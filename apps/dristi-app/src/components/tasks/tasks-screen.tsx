"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import {
  applyFilters,
  caseOf,
  courtsOf,
  DEFAULT_FILTERS,
  type Filters,
  isNarrowed,
  categoryCounts,
  summaryOf,
  VIEW_LABELS,
  viewCounts,
  type World,
} from "@/lib/tasks/selectors";
import { headerDate, rupees } from "@/lib/tasks/format";
import { ACTIONABLE, canArchive, categoryOf, verbFor } from "@/lib/tasks/permissions";
import { useTasks } from "@/lib/tasks/store";
import { archive, markDone, unarchive } from "@/lib/tasks/transitions";
import type { TaskCategory, Task, TaskId, TaskView, Verb } from "@/lib/tasks/types";
import { cn } from "@/lib/utils";
import { Banner } from "@/components/ui/banner";
import { Button } from "@/components/ui/button";
import { OverflowTabsList } from "@/components/chrome/overflow-tabs";
import { Tabs } from "@/components/ui/tabs";
import { Breadcrumbs } from "@/components/shell/chrome";
import { useHereHref } from "@/components/shell/origin";
import { withOrigin } from "@/lib/nav/origin";
import { ConfirmDialog } from "@/components/shell/confirm-dialog";
import { TaskActModal } from "@/components/tasks/act/act-modal";
import { TaskRespondDialog } from "@/components/tasks/act/respond-dialog";
import { BatchActDialog } from "@/components/tasks/batch-act-dialog";
import { FilterRow, KIND_PILLS_ONLY } from "@/components/tasks/filter-row";
import { useFilters } from "@/components/tasks/filters";
import { KindPills } from "@/components/tasks/kind-pills";
import { TasksTable, TasksTableSkeleton } from "@/components/tasks/tasks-table";
import { type ActMode, type Flow, actModeOf, actPathOf, draftFlowOf, FLOW_DIALOG, flowPathOf, useTaskActions } from "@/components/tasks/use-task-actions";

const VIEWS: TaskView[] = ["needs-action", "waiting", "completed", "archived"];

/**
 * A tab: label + count as muted tabular text — the same presentation as every count.
 * 40px tall (the DS touch floor), text seated low so the underline still sits ON the
 * band's rule (`-mb-px` + `after:bottom-0`) — one line, not two.
 *
 * `items-baseline`, not `items-end`: the count is a step smaller than the label, so
 * aligning their boxes' bottoms dropped the number below the label's baseline and it
 * read as misaligned (owner, 2026-09-16). Text next to text aligns on the baseline.
 */
const TAB_CLASS =
  "-mb-px flex-none items-baseline gap-1.5 rounded-none px-0 pb-2.5 text-body-compact group-data-horizontal/tabs:h-10 group-data-horizontal/tabs:after:bottom-0 group-data-[variant=line]/tabs-list:data-active:after:bg-brand-accent";

/** A clock that ticks once a minute so due cues stay honest on a long-open tab. */
function useNow(): Date {
  const [now, setNow] = React.useState(() => new Date());
  React.useEffect(() => {
    const t = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(t);
  }, []);
  return now;
}


/**
 * Pending tasks — the command centre. A dated header, four ability-based tabs, then one
 * controls line (the kind pills, the search and Filters) and ONE lifted table, its rows
 * banded by when they bite; the detail pushes in from the right on `lg`+ (a sheet
 * below). Pay and file act in a modal over the table; sign, fix & re-file and drafts
 * continue in their own pages behind a dialog. Everything the tabs, pills and filters
 * hold lives in the URL — the kind survives a tab switch, and a selection of one kind
 * carries its own bulk verb into the batch dialog.
 */
