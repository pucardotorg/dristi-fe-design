/**
 * Applications — the case register of submission containers: structured
 * applications and document submissions. The list carries the scannable
 * facts; the outcome and the filed packet live on the record.
 *
 * Status follows the Application Lifecycle PRD (v20, Sept 23): one status
 * runs from the filer's draft through the court's decision. The filer moves
 * the first three; the court moves the rest (onboarding, dismissal, the
 * accept or reject order). The court side is not built here, so every court
 * move a row shows is authored in `applications-dummy.json`.
 *
 * Featured dummy content comes from `applications-dummy.json`. Labels
 * follow Laws sentence case.
 */
import pack from "./applications-dummy.json";
import { counselFor, type CaseRecord, type Parties } from "./types";
import { isViewer, VIEWER_CLERK_NAME } from "./viewer";

export type SubmissionKind = "application" | "document";

/**
 * Every status an application passes through (PRD "The workflow").
 *
 * - Dismissed and Rejected are two different endings. Dismissed happens
 *   before onboarding: no application number, no accept or reject order.
 *   Rejected only happens after onboarding.
 * - Submitted belongs to Objection: an objection is never accepted or
 *   rejected on its own, it is read with the application it objects to.
 *   Document submissions (affidavits, memos) end here too, because they are
 *   never decided either. That second use is ours, not the PRD's: flagged.
 * - "Set a date" on the court's Review application task and "move the
 *   decision date" change no status. There is no "rescheduled" status.
 */
export type FilingStatus =
  | "draft"
  | "pending-signature"
  | "pending-payment"
  | "pending-review"
  | "pending-decision"
  | "accepted"
  | "rejected"
  | "dismissed"
  | "submitted"
  | "expired";

export type ApplicationTypeId =
  | "absent-application"
  /** Advance (prepone). The id is kept from when one type covered both ways. */
  | "advancement-reschedule"
  | "postpone"
  | "addition-of-witness"
  | "bail"
  | "certified-copy"
  | "condonation-of-delay"
  | "edit-litigant-details"
  | "poa-change"
  | "production-of-documents"
  | "reopen-evidence"
  | "settlement"
  | "transfer"
  | "warrant-by-hand"
  /**
   * Certified copy and Warrant recall are not types in the Application
   * Lifecycle PRD and are never offered; the ids stay so anything already
   * filed under them still has a label.
   */
  | "warrant-recall"
  | "withdrawal"
  | "application-others"
  /**
   * Raised only from a File objection task, against one application of the
   * opposing side (PRD ALC-12, ALC-24). Never offered in the type picker:
   * there is no freestanding objection.
   */
  | "objection";

/** Submission-flow buckets — the register's document heads live in documents.ts. */
export type SubmissionDocumentTypeId =
  | "affidavits"
  | "memos"
  | "objections"
  | "document-others";

export type SubmissionTypeId = ApplicationTypeId | SubmissionDocumentTypeId;

export const SUBMISSION_KINDS: {
  id: SubmissionKind;
  label: string;
}[] = [
  { id: "application", label: "Application" },
  { id: "document", label: "Document submission" },
];

export const APPLICATION_TYPES: {
  id: ApplicationTypeId;
  label: string;
}[] = [
  { id: "absent-application", label: "Absent application" },
  { id: "addition-of-witness", label: "Addition of witness" },
  { id: "advancement-reschedule", label: "Advance (prepone)" },
  { id: "bail", label: "Bail" },
  { id: "certified-copy", label: "Certified copy" },
  { id: "condonation-of-delay", label: "Delay condonation" },
  { id: "edit-litigant-details", label: "Edit litigant details" },
  { id: "poa-change", label: "PoA change" },
  { id: "postpone", label: "Postpone" },
  { id: "production-of-documents", label: "Production of documents" },
  { id: "reopen-evidence", label: "Reopen evidence" },
  { id: "settlement", label: "Case settlement" },
  { id: "transfer", label: "Case transfer" },
  { id: "warrant-by-hand", label: "Warrant by hand" },
  { id: "warrant-recall", label: "Warrant recall" },
  { id: "withdrawal", label: "Case withdrawal" },
  { id: "application-others", label: "Generic" },
  { id: "objection", label: "Objection" },
];

