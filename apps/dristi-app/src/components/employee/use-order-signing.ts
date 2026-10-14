"use client";

import * as React from "react";

import {
  readOrderSigning,
  serverOrderSigning,
  subscribeToOrderSigning,
  type OrderSigning,
} from "@/lib/employee/order-signing";

/**
 * Where each of today's orders stands past the draft — the store the composer writes and
 * the Orders view on today's hearings reads, so the two cannot disagree. The server
 * snapshot is the same empty map the module opens on, so hydration agrees.
 */
export function useOrderSigning(): OrderSigning {
  return React.useSyncExternalStore(
    subscribeToOrderSigning,
    readOrderSigning,
    serverOrderSigning,
  );
}
