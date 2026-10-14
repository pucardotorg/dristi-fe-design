/**
 * Where each of today's orders stands after the composer — added to the signing list,
 * or signed — for the length of this sitting.
 *
 * The composer used to hold this in its own state, which was enough while nothing else
 * asked. Today's hearings now has an Orders view that sorts the day's orders into
 * Drafts, Ready to sign and Signed, so the answer has to outlive the composer the same
 * way the draft text does (`order-drafts.ts`) — and it makes the same bargain: saved in
 * this browser, so it outlives a reload (owner, 2026-10-14). Nothing here is filed,
 * published or signed in any real sense.
 *
 * No key means the order is still a draft.
 *
 * Read it through `components/employee/use-order-signing.ts`, never directly from a
 * render — the hook is what subscribes.
 */

import { SAMPLE_SIGNING } from "./sample-sitting";
import { restoreRecord, saveRecord } from "./browser-record";

export type OrderSigningStatus = "ready" | "signed";

/** Every listing whose order has left the draft stage, keyed by hearing id. */
export type OrderSigning = Readonly<Record<string, OrderSigningStatus>>;

/* Frozen and shared, so an untouched sitting reads as the same object every time —
   `useSyncExternalStore` compares snapshots by identity. */
const OPENING: OrderSigning = Object.freeze({ ...SAMPLE_SIGNING });

let signing: OrderSigning = OPENING;
let restored = false;

/* Saved in this browser (`browser-record.ts`), so it outlives a reload. Restored when the
   first component subscribes, or on the first write; the server and hydration read the
   opening value. */
const STORAGE_KEY = "dristi.order-signing.v1";

function restore(): void {
  if (restored || typeof window === "undefined") return;
  restored = true;
  signing = restoreRecord(STORAGE_KEY, OPENING);
}

/** What the server rendered, and what hydration must agree with. */
export function serverOrderSigning(): OrderSigning {
  return OPENING;
}

const listeners = new Set<() => void>();

export function subscribeToOrderSigning(listener: () => void): () => void {
  listeners.add(listener);
  /* The saved copy loads with the first subscriber — after hydration, so the server and
     the first paint agree — and every subscriber hears it. */
  if (!restored) {
    restore();
    for (const each of listeners) each();
  }
  return () => {
    listeners.delete(listener);
  };
}

export function readOrderSigning(): OrderSigning {
  return signing;
}

function write(next: OrderSigning) {
  signing = next;
  saveRecord(STORAGE_KEY, signing);
  for (const listener of listeners) listener();
}

/** Add to signing list. A signed order stays signed. */
export function markOrderReady(hearingId: string): void {
  restore();
  if (signing[hearingId]) return;
  write({ ...signing, [hearingId]: "ready" });
}

/** Off the signing list, back to draft — never once signed. */
export function returnOrderToDraft(hearingId: string): void {
  restore();
  if (signing[hearingId] !== "ready") return;
  const next: Record<string, OrderSigningStatus> = { ...signing };
  delete next[hearingId];
  write(next);
}

/** Signed — from the composer's own overlay or from the Orders view in bulk. */
export function markOrdersSigned(hearingIds: Iterable<string>): void {
  restore();
  const next: Record<string, OrderSigningStatus> = { ...signing };
  let changed = false;
  for (const id of hearingIds) {
    if (next[id] === "signed") continue;
    next[id] = "signed";
    changed = true;
  }
  if (changed) write(next);
}

/** Back to how a fresh browser opens — Reset sandbox data (`sandbox-reset.ts`). */
export function resetOrderSigning(): void {
  restored = true;
  write(OPENING);
}
