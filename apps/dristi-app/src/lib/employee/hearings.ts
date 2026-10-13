/**
 * Today's cause list — what this bench is sitting on, as data.
 *
 * The employee area is self-contained by design (see `content.ts`): nothing under
 * `/employee` reads from the citizen side and nothing there reads from here. So the
 * hearing vocabulary is restated in this module rather than imported from
 * `lib/cases/hearings.ts`. The *words* are deliberately the same ones — a hearing is
 * "scheduled" or "completed" and its purpose is "Admission" whichever side of the app is
 * looking at it — because the two halves must not drift into disagreeing about the same
 * §138 listing. Only the coupling is avoided, never the shared meaning. Passed over is
 * a sitting overlay this side owns; the citizen hearing record does not carry it yet.
 *
 * **There is no backend.** `CAUSE_LIST` is one sitting day of demo rows, shaped to
 * exercise what the screen has to survive: a purpose long enough to wrap its column, a
 * corporate accused long enough to wrap the cause title, sides with one counsel and
 * sides with several, and enough rows to page at 10 and 20. No row is read from a case,
 * a court or a queue.
 *
 * **The board opens before the court has sat**, every listing still to be called
 * (owner, 2026-09-16). The day starts where the bench starts: nothing heard, nothing
 * drawn up, and every mark on this screen made by the person at it. A board that opened
 * part-heard had the first thing it is for — Start hearing, on a matter that has not
 * been called — already done on half the rows, and an order can only follow a sitting,
 * so a completed listing here would arrive carrying one nobody wrote.
 *
 * **Starting, ending, and passing over are screen actions, not a court record.** The
 * listing stands as scheduled until the bench presses Start hearing; only then does
 * the chip read ongoing, and that matter's case overview opens over the list — the
 * glance the advocate list already ships, as an overlay the day sits behind. End
 * hearing, on the same control, marks that listing completed. Pass over, from the row overflow, marks it
 * passed over — to be heard on a later date — without completing it. Nothing is
 * filed, notified, or written back. Choosing that later date is Bulk reschedule /
 * Schedule, not this mark.
 *
 * The three marks themselves live in `hearing-session.ts`, because the cause title
 * and the order composer both navigate and the screen holding them does not survive
 * the trip. Where they are kept changed; what they claim did not.
 */

import { caseSearchKey } from "@/lib/court/localize";

export type CourtHearingStatus =
  | "scheduled"
  | "ongoing"
  | "completed"
  | "passed-over"
  | "rescheduled"
  | "abandoned";

export const COURT_HEARING_STATUSES: {
  id: CourtHearingStatus;
  label: string;
}[] = [
  { id: "scheduled", label: "Scheduled" },
  { id: "ongoing", label: "Ongoing" },
  { id: "completed", label: "Completed" },
  { id: "passed-over", label: "Passed over" },
  { id: "rescheduled", label: "Rescheduled" },
  { id: "abandoned", label: "Abandoned" },
];

/**
 * Statuses a listing can hold on today's cause list.
 *
 * Today's sitting is the matters listed for this date: still to be called, currently
 * being heard, already heard, or passed over to a later date. Rescheduled and
 * abandoned are not on this day's list — they have left it — so they are not offered
 * as filters here either. Passed over stays: the bench still needs to see what was
 * deferred versus what was heard.
 */
export type TodaysCauseStatus = Extract<
  CourtHearingStatus,
  "scheduled" | "ongoing" | "completed" | "passed-over"
>;

export const TODAYS_CAUSE_STATUSES = COURT_HEARING_STATUSES.filter(
  (status): status is { id: TodaysCauseStatus; label: string } =>
    status.id === "scheduled" ||
    status.id === "ongoing" ||
    status.id === "completed" ||
    status.id === "passed-over",
);

/** A matter that still belongs on this day's cause list. */
export function isOnTodaysCauseList(status: CourtHearingStatus): boolean {
  return (
    status === "scheduled" ||
    status === "completed" ||
    status === "passed-over"
  );
}

