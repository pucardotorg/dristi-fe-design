"use client";

import * as React from "react";
import { CircleAlertIcon, ConstructionIcon } from "lucide-react";

import { ChromeDialogContent } from "@/components/chrome/app-chrome";
import { Identifier } from "@/components/chrome/identifier";
import { TABLE_CELL, TABLE_HEAD, TABLE_HEAD_ROW, tableBodyClass, tableRowClass } from "@/components/chrome/table-plate";
import { CaseListBox, CountButton, PanelHeader, plural, useCaseList } from "@/components/employee/court-dashboard-attention";
import { EndedTable, OverviewCard, StageCells, type EndedKey, type Opener } from "@/components/employee/court-dashboard-parts";
import { ListFooter } from "@/components/employee/list-footer";
import { NotBuiltDialog } from "@/components/employee/not-built-dialog";
import { QueueAnnouncer } from "@/components/employee/queue-announcer";
import { useReturnFocus } from "@/components/employee/return-focus";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { courtRoleLabel, type CourtRole } from "@/lib/employee/content";
import {
  COURT_LIMITS,
  DAY_MS,
  STAGES,
  UNCONTESTED,
  daysBetween,
  monthKey,
  monthStart,
  stageByKey,
  type CourtDocket,
  type DisposalMethod,
  type DocketCase,
  type StageKey,
} from "@/lib/employee/court-docket";
import {
  closedCases,
  defaultSelection,
  formatDay,
  formatSpan,
  formatSpanFull,
  longPendingCases,
  pendingSets,
  periodReading,
  type DatedCase,
  type Period,
} from "@/lib/employee/court-flow";
import { PAGE_SIZE, type HearingsPageSize } from "@/lib/employee/hearings";
import { judgmentTarget, parseTarget, setJudgmentTarget, subscribeToJudgmentTarget } from "@/lib/employee/judgment-target";
import {
  JUDGMENT_DUE_DAYS,
  farOffCases,
  judgmentMonths,
  registerMonths,
  reservedForJudgment,
  silentCases,
  undatedCases,
} from "@/lib/employee/magistrate-view";
import type { CourtId } from "@/lib/court/profiles";
import { formatCount } from "@/lib/employee/register-rows";
import { rowActivation, rowOpener, rowOpenerClass } from "@/lib/employee/row-activation";
import { cn } from "@/lib/utils";

/**
 * A seat's own view on the dashboard ("For you"), beside the court's.
 *
 * The magistrate's is built (round 18, owner, 2026-11-15), from note 1.2, Magistrate a–d,
 * as round 11 lays them out, and designed around the acts only the magistrate does here:
 * writing judgments and giving next dates. Every other seat sees the product's "not built
 * yet" end state until its own view is designed (rounds 19 and 20), so the two tabs are
 * the same on every seat.
 *
 * Everything reads today, except "How cases ended", which reads this month so far against
 * the same days of last month, as the Court view opens.
 */

const PANEL = "flex min-w-0 flex-col gap-4 rounded-xl border border-hairline bg-card p-4 shadow-raised sm:p-6";
const SUBSECTION = "flex min-w-0 flex-col gap-4 border-t border-hairline pt-6";

const MONTHS_LONG = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];
const monthName = (key: number) => `${MONTHS_LONG[key % 12]} ${Math.floor(key / 12)}`;
const dayCount = (n: number) => `${formatCount(n)} ${n === 1 ? "day" : "days"}`;

/* ------------------------------------------------------------- the view */

export function ForYouView({
  docket,
  role,
  court,
}: {
  docket: CourtDocket;
  role: CourtRole;
  court: CourtId;
}) {
  if (role === "magistrate") return <MagistrateView docket={docket} court={court} />;
  return (
    <section aria-label={`For you, ${courtRoleLabel(role, court)}`} className={PANEL}>
      <Empty className="border-0 p-0 py-8">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <ConstructionIcon aria-hidden />
          </EmptyMedia>
          <EmptyTitle className="text-title-s font-semibold">Not built yet</EmptyTitle>
          <EmptyDescription className="text-body text-pretty">
            The {courtRoleLabel(role, court).toLowerCase()}&rsquo;s own view hasn&rsquo;t been built yet.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    </section>
  );
}

