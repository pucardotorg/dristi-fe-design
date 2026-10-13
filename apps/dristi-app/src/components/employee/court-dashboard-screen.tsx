"use client";

import * as React from "react";
import Link from "next/link";
import { CheckIcon, ChevronDownIcon, CircleAlertIcon } from "lucide-react";

import { useCourtText } from "@/components/court/court-provider";
import {
  TABLE_CELL,
  TABLE_HEAD,
  TABLE_HEAD_ROW,
  tableBodyClass,
  tableRowClass,
} from "@/components/chrome/table-plate";
import { CountBarChart } from "@/components/employee/count-bar-chart";
import {
  DocketCaseList,
  useCourtDocket,
  type CaseListRow,
} from "@/components/employee/docket-table";
import { useCourtSession } from "@/components/employee/use-court-role";
import { useCourtToday } from "@/components/employee/use-court-today";
import { PANEL_CLASS } from "@/components/shell/panel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  SegmentedControl,
  SegmentedControlItem,
} from "@/components/ui/segmented-control";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  COURT_LIMITS,
  courtMeasures,
  daysBetween,
  daysInStage,
  gapHistogram,
  gapSummary,
  HEARING_STAGES,
  monthKey,
  monthLabel,
  monthShortLabel,
  stageByKey,
  STAGES,
  stageHearingHistogram,
  type CourtDocket,
  type HearingStageFilter,
  type LiveProcess,
  type StageKey,
} from "@/lib/employee/court-docket";
import { formatCourtDay } from "@/lib/employee/hearings";
import { formatCount } from "@/lib/employee/register-rows";
import { registerById, registerHref } from "@/lib/employee/registers";
import { cn } from "@/lib/utils";

/**
 * `/employee` — the magistrate dashboard, Direction 1 "Briefing" (owner-finalized).
 *
 * One scrolling page in the order of the owner's note (section A2): case status and
 * disposal, time between hearings, overdue cases, process, and undated cases. Every
 * number opens what it counts — a status tile opens its register, an overdue row or a
 * process tile opens its list of cases in place — and each count is the length of that
 * register or list, because both read the one generated court (`court-docket.ts`).
 *
 * One screen for every seat; the court side's default seat is the bench clerk.
 *
 * DEMO DATA. There is no court backend yet; the court is generated and anchored to
 * today. Case rows are not links: the court side has no case-detail page to open.
 */

const PANEL = cn("rounded-xl border bg-card", PANEL_CLASS);

/** A tile that is a control — a link or a toggle — keeps the DS hover and focus. */
const TILE = cn(
  PANEL,
  "group/tile flex min-w-0 flex-col gap-2 p-4 text-left transition-colors outline-none hover:bg-accent focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
);

export function CourtDashboardScreen() {
  const docket = useCourtDocket();
  const today = useCourtToday();
  const courtText = useCourtText();
  const { court } = useCourtSession();

  return (
    <div className="flex min-w-0 flex-1 flex-col gap-12 p-6 md:p-8">
      {/* Heading and day only: Registers is in the rail, so a button to it here only
          repeated the rail (owner, 2026-10-11). */}
      <header className="flex min-w-0 flex-col gap-1">
        <h1 className="text-title text-balance font-semibold">Dashboard</h1>
        <p className="text-body text-muted-foreground">
          {courtText(court)} · {formatCourtDay(today)}
        </p>
      </header>

      <StatusSection docket={docket} />
      <HearingGapSection docket={docket} />
      <OverdueSection docket={docket} />
      <ProcessSection docket={docket} />
      <UndatedSection docket={docket} />
    </div>
  );
}

function SectionHeading({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <h2 id={id} className="text-title-s font-semibold">
      {children}
    </h2>
  );
}

/** A count's case list heading: the list's name, then how many it holds. */
function ListHeading({ id, title, count }: { id: string; title: string; count: number }) {
  return (
    <h3 id={id} className="text-body font-semibold">
      {title}
      <span className="font-normal text-muted-foreground tabular-nums">
        {" "}
        · {formatCount(count)} {count === 1 ? "case" : "cases"}
      </span>
    </h3>
  );
}

