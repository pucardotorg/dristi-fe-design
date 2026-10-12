"use client";

import * as React from "react";

import {
  readOrderLayout,
  serverOrderLayout,
  setOrderLayout,
  subscribeToOrderLayout,
  type OrderLayout,
} from "@/lib/employee/order-layout";

/** Which order composer is switched on — A (blocks) or B (text box). */
export function useOrderLayout(): [OrderLayout, (layout: OrderLayout) => void] {
  const layout = React.useSyncExternalStore(
    subscribeToOrderLayout,
    readOrderLayout,
    serverOrderLayout,
  );
  return [layout, setOrderLayout];
}
