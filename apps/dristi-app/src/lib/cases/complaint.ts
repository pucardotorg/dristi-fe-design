/**
 * Complaint — the pleaded record, as filed.
 *
 * Four sections and their order are fixed (the live Complaint tab). This
 * is a structured read of that record, linked to papers in the Case file.
 * It is not the filing wizard and it does not calculate limitation.
 *
 * Values come from the dummy pack (`complaint-dummy.json`). Labels follow
 * Laws sentence case. Statutory short forms (BNSS) stay as written.
 */
import pack from "./complaint-dummy.json";
import {
  CASE_FILE_TREE,
  caseFileDocHref,
  caseFilePdfSrc,
  findNode as findCaseFileNode,
} from "./case-file";
import { formatChequeAmount } from "./peek";
import { caseSectionHref } from "./sections";
import { formatCaseDate } from "./types";
import type { Address } from "@/lib/filing/types";

export type ComplaintNode = {
  id: string;
  /** Outline number: "1", "2.1". */
  number: string;
  label: string;
  /** An identifier the label names — a cheque's own number. Apart, so it can be set as one. */
  labelId?: string;
  children?: ComplaintNode[];
};

export type ComplaintField = {
  term: string;
  value: string;
  /** Missing / not uploaded / not applicable — muted, still a row. */
  empty?: boolean;
  /**
   * A unique identifier — an IFSC, a filing id, an exhibit code. Read character by
   * character and transcribed elsewhere, so it is set as one (`chrome/identifier.tsx`).
   */
  id?: true;
};

export type ComplaintBlock = {
  title: string;
  body: string;
};

export type ComplaintPerson = {
  title: string;
  detail: string;
};

export type ComplaintDocument = {
  id: string;
  label: string;
  /** Case file leaf — used to preview the PDF and to open the full file. */
  caseFileDocId?: string;
};

export type ComplaintPane = {
  title: string;
  /** An identifier the title names — a cheque's own number. Apart, so it can be set as one. */
  titleId?: string;
  badges?: string[];
  /** Scope note — accused joinder only, so far. */
  notice?: string;
  fields?: ComplaintField[];
  blocks?: ComplaintBlock[];
  people?: ComplaintPerson[];
  documents?: ComplaintDocument[];
};

type PackDoc = {
  documentId: string;
  name: string;
  status?: string;
  file?: string | null;
};

type PackDate = { value: string; display: string };
type PackMoney = { value: number; currency: string; display: string };

type PackParty = {
  partyId: string;
  name: string;
  partyType: string;
  role: string;
  mobileNumber?: string;
  emailId?: string;
  age?: number;
  representedBy?: { name: string; capacity: string; age?: number };
  appearanceMode?: string;
  policeStation?: string;
  idProof?: { type: string; maskedNumber: string; status: string };
  companyDocuments?: { applicable: boolean; documents: PackDoc[] };
  address: {
    line1: string;
    locality: string;
    district: string;
    state: string;
    pincode: string;
  };
  currentResidentialAddress?: { sameAsAddress: boolean };
  powerOfAttorneyTransferred: boolean;
  documents?: PackDoc[];
};

type PackCheque = {
  chequeId: string;
  chequeNumber: string;
  nameOfSignatoryOfDishonouredCheque: string;
  payeeNameOnCheque: string;
  payeeBankName: string;
  payeeBankBranchName: string;
  payeeIfscCode: string;
  dateOfCheque: PackDate;
  payerBankName: string;
  payerBankBranchName: string;
  payerIfscCode: string;
  chequeAmount: PackMoney;
  policeStationWithJurisdictionOverChequeDepositBank: string;
  dateOfDeposit: PackDate;
  dateOfReturnAsPerChequeReturnMemo: PackDate;
  reasonForReturn: string;
  additionalDetails?: string;
  confirmations: { statement: string; confirmed: boolean }[];
  documents: PackDoc[];
};

type PackNotice = {
  noticeId: string;
  dateOfNotice: PackDate;
  dateOfDispatch: PackDate;
  dateOfServiceOrDeemedService: PackDate;
  dateOfReply: PackDate;
  dateWhenFifteenDaysFromServiceWasComplete: PackDate;
  replySummary: string;
  documents: PackDoc[];
};

type PackWitness = {
  witnessId: string;
  sequence: number;
  name: string;
  witnessType: string;
  description: string;
  summonsRequired: boolean;
};

type PackAdvocate = {
  advocateId: string;
  name: string;
  barRegistration: string;
  emailId?: string;
  isLeadAdvocate: boolean;
  idProofStatus?: string;
};

