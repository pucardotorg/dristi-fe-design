/**
 * Documents — the case register of individual files. This is not the
 * compiled Case file, an application packet, a hearing, or an order.
 * Bail bonds are a sibling population of that register, not a type
 * filter.
 *
 * Featured dummy content comes from `documents-dummy.json`. Labels follow
 * Laws sentence case; statutory short forms (BNSS, PW-1, NI Act) stay as
 * written.
 */
import pack from "./documents-dummy.json";
import { counselFor, type CaseRecord, type Parties } from "./types";
import type { ApplicationRecord } from "./application-record";

/** Mutually exclusive populations on the documents register. */
export type DocumentKind = "documents" | "bail-bonds";

export type DocumentGroupId =
  | "complaint-pack"
  | "affidavits"
  | "memos"
  | "exhibits"
  | "witness-records"
  | "court-forms"
  | "bail-bonds";

/** Register document heads — submission-flow buckets live in applications.ts. */
export type DocumentTypeId =
  | "legal-demand-notice"
  | "proof-of-dispatch"
  | "dishonoured-cheque"
  | "cheque-return-memo"
  | "vakalatnama"
  | "party-in-person-affidavit"
  | "affidavit-223-bnss"
  | "affidavit-225-bnss"
  | "affidavit-145-ni"
  | "affidavit"
  | "memo"
  | "account-records"
  | "proof-of-debt-or-liability"
  | "proof-of-deposit-of-cheque"
  | "exhibit-index"
  | "documentary"
  | "witness-deposition"
  | "plea-record"
  | "questionnaire-351-bnss"
  | "mediation"
  | "bail-bond";

export type DocumentSourceId =
  | "case-filing"
  | "application"
  | "hearing"
  | "court"
  | "submission";

/**
 * Filing-workflow values — not evidence state. The register once shared the
 * Applications workflow outright; Applications now carries the court's
 * lifecycle (Application Lifecycle PRD), which a document does not go
 * through, so the two lists are separate. This one keeps the Document
 * Execution step: every party has signed and the document is with the
 * magistrate.
 */
export type DocumentStatus =
  | "draft"
  | "pending-signature"
  | "pending-review"
  | "pending-payment"
  | "completed"
  | "rejected"
  | "expired";

/** Court treatment after the document submission workflow is complete. */
export type EvidenceStatus = "marked" | "void";

export const DOCUMENT_KINDS: { id: DocumentKind; label: string }[] = [
  { id: "documents", label: "Documents" },
  { id: "bail-bonds", label: "Bail bonds" },
];

export const DOCUMENT_GROUPS: { id: DocumentGroupId; label: string }[] = [
  { id: "complaint-pack", label: "Complaint pack" },
  { id: "affidavits", label: "Affidavits" },
  { id: "memos", label: "Memos" },
  { id: "exhibits", label: "Exhibits" },
  { id: "witness-records", label: "Witness records" },
  { id: "court-forms", label: "Court forms" },
  { id: "bail-bonds", label: "Bail bonds" },
];

