"use client";

import * as React from "react";

import {
  readOrderDetailsPlacement,
  serverOrderDetailsPlacement,
  setOrderDetailsPlacement,
  subscribeToOrderDetailsPlacement,
  type OrderDetailsPlacement,
} from "@/lib/employee/order-details-placement";

/** Where attendance and the next hearing are entered — see `order-details-placement.ts`. */
export function useOrderDetailsPlacement(): [
  OrderDetailsPlacement,
  (placement: OrderDetailsPlacement) => void,
] {
  const placement = React.useSyncExternalStore(
    subscribeToOrderDetailsPlacement,
    readOrderDetailsPlacement,
    serverOrderDetailsPlacement,
  );
  return [placement, setOrderDetailsPlacement];
}