/* ------------------------------------------------- 1. case status and disposal */

function StatusSection({ docket }: { docket: CourtDocket }) {
  const m = courtMeasures(docket);
  const tiles = [
    {
      label: "ST pending",
      value: m.stPending.length,
      foot: `${formatCount(m.awaitingRegistration.length)} more awaiting registration`,
      href: registerHref("pending", "st"),
      register: "pending",
    },
    {
      label: "ST disposed",
      value: m.stDisposed.length,
      foot: `${formatCount(m.stDisposedThisMonth)} this month`,
      href: registerHref("disposed", "st"),
      register: "disposed",
    },
    {
      label: "CMP pending",
      value: m.cmpPending.length,
      foot: "Awaiting cognizance",
      href: registerHref("pending", "cmp"),
      register: "pending",
    },
    {
      label: "CMP disposed",
      value: m.cmpDisposed.length,
      foot: "Before numbering as ST",
      href: registerHref("disposed", "cmp"),
      register: "disposed",
    },
    {
      label: "Long pending (LPR)",
      value: m.longPending.length,
      foot: "Moved with CJM sanction",
      href: registerHref("calendar", "lpr"),
      register: "calendar",
    },
  ];
  const first = m.judgements[0];
  const last = m.judgements.at(-1);

  return (
    <section aria-labelledby="dash-status" className="flex min-w-0 flex-col gap-4">
      <SectionHeading id="dash-status">Case status and disposal</SectionHeading>
      <ul className="grid min-w-0 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {tiles.map((tile) => (
          <li key={tile.label} className="flex min-w-0">
            <Link href={tile.href} className={cn(TILE, "flex-1")}>
              {/* The tile is the way in: it opens that register at the view the count is
                  taken from. No icon or text cue (owner, 2026-10-11); the hover fill is
                  the affordance, and the destination is said, not shown. */}
              <span className="text-body-compact text-muted-foreground">{tile.label}</span>
              <span className="text-title font-semibold tabular-nums">{formatCount(tile.value)}</span>
              <span className="mt-auto text-caption text-muted-foreground tabular-nums">{tile.foot}</span>
              <span className="sr-only">, opens {registerById(tile.register)?.name}</span>
            </Link>
          </li>
        ))}
      </ul>

      <section aria-labelledby="dash-judgements" className={cn(PANEL, "flex min-w-0 flex-col gap-4 p-6")}>
        <div className="flex flex-col gap-1">
          <h3 id="dash-judgements" className="text-body font-semibold">
            Judgements each month
          </h3>
          <p className="text-body-compact text-muted-foreground">
            Convictions and acquittals
            {first && last ? `, ${monthLabel(first.month)} to ${monthLabel(last.month)}` : ""}
          </p>
        </div>
        <CountBarChart
          title="Judgements each month"
          unit="judgements"
          data={m.judgements.map((j) => ({
            short: monthShortLabel(j.month),
            label: monthLabel(j.month),
            value: j.value,
          }))}
        />
      </section>
    </section>
  );
}

/* --------------------------------------------------- 2. time between hearings */

const STAGE_FILTERS: { id: HearingStageFilter; label: string }[] = [
  { id: "all", label: "All stages" },
  ...HEARING_STAGES.map((stage) => ({ id: stage.key as HearingStageFilter, label: stage.label })),
];