/**
 * Chip fills follow where the listing sits in the day. Each word gets its own Badge
 * variant so a scan of the Status column can tell them apart — the chip still carries
 * the word, so status is never colour alone (ACCESSIBILITY §3).
 *
 * Ongoing is the live sitting: Badge `default` (brand solid), the DS mark for now / today
 * / live. Scheduled stays `info` (listed, not yet called). Success keeps completed.
 * Passed over and rescheduled share `secondary` (deferred); they never appear together
 * on this list — rescheduled has left the day, passed over has not. Abandoned stays
 * `warning`. Sharing `info` between scheduled and ongoing left those two
 * indistinguishable at a glance.
 */
export function courtHearingStatusVariant(
  status: CourtHearingStatus,
): "default" | "info" | "success" | "secondary" | "warning" {
  switch (status) {
    case "scheduled":
      return "info";
    case "ongoing":
      return "default";
    case "completed":
      return "success";
    case "passed-over":
    case "rescheduled":
      return "secondary";
    case "abandoned":
      return "warning";
  }
}

export function courtHearingStatusLabel(status: CourtHearingStatus): string {
  return (
    COURT_HEARING_STATUSES.find((entry) => entry.id === status)?.label ?? status
  );
}

/** Only a listing that has not yet been called can be started. */
export function canStartHearing(status: CourtHearingStatus): boolean {
  return status === "scheduled";
}

/** Only the listing the bench is currently hearing can be ended. */
export function canEndHearing(status: CourtHearingStatus): boolean {
  return status === "ongoing";
}

/**
 * Orders on a listing open once the bench has called it.
 *
 * The composer drafts an order *in* a hearing, so a listing that has not been called has
 * nothing to draft from: on a scheduled row the Orders control is disabled, and Start
 * hearing beside it is what opens it. It stays open after End hearing — the order on a
 * matter the bench has just heard is the ordinary case, and closing the composer at the
 * end of the sitting would strand a draft written during it. A passed-over listing was
 * never heard, so no order comes out of today's sitting on it.
 *
 * **This is the gate for a seat that runs the sitting.** The typist has no start control
 * to open it with, so that seat reads `canTypeOrder` below.
 */
export function canDraftOrder(status: CourtHearingStatus): boolean {
  return status === "ongoing" || status === "completed";
}

/**
 * Orders on a listing, from the seat that does not call the matter.
 *
 * The typist's cause list is the orders column and nothing else — no Start, no End, no
 * Pass over, and no line about the sitting either, because the row's Status chip already
 * says where the matter stands and a column repeating it in other words was one column
 * of nothing (owner, 2026-09-09). Which means the precondition the bench's control
 * exists to satisfy has nothing left to satisfy it: gated on `canDraftOrder`, every
 * order on this board would be permanently shut.
 *
 * So for this seat the trip into the order **is** the sitting: a listing still on the
 * day's call opens, and walking in is what marks the matter heard
 * (`hearings-screen.tsx`). One press per row, which is the whole of this seat's line of
 * work through the day.
 *
 * A listing that was deferred, moved off the day or abandoned is not on the call, so no
 * order comes out of today's sitting on it — the same reason `canDraftOrder` closes on
 * those, and the one thing both seats still agree about.
 */
export function canTypeOrder(status: CourtHearingStatus): boolean {
  return status === "scheduled" || canDraftOrder(status);
}

/**
 * A listing still on the call can be passed over — scheduled (skip without
 * starting) or ongoing (stop without completing). Completed and already
 * passed-over listings cannot.
 */
export function canPassOver(status: CourtHearingStatus): boolean {
  return status === "scheduled" || status === "ongoing";
}

