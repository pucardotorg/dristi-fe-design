/**
 * Case-file Overview — three regions: where the case sits in time, what is
 * still owed, and what recently happened. Applications live on their own
 * tab; a pending task is the door into that section.
 *
 * Peek and Overview answer the same questions but no longer carry the same
 * rows. Peek is a drawer with no page chrome, so it states identity itself.
 * Overview sits under the case header, so identity — number, stage and
 * substage, counsel, cheque amount, filing date — is the header's job and
 * repeating it here was the redundancy this model dropped.
 */
import {
  applicationsFile,
  filingStatusLabel,
  isOnboardedStatus,
  type FilingStatus,
} from "./applications";
import {
  hearingOnDate,
  hearingStatusLabel,
  hearingStatusVariant,
  hearingTypeFromCase,
  hearingTypeLabel,
  hearingsFile,
  isHearingHeld,
  type HearingStatus,
} from "./hearings";
import { ordersFile } from "./orders";
import { taskHref } from "../tasks/routes";
import { buildTasks } from "../tasks/sandbox";
import {
  applicationStatusLabel,
  dayStamp,
  dueStatusView,
  formatWeekdayDate,
  isSameDay,
  peekExtras,
  type CasePeekExtras,
  type CaseTask,
  type DueStatusView,
} from "./peek";
import {
  applicationHref,
  caseSectionHref,
  hearingHref,
  orderHref,
} from "./sections";
import { formatCaseDate, outcomeLabel, type CaseRecord } from "./types";
import { displayName } from "./names";

export type OverviewNextHearing = {
  /** "Today" on the day, the formatted date otherwise, or "No hearing
   *  scheduled" (OVW-04). */
  on: string;
  /** The sitting before this one, carried only while nothing is listed, so
   *  the block still says where the case last stood. */
  last?: { on: string; purpose?: string };
  /** What the matter stands listed for — a clause, not a label. */
  purpose?: string;
  /**
   * The listed date split into the parts a calendar rail shows. Absent when
   * nothing is listed — there is no date to set, and the absence is said in
   * words instead.
   */
  tile?: OverviewDateTile;
  /** How the listing stands — scheduled until the court sits, or whatever the
   *  hearings register already says about that date. */
  status?: OverviewHearingStatus;
};

/** A listing status in the two parts a chip needs. The label and the rung
 *  come from the hearings module, so Overview and Hearings say the same word
 *  in the same colour. */
export type OverviewHearingStatus = {
  label: string;
  variant: ReturnType<typeof hearingStatusVariant>;
};

/**
 * The listed date in the parts a calendar face sets it in: the day numeral on
 * its own line, the weekday and the month beneath it. Split in the model
 * rather than in the component because one that takes an ISO string and
 * formats three ways is a component that decides locale, and that decision
 * belongs with the other date formatting in this file.
 *
 * The numeral travels alone again. It was collapsed into a single written-out
 * line when the date last lost its rail; the face is back, and on a two-column
 * face "19 August 2026" is a sentence where the eye wants a numeral.
 *
 * Names are written out — "Wednesday", "August 2026" — rather than clipped to
 * three letters. The column has room for the words, and "Wed · Aug" was two
 * abbreviations doing the work of a date.
 *
 * `full` carries it as one string for the accessible name: a numeral and two
 * lines under it reach a screen reader as three fragments, and the date has to
 * arrive as the date it is.
 */
export type OverviewDateTile = {
  /** For `<time dateTime>`. */
  iso: string;
  /** "Wednesday, 19 August 2026" — the accessible name. */
  full: string;
  /** "19" — the numeral the eye lands on. */
  day: string;
  /** "Wednesday" */
  weekday: string;
  /** "August 2026" */
  monthYear: string;
  /** The sitting is today. */
  today: boolean;
};

