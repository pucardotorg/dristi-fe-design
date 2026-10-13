import {
  applicationsFile,
  filingStatusLabel,
  filingStatusVariant,
  isSubmittedToCourt,
  othersTitle,
  submissionDocumentSrc,
  submissionTypeLabel,
  submittedByName,
  APPLICATION_TYPES,
  SUBMISSION_DOCUMENT_TYPES,
  type ApplicationsFile,
  type FilingStatus,
  type Submission,
} from "./applications";
import {
  applicationStepFor,
  canSeeApplication,
  objectionAgainst,
  objectionDeadline,
  objectionInvitations,
  type ObjectionInvitation,
  submissionSide,
  waitingOn,
  type ApplicationStep,
  type ApplicationViewer,
} from "./application-access";
import { dayStamp } from "./peek";
import { formatCaseDate, type CaseRecord } from "./types";
import { displayName } from "./names";

export type ApplicationSide = "complainant" | "accused" | "court";

const SIDE_LABEL: Record<ApplicationSide, string> = {
  complainant: "Complainant",
  accused: "Accused",
  court: "Court",
};

export function applicationSideLabel(side: ApplicationSide): string {
  return SIDE_LABEL[side];
}

/** Another application this one points at, or is pointed at by. */
export type LinkedApplication = {
  id: string;
  typeLabel: string;
  statusLabel: string;
  statusVariant: ReturnType<typeof filingStatusVariant>;
  /** The number to cite it by: the court's, else the temporary one. */
  number?: string;
};

/**
 * An application as the PRD records it (Application Lifecycle v20,
 * "Application attributes"), for one viewer. The register, the Needs
 * attention list and the record dialog all read this one shape. `source`
 * stays attached because the signing and payment dialogs still take the
 * underlying filing.
 */
export type ApplicationRecord = {
  id: string;
  /** One flat catalogue; see `APPLICATION_TYPE_OPTIONS`. */
  type: string;
  typeLabel: string;
  title: string;
  /** What to call it: an Others filer's own title, else the type's name. */
  name: string;
  /** An Others filer's own title (the PRD's "Application Title"). */
  ownTitle?: string;
  status: FilingStatus;
  statusLabel: string;
  statusVariant: ReturnType<typeof filingStatusVariant>;
  /** The step this viewer can take, if any. Drives Needs attention. */
  step: ApplicationStep | null;
  needsAction: boolean;
  /** Said on the row when the viewer's filing waits on someone else's step. */
  waitingOn?: string;
  /** ISO days; each is absent until that step has happened. */
  createdOn: string;
  submittedOn?: string;
  onboardedOn?: string;
  decisionOn?: string;
  created: string;
  submitted?: string;
  onboarded?: string;
  decision?: string;
  /** "8 Sep 2025", for the register, which sets two dates side by side. */
  createdShort: string;
  submittedShort?: string;
  onboardedShort?: string;
  decisionShort?: string;
  filedById: string;
  /** Raised by: the advocate or party in person who signs it. */
  filedBy: string;
  /** Who started the draft, when that was someone else (a clerk); only
   *  until it is submitted. */
  draftedBy?: string;
  /** The litigant it is raised for. */
  onBehalfOf?: string;
  side: ApplicationSide;
  /** Filed by the other side (the viewer's opponent). */
  fromOtherSide: boolean;
  /** Allotted on submission. Shown to the filer, never cited in an order. */
  temporaryId?: string;
  /** Allotted on onboarding: the number the court knows it by. */
  applicationNumber?: string;
  /** Whether the court invited the other side to object. */
  objectionsInvited?: boolean;
  /** For an application that invited objections: the last day to file one. */
  objectionDueOn?: string;
  objectionDue?: string;
  /** The objection filed against this application, if any. */
  objection?: LinkedApplication;
  /** For an objection: the application it objects to. */
  objectionTo?: LinkedApplication;
  /**
   * For an unfiled filing with a known expiry: the day, and days left from
   * today. Needs attention mentions it only within `EXPIRY_NOTICE_DAYS`.
   */
  expiresOn?: string;
  expiresShort?: string;
  expiresInDays?: number;
  /**
   * The viewer's side is invited to object to this (the other side's)
   * application, and has not started its one objection: the File objection
   * task, seen from the record.
   */
  objectionInvite?: {
    dueOn: string;
    due: string;
    dueShort: string;
    /** False for a litigant or PoA holder: their advocate files it. */
    canFile: boolean;
  };
  /** The order's operative line, once decided or dismissed. */
  courtResult?: string;
  linkedOrder?: { id: string; label: string };
  documents: { label: string; src?: string }[];
  source: Submission;
};