/** The cases on the magistrate's own lists: the count the "For you" tab carries. */
export function forYouCount(docket: CourtDocket, role: CourtRole): number | null {
  if (role !== "magistrate") return null;
  const ids = new Set<number>();
  for (const r of undatedCases(docket)) ids.add(r.case.id);
  for (const r of farOffCases(docket)) ids.add(r.case.id);
  for (const r of silentCases(docket)) ids.add(r.case.id);
  return ids.size;
}

type Opening = { item: string; opens: string } | null;

function MagistrateView({ docket, court }: { docket: CourtDocket; court: CourtId }) {
  /* Rows open the case file or the scheduling flow, neither built yet: the product's
     "not built yet" end state, as every court queue does (owner, 2026-09-15). */
  const [opening, setOpening] = React.useState<Opening>(null);
  const open = (opens: string) => (c: DocketCase) => setOpening({ item: c.title, opens });
  return (
    <>
      <JudgmentsPanel docket={docket} court={court} onOpen={open("the case file, to write the judgment")} />
      <RegistersPanel docket={docket} />
      <NextDatesPanel docket={docket} onOpenUndated={open("the scheduling flow for this case")} onOpenFar={open("the case file")} />
      <SilentPanel docket={docket} onOpen={open("the case file")} />
      <StagesPanel docket={docket} />
      <EndedPanel docket={docket} />
      <NotBuiltDialog
        item={opening?.item ?? null}
        opens={opening?.opens ?? "the case file"}
        open={opening !== null}
        onOpenChange={(next) => {
          if (!next) setOpening(null);
        }}
      />
    </>
  );
}

/* ------------------------------------------------------------- a case list */

type Column<T> = { header: string; cell: (row: T) => React.ReactNode; numeric?: boolean };

/**
 * A list whose rows open the case they name: the court queues' row (cause title as the
 * opener, the case number beside it) on the dashboard's table plate, with the shared
 * footer. Longest waiting first, as each list is sorted.
 */