function HearingGapSection({ docket }: { docket: CourtDocket }) {
  const [stage, setStage] = React.useState<HearingStageFilter>("all");
  const summary = gapSummary(docket, stage);
  const stageName = stage === "all" ? "all stages" : stageByKey(stage).label.toLowerCase();

  return (
    <section aria-labelledby="dash-gaps" className="flex min-w-0 flex-col gap-4">
      <SectionHeading id="dash-gaps">Time between hearings</SectionHeading>
      {/* One row: the filter leads on the left, above what it filters — the court side's
          convention (`court-filters.tsx`), not a control parked beside the heading — and
          the two figures sit beside it rather than under it (owner, 2026-10-11). On a
          narrower screen the row wraps and the figures drop below the filter. Six options
          run past a phone's width, so the control scrolls rather than widening the page. */}
      <div className="flex min-w-0 flex-wrap items-center justify-between gap-4">
        <div className="-m-1 max-w-full overflow-x-auto p-1">
          <SegmentedControl
            type="single"
            aria-label="Stage"
            value={stage}
            onValueChange={(next) => {
              if (next) setStage(next as HearingStageFilter);
            }}
          >
            {STAGE_FILTERS.map((option) => (
              <SegmentedControlItem key={option.id} value={option.id}>
                {option.label}
              </SegmentedControlItem>
            ))}
          </SegmentedControl>
        </div>

        {/* The two figures share one container, built to the filter's own height and
            radius so the row reads as a single band: tall cards beside a 40px control
            left a block of empty page between the heading, the filter and the charts
            (owner, 2026-10-11). The stage is already named by the filter, so the labels
            stay short. They open nothing, so they take no hover and no focus. */}
        <dl
          className={cn(
            PANEL,
            "flex min-h-10 min-w-0 items-center gap-4 rounded-lg px-4 max-sm:w-full max-sm:py-2",
          )}
        >
          {/* Side by side in one line where there is room; on a phone each figure stacks
              its label over its value, since both on one line run past the width. */}
          <div className="flex items-baseline gap-2 whitespace-nowrap max-sm:flex-1 max-sm:flex-col max-sm:gap-0">
            <dt className="text-body-compact text-muted-foreground">Median gap</dt>
            <dd className="text-body font-semibold tabular-nums">{formatCount(summary.median)} days</dd>
          </div>
          <div className="flex items-baseline gap-2 whitespace-nowrap border-l border-hairline pl-4 max-sm:flex-1 max-sm:flex-col max-sm:gap-0">
            <dt className="text-body-compact text-muted-foreground">Average gap</dt>
            <dd className="text-body font-semibold tabular-nums">{summary.average.toFixed(1)} days</dd>
          </div>
        </dl>
      </div>

      <div className="grid min-w-0 gap-6 lg:grid-cols-2">
        <section aria-labelledby="dash-gap-chart" className={cn(PANEL, "flex min-w-0 flex-col gap-4 p-6")}>
          <div className="flex flex-col gap-1">
            <h3 id="dash-gap-chart" className="text-body font-semibold">
              Days between successive hearings
            </h3>
            <p className="text-body-compact text-muted-foreground tabular-nums">
              {formatCount(summary.count)} gaps between hearings, {stageName}
            </p>
          </div>
          <CountBarChart
            title={`Days between successive hearings, ${stageName}`}
            unit="gaps"
            data={gapHistogram(docket, stage)}
          />
        </section>
        <section aria-labelledby="dash-held-chart" className={cn(PANEL, "flex min-w-0 flex-col gap-4 p-6")}>
          <div className="flex flex-col gap-1">
            <h3 id="dash-held-chart" className="text-body font-semibold">
              Hearings held in the current stage
            </h3>
            <p className="text-body-compact text-muted-foreground">Pending cases, {stageName}</p>
          </div>
          <CountBarChart
            title={`Hearings held in the current stage, pending cases, ${stageName}`}
            unit="cases"
            data={stageHearingHistogram(docket, stage)}
          />
        </section>
      </div>
    </section>
  );
}

/* --------------------------------------------------------- 3. overdue cases */

function OverLimitBadge({ count }: { count: number }) {
  if (count === 0) {
    return (
      <Badge variant="success">
        <CheckIcon aria-hidden data-icon="inline-start" />
        None
      </Badge>
    );
  }
  return (
    <Badge variant="warning">
      <CircleAlertIcon aria-hidden data-icon="inline-start" />
      {formatCount(count)}
    </Badge>
  );
}

