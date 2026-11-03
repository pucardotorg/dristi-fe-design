/**
 * How many hearings are already listed on each day ahead, and for what — what the
 * cause list's next-hearing calendar shows against each date (owner, 2026-10-15).
 *
 * **Indicative, not a register.** There is no court diary behind the court side yet.
 * The count is the dashboard's own demo court (`court-docket.ts`), every pending case
 * with a next hearing on that day, plus the matters this sitting has already posted
 * from the cause list (`hearing-session.ts`). The owner asked for it to be indicative,
 * not accurate; it is the same court the dashboard counts, so the two do not disagree.
 */

import { courtDocket, isPending, msToDay } from "./court-docket";
import {
  COURT_HEARING_PURPOSES,
  courtHearingPurposeLabel,
  type CourtHearingPurposeId,
} from "./hearings";
import type { CausePosting } from "./order-draft";

/** One purpose on one day. */
export type PurposeLoad = {
  id: CourtHearingPurposeId;
  label: string;
  count: number;
};

/** One day's listings: the total, then the purposes, most first. */
export type DayLoad = { total: number; purposes: PurposeLoad[] };

/* The docket names a next hearing's purpose in its own words (`STAGES`); the cause list
   has one vocabulary of purposes, so they are read into it here. */
export const DOCKET_PURPOSE: Record<string, CourtHearingPurposeId> = {
  Cognizance: "cognizance",
  Appearance: "appearance",
  Bail: "bail",
  Plea: "plea",
  Evidence: "evidence-of-complainant",
  Arguments: "arguments",
  Judgement: "judgement",
};

const ORDER = new Map(COURT_HEARING_PURPOSES.map((entry, index) => [entry.id, index]));

/**
 * Every day from `today` on with something listed on it. `except` leaves out one
 * listing's own posting, so a matter being re-posted is not counted against itself.
 */
export function listingLoad(
  today: string,
  postings: Readonly<Record<string, CausePosting>>,
  except?: string,
): ReadonlyMap<string, DayLoad> {
  const counts = new Map<string, Map<CourtHearingPurposeId, number>>();
  const add = (day: string, purpose: CourtHearingPurposeId) => {
    if (day < today) return;
    const byPurpose = counts.get(day) ?? new Map<CourtHearingPurposeId, number>();
    byPurpose.set(purpose, (byPurpose.get(purpose) ?? 0) + 1);
    counts.set(day, byPurpose);
  };

  for (const entry of courtDocket(today).cases) {
    if (!isPending(entry) || entry.nextHearing === null || !entry.nextPurpose) continue;
    const purpose = DOCKET_PURPOSE[entry.nextPurpose];
    if (purpose) add(msToDay(entry.nextHearing), purpose);
  }
  for (const [id, posting] of Object.entries(postings)) {
    if (id === except) continue;
    if (posting.next === "list" && posting.nextDate && posting.nextPurpose) {
      add(posting.nextDate, posting.nextPurpose);
    }
  }

  return new Map(
    [...counts].map(([day, byPurpose]) => {
      const purposes = [...byPurpose]
        .map(([id, count]) => ({ id, label: courtHearingPurposeLabel(id), count }))
        .sort((a, b) => b.count - a.count || ORDER.get(a.id)! - ORDER.get(b.id)!);
      return [
        day,
        { total: purposes.reduce((sum, entry) => sum + entry.count, 0), purposes },
      ];
    }),
  );
}