/** Register document heads — submission-flow buckets live in applications.ts. */
export const DOCUMENT_TYPES: {
  id: DocumentTypeId;
  label: string;
  groupId: DocumentGroupId;
}[] = [
  {
    id: "legal-demand-notice",
    label: "Legal demand notice",
    groupId: "complaint-pack",
  },
  {
    id: "proof-of-dispatch",
    label: "Proof of dispatch of legal demand notice",
    groupId: "complaint-pack",
  },
  {
    id: "dishonoured-cheque",
    label: "Dishonoured cheque",
    groupId: "complaint-pack",
  },
  {
    id: "cheque-return-memo",
    label: "Cheque return memo",
    groupId: "complaint-pack",
  },
  { id: "vakalatnama", label: "Vakalatnama", groupId: "complaint-pack" },
  {
    id: "party-in-person-affidavit",
    label: "Party-in-person affidavit",
    groupId: "complaint-pack",
  },
  {
    id: "affidavit-223-bnss",
    label: "Affidavit under section 223 BNSS",
    groupId: "affidavits",
  },
  {
    id: "affidavit-225-bnss",
    label: "Affidavit under section 225 BNSS",
    groupId: "affidavits",
  },
  {
    id: "affidavit-145-ni",
    label: "Affidavit under section 145 of the Negotiable Instruments Act",
    groupId: "affidavits",
  },
  /* Filed during the case through the document submission flow (memos and
     affidavits; PM, Oct 8): the pack names no finer type. */
  { id: "affidavit", label: "Affidavit", groupId: "affidavits" },
  { id: "memo", label: "Memo", groupId: "memos" },
  {
    id: "account-records",
    label: "Account records",
    groupId: "exhibits",
  },
  {
    id: "proof-of-debt-or-liability",
    label: "Proof of debt or liability",
    groupId: "exhibits",
  },
  {
    id: "proof-of-deposit-of-cheque",
    label: "Proof of deposit of cheque",
    groupId: "exhibits",
  },
  { id: "exhibit-index", label: "Exhibit index", groupId: "exhibits" },
  { id: "documentary", label: "Documentary", groupId: "exhibits" },
  {
    id: "witness-deposition",
    label: "Witness deposition",
    groupId: "witness-records",
  },
  { id: "plea-record", label: "Plea record", groupId: "court-forms" },
  {
    id: "questionnaire-351-bnss",
    label: "Questionnaire under section 351 BNSS",
    groupId: "court-forms",
  },
  { id: "mediation", label: "Mediation", groupId: "court-forms" },
  { id: "bail-bond", label: "Bail bond", groupId: "bail-bonds" },
];

export const DOCUMENT_SOURCES: { id: DocumentSourceId; label: string }[] = [
  { id: "case-filing", label: "Case filing" },
  { id: "application", label: "Application" },
  { id: "hearing", label: "Hearing" },
  { id: "court", label: "Court" },
  { id: "submission", label: "Document submission" },
];

/**
 * The register's own status list: the filing steps, Pending review (between
 * signature and the magistrate's decision), and the endings.
 */
export const DOCUMENT_STATUSES: { id: DocumentStatus; label: string }[] = [
  { id: "draft", label: "Draft" },
  { id: "pending-signature", label: "Pending signature" },
  { id: "pending-review", label: "Pending review" },
  { id: "pending-payment", label: "Pending payment" },
  { id: "completed", label: "Completed" },
  { id: "rejected", label: "Rejected" },
  { id: "expired", label: "Expired" },
];

export function documentTypeLabel(id: DocumentTypeId): string {
  return DOCUMENT_TYPES.find((item) => item.id === id)?.label ?? id;
}

export function documentGroupLabel(id: DocumentGroupId): string {
  return DOCUMENT_GROUPS.find((item) => item.id === id)?.label ?? id;
}

export function documentTypeGroup(id: DocumentTypeId): DocumentGroupId {
  return DOCUMENT_TYPES.find((item) => item.id === id)?.groupId ?? "exhibits";
}

export function documentKind(type: DocumentTypeId): DocumentKind {
  return documentTypeGroup(type) === "bail-bonds" ? "bail-bonds" : "documents";
}

export function isDocumentKind(value: string): value is DocumentKind {
  return DOCUMENT_KINDS.some((item) => item.id === value);
}

export function documentKindTitle(kind: DocumentKind): string {
  return DOCUMENT_KINDS.find((item) => item.id === kind)?.label ?? kind;
}

export function isDocumentTypeId(value: string): value is DocumentTypeId {
  return DOCUMENT_TYPES.some((item) => item.id === value);
}

export function documentSourceLabel(id: DocumentSourceId): string {
  return DOCUMENT_SOURCES.find((item) => item.id === id)?.label ?? id;
}

export function documentStatusLabel(status: DocumentStatus): string {
  return DOCUMENT_STATUSES.find((item) => item.id === status)?.label ?? status;
}

/**
 * Completed carries the success tint (the same one it had when this list was
 * shared with Applications); every
 * colour remains paired with text. Pending states stay in the amber family.
 * This register has no Needs-attention pinning the way Applications does,
 * so amber here reads "in flight" rather than "you owe a step" — Pending
 * review is waiting on the magistrate, not on you (Laws: colour is never
 * the only carrier).
 */
export function documentStatusVariant(
  status: DocumentStatus
): "warning" | "destructive" | "secondary" | "success" {
  if (status === "rejected") return "destructive";
  if (status === "expired") return "secondary";
  if (status === "completed") return "success";
  return "warning";
}

export type DocumentPerson = {
  id: string;
  name: string;
  role: string;
  filterLabel: string;
};

