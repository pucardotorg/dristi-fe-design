/**
 * The A-Diary entries waiting on this bench's signature — the day's register, as data.
 *
 * The third row of the rail's Sign group, and a different kind of paper from the two
 * above it. A form is a court paper a party swears; an order is the court's own
 * decision. The A-Diary is the court's **register of its own day**: for every matter the
 * bench dealt with, what was done and when the case comes back. It is written as the day
 * runs and signed once the day is over, and until it is signed the day's record is not
 * made.
 *
 * **It is signed a whole day at a time** (`a-diary.md` `ADY-12`–`ADY-12b`): one document
 * per courtroom per day, generated at the moment of signing from the entries as they
 * stand, and only once that day is over. Entries are not signed one by one, and today's
 * diary cannot be signed today. `signableADiaryDays`, `buildADiaryDayDocument` and
 * `signADiaryDay` are that act.
 *
 * Two more facts shape everything here:
 *
 * 1. **An entry is dated, and the diary is read one day at a time.** So the screen's one
 *    filter is a date, opening on the day the court is sitting — the reference's own
 *    control — and the entries carry the day they record rather than a created-on
 *    timestamp.
 * 2. **The business of the day is editable until the day is signed** (`ADY-07`). Every
 *    other court-side queue shows a finished paper and asks only whether to act on it.
 *    This one is the record itself, so the bench can correct the words before the day is
 *    signed. `saveBusinessOfTheDay` is that edit. It changes the entry — which is the
 *    order's A-Diary text, one text kept in sync (`ADY-09`) — and never the order text,
 *    which is why an entry carries the two separately.
 *
 * **There is no backend. Nothing here is signed, filed or recorded.** `A_DIARY_SEED` is
 * demo data shaped to exercise what the screen has to survive: a day with enough entries
 * to read as a register, a short backlog on earlier days so the date filter has
 * something to cut on, a business line long enough to clamp in its column and to wrap in
 * the editor, a corporate party long enough to wrap the cause title, and a side with no
 * vakalat so the appearance table has an empty row to answer for. No row is read from a
 * case, a court or a register.
 *
 * **The dates are offsets, not fixtures.** A diary pinned to a date in 2026 is empty
 * every morning after that date, and a screen that opens on today would show nothing
 * forever. `bulk-reschedule.ts` reached the same conclusion for the same reason; the
 * offsets here are resolved against the reader's own clock by `aDiaryEntries`.
 *
 * **This does not read today's cause list**, though the diary of a real court is the
 * record of exactly those matters. `CAUSE_LIST` holds one day of listings, and what the
 * bench actually *did* with each of them — heard, passed over, still to be called — is
 * state that lives in the hearings screen for the length of a visit. A diary derived
 * from it would hold three entries, and would empty or contradict itself the moment
 * either side changed. So this module keeps its own matters, and they are its own: no
 * entry here restates a case on today's board, the scheduling queue, the register queue,
 * either review queue, or the two signing queues above it.
 */

import { addDays } from "./bulk-reschedule";
import { CURRENT_STAFF, PRESIDING_MAGISTRATE } from "./content";
import {
  causeTitle,
  counselFor,
  courtHearingPurposeLabel,
  formatCourtDay,
  formatListingDate,
  type CourtCounsel,
  type CourtHearingPurposeId,
} from "./hearings";
import { localizeForDownload, voicedForDownload } from "@/lib/court/browser";

/** The court whose register this is. One bench, one diary. */
const COURT = CURRENT_STAFF.court;

