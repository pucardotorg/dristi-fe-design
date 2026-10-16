"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { InboxIcon } from "lucide-react";

import {
  TABLE_CELL,
  TABLE_HEAD,
  TABLE_HEAD_ROW,
  tableBodyClass,
  tableRowClass,
} from "@/components/chrome/table-plate";
import { Identifier } from "@/components/chrome/identifier";
import {
  PILL_COUNT,
  PILL_ITEM,
  PILL_ROW,
} from "@/components/chrome/pill-plate";
import { applicationOrderHref } from "@/components/employee/application-order-screen";
import {
  VIEW_PARAM,
  type ApplicationView,
} from "@/lib/employee/application-views";
import { QueueItemRow } from "@/components/employee/queue-item-row";
import { Badge } from "@/components/ui/badge";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  courtTasks,
  setADateUsed,
  sideLabel,
  type CourtTask,
} from "@/lib/applications/lifecycle";
import {
  today,
  useApplicationsReady,
  useLifecycleApplications,
} from "@/lib/applications/store";
import { formatCaseDate } from "@/lib/cases/types";
import {
  caseOf,
  causeTitleOf,
  dueState,
} from "@/lib/employee/application-tasks";
import {
  rowActivation,
  rowOpener,
  rowOpenerClass,
} from "@/lib/employee/row-activation";
import { cn } from "@/lib/utils";
import {
  CourtFilters,
  CourtSortSelect,
} from "@/components/employee/court-filters";
import { QueueAnnouncer } from "@/components/employee/queue-announcer";
import { Button } from "@/components/ui/button";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { matchesQuery } from "@/lib/employee/filter-state";
import {
  compareDays,
  compareText,
  sortOptions,
  sortRows,
  type CourtSortSpec,
} from "@/lib/employee/court-sort";
import {
  applyColumnFilters,
  columnFilterFields,
  emptyColumnFilters,
  hasColumnFilters,
  type ColumnFilter,
} from "@/lib/employee/court-column-filters";

type TaskSort = "due" | "oldest" | "newest";

const filedOn = (task: CourtTask) =>
  task.application.submittedOn ?? task.application.createdOn;

/** Due soonest by default — the Due column, and the date the court said it would act by. */
const TASK_SORTS: CourtSortSpec<CourtTask, TaskSort>[] = [
  {
    id: "due",
    label: "Due soonest",
    compare: (a, b) =>
      compareDays(a.dueOn, b.dueOn) ||
      compareText(a.application.typeLabel, b.application.typeLabel),
  },
  {
    id: "oldest",
    label: "Oldest filed first",
    compare: (a, b) => compareDays(filedOn(a), filedOn(b)),
  },
  {
    id: "newest",
    label: "Newest filed first",
    compare: (a, b) => compareDays(filedOn(b), filedOn(a)),
  },
];

/** The application types on this queue, and the side that filed — what a pile is split by. */
function taskFilters(tasks: CourtTask[]): ColumnFilter<CourtTask>[] {
  return [
    {
      id: "application-type",
      label: "Application type",
      allLabel: "All application types",
      options: [...new Set(tasks.map((task) => task.application.typeLabel))]
        .sort(compareText)
        .map((label) => ({ value: label, label })),
      test: (task, value) => task.application.typeLabel === value,
    },
    {
      id: "application-side",
      label: "Filed for",
      allLabel: "Either side",
      options: [
        { value: "complainant", label: "Complainant" },
        { value: "accused", label: "Accused" },
      ],
      test: (task, value) => task.application.side === value,
    },
  ];
}

const VIEWS: {
  id: ApplicationView;
  label: string;
  /** The pill's tooltip — what the list holds, in the bench's words. */
  hint: string;
  /** Counts mean work: only the two lists the bench owes carry one. */
  counted: boolean;
}[] = [
  {
    id: "all",
    label: "All open",
    hint: "Every application waiting on the court, to onboard or to decide",
    counted: false,
  },
  {
    id: "review",
    label: "To onboard",
    hint: "New applications to onboard, defer or dismiss",
    counted: true,
  },
  {
    id: "decide",
    label: "To decide",
    hint: "Onboarded applications waiting for an order accepting or rejecting them",
    counted: true,
  },
];

