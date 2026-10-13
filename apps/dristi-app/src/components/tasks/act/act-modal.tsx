"use client";

/**
 * The act modal: pay and file complete right here — a `Dialog` over the table from `md`
 * (a full-height `Sheet` below it), reusing the act bodies. On completion the toast
 * fires, the modal closes and the row updates in place; nothing navigates. Signing,
 * fixing a scrutiny return and filing-flow drafts do NOT act here — those continue in
 * their own full pages (`/tasks/[id]/sign` · `/fix` · `/continue`) behind a dialog that
 * says so.
 */

import * as React from "react";
import { toast } from "sonner";

import { FlowDialogContent } from "@/components/chrome/flow-dialog";

import { canComplete } from "@/lib/tasks/permissions";
import { useTasks } from "@/lib/tasks/store";
import type { Case, Task, TaskId } from "@/lib/tasks/types";
import {
  Dialog,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { type ActContext } from "@/components/tasks/act/shared";
import { type ActMode } from "@/components/tasks/use-task-actions";
import { FileBody } from "@/components/tasks/act/file-page";
import { PayBody } from "@/components/tasks/act/pay-page";
import { Identifier } from "@/components/chrome/identifier";
import { useCourtText } from "@/components/court/court-provider";

/** The one quiet line per flow that says what is not real here. */
const SANDBOX: Record<ActMode, string> = {
  pay: "Sandbox — no money moves; the gateway's answer is whatever you pick and the receipt is generated locally.",
  file: "Sandbox — uploads stay in this browser and the registry's answer is whatever you pick.",
};

/** The document column reads better with room; pay is a summary and stays narrow. */
const WIDTH: Record<ActMode, string> = {
  pay: "sm:max-w-xl",
  file: "sm:max-w-2xl",
};

function Body({ ctx, mode }: { ctx: ActContext; mode: ActMode }) {
  switch (mode) {
    case "pay":
      return <PayBody ctx={ctx} />;
    case "file":
      return <FileBody ctx={ctx} />;
  }
}

export function TaskActModal({
  task,
  kase,
  mode,
  open,
  onOpenChange,
  onFinished,
}: {
  task: Task | null;
  kase: Case | null;
  mode: ActMode | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called with the task to flash once a step lands — the created re-filing task, or this one. */
  onFinished?: (taskId: TaskId) => void;
}) {
  const courtText = useCourtText();
  const { user, people, online } = useTasks();

  const finish = React.useCallback(
    (message?: string, taskId?: string) => {
      if (message) toast.success(message);
      onOpenChange(false);
      if (task) onFinished?.(taskId ?? task.id);
    },
    [onOpenChange, onFinished, task]
  );

  if (!task || !kase || !mode) return null;

  const ctx: ActContext = {
    task,
    kase,
    user,
    people,
    online,
    signatory: canComplete(user, kase),
    finish,
  };

  const caseLine = (
    <>
      {kase.parties}
      {kase.stNumber ? (
        <>
          {" · "}
          {/* Inside the dialog's accessible description — a copy control here would be
              announced as part of the description and could take the dialog's first focus,
              so the face is restored without the affordance. */}
          <Identifier value={kase.stNumber} label="case number" copyable={false} />
        </>
      ) : (
        " · Not yet numbered"
      )}
      {" · "}
      {courtText(kase.court)}
    </>
  );

  // One dialog at every width. On a phone `FlowDialogContent` turns it into the
  // window that slides in from the right (lead designer, Sept 21: no full-height
  // sheets for a workflow); it replaced a bottom `Sheet` that stood the full
  // height of the screen.
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <FlowDialogContent className={`max-h-[85svh] w-full overflow-y-auto ${WIDTH[mode]}`}>
        <DialogHeader className="pr-8 text-left">
          <DialogTitle className="text-title-s font-semibold text-balance">{task.title}</DialogTitle>
          <DialogDescription className="text-caption text-muted-foreground">{caseLine}</DialogDescription>
        </DialogHeader>
        <p className="text-caption text-muted-foreground">{SANDBOX[mode]}</p>
        <Body ctx={ctx} mode={mode} />
      </FlowDialogContent>
    </Dialog>
  );
}