export type ADiaryEntry = {
  id: string;
  caseNumber: string;
  parties: { complainant: string; accused: string };
  /** Who appeared. A side may have none — no vakalat yet. */
  counsel: CourtCounsel[];
  /** The day this entry records, `YYYY-MM-DD`. */
  dated: string;
  /**
   * The hearing the order was passed in — its day and what it was listed for — or `null`
   * when the order was passed outside a hearing (`a-diary.md` `ADY-02`). The register's
   * Hearing column is blank for those (`ADY-03a`).
   */
  hearing: { day: string; purpose: CourtHearingPurposeId } | null;
  /**
   * The order sheet's opening recital: who was before the court, and what the case was
   * called for that day.
   *
   * **Not part of the business of the day, though it is part of the order.** It was, for
   * one render, and the table it feeds gave five rows opening "Both sides are represented
   * by counsel" — a column whose whole job is to say what was *done*, clamped to two
   * lines, reading as five copies of the same boilerplate. An order sheet states
   * appearances in its own block above the operative part (`order-screen.tsx` draws them
   * as two rolls), so that is where this belongs, beside the appearance table that
   * carries the same fact in names.
   *
   * Standing furniture, so the bench does not edit it: who appeared and what the matter
   * was called for are facts about the listing, not the court's own words. The business
   * below is what the bench writes, corrects and signs.
   */
  attendance: string;
  /**
   * Which order the court passed that day — the heading its order sheet carries.
   *
   * Descriptive rather than the bare "Order" the composer prints (`order-draft.ts`),
   * because this queue shows one day's order out of its own case: the bench opening a
   * row has not just dictated it and needs the heading to say which decision it is
   * reading. Sentence case, like every other title in the court-side catalogues.
   */
  orderTitle: string;
  /**
   * The operative passage of the order the entry came from, as signed.
   *
   * Starts out the same as `business` — the order's A-Diary text is the order text by
   * default (`order-generation.md` `PUB-04`) — and then stays put: correcting the entry
   * changes the A-Diary text, never the order (`ADY-09`). The entry dialog draws the
   * order from this, beside the editor, so the bench can check the one against the other
   * (`ADY-10`).
   */
  orderText: string;
  /**
   * What the court did that day, in the court's own words — the reference's
   * "Proceedings/Business of the day": the entry's A-Diary text, which is also the A-Diary
   * text of the order it came from (`ADY-09`).
   *
   * One string rather than a list of acts, because that is what it is on the paper: a
   * passage the bench writes, corrects and, with the rest of the day, signs. Paragraphs are separated by a blank
   * line, the way the editor holds them and the way the page prints them. It always ends
   * with the sentence that fixes the next date, which is the part the register is read
   * for.
   */
  business: string;
  /** The day the case comes back, and what it is listed for. */
  nextHearing: string;
  nextPurpose: CourtHearingPurposeId;
};

/**
 * One entry before its dates are resolved.
 *
 * `datedOffset` is days from today — `0` is the day the court is sitting, `-1` yesterday.
 * `nextOffset` is measured from the same today rather than from the entry's own day, so
 * a backlog entry cannot list a case for a date that has already passed.
 */
type ADiarySeed = Omit<
  ADiaryEntry,
  "dated" | "nextHearing" | "business" | "orderText" | "hearing"
> & {
  datedOffset: number;
  /** What the hearing was listed for, or `null` for an order passed outside a hearing. */
  hearingPurpose: CourtHearingPurposeId | null;
  nextOffset: number;
  /**
   * What was done, as the paragraphs of the order.
   *
   * Required, and a list rather than one string: these are the operative passage of the
   * day's order (`orderText`) as well as the start of its A-Diary text, and an order that
   * recites nothing but the date it is posted to is not an order the bench can read back.
   *
   * **The first paragraph is what the court did**, never who turned up — that is
   * `attendance`, and it is kept out of here so the table's clamped column opens on the
   * one fact that tells one day from another. `composeBusiness` puts the next-hearing
   * sentence after these as the last paragraph, which is where an order sheet fixes the
   * next date.
   */
  proceedings: string[];
};

/**
 * The register, newest day first.
 *
 * Five entries for the day the court is sitting, and three left unsigned from earlier
 * days — a bench that has not signed its diary every evening, which is the ordinary case
 * and the reason the screen offers a date at all.
 */
