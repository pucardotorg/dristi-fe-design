"use client";

import * as React from "react";

import { useCourt } from "@/components/court/court-provider";

/**
 * Bulk filing is built for Gujarat (SARAS 2.0), where institutional filers send cases by
 * the thousand (docs/product/rollout.md). Its screens open in that deployment: arriving
 * from another state switches the court, the way the Settings switch does.
 */
export function useGujarat(): boolean {
  const { court, setCourt } = useCourt();
  React.useEffect(() => {
    if (court !== "gujarat") setCourt("gujarat");
  }, [court, setCourt]);
  return court === "gujarat";
}
