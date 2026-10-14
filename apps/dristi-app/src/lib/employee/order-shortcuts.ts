/**
 * Typing shortcuts for the full-page order editor (owner, 2026-10-14): type `/` and a
 * shortcut's name, press Tab, and its text takes the place of what was typed.
 *
 * Deliberately plain — a name and the text it stands for, nothing more. No variables, no
 * blanks, no workflow: a shortcut saves typing and says nothing the typist did not
 * choose. The order items with workflows stay the catalogue's (`order-templates.ts`).
 *
 * It opens on the catalogue's own order items that carry no variables, worded as the
 * catalogue words them. Shortcuts added, changed or removed are kept in this browser
 * (`localStorage`) — per person and per device, not shared with the court, and lost with
 * the browser's site data. A shared, court-wide list is the backend's to hold.
 */

import { ORDER_TEMPLATES } from "./order-templates";

export type OrderShortcut = { id: string; name: string; text: string };

const KEY = "dristi.order-shortcuts";

/** The catalogue's variable-free order items, as the shortcuts a browser starts on. */
export const SAMPLE_SHORTCUTS: readonly OrderShortcut[] = Object.freeze(
  ORDER_TEMPLATES.filter(
    (template) => template.botd && !template.botd.includes("["),
  ).map((template) => ({
    id: `sample-${template.id}`,
    name: template.label,
    text: template.botd,
  })),
);

let shortcuts: readonly OrderShortcut[] = SAMPLE_SHORTCUTS;
let restored = false;
const listeners = new Set<() => void>();

function isShortcutList(value: unknown): value is OrderShortcut[] {
  return (
    Array.isArray(value) &&
    value.every(
      (entry) =>
        entry &&
        typeof entry.id === "string" &&
        typeof entry.name === "string" &&
        typeof entry.text === "string",
    )
  );
}

function restore(): void {
  if (restored || typeof window === "undefined") return;
  restored = true;
  try {
    const stored = JSON.parse(window.localStorage.getItem(KEY) ?? "null");
    if (isShortcutList(stored)) shortcuts = stored;
  } catch {
    // Private mode, cleared storage or a damaged value. The samples stand.
  }
}

function write(next: readonly OrderShortcut[]): void {
  shortcuts = next;
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(KEY, JSON.stringify(next));
    } catch {
      // Blocked storage loses persistence, not the change — listeners still fire.
    }
  }
  for (const listener of listeners) listener();
}

export function subscribeToOrderShortcuts(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function readOrderShortcuts(): readonly OrderShortcut[] {
  restore();
  return shortcuts;
}

/** What the server rendered, and what hydration must agree with. */
export function serverOrderShortcuts(): readonly OrderShortcut[] {
  return SAMPLE_SHORTCUTS;
}

export function addOrderShortcut(name: string, text: string): void {
  const id = `shortcut-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
  write([...readOrderShortcuts(), { id, name: name.trim(), text: text.trim() }]);
}

export function updateOrderShortcut(
  id: string,
  change: { name: string; text: string },
): void {
  write(
    readOrderShortcuts().map((entry) =>
      entry.id === id
        ? { ...entry, name: change.name.trim(), text: change.text.trim() }
        : entry,
    ),
  );
}

export function removeOrderShortcut(id: string): void {
  write(readOrderShortcuts().filter((entry) => entry.id !== id));
}

/** A name already taken by another shortcut, ignoring case — two would shadow each other. */
export function shortcutNameTaken(
  list: readonly OrderShortcut[],
  name: string,
  except?: string,
): boolean {
  const wanted = name.trim().toLowerCase();
  return list.some(
    (entry) => entry.id !== except && entry.name.trim().toLowerCase() === wanted,
  );
}

/**
 * The shortcuts a `/` query names, best first: a name that starts with it, then one with
 * a word that starts with it, then one that merely contains it.
 */
export function matchOrderShortcuts(
  list: readonly OrderShortcut[],
  query: string,
): OrderShortcut[] {
  const wanted = query.trim().toLowerCase();
  if (!wanted) return [];
  const rank = (name: string) => {
    const lower = name.toLowerCase();
    if (lower.startsWith(wanted)) return 0;
    if (lower.split(/\s+/).some((word) => word.startsWith(wanted))) return 1;
    if (lower.includes(wanted)) return 2;
    return 3;
  };
  return list
    .map((entry) => ({ entry, rank: rank(entry.name) }))
    .filter((match) => match.rank < 3)
    .sort((a, b) => a.rank - b.rank)
    .map((match) => match.entry);
}
