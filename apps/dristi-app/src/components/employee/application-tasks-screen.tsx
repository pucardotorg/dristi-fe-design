"use client";

import * as React from "react";
import { InboxIcon } from "lucide-react";

import {
  TABLE_CELL,
  TABLE_HEAD,
  TABLE_HEAD_ROW,
  tableBodyClass,
  tableRowClass,
} from "@/components/chrome/table-plate";
import { Identifier } from "@/components/chrome/identifier";
import { ApplicationTaskDialog } from "@/components/employee/application-task-dialog";
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
  type CourtTask,
  type CourtTaskKind,
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

/**
 * The court's application queues, soonest due first.
 *
 * The same furniture as the other Review-applications rows: the title on the page, one
 * lifted panel holding the list. What differs is where the rows come from. These are
 * the applications actually filed through the citizen side in this browser, carrying
 * their whole lifecycle, rather than a fixture — so the queue is empty until someone
 * files one, and it says how.
 */
const VIEWS: Record<
  CourtTaskKind,
  { title: string; empty: string; one: string; many: (n: number) => string }
> = {
  review: {
    title: "Onboard applications",
    empty:
      "An application appears here the day it is filed — signed and its fee paid — from a case's Applications tab on the advocate side.",
    one: "1 application is waiting to be onboarded.",
    many: (n) => `${n} applications are waiting to be onboarded.`,
  },
  decide: {
    title: "Decide on applications",
    empty:
      "An application appears here once it is onboarded, due on the date the court said it would decide it.",
    one: "1 application is waiting for a decision.",
    many: (n) => `${n} applications are waiting for a decision.`,
  },
};

/**
 * One of the court's two application queues — the rail's **Onboard applications**
 * (Review application tasks, the first gate) or **Decide on applications** (Decide
 * application tasks, the second). An application moves from the first to the second
 * when it is onboarded, and leaves on the signed order.
 */
