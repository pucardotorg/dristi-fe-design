"use client";

import * as React from "react";
import { CheckIcon, ClockIcon } from "lucide-react";

import { FlowDialogContent } from "@/components/chrome/flow-dialog";
import { Identifier } from "@/components/chrome/identifier";
import { TaskCaseLine } from "@/components/tasks/act/task-flows";
import { useTaskActions } from "@/components/tasks/use-task-actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DescriptionDetails,
  DescriptionList,
  DescriptionRow,
  DescriptionTerm,
} from "@/components/ui/description-list";
import {
  Dialog,
  DialogClose,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { dateTime, longDate, outcomeOf, rupees, waitingOnOf } from "@/lib/tasks/format";
import { canComplete } from "@/lib/tasks/permissions";
import { useTasks } from "@/lib/tasks/store";
import { confirmPayment } from "@/lib/tasks/transitions";
import type { Case, Task } from "@/lib/tasks/types";

/**
 * **A task to look at, not to act on — in a window over the list** (owner, 2026-10-14).
 *
 * "View" on a task waiting on someone else, done, or archived used to leave the screen
 * (a signing or a correction round for its own page, the home rail for the task list).
 * It opens here instead, the way every record in the product reads: the task and its
 * case in the header, where it stands as one chip, then only what the task itself
 * records — when it is due, the fee and amount, the documents and the files against
 * them, the receipt, who did it and when — and its history. Nothing is restated from
 * elsewhere and nothing is inferred.
 *
 * The one act it keeps is the sandbox's answer to a payment the gateway is still
 * confirming, which has nowhere else to happen.
 */
export function TaskViewDialog({
  task,
  kase,
  open,
  onOpenChange,
}: {
  task: Task | null;
  kase: Case | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open && !!task && !!kase} onOpenChange={onOpenChange}>
      {task && kase ? (
        <ViewBody key={task.id} task={task} kase={kase} onClose={() => onOpenChange(false)} />
      ) : null}
    </Dialog>
  );
}

function ViewBody({ task, kase, onClose }: { task: Task; kase: Case; onClose: () => void }) {
  const { people, user, online } = useTasks();
  const { act, busy } = useTaskActions();
  const closed = ["done", "expired", "obsolete", "archived"].includes(task.status) || Boolean(task.archived);
  const standing = closed ? outcomeOf(task) : waitingOnOf(task, kase, people);
  const by = people.find((p) => p.id === task.completion?.by);
  const fileFor = (slot: string) => task.files?.filter((f) => f.slot === slot) ?? [];
  const loose = task.files?.filter((f) => !f.slot || !task.documentsNeeded?.includes(f.slot)) ?? [];
  const reference = task.completion?.receipt ?? task.lastPayment?.ref;
  const uploads = task.kind === "file" || task.kind === "draft";

  return (
    <FlowDialogContent className="max-h-[85svh] w-full overflow-y-auto sm:max-w-xl">
      <DialogHeader className="pr-8 text-left">
        <div className="flex flex-wrap items-center gap-2">
          <DialogTitle className="text-title-s font-semibold text-balance">{task.title}</DialogTitle>
          <Badge variant={task.status === "done" ? "success" : closed ? "secondary" : "info"}>
            {task.status === "done" ? <CheckIcon aria-hidden /> : closed ? null : <ClockIcon aria-hidden />}
            {standing}
          </Badge>
        </div>
        <DialogDescription className="text-body-compact text-muted-foreground">
          <TaskCaseLine kase={kase} />
        </DialogDescription>
      </DialogHeader>

      <DescriptionList className="rounded-xl bg-surface-sunken px-4 py-1">
        {task.dueAt ? (
          <DescriptionRow className="border-hairline">
            <DescriptionTerm>Due</DescriptionTerm>
            <DescriptionDetails className="tabular-nums">
              {longDate(task.dueAt)}
              {task.deadlineNote ? (
                <span className="block text-body-compact text-muted-foreground">{task.deadlineNote}</span>
              ) : null}
            </DescriptionDetails>
          </DescriptionRow>
        ) : null}
        {task.feeHead ? (
          <DescriptionRow className="border-hairline">
            <DescriptionTerm>Fee</DescriptionTerm>
            <DescriptionDetails>{task.feeHead}</DescriptionDetails>
          </DescriptionRow>
        ) : null}
        {task.amountPaise !== undefined ? (
          <DescriptionRow className="border-hairline">
            <DescriptionTerm>Amount</DescriptionTerm>
            <DescriptionDetails className="font-semibold tabular-nums">{rupees(task.amountPaise)}</DescriptionDetails>
          </DescriptionRow>
        ) : null}
        {task.documentsNeeded?.length ? (
          <DescriptionRow className="border-hairline">
            <DescriptionTerm>Documents</DescriptionTerm>
            <DescriptionDetails>
              <ul className="flex flex-col gap-1">
                {task.documentsNeeded.map((name) => {
                  const files = fileFor(name);
                  return (
                    <li key={name} className="flex flex-col">
                      <span>{name}</span>
                      {/* Attaching is a filing's part; a signature is on the document itself. */}
                      {uploads || files.length ? (
                        <span className="text-body-compact text-muted-foreground">
                          {files.length ? files.map((f) => f.name).join(", ") : "Not attached"}
                        </span>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            </DescriptionDetails>
          </DescriptionRow>
        ) : null}
        {loose.length ? (
          <DescriptionRow className="border-hairline">
            <DescriptionTerm>Files</DescriptionTerm>
            <DescriptionDetails>{loose.map((f) => f.name).join(", ")}</DescriptionDetails>
          </DescriptionRow>
        ) : null}
        {reference ? (
          <DescriptionRow className="border-hairline">
            <DescriptionTerm>{task.completion?.receipt ? "Receipt" : "Gateway reference"}</DescriptionTerm>
            <DescriptionDetails>
              <Identifier value={reference} label="reference" />
            </DescriptionDetails>
          </DescriptionRow>
        ) : null}
        {task.completion ? (
          <DescriptionRow className="border-hairline">
            <DescriptionTerm>Completed</DescriptionTerm>
            <DescriptionDetails className="tabular-nums">
              {dateTime(task.completion.at)}
              {by ? ` · ${by.name}` : ""}
            </DescriptionDetails>
          </DescriptionRow>
        ) : null}
      </DescriptionList>

      {task.history.length ? (
        <section aria-labelledby={`history-${task.id}`} className="flex flex-col gap-2">
          <h3 id={`history-${task.id}`} className="text-body-compact font-semibold">
            History
          </h3>
          <ol className="flex flex-col border-l border-hairline pl-4">
            {[...task.history].reverse().map((entry, index) => (
              <li key={index} className="flex flex-col gap-0.5 py-1.5">
                <span className="text-body-compact">{entry.text}</span>
                <span className="text-caption text-muted-foreground tabular-nums">{dateTime(entry.at)}</span>
              </li>
            ))}
          </ol>
        </section>
      ) : null}

      <DialogFooter>
        {task.status === "payment-confirming" && canComplete(user, kase) ? (
          <Button
            type="button"
            variant="outline"
            disabled={!online || Boolean(busy)}
            onClick={() =>
              void act(task.id, confirmPayment).then((t) => {
                if (t) onClose();
              })
            }
          >
            Sandbox: the gateway confirms
          </Button>
        ) : null}
        <DialogClose asChild>
          <Button type="button">Close</Button>
        </DialogClose>
      </DialogFooter>
    </FlowDialogContent>
  );
}
