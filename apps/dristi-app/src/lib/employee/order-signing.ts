/**
 * Where each of today's orders stands after the composer — added to the signing list,
 * or signed — for the length of this sitting.
 *
 * The composer used to hold this in its own state, which was enough while nothing else
 * asked. Today's hearings now has an Orders view that sorts the day's orders into
 * Drafts, Ready to sign and Signed, so the answer has to outlive the composer the same
 * way the draft text does (`order-drafts.ts`) — and it makes the same bargain: a client
 * module that survives navigation inside `/employee` and dies on a reload. Nothing here
 * is filed, published or signed in any real sense.
 *
 * No key means the order is still a draft.
 *
 * Read it through `components/employee/use-order-signing.ts`, never directly from a
 * render — the hook is what subscribes.
 */

import { SAMPLE_SIGNING } from "./sample-sitting";

export type OrderSigningStatus = "ready" | "signed";

/** Every listing whose order has left the draft stage, keyed by hearing id. */
export type OrderSigning = Readonly<Record<string, OrderSigningStatus>>;

/* Frozen and shared, so an untouched sitting reads as the same object every time —
   `useSyncExternalStore` compares snapshots by identity. */
const OPENING: OrderSigning = Object.freeze({ ...SAMPLE_SIGNING });

let signing: OrderSigning = OPENING;
const listeners = new Set<() => void>();

export function subscribeToOrderSigning(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function readOrderSigning(): OrderSigning {
  return signing;
}

function write(next: OrderSigning) {
  signing = next;
  for (const listener of listeners) listener();
}

/** Add to signing list. A signed order stays signed. */
export function markOrderReady(hearingId: string): void {
  if (signing[hearingId]) return;
  write({ ...signing, [hearingId]: "ready" });
}

/** Off the signing list, back to draft — never once signed. */
export function returnOrderToDraft(hearingId: string): void {
  if (signing[hearingId] !== "ready") return;
  const next: Record<string, OrderSigningStatus> = { ...signing };
  delete next[hearingId];
  write(next);
}

/** Signed — from the composer's own overlay or from the Orders view in bulk. */
export function markOrdersSigned(hearingIds: Iterable<string>): void {
  const next: Record<string, OrderSigningStatus> = { ...signing };
  let changed = false;
  for (const id of hearingIds) {
    if (next[id] === "signed") continue;
    next[id] = "signed";
    changed = true;
  }
  if (changed) write(next);
}
