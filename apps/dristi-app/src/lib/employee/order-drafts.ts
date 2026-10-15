/**
 * What the bench has dictated on each listing so far, for the length of this sitting.
 *
 * It lives in a module rather than in the composer's own state because the composer
 * now advances: Next item ends this listing, calls the next, and routes to that
 * matter's composer — which unmounts this one. A draft kept in `React.useState` would
 * be gone the moment the bench moved on, on the one screen in this area whose whole
 * point is the text being written into it.
 *
 * The module outlives client-side navigation inside `/employee`, so the words survive
 * the trip between items, and it is saved in this browser so they survive a reload too
 * (owner, 2026-10-14: a reload used to keep an onboarded application and lose the order
 * deciding it). Nothing here is filed, notified, signed, or written back to a case.
 *
 * The map opens on the demo sitting — see `OPENING_DRAFTS` below.
 *
 * Read it through `components/employee/use-order-draft.ts`, never directly from a
 * render — the hook is what subscribes.
 */

import { EMPTY_ORDER_DRAFT, type OrderDraft } from "./order-draft";
import { SAMPLE_DRAFTS } from "./sample-sitting";
import { restoreRecord, saveRecord, watchRecord } from "./browser-record";

/** Every listing that has an order open on it, keyed by hearing id. */
export type OrderDrafts = Readonly<Record<string, OrderDraft>>;

/* One frozen map, shared: `useSyncExternalStore` compares snapshots by identity, so an
   untouched sitting has to read as the same object every time or the composer would
   re-render on every tick of anything.

   **It is empty**, because a draft is somebody's own half-written order and the court
   opens before anyone has written one (owner, 2026-09-16). This court did briefly open
   on a seeded set so the Draft orders queue had rows on a cold load; that put the board
   in a state the person using it had not reached, which is the opposite of what the
   screen is for. A key here says an order on this listing has been started and not sent
   for signature.

   It opens on `sample-sitting.ts`, which is currently empty (owner, 2026-10-13: no
   order drafted yet). Fill that file to open on a sample draft again. */
const OPENING_DRAFTS: OrderDrafts = Object.freeze({ ...SAMPLE_DRAFTS });

let drafts: OrderDrafts = OPENING_DRAFTS;
let restored = false;

/* Saved in this browser (`browser-record.ts`), so it outlives a reload. Restored when the
   first component subscribes, or on the first write; the server and hydration read the
   opening value. */
const STORAGE_KEY = "dristi.order-drafts.v1";

function restore(): void {
  if (restored || typeof window === "undefined") return;
  restored = true;
  drafts = restoreRecord(STORAGE_KEY, OPENING_DRAFTS);
}

/** What the server rendered, and what hydration must agree with. */
export function serverOrderDrafts(): OrderDrafts {
  return OPENING_DRAFTS;
}

const listeners = new Set<() => void>();

export function subscribeToOrderDrafts(listener: () => void): () => void {
  listeners.add(listener);
  /* The saved copy loads with the first subscriber — after hydration, so the server and
     the first paint agree — and every subscriber hears it. */
  if (!restored) {
    restore();
    for (const each of listeners) each();
  }
  /* Another tab's save replaces this tab's copy. */
  watchRecord(STORAGE_KEY, () => {
    drafts = restoreRecord(STORAGE_KEY, OPENING_DRAFTS);
    for (const each of listeners) each();
  });
  return () => {
    listeners.delete(listener);
  };
}

/** Every draft in this sitting. A new object only when one of them has changed. */
export function readOrderDrafts(): OrderDrafts {
  return drafts;
}

/**
 * One listing's draft, or the one it opens on. Never undefined — a composer always
 * opens.
 *
 * `initial` is what a listing nobody has dictated on starts from. It is empty for most
 * of the board and a written order for a listing the bench has finished
 * (`order-demo.ts`), and it has to be the *same* value on the read path and the write
 * path: an edit that started from the empty draft while the screen was showing the
 * written one would blank the order the bench could see.
 */
export function readOrderDraft(
  hearingId: string,
  initial: OrderDraft = EMPTY_ORDER_DRAFT,
): OrderDraft {
  restore();
  return drafts[hearingId] ?? initial;
}

/** Replace one listing's draft. The others are untouched. */
export function writeOrderDraft(hearingId: string, next: OrderDraft): void {
  restore();
  if (drafts[hearingId] === next) return;
  drafts = { ...drafts, [hearingId]: next };
  saveRecord(STORAGE_KEY, drafts);
  for (const listener of listeners) listener();
}

/**
 * Apply a change to one listing's draft.
 *
 * Reads through the module rather than through a captured value so two edits in the
 * same tick — typing while a mark lands — cannot write over each other.
 */
export function updateOrderDraft(
  hearingId: string,
  update: (current: OrderDraft) => OrderDraft,
  initial: OrderDraft = EMPTY_ORDER_DRAFT,
): void {
  writeOrderDraft(hearingId, update(readOrderDraft(hearingId, initial)));
}

/**
 * Version B's key for a listing's draft (`lib/employee/order-door.ts`). Its own key, so the block
 * composer and the text-box composer never share a half-made order while they are A/B
 * tested side by side.
 */
export function textDraftKey(id: string): string {
  return `text:${id}`;
}

/** Version C's key for a listing's draft (`lib/employee/order-door.ts`), its own like B's. */
export function proceedingsDraftKey(id: string): string {
  return `proceedings:${id}`;
}

/** Version D's key for a listing's draft (`lib/employee/order-door.ts`), its own like B's. */
export function optionDDraftKey(id: string): string {
  return `d:${id}`;
}

/** Version E's key for a listing's draft (`lib/employee/order-door.ts`), its own like B's. */
export function editorDraftKey(id: string): string {
  return `editor:${id}`;
}

/** Whether a listing has an order started on it, in any version of the composer. */
export function hasDraftFor(drafts: OrderDrafts, hearingId: string): boolean {
  return Boolean(
    drafts[hearingId] ??
      drafts[textDraftKey(hearingId)] ??
      drafts[proceedingsDraftKey(hearingId)] ??
      drafts[optionDDraftKey(hearingId)] ??
      drafts[editorDraftKey(hearingId)],
  );
}

/** Back to how a fresh browser opens — Reset sandbox data (`sandbox-reset.ts`). */
export function resetOrderDrafts(to: OrderDrafts = OPENING_DRAFTS): void {
  restored = true;
  drafts = Object.freeze({ ...to });
  saveRecord(STORAGE_KEY, drafts);
  for (const listener of listeners) listener();
}
