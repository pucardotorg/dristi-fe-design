/**
 * Per-case sidecar for peek and the case-file Overview. Applications and
 * tasks are review fixtures — those screens are not designed yet. Overview
 * uses extras only for proceeding detail (evidence) and blocking work;
 * identity stays in the header.
 */
import {
  formatCaseDate,
  outcomeLabel,
  stageLabel,
  type CaseRecord,
  type CounselSide,
} from "./types";

export type ApplicationStatus =
  | "sent-back"
  | "accepted"
  | "allowed"
  | "allowed-for-the-day";

export type CaseApplication = {
  id: string;
  title: string;
  status: ApplicationStatus;
  filedOn: string;
  filedBy?: CounselSide;
  /** Registry application number, when one has been allotted. */
  number?: string;
  /** Overrides the generic status label — e.g. allowed for one date only. */
  statusLabel?: string;
  /** Short order, outcome, or standing direction. */
  summary?: string;
  defects?: string[];
};

export type CaseTask = {
  id: string;
  title: string;
  dueOn: string;
  /** Who holds the task. Shown in place of the due date when known. */
  assignedTo?: string;
  /** When the task was raised — only meaningful alongside `assignedTo`. */
  markedOn?: string;
  /** Standing direction when the task is not assigned to a person. */
  note?: string;
  /** What fails on the next posting if this is not done. */
  consequence?: string;
  /** The verb the task names, and the section that owns it. Its presence is
   *  what makes an Overview row a plain row with an outline button instead
   *  of a whole-row link. Absent when product has not named the verb. */
  action?: { label: string; section: "applications" | "documents" | "hearings" };
};

export type OverviewAppearance = {
  name: string;
  role: string;
};

export type EvidenceStepStatus = "completed" | "partly-completed";

export type EvidenceWitness = {
  id: string;
  name: string;
  /** Bank designation or other role, when the witness is not a party. */
  role?: string;
  /** Standing direction when examination has not started. */
  direction?: string;
  steps?: { label: string; status: EvidenceStepStatus }[];
};

export type CaseEvidence = {
  status: "in-progress" | "closed";
  exhibitsMarked?: string;
  /** Plain-language where-this-sits line for Overview. */
  summary?: string;
  witnesses: EvidenceWitness[];
};

export type CaseCheque = {
  number: string;
  dated: string;
  bank: string;
  dishonourOn: string;
  returnReason: string;
  demandNoticeSentOn: string;
  noticeDeliveredOn: string;
  paymentReceived: boolean;
};

export type CasePeekExtras = {
  /**
   * The registry's second number, shown after the case number in the header.
   * Kerala's summary-trial ("ST") number is the design's example; the
   * per-state format is unconfirmed — see docs/product/open-questions.md.
   */
  altCaseNumber?: string;
  /** The day the registry allotted `altCaseNumber`. Fixture guess, worklist K. */
  altCaseNumberOn?: string;
  chequeAmount?: number;
  /** How the accused is described on the cause title beyond the short name. */
  accusedRepresentation?: string;
  /** The side the signed-in advocate appears for, marked on that party row. */
  appearingFor?: CounselSide;
  orderOfTheDay?: string;
  /** Purpose bullets for the next posting, when the list field is one line. */
  postingPurposes?: string[];
  requiredToAppear?: OverviewAppearance[];
  lastHearingPurpose?: string;
  /** How the last hearing ended — part-heard, adjourned, concluded. */
  lastHearingStatus?: string;
  evidence?: CaseEvidence;
  cheque?: CaseCheque;
  applications?: CaseApplication[];
  tasks?: CaseTask[];
};

export type PeekHistoryItem = {
  on: string;
  title: string;
  note?: string;
  status: "past" | "current" | "future";
};

const MS_DAY = 24 * 60 * 60 * 1000;