type PackSubmission = {
  submissionId: string;
  submittedBy: string;
  submittedOn: PackDate;
  status: string;
  appearanceMode: string;
  partyDetailsConfirmed: boolean;
  serviceAddressConfirmed: boolean;
  authorisedRepresentative: string;
  documents: PackDoc[];
};

/** Pack documentId → Case file leaf, when the PDF is in the dummy pack. */
const CASE_FILE_BY_DOC: Record<string, string> = {
  "DOC-INI-001": "legal-demand-notice",
  "DOC-INI-002": "proof-of-dispatch",
  "DOC-INI-003": "dishonoured-cheque",
  "DOC-INI-004": "cheque-return-memo",
  "DOC-AFF-001": "affidavit-223-bnss",
  "DOC-AFF-002": "affidavit-225-bnss",
  "DOC-COM-001": "complaint",
  "DOC-VAK-002": "vakalatnama-1",
  "DOC-VAK-003": "vakalatnama-2",
};

export function isComplaintFolder(node: ComplaintNode): boolean {
  return node.children !== undefined;
}

export function fileNumberLabel(number: string): string {
  return number.includes(".") ? number : `${number}.`;
}

export function flattenLeaves(nodes: ComplaintNode[]): ComplaintNode[] {
  const leaves: ComplaintNode[] = [];
  for (const node of nodes) {
    if (isComplaintFolder(node)) {
      leaves.push(...flattenLeaves(node.children ?? []));
    } else {
      leaves.push(node);
    }
  }
  return leaves;
}

export function findNode(
  nodes: ComplaintNode[],
  id: string
): ComplaintNode | undefined {
  for (const node of nodes) {
    if (node.id === id) return node;
    if (node.children) {
      const found = findNode(node.children, id);
      if (found) return found;
    }
  }
  return undefined;
}

export function findPath(
  nodes: ComplaintNode[],
  id: string,
  trail: ComplaintNode[] = []
): ComplaintNode[] | undefined {
  for (const node of nodes) {
    const next = [...trail, node];
    if (node.id === id) return next;
    if (node.children) {
      const found = findPath(node.children, id, next);
      if (found) return found;
    }
  }
  return undefined;
}

export function ancestorIds(nodes: ComplaintNode[], id: string): string[] {
  const path = findPath(nodes, id);
  if (!path || path.length < 2) return [];
  return path.slice(0, -1).map((node) => node.id);
}

export function firstLeaf(nodes: ComplaintNode[]): ComplaintNode | undefined {
  return flattenLeaves(nodes)[0];
}

export function parseComplaintPart(
  value: string | string[] | undefined,
  tree: ComplaintNode[]
): string {
  const raw = Array.isArray(value) ? value[0] : value;
  const leaves = flattenLeaves(tree);
  if (raw && leaves.some((node) => node.id === raw)) return raw;
  return firstLeaf(tree)?.id ?? "";
}

export function complaintPartHref(caseId: string, partId: string): string {
  const base = caseSectionHref(caseId, "complaint");
  const join = base.includes("?") ? "&" : "?";
  return `${base}${join}part=${partId}`;
}

export function complaintDocumentHref(
  caseId: string,
  doc: ComplaintDocument
): string | undefined {
  return doc.caseFileDocId
    ? caseFileDocHref(caseId, doc.caseFileDocId)
    : undefined;
}

/** Same PDF the Case file viewer opens, including the child-document page. */
export function complaintDocumentSrc(
  doc: ComplaintDocument
): string | undefined {
  if (!doc.caseFileDocId) return undefined;
  const node = findCaseFileNode(CASE_FILE_TREE, doc.caseFileDocId);
  return node ? caseFilePdfSrc(node) : undefined;
}

function field(term: string, value: string): ComplaintField {
  return { term, value };
}

/** The same row for a value that is an identifier rather than prose. */
function idField(term: string, value: string): ComplaintField {
  return { term, value, id: true };
}

function empty(
  term: string,
  value: "Not provided" | "Not uploaded" | "Not applicable" | "Not filed"
): ComplaintField {
  return { term, value, empty: true };
}

function yesNo(value: boolean): string {
  return value ? "Yes" : "No";
}

function on(date: PackDate): string {
  return date.display || formatCaseDate(date.value);
}

function money(amount: PackMoney): string {
  return formatChequeAmount(amount.value);
}

function address(party: PackParty["address"]): string {
  return `${party.line1}, ${party.locality}, ${party.district}, ${party.state} - ${party.pincode}`;
}

