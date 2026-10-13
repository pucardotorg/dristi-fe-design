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

export type OrderLayout = "blocks" | "text" | "proceedings" | "option-d";

/** With nothing stored, version A. */
export const DEFAULT_ORDER_LAYOUT: OrderLayout = "blocks";

/**
 * Every variant of the order screen, in the order they are offered — the one list the
 * breadcrumb switch and Court settings both read, so a new variant is one entry here.
 */
export const ORDER_LAYOUT_OPTIONS: readonly {
  id: OrderLayout;
  label: string;
}[] = [
  { id: "blocks", label: "A: Blocks" },
  { id: "text", label: "B: Text box" },
  { id: "proceedings", label: "C: Proceedings" },
  /* C with Preview order as a live tab in the right panel (owner, 2026-10-14). The id
     stays "option-d" whatever the label becomes: it is what a browser has stored. */
  { id: "option-d", label: "D: Live preview" },
];

const ORDER_LAYOUTS: readonly OrderLayout[] = ORDER_LAYOUT_OPTIONS.map(
  (option) => option.id,
);

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
