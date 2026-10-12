/**
 * Today's orders, one per listing — the Orders view of today's hearings, as data.
 *
 * Derived live from the same three stores the cause list and the composer read: the
 * day's board after this sitting's marks, the draft text (`order-drafts.ts`) and where
 * each order stands past the draft (`order-signing.ts`). So a listing cannot read as a
 * draft here and as signed in the composer.
 *
 * **Which listings are on it** is the Draft orders rule (`hasOrderDrawnUp`), plus any
 * listing whose order has been added to the signing list — pressing that without typing
 * a word leaves no draft key, and the order still exists.
 *
 * **What "in this order" means.** The templates the typist pulled in (`items`, by label)
 * and the next date it lists the matter for — the facts, as chips. What is still to fill
 * is read off the order's own text, every `[placeholder]` left in it (`openSlots`), plus a
 * next listing chosen with no date. Those are the warning chips and the count under the
 * status. Nothing here is a court record; the words are the composer's.
 */

import { hasOrderDrawnUp } from "./draft-orders";
import type { CourtHearing } from "./hearings";
import { initialOrderDraft } from "./order-demo";
import type { OrderDraft } from "./order-draft";
import type { OrderDrafts } from "./order-drafts";
import { orderItemLabel } from "./order-items";
import type { OrderSigning } from "./order-signing";
import { openSlots } from "./order-templates";

export type HearingOrderStatus = "draft" | "ready" | "signed";

/** The pills, in the order the work moves through them. */
export const HEARING_ORDER_STATUSES: {
  id: HearingOrderStatus;
  /** The pill's word — the pile. */
  pill: string;
  /** The row's word — the one order. */
  label: string;
  hint: string;
}[] = [
  {
    id: "draft",
    pill: "Drafts",
    label: "Draft",
    hint: "Being written. Not yet added to the signing list.",
  },
  {
    id: "ready",
    pill: "Ready to sign",
    label: "Ready to sign",
    hint: "Added to the signing list and waiting for a signature.",
  },
  {
    id: "signed",
    pill: "Signed",
    label: "Signed",
    hint: "Signed at this sitting.",
  },
];

export function hearingOrderStatusLabel(id: HearingOrderStatus): string {
  return HEARING_ORDER_STATUSES.find((entry) => entry.id === id)?.label ?? id;
}

export function hearingOrderStatusVariant(
  id: HearingOrderStatus,
): "secondary" | "info" | "success" {
  return id === "signed" ? "success" : id === "ready" ? "info" : "secondary";
}

export type HearingOrder = {
  hearing: CourtHearing;
  status: HearingOrderStatus;
  /** Template labels, in the order they were pulled in. */
  items: string[];
  /** What is still to fill, worded as the chip says it. */
  gaps: string[];
  /** ISO day the order lists the matter for next, if it names one. */
  nextDate: string | null;
};

/** "[date of summons]" → "Date of summons missing". */
function gapLabel(slot: string): string {
  const name = slot.replace(/^\[|\]$/g, "").trim();
  if (!name) return "Detail missing";
  return `${name.charAt(0).toUpperCase()}${name.slice(1).toLowerCase()} missing`;
}

function gapsOf(draft: OrderDraft): string[] {
  /* One chip per distinct placeholder: the same blank twice in a passage is one fact
     to supply. */
  const gaps = [...new Set(openSlots(draft.body.text))].map(gapLabel);
  if (draft.next === "list" && !draft.nextDate) gaps.push("Next hearing date missing");
  return gaps;
}

/**
 * The day's orders, in the court's serial order.
 *
 * `hearings` is the board **after** this sitting's marks (`withHearingSession`): the
 * opening draft of a completed listing turns on its live status.
 */
export function ordersForSitting(
  hearings: CourtHearing[],
  drafts: OrderDrafts,
  signing: OrderSigning,
  today: string,
): HearingOrder[] {
  return hearings
    .filter((hearing) => hasOrderDrawnUp(hearing, drafts) || signing[hearing.id])
    .sort((a, b) => a.item - b.item)
    .map((hearing) => {
      const draft =
        drafts[hearing.id] ?? initialOrderDraft(hearing, hearing.status, today);
      const signed = signing[hearing.id];
      return {
        hearing,
        status: signed ?? "draft",
        items: draft.items.map((item) => orderItemLabel(item.type)),
        gaps: gapsOf(draft),
        nextDate: draft.next === "list" ? draft.nextDate : null,
      };
    });
}