export type LinkedRecord = {
  id: string;
  label: string;
};

export type CaseDocument = {
  id: string;
  /** The registry's own identifier for the filing — what the search matches. */
  filingId: string;
  title: string;
  type: DocumentTypeId;
  submissionStatus: DocumentStatus;
  submittedOn: string;
  submittedById: string;
  source: DocumentSourceId;
  linkedApplication: LinkedRecord | null;
  linkedHearing: LinkedRecord | null;
  evidenceNumber: string | null;
  evidenceStatus: EvidenceStatus | null;
  href?: string;
  page?: number;
};

export type DocumentsFile = {
  caseNumber: string;
  parties: Parties;
  court: string;
  people: DocumentPerson[];
  documents: CaseDocument[];
};

export function personIdentity(person: DocumentPerson): string {
  const [left] = person.filterLabel.split(" — ");
  return left?.trim() || person.name;
}

export function submittedByName(
  document: CaseDocument,
  peopleById: Map<string, DocumentPerson>
): string {
  const person = peopleById.get(document.submittedById);
  return person ? personIdentity(person) : document.submittedById;
}

export function submittedByRole(
  document: CaseDocument,
  peopleById: Map<string, DocumentPerson>
): string {
  return peopleById.get(document.submittedById)?.role ?? "";
}

/**
 * Table shows the party side. Advocate name is the hover/focus detail.
 * Accused is matched first so "Accused counsel" is not read as complainant.
 */
export function submittedBySideLabel(
  document: CaseDocument,
  peopleById: Map<string, DocumentPerson>
): string {
  const role =
    peopleById.get(document.submittedById)?.role.toLowerCase() ?? "";
  if (role.includes("accused")) return "Accused";
  if (role.includes("complainant")) return "Complainant";
  return submittedByName(document, peopleById);
}

export function documentSrc(document: CaseDocument): string | undefined {
  if (!document.href) return undefined;
  return document.page ? `${document.href}#page=${document.page}` : document.href;
}

export function evidenceStatusLabel(status: EvidenceStatus): string {
  return status === "marked" ? "Marked" : "Void";
}

function typeFromPack(label: string): DocumentTypeId {
  const normalized = label.trim().toLowerCase();
  const match = DOCUMENT_TYPES.find(
    (item) => item.label.toLowerCase() === normalized
  );
  if (!match) {
    throw new Error(`Unknown document type in dummy pack: ${label}`);
  }
  return match.id;
}

function sourceFromPack(label: string): DocumentSourceId {
  const normalized = label.trim().toLowerCase();
  const match = DOCUMENT_SOURCES.find(
    (item) => item.label.toLowerCase() === normalized
  );
  if (!match) {
    throw new Error(`Unknown document source in dummy pack: ${label}`);
  }
  return match.id;
}

function submissionStatusFromPack(value: string): DocumentStatus {
  const normalized = value.trim().toLowerCase();
  const match = DOCUMENT_STATUSES.find(
    (item) => item.label.toLowerCase() === normalized
  );
  if (!match) {
    throw new Error(`Unknown document status in dummy pack: ${value}`);
  }
  return match.id;
}

function evidenceStatusFromPack(value: string | null): EvidenceStatus | null {
  if (!value) return null;
  const normalized = value.trim().toLowerCase();
  if (normalized === "marked") return "marked";
  if (normalized === "void") return "void";
  throw new Error(`Unknown evidence status in dummy pack: ${value}`);
}

function linkedFromPack(
  value: { id: string; label: string } | undefined
): LinkedRecord | null {
  if (!value) return null;
  return { id: value.id, label: value.label };
}

function featuredPeople(): DocumentPerson[] {
  return pack.people.map((item) => {
    const [left, role] = item.label.split(" — ");
    const name = left.split(",")[0]?.trim() ?? left;
    return {
      id: item.id,
      name,
      role: role ?? "",
      filterLabel: item.label,
    };
  });
}

/**
 * A pack row, whether it comes from the featured case's register or from an
 * `extraCases` entry. Spelled out rather than inferred off the JSON because
 * the two sources carry different optional fields and both must parse
 * through the same throwing validators.
 */
