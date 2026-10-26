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
import { isSubmittedToCourt } from "./applications";

/**
 * Mutually exclusive populations on the documents register. The court's own
 * papers (plea record, questionnaire) are on the record for the case file,
 * but the Document Submission PRD gives them no source or type, so the
 * Documents tab lists neither.
 */
export type DocumentKind = "documents" | "bail-bonds" | "court-records";

/**
 * The Documents tab's types (DSB-11): the three a filer picks in Submit
 * documents, then one per other source. Bail bonds and court records are
 * their own populations, never a filter value.
 */
export type DocumentTypeId =
  | "affidavit"
  | "memo"
  | "evidence"
  | "deposition"
  | "filing"
  | "application"
  | "bail-bond"
  | "court-record";

/** Where a document came from, shown under its title (DSB-22). */
export type DocumentSourceId =
  | "complaint"
  | "application"
  | "submission"
  | "deposition"
  | "court";

/**
 * Held for every document, never shown as a column (DSB-05). A draft or one
 * waiting for its signature is only under Needs attention (DSB-09); Marked as
 * evidence is read off `evidenceNumber`. Pending review is the bail bond's
 * own step (with the magistrate), outside this PRD.
 */
export type DocumentStatus =
  | "draft"
  | "pending-signature"
  | "submitted"
  | "pending-review";

export const DOCUMENT_KINDS: { id: DocumentKind; label: string }[] = [
  { id: "documents", label: "Documents" },
  { id: "bail-bonds", label: "Bail bonds" },
];

export const DOCUMENT_TYPES: {
  id: DocumentTypeId;
  label: string;
  kind: DocumentKind;
}[] = [
  { id: "affidavit", label: "Affidavit", kind: "documents" },
  { id: "memo", label: "Memo", kind: "documents" },
  { id: "evidence", label: "Evidence", kind: "documents" },
  { id: "deposition", label: "Deposition", kind: "documents" },
  { id: "filing", label: "Filing", kind: "documents" },
  { id: "application", label: "Application", kind: "documents" },
  { id: "bail-bond", label: "Bail bond", kind: "bail-bonds" },
  { id: "court-record", label: "Court record", kind: "court-records" },
];

/** The Type filter: the six of DSB-11, in the PRD's order. */
export const DOCUMENT_FILTER_TYPES = DOCUMENT_TYPES.filter(
  (item) => item.kind === "documents"
);

export const DOCUMENT_SOURCES: { id: DocumentSourceId; label: string }[] = [
  { id: "complaint", label: "Complaint" },
  { id: "application", label: "Application" },
  { id: "submission", label: "Submitted directly" },
  { id: "deposition", label: "Deposition" },
  { id: "court", label: "Court" },
];

export const DOCUMENT_STATUSES: { id: DocumentStatus; label: string }[] = [
  { id: "draft", label: "Draft" },
  { id: "pending-signature", label: "Pending signature" },
  { id: "submitted", label: "Submitted" },
  { id: "pending-review", label: "Pending review" },
];

export function documentTypeLabel(id: DocumentTypeId): string {
  return DOCUMENT_TYPES.find((item) => item.id === id)?.label ?? id;
}

export function documentKind(type: DocumentTypeId): DocumentKind {
  return DOCUMENT_TYPES.find((item) => item.id === type)?.kind ?? "documents";
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
  /**
   * DOC-1, DOC-2…, counted within the case, given when the document enters
   * the record (DSB-15). Null until then. Stays after marking.
   */
  provisionalId: string | null;
  /** P1, P2… or D1, D2…, given at marking (DSB-14). Null until marked. */
  evidenceNumber: string | null;
  href?: string;
  /** Every file of a document filed with several (Submit documents); `href`
   *  is the first. */
  files?: { label: string; src: string }[];
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
    provisionalId: null,
    evidenceNumber: row.evidenceNumber,
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
  /** Case-insensitive fragment of the title, DOC-n or evidence number;
   *  empty/whitespace means no search. */
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
    if (
      query &&
      ![document.title, document.provisionalId, document.evidenceNumber].some(
        (value) => value?.toLowerCase().includes(query)
      )
    ) {
      return false;
    }
    return true;
  });

  const documentsCount = shared.filter(
    (item) => documentKind(item.type) === "documents"
  ).length;
  const bailBondsCount = shared.filter(
    (item) => documentKind(item.type) === "bail-bonds"
  ).length;

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
 * A document filed through Submit documents, as a row of this register: one
 * row per document, whatever its submission carried (DSB-02). The row keeps
 * the filing's id, so the register can open the filing itself, steps and all.
 */