const A_DIARY_SEED: ADiarySeed[] = [
  {
    id: "ad-655",
    caseNumber: "ST/655/2026",
    parties: { complainant: "Sajeev Kumar", accused: "Thevally Auto Works" },
    counsel: [
      { name: "Adv. Nisha Thomas", side: "complainant" },
      { name: "Adv. Arun Prakash", side: "accused" },
    ],
    datedOffset: 0,
    hearingPurpose: "evidence-of-complainant",
    nextOffset: 7,
    nextPurpose: "evidence-of-complainant",
    attendance:
      "The complainant is present in person and is represented by counsel. The accused is represented by counsel. The case stands posted today for the evidence of the complainant.",
    orderTitle: "Order on the evidence of the complainant",
    proceedings: [
      "The complainant was sworn and examined as PW1 and his chief examination was completed. The cheque on which the complaint is founded, the memo by which the bank returned it and the statutory notice issued to the accused were marked through him, subject to proof, and the objections of the accused to their marking are left open.",
      "Counsel for the accused applied to take up the cross examination of PW1 today. The marking of the documents took up the sitting and the cross examination could not be taken up for want of time. PW1 is directed to be present on the next date.",
    ],
  },
  {
    id: "ad-658",
    caseNumber: "ST/658/2026",
    parties: { complainant: "Radhika Menon", accused: "Firoz Muhammad" },
    counsel: [
      { name: "Adv. Leela Krishnan", side: "complainant" },
      { name: "Adv. Sabu Varghese", side: "accused" },
    ],
    datedOffset: 0,
    hearingPurpose: "appearance",
    nextOffset: 10,
    nextPurpose: "appearance",
    attendance:
      "The complainant is represented by counsel. Counsel for the accused has filed his vakalat and entered appearance. The accused is not present in person.",
    orderTitle: "Order on the personal appearance of the accused",
    proceedings: [
      "Counsel for the accused reported that the accused is away from the district on work and applied that his personal appearance on this date be excused. The complainant has no objection. The application is allowed for today alone.",
      "The accused is directed to be present in person on the next date to enter his appearance and to furnish bail. No further exemption will be granted except on his own application.",
    ],
  },
  {
    id: "ad-662",
    caseNumber: "ST/662/2026",
    parties: {
      complainant: "Ashramam Hardware and Sanitary Wares",
      accused: "Bindu Rajagopal",
    },
    counsel: [{ name: "Adv. Mohan Das", side: "complainant" }],
    datedOffset: 0,
    hearingPurpose: "appearance",
    nextOffset: 14,
    nextPurpose: "plea",
    attendance:
      "The complainant is represented by counsel. The accused, Bindu Rajagopal, appeared before this court in person on the summons served on her. There is no advocate on record for the accused.",
    orderTitle: "Order releasing the accused on bail",
    proceedings: [
      "The accused is released on bail on the bond already executed before this court, with the surety already accepted. The substance of the accusation under section 138 of the Negotiable Instruments Act, 1881 was read over and explained to her in the language she understands, and she was told that she is not bound to answer it today.",
      "The accused submitted that she wishes to engage counsel before answering the accusation. She is at liberty to do so, and a copy of the complaint and of the documents produced with it was furnished to her.",
    ],
  },
  {
    id: "ad-665",
    caseNumber: "ST/665/2026",
    parties: { complainant: "Jomon Jacob", accused: "Sheela Ravindran" },
    counsel: [
      { name: "Adv. Priya Raghavan", side: "complainant" },
      { name: "Adv. Haridas Nair", side: "accused" },
    ],
    datedOffset: 0,
    hearingPurpose: null,
    nextOffset: 5,
    nextPurpose: "arguments",
    /* Passed outside a hearing, on a memo — the entry whose Hearing column is blank. */
    attendance:
      "This order is passed outside a hearing, on a memo filed by counsel for the accused. Both sides are represented by counsel.",
    orderTitle: "Order closing the evidence on both sides",
    proceedings: [
      "By the memo, the accused reports that she does not propose to adduce any evidence on her side, and that she will rely on the answers recorded in her examination under S. 351 BNSS and on the documents already marked in the evidence of the complainant. The evidence on both sides is accordingly closed.",
      "Both sides are to be ready with their submissions on the next date.",
    ],
  },
  {
    id: "ad-669",
    caseNumber: "ST/669/2026",
    parties: { complainant: "Shanavas Ali", accused: "Kadappakada Motors" },
    counsel: [
      { name: "Adv. Elizabeth Kurian", side: "complainant" },
      { name: "Adv. Rajan Pillai", side: "accused" },
    ],
    datedOffset: 0,
    hearingPurpose: "for-reports",
    nextOffset: 21,
    nextPurpose: "for-reports",
    attendance:
      "Both sides are represented by counsel. The case stands posted today for the report on the reference this court made to the mediation centre attached to it.",
    orderTitle: "Order on the reference to mediation",
    proceedings: [
      "Both counsel reported that the parties have appeared before the mediator and that the reference is still in progress. The report of the mediator has not been received by this court.",
      "The mediation centre is directed to report the result of the reference to this court, and the parties are directed to appear before the mediator on the dates the centre appoints.",
    ],
  },
  /* Left unsigned from earlier days. They are the reason the date filter is a control
     and not decoration. They are also the only days that can be signed: today's
     entries wait until the day is over (`ADY-12b`). */
  {
    id: "ad-672",
    caseNumber: "ST/672/2026",
    parties: { complainant: "Girija Amma", accused: "Nowfal Rawther" },
    counsel: [
      { name: "Adv. Suresh Menon", side: "complainant" },
      { name: "Adv. Deepa Chandran", side: "accused" },
    ],
    datedOffset: -1,
    hearingPurpose: "evidence-of-complainant",
    nextOffset: 9,
    nextPurpose: "examination-of-accused-351",
    attendance:
      "Both sides are represented by counsel. The accused is present in person. The case stands posted today for the cross examination of PW1.",
    orderTitle: "Order closing the evidence of the complainant",
    proceedings: [
      "PW1 was recalled and was cross examined by counsel for the accused. The cross examination was completed and the witness was discharged. The complainant reported that she has no further witness to examine, and the evidence on the side of the complainant is closed.",
      "The accused is directed to be present in person on the next date for his examination on the circumstances appearing against him in the evidence.",
    ],
  },
  {
    id: "ad-1046",
    caseNumber: "CMP/1046/2026",
    parties: {
      complainant: "Kilikolloor Rubber Traders",
      accused: "Anilkumar Sivadasan",
    },
    counsel: [{ name: "Adv. Fathima Nazar", side: "complainant" }],
    datedOffset: -1,
    hearingPurpose: "cognizance",
    nextOffset: 4,
    nextPurpose: "cognizance",
    attendance:
      "The complainant is represented by counsel. The accused has not been summoned at this stage and there is no advocate on record for him. The complaint under section 138 of the Negotiable Instruments Act, 1881 is taken up before cognizance.",
    orderTitle: "Order recording the sworn statement of the complainant",
    proceedings: [
      "The authorised representative of the complainant was examined on oath and his sworn statement was recorded separately and placed on the file. The authorisation under which he speaks for the complainant firm was produced and is on record.",
      "The originals of the cheque, of the memo by which the bank returned it and of the statutory notice with its postal acknowledgement were produced for verification. They were compared with the copies filed along with the complaint and were returned to the complainant.",
    ],
  },
  {
    id: "ad-676",
    caseNumber: "ST/676/2026",
    parties: { complainant: "Vijayan Pillai", accused: "Susan Mathew" },
    counsel: [
      { name: "Adv. Anwar Sadath", side: "complainant" },
      { name: "Adv. Rekha Pillai", side: "accused" },
    ],
    datedOffset: -3,
    hearingPurpose: "delay-condonation",
    nextOffset: 2,
    nextPurpose: "delay-condonation",
    attendance:
      "Both sides are represented by counsel. The case stands posted today on the application filed by the complainant to condone the delay in filing the complaint.",
    orderTitle: "Order on the application to condone the delay",
    proceedings: [
      "Counsel for the accused filed an objection to the application today and applied for time to address the court on it. A copy of the objection was furnished to counsel for the complainant across the bar.",
      "Both sides are to be heard on the application before the complaint is taken on file.",
    ],
  },
];

