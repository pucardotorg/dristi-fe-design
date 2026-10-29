"use client";

import * as React from "react";
import { LockIcon } from "lucide-react";

import { AlertDialogMedia } from "@/components/ui/alert-dialog";

import { StatusMark } from "./mark";

/**
 * The question before a risky act. A confirm is a question, not an outcome, so it never
 * wears the cross or the "!". Its mark shows the act itself (a person leaving, a bin, a
 * pen), sitting in the alert dialog's own media slot:
 *
 * - **danger** for a removal: the soft red of the destructive button. The confirm button
 *   stays `variant="destructive"` (soft red), never `destructive-solid`.
 * - **neutral** for an act that is normal but cannot be taken back (sign, pay, file). Not
 *   a warning: signing is the job. Its button stays primary.
 */
export function ConfirmMark({
  icon,
  danger = false,
}: {
  /** The act itself; a bin for a removal, an info icon otherwise, if none is given. */
  icon?: React.ComponentProps<typeof StatusMark>["icon"];
  danger?: boolean;
}) {
  return (
    <AlertDialogMedia className="mb-0 rounded-full bg-transparent">
      <StatusMark tone={danger ? "danger" : "neutral"} icon={icon} size={40} />
    </AlertDialogMedia>
  );
}

/** "This cannot be undone." on its own line with a lock, so it is read, not skimmed. */
export function IrreversibleNote({ children }: { children: React.ReactNode }) {
  return (
    <span className="mt-1 flex items-center gap-1.5 text-body-compact font-medium text-foreground">
      <LockIcon className="size-3.5 shrink-0" aria-hidden />
      {children}
    </span>
  );
}
