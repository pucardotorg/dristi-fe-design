/**
 * Digital read of a Case file paper — the same structured record the
 * Complaint tab uses, filled from existing dummy packs. A paper with no
 * structured fixture stays undefined; the UI must not invent the filing.
 */
import {
  complaintPane,
  type ComplaintField,
  type ComplaintPane,
} from "./complaint";
import { CASES } from "./fixtures";
import {
  documentSourceLabel,
  documentStatusLabel,
  documentsFile,
  documentTypeLabel,
  submittedByName,
  submittedByRole,
  type CaseDocument,
  type DocumentPerson,
} from "./documents";
import {
  depositionStatusLabel,
  exhibitLabel,
  findDeposition,
  hearingsFile,
  type WitnessDeposition,
} from "./hearings";
import {
  orderClassLabel,
  orderStatusLabel,
  orderTypeLabel,
  ordersFile,
  type OrderRecord,
} from "./orders";
import { formatCaseDate, type CaseRecord } from "./types";

/** Case file leaf → Complaint pane. Same facts the Complaint tab already shows. */
const COMPLAINT_PANE_BY_DOC: Record<string, string> = {
  complaint: "complaintNarrative",
  "legal-demand-notice": "LDN-001",
  "proof-of-dispatch": "LDN-001",
  "dishonoured-cheque": "CHQ-001",
  "cheque-return-memo": "CHQ-001",
  "vakalatnama-1": "advocateDetails",
};

/** Case file leaf → Documents register filing id. */
const DOCUMENT_BY_DOC: Record<string, string> = {
  "affidavit-223-bnss": "KL-DUMMY-001386-2026-AR6",
  "affidavit-225-bnss": "KL-DUMMY-001386-2026-AR10",
  "pw1-chief-affidavit-145": "KL-DUMMY-001386-2026-AR3",
  "pip-affidavit-1": "KL-DUMMY-001386-2026-AR11",
  "exhibit-index-p1-p6": "KL-DUMMY-001386-2026-AR15",
  "exhibit-index-d1-d3": "KL-DUMMY-001386-2026-AR14",
  plea: "KL-DUMMY-001386-2026-AR2",
  "questionnaire-351-bnss": "KL-DUMMY-001386-2026-AR1",
};

/** Case file leaf → hearing deposition ids, in file order. */
const DEPOSITIONS_BY_DOC: Record<string, string[]> = {
  "witness-deposition-pw1": ["DEP-PW1-001", "DEP-PW1-002"],
  "witness-deposition-pw2": ["DEP-PW2-001"],
  "witness-deposition-dw1": ["DEP-DW1-001"],
};

/** Case file leaf → Orders register id, when the dummy pack names that paper. */
const ORDER_BY_DOC: Record<string, string> = {
  "order-cognizance": "KL-DUMMY-001386-2025-OR1",
  "order-issuing-summons": "KL-DUMMY-001386-2025-OR2",
  "order-appearance-plea-bail": "KL-DUMMY-001386-2025-OR4",
  judgment: "KL-DUMMY-001386-2025-OR8",
};

/**
 * The case file is one shared QA pack: `CASE_FILE_TREE` and the PDFs under it
 * are the same papers on every case. The digital read is the same pack read a
 * second way, so it resolves against the fixture case that owns those
 * registers rather than the case being viewed — scoping it to the viewed case
 * left every case but that one reading as empty while its PDF still showed
 * this pack. Real per-case records replace this, not the mapping below.
 */
const FIXTURE_CASE_ID = "c-1001";

