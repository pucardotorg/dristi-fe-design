/**
 * Where a case stands in its batch, and what is left in the batch step by step, decided
 * one way for every screen that shows it: the batch's steps, Case details' list, the open
 * case's strip, Documents, Sign and Pay.
 *
 * Round 3 of the bulk audit found one batch saying "Complete 9", "Continue with 10
 * complete" and "Sign 8" at once, and an open case saying "Case 4 of 12 to fix" beside a
 * list of 2, because each screen counted its own way. So there is one state per case, and
 * "complete" means one thing: details and documents both done, ready to sign.
 */

import type { BatchView, CaseView } from "./api";
import type { BulkStepId, StepMark } from "./bulk-steps";

export { aboutDetails, caseState, detailFlags, documentFlags, type CaseState } from "@/lib/bulk/case-state";
import { caseState, documentFlags, type CaseState } from "@/lib/bulk/case-state";

/** Cases that can still change: everything before signing. */
export const isOpen = (c: CaseView) => c.stage === "held" || c.stage === "ready";

export function batchTallies(batch: BatchView) {
  const open = batch.cases.filter(isOpen);
  const by = (s: CaseState) => open.filter((c) => caseState(c) === s);
  const fixingCases = by("fix");
  const checkingCases = by("check");
  const completeCases = by("complete");
  const workable = open.length;
  const allFiled = batch.total > 0 && batch.counts.filed === batch.total;
  // Documents works on every case not still being fixed (v8: those join it later).
  const atDocuments = open.filter((c) => caseState(c) !== "fix");
  const docsCases = atDocuments.filter((c) => documentFlags(c).length > 0 || c.docs.have < c.docs.need);
  const docsMissing = docsCases.length;
  // Cases being fixed that will also need a file once they reach Documents.
  const docsLater = fixingCases.filter((c) => c.docs.have < c.docs.need).length;
  const fixing = fixingCases.length;
  const checking = checkingCases.length;
  const attention = fixing + checking;
  const clear = completeCases.length;
  // Case details' count, in the words its list uses.
  const detailsNote = [fixing ? `${fixing} to fix` : "", checking ? `${checking} to check` : ""]
    .filter(Boolean)
    .join(" · ") || undefined;
  return {
    open,
    workable,
    allFiled,
    fixingCases,
    checkingCases,
    completeCases,
    atDocuments,
    docsCases,
    docsMissing,
    docsLater,
    fixing,
    checking,
    attention,
    clear,
    detailsNote,
  };
}

/** The six steps' marks, with `current` on screen and each step opening at `href(step)`. */
export function batchMarks(
  batch: BatchView,
  current: BulkStepId,
  href: (step: BulkStepId) => string,
): Record<BulkStepId, StepMark> {
  const t = batchTallies(batch);
  const mark = (id: BulkStepId, done: boolean, note?: string, tone?: StepMark["tone"]): StepMark => ({
    status: current === id ? "current" : done ? "complete" : "upcoming",
    href: href(id),
    note: current === id ? undefined : note,
    tone,
  });
  return {
    common: mark("common", true),
    cases: mark("cases", true),
    // The step's own count is short: what blocks first.
    details: mark(
      "details",
      t.workable > 0 && t.attention === 0,
      t.fixing ? `${t.fixing} to fix` : t.checking ? `${t.checking} to check` : undefined,
      t.fixing ? "fix" : undefined,
    ),
    documents: mark(
      "documents",
      t.workable > 0 && t.docsMissing === 0 && t.fixing === 0,
      t.docsMissing ? `${t.docsMissing} missing` : undefined,
      // A count, not an alarm, until the filer reaches Documents: red there and after
      // (owner, 2026-11-12: red on Case details shouted about a step not yet begun).
      t.docsMissing ? (current === "sign" || current === "pay" ? "fix" : "neutral") : undefined,
    ),
    sign: mark("sign", batch.counts.signed + batch.counts.filed > 0 && t.workable === 0, t.clear ? `${t.clear} ready` : undefined, "ready"),
    pay: mark(
      "pay",
      t.allFiled,
      batch.counts.signed ? `${batch.counts.signed} to pay` : undefined,
      "ready",
    ),
  };
}
