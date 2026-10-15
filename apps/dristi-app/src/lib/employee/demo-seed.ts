/**
 * Which demo day the court side opens on (owner, 2026-10-15) — Court settings → Demo
 * data:
 *
 * - **Orders in every state** — twelve heard matters with orders in each Pending orders
 *   stage (`sample-sitting.ts`). The default.
 * - **Empty day** — nothing heard, no order drafted.
 *
 * Choosing one reloads this browser's hearings and orders from it (`loadDemoSeed` in
 * `sandbox-reset.ts`); Reset sandbox data reloads the chosen one. Applications are not
 * touched by the switch.
 *
 * A per-browser preference, modelled on `next-hearing-entry.ts`: an in-memory value,
 * restored from `localStorage` once and lazily, safe to import from the server render.
 */

import type { DemoSeed } from "./sample-sitting";

export type { DemoSeed };

const KEY = "dristi.demo-seed";

export const DEFAULT_DEMO_SEED: DemoSeed = "orders";

export const DEMO_SEED_OPTIONS: readonly { id: DemoSeed; label: string }[] = [
  { id: "orders", label: "Orders in every state" },
  { id: "empty", label: "Empty day" },
];

function isSeed(value: string | null): value is DemoSeed {
  return value === "orders" || value === "empty";
}

let seed: DemoSeed = DEFAULT_DEMO_SEED;
let restored = false;
const listeners = new Set<() => void>();

function restore(): void {
  if (restored || typeof window === "undefined") return;
  restored = true;
  try {
    const stored = window.localStorage.getItem(KEY);
    if (isSeed(stored)) seed = stored;
  } catch {
    // Private mode or a cleared quota. The default stands.
  }
}

export function subscribeToDemoSeed(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function readDemoSeed(): DemoSeed {
  restore();
  return seed;
}

/** What the server rendered, and what hydration must agree with. Always the default. */
export function serverDemoSeed(): DemoSeed {
  return DEFAULT_DEMO_SEED;
}

/** Record the choice. Reloading the stores from it is `loadDemoSeed`'s job. */
export function setDemoSeed(next: DemoSeed): void {
  if (readDemoSeed() === next) return;
  seed = next;
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(KEY, next);
    } catch {
      // Blocked storage loses persistence, not the switch — listeners still fire.
    }
  }
  for (const listener of listeners) listener();
}
