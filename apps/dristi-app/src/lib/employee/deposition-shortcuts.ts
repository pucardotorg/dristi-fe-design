/**
 * Typing shortcuts for recording oral evidence — the order screen's shortcuts, put to
 * questions (Anshumanth, 2026-10-26: "Instead of [Add Questions] in the new order screen,
 * you will see an option for shortcuts. Let's leverage that same functionality to let them
 * insert questions"). Type `/` and a shortcut's name, press Tab, and its text takes the
 * place of what was typed. A `[…]` in the text is a blank the field selects on insert.
 *
 * The same shape and rules as `lib/employee/order-shortcuts.ts`, kept as its own list so
 * the questions do not turn up while an order is typed, nor orders in a deposition. Kept
 * in this browser (`localStorage`), per person and per device, as the order list is.
 *
 * The samples are DRISTI 1.0's six question sets for the examination of an accused in a
 * cheque case — evidence, the cheque (Ext. P1), the dishonour (Ext. P2), the notice and
 * postal records (Exts. P3 to P5), non-payment under Section 138, and the closing
 * questions — and a handful of cross-examination questions. Sample wording, not the
 * court's: a court replaces it with its own.
 */

export type DepositionShortcut = {
  id: string;
  name: string;
  /** The words, plain — what the list shows. */
  text: string;
  /** The words as formatted: a question and its answer are paragraphs of their own. */
  html: string;
};

const KEY = "dristi.deposition-shortcuts";

/**
 * A question and its answer are one paragraph, the answer on its own line: the field
 * selects the first blank in the first paragraph a shortcut puts in, so the answer's
 * `[answer]` has to be in it.
 */
function qa(question: string): string {
  return `<p><strong>Q:</strong> ${question}<br><strong>A:</strong> [answer]</p>`;
}

function sample(id: string, name: string, html: string): DepositionShortcut {
  return { id: `sample-${id}`, name, text: plainText(html), html };
}

/**
 * The examination's question sets start "Accused:", so `/acc` lists them all. Not "351":
 * the field never completes a slash followed by a digit, so that case numbers and
 * section references do not set it off (`lib/rich-text/ghost.ts`).
 */
export const SAMPLE_DEPOSITION_SHORTCUTS: readonly DepositionShortcut[] = Object.freeze([
  sample(
    "chief-affidavit",
    "Chief affidavit read as evidence",
    "<p>The chief affidavit of the witness, filed on [date], is read as part of this deposition. Exts. [P1 to P6] are marked through the witness.</p>"
  ),
  sample(
    "cross-security",
    "Cross: cheque given as security",
    qa(
      "It is suggested that cheque No. [cheque number] was given only as a blank security when the dealings began, and not to repay any debt. What do you say?"
    )
  ),
  sample(
    "cross-source",
    "Cross: source of the money",
    qa("From where did you raise the amount you say was due from the accused?") +
      qa("Is the amount shown in your income-tax returns?")
  ),
  sample(
    "cross-notice",
    "Cross: notice not received",
    qa("The accused says the demand notice never reached them. What do you say?")
  ),
  sample(
    "cross-records",
    "Cross: evidence from records only",
    qa("You were not present when the cheque was presented for collection?") +
      qa("Your evidence is only from the records of the bank?")
  ),
  sample(
    "cross-deferred",
    "Cross-examination deferred",
    "<p>Cross-examination deferred to the next hearing at the request of counsel for the accused.</p>"
  ),
  sample(
    "351-evidence",
    "Accused: understanding of the evidence",
    qa(
      "You heard the evidence of [PW-1 to PW-2] and saw Exts. [P1 to P6] marked. Did you understand the evidence against you?"
    )
  ),
  sample(
    "351-cheque",
    "Accused: cheque (Ext. P1)",
    qa(
      "PW-1 said that you issued Ext. P1, cheque No. [cheque number] for Rs. [amount], to repay the amount due to the complainant. What do you say?"
    ) + qa("Is the signature on Ext. P1 yours?")
  ),
  sample(
    "351-dishonour",
    "Accused: dishonour (Ext. P2)",
    qa(
      "It is in evidence that Ext. P1 was returned unpaid for want of funds, as the return memo Ext. P2 shows. What do you say?"
    )
  ),
  sample(
    "351-notice",
    "Accused: notice and postal records (Exts. P3 to P5)",
    qa(
      "PW-1 said the demand notice Ext. P3 was sent to you and reached you, as Exts. P4 and P5 show. What do you say?"
    )
  ),
  sample(
    "351-non-payment",
    "Accused: non-payment and Section 138",
    qa(
      "PW-1 said you did not pay the amount within fifteen days of receiving the notice. What do you say?"
    )
  ),
  sample(
    "351-closing",
    "Accused: additional statement",
    qa("Is there anything more you want to say?") +
      qa("Do you want to give evidence in your defence?")
  ),
]);

