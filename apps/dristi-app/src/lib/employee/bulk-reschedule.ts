/**
 * The matters this court could move to another date — as data.
 *
 * Rescheduling in bulk is what a bench does when it is not going to sit: leave, transfer,
 * a court holiday declared late, a strike. The court pulls up everything listed across a
 * span of days and puts it on a new date in one act, rather than opening 20 case files.
 *
 * **There is no backend; the move is a demo move.** Confirming inside the overlay writes
 * the new date onto the matters for this session and nothing further — the board reads
 * back what the bench did, so the flow can be walked end to end, and that is the whole of
 * it. No notification is drawn up for the parties (the court's own
 * `notification-for-bulk-reschedule`), nobody is told, and nothing survives a reload. The
 * settled stage of the overlay says the second half of that out loud rather than letting
 * the screen imply the court has finished the act. Same bargain the registrations overlay
 * makes with its queue.
 *
 * **Today's rows are not restated here.** They are read out of `CAUSE_LIST` in
 * `./hearings`, so the two court-side screens cannot disagree about what this bench is
 * sitting on today. Only matters still `scheduled` are offered: one already heard,
 * abandoned or moved is not a matter this court can move again.
 *
 * The days after today are this module's own, and they are declared as **offsets** rather
 * than dates. A fixture pinned to 2026 goes stale the morning after it is written and
 * leaves the screen permanently empty; an offset is right whenever the screen is opened.
 */

import { CURRENT_STAFF, PRESIDING_MAGISTRATE } from "./content";
import {
  CAUSE_LIST,
  causeTitle,
  formatOrderDate,
  isSittingDay,
  isoDay,
  parseIsoDay,
  type CourtCaseStage,
  type CourtHearingPurposeId,
} from "./hearings";
import { caseSearchKey } from "@/lib/court/localize";
import { localizeForDownload, voicedForDownload } from "@/lib/court/browser";

export type ReschedulableHearing = {
  id: string;
  caseNumber: string;
  /** "A v. B" — the cause title, the same way the case record writes it. */
  title: string;
  /** How far the case has got. */
  stage: CourtCaseStage;
  /** What this sitting is listed for. Not the same fact as the stage. */
  purpose: CourtHearingPurposeId;
  /** The day the court's board has this matter on, `YYYY-MM-DD`. */
  date: string;
  /**
   * Where this session's bulk move has put it — absent on a matter nobody has moved.
   *
   * Held beside `date` rather than written over it, because a move is a change and a
   * change has two ends. A board that only ever showed where a matter now stands could
   * not tell the bench what it had just done: twenty rows would quietly take a new day
   * and the act that moved them would leave no mark on the thing it acted on. So the
   * day the matter was listed on stays where it is, this is the day it goes to, and the
   * board shows the pair (owner, 2026-09-15).
   */
  newDate?: string;
};

/**
 * The day a matter actually sits on — where this session moved it, else where it was
 * listed. Everything that asks *when* asks this; only the board, which shows the change
 * itself, reads the two fields apart.
 */
export function listedOn(row: ReschedulableHearing): string {
  return row.newDate ?? row.date;
}

/**
 * A listing on a day the court has already fixed, held as a distance from today **in
 * sitting days** — `offset: 1` is the next day this court sits, not tomorrow.
 *
 * Calendar days were the first reading and they cannot survive the sitting-day rule: an
 * offset of 5 from a Monday is a Saturday, so the fixture at that distance simply vanished
 * — and *which* fixtures vanished changed with the day of the week the screen was opened,
 * which is a board that cannot be tested or pointed at. Counting in sitting days keeps
 * every fixture on the board and keeps all of them on days the court is open, whatever
 * today happens to be.
 */
type UpcomingListing = Omit<ReschedulableHearing, "date"> & { offset: number };

/**
 * The days ahead of today, on this bench's board.
 *
 * Shaped to exercise what the screen has to survive rather than to look busy: a cause
 * title long enough to wrap its column, complaint numbers that have not yet become
 * summary-trial numbers, every stage the journey names, and enough days that a range
 * wider than one is worth asking for.
 */
