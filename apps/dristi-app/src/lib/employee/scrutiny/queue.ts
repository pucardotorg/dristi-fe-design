import { QUEUE } from "@/lib/employee/scrutiny/fixtures";
import type { Ball, Filing, QueueOwner } from "@/lib/employee/scrutiny/types";
import { caseSearchKey } from "@/lib/court/localize";

export function countByBall(queue: Filing[], ball: Ball): number {
  return queue.filter((r) => r.ball === ball).length;
}

/**
 * What the rail's row counts: filings sitting with the registry, i.e. the officer's
 * actual inbox. Filings out with an advocate are not this desk's work and would make
 * the number lie.
 *
 * A constant rather than a function, to match the other court-side queues — the rail
 * reads `count` as a number, and a count of the list behind it is what keeps the rail
 * and the screen from disagreeing.
 */
export const SCRUTINY_QUEUE_COUNT = countByBall(QUEUE, "registry");

/**
 * Longest-waiting first, then filing no. — the queue is a work list, so the thing that
 * has been waiting the longest is the thing to look at. The filing no. tie-break keeps
 * the order stable between renders when two filings share a day count.
 */
export function filterQueue(
  queue: Filing[],
  ball: Ball,
  owner: QueueOwner,
  text: string,
): Filing[] {
  const needle = caseSearchKey(text);
  return queue
    .filter((r) => r.ball === ball)
    .filter((r) =>
      owner === "anyone" ? true : owner === "me" ? !!r.self : r.who === "—",
    )
    .filter(
      (r) =>
        !needle ||
        `${r.no} ${r.parties} ${r.advocate}`.toLowerCase().includes(needle),
    )
    .sort((a, b) => b.days - a.days || a.no.localeCompare(b.no));
}

/*
 * There is no `stageVariant` any more. It keyed the badge off `filing.ball` — which is
 * exactly what the tab above the table already filters by — so within one tab every row
 * wore the same chip in the same colour, saying nothing thirty times over. The stage now
 * reads as plain text in its column.
 */

export type WaitTone = "plain" | "muted" | "warning" | "destructive";

/**
 * Escalation is asymmetric on purpose: the registry's clock is the registry's problem
 * from day 7 and urgent from day 14; the advocate's is not chased until day 21, because
 * chasing an advocate on day 8 is noise.
 */
export function waitTone(filing: Filing): WaitTone {
  if (filing.ball === "closed") return "muted";
  if (filing.ball === "registry") {
    if (filing.days >= 14) return "destructive";
    if (filing.days >= 7) return "warning";
  }
  if (filing.ball === "advocate" && filing.days >= 21) return "warning";
  return "plain";
}

/** The filing behind a route param, or `undefined` when the id is not a real one. */
export function findFiling(filingNo: string): Filing | undefined {
  return QUEUE.find((r) => r.no === filingNo);
}

/**
 * The next filing to scrutinise after this one — what "Next file" reaches for when an
 * officer has just decided on a file and does not want to be sent back to the list
 * (owner, 2026-09-17).
 *
 * **"Next" is the registry work list in the order the queue shows it**, longest waiting
 * first, not the fixture's array order: the officer's idea of next is the row under the
 * one they just left, and that ordering lives in `filterQueue`. Reading it from there
 * rather than restating it is what keeps the button and the queue from disagreeing.
 *
 * A filing that is not in that list — out with an advocate, or closed — has no successor
 * in it, so the first row is the answer: the question asked was "what next", and that is
 * the next thing to do. The last row in the list returns `undefined`, which is the
 * caller's cue to offer the queue instead.
 */
export function nextFilingAfter(filingNo: string): Filing | undefined {
  const work = filterQueue(QUEUE, "registry", "anyone", "");
  const at = work.findIndex((r) => r.no === filingNo);
  return at < 0 ? work[0] : work[at + 1];
}