export type OverviewTask = {
  id: string;
  title: string;
  /** Who holds the task, or the standing direction. Absent when neither is
   *  known — see `taskDetail`. */
  detail?: string;
  /** The deadline in the two parts the row renders, already ranked against
   *  the next sitting. Resolved here rather than in the row — see
   *  `dueStatusView`. Absent for a task the court set no date on. */
  due?: DueStatusView;
  /** Where Respond goes: the task's own workflow on the Pending tasks page
   *  when it has one (OVW-14), otherwise the related tab. */
  respondHref?: string;
  /** Where the row goes when it names no action: the whole row is the link
   *  then, and Applications is the tab that owns most pending filings. */
  href: string;
  /** The verb, when the task names one. A row with an action is not itself
   *  a link — the button is the affordance, because an anchor inside an
   *  anchor is neither valid markup nor reachable by keyboard. */
  action?: { label: string; href: string };
};

/** The PRD's category set (OVW-09). Process and Parties have no event source
 *  in the prototype yet; the full catalogue is maintained outside it. */
export type OverviewUpdateCategory =
  | "Filing"
  | "Orders"
  | "Submissions"
  | "Process"
  | "Hearing"
  | "Parties";

export type OverviewUpdate = {
  id: string;
  /** One line saying what happened (OVW-06). */
  title: string;
  category: OverviewUpdateCategory;
  date: string;
  href: string;
  /** Happened-only: today is current, everything else is past. */
  status: "past" | "current";
};

export type CaseOverviewModel = {
  /** Absent once the case is disposed — there is no next date. */
  nextHearing: OverviewNextHearing;
  tasks: OverviewTask[];
  /** What the pending work is owed before, when that is true of all of it.
   *  Null otherwise — see `tasksBeforeHearing`. */
  tasksCaption: string | null;
  updates: OverviewUpdate[];
};

/** A pulse, not a register — the owning tab holds the rest. */
const UPDATE_LIMIT = 3;

export function caseOverviewModel(
  record: CaseRecord,
  now: number,
): CaseOverviewModel {
  const extras = peekExtras(record.id);
  return {
    nextHearing: overviewNextHearing(record, now),
    tasks: overviewTasks(record, extras, now),
    tasksCaption: tasksBeforeHearing(record, extras.tasks ?? []),
    updates: overviewUpdates(record, extras, now),
  };
}

/**
 * A disposed case has no next date — the outcome is the end of it. A live
 * case with nothing listed still gets the card: the absence is the fact,
 * and it is the one worth acting on.
 */
function overviewNextHearing(
  record: CaseRecord,
  now: number,
): OverviewNextHearing {
  if (record.disposal || !record.nextHearing) {
    return {
      on: "No hearing scheduled",
      last: record.previousHearingOn
        ? {
            on: formatCaseDate(record.previousHearingOn),
            purpose: peekExtras(record.id).lastHearingPurpose,
          }
        : undefined,
    };
  }
  const purpose = record.nextHearing.purpose.trim();
  const status = nextHearingStatus(record, record.nextHearing.on);
  return {
    on: isSameDay(record.nextHearing.on, now)
      ? "Today"
      : formatCaseDate(record.nextHearing.on),
    purpose: purpose.length > 0 ? purpose : undefined,
    tile: overviewDateTile(record.nextHearing.on, now),
    /* A next hearing is scheduled by definition, so that chip said nothing
       (owner, Sept 18). Any other listing status still shows. */
    status:
      status === "scheduled"
        ? undefined
        : {
            label: hearingStatusLabel(status),
            variant: hearingStatusVariant(status),
          },
  };
}

/**
 * How the listing stands. A date on the case row means the matter is listed
 * and not yet heard, so "scheduled" is the floor — but the hearings register
 * is the thing that knows if the court has already moved that sitting, so it
 * is asked first. No register for this case is not a reason to say nothing:
 * the date on the row is still a fact.
 */
function nextHearingStatus(record: CaseRecord, on: string): HearingStatus {
  try {
    return hearingOnDate(hearingsFile(record), on)?.status ?? "scheduled";
  } catch {
    return "scheduled";
  }
}

/**
 * Built off `dayStamp` rather than the raw ISO string, so a stored timestamp
 * cannot roll the face onto the previous day in a west-of-UTC render — the
 * same guard `formatWeekdayDate` already applies. All three faces are
 * formatted off that one local-midnight value rather than through
 * `formatCaseDate`, which parses the bare string and would reintroduce the
 * roll this guards against.
 */