export function dayStamp(isoOrMs: string | number): string {
  if (typeof isoOrMs === "string") return isoOrMs.slice(0, 10);
  const date = new Date(isoOrMs);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function daysUntil(iso: string, now: number): number {
  const due = Date.parse(`${dayStamp(iso)}T00:00:00`);
  const today = Date.parse(`${dayStamp(now)}T00:00:00`);
  return Math.round((due - today) / MS_DAY);
}

export function isSameDay(iso: string, now: number): boolean {
  return daysUntil(iso, now) === 0;
}

export function formatWeekdayDate(iso: string): string {
  return new Date(`${dayStamp(iso)}T00:00:00`).toLocaleDateString("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export function formatChequeAmount(amount: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);
}

/**
 * A deadline in parts, not as one finished string. The interval is the half
 * that carries urgency and the date is the half work is planned against, and
 * a caller that ranks a deadline — a badge on the interval, the date plain
 * beside it — needs to treat them differently. Callers that only state the
 * deadline take `label`, which is the two joined in the order they read: the
 * interval leads, because a column of absolute dates makes the reader do the
 * subtraction on every row to find which one is urgent.
 */
export type DueStatus = {
  /** "6 days past due" · "Due today" · "Due tomorrow" · "Due in 5 days" */
  relative: string;
  /** The calendar date the interval resolves to. Always present. */
  on: string;
  /** Interval then date, as the deadline reads when it is one line. Past
   *  due and today are the interval alone — the date adds nothing there. */
  label: string;
  overdue: boolean;
};

export function formatDueStatus(iso: string, now: number): DueStatus {
  const days = daysUntil(iso, now);
  const on = formatCaseDate(iso);
  if (days < 0) {
    const past = Math.abs(days);
    const relative = past === 1 ? "1 day past due" : `${past} days past due`;
    return { relative, on, label: relative, overdue: true };
  }
  if (days === 0) {
    return { relative: "Due today", on, label: "Due today", overdue: false };
  }
  const relative = days === 1 ? "Due tomorrow" : `Due in ${days} days`;
  return { relative, on, label: `${relative} · ${on}`, overdue: false };
}

/**
 * Where a deadline sits against the sitting it is owed for.
 *
 * The rung is anchored to the next hearing rather than to a count of days,
 * because §138 work is owed *for* an appearance: a step you owe before the
 * court next sits is the one warranting caution, and one falling after that
 * date can wait for it. A "due within N days" cutoff would be a number
 * invented in the UI — this line is already the frame Pending tasks states
 * in its own caption ("Before the hearing on …").
 */
export type DueRamp =
  /** The date has gone. */
  | "past"
  /** Falls on or before the next sitting. Subsumes today and tomorrow. */
  | "before-hearing"
  /** Falls after the next sitting, or the case has no date listed to be
   *  owed before. */
  | "later";

/** A deadline in the two parts a row renders, plus its rung. */
export type DueStatusView = {
  relative: string;
  on: string;
  ramp: DueRamp;
};

/**
 * The ranked form of a deadline.
 *
 * Resolved in the model, never in the row: a component that reaches for a
 * case record to pick a colour gives presentation logic a second home. It
 * lives *here* rather than in `overview.ts` or `service.ts` because Pending
 * tasks and the Service of process obligation render through one shared
 * line, and two copies of this comparison are two places for the two cards
 * to start escalating differently.
 *
 * Takes the listed date, not the record — the caller owns reading it.
 * `null` means nothing is listed, which is the same rung as "after".
 */
export function dueStatusView(
  dueOn: string,
  nextHearingOn: string | null | undefined,
  now: number
): DueStatusView {
  const due = formatDueStatus(dueOn, now);
  return {
    relative: due.relative,
    on: due.on,
    ramp: dueRamp(due, dueOn, nextHearingOn),
  };
}

function dueRamp(
  due: DueStatus,
  dueOn: string,
  nextHearingOn: string | null | undefined
): DueRamp {
  if (due.overdue) return "past";
  if (!nextHearingOn) return "later";
  return dayStamp(dueOn) <= dayStamp(nextHearingOn)
    ? "before-hearing"
    : "later";
}

export function applicationStatusLabel(status: ApplicationStatus): string {
  switch (status) {
    case "sent-back":
      return "Sent back";
    case "accepted":
      return "Accepted";
    case "allowed":
      return "Allowed";
    case "allowed-for-the-day":
      return "Allowed for the day";
  }
}

export function applicationStatusVariant(
  status: ApplicationStatus
): "destructive" | "success" {
  return status === "sent-back" ? "destructive" : "success";
}

export function evidenceStepLabel(status: EvidenceStepStatus): string {
  return status === "completed" ? "Completed" : "Partly completed";
}

export function evidenceStatusLabel(status: CaseEvidence["status"]): string {
  return status === "in-progress" ? "In progress" : "Closed";
}

export function peekExtras(id: string): CasePeekExtras {
  return PEEK_EXTRAS[id] ?? {};
}

/**
 * Oldest to newest. Dates after today are future; today is current.
 * Built from the case record so every peek has a history tab.
 */
export function peekHistory(record: CaseRecord, now: number): PeekHistoryItem[] {
  const today = dayStamp(now);
  const items: Omit<PeekHistoryItem, "status">[] = [
    { on: record.filedOn, title: "Complaint filed" },
  ];

  if (record.previousHearingOn) {
    items.push({
      on: record.previousHearingOn,
      title: record.substage ?? stageLabel(record.stage),
      note: record.latestUpdate,
    });
  }

  if (record.nextHearing && !record.disposal) {
    items.push({
      on: record.nextHearing.on,
      title: record.nextHearing.purpose,
    });
  }

  if (record.disposal) {
    items.push({
      on: record.disposal.on,
      title: outcomeLabel(record.disposal.outcome),
    });
  }

  return items
    .slice()
    .sort((a, b) => a.on.localeCompare(b.on))
    .map((item) => {
      const day = dayStamp(item.on);
      const status: PeekHistoryItem["status"] =
        day > today ? "future" : day === today ? "current" : "past";
      return { ...item, status };
    });
}

const PEEK_EXTRAS: Partial<Record<string, CasePeekExtras>> = {
  "c-1001": {
    altCaseNumber: "ST 412/2026",
    altCaseNumberOn: "2026-07-03",
    chequeAmount: 450000,
    accusedRepresentation: "represented by proprietor Anand Krishnan",
    appearingFor: "complainant",
    orderOfTheDay:
      "PW-1 was examined in chief and partly cross-examined. Further cross-examination was deferred at the request of counsel for the accused. The complainant was directed to keep PW-2 present and produce the original bank return memo on the next posting date.",
    postingPurposes: [
      "Further cross-examination of PW-1",
      "Examination of PW-2",
      "Production of the original bank return memo",
    ],
    requiredToAppear: [
      { name: "Benny Alexander", role: "PW-1, accountant to the complainant" },
      {
        name: "Priya Nair",
        role: "PW-2, Assistant manager, South Kerala Bank",
      },
    ],
    lastHearingPurpose: "Evidence of the complainant",
    lastHearingStatus: "Part-heard",
    evidence: {
      status: "in-progress",
      exhibitsMarked: "P1–P4",
      summary:
        "PW-1, Benny Alexander, has completed examination-in-chief and is partly cross-examined. PW-2, the bank official, is scheduled to give evidence next.",
      witnesses: [
        {
          id: "PW-1",
          name: "Benny Alexander",
          steps: [
            { label: "Examination-in-chief", status: "completed" },
            { label: "Cross-examination", status: "partly-completed" },
          ],
        },
        {
          id: "PW-2",
          name: "Priya Nair",
          role: "Assistant manager, South Kerala Bank",
          direction: "Directed to appear on the next posting",
        },
      ],
    },
    cheque: {
      number: "781426",
      dated: "2026-04-16",
      bank: "District Commercial Bank",
      dishonourOn: "2026-04-20",
      returnReason: "Funds insufficient",
      demandNoticeSentOn: "2026-04-25",
      noticeDeliveredOn: "2026-04-29",
      paymentReceived: false,
    },
    applications: [
      {
        id: "a-1001-1",
        number: "APP/54/2026",
        title: "Summon bank official and produce account records",
        status: "allowed",
        filedOn: "2026-07-24",
        filedBy: "complainant",
        summary:
          "Process fee must be paid before summons can be issued to PW-2.",
      },
      {
        id: "a-1001-2",
        number: "APP/57/2026",
        title: "Exemption from personal appearance",
        status: "allowed-for-the-day",
        statusLabel: "Allowed for 29 July 2026",
        filedOn: "2026-07-29",
        filedBy: "accused",
      },
    ],
    tasks: [
      {
        id: "t-1001-1",
        title: "Pay process fee for PW-2",
        dueOn: "2026-08-17",
        assignedTo: "Sunil Varghese",
        markedOn: "2026-08-14",
        consequence:
          "If this is not completed, the witness summons cannot be processed.",
        action: { label: "Make payment", section: "applications" },
      },
      {
        id: "t-1001-2",
        title: "Upload chief affidavit of PW-2",
        dueOn: "2026-08-18",
        assignedTo: "Adv. Ramesh Menon",
        markedOn: "2026-08-14",
        consequence:
          "If it is not filed, PW-2's evidence may not be taken on the next posting, subject to the court's direction.",
        action: { label: "Upload affidavit", section: "documents" },
      },
      {
        id: "t-1001-3",
        title: "Produce original bank return memo",
        dueOn: "2026-08-19",
        assignedTo: "Sunil Varghese",
        note: "To be produced during the next hearing",
        consequence:
          "If it is not produced, the copy marked as Exhibit P2 may remain provisional, subject to the court's direction.",
        action: { label: "Upload production memo", section: "documents" },
      },
    ],
  },
  "c-1003": {
    chequeAmount: 180000,
    applications: [
      {
        id: "a-1003-1",
        title: "Application to condone delay in filing the complaint",
        status: "sent-back",
        filedOn: "2026-08-04",
        defects: [
          "Court fee is short by ₹200.",
          "Condonation of delay application is not accompanied by an affidavit.",
        ],
      },
    ],
    tasks: [
      {
        id: "t-1003-1",
        title: "Fix 2 defects: condonation of delay application",
        dueOn: "2026-08-08",
      },
    ],
  },
  "c-1004": {
    altCaseNumber: "ST 1204/2026",
    altCaseNumberOn: "2026-05-04",
    chequeAmount: 275000,
    appearingFor: "complainant",
    orderOfTheDay:
      "Recall application heard in part. Complainant to produce the bank's dishonour memo.",
  },
  "c-1005": {
    chequeAmount: 90000,
    appearingFor: "complainant",
    tasks: [
      {
        id: "t-1005-1",
        title: "File execution papers for the non-bailable warrant",
        dueOn: "2026-08-06",
      },
    ],
  },
  "c-2002": {
    altCaseNumber: "ST 88/2024",
    altCaseNumberOn: "2024-06-10",
  },
  /* The ON Court demo cases sit at the top of Your Cases (newest updatedOn),
     so the first screens a demo opens carry authored pending work beyond the
     seeded bond task. */
  "tw-c-412": {
    chequeAmount: 240000,
    appearingFor: "complainant",
    tasks: [
      {
        id: "t-tw412-1",
        title: "Produce the original cheque and return memo",
        dueOn: "2026-09-01",
        note: "To be produced during the next hearing",
        consequence:
          "If they are not produced, the copies on record may remain provisional, subject to the court's direction.",
        action: { label: "Upload production memo", section: "documents" },
      },
    ],
  },
  "tw-c-88": {
    chequeAmount: 130000,
    appearingFor: "complainant",
    tasks: [
      {
        id: "t-tw88-1",
        title: "File proof of service of the demand notice",
        dueOn: "2026-08-30",
        consequence:
          "If it is not filed, the plea cannot be recorded on the next posting, subject to the court's direction.",
        action: { label: "Upload proof", section: "documents" },
      },
    ],
  },
  // Today's cause-list matters that still owe work before the hearing — the
  // home timeline flags these, and the peek states the task with its action.
  "tw-c-hd3": {
    appearingFor: "complainant",
    tasks: [
      {
        id: "t-twhd3-1",
        title: "Pay the process fee for the summons to the accused",
        dueOn: "2026-09-14",
        consequence:
          "If it is not paid, the summons cannot issue and the matter may be adjourned, subject to the court's direction.",
        action: { label: "Pay process fee", section: "applications" },
      },
    ],
  },
  "tw-c-hd5": {
    appearingFor: "complainant",
    tasks: [
      {
        id: "t-twhd5-1",
        title: "File the chief affidavit of PW-1 before the evidence posting",
        dueOn: "2026-09-14",
        consequence:
          "If it is not filed, evidence cannot be led on the next posting, subject to the court's direction.",
        action: { label: "File affidavit", section: "documents" },
      },
    ],
  },
  "tw-c-hd8": {
    appearingFor: "complainant",
    tasks: [
      {
        id: "t-twhd8-1",
        title: "Produce the postal acknowledgement of the demand notice",
        dueOn: "2026-09-14",
        consequence:
          "If it is not produced, service may remain unproved on the next posting, subject to the court's direction.",
        action: { label: "Upload acknowledgement", section: "documents" },
      },
    ],
  },
  "c-1002": { chequeAmount: 620000 },
  "c-1006": { chequeAmount: 150000 },
  "c-1008": { chequeAmount: 340000 },
};