/** The number a row is cited by: the court's once allotted, else the temporary one. */
export function applicationNumberLabel(
  application: Pick<ApplicationRecord, "applicationNumber" | "temporaryId">
): string | undefined {
  return application.applicationNumber ?? application.temporaryId;
}

/** How close an expiry has to be before Needs attention mentions it (owner, Sept 24). */
export const EXPIRY_NOTICE_DAYS = 3;

/** An expiry worth saying in Needs attention: known, and within the notice window. */
export function expiringSoon(application: ApplicationRecord): boolean {
  return (
    application.expiresInDays !== undefined &&
    application.expiresInDays >= 0 &&
    application.expiresInDays <= EXPIRY_NOTICE_DAYS
  );
}

/** Whether the viewer has set up the bulk signing tool (APP-10). A working
 *  stand-in until product says how the screen learns this. */
export const HAS_BULK_SIGNING_TOOL = true;

/** The two catalogues as one list. Each had its own "Others"; one survives. */
const OTHERS = "others";
function flatType(id: string): string {
  return id === "application-others" || id === "document-others" ? OTHERS : id;
}

/**
 * The register's Type filter. The document bucket "Objections" is left out:
 * an objection is an application type now (Objection), and two near-identical
 * entries would split one kind of filing across two filters.
 */
export const APPLICATION_TYPE_OPTIONS: { value: string; label: string }[] = [
  ...[...APPLICATION_TYPES, ...SUBMISSION_DOCUMENT_TYPES]
    .filter(
      (item) => flatType(item.id) !== OTHERS && item.id !== "objections"
    )
    .map((item) => ({ value: item.id as string, label: item.label }))
    .sort((a, b) => a.label.localeCompare(b.label)),
  { value: OTHERS, label: "Generic" },
];

export type ApplicationPerson = { id: string; name: string; role: string };

/** A File objection task the viewer's side has open (PRD citizen-side task). */
export type ObjectionTask = {
  application: ApplicationRecord;
  dueOn: string;
  due: string;
  /** False for a litigant or PoA holder: a reminder, their advocate files. */
  canFile: boolean;
};

/**
 * What a batch of filings is called in copy: "documents" when every one is a
 * memo or affidavit, else "applications". Read off the rows, so a screen
 * shared by both tabs never needs telling.
 */
export function filingNoun(
  items: Pick<ApplicationRecord, "source">[],
  count = items.length
): string {
  const documents =
    items.length > 0 && items.every((item) => item.source.kind === "document");
  const noun = documents ? "document" : "application";
  return count === 1 ? noun : `${noun}s`;
}

export type ApplicationsRegister = {
  applications: ApplicationRecord[];
  /** Memos and affidavits: uploads, not applications, so they live under
   *  Documents with their sign and pay steps (PM, Oct 8). Same records. */
  documents: ApplicationRecord[];
  /** Everyone who raised a row this viewer can see, for the Filed by filter. */
  people: ApplicationPerson[];
  /** File objection tasks for the viewer's side, soonest first. */
  objectionTasks: ObjectionTask[];
};

/**
 * A step taken in this session. Signing and paying move a filing on in
 * memory only; the court side that would move it further is not built.
 */
