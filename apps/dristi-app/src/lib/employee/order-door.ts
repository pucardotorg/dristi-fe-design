/**
 * The pure half of an order door — everything about opening the order screen that
 * depends on which composer variant is switched on (`order-layout.ts`), in one place.
 *
 * A door (`components/employee/order-door-screen.tsx`) describes *what* the order is on
 * and what it opens with: one draft, variant-neutral. This module turns that one draft
 * into each variant's own:
 *
 * - **A** (blocks) takes it as it is.
 * - **B** (text box) also needs the order as one body of text, written from the blocks —
 *   with the attendance and next-hearing lines on a hearing.
 * - **C** (proceedings) keeps an application's decision as the decision, not as an item
 *   block, so decision blocks are left out.
 *
 * Each variant keeps its own draft under its own key, so switching mid-order never
 * shows one composer's half-made order in another. The keys are the ones the variants
 * have always used, so the Draft orders queue (`order-drafts.ts` `hasDraftFor`) and any
 * draft already started read the same.
 */

import type { ComposerBlock } from "./order-composer";
import {
  attendanceRecital,
  buildOrderDocument,
  nextListingRecital,
  recitalText,
  type Appearance,
  type OrderDocument,
  type OrderDraft,
} from "./order-draft";
import { proceedingsDraftKey, textDraftKey } from "./order-drafts";
import type { OrderLayout } from "./order-layout";
import { bodyFromBlocks } from "./order-text";

/** What a workflow preloads: the order items it opens with, and which cannot go. */
export type OrderPreset = {
  blocks: ComposerBlock[];
  /** Blocks that cannot be removed or changed into another kind. */
  fixedIds: string[];
};

/** The draft store's key for one variant of a door's order. */
export function variantDraftKey(variant: OrderLayout, base: string): string {
  if (variant === "text") return textDraftKey(base);
  if (variant === "proceedings") return proceedingsDraftKey(base);
  return base;
}

/**
 * The draft one variant opens on, from the door's variant-neutral draft.
 *
 * `appearances` is the hearing's roll — given only on a hearing, where B's text opens
 * with the attendance and next-hearing lines.
 */
export function variantInitialDraft(
  variant: OrderLayout,
  initial: OrderDraft,
  appearances?: Appearance[],
): OrderDraft {
  if (variant === "text") {
    return {
      ...initial,
      body: bodyFromBlocks(
        initial.blocks,
        appearances
          ? {
              attendance: attendanceRecital(appearances, initial.marks),
              next: nextListingRecital(initial),
            }
          : undefined,
      ),
    };
  }
  if (variant === "proceedings") {
    return {
      ...initial,
      blocks: initial.blocks.filter(
        (block) => !(block.kind === "item" && block.applicationId),
      ),
    };
  }
  return initial;
}

/**
 * The order as paper for one variant. A builds it from the blocks — on a hearing, between
 * the attendance and the posting; B from its one body of text, a paragraph a line.
 */
export function variantDocument(
  variant: OrderLayout,
  input: { caseNumber: string; matter: string; day: string },
  draft: OrderDraft,
  appearances?: Appearance[],
): OrderDocument {
  if (variant === "text") {
    return {
      ...buildOrderDocument({ ...input, blocks: [] }),
      paragraphs: (draft.body?.text ?? "")
        .split(/\n+/)
        .map((line) => line.trim())
        .filter(Boolean),
    };
  }
  return buildOrderDocument({
    ...input,
    blocks: draft.blocks,
    ...(appearances
      ? {
          opening: attendanceRecital(appearances, draft.marks).map(recitalText),
          closing: nextListingRecital(draft).map(recitalText),
        }
      : {}),
  });
}