export function documentFromFiling(item: ApplicationRecord): CaseDocument {
  const files = item.documents.flatMap((doc) =>
    doc.src ? [{ label: doc.label, src: doc.src }] : []
  );
  const file = files[0];
  return {
    id: item.id,
    filingId: item.id,
    title: item.name,
    type: FILING_TYPE[item.source.type] ?? "evidence",
    submissionStatus: documentStatusFromFiling(item.status),
    // Not yet filed: the day it was started, so it sorts among its peers.
    submittedOn: item.submittedOn ?? item.createdOn,
    submittedById: item.filedById,
    source: "submission",
    linkedApplication: null,
    linkedHearing: null,
    provisionalId: null,
    evidenceNumber: null,
    href: file?.src,
    files,
  };
}

/**
 * A submitted application's attachments on this register (DSB-11, DSB-22,
 * DSB-23), each named by its field or by the filer. Only the attachments: the
 * application itself is read on the Applications tab, which already shows
 * its papers (PM, Oct 26). Only once it is submitted: a draft, or one still
 * to be signed or paid, is not on the record. Who may see it follows the
 * Applications tab, which has already filtered the rows it gets.
 */
export function documentsFromApplication(item: ApplicationRecord): CaseDocument[] {
  if (!isSubmittedToCourt(item.status)) return [];
  const submittedOn = item.submittedOn ?? item.createdOn;
  const row = (
    id: string,
    title: string,
    files: { label: string; src: string }[]
  ): CaseDocument => ({
    id,
    filingId: id,
    title,
    type: "application",
    submissionStatus: "submitted",
    submittedOn,
    submittedById: item.filedById,
    source: "application",
    linkedApplication: null,
    linkedHearing: null,
    provisionalId: null,
    evidenceNumber: null,
    href: files[0]?.src,
    files,
  });
  return (item.source.attachments ?? []).map((attachment, index) =>
    row(
      `${item.id}:attachment-${index}`,
      attachment.label,
      attachment.files.flatMap((file) =>
        file.href ? [{ label: file.label, src: file.href }] : []
      )
    )
  );
}

const FILING_TYPE: Record<string, DocumentTypeId> = {
  affidavits: "affidavit",
  memos: "memo",
  evidence: "evidence",
};

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

/** No payment for a document (DSB-19): it is a draft, waits for its
 *  signature, or is on the record. */
function documentStatusFromFiling(
  status: ApplicationRecord["status"]
): DocumentStatus {
  return status === "draft" || status === "pending-signature"
    ? status
    : "submitted";
}

/** Still the filer's to finish: nothing has gone to the court yet. */
export function documentNotSubmitted(document: CaseDocument): boolean {
  return (
    document.submissionStatus === "draft" ||
    document.submissionStatus === "pending-signature"
  );
}

/**
 * Give every document on the record its DOC-n, in the order it entered the
 * record, counted within the case (DSB-15). Drafts and documents waiting for
 * a signature are not on the record yet and get none. Bail bonds are the
 * tab's sibling population and the court's papers are not listed, so only
 * the Documents list is counted.
 */
export function withProvisionalIds(documents: CaseDocument[]): CaseDocument[] {
  const order = documents
    .filter(
      (document) =>
        !documentNotSubmitted(document) &&
        documentKind(document.type) === "documents"
    )
    .sort(
      (a, b) =>
        a.submittedOn.localeCompare(b.submittedOn) || a.id.localeCompare(b.id)
    );
  const ids = new Map(order.map((document, index) => [document.id, `DOC-${index + 1}`]));
  return documents.map((document) => ({
    ...document,
    provisionalId: ids.get(document.id) ?? null,
  }));
}

/** The Evidence number column: the evidence number once marked, the DOC-n
 *  in its place until then (DSB-10). */
export function evidenceNumberShown(document: CaseDocument): string | null {
  return document.evidenceNumber ?? document.provisionalId;
}
