"use client";

import * as React from "react";

import {
  readOrderFlow,
  serverOrderFlow,
  setOrderFlow,
  subscribeToOrderFlow,
  type OrderFlow,
} from "@/lib/employee/order-flow";

/** The order flow this browser runs — see `order-flow.ts`. */
export function useOrderFlow(): [OrderFlow, (flow: OrderFlow) => void] {
  const flow = React.useSyncExternalStore(
    subscribeToOrderFlow,
    readOrderFlow,
    serverOrderFlow,
  );
  return [flow, setOrderFlow];
}
