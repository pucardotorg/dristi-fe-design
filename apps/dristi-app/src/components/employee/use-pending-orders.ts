"use client";

import * as React from "react";

import {
  readPendingOrders,
  serverPendingOrders,
  subscribeToPendingOrders,
  type PendingOrders,
} from "@/lib/employee/pending-orders";

/** Every order the full-page editor has started — see `pending-orders.ts`. */
export function usePendingOrders(): PendingOrders {
  return React.useSyncExternalStore(
    subscribeToPendingOrders,
    readPendingOrders,
    serverPendingOrders,
  );
}
