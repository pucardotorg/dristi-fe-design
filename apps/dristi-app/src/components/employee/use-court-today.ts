"use client";

import * as React from "react";

import { isoDay } from "@/lib/employee/hearings";

/**
 * The day the bench is sitting on is the reader's, not the server's — a court in
 * Kerala should not be shown yesterday's list because the process serving it woke
 * up somewhere else. The server renders its own guess and the browser replaces it
 * on hydration, so there is no mismatch to suppress and no blank first paint. It
 * does not re-subscribe; a screen left open across midnight is settled by the next
 * navigation.
 *
 * Shared by the cause list and by one listing's case overview, which has to place
 * today's sitting on that case's history. Two copies of this would eventually
 * disagree about what day it is on the same screen.
 */
const NEVER_CHANGES = () => () => {};
const readToday = () => isoDay(new Date());

export function useCourtToday(): string {
  return React.useSyncExternalStore(NEVER_CHANGES, readToday, readToday);
}