export function TasksScreen() {
  const store = useTasks();
  const { state, error, people, cases, tasks, user, online, reload, requestHighlight } = store;
  const { act, busy } = useTaskActions();
  const router = useRouter();
  // This list, with the open task and the filters on it — where a flow should return to.
  const here = useHereHref();
  const { filters, setFilters, taskId } = useFilters();
  const now = useNow();

  const world = React.useMemo<World>(
    () => ({ people, cases, tasks, user, now }),
    [people, cases, tasks, user, now]
  );

  const rows = React.useMemo(() => applyFilters(world, filters), [world, filters]);
  const counts = React.useMemo(() => categoryCounts(world, filters), [world, filters]);
  const tabCounts = React.useMemo(() => viewCounts(world, filters.query), [world, filters.query]);
  const summary = React.useMemo(() => summaryOf(world), [world]);
  const courts = React.useMemo(() => courtsOf(world), [world]);

  const [selected, setSelected] = React.useState<Set<TaskId>>(() => new Set());
  /** Tasks awaiting the mark-as-done confirmation — one from a row, several from the bar. */
  const [confirmDone, setConfirmDone] = React.useState<Task[] | null>(null);
  /** The leaving-this-screen dialog: sign, fix and continue open their own pages. */
  const [flowNotice, setFlowNotice] = React.useState<{ task: Task; flow: Flow } | null>(null);
  /** The act modal — pay and file only (the owner's rule). */
  const [acting, setActing] = React.useState<{ taskId: TaskId; mode: ActMode } | null>(null);
  /** The respond dialog — a review task's decision acts in place. */
  const [responding, setResponding] = React.useState<Task | null>(null);
  const actingTask = React.useMemo(
    () => (acting ? (tasks.find((t) => t.id === acting.taskId) ?? null) : null),
    [acting, tasks]
  );
  const actingCase = actingTask ? (caseOf(world, actingTask) ?? null) : null;

  const focusRow = React.useCallback((id: TaskId) => {
    window.requestAnimationFrame(() => {
      const el = document.querySelector<HTMLButtonElement>(
        `[data-task-row][data-task-id="${CSS.escape(id)}"] [data-task-title]`
      );
      if (el) {
        el.focus();
        el.scrollIntoView({ block: "nearest" });
        return;
      }
      // The row may have left this tab — a task completed on its act page comes back
      // under Completed — in which case there is nothing here to focus and the status
      // line the act raised is what reports where it went.
    });
  }, []);

  /* A flow that finishes sends the person back here with `?task=` on the URL. Nothing
     opens from it any more — the row it names is simply the one that takes focus. */
  const [arrivedWith] = React.useState<TaskId | null>(() => taskId);
  const arrivalDone = React.useRef(false);
  React.useEffect(() => {
    if (state !== "ready" || !arrivedWith || arrivalDone.current) return;
    arrivalDone.current = true;
    requestHighlight(arrivedWith);
    focusRow(arrivedWith);
  }, [state, arrivedWith, requestHighlight, focusRow]);

  const openAct = React.useCallback(
    (task: Task, mode: ActMode | null) => {
      if (mode) setActing({ taskId: task.id, mode });
    },
    []
  );

  const handleVerb = React.useCallback(
    (task: Task, verb: Verb) => {
      switch (verb) {
        case "Pay":
        case "File":
          openAct(task, actModeOf(task));
          return;
        case "Sign":
          setFlowNotice({ task, flow: "sign" });
          return;
        case "Re-file":
          setFlowNotice({ task, flow: "scrutiny" });
          return;
        case "Continue": {
          // A draft continues in its own flow, behind the dialog; a pay draft is a
          // payment and acts in place.
          const flow = draftFlowOf(task);
          if (flow) setFlowNotice({ task, flow });
          else openAct(task, actModeOf(task));
          return;
        }
        case "Respond":
          setResponding(task);
          return;
        case "Mark done":
          setConfirmDone([task]);
          return;
        case "Unarchive":
          void act(task.id, unarchive, "Restored from the archive");
          return;
        default:
          // "View" — a task waiting on someone else, closed, or held by a vakalatnama
          // holder who is not you. It opens its own flow to look at rather than to act
          // in: paying and filing read back in the modal, signing and scrutiny returns
          // on their pages. A courtroom task has no such surface, and its row already
          // carries the whole record, so the click does nothing rather than open an
          // empty shell.
          {
            const path = actPathOf(task);
            if (path) router.push(withOrigin(path, here));
            else openAct(task, actModeOf(task));
          }
      }
    },
    [act, openAct, router, here]
  );

  const setView = React.useCallback(
    (view: TaskView) => {
      setSelected(new Set());
      setFilters({ view });
    },
    [setFilters]
  );

  const selectKind = React.useCallback(
    (kinds: TaskCategory[]) => setFilters((prev: Filters) => ({ ...prev, kinds })),
    [setFilters]
  );

  const clearFilters = React.useCallback(
    () => setFilters({ ...DEFAULT_FILTERS, view: filters.view }),
    [filters.view, setFilters]
  );

  /** The listed rows a checkbox can reach — what the header's select-all answers for. */
  const selectableRows = React.useMemo(
    () =>
      rows.filter((r) => {
        const k = caseOf(world, r);
        return !!k && canArchive(user, r, k);
      }),
    [rows, world, user]
  );

  // Only rows in the current table count as selected; ids that scrolled out of the
  // filters are ignored rather than pruned, so a filter round-trip keeps the selection.
  const selectedTasks = React.useMemo(
    () =>
      rows.filter((r) => {
        const k = caseOf(world, r);
        return selected.has(r.id) && k && canArchive(user, r, k);
      }),
    [rows, selected, world, user]
  );
  const visibleSelected = React.useMemo(() => new Set(selectedTasks.map((t) => t.id)), [selectedTasks]);
  // Mark as done needs an open-state task; a filed one waiting on the court does not.
  const doableSelected = React.useMemo(
    () => selectedTasks.filter((t) => ACTIONABLE.has(t.status)),
    [selectedTasks]
  );

  /**
   * The bulk verb the selection itself supports — no pill required.
   *
   * It used to appear only while the "To sign" or "To pay" pill was pressed, which made
   * a filter the price of admission to the feature (owner, 2026-09-15): tick three fees
   * in the ordinary list and nothing offered to pay them. The selection knows its own
   * kind, so it answers for itself. Every task in the set must be one you can actually
   * complete — `verbFor` is the same test the row's own button passes, so the bar can
   * never offer an act the model will refuse.
   */
  const batchKind = React.useMemo<"sign" | "pay" | null>(() => {
    // One ticked fee still shows its amount (owner, 2026-09-16): the bar reports what
    // the selection costs whatever its size, and "Pay ₹40" for one is the same promise
    // as "Pay ₹48" for two. The row's own button remains the other way in.
    if (!selectedTasks.length) return null;
    const kinds = new Set(selectedTasks.map((t) => categoryOf(t)));
    if (kinds.size !== 1) return null;
    const [kind] = [...kinds];
    if (kind !== "sign" && kind !== "pay") return null;
    const want: Verb = kind === "sign" ? "Sign" : "Pay";
    const all = selectedTasks.every((t) => {
      const kase = caseOf(world, t);
      if (!kase || !ACTIONABLE.has(t.status) || verbFor(user, t, kase) !== want) return false;
      // Never put a figure on a fee whose amount has not arrived — the single pay flow
      // refuses that state outright, and a batch total must not quietly read it as ₹0.
      return kind !== "pay" || t.amountPaise !== undefined;
    });
    return all ? kind : null;
  }, [selectedTasks, world, user]);

  /** Set when the batch dialog is open, so the set it is acting on cannot change under it. */
  const [batching, setBatching] = React.useState<{ kind: "sign" | "pay"; tasks: Task[] } | null>(null);

  const markAllDone = async (batch: Task[]) => {
    let ok = 0;
    for (const t of batch) if (await act(t.id, markDone)) ok += 1;
    if (ok) toast.success(`Marked done ${ok} task${ok === 1 ? "" : "s"}`);
    setSelected(new Set());
  };

  const archiveAll = async () => {
    let ok = 0;
    for (const t of selectedTasks) if (await act(t.id, archive)) ok += 1;
    if (ok) toast.success(`Archived ${ok} task${ok === 1 ? "" : "s"}`);
    setSelected(new Set());
  };

  const narrowed = isNarrowed(filters);
  const emptyKind = narrowed ? "filtered" : "none";

  return (
    /* The warm canvas the product defaults to, with the table and the selection bar
       lifted off it as panels (ui-craft §1.0; owner, 2026-09-16). */
    <main className="flex min-w-0 flex-1 bg-muted dark:bg-background">
      <Breadcrumbs crumbs={[]} />

      <div className="flex min-w-0 flex-1 flex-col gap-6 px-4 py-6 md:px-6 lg:px-8">
        {/* Today anchors every relative date below it — "2 days overdue" from when. */}
        <header className="flex flex-col gap-1">
          <h1 className="text-title-s font-semibold text-foreground">{headerDate(now)}</h1>
          <p className="text-body-compact text-muted-foreground tabular-nums">
            {state === "ready"
              ? `${summary.action} need action · ${summary.waiting} waiting on others · ${summary.overdue} overdue`
              : "Loading…"}
          </p>
        </header>

        {/* Views. The active underline sits on the band's own rule rather than floating
            above it — one horizontal line, not two. */}
        <Tabs
          value={filters.view}
          onValueChange={(v) => {
            // More answers with its own sentinel while it stands for no view.
            if ((VIEWS as readonly string[]).includes(v)) setView(v as TaskView);
          }}
          className="gap-0"
        >
          {/* Four views do not fit a phone, and a row that scrolls sideways hides
              the ones off its edge. The ones that fit stay; the rest sit under More. */}
          <OverflowTabsList
            aria-label="Task views"
            value={filters.view}
            onSelect={(v) => setView(v as TaskView)}
            className="w-full justify-start gap-4 border-b border-hairline p-0 pb-0 group-data-horizontal/tabs:h-auto sm:gap-6"
            triggerClassName={TAB_CLASS}
            // The labels ride the baseline above a 10px foot, so the box's
            // centre is below the words. Lift the two centred parts to them.
            dividerClassName="-translate-y-1.5"
            chevronClassName="-translate-y-1"
            items={VIEWS.map((v) => {
              const count = state === "ready" ? String(tabCounts[v]) : "–";
              return {
                value: v,
                measure: count,
                label: (
                  <>
                    {VIEW_LABELS[v]}
                    <span className="text-caption tabular-nums text-muted-foreground">{count}</span>
                  </>
                ),
              };
            })}
          />
        </Tabs>

        {/* One controls line: the tab is the population, the pills narrow it by the act
            still needed, and the search and Filters sit at its end (owner, 2026-09-16).
            Each pill's count is what pressing it yields, so the control never disagrees
            with the list under it.

            Both halves carry a minimum width and the row wraps, so the search and
            Filters drop to a second line when the pills can no longer be squeezed —
            content decides, not a breakpoint. */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          {/* The pills' floor is what decides "too small": below it the search and
             Filters leave rather than squeezing the pills to two visible kinds. */}
          <div className={cn("min-w-96 flex-1", KIND_PILLS_ONLY)}>
            <KindPills
              counts={state === "ready" ? counts : null}
              active={filters.kinds}
              loading={state !== "ready"}
              onSelect={selectKind}
            />
          </div>
          <div className="w-full min-w-0 md:pointer-fine:w-auto md:pointer-fine:min-w-72 md:pointer-fine:flex-none">
            <FilterRow
              categoryCounts={state === "ready" ? counts : null}
              filters={filters}
              courts={courts}
              people={people}
              narrowed={narrowed}
              onChange={setFilters}
              onClear={clearFilters}
            />
          </div>
        </div>

        {!online ? (
          <Banner variant="warning">
            You are offline. The table is read-only until the connection returns — nothing is
            queued, so payments and signatures are never sent twice.
          </Banner>
        ) : null}

        {state === "error" ? (
          <Banner
            variant="error"
            action={
              <Button variant="outline" onClick={() => void reload()}>
                Retry
              </Button>
            }
          >
            Tasks could not be loaded{error ? ` — ${error}` : ""}.
          </Banner>
        ) : null}

        {/* Always mounted, so the first tick is announced: the bar's own summary is a
            live region, but a region inserted together with its content is read
            unreliably, and the first tick is exactly the moment that matters. This says
            only what the bar does not — that acting is now possible. */}
        <p aria-live="polite" className="sr-only">
          {selectedTasks.length && batchKind
            ? `${batchKind === "sign" ? "Sign" : "Pay"} is available for the selection.`
            : ""}
        </p>

        {/* One selection bar, above the list: what you ticked, and everything that can be
            done with it. It sat at the foot of the window until the owner pointed out
            that nobody looks there after selecting rows (2026-09-16) — a toolbar belongs
            over the thing it acts on. Sticky under the chrome bar, so a set built forty
            rows down keeps its verbs in view. */}
        {selectedTasks.length ? (
          <SelectionBar
            count={selectedTasks.length}
            batch={batchKind ? { kind: batchKind, tasks: selectedTasks } : null}
            hasPayOrSign={selectedTasks.some((t) => {
              const k = categoryOf(t);
              return k === "pay" || k === "sign";
            })}
            disabled={!online || !!busy}
            canMarkDone={!!doableSelected.length}
            onBatch={(b) => setBatching(b)}
            onMarkDone={() => setConfirmDone(doableSelected)}
            onArchive={() => void archiveAll()}
            onClear={() => setSelected(new Set())}
          />
        ) : null}

        {state === "loading" ? (
          <TasksTableSkeleton />
        ) : (
          <TasksTable
            rows={rows}
            cases={cases}
            people={people}
            user={user}
            now={now}
            view={filters.view}
            query={filters.query}
            selected={visibleSelected}
            allSelected={!!selectableRows.length && selectedTasks.length === selectableRows.length}
            someSelected={!!selectedTasks.length && selectedTasks.length < selectableRows.length}
            offline={!online}
            emptyKind={emptyKind}
            onClearFilters={clearFilters}
            onToggleAll={(select) =>
              setSelected(select ? new Set(selectableRows.map((t) => t.id)) : new Set())
            }
            onVerb={handleVerb}
            onToggleSelect={(t) =>
              setSelected((prev) => {
                const next = new Set(prev);
                if (next.has(t.id)) next.delete(t.id);
                else next.add(t.id);
                return next;
              })
            }
          />
        )}

      </div>

      <TaskActModal
        task={actingTask}
        kase={actingCase}
        mode={acting?.mode ?? null}
        open={!!acting && !!actingTask && !!actingCase}
        onOpenChange={(open) => {
          if (!open) setActing(null);
        }}
        onFinished={(id) => {
          requestHighlight(id);
          focusRow(id);
        }}
      />

      {/* Signing or paying the whole set: one OTP, one transaction, then a line per
          task — the handover's batch note, built. */}
      <BatchActDialog
        kind={batching?.kind ?? null}
        tasks={batching?.tasks ?? []}
        user={user}
        open={!!batching}
        onOpenChange={(open) => {
          if (!open) setBatching(null);
        }}
        onFinished={(closed) => {
          setSelected((prev) => {
            const next = new Set(prev);
            for (const id of closed) next.delete(id);
            return next;
          });
          const last = closed[closed.length - 1];
          if (last) requestHighlight(last);
        }}
      />

      <TaskRespondDialog
        task={responding}
        kase={responding ? (cases.find((c) => c.id === responding.caseId) ?? null) : null}
        open={!!responding}
        onOpenChange={(open) => {
          if (!open) setResponding(null);
        }}
        onFinished={(id) => {
          requestHighlight(id);
          focusRow(id);
        }}
      />

      {/* Signing, fixing a return and continuing a draft leave this screen for their
          own pages — the dialog says so before anything moves. */}
      <ConfirmDialog
        open={!!flowNotice}
        onOpenChange={(open) => !open && setFlowNotice(null)}
        title={flowNotice ? FLOW_DIALOG[flowNotice.flow].title : ""}
        description={flowNotice ? FLOW_DIALOG[flowNotice.flow].description : undefined}
        confirmLabel="Continue"
        destructive={false}
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
            ? `${
                confirmDone.length === 1
                  ? `“${confirmDone[0].title}”`
                  : `${confirmDone.length} tasks`
              } — this records that it was completed outside DRISTI. Nothing is sent to the court.`
            : undefined
        }
        confirmLabel="Mark as done"
        destructive={false}
        onConfirm={() => {
          const batch = confirmDone;
          setConfirmDone(null);
          if (batch) void markAllDone(batch);
        }}
      />
    </main>
  );
}

