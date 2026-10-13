/**
 * Which of today's listings have an order open on them — the Sign orders screen's Draft
 * orders tab, as data.
 *
 * The signing queue beside it (`sign-orders.ts`) is a fixture: orders standing in front
 * of the bench with dates spread over months. This list is not. It is derived, live, from
 * **today's own board** — the cause list, this sitting's marks, and the orders the court
 * has in progress — because that is where an order comes from before it is anybody's to
 * sign. A fixture here would have been a second answer to "what have we drawn up today",
 * and the screen that draws them (`order-screen.tsx`) already holds the first.
 *
 * **Which listings count, and why those two tests.** A listing is on this list when
 * either:
 *
 * 1. an order has been started on it — a key in `order-drafts.ts`, whether it came from
 *    the court's opening drafts or from the typist during this visit; or
 * 2. the sitting on it is finished, which is what makes it open on a written order
 *    (`order-demo.ts`) with no key of its own.
 *
 * These are the same two facts today's cause list already marks in its Orders column —
 * the draft plate and the recorded tick — so the two screens cannot disagree about which
 * matters have an order on them. `draft-orders.test.ts` holds that agreement as a gate
 * rather than a comment. Anything else on the board has nothing drawn up: a matter still
 * to be called has no sitting to record, and one the bench is in is the one case where a
 * pre-written order would be actively wrong.
 *
 * **Nothing here is an order of the court, and nothing on this list has been sent
 * anywhere.** A draft is the composer's own text and it dies on a reload
 * (`order-drafts.ts`); the written ones are demo text that no court passed
 * (`order-demo.ts`). Putting them on this screen adds no claim: the tab lists what is
 * open, and the way to finish one is the composer it came from.
 *
 * The rows are `CourtHearing`s rather than a shape of this module's own, because the tab
 * draws them the way today's cause list draws them — the owner's instruction, and the
 * reason `DraftOrdersTable` composes out of that table's own cells. A private row type
 * would have been a second vocabulary for the same listing.
 */

import type { CourtHearing } from "./hearings";
import { hasDraftFor, type OrderDrafts } from "./order-drafts";

/** The composer that owns the words — the row's opener, and the way to finish one. */
export function draftOrderHref(hearing: { id: string }): string {
  return `/employee/hearings/${hearing.id}/order`;
}

/**
 * Whether this listing has an order on it — the one rule, in the one place.
 *
 * Written as the two booleans `HearingOrdersButton` reads for its own glyph so a change
 * to either side has somewhere to be caught.
 */
export function hasOrderDrawnUp(
  hearing: CourtHearing,
  drafts: OrderDrafts,
): boolean {
  const drafted = hasDraftFor(drafts, hearing.id);
  const recorded = hearing.status === "completed";
  return drafted || recorded;
}

/**
 * Today's open orders, in the court's own serial order.
 *
 * `hearings` is the board **after** this sitting's marks (`withHearingSession`), because
 * the second test reads a live status: a matter the bench ended a moment ago is completed
 * in the session and still scheduled in the fixture.
 *
 * Serial order, not newest-first: a bench looking for the order it was just writing finds
 * the matter where the day put it, and there is no drawn-up time to sort on — the drafts
 * are a map keyed by listing, not a log.
 */
export function draftOrdersForSitting(
  hearings: CourtHearing[],
  drafts: OrderDrafts,
): CourtHearing[] {
  return hearings
    .filter((hearing) => hasOrderDrawnUp(hearing, drafts))
    .sort((a, b) => a.item - b.item);
}
