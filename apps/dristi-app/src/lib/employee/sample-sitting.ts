/**
 * The progress today's sitting opens on — the one place each store below takes its
 * opening slice from, so the demo day can be filled or emptied in one edit.
 *
 * Currently an **untouched day** (owner, 2026-10-13: none of today's hearings has
 * started and no order has been drafted). This replaces the 2026-10-12 sample that had
 * five matters heard, one being heard, two passed over, and orders drafted and signed
 * on them. Every listing opens as scheduled; the Orders column, the Draft orders tab and
 * the signing list open empty, and fill only as the bench works through the day.
 *
 * Nothing here is a court record — it is the same demo bargain as the stores it seeds.
 */

import type { HearingSession } from "./hearing-session";
import type { OrderDraft } from "./order-draft";
import type { OrderSigningStatus } from "./order-signing";

export const SAMPLE_SESSION: HearingSession = {
  ongoingId: null,
  endedIds: new Set(),
  passedOverIds: new Set(),
};

export const SAMPLE_SIGNING: Readonly<Record<string, OrderSigningStatus>> = {};

export const SAMPLE_DRAFTS: Readonly<Record<string, OrderDraft>> = {};