export type ApplicationMove = {
  status: FilingStatus;
  /** ISO day, for a filing submitted in this session. */
  submittedOn?: string;
};

/** Where this visit's moves on a case are kept (see `demo-session.ts`). */
export function movesKey(caseId: string): string {
  return `applications-moves:${caseId}`;
}

export function parseMoves(
  raw: string | null
): ReadonlyMap<string, ApplicationMove> {
  if (!raw) return new Map();
  try {
    const value: unknown = JSON.parse(raw);
    return Array.isArray(value)
      ? new Map(value as [string, ApplicationMove][])
      : new Map();
  } catch {
    return new Map();
  }
}

/**
 * Everything the case's filers have raised, as this viewer may see it. The
 * pack also tags some filings as document submissions (affidavits, memos):
 * those are uploads, not applications, and come back separately as
 * `documents` for the Documents tab (PM, Oct 8; View Case CHG-28).
 *
 * Only what `viewer` may see is returned (ALC-17 and "Users and actions").
 * A null viewer (the account is nobody on this case) sees nothing.
 *
 * Sorted by submitted date, newest first, falling back to the created date
 * for filings not yet submitted (working guess for APP-08).
 */
export function applicationsRegister(
  record: CaseRecord,
  options: {
    viewer: ApplicationViewer | null;
    today: string;
    moves?: ReadonlyMap<string, ApplicationMove>;
    /** Filed from the form during this visit (see `saved-application-drafts.ts`). */
    saved?: Submission[];
  }
): ApplicationsRegister {
  const base = applicationsFile(record);
  const file: ApplicationsFile = {
    ...base,
    /* A saved draft that reopened a pack draft carries its id and replaces it. */
    submissions: [
      ...(options.saved ?? []),
      ...base.submissions.filter(
        (item) => !options.saved?.some((saved) => saved.id === item.id)
      ),
    ].map((original) => applyMove(original, options.moves?.get(original.id))),
  };
  const { viewer, today } = options;
  if (!viewer)
    return { applications: [], documents: [], people: [], objectionTasks: [] };

  const byId = new Map(file.submissions.map((item) => [item.id, item]));
  const invitations = new Map(
    objectionInvitations(viewer, file, today).map((item) => [
      item.application.id,
      item,
    ])
  );
  const toRecord = (source: Submission): ApplicationRecord =>
    recordFor(source, file, viewer, byId, today, invitations.get(source.id));

  const visible = file.submissions
    .filter((source) => canSeeApplication(viewer, source, file))
    .map(toRecord)
    .sort((a, b) =>
      (b.submittedOn ?? b.createdOn).localeCompare(a.submittedOn ?? a.createdOn)
    );
  const applications = visible.filter(
    (item) => item.source.kind === "application"
  );
  const documents = visible.filter((item) => item.source.kind === "document");

  const seen = new Set(visible.map((item) => item.filedById));
  const people = file.people
    .filter((person) => seen.has(person.id))
    .map((person) => ({
      id: person.id,
      name: displayName(person.name),
      role: person.role,
    }));

  const objectionTasks = [...invitations].map(([id, { dueOn, canFile }]) => ({
    application: toRecord(byId.get(id)!),
    dueOn,
    due: formatCaseDate(dueOn),
    canFile,
  }));

  return { applications, documents, people, objectionTasks };
}

function applyMove(
  original: Submission,
  move: ApplicationMove | undefined
): Submission {
  if (!move) return original;
  const next: Submission = { ...original, status: move.status };
  if (isSubmittedToCourt(move.status) && !original.submittedOn) {
    next.submittedOn = move.submittedOn ?? null;
    next.temporaryId = original.temporaryId ?? sessionTemporaryId(original);
  }
  return next;
}

/**
 * A temporary identifier for a filing paid in this session (ALC-02). Shaped
 * like the pack's, and stable for the row, so the same filing reads the same
 * after a re-render.
 */
/* From the whole id, not its tail: ids that end alike ("…-signature")
   all came out as KL-TMP-ATURE. */
