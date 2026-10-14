/**
 * A keyed record kept in this browser's `localStorage` — what the court's order stores
 * (`order-drafts.ts`, `pending-orders.ts`, `order-signing.ts`) are saved in, so an order
 * outlives a reload the way the applications it decides already do
 * (`lib/applications/store.ts`; owner, 2026-10-14). Without it a reload kept the
 * application onboarded and lost the order deciding it.
 *
 * Restored once and lazily, on the client only: the server, and the hydration render
 * that must agree with it, read each store's opening value.
 */

export function restoreRecord<T extends object>(key: string, opening: T): T {
  if (typeof window === "undefined") return opening;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return opening;
    const value: unknown = JSON.parse(raw);
    return value && typeof value === "object" && !Array.isArray(value)
      ? (Object.freeze(value) as T)
      : opening;
  } catch {
    // Private mode, blocked storage or a damaged value. The opening value stands.
    return opening;
  }
}

export function saveRecord(key: string, value: object): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Blocked storage or a full quota loses persistence, not the change.
  }
}
