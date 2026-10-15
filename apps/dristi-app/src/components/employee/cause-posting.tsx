"use client";

import * as React from "react";

/**
 * Whether the order on screen takes its next hearing from the cause list (owner,
 * 2026-10-15). A hearing's order on screen E does: the date and purpose are set in the
 * cause list's Next hearing column, and the order's own Next hearing fields stay where they were
 * but are disabled. An order outside a hearing has no cause list and keeps its fields.
 *
 * A context rather than a prop because five composers draw the Next hearing region, and
 * the door that opens them is the one place that knows whether a hearing is behind it.
 */
export const CausePostingContext = React.createContext(false);

export function useFromCauseList(): boolean {
  return React.useContext(CausePostingContext);
}

/** The line under a disabled Next hearing that says where it is set. */
export function CausePostingNote({ set }: { set: boolean }) {
  return (
    <p className="text-body-compact text-muted-foreground">
      {set
        ? "Set on the cause list."
        : "Not set yet. It is set on the cause list, in the Next hearing column."}
    </p>
  );
}
