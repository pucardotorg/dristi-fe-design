/**
 * Filtering, sorting, grouping and counting — pure, over the loaded world.
 *
 * The screen's state (view tab, kind pill, the labelled filters, search) lives in the
 * URL as `Filters`.
 *
 * ## One count contract
 *
 * Every count on the screen follows the rows the list is showing, except the four tab
 * counts, which have to be cross-view to be any use. So a pill's number is what
 * pressing it yields — `categoryCounts` applies the whole filter set *except* the kind —
 * and a band's number is the rows under it. The pills used to be six cards counting the
 * tab while the table counted the filters, which is how a card could read 5 above an
 * empty list (2026-09-15).
 *
 * Everything here is presentation-agnostic: the home screen shows the same tasks in a
 * smaller frame, so grouping and counting live in this module rather than in the screen.
 */

import { canView, canViewTask, categoryOf, isBinding, TERMINAL, viewOf } from "./permissions";
import { compareUrgency, consequenceAt, daysUntil, isOverdue } from "./urgency";
import type { Case, TaskCategory, Person, PersonId, Task, TaskView } from "./types";
import { caseSearchKey } from "@/lib/court/localize";

/** Past its date *and* still binding — the one rule the cell, the filter and the band share. */
export function readsAsOverdue(task: Task, now: Date | string): boolean {
  return isBinding(task) && isOverdue(task, now);
}

export type DueFilter = "any" | "overdue" | "today" | "week" | "before-hearing";

export type Filters = {
  view: TaskView;
  /**
   * Every labelled filter holds a set, and an empty set means "any" (owner,
   * Sept 21: checkboxes, as on the Cases filters, so any combination can be
   * asked for). Within one filter the choices widen (Pay OR File); across
   * filters they narrow (Pay AND overdue).
   */
  kinds: TaskCategory[];
  /** Never holds "any": that is the empty set. */
  dues: DueFilter[];
  courts: string[];
  /** Advocates on the case. */
  advocates: PersonId[];
  query: string;
};

export const DEFAULT_FILTERS: Filters = {
  view: "needs-action",
  kinds: [],
  dues: [],
  courts: [],
  advocates: [],
  query: "",
};

/**
 * The PRD's citizen-side categories, in its order and its words (Pending Tasks
 * handover, attribute 6; the Coda catalogue's Category column). `categoryOf` decides
 * which one a task counts under.
 */
export const CATEGORY_ORDER = ["pay", "sign", "file", "others"] as const satisfies readonly TaskCategory[];

export const CATEGORY_LABELS: Record<TaskCategory, string> = {
  pay: "Pay",
  sign: "Sign",
  file: "File/Submit",
  others: "Others",
};

export const VIEW_LABELS: Record<TaskView, string> = {
  "needs-action": "Needs action",
  waiting: "Waiting on others",
  completed: "Completed",
  archived: "Archived",
};

export const DUE_LABELS: Record<DueFilter, string> = {
  any: "Any time",
  overdue: "Overdue",
  today: "Today",
  week: "This week",
  "before-hearing": "Before next hearing",
};

export type World = {
  people: Person[];
  cases: Case[];
  tasks: Task[];
  user: Person;
  now: Date | string;
};

export function caseOf(world: Pick<World, "cases">, task: Task): Case | undefined {
  return world.cases.find((c) => c.id === task.caseId);
}

export function personOf(world: Pick<World, "people">, id?: PersonId): Person | undefined {
  return id ? world.people.find((p) => p.id === id) : undefined;
}

/** Tasks this person sees: on the case, minus actors-only tasks they cannot act on. */
export function visibleTasks(world: World): Task[] {
  return world.tasks.filter((t) => {
    const kase = caseOf(world, t);
    return !!kase && canViewTask(world.user, t, kase);
  });
}

/** The visible tasks that belong to a tab — from the current person's chair. */
export function tasksInView(world: World, view: TaskView): Task[] {
  return world.tasks.filter((t) => {
    const kase = caseOf(world, t);
    return !!kase && canViewTask(world.user, t, kase) && viewOf(t, world.user, kase) === view;
  });
}

function matchesSearch(task: Task, kase: Case, q: string): boolean {
  const needle = caseSearchKey(q);
  if (!needle) return true;
  const hay = [task.title, kase.parties, kase.stNumber, kase.cnr, kase.court].join(" ").toLowerCase();
  return needle.split(/\s+/).every((word) => hay.includes(word));
}

