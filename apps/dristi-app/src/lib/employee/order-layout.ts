/**
 * Which order composer the court side opens — **A**, the block composer (Abhirami's
 * screen with Varun's blocks), or **B**, the text-box composer (today's screen, tightened)
 * — so the two can be put in front of people side by side (owner, 2026-10-12: "create a
 * version B so that we can A/B test", toggled "from that left-side settings bar where
 * every other toggle is").
 *
 * A per-browser preference, modelled on `cognizance-layout.ts`: an in-memory value,
 * restored from `localStorage` once and lazily, safe to import from the server render.
 */

const KEY = "dristi.order-layout";

export type OrderLayout = "blocks" | "text";

/** With nothing stored, version A. */
export const DEFAULT_ORDER_LAYOUT: OrderLayout = "blocks";

const ORDER_LAYOUTS: readonly OrderLayout[] = ["blocks", "text"];

function isOrderLayout(value: string | null): value is OrderLayout {
  return (ORDER_LAYOUTS as readonly (string | null)[]).includes(value);
}

let layout: OrderLayout = DEFAULT_ORDER_LAYOUT;
let restored = false;
const listeners = new Set<() => void>();

function restore(): void {
  if (restored || typeof window === "undefined") return;
  restored = true;
  try {
    const stored = window.localStorage.getItem(KEY);
    if (isOrderLayout(stored)) layout = stored;
  } catch {
    // Private mode or a cleared quota. The default stands.
  }
}

export function subscribeToOrderLayout(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function readOrderLayout(): OrderLayout {
  restore();
  return layout;
}

/** What the server rendered, and what hydration must agree with. Always the default. */
export function serverOrderLayout(): OrderLayout {
  return DEFAULT_ORDER_LAYOUT;
}

export function setOrderLayout(next: OrderLayout): void {
  if (readOrderLayout() === next) return;
  layout = next;
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(KEY, next);
    } catch {
      // Blocked storage loses persistence, not the switch — listeners still fire.
    }
  }
  for (const listener of listeners) listener();
}
