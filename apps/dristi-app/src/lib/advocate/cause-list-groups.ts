import type { CauseListRow } from "./home";

export type CauseListGroupBy = "item" | "court" | "hearingType" | "status";

/** The cause list reads four statuses: ongoing, listed, passed over (called but
 *  not taken up, so still owed its hearing today) and completed. A matter carried
 *  over from an earlier day is simply listed; only one passed over on this day
 *  forms the passed-over group. */
export type CauseStatusKey = "now" | "upcoming" | "passed-over" | "completed";
export function causeStatusKey(row: CauseListRow): CauseStatusKey {
  if (row.status === "now") return "now";
  if (row.passedOver && !row.passedOverOn) return "passed-over";
  if (row.status === "upcoming") return "upcoming";
  return "completed";
}

/** Status groups read most-active first: ongoing, listed, then passed-over ahead
 *  of completed (a passed-over matter is the one still owed a hearing). */
const STATUS_ORDER: Record<CauseStatusKey, number> = {
  now: 0,
  upcoming: 1,
  "passed-over": 2,
  completed: 3,
};

/** Group only the current filtered scope; numeric item ordering works beyond 9.
 * "court" groups by the court itself — one cause list per court, so SARAS Court 1
 * and SARAS Court 2 are two groups though they share a name; "status" by the
 * four-way cause-list status. */
export function groupCauseList(rows: readonly CauseListRow[], by: CauseListGroupBy, locale = "en-IN") {
  const grouped = new Map<string, CauseListRow[]>();
  const keyOf = (row: CauseListRow) =>
    by === "court" ? row.court : by === "status" ? causeStatusKey(row) : String(row[by]);
  const compareCourt = (a: CauseListRow, b: CauseListRow) =>
    a.courtLabel.localeCompare(b.courtLabel, locale, { numeric: true }) ||
    a.court.localeCompare(b.court, locale, { numeric: true });
  const compareStatus = (a: CauseListRow, b: CauseListRow) =>
    (STATUS_ORDER[causeStatusKey(a)] ?? 9) - (STATUS_ORDER[causeStatusKey(b)] ?? 9);
  const primary = (a: CauseListRow, b: CauseListRow) =>
    by === "item" ? a.item - b.item :
    by === "court" ? compareCourt(a, b) :
    by === "status" ? compareStatus(a, b) :
    a.hearingType.localeCompare(b.hearingType, locale);
  const sorted = [...rows].sort((a, b) =>
    primary(a, b) || a.item - b.item || compareCourt(a, b) || a.id.localeCompare(b.id)
  );
  for (const row of sorted) {
    const key = keyOf(row);
    const items = grouped.get(key) ?? [];
    items.push(row);
    grouped.set(key, items);
  }
  return [...grouped].map(([key, items]) => ({ key, rows: items }));
}

export function searchCauseList(rows: readonly CauseListRow[], query: string) {
  const q = query.trim().toLocaleLowerCase();
  if (!q) return [...rows];
  return rows.filter((row) =>
    [row.parties, row.caseNumber, row.advocates, row.courtLabel, String(row.courtNumber ?? ""), row.hearingType]
      .some((value) => value.toLocaleLowerCase().includes(q)) || String(row.item) === q
  );
}