function sessionTemporaryId(submission: Submission): string {
  let hash = 0;
  for (const char of submission.id) {
    hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  }
  const tail = hash.toString(36).toUpperCase().padStart(5, "0").slice(-5);
  return `KL-TMP-${tail}`;
}

function linkedFrom(source: Submission): LinkedApplication {
  return {
    id: source.id,
    typeLabel: submissionTypeLabel(source.type),
    statusLabel: filingStatusLabel(source.status),
    statusVariant: filingStatusVariant(source.status),
    number: source.applicationNumber ?? source.temporaryId ?? undefined,
  };
}

function daysBetween(from: string, to: string): number {
  return Math.round(
    (Date.parse(`${to.slice(0, 10)}T00:00:00Z`) -
      Date.parse(`${from.slice(0, 10)}T00:00:00Z`)) /
      86_400_000
  );
}

function recordFor(
  source: Submission,
  file: ApplicationsFile,
  viewer: ApplicationViewer,
  byId: Map<string, Submission>,
  today: string,
  invite?: ObjectionInvitation
): ApplicationRecord {
  const peopleById = new Map(file.people.map((person) => [person.id, person]));
  const step = applicationStepFor(viewer, source, file);
  const drafter =
    source.createdById !== source.submittedById
      ? peopleById.get(source.createdById)
      : undefined;
  const party = peopleById.get(source.onBehalfOfId);
  const objection = objectionAgainst(source, file);
  const objectionTarget = source.objectionToId
    ? byId.get(source.objectionToId)
    : undefined;
  const invited = source.objectionsInvited === true && source.decisionOn;
  const dueOn = invited ? objectionDeadline(source.decisionOn!) : undefined;

  return {
    id: source.id,
    type: flatType(source.type),
    typeLabel: submissionTypeLabel(source.type),
    title: source.title,
    /* A memo or affidavit goes by its own title ("Memo of calculation of
       cheque amount and interest"), not its bucket ("Memos"). */
    name:
      source.kind === "document" && source.title.trim()
        ? source.title.trim()
        : (othersTitle(source) ?? submissionTypeLabel(source.type)),
    ownTitle: othersTitle(source) ?? undefined,
    status: source.status,
    statusLabel: filingStatusLabel(source.status),
    statusVariant: filingStatusVariant(source.status),
    step,
    needsAction: step !== null,
    waitingOn: waitingFor(viewer, source, file),
    createdOn: dayStamp(source.addedOn),
    submittedOn: source.submittedOn ?? undefined,
    onboardedOn: source.onboardedOn ?? undefined,
    decisionOn: source.decisionOn ?? undefined,
    created: formatCaseDate(source.addedOn),
    submitted: source.submittedOn ? formatCaseDate(source.submittedOn) : undefined,
    onboarded: source.onboardedOn
      ? formatCaseDate(source.onboardedOn)
      : undefined,
    decision: source.decisionOn ? formatCaseDate(source.decisionOn) : undefined,
    createdShort: shortDate(source.addedOn),
    submittedShort: source.submittedOn ? shortDate(source.submittedOn) : undefined,
    onboardedShort: source.onboardedOn ? shortDate(source.onboardedOn) : undefined,
    decisionShort: source.decisionOn ? shortDate(source.decisionOn) : undefined,
    filedById: source.submittedById,
    filedBy: displayName(submittedByName(source, peopleById)),
    /* Only until it reaches the court (owner, Sept 24): once submitted it is
       the signing advocate's application (the PRD's "Raised By"), and who
       drafted it is theirs to know. */
    draftedBy:
      drafter && !isSubmittedToCourt(source.status)
        ? displayName(drafter.name)
        : undefined,
    onBehalfOf:
      party && party.id !== source.submittedById
        ? displayName(party.name)
        : undefined,
    side: submissionSide(source, peopleById),
    fromOtherSide: submissionSide(source, peopleById) !== viewer.side,
    temporaryId: source.temporaryId ?? undefined,
    applicationNumber: source.applicationNumber ?? undefined,
    objectionsInvited: source.objectionsInvited ?? undefined,
    objectionDueOn: dueOn,
    objectionDue: dueOn ? formatCaseDate(dueOn) : undefined,
    objection:
      objection && canSeeApplication(viewer, objection, file)
        ? linkedFrom(objection)
        : undefined,
    objectionTo: objectionTarget ? linkedFrom(objectionTarget) : undefined,
    expiresOn: source.expiresOn ?? undefined,
    expiresShort: source.expiresOn ? shortDate(source.expiresOn) : undefined,
    expiresInDays: source.expiresOn
      ? daysBetween(today, source.expiresOn)
      : undefined,
    objectionInvite: invite
      ? {
          dueOn: invite.dueOn,
          due: formatCaseDate(invite.dueOn),
          dueShort: shortDate(invite.dueOn),
          canFile: invite.canFile,
        }
      : undefined,
    courtResult: source.courtResult ?? undefined,
    linkedOrder: source.linkedOrder ?? undefined,
    documents: source.documents.map((doc) => ({
      label: doc.label,
      src: submissionDocumentSrc(doc),
    })),
    source,
  };
}