/**
 * Applies this sitting's live progress on top of the fixture.
 *
 * Ended listings stay completed. Passed-over listings stay passed over. Fixture
 * completed, passed-over, rescheduled and abandoned keep the status the data already
 * named. Everything else is scheduled until Start hearing names one id — and only
 * that id is ongoing. Starting a second matter without ending the first returns the
 * first to scheduled: the bench hears one cause at a time. A passed-over listing is
 * not recalled today.
 */
export function withHearingSession(
  hearings: CourtHearing[],
  session: {
    ongoingId: string | null;
    endedIds: ReadonlySet<string>;
    passedOverIds: ReadonlySet<string>;
  },
): CourtHearing[] {
  return hearings.map((hearing) => {
    if (session.endedIds.has(hearing.id)) {
      return { ...hearing, status: "completed" as const };
    }
    if (session.passedOverIds.has(hearing.id)) {
      return { ...hearing, status: "passed-over" as const };
    }
    if (
      hearing.status === "completed" ||
      hearing.status === "passed-over" ||
      hearing.status === "rescheduled" ||
      hearing.status === "abandoned"
    ) {
      return hearing;
    }
    return {
      ...hearing,
      status: hearing.id === session.ongoingId ? "ongoing" : "scheduled",
    };
  });
}

/**
 * The listing purposes this cause list actually uses.
 *
 * A subset of the §138 purposes the domain names, not the whole vocabulary — the Purpose
 * filter is built from this list, and offering the bench a purpose that cannot match a
 * row would be a control that only ever returns nothing.
 */
export type CourtHearingPurposeId =
  | "admission"
  | "appearance"
  | "arguments"
  | "bail"
  | "cognizance"
  | "delay-condonation"
  | "evidence-of-complainant"
  | "examination-of-accused-351"
  | "for-reports"
  | "judgement"
  | "plea";

export const COURT_HEARING_PURPOSES: {
  id: CourtHearingPurposeId;
  label: string;
}[] = [
  { id: "admission", label: "Admission" },
  { id: "appearance", label: "Appearance" },
  { id: "arguments", label: "Arguments" },
  { id: "bail", label: "Bail" },
  { id: "cognizance", label: "Cognizance" },
  { id: "delay-condonation", label: "Delay condonation" },
  { id: "evidence-of-complainant", label: "Evidence of complainant" },
  {
    id: "examination-of-accused-351",
    label: "Examination of accused under S. 351 BNSS",
  },
  {
    id: "for-reports",
    label: "For reports (to be received from forensics, ADR, etc)",
  },
  { id: "judgement", label: "Judgement" },
  { id: "plea", label: "Plea" },
];

export function courtHearingPurposeLabel(id: CourtHearingPurposeId): string {
  return (
    COURT_HEARING_PURPOSES.find((entry) => entry.id === id)?.label ?? id
  );
}

/**
 * Where the case itself has reached — not what this one sitting is listed for.
 *
 * A hearing's purpose and its case's stage are different facts and the court reads both:
 * a matter at the Cognizance stage can be listed for admission, and so can one that has
 * already reached Appearance. The reference's bulk-reschedule screen shows them as two
 * columns for exactly that reason, so they are two fields here.
 *
 * The stages are the national §138 journey's own (`docs/product/domain/journey.md`
 * §4–§8), named as the court names them. Nothing before cognizance appears: a complaint
 * the magistrate has not taken on file has no hearing to move.
 */
export type CourtCaseStage =
  | "cognizance"
  | "process"
  | "appearance"
  | "plea"
  | "evidence"
  | "arguments"
  | "judgement";

export const COURT_CASE_STAGES: { id: CourtCaseStage; label: string }[] = [
  { id: "cognizance", label: "Cognizance" },
  { id: "process", label: "Process" },
  { id: "appearance", label: "Appearance" },
  { id: "plea", label: "Plea" },
  { id: "evidence", label: "Evidence" },
  { id: "arguments", label: "Arguments" },
  { id: "judgement", label: "Judgement" },
];

