/**
 * Process the court has issued — summons, notices, warrants and proclamations — from the
 * moment it waits on a cover to the moment its channel reports back, as data.
 *
 * **Three tabs, cut by who the process is waiting on** (owner, 2026-10-06). The line
 * used to be five tabs, one per stage, which made three of them statuses of the same
 * thing and sent the bench across tabs to do one job. What actually changes the work is
 * whose move it is:
 *
 * - **RPAD collection** waits on the advocate. A registered-post process cannot be signed
 *   until its cover is in the court's hands; nothing else waits here.
 * - **Issuance** waits on the court. Everything to sign, from every channel; the
 *   registered-post covers that are signed and still to be taken to the post office; and
 *   any electronic send the channel refused. A process leaves this tab only when it has
 *   actually left the court.
 * - **Service** waits on the channel: out, and then back — completed or failed.
 *
 * Inside a tab, the statuses are pills, not tabs: one at a time, with All to see the tab
 * whole. The tab is the job; the pill narrows it.
 *
 * **Signing is not sending for registered post** (owner, 2026-10-06). An electronic
 * channel goes out the moment the process is signed — SMS, email, the police through
 * ICOPS. A registered-post cover is signed in a batch and taken to the post office later,
 * so it waits under *To post* until someone marks it posted. A send can also fail before
 * the process ever leaves (ICOPS not answering); that is still the court's to fix, so it
 * waits under *Send failed* in the same tab, not under Service.
 *
 * **What came back is the channel's word, and only registered post is recorded by hand.**
 * Electronic channels report their own outcome. A registered-post acknowledgement comes
 * back to the court as paper, and the clerk records it — in bulk, from the stack of
 * returned covers, using the same type-the-number-then-Enter gesture the covers came in
 * by. The case file's Notice/Process status section (`lib/cases/process-status.ts`) is
 * the party-by-party record of service; this is the court's own worklist.
 *
 * **There is no backend and nothing here is signed, sent, posted or served.**
 * `PROCESS_LINE` is demo data, and every act below moves a row's status in memory and
 * stamps a day. The one demo-only field, `demoSendFailure`, is how the line shows where a
 * refused send lands; a real channel decides that for itself.
 *
 * **The process wording is demo text, not court-approved process** — see
 * `buildProcessDocument`. Numbers are `ST/…` and `CMP/…` both: process can issue before
 * cognizance (a §223 notice on a complaint still numbered CMP) or after it.
 */

import { CURRENT_STAFF } from "./content";
import { matchesQuery } from "./filter-state";
import { causeTitle, formatListingDate, parseIsoDay } from "./hearings";
import { localizeForDownload, voicedForDownload } from "@/lib/court/browser";

/**
 * Which instrument the row is — the "Process type" column.
 *
 * Five, and only these: a row must have a type the templates below can actually write.
 * The words are the case register's own (`lib/cases/orders.ts`), restated rather than
 * imported because the employee area stays self-contained (`content.ts`).
 */
export type CourtProcessTypeId =
  | "summons"
  | "section-223-notice"
  | "dca-notice"
  | "warrant"
  | "proclamation"
  | "attachment";

export const COURT_PROCESS_TYPES: {
  id: CourtProcessTypeId;
  /** How the type is written where it stands on its own — a column, a filter, a title. */
  label: string;
  /**
   * How it is written inside a sentence: "Read the summons in ST/1301/2026".
   *
   * Carried rather than lower-cased from `label`, because "DCA notice" lower-cased is a
   * screen reader told to say a word rather than four letters, and "Section 223 notice"
   * keeps its capital because it names a section (ACCESSIBILITY §2, §9).
   */
  inline: string;
  /**
   * Whether the channel *executes* it rather than delivering it — the word its outcome
   * is written in. A warrant or a proclamation is executed or not executed; a summons or
   * notice is delivered or not delivered. The reference's Completed tab uses both.
   */
  executed: boolean;
}[] = [
  { id: "summons", label: "Summons", inline: "summons", executed: false },
  {
    id: "section-223-notice",
    label: "Section 223 notice",
    inline: "Section 223 notice",
    executed: false,
  },
  { id: "dca-notice", label: "DCA notice", inline: "DCA notice", executed: false },
  { id: "warrant", label: "Warrant", inline: "warrant", executed: true },
  {
    id: "proclamation",
    label: "Proclamation",
    inline: "proclamation",
    executed: true,
  },
  /* From #43 (2026-10-01): the handover's sixth process type with a police channel,
     executed like the other two (§6.3, §10.1 of `handovers/process-handover.md`). */
  { id: "attachment", label: "Attachment", inline: "attachment", executed: true },
];

function processType(id: CourtProcessTypeId) {
  const entry = COURT_PROCESS_TYPES.find((type) => type.id === id);
  if (!entry) throw new Error(`Unknown process type: ${id}`);
  return entry;
}

export function courtProcessTypeLabel(id: CourtProcessTypeId): string {
  return processType(id).label;
}

/** The same instrument, named mid-sentence. See `inline` above. */
export function courtProcessTypeInline(id: CourtProcessTypeId): string {
  return processType(id).inline;
}

/**
 * How the process goes out — the "Delivery channel" column.
 *
 * The four the owner named for this court (2026-10-06): registered post, the police
 * through ICOPS, SMS and email. They split two ways, and the split is the whole reason
 * Issuance has a To post pill:
 *
 * - **post** — paper. A cover is collected before signing, and after signing it still has
 *   to be carried to the post office. Its outcome comes back as paper too, so the clerk
 *   records it.
 * - **electronic** — the system sends it on signing and the channel reports back by
 *   itself. Its send can fail before it leaves.
 */
export type ProcessChannelId = "rpad" | "police" | "sms" | "email";

export type ProcessChannel = {
  id: ProcessChannelId;
  label: string;
  dispatch: "post" | "electronic";
  /** What the channel is reached through, where that is not the channel's own name. */
  via?: string;
};

export const PROCESS_CHANNELS: ProcessChannel[] = [
  // An abbreviation the court uses as a word; it keeps its capitals.
  { id: "rpad", label: "RPAD", dispatch: "post" },
  { id: "police", label: "Police", dispatch: "electronic", via: "ICOPS" },
  { id: "sms", label: "SMS", dispatch: "electronic" },
  { id: "email", label: "Email", dispatch: "electronic" },
];

function processChannel(id: ProcessChannelId): ProcessChannel {
  const entry = PROCESS_CHANNELS.find((channel) => channel.id === id);
  if (!entry) throw new Error(`Unknown process channel: ${id}`);
  return entry;
}

export function processChannelLabel(id: ProcessChannelId): string {
  return processChannel(id).label;
}

/** Whether a process travels as paper — the one fact every fork on this screen reads. */
export function goesByPost(process: Pick<CourtProcess, "channel">): boolean {
  return processChannel(process.channel).dispatch === "post";
}

/**
 * Why a registered-post cover came back unserved — the reasons the reference's delivery
 * dialog offers, word for word bar sentence case.
 */
export const NON_SERVICE_REASONS = [
  "Address not found",
  "Door locked",
  "Person not present",
  "Delivery refused",
  "Other",
] as const;

export type NonServiceReason = (typeof NON_SERVICE_REASONS)[number];

/** What the channel reported. `reason` only when it was not served. */
export type ProcessOutcome =
  | { served: true }
  | { served: false; reason: NonServiceReason };

/** Where a row is. The pill it appears under. */
export type ProcessStatusId =
  | "awaiting-cover"
  | "to-sign"
  | "to-post"
  | "send-failed"
  | "in-progress"
  | "completed";

export type CourtProcess = {
  id: string;
  caseNumber: string;
  parties: { complainant: string; accused: string };
  type: CourtProcessTypeId;
  channel: ProcessChannelId;
  status: ProcessStatusId;
  /** ISO day the process fee was paid. Every row has one — the fee comes first. */
  paidOn: string;
  /** The listing this process is returnable for. */
  hearingDate: string;
  /** ISO day it was drawn up and sent for signature. */
  issuedOn?: string;
  /** ISO day the signature went on. */
  signedOn?: string;
  /** ISO day it left the court: sent electronically, or posted. */
  sentOn?: string;
  /** Why the last electronic send did not go out. Only while `send-failed`. */
  sendFailure?: string;
  /** ISO day the channel's word came back. */
  returnedOn?: string;
  /** What that word was. Present exactly when `completed`. */
  outcome?: ProcessOutcome;
  /**
   * Demo only: the refusal this row's channel gives the next time it is sent to. The
   * line has no channel to ask, so this is how it shows where a refused send lands.
   */
  demoSendFailure?: string;
};

