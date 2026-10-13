/**
 * Whether a court-side filter form is asking for something narrower than a given baseline.
 *
 * This used to answer "has the Search button anything to do?", when every queue held the
 * controls in a `draft` and the table showed a separately `applied` copy. Those buttons
 * are gone — the queues filter as they are typed, from one state — and with them went
 * eleven of the twelve callers.
 *
 * What is left is the other question the same comparison answers, and the one worth
 * keeping: **is this view filtered at all?** A screen needs it to tell "nothing matches
 * what you asked for" apart from "there is nothing here", and `SignProcessScreen` needs it
 * against a per-tab default rather than against empty. Comparing to a baseline is still a
 * question with one right answer, so it still lives here rather than being re-derived.
 */

import { caseSearchKey } from "@/lib/court/localize";

/** A filter object as these screens hold one: flat, and only ever text. */
type FilterShape = Record<string, string | null>;

/**
 * Whether `draft` is asking for something `applied` is not already showing.
 *
 * Compared field by field, with each value settled first: `null` and `""` are both "not
 * asked for", and a query is trimmed the way every one of these filters trims it before
 * matching — trailing space is not a search the bench meant to run.
 *
 * **Resolve defaulted fields before calling.** Where `null` means something other than
 * empty — "the day the court is sitting", on the screens that carry a date — an untouched
 * field and a deliberately picked today are the same request, and only the screen knows
 * that. Those screens pass resolved objects in (`resolveRange`, `resolveADiaryDay`).
 */
export function isPendingFilterChange<T extends FilterShape>(
  draft: T,
  applied: T,
): boolean {
  return Object.keys(draft).some(
    (key) => settled(draft[key]) !== settled(applied[key]),
  );
}

function settled(value: string | null | undefined): string {
  return value?.trim() ?? "";
}

/**
 * Whether a row's own words answer what was typed into a court-side search box.
 *
 * Shared for the same reason `isPendingFilterChange` is: every queue on the court side
 * offers one free-text box over a case, and a box that behaves differently on each screen
 * is a box the bench cannot learn.
 *
 * **Every token has to land, in any order and any amount of space.** The reference labels
 * these boxes "Case Name or Number", so the first thing a clerk does is read a name off
 * the Case name column and type it back — and a column prints a *cause title*,
 * "Girija Damodaran v. Sabu Chacko", which no single stored field contains. Matching one
 * contiguous substring against the parties separately therefore fails the most obvious
 * query on the screen, and so does a stray double space. Splitting the query and asking
 * that each part appear somewhere in the row fixes both, and costs nothing a clerk has to
 * know about.
 *
 * Pass the row's words as they are *shown* — the cause title, not the two parties — so
 * what is on screen is what can be found.
 */
export function matchesQuery(
  query: string,
  ...parts: (string | undefined)[]
): boolean {
  const tokens = caseSearchKey(query).split(/\s+/).filter(Boolean);
  // An empty box is not a filter; it asks for everything.
  if (tokens.length === 0) return true;
  const haystack = parts.filter(Boolean).join(" ").toLowerCase();
  return tokens.every((token) => haystack.includes(token));
}