export function courtCaseStageLabel(id: CourtCaseStage): string {
  return COURT_CASE_STAGES.find((entry) => entry.id === id)?.label ?? id;
}

/** Which side of the cause a lawyer appears for. The row marks it (C) / (A). */
export type CounselSide = "complainant" | "accused";

export type CourtCounsel = { name: string; side: CounselSide };

export type CourtHearing = {
  id: string;
  /**
   * The court's own serial on the day's list — the number the bench calls, not the row's
   * position on screen. It is stored rather than derived so filtering the list does not
   * renumber the matters: item 17 is item 17 whether or not items 1–16 are in view.
   */
  item: number;
  caseNumber: string;
  /** How far the case has got. Independent of `purpose` — see `CourtCaseStage`. */
  stage: CourtCaseStage;
  parties: { complainant: string; accused: string };
  /** Counsel on record for the listing. A side may have none — no vakalat yet. */
  counsel: CourtCounsel[];
  purpose: CourtHearingPurposeId;
  status: CourtHearingStatus;
};

/**
 * "A v. B" — the cause title, the same way the case record writes it.
 *
 * Takes the parties rather than a `CourtHearing`, so the scheduling queue
 * (`schedule.ts`) writes a cause title the same way this list does. Two court-side
 * screens naming the same case differently is the drift this shape rules out.
 */
export function causeTitle(matter: {
  parties: { complainant: string; accused: string };
}): string {
  return `${matter.parties.complainant} v. ${matter.parties.accused}`;
}

/** One side's advocates on record. Structural for the same reason as `causeTitle`. */
export function counselFor(
  matter: { counsel: CourtCounsel[] },
  side: CounselSide,
): CourtCounsel[] {
  return matter.counsel.filter((entry) => entry.side === side);
}

/** How a court-side row names a side in prose: "the complainant" / "the accused". */
export function partySideLabel(side: CounselSide): string {
  return side === "complainant" ? "complainant" : "accused";
}

/**
 * Who actually put an application in — counsel on record for that side, or the
 * party themselves when the side has no vakalat.
 *
 * Derived rather than stored, so a row cannot claim an advocate it does not
 * have on record. It is the "Application filer" line every court-side review
 * overlay shows, and it lives here so the four of them cannot word it four
 * ways.
 */
export function applicationFiler(
  matter: {
    parties: { complainant: string; accused: string };
    counsel: CourtCounsel[];
  },
  side: CounselSide,
): string {
  const onRecord = counselFor(matter, side)[0];
  const label = partySideLabel(side);
  return onRecord
    ? `${onRecord.name}, counsel for the ${label}`
    : `${matter.parties[side]}, ${label}, appearing without counsel`;
}

/**
 * One sitting day, 23 matters — the count the reference screen lists.
 *
 * Names and numbers follow the fixtures the rest of the repo already uses: local parties,
 * `Adv.`-prefixed counsel, and the `ST/NNN/YYYY` summary-trial number the reference shows
 * once a complaint has been taken on file.
 */
