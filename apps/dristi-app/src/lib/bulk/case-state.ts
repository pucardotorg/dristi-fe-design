/**
 * Where a case stands in its batch, decided once for every screen and for the batch list
 * (audit, 2026-11-10: the list counted raw stages and said "Ready to sign 10" beside a
 * Sign step saying 8). `components/bulk/batch-marks.ts` builds the steps' marks on it.
 */

import type { CaseView } from "./actions.server";

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