const UPCOMING: UpcomingListing[] = [
  {
    id: "r-799",
    caseNumber: "CMP/799/2026",
    title: "Ancy Varghese v. Kadavu Timber Depot",
    stage: "cognizance",
    purpose: "cognizance",
    offset: 1,
  },
  {
    id: "r-801",
    caseNumber: "CMP/801/2026",
    title: "Rahul Nambiar v. Sreelakshmi Agencies",
    stage: "cognizance",
    purpose: "admission",
    offset: 1,
  },
  {
    id: "r-266",
    caseNumber: "ST/266/2026",
    title: "Jayasree Menon v. Ashokan K",
    stage: "appearance",
    purpose: "appearance",
    offset: 1,
  },
  {
    id: "r-267",
    caseNumber: "ST/267/2026",
    title: "Noushad Ali v. Meridian Tyres and Retreading Works Pvt Ltd",
    stage: "evidence",
    purpose: "evidence-of-complainant",
    offset: 1,
  },
  {
    id: "r-803",
    caseNumber: "CMP/803/2026",
    title: "Sarita Balakrishnan v. Vayal Agri Products",
    stage: "cognizance",
    purpose: "delay-condonation",
    offset: 2,
  },
  {
    id: "r-268",
    caseNumber: "ST/268/2026",
    title: "Devika Ravindran v. Chackos Jewellery",
    stage: "plea",
    purpose: "plea",
    offset: 2,
  },
  {
    id: "r-269",
    caseNumber: "ST/269/2026",
    title: "Manaf Sadiq v. Greenfield Rubber Estates",
    stage: "evidence",
    purpose: "examination-of-accused-351",
    offset: 2,
  },
  {
    id: "r-807",
    caseNumber: "CMP/807/2026",
    title: "Bindu Rajan v. Alappat Hardware",
    stage: "process",
    purpose: "appearance",
    offset: 3,
  },
  {
    id: "r-270",
    caseNumber: "ST/270/2026",
    title: "Elizabeth Mathew v. Karunya Motors",
    stage: "arguments",
    purpose: "arguments",
    offset: 3,
  },
  {
    id: "r-271",
    caseNumber: "ST/271/2026",
    title: "Prakash Menon v. Sea Breeze Cold Storage",
    stage: "evidence",
    purpose: "for-reports",
    offset: 3,
  },
  {
    id: "r-808",
    caseNumber: "CMP/808/2026",
    title: "Shalini Dev v. Amrutha Fabrics",
    stage: "cognizance",
    purpose: "admission",
    offset: 5,
  },
  {
    id: "r-272",
    caseNumber: "ST/272/2026",
    title: "Ibrahim Kutty v. Pournami Chit Funds",
    stage: "judgement",
    purpose: "judgement",
    offset: 5,
  },
  {
    id: "r-273",
    caseNumber: "ST/273/2026",
    title: "Geetha Sasidharan v. Vismaya Builders",
    stage: "appearance",
    purpose: "bail",
    offset: 6,
  },
  {
    id: "r-842",
    caseNumber: "CMP/842/2026",
    title: "Anwar Sadath v. Neeraja Metals",
    stage: "cognizance",
    purpose: "cognizance",
    offset: 8,
  },
  {
    id: "r-274",
    caseNumber: "ST/274/2026",
    title: "Latha Vijayan v. Harbour Marine Foods",
    stage: "plea",
    purpose: "plea",
    offset: 8,
  },
  {
    id: "r-275",
    caseNumber: "ST/275/2026",
    title: "Sabu Cherian v. Highway Auto Works",
    stage: "evidence",
    purpose: "evidence-of-complainant",
    offset: 9,
  },
  /* Past the fortnight, and then past the month. A court fixes evidence and arguments
     six weeks out as a matter of course, and the board used to stop nine days from
     today — which left the range filter with almost nothing to do: every span wider
     than a week selected the whole screen, so asking for one looked like a control that
     did not work. A range is only worth drawing over a board deep enough to narrow. */
  {
    id: "r-276",
    caseNumber: "ST/276/2026",
    title: "Zainaba Musthafa v. Ashtamudi Cashew Exports",
    stage: "evidence",
    purpose: "evidence-of-complainant",
    offset: 13,
  },
  {
    id: "r-851",
    caseNumber: "CMP/851/2026",
    title: "Vinod Kumar P v. Thattamala Steels",
    stage: "cognizance",
    purpose: "admission",
    offset: 17,
  },
  {
    id: "r-277",
    caseNumber: "ST/277/2026",
    title: "Remani Amma v. Kundara Poultry Farms",
    stage: "evidence",
    purpose: "examination-of-accused-351",
    offset: 24,
  },
  {
    id: "r-278",
    caseNumber: "ST/278/2026",
    title: "Shajahan Kunju v. Paravur Cements",
    stage: "arguments",
    purpose: "arguments",
    offset: 36,
  },
  {
    id: "r-279",
    caseNumber: "ST/279/2026",
    title: "Preetha Krishnan v. Chavara Fisheries Co-operative",
    stage: "judgement",
    purpose: "judgement",
    offset: 47,
  },
];