/** The court whose process this is. One bench, one line. */
const COURT = CURRENT_STAFF.court;

function plural(count: number, one: string, many: string): string {
  return count === 1 ? one : many;
}

/* ───────────────────────────── statuses ───────────────────────────── */

/**
 * Paper in the clerk's hands, matched against the list one case number at a time.
 *
 * Three moments on this screen have it — covers arriving, covers leaving for the post
 * office, acknowledgements coming back — and they are the same gesture: type the number
 * on the cover, press Enter, it joins the pile. `postOnly` because only registered post
 * is paper; an SMS still out with its channel is not something anyone is holding.
 */
export type ProcessPile = {
  /** The tray's name for what it is holding: "covers in hand". */
  noun: string;
  postOnly?: boolean;
};

export type ProcessStatus = {
  id: ProcessStatusId;
  tab: ProcessTabId;
  /** The pill and the band. Sentence case, per the DS Laws. */
  label: string;
  /** What the pill's tooltip says the status is. */
  hint: string;
  /**
   * Whether the pill carries a count. Only where the count is work still to do
   * (owner, 2026-10-06): Completed is a record that only grows, and a number on it would
   * be the loudest thing on the row saying the least.
   */
  counted: boolean;
  /** The act that moves a row out of here, where one does on this screen. */
  act?: ProcessActId;
  pile?: ProcessPile;
  /** What an empty status means, when no filter is what emptied it. */
  empty: { title: string; description: string };
};

export const PROCESS_STATUSES: ProcessStatus[] = [
  {
    id: "awaiting-cover",
    hint: "Waiting for the advocate to bring the registered-post cover.",
    counted: true,
    tab: "rpad-collection",
    label: "Awaiting cover",
    act: "collect",
    pile: { noun: "covers in hand" },
    empty: {
      title: "No covers to collect",
      description:
        "Every registered-post process this court has issued has its cover.",
    },
  },
  {
    id: "to-sign",
    hint: "Issued and waiting for your signature.",
    counted: true,
    tab: "issuance",
    label: "To sign",
    act: "sign",
    empty: {
      title: "Nothing to sign",
      description: "Every process this court has issued has been signed.",
    },
  },
  {
    id: "to-post",
    hint: "Signed registered-post covers, to be taken to the post office.",
    counted: true,
    tab: "issuance",
    label: "To post",
    act: "post",
    pile: { noun: "covers to post" },
    empty: {
      title: "Nothing to post",
      description: "Every signed registered-post cover has gone to the post office.",
    },
  },
  {
    id: "send-failed",
    hint: "Signed, but the channel did not accept it. Resend to try again.",
    counted: true,
    tab: "issuance",
    label: "Send failed",
    act: "resend",
    empty: {
      title: "No failed sends",
      description: "Every electronic process this court has signed went out.",
    },
  },
  {
    id: "in-progress",
    hint: "Sent, and waiting for the channel to report back.",
    counted: true,
    tab: "service",
    label: "In progress",
    act: "record",
    pile: { noun: "returns in hand", postOnly: true },
    empty: {
      title: "Nothing is out",
      description: "No process this court has sent is still with its channel.",
    },
  },
  {
    id: "completed",
    hint: "The channel has reported back — served or not.",
    counted: false,
    tab: "service",
    label: "Completed",
    empty: {
      title: "Nothing has come back yet",
      description: "No channel has reported back on a process this court sent.",
    },
  },
];

function processStatusEmpty(id: ProcessStatusId) {
  return processStatus(id).empty;
}

export function processStatus(id: ProcessStatusId): ProcessStatus {
  const entry = PROCESS_STATUSES.find((status) => status.id === id);
  if (!entry) throw new Error(`Unknown process status: ${id}`);
  return entry;
}

/**
 * What a row's Status cell says: a word, and either the day it happened or — where the
 * row went wrong — why. `warn` marks the two that went wrong; the word itself still says
 * so, so the colour is never the only signal (DS Principles §6).
 */
export type ProcessStatusLine = {
  word: string;
  day?: string;
  reason?: string;
  warn: boolean;
};

export function processOutcomeWord(
  process: Pick<CourtProcess, "type">,
  served: boolean,
): string {
  const executed = processType(process.type).executed;
  if (executed) return served ? "Executed" : "Not executed";
  return served ? "Delivered" : "Not delivered";
}

export function processStatusLine(process: CourtProcess): ProcessStatusLine {
  switch (process.status) {
    case "awaiting-cover":
      return { word: "Fee paid", day: process.paidOn, warn: false };
    case "to-sign":
      return { word: "Issued", day: process.issuedOn, warn: false };
    case "to-post":
      return { word: "Signed", day: process.signedOn, warn: false };
    case "send-failed":
      return { word: "Send failed", reason: process.sendFailure, warn: true };
    case "in-progress":
      return { word: "Sent", day: process.sentOn, warn: false };
    case "completed": {
      /* Completed holds both answers a channel gives (owner, 2026-10-06): served, with
         the day; or not, with why. Not served is a kind of completion, not a pill. */
      const outcome = process.outcome;
      if (outcome && !outcome.served) {
        return {
          word: processOutcomeWord(process, false),
          reason: outcome.reason,
          warn: true,
        };
      }
      return {
        word: processOutcomeWord(process, true),
        day: process.returnedOn,
        warn: false,
      };
    }
  }
}

/* ───────────────────────────── tabs ───────────────────────────── */

export type ProcessTabId = "rpad-collection" | "issuance" | "service";

/** One status, or the whole tab. */
export type ProcessView = ProcessStatusId | "all";

export type ProcessTab = {
  id: ProcessTabId;
  /** The tab. Sentence case, per the DS Laws. */
  label: string;
  /** Its statuses, in the order the pills and the bands under All show them. */
  statuses: ProcessStatusId[];
  /** The pill a tab opens on — the status the work is in. */
  defaultView: ProcessView;
  /**
   * What the tab's count counts — only the statuses that are work. The whole of RPAD
   * collection and Issuance; on Service, In progress alone, because a registered-post
   * process out with its channel is a return the court will have to record, and
   * Completed is a record that only grows (owner, 2026-10-06).
   */
  countedStatuses: ProcessStatusId[];
  /**
   * The fifth column's heading. "Payment made" on the one-status tab, as the reference
   * draws it; "Status" where a tab holds several and the row has to say which.
   */
  dateColumn: string;
  /**
   * The channel every row here carries, where the tab is defined by one. Only RPAD waits
   * for a cover, so the channel filter has one possible answer there and is not drawn.
   */
  onlyChannel?: ProcessChannelId;
  /**
   * Whether the outcome and reason filters are offered — only where rows have come back
   * from their channel (owner, 2026-10-06: success or fail is the first question asked
   * of Service, and the reason is the one a clerk follows up on).
   */
  outcomeFilters: boolean;
  /** What the All pill's tooltip says. */
  allHint: string;
  /** What the tab says empty under All, when no filter is what emptied it. */
  empty: { title: string; description: string };
};

export const PROCESS_TABS: ProcessTab[] = [
  {
    id: "rpad-collection",
    label: "RPAD collection",
    statuses: ["awaiting-cover"],
    defaultView: "awaiting-cover",
    countedStatuses: ["awaiting-cover"],
    dateColumn: "Payment made",
    onlyChannel: "rpad",
    outcomeFilters: false,
    allHint: "Everything waiting for its cover.",
    empty: processStatusEmpty("awaiting-cover"),
  },
  {
    id: "issuance",
    label: "Issuance",
    statuses: ["to-sign", "to-post", "send-failed"],
    defaultView: "to-sign",
    countedStatuses: ["to-sign", "to-post", "send-failed"],
    dateColumn: "Status",
    outcomeFilters: false,
    allHint: "Everything still with the court: to sign, to post, or to resend.",
    empty: {
      title: "Nothing is waiting on the court",
      description: "Everything this court has issued is signed and on its way.",
    },
  },
  {
    id: "service",
    label: "Service",
    statuses: ["in-progress", "completed"],
    defaultView: "in-progress",
    countedStatuses: ["in-progress"],
    dateColumn: "Status",
    outcomeFilters: true,
    allHint: "Everything the court has sent out, in progress or completed.",
    empty: {
      title: "Nothing has gone out",
      description: "No process this court has signed has left it yet.",
    },
  },
];

