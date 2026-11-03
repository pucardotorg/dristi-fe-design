/**
 * The cause list for any day, not only today (owner, 2026-10-22: "court-side users
 * can't switch the date and look at different days' cause list").
 *
 * **Today is the live sitting and comes from where it always did** (`boardForDay`): the
 * day's fixture with this browser's marks on it. So is a past day this browser worked,
 * shown closed.
 *
 * **Every other day is read from the demo court** (`court-docket.ts`) — the same court
 * the dashboard counts and the Next hearing calendar's numbers come from
 * (`listing-load.ts`), so the week strip, the calendar and the list all agree on how
 * many matters a day holds. A day ahead lists every pending case whose next hearing
 * falls on it, plus the matters this sitting has posted there from the Next hearing
 * column; a day behind lists the cases whose last hearing it was, heard. A weekend lists
 * nothing. Nothing on any of them can be called: a sitting happens on its own day.
 */

import { courtDocket, isPending, msToDay, type DocketCase, type StageKey } from "./court-docket";
import {
  boardForDay,
  CAUSE_LIST,
  type CourtCaseStage,
  type CourtCounsel,
  type CourtHearing,
  type CourtHearingPurposeId,
  isoDay,
  isSittingDay,
  parseIsoDay,
} from "./hearings";
import type { HearingSession } from "./hearing-session";
import { DOCKET_PURPOSE } from "./listing-load";

type DayMarks = Pick<HearingSession, "ongoingIds" | "endedIds" | "passedOverIds" | "previous" | "postings">;

/* The docket's stages are the dashboard's; the cause list names a case's stage in its
   own words. A trial purpose says where in the trial the case is, so it wins. */
const STAGE_FROM_DOCKET: Record<StageKey, CourtCaseStage> = {
  registration: "cognizance",
  cognizance: "cognizance",
  appearance: "appearance",
  bail: "appearance",
  trial: "evidence",
  judgement: "judgement",
};

const STAGE_FROM_PURPOSE: Partial<Record<CourtHearingPurposeId, CourtCaseStage>> = {
  plea: "plea",
  "evidence-of-complainant": "evidence",
  arguments: "arguments",
  judgement: "judgement",
};

function docketListing(entry: DocketCase, purpose: CourtHearingPurposeId, status: CourtHearing["status"]): Omit<CourtHearing, "item"> {
  const counsel: CourtCounsel[] = [];
  if (entry.advocate) counsel.push({ name: entry.advocate, side: "complainant" });
  if (entry.accusedAdvocate) counsel.push({ name: entry.accusedAdvocate, side: "accused" });
  return {
    id: `d-${entry.id}`,
    caseNumber: entry.caseNumber,
    stage: STAGE_FROM_PURPOSE[purpose] ?? STAGE_FROM_DOCKET[entry.stage ?? "judgement"],
    parties: { complainant: entry.complainant, accused: entry.accused },
    counsel,
    purpose,
    status,
  };
}

/** Whether the board for `day` is the live sitting or a record kept in this browser. */
function isWorkedDay(day: string, today: string, session: DayMarks): boolean {
  return day === today || (session.previous?.day === day && day < today);
}

/**
 * Every listing on a day that is not worked here, in the court's serial. Items are
 * numbered in the order the docket holds the cases, which is the order they were filed.
 */
function docketDay(day: string, today: string, session: DayMarks): CourtHearing[] {
  /* The court does not sit on a weekend (`isSittingDay`), whatever the demo docket's
     dates say. */
  if (!isSittingDay(day)) return [];
  const listings: Omit<CourtHearing, "item">[] = [];
  for (const entry of courtDocket(today).cases) {
    const purpose = entry.nextPurpose ? DOCKET_PURPOSE[entry.nextPurpose] : undefined;
    if (!purpose) continue;
    if (day > today && isPending(entry) && entry.nextHearing !== null && msToDay(entry.nextHearing) === day) {
      listings.push(docketListing(entry, purpose, "scheduled"));
    } else if (day < today && entry.previousPosting !== null && msToDay(entry.previousPosting) === day) {
      listings.push(docketListing(entry, purpose, "completed"));
    }
  }
  /* A matter this sitting posted to a day ahead is on that day's list, for the purpose
     it was posted for. */
  if (day > today) {
    for (const hearing of CAUSE_LIST) {
      const posting = session.postings[hearing.id];
      if (posting?.next === "list" && posting.nextDate === day && posting.nextPurpose) {
        listings.push({ ...hearing, id: `${hearing.id}@${day}`, purpose: posting.nextPurpose, status: "scheduled" });
      }
    }
  }
  return listings.map((listing, index) => ({ ...listing, item: index + 1 }));
}

/** The cause list for `day`. */
export function causeListForDay(day: string, today: string, session: DayMarks): CourtHearing[] {
  return isWorkedDay(day, today, session) ? boardForDay(day, today, session) : docketDay(day, today, session);
}

/** How many sitting days the date scrubber reaches either side of the chosen one. */
export const NEARBY_RADIUS = 5;
export const NEARBY_COUNT = NEARBY_RADIUS * 2 + 1;

function stepDay(day: string, delta: 1 | -1): string {
  const date = parseIsoDay(day);
  date.setDate(date.getDate() + delta);
  return isoDay(date);
}

/**
 * The day `delta` sittings from `day`: a weekend is stepped over, because the court does
 * not sit on one (`isSittingDay`) — except today, which the board always holds.
 */
export function stepSittingDay(day: string, delta: 1 | -1, today: string): string {
  let next = stepDay(day, delta);
  while (!isSittingDay(next) && next !== today) next = stepDay(next, delta);
  return next;
}

/**
 * The eleven days the scrubber previews: the chosen day in the middle and five sitting
 * days either side. The advocate home's scrubber walks calendar days; a court that does
 * not sit on a weekend would only show an empty list there.
 */
export function nearbySittingDays(day: string, today: string): string[] {
  const before: string[] = [];
  const after: string[] = [];
  for (let cursor = day, i = 0; i < NEARBY_RADIUS; i++) before.unshift((cursor = stepSittingDay(cursor, -1, today)));
  for (let cursor = day, i = 0; i < NEARBY_RADIUS; i++) after.push((cursor = stepSittingDay(cursor, 1, today)));
  return [...before, day, ...after];
}

/** Which of the eleven a pointer at `x` is over — the whole square is the hit area. */
export function nearbyIndex(x: number, left: number, width: number): number {
  if (width <= 0) return NEARBY_RADIUS;
  return Math.max(0, Math.min(NEARBY_COUNT - 1, Math.floor(((x - left) / width) * NEARBY_COUNT)));
}
