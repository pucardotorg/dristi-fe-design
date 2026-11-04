"use client";

import * as React from "react";

/**
 * Pending orders' one optional column, Case type (stakeholder call, 2026-11-04): off by
 * default, added from Edit columns by whoever wants it. Every other column always shows.
 * A view preference kept in this browser, like the cause list's — never a court record.
 */
const KEY = "dristi.pending-orders.columns.v1";
const listeners = new Set<() => void>();

function readShown(): boolean {
  try {
    return window.localStorage.getItem(KEY) === "caseType";
  } catch {
    return false;
  }
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  window.addEventListener("storage", listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", listener);
  };
}

function write(shown: boolean) {
  try {
    if (shown) window.localStorage.setItem(KEY, "caseType");
    else window.localStorage.removeItem(KEY);
  } catch {
    /* Private mode or blocked storage: nothing to keep. */
  }
  listeners.forEach((listener) => listener());
}

export function usePendingOrderColumns(): {
  showCaseType: boolean;
  setShowCaseType: (shown: boolean) => void;
} {
  /* The server renders the default, so first paint and hydration agree. */
  const showCaseType = React.useSyncExternalStore(subscribe, readShown, () => false);
  return { showCaseType, setShowCaseType: write };
}
