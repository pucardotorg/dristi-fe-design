"use client";

import * as React from "react";

import {
  readDemoSeed,
  serverDemoSeed,
  subscribeToDemoSeed,
  type DemoSeed,
} from "@/lib/employee/demo-seed";

/** Which demo day this browser is on (`demo-seed.ts`). Switch it with `loadDemoSeed`. */
export function useDemoSeed(): DemoSeed {
  return React.useSyncExternalStore(
    subscribeToDemoSeed,
    readDemoSeed,
    serverDemoSeed,
  );
}
