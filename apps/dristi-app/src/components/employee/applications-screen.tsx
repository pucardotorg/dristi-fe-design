"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { InboxIcon, SearchXIcon } from "lucide-react";
import { toast } from "sonner";

import { PILL_COUNT, PILL_ITEM, PILL_ROW } from "@/components/chrome/pill-plate";
import {
  TABLE_CELL,
  TABLE_HEAD,
  TABLE_HEAD_ROW,
  tableBodyClass,
  tableRowClass,
} from "@/components/chrome/table-plate";
import { Identifier } from "@/components/chrome/identifier";
import { ApplicationBulkDialog, type BulkAct } from "@/components/employee/application-bulk-dialog";
import { ApplicationDialog } from "@/components/employee/application-dialog";
import { CourtFilters } from "@/components/employee/court-filters";
import { QueueAnnouncer } from "@/components/employee/queue-announcer";
import { QueueItemRow } from "@/components/employee/queue-item-row";
import { useCourtRole } from "@/components/employee/use-court-role";
import { useOrderSigning } from "@/components/employee/use-order-signing";
import { usePendingOrders } from "@/components/employee/use-pending-orders";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Empty,
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
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  canTakeSystemAction,
  sideLabel,
  type CourtSeat,
  type LifecycleApplication,
} from "@/lib/applications/lifecycle";
import {
  today,
  useApplicationsReady,
  useLifecycleApplications,
} from "@/lib/applications/store";
import {
  APPLICATION_VIEWS,
  applicationsIn,
  bandsOf,
  countIn,
  matchesQuery,
  queueOf,
  shortDate,
  statusLine,
  todayLabel,
  type ApplicationView,
} from "@/lib/employee/application-queue";
import { caseOf, causeTitleOf } from "@/lib/employee/application-tasks";
import { nextApplicationOrderKey } from "@/lib/employee/application-order-draft";
import {
  pendingOrderStage,
  pendingOrderStageLabel,
} from "@/lib/employee/pending-orders";
import {
  rowActivation,
  rowOpener,
  rowOpenerClass,
} from "@/lib/employee/row-activation";
import { cn } from "@/lib/utils";

const EMPTY: Record<ApplicationView | "archive", { title: string; description: string }> = {
  all: {
    title: "No open applications",
    description: "Applications filed on a case arrive here the working day after filing.",
  },
  onboard: {
    title: "Nothing to onboard today",
    description: "New applications arrive here the working day after they are filed.",
  },
  decide: {
    title: "Nothing listed for today",
    description: "Applications return here on the date they are listed for.",
  },
  later: {
    title: "Nothing upcoming",
    description: "Reviews deferred and applications listed for a later date appear here.",
  },
  closed: {
    title: "Nothing closed in the last 30 days",
    description: "Older decisions are in the archive.",
  },
  archive: {
    title: "The archive is empty",
    description: "Applications closed more than 30 days ago move here.",
  },
};

/**
 * Applications — the court's one queue for the application lifecycle (owner, 2026-10-07:
 * one rail item, one list, instead of Onboard applications and Decide on applications).
 *
 * The list reads like a cause list: today's date beside the title, and the two lists the
 * bench owes today — To onboard and To decide — first and counted. Upcoming is there to
 * look ahead, never the default (Anshumanth, 2026-10-08). Orders drafted on an
 * application are signed in Sign orders, so they have no list here; under All they keep
 * their own band so none is lost. Closed holds the last 30 days, with the rest in the
 * archive below it.
 *
 * Opening a row opens the application as a pop-up over the list (`application-dialog.tsx`,
 * owner, 2026-10-21: the workstation's list beside it was a distraction). The magistrate or bench clerk can act on a
 * selection — onboard, defer or relist — where the act is a date, not a judgment; accept,
 * reject and dismiss are always one application at a time.
 */
