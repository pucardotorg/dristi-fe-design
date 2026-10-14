import type { CourtId } from "@/lib/court/profiles";

import type { Task } from "./types";

/** A process fee — paying for the court's process (summons, warrants) to issue. */
export function isProcessFee(task: Task): boolean {
  return task.feeHead === "Process fee" || /\bprocess fee\b/i.test(task.title);
}

/**
 * The tasks an advocate in `court` is asked to do. The sandbox is one set for every
 * state; this takes out the work a state does not have.
 *
 * Gujarat: no process fees (owner, 2026-10-14) — every task to pay one is left out,
 * wherever it would show (Take action, the home rail, a hearing's pending chip).
 */
export function tasksForCourt(tasks: Task[], court: CourtId): Task[] {
  if (court === "gujarat") return tasks.filter((task) => !isProcessFee(task));
  return tasks;
}