type PackDocumentRow = {
  filingId: string;
  title: string;
  type: string;
  submissionStatus: string;
  submittedOn: string;
  submittedById: string;
  source: string;
  evidenceNumber: string | null;
  evidenceStatus: string | null;
  linkedApplication?: { id: string; label: string } | null;
  linkedHearing?: { id: string; label: string } | null;
  href?: string;
  page?: number;
};

function documentFromPack(row: PackDocumentRow): CaseDocument {
  return {
    id: row.filingId,
    filingId: row.filingId,
    title: row.title.trim() || documentTypeLabel(typeFromPack(row.type)),
    type: typeFromPack(row.type),
    submissionStatus: submissionStatusFromPack(row.submissionStatus),
    submittedOn: row.submittedOn,
    submittedById: row.submittedById,
    source: sourceFromPack(row.source),
    linkedApplication: linkedFromPack(row.linkedApplication ?? undefined),
    linkedHearing: linkedFromPack(row.linkedHearing ?? undefined),
    evidenceNumber: row.evidenceNumber,
    evidenceStatus: evidenceStatusFromPack(row.evidenceStatus),
    // Defensive: href and page are optional on a pack row — a file-less
    // register entry stays representable.
    href: row.href,
    page: row.page,
  };
}

function featuredFile(record: CaseRecord): DocumentsFile {
  return {
    caseNumber: record.caseNumber,
    parties: record.parties,
    court: pack.case.court,
    people: featuredPeople(),
    documents: (pack.documents as PackDocumentRow[]).map(documentFromPack),
  };
}

/**
 * Registers for the non-featured cases, keyed by fixture id. Their rows name
 * people by the generated ids `peopleFrom` produces (`<case>-complainant`,
 * `<case>-counsel-c-0`, …), so populating a case here needs no people
 * authoring — the fixture's own cause title and counsel stay the one source.
 */
const EXTRA_PACKS = pack.extraCases as Record<
  string,
  PackDocumentRow[] | undefined
>;

function peopleFrom(record: CaseRecord): DocumentPerson[] {
  const people: DocumentPerson[] = [
    {
      id: `${record.id}-complainant`,
      name: record.parties.complainant,
      role: "Complainant",
      filterLabel: `${record.parties.complainant} — Complainant`,
    },
    {
      id: `${record.id}-accused`,
      name: record.parties.accused,
      role: "Accused",
      filterLabel: `${record.parties.accused} — Accused`,
    },
  ];

  counselFor(record, "complainant").forEach((name, index) => {
    people.push({
      id: `${record.id}-counsel-c-${index}`,
      name,
      role: "Complainant counsel",
      filterLabel: `${name} — Complainant counsel`,
    });
  });
  counselFor(record, "accused").forEach((name, index) => {
    people.push({
      id: `${record.id}-counsel-a-${index}`,
      name,
      role: "Accused counsel",
      filterLabel: `${name} — Accused counsel`,
    });
  });

  return people;
}

const FEATURED_CASE_ID = "c-1001";

export function documentsFile(record: CaseRecord): DocumentsFile {
  if (record.id === FEATURED_CASE_ID) return featuredFile(record);
  return {
    caseNumber: record.caseNumber,
    parties: record.parties,
    court: record.court,
    people: peopleFrom(record),
    documents: (EXTRA_PACKS[record.id] ?? []).map(documentFromPack),
  };
}

export const DOCUMENTS_PAGE_SIZES = [10, 20, 30, 40, 50] as const;
export type DocumentsPageSize = (typeof DOCUMENTS_PAGE_SIZES)[number];
export const DOCUMENTS_PAGE_SIZE: DocumentsPageSize = 10;

export function isDocumentsPageSize(
  value: number
): value is DocumentsPageSize {
  return (DOCUMENTS_PAGE_SIZES as readonly number[]).includes(value);
}

export type DocumentsSelection = {
  rows: CaseDocument[];
  total: number;
  page: number;
  pageCount: number;
  from: number;
  to: number;
  documentsCount: number;
  bailBondsCount: number;
};