/**
 * How many days of the diary are waiting to be signed — the number the rail carries
 * beside "Sign A-Diary".
 *
 * Days, not entries, because a day is what gets signed (`ADY-12`); and only days that are
 * over, because today's diary cannot be signed until tomorrow (`ADY-12b`). Read from the
 * seed's offsets, which are facts about the fixture and not about the clock, so the rail
 * can carry it without asking what day it is. The page's own count line agrees with it.
 */
export const A_DIARY_PENDING_COUNT = new Set(
  A_DIARY_SEED.filter((seed) => seed.datedOffset < 0).map((seed) => seed.datedOffset),
).size;

/**
 * The next-hearing sentence — the one line every entry in the register ends with.
 *
 * The purpose keeps the case the catalogue gives it. Lower-casing it mid-sentence would
 * read better for "Appearance" and would destroy "Examination of accused under S. 351
 * BNSS", and the purposes are the court's own register vocabulary rather than ordinary
 * prose — the reference writes "for Appearance" for the same reason.
 *
 * One label — "For reports (to be received from forensics, ADR, etc)" — already opens
 * with the preposition, and bolting a second one on gives "for For reports". The
 * catalogue is right and the sentence is what has to bend, so the duplicate is dropped
 * rather than the purpose being avoided in the fixture.
 */