function overviewDateTile(iso: string, now: number): OverviewDateTile {
  const stamp = dayStamp(iso);
  const on = new Date(`${stamp}T00:00:00`);
  return {
    iso: stamp,
    full: formatWeekdayDate(iso),
    day: on.toLocaleDateString("en-IN", { day: "numeric" }),
    weekday: on.toLocaleDateString("en-IN", { weekday: "long" }),
    monthYear: on.toLocaleDateString("en-IN", {
      month: "long",
      year: "numeric",
    }),
    today: isSameDay(iso, now),
  };
}

/**
 * Soonest first — the list is a queue, and fixtures are not ordered.
 *
 * Most pending work is a filing, so a row with no named verb opens
 * Applications. A process fee row used to anchor into Service of process
 * instead, on the grounds that the card held its detail. It no longer does:
 * that card is about the accused, and the only fee task pointing at it was
 * for a witness summons — an anchor to a card that is not on the page. The
 * row takes the ordinary destination.
 *
 * A named action goes to the section the task names. Sending every action
 * to Applications made "Upload affidavit" open the tab that does not hold
 * documents, which is a button that lies about where it lands.
 */
function overviewTasks(
  record: CaseRecord,
  extras: CasePeekExtras,
  now: number,
): OverviewTask[] {
  const authored: OverviewTask[] = (extras.tasks ?? [])
    .slice()
    .sort((a, b) => a.dueOn.localeCompare(b.dueOn))
    .map((task) => ({
      id: task.id,
      title: task.title,
      detail: taskDetail(task),
      /* Anchored to the same date the section caption names, so the rung and
         the caption cannot disagree about which sitting the work is owed
         before. */
      due: dueStatusView(task.dueOn, record.nextHearing?.on, now),
      href: caseSectionHref(record.id, "applications"),
      action: task.action
        ? {
            label: task.action.label,
            href: caseSectionHref(record.id, task.action.section),
          }
        : undefined,
    }));
  return [...pendingPageTasks(record, now), ...authored];
}

/**
 * The case's open tasks on the Pending tasks page. The demo matters that page
 * runs on appear here as `tw-<its id>`, so those tasks are the same tasks:
 * Respond opens the task there and enters its real workflow (pay, sign, file,
 * fix). Cases outside that world keep their authored tasks, which have no
 * workflow behind them yet.
 */
const OPEN_TASK_STATUSES = new Set(["open", "draft", "ready"]);
function pendingPageTasks(record: CaseRecord, now: number): OverviewTask[] {
  if (!record.id.startsWith("tw-")) return [];
  const caseId = record.id.slice(3);
  return buildTasks()
    .filter(
      (task) => task.caseId === caseId && OPEN_TASK_STATUSES.has(task.status)
    )
    .map((task) => ({
      id: task.id,
      title: task.title,
      detail: task.why.event,
      due: task.dueAt
        ? dueStatusView(task.dueAt, record.nextHearing?.on, now)
        : undefined,
      href: taskHref(task.id),
      respondHref: taskHref(task.id),
    }));
}

/**
 * Who holds the task, in the words peek already uses for the same object —
 * a second phrasing of one fact is how two screens stop agreeing.
 *
 * Peek ends on the due date when there is neither a direction nor an owner.
 * Here the row states its due status a line above, so that fallback would
 * print the same date twice; the line is dropped instead.
 */
function taskDetail(task: CaseTask): string | undefined {
  if (task.note) return displayName(task.note);
  if (task.assignedTo && task.markedOn) {
    return `Assigned to ${displayName(task.assignedTo)} · marked ${formatCaseDate(task.markedOn)}`;
  }
  return undefined;
}

/**
 * The tasks card sits beside the next hearing and the two have never
 * acknowledged each other, though on most cases the work is owed *for* that
 * date. Said once at the section, it is context; said on every row it would
 * be three more dates to read.
 *
 * Only when it holds for every task. A caption that is right about two rows
 * out of three teaches the reader to distrust the third, which is exactly
 * the row that falls after the hearing.
 */
