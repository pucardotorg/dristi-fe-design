/**
 * An order's title (order-generation §5.2).
 *
 * `TIT-02`: taken from the order items in the order data, and editable until the order
 * is triggered. How the title follows the items as they change is left to the design;
 * this build uses the old system's pattern — one item's name, or the first item's name
 * "and other items" — and keeps whatever the person typed once they have typed one.
 */

import type { OrderDraft } from "./order-draft";
import { orderTemplate, type OrderTemplateId } from "./order-templates";

/** The title the items give, before anyone types one. */
export function derivedOrderTitle(draft: Pick<OrderDraft, "blocks">): string {
  const items = draft.blocks.flatMap((block) =>
    block.kind === "item" ? [orderTemplate(block.type as OrderTemplateId).label] : [],
  );
  if (items.length === 0) return "Order";
  if (items.length === 1) return items[0];
  return `${items[0]} and other items`;
}

/** The order's title: the one typed, or the one its items give. */
export function orderTitle(draft: Pick<OrderDraft, "blocks" | "title">): string {
  const typed = draft.title?.trim();
  return typed ? typed : derivedOrderTitle(draft);
}