/** Submission-flow buckets — the register's document heads live in documents.ts. */
export const SUBMISSION_DOCUMENT_TYPES: {
  id: SubmissionDocumentTypeId;
  label: string;
}[] = [
  { id: "affidavits", label: "Affidavits" },
  { id: "memos", label: "Memos" },
  { id: "objections", label: "Objections" },
  { id: "document-others", label: "Others" },
];

/** In lifecycle order, so the Status filter reads the way a filing moves. */
export const FILING_STATUSES: { id: FilingStatus; label: string }[] = [
  { id: "draft", label: "Draft" },
  { id: "pending-signature", label: "Pending signature" },
  { id: "pending-payment", label: "Pending payment" },
  { id: "pending-review", label: "Pending review" },
  { id: "pending-decision", label: "Pending decision" },
  { id: "accepted", label: "Accepted" },
  { id: "rejected", label: "Rejected" },
  { id: "dismissed", label: "Dismissed" },
  { id: "submitted", label: "Submitted" },
  { id: "expired", label: "Expired" },
];

/** Signed and paid: the court has it (PRD ALC-01). */
export function isSubmittedToCourt(status: FilingStatus): boolean {
  return !(
    status === "draft" ||
    status === "pending-signature" ||
    status === "pending-payment" ||
    status === "expired"
  );
}

/**
 * Onboarded: the court has allotted the application number (ALC-04). Only
 * from here can the other side see it (ALC-17). Dismissed never gets here,
 * so a dismissed application stays invisible to the other side for good.
 */
export function isOnboardedStatus(status: FilingStatus): boolean {
  return (
    status === "pending-decision" ||
    status === "accepted" ||
    status === "rejected"
  );
}

const APPLICATION_TYPE_IDS = new Set<string>(
  APPLICATION_TYPES.map((item) => item.id)
);
const SUBMISSION_DOCUMENT_TYPE_IDS = new Set<string>(
  SUBMISSION_DOCUMENT_TYPES.map((item) => item.id)
);

export function isApplicationTypeId(
  value: string
): value is ApplicationTypeId {
  return APPLICATION_TYPE_IDS.has(value);
}

export function isSubmissionDocumentTypeId(
  value: string
): value is SubmissionDocumentTypeId {
  return SUBMISSION_DOCUMENT_TYPE_IDS.has(value);
}

export function isSubmissionTypeId(value: string): value is SubmissionTypeId {
  return isApplicationTypeId(value) || isSubmissionDocumentTypeId(value);
}

export function isFilingStatus(value: string): value is FilingStatus {
  return FILING_STATUSES.some((item) => item.id === value);
}

export function submissionKindLabel(kind: SubmissionKind): string {
  return SUBMISSION_KINDS.find((item) => item.id === kind)?.label ?? kind;
}

export function submissionTypeLabel(id: SubmissionTypeId): string {
  const fromApplication = APPLICATION_TYPES.find((item) => item.id === id);
  if (fromApplication) return fromApplication.label;
  return SUBMISSION_DOCUMENT_TYPES.find((item) => item.id === id)?.label ?? id;
}

/**
 * An Others application's own title, quoted exactly as the filer typed it
 * (the PRD's "Application Title" field), for a sentence that names it:
 * "File objection to “Addition of the firm's accountant as a witness”".
 * Every other type is named by its type, so this is null for them, and for
 * an Others filing with no title of its own. Never re-cased: it is free text,
 * and "PW-2 recall" must not become "pW-2 recall" (owner, Sept 24).
 */
export function quotedOthersTitle(
  submission: Pick<Submission, "type" | "title">
): string | null {
  const title = othersTitle(submission);
  return title ? `\u201c${title}\u201d` : null;
}

