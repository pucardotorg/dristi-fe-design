import type * as React from "react";

import { shortDocName } from "@/lib/employee/scrutiny/bundle";
import type {
  BundleDoc,
  Draft,
  Field,
  FlagMap,
  Rect,
  SectionDef,
} from "@/lib/employee/scrutiny/types";

/* ── counts across the case ──────────────────────────────────────────────── */

/** Observations AI has about a section — what the officer should check. */
export function sectionIssueCount(section: SectionDef): number {
  return section.groups.reduce(
    (n, g) => n + g.fields.filter((f) => f.docread || f.ocrfail).length,
    0,
  );
}

/** Items the officer has raised in a section. */
export function sectionFlagCount(section: SectionDef, flags: FlagMap): number {
  return section.groups.reduce(
    (n, g) => n + g.fields.filter((f) => flags[f.id]).length,
    0,
  );
}

export function rectStyle(rect: Rect): React.CSSProperties {
  const [left, top, width, height] = rect;
  return {
    left: `${left}%`,
    top: `${top}%`,
    width: `${width}%`,
    height: `${height}%`,
  };
}

/* ── the composer's draft ────────────────────────────────────────────────── */

/** Anything at all has been entered. */
export function isDraftDirty(field: Field, draft: Draft | null): boolean {
  if (!draft) return false;
  return !!(draft.text.trim() || draft.reason);
}

/**
 * The item states what is wrong.
 *
 * A document reason chip states itself; otherwise there must be words.
 */
export function saysSomething(field: Field, draft: Draft | null): boolean {
  if (!draft) return false;
  return !!(draft.reason || draft.text.trim());
}

/** A linked document item must name what is wrong with the document before it saves. */
export function isLinkedComplete(draft: Draft | null): boolean {
  return !draft?.linked || !!draft.linked.reason;
}

/** The save gate. Both items have to be legible, not just entered. */
export function canSaveDraft(field: Field, draft: Draft | null): boolean {
  return (
    isDraftDirty(field, draft) &&
    saysSomething(field, draft) &&
    isLinkedComplete(draft)
  );
}

/**
 * What a raised item grants the advocate — as one plain sentence, printed identically on
 * the composer, on the item, and in the review dialog.
 *
 * The unlock rule: an item unlocks only what it names. A field item unlocks that value
 * and nothing else; **re-upload is opened by a document-row item alone**. The earlier
 * phrasing said this as a negation ("this value — not re-upload of Aadhaar"), which read
 * as legalese; "only" carries the same boundary in natural voice, and the adjacent
 * "Flag the upload" affordance makes the alternative concrete. The word appears exactly
 * where a mark on an uploaded document could mislead — a field sourced from a generated
 * page has nothing to re-upload, so it takes the plain sentence.
 */
export function unlocksSentence(
  field: Field,
  docRow: Record<string, string>,
): string {
  if (field.docrow) {
    return "Lets the advocate re-upload this document.";
  }
  if (field.doc && docRow[field.doc]) {
    return "Lets the advocate edit this value only.";
  }
  return "Lets the advocate edit this value.";
}

/** Short enough that a Malayalam or Gujarati bundle label does not blow the line. */
export function docName(
  docId: string,
  docById: Record<string, BundleDoc>,
): string {
  const doc = docById[docId];
  return doc ? shortDocName(doc.name) : "the document";
}