function packDocs(docs: PackDoc[] | undefined): ComplaintDocument[] {
  return (docs ?? []).map((doc) => ({
    id: doc.documentId,
    label: doc.name,
    caseFileDocId:
      doc.file && CASE_FILE_BY_DOC[doc.documentId]
        ? CASE_FILE_BY_DOC[doc.documentId]
        : undefined,
  }));
}

function partyPane(party: PackParty): ComplaintPane {
  const company = party.companyDocuments;
  const fields: ComplaintField[] = [];

  if (party.representedBy) {
    fields.push(
      field(
        "Represented by",
        `${party.representedBy.name}, ${party.representedBy.capacity.toLowerCase()}`
      )
    );
    if (party.representedBy.age !== undefined) {
      fields.push(field("Age", String(party.representedBy.age)));
    }
  }
  if (party.appearanceMode) {
    fields.push(field("Appearance", party.appearanceMode));
  }
  fields.push(
    party.mobileNumber
      ? field("Mobile", party.mobileNumber)
      : empty("Mobile", "Not provided")
  );
  fields.push(
    party.emailId
      ? field("Email", party.emailId)
      : empty("Email", "Not provided")
  );
  if (!party.representedBy) {
    fields.push(
      party.age !== undefined
        ? field("Age", String(party.age))
        : empty("Age", "Not provided")
    );
  }
  if (party.idProof) {
    fields.push(
      field(
        "ID proof",
        `${party.idProof.type} · ${party.idProof.maskedNumber} · ${party.idProof.status}`
      )
    );
  }
  if (company) {
    fields.push(
      company.applicable
        ? field(
            "Company documents",
            company.documents.map((doc) => doc.name).join("; ")
          )
        : empty("Company documents", "Not applicable")
    );
  }
  fields.push(field("Address", address(party.address)));
  if (party.currentResidentialAddress) {
    fields.push(
      field(
        "Residence",
        party.currentResidentialAddress.sameAsAddress
          ? "Same as address"
          : "Not provided"
      )
    );
  }
  if (party.policeStation) {
    fields.push(field("Police station", party.policeStation));
  }
  fields.push(
    field("Power of attorney", yesNo(party.powerOfAttorneyTransferred))
  );

  return {
    title: party.name,
    badges: [party.role, party.partyType],
    fields,
    documents: packDocs([
      ...(company?.applicable ? company.documents : []),
      ...(party.documents ?? []),
    ]),
  };
}

function chequePane(cheque: PackCheque): ComplaintPane {
  return {
    title: "Cheque number",
    titleId: cheque.chequeNumber,
    fields: [
      field("Signatory", cheque.nameOfSignatoryOfDishonouredCheque),
      field("Payee", cheque.payeeNameOnCheque),
      field("Payee bank", cheque.payeeBankName),
      field("Payee branch", cheque.payeeBankBranchName),
      idField("Payee IFSC", cheque.payeeIfscCode),
      field("Date of cheque", on(cheque.dateOfCheque)),
      field("Payer bank", cheque.payerBankName),
      field("Payer branch", cheque.payerBankBranchName),
      idField("Payer IFSC", cheque.payerIfscCode),
      field("Amount", money(cheque.chequeAmount)),
      field(
        "Jurisdiction",
        cheque.policeStationWithJurisdictionOverChequeDepositBank
      ),
      field("Date of deposit", on(cheque.dateOfDeposit)),
      field("Date of return", on(cheque.dateOfReturnAsPerChequeReturnMemo)),
      field("Reason for return", cheque.reasonForReturn),
      cheque.additionalDetails
        ? field("Additional details", cheque.additionalDetails)
        : empty("Additional details", "Not provided"),
      ...cheque.confirmations.map((item) =>
        field(item.statement, yesNo(item.confirmed))
      ),
    ],
    documents: packDocs(cheque.documents),
  };
}

function packSection(id: string) {
  const section = pack.sections.find((item) => item.id === id);
  if (!section) {
    throw new Error(`Complaint dummy is missing section ${id}.`);
  }
  return section;
}

function packGroups(id: string) {
  const section = packSection(id);
  if (!section.groups) {
    throw new Error(`Complaint dummy section ${id} has no groups.`);
  }
  return section.groups;
}

