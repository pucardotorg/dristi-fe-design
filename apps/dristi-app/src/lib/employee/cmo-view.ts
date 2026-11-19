/**
 * What the CMO / FSO's own view reads (note 1.2, CMO/FSO a–d; canvas round 19): the
 * process that is stuck, on top of the silent and undated cases the magistrate's view
 * already reads (`magistrate-view.ts`). The scrutiny officer's seat opens it, or the
 * Ahlmad's where there is no separate scrutiny officer (owner, 2026-11-17).
 *
 * Read on today from the same generated court as the rest of the dashboard
 * (`court-docket.ts`). Covers — "payment made, cover not submitted" (3b(b)) and "cover not
 * received 7 days before hearing" (3d) — are not here: the docket carries no cover, so
 * the view shows those two as not counted yet.
 */
import type { CourtRole } from "./content";
import {
  COURT_LIMITS,
  courtMeasures,
  daysBetween,
  type CourtDocket,
  type CourtProcess,
  type DocketCase,
} from "./court-docket";

/**
 * The seats whose "For you" is the CMO / FSO's view: the scrutiny officer, and the Ahlmad
 * in Punjab & Haryana, who holds scrutiny there (court-roles §3.3). The app has no CMO
 * seat of its own; this is a view rule, not a role (owner, 2026-11-17).
 */
export function holdsCmoView(role: CourtRole): boolean {
  return role === "scrutiny-officer" || role === "ahlmad";
}

export type StuckProcess ={ case: DocketCase; process: CourtProcess; days: number };

/**
 * Process issued more than 7 days ago and not paid (3b(a)), longest unpaid first: the
 * dashboard's own payment-pending count, so the two agree.
 */
export function unpaidProcess(docket: CourtDocket): StuckProcess[] {
  return courtMeasures(docket)
    .paymentPending.map(({ case: c, process }) => ({ case: c, process, days: daysBetween(process.issued, docket.today) }))
    .sort((a, b) => b.days - a.days);
}

/** Days after it is sent before a summons with no update is listed (note 1.2, 3b(c)). */
export const SUMMONS_UPDATE_DAYS = 7;

/**
 * Summons sent more than 7 days ago with no update (3b(c)), longest first. The docket has
 * no dispatch day and no status updates, so "sent" is read as the day the summons was
 * paid for, and "no update" as not delivered yet (owner, 2026-11-17, round 19). Only the
 * process running in the stage the case is in counts, as on the rest of the dashboard.
 */
export function summonsWithoutUpdate(docket: CourtDocket): StuckProcess[] {
  const { today } = docket;
  return courtMeasures(docket)
    .pending.flatMap((c) =>
      c.processes
        .filter(
          (p) =>
            p.stage === c.stage &&
            p.type === "Summons" &&
            p.paid !== null &&
            p.delivered === null &&
            daysBetween(p.paid, today) > SUMMONS_UPDATE_DAYS,
        )
        .map((process) => ({ case: c, process, days: daysBetween(process.paid!, today) })),
    )
    .sort((a, b) => b.days - a.days);
}

/** The payment limit the unpaid list reads, said where the list says what puts a case on it. */
export const PAYMENT_PENDING_DAYS = COURT_LIMITS.process.paymentPendingDays;
