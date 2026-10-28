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
 * hearing, on the same control, marks that listing heard. Pass over, behind that control's chevron, sets
 * it aside unheard, to be called again later the same day with Start hearing
 * (order-generation `HRG-04`). Nothing is filed, notified, or written back.
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
  /* The id stays `completed`, the word the citizen side shares; the board's word is
     Heard (order-generation `HRG-01`). */
  { id: "completed", label: "Heard" },
  { id: "passed-over", label: "Passed over" },
  { id: "rescheduled", label: "Rescheduled" },
  { id: "abandoned", label: "Abandoned" },
];

/**
 * Statuses a listing can hold on a day's cause list (order-generation `HRG-01`):
 * Scheduled, Ongoing, Passed over, Heard, Abandoned. Rescheduled has left the day, so it
 * is not one of them.
 */
export type TodaysCauseStatus = Extract<
  CourtHearingStatus,
  "scheduled" | "ongoing" | "completed" | "passed-over" | "abandoned"
>;

/**
 * The board's groups, in order (`CLS-02`): what is being heard, what is still to be
 * called, what was set aside to be called again, then what is finished with.
 */
export const CAUSE_LIST_STATUS_ORDER: readonly TodaysCauseStatus[] = [
  "ongoing",
  "scheduled",
  "passed-over",
  "completed",
  "abandoned",
];

/** Where a listing's status sits in the board's grouping — lower comes first. */
export function causeListStatusRank(status: CourtHearingStatus): number {
  const rank = CAUSE_LIST_STATUS_ORDER.indexOf(status as TodaysCauseStatus);
  return rank === -1 ? CAUSE_LIST_STATUS_ORDER.length : rank;
}

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

/**
 * Start hearing takes a listing not yet called, or one passed over earlier in the day —
 * passing over sets a matter aside to be called again the same day (`HRG-02`, `HRG-04`).
 */
export function canStartHearing(status: CourtHearingStatus): boolean {
  return status === "scheduled" || status === "passed-over";
}

/** The row's End hearing: only a listing being heard (`CLS-08`). */
export function canEndHearing(status: CourtHearingStatus): boolean {
  return status === "ongoing";
}

/**
 * End hearing from the cause list's bulk actions: a listing being heard, or one still
 * Scheduled. A hearing is always started before it is ended (`HRG-02`), so a Scheduled
 * listing ended in bulk is started and ended by the same press, both at that moment
 * (`CLS-10`, `HRG-08`). A passed-over listing has to be started again before it can be
 * ended.
 */
export function canEndHearingInBulk(status: CourtHearingStatus): boolean {
  return status === "scheduled" || status === "ongoing";
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
 * starting) or ongoing (stop without finishing). Heard, abandoned and already
 * passed-over listings cannot (`HRG-02`).
 */
export function canPassOver(status: CourtHearingStatus): boolean {
  return status === "scheduled" || status === "ongoing";
}

/** One day's marks — which listings are being heard, which were heard, which set aside. */
export type HearingMarks = {
  /** Several hearings may be under way at once (`HRG-06`). */
  ongoingIds: ReadonlySet<string>;
  endedIds: ReadonlySet<string>;
  passedOverIds: ReadonlySet<string>;
};

/**
 * Applies a sitting's marks on top of the fixture.
 *
 * Ended listings are heard, passed-over listings passed over, and every listing named
 * ongoing is ongoing — several at once (`HRG-06`). Fixture completed, passed-over,
 * rescheduled and abandoned keep the status the data already named. Everything else is
 * scheduled. The marks keep a listing in at most one set (`hearing-session.ts`).
 */
export function withHearingSession(
  hearings: CourtHearing[],
  session: HearingMarks,
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
      status: session.ongoingIds.has(hearing.id) ? "ongoing" : "scheduled",
    };
  });
}

/**
 * A day that is over. Every listing still Scheduled, Ongoing or Passed over when its day
 * ended is Abandoned (`HRG-05`); heard listings stay heard.
 */
export function closeDay(hearings: CourtHearing[]): CourtHearing[] {
  return hearings.map((hearing) =>
    hearing.status === "scheduled" ||
    hearing.status === "ongoing" ||
    hearing.status === "passed-over"
      ? { ...hearing, status: "abandoned" as const }
      : hearing,
  );
}

/**
 * The board's order (`CLS-02`): grouped by status — Ongoing, Scheduled, Passed over,
 * Heard, Abandoned — and, within each group, in the order `compare` gives, which is the
 * cause list's own sequence unless the reader has chosen another sort.
 */
export function groupByStatus(
  hearings: CourtHearing[],
  compare: (a: CourtHearing, b: CourtHearing) => number = (a, b) => a.item - b.item,
): CourtHearing[] {
  return [...hearings].sort(
    (a, b) =>
      causeListStatusRank(a.status) - causeListStatusRank(b.status) || compare(a, b),
  );
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

export type CourtCounsel = {
  name: string;
  side: CounselSide;
  /**
   * The party this advocate appears for, by name. Left out, they appear for every party
   * on their side — the usual case of one complainant and one accused.
   */
  party?: string;
};

/** A party beyond the one named in the cause title — a second accused, say. */
export type CourtParty = { name: string; side: CounselSide };

/** Someone appearing on a party's power of attorney (court-roles: PoA holder). */
export type CourtPoaHolder = { name: string; side: CounselSide; for: string };

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
  /** Further complainants or accused, after the ones in the cause title. */
  otherParties?: CourtParty[];
  /** PoA holders appearing for a party (`ATT-01`). */
  poaHolders?: CourtPoaHolder[];
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
      { name: "Adv. Feroz Hameed", side: "accused", party: "Sabari Textiles" },
      { name: "Adv. Latha Krishnan", side: "accused", party: "Sabari Textiles" },
    ],
    /* A firm and its partner, both accused (§141 NI Act); the firm has two advocates on
       record and the partner appears in person. The complainant is represented on a
       power of attorney too. A sample for `ATT-01`'s roll: every party and PoA holder,
       one advocate line per party however many advocates it has. */
    otherParties: [{ name: "Ramesh Kumar", side: "accused" }],
    poaHolders: [{ name: "Arun Menon", side: "complainant", for: "Priya Menon" }],
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
 * matters to look populated. The one exception is the last day this browser worked a
 * board, which `boardForDay` shows closed.
 *
 * Only scheduled, completed and passed-over listings belong here. Rescheduled and
 * abandoned have left this day's list; ongoing, newly ended and newly passed over
 * are a live overlay `withHearingSession` applies after.
 */
