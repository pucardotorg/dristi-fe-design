"use client";

import * as React from "react";

import {
  readHearingSession,
  serverHearingSession,
  subscribeToHearingSession,
  type HearingSession,
} from "@/lib/employee/hearing-session";

/**
 * This sitting's marks, from wherever on the court side the screen is standing.
 *
 * `useSyncExternalStore` over a provider because the store has to outlive the cause
 * list, and the cause list is what unmounts when the bench walks into the order
 * composer — the one trip out of the day that is left, now that reading a matter opens
 * a sheet over the list and calling one opens nothing. The marks still have to be there
 * when the composer lands, and still there when the trail brings the bench back. The
 * server snapshot is the same empty session the module starts at, so the first paint and
 * hydration agree and there is nothing to suppress.
 */
export function useHearingSession(): HearingSession {
  return React.useSyncExternalStore(
    subscribeToHearingSession,
    readHearingSession,
    serverHearingSession,
  );
}