/**
 * The title an Others filer typed (the PRD's "Application Title"), as typed.
 * "Others" names no ask, so wherever an application is named this is what
 * tells two Others apart (owner, Sept 24: "I don't even understand what it
 * is about"). Null for every other type, and for an Others filing with no
 * title of its own.
 */
export function othersTitle(
  submission: Pick<Submission, "type" | "title">
): string | null {
  if (submission.type !== "application-others") return null;
  const title = submission.title.trim();
  if (!title || ["others", "generic"].includes(title.toLowerCase())) return null;
  return title;
}

export function filingStatusLabel(status: FilingStatus): string {
  return FILING_STATUSES.find((item) => item.id === status)?.label ?? status;
}

/**
 * Status colour, always paired with the words (Laws). Muted tints only, no
 * solids: a badge in a register is a label, not an action.
 *
 * - Amber: the three filer steps (draft, sign, pay), which is what pins a
 *   row to Needs attention.
 * - Info: with the court (Pending review, Pending decision). In flight, and
 *   nothing owed by the filer.
 * - Green: Accepted. Red: both refusals, Rejected and Dismissed; the words
 *   tell them apart.
 * - Neutral: the two endings that are neither a win nor a refusal. Expired
 *   keeps the grey fill it had; Submitted takes the outline so the two
 *   still differ at a glance.
 */
export function filingStatusVariant(
  status: FilingStatus
): "warning" | "destructive" | "secondary" | "success" | "info" | "outline" {
  switch (status) {
    case "pending-review":
    case "pending-decision":
      return "info";
    case "accepted":
      return "success";
    case "rejected":
    case "dismissed":
      return "destructive";
    case "submitted":
      return "outline";
    case "expired":
      return "secondary";
    default:
      return "warning";
  }
}

export function nextStepCopy(status: FilingStatus): string | null {
  switch (status) {
    case "draft":
      return "Continue draft";
    case "pending-signature":
      return "Add signature";
    case "pending-payment":
      return "Complete payment";
    default:
      return null;
  }
}

export function filingActionLabel(status: FilingStatus): string {
  return nextStepCopy(status) ?? "View application";
}

/** Filings that still need a step from you — pin these above the register. */
export function needsAttention(status: FilingStatus): boolean {
  return nextStepCopy(status) !== null;
}

export type BatchAction = {
  /** Group header — the ask in words, since the chip alone cannot say it. */
  title: (count: number) => string;
  /** The one CTA that stands in for the whole group. */
  cta: string;
  /** Heading of the confirm step, which names what the batch covers. */
  confirm: (count: number) => string;
};

/**
 * The steps that can be taken for several filings in one go. Signature is the
 * only one for now: one signing session covers a set.
 *
 * Payment is deliberately out until a filing carries its fee — a single
 * "Complete payments" over two filings that cannot state a total asks for
 * money without saying how much. Draft is out for a different reason: a draft
 * is resumed one at a time, so one "continue" over three of them would
 * promise something the flow cannot do. Both keep their own card until then.
 */
const BATCH_ACTIONS: Partial<Record<FilingStatus, BatchAction>> = {
  "pending-signature": {
    title: (count) =>
      count === 1
        ? "1 application needs a signature"
        : `${count} applications need a signature`,
    cta: "Add signatures",
    confirm: (count) =>
      count === 1 ? "Add signature" : `Add signatures to ${count} applications`,
  },
};

export function batchAction(status: FilingStatus): BatchAction | null {
  return BATCH_ACTIONS[status] ?? null;
}

export type AttentionEntry =
  | { kind: "single"; key: string; submission: Submission }
  | {
      kind: "group";
      key: string;
      status: FilingStatus;
      submittedById: string;
      submissions: Submission[];
    };

export type AttentionGroupEntry = Extract<AttentionEntry, { kind: "group" }>;

function attentionEntryDate(entry: AttentionEntry): string {
  return entry.kind === "single"
    ? entry.submission.addedOn
    : entry.submissions[0].addedOn;
}

