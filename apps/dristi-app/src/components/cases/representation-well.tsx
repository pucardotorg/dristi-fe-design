"use client";

/**
 * An advocate's well in the Parties detail pane, with the removal entry
 * point (scenarios 3a/3b) riding on it: you act on the person where you
 * see them. The well matches the pane's other fact wells; Remove is the
 * row's one action, destructive-ghost like the access list's rows, and
 * opens the shared removal flow.
 *
 * Once a removal has gone out, the well is the requester's waiting view:
 * the second line says what was asked and who it waits on, and Remove
 * retires so the same request cannot be raised twice. Session-local — the
 * real record of a pending request is the tasks service.
 */

import { displayName } from "@/lib/cases/names";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import type { CaseRef } from "@/components/cases/party-application";
import { RemoveAdvocateDialog } from "@/components/cases/remove-advocate-dialog";

const PENDING_LINE = {
  consent: "Removal requested · awaiting consent",
  magistrate: "Removal requested · awaiting order",
} as const;

export function RepresentationWell({
  advocate,
  partyName,
  caseRef,
}: {
  advocate: string;
  /** The litigant this pane belongs to, for the dialog's copy. */
  partyName: string;
  caseRef: CaseRef;
}) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState<keyof typeof PENDING_LINE | null>(null);

  return (
    <>
      <div className="flex min-h-12 min-w-0 items-center gap-2 rounded-md bg-surface-sunken py-2 pr-2 pl-3">
        <span className="flex min-w-0 flex-1 flex-col justify-center gap-1">
          {/* The same name line as every well beside it, "(you)" included:
              one size, no "Adv." (owner, Oct 8). */}
          <span className="block truncate text-body-compact font-medium text-foreground">
            {displayName(advocate)}
          </span>
          {pending ? (
            <span className="block truncate text-caption text-muted-foreground">
              {PENDING_LINE[pending]}
            </span>
          ) : null}
        </span>
        {!pending ? (
          <Button
            type="button"
            variant="destructive-ghost"
            size="sm"
            className="shrink-0"
            onClick={() => setOpen(true)}
          >
            Remove
          </Button>
        ) : null}
      </div>
      <RemoveAdvocateDialog
        open={open}
        onOpenChange={setOpen}
        advocateName={displayName(advocate)}
        partyName={partyName}
        caseRef={caseRef}
        onRequested={setPending}
      />
    </>
  );
}
