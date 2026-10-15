/**
 * Reset sandbox data (owner, 2026-10-14): this browser's court-side demo state back to
 * how it opens — the sample applications (`lib/applications/seed.ts`), and the hearings
 * and orders of the demo day chosen in Court settings (`demo-seed.ts`, 2026-10-15).
 *
 * Everything filed on the advocate side in this browser goes with it: the applications
 * live in the same store.
 */

import { resetApplications } from "@/lib/applications/store";

import { readDemoSeed, setDemoSeed, type DemoSeed } from "./demo-seed";
import { resetHearingSession } from "./hearing-session";
import { resetOrderDrafts } from "./order-drafts";
import { resetOrderSigning } from "./order-signing";
import { resetPendingOrders } from "./pending-orders";
import { SITTING_SEEDS } from "./sample-sitting";

/** Reload this browser's hearings and orders from a demo day, and remember the choice. */
export function loadDemoSeed(seed: DemoSeed): void {
  setDemoSeed(seed);
  const day = SITTING_SEEDS[seed];
  resetOrderDrafts(day.drafts);
  resetOrderSigning(day.signing);
  resetPendingOrders(day.pending);
  resetHearingSession(day.session);
}

export function resetSandboxData(): void {
  resetApplications();
  loadDemoSeed(readDemoSeed());
}