export function processTab(id: ProcessTabId): ProcessTab {
  const entry = PROCESS_TABS.find((tab) => tab.id === id);
  if (!entry) throw new Error(`Unknown process tab: ${id}`);
  return entry;
}

/** Which tab the screen opens on — the head of the line. */
export const DEFAULT_PROCESS_TAB: ProcessTabId = PROCESS_TABS[0].id;

/** Whether a tab has more than one status, and so a pill row. */
export function hasPills(tab: ProcessTab): boolean {
  return tab.statuses.length > 1;
}

/* ───────────────────────────── acts ───────────────────────────── */

export type ProcessActId = "collect" | "sign" | "post" | "resend" | "record";

/**
 * What moves a row on, and the words it is said in.
 *
 * Confirmed the product's plain way (owner, 2026-10-07): an alert with the question and
 * one line saying where the rows go — `moveLine` — then Back or the act. Nothing else;
 * the bar says what happened once the window closes.
 */
export type ProcessAct = {
  id: ProcessActId;
  /** The status a row has to be at for the act to take it. */
  from: ProcessStatusId;
  /** The sticky bar's button over a count. */
  bar: (count: number) => string;
  idle: string;
  /** The button that commits it. */
  confirm: string;
  /** The question, over "this process" or "5 processes". */
  question: (subject: string) => string;
  /** The success heading, over "process" or "5 processes". */
  done: (phrase: string) => string;
  /** What the rows are called where "process" is the wrong word — a clerk posting holds covers. */
  noun?: { one: string; many: string };
  /** What the bar reads out once it is over. Says plainly that nothing left the browser. */
  notice: (count: number) => string;
};

export const PROCESS_ACTS: ProcessAct[] = [
  {
    id: "collect",
    from: "awaiting-cover",
    bar: (count) =>
      `Send ${count} ${plural(count, "process", "processes")} for signature`,
    idle: "Send selected for signature",
    confirm: "Send for signature",
    question: (subject) => `Send ${subject} for signature?`,
    done: (phrase) => `${capitalise(phrase)} sent for signature`,
    notice: (count) =>
      `${count} ${plural(count, "process is", "processes are")} waiting to be signed. Nothing was sent.`,
  },
  {
    id: "sign",
    from: "to-sign",
    bar: (count) => `Sign ${count} ${plural(count, "process", "processes")}`,
    idle: "Sign selected processes",
    confirm: "Sign",
    question: (subject) => `Sign ${subject}?`,
    done: (phrase) => `${capitalise(phrase)} signed`,
    notice: (count) =>
      `${count} ${plural(count, "process is", "processes are")} marked signed on this screen. Nothing was signed or sent.`,
  },
  {
    id: "post",
    from: "to-post",
    bar: (count) => `Mark ${count} ${plural(count, "cover", "covers")} as posted`,
    idle: "Mark selected as posted",
    confirm: "Mark as posted",
    question: (subject) => `Mark ${subject} as posted?`,
    noun: { one: "cover", many: "covers" },
    done: (phrase) => `${capitalise(phrase)} posted`,
    notice: (count) =>
      `${count} ${plural(count, "process is", "processes are")} marked posted on this screen. Nothing was posted.`,
  },
  {
    id: "resend",
    from: "send-failed",
    bar: (count) => `Resend ${count}`,
    idle: "Resend selected",
    confirm: "Resend",
    question: (subject) => `Resend ${subject}?`,
    done: (phrase) => `${capitalise(phrase)} resent`,
    notice: (count) =>
      `${count} ${plural(count, "process is", "processes are")} marked sent on this screen. Nothing was sent.`,
  },
  {
    id: "record",
    from: "in-progress",
    bar: (count) => `Record ${count} ${plural(count, "return", "returns")}`,
    idle: "Record returns",
    confirm: "Record",
    question: (subject) => `Record ${subject}`,
    done: (phrase) => `${capitalise(phrase)} recorded`,
    notice: (count) =>
      `${count} ${plural(count, "return is", "returns are")} recorded on this screen. Nothing was written to the case file.`,
  },
];

/** Sentence case, so a noun only rises to a capital when it opens the line. */
function capitalise(phrase: string): string {
  return phrase.charAt(0).toUpperCase() + phrase.slice(1);
}

export function processAct(id: ProcessActId): ProcessAct {
  const entry = PROCESS_ACTS.find((act) => act.id === id);
  if (!entry) throw new Error(`Unknown process act: ${id}`);
  return entry;
}

/**
 * Whether an act takes this row.
 *
 * The status alone, except for recording a return: only registered post comes back as
 * paper, so an SMS still out with its channel can be selected (to download) but never
 * recorded by hand.
 */
export function actTakes(act: ProcessAct, process: CourtProcess): boolean {
  if (process.status !== act.from) return false;
  return act.id === "record" ? goesByPost(process) : true;
}

/**
 * The selection split by the acts that would take it, in the order the tab's statuses
 * run. A Issuance selection can hold rows to sign, covers to post and failed sends at
 * once, and each gets its own button rather than one verb applied to rows it does not fit.
 */
export function actsForSelection(
  tab: ProcessTab,
  selected: CourtProcess[],
): { act: ProcessAct; rows: CourtProcess[] }[] {
  return tab.statuses
    .map((id) => processStatus(id).act)
    .filter((id): id is ProcessActId => id !== undefined)
    .map((id) => {
      const act = processAct(id);
      return { act, rows: selected.filter((process) => actTakes(act, process)) };
    })
    .filter((entry) => entry.rows.length > 0);
}

/**
 * Run an act over the chosen rows — the demo behind every bar on this screen.
 *
 * A pure function over the line so the screen holds one list and no second copy of the
 * truth. It moves only what the act takes: an id naming a row that has since moved, or no
 * row at all, is ignored rather than throwing — a line that has moved on under a stale
 * selection is a real case, not an error.
 *
 * Signing forks on the channel. Registered post waits to be posted; an electronic
 * channel goes out on the day, unless the row's demo channel refuses it.
 *
 * **It sends nothing.** It changes a status and stamps a day in memory.
 */
export function runProcessAct(
  rows: CourtProcess[],
  actId: Exclude<ProcessActId, "record">,
  ids: ReadonlySet<string>,
  on: string,
): CourtProcess[] {
  const act = processAct(actId);
  return rows.map((process) => {
    if (!ids.has(process.id) || !actTakes(act, process)) return process;
    switch (actId) {
      case "collect":
        return { ...process, status: "to-sign", issuedOn: on };
      case "sign": {
        const signed = { ...process, signedOn: on };
        if (goesByPost(process)) return { ...signed, status: "to-post" };
        return sendElectronically(signed, on);
      }
      case "post":
        return { ...process, status: "in-progress", sentOn: on };
      case "resend":
        return sendElectronically(process, on);
    }
  });
}

function sendElectronically(process: CourtProcess, on: string): CourtProcess {
  const { demoSendFailure, ...rest } = process;
  if (demoSendFailure) {
    /* The refusal is used up once it has been shown: resending the same row goes out,
       which is what a channel that was briefly down would do. */
    return { ...rest, status: "send-failed", sendFailure: demoSendFailure };
  }
  return { ...rest, status: "in-progress", sentOn: on, sendFailure: undefined };
}

/**
 * Record what came back on a pile of registered-post covers.
 *
 * Each row gets its own outcome; the day is the batch's, because a stack of returned
 * covers is opened on one day. Rows the act does not take are left alone.
 */
