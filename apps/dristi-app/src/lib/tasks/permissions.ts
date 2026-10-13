/**
 * Who may do what — the owner's rule, in code. File-share permissions:
 *
 *   on the case (`Case.advocates`)        → may see the task and prepare it (draft, ready)
 *   on the vakalatnama (`Case.signatories`) → may also complete it (sign, pay, file)
 *
 * No assignment, no approval routing. Every verb on every row is derived from these
 * functions at render time; nothing is cached per row, so switching identity re-derives
 * everything.
 */

import type { Case, Person, PersonId, Task, TaskCategory, TaskKind, TaskStatus, TaskView, Verb } from "./types";

function idOf(user: Person | PersonId): PersonId {
  return typeof user === "string" ? user : user.id;
}

/** On the case. A signatory is always on the case, whatever the advocates list says. */
export function canView(user: Person | PersonId, kase: Case): boolean {
  const id = idOf(user);
  return kase.advocates.includes(id) || kase.signatories.includes(id);
}

/** On the vakalatnama — may sign, pay and file. */
export function canComplete(user: Person | PersonId, kase: Case): boolean {
  return kase.signatories.includes(idOf(user));
}

/**
 * Whether this person sees this task. `visibility` defaults to `"case"` — everyone on
 * the case's side. `"actors"` narrows it to the people who can act on it: the
 * vakalatnama holders for completing kinds, anyone on the case for the kinds everyone
 * acts on (hearing tasks, drafts). A seam for the 1.0 attributes doc's Visibility —
 * every seeded task stays `"case"`.
 */
export function canViewTask(user: Person | PersonId, task: Task, kase: Case): boolean {
  if (!canView(user, kase)) return false;
  if ((task.visibility ?? "case") === "case") return true;
  if (task.kind === "hearing" || task.status === "draft") return true;
  // A review task's one actor is its addressee.
  if (task.kind === "review") return !task.review?.of || idOf(user) === task.review.of;
  return canComplete(user, kase);
}

/** The main advocate: first on the vakalatnama. */
export function mainAdvocateOf(kase: Case): PersonId | undefined {
  return kase.signatories[0];
}

/** The case's advocates as people, main advocate first, then the rest in case order. */
export function advocatesOf(kase: Case, people: Person[]): Person[] {
  const ids = [...kase.signatories, ...kase.advocates.filter((id) => !kase.signatories.includes(id))];
  return ids.map((id) => people.find((p) => p.id === id)).filter(Boolean) as Person[];
}

/** The signatories as people, in vakalatnama order. */
export function signatoriesOf(kase: Case, people: Person[]): Person[] {
  return kase.signatories
    .map((pid) => people.find((p) => p.id === pid))
    .filter(Boolean) as Person[];
}

export const TERMINAL: ReadonlySet<TaskStatus> = new Set(["done", "expired", "obsolete"]);
export const WAITING: ReadonlySet<TaskStatus> = new Set(["awaiting-court", "payment-confirming"]);
/** States someone on the case can still act on. */
export const ACTIONABLE: ReadonlySet<TaskStatus> = new Set(["open", "draft", "ready"]);

/**
 * Whether the task's deadline still binds anyone. Once it is closed, archived, or
 * waiting on the court or the gateway, the date is history — which is why the Due cell
 * drops the overdue ink there, and why the Overdue filter and the Overdue band have to
 * ask this same question rather than compare dates on their own (2026-09-15).
 */
export function isBinding(task: Task): boolean {
  return !TERMINAL.has(task.status) && !WAITING.has(task.status) && task.status !== "archived";
}
/** Verbs that make a task this viewer's move — the Needs-action test. */
const ACTING: ReadonlySet<Verb> = new Set(["Sign", "Pay", "File", "Re-file", "Continue", "Respond", "Mark done"]);

/**
 * Which tab a task belongs to — viewer-dependent. Needs action means this viewer holds
 * an acting verb: a signatory on open/ready items of kinds they can complete, anyone on
 * the case on a draft or a hearing task. A ready or open item that needs a vakalatnama
 * holder is Waiting from everyone else's chair (they can only view it). Closed tasks are
 * Completed; archived tasks have their own tab.
 */