/**
 * Two or more filings waiting on the same step from the same filer collapse
 * into one entry with one CTA — three "Add signature" cards are three copies
 * of one job. Grouping is per filer because you cannot sign or pay for
 * someone else's filing, and a filing left alone in its bucket keeps its own
 * card. Order stays the well's newest-first, a group taking the date of its
 * newest member. Expects `rows` already sorted newest-first.
 */
export function groupAttention(rows: Submission[]): AttentionEntry[] {
  const buckets = new Map<string, Submission[]>();
  for (const submission of rows) {
    if (!batchAction(submission.status)) continue;
    const key = `${submission.status}-${submission.submittedById}`;
    const bucket = buckets.get(key);
    if (bucket) bucket.push(submission);
    else buckets.set(key, [submission]);
  }

  const entries: AttentionEntry[] = [];
  const grouped = new Set<string>();
  for (const [key, bucket] of buckets) {
    if (bucket.length < 2) continue;
    for (const submission of bucket) grouped.add(submission.id);
    entries.push({
      kind: "group",
      key,
      status: bucket[0].status,
      submittedById: bucket[0].submittedById,
      submissions: bucket,
    });
  }
  for (const submission of rows) {
    if (grouped.has(submission.id)) continue;
    entries.push({ kind: "single", key: submission.id, submission });
  }

  return entries.sort((a, b) => {
    const byDate = attentionEntryDate(b).localeCompare(attentionEntryDate(a));
    return byDate !== 0 ? byDate : a.key.localeCompare(b.key);
  });
}

/** What a person is on the case, for who may see and do what (PRD "Users and actions"). */
export type SubmissionPersonKind =
  | "party"
  | "advocate"
  | "clerk"
  | "poa-holder";

export type SubmissionPerson = {
  id: string;
  name: string;
  role: string;
  filterLabel: string;
  kind: SubmissionPersonKind;
  side: "complainant" | "accused";
  /**
   * The advocate whose office this clerk or junior works in. "Associated" in
   * the PRD: the advocate signs what the clerk drafts, and each sees the
   * other's drafts.
   */
  officeOf?: string;
  /** For a PoA holder: the party whose power of attorney they hold. */
  holdsPoaFor?: string;
};

export type SubmissionDocument = {
  label: string;
  href?: string;
  page?: number;
};

export type LinkedOrder = {
  id: string;
  label: string;
};

export type Submission = {
  id: string;
  kind: SubmissionKind;
  type: SubmissionTypeId;
  title: string;
  status: FilingStatus;
  /** Date created: when the draft was started. */
  addedOn: string;
  /**
   * Raised by: the advocate or party in person who signs it (PRD
   * "Application Raised By"). On a draft, the one who will sign it.
   */
  submittedById: string;
  /** Who started the draft, when that is not the signer (a clerk or junior). */
  createdById: string;
  /** The litigant it is raised for (PRD "Application Raised On Behalf Of"). */
  onBehalfOfId: string;
  /**
   * Allotted on submission, once signed and paid (ALC-02). The filer may see
   * it; it is never cited in an order or any other document.
   */
  temporaryId: string | null;
  /** Allotted on onboarding (ALC-04). The number the court knows it by. */
  applicationNumber: string | null;
  /** ISO day it was signed and paid. */
  submittedOn: string | null;
  /** ISO day the court onboarded it. */
  onboardedOn: string | null;
  /**
   * The day the court will decide it (ALC-09). Not a stored attribute in the
   * PRD: it is the Decide application task's due date. Carried here because
   * the court's tasks are not built, and the filer is told the date.
   */
  decisionOn: string | null;
  /** Whether the court invited the other side to object (ALC-11). */
  objectionsInvited: boolean | null;
  /** For an objection: the application it objects to. */
  objectionToId: string | null;
  /**
   * When an unfiled filing (draft, unsigned, unpaid) expires (PRD: "Expire,
   * System"). The PRD gives no timer, so the demo pack states a day where it
   * wants one shown; absent means none is known.
   */
  expiresOn: string | null;
  /**
   * The prayer in plain words — what the filer asked the court to do. Only
   * applications ask for something, so document submissions carry null.
   *
   * Deliberately not rendered in the record dialog: the filed PDF sits on
   * that same screen and *is* the application, and a plain-language
   * paraphrase placed above the operative text invites reliance on the
   * paraphrase. Kept because two "Advancement/reschedule" rows are currently
   * indistinguishable in the register — this is the candidate secondary line
   * for the table row. Not dead data; do not re-add it to the dialog.
   */
  request: string | null;
  /** The order's operative line, once decided or dismissed. */
  courtResult: string | null;
  /** The order accepting, rejecting or dismissing it. */
  linkedOrder: LinkedOrder | null;
  defects: string[];
  documents: SubmissionDocument[];
};