/** How far ahead the prototype's board reaches — forty sittings, about eight weeks. */
const BOARD_SITTINGS = 40;

/**
 * Names for the days the hand-written fixtures do not reach.
 *
 * `UPCOMING` above is deliberate: long titles, every stage, complaint numbers beside
 * summary-trial ones. It covers twelve sittings out of forty, which was enough while
 * the board opened unasked and the bench arrived on everything. It is not enough now that
 * the screen opens on one day and the range is the way around: a bench moving Thursday's
 * board wants Thursday to have something on it (owner, 2026-09-16 — *"cases for all
 * dates"*).
 *
 * So every sitting day the fixtures miss gets two or three matters drawn from these,
 * deterministically by day, because a board that reshuffles between renders is a board
 * nobody can point at twice.
 */
const FILLER_PARTIES: { complainant: string; respondent: string }[] = [
  { complainant: "Vijayan Pillai", respondent: "Lakeside Coir Traders" },
  { complainant: "Leela Mohan", respondent: "Ashtamudi Marine Exports" },
  { complainant: "Sabu Chacko", respondent: "Thevally Steel Syndicate" },
  { complainant: "Girija Damodaran", respondent: "Punalur Paper Agencies" },
  { complainant: "Anil Kurup", respondent: "Kottarakkara Cashew Works" },
  { complainant: "Remya Suresh", respondent: "Chinnakada Gold Palace" },
  { complainant: "Basheer Kunju", respondent: "Karunagappally Tile Company" },
  { complainant: "Sheela Thomas", respondent: "Paravur Lake Resorts Pvt Ltd" },
  { complainant: "Manoj Prasad", respondent: "Kundara Rubber Industries" },
  { complainant: "Fathima Rasheed", respondent: "Chathannoor Poultry Farm" },
  { complainant: "Unnikrishnan Nair", respondent: "Sasthamcotta Transport Service" },
  { complainant: "Devika Ramesh", respondent: "Anchalummoodu Timber Mart" },
  { complainant: "Joseph Varkey", respondent: "Neendakara Fishing Fleet" },
  { complainant: "Sreelatha Vijayan", respondent: "Pathanapuram Spice Board Agency" },
  { complainant: "Riyas Muhammed", respondent: "Kadappakada Auto Works" },
];

const FILLER_STAGES: { stage: CourtCaseStage; purpose: CourtHearingPurposeId }[] = [
  { stage: "cognizance", purpose: "cognizance" },
  { stage: "cognizance", purpose: "delay-condonation" },
  { stage: "process", purpose: "appearance" },
  { stage: "appearance", purpose: "admission" },
  { stage: "plea", purpose: "plea" },
  { stage: "evidence", purpose: "evidence-of-complainant" },
  { stage: "evidence", purpose: "for-reports" },
  { stage: "arguments", purpose: "arguments" },
  { stage: "judgement", purpose: "judgement" },
  { stage: "appearance", purpose: "bail" },
];

/**
 * The matters on one day that the fixtures left empty.
 *
 * Two or three, alternating, so consecutive days do not look stamped from one template;
 * the party and the stage advance on their own cycles so a day is not three rows of the
 * same posture either. Case numbers run in their own series (`ST/4xx`, `CMP/9xx`) so they
 * can never collide with a hand-written fixture.
 */
function fillerFor(sitting: number): UpcomingListing[] {
  const count = 2 + (sitting % 2);
  return Array.from({ length: count }, (_, index) => {
    const seed = sitting * 3 + index;
    const parties = FILLER_PARTIES[seed % FILLER_PARTIES.length];
    const posture = FILLER_STAGES[seed % FILLER_STAGES.length];
    const summary = seed % 3 !== 0;
    const serial = 400 + seed;
    return {
      id: `r-fill-${sitting}-${index}`,
      caseNumber: summary ? `ST/${serial}/2026` : `CMP/${serial + 500}/2026`,
      title: `${parties.complainant} v. ${parties.respondent}`,
      stage: posture.stage,
      purpose: posture.purpose,
      offset: sitting,
    };
  });
}

