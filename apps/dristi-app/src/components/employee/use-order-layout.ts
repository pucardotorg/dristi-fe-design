"use client";

import * as React from "react";

import { useOrderFlow } from "@/components/employee/use-order-flow";
import {
  effectiveOrderLayout,
  readOrderLayout,
  serverOrderLayout,
  setOrderLayout,
  subscribeToOrderLayout,
  type OrderLayout,
} from "@/lib/employee/order-layout";

/**
 * Which order screen opens — E in the Pending orders flow, the stored A–D in Classic
 * (`effectiveOrderLayout`). The setter stores the Classic choice.
 */
export function useOrderLayout(): [OrderLayout, (layout: OrderLayout) => void] {
  const [flow] = useOrderFlow();
  const stored = React.useSyncExternalStore(
    subscribeToOrderLayout,
    readOrderLayout,
    serverOrderLayout,
  );
  return [effectiveOrderLayout(flow, stored), setOrderLayout];
}