function nextHearingSentence(day: string, purpose: CourtHearingPurposeId): string {
  const label = courtHearingPurposeLabel(purpose);
  const listedFor = label.startsWith("For ") ? label.slice("For ".length) : label;
  return `Next hearing is scheduled on ${formatListingDate(day)} for ${listedFor}.`;
}

function composeBusiness(seed: ADiarySeed, nextHearing: string): string {
  return [
    ...seed.proceedings,
    nextHearingSentence(nextHearing, seed.nextPurpose),
  ].join("\n\n");
}

/**
 * The unsigned register, resolved against the day the reader is on.
 *
 * Newest day first, and within a day in the order the matters were dealt with — which is
 * the order a diary is written and therefore the order it is read back and signed.
 */
export function aDiaryEntries(today: string): ADiaryEntry[] {
  return A_DIARY_SEED.map((seed) => {
    const nextHearing = addDays(today, seed.nextOffset);
    const business = composeBusiness(seed, nextHearing);
    return {
      id: seed.id,
      caseNumber: seed.caseNumber,
      parties: seed.parties,
      counsel: seed.counsel,
      attendance: seed.attendance,
      orderTitle: seed.orderTitle,
      dated: addDays(today, seed.datedOffset),
      hearing:
        seed.hearingPurpose === null
          ? null
          : { day: addDays(today, seed.datedOffset), purpose: seed.hearingPurpose },
      /* The same text at the start: the A-Diary text is the order text by default. */
      orderText: business,
      business,
      nextHearing,
      nextPurpose: seed.nextPurpose,
    };
  });
}

export type ADiaryFilters = {
  /**
   * Which day's diary is on screen.
   *
   * `null` is the day the court is sitting, resolved against the reader's clock at
   * render rather than frozen when the screen first painted — the same bargain
   * `HearingsScreen` makes with its own day. Anything else is the ISO day the bench
   * asked for.
   *
   * There is deliberately no "every day" — the A-Diary is a dated register and is read,
   * corrected and signed one day at a time. A view mixing three days would also be a
   * table whose rows cannot be told apart, since the reference's columns carry the next
   * hearing date and not the day being signed. Clear returns to today for the same
   * reason.
   */
  dated: string | null;
};

