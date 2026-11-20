/**
 * Match values' suggestions: for a word in the filer's file that a court list does not
 * have ("A/C CLOSED"), the list option it most plainly reads as ("Account closed").
 *
 * Plain text comparison only, no AI and no guessing at meaning: both sides are lower-cased,
 * stripped of punctuation, common bank abbreviations are spelled out (A/C → account,
 * INSUFF → insufficient, REGD → registered), and their words compared. A suggestion is
 * offered only when one option is clearly closest; the filer confirms it, it is never
 * applied unseen (BLK-33: the filer chooses, we do not guess).
 */

import { LISTS, type ListName } from "./excel-spec";

/** Abbreviations a recovery team's export commonly writes, spelled out. */
const SPELLED: Record<string, string> = {
  ac: "account",
  acct: "account",
  insuf: "insufficient",
  insuff: "insufficient",
  insufft: "insufficient",
  regd: "registered",
  reg: "registered",
  pmt: "payment",
  pymt: "payment",
  stpd: "stopped",
  sig: "signature",
  sign: "signature",
  amt: "amount",
  chq: "cheque",
  check: "cheque",
  pvt: "private",
  ltd: "limited",
  co: "company",
  y: "yes",
  n: "no",
  indiv: "individual",
  ind: "individual",
  mismatch: "differs",
  differ: "differs",
  different: "differs",
};

/** Words that carry no meaning of their own here. "No" is not one: it is an answer. */
const FILLER = new Set(["a", "an", "the", "by", "of", "to", "and", "or", "in", "for", "on", "at", "with"]);

/** The words of a value, compared: lower case, punctuation gone, abbreviations spelled out. */
export function wordsOf(s: string): string[] {
  const out: string[] = [];
  const text = s
    .toLowerCase()
    .replace(/'s\b/g, "")
    // A/C, A/D: single letters split by a slash are one abbreviation.
    .replace(/\b([a-z])\s*\/\s*([a-z])\b/g, "$1$2")
    // E-mail: a single letter hyphenated to a word is one word.
    .replace(/\b([a-z])-(?=[a-z])/g, "$1");
  for (const raw of text.split(/[^a-z0-9]+/)) {
    if (!raw || /^\d+$/.test(raw)) continue;
    const w = SPELLED[raw] ?? raw;
    if (!FILLER.has(w)) out.push(w);
  }
  return out;
}

/** The initials of a value's raw words ("Regd. Post A/D" → "rpad"), for an acronym in an option. */
function initialsOf(s: string): string {
  return s
    .toLowerCase()
    .split(/[^a-z]+/)
    .filter(Boolean)
    .map((w) => w[0])
    .join("");
}

/** One word reads as another: equal, or one a 4+ letter start of the other ("insuff", "stop"). */
function same(a: string, b: string): boolean {
  if (a === b) return true;
  const [short, long] = a.length <= b.length ? [a, b] : [b, a];
  return short.length >= 4 && long.startsWith(short);
}

/**
 * How closely a file's word reads as an option, 0 to 1: the share of words the two have
 * in common (Dice). An option that contains every word of the file's (and only adds
 * detail, "PAYMENT STOPPED" → "Payment stopped by drawer") counts at least 0.6, and an
 * option carrying the file's initials as a word ("Regd Post A/D" → "(RPAD)") at least 0.8.
 */
export function closeness(word: string, option: string): number {
  const a = wordsOf(word);
  const b = wordsOf(option);
  if (!a.length || !b.length) return 0;
  const used = new Set<number>();
  let shared = 0;
  for (const x of a) {
    const j = b.findIndex((y, k) => !used.has(k) && same(x, y));
    if (j >= 0) {
      used.add(j);
      shared++;
    }
  }
  let score = (2 * shared) / (a.length + b.length);
  if (shared === a.length) score = Math.max(score, 0.6);
  const initials = initialsOf(word);
  if (initials.length >= 3 && b.includes(initials)) score = Math.max(score, 0.8);
  return Math.round(score * 100) / 100;
}

/** Below this an option is not offered at all. */
export const SUGGEST_AT = 0.5;
/** The best must lead the next by this much, or two options are equally likely and none is offered. */
const LEAD = 0.15;

export type Suggestion = { value: string; label: string; score: number };

/** The court's option a file's word most plainly reads as, or null when none clearly does. */
export function suggestOption(list: ListName, word: string): Suggestion | null {
  const ranked = LISTS[list]
    .map((o) => ({ value: o.value, label: o.label, score: closeness(word, o.label) }))
    .sort((x, y) => y.score - x.score);
  const [best, next] = ranked;
  if (!best || best.score < SUGGEST_AT) return null;
  if (next && best.score - next.score < LEAD) return null;
  return best;
}
