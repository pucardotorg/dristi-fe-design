/**
 * Formats for "Any additional details", set up on Configurations the way the magistrate's
 * order templates are, and offered to the filer as a starting text.
 *
 * A format is formatted text with `[variables]` in it. Each variable is **mapped** to an
 * e-filing field (`detail-fields.ts`), or left for the filer to write. A variable named
 * after a field maps to it without being told; a mapping set on Configurations wins over
 * the name. When the filer starts from a format, every mapped variable is written into
 * their text as its field (`[Drawer]` mapped to Accused Name becomes `[Accused Name]`),
 * so the filing side only ever deals in field names, and the rest stay blanks to write.
 *
 * Formats are kept in this browser (`localStorage`), like the order shortcuts — not
 * shared with the court, and lost with the browser's site data. A shared list is the
 * backend's to hold (MDMS, as for order templates).
 */

import { DETAILS_FORMAT, detailField, type DetailField } from "./detail-fields";

/** The mapping that says: no field — the filer writes this one. */
export const FILER_WRITES = "__filer";

export type DetailsFormat = {
  id: string;
  name: string;
  html: string;
  /** Variable name → field name, or `FILER_WRITES`. Absent: matched by name. */
  mappings: Record<string, string>;
};

export const DEFAULT_FORMATS: readonly DetailsFormat[] = Object.freeze([
  { id: "s138-facts", name: "§138 facts of the case", html: DETAILS_FORMAT, mappings: {} },
]);

/** The field a variable stands for in this format; undefined when the filer writes it. */
export function mappedField(format: DetailsFormat, variable: string): DetailField | undefined {
  const mapping = format.mappings[variable];
  if (mapping === FILER_WRITES) return undefined;
  if (mapping) return detailField(mapping);
  return detailField(variable);
}

/** Whether the variable's mapping was set by hand rather than matched by its name. */
export function mappedByHand(format: DetailsFormat, variable: string): boolean {
  return variable in format.mappings;
}

/** The format as the filer's starting text: mapped variables become their fields. */
export function formatForFiler(format: DetailsFormat): string {
  return format.html.replace(/(^|>)([^<]*)/g, (_, open: string, text: string) =>
    open +
    text.replace(/\[([^\]\n]+)\]/g, (whole, name: string) => {
      const field = mappedField(format, name);
      return field ? `[${field.name}]` : whole;
    }),
  );
}

/* ───────────────────────────── Store ───────────────────────────────── */

const KEY = "dristi.filing.details-formats";

let formats: readonly DetailsFormat[] = DEFAULT_FORMATS;
let restored = false;
const listeners = new Set<() => void>();

function isFormatList(value: unknown): value is DetailsFormat[] {
  return (
    Array.isArray(value) &&
    value.every(
      (f) =>
        f &&
        typeof f.id === "string" &&
        typeof f.name === "string" &&
        typeof f.html === "string" &&
        f.mappings &&
        typeof f.mappings === "object",
    )
  );
}

function restore(): void {
  if (restored || typeof window === "undefined") return;
  restored = true;
  try {
    const stored = JSON.parse(window.localStorage.getItem(KEY) ?? "null");
    if (isFormatList(stored)) formats = stored;
  } catch {
    // Private mode, cleared storage or a damaged value. The defaults stand.
  }
}

function write(next: readonly DetailsFormat[]): void {
  formats = next;
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(KEY, JSON.stringify(next));
    } catch {
      // Blocked storage loses persistence, not the change — listeners still fire.
    }
  }
  for (const listener of listeners) listener();
}

export function subscribeToDetailsFormats(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function readDetailsFormats(): readonly DetailsFormat[] {
  restore();
  return formats;
}

/** What the server rendered, and what hydration must agree with. */
export function serverDetailsFormats(): readonly DetailsFormat[] {
  return DEFAULT_FORMATS;
}

export function saveDetailsFormat(format: DetailsFormat): void {
  const list = readDetailsFormats();
  write(
    list.some((f) => f.id === format.id)
      ? list.map((f) => (f.id === format.id ? format : f))
      : [...list, format],
  );
}

export function removeDetailsFormat(id: string): void {
  write(readDetailsFormats().filter((f) => f.id !== id));
}

export function newFormatId(): string {
  return `format-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}