export function caseFileDigitalPane(
  record: CaseRecord,
  docId: string
): ComplaintPane | undefined {
  const source = CASES.find((item) => item.id === FIXTURE_CASE_ID) ?? record;

  const complaintPartId = COMPLAINT_PANE_BY_DOC[docId];
  if (complaintPartId) {
    return complaintPane(source.id, complaintPartId);
  }

  const depositionIds = DEPOSITIONS_BY_DOC[docId];
  if (depositionIds) {
    const file = hearingsFile(source);
    const depositions = depositionIds
      .map((id) => findDeposition(file, id))
      .filter((item): item is WitnessDeposition => Boolean(item));
    return depositions.length > 0 ? depositionPane(depositions) : undefined;
  }

  const orderId = ORDER_BY_DOC[docId];
  if (orderId) {
    const file = ordersFile(source);
    const order = file.orders.find((item) => item.id === orderId);
    return order ? orderPane(file.court, order) : undefined;
  }

  const filingId = DOCUMENT_BY_DOC[docId];
  if (filingId) {
    const file = documentsFile(source);
    const document = file.documents.find((item) => item.id === filingId);
    if (!document) return undefined;
    const peopleById = new Map(file.people.map((person) => [person.id, person]));
    return documentPane(document, peopleById);
  }

  return undefined;
}

function field(term: string, value: string) {
  return { term, value };
}

/** The same row for a value that is an identifier rather than prose. */
function idField(term: string, value: string): ComplaintField {
  return { term, value, id: true };
}

function depositionPane(depositions: WitnessDeposition[]): ComplaintPane {
  const first = depositions[0];
  const exhibits = [
    ...new Set(depositions.flatMap((item) => item.exhibits)),
  ];

  return {
    title: `${first.witnessNumber} deposition`,
    badges: [first.witnessType],
    fields: [
      /* The designation and the name as one sentence — prose, so no mono. The
         designation on its own carries the face where it is the field
         (`hearing-record-dialog`). */
      field("Witness", `${first.witnessNumber} ${first.witnessName}`),
      field("Witness type", first.witnessType),
      ...(exhibits.length > 0
        ? [
            /* Marks with their descriptions: a list of phrases, not a reference. */
            field(
              "Exhibits",
              exhibits.map((code) => `${code} · ${exhibitLabel(code)}`).join("; ")
            ),
          ]
        : []),
    ],
    blocks: depositions.map((item) => ({
      title: item.examinationStage,
      body: `${depositionStatusLabel(item)}. ${item.summary}`,
    })),
  };
}

function orderPane(court: string, order: OrderRecord): ComplaintPane {
  return {
    title: order.title,
    badges: [orderClassLabel(order.classId)],
    fields: [
      field("Type", orderTypeLabel(order.type)),
      field("Status", orderStatusLabel(order.status)),
      field("Date issued", formatCaseDate(order.issuedOn)),
      field("Court", court),
      ...(order.partiesDisplay
        ? [field("Parties", order.partiesDisplay)]
        : []),
    ],
  };
}

function documentPane(
  document: CaseDocument,
  peopleById: Map<string, DocumentPerson>
): ComplaintPane {
  const role = submittedByRole(document, peopleById);
  const submittedBy = role
    ? `${submittedByName(document, peopleById)} · ${role}`
    : submittedByName(document, peopleById);

  return {
    title: document.title,
    fields: [
      idField("Filing ID", document.id),
      field("Document type", documentTypeLabel(document.type)),
      field("Source", documentSourceLabel(document.source)),
      field("Status", documentStatusLabel(document.submissionStatus)),
      field("Submitted on", formatCaseDate(document.submittedOn)),
      field("Submitted by", submittedBy),
      ...(document.evidenceNumber
        ? [idField("Evidence no.", document.evidenceNumber)]
        : []),
      ...(document.linkedApplication
        ? [
            /* A title with its id in brackets. The sentence is the fact here. */
            field(
              "Filed with",
              `${document.linkedApplication.label} (${document.linkedApplication.id})`
            ),
          ]
        : []),
      ...(document.linkedHearing
        ? [
            field(
              "Hearing",
              `${document.linkedHearing.label} (${document.linkedHearing.id})`
            ),
          ]
        : []),
    ],
  };
}