export function ApplicationsScreen({
  initialView,
  initialOpen,
}: {
  initialView: ApplicationView | "archive";
  /** An application to open on arrival — the way back from its order. */
  initialOpen?: string;
}) {
  const router = useRouter();
  const ready = useApplicationsReady();
  const apps = useLifecycleApplications();
  const seat = useCourtRole() as CourtSeat;
  const mayAct = canTakeSystemAction(seat);
  const on = today();

  const [view, setView] = React.useState<ApplicationView | "archive">(initialView);
  const [query, setQuery] = React.useState("");
  const [selectedIds, setSelectedIds] = React.useState<ReadonlySet<string>>(new Set());
  const [bulk, setBulk] = React.useState<BulkAct | null>(null);
  const [openId, setOpenId] = React.useState<string | null>(initialOpen ?? null);
  /* The row an application was opened from, so closing it puts focus back there. */
  const openerRef = React.useRef<string | null>(initialOpen ?? null);
  const searchRef = React.useRef<HTMLInputElement>(null);

  const rows = applicationsIn(apps, view, on).filter((app) => matchesQuery(app, query));
  /* One list, soonest due first: the bands (To onboard today, To decide today…) did not
     scale (owner, 2026-10-22). The pills are the way to narrow it. */
  const banded = false;
  /* Selection is the magistrate's or bench clerk's, and only where an act on a date applies. */
  const selectable = mayAct && (view === "all" || view === "onboard" || view === "decide" || view === "later");
  const selected = rows.filter((app) => selectedIds.has(app.id));

  function changeView(next: ApplicationView | "archive") {
    setView(next);
    setSelectedIds(new Set());
    router.replace(`/employee/applications?view=${next}`, { scroll: false });
  }

  /* Opened as a pop-up over the list (owner, 2026-10-21), kept in the URL so the way
     back from its order lands on it again. */
  function open(app: LifecycleApplication) {
    openerRef.current = app.id;
    setOpenId(app.id);
    router.replace(`/employee/applications?view=${view}&open=${encodeURIComponent(app.id)}`, {
      scroll: false,
    });
  }

  function close() {
    setOpenId(null);
    router.replace(`/employee/applications?view=${view}`, { scroll: false });
  }

  function toggle(app: LifecycleApplication) {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(app.id)) next.delete(app.id);
      else next.add(app.id);
      return next;
    });
  }

  function toggleAll(select: boolean) {
    setSelectedIds(select ? new Set(rows.map((app) => app.id)) : new Set());
  }

  const acts = bulkActsFor(selected);

  /* An order already started on an application, and where it stands — so a row the bench
     has acted on does not read as untouched until the order is signed. */
  const orders = usePendingOrders();
  const signing = useOrderSigning();
  const orderOf = (app: LifecycleApplication): string | undefined => {
    const order = orders[nextApplicationOrderKey(app)];
    if (!order) return undefined;
    const stage = pendingOrderStage(order, signing);
    return stage === "triggered" ? undefined : `Order · ${pendingOrderStageLabel(stage)}`;
  };

  return (
    <div className="flex min-w-0 flex-1 flex-col gap-8 p-6 md:p-8">
      <header className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <h1 className="text-title text-balance font-semibold">Applications</h1>
        {/* The day the bench is working, as a cause list heads itself: To onboard and To
            decide are *today's* work (Anshumanth, 2026-10-08). */}
        <p className="text-body text-muted-foreground">Today · {todayLabel(on)}</p>
      </header>

      <section className="flex min-w-0 flex-col gap-6 rounded-xl border border-hairline bg-card p-6 shadow-raised">
        <CourtFilters
          leading={
            <ViewPills
              apps={apps}
              view={view === "archive" ? "closed" : view}
              on={on}
              onChange={changeView}
            />
          }
          search={{
            label: "Search applications",
            value: query,
            onChange: setQuery,
            placeholder: "Case, party or number",
          }}
          searchRef={searchRef}
          fields={[]}
          onClearAll={() => setQuery("")}
        />

        <QueueAnnouncer from={1} to={rows.length} total={rows.length} />

        <div className="flex min-h-96 min-w-0 flex-col gap-4">
          {!ready ? (
            <div className="flex flex-col gap-2" aria-busy>
              {Array.from({ length: 4 }, (_, index) => (
                <Skeleton key={index} className="h-12 w-full rounded-lg" />
              ))}
            </div>
          ) : rows.length === 0 ? (
            <Empty className="border-0 p-0">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  {query ? <SearchXIcon aria-hidden /> : <InboxIcon aria-hidden />}
                </EmptyMedia>
                <EmptyTitle className="text-title-s font-semibold">
                  {query ? "No application matches this search" : EMPTY[view].title}
                </EmptyTitle>
                <EmptyDescription className="text-body">
                  {query
                    ? "Search looks at the case, the parties, the application type and its number."
                    : EMPTY[view].description}
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            <>
              <div className="hidden min-w-0 overflow-x-auto md:block">
                <ApplicationsTable
                  rows={rows}
                  banded={banded}
                  on={on}
                  closed={view === "closed" || view === "archive"}
                  selectable={selectable}
                  selectedIds={selectedIds}
                  onToggle={toggle}
                  onToggleAll={toggleAll}
                  onOpen={open}
                  orderOf={orderOf}
                />
              </div>
              {/* Phones get the same bands as the table, each headed the same way. */}
              <div className="flex flex-col gap-6 md:hidden">
                {(banded ? bandsOf(rows, on) : [{ id: "rows", label: "", rows }]).map((band) => (
                  <section key={band.id} className="flex flex-col gap-3" aria-label={band.label || undefined}>
                    {band.label ? (
                      <h2 className="flex items-baseline gap-2 text-body-compact font-semibold">
                        {band.label}
                        <span className="font-normal tabular-nums text-muted-foreground">
                          {band.rows.length}
                        </span>
                      </h2>
                    ) : null}
                    <ul className="flex flex-col gap-3 text-body-compact">
                      {band.rows.map((app) => (
                        <QueueItemRow key={app.id} className="flex flex-col gap-2">
                          {/* The whole card opens it, so the name needs no 40px band of its
                              own: it sits on the line above the parties. */}
                          <div className="flex flex-col gap-0.5">
                            <button
                              type="button"
                              onClick={() => open(app)}
                              {...rowOpener}
                              className={cn(rowOpenerClass, "min-h-0")}
                            >
                              {app.typeLabel}
                            </button>
                            <p className="text-body-compact text-muted-foreground">
                              {causeTitleOf(app)}
                            </p>
                          </div>
                          <StatusCell app={app} on={on} order={orderOf(app)} />
                        </QueueItemRow>
                      ))}
                    </ul>
                  </section>
                ))}
              </div>
            </>
          )}

          {view === "closed" || view === "archive" ? (
            <div className="flex justify-center">
              <Button
                type="button"
                variant="ghost"
                onClick={() => changeView(view === "archive" ? "closed" : "archive")}
              >
                {view === "archive"
                  ? "Back to the last 30 days"
                  : `View archive · ${countIn(apps, "archive", on)} closed more than 30 days ago`}
              </Button>
            </div>
          ) : null}
        </div>

        {selectable && selected.length > 0 ? (
          <div className="sticky bottom-0 z-30 -mx-6 -mb-6 flex flex-wrap items-center justify-end gap-3 rounded-b-xl border-t border-hairline bg-card px-6 py-4">
            <p className="mr-auto text-body-compact tabular-nums text-muted-foreground" aria-live="polite">
              {selected.length} selected
            </p>
            <Button type="button" variant="ghost" onClick={() => setSelectedIds(new Set())}>
              Clear selection
            </Button>
            {acts.map((act, index) => (
              <Button
                key={act.kind}
                type="button"
                variant={index === 0 ? "default" : "outline"}
                onClick={() => setBulk(act)}
              >
                {act.label}
              </Button>
            ))}
          </div>
        ) : null}
      </section>

      <ApplicationDialog
        applicationId={openId}
        view={view}
        onOpenChange={(next) => {
          if (!next) close();
        }}
        onDone={(id, message) => {
          toast.success(message);
          /* On to the next in this list, as the workstation did: the one just ordered
             is left out even before its order moves it. */
          const index = rows.findIndex((row) => row.id === id);
          const rest = rows.filter((row) => row.id !== id);
          const target = rest[Math.max(0, Math.min(index, rest.length - 1))];
          if (target) open(target);
          else close();
        }}
        onReturnFocus={() =>
          window.document
            .querySelector<HTMLElement>(`[data-application-row="${openerRef.current ?? ""}"]`)
            ?.focus()
        }
      />

      <ApplicationBulkDialog
        act={bulk}
        on={on}
        seat={seat}
        onOpenChange={(open) => {
          if (!open) setBulk(null);
        }}
        onDone={(message, ids) => {
          toast.success(message);
          setSelectedIds((current) => {
            const next = new Set(current);
            for (const id of ids) next.delete(id);
            return next;
          });
        }}
      />
    </div>
  );
}