function tasksBeforeHearing(
  record: CaseRecord,
  tasks: CaseTask[],
): string | null {
  const on = record.nextHearing?.on;
  if (!on || tasks.length === 0) return null;
  const hearingDay = dayStamp(on);
  const allBefore = tasks.every((task) => dayStamp(task.dueOn) <= hearingDay);
  return allBefore ? `Before the hearing on ${formatCaseDate(on)}` : null;
}

type UpdateKind = "hearing" | "order" | "application" | "document" | "filing";

type RawUpdate = {
  id: string;
  kind: UpdateKind;
  on: string;
  title: string;
  detail?: string;
  href: string;
};

/**
 * Newest first, capped. Only facts that already happened — in-flight
 * filings stay on Applications / Pending tasks. Dates are clipped to
 * the complaint window so a featured dummy pack from another story
 * cannot leak into this case.
 */
function overviewUpdates(
  record: CaseRecord,
  extras: CasePeekExtras,
  now: number,
): OverviewUpdate[] {
  const today = dayStamp(now);
  const filedOn = dayStamp(record.filedOn);
  const raw: RawUpdate[] = [
    {
      id: `${record.id}-filed`,
      kind: "filing",
      on: filedOn,
      title: "Complaint filed",
      href: caseSectionHref(record.id, "case-file"),
    },
  ];

  if (
    record.previousHearingOn &&
    inComplaintWindow(record.previousHearingOn, filedOn, today)
  ) {
    raw.push({
      id: `${record.id}-last-hearing`,
      kind: "hearing",
      on: dayStamp(record.previousHearingOn),
      title:
        extras.lastHearingPurpose ??
        record.substage ??
        hearingTypeLabel(hearingTypeFromCase(record)),
      detail: extras.lastHearingStatus,
      href: lastHearingHref(record),
    });
  }

  if (
    record.disposal &&
    inComplaintWindow(record.disposal.on, filedOn, today)
  ) {
    raw.push({
      id: `${record.id}-disposal`,
      kind: "order",
      on: dayStamp(record.disposal.on),
      title: outcomeLabel(record.disposal.outcome),
      href: caseSectionHref(record.id, "orders-and-notifications"),
    });
  }

  for (const application of extras.applications ?? []) {
    if (!inComplaintWindow(application.filedOn, filedOn, today)) continue;
    raw.push({
      id: application.id,
      kind: "application",
      on: dayStamp(application.filedOn),
      title: application.title,
      detail: applicationStatusLabel(application.status),
      href: registeredApplicationHref(record, application.title),
    });
  }

  collectRegisterUpdates(record, filedOn, today, raw);

  const seen = new Set<string>();
  return raw
    .filter((item) => {
      const key = `${item.kind}:${item.on}:${item.title.toLowerCase()}`;
      if (seen.has(key) || seen.has(item.id)) return false;
      seen.add(key);
      seen.add(item.id);
      return true;
    })
    .sort((a, b) => {
      const byDate = b.on.localeCompare(a.on);
      if (byDate !== 0) return byDate;
      const byKind = updateKindRank(b.kind) - updateKindRank(a.kind);
      return byKind !== 0 ? byKind : b.id.localeCompare(a.id);
    })
    .slice(0, UPDATE_LIMIT)
    .map((item) => ({
      id: item.id,
      title: updateLine(item),
      category: updateCategory(item.kind),
      date: formatCaseDate(item.on),
      href: item.href,
      status: dayStamp(item.on) === today ? "current" : "past",
    }));
}

/** The application's own record when the register holds one by that title. */
function registeredApplicationHref(record: CaseRecord, title: string): string {
  try {
    const match = applicationsFile(record).submissions.find(
      (item) => item.title.trim().toLowerCase() === title.trim().toLowerCase()
    );
    if (match) return applicationHref(record.id, match.id);
  } catch {
    /* No applications register for this case: fall through to the tab. */
  }
  return caseSectionHref(record.id, "applications");
}