export type ApplicationsFile = {
  /** Needed to link a record out to the section that holds the order. */
  caseId: string;
  caseNumber: string;
  parties: Parties;
  court: string;
  people: SubmissionPerson[];
  submissions: Submission[];
};

export function personIdentity(person: SubmissionPerson): string {
  const [left] = person.filterLabel.split(" — ");
  return left?.trim() || person.name;
}

export function submittedByName(
  submission: Submission,
  peopleById: Map<string, SubmissionPerson>
): string {
  const person = peopleById.get(submission.submittedById);
  return person ? personIdentity(person) : submission.submittedById;
}

/**
 * Table shows the party side as plain text. Who signed it and on whose
 * behalf is the record's job, not a hover. Accused is matched first so
 * "Accused counsel" is not read as complainant.
 */
export function submittedBySideLabel(
  submission: Submission,
  peopleById: Map<string, SubmissionPerson>
): string {
  const role =
    peopleById.get(submission.submittedById)?.role.toLowerCase() ?? "";
  if (role.includes("accused")) return "Accused";
  if (role.includes("complainant")) return "Complainant";
  return submittedByName(submission, peopleById);
}

export function submittedByOnBehalf(
  submission: Submission,
  peopleById: Map<string, SubmissionPerson>,
  parties: Parties
): string {
  const name = submittedByName(submission, peopleById);
  const side = submittedBySideLabel(submission, peopleById);
  if (side === "Complainant") {
    return `${name} on behalf of ${parties.complainant}`;
  }
  if (side === "Accused") {
    return `${name} on behalf of ${parties.accused}`;
  }
  return name;
}

export function submissionDocumentSrc(
  doc: SubmissionDocument
): string | undefined {
  if (!doc.href) return undefined;
  return doc.page ? `${doc.href}#page=${doc.page}` : doc.href;
}

export function hasSubmissionDocument(submission: Submission): boolean {
  return submission.documents.some((doc) => Boolean(doc.href));
}

function kindFromPack(value: string): SubmissionKind {
  const normalized = value.trim().toLowerCase();
  if (normalized === "application") return "application";
  if (normalized === "document submission") return "document";
  throw new Error(`Unknown submission kind in dummy pack: ${value}`);
}

function typeFromPack(kind: SubmissionKind, label: string): SubmissionTypeId {
  const normalized = label.trim().toLowerCase();
  const catalogue =
    kind === "application" ? APPLICATION_TYPES : SUBMISSION_DOCUMENT_TYPES;
  const match = catalogue.find(
    (item) => item.label.toLowerCase() === normalized
  );
  if (!match) {
    throw new Error(`Unknown ${kind} type in dummy pack: ${label}`);
  }
  return match.id;
}

function statusFromPack(value: string): FilingStatus {
  const normalized = value.trim().toLowerCase();
  const match = FILING_STATUSES.find(
    (item) => item.label.toLowerCase() === normalized
  );
  if (!match) {
    throw new Error(`Unknown filing status in dummy pack: ${value}`);
  }
  return match.id;
}