/** What the screen opens on, and what Clear returns to: today's diary. */
export const DEFAULT_A_DIARY_FILTERS: ADiaryFilters = { dated: null };

/** Which day the filter is asking for, with `null` resolved to the reader's today. */
export function resolveADiaryDay(
  filters: ADiaryFilters,
  today: string,
): string {
  return filters.dated ?? today;
}

export function filterADiary(
  rows: ADiaryEntry[],
  filters: ADiaryFilters,
  today: string,
): ADiaryEntry[] {
  const day = resolveADiaryDay(filters, today);
  return rows.filter((entry) => entry.dated === day);
}

/** Every day that still has unsigned entries, today included — what the picker marks. */
export function unsignedADiaryDays(rows: ADiaryEntry[]): string[] {
  return [...new Set(rows.map((entry) => entry.dated))].sort((a, b) => b.localeCompare(a));
}

/**
 * Whether a day's diary can be signed yet: only once the day is over, never on the day
 * itself (`ADY-12b`). ISO days compare as strings.
 */
export function canSignADiaryDay(day: string, today: string): boolean {
  return day < today;
}

/** The unsigned days that can be signed now, newest first. */
export function signableADiaryDays(rows: ADiaryEntry[], today: string): string[] {
  return [...new Set(rows.map((entry) => entry.dated))]
    .filter((day) => canSignADiaryDay(day, today))
    .sort((a, b) => b.localeCompare(a));
}

/**
 * Sign one day: every entry of that day leaves the unsigned register together, because
 * the day is signed as one document (`ADY-12`). Once signed, nothing in it changes
 * (`ADY-07`), so there is nothing left on this screen to act on.
 *
 * **It records nothing.** See the module header: this filters a list in memory.
 */
export function signADiaryDay(rows: ADiaryEntry[], day: string): ADiaryEntry[] {
  return rows.filter((entry) => entry.dated !== day);
}

/**
 * Correct the day's business before the day is signed.
 *
 * A pure function over the register so the screen holds one list and no second copy of
 * the truth. The text is trimmed, and a blank one is ignored rather than written: a
 * diary entry with no business recorded is not a record the court can sign, and the
 * editor disables Save on it for the same reason. An id that names no entry is ignored
 * too — a register that has moved on under a stale dialog is a real case, not an error.
 *
 * It changes the entry's A-Diary text only. `orderText` is left exactly as it was: the
 * order text is not changed by editing the diary (`ADY-09`).
 *
 * **It records nothing.** See the module header: this replaces a string in memory.
 */
export function saveBusinessOfTheDay(
  rows: ADiaryEntry[],
  id: string,
  business: string,
): ADiaryEntry[] {
  const text = business.trim();
  if (!text) return rows;
  return rows.map((entry) =>
    entry.id === id ? { ...entry, business: text } : entry,
  );
}

/** "31 Aug 2026" — the same column register every other court-side list uses. */
export function formatADiaryDate(day: string): string {
  return formatListingDate(day);
}

/**
 * The order the court passed that day — what the preview renders and what Download
 * writes.
 *
 * **The document is the order, not the register line** (owner, 2026-09-15). The bench
 * opening a diary row is reading back a day it sat, and what it has to check before
 * signing is the paper that day produced: the order. So the entry dialog draws an order
 * sheet, built on the one the order composer prints (`order-screen.tsx`) so the two
 * halves of the court side cannot disagree about what an order looks like — the court
 * heading, the cause, the offence every case here is prosecuted for, the order's own
 * title, who appeared, the operative passage, and the block that signs it.
 *
 * It keeps the reference's **appearance table**, the part of the day's record that says
 * the hearing happened at all, as the order sheet's Present roll. The operative passage
 * is `entry.orderText` — the order as signed — and not the business the editor corrects:
 * correcting the diary does not change the order (`ADY-09`), and the order is shown so
 * the correction can be checked against it (`ADY-10`).
 *
 * **The order wording is demo text, not a court-approved order.** `docs/product/` defines
 * no §138 order template, the entries carry no sums, sureties or dates of payment, and
 * the passages below recite none. They claim nothing more than that. The one statute
 * they name is the one every case on this platform is about.
 */
