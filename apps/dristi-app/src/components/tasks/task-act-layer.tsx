"use client";

import { isApplicationTask } from "@/components/tasks/act/task-flows";
import { TaskViewDialog } from "@/components/tasks/act/task-view-dialog";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ArrowRightIcon, ListChecksIcon } from "lucide-react";

import { verbFor } from "@/lib/tasks/permissions";
import { caseOf } from "@/lib/tasks/selectors";
import { useTasks } from "@/lib/tasks/store";
import { withOrigin } from "@/lib/nav/origin";
import { useHereHref } from "@/components/shell/origin";
import { markDone } from "@/lib/tasks/transitions";
import type { Task } from "@/lib/tasks/types";
import { ConfirmDialog } from "@/components/shell/confirm-dialog";
import { TaskActModal } from "@/components/tasks/act/act-modal";
import { TaskRespondDialog } from "@/components/tasks/act/respond-dialog";
import {
  type ActMode,
  type Flow,
  actModeOf,
  draftFlowOf,
  FLOW_DIALOG,
  flowPathOf,
  useTaskActions,
} from "@/components/tasks/use-task-actions";

/**
 * Acting on a task from any screen, without leaving it — the same decision
 * table /tasks runs, packaged: pay and file open the act modal in place;
 * signing, fixing a return and continuing a draft go to their own pages behind
 * the dialog that says so; hearing tasks confirm mark-as-done; anything else
 * opens the task on /tasks.
 *
 * `run(task)` routes by the viewer's verb; render `layer` once, anywhere in the
 * tree. Completions land in the shared store, so every surface reading the
 * world updates together.
 */
export function useTaskAct() {
  const store = useTasks();
  const router = useRouter();
  // Whichever screen is hosting the layer — the flow's way back.
  const here = useHereHref();
  const { act } = useTaskActions();

  const [acting, setActing] = React.useState<{ task: Task; mode: ActMode } | null>(null);
  const [flowNotice, setFlowNotice] = React.useState<{ task: Task; flow: Flow } | null>(null);
  const [confirmDone, setConfirmDone] = React.useState<Task | null>(null);
  const [responding, setResponding] = React.useState<Task | null>(null);
  const [viewing, setViewing] = React.useState<Task | null>(null);

  const run = React.useCallback(
    (task: Task) => {
      const kase = caseOf({ cases: store.cases }, task);
      if (!kase) return;
      const verb = verbFor(store.user, task, kase);
      switch (verb) {
        case "Pay":
        case "File": {
          const mode = actModeOf(task);
          if (mode) setActing({ task, mode });
          return;
        }
        case "Sign":
          setFlowNotice({ task, flow: "sign" });
          return;
        case "Re-file":
          setFlowNotice({ task, flow: "scrutiny" });
          return;
        case "Continue": {
          /* A drafted application is finished in View case's Raise application, over
             this page (`task-flows.tsx`), not on the filing flow's own page. */
          if (isApplicationTask(task)) {
            setActing({ task, mode: "file" });
            return;
          }
          const flow = draftFlowOf(task);
          if (flow) setFlowNotice({ task, flow });
          else {
            const mode = actModeOf(task);
            if (mode) setActing({ task, mode });
          }
          return;
        }
        case "Respond":
          setResponding(task);
          return;
        case "Mark done":
          setConfirmDone(task);
          return;
        default:
          // Waiting or closed — opened to look at, in its view window over the page
          // (owner, 2026-10-14), not on the task list.
          setViewing(task);
      }
    },
    [store.cases, store.user]
  );

  const actingCase = acting ? (caseOf({ cases: store.cases }, acting.task) ?? null) : null;

  const viewingCase = viewing ? (caseOf({ cases: store.cases }, viewing) ?? null) : null;

  const layer = (
    <>
      <TaskViewDialog
        task={viewing ? (store.tasks.find((t) => t.id === viewing.id) ?? viewing) : null}
        kase={viewingCase}
        open={!!viewing && !!viewingCase}
        onOpenChange={(open) => {
          if (!open) setViewing(null);
        }}
      />
      <TaskActModal
        task={acting?.task ?? null}
        kase={actingCase}
        mode={acting?.mode ?? null}
        open={!!acting && !!actingCase}
        onOpenChange={(open) => {
          if (!open) setActing(null);
        }}
        onFinished={(id) => store.requestHighlight(id)}
      />

      <TaskRespondDialog
        task={responding}
        kase={responding ? (caseOf({ cases: store.cases }, responding) ?? null) : null}
        open={!!responding}
        onOpenChange={(open) => {
          if (!open) setResponding(null);
        }}
        onFinished={(id) => store.requestHighlight(id)}
      />

      <ConfirmDialog
        open={!!flowNotice}
        onOpenChange={(open) => !open && setFlowNotice(null)}
        title={flowNotice ? FLOW_DIALOG[flowNotice.flow].title : ""}
        description={flowNotice ? FLOW_DIALOG[flowNotice.flow].description : undefined}
        confirmLabel="Continue"
        destructive={false}
        icon={ArrowRightIcon}
        onConfirm={() => {
          const notice = flowNotice;
          setFlowNotice(null);
          if (notice) router.push(withOrigin(flowPathOf(notice.flow, notice.task), here));
        }}
      />

      <ConfirmDialog
        open={!!confirmDone}
        onOpenChange={(open) => !open && setConfirmDone(null)}
        title="Mark as done?"
        description={
          confirmDone
            ? `“${confirmDone.title}” — this records that it was completed outside DRISTI. Nothing is sent to the court.`
            : undefined
        }
        confirmLabel="Mark as done"
        destructive={false}
        icon={ListChecksIcon}
        onConfirm={() => {
          const task = confirmDone;
          setConfirmDone(null);
          if (task) void act(task.id, markDone, "Marked as done");
        }}
      />
    </>
  );

  return { run, layer };
}