type PackPerson = {
  id: string;
  label: string;
  kind?: string;
  side?: string;
  officeOf?: string;
  holdsPoaFor?: string;
};

function personKindFromPack(
  value: string | undefined,
  role: string
): SubmissionPersonKind {
  if (
    value === "party" ||
    value === "advocate" ||
    value === "clerk" ||
    value === "poa-holder"
  ) {
    return value;
  }
  const lower = role.toLowerCase();
  if (lower.includes("counsel")) return "advocate";
  if (lower.includes("clerk")) return "clerk";
  if (lower.includes("power of attorney")) return "poa-holder";
  return "party";
}

/** Accused is matched first so "Accused counsel" is never read as complainant. */
function sideFromRole(role: string): "complainant" | "accused" {
  return role.toLowerCase().includes("accused") ? "accused" : "complainant";
}

function personFromPack(item: PackPerson): SubmissionPerson {
  const [left, role = ""] = item.label.split(" — ");
  const name = left.split(",")[0]?.trim() ?? left;
  return {
    id: item.id,
    name,
    role,
    filterLabel: item.label,
    kind: personKindFromPack(item.kind, role),
    side:
      item.side === "accused" || item.side === "complainant"
        ? item.side
        : sideFromRole(role),
    officeOf: item.officeOf,
    holdsPoaFor: item.holdsPoaFor,
  };
}

function featuredPeople(): SubmissionPerson[] {
  return (pack.people as PackPerson[]).map(personFromPack);
}

/**
 * A pack row from either register — the featured case's `submissions` or an
 * `extraCases` entry. Spelled out rather than inferred off the JSON because
 * the two sources carry different optional fields and both must go through
 * the same throwing validators.
 *
 * The lifecycle fields are optional so a row states only what the court has
 * done to it. What is left out is derived: the drafter is the signer, the
 * litigant is the filer's own side, and a submitted row was submitted the
 * day it was added.
 */
type PackSubmissionRow = {
  id: string;
  kind: string;
  type: string;
  title: string;
  status: string;
  addedOn: string;
  submittedById: string;
  createdById?: string;
  onBehalfOfId?: string;
  temporaryId: string | null;
  applicationNumber?: string | null;
  submittedOn?: string | null;
  onboardedOn?: string | null;
  decisionOn?: string | null;
  objectionsInvited?: boolean | null;
  objectionToId?: string | null;
  expiresOn?: string | null;
  request: string | null;
  courtResult: string | null;
  linkedOrder: LinkedOrder | null;
  defects: string[];
  documents: { label: string; href?: string; page?: number }[];
};

function submissionFromPack(
  row: PackSubmissionRow,
  people: SubmissionPerson[]
): Submission {
  const kind = kindFromPack(row.kind);
  const type = typeFromPack(kind, row.type);
  const status = statusFromPack(row.status);
  const filer = people.find((person) => person.id === row.submittedById);
  const party = people.find(
    (person) => person.kind === "party" && person.side === filer?.side
  );
  const submitted = isSubmittedToCourt(status);
  const onboarded = isOnboardedStatus(status);
  return {
    id: row.id,
    kind,
    type,
    title: row.title.trim() || submissionTypeLabel(type),
    status,
    addedOn: row.addedOn,
    submittedById: row.submittedById,
    createdById: row.createdById ?? row.submittedById,
    onBehalfOfId: row.onBehalfOfId ?? party?.id ?? row.submittedById,
    temporaryId: submitted ? row.temporaryId : null,
    applicationNumber: onboarded ? (row.applicationNumber ?? null) : null,
    submittedOn: submitted ? (row.submittedOn ?? dayOf(row.addedOn)) : null,
    onboardedOn: onboarded
      ? (row.onboardedOn ?? row.submittedOn ?? dayOf(row.addedOn))
      : null,
    decisionOn: row.decisionOn ?? null,
    objectionsInvited: row.objectionsInvited ?? null,
    objectionToId: row.objectionToId ?? null,
    expiresOn: submitted ? null : (row.expiresOn ?? null),
    request: row.request,
    courtResult: row.courtResult,
    linkedOrder: row.linkedOrder,
    defects: row.defects,
    documents: row.documents.map((doc) => ({
      label: doc.label,
      href: doc.href,
      page: doc.page,
    })),
  };
}