export function recordProcessReturns(
  rows: CourtProcess[],
  outcomes: ReadonlyMap<string, ProcessOutcome>,
  on: string,
): CourtProcess[] {
  const act = processAct("record");
  return rows.map((process) => {
    const outcome = outcomes.get(process.id);
    if (!outcome || !actTakes(act, process)) return process;
    return {
      ...process,
      status: "completed",
      outcome,
      returnedOn: on,
    };
  });
}

/** Where an act sends one row. Signing forks: registered post waits to be posted. */
function destinationOf(
  actId: ProcessActId,
  process: CourtProcess,
): ProcessStatusId {
  switch (actId) {
    case "collect":
      return "to-sign";
    case "sign":
      return goesByPost(process) ? "to-post" : "in-progress";
    case "post":
    case "resend":
      return "in-progress";
    case "record":
      return "completed";
  }
}

/**
 * The confirmation's one line: where the rows are going (owner, 2026-10-07 — "one simple
 * line saying where this is getting taken to"). Said as the pill and the tab it sits in,
 * the two names the clerk sees on the screen.
 */
/** "To post in Issuance" — a pill named by the place the screen shows it. */
function placeOf(id: ProcessStatusId): string {
  const status = processStatus(id);
  return `${status.label} in ${processTab(status.tab).label}`;
}

/**
 * The success line: where the rows an act took actually are now — read off the live
 * rows, because signing forks on the channel. A send its channel refused is left out of
 * it and said separately (`refusedLine`), so a success fill never carries a failure.
 */
export function landedLine(rows: CourtProcess[]): string {
  const counts = new Map<ProcessStatusId, number>();
  for (const process of rows) {
    if (process.status === "send-failed") continue;
    counts.set(process.status, (counts.get(process.status) ?? 0) + 1);
  }
  const entries = [...counts];
  if (entries.length === 0) return "";
  if (entries.length === 1) {
    const [id, count] = entries[0];
    return `${count === 1 ? "It is" : "They are"} now in ${placeOf(id)}.`;
  }
  return `${entries
    .map(([id, count]) => `${count} ${count === 1 ? "is" : "are"} now in ${placeOf(id)}`)
    .join(", ")}.`;
}

/** What could not be sent, if anything — said beside the success, never inside it. */
export function refusedLine(rows: CourtProcess[]): string {
  const refused = rows.filter((process) => process.status === "send-failed");
  if (refused.length === 0) return "";
  return refused.length === 1
    ? `1 could not be sent and is in ${placeOf("send-failed")}.`
    : `${refused.length} could not be sent and are in ${placeOf("send-failed")}.`;
}

export function moveLine(actId: ProcessActId, rows: CourtProcess[]): string {
  const counts = new Map<ProcessStatusId, number>();
  for (const process of rows) {
    const to = destinationOf(actId, process);
    counts.set(to, (counts.get(to) ?? 0) + 1);
  }
  const place = placeOf;
  const entries = [...counts];
  if (entries.length === 1) {
    return `${rows.length === 1 ? "It moves" : "They move"} to ${place(entries[0][0])}.`;
  }
  return `${entries
    .map(([id, count]) => `${count} ${count === 1 ? "moves" : "move"} to ${place(id)}`)
    .join(", ")}.`;
}


/* ───────────────────────────── the line ───────────────────────────── */

/**
 * Every process this court has in the line, newest first inside each status.
 *
 * One list rather than seven, so a row that moves stays the same object and the tabs,
 * the pills and the rail cannot disagree about where it is. Shaped to exercise what the
 * screen has to survive: all five types, all four channels, one case carrying three
 * processes, corporate parties long enough to wrap, both kinds of outcome, and a police
 * warrant whose ICOPS send will be refused.
 */
