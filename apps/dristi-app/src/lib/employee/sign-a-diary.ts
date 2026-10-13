/**
 * The A-Diary entries waiting on this bench's signature — the day's register, as data.
 *
 * The third row of the rail's Sign group, and a different kind of paper from the two
 * above it. A form is a court paper a party swears; an order is the court's own
 * decision. The A-Diary is the court's **register of its own day**: for every matter the
 * bench dealt with, what was done and when the case comes back. It is written as the day
 * runs and signed at the end of it, and until the magistrate signs it the day's record
 * is not made.
 *
 * Two facts follow from that and shape everything here:
 *
 * 1. **An entry is dated, and the diary is read one day at a time.** So the screen's one
 *    filter is a date, opening on the day the court is sitting — the reference's own
 *    control — and the entries carry the day they record rather than a created-on
 *    timestamp.
 * 2. **The business of the day is editable until it is signed.** Every other court-side
 *    queue shows a finished paper and asks only whether to act on it. This one is the
 *    record itself, so the bench can correct the words before putting a signature under
 *    them. `saveBusinessOfTheDay` is that edit.
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
   * What the court did that day, in the court's own words — the reference's
   * "Proceedings/Business of the day", and the operative passage of the order sheet the
   * entry dialog renders.
   *
   * One string rather than a list of acts, because that is what it is on the paper: a
   * passage the bench writes, corrects and signs. Paragraphs are separated by a blank
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
type ADiarySeed = Omit<ADiaryEntry, "dated" | "nextHearing" | "business"> & {
  datedOffset: number;
  nextOffset: number;
  /**
   * What was done, as the paragraphs of the order.
   *
   * Required, and a list rather than one string: the entry dialog renders this as the
   * operative passage of the day's order sheet, and an order that recites nothing but
   * the date it is posted to is not an order the bench can read back.
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
    nextOffset: 5,
    nextPurpose: "arguments",
    attendance:
      "Both sides are represented by counsel. The accused is present in person. The case stands posted today for the evidence of the accused.",
    orderTitle: "Order closing the evidence on both sides",
    proceedings: [
      "The accused reported that she does not propose to adduce any evidence on her side, and that she will rely on the answers recorded in her examination under S. 351 BNSS and on the documents already marked in the evidence of the complainant. The evidence on both sides is accordingly closed.",
      "Both counsel applied for time to prepare their submissions.",
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
     and not decoration, and the reason the page's count and the table's count differ:
     the count is the whole unsigned diary, the table is one day of it. */
  {
    id: "ad-672",
    caseNumber: "ST/672/2026",
    parties: { complainant: "Girija Amma", accused: "Nowfal Rawther" },
    counsel: [
      { name: "Adv. Suresh Menon", side: "complainant" },
      { name: "Adv. Deepa Chandran", side: "accused" },
    ],
    datedOffset: -1,
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
 * How many diary entries are unsigned — the number the rail carries beside "Sign
 * A-Diary".
 *
 * The length of the seed, which is a fact about the fixture and not about the clock, so
 * the rail can carry it without asking what day it is. It counts the whole unsigned
 * diary rather than one day of it: the rail sends the bench to a screen that opens on
 * today, and the page's own count line is the one that agrees with this number. Derived
 * rather than typed in beside the label, the way every other built row's count is.
 */
export const A_DIARY_PENDING_COUNT = A_DIARY_SEED.length;

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
    return {
      id: seed.id,
      caseNumber: seed.caseNumber,
      parties: seed.parties,
      counsel: seed.counsel,
      attendance: seed.attendance,
      orderTitle: seed.orderTitle,
      dated: addDays(today, seed.datedOffset),
      business: composeBusiness(seed, nextHearing),
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

/**
 * Correct the day's business before it is signed.
 *
 * A pure function over the register so the screen holds one list and no second copy of
 * the truth. The text is trimmed, and a blank one is ignored rather than written: a
 * diary entry with no business recorded is not a record the court can sign, and the
 * editor disables Save on it for the same reason. An id that names no entry is ignored
 * too — a register that has moved on under a stale dialog is a real case, not an error.
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
 * Two things it keeps from the register it replaced. The **appearance table** is the
 * reference's own drawing and is the part of the day's record that says the hearing
 * happened at all, so it stays, as the order sheet's Present roll. And the operative
 * passage is `entry.business` — the same string the editor corrects — so correcting the
 * day's record still visibly changes the paper beside it.
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
  /** The operative passage, in paragraphs — the business of the day as the bench left it. */
  paragraphs: string[];
  /** The signature block. Nothing in this build ever signs it. */
  signature: string;
};

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
    /* Split on the blank line the editor holds and the seed writes. A passage the bench
       has flattened into one paragraph is one paragraph, which is what it asked for. */
    paragraphs: entry.business.split(/\n\s*\n/).filter((text) => text.trim() !== ""),
    /* The signature block names whose signature the page is waiting for — the magistrate,
       never the seat working the screen. An unsigned order says so plainly rather than
       showing an empty rule that could be mistaken for a signature that failed to
       render. */
    signature: `Pending the signature of ${PRESIDING_MAGISTRATE.name}, ${PRESIDING_MAGISTRATE.designation}, ${COURT}.`,
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