function dayOf(iso: string): string {
  return iso.slice(0, 10);
}

function featuredFile(record: CaseRecord): ApplicationsFile {
  const people = featuredPeople();
  return {
    caseId: record.id,
    caseNumber: record.caseNumber,
    parties: record.parties,
    court: pack.case.court,
    people,
    submissions: (pack.submissions as PackSubmissionRow[]).map((row) =>
      submissionFromPack(row, people)
    ),
  };
}

/**
 * Registers for the non-featured cases, keyed by fixture id. Rows name
 * people by the generated ids `peopleFrom` produces (`<case>-complainant`,
 * `<case>-counsel-c-0`, …), so populating a case here needs no people
 * authoring — the fixture's cause title and counsel stay the one source.
 * People the cause title cannot supply (a clerk, a PoA holder) come from
 * `extraPeople`.
 */
const EXTRA_PACKS = pack.extraCases as Record<
  string,
  PackSubmissionRow[] | undefined
>;
const EXTRA_PEOPLE = pack.extraPeople as Record<string, PackPerson[] | undefined>;

function peopleFrom(record: CaseRecord): SubmissionPerson[] {
  const people: SubmissionPerson[] = [
    {
      id: `${record.id}-complainant`,
      name: record.parties.complainant,
      role: "Complainant",
      filterLabel: `${record.parties.complainant} — Complainant`,
      kind: "party",
      side: "complainant",
    },
    {
      id: `${record.id}-accused`,
      name: record.parties.accused,
      role: "Accused",
      filterLabel: `${record.parties.accused} — Accused`,
      kind: "party",
      side: "accused",
    },
  ];

  counselFor(record, "complainant").forEach((name, index) => {
    people.push({
      id: `${record.id}-counsel-c-${index}`,
      name,
      role: "Complainant counsel",
      filterLabel: `${name} — Complainant counsel`,
      kind: "advocate",
      side: "complainant",
    });
  });
  counselFor(record, "accused").forEach((name, index) => {
    people.push({
      id: `${record.id}-counsel-a-${index}`,
      name,
      role: "Accused counsel",
      filterLabel: `${name} — Accused counsel`,
      kind: "advocate",
      side: "accused",
    });
  });

  /* The signed-in advocate's clerk, on every case the advocate holds a
     vakalatnama in, so the clerk profile has a seat wherever its advocate
     does. The featured case names its clerk in the pack instead. */
  const office = people.find(
    (person) => person.kind === "advocate" && isViewer(person.name)
  );
  if (office) {
    people.push({
      id: `${record.id}-clerk`,
      name: VIEWER_CLERK_NAME,
      role: `Clerk to ${office.name}`,
      filterLabel: `${VIEWER_CLERK_NAME} — Clerk to ${office.name}`,
      kind: "clerk",
      side: office.side,
      officeOf: office.id,
    });
  }

  for (const extra of EXTRA_PEOPLE[record.id] ?? []) {
    people.push(personFromPack(extra));
  }

  return people;
}

const FEATURED_CASE_ID = "c-1001";

export function applicationsFile(record: CaseRecord): ApplicationsFile {
  if (record.id === FEATURED_CASE_ID) return featuredFile(record);
  const people = peopleFrom(record);
  return {
    caseId: record.id,
    caseNumber: record.caseNumber,
    parties: record.parties,
    court: record.court,
    people,
    submissions: (EXTRA_PACKS[record.id] ?? []).map((row) =>
      submissionFromPack(row, people)
    ),
  };
}