export type ADiaryDocument = {
  court: string;
  caseNumber: string;
  matter: string;
  /** "Monday, 31 August 2026" — the day the order was passed, named in full. */
  dated: string;
  /**
   * The offence, as an order sheet prints it above the operative part.
   *
   * A fact about the platform rather than about the row — every case DRISTI runs is a
   * cheque-dishonour prosecution — and worded exactly as the order composer's own page
   * prints it, for the reason the titles are the register's: one product, one sentence.
   */
  offence: string;
  /** Which order this is — "Order on the evidence of the complainant". */
  title: string;
  /** Who was before the court, and what the matter was called for. */
  attendance: string;
  /** The reference's bordered table: a label and a value, in the order it draws them. */
  appearances: { label: string; value: string }[];
  /** The operative passage, in paragraphs — the order text as signed. */
  paragraphs: string[];
  /** The signature block. The order is signed: an entry exists only once it is (`ADY-05`). */
  signature: string;
};

/** Split on the blank line the editor holds and the seed writes. */
function splitParagraphs(text: string): string[] {
  return text.split(/\n\s*\n/).filter((paragraph) => paragraph.trim() !== "");
}

/** Counsel for one side, or the plain fact that there is none. */
function appearanceFor(entry: ADiaryEntry, side: "complainant" | "accused"): string {
  const names = counselFor(entry, side).map((counsel) => counsel.name);
  /* Named rather than left blank. The reference draws an empty row here, and an empty
     row in a facsimile reads as a document that failed to render — the same reason the
     signature block below says what it is waiting for. */
  return names.length > 0 ? names.join(", ") : "No advocate on record";
}

export function buildADiaryDocument(entry: ADiaryEntry): ADiaryDocument {
  return {
    court: `Before the ${COURT}`,
    caseNumber: entry.caseNumber,
    matter: causeTitle(entry),
    dated: formatCourtDay(entry.dated),
    offence: "Offence under S. 138 of the Negotiable Instruments Act, 1881",
    title: entry.orderTitle,
    attendance: entry.attendance,
    /* The reference's own four rows, in its own order: each side, then who appeared for
       it. "1" is the reference's numbering — a case can carry more than one complainant
       or accused, and the register numbers them. */
    appearances: [
      { label: "Complainant 1", value: entry.parties.complainant },
      { label: "Advocate(s)", value: appearanceFor(entry, "complainant") },
      { label: "Accused 1", value: entry.parties.accused },
      { label: "Advocate(s)", value: appearanceFor(entry, "accused") },
    ],
    paragraphs: splitParagraphs(entry.orderText),
    /* An entry is made when its order is triggered — signed and its order data complete
       (`ADY-05`) — so the order beside it is always a signed one. Named for the
       magistrate, never the seat working the screen. */
    signature: `Signed by ${PRESIDING_MAGISTRATE.name}, ${PRESIDING_MAGISTRATE.designation}, ${COURT}.`,
  };
}

export function aDiaryDocumentText(document: ADiaryDocument): string {
  return [
    document.court,
    `Case no. ${document.caseNumber}`,
    `In the matter of ${document.matter}`,
    `Dated ${document.dated}`,
    document.offence,
    "",
    document.title,
    "",
    ...document.appearances.map(({ label, value }) => `${label}: ${value}`),
    "",
    document.attendance,
    "",
    ...document.paragraphs.map(
      (paragraph, index) => `${index + 1}. ${paragraph}`,
    ),
    "",
    document.signature,
  ].join("\n");
}

export function aDiaryDocumentFilename(entry: ADiaryEntry): string {
  return `${entry.caseNumber.replace(/\//g, "-")}-order-${entry.dated}.txt`;
}