export const PROCESS_LINE: CourtProcess[] = [
  /* Waiting on a registered-post cover. All RPAD, by definition of the tab. */
  {
    id: "pr-1301-a",
    caseNumber: "ST/1301/2026",
    parties: {
      complainant: "Thevally Rubber and Latex Traders",
      accused: "Rajeev Sankaran",
    },
    type: "summons",
    channel: "rpad",
    status: "awaiting-cover",
    paidOn: "2026-09-04",
    hearingDate: "2026-10-05",
  },
  {
    id: "pr-1301-b",
    caseNumber: "ST/1301/2026",
    parties: {
      complainant: "Thevally Rubber and Latex Traders",
      accused: "Rajeev Sankaran",
    },
    type: "section-223-notice",
    channel: "rpad",
    status: "awaiting-cover",
    paidOn: "2026-09-04",
    hearingDate: "2026-10-05",
  },
  {
    id: "pr-1301-c",
    caseNumber: "ST/1301/2026",
    parties: {
      complainant: "Thevally Rubber and Latex Traders",
      accused: "Rajeev Sankaran",
    },
    type: "dca-notice",
    channel: "rpad",
    status: "awaiting-cover",
    paidOn: "2026-09-04",
    hearingDate: "2026-10-05",
  },
  {
    id: "pr-1642",
    caseNumber: "CMP/1642/2026",
    parties: { complainant: "Sheeba Rasheed", accused: "Anil Kumar Pillai" },
    type: "section-223-notice",
    channel: "rpad",
    status: "awaiting-cover",
    paidOn: "2026-09-03",
    hearingDate: "2026-09-28",
  },
  {
    id: "pr-1304",
    caseNumber: "ST/1304/2026",
    parties: {
      complainant: "Kadappakada Hardware and Sanitaryware",
      accused: "Fousiya Nazar",
    },
    type: "summons",
    channel: "rpad",
    status: "awaiting-cover",
    paidOn: "2026-09-02",
    hearingDate: "2026-10-12",
  },
  {
    id: "pr-1307",
    caseNumber: "ST/1307/2026",
    parties: { complainant: "Girija Damodaran", accused: "Sabu Chacko" },
    type: "summons",
    channel: "rpad",
    status: "awaiting-cover",
    paidOn: "2026-09-01",
    hearingDate: "2026-09-25",
  },
  {
    id: "pr-1646",
    caseNumber: "CMP/1646/2026",
    parties: { complainant: "Noushad Ali", accused: "Chinnakada Auto Spares" },
    type: "dca-notice",
    channel: "rpad",
    status: "awaiting-cover",
    paidOn: "2026-08-31",
    hearingDate: "2026-09-22",
  },
  {
    id: "pr-1310",
    caseNumber: "ST/1310/2026",
    parties: { complainant: "Bindu Rajagopal", accused: "Hameed Kunju" },
    type: "warrant",
    channel: "rpad",
    status: "awaiting-cover",
    paidOn: "2026-08-28",
    hearingDate: "2026-09-30",
  },
  {
    id: "pr-1313",
    caseNumber: "ST/1313/2026",
    parties: {
      complainant: "Ashramam Poultry and Feeds",
      accused: "Vinu Prakash",
    },
    type: "summons",
    channel: "rpad",
    status: "awaiting-cover",
    paidOn: "2026-08-27",
    hearingDate: "2026-10-19",
  },
  {
    id: "pr-1651",
    caseNumber: "CMP/1651/2026",
    parties: { complainant: "Remya Suresh", accused: "Abdul Latheef" },
    type: "section-223-notice",
    channel: "rpad",
    status: "awaiting-cover",
    paidOn: "2026-08-26",
    hearingDate: "2026-09-24",
  },
  {
    id: "pr-1316",
    caseNumber: "ST/1316/2026",
    parties: { complainant: "Jayaprakash Menon", accused: "Sindhu Balan" },
    type: "summons",
    channel: "rpad",
    status: "awaiting-cover",
    paidOn: "2026-08-25",
    hearingDate: "2026-10-26",
  },
  {
    id: "pr-1319",
    caseNumber: "ST/1319/2026",
    parties: {
      complainant: "Perinad Cashew Processing Company",
      accused: "Mohammed Shafi",
    },
    type: "summons",
    channel: "rpad",
    status: "awaiting-cover",
    paidOn: "2026-08-24",
    hearingDate: "2026-10-30",
  },

  /* Drawn up and waiting on the signature. Every channel reaches this status. */
  {
    id: "pr-1322",
    caseNumber: "ST/1322/2026",
    parties: { complainant: "Lekha Vijayan", accused: "Sudheer Nadesan" },
    type: "warrant",
    channel: "police",
    status: "to-sign",
    paidOn: "2026-08-31",
    issuedOn: "2026-09-03",
    hearingDate: "2026-09-21",
  },
  {
    id: "pr-1655-a",
    caseNumber: "CMP/1655/2026",
    parties: {
      complainant: "Kilikolloor Steel and Cement Mart",
      accused: "Deepthi Ravindran",
    },
    type: "section-223-notice",
    channel: "rpad",
    status: "to-sign",
    paidOn: "2026-08-28",
    issuedOn: "2026-09-02",
    hearingDate: "2026-09-23",
  },
  {
    id: "pr-1655-b",
    caseNumber: "CMP/1655/2026",
    parties: {
      complainant: "Kilikolloor Steel and Cement Mart",
      accused: "Deepthi Ravindran",
    },
    type: "dca-notice",
    channel: "rpad",
    status: "to-sign",
    paidOn: "2026-08-28",
    issuedOn: "2026-09-02",
    hearingDate: "2026-09-23",
  },
  {
    id: "pr-1325",
    caseNumber: "ST/1325/2026",
    parties: { complainant: "Salim Muhammed", accused: "Anju Thankachan" },
    type: "summons",
    channel: "sms",
    status: "to-sign",
    paidOn: "2026-08-27",
    issuedOn: "2026-09-01",
    hearingDate: "2026-09-29",
  },
  {
    id: "pr-1328",
    caseNumber: "ST/1328/2026",
    parties: { complainant: "Radhika Unnikrishnan", accused: "Byju Thomas" },
    type: "proclamation",
    channel: "police",
    status: "to-sign",
    paidOn: "2026-08-24",
    issuedOn: "2026-08-31",
    hearingDate: "2026-10-08",
  },
  {
    id: "pr-1659",
    caseNumber: "CMP/1659/2026",
    parties: { complainant: "Ismail Kunju", accused: "Pallimukku Textiles" },
    type: "section-223-notice",
    channel: "rpad",
    status: "to-sign",
    paidOn: "2026-08-22",
    issuedOn: "2026-08-28",
    hearingDate: "2026-09-18",
  },
  {
    id: "pr-1331",
    caseNumber: "ST/1331/2026",
    parties: { complainant: "Sujith Mohan", accused: "Ayisha Beevi" },
    type: "summons",
    channel: "rpad",
    status: "to-sign",
    paidOn: "2026-08-20",
    issuedOn: "2026-08-27",
    hearingDate: "2026-09-17",
  },
  {
    id: "pr-1334",
    caseNumber: "ST/1334/2026",
    parties: {
      complainant: "Mundakkal Fisheries Cooperative Society",
      accused: "Rahul Krishnan",
    },
    type: "warrant",
    channel: "police",
    status: "to-sign",
    paidOn: "2026-08-18",
    issuedOn: "2026-08-26",
    demoSendFailure: "No response from ICOPS",
    hearingDate: "2026-09-16",
  },
  {
    id: "pr-1337",
    caseNumber: "ST/1337/2026",
    parties: { complainant: "Preetha Nandakumar", accused: "Shibu Kesavan" },
    type: "summons",
    channel: "email",
    status: "to-sign",
    paidOn: "2026-08-17",
    issuedOn: "2026-08-24",
    hearingDate: "2026-09-15",
  },
  {
    id: "pr-1663",
    caseNumber: "CMP/1663/2026",
    parties: { complainant: "Aneesh Gopakumar", accused: "Suma Devarajan" },
    type: "dca-notice",
    channel: "rpad",
    status: "to-sign",
    paidOn: "2026-08-14",
    issuedOn: "2026-08-21",
    hearingDate: "2026-09-14",
  },
  {
    id: "pr-1340",
    caseNumber: "ST/1340/2026",
    parties: { complainant: "Vijayamma Kesavan", accused: "Nithin Raj" },
    type: "summons",
    channel: "rpad",
    status: "to-sign",
    paidOn: "2026-08-13",
    issuedOn: "2026-08-20",
    hearingDate: "2026-09-11",
  },

  /* Signed. Registered post waits to be posted; two police processes ICOPS did not take. */
  {
    id: "pr-1343",
    caseNumber: "ST/1343/2026",
    parties: { complainant: "Faisal Rahman", accused: "Geetha Sadanandan" },
    type: "summons",
    channel: "rpad",
    status: "to-post",
    paidOn: "2026-08-14",
    issuedOn: "2026-08-21",
    signedOn: "2026-08-31",
    hearingDate: "2026-09-19",
  },
  {
    id: "pr-1346",
    caseNumber: "ST/1346/2026",
    parties: {
      complainant: "Beach Road Auto Works",
      accused: "Manoj Chandran",
    },
    type: "warrant",
    channel: "police",
    status: "send-failed",
    paidOn: "2026-08-12",
    issuedOn: "2026-08-19",
    signedOn: "2026-08-28",
    sendFailure: "No response from ICOPS",
    hearingDate: "2026-09-26",
  },
  {
    id: "pr-1667",
    caseNumber: "CMP/1667/2026",
    parties: { complainant: "Shalini Peter", accused: "Rafeeq Muhammed" },
    type: "section-223-notice",
    channel: "rpad",
    status: "to-post",
    paidOn: "2026-08-11",
    issuedOn: "2026-08-18",
    signedOn: "2026-08-27",
    hearingDate: "2026-09-12",
  },
  {
    id: "pr-1349",
    caseNumber: "ST/1349/2026",
    parties: { complainant: "Divya Anilkumar", accused: "Prasanth Vijayan" },
    type: "summons",
    channel: "sms",
    status: "in-progress",
    paidOn: "2026-08-10",
    issuedOn: "2026-08-17",
    signedOn: "2026-08-25",
    sentOn: "2026-08-25",
    hearingDate: "2026-09-10",
  },
  /* From #43: an attachment out with the police, so the line carries one. */
  {
    id: "pr-1392",
    caseNumber: "ST/1392/2026",
    parties: { complainant: "Paravur Fisheries Co-operative", accused: "Biju Thomas" },
    type: "attachment",
    channel: "police",
    status: "in-progress",
    paidOn: "2026-08-02",
    issuedOn: "2026-08-07",
    signedOn: "2026-08-13",
    sentOn: "2026-08-23",
    hearingDate: "2026-09-27",
  },
  {
    id: "pr-1352",
    caseNumber: "ST/1352/2026",
    parties: { complainant: "Haridas Pillai", accused: "Kavitha Menon" },
    type: "proclamation",
    channel: "police",
    status: "send-failed",
    paidOn: "2026-08-07",
    issuedOn: "2026-08-14",
    signedOn: "2026-08-24",
    sendFailure: "No response from ICOPS",
    hearingDate: "2026-10-01",
  },
  {
    id: "pr-1671",
    caseNumber: "CMP/1671/2026",
    parties: {
      complainant: "Sasthamcotta Lake Fisheries",
      accused: "Jomon Varghese",
    },
    type: "dca-notice",
    channel: "rpad",
    status: "to-post",
    paidOn: "2026-08-06",
    issuedOn: "2026-08-13",
    signedOn: "2026-08-21",
    hearingDate: "2026-09-09",
  },
  {
    id: "pr-1355",
    caseNumber: "ST/1355/2026",
    parties: { complainant: "Asha Vijayakumar", accused: "Siddique Ibrahim" },
    type: "summons",
    channel: "rpad",
    status: "to-post",
    paidOn: "2026-08-04",
    issuedOn: "2026-08-12",
    signedOn: "2026-08-19",
    hearingDate: "2026-09-08",
  },
  {
    id: "pr-1358",
    caseNumber: "ST/1358/2026",
    parties: { complainant: "Benny Mathew", accused: "Sreekala Prasad" },
    type: "summons",
    channel: "email",
    status: "in-progress",
    paidOn: "2026-08-03",
    issuedOn: "2026-08-11",
    signedOn: "2026-08-18",
    sentOn: "2026-08-18",
    hearingDate: "2026-09-07",
  },

  /* Out with a channel, waiting on it to report back. */
  {
    id: "pr-1361",
    caseNumber: "ST/1361/2026",
    parties: { complainant: "Latha Ramakrishnan", accused: "Nazeer Muhammed" },
    type: "summons",
    channel: "rpad",
    status: "in-progress",
    paidOn: "2026-07-30",
    issuedOn: "2026-08-06",
    signedOn: "2026-08-13",
    sentOn: "2026-08-24",
    hearingDate: "2026-09-13",
  },
  {
    id: "pr-1364",
    caseNumber: "ST/1364/2026",
    parties: {
      complainant: "Karunagappally Coir and Mats",
      accused: "Prakashan Achari",
    },
    type: "warrant",
    channel: "police",
    status: "in-progress",
    paidOn: "2026-07-28",
    issuedOn: "2026-08-04",
    signedOn: "2026-08-11",
    sentOn: "2026-08-20",
    hearingDate: "2026-09-20",
  },
  {
    id: "pr-1675",
    caseNumber: "CMP/1675/2026",
    parties: { complainant: "Manoj Sivadasan", accused: "Rekha Balachandran" },
    type: "section-223-notice",
    channel: "rpad",
    status: "in-progress",
    paidOn: "2026-07-27",
    issuedOn: "2026-08-03",
    signedOn: "2026-08-10",
    sentOn: "2026-08-18",
    hearingDate: "2026-09-11",
  },
  {
    id: "pr-1367",
    caseNumber: "ST/1367/2026",
    parties: { complainant: "Sreedevi Warrier", accused: "Tony Sebastian" },
    type: "summons",
    channel: "sms",
    status: "in-progress",
    paidOn: "2026-07-24",
    issuedOn: "2026-07-31",
    signedOn: "2026-08-07",
    sentOn: "2026-08-14",
    hearingDate: "2026-09-09",
  },
  {
    id: "pr-1370",
    caseNumber: "ST/1370/2026",
    parties: { complainant: "Anwar Sadath", accused: "Meera Krishnankutty" },
    type: "proclamation",
    channel: "police",
    status: "in-progress",
    paidOn: "2026-07-22",
    issuedOn: "2026-07-29",
    signedOn: "2026-08-05",
    sentOn: "2026-08-12",
    hearingDate: "2026-09-27",
  },
  {
    id: "pr-1679",
    caseNumber: "CMP/1679/2026",
    parties: { complainant: "Jaya Sreekumar", accused: "Eravipuram Marine Foods" },
    type: "dca-notice",
    channel: "rpad",
    status: "in-progress",
    paidOn: "2026-07-20",
    issuedOn: "2026-07-27",
    signedOn: "2026-08-03",
    sentOn: "2026-08-10",
    hearingDate: "2026-09-08",
  },
  {
    id: "pr-1373",
    caseNumber: "ST/1373/2026",
    parties: { complainant: "Ravi Sankar Nair", accused: "Bushra Yusuf" },
    type: "summons",
    channel: "rpad",
    status: "in-progress",
    paidOn: "2026-07-17",
    issuedOn: "2026-07-24",
    signedOn: "2026-07-31",
    sentOn: "2026-08-05",
    hearingDate: "2026-09-07",
  },

  /* Back from the channel — served, or not. */
  {
    id: "pr-1376",
    caseNumber: "ST/1376/2026",
    parties: { complainant: "Shajahan Beevi", accused: "Dileep Raghavan" },
    type: "summons",
    channel: "rpad",
    status: "completed",
    paidOn: "2026-07-13",
    issuedOn: "2026-07-20",
    signedOn: "2026-07-27",
    sentOn: "2026-08-03",
    returnedOn: "2026-08-18",
    outcome: { served: true },
    hearingDate: "2026-09-14",
  },
  {
    id: "pr-1379",
    caseNumber: "ST/1379/2026",
    parties: {
      complainant: "Punalur Plywood and Timber Company",
      accused: "Seema Joseph",
    },
    type: "warrant",
    channel: "police",
    status: "completed",
    paidOn: "2026-07-10",
    issuedOn: "2026-07-17",
    signedOn: "2026-07-24",
    sentOn: "2026-07-31",
    returnedOn: "2026-08-14",
    outcome: { served: true },
    hearingDate: "2026-09-22",
  },
  {
    id: "pr-1683",
    caseNumber: "CMP/1683/2026",
    parties: { complainant: "Unnikrishnan Nair", accused: "Farhana Rasheed" },
    type: "section-223-notice",
    channel: "rpad",
    status: "completed",
    paidOn: "2026-07-08",
    issuedOn: "2026-07-15",
    signedOn: "2026-07-22",
    sentOn: "2026-07-29",
    returnedOn: "2026-08-11",
    outcome: { served: false, reason: "Door locked" },
    hearingDate: "2026-09-10",
  },
  {
    id: "pr-1382",
    caseNumber: "ST/1382/2026",
    parties: { complainant: "Molly Kuriakose", accused: "Sanal Kumar" },
    type: "summons",
    channel: "email",
    status: "completed",
    paidOn: "2026-07-06",
    issuedOn: "2026-07-13",
    signedOn: "2026-07-20",
    sentOn: "2026-07-27",
    returnedOn: "2026-08-07",
    outcome: { served: true },
    hearingDate: "2026-09-06",
  },
  {
    id: "pr-1385",
    caseNumber: "ST/1385/2026",
    parties: { complainant: "Abdul Salam", accused: "Nisha Chandrasekharan" },
    type: "proclamation",
    channel: "police",
    status: "completed",
    paidOn: "2026-07-03",
    issuedOn: "2026-07-10",
    signedOn: "2026-07-17",
    sentOn: "2026-07-24",
    returnedOn: "2026-08-04",
    outcome: { served: false, reason: "Person not present" },
    hearingDate: "2026-09-29",
  },
  {
    id: "pr-1687",
    caseNumber: "CMP/1687/2026",
    parties: { complainant: "Gopakumar Pillai", accused: "Thangassery Ice Plant" },
    type: "dca-notice",
    channel: "rpad",
    status: "completed",
    paidOn: "2026-07-01",
    issuedOn: "2026-07-08",
    signedOn: "2026-07-15",
    sentOn: "2026-07-22",
    returnedOn: "2026-07-30",
    outcome: { served: true },
    hearingDate: "2026-09-05",
  },
];