/**
 * Where a draft resumes. Applications reopen in the Raise application form
 * with the draft named in the URL; document submissions have their own flow
 * and no per-draft resume, so they get the flow itself.
 *
 * Anything that is not a draft has no form to go back to — it has been filed
 * — and belongs on the record instead, which is what the null tells callers.
 */
export function resumeDraftHref(
  caseId: string,
  submission: Submission
): string | null {
  if (submission.status !== "draft") return null;
  const base = `/cases/${caseId}/filings`;
  return submission.kind === "application"
    ? `${base}/application?draft=${encodeURIComponent(submission.id)}`
    : `${base}/documents`;
}

/**
 * Where the File objection task leads: the Raise application form, opened on
 * an Objection already pointed at the other side's application. Objection
 * is never offered in the type picker (ALC-12), so this is its only way in.
 */
export function objectionHref(caseId: string, applicationId: string): string {
  return `/cases/${caseId}/filings/application?objectTo=${encodeURIComponent(
    applicationId
  )}`;
}

/**
 * The draft named by ?draft=. A stale or hand-edited id resolves to null and
 * the flow simply starts fresh at the type picker — a filing screen should
 * not 404 over a query parameter.
 */
export function findDraftSubmission(
  file: ApplicationsFile,
  id: string | undefined
): Submission | null {
  if (!id) return null;
  const match = file.submissions.find((item) => item.id === id);
  return match && match.status === "draft" ? match : null;
}

export const APPLICATIONS_PAGE_SIZES = [10, 20, 30, 40, 50] as const;
export type ApplicationsPageSize = (typeof APPLICATIONS_PAGE_SIZES)[number];
export const APPLICATIONS_PAGE_SIZE: ApplicationsPageSize = 10;

export function isApplicationsPageSize(
  value: number
): value is ApplicationsPageSize {
  return (APPLICATIONS_PAGE_SIZES as readonly number[]).includes(value);
}

export type ApplicationsSelection = {
  attention: Submission[];
  rows: Submission[];
  total: number;
  page: number;
  pageCount: number;
  from: number;
  to: number;
};

function sortSubmissions(list: Submission[]): Submission[] {
  return [...list].sort((a, b) => {
    const byDate = b.addedOn.localeCompare(a.addedOn);
    return byDate !== 0 ? byDate : b.id.localeCompare(a.id);
  });
}

export function selectApplications(options: {
  submissions: Submission[];
  submittedById: string | null;
  typeId: SubmissionTypeId | null;
  status: FilingStatus | null;
  /** Case-insensitive submission-id fragment; empty/whitespace = no search. */
  submissionQuery?: string;
  pageSize: ApplicationsPageSize;
  page: number;
}): ApplicationsSelection {
  const query = options.submissionQuery?.trim().toLowerCase() ?? "";
  const matched = options.submissions.filter((submission) => {
    if (
      options.submittedById &&
      submission.submittedById !== options.submittedById
    ) {
      return false;
    }
    if (options.typeId && submission.type !== options.typeId) return false;
    if (options.status && submission.status !== options.status) return false;
    // Drafts and unsigned filings have no submission id yet, so an id search
    // rightly excludes them.
    if (
      query &&
      ![submission.applicationNumber, submission.temporaryId].some((id) =>
        (id ?? "").toLowerCase().includes(query)
      )
    ) {
      return false;
    }
    return true;
  });

  const attention = sortSubmissions(
    matched.filter((item) => needsAttention(item.status))
  );
  const rest = sortSubmissions(
    matched.filter((item) => !needsAttention(item.status))
  );

  const pageSize = options.pageSize;
  const pageCount = Math.max(1, Math.ceil(rest.length / pageSize));
  const page = Math.min(options.page, pageCount);
  const start = (page - 1) * pageSize;
  const rows = rest.slice(start, start + pageSize);

  return {
    attention,
    rows,
    total: rest.length,
    page,
    pageCount,
    from: rest.length === 0 ? 0 : start + 1,
    to: start + rows.length,
  };
}

export function applicationPageWindow(
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
