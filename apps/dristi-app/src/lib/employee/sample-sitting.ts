/**
 * Sample progress on today's sitting, so every view and pill on today's hearings opens
 * with rows in it (owner, 2026-10-12: *"keep some sample data for all tabs and pills in
 * both orders and hearings"*).
 *
 * This reverses, for the demo, the 2026-09-16 call that the court opens with nothing
 * started. It lives in one place so it can be emptied in one place: each store below
 * opens on its slice of this, and a reload brings it back exactly as written.
 *
 * - **Hearings:** five matters heard, one being heard, two passed over; the rest not
 *   started.
 * - **Orders:** the five heard matters carry the written order their sitting produced
 *   (`order-demo.ts`); two of those are signed and two are on the signing list. The
 *   matter being heard has a draft with details still to fill.
 *
 * Nothing here is a court record — it is the same demo bargain as the stores it seeds.
 */

import type { HearingSession } from "./hearing-session";
import { EMPTY_ORDER_DRAFT, type OrderDraft } from "./order-draft";
import { appendRichText, createOrderItem } from "./order-items";
import type { OrderSigningStatus } from "./order-signing";

export const SAMPLE_SESSION: HearingSession = {
  ongoingId: "h-243",
  /* Chosen for their purposes, so the written orders carry different templates:
     evidence, appearance, cognizance (with summons), bail and judgement. */
  endedIds: new Set(["h-241", "h-244", "h-247", "h-255", "h-260"]),
  passedOverIds: new Set(["h-249", "h-250"]),
};

export const SAMPLE_SIGNING: Readonly<Record<string, OrderSigningStatus>> = {
  "h-241": "signed",
  "h-260": "signed",
  "h-247": "ready",
  "h-255": "ready",
};

/* The matter on the call: summons drafted, addressee and next date not yet given. */
const summons = createOrderItem("issue-of-summons", "sample-h-243-summons");

export const SAMPLE_DRAFTS: Readonly<Record<string, OrderDraft>> = {
  "h-243": {
    ...EMPTY_ORDER_DRAFT,
    next: "list",
    nextDate: null,
    body: appendRichText(EMPTY_ORDER_DRAFT.body, summons.text),
    items: [summons],
  },
};