function CaseTable<T extends { case: DocketCase }>({
  id,
  caption,
  rows,
  columns,
  onOpen,
}: {
  id: string;
  caption: string;
  rows: T[];
  columns: Column<T>[];
  onOpen: (c: DocketCase) => void;
}) {
  const [pageSize, setPageSize] = React.useState<HearingsPageSize>(PAGE_SIZE);
  const [page, setPage] = React.useState(1);
  const pageCount = Math.max(1, Math.ceil(rows.length / pageSize));
  const current = Math.min(page, pageCount);
  const start = (current - 1) * pageSize;
  const pageRows = rows.slice(start, start + pageSize);
  return (
    <div className="flex min-w-0 flex-col gap-4">
      <QueueAnnouncer from={start + 1} to={start + pageRows.length} total={rows.length} />
      <div className="min-w-0 overflow-x-auto">
        <Table className="w-full border-separate border-spacing-0 text-body-compact">
          <caption className="sr-only">{caption}</caption>
          <TableHeader>
            <TableRow className={TABLE_HEAD_ROW}>
              <TableHead className={cn(TABLE_HEAD, "min-w-64 whitespace-normal")}>Case name</TableHead>
              <TableHead className={cn(TABLE_HEAD, "whitespace-nowrap")}>Case number</TableHead>
              {columns.map((column) => (
                <TableHead key={column.header} className={cn(TABLE_HEAD, "whitespace-nowrap", column.numeric && "text-right")}>
                  {column.header}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody className={tableBodyClass()}>
            <tr aria-hidden="true">
              <td colSpan={columns.length + 2} className="h-2 p-0" />
            </tr>
            {pageRows.map((row) => (
              <TableRow key={row.case.id} {...rowActivation(tableRowClass())}>
                <TableCell className={cn(TABLE_CELL, "min-w-64 font-medium whitespace-normal")}>
                  <button type="button" onClick={() => onOpen(row.case)} {...rowOpener} className={rowOpenerClass}>
                    <span className="sr-only">Open </span>
                    {row.case.title}
                  </button>
                </TableCell>
                <TableCell className={cn(TABLE_CELL, "whitespace-nowrap")}>
                  <Identifier value={row.case.caseNumber} label="case number" />
                </TableCell>
                {columns.map((column) => (
                  <TableCell key={column.header} className={cn(TABLE_CELL, "whitespace-nowrap", column.numeric && "text-right tabular-nums")}>
                    {column.cell(row)}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <ListFooter
        id={`${id}-page-size`}
        from={start + 1}
        to={start + pageRows.length}
        total={rows.length}
        page={current}
        pageCount={pageCount}
        onPageChange={setPage}
        pageSize={pageSize}
        onPageSizeChange={(size) => {
          setPageSize(size);
          setPage(1);
        }}
      />
    </div>
  );
}

const stageCell = <T extends { case: DocketCase }>(): Column<T> => ({
  header: "Stage",
  cell: (row) => (row.case.stage ? stageByKey(row.case.stage).label : "–"),
});

/** A heading inside a panel, with the count line under it. */
function SubHeading({ id, title, line }: { id: string; title: string; line: string }) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <h3 id={id} className="text-body font-semibold">
        {title}
      </h3>
      <p className="text-body-compact text-muted-foreground tabular-nums">{line}</p>
    </div>
  );
}

/* ------------------------------------------------------------- judgments (a) */

const NO_TARGET = () => null;

function useJudgmentTarget(court: CourtId): number | null {
  return React.useSyncExternalStore(
    (listener) => subscribeToJudgmentTarget(court, listener),
    () => judgmentTarget(court),
    NO_TARGET,
  );
}

/**
 * Judgments against the magistrate's own target: this month so far, last month, and the
 * cases reserved for judgment — the ones that can still become this month's. Judgments are
 * convictions and acquittals: contested disposals.
 */
function JudgmentsPanel({ docket, court, onOpen }: { docket: CourtDocket; court: CourtId; onOpen: (c: DocketCase) => void }) {
  const target = useJudgmentTarget(court);
  const [editing, setEditing] = React.useState(false);
  const months = judgmentMonths(docket, 6);
  const now = months[months.length - 1];
  const last = months[months.length - 2];
  const today = docket.today;
  const thisMonth: Period = { from: monthStart(now.month), to: today };
  const lastMonth: Period = { from: monthStart(last.month), to: monthStart(now.month) - DAY_MS };
  const dayOfMonth = daysBetween(thisMonth.from, today) + 1;
  const daysInMonth = daysBetween(thisMonth.from, monthStart(now.month + 1));
  const left = daysInMonth - dayOfMonth;
  const pace = Math.round((now.value / dayOfMonth) * daysInMonth);
  const onTarget = target === null ? 0 : months.slice(0, -1).filter((m) => m.value >= target).length;
  const reserved = reservedForJudgment(docket);
  const late = reserved.filter((r) => r.days > JUDGMENT_DUE_DAYS).length;

  const list = useCaseList<"now" | "last">();
  const listId = "you-judgments-cases";
  const judgedIn = (p: Period) =>
    closedCases(docket, p).filter((r) => r.outcome !== "toLongPending" && !UNCONTESTED.has(r.method as DisposalMethod));
  const opener = (key: "now" | "last"): Opener => ({ expanded: list.open === key, controls: listId, onOpen: (from) => list.toggle(key, from) });
  const spec = list.open
    ? list.open === "now"
      ? { title: `Judgments · ${formatSpanFull(thisMonth.from, thisMonth.to)}`, rows: judgedIn(thisMonth) }
      : { title: `Judgments · ${monthName(last.month)}`, rows: judgedIn(lastMonth) }
    : null;

  const count = (value: number, key: "now" | "last", name: string) =>
    value ? (
      <CountButton name={name} className="text-title-l font-semibold" {...opener(key)}>
        {formatCount(value)}
      </CountButton>
    ) : (
      <span className="inline-flex min-h-10 items-center text-title-l font-semibold text-muted-foreground">0</span>
    );

  return (
    <section aria-labelledby="you-judgments" className={cn(PANEL, "gap-6")}>
      <div className="flex min-w-0 flex-col gap-4">
        <PanelHeader id="you-judgments" title="Judgments">
          {target === null ? (
            <Button type="button" variant="outline" onClick={() => setEditing(true)}>
              Set a target
            </Button>
          ) : (
            <div className="flex flex-wrap items-center gap-3">
              <p className="text-body-compact text-muted-foreground tabular-nums">
                Target <span className="font-semibold text-foreground">{formatCount(target)} a month</span>
              </p>
              <Button type="button" variant="outline" onClick={() => setEditing(true)}>
                Change
              </Button>
            </div>
          )}
        </PanelHeader>
        <div className="grid min-w-0 gap-3 md:grid-cols-2">
          <OverviewCard
            label={`This month, ${formatSpan(thisMonth.from, thisMonth.to, today)}`}
            count={
              <p className="flex items-baseline gap-2">
                {count(now.value, "now", "judgments this month")}
                {target !== null ? <span className="text-body text-muted-foreground tabular-nums">of {formatCount(target)}</span> : null}
              </p>
            }
            change={
              target === null ? (
                <p className="text-body-compact text-muted-foreground tabular-nums">{dayCount(left)} left</p>
              ) : (
                <div className="flex w-full flex-col gap-2">
                  <Progress
                    value={Math.min(100, (now.value / target) * 100)}
                    aria-label={`${formatCount(now.value)} of ${formatCount(target)} judgments this month`}
                    className="my-1"
                  />
                  <p className="text-body-compact text-muted-foreground tabular-nums">
                    {now.value >= target ? (
                      <>
                        <span className="font-semibold">Target met</span> · {formatCount(now.value - target)} over
                      </>
                    ) : (
                      <>
                        <span className="font-semibold">{formatCount(target - now.value)}</span> to go
                      </>
                    )}{" "}
                    · {dayCount(left)} left
                  </p>
                </div>
              )
            }
            fact={target === null ? undefined : `At this rate, ${formatCount(pace)} by the month’s end`}
          />
          <OverviewCard
            label={monthName(last.month)}
            count={count(last.value, "last", `judgments in ${monthName(last.month)}`)}
            change={
              target === null ? null : (
                <p className="text-body-compact text-muted-foreground tabular-nums">
                  <span className={cn("font-semibold", last.value < target && "text-destructive-ink")}>
                    <span aria-hidden>{last.value >= target ? "▲ " : "▼ "}</span>
                    {formatCount(Math.abs(last.value - target))}
                  </span>{" "}
                  {last.value >= target ? "over the target" : "under the target"}
                </p>
              )
            }
            fact={target === null ? undefined : `On target in ${onTarget} of the last 6 months`}
          />
        </div>
        <div id={listId} className="min-w-0 empty:hidden">
          {spec && list.open ? (
            <CaseListBox
              key={list.open}
              id={`you-judgments-${list.open}`}
              title={spec.title}
              summary={plural(spec.rows.length, "case", "cases")}
              rows={spec.rows}
              daysHeader="Days from filing to judgment"
              onClose={list.close}
            />
          ) : null}
        </div>
      </div>

      <section aria-labelledby="you-reserved" className={SUBSECTION}>
        <SubHeading
          id="you-reserved"
          title="Reserved for judgment"
          line={`${plural(reserved.length, "case", "cases")} · ${formatCount(late)} waiting more than ${JUDGMENT_DUE_DAYS} days`}
        />
        {reserved.length ? (
          <CaseTable
            id="you-reserved-list"
            caption="Reserved for judgment"
            rows={reserved}
            onOpen={onOpen}
            columns={[
              { header: "Reserved on", cell: (r) => formatDay(r.since) },
              {
                header: "Waiting",
                numeric: true,
                cell: (r) =>
                  r.days > JUDGMENT_DUE_DAYS ? (
                    <Badge variant="warning">
                      <CircleAlertIcon aria-hidden data-icon="inline-start" />
                      {dayCount(r.days)}
                      <span className="sr-only">, over {JUDGMENT_DUE_DAYS} days</span>
                    </Badge>
                  ) : (
                    dayCount(r.days)
                  ),
              },
              { header: "Next hearing", cell: (r) => (r.case.nextHearing === null ? "–" : formatDay(r.case.nextHearing)) },
            ]}
          />
        ) : (
          <p className="text-body-compact text-muted-foreground">No cases reserved for judgment</p>
        )}
      </section>

      {editing ? (
        <TargetDialog open onOpenChange={setEditing} current={target} onSave={(value) => setJudgmentTarget(court, value)} />
      ) : null}
    </section>
  );
}

/**
 * Setting the target: one field, entered by hand, so a click outside does not discard it
 * (entry dialogs ignore outside clicks; owner, popup rule). Removing the target is offered
 * only once there is one.
 */
function TargetDialog({
  open,
  onOpenChange,
  current,
  onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  current: number | null;
  onSave: (value: number | null) => void;
}) {
  /* Mounted only while open, so each opening starts from the target as it stands. */
  const [draft, setDraft] = React.useState(current === null ? "" : String(current));
  const [error, setError] = React.useState<string | null>(null);
  const inputId = React.useId();
  const returnFocus = useReturnFocus();
  const save = (event: React.FormEvent) => {
    event.preventDefault();
    const value = parseTarget(draft);
    if (value === null) {
      setError("Enter a whole number from 1 to 999.");
      return;
    }
    onSave(value);
    onOpenChange(false);
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <ChromeDialogContent className="sm:max-w-md" aria-describedby={undefined} onInteractOutside={(event) => event.preventDefault()} {...returnFocus}>
        <form onSubmit={save} className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle className="text-title-s font-semibold">Monthly judgment target</DialogTitle>
          </DialogHeader>
          <Field data-invalid={error ? true : undefined}>
            <FieldLabel htmlFor={inputId}>Judgments a month</FieldLabel>
            <Input
              id={inputId}
              inputMode="numeric"
              autoComplete="off"
              value={draft}
              aria-invalid={error ? true : undefined}
              onChange={(event) => {
                setDraft(event.target.value);
                if (error) setError(null);
              }}
              className="sm:w-40"
            />
            {error ? <FieldError>{error}</FieldError> : null}
          </Field>
          <DialogFooter>
            {current !== null ? (
              <Button
                type="button"
                variant="ghost"
                className="sm:mr-auto"
                onClick={() => {
                  onSave(null);
                  onOpenChange(false);
                }}
              >
                Remove target
              </Button>
            ) : null}
            <DialogClose asChild>
              <Button type="button" variant="outline">
                Cancel
              </Button>
            </DialogClose>
            <Button type="submit">Save</Button>
          </DialogFooter>
        </form>
      </ChromeDialogContent>
    </Dialog>
  );
}

/* ------------------------------------------------------------- registers (a) */

type RegisterKey = "judgments" | "stDisposed" | "cmpDisposed" | "toLongPending" | "stPending" | "cmpPending" | "longPending";

const REGISTER_COLUMNS: { key: RegisterKey; header: string }[] = [
  { key: "judgments", header: "Judgments" },
  { key: "stDisposed", header: "ST disposed" },
  { key: "cmpDisposed", header: "CMP disposed" },
  { key: "toLongPending", header: "To the LPR" },
  { key: "stPending", header: "ST pending" },
  { key: "cmpPending", header: "CMP pending" },
  { key: "longPending", header: "LPR" },
];

/**
 * The registers month by month, to check against the physical ones: what moved in each
 * month, then what stood on each register at its end. This month's counts open their
 * cases; past months are the figures to tally.
 */
function RegistersPanel({ docket }: { docket: CourtDocket }) {
  const rows = registerMonths(docket, 6);
  const today = docket.today;
  const period: Period = { from: monthStart(monthKey(today)), to: today };
  const list = useCaseList<RegisterKey>();
  const listId = "you-registers-cases";
  const opener = (key: RegisterKey): Opener => ({ expanded: list.open === key, controls: listId, onOpen: (from) => list.toggle(key, from) });
  const resolve = (key: RegisterKey): { title: string; rows: DatedCase[]; daysHeader: string } => {
    const closed = closedCases(docket, period);
    const disposed = closed.filter((r) => r.outcome !== "toLongPending");
    const sets = pendingSets(docket, period);
    const span = formatSpanFull(period.from, period.to);
    switch (key) {
      case "judgments":
        return { title: `Judgments · ${span}`, rows: disposed.filter((r) => !UNCONTESTED.has(r.method as DisposalMethod)), daysHeader: "Days from filing to judgment" };
      case "stDisposed":
        return { title: `Disposed from the ST register · ${span}`, rows: disposed.filter((r) => !r.beforeCognizance), daysHeader: "Days from filing to disposal" };
      case "cmpDisposed":
        return { title: `Disposed from the CMP register · ${span}`, rows: disposed.filter((r) => r.beforeCognizance), daysHeader: "Days from filing to disposal" };
      case "toLongPending":
        return { title: `Moved to the long pending register · ${span}`, rows: closed.filter((r) => r.outcome === "toLongPending"), daysHeader: "Days from filing to closing" };
      case "stPending":
        return { title: "Pending today · ST register", rows: sets.st, daysHeader: "Days in court" };
      case "cmpPending":
        return { title: "Pending today · CMP register", rows: sets.cmp, daysHeader: "Days in court" };
      case "longPending":
        return { title: "On the long pending register today", rows: longPendingCases(docket, today), daysHeader: "Days in court" };
    }
  };
  const spec = list.open ? resolve(list.open) : null;
  return (
    <section aria-labelledby="you-registers" className={PANEL}>
      <div className="flex min-w-0 flex-col gap-1">
        <h2 id="you-registers" className="text-title-s font-semibold">
          Registers
        </h2>
        <p className="text-body-compact text-muted-foreground tabular-nums">
          The last 6 months, and this month to {formatDay(today)}
        </p>
      </div>
      <div className="min-w-0 overflow-x-auto">
        <Table aria-labelledby="you-registers" className="tabular-nums">
          <TableHeader>
            <TableRow className={TABLE_HEAD_ROW}>
              <TableHead scope="col" className={cn(TABLE_HEAD, "whitespace-nowrap")}>Month</TableHead>
              {REGISTER_COLUMNS.map((c) => (
                /* A figure is narrow and its header long: the header wraps over the column
                   instead of setting its width, as the register tables do. */
                <TableHead key={c.key} scope="col" className={cn(TABLE_HEAD, "h-auto min-w-20 text-right whitespace-normal")}>
                  {c.header}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody className={tableBodyClass({ hover: false })}>
            {rows.map((r, i) => {
              const lastRow = i === rows.length - 1;
              return (
                <TableRow key={r.month} className={tableRowClass({ hover: false })}>
                  <th scope="row" className={cn(TABLE_CELL, "whitespace-nowrap", r.partial ? "font-semibold" : "font-normal", lastRow && "border-b-0")}>
                    {monthName(r.month)}
                    {r.partial ? <span className="font-normal text-muted-foreground"> · to date</span> : null}
                  </th>
                  {REGISTER_COLUMNS.map((c) => (
                    <TableCell key={c.key} className={cn(TABLE_CELL, "text-right", lastRow && "border-b-0")}>
                      {r.partial && r[c.key] ? (
                        <CountButton name={`${c.header.toLowerCase()}, ${monthName(r.month)}`} {...opener(c.key)}>
                          {formatCount(r[c.key])}
                        </CountButton>
                      ) : (
                        formatCount(r[c.key])
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
      <div id={listId} className="min-w-0 empty:hidden">
        {spec && list.open ? (
          <CaseListBox
            key={list.open}
            id={`you-registers-${list.open}`}
            title={spec.title}
            summary={plural(spec.rows.length, "case", "cases")}
            rows={spec.rows}
            daysHeader={spec.daysHeader}
            onClose={list.close}
          />
        ) : null}
      </div>
    </section>
  );
}

/* ------------------------------------------------------------- next dates (d, b) */

/**
 * The cases waiting on a next date from the magistrate: none given yet (opens scheduling),
 * then given but far off — judged against the stage's own usual gap, since a sensible gap
 * differs by stage (note 1.1).
 */
function NextDatesPanel({
  docket,
  onOpenUndated,
  onOpenFar,
}: {
  docket: CourtDocket;
  onOpenUndated: (c: DocketCase) => void;
  onOpenFar: (c: DocketCase) => void;
}) {
  const undated = undatedCases(docket);
  const far = farOffCases(docket);
  return (
    <section aria-labelledby="you-dates" className={cn(PANEL, "gap-6")}>
      <h2 id="you-dates" className="text-title-s font-semibold">
        Next hearing dates
      </h2>
      <section aria-labelledby="you-undated" className="flex min-w-0 flex-col gap-4">
        <SubHeading
          id="you-undated"
          title="No next hearing date"
          line={
            undated.length
              ? `${plural(undated.length, "case", "cases")} · longest ${dayCount(undated[0].days)} since a hearing`
              : "None"
          }
        />
        {undated.length ? (
          <CaseTable
            id="you-undated-list"
            caption="No next hearing date"
            rows={undated}
            onOpen={onOpenUndated}
            columns={[
              stageCell(),
              { header: "Last hearing", cell: (r) => (r.case.previousPosting === null ? "–" : formatDay(r.case.previousPosting)) },
              { header: "Since", numeric: true, cell: (r) => dayCount(r.days) },
            ]}
          />
        ) : null}
      </section>
      <section aria-labelledby="you-far" className={SUBSECTION}>
        <SubHeading
          id="you-far"
          title="Next date far off"
          line={far.length ? `${plural(far.length, "case", "cases")} listed more than twice the usual gap for their stage` : "None"}
        />
        {far.length ? (
          <CaseTable
            id="you-far-list"
            caption="Next date far off"
            rows={far}
            onOpen={onOpenFar}
            columns={[
              stageCell(),
              { header: "Last hearing", cell: (r) => formatDay(r.case.previousPosting!) },
              { header: "Next hearing", cell: (r) => formatDay(r.case.nextHearing!) },
              { header: "Gap", numeric: true, cell: (r) => dayCount(r.gap) },
              { header: "Usual for the stage", numeric: true, cell: (r) => dayCount(r.usual) },
            ]}
          />
        ) : null}
      </section>
    </section>
  );
}

/* ------------------------------------------------------------- silent (c) */

function SilentPanel({ docket, onOpen }: { docket: CourtDocket; onOpen: (c: DocketCase) => void }) {
  const rows = silentCases(docket);
  const days = COURT_LIMITS.silentDays;
  return (
    <section aria-labelledby="you-silent" className={PANEL}>
      <div className="flex min-w-0 flex-col gap-1">
        <h2 id="you-silent" className="text-title-s font-semibold">
          Silent cases
        </h2>
        <p className="text-body-compact text-muted-foreground tabular-nums">
          No hearing, filing, process step or deposition for {days} days · not on the long pending register
        </p>
      </div>
      {rows.length ? (
        <CaseTable
          id="you-silent-list"
          caption="Silent cases"
          rows={rows}
          onOpen={onOpen}
          columns={[
            stageCell(),
            { header: "Last activity", cell: (r) => `${r.what} · ${formatDay(r.last)}` },
            { header: "Silent for", numeric: true, cell: (r) => dayCount(r.days) },
            { header: "Next hearing", cell: (r) => (r.case.nextHearing === null ? "–" : formatDay(r.case.nextHearing)) },
          ]}
        />
      ) : (
        <Empty className="border border-dashed border-hairline p-8">
          <EmptyHeader>
            <EmptyTitle className="text-title-s font-semibold">No silent cases</EmptyTitle>
            <EmptyDescription className="text-body text-pretty">
              Every pending case has had a hearing, filing or process step in the last {days} days.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      )}
    </section>
  );
}

/* ------------------------------------------------------------- added: stages, outcomes */

/** Pending today by stage: the Court view's stage cells, without its time table. */
function StagesPanel({ docket }: { docket: CourtDocket }) {
  const period = defaultSelection(docket);
  const sets = pendingSets(docket, period);
  const total = sets.all.length;
  const list = useCaseList<`stage-${StageKey}`>();
  const listId = "you-stages-cases";
  const opener = (key: `stage-${StageKey}`): Opener => ({ expanded: list.open === key, controls: listId, onOpen: (from) => list.toggle(key, from) });
  const stage = list.open ? STAGES.find((s) => `stage-${s.key}` === list.open) : null;
  return (
    <section aria-labelledby="you-stages" className={PANEL}>
      <div className="flex min-w-0 flex-col gap-1">
        <h2 id="you-stages" className="text-title-s font-semibold">
          Pending cases by stage
        </h2>
        <p className="text-body-compact text-muted-foreground tabular-nums">{plural(total, "case", "cases")} pending today</p>
      </div>
      <StageCells
        counts={Object.fromEntries(STAGES.map((s) => [s.key, sets.byStage[s.key].length])) as Record<StageKey, number>}
        total={total}
        opener={opener}
        idPrefix="you-by-stage"
      />
      <div id={listId} className="min-w-0 empty:hidden">
        {stage && list.open ? (
          <CaseListBox
            key={list.open}
            id={`you-stages-${stage.key}`}
            title={`Pending today · ${stage.label}`}
            summary={`${plural(sets.byStage[stage.key].length, "case", "cases")} · longest in court first`}
            rows={sets.byStage[stage.key]}
            daysHeader="Days in court"
            onClose={list.close}
          />
        ) : null}
      </div>
    </section>
  );
}

/** How cases ended this month so far, against the same days of last month: the Court view's table. */
function EndedPanel({ docket }: { docket: CourtDocket }) {
  const reading = periodReading(defaultSelection(docket), docket, "prev");
  const base = reading.baseline[0];
  const baseline = base ? formatSpan(base.from, base.to, docket.today) : null;
  const list = useCaseList<EndedKey>();
  const listId = "you-ended-cases";
  const opener = (key: EndedKey): Opener => ({ expanded: list.open === key, controls: listId, onOpen: (from) => list.toggle(key, from) });
  const closed = closedCases(docket, reading.selection);
  const disposed = closed.filter((r) => r.outcome !== "toLongPending");
  const span = formatSpanFull(reading.selection.from, reading.selection.to);
  const resolve = (key: EndedKey) => {
    if (key === "toLongPending") return { title: `Moved to long pending · ${span}`, rows: closed.filter((r) => r.outcome === "toLongPending") };
    const contested = (r: (typeof disposed)[number]) => !UNCONTESTED.has(r.method as DisposalMethod);
    if (key === "contested") return { title: `Disposed · Contested · ${span}`, rows: disposed.filter(contested) };
    if (key === "uncontested") return { title: `Disposed · Uncontested · ${span}`, rows: disposed.filter((r) => !contested(r)) };
    const method = key.slice(7);
    return { title: `Disposed · ${method} · ${span}`, rows: disposed.filter((r) => r.method === method) };
  };
  const spec = list.open ? resolve(list.open) : null;
  return (
    <section aria-labelledby="you-ended" className={PANEL}>
      <div className="flex min-w-0 flex-col gap-1">
        <h2 id="you-ended" className="text-title-s font-semibold">
          How cases ended
        </h2>
        <p className="text-body-compact text-muted-foreground tabular-nums">
          {span}
          {baseline ? ` · last column ${baseline}` : null}
        </p>
      </div>
      <EndedTable docket={docket} reading={reading} baseline={baseline} opener={opener} labelledBy="you-ended" />
      <div id={listId} className="min-w-0 empty:hidden">
        {spec && list.open ? (
          <CaseListBox
            key={list.open}
            id={`you-ended-${list.open}`}
            title={spec.title}
            summary={plural(spec.rows.length, "case", "cases")}
            rows={spec.rows}
            daysHeader="Days from filing to closing"
            onClose={list.close}
          />
        ) : null}
      </div>
    </section>
  );
}
