"use client";

import * as React from "react";

import { type CognizanceTab, type CognizanceTabSpec } from "@/lib/employee/cognizance";

/**
 * Which tab the queue should open on when a complaint sends the magistrate back to it.
 *
 * The queue is two tabs and a complaint is one page, so the way back has to say which
 * half of the register it is returning to. Without this, a bench working through the
 * late complaints lands on the timely ones after every decision — and since *Next
 * complaint* stays on the tab (`nextCognizanceCase`), Back would be the one control in
 * the loop that moved them.
 *
 * It cannot be read off the URL: `/employee/cognizance` is both tabs, and the complaint
 * it came from is gone by the time the queue mounts. So the control that navigates says
 * where it is going, and the screen that mounts takes it — `useArrival`'s bargain, for
 * the same three reasons. A module variable rather than storage: it is one hop, it must
 * not survive a reload (a refreshed queue has not come back from anywhere), and nothing
 * else should be able to read it.
 */
let pending: CognizanceTab | null = null;

/** Called by the control that navigates back to the queue, just before it does. */
export function markCognizanceTab(tab: CognizanceTab): void {
  pending = tab;
}

/**
 * Taken once, by the queue as it mounts. The first tab on a fresh load, a refresh, a
 * typed URL or a bookmark — none of those has come back from a complaint.
 */
export function useReturnedTab(tabs: CognizanceTabSpec[]): CognizanceTab {
  const [tab] = React.useState(() => {
    const returned = pending;
    pending = null;
    return returned && tabs.some((entry) => entry.id === returned) ? returned : tabs[0].id;
  });
  return tab;
}