/** Everything at one status. */
export function processesAt(
  rows: CourtProcess[],
  status: ProcessStatusId,
): CourtProcess[] {
  return rows.filter((process) => process.status === status);
}

/** Everything a tab holds under one pill, or under All. */
export function processesIn(
  rows: CourtProcess[],
  tab: ProcessTab,
  view: ProcessView,
): CourtProcess[] {
  return rows.filter((process) =>
    view === "all"
      ? tab.statuses.includes(process.status)
      : process.status === view,
  );
}

/**
 * A page of rows cut into status bands — what All shows.
 *
 * In the tab's own status order, and inside a band the line's own order: the bands are a
 * cut of the list, not a second sort. Whether to band at all is `spansStatuses`'s
 * question: a view in one status has nothing to group.
 */
export function bandByStatus(
  rows: CourtProcess[],
  tab: ProcessTab,
): { status: ProcessStatus; rows: CourtProcess[] }[] {
  return tab.statuses
    .map((id) => ({
      status: processStatus(id),
      rows: rows.filter((process) => process.status === id),
    }))
    .filter((band) => band.rows.length > 0);
}

/** Whether these rows hold more than one status — one band is not worth a header. */
export function spansStatuses(rows: CourtProcess[]): boolean {
  return new Set(rows.map((process) => process.status)).size > 1;
}

/**
 * The rows of a view in band order — what the table pages through under All.
 *
 * Paging the line's raw order and banding each page would split one status across pages
 * and back again. Ordering by band first means a page break falls inside a band at most
 * once, and the bands read top to bottom in the tab's own order.
 */
export function orderForView(
  rows: CourtProcess[],
  tab: ProcessTab,
): CourtProcess[] {
  return tab.statuses.flatMap((id) =>
    rows.filter((process) => process.status === id),
  );
}

/** The paper this view is matched against, if it is a view that has any. */
export function pileFor(view: ProcessView): ProcessPile | undefined {
  return view === "all" ? undefined : processStatus(view).pile;
}

