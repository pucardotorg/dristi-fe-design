/**
 * What is left in a batch, step by step, counted one way for every screen that shows it:
 * the batch's own steps, an open case's steps, and Common details' "where the cases
 * stand" (bulk audit: one screen once said "3 to fix" and another "Needs fixing 12").
 */

import type { BatchView, CaseView } from "./api";
import type { BulkStepId, StepMark } from "./bulk-steps";

const aboutDetails = (f: CaseView["flags"][number]) =>
  f.section !== "documents" && f.fix?.kind !== "upload" && f.fix?.kind !== "documents";

export function batchTallies(batch: BatchView) {
  const open = batch.cases.filter((c) => c.stage === "held" || c.stage === "ready");
  const workable = open.length;
  const allFiled = batch.total > 0 && batch.counts.filed === batch.total;
  // Documents counts the cases with a file missing or a scan too blurry to read.
  const docsMissing = open.filter(
    (c) => c.docs.have < c.docs.need || c.flags.some((f) => f.rule === "dcm-poor"),
  ).length;
  // Of those, the cases with a file still to add, apart from scans that only need a look.
  const lacking = open.filter((c) => c.docs.have < c.docs.need).length;
  // Case details counts what it shows: flags about the details, not missing documents.
  const attention = open.filter((c) => c.flags.some(aboutDetails)).length;
  // Of those, the ones held until fixed (the rest are checks to look at).
  const fixing = open.filter((c) => c.flags.some((f) => f.level === "hold" && aboutDetails(f))).length;
  const clear =
    batch.counts.ready - batch.cases.filter((c) => c.stage === "ready" && c.flags.length > 0).length;
  // Case details' count, in the words its title uses.
  const detailsNote = fixing ? `${fixing} to fix` : attention ? `${attention} to check` : undefined;
  return { open, workable, allFiled, docsMissing, lacking, attention, fixing, clear, detailsNote };
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
    details: mark("details", t.workable > 0 && t.attention === 0, t.detailsNote),
    documents: mark("documents", t.workable > 0 && t.docsMissing === 0, t.docsMissing ? `${t.docsMissing} missing` : undefined),
    sign: mark("sign", batch.counts.signed + batch.counts.filed > 0 && t.workable === 0, t.clear ? `${t.clear} ready` : undefined, "ready"),
    pay: mark("pay", t.allFiled),
  };
}