export const CAUSE_LIST: CourtHearing[] = [
  {
    id: "h-241",
    item: 1,
    caseNumber: "ST/241/2026",
    parties: { complainant: "Sunil Varghese", accused: "Anand Traders" },
    counsel: [
      { name: "Adv. Suresh Menon", side: "complainant" },
      { name: "Adv. Rekha Pillai", side: "accused" },
    ],
    stage: "evidence",
    purpose: "evidence-of-complainant",
    status: "scheduled",
  },
  {
    id: "h-243",
    item: 2,
    caseNumber: "ST/243/2026",
    parties: {
      complainant: "Meenakshi Nair",
      accused: "Coastal Agro Exports Pvt Ltd",
    },
    counsel: [
      { name: "Adv. Anitha George", side: "complainant" },
      { name: "Adv. Vinod Chandran", side: "accused" },
    ],
    stage: "appearance",
    purpose: "admission",
    status: "scheduled",
  },
  {
    id: "h-244",
    item: 3,
    caseNumber: "ST/244/2026",
    parties: { complainant: "Kiran Mathew", accused: "Harbour Line Shipping" },
    counsel: [{ name: "Adv. Anitha George", side: "complainant" }],
    stage: "appearance",
    purpose: "appearance",
    status: "scheduled",
  },
  {
    id: "h-245",
    item: 4,
    caseNumber: "ST/245/2026",
    parties: { complainant: "Rajeev Menon", accused: "Ferns Interiors" },
    counsel: [
      { name: "Adv. Suresh Menon", side: "complainant" },
      { name: "Adv. Latha Krishnan", side: "accused" },
      { name: "Adv. Feroz Hameed", side: "accused" },
    ],
    stage: "cognizance",
    purpose: "delay-condonation",
    status: "scheduled",
  },
  {
    id: "h-246",
    item: 5,
    caseNumber: "ST/246/2026",
    parties: { complainant: "Ayesha Rahman", accused: "Sreekumar P" },
    counsel: [
      { name: "Adv. Nisha Thomas", side: "complainant" },
      { name: "Adv. Rekha Pillai", side: "accused" },
    ],
    stage: "cognizance",
    purpose: "admission",
    status: "scheduled",
  },
  {
    id: "h-247",
    item: 6,
    caseNumber: "ST/247/2026",
    parties: { complainant: "Thomas Kurian", accused: "Highland Rubber Works" },
    counsel: [
      { name: "Adv. Saurabh Verma", side: "complainant" },
      { name: "Adv. Vinod Chandran", side: "accused" },
    ],
    stage: "cognizance",
    purpose: "cognizance",
    status: "scheduled",
  },
  {
    id: "h-248",
    item: 7,
    caseNumber: "ST/248/2026",
    parties: { complainant: "Deepa Suresh", accused: "Vasanth Kumar S" },
    counsel: [
      { name: "Adv. Saurabh Verma", side: "complainant" },
      { name: "Adv. Latha Krishnan", side: "accused" },
    ],
    stage: "plea",
    purpose: "plea",
    status: "scheduled",
  },
  {
    id: "h-249",
    item: 8,
    caseNumber: "ST/249/2026",
    parties: {
      complainant: "Shubhreet Singh",
      accused: "Gill Steel Fabricators",
    },
    counsel: [{ name: "Adv. Nisha Thomas", side: "complainant" }],
    stage: "process",
    purpose: "appearance",
    status: "scheduled",
  },
  {
    id: "h-250",
    item: 9,
    caseNumber: "ST/250/2026",
    parties: { complainant: "Fathima Beevi", accused: "Nithin Jose" },
    counsel: [
      { name: "Adv. Anitha George", side: "complainant" },
      { name: "Adv. Feroz Hameed", side: "accused" },
    ],
    stage: "evidence",
    purpose: "evidence-of-complainant",
    status: "scheduled",
  },
  {
    id: "h-251",
    item: 10,
    caseNumber: "ST/251/2026",
    parties: {
      complainant: "Ganesh Iyer",
      accused: "Backwater Marine Logistics and Warehousing Company Pvt Ltd",
    },
    counsel: [
      { name: "Adv. Suresh Menon", side: "complainant" },
      { name: "Adv. Rekha Pillai", side: "accused" },
      { name: "Adv. Vinod Chandran", side: "accused" },
    ],
    stage: "evidence",
    purpose: "for-reports",
    status: "scheduled",
  },
  {
    id: "h-252",
    item: 11,
    caseNumber: "ST/252/2026",
    parties: { complainant: "Lakshmi Prasad", accused: "Zenith Auto Spares" },
    counsel: [{ name: "Adv. Saurabh Verma", side: "complainant" }],
    stage: "cognizance",
    purpose: "admission",
    status: "scheduled",
  },
  {
    id: "h-253",
    item: 12,
    caseNumber: "ST/253/2026",
    parties: { complainant: "Abdul Salam", accused: "Riverside Constructions" },
    counsel: [
      { name: "Adv. Nisha Thomas", side: "complainant" },
      { name: "Adv. Latha Krishnan", side: "accused" },
    ],
    stage: "evidence",
    purpose: "examination-of-accused-351",
    status: "scheduled",
  },
  {
    id: "h-254",
    item: 13,
    caseNumber: "ST/254/2026",
    parties: { complainant: "Priya Menon", accused: "Sabari Textiles" },
    counsel: [
      { name: "Adv. Anitha George", side: "complainant" },
      { name: "Adv. Feroz Hameed", side: "accused" },
    ],
    stage: "arguments",
    purpose: "arguments",
    status: "scheduled",
  },
  {
    id: "h-255",
    item: 14,
    caseNumber: "ST/255/2026",
    parties: { complainant: "Joseph Antony", accused: "Mangala Cashews" },
    counsel: [
      { name: "Adv. Suresh Menon", side: "complainant" },
      { name: "Adv. Vinod Chandran", side: "accused" },
    ],
    stage: "appearance",
    purpose: "bail",
    status: "scheduled",
  },
  {
    id: "h-256",
    item: 15,
    caseNumber: "ST/256/2026",
    parties: { complainant: "Radhika Warrier", accused: "Anil Kumar T" },
    counsel: [{ name: "Adv. Saurabh Verma", side: "complainant" }],
    stage: "process",
    purpose: "appearance",
    status: "scheduled",
  },
  {
    id: "h-257",
    item: 16,
    caseNumber: "ST/257/2026",
    parties: {
      complainant: "Vivek Ramachandran",
      accused: "Palm Grove Resorts",
    },
    counsel: [
      { name: "Adv. Nisha Thomas", side: "complainant" },
      { name: "Adv. Rekha Pillai", side: "accused" },
    ],
    stage: "cognizance",
    purpose: "delay-condonation",
    status: "scheduled",
  },
  {
    id: "h-258",
    item: 17,
    caseNumber: "ST/258/2026",
    parties: { complainant: "Sneha Pillai", accused: "Kerala Spice Traders" },
    counsel: [
      { name: "Adv. Anitha George", side: "complainant" },
      { name: "Adv. Latha Krishnan", side: "accused" },
    ],
    stage: "evidence",
    purpose: "evidence-of-complainant",
    status: "scheduled",
  },
  {
    id: "h-259",
    item: 18,
    caseNumber: "ST/259/2026",
    parties: { complainant: "Mohammed Rafi", accused: "Unity Hardware Mart" },
    counsel: [{ name: "Adv. Suresh Menon", side: "complainant" }],
    stage: "appearance",
    purpose: "admission",
    status: "scheduled",
  },
  {
    id: "h-260",
    item: 19,
    caseNumber: "ST/260/2026",
    parties: { complainant: "Anjali Nambiar", accused: "Sunrise Poultry Farm" },
    counsel: [
      { name: "Adv. Saurabh Verma", side: "complainant" },
      { name: "Adv. Feroz Hameed", side: "accused" },
    ],
    stage: "judgement",
    purpose: "judgement",
    status: "scheduled",
  },
  {
    id: "h-261",
    item: 20,
    caseNumber: "ST/261/2026",
    parties: { complainant: "Hari Krishnan", accused: "Vaishnav Enterprises" },
    counsel: [
      { name: "Adv. Nisha Thomas", side: "complainant" },
      { name: "Adv. Vinod Chandran", side: "accused" },
    ],
    stage: "plea",
    purpose: "plea",
    status: "scheduled",
  },
  {
    id: "h-262",
    item: 21,
    caseNumber: "ST/262/2026",
    parties: { complainant: "Beena Jacob", accused: "Trident Packaging" },
    counsel: [{ name: "Adv. Anitha George", side: "complainant" }],
    stage: "process",
    purpose: "appearance",
    status: "scheduled",
  },
  {
    id: "h-263",
    item: 22,
    caseNumber: "ST/263/2026",
    parties: { complainant: "Suresh Babu", accused: "Ocean Pearl Seafoods" },
    counsel: [
      { name: "Adv. Suresh Menon", side: "complainant" },
      { name: "Adv. Rekha Pillai", side: "accused" },
    ],
    stage: "arguments",
    purpose: "arguments",
    status: "scheduled",
  },
  {
    id: "h-264",
    item: 23,
    caseNumber: "ST/264/2026",
    parties: { complainant: "Nithya Raman", accused: "Everbright Electricals" },
    counsel: [
      { name: "Adv. Saurabh Verma", side: "complainant" },
      { name: "Adv. Latha Krishnan", side: "accused" },
    ],
    stage: "cognizance",
    purpose: "cognizance",
    status: "scheduled",
  },
];