/** The last sitting's own record when the register has it, else the list. */
function lastHearingHref(record: CaseRecord): string {
  try {
    const hearing = record.previousHearingOn
      ? hearingOnDate(hearingsFile(record), record.previousHearingOn)
      : undefined;
    if (hearing) return hearingHref(record.id, hearing.id);
  } catch {
    /* No hearings register for this case: fall through to the list. */
  }
  return caseSectionHref(record.id, "hearings");
}

function collectRegisterUpdates(
  record: CaseRecord,
  filedOn: string,
  today: string,
  raw: RawUpdate[],
) {
  const lastHearingDay = record.previousHearingOn
    ? dayStamp(record.previousHearingOn)
    : null;
  const disposalDay = record.disposal ? dayStamp(record.disposal.on) : null;

  try {
    for (const hearing of hearingsFile(record).hearings) {
      if (!isHearingHeld(hearing)) continue;
      if (!inComplaintWindow(hearing.on, filedOn, today)) continue;
      if (lastHearingDay && dayStamp(hearing.on) === lastHearingDay) continue;
      raw.push({
        id: hearing.id,
        kind: "hearing",
        on: dayStamp(hearing.on),
        title: hearingTypeLabel(hearing.type),
        href: hearingHref(record.id, hearing.id),
      });
    }
  } catch {
    // Featured last sitting is already on the record when the pack disagrees.
  }

  for (const order of ordersFile(record).orders) {
    if (order.status !== "published") continue;
    if (!inComplaintWindow(order.issuedOn, filedOn, today)) continue;
    if (disposalDay && dayStamp(order.issuedOn) === disposalDay) continue;
    raw.push({
      id: order.id,
      kind: "order",
      on: dayStamp(order.issuedOn),
      title: order.title,
      href: orderHref(record.id, order.id),
    });
  }

  /* No note on a submission row. `Submission.request` is the prayer in plain
     words, and the register deliberately keeps it off the record dialog
     because a paraphrase placed near the operative text invites reliance on
     the paraphrase (see `applications.ts`). A three-row pulse is further from
     the filed document than that dialog is, not closer, so the reasoning
     applies harder here. It is also not a business entry, so it could not
     travel under the one term this disclosure uses. */
  for (const submission of applicationsFile(record).submissions) {
    if (!submissionOccurred(submission.status)) continue;
    if (!inComplaintWindow(submission.addedOn, filedOn, today)) continue;
    raw.push({
      id: submission.id,
      kind: submission.kind === "document" ? "document" : "application",
      on: dayStamp(submission.addedOn),
      title: submission.title,
      /* The status, not a gist of the order: only the order says why, and
         it is its own update in this list (owner, Sept 24). */
      detail: filingStatusLabel(submission.status),
      href: applicationHref(record.id, submission.id),
    });
  }
}

/**
 * A filing both sides may see. The overview has no viewer, so it lists only
 * what the Application Lifecycle PRD shows everyone: an application the court
 * has onboarded (ALC-17 hides it from the other side until then; a dismissed
 * one never gets there), and a submission nobody decides (an objection, an
 * affidavit, a memo). The filer's own not-yet-onboarded filings stay on the
 * Applications tab, which knows who is looking.
 */
function submissionOccurred(status: FilingStatus): boolean {
  return isOnboardedStatus(status) || status === "submitted";
}

function inComplaintWindow(
  on: string,
  filedOn: string,
  today: string,
): boolean {
  const day = dayStamp(on);
  return day >= filedOn && day <= today;
}

/** Same-day: the sitting outranks a filing; an order outranks a submission. */
function updateKindRank(kind: UpdateKind): number {
  switch (kind) {
    case "hearing":
      return 4;
    case "order":
      return 3;
    case "application":
    case "document":
      return 2;
    case "filing":
      return 1;
  }
}

function updateCategory(kind: UpdateKind): OverviewUpdateCategory {
  switch (kind) {
    case "hearing":
      return "Hearing";
    case "order":
      return "Orders";
    case "application":
    case "document":
      return "Submissions";
    case "filing":
      return "Filing";
  }
}

/** The event and its outcome as the one line the row shows. */
function updateLine(item: RawUpdate): string {
  return item.detail ? `${item.title} · ${item.detail}` : item.title;
}
