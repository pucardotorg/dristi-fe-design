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
export const detailFlags = (c: Pick<CaseView, "flags">) => c.flags.filter(aboutDetails);

/** A case's flags about its files: missing ones, and scans too blurry to read. */
export const documentFlags = (c: Pick<CaseView, "flags">) => c.flags.filter((f) => !aboutDetails(f));

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

/** What `caseState` reads: a case view, or the same few facts without building one. */
export type StateFacts = Pick<CaseView, "stage" | "flags" | "docs">;

/**
 * Whether a case can be signed: nothing holds it, its documents are all in and readable,
 * and it is not signed or filed yet. Warnings on its details don't stop it: Case details
 * says those cases "can go ahead without changes", and they do (owner, 2026-11-17: 161
 * cases had their documents but only the 48 without a warning could be signed).
 */
export function readyToSign(c: StateFacts): boolean {
  if (c.stage === "filed" || c.stage === "signed") return false;
  if (detailFlags(c).some((f) => f.level === "hold")) return false;
  return documentFlags(c).length === 0 && c.docs.have >= c.docs.need;
}

/**
 * Where a case is in the steps, for counts that must add up (the batch list's bar): to fix,
 * missing a document, ready to sign, signed, filed. A warning on its details is not a stage
 * of its own here; Case details still lists such cases under To check (`caseState`).
 */
export function progressState(c: StateFacts): CaseState {
  if (c.stage === "filed") return "filed";
  if (c.stage === "signed") return "signed";
  if (detailFlags(c).some((f) => f.level === "hold")) return "fix";
  return readyToSign(c) ? "complete" : "docs";
}

export function caseState(c: StateFacts): CaseState {
  if (c.stage === "filed") return "filed";
  if (c.stage === "signed") return "signed";
  const details = detailFlags(c);
  if (details.some((f) => f.level === "hold")) return "fix";
  if (details.length) return "check";
  if (documentFlags(c).length || c.docs.have < c.docs.need) return "docs";
  // A held case with nothing listed against it still can't be signed: treat it as one to fix.
  return c.stage === "ready" ? "complete" : "fix";
}

