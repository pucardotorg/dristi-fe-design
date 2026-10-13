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
 * - **D** is C with the preview live in the right panel, so it opens as C does — on its
 *   own draft.
 * - **E** (full-page editor) is the order as one body of text, like B, but without the
 *   attendance and next-hearing lines: those are its workflow, entered apart from the
 *   words.
 *
 * Each variant keeps its own draft under its own key, so switching mid-order never
 * shows one composer's half-made order in another. The keys are the ones the variants
 * have always used, so the Draft orders queue (`order-drafts.ts` `hasDraftFor`) and any
 * draft already started read the same.
 */

import {
  attendanceRecital,
  buildOrderDocument,
  nextListingRecital,
  recitalText,
  type Appearance,
  type OrderDocument,
  type OrderDraft,
} from "./order-draft";
import {
  editorDraftKey,
  optionDDraftKey,
  proceedingsDraftKey,
  textDraftKey,
} from "./order-drafts";
import type { OrderLayout } from "./order-layout";
import { bodyFromBlocks } from "./order-text";

/** The draft store's key for one variant of a door's order. */
export function variantDraftKey(variant: OrderLayout, base: string): string {
  if (variant === "text") return textDraftKey(base);
  if (variant === "proceedings") return proceedingsDraftKey(base);
  if (variant === "option-d") return optionDDraftKey(base);
  if (variant === "editor") return editorDraftKey(base);
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
  if (variant === "editor") {
    return { ...initial, body: bodyFromBlocks(initial.blocks) };
  }
  if (variant === "proceedings" || variant === "option-d") {
    /* C (and D) lists the next hearing in its own section, never as an item. A door that loads a
       *Scheduling of hearing date* item (Take cognizance, Issue notice) has it moved there,
       with whatever date and purpose it carried, so the order asks for the date once. */
    const scheduling = initial.blocks.find(
      (block) => block.kind === "item" && block.type === "scheduling-of-hearing",
    );
    return {
      ...initial,
      blocks: initial.blocks.filter(
        (block) =>
          block !== scheduling && !(block.kind === "item" && block.applicationId),
      ),
      ...(scheduling && scheduling.kind === "item"
        ? {
            next: "list" as const,
            nextDate: scheduling.values.date || initial.nextDate,
            nextPurpose:
              (scheduling.values.purpose as OrderDraft["nextPurpose"]) ||
              initial.nextPurpose,
          }
        : {}),
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
  if (variant === "text" || variant === "editor") {
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
