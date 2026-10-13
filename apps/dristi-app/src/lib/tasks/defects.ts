/**
 * Whether a scrutiny defect has been addressed — derived, never self-certified.
 *
 * The old model asked the advocate to tick a box; the tick meant only that someone
 * ticked it (brief §2, problem 1). Here "addressed" is a fact computed from what is
 * actually in the filing:
 *
 *   · the flagged field's value changed from what scrutiny saw, or
 *   · the advocate chose to keep the filed value, or
 *   · the flagged document was replaced.
 *
 * The officer says what is wrong in a note; the advocate makes the fix. There is no
 * proposed value to accept and no reply to write (owner, 2026-10-08). Keeping the filed
 * value needs no reason — the advocate is not forced to change a value they believe is
 * right just to get past the submit gate (owner, 2026-10-08).
 *
 * Two tiers, because two callers need different things:
 *   `defectState(defect, value)` — the screen, which holds the live draft value.
 *   `resolutionSatisfies(defect)` — the pure task transition, which does not.
 * They agree because the screen writes and clears `resolution` as the value moves.
 */

import { WALK_ORDER } from "@/lib/filing/steps";
import type { Defect, DefectTarget, Resolution } from "./types";

export type DefectState =
  /** Nothing has been done about it yet. */
  | "open"
  | "resolved";

const norm = (v: string | undefined | null): string => (v ?? "").trim();

/** Does the filing hold something other than what scrutiny saw? */
function changed(defect: Defect, value: string | undefined): boolean {
  return norm(value) !== norm(defect.valueAtReturn);
}

/**
 * The task-side check: does the recorded resolution stand on its own? Used by `refile`,
 * which has no access to the filing draft.
 */
export function resolutionSatisfies(defect: Defect): boolean {
  const r = defect.resolution;
  if (!r) return false;
  if (r.how === "replaced") return !!r.replacement;
  return r.how === "edited" || r.how === "kept";
}

/**
 * The screen-side state, given what the filing currently holds for this defect's target.
 * `value` is the live field value (field defects) or the replacement file's id (document
 * defects, where `undefined` means nothing has been re-uploaded).
 *
 * A field defect is resolved once its value differs from what scrutiny saw, or once the
 * advocate has chosen to keep the filed value.
 */
export function defectState(defect: Defect, value: string | undefined): DefectState {
  if (defect.target.kind === "doc") {
    return defect.resolution?.how === "replaced" && defect.resolution.replacement
      ? "resolved"
      : "open";
  }

  if (changed(defect, value)) return "resolved";
  return defect.resolution?.how === "kept" ? "resolved" : "open";
}

export function isResolved(defect: Defect, value: string | undefined): boolean {
  return defectState(defect, value) === "resolved";
}

/** How many of these defects are addressed, given a lookup of live values. */
export function countResolved(
  defects: readonly Defect[],
  valueOf: (defect: Defect) => string | undefined
): { resolved: number; total: number } {
  let resolved = 0;
  for (const d of defects) if (isResolved(d, valueOf(d))) resolved += 1;
  return { resolved, total: defects.length };
}

/** Every defect addressed — the gate on "Submit corrections to scrutiny". */
export function allResolved(
  defects: readonly Defect[],
  valueOf: (defect: Defect) => string | undefined
): boolean {
  return defects.length > 0 && defects.every((d) => isResolved(d, valueOf(d)));
}

/**
 * The order the filing itself reads in: the form's own walking order, then the instance
 * (cheque 1 before cheque 2), then the officer's numbering as the tiebreak inside one
 * instance. The queue is an index of the form, so it sorts the way the form turns its
 * pages — the officer's numbering records who wrote what, not where the work is.
 */
export function formOrder(a: Defect, b: Defect): number {
  const step = WALK_ORDER.indexOf(a.target.step) - WALK_ORDER.indexOf(b.target.step);
  if (step !== 0) return step;
  const ia = a.target.kind === "field" ? (a.target.instance ?? 0) : 0;
  const ib = b.target.kind === "field" ? (b.target.instance ?? 0) : 0;
  if (ia !== ib) return ia - ib;
  return a.n - b.n;
}

/** The defect the screen should land on when it opens (or re-opens). */
export function firstUnresolved(
  defects: readonly Defect[],
  valueOf: (defect: Defect) => string | undefined
): Defect | null {
  return defects.find((d) => !isResolved(d, valueOf(d))) ?? null;
}

/** "Corrected" / "Kept as filed" / "Document replaced" — what the frame reports back. */
export function resolutionLabel(defect: Defect, value: string | undefined): string {
  if (defectState(defect, value) !== "resolved") return "";
  if (defect.target.kind === "doc") return "Document replaced";
  return changed(defect, value) ? "Corrected" : "Kept as filed";
}

/** "Case details › Cheque 2 › IFSC code" — never truncated; the queue card wraps it. */
export function breadcrumbOf(target: DefectTarget): string[] {
  const trail = [target.sectionLabel];
  if (target.kind === "field" && target.instanceLabel) trail.push(target.instanceLabel);
  trail.push(target.label);
  return trail;
}

/** A stable key for a defect's target — used to look values up and to focus a field. */
export function targetKey(target: DefectTarget): string {
  if (target.kind === "doc") return `doc:${target.step}:${target.slotKey}`;
  return `field:${target.step}:${target.instance ?? 0}:${target.field}`;
}

/**
 * What the task's record *should* say about a field defect, given what the filing now
 * holds and whether the advocate chose to keep the filed value. `undefined` means
 * "nothing was done" — the record is cleared. A changed value always wins over a keep.
 *
 * The screen calls this once per commit rather than per keystroke: the state above is
 * derived live from the draft, so the record only has to catch up when a human act ends
 * (blur, a pause in typing). One human act, one line of history.
 */
export function intendedResolution(
  defect: Defect,
  value: string | undefined,
  keep: boolean,
  at: string
): Resolution | undefined {
  if (defect.target.kind === "doc") return defect.resolution;
  if (changed(defect, value)) return { how: "edited", value: value ?? "", at };
  return keep ? { how: "kept", value: norm(defect.valueAtReturn), at } : undefined;
}

/**
 * Do two records say the same thing? Compared on substance, never on `at` — otherwise
 * every reconciliation would look like a change and write another line of history.
 */
export function sameResolution(a: Resolution | undefined, b: Resolution | undefined): boolean {
  if (!a || !b) return a === b;
  return (
    a.how === b.how &&
    norm(a.value) === norm(b.value) &&
    (a.replacement?.id ?? null) === (b.replacement?.id ?? null)
  );
}
