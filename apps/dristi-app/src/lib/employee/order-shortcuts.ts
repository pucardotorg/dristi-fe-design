/**
 * Typing shortcuts for the full-page order editor (owner, 2026-10-14): type `/` and a
 * shortcut's name, press Tab, and its text takes the place of what was typed.
 *
 * A name and the text it stands for — no workflow: a shortcut saves typing and says
 * nothing the typist did not choose. The order items with workflows stay the catalogue's
 * (`order-templates.ts`).
 *
 * **The text is formatted** (owner, 2026-10-16: "a much larger rich text field where I
 * can format text"): paragraphs, bold, lists. `html` carries the formatting, `text` the
 * same words plain for the list and the search. A one-line shortcut with no formatting
 * still lands inline, in the sentence being typed; anything else lands as its own
 * paragraphs. A `[…]` in the text is a blank the editor selects on insert, so the
 * typist types straight over it.
 *
 * It opens on the catalogue's own order items that carry no variables, worded as the
 * catalogue words them, and a set of longer orders modelled on §138 order sheets (see
 * `order-shortcut-samples.ts`). Shortcuts added, changed or removed are kept in this browser
 * (`localStorage`) — per person and per device, not shared with the court, and lost with
 * the browser's site data. A shared, court-wide list is the backend's to hold.
 */

import { FORMATTED_SAMPLE_SHORTCUTS } from "./order-shortcut-samples";
import { ORDER_TEMPLATES } from "./order-templates";

export type OrderShortcut = {
  id: string;
  name: string;
  /** The words, plain — what the list shows and what a one-line shortcut types. */
  text: string;
  /** The words as formatted. Absent on a shortcut saved before shortcuts had formatting. */
  html?: string;
};

const KEY = "dristi.order-shortcuts";
/** Sample ids this browser has already been given, so a removed sample stays removed. */
const SEEN_KEY = "dristi.order-shortcuts.samples-seen";

/** The catalogue's variable-free order items. */
const CATALOGUE_SHORTCUTS: readonly OrderShortcut[] = ORDER_TEMPLATES.filter(
  (template) => template.botd && !template.botd.includes("["),
).map((template) => ({
  id: `sample-${template.id}`,
  name: template.label,
  text: template.botd,
}));

/** The shortcuts a browser starts on: the catalogue's one-liners, then the longer orders. */
export const SAMPLE_SHORTCUTS: readonly OrderShortcut[] = Object.freeze([
  ...CATALOGUE_SHORTCUTS,
  ...FORMATTED_SAMPLE_SHORTCUTS,
]);

/**
 * What a shortcut puts in the order: one plain line goes in as text, at the caret;
 * anything with paragraphs or formatting goes in as its own blocks.
 */
export function shortcutInsertion(
  entry: OrderShortcut,
): { kind: "inline"; text: string } | { kind: "block"; html: string } {
  if (entry.html && isFormatted(entry.html)) {
    return { kind: "block", html: leadInParagraph(entry.html) };
  }
  return { kind: "inline", text: entry.text };
}

/**
 * The words typed on a shortcut's first line, before any paragraph or list, sit bare in
 * the editor's markup. Put in an order as they are, they run on from the paragraph above
 * with no gap; wrapped, they are a paragraph like the rest.
 */
export function leadInParagraph(html: string): string {
  const block = /<(p|div|ul|ol|table|h[1-6]|blockquote)[\s>]/i.exec(html);
  const cut = block ? block.index : html.length;
  const lead = html.slice(0, cut);
  if (!lead.replace(/<br\s*\/?>/gi, "").trim()) return html.slice(cut) || html;
  return `<p>${lead.replace(/(<br\s*\/?>)+$/i, "")}</p>${html.slice(cut)}`;
}

/**
 * Markup that is more than one plain line. The editor wraps even a plain line in a
 * `<div>` or ends it with a `<br>` now and then, so those alone do not count.
 */
export function isFormatted(html: string): boolean {
  const bare = html
    .trim()
    .replace(/^<(div|p)>/i, "")
    .replace(/<\/(div|p)>$/i, "")
    .replace(/<br\s*\/?>$/i, "");
  return /<[a-z]/i.test(bare);
}

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
        typeof entry.text === "string" &&
        (entry.html === undefined || typeof entry.html === "string"),
    )
  );
}

function restore(): void {
  if (restored || typeof window === "undefined") return;
  restored = true;
  try {
    const stored = JSON.parse(window.localStorage.getItem(KEY) ?? "null");
    if (isShortcutList(stored)) {
      /* Samples added since this browser saved its list join the end of it, once — a
         browser that saved before the longer orders existed would otherwise never see
         them. A sample it was given and removed is not given back. */
      const seenStored = JSON.parse(
        window.localStorage.getItem(SEEN_KEY) ?? "null",
      );
      const seen = new Set<string>(
        Array.isArray(seenStored)
          ? seenStored
          : CATALOGUE_SHORTCUTS.map((entry) => entry.id),
      );
      const held = new Set(stored.map((entry) => entry.id));
      shortcuts = [
        ...stored,
        ...SAMPLE_SHORTCUTS.filter(
          (entry) => !seen.has(entry.id) && !held.has(entry.id),
        ),
      ];
    }
    window.localStorage.setItem(
      SEEN_KEY,
      JSON.stringify(SAMPLE_SHORTCUTS.map((entry) => entry.id)),
    );
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

export function addOrderShortcut(
  name: string,
  body: { text: string; html: string },
): void {
  const id = `shortcut-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
  write([
    ...readOrderShortcuts(),
    { id, name: name.trim(), text: body.text.trim(), html: body.html.trim() },
  ]);
}

export function updateOrderShortcut(
  id: string,
  change: { name: string; text: string; html: string },
): void {
  write(
    readOrderShortcuts().map((entry) =>
      entry.id === id
        ? {
            ...entry,
            name: change.name.trim(),
            text: change.text.trim(),
            html: change.html.trim(),
          }
        : entry,
    ),
  );
}

/** The markup a shortcut opens with in the editor — its own, or its plain text escaped. */
export function shortcutHtml(entry: OrderShortcut): string {
  if (entry.html) return entry.html;
  return entry.text
    .split("\n")
    .map((line) =>
      line.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"),
    )
    .join("<br>");
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