/** What a selection can have done to it in one go — only acts that are a date. */
function bulkActsFor(selected: LifecycleApplication[]): BulkAct[] {
  const review = selected.filter((app) => app.status === "pending-review" && !app.pendingOrder);
  const listed = selected.filter(
    (app) => app.status === "pending-decision" && app.decide?.mode === "date" && !app.pendingOrder,
  );
  const acts: BulkAct[] = [];
  if (review.length) {
    acts.push({ kind: "onboard", rows: review, label: `Onboard ${review.length}` });
    acts.push({ kind: "defer", rows: review, label: `Defer review of ${review.length}` });
  }
  if (listed.length) acts.push({ kind: "relist", rows: listed, label: `Relist ${listed.length}` });
  return acts;
}

/**
 * The views as a single-select pill row — the pending-tasks row (`chrome/pill-plate.ts`).
 * Counts only where they are work: To onboard and To decide.
 */
function ViewPills({
  apps,
  view,
  on,
  onChange,
}: {
  apps: LifecycleApplication[];
  view: ApplicationView;
  on: string;
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
        {/* No Upcoming pill (owner, 2026-10-22): what is listed ahead stays in All open. */}
        {APPLICATION_VIEWS.filter((entry) => entry.id !== "later").map((entry) => {
          const count = entry.counted ? countIn(apps, entry.id, on) : null;
          return (
            <Tooltip key={entry.id}>
              <TooltipTrigger asChild>
                <span className="inline-flex">
                  <ToggleGroupItem
                    value={entry.id}
                    aria-label={count === null ? entry.label : `${entry.label}, ${count}`}
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

/** Where it stands: the state in words, then the day or the objection with its overdue or due-today badge on the same line. */
function StatusCell({
  app,
  on,
  order,
}: {
  app: LifecycleApplication;
  on: string;
  /** An order under way on it, as "Order · Drafting". */
  order?: string;
}) {
  const line = statusLine(app, on);
  const closed = queueOf(app, on) === "closed" || queueOf(app, on) === "archive";
  return (
    <span className="flex flex-col items-start gap-1 text-body-compact">
      {closed ? (
        <Badge
          variant={
            app.status === "accepted"
              ? "success"
              : app.status === "rejected"
                ? "destructive"
                : "secondary"
          }
        >
          {line.word}
        </Badge>
      ) : (
        /* The due badge rides on the state's own line, in every row, so a column of them
           reads the same whatever the line under it says. */
        <span className="flex flex-wrap items-center gap-2">
          <span className="font-medium text-foreground">{line.word}</span>
          {line.due === "overdue" ? <Badge variant="destructive">Overdue</Badge> : null}
          {line.due === "today" ? <Badge variant="warning">Due today</Badge> : null}
        </span>
      )}
      {line.detail ? (
        <span
          className={app.objectionId ? "font-medium text-foreground" : "text-muted-foreground"}
        >
          {line.detail}
        </span>
      ) : null}
      {order ? <span className="font-medium text-foreground">{order}</span> : null}
    </span>
  );
}

function ApplicationsTable({
  rows,
  banded,
  on,
  closed,
  selectable,
  selectedIds,
  onToggle,
  onToggleAll,
  onOpen,
  orderOf,
}: {
  rows: LifecycleApplication[];
  banded: boolean;
  on: string;
  closed: boolean;
  selectable: boolean;
  selectedIds: ReadonlySet<string>;
  onToggle: (app: LifecycleApplication) => void;
  onToggleAll: (select: boolean) => void;
  onOpen: (app: LifecycleApplication) => void;
  orderOf: (app: LifecycleApplication) => string | undefined;
}) {
  const selectedCount = rows.filter((app) => selectedIds.has(app.id)).length;
  const allSelected = rows.length > 0 && selectedCount === rows.length;
  const columns = selectable ? 6 : 5;
  const bands = banded ? bandsOf(rows, on) : [{ id: "rows", label: "", rows }];

  return (
    <Table className="w-full border-separate border-spacing-0 text-body-compact">
      <TableHeader>
        <TableRow className={TABLE_HEAD_ROW}>
          {selectable ? (
            <TableHead className={cn(TABLE_HEAD, "w-12")}>
              <Checkbox
                checked={allSelected ? true : selectedCount > 0 ? "indeterminate" : false}
                onCheckedChange={(next) => onToggleAll(next === true)}
                aria-label={allSelected ? "Clear every application shown" : "Select every application shown"}
              />
            </TableHead>
          ) : null}
          <TableHead className={cn(TABLE_HEAD, "min-w-36 whitespace-normal")}>Application</TableHead>
          <TableHead className={cn(TABLE_HEAD, "min-w-40 whitespace-normal")}>Case</TableHead>
          {/* The two short columns take their content's width; what is left goes to the
              columns that carry words, so Status never wraps a badge onto its own line. */}
          <TableHead className={cn(TABLE_HEAD, "w-px whitespace-nowrap")}>Number</TableHead>
          <TableHead className={cn(TABLE_HEAD, "w-px whitespace-nowrap")}>Filed</TableHead>
          <TableHead className={cn(TABLE_HEAD, "min-w-56 whitespace-normal")}>
            {closed ? "Outcome" : "Status"}
          </TableHead>
        </TableRow>
      </TableHeader>
      {bands.map((band) => (
        <TableBody key={band.id} className={tableBodyClass({ selectable })}>
          {band.label ? (
            <tr>
              {/* The band label of Sign processes (`sign-process-table.tsx`): 14px, the
                  table's own size, ruled off from the rows it heads. */}
              <th scope="rowgroup" colSpan={columns} className="p-0 text-left">
                <div className="flex w-full items-baseline gap-2 border-b border-hairline px-4 pt-4 pb-2">
                  <span className="text-body-compact font-semibold text-foreground">
                    {band.label}
                  </span>
                  <span className="text-body-compact font-normal tabular-nums text-muted-foreground">
                    {band.rows.length}
                  </span>
                </div>
              </th>
            </tr>
          ) : (
            <tr aria-hidden="true">
              <td colSpan={columns} className="h-2 p-0" />
            </tr>
          )}
          {band.rows.map((app) => {
            const record = caseOf(app);
            const isSelected = selectedIds.has(app.id);
            return (
              <TableRow
                key={app.id}
                data-state={isSelected ? "selected" : undefined}
                {...rowActivation(tableRowClass({ selectable }))}
              >
                {selectable ? (
                  <TableCell className={cn(TABLE_CELL, "align-top", "w-12")}>
                    <Checkbox
                      checked={isSelected}
                      onCheckedChange={() => onToggle(app)}
                      aria-label={`Select ${app.typeLabel}, ${causeTitleOf(app)}`}
                    />
                  </TableCell>
                ) : null}
                <TableCell className={cn(TABLE_CELL, "align-top", "min-w-36 whitespace-normal")}>
                  {/* The side rides inside the opener: on its own line under it, the
                      opener's 40px floor left a gap between the two. */}
                  <button
                    type="button"
                    onClick={() => onOpen(app)}
                    {...rowOpener}
                    data-application-row={app.id}
                    className={cn(rowOpenerClass, "flex flex-col gap-0.5")}
                  >
                    {app.typeLabel}
                    {/* Under the application's name, the side alone says who filed it. */}
                    <span className="font-normal text-muted-foreground">
                      {sideLabel(app.side)}
                    </span>
                  </button>
                </TableCell>
                <TableCell className={cn(TABLE_CELL, "align-top", "min-w-40 whitespace-normal")}>
                  <span className="flex flex-col gap-1">
                    <span>{causeTitleOf(app)}</span>
                    {record ? (
                      /* A number is read whole: it never breaks at its hyphens. */
                      <span className="whitespace-nowrap text-muted-foreground">
                        <Identifier value={record.caseNumber} label="case number" />
                      </span>
                    ) : null}
                  </span>
                </TableCell>
                <TableCell className={cn(TABLE_CELL, "align-top", "whitespace-nowrap")}>
                  <span className="flex flex-col gap-1">
                    <Identifier
                      value={app.applicationNumber ?? app.temporaryId ?? "—"}
                      label={app.applicationNumber ? "application number" : "temporary number"}
                    />
                    {app.applicationNumber ? null : (
                      <span className="text-muted-foreground">Temporary</span>
                    )}
                  </span>
                </TableCell>
                <TableCell className={cn(TABLE_CELL, "align-top", "whitespace-nowrap tabular-nums")}>
                  {shortDate(app.submittedOn ?? app.createdOn)}
                </TableCell>
                <TableCell className={cn(TABLE_CELL, "align-top", "min-w-56 whitespace-normal")}>
                  <StatusCell app={app} on={on} order={orderOf(app)} />
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      ))}
    </Table>
  );
}