/** The rows a pile can take: the view's own, narrowed to paper where only paper counts. */
export function pilePool(
  rows: CourtProcess[],
  view: ProcessView,
): CourtProcess[] {
  const pile = pileFor(view);
  if (!pile || view === "all") return [];
  return processesAt(rows, view).filter(
    (process) => !pile.postOnly || goesByPost(process),
  );
}

/** One envelope's worth of selection: a case, and the process picked out of it. */
export type SelectedCase = {
  caseNumber: string;
  parties: CourtProcess["parties"];
  processes: CourtProcess[];
};

/**
 * The selection as the pile of envelopes it stands for.
 *
 * A cover is one per **case**, so the thing the clerk is holding is a case number, not a
 * process. Grouping here lets the table stay one row per process while the tray counts in
 * the unit the clerk counts in. **Order is the order they were picked** — a `Set` keeps
 * insertion order, so the envelope just ticked lands at the end of the tray.
 *
 * Ids that name nothing in `rows` are dropped rather than counted — a row that has since
 * moved is no longer selected, and the tray must not claim it.
 */
export function groupSelectionByCase(
  rows: CourtProcess[],
  selectedIds: ReadonlySet<string>,
): SelectedCase[] {
  const byId = new Map(rows.map((process) => [process.id, process]));
  const cases = new Map<string, SelectedCase>();

  for (const id of selectedIds) {
    const process = byId.get(id);
    if (!process) continue;
    const existing = cases.get(process.caseNumber);
    if (existing) {
      existing.processes.push(process);
      continue;
    }
    cases.set(process.caseNumber, {
      caseNumber: process.caseNumber,
      parties: process.parties,
      processes: [process],
    });
  }

  return [...cases.values()];
}

/**
 * The one case a request names, or nothing.
 *
 * What Enter in the search box commits on. A cover is one per case, so a request that
 * lands on a single case names a single envelope and every process of it in the pile
 * goes on together. **Two cases still matching is an unfinished number**, not a near
 * miss: guessing between them would put one case's process into another's envelope, so
 * anything but exactly one case answers `null` and the clerk keeps typing.
 */
export function singleCaseMatch(
  rows: CourtProcess[],
  filters: ProcessFilters,
): CourtProcess[] | null {
  const matches = filterProcesses(rows, filters);
  const first = matches[0];
  if (!first) return null;
  return matches.every((process) => process.caseNumber === first.caseNumber)
    ? matches
    : null;
}

/** Every id in `rows` belonging to one case — what removing an envelope takes out. */
export function processIdsForCase(
  rows: CourtProcess[],
  caseNumber: string,
): string[] {
  return rows
    .filter((process) => process.caseNumber === caseNumber)
    .map((process) => process.id);
}

/** The statuses that wait on the court — what the rail's badge counts. */
const WAITING_ON_COURT: ProcessStatusId[] = [
  "awaiting-cover",
  "to-sign",
  "to-post",
  "send-failed",
];

/**
 * How much process is still waiting on this court — the number the rail carries beside
 * "Sign process": the first two tabs, whole. Service is the channel's, and a badge that
 * counted it would send the bench to a screen with less work on it than it promised.
 */
export function processQueueCount(rows: CourtProcess[]): number {
  return rows.filter((process) => WAITING_ON_COURT.includes(process.status))
    .length;
}

export const PROCESS_QUEUE_COUNT = processQueueCount(PROCESS_LINE);

/** A tab's count: what is standing in it, or nothing where the tab is not counted. */
/** A tab's count: the work standing in it. */
export function tabCount(rows: CourtProcess[], tab: ProcessTab): number {
  return rows.filter((process) => tab.countedStatuses.includes(process.status))
    .length;
}

/** Whether the All pill counts — only where every status in the tab is work. */
export function allCounted(tab: ProcessTab): boolean {
  return tab.statuses.every((id) => tab.countedStatuses.includes(id));
}

export type ProcessFilters = {
  type: CourtProcessTypeId | "all";
  channel: ProcessChannelId | "all";
  /** Free text over the case number only, token by token. */
  query: string;
  /** What the channel reported: served, not served, or either. Service only. */
  outcome: "all" | "served" | "unserved";
  /** Why it was not served. Service only; choosing one implies not served. */
  reason: NonServiceReason | "all";
};

export const OUTCOME_FILTERS: { id: "served" | "unserved"; label: string }[] = [
  { id: "served", label: "Successful" },
  { id: "unserved", label: "Failed" },
];

/**
 * What a tab opens on — everything it holds. The one pre-set is the channel on the tab
 * defined by one, which is a fact about the tab rather than a narrowing.
 */
export function defaultProcessFilters(tab: ProcessTab): ProcessFilters {
  return {
    type: "all",
    channel: tab.onlyChannel ?? "all",
    query: "",
    outcome: "all",
    reason: "all",
  };
}

/**
 * How the list is ordered. The hearing date was a filter that picked one day; what the
 * bench actually asks of it is *which process is most urgent*, so it is an order instead
 * (owner, 2026-10-06). Soonest hearing first is the default: a process has to be served
 * before its listing, so the one returnable next is the one to move next.
 */
export type ProcessSort = "hearing-soonest" | "hearing-latest" | "recent";

export const PROCESS_SORTS: { id: ProcessSort; label: string }[] = [
  { id: "hearing-soonest", label: "Soonest hearing first" },
  { id: "hearing-latest", label: "Latest hearing first" },
  { id: "recent", label: "Recently updated first" },
];

export const DEFAULT_PROCESS_SORT: ProcessSort = "hearing-soonest";

/** The last day anything happened to a row — what "Last updated" orders by. */
export function lastActivityDay(process: CourtProcess): string {
  return (
    process.returnedOn ??
    process.sentOn ??
    process.signedOn ??
    process.issuedOn ??
    process.paidOn
  );
}

/**
 * Order rows, ties broken by case number so the order is stable. ISO days compare as
 * strings. A new array; the line is not touched.
 */
export function sortProcesses(
  rows: CourtProcess[],
  sort: ProcessSort,
): CourtProcess[] {
  const key = (process: CourtProcess) =>
    sort === "recent" ? lastActivityDay(process) : process.hearingDate;
  const direction = sort === "hearing-soonest" ? 1 : -1;
  return [...rows].sort(
    (a, b) =>
      direction * key(a).localeCompare(key(b)) ||
      a.caseNumber.localeCompare(b.caseNumber),
  );
}

export function filterProcesses(
  rows: CourtProcess[],
  filters: ProcessFilters,
): CourtProcess[] {
  return rows.filter((process) => {
    if (filters.type !== "all" && process.type !== filters.type) return false;
    if (filters.channel !== "all" && process.channel !== filters.channel) {
      return false;
    }
    /* A row still out has no outcome, so either outcome filter leaves it behind. */
    if (filters.outcome !== "all") {
      if (process.outcome?.served !== (filters.outcome === "served")) return false;
    }
    if (filters.reason !== "all") {
      const outcome = process.outcome;
      if (!outcome || outcome.served || outcome.reason !== filters.reason) {
        return false;
      }
    }
    // Case number only — the box matches the number and nothing else.
    return matchesQuery(filters.query, process.caseNumber);
  });
}

/**
 * The same request, asked of another tab. A tab-defining channel is not something the
 * bench asked for — carrying "RPAD" out of RPAD collection would hide every police round
 * under Issuance — so it is dropped on the way; a channel the bench chose travels.
 */
export function rebaseFilters(
  filters: ProcessFilters,
  from: ProcessTab,
  to: ProcessTab,
): ProcessFilters {
  /* The outcome filters only exist where rows have come back; carried anywhere else they
     would empty the tab with a control that is not on it. */
  const kept = to.outcomeFilters
    ? { ...filters }
    : { ...filters, outcome: "all" as const, reason: "all" as const };
  if (from.onlyChannel === undefined || filters.channel !== from.onlyChannel) {
    return kept;
  }
  return { ...kept, channel: to.onlyChannel ?? "all" };
}

/**
 * Where else in the line this search would have found something.
 *
 * A process moves, so the most ordinary search on this screen — a case number typed while
 * standing where the row was last seen — finds nothing here and something one pill or one
 * tab over. So an empty view names the statuses that do hold a match, with counts, before
 * it says nothing is there. Every status outside the current view is asked, including the
 * other pills of this tab.
 */
