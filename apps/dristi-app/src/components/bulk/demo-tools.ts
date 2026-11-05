"use client";

/**
 * Whether the demo's shortcuts (fill a case with demo values, fill documents with demo
 * files) are shown. They never sit in the product's chrome by default: a button that
 * writes made-up dates into a legal filing is not something a filer should meet (bulk
 * audit, 2026-11-04). A presenter turns them on for the tab with `?demo=1` on any bulk
 * page, and off again with `?demo=0`.
 */

import * as React from "react";
import { useSearchParams } from "next/navigation";

const KEY = "dristi.bulk.demo-tools";

function stored(): boolean {
  try {
    return window.sessionStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
}

function store(on: boolean) {
  try {
    if (on) window.sessionStorage.setItem(KEY, "1");
    else window.sessionStorage.removeItem(KEY);
  } catch {
    /* Blocked storage only means the flag lasts for this page. */
  }
}

const noSubscribe = () => () => undefined;

export function useDemoTools(): boolean {
  const param = useSearchParams().get("demo");
  // Read once per render from the tab's storage; never on the server.
  const remembered = React.useSyncExternalStore(noSubscribe, stored, () => false);
  React.useEffect(() => {
    if (param === "1" || param === "0") store(param === "1");
  }, [param]);
  return param === "1" || (param !== "0" && remembered);
}