const complainantGroup = packGroups("litigantDetails")[0] as {
  parties: PackParty[];
};
const accusedGroup = packGroups("litigantDetails")[1] as { parties: PackParty[] };
const chequeGroup = packGroups("caseSpecificDetails")[0] as {
  cheques: PackCheque[];
};
const debtGroup = packGroups("caseSpecificDetails")[1] as {
  natureOfDebtLiability: string;
  underlyingTransaction: string;
  liabilityCoverage: string;
  amountCoveredByCheque: PackMoney;
  additionalDetails: string;
  documents: PackDoc[];
};
const noticeGroup = packGroups("caseSpecificDetails")[2] as {
  notices: PackNotice[];
};
const delayGroup = packGroups("caseSpecificDetails")[3] as {
  filedWithinOneMonthOfAccrualOfCauseOfAction: boolean;
  applicationRequired: boolean;
  application: PackDoc | null;
  displayState: string;
};
const extraGroup = packGroups("caseSpecificDetails")[4] as { value: string };
const witnessGroup = packGroups("additionalDetails")[0] as {
  witnesses: PackWitness[];
};
const complaintGroup = packGroups("additionalDetails")[1] as {
  synopsis: string;
  complaint: string;
  affidavitUnderSection223Bnss: PackDoc;
  prayer: string;
  additionalDetails: string;
  documents: PackDoc[];
};
const advocateGroup = packGroups("additionalDetails")[2] as {
  forParty: string;
  numberOfAdvocates: number;
  advocates: PackAdvocate[];
  vakalatnama: PackDoc;
};
const joinSection = packSection("submissionsFromAccused") as {
  id: string;
  info: string;
  submissions: PackSubmission[];
};

function buildTree(): ComplaintNode[] {
  const complainants = complainantGroup.parties.map((party, index) => ({
    id: party.partyId,
    number: `1.${index + 1}`,
    label: `Complainant — ${party.name}`,
  }));
  const accusedStart = complainants.length;
  const accused = accusedGroup.parties.map((party, index) => ({
    id: party.partyId,
    number: `1.${accusedStart + index + 1}`,
    label: `Accused — ${party.name}`,
  }));
  const cheques = chequeGroup.cheques.map((cheque, index) => ({
    id: cheque.chequeId,
    number: `2.${index + 1}`,
    label: "Cheque number",
    labelId: cheque.chequeNumber,
  }));
  let caseSpecificN = cheques.length;
  const submissions = joinSection.submissions.map((item, index) => ({
    id: item.submissionId,
    number: `4.${index + 1}`,
    label: item.submittedBy,
  }));

  return [
    {
      id: "litigantDetails",
      number: "1",
      label: "Litigant details",
      children: [...complainants, ...accused],
    },
    {
      id: "caseSpecificDetails",
      number: "2",
      label: "Case specific details",
      children: [
        ...cheques,
        {
          id: "debtLiabilityDetails",
          number: `2.${++caseSpecificN}`,
          label: "Debt / liability",
        },
        ...noticeGroup.notices.map((notice, index) => {
          caseSpecificN += 1;
          return {
            id: notice.noticeId,
            number: `2.${caseSpecificN}`,
            label:
              noticeGroup.notices.length === 1
                ? "Legal demand notice"
                : `Legal demand notice ${index + 1}`,
          };
        }),
        {
          id: "delayCondonationApplication",
          number: `2.${++caseSpecificN}`,
          label: "Delay condonation",
        },
        {
          id: "additionalInformation",
          number: `2.${++caseSpecificN}`,
          label: "Additional information",
        },
      ],
    },
    {
      id: "additionalDetails",
      number: "3",
      label: "Additional details",
      children: [
        { id: "witnessDetails", number: "3.1", label: "Witnesses" },
        { id: "complaintNarrative", number: "3.2", label: "Complaint" },
        { id: "advocateDetails", number: "3.3", label: "Advocates" },
      ],
    },
    {
      id: "submissionsFromAccused",
      number: "4",
      label: "Submissions from accused",
      children: submissions,
    },
  ];
}