/** `YYYY-MM-DD`, `n` days on. Built through a Date so month and year ends are the OS's. */
export function addDays(day: string, count: number): string {
  const date = parseIsoDay(day);
  date.setDate(date.getDate() + count);
  return isoDay(date);
}

/**
 * The `n`th day this court sits after `from` — weekends skipped, never counted.
 *
 * Here rather than beside `isSittingDay` because it needs `addDays`, and `hearings.ts`
 * importing this module back would be a cycle. The predicate is the shared fact; walking
 * it is arithmetic.
 */
function nthSittingDay(from: string, count: number): string {
  let day = from;
  for (let step = 0; step < count; step += 1) {
    do {
      day = addDays(day, 1);
    } while (!isSittingDay(day));
  }
  return day;
}

/**
 * The order a board reads in: by the day it sits on, then by the court's own number, so
 * a matter keeps its place when the range widens — and when a move lands it in a
 * different day's block.
 */
function byListing(a: ReschedulableHearing, b: ReschedulableHearing): number {
  return (
    listedOn(a).localeCompare(listedOn(b)) ||
    a.caseNumber.localeCompare(b.caseNumber)
  );
}

/**
 * Everything this court could move, today first.
 */
export function reschedulableHearings(today: string): ReschedulableHearing[] {
  const listedToday: ReschedulableHearing[] = CAUSE_LIST.filter(
    (hearing) => hearing.status === "scheduled",
  ).map((hearing) => ({
    id: hearing.id,
    caseNumber: hearing.caseNumber,
    title: causeTitle(hearing),
    stage: hearing.stage,
    purpose: hearing.purpose,
    date: today,
  }));

  /* Every sitting day in the window, so a range drawn anywhere inside it lands on
     something: the hand-written listings where there are any, filler where there are
     none, and nothing at all on a day the court is closed. */
  const spoken = new Set(UPCOMING.map((listing) => listing.offset));
  const ahead: ReschedulableHearing[] = [];
  for (let sitting = 1; sitting <= BOARD_SITTINGS; sitting += 1) {
    const date = nthSittingDay(today, sitting);
    const listings = spoken.has(sitting)
      ? UPCOMING.filter((listing) => listing.offset === sitting)
      : fillerFor(sitting);
    for (const listing of listings) {
      ahead.push({
        id: listing.id,
        caseNumber: listing.caseNumber,
        title: listing.title,
        stage: listing.stage,
        purpose: listing.purpose,
        date,
      });
    }
  }

  return [...listedToday, ...ahead].sort(byListing);
}

/**
 * The board as this session left it.
 *
 * The fixture with whatever the bench has already moved written over it, back in board
 * order — a matter moved to next Tuesday has to fall into next Tuesday's block, not stay
 * in the one it was pulled out of. Recomputed from the fixture on every read rather than
 * held as a mutated list, so there is one source for what is listed and the moves are a
 * layer over it that a reload drops.
 */
export function boardAfterMoves(
  today: string,
  moved: Readonly<Record<string, string>>,
): ReschedulableHearing[] {
  return reschedulableHearings(today)
    .map((row) => {
      const to = moved[row.id];
      /* A move onto the day the matter is already on is not a move, and a row carrying
         a new date equal to its old one would put a second date on the board saying
         nothing. The overlay's calendar cannot offer that day, so this is a floor under
         the data rather than a case the screen reaches. */
      return to && to !== row.date ? { ...row, newDate: to } : row;
    })
    .sort(byListing);
}

/** One day the bench moved matters to, and how many went there. */
export type RescheduledDay = { day: string; count: number };