function matchesDue(task: Task, due: DueFilter, now: Date | string): boolean {
  if (due === "any") return true;
  if (due === "before-hearing") return !!task.hearingAt && daysUntil(task.hearingAt, now) >= 0;
  // "Overdue" means what the row says it means. The filter used to compare dates of its
  // own accord, so a closed task could be listed under an Overdue chip while its own
  // Due cell refused the word (2026-09-15).
  if (due === "overdue") return readsAsOverdue(task, now);
  const at = consequenceAt(task);
  if (!at) return false;
  const days = daysUntil(at, now);
  if (due === "today") return days === 0;
  return days >= 0 && days <= 7;
}

/** Everything but the view and the card: the labelled filters and the search. */
function passesFilters(task: Task, kase: Case, f: Filters, now: Date | string): boolean {
  if (!matchesSearch(task, kase, f.query)) return false;
  if (f.courts.length && !f.courts.includes(kase.court)) return false;
  if (f.advocates.length && !f.advocates.some((id) => canView(id, kase))) return false;
  if (f.dues.length && !f.dues.some((due) => matchesDue(task, due, now))) return false;
  return true;
}

/** When a task closed — its completion, else its last history line. */
export function closedAt(task: Task): number {
  const at = task.completion?.at ?? task.history[task.history.length - 1]?.at ?? task.createdAt;
  return new Date(at).getTime();
}

/** Closed or put away — no urgency left to sort by. */
function settled(task: Task): boolean {
  return TERMINAL.has(task.status) || task.status === "archived";
}

/**
 * The list has exactly one order: how urgently it needs you (owner, 2026-08-24).
 *
 * There used to be a sort control — urgency, case name, kind. Nobody sorts a to-do list
 * alphabetically by case, and the cards already gather by kind; two of the three options
 * existed because tables conventionally sort, not because anyone needed them. The one
 * order that matters — blocks-a-hearing, then overdue, then due date — is now simply how
 * the list *is*, and the height the control occupied goes back to the tasks.
 */
export function sortTasks(world: World, tasks: Task[]): Task[] {
  const now = world.now;
  // Settled tasks have no urgency; the most recently closed or archived comes first.
  return [...tasks].sort((a, b) => {
    const ta = settled(a);
    const tb = settled(b);
    if (ta && tb) return closedAt(b) - closedAt(a) || compareUrgency(a, b, now);
    if (ta !== tb) return ta ? 1 : -1;
    return compareUrgency(a, b, now);
  });
}

/** The rows the table shows for the filters, most urgent first. */
export function applyFilters(world: World, f: Filters): Task[] {
  const rows = tasksInView(world, f.view).filter((t) => {
    const kase = caseOf(world, t)!;
    if (f.kinds.length && !f.kinds.includes(categoryOf(t) as TaskCategory)) return false;
    return passesFilters(t, kase, f, world.now);
  });
  return sortTasks(world, rows);
}

/** One count per pill. `draft` has no pill, so it is not a key here. */
export type CategoryCounts = Record<(typeof CATEGORY_ORDER)[number], number>;

/**
 * What each kind pill counts: the rows pressing it would leave. Every filter applies
 * except the kind itself, so a pill reading 5 always yields five rows — and the pill
 * row stays a control, not a second summary of the tab (2026-09-15).
 */
export function categoryCounts(world: World, f: Filters): CategoryCounts {
  const out = Object.fromEntries(CATEGORY_ORDER.map((k) => [k, 0])) as CategoryCounts;
  for (const t of tasksInView(world, f.view)) {
    const kase = caseOf(world, t);
    if (!kase || !passesFilters(t, kase, f, world.now)) continue;
    out[categoryOf(t)] += 1;
  }
  return out;
}

/* ───────────────────────────── when it bites ───────────────────────────── */

export type DueBucket = "overdue" | "today" | "week" | "later" | "none";

/**
 * The bands the open lists are cut into. Plain calendar language: a band says when the
 * work bites, so the first screenful is the part that hurts. Closed and archived lists
 * are not banded — they are ordered by when they closed, and "overdue" is meaningless
 * once nothing binds.
 */
export const DUE_BUCKET_ORDER: DueBucket[] = ["overdue", "today", "week", "later", "none"];

