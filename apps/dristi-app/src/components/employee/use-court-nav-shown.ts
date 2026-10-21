"use client";

import * as React from "react";

import {
  readCourtNavShown,
  serverCourtNavShown,
  setCourtNavShown,
  subscribeToCourtNavShown,
} from "@/lib/employee/nav-shown";

/** The rail's shown optional tabs and their setter — `useCourtNavLayout`'s shape. */
export function useCourtNavShown(): [
  readonly string[],
  (shown: readonly string[]) => void,
] {
  const shown = React.useSyncExternalStore(
    subscribeToCourtNavShown,
    readCourtNavShown,
    serverCourtNavShown,
  );
  return [shown, setCourtNavShown];
}