/**
 * The selection bar: what is ticked, said in a sentence, and everything that can be
 * done with it.
 *
 * Its first shape put the count and all four controls in a left-aligned row, which left
 * the right two thirds of the bar empty and gave the primary act no more standing than
 * Clear beside it — the owner's "un-UX-ly" (2026-09-16). This is the shape the court's
 * own sign queues use: the summary muted and left, in a live region so the selection is
 * heard as well as seen; the acts grouped hard right, least consequential first and the
 * primary last, carrying the count or the money it will charge.
 *
 * Clear belongs with the count, not with the acts — it undoes the selection rather than
 * doing anything to the tasks — so the right-hand group is acts only.
 */
function SelectionBar({
  count,
  batch,
  hasPayOrSign,
  disabled,
  canMarkDone,
  onBatch,
  onMarkDone,
  onArchive,
  onClear,
}: {
  count: number;
  batch: { kind: "sign" | "pay"; tasks: Task[] } | null;
  hasPayOrSign: boolean;
  disabled: boolean;
  canMarkDone: boolean;
  onBatch: (batch: { kind: "sign" | "pay"; tasks: Task[] }) => void;
  onMarkDone: () => void;
  onArchive: () => void;
  onClear: () => void;
}) {
  const label = batch
    ? batch.kind === "sign"
      ? `Sign ${batch.tasks.length} document${batch.tasks.length === 1 ? "" : "s"}`
      : `Pay ${rupees(batch.tasks.reduce((sum, t) => sum + (t.amountPaise ?? 0), 0))}`
    : null;
  /* One line of prose does both jobs: how many are ticked, and — when the set is mixed —
     why there is no Pay or Sign among the acts to the right. */
  const summary =
    `${count} task${count === 1 ? "" : "s"} selected.` +
    (!batch && hasPayOrSign && count > 1
      ? " Paying or signing needs one kind at a time."
      : "");

  return (
    <div
      role="region"
      aria-label="Selected tasks"
      /* `top-14` clears the chrome bar exactly, with none of the page air the
         `--chrome-sticky-top` offset adds — a toolbar sits against the chrome. Opaque,
         because rows sliding under a translucent bar would decide the contrast of a
         money label; and unlifted, so the table below stays the one raised object and
         this reads as its toolbar rather than a second panel. */
      className="sticky top-14 z-20 flex flex-wrap items-center justify-end gap-3 rounded-lg border border-hairline bg-card px-4 py-3"
    >
      <p className="mr-auto flex flex-wrap items-center gap-x-3 text-body-compact text-muted-foreground" aria-live="polite">
        <span className="tabular-nums">{summary}</span>
        <Button variant="link" className="h-auto p-0 font-normal underline" onClick={onClear}>
          Clear
        </Button>
      </p>

      <Button variant="outline" disabled={disabled} onClick={onArchive}>
        Archive
      </Button>
      <Button variant="outline" disabled={disabled || !canMarkDone} onClick={onMarkDone}>
        Mark as done
      </Button>
      {batch && label ? (
        <Button disabled={disabled} onClick={() => onBatch(batch)} className="tabular-nums">
          {label}
        </Button>
      ) : null}
    </div>
  );
}

export function TasksScreenFallback() {
  return (
    /* The warm canvas the product defaults to, with the table and the selection bar
       lifted off it as panels (ui-craft §1.0; owner, 2026-09-16). */
    <main className="flex min-w-0 flex-1 bg-muted dark:bg-background">
      <div className={cn("flex min-w-0 flex-1 flex-col gap-6 px-4 py-6 md:px-6 lg:px-8")}>
        <header className="flex flex-col gap-1">
          <h1 className="text-title-s font-semibold text-foreground">{headerDate(new Date())}</h1>
          <p className="text-body-compact text-muted-foreground">Loading…</p>
        </header>
        <TasksTableSkeleton />
      </div>
    </main>
  );
}