/** The words of some markup, one space between blocks — for the list and for search. */
export function plainText(html: string): string {
  return html
    .replace(/<\/(p|div|li|tr)>/gi, " ")
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * A question typed as "Q: …" and its answer as "A: …" become the paragraphs the samples
 * are, with the marker in bold; an answer left empty becomes a blank to fill.
 */
export function shapeQuestions(html: string): string {
  return html
    .replace(
      /<(p|div)>\s*([QA]):\s*([\s\S]*?)<\/\1>/g,
      (_whole, _tag: string, marker: string, rest: string) => {
        const body = rest.replace(/<br\s*\/?>\s*$/i, "").trim();
        return `<p><strong>${marker}:</strong> ${body || (marker === "A" ? "[answer]" : "")}</p>`;
      }
    )
    .replace(/<\/p>\s*<p><strong>A:<\/strong>/g, "<br><strong>A:</strong>");
}

let shortcuts: readonly DepositionShortcut[] = SAMPLE_DEPOSITION_SHORTCUTS;
let restored = false;
const listeners = new Set<() => void>();

function isShortcutList(value: unknown): value is DepositionShortcut[] {
  return (
    Array.isArray(value) &&
    value.every(
      (entry) =>
        entry &&
        typeof entry.id === "string" &&
        typeof entry.name === "string" &&
        typeof entry.text === "string" &&
        typeof entry.html === "string"
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

function write(next: readonly DepositionShortcut[]): void {
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

export function subscribeToDepositionShortcuts(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function readDepositionShortcuts(): readonly DepositionShortcut[] {
  restore();
  return shortcuts;
}

/** What the server rendered, and what hydration must agree with. */
export function serverDepositionShortcuts(): readonly DepositionShortcut[] {
  return SAMPLE_DEPOSITION_SHORTCUTS;
}

export function addDepositionShortcut(name: string, html: string): void {
  const id = `shortcut-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
  const shaped = shapeQuestions(html.trim());
  write([
    ...readDepositionShortcuts(),
    { id, name: name.trim(), text: plainText(shaped), html: shaped },
  ]);
}

export function updateDepositionShortcut(id: string, name: string, html: string): void {
  const shaped = shapeQuestions(html.trim());
  write(
    readDepositionShortcuts().map((entry) =>
      entry.id === id
        ? { ...entry, name: name.trim(), text: plainText(shaped), html: shaped }
        : entry
    )
  );
}

export function removeDepositionShortcut(id: string): void {
  write(readDepositionShortcuts().filter((entry) => entry.id !== id));
}

/** A name already taken by another shortcut, ignoring case — two would shadow each other. */
export function depositionShortcutNameTaken(
  list: readonly DepositionShortcut[],
  name: string,
  except?: string
): boolean {
  const wanted = name.trim().toLowerCase();
  return list.some(
    (entry) => entry.id !== except && entry.name.trim().toLowerCase() === wanted
  );
}

/** The examination's own question sets: the questions put to the accused. */
export function isExaminationShortcut(entry: DepositionShortcut): boolean {
  return /^Accused:/i.test(entry.name);
}

/**
 * The shortcuts a `/` query names, best first — the order screen's ranking (a name that
 * starts with it, then a word that does, then anywhere) — and, within a rank, the ones
 * for what is being recorded: the questions for the accused in an examination, the rest
 * in a deposition.
 */
export function matchDepositionShortcuts(
  list: readonly DepositionShortcut[],
  query: string,
  kind: "deposition" | "examination"
): DepositionShortcut[] {
  const wanted = query.trim().toLowerCase();
  if (!wanted) return [];
  const rank = (name: string) => {
    const lower = name.toLowerCase();
    if (lower.startsWith(wanted)) return 0;
    if (lower.split(/\s+/).some((word) => word.startsWith(wanted))) return 1;
    if (lower.includes(wanted)) return 2;
    return 3;
  };
  const fits = (entry: DepositionShortcut) =>
    isExaminationShortcut(entry) === (kind === "examination") ? 0 : 1;
  return list
    .map((entry) => ({ entry, rank: rank(entry.name) }))
    .filter((match) => match.rank < 3)
    .sort((a, b) => a.rank - b.rank || fits(a.entry) - fits(b.entry))
    .map((match) => match.entry);
}
