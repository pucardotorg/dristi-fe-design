/**
 * Plain words as the order editor's rich text — how a quick order on an application
 * (`application-order-draft.ts`) becomes the body the order screen opens on.
 *
 * The paragraph an order item wrote is marked with the item's id
 * (`ORDER_ITEM_ATTRIBUTE`), so the order's markup records which words came from which
 * item.
 */

import type { RichTextValue } from "@/components/cases/rich-text-field";

/** The attribute that marks a paragraph as the words one order item contributed. */
export const ORDER_ITEM_ATTRIBUTE = "data-order-item";

/**
 * A plain sentence as the editor's own markup. `item` marks the paragraph as the words
 * one order item contributed — see `ORDER_ITEM_ATTRIBUTE`.
 */
export function richTextFromPlain(
  value: string,
  item?: string,
): RichTextValue {
  if (!value) return { html: "", text: "" };
  const mark = item ? ` ${ORDER_ITEM_ATTRIBUTE}="${item}"` : "";
  return { html: `<p${mark}>${escapeText(value)}</p>`, text: value };
}

function escapeText(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