function waitingFor(
  viewer: ApplicationViewer,
  source: Submission,
  file: ApplicationsFile
): string | undefined {
  const signer = waitingOn(viewer, source, file);
  return signer ? `Waiting for ${displayName(signer.name)} to sign` : undefined;
}

function shortDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export type ActionEntry =
  | { kind: "single"; key: string; application: ApplicationRecord }
  | {
      kind: "group";
      key: string;
      step: Exclude<ApplicationStep, "continue">;
      status: FilingStatus;
      applications: ApplicationRecord[];
    }
  | { kind: "objection"; key: string; task: ObjectionTask };

/**
 * The viewer's to-do list (APP-09). Every row here is a step this viewer can
 * take, so two or more waiting on the same step collapse into one entry
 * with one action, whoever drafted them: an advocate signs their clerk's
 * drafts in the same sitting as their own. Drafts never group: each is
 * continued in its own form. File objection tasks lead, because they are the
 * only entries with a deadline the viewer does not control.
 */
export function groupActions(
  rows: ApplicationRecord[],
  objectionTasks: ObjectionTask[] = []
): ActionEntry[] {
  const buckets = new Map<string, ApplicationRecord[]>();
  for (const row of rows) {
    if (!row.step) continue;
    buckets.set(row.step, [...(buckets.get(row.step) ?? []), row]);
  }
  const entries: ActionEntry[] = objectionTasks.map((task) => ({
    kind: "objection",
    key: `objection-${task.application.id}`,
    task,
  }));
  const rest: ActionEntry[] = [];
  for (const [step, bucket] of buckets) {
    if (bucket.length > 1 && step !== "continue") {
      rest.push({
        kind: "group",
        key: step,
        step: step as Exclude<ApplicationStep, "continue">,
        status: bucket[0].status,
        applications: bucket,
      });
    } else {
      for (const application of bucket) {
        rest.push({ kind: "single", key: application.id, application });
      }
    }
  }
  /* Objections keep the top: theirs is a deadline set by the court. Then
     anything about to expire, soonest first, above the rest, which keep
     their order (owner, Sept 24). */
  const soonest = (entry: ActionEntry): number => {
    const members =
      entry.kind === "group"
        ? entry.applications
        : entry.kind === "single"
          ? [entry.application]
          : [];
    const days = members.filter(expiringSoon).map((item) => item.expiresInDays!);
    return days.length ? Math.min(...days) : Number.POSITIVE_INFINITY;
  };
  const ranked = rest
    .map((entry, index) => ({ entry, index, soon: soonest(entry) }))
    .sort((a, b) => a.soon - b.soon || a.index - b.index)
    .map((item) => item.entry);
  return [...entries, ...ranked];
}
