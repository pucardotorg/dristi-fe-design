/**
 * Who enters the next hearing's date and purpose (owner, 2026-10-15) — a court setting:
 *
 * - **Reader:** the reader sets it on the cause list (the Next hearing column, which only
 *   that seat can add), and the steno sees it on order screen E, disabled.
 * - **Steno:** the steno fills it in order screen E, as before, and the cause list offers
 *   no Next hearing column.
 *
 * Pending orders flow only: Classic's screens (A–D) always take it in the order.
 *
 * A per-browser preference, modelled on `order-flow.ts`: an in-memory value, restored
 * from `localStorage` once and lazily, safe to import from the server render.
 */

const KEY = "dristi.next-hearing-entry";

export type NextHearingEntry = "reader" | "steno";

/** With nothing stored, the reader (the owner's ask that started this). */
export const DEFAULT_NEXT_HEARING_ENTRY: NextHearingEntry = "reader";

export const NEXT_HEARING_ENTRY_OPTIONS: readonly {
  id: NextHearingEntry;
  label: string;
}[] = [
  { id: "reader", label: "Reader, on the cause list" },
  { id: "steno", label: "Steno, in the order" },
];

function isEntry(value: string | null): value is NextHearingEntry {
  return value === "reader" || value === "steno";
}

let entry: NextHearingEntry = DEFAULT_NEXT_HEARING_ENTRY;
let restored = false;
const listeners = new Set<() => void>();

function restore(): void {
  if (restored || typeof window === "undefined") return;
  restored = true;
  try {
    const stored = window.localStorage.getItem(KEY);
    if (isEntry(stored)) entry = stored;
  } catch {
    // Private mode or a cleared quota. The default stands.
  }
}

export function subscribeToNextHearingEntry(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function readNextHearingEntry(): NextHearingEntry {
  restore();
  return entry;
}

/** What the server rendered, and what hydration must agree with. Always the default. */
export function serverNextHearingEntry(): NextHearingEntry {
  return DEFAULT_NEXT_HEARING_ENTRY;
}

export function setNextHearingEntry(next: NextHearingEntry): void {
  if (readNextHearingEntry() === next) return;
  entry = next;
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(KEY, next);
    } catch {
      // Blocked storage loses persistence, not the switch — listeners still fire.
    }
  }
  for (const listener of listeners) listener();
}