/**
 * The days this session moved matters to, ascending, each with its tally.
 *
 * A session is not one act. A court that is not sitting on the 15th moves that day's
 * board to the 17th, then looks at the fortnight after and moves eight more to 9 October
 * — two decisions, two days, one afternoon. The record has to hold both.
 *
 * **This returns the days, not the rows under them.** It used to return the rows too
 * (`groupByNewListing`), because the record was a stack of tables with a date heading
 * over each. The record is now one table with a *New hearing date* column, and the days
 * are what its filter offers (owner, 2026-09-16) — so what a caller needs is the list of
 * dates and, for each, how much is waiting there. The tally is the number worth having:
 * it is how a bench decides which date to look at, which is the moment the filter is
 * open.
 *
 * Rows keep the order the board gave them — `boardAfterMoves` has already sorted by the
 * day a matter now sits on and then by the court's own number — so the flat table reads
 * date by date without anything here sorting it again.
 */
export function rescheduledDays(
  rows: ReschedulableHearing[],
): RescheduledDay[] {
  const tally = new Map<string, number>();
  for (const row of rows) {
    if (row.newDate === undefined) continue;
    tally.set(row.newDate, (tally.get(row.newDate) ?? 0) + 1);
  }
  return [...tally]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([day, count]) => ({ day, count }));
}

export type RescheduleFilters = {
  /**
   * First and last listing date to pull in, inclusive — or `null` for no bound.
   *
   * The screen used to open on today and only today, and to say so by writing today into
   * both ends. That default is what made the range control read as already answered: the
   * calendar opened with a day lit, and the next click was taken as the *other* end of a
   * span starting there rather than as a first choice (owner, 2026-09-13). So an unasked
   * range is now genuinely unasked — the board shows everything this court has listed,
   * and the first click on the calendar is a first date.
   */
  from: string | null;
  to: string | null;
  /** Free text over the cause title and the case number — what the bench can recall. */
  query: string;
};

export function filterReschedulable(
  rows: ReschedulableHearing[],
  filters: RescheduleFilters,
): ReschedulableHearing[] {
  const query = caseSearchKey(filters.query);

  /* ISO days sort as strings, so each bound is a plain comparison — no Date per row.
     A `null` end is not a bound at all rather than a bound at today. */
  const inSpan = (day: string) =>
    (filters.from === null || day >= filters.from) &&
    (filters.to === null || day <= filters.to);

  return rows.filter((row) => {
    /* Judged on the day the matter stands listed on — which for a matter this session
       moved is the day it moved to.
       
       This used to let either end of the move keep a row in range, so that the bench
       could see what it had just done. That job now belongs to the Scheduled tab, which
       this filter does not touch: a range is a lens for finding matters to move, and
       nothing about narrowing it should hide work already finished. Leaving the rule
       here made the record answer to the lens — reschedule three matters, then move the
       range on to the next fortnight, and the Scheduled tab read zero (owner,
       2026-09-15). */
    if (!inSpan(listedOn(row))) return false;
    if (!query) return true;
    return `${row.title} ${row.caseNumber}`.toLowerCase().includes(query);
  });
}

/** The last day any of these matters currently stands listed on. */
function lastListedDay(rows: ReschedulableHearing[]): string | null {
  let last: string | null = null;
  for (const row of rows) {
    const day = listedOn(row);
    if (last === null || day > last) last = day;
  }
  return last;
}

/**
 * The first day a bulk move can land on.
 *
 * A bulk move is one act in one direction — the court is not sitting across a span, so
 * the span goes forward — and a new date *inside* the days being moved would send the
 * matters listed before it forward and the ones listed after it backward, which is two
 * acts wearing one button. It would also silently do nothing to whatever was already
 * listed on the day picked.
 *
 * So the floor is whichever of these is latest, and the day after it is the first the
 * overlay's calendar will offer:
 *
 * - **The span the bench asked the board for.** This is the one that matters, and it is
 *   the reason this takes `spanEnd` rather than reading the rows alone: a court that has
 *   said "13 September to 12 October" has declared those days dealt with, and offering a
 *   new date inside them invites exactly the mistaken pick the span was drawn to avoid —
 *   even where nothing happens to be listed in the tail of it (owner, 2026-09-13).
 * - **The last day any selected matter is listed**, which covers the board with no span
 *   asked for at all.
 * - **Today**, because a listing cannot be made in the past.
 */
export function earliestNewListing(
  rows: ReschedulableHearing[],
  spanEnd: string | null,
  today: string,
): string {
  let floor = today;
  const last = lastListedDay(rows);
  if (last !== null && last > floor) floor = last;
  if (spanEnd !== null && spanEnd > floor) floor = spanEnd;
  return addDays(floor, 1);
}