export function hearingsForDay(day: string, today: string): CourtHearing[] {
  if (day !== today) return [];
  return CAUSE_LIST.filter((hearing) => isOnTodaysCauseList(hearing.status));
}

/**
 * A day's board with its marks applied.
 *
 * Today is the live sitting. A past day is shown only when this browser holds its marks
 * — the last day a board was worked here (`hearing-session.ts`) — and it is shown closed:
 * whatever was not heard that day is Abandoned (`HRG-05`). Any other day has nothing
 * listed, as `hearingsForDay` says.
 */
export function boardForDay(
  day: string,
  today: string,
  session: HearingMarks & { previous: (HearingMarks & { day: string }) | null },
): CourtHearing[] {
  if (day === today) return withHearingSession(hearingsForDay(today, today), session);
  if (session.previous && session.previous.day === day && day < today) {
    return closeDay(withHearingSession(hearingsForDay(today, today), session.previous));
  }
  return [];
}

/** Where a listing's order stands, as the Orders column marks it (`CLS-03`, `CLS-08`). */
export type ListingOrderMark = "none" | "draft" | "recorded";

/* The words stand alone, because an applied filter shows as a chip with its value only. */
export const LISTING_ORDER_MARKS: { id: ListingOrderMark; label: string }[] = [
  { id: "none", label: "No order" },
  { id: "draft", label: "Draft order" },
  { id: "recorded", label: "Recorded order" },
];

/** Whether a listing's next hearing has been entered on the cause list (`CLS-06`). */
export type NextHearingMark = "set" | "unset";

export const NEXT_HEARING_MARKS: { id: NextHearingMark; label: string }[] = [
  { id: "set", label: "Next hearing set" },
  { id: "unset", label: "Next hearing not set" },
];

/**
 * The cause list's filters (`CLS-07`): one per column where filtering makes sense. Each
 * takes several values; an empty list does not narrow. S. no. and Action are not
 * filtered; Case name and Case number are the search.
 */
export type HearingFilters = {
  /** Also the quick pills above the list: none picked is *All*. */
  statuses: TodaysCauseStatus[];
  purposes: CourtHearingPurposeId[];
  /** Advocates on record, by name — a listing with any of them matches. */
  advocates: string[];
  stages: CourtCaseStage[];
  orders: ListingOrderMark[];
  /** Only where Next hearing is a column. */
  nextHearing: NextHearingMark[];
  /** Free text over the cause title and the case number — what the bench can recall. */
  query: string;
};

export const EMPTY_FILTERS: HearingFilters = {
  statuses: [],
  purposes: [],
  advocates: [],
  stages: [],
  orders: [],
  nextHearing: [],
  query: "",
};

/**
 * What the Orders and Next hearing filters read about a listing. Both live outside this
 * module — the draft store and the session's postings — so the screen hands them in.
 */
export type ListingFacts = {
  orderMark: (hearing: CourtHearing) => ListingOrderMark;
  nextHearingSet: (hearing: CourtHearing) => boolean;
};

export function filterHearings(
  rows: CourtHearing[],
  filters: HearingFilters,
  facts?: ListingFacts,
): CourtHearing[] {
  const query = caseSearchKey(filters.query);
  return rows.filter((hearing) => {
    if (
      filters.statuses.length &&
      !filters.statuses.includes(hearing.status as TodaysCauseStatus)
    ) {
      return false;
    }
    if (filters.purposes.length && !filters.purposes.includes(hearing.purpose)) {
      return false;
    }
    if (filters.stages.length && !filters.stages.includes(hearing.stage)) {
      return false;
    }
    if (
      filters.advocates.length &&
      !hearing.counsel.some((counsel) => filters.advocates.includes(counsel.name))
    ) {
      return false;
    }
    if (facts && filters.orders.length && !filters.orders.includes(facts.orderMark(hearing))) {
      return false;
    }
    if (
      facts &&
      filters.nextHearing.length &&
      !filters.nextHearing.includes(facts.nextHearingSet(hearing) ? "set" : "unset")
    ) {
      return false;
    }
    if (!query) return true;
    const haystack =
      `${causeTitle(hearing)} ${hearing.caseNumber}`.toLowerCase();
    return haystack.includes(query);
  });
}

/** Every advocate on record across these listings, by name, for the Advocate filter. */
export function advocatesOnList(rows: CourtHearing[]): string[] {
  return [...new Set(rows.flatMap((hearing) => hearing.counsel.map((c) => c.name)))].sort(
    (a, b) => a.localeCompare(b),
  );
}

export const PAGE_SIZES = [10, 20, 30, 50] as const;

export type HearingsPageSize = (typeof PAGE_SIZES)[number];

/** Default page length for every employee list that pages through this vocabulary. */
export const PAGE_SIZE: HearingsPageSize = 10;

export function isHearingsPageSize(value: number): value is HearingsPageSize {
  return (PAGE_SIZES as readonly number[]).includes(value);
}
