/**
 * Reset sandbox data (owner, 2026-10-14): this browser's court-side demo state back to
 * how a fresh browser opens — the sample applications (`lib/applications/seed.ts`), and
 * no order drafts, pending orders or signatures, so no order is left pointing at an
 * application that is gone.
 *
 * Everything filed on the advocate side in this browser goes with it: the applications
 * live in the same store.
 */

import { resetApplications } from "@/lib/applications/store";

import { resetOrderDrafts } from "./order-drafts";
import { resetOrderSigning } from "./order-signing";
import { resetPendingOrders } from "./pending-orders";

export function resetSandboxData(): void {
  resetApplications();
  resetOrderDrafts();
  resetOrderSigning();
  resetPendingOrders();
}
