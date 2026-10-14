/**
 * Where an order's attendance and next hearing are entered under the Pending orders flow
 * (owner, 2026-10-14: keep it "as a config so that I can move this attendance and next
 * hearing date back inside" the order data).
 *
 * - **On the order**: fields on the order's page — attendance under the court's heading,
 *   the next hearing above the signature — printed on the order once it is sent, and set
 *   before it can be sent for signing.
 * - **In order data**: cards beside the order, with the items and applications; recorded,
 *   never printed, and fillable until the order data is marked complete.
 *
 * A per-browser preference, modelled on `order-flow.ts`: in memory, restored from
 * `localStorage` once and lazily, safe to import from the server render.
 */

const KEY = "dristi.order-details-placement";

export type OrderDetailsPlacement = "order" | "order-data";

/** With nothing stored, on the order (owner, 2026-10-14). */
export const DEFAULT_ORDER_DETAILS_PLACEMENT: OrderDetailsPlacement = "order";

export const ORDER_DETAILS_PLACEMENT_OPTIONS: readonly {
  id: OrderDetailsPlacement;
  label: string;
}[] = [
  { id: "order", label: "On the order" },
  { id: "order-data", label: "In order data" },
];

function isPlacement(value: string | null): value is OrderDetailsPlacement {
  return value === "order" || value === "order-data";
}

let placement: OrderDetailsPlacement = DEFAULT_ORDER_DETAILS_PLACEMENT;
let restored = false;
const listeners = new Set<() => void>();

function restore(): void {
  if (restored || typeof window === "undefined") return;
  restored = true;
  try {
    const stored = window.localStorage.getItem(KEY);
    if (isPlacement(stored)) placement = stored;
  } catch {
    // Private mode or a cleared quota. The default stands.
  }
}

export function subscribeToOrderDetailsPlacement(
  listener: () => void,
): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function readOrderDetailsPlacement(): OrderDetailsPlacement {
  restore();
  return placement;
}

/** What the server rendered, and what hydration must agree with. Always the default. */
export function serverOrderDetailsPlacement(): OrderDetailsPlacement {
  return DEFAULT_ORDER_DETAILS_PLACEMENT;
}

export function setOrderDetailsPlacement(next: OrderDetailsPlacement): void {
  if (readOrderDetailsPlacement() === next) return;
  placement = next;
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(KEY, next);
    } catch {
      // Blocked storage loses persistence, not the switch — listeners still fire.
    }
  }
  for (const listener of listeners) listener();
}