/**
 * The order a bulk move is passed by.
 *
 * A court does not move twenty matters by editing twenty rows: it passes one order, and
 * the order is what the case files carry afterwards. The screen used to commit the move
 * the moment a date was picked, which made the act a database edit wearing a calendar —
 * nothing was drawn up, so there was nothing to sign and nothing for the files to hold.
 * The bench now signs this before anything moves (Anshumanth, 2026-09-15).
 *
 * One order for the whole run rather than one per case. That is the act as the bench
 * performs it — a single direction naming the matters it covers — and it is what makes
 * the signature a single signature rather than twenty.
 *
 * **What it does not say.** It gives no reason. This screen never asks for one — leave,
 * transfer, a holiday declared late are all the same picked date to it — and an order
 * that recited a ground the court never entered would be the app writing the bench's
 * words for it. It also directs nothing at the parties: no notification is drawn up on
 * this branch, so the paper does not pretend to order one.
 */
export type RescheduleOrder = {
  /** "Before the JMFC Court 1". */
  court: string;
  title: string;
  /** The operative words. */
  paragraphs: string[];
  /** What the order covers, one line each. */
  matters: { caseNumber: string; matter: string; from: string; to: string }[];
  dated: string;
  /** Who signs, and whether they have. */
  signature: string;
};

export function buildRescheduleOrder(
  rows: ReschedulableHearing[],
  /** The day the matters are being listed on. */
  day: string,
  /** The day the order is passed. */
  today: string,
  /**
   * Present once the signature has gone on, absent before it.
   *
   * The signature block is the one part of the paper that is not the same before and
   * after the act, and it must be read at the moment it is written: a copy taken on the
   * signing step and handed back on the settled step would print "Pending the signature
   * of the magistrate" across an order the bench has just signed — the same trap
   * `sign-process` documents on its own bundle.
   */
  signedOn?: string,
): RescheduleOrder {
  return {
    court: `Before the ${CURRENT_STAFF.court}`,
    title: "Order rescheduling listed hearings",
    paragraphs: [
      `The matters listed below stand adjourned from the dates shown against them.`,
      `They are listed for hearing before this court on ${formatOrderDate(day)}.`,
    ],
    matters: rows.map((row) => ({
      caseNumber: row.caseNumber,
      matter: row.title,
      from: formatOrderDate(listedOn(row)),
      to: formatOrderDate(day),
    })),
    dated: formatOrderDate(today),
    signature: signedOn
      ? `Signed by ${PRESIDING_MAGISTRATE.name}, ${PRESIDING_MAGISTRATE.designation}, ${CURRENT_STAFF.court}, on ${formatOrderDate(signedOn)}.`
      : "Pending the signature of the magistrate.",
  };
}

/** The order as a plain-text facsimile — the shape every other court paper here takes. */
export function rescheduleOrderText(order: RescheduleOrder): string {
  return [
    order.court,
    "",
    order.title,
    "",
    ...order.paragraphs.map((paragraph, index) => `${index + 1}. ${paragraph}`),
    "",
    `Matters (${order.matters.length})`,
    ...order.matters.map(
      (matter) =>
        `${matter.caseNumber} · ${matter.matter} · ${matter.from} → ${matter.to}`,
    ),
    "",
    `Dated this the ${order.dated}.`,
    "",
    order.signature,
  ].join("\n");
}

export function rescheduleOrderFilename(order: RescheduleOrder): string {
  return `reschedule-order-${order.matters.length}-matters.txt`;
}

/**
 * Put the order in the bench's hands.
 *
 * Offered on the signing step, where the paper is off screen and the bench is one click
 * from committing, and again once it is signed — the two moments the reference offers a
 * court paper. Same blob-and-anchor the process and application documents use; nothing
 * is filed and no record is minted.
 */
export function downloadRescheduleOrder(order: RescheduleOrder): void {
  const url = URL.createObjectURL(
    new Blob([localizeForDownload(rescheduleOrderText(order))], { type: "text/plain" }),
  );
  const anchor = window.document.createElement("a");
  anchor.href = url;
  anchor.download = rescheduleOrderFilename(voicedForDownload(order));
  anchor.click();
  URL.revokeObjectURL(url);
}
