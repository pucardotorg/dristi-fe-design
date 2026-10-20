/**
 * The pure half of an order door — how the order screen opens a door's draft.
 *
 * A door (`components/employee/order-door-screen.tsx`) describes *what* the order is on
 * and what it opens with. This module turns that into the draft the order screen keeps:
 * its text empty, the door's items — a cognizance act's, an application decision's —
 * kept as items in the workflow, entered apart from the words.
 *
 * The draft lives under the `editor:` key the screen has always used
 * (`order-drafts.ts` `editorDraftKey`), so a draft already started opens as it was.
 */

import type { OrderDraft } from "./order-draft";
import { editorDraftKey } from "./order-drafts";

/** The draft store's key for a door's order. */
export function orderDraftKey(base: string): string {
  return editorDraftKey(base);
}

/**
 * The draft a door's order opens on. The text opens empty and what the door loaded stays
 * as items in the workflow (owner, 2026-10-14: "instead of pre-filling the text, pre-add
 * the items"). A *Scheduling of hearing date* item is folded into the workflow's Next
 * hearing, so the date is asked for once (owner, 2026-10-14).
 */
export function orderInitialDraft(initial: OrderDraft): OrderDraft {
  return {
    ...initial,
    ...foldScheduling(initial),
    body: { html: "", text: "" },
  };
}

/**
 * A door that loads a *Scheduling of hearing date* item (Take cognizance, Issue notice)
 * has it moved into the order's own next hearing, with whatever date and purpose it
 * carried.
 */
function foldScheduling(
  initial: OrderDraft,
): Pick<OrderDraft, "blocks" | "next" | "nextDate" | "nextPurpose"> {
  const scheduling = initial.blocks.find(
    (block) => block.kind === "item" && block.type === "scheduling-of-hearing",
  );
  if (!scheduling || scheduling.kind !== "item") {
    return {
      blocks: initial.blocks,
      next: initial.next,
      nextDate: initial.nextDate,
      nextPurpose: initial.nextPurpose,
    };
  }
  return {
    blocks: initial.blocks.filter((block) => block !== scheduling),
    next: "list",
    nextDate: scheduling.values.date || initial.nextDate,
    nextPurpose:
      (scheduling.values.purpose as OrderDraft["nextPurpose"]) ||
      initial.nextPurpose,
  };
}
