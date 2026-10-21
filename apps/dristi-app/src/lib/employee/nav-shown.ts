/**
 * Which of the rail's optional tabs show — a per-browser preference, from Court settings.
 *
 * Every Sign row, and the three rows at the rail's foot (Schedule hearing, Bulk
 * reschedule hearings, Configurations), can be hidden. By default only Sign process,
 * Sign A-Diary and Schedule hearing show; the rest are hidden but not removed, and come
 * back from the "Tabs to show" dropdown (owner, 2026-10-21). Every other rail row is not
 * optional and always shows.
 *
 * Hidden is a rail rule, not a permission: the screens stay reachable by URL and search.
 *
 * Modelled on `nav-layout.ts`: an in-memory value, restored from `localStorage` once and
 * lazily on the client. Read it through `components/employee/use-court-nav-shown.ts`, so
 * the server's first paint and hydration agree on the default.
 */

const KEY = "dristi.court-nav-shown";

/** The rows that can be hidden, in rail order, with the label the dropdown shows. */
export const OPTIONAL_COURT_NAV_ROWS: readonly { id: string; label: string }[] = [
  { id: "sign-forms", label: "Sign forms" },
  { id: "sign-orders", label: "Sign orders" },
  { id: "sign-process", label: "Sign process" },
  { id: "sign-bail-bonds", label: "Sign bail bonds" },
  { id: "sign-deposition", label: "Sign witness deposition" },
  { id: "sign-evidence", label: "Sign evidence" },
  { id: "sign-a-diary", label: "Sign A-Diary" },
  { id: "schedule-hearing", label: "Schedule hearing" },
  { id: "bulk-reschedule", label: "Bulk reschedule hearings" },
  { id: "configurations", label: "Configurations" },
];

const OPTIONAL_IDS = new Set(OPTIONAL_COURT_NAV_ROWS.map((row) => row.id));

export const DEFAULT_COURT_NAV_SHOWN: readonly string[] = [
  "sign-process",
  "sign-a-diary",
  "schedule-hearing",
];

let shown: readonly string[] = DEFAULT_COURT_NAV_SHOWN;
let restored = false;
const listeners = new Set<() => void>();

function restore(): void {
  if (restored || typeof window === "undefined") return;
  restored = true;
  try {
    const stored = window.localStorage.getItem(KEY);
    if (stored === null) return;
    const parsed: unknown = JSON.parse(stored);
    if (Array.isArray(parsed)) {
      shown = parsed.filter(
        (id): id is string => typeof id === "string" && OPTIONAL_IDS.has(id),
      );
    }
  } catch {
    // Private mode, a cleared quota or a malformed value. The default stands.
  }
}

export function subscribeToCourtNavShown(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** The live list. Safe as a `useSyncExternalStore` snapshot — replaced, never mutated. */
export function readCourtNavShown(): readonly string[] {
  restore();
  return shown;
}

/** What the server rendered, and what hydration must agree with. Always the default. */
export function serverCourtNavShown(): readonly string[] {
  return DEFAULT_COURT_NAV_SHOWN;
}

export function setCourtNavShown(next: readonly string[]): void {
  restore();
  shown = OPTIONAL_COURT_NAV_ROWS.map((row) => row.id).filter((id) => next.includes(id));
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(KEY, JSON.stringify(shown));
    } catch {
      // Blocked storage loses persistence, not the switch — listeners still fire.
    }
  }
  for (const listener of listeners) listener();
}

/** Whether the rail shows this row: always for a row that is not optional. */
export function courtNavRowShown(id: string, shownIds: readonly string[]): boolean {
  return !OPTIONAL_IDS.has(id) || shownIds.includes(id);
}