function buildPanes(): Record<string, ComplaintPane> {
  const panes: Record<string, ComplaintPane> = {};

  for (const party of complainantGroup.parties) {
    panes[party.partyId] = partyPane(party);
  }
  for (const party of accusedGroup.parties) {
    panes[party.partyId] = partyPane(party);
  }
  for (const cheque of chequeGroup.cheques) {
    panes[cheque.chequeId] = chequePane(cheque);
  }

  panes.debtLiabilityDetails = {
    title: "Debt / liability",
    fields: [
      field("Nature of debt", debtGroup.natureOfDebtLiability),
      field("Transaction", debtGroup.underlyingTransaction),
      field("Liability", debtGroup.liabilityCoverage),
      field("Amount covered", money(debtGroup.amountCoveredByCheque)),
      field("Additional details", debtGroup.additionalDetails),
    ],
    documents: packDocs(debtGroup.documents),
  };

  for (const notice of noticeGroup.notices) {
    panes[notice.noticeId] = {
      title: "Legal demand notice",
      fields: [
        field("Date of notice", on(notice.dateOfNotice)),
        field("Date of dispatch", on(notice.dateOfDispatch)),
        field("Date of service", on(notice.dateOfServiceOrDeemedService)),
        field("Date of reply", on(notice.dateOfReply)),
        field(
          "Fifteen days from service",
          on(notice.dateWhenFifteenDaysFromServiceWasComplete)
        ),
        field("Reply", notice.replySummary),
      ],
      documents: packDocs(notice.documents),
    };
  }

  panes.delayCondonationApplication = {
    title: "Delay condonation",
    fields: [
      field(
        "Filed within one month",
        yesNo(delayGroup.filedWithinOneMonthOfAccrualOfCauseOfAction)
      ),
      delayGroup.application == null
        ? empty("Application", "Not filed")
        : field("Application", "Filed"),
    ],
    blocks: [{ title: "As filed", body: delayGroup.displayState }],
  };

  panes.additionalInformation = {
    title: "Additional information",
    blocks: [{ title: "As filed", body: extraGroup.value }],
  };

  panes.witnessDetails = {
    title: "Witnesses",
    people: witnessGroup.witnesses.map((witness) => ({
      title: `PW-${witness.sequence} ${witness.name}`,
      detail: `${witness.witnessType}. ${witness.description} ${
        witness.summonsRequired ? "Summons required." : "Summons not required."
      }`,
    })),
  };

  panes.complaintNarrative = {
    title: "Complaint",
    blocks: [
      { title: "Synopsis", body: complaintGroup.synopsis },
      { title: "Complaint", body: complaintGroup.complaint },
      { title: "Prayer", body: complaintGroup.prayer },
      { title: "Additional details", body: complaintGroup.additionalDetails },
    ],
    documents: packDocs([
      ...complaintGroup.documents,
      complaintGroup.affidavitUnderSection223Bnss,
    ]),
  };

  panes.advocateDetails = {
    title: "Advocates",
    fields: [
      field("For", advocateGroup.forParty),
      field("Number of advocates", String(advocateGroup.numberOfAdvocates)),
    ],
    people: advocateGroup.advocates.map((advocate) => ({
      title: advocate.name,
      detail: [
        advocate.barRegistration,
        advocate.isLeadAdvocate ? "Lead advocate" : "Additional advocate",
        advocate.emailId,
        advocate.idProofStatus
          ? `ID proof ${advocate.idProofStatus.toLowerCase()}`
          : undefined,
      ]
        .filter(Boolean)
        .join(" · "),
    })),
    documents: packDocs([advocateGroup.vakalatnama]),
  };

  for (const submission of joinSection.submissions) {
    panes[submission.submissionId] = {
      title: submission.submittedBy,
      notice: joinSection.info,
      fields: [
        field("Submitted by", submission.submittedBy),
        field("Submitted on", on(submission.submittedOn)),
        field("Status", submission.status),
        field("Appearance", submission.appearanceMode),
        field("Party details", yesNo(submission.partyDetailsConfirmed)),
        field("Service address", yesNo(submission.serviceAddressConfirmed)),
        field("Representative", submission.authorisedRepresentative),
      ],
      documents: packDocs(submission.documents),
    };
  }

  return panes;
}

export const COMPLAINT_TREE: ComplaintNode[] = buildTree();
const COMPLAINT_PANES = buildPanes();

/** Dummy pack is the Sunil Varghese v. Anand Traders review case. */
export function complaintTree(caseId: string): ComplaintNode[] {
  return caseId === "c-1001" ? COMPLAINT_TREE : [];
}

export function complaintPane(
  caseId: string,
  partId: string
): ComplaintPane | undefined {
  if (caseId !== "c-1001") return undefined;
  return COMPLAINT_PANES[partId];
}

/**
 * Each accused's address as the complaint records it, for forms that prefill
 * from the case file (Warrant by Hand's address for delivery). Only the
 * review case carries a complaint; every other case returns nothing.
 */
export function accusedAddressesOnFile(
  caseId: string
): { name: string; address: Address }[] {
  if (caseId !== "c-1001") return [];
  return accusedGroup.parties.map((party) => ({
    name: party.name,
    address: {
      line1: party.address.line1,
      city: party.address.locality,
      pin: party.address.pincode,
      district: party.address.district,
      state: party.address.state,
    },
  }));
}
