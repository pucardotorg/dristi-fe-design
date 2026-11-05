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

type CaseFlag = CaseView["flags"][number];

/** A flag about the case's details, not about a document file. */
export const aboutDetails = (f: CaseFlag) =>
  f.section !== "documents" && f.fix?.kind !== "upload" && f.fix?.kind !== "documents";

/** A case's flags about its details; files are the Documents step's. */
export const detailFlags = (c: CaseView) => c.flags.filter(aboutDetails);

/** A case's flags about its files: missing ones, and scans too blurry to read. */
export const documentFlags = (c: CaseView) => c.flags.filter((f) => !aboutDetails(f));

/**
 * Where one case stands, first match wins:
 *
 *  · `fix`      — a detail it can't be filed without. Case details' "To fix".
 *  · `check`    — a detail to look at, which can be skipped. Case details' "To check".
 *  · `docs`     — details done, a file missing or hard to read. The Documents step's.
 *  · `complete` — details and documents done: ready to sign.
 *  · `signed`, `filed` — past the steps where it can change.
 */
export type CaseState = "fix" | "check" | "docs" | "complete" | "signed" | "filed";

export function caseState(c: CaseView): CaseState {
  if (c.stage === "filed") return "filed";
  if (c.stage === "signed") return "signed";
  const details = detailFlags(c);
  if (details.some((f) => f.level === "hold")) return "fix";
  if (details.length) return "check";
  if (documentFlags(c).length || c.docs.have < c.docs.need) return "docs";
  // A held case with nothing listed against it still can't be signed: treat it as one to fix.
  return c.stage === "ready" ? "complete" : "fix";
}

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