export const DUE_BUCKET_LABELS: Record<DueBucket, string> = {
  overdue: "Overdue",
  today: "Due today",
  week: "This week",
  later: "Later",
  none: "No date set",
};

/**
 * The views whose rows are banded by date — the main list, and only it.
 *
 * Waiting on others was banded too for an afternoon, and the bands lied: a filing that
 * has been with the court since 14 Aug is not binding, so it is not overdue and its own
 * Due cell prints a bare "Due 14 Aug" — under a band reading "Due today". Nothing there
 * is this viewer's move, the "Waiting on" column already says whose it is, and a band
 * has to be able to say something true about every row beneath it.
 */
export const BANDED_VIEWS: ReadonlySet<TaskView> = new Set<TaskView>(["needs-action"]);

export function dueBucketOf(task: Task, now: Date | string): DueBucket {
  if (readsAsOverdue(task, now)) return "overdue";
  const at = consequenceAt(task);
  if (!at) return "none";
  const days = daysUntil(at, now);
  // Inside a banded view every task still binds, so a non-positive count is today. A
  // settled task reaching here — from a caller that bands a closed list — would land
  // under Today with a cell that refuses the word, which is why `BANDED_VIEWS` is one
  // view and this function is not asked about the others.
  if (days <= 0) return "today";
  if (days <= 7) return "week";
  return "later";
}

export type DueBand = { bucket: DueBucket; label: string; tasks: Task[] };

/**
 * Cut an already-sorted list into its bands, keeping `sortTasks`'s order inside each
 * one. Empty bands are dropped, so a list with nothing overdue shows no Overdue band.
 *
 * Banding does outrank one part of the comparator, and deliberately: `compareUrgency`
 * lifts a task that blocks an upcoming hearing above one merely due sooner, so a filing
 * for Friday's hearing used to sit above a fee due today. Under bands that filing reads
 * under "This week" and the fee under "Due today", because the band answers *when it
 * bites* and Friday is not today. Inside "This week" the blocking filing still leads.
 * The alternative — bands that run out of date order to honour the comparator — is a
 * heading that lies about its own contents.
 */
export function bandByDue(tasks: Task[], now: Date | string): DueBand[] {
  const bins = new Map<DueBucket, Task[]>();
  for (const t of tasks) {
    const b = dueBucketOf(t, now);
    const bin = bins.get(b);
    if (bin) bin.push(t);
    else bins.set(b, [t]);
  }
  return DUE_BUCKET_ORDER.filter((b) => bins.get(b)?.length).map((b) => ({
    bucket: b,
    label: DUE_BUCKET_LABELS[b],
    tasks: bins.get(b)!,
  }));
}

/** "26 need action · 4 waiting on others · 5 overdue" — the header line. */
export function summaryOf(world: World): { action: number; waiting: number; overdue: number } {
  const action = tasksInView(world, "needs-action");
  const waiting = tasksInView(world, "waiting");
  // Overdue counts every still-binding task past its date, whoever's move it is — the
  // same rule the row's Due cell and the Overdue band use.
  const overdue = [...action, ...waiting].filter((t) => readsAsOverdue(t, world.now)).length;
  return { action: action.length, waiting: waiting.length, overdue };
}

/**
 * Counts for the four tabs. When a search query is set the counts follow it, so typing
 * shows where the matches live even on the tabs not being looked at.
 */
export function viewCounts(world: World, query = ""): Record<TaskView, number> {
  const views: Record<TaskView, number> = { "needs-action": 0, waiting: 0, completed: 0, archived: 0 };
  for (const t of world.tasks) {
    const kase = caseOf(world, t);
    if (!kase || !canViewTask(world.user, t, kase)) continue;
    if (!matchesSearch(t, kase, query)) continue;
    views[viewOf(t, world.user, kase)] += 1;
  }
  return views;
}

/** Distinct courts among visible cases — for the Court filter. */
export function courtsOf(world: World): string[] {
  const visible = world.cases.filter((c) => canView(world.user, c));
  return [...new Set(visible.map((c) => c.court))].sort();
}

/** Whether anything narrows the view beyond the tab (for "Clear filters" and the empty state). */
export function isNarrowed(f: Filters): boolean {
  return (
    f.kinds.length > 0 ||
    f.dues.length > 0 ||
    f.courts.length > 0 ||
    f.advocates.length > 0 ||
    !!f.query.trim()
  );
}
