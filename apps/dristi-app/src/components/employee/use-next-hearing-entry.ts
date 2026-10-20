"use client";

import * as React from "react";

import {
  readNextHearingEntry,
  serverNextHearingEntry,
  setNextHearingEntry,
  subscribeToNextHearingEntry,
  type NextHearingEntry,
} from "@/lib/employee/next-hearing-entry";

export function useNextHearingEntry(): [
  NextHearingEntry,
  (entry: NextHearingEntry) => void,
] {
  const entry = React.useSyncExternalStore(
    subscribeToNextHearingEntry,
    readNextHearingEntry,
    serverNextHearingEntry,
  );
  return [entry, setNextHearingEntry];
}

/**
 * Whether the reader enters the next hearing on the cause list — the setting on Reader. Everything that changes with it asks this one question:
 * the cause list's Next hearing column, the case overview's fields, and whether order
 * screen E shows the posting disabled.
 */
export function useReaderPostsNextHearing(): boolean {
  const [entry] = useNextHearingEntry();
  return entry === "reader";
}
