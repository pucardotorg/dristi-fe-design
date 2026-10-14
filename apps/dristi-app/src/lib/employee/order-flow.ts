/**
 * Which order flow the court side runs — **Pending orders**, the new one, or **Classic**,
 * the way it was before (owner, 2026-10-14: merge it, "with an option for them to switch
 * back to the previous version").
 *
 * - **Pending orders**: a Pending orders row under Today's hearings, where the magistrate
 *   signs and the steno completes each order's workflow; Schedule hearing and Bulk
 *   reschedule at the foot of the rail; no Orders toggle on Today's hearings; no Sign
 *   orders row for the magistrate.
 * - **Classic**: the rail and Today's hearings as they were — Schedule hearing and Bulk
 *   reschedule under Hearings, the Hearings / Orders toggle with its signing, Sign orders
 *   for the magistrate, and no Pending orders.
 *
 * Both keep the steno's narrowed rail and every order screen variant (A–E).
 *
 * A per-browser preference, modelled on `order-layout.ts`: in memory, restored from
 * `localStorage` once and lazily, safe to import from the server render.
 */

const KEY = "dristi.order-flow";

export type OrderFlow = "pending" | "classic";

/** With nothing stored, the new flow (owner, 2026-10-14). */
export const DEFAULT_ORDER_FLOW: OrderFlow = "pending";

export const ORDER_FLOW_OPTIONS: readonly { id: OrderFlow; label: string }[] = [
  { id: "pending", label: "Pending orders" },
  { id: "classic", label: "Classic" },
];

function isOrderFlow(value: string | null): value is OrderFlow {
  return value === "pending" || value === "classic";
}

let flow: OrderFlow = DEFAULT_ORDER_FLOW;
let restored = false;
const listeners = new Set<() => void>();

function restore(): void {
  if (restored || typeof window === "undefined") return;
  restored = true;
  try {
    const stored = window.localStorage.getItem(KEY);
    if (isOrderFlow(stored)) flow = stored;
  } catch {
    // Private mode or a cleared quota. The default stands.
  }
}

export function subscribeToOrderFlow(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function readOrderFlow(): OrderFlow {
  restore();
  return flow;
}

/** What the server rendered, and what hydration must agree with. Always the default. */
export function serverOrderFlow(): OrderFlow {
  return DEFAULT_ORDER_FLOW;
}

export function setOrderFlow(next: OrderFlow): void {
  if (readOrderFlow() === next) return;
  flow = next;
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(KEY, next);
    } catch {
      // Blocked storage loses persistence, not the switch — listeners still fire.
    }
  }
  for (const listener of listeners) listener();
}
