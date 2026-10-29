"use client";

import * as React from "react";
import type { LucideIcon } from "lucide-react";

import { notify } from "@/components/feedback";

import { PAGED_KINDS } from "@/lib/tasks/permissions";
import { useTasks } from "@/lib/tasks/store";
import { type Transition, TransitionError } from "@/lib/tasks/transitions";
import type { Task, TaskId } from "@/lib/tasks/types";

/**
 * The act-modal flavours. Only paying and uploading documents act in the modal (the
 * owner's rule); signing, fixing a return and filing-flow drafts continue in their own
 * full pages — see `actPathOf`.
 */
export type ActMode = "pay" | "file";

const MODE_OF: Partial<Record<Task["kind"], ActMode>> = {
  pay: "pay",
  file: "file",
  draft: "file",
};

/** The act modal for a task, if its kind acts in place. Hearing tasks are done in court. */
export function actModeOf(task: Task): ActMode | null {
  if (!PAGED_KINDS.has(task.kind)) return null;
  return MODE_OF[task.kind] ?? null;
}

/** The full page a task's flow continues on, for the kinds that left the modal. */
export function actPathOf(task: Task): string | null {
  if (task.kind === "sign") return `/tasks/${encodeURIComponent(task.id)}/sign`;
  if (task.kind === "returned") return `/tasks/${encodeURIComponent(task.id)}/fix`;
  return null;
}

/**
 * The flows that leave the current screen for their own page, each behind a
 * dialog that says so. Signing and the scrutiny correction round are both built
 * and live in their own flows; e-filing (drafts) is not built yet, so its page
 * is still interim. Shared by every screen that lets a task act in place.
 */
export type Flow = "sign" | "scrutiny" | "filing";

export const FLOW_DIALOG: Record<Flow, { title: string; description: string }> = {
  sign: {
    title: "Continuing in the signing flow",
    description: "Signing happens in its own flow. We'll bring you back here when it's done.",
  },
  scrutiny: {
    title: "Continuing in the scrutiny flow",
    description:
      "Correcting the defects happens in the scrutiny flow, on the filing itself. We'll bring you back here when the corrections have gone to the Registry.",
  },
  filing: {
    title: "Continuing in the filing flow",
    description:
      "Drafting and filing happens in the e-filing flow, which is not built yet — this is an interim screen. We'll bring you back here when it's done.",
  },
};

/** Where each flow's page lives for a task. */
export function flowPathOf(flow: Flow, task: Task): string {
  const id = encodeURIComponent(task.id);
  if (flow === "sign") return `/tasks/${id}/sign`;
  if (flow === "scrutiny") return `/tasks/${id}/fix`;
  return `/tasks/${id}/continue`;
}

/** The flow a Continue verb hands its draft to — by the kind the draft will become. */
export function draftFlowOf(task: Task): Flow | null {
  if (task.kind === "sign") return "sign";
  if (task.kind === "returned") return "scrutiny";
  if (task.kind === "pay") return null; // paying acts in place — the modal
  return "filing";
}

/**
 * `dispatch` with the toast and error handling every screen wants: a quiet success
 * message, and the transition's own words when it refuses.
 */
export function useTaskActions() {
  const { dispatch, online } = useTasks();
  const [busy, setBusy] = React.useState<TaskId | null>(null);

  const act = React.useCallback(
    async (
      taskId: TaskId,
      transition: Transition,
      /* What to say once it lands. An `icon` makes it neutral: not news (a draft saved,
         a task restored), said quietly with the act's own icon (skill `feedback-states`). */
      done?: string | { title: string; icon: LucideIcon },
    ): Promise<Task | null> => {
      if (!online) {
        notify.error("You are offline. Nothing was changed.");
        return null;
      }
      setBusy(taskId);
      try {
        const task = await dispatch(taskId, transition);
        if (typeof done === "string") notify.success(done);
        else if (done) notify.neutral(done.title, { icon: done.icon });
        return task;
      } catch (e) {
        const message =
          e instanceof TransitionError ? e.message : "Something went wrong. Nothing was changed.";
        notify.error(message);
        return null;
      } finally {
        setBusy(null);
      }
    },
    [dispatch, online]
  );

  return { act, busy, online };
}