export function downloadADiaryDocument(entry: ADiaryEntry): void {
  const document = buildADiaryDocument(entry);
  const url = URL.createObjectURL(
    new Blob([localizeForDownload(aDiaryDocumentText(document))], { type: "text/plain" }),
  );
  const anchor = window.document.createElement("a");
  anchor.href = url;
  anchor.download = aDiaryDocumentFilename(voicedForDownload(entry));
  anchor.click();
  URL.revokeObjectURL(url);
}

/** "20 Oct 2026 · Evidence of complainant" — a date and what it is for, as one cell. */
export function formatADiaryHearing(day: string, purpose: CourtHearingPurposeId): string {
  return `${formatListingDate(day)} · ${courtHearingPurposeLabel(purpose)}`;
}

/**
 * The day's A-Diary as one document — what the signer signs (`ADY-12`).
 *
 * **Generated at the moment of signing, from the entries as they stand** (`ADY-12a`).
 * Until then the diary is entries on a screen, the same way an order is text until it is
 * signed and stored as a signed PDF (`order-generation.md` `PUB-01`). So nothing builds
 * this ahead of time: the sign dialog builds it when it opens, from the register it is
 * handed, and an entry corrected a minute earlier is in it.
 *
 * The same table as the screen (`ADY-03a`): one row per entry, with the case name and
 * number, the hearing (blank outside a hearing), the proceedings and the next hearing.
 */
export type ADiaryDayDocument = {
  court: string;
  /** "Monday, 19 October 2026" — the day the diary records, named in full. */
  dated: string;
  entries: {
    caseNumber: string;
    matter: string;
    /** Date and purpose, or `null` when the order was passed outside a hearing. */
    hearing: string | null;
    paragraphs: string[];
    /** Date and purpose. */
    nextHearing: string;
  }[];
  /** The signature block, until it is signed. */
  signature: string;
};

export function buildADiaryDayDocument(
  day: string,
  rows: ADiaryEntry[],
): ADiaryDayDocument {
  return {
    court: `Before the ${COURT}`,
    dated: formatCourtDay(day),
    entries: rows
      .filter((entry) => entry.dated === day)
      .map((entry) => ({
        caseNumber: entry.caseNumber,
        matter: causeTitle(entry),
        hearing: entry.hearing
          ? formatADiaryHearing(entry.hearing.day, entry.hearing.purpose)
          : null,
        paragraphs: splitParagraphs(entry.business),
        nextHearing: formatADiaryHearing(entry.nextHearing, entry.nextPurpose),
      })),
    signature: `Pending the signature of ${PRESIDING_MAGISTRATE.name}, ${PRESIDING_MAGISTRATE.designation}, ${COURT}.`,
  };
}

export function aDiaryDayDocumentText(document: ADiaryDayDocument): string {
  return [
    document.court,
    "A-Diary",
    `Dated ${document.dated}`,
    "",
    ...document.entries.flatMap((entry, index) => [
      `${index + 1}. Case: ${entry.matter}, ${entry.caseNumber}`,
      `Hearing: ${entry.hearing ?? ""}`,
      "Proceedings:",
      ...entry.paragraphs,
      `Next hearing: ${entry.nextHearing}`,
      "",
    ]),
    document.signature,
  ].join("\n");
}

export function aDiaryDayDocumentFilename(day: string): string {
  return `a-diary-${day}.txt`;
}

export function downloadADiaryDayDocument(day: string, rows: ADiaryEntry[]): void {
  const document = buildADiaryDayDocument(day, rows);
  const url = URL.createObjectURL(
    new Blob([localizeForDownload(aDiaryDayDocumentText(document))], {
      type: "text/plain",
    }),
  );
  const anchor = window.document.createElement("a");
  anchor.href = url;
  anchor.download = aDiaryDayDocumentFilename(day);
  anchor.click();
  URL.revokeObjectURL(url);
}