export function selectDocuments(options: {
  documents: CaseDocument[];
  kind: DocumentKind;
  typeId: DocumentTypeId | null;
  submittedById: string | null;
  /** Case-insensitive filing-id fragment; empty/whitespace means no search. */
  filingQuery?: string;
  /** A pager size, or any count when the list grows by "Show more". */
  pageSize: number;
  page: number;
}): DocumentsSelection {
  const query = options.filingQuery?.trim().toLowerCase() ?? "";
  const shared = options.documents.filter((document) => {
    if (
      options.submittedById &&
      document.submittedById !== options.submittedById
    ) {
      return false;
    }
    // The search spans both registers, like the submitter filter, so the
    // group-tab counts answer "where did my match land".
    if (query && !document.filingId.toLowerCase().includes(query)) {
      return false;
    }
    return true;
  });

  const documentsCount = shared.filter(
    (item) => documentKind(item.type) === "documents"
  ).length;
  const bailBondsCount = shared.length - documentsCount;

  const matched = shared.filter((document) => {
    if (documentKind(document.type) !== options.kind) return false;
    if (options.typeId && document.type !== options.typeId) return false;
    return true;
  });

  const sorted = [...matched].sort((a, b) => {
    const byDate = b.submittedOn.localeCompare(a.submittedOn);
    return byDate !== 0 ? byDate : b.id.localeCompare(a.id);
  });

  const pageSize = options.pageSize;
  const pageCount = Math.max(1, Math.ceil(sorted.length / pageSize));
  const page = Math.min(options.page, pageCount);
  const start = (page - 1) * pageSize;
  const rows = sorted.slice(start, start + pageSize);

  return {
    rows,
    total: sorted.length,
    page,
    pageCount,
    from: sorted.length === 0 ? 0 : start + 1,
    to: start + rows.length,
    documentsCount,
    bailBondsCount,
  };
}

export function documentPageWindow(
  page: number,
  pageCount: number
): (number | "gap")[] {
  if (pageCount <= 7) {
    return Array.from({ length: pageCount }, (_, index) => index + 1);
  }
  const pages = new Set([1, pageCount, page, page - 1, page + 1]);
  const visible = [...pages]
    .filter((entry) => entry >= 1 && entry <= pageCount)
    .sort((a, b) => a - b);

  return visible.flatMap((entry, index) =>
    index > 0 && entry - visible[index - 1] > 1
      ? ["gap" as const, entry]
      : [entry]
  );
}

/**
 * A memo or affidavit filed through the document submission flow, as a row
 * of this register (PM, Oct 8: uploads, not applications, so they live here
 * with their sign and pay steps). The row keeps the filing's id, so the
 * register can open the filing itself, steps and all.
 */
export function documentFromFiling(item: ApplicationRecord): CaseDocument {
  const file = item.documents.find((doc) => doc.src);
  return {
    id: item.id,
    filingId: item.temporaryId ?? "",
    title: item.name,
    type: item.typeLabel.toLowerCase().startsWith("memo") ? "memo" : "affidavit",
    submissionStatus: documentStatusFromFiling(item.status),
    // Not yet filed: the day it was started, so it sorts among its peers.
    submittedOn: item.submittedOn ?? item.createdOn,
    submittedById: item.filedById,
    source: "submission",
    linkedApplication: null,
    linkedHearing: null,
    evidenceNumber: null,
    evidenceStatus: null,
    href: file?.src,
  };
}

/** Who filed them, in this register's people shape. */
export function documentPeopleFromFilings(
  items: ApplicationRecord[]
): DocumentPerson[] {
  const seen = new Map<string, DocumentPerson>();
  for (const item of items) {
    if (seen.has(item.filedById)) continue;
    const side = item.side === "court" ? "Court" : item.side === "accused" ? "Accused" : "Complainant";
    seen.set(item.filedById, {
      id: item.filedById,
      name: item.filedBy,
      role: `${side} advocate`,
      filterLabel: item.filedBy,
    });
  }
  return [...seen.values()];
}

function documentStatusFromFiling(
  status: ApplicationRecord["status"]
): DocumentStatus {
  switch (status) {
    case "draft":
    case "pending-signature":
    case "pending-payment":
    case "expired":
    case "rejected":
      return status;
    case "accepted":
      return "completed";
    case "dismissed":
      return "rejected";
    default:
      // Submitted, or with the court: filed and waiting on it.
      return "pending-review";
  }
}

/** Still the filer's to finish: nothing has gone to the court yet. */
export function documentNotSubmitted(document: CaseDocument): boolean {
  return (
    document.submissionStatus === "draft" ||
    document.submissionStatus === "pending-signature" ||
    document.submissionStatus === "pending-payment"
  );
}