const EMPTY: Record<ApplicationView, string> = {
  all: "An application appears here the day it is filed — signed and its fee paid — from a case's Applications tab on the advocate side.",
  review:
    "An application appears here the day it is filed — signed and its fee paid — from a case's Applications tab on the advocate side.",
  decide:
    "An application appears here once it is onboarded, due on the date the court said it would decide it.",
};

/** "Friday, 16 October 2026" — the day the bench is working, beside the title. */
function todayLabel(on: string): string {
  const [y, m, d] = on.split("-").map(Number);
  const weekday = new Date(y, m - 1, d).toLocaleDateString("en-IN", {
    weekday: "long",
  });
  return `${weekday}, ${formatCaseDate(on)}`;
}

/**
 * Applications — the court's two application queues as one rail item (owner,
 * 2026-10-16, taking the list of PR #120 onto main's flow): **To onboard** (Review
 * application tasks, the first gate) and **To decide** (Decide application tasks, the
 * second), with All open ahead of them. One list, no bands: where each application
 * stands is its Status column, and who filed it is a column of its own.
 *
 * Opening a row opens the order on it, with the application in Full view over it.
 */
export function ApplicationsScreen({
  initialView,
}: {
  initialView: ApplicationView;
}) {
  const router = useRouter();
  const ready = useApplicationsReady();
  const apps = useLifecycleApplications();
  const tasks = courtTasks(apps);
  const [view, setView] = React.useState<ApplicationView>(initialView);
  const all = tasks.filter((task) => view === "all" || task.kind === view);
  const filters = taskFilters(all);
  const [query, setQuery] = React.useState("");
  const [columns, setColumns] = React.useState(() =>
    emptyColumnFilters(filters),
  );
  const [sort, setSort] = React.useState<TaskSort>("due");
  const rows = sortRows(
    applyColumnFilters(all, filters, columns).filter((task) => {
      const record = caseOf(task.application);
      return matchesQuery(
        query,
        task.application.typeLabel,
        causeTitleOf(task.application),
        record?.caseNumber,
        task.application.applicationNumber,
        task.application.temporaryId,
      );
    }),
    TASK_SORTS,
    sort,
  );
  const isFiltered = query.trim() !== "" || hasColumnFilters(columns);

  function clearFilters() {
    setQuery("");
    setColumns(emptyColumnFilters(filters));
  }

  function changeView(next: ApplicationView) {
    setView(next);
    router.replace(`/employee/applications?view=${VIEW_PARAM[next]}`, {
      scroll: false,
    });
  }

  /* A row opens the order on it, the application itself open in Full view over the
     order (owner, 2026-10-16) — the order is how the court answers it. */
  function openTask(task: CourtTask) {
    router.push(applicationOrderHref(task.kind, task.application.id));
  }
  const headingRef = React.useRef<HTMLHeadingElement>(null);
  const on = today();

  return (
    <div className="flex min-w-0 flex-1 flex-col gap-8 p-6 md:p-8">
      <header className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <h1
          ref={headingRef}
          tabIndex={-1}
          className="text-title text-balance font-semibold outline-none"
        >
          Applications
        </h1>
        <p className="text-body text-muted-foreground">
          Today · {todayLabel(on)}
        </p>
      </header>

      <section className="flex min-w-0 flex-col gap-6 rounded-xl border border-hairline bg-card p-6 shadow-raised">
        <CourtFilters
          leading={
            <ViewPills tasks={tasks} view={view} onChange={changeView} />
          }
          search={{
            label: "Search applications",
            value: query,
            onChange: setQuery,
            placeholder: "Case, party or number",
          }}
          fields={columnFilterFields(filters, columns, (id, value) =>
            setColumns((current) => ({ ...current, [id]: value })),
          )}
          trailing={
            <CourtSortSelect
              id="applications-sort"
              value={sort}
              options={sortOptions(TASK_SORTS)}
              onChange={setSort}
            />
          }
          onClearAll={clearFilters}
        />
        <QueueAnnouncer from={1} to={rows.length} total={rows.length} />
        {!ready ? (
          <div className="flex flex-col gap-2" aria-busy>
            {Array.from({ length: 4 }, (_, index) => (
              <Skeleton key={index} className="h-12 w-full rounded-lg" />
            ))}
          </div>
        ) : all.length === 0 ? (
          <Empty className="border-0 p-0">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <InboxIcon aria-hidden />
              </EmptyMedia>
              <EmptyTitle className="text-title-s font-semibold">
                Nothing waiting
              </EmptyTitle>
              <EmptyDescription className="text-body">
                {EMPTY[view]}
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : rows.length === 0 ? (
          <Empty className="border-0 p-0">
            <EmptyHeader>
              <EmptyTitle className="text-title-s font-semibold">
                No applications match
              </EmptyTitle>
              <EmptyDescription className="text-body">
                Nothing on this list matches the search and filters you have
                applied.
              </EmptyDescription>
            </EmptyHeader>
            {isFiltered ? (
              <EmptyContent>
                <Button variant="outline" onClick={clearFilters}>
                  Clear all
                </Button>
              </EmptyContent>
            ) : null}
          </Empty>
        ) : (
          <>
            <div className="hidden min-w-0 overflow-x-auto md:block">
              <TasksTable tasks={rows} on={on} onOpen={openTask} />
            </div>
            <ul className="flex flex-col gap-3 md:hidden">
              {rows.map((task) => (
                <QueueItemRow
                  key={task.application.id}
                  className="flex flex-col gap-2"
                >
                  <button
                    type="button"
                    onClick={() => openTask(task)}
                    {...rowOpener}
                    className={rowOpenerClass}
                  >
                    {task.application.typeLabel}
                  </button>
                  <p className="text-body-compact">
                    {causeTitleOf(task.application)}
                  </p>
                  <StatusCell task={task} on={on} />
                </QueueItemRow>
              ))}
            </ul>
          </>
        )}
      </section>
    </div>
  );
}

/**
 * The lists as a single-select pill row — the pending-tasks row (`chrome/pill-plate.ts`).
 * Counts only where they are work: To onboard and To decide.
 */
function ViewPills({
  tasks,
  view,
  onChange,
}: {
  tasks: CourtTask[];
  view: ApplicationView;
  onChange: (view: ApplicationView) => void;
}) {
  return (
    <TooltipProvider delayDuration={300}>
      <ToggleGroup
        type="single"
        size="lg"
        variant="default"
        value={view}
        onValueChange={(next) => {
          if (next) onChange(next as ApplicationView);
        }}
        aria-label="Show"
        className={PILL_ROW}
      >
        {VIEWS.map((entry) => {
          const count = entry.counted
            ? tasks.filter((task) => task.kind === entry.id).length
            : null;
          return (
            <Tooltip key={entry.id}>
              <TooltipTrigger asChild>
                <span className="inline-flex">
                  <ToggleGroupItem
                    value={entry.id}
                    aria-label={
                      count === null ? entry.label : `${entry.label}, ${count}`
                    }
                    className={PILL_ITEM}
                  >
                    <span>{entry.label}</span>
                    {count ? (
                      <span aria-hidden className={PILL_COUNT}>
                        {count}
                      </span>
                    ) : null}
                  </ToggleGroupItem>
                </span>
              </TooltipTrigger>
              <TooltipContent side="bottom">{entry.hint}</TooltipContent>
            </Tooltip>
          );
        })}
      </ToggleGroup>
    </TooltipProvider>
  );
}

function TasksTable({
  tasks,
  on,
  onOpen,
}: {
  tasks: CourtTask[];
  on: string;
  onOpen: (task: CourtTask) => void;
}) {
  return (
    <Table className="w-full border-separate border-spacing-0 text-body-compact">
      <TableHeader>
        <TableRow className={TABLE_HEAD_ROW}>
          <TableHead className={cn(TABLE_HEAD, "min-w-36 whitespace-normal")}>
            Application
          </TableHead>
          <TableHead className={cn(TABLE_HEAD, "w-px whitespace-nowrap")}>
            Filed by
          </TableHead>
          <TableHead className={cn(TABLE_HEAD, "min-w-40 whitespace-normal")}>
            Case
          </TableHead>
          {/* The short columns take their content's width; what is left goes to the
              columns that carry words. */}
          <TableHead className={cn(TABLE_HEAD, "w-px whitespace-nowrap")}>
            Number
          </TableHead>
          <TableHead className={cn(TABLE_HEAD, "w-px whitespace-nowrap")}>
            Filed
          </TableHead>
          <TableHead className={cn(TABLE_HEAD, "min-w-44 whitespace-normal")}>
            Status
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody className={tableBodyClass()}>
        <tr aria-hidden="true">
          <td colSpan={6} className="h-2 p-0" />
        </tr>
        {tasks.map((task) => {
          const app = task.application;
          const record = caseOf(app);
          return (
            <TableRow key={app.id} {...rowActivation(tableRowClass())}>
              <TableCell
                className={cn(
                  TABLE_CELL,
                  "min-w-36 align-top font-medium whitespace-normal",
                )}
              >
                <button
                  type="button"
                  onClick={() => onOpen(task)}
                  {...rowOpener}
                  className={rowOpenerClass}
                >
                  {app.typeLabel}
                </button>
              </TableCell>
              <TableCell
                className={cn(TABLE_CELL, "align-top whitespace-nowrap")}
              >
                {sideLabel(app.side)}
              </TableCell>
              <TableCell
                className={cn(
                  TABLE_CELL,
                  "min-w-40 align-top whitespace-normal",
                )}
              >
                <span className="flex flex-col gap-1">
                  <span>{causeTitleOf(app)}</span>
                  {record ? (
                    /* A number is read whole: it never breaks at its hyphens. */
                    <span className="whitespace-nowrap text-muted-foreground">
                      <Identifier
                        value={record.caseNumber}
                        label="case number"
                      />
                    </span>
                  ) : null}
                </span>
              </TableCell>
              <TableCell
                className={cn(TABLE_CELL, "align-top whitespace-nowrap")}
              >
                <span className="flex flex-col gap-1">
                  <Identifier
                    value={app.applicationNumber ?? app.temporaryId ?? "—"}
                    label={
                      app.applicationNumber
                        ? "application number"
                        : "temporary identifier"
                    }
                  />
                  {app.applicationNumber ? null : (
                    <span className="text-muted-foreground">Temporary</span>
                  )}
                </span>
              </TableCell>
              <TableCell
                className={cn(
                  TABLE_CELL,
                  "align-top whitespace-nowrap tabular-nums",
                )}
              >
                {app.submittedOn ? formatCaseDate(app.submittedOn) : "—"}
              </TableCell>
              <TableCell
                className={cn(
                  TABLE_CELL,
                  "min-w-44 align-top whitespace-normal",
                )}
              >
                <StatusCell task={task} on={on} />
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}

/**
 * Where it stands, in words, with no date (owner, 2026-10-16): the queue it is on, the
 * overdue or due-today badge on the same line, and under it an order awaiting signature
 * or a review deferred.
 */
function StatusCell({ task, on }: { task: CourtTask; on: string }) {
  const state = dueState(task.dueOn, on);
  const app = task.application;
  const detail = app.pendingOrder
    ? "Order awaiting signature"
    : task.kind === "review" && setADateUsed(app)
      ? "Back after deferral"
      : undefined;
  return (
    <span className="flex flex-col items-start gap-1 text-body-compact">
      <span className="flex flex-wrap items-center gap-2">
        <span className="font-medium text-foreground">
          {task.kind === "review" ? "To onboard" : "To decide"}
        </span>
        {state === "overdue" ? (
          <Badge variant="destructive">Overdue</Badge>
        ) : state === "today" ? (
          <Badge variant="warning">Due today</Badge>
        ) : null}
      </span>
      {detail ? <span className="text-muted-foreground">{detail}</span> : null}
    </span>
  );
}