export function ApplicationTasksScreen({ kind }: { kind: CourtTaskKind }) {
  const view = VIEWS[kind];
  const ready = useApplicationsReady();
  const apps = useLifecycleApplications();
  const all = courtTasks(apps).filter((task) => task.kind === kind);
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
  const [openId, setOpenId] = React.useState<string | null>(null);
  const open = openId ? (apps.find((app) => app.id === openId) ?? null) : null;
  const headingRef = React.useRef<HTMLHeadingElement>(null);
  const on = today();

  return (
    <div className="flex min-w-0 flex-1 flex-col gap-8 p-6 md:p-8">
      <header className="flex flex-col gap-2">
        <h1
          ref={headingRef}
          tabIndex={-1}
          className="text-title text-balance font-semibold outline-none"
        >
          {view.title}
        </h1>
        <p className="text-body text-muted-foreground">
          {!ready
            ? "Loading."
            : all.length === 1
              ? view.one
              : view.many(all.length)}
        </p>
      </header>

      <section className="flex min-w-0 flex-col gap-6 rounded-xl border border-hairline bg-card p-6 shadow-raised">
        {!ready ? (
          <div className="flex flex-col gap-2" aria-busy>
            {Array.from({ length: 4 }, (_, index) => (
              <Skeleton key={index} className="h-10 w-full rounded-lg" />
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
                {view.empty}
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <>
            <CourtFilters
              search={{
                label: "Search applications",
                value: query,
                onChange: setQuery,
                placeholder: "Application, case name or number",
              }}
              fields={columnFilterFields(filters, columns, (id, value) =>
                setColumns((current) => ({ ...current, [id]: value })),
              )}
              trailing={
                <CourtSortSelect
                  id={`${kind}-applications-sort`}
                  value={sort}
                  options={sortOptions(TASK_SORTS)}
                  onChange={setSort}
                />
              }
              onClearAll={clearFilters}
            />
            <QueueAnnouncer from={1} to={rows.length} total={rows.length} />
            {rows.length === 0 ? (
              <Empty className="border-0 p-0">
                <EmptyHeader>
                  <EmptyTitle className="text-title-s font-semibold">
                    No applications match
                  </EmptyTitle>
                  <EmptyDescription className="text-body">
                    Nothing on this queue matches the search and filters you
                    have applied.
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
                  <TasksTable tasks={rows} on={on} onOpen={setOpenId} />
                </div>
                <ul className="flex flex-col gap-3 md:hidden">
                  {rows.map((task) => (
                    <QueueItemRow
                      key={task.application.id}
                      className="flex flex-col gap-2"
                    >
                      <button
                        type="button"
                        onClick={() => setOpenId(task.application.id)}
                        {...rowOpener}
                        className={rowOpenerClass}
                      >
                        {task.application.typeLabel}
                      </button>
                      <p className="text-body-compact">
                        {causeTitleOf(task.application)}
                      </p>
                      <DueLine task={task} on={on} />
                    </QueueItemRow>
                  ))}
                </ul>
              </>
            )}
          </>
        )}
      </section>

      <ApplicationTaskDialog
        application={open}
        all={apps}
        queue={kind}
        onOpenChange={(next) => {
          if (!next) setOpenId(null);
        }}
        onReturnFocus={() => headingRef.current?.focus()}
      />
    </div>
  );
}

function TasksTable({
  tasks,
  on,
  onOpen,
}: {
  tasks: CourtTask[];
  on: string;
  onOpen: (id: string) => void;
}) {
  return (
    <Table className="w-full border-separate border-spacing-0 text-body-compact">
      <TableHeader>
        <TableRow className={TABLE_HEAD_ROW}>
          <TableHead className={cn(TABLE_HEAD, "min-w-40 whitespace-normal")}>
            Application
          </TableHead>
          <TableHead className={cn(TABLE_HEAD, "min-w-56 whitespace-normal")}>
            Case
          </TableHead>
          <TableHead className={cn(TABLE_HEAD, "whitespace-nowrap")}>
            Number
          </TableHead>
          <TableHead className={cn(TABLE_HEAD, "whitespace-nowrap")}>
            Filed on
          </TableHead>
          <TableHead className={cn(TABLE_HEAD, "whitespace-nowrap")}>
            Due
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody className={tableBodyClass()}>
        <tr aria-hidden="true">
          <td colSpan={5} className="h-2 p-0" />
        </tr>
        {tasks.map((task) => {
          const app = task.application;
          const record = caseOf(app);
          return (
            <TableRow key={app.id} {...rowActivation(tableRowClass())}>
              <TableCell
                className={cn(
                  TABLE_CELL,
                  "min-w-40 font-medium whitespace-normal",
                )}
              >
                <button
                  type="button"
                  onClick={() => onOpen(app.id)}
                  {...rowOpener}
                  className={rowOpenerClass}
                >
                  {app.typeLabel}
                </button>
                {app.pendingOrder ? (
                  <p className="text-caption font-normal text-muted-foreground">
                    Order awaiting signature
                  </p>
                ) : null}
              </TableCell>
              <TableCell
                className={cn(TABLE_CELL, "min-w-56 whitespace-normal")}
              >
                <span className="flex flex-col gap-0.5">
                  <span>{causeTitleOf(app)}</span>
                  {record ? (
                    <span className="text-caption text-muted-foreground">
                      <Identifier
                        value={record.caseNumber}
                        label="case number"
                      />
                    </span>
                  ) : null}
                </span>
              </TableCell>
              <TableCell className={cn(TABLE_CELL, "whitespace-nowrap")}>
                {app.applicationNumber ? (
                  <Identifier
                    value={app.applicationNumber}
                    label="application number"
                  />
                ) : (
                  <span className="flex flex-col gap-0.5 text-caption text-muted-foreground">
                    {app.temporaryId ? (
                      <Identifier
                        value={app.temporaryId}
                        label="temporary identifier"
                      />
                    ) : null}
                    <span>Temporary</span>
                  </span>
                )}
              </TableCell>
              <TableCell
                className={cn(TABLE_CELL, "whitespace-nowrap tabular-nums")}
              >
                {app.submittedOn ? formatCaseDate(app.submittedOn) : "—"}
              </TableCell>
              <TableCell className={cn(TABLE_CELL, "whitespace-nowrap")}>
                <DueLine task={task} on={on} />
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}

/** The due date, with its state said in words as well as colour. */
function DueLine({ task, on }: { task: CourtTask; on: string }) {
  const state = dueState(task.dueOn, on);
  return (
    <span className="flex flex-wrap items-center gap-2">
      <span className="tabular-nums">{formatCaseDate(task.dueOn)}</span>
      {state === "overdue" ? (
        <Badge variant="destructive">Overdue</Badge>
      ) : state === "today" ? (
        <Badge variant="warning">Due today</Badge>
      ) : null}
    </span>
  );
}
