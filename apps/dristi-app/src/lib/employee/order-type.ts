/**
 * An order's type, and the companion text a regular order carries (owner, 2026-10-30).
 *
 * A state may offer a second type beside a regular order — Gujarat's Roznama, Punjab &
 * Haryana's Zimni (`OrderTypeRules` in `lib/court/profiles.ts`). The type changes
 * nothing about the order — its items, workflows, signing and triggering are the same —
 * except that an order of the alternative type carries no companion text: its order text
 * is the entry.
 *
 * Where the state signs the companion text one at a time (Gujarat), a regular order's
 * Roznama becomes its own document once the order is triggered, listed in Pending orders
 * under Awaiting signature and signed there by the order signer. Its signature is kept
 * in `order-signing.ts` under `companionKey`.
 */

import type { OrderTypeRules } from "@/lib/court/profiles";
import type { OrderDraft, OrderType } from "./order-draft";

/**
 * The type an order opens as, from its draft key: a hearing's or an application's is the
 * alternative type, a cognizance order regular (owner, 2026-10-22).
 */
export function defaultOrderType(key: string): OrderType {
  return key.startsWith("cognizance:") ? "regular" : "alternative";
}

/** The order's type: as chosen, or as it opened. Regular where the state has no other. */
export function orderTypeOf(
  draft: Pick<OrderDraft, "orderType"> | undefined,
  key: string,
  rules: OrderTypeRules,
): OrderType {
  if (!rules.alternative) return "regular";
  return draft?.orderType ?? defaultOrderType(key);
}

/** What the type is called: "Order", or the state's own name for the alternative. */
export function orderTypeLabel(type: OrderType, rules: OrderTypeRules): string {
  return type === "alternative" && rules.alternative ? rules.alternative : "Order";
}

/** The companion text's name on this order, or `null` where it carries none. */
export function companionLabel(type: OrderType, rules: OrderTypeRules): string | null {
  return type === "regular" && rules.companion ? rules.companion.label : null;
}

/** Whether a regular order's companion text is signed on its own, after triggering. */
export function companionSignedEach(type: OrderType, rules: OrderTypeRules): boolean {
  return type === "regular" && rules.companion?.signing === "each";
}

/** Where a companion document's signature is kept, beside its order's. */
export function companionKey(orderKey: string): string {
  return `companion:${orderKey}`;
}

/** The companion text itself: the order text, or the text typed separately. */
export function companionText(draft: OrderDraft | undefined): string {
  if (!draft) return "";
  return draft.aDiarySame !== false ? (draft.body?.text ?? "") : (draft.aDiaryText ?? "");
}