export function viewOf(task: Task, user: Person | PersonId, kase: Case): TaskView {
  if (task.status === "archived") return "archived";
  if (TERMINAL.has(task.status)) return "completed";
  if (WAITING.has(task.status)) return "waiting";
  return ACTING.has(verbFor(user, task, kase)) ? "needs-action" : "waiting";
}

/**
 * The advocates who can act on this task now: those for whom it is their move. For a
 * signing, paying or filing task that is the vakalatnama holders; for a courtroom task
 * or a draft it is everyone on the case; for a task closed or waiting on the court it is
 * nobody. Derived from `viewOf`, so the answer cannot drift from the tab a person finds
 * the task under.
 */
export function whoCanActOn(task: Task, kase: Case, people: Person[]): Person[] {
  return advocatesOf(kase, people).filter((p) => viewOf(task, p, kase) === "needs-action");
}

/**
 * Which category pill a task counts under — by the **act it still needs**, never by how
 * far along it is (owner, 2026-08-24).
 *
 * "Draft" is not an act, it is a state — a half-written filing is still *File/Submit*,
 * and a scrutiny return stays there until it goes back. Counting
 * started work under a separate "Drafts" card took it out of the queue it belongs to and
 * made the same task move between cards just because someone opened it.
 *
 * Nothing is lost: that a task is in progress still shows on the row (the second line
 * says who saved it and when) and in its verb, which reads *Continue* rather than *Start*.
 */
export function categoryOf(task: Task): TaskCategory {
  return CATEGORY_OF_KIND[task.kind];
}

/**
 * Kind → PRD category. A scrutiny return is File/Submit, as the Coda catalogue files
 * "Correct defects"; a draft is the filing it will become. Review requests and hearing
 * tasks (being present, producing a witness) are none of pay, sign or file — Others.
 */
const CATEGORY_OF_KIND: Record<TaskKind, TaskCategory> = {
  pay: "pay",
  sign: "sign",
  file: "file",
  returned: "file",
  draft: "file",
  review: "others",
  hearing: "others",
};

/** Kinds that have their own act flow. Hearing tasks are done in court. */
export const PAGED_KINDS: ReadonlySet<Task["kind"]> = new Set(["sign", "pay", "file", "returned", "draft"]);

/**
 * Any open-state task may be marked done by hand by anyone on the case — work gets
 * completed at the counter or in court, outside DRISTI, and the record should say so.
 */
export function canMarkDone(user: Person | PersonId, task: Task, kase: Case): boolean {
  return ACTIONABLE.has(task.status) && canView(user, kase);
}

/** Anything not yet closed can be put away; unarchive brings it back. */
export function canArchive(user: Person | PersonId, task: Task, kase: Case): boolean {
  if (TERMINAL.has(task.status) || task.status === "archived") return false;
  return canView(user, kase);
}

/** The completing verb for a paged kind. */
export function completeVerbOf(kind: Task["kind"]): Verb {
  switch (kind) {
    case "sign":
      return "Sign";
    case "pay":
      return "Pay";
    case "returned":
      return "Re-file";
    default:
      return "File";
  }
}

/** What a task needs from its signatory: "signature" · "payment" · "filing". */
export function needOf(kind: Task["kind"]): "signature" | "payment" | "filing" {
  if (kind === "sign") return "signature";
  if (kind === "pay") return "payment";
  return "filing";
}

/**
 * The one verb a row shows this person. "View" means there is nothing for them to do
 * — the task is waiting on others (including a ready item that needs a vakalatnama
 * holder they are not), closed, or outside their access.
 */
export function verbFor(user: Person | PersonId, task: Task, kase: Case): Verb {
  const id = idOf(user);
  if (!canView(id, kase)) return "View";
  if (task.status === "archived") return "Unarchive";
  if (!ACTIONABLE.has(task.status)) return "View";

  if (task.kind === "hearing") return "Mark done";
  // A review task waits for its addressee's decision — everyone else watches it wait.
  if (task.kind === "review") return !task.review?.of || id === task.review.of ? "Respond" : "View";
  if (task.status === "draft") return "Continue";
  return canComplete(id, kase) ? completeVerbOf(task.kind) : "View";
}