/**
 * How many matters are listed today — the number the rail carries beside "Today's
 * hearings".
 *
 * Derived from the list itself rather than typed in beside the label, so the rail and the
 * screen can never disagree about the size of the day. The other counts in the rail are
 * still the reference's demo numbers; this one is as real as the data behind it.
 */
export const TODAYS_HEARING_COUNT = CAUSE_LIST.filter((hearing) =>
  isOnTodaysCauseList(hearing.status),
).length;

/** One listing from the board, or nothing — the order composer looks a matter up by id. */
export function hearingById(id: string): CourtHearing | undefined {
  return CAUSE_LIST.find((hearing) => hearing.id === id);
}

/** A calendar day as `YYYY-MM-DD` in the reader's own timezone. */
export function isoDay(date: Date): string {
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

/**
 * `YYYY-MM-DD`, moved by whole days.
 *
 * It sits beside `isoDay` and `parseIsoDay` because more than one court-side module
 * walks a chain of dates: the register queue runs a §138 chain forward from a
 * submission, the case overview runs the same chain backward from a filing date. A
 * date helper each of them keeps privately is two implementations of one piece of
 * arithmetic, waiting to disagree about a month boundary.
 */
export function shiftDay(day: string, delta: number): string {
  const date = parseIsoDay(day);
  date.setDate(date.getDate() + delta);
  return isoDay(date);
}

/**
 * `YYYY-MM-DD` back to a Date at local midnight.
 *
 * Built from parts rather than `new Date(iso)`, which reads a bare date string as UTC and
 * so lands on the previous day for every court west of Greenwich. Kerala is not one of
 * them, but the bug is silent and the fix is one line.
 */
/**
 * **Whether this court sits on a day at all.** Monday to Friday, and nothing else.
 *
 * The rule was already in the product and already tested — `nextSittingDay` in
 * `order-demo.ts` rolls a next listing forward off `[0, 6]` so an order never names a day
 * the court is closed. It lives here now because a second screen needs it: the bulk
 * reschedule board carries no weekend listings and its calendar refuses to offer one, and
 * two copies of "which days are sitting days" is the kind of rule that drifts apart by a
 * day and is then wrong in one place only. `nextSittingDay` still applies it inline; it
 * should take this predicate the next time that file is open.
 *
 * **Saturday is closed, on the product's own evidence rather than on an assumption.** The
 * owner's instruction was about Sunday (2026-09-16) and this goes one day further, which
 * is a deviation worth naming: `nextSittingDay` has excluded Saturday since before this
 * screen existed, so listing matters on a Saturday here would have put the board at odds
 * with every order the same court issues. One line in this function is the whole cost of
 * reversing that if the owner means Saturdays to sit.
 *
 * **Holidays are not modelled.** Onam, a declared bandh, a day the Chief Justice closes —
 * a prototype that invented those would be asserting a calendar nobody has given it.
 */
export function isSittingDay(day: string): boolean {
  const weekday = parseIsoDay(day).getDay();
  return weekday !== 0 && weekday !== 6;
}

export function parseIsoDay(day: string): Date {
  const [year, month, date] = day.split("-").map(Number);
  return new Date(year, month - 1, date);
}

/**
 * A day, written out.
 *
 * **Three registers, because a date does three jobs here.** Screen prose names the day
 * the court is sitting on and can afford the weekday; a column of dates read against
 * each other cannot, and gets the short form; and a date inside the operative words of
 * an order takes neither — the court's own orders write "12 August 2025" and the
 * weekday is not part of the direction (`public/case-file/09-orders.pdf`: *"Accused to
 * appear on 12 August 2025"*, *"Call on 15 September 2025 for Evidence of
 * Complainant"*).
 *
 * The split is the court's, not a preference: `Summons_v14.pdf` makes it on one
 * page, writing "18 September 2026" in the sentence that requires the appearance and
 * "Friday, 10:30 AM" in the facts block above it. So a named fact may carry the weekday
 * and a sentence of order text may not.
 *
 * All three pin `en-IN` rather than reading the runtime's locale, so the server and the
 * browser render the same string.
 */
const LONG_DAY = new Intl.DateTimeFormat("en-IN", {
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
});

const LISTING_DAY = new Intl.DateTimeFormat("en-IN", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

const ORDER_DAY = new Intl.DateTimeFormat("en-IN", {
  day: "numeric",
  month: "long",
  year: "numeric",
});

/** "Monday, 31 August 2026" — a day named in a sentence. */
export function formatCourtDay(day: string): string {
  return LONG_DAY.format(parseIsoDay(day));
}

/** "31 Aug 2026" — a day in a column, beside other days. */
export function formatListingDate(day: string): string {
  return LISTING_DAY.format(parseIsoDay(day));
}

/** "31 August 2026" — a day inside the operative words of an order. */
export function formatOrderDate(day: string): string {
  return ORDER_DAY.format(parseIsoDay(day));
}

/**
 * The list for one day.
 *
 * There is exactly one day of demo data, so any date other than today's returns nothing
 * and the screen shows its empty state. That is the honest answer for this build: a court
 * that has no listing for the date asked for should say so, not borrow another day's
 * matters to look populated.
 *
 * Only scheduled, completed and passed-over listings belong here. Rescheduled and
 * abandoned have left this day's list; ongoing, newly ended and newly passed over
 * are a live overlay `withHearingSession` applies after.
 */
export function hearingsForDay(day: string, today: string): CourtHearing[] {
  if (day !== today) return [];
  return CAUSE_LIST.filter((hearing) => isOnTodaysCauseList(hearing.status));
}

export type HearingFilters = {
  status: TodaysCauseStatus | "all";
  purpose: CourtHearingPurposeId | "all";
  /** Free text over the cause title and the case number — what the bench can recall. */
  query: string;
};

export const EMPTY_FILTERS: HearingFilters = {
  status: "all",
  purpose: "all",
  query: "",
};

export function filterHearings(
  rows: CourtHearing[],
  filters: HearingFilters,
): CourtHearing[] {
  const query = caseSearchKey(filters.query);
  return rows.filter((hearing) => {
    if (filters.status !== "all" && hearing.status !== filters.status) {
      return false;
    }
    if (filters.purpose !== "all" && hearing.purpose !== filters.purpose) {
      return false;
    }
    if (!query) return true;
    const haystack =
      `${causeTitle(hearing)} ${hearing.caseNumber}`.toLowerCase();
    return haystack.includes(query);
  });
}

export const PAGE_SIZES = [10, 20, 30, 50] as const;

export type HearingsPageSize = (typeof PAGE_SIZES)[number];

/** Default page length for every employee list that pages through this vocabulary. */
export const PAGE_SIZE: HearingsPageSize = 10;

export function isHearingsPageSize(value: number): value is HearingsPageSize {
  return (PAGE_SIZES as readonly number[]).includes(value);
}
