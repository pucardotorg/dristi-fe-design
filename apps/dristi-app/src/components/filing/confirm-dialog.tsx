"use client";

import * as React from "react";

import { ChromeAlertDialogContent } from "@/components/chrome/app-chrome";
import { ConfirmMark, IrreversibleNote, StatusMark } from "@/components/feedback";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

/**
 * "Are you sure?" before a risky act. It is a question, not an outcome
 * (skill `feedback-states`):
 * - `destructive` (the default, for removals and discards): a soft red mark showing the
 *   act (`icon`, a bin by default) and the soft red confirm button, never solid red.
 * - not destructive: a neutral mark when an `icon` is given (an act that cannot be taken
 *   back, such as signing), otherwise a plain question. The confirm stays primary.
 * - `note`: "This cannot be undone." on its own line with a lock, so it is read.
 */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = "Yes, remove",
  cancelLabel = "Cancel",
  destructive = true,
  icon,
  note,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: React.ReactNode;
  description?: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  /** The act itself (a person leaving, a bin, a pen). */
  icon?: React.ComponentProps<typeof StatusMark>["icon"];
  note?: React.ReactNode;
  onConfirm: () => void;
}) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <ChromeAlertDialogContent>
        <AlertDialogHeader>
          {destructive || icon ? <ConfirmMark danger={destructive} icon={icon} /> : null}
          <AlertDialogTitle>{title}</AlertDialogTitle>
          {description || note ? (
            <AlertDialogDescription>
              {description ? <span className="block">{description}</span> : null}
              {note ? <IrreversibleNote>{note}</IrreversibleNote> : null}
            </AlertDialogDescription>
          ) : null}
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{cancelLabel}</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm} variant={destructive ? "destructive" : "default"}>
            {confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </ChromeAlertDialogContent>
    </AlertDialog>
  );
}