export function processesElsewhere(
  rows: CourtProcess[],
  filters: ProcessFilters,
  from: { tab: ProcessTabId; view: ProcessView },
): { tab: ProcessTab; status: ProcessStatus; count: number }[] {
  const here = processTab(from.tab);
  return PROCESS_STATUSES.filter((status) =>
    status.tab === from.tab
      ? from.view !== "all" && status.id !== from.view
      : true,
  )
    .map((status) => {
      const tab = processTab(status.tab);
      return {
        tab,
        status,
        count: filterProcesses(
          processesAt(rows, status.id),
          rebaseFilters(filters, here, tab),
        ).length,
      };
    })
    .filter((entry) => entry.count > 0);
}

/** "31 Aug 2026" — the same column register every other court-side list uses. */
export function formatProcessDate(day: string): string {
  return formatListingDate(day);
}

const LONG_DAY = new Intl.DateTimeFormat("en-IN", {
  day: "numeric",
  month: "long",
  year: "numeric",
});

/** "15 September 2026" — a date named inside the process's prose, not in a column. */
export function formatProcessLongDate(day: string): string {
  return LONG_DAY.format(parseIsoDay(day));
}

/** Today, as an ISO day — what an act is stamped with. */
export function todayIsoDay(): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

/**
 * The process as a document: what the preview renders and what Download writes.
 *
 * Shaped like `SignOrderDocument`, with one field an order does not have. A process is
 * *addressed* — to the accused, or to the officer who must execute it — and who it is
 * addressed to is the first thing written on it. That is the difference between the
 * court's decision and the instrument that carries it out.
 */
export type ProcessDocument = {
  court: string;
  caseNumber: string;
  matter: string;
  title: string;
  /** Who the instrument commands. */
  addressee: string;
  paragraphs: string[];
  dated: string;
  /** How it goes out, written on the face of it. */
  channel: string;
  /** The signature block: who signs, and whether they have. */
  signature: string;
};

/**
 * Who each instrument is addressed to.
 *
 * A warrant, proclamation or attachment is addressed to the police, who execute it
 * (§6.3 of `handovers/process-handover.md`); everything else commands the accused to
 * appear. `docs/product/domain/actors.md` puts process execution with the police for a
 * §138 case.
 */
function addresseeFor(process: CourtProcess): string {
  if (processType(process.type).executed) {
    return "To the officer in charge of the police station";
  }
  return `To ${process.parties.accused}, the accused`;
}

/**
 * What each process says.
 *
 * Five templates, filled from the row's own particulars. All five are demo text — see
 * the module header. They recite no address, sum or process fee, because the rows carry
 * none and an invented particular in a facsimile is the kind of detail that gets
 * screenshot and quoted back.
 */
function paragraphsFor(process: CourtProcess): string[] {
  const { complainant, accused } = process.parties;
  const returnable = formatProcessLongDate(process.hearingDate);

  switch (process.type) {
    case "summons":
      return [
        `Whereas your attendance is necessary to answer a charge under section 138 of the Negotiable Instruments Act, 1881, on the complaint of ${complainant}, you are required to appear in person before this court on ${returnable}.`,
        "A summons sent by registered post is treated as duly served even if you refuse to take delivery of it. If you do not appear on the date fixed, this court may issue a warrant for your arrest.",
      ];
    case "section-223-notice":
      return [
        `A complaint under section 138 of the Negotiable Instruments Act, 1881 has been filed against you by ${complainant}. Before taking cognizance of the offence, this court has to give you an opportunity of being heard.`,
        `You are therefore given notice to appear before this court on ${returnable} and to state what you have to say on the complaint. The court will take cognizance after hearing you, or after the time allowed by this notice has passed.`,
      ];
    case "dca-notice":
      return [
        `The complainant, ${complainant}, has applied to this court to condone the delay in filing the complaint against you under section 138 of the Negotiable Instruments Act, 1881.`,
        `You are given notice of that application and are required to appear before this court on ${returnable} to show cause why the delay should not be condoned. The application will be heard and decided on that date.`,
      ];
    case "warrant":
      return [
        `Whereas ${accused}, the accused in this case, has failed to appear before this court although duly served with process, you are directed to arrest the said ${accused} and to produce them before this court.`,
        `This warrant remains in force until it is executed or until this court cancels it. The officer executing it shall report the manner of its execution to this court on ${returnable}.`,
      ];
    case "proclamation":
      return [
        `Whereas a warrant issued by this court for the arrest of ${accused} has been returned unexecuted, and this court has reason to believe that the said ${accused} is absconding or concealing themselves so that the warrant cannot be executed,`,
        `a proclamation is published requiring the said ${accused} to appear before this court on ${returnable}. It shall be read publicly, affixed at the accused's last known place of residence and at this courthouse, and the officer publishing it shall report compliance to this court.`,
      ];
    case "attachment":
      return [
        `Whereas a proclamation has been issued requiring ${accused}, the accused in this case, to appear before this court, and the said ${accused} has not appeared, on the complaint of ${complainant},`,
        `you are directed to attach the movable property belonging to the said ${accused} within the local limits of your jurisdiction, to hold it subject to the further orders of this court, and to report the manner of execution to this court on ${returnable}.`,
      ];
  }
}

export function buildProcessDocument(process: CourtProcess): ProcessDocument {
  const drawnUp = process.issuedOn ?? process.paidOn;
  return {
    court: `Before the ${COURT}`,
    caseNumber: process.caseNumber,
    matter: causeTitle(process),
    title: courtProcessTypeLabel(process.type),
    addressee: addresseeFor(process),
    paragraphs: paragraphsFor(process),
    dated: formatProcessLongDate(drawnUp),
    channel: `To be served through: ${processChannelLabel(process.channel)}.`,
    /* The signature block is the one part of the facsimile that is not the same on every
       row: an unsigned process says so plainly rather than showing an empty rule that
       could be mistaken for a signature that failed to render. */
    signature: process.signedOn
      ? `Signed by the magistrate, ${COURT}, on ${formatProcessLongDate(process.signedOn)}.`
      : "Pending the signature of the magistrate.",
  };
}

export function processDocumentText(document: ProcessDocument): string {
  return [
    document.court,
    `Case no. ${document.caseNumber}`,
    document.matter,
    "",
    document.title,
    document.addressee,
    "",
    ...document.paragraphs.map(
      (paragraph, index) => `${index + 1}. ${paragraph}`,
    ),
    "",
    document.channel,
    `Dated this the ${document.dated}.`,
    "",
    document.signature,
  ].join("\n");
}

export function processDocumentFilename(process: CourtProcess): string {
  return `${process.caseNumber.replace(/\//g, "-")}-${process.type}.txt`;
}

export function downloadProcessDocument(process: CourtProcess): void {
  const document = buildProcessDocument(process);
  const url = URL.createObjectURL(
    new Blob([localizeForDownload(processDocumentText(document))], { type: "text/plain" }),
  );
  const anchor = window.document.createElement("a");
  anchor.href = url;
  anchor.download = processDocumentFilename(voicedForDownload(process));
  anchor.click();
  URL.revokeObjectURL(url);
}

/**
 * Write the chosen rows out as one file — the Download the reference offers beside every
 * act, on every tab including the two that have no act.
 *
 * One file rather than one download per row: a bench that has checked eleven boxes is
 * asking for the eleven papers, and eleven separate saves is a browser fighting the
 * user. The papers are separated the way a bundle separates them.
 */
export function downloadProcessBundle(rows: CourtProcess[]): void {
  if (rows.length === 0) return;
  if (rows.length === 1) {
    downloadProcessDocument(rows[0]);
    return;
  }
  const body = rows
    .map((process) => processDocumentText(buildProcessDocument(process)))
    .join("\n\n———\n\n");
  const url = URL.createObjectURL(new Blob([localizeForDownload(body)], { type: "text/plain" }));
  const anchor = window.document.createElement("a");
  anchor.href = url;
  anchor.download = `process-${rows.length}-documents.txt`;
  anchor.click();
  URL.revokeObjectURL(url);
}

