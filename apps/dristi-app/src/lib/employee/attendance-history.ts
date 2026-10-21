/**
 * Attendance history — the first thing the Data flags tab shows (`ORD-15`, `CLS-11`:
 * "things like attendance history").
 *
 * One row per person on the listing's roll (`appearancesFor`, `ATT-01`), in roll order:
 * how often they have attended the case's past sittings, and how they were marked at the
 * last five.
 *
 * **The marks are demo data.** No past sitting in the prototype records attendance — a
 * sitting carries its date, purpose and order (`hearingSittings`), and nothing else. The
 * marks are drawn from the listing, the person and the date, so a screenshot taken twice
 * shows the same roll; each person keeps a steady rate of their own, so the flags read
 * like a record rather than noise. When attendance is stored with each order (`ATT-02`),
 * `markAt` is the one function that changes.
 */

import { hearingSittings, type HearingSitting } from "./hearing-overview";
import { appearancesFor, type Appearance } from "./order-draft";
import type { CourtHearing } from "./hearings";

/** How a person was marked at one sitting (`ATT-02`). */
export type SittingMark = "present" | "absent" | "not-required";

/** How many past sittings a row shows mark by mark. */
export const RECENT_SITTINGS = 5;

export type AttendanceSitting = { on: string; purpose: string };

export type AttendanceRow = {
  appearance: Appearance;
  /** Oldest first, one per entry in `AttendanceHistory.recent`. */
  recent: SittingMark[];
  /** Across every past sitting, not just the recent ones. */
  present: number;
  /** Sittings the person was required at: present plus absent. */
  required: number;
  /** Whole per cent of required sittings attended; absent when none were required. */
  percent?: number;
};

export type AttendanceHistory = {
  /** The last sittings, oldest first — the columns every row's marks line up under. */
  recent: AttendanceSitting[];
  /** Every past sitting counted. */
  total: number;
  rows: AttendanceRow[];
};

export function attendanceHistory(hearing: CourtHearing): AttendanceHistory {
  /* `hearingSittings` is newest first. A sitting that passed no order still had people
     before the bench, so it counts. */
  const sittings = hearingSittings(hearing.id).toReversed();
  const recent = sittings.slice(-RECENT_SITTINGS);
  const rows = appearancesFor(hearing).map((appearance): AttendanceRow => {
    const marks = sittings.map((sitting) => markAt(hearing.id, appearance, sitting));
    const present = marks.filter((mark) => mark === "present").length;
    const required = marks.filter((mark) => mark !== "not-required").length;
    return {
      appearance,
      recent: marks.slice(-RECENT_SITTINGS),
      present,
      required,
      percent: required > 0 ? Math.round((present / required) * 100) : undefined,
    };
  });
  return {
    recent: recent.map(({ on, purpose }) => ({ on, purpose })),
    total: sittings.length,
    rows,
  };
}

/**
 * Demo: how this person was marked at this sitting. About one sitting in seven a person
 * was not required; otherwise each person has a steady rate, between about half and
 * nearly always, and each sitting is drawn against it.
 */
function markAt(
  listingId: string,
  appearance: Appearance,
  sitting: HearingSitting,
): SittingMark {
  const rate = 0.5 + (hash(`${listingId}:${appearance.id}`) % 46) / 100;
  const draw = (hash(`${listingId}:${appearance.id}:${sitting.on}`) % 100) / 100;
  if (hash(`required:${listingId}:${appearance.id}:${sitting.on}`) % 7 === 0) {
    return "not-required";
  }
  return draw < rate ? "present" : "absent";
}

/** FNV-1a: small, stable, and the same in every browser. */
function hash(text: string): number {
  let value = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    value ^= text.charCodeAt(index);
    value = Math.imul(value, 16777619);
  }
  return value >>> 0;
}