function OverdueSection({ docket }: { docket: CourtDocket }) {
  const m = courtMeasures(docket);
  const [open, setOpen] = React.useState<StageKey | null>(null);
  const toggle = (key: StageKey) => setOpen((current) => (current === key ? null : key));

  return (
    <section aria-labelledby="dash-overdue" className="flex min-w-0 flex-col gap-4">
      <div className="flex flex-col gap-1">
        <SectionHeading id="dash-overdue">Overdue cases</SectionHeading>
        <p className="text-body-compact text-muted-foreground">
          Pending cases that have stayed in a stage longer than its limit. Choose a stage to see its cases.
        </p>
      </div>
      <div className={cn(PANEL, "flex min-w-0 flex-col gap-6 p-6")}>
        <div className="min-w-0">
          <Table className="w-full border-separate border-spacing-0 text-body-compact">
            <caption className="sr-only">Overdue cases by stage</caption>
            <TableHeader>
              <TableRow className={TABLE_HEAD_ROW}>
                <TableHead className={cn(TABLE_HEAD, "min-w-56")}>Stage</TableHead>
                <TableHead className={cn(TABLE_HEAD, "text-right whitespace-nowrap")}>Limit</TableHead>
                <TableHead className={cn(TABLE_HEAD, "text-right whitespace-nowrap")}>In stage</TableHead>
                <TableHead className={cn(TABLE_HEAD, "text-right whitespace-nowrap")}>Over limit</TableHead>
                <TableHead className={cn(TABLE_HEAD, "text-right whitespace-nowrap")}>Longest</TableHead>
                <TableHead className={cn(TABLE_HEAD, "w-px")}>
                  <span className="sr-only">Cases</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody className={tableBodyClass()}>
              <tr aria-hidden="true">
                <td colSpan={6} className="h-2 p-0" />
              </tr>
              {STAGES.map((stage) => {
                const over = m.overdue[stage.key];
                const isOpen = open === stage.key;
                const listId = `dash-overdue-${stage.key}`;
                const title = `${stage.label} for more than ${COURT_LIMITS.stages[stage.key]} days`;
                return (
                  <React.Fragment key={stage.key}>
                    <TableRow
                      className={cn("group/row cursor-pointer", tableRowClass({ open: isOpen }))}
                      onClick={(event) => {
                        /* The whole row answers a press; the button inside it is what the
                           keyboard and a screen reader reach. */
                        if ((event.target as HTMLElement).closest("button")) return;
                        toggle(stage.key);
                      }}
                    >
                      <TableCell className={cn(TABLE_CELL, "min-w-56 whitespace-normal")}>
                        <button
                          type="button"
                          aria-expanded={isOpen}
                          aria-controls={listId}
                          onClick={() => toggle(stage.key)}
                          className="flex min-h-10 w-full cursor-pointer flex-col items-start justify-center rounded-sm text-left outline-none focus-visible:ring-3 focus-visible:ring-focus-ring"
                        >
                          <span className="font-medium text-foreground underline-offset-4 group-hover/row:underline">
                            {stage.label}
                          </span>
                          <span className="text-muted-foreground">{stage.covers}</span>
                        </button>
                      </TableCell>
                      <TableCell className={cn(TABLE_CELL, "text-right tabular-nums whitespace-nowrap")}>
                        {COURT_LIMITS.stages[stage.key]} days
                      </TableCell>
                      <TableCell className={cn(TABLE_CELL, "text-right tabular-nums whitespace-nowrap")}>
                        {formatCount(m.byStage[stage.key].length)}
                      </TableCell>
                      <TableCell className={cn(TABLE_CELL, "text-right whitespace-nowrap")}>
                        <OverLimitBadge count={over.length} />
                      </TableCell>
                      <TableCell className={cn(TABLE_CELL, "text-right tabular-nums whitespace-nowrap")}>
                        {over.length ? (
                          `${formatCount(daysInStage(over[0], docket.today))} days`
                        ) : (
                          <span className="text-muted-foreground">
                            <span aria-hidden>—</span>
                            <span className="sr-only">None</span>
                          </span>
                        )}
                      </TableCell>
                      <TableCell className={cn(TABLE_CELL, "w-px")}>
                        <ChevronDownIcon
                          aria-hidden
                          className={cn(
                            "size-4 text-muted-foreground transition-transform",
                            isOpen && "rotate-180",
                          )}
                        />
                      </TableCell>
                    </TableRow>
                    {/* The stage's cases open in place, directly under its row, and push
                        the stages below down (owner, 2026-10-11). One full-span cell on
                        the plate's rest fill; the open row above carries the band. */}
                    {isOpen ? (
                      <TableRow id={listId} className={tableRowClass({ hover: false })}>
                        <TableCell colSpan={6} className={cn(TABLE_CELL, "h-auto px-4 pt-4 pb-6 whitespace-normal")}>
                          <section aria-labelledby={`${listId}-title`} className="flex min-w-0 flex-col gap-4">
                            <ListHeading id={`${listId}-title`} title={title} count={over.length} />
                            <DocketCaseList
                              id={listId}
                              caption={`${title}, longest first`}
                              rows={over.map((c) => ({ case: c, days: daysInStage(c, docket.today) }))}
                              daysHeader="Days in stage"
                            />
                          </section>
                        </TableCell>
                      </TableRow>
                    ) : null}
                  </React.Fragment>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </div>
    </section>
  );
}

/* ---------------------------------------------------------------- 4. process */

type ProcessCheck = "payment" | "delivery" | "soon";

const PROCESS_CHECKS: ProcessCheck[] = ["payment", "delivery", "soon"];

function processCheck(docket: CourtDocket, check: ProcessCheck) {
  const m = courtMeasures(docket);
  const limits = COURT_LIMITS.process;
  const toRows = (list: LiveProcess[], days: (x: LiveProcess) => number): CaseListRow[] =>
    list.map((x) => ({ case: x.case, days: days(x) }));
  switch (check) {
    case "payment":
      return {
        label: `Payment pending over ${limits.paymentPendingDays} days`,
        foot: "Process fee not paid",
        title: `Process payment pending over ${limits.paymentPendingDays} days`,
        daysHeader: "Days unpaid",
        rows: toRows(m.paymentPending, (x) => daysBetween(x.process.issued, docket.today)),
      };
    case "delivery":
      return {
        label: `Delivery pending over ${limits.deliveryPendingDays} days`,
        foot: "Paid, not yet served",
        title: `Process delivery pending over ${limits.deliveryPendingDays} days`,
        daysHeader: "Days undelivered",
        rows: toRows(m.deliveryPending, (x) => daysBetween(x.process.paid!, docket.today)),
      };
    case "soon":
      return {
        label: "Pending, hearing within 2 weeks",
        foot: "May not be served in time",
        title: `Process pending, hearing within ${limits.hearingWithinDays} days`,
        daysHeader: "Days to hearing",
        rows: toRows(m.hearingSoon, (x) => daysBetween(docket.today, x.case.nextHearing!)),
      };
  }
}

function ProcessSection({ docket }: { docket: CourtDocket }) {
  const m = courtMeasures(docket);
  const [open, setOpen] = React.useState<ProcessCheck | null>(null);
  const regionId = "dash-process-cases";
  const current = open ? processCheck(docket, open) : null;

  return (
    <section aria-labelledby="dash-process" className="flex min-w-0 flex-col gap-4">
      <SectionHeading id="dash-process">Process</SectionHeading>
      <ul className="grid min-w-0 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {PROCESS_CHECKS.map((check) => {
          const spec = processCheck(docket, check);
          const isOpen = open === check;
          return (
            <li key={check} className="flex min-w-0">
              <button
                type="button"
                aria-expanded={isOpen}
                aria-controls={regionId}
                onClick={() => setOpen(isOpen ? null : check)}
                className={cn(TILE, "flex-1 cursor-pointer aria-expanded:bg-accent-strong")}
              >
                <span className="text-body-compact text-muted-foreground">{spec.label}</span>
                <span className="text-title font-semibold tabular-nums">{formatCount(spec.rows.length)}</span>
                <span className="mt-auto flex flex-wrap items-end justify-between gap-x-3 gap-y-1">
                  <span className="text-caption text-muted-foreground">{spec.foot}</span>
                  <span className="inline-flex items-center gap-0.5 text-caption text-foreground">
                    {isOpen ? "Hide cases" : "See cases"}
                    <ChevronDownIcon
                      aria-hidden
                      className={cn("size-3.5 transition-transform", isOpen && "rotate-180")}
                    />
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      <div id={regionId} className="min-w-0 empty:hidden">
        {current && open ? (
          <section aria-labelledby="dash-process-list" className={cn(PANEL, "flex min-w-0 flex-col gap-4 p-6")}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <ListHeading id="dash-process-list" title={current.title} count={current.rows.length} />
              <Button type="button" variant="ghost" onClick={() => setOpen(null)}>
                Close
              </Button>
            </div>
            <DocketCaseList
              key={open}
              id={`dash-process-${open}`}
              caption={current.title}
              rows={current.rows}
              daysHeader={current.daysHeader}
            />
          </section>
        ) : null}
      </div>

      <section aria-labelledby="dash-process-average" className={cn(PANEL, "flex min-w-0 flex-col gap-4 p-6")}>
        <div className="flex flex-col gap-1">
          <h3 id="dash-process-average" className="text-body font-semibold">
            Average time for payment and delivery
          </h3>
          <p className="text-body-compact text-muted-foreground">
            All process issued since {monthLabel(monthKey(docket.start))}
          </p>
        </div>
        <div className="min-w-0">
          <Table className="w-full border-separate border-spacing-0 text-body-compact">
            <caption className="sr-only">Average time for payment and delivery</caption>
            <TableHeader>
              <TableRow className={TABLE_HEAD_ROW}>
                <TableHead className={cn(TABLE_HEAD, "whitespace-nowrap")}>Process</TableHead>
                <TableHead className={cn(TABLE_HEAD, "text-right whitespace-nowrap")}>Issued</TableHead>
                <TableHead className={cn(TABLE_HEAD, "text-right whitespace-nowrap")}>Avg. days to payment</TableHead>
                <TableHead className={cn(TABLE_HEAD, "text-right whitespace-nowrap")}>Avg. days to delivery</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody className={tableBodyClass({ hover: false })}>
              <tr aria-hidden="true">
                <td colSpan={4} className="h-2 p-0" />
              </tr>
              {m.processAverages.map((row) => (
                <TableRow key={row.type} className={tableRowClass({ hover: false })}>
                  <TableCell className={cn(TABLE_CELL, "font-medium whitespace-nowrap")}>{row.type}</TableCell>
                  <TableCell className={cn(TABLE_CELL, "text-right tabular-nums")}>{formatCount(row.issued)}</TableCell>
                  <TableCell className={cn(TABLE_CELL, "text-right tabular-nums")}>{row.toPayment.toFixed(1)}</TableCell>
                  <TableCell className={cn(TABLE_CELL, "text-right tabular-nums")}>{row.toDelivery.toFixed(1)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </section>
    </section>
  );
}

/* ---------------------------------------------------------- 5. undated cases */

function UndatedSection({ docket }: { docket: CourtDocket }) {
  const m = courtMeasures(docket);
  const rows: CaseListRow[] = m.undated.map((c) => ({
    case: c,
    days: c.previousPosting === null ? 0 : daysBetween(c.previousPosting, docket.today),
  }));

  return (
    <section aria-labelledby="dash-undated" className="flex min-w-0 flex-col gap-4">
      <div className="flex flex-col gap-1">
        <SectionHeading id="dash-undated">Undated cases</SectionHeading>
        <p className="text-body-compact text-muted-foreground tabular-nums">
          {rows.length === 1
            ? "1 pending case has no next hearing date."
            : `${formatCount(rows.length)} pending cases have no next hearing date.`}
        </p>
      </div>
      <div className={cn(PANEL, "flex min-w-0 flex-col gap-4 p-6")}>
        {rows.length === 0 ? (
          <p className="text-body-compact text-muted-foreground">
            Every pending case past registration has a next hearing date.
          </p>
        ) : (
          <DocketCaseList
            id="dash-undated-cases"
            caption="Undated cases, longest since last posting first"
            rows={rows}
            daysHeader="Days since last posting"
          />
        )}
      </div>
    </section>
  );
}
