"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowRightIcon, CircleAlertIcon } from "lucide-react";

import { TABLE_CELL, TABLE_HEAD, TABLE_HEAD_ROW, tableBodyClass, tableRowClass } from "@/components/chrome/table-plate";
import { Identifier } from "@/components/chrome/identifier";
import { useCourtDocket } from "@/components/employee/docket-table";
import { ListFooter } from "@/components/employee/list-footer";
import { NotBuiltDialog } from "@/components/employee/not-built-dialog";
import { QueueAnnouncer } from "@/components/employee/queue-announcer";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia } from "@/components/ui/empty";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { COURT_LIMITS, stageByKey, type CourtDocket, type DocketCase } from "@/lib/employee/court-docket";
import { formatDay } from "@/lib/employee/court-flow";
import { forYouListHref, FOR_YOU_LISTS, type ForYouListId } from "@/lib/employee/for-you-lists";
import { PAGE_SIZE, type HearingsPageSize } from "@/lib/employee/hearings";
import { JUDGMENT_DUE_DAYS, farOffCases, reservedForJudgment, silentCases, undatedCases } from "@/lib/employee/magistrate-view";
import { formatCount } from "@/lib/employee/register-rows";
import { rowActivation, rowOpener, rowOpenerClass } from "@/lib/employee/row-activation";
import { cn } from "@/lib/utils";

/**
 * The magistrate's lists (note 1.2, Magistrate b–d, and the cases reserved for judgment),
 * each in two sizes (owner, 2026-11-15): a card on the "For you" tab — the count as its
 * headline, one fact, the three most urgent cases, and the way to all of them — and the
 * whole list on a page of its own, with the columns and pagination the tab used to carry.
 */

export const PANEL = "flex min-w-0 flex-col gap-4 rounded-xl border border-hairline bg-card p-4 shadow-raised sm:p-6";

/** A list's card sits inside the "Cases waiting on you" panel (owner, 2026-11-16), its
    title a step under the panel's own heading. The card keeps the panel's edge, without
    its shadow, so one raised surface holds the four. Tighter on a phone, where its
    padding comes inside the panel's. */
const CARD = "flex min-w-0 flex-col gap-4 rounded-xl border border-hairline bg-card p-3 sm:p-6";

export const dayCount = (n: number) => `${formatCount(n)} ${n === 1 ? "day" : "days"}`;

/* ------------------------------------------------------------- the table */

export type Column<T> = { header: string; cell: (row: T) => React.ReactNode; numeric?: boolean };

type Row = { case: DocketCase };

/**
 * A list whose rows open the case they name: the court queues' row (cause title as the
 * opener, the case number beside it) on the dashboard's table plate, with the shared
 * footer. The list's own page.
 */
export function CaseTable<T extends Row>({
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

/**
 * A card's preview: a picture of the list, not the list (owner, 2026-11-16) — its first
 * rows in a beige well, as the empty card's well, with no column headers and nothing to
 * click or copy. Each row is the case, its number, and the list's one figure; a screen
 * reader hears what the figure is. The number sits under the name on a phone.
 */
function PreviewList<T extends Row>({ label, rows, figure }: { label: string; rows: T[]; figure: Column<T> }) {
  return (
    <ul aria-label={label} className="flex min-w-0 flex-col rounded-xl bg-surface-sunken px-4">
      {rows.map((row) => (
        <li
          key={row.case.id}
          className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 border-b border-hairline py-3 text-body-compact last:border-b-0 sm:grid-cols-[minmax(0,1fr)_auto_auto]"
        >
          <span className="min-w-0">
            <span className="block font-medium text-pretty">{row.case.title}</span>
            <span className="block text-muted-foreground sm:hidden">
              <Identifier value={row.case.caseNumber} label="case number" copyable={false} />
            </span>
          </span>
          <span className="hidden whitespace-nowrap sm:block">
            <Identifier value={row.case.caseNumber} label="case number" copyable={false} />
          </span>
          <span className="text-right whitespace-nowrap tabular-nums">
            <span className="sr-only">{figure.header}: </span>
            {figure.cell(row)}
          </span>
        </li>
      ))}
    </ul>
  );
}

const stageCell = <T extends Row>(): Column<T> => ({
  header: "Stage",
  cell: (row) => (row.case.stage ? stageByKey(row.case.stage).label : "–"),
});

/* ------------------------------------------------------------- the lists */

type ListSpec<T extends Row> = {
  id: ForYouListId;
  title: string;
  href: string;
  rows: T[];
  /** The one fact beside the count, on the list's page: the worst case, not the rule. */
  fact: string;
  /** The same fact as the card's line under its title. `warn` draws its figure in amber:
      every list's worst case is past its own limit (no date, the usual gap, 60 silent
      days), and the reserved list's once any case waits past 10 days (owner, 2026-11-16). */
  stat: { value: number; days?: boolean; label: string; warn?: boolean } | null;
  /** What puts a case on the list, said on the list's own page. */
  rule?: string;
  /** The whole card when there are none: "none in the last 60 days". */
  empty: string;
  /** The card's one figure per case, beside its name and number; `header` names it for a
      screen reader, as the preview shows no column headers. */
  preview: Column<T>;
  /** The page's columns, as the tab carried them. */
  full: Column<T>[];
  /** Where a row leads; neither is built, so a row ends on "not built yet". */
  opens: string;
};

/** Days waiting, flagged once past the judgment-stage limit. */
const waiting = (days: number) =>
  days > JUDGMENT_DUE_DAYS ? (
    <Badge variant="warning">
      <CircleAlertIcon aria-hidden data-icon="inline-start" />
      {dayCount(days)}
      <span className="sr-only">, over {JUDGMENT_DUE_DAYS} days</span>
    </Badge>
  ) : (
    dayCount(days)
  );

const nextHearing: Column<Row> = {
  header: "Next hearing",
  cell: (r) => (r.case.nextHearing === null ? "–" : formatDay(r.case.nextHearing)),
};

const titleOf = (id: ForYouListId) => FOR_YOU_LISTS.find((l) => l.id === id)!.title;

/** Calls `visit` with the list's spec: one place that knows every list's columns. */
function withList<R>(id: ForYouListId, docket: CourtDocket, visit: <T extends Row>(spec: ListSpec<T>) => R): R {
  const base = { id, title: titleOf(id), href: forYouListHref(id) };
  switch (id) {
    case "reserved": {
      const rows = reservedForJudgment(docket);
      const late = rows.filter((r) => r.days > JUDGMENT_DUE_DAYS).length;
      return visit({
        ...base,
        rows,
        fact: late ? `${formatCount(late)} over ${JUDGMENT_DUE_DAYS} days` : `none over ${JUDGMENT_DUE_DAYS} days`,
        stat: { value: late, label: `over ${JUDGMENT_DUE_DAYS} days`, warn: late > 0 },
        empty: "none",
        preview: { header: "Waiting", cell: (r) => waiting(r.days) },
        full: [
          { header: "Reserved on", cell: (r) => formatDay(r.since) },
          { header: "Waiting", numeric: true, cell: (r) => waiting(r.days) },
          nextHearing,
        ],
        opens: "the case file, to write the judgment",
      });
    }
    case "undated": {
      const rows = undatedCases(docket);
      return visit({
        ...base,
        rows,
        fact: rows.length ? `longest ${dayCount(rows[0].days)} since a hearing` : "",
        stat: rows.length ? { value: rows[0].days, days: true, label: "longest since a hearing", warn: true } : null,
        empty: "none",
        preview: { header: "Since last hearing", cell: (r) => dayCount(r.days) },
        full: [
          stageCell(),
          { header: "Last hearing", cell: (r) => (r.case.previousPosting === null ? "–" : formatDay(r.case.previousPosting)) },
          { header: "Since", numeric: true, cell: (r) => dayCount(r.days) },
        ],
        opens: "the scheduling flow for this case",
      });
    }
    case "far": {
      /* Furthest past the stage's usual gap in days, as the card's columns read (owner,
         2026-11-15); the rule that puts a case here is unchanged. */
      const rows = farOffCases(docket).sort((a, b) => b.gap - b.usual - (a.gap - a.usual));
      return visit({
        ...base,
        rows,
        fact: rows.length ? `up to ${dayCount(rows[0].gap - rows[0].usual)} past the usual gap` : "",
        stat: rows.length ? { value: rows[0].gap - rows[0].usual, days: true, label: "most past the usual gap", warn: true } : null,
        rule: "Listed more than twice the usual gap for the case's stage",
        empty: "none",
        /* The gap, the stage's usual under it: with no column headers, two bare day
           counts side by side would not say which is which. */
        preview: {
          header: "Gap",
          cell: (r) => (
            <>
              {dayCount(r.gap)}
              <span className="block text-caption text-muted-foreground">usual {dayCount(r.usual)}</span>
            </>
          ),
        },
        full: [
          stageCell(),
          { header: "Last hearing", cell: (r) => formatDay(r.case.previousPosting!) },
          { header: "Next hearing", cell: (r) => formatDay(r.case.nextHearing!) },
          { header: "Gap", numeric: true, cell: (r) => dayCount(r.gap) },
          { header: "Usual for the stage", numeric: true, cell: (r) => dayCount(r.usual) },
        ],
        opens: "the case file",
      });
    }
    case "silent": {
      const rows = silentCases(docket);
      return visit({
        ...base,
        rows,
        fact: rows.length ? `longest ${dayCount(rows[0].days)} without activity` : "",
        stat: rows.length ? { value: rows[0].days, days: true, label: "longest without activity", warn: true } : null,
        rule: `No hearing, filing, process step or deposition for ${COURT_LIMITS.silentDays} days · not on the long pending register`,
        empty: `none in the last ${COURT_LIMITS.silentDays} days`,
        preview: { header: "Silent for", cell: (r) => dayCount(r.days) },
        full: [
          stageCell(),
          { header: "Last activity", cell: (r) => `${r.what} · ${formatDay(r.last)}` },
          { header: "Silent for", numeric: true, cell: (r) => dayCount(r.days) },
          nextHearing,
        ],
        opens: "the case file",
      });
    }
  }
}

const capitalise = (text: string) => `${text.charAt(0).toUpperCase()}${text.slice(1)}`;

/** "32 cases": the count, then its noun. */
const caseWord = (n: number) => (n === 1 ? "case" : "cases");

/* ------------------------------------------------------------- the card */

const PREVIEW_ROWS = 3;

/**
 * The advocate case file's paper stack (`public/illustrations/case-document-stack.png`),
 * redrawn as vector in the theme's own colours: the bitmap, scaled down with its baked
 * shadow, drew soft rough edges (owner, 2026-11-15). Two sheets fanned behind a front
 * sheet with a thumbnail, a heading and three paragraphs of lines. Decorative.
 */
function PaperStack() {
  const sheet = { fill: "var(--color-card)", stroke: "var(--color-hairline)", strokeWidth: 1 } as const;
  const ink = "var(--color-track)";
  const lines: [number, number][] = [
    [46, 52], [53, 44], [60, 36],
    [69, 52], [76, 44], [83, 36],
  ];
  return (
    <svg viewBox="0 0 96 112" aria-hidden className="h-32 w-28">
      <rect x="16" y="14" width="64" height="84" rx="5" transform="rotate(9 48 56)" {...sheet} />
      <rect x="16" y="14" width="64" height="84" rx="5" transform="rotate(-6 48 56)" {...sheet} />
      <rect x="16" y="12" width="64" height="86" rx="5" {...sheet} />
      <rect x="23" y="20" width="11" height="11" rx="2" fill={ink} />
      <rect x="38" y="21" width="35" height="3" rx="1.5" fill={ink} />
      <rect x="38" y="27" width="22" height="3" rx="1.5" fill={ink} />
      <rect x="23" y="37" width="50" height="3" rx="1.5" fill={ink} />
      {lines.map(([y, w]) => (
        <rect key={y} x="23" y={y} width={w} height="3" rx="1.5" fill={ink} />
      ))}
    </svg>
  );
}

/**
 * One list on the tab: title, the count as the headline with one fact, the three most
 * urgent cases (a still preview), then the way to all of them.
 *
 * With no cases the card keeps its row's height and says so under the paper-stack
 * illustration from the advocate's case file (owner, 2026-11-15), centred in the card.
 */
export function ForYouListCard({ id, docket }: { id: ForYouListId; docket: CourtDocket }) {
  return withList(id, docket, (spec) => {
    const headingId = `you-${spec.id}`;
    const n = spec.rows.length;
    if (!n) {
      return (
        <section aria-labelledby={headingId} className={CARD}>
          <h2 id={headingId} className="text-body font-semibold">
            {spec.title}
          </h2>
          {/* The beige well fills the card under its title, as the Judgments cards sit in
              theirs (owner, 2026-11-15). */}
          <Empty className="rounded-xl border-0 bg-surface-sunken p-6">
            <EmptyHeader>
              <EmptyMedia>
                <PaperStack />
              </EmptyMedia>
              <EmptyDescription className="text-body-compact">{capitalise(spec.empty)}</EmptyDescription>
            </EmptyHeader>
          </Empty>
        </section>
      );
    }
    return (
      <section aria-labelledby={headingId} className={CARD}>
        {/* The title with the worst case on one line under it, and the count on the right
            as a small tile, drawn as the page's date tile is, "cases" under it as the
            weekday sits under the day (owner, 2026-11-16). Amber only on a figure past a
            limit. */}
        <div className="flex min-w-0 items-start justify-between gap-4">
          <div className="flex min-w-0 flex-col gap-1">
            <h2 id={headingId} className="text-body font-semibold">
              {spec.title}
            </h2>
            {spec.stat ? (
              <p className="text-body-compact text-muted-foreground tabular-nums">
                <span className={cn("font-semibold text-foreground", spec.stat.warn && "text-warning-ink")}>
                  {spec.stat.days ? dayCount(spec.stat.value) : formatCount(spec.stat.value)}
                </span>{" "}
                {spec.stat.label}
              </p>
            ) : null}
          </div>
          <p className="flex shrink-0 flex-col items-center">
            <span className="flex h-14 min-w-14 items-center justify-center rounded-xl border border-hairline bg-card px-3 text-title-l font-semibold text-brand-muted-foreground tabular-nums">
              {formatCount(n)}
            </span>
            <span className="mt-1 text-caption text-muted-foreground"> {caseWord(n)}</span>
          </p>
        </div>
        <PreviewList
          label={`${spec.title}, the first ${Math.min(n, PREVIEW_ROWS)} of ${formatCount(n)}`}
          rows={spec.rows.slice(0, PREVIEW_ROWS)}
          figure={spec.preview}
        />
        <div className="mt-auto flex min-w-0 flex-wrap items-center gap-3 border-t border-hairline pt-4">
          <Button asChild variant="ghost" className="ml-auto">
            <Link href={spec.href}>
              View all
              <span className="sr-only"> {formatCount(n)} {spec.title.toLowerCase()}</span>
              <ArrowRightIcon aria-hidden data-icon="inline-end" />
            </Link>
          </Button>
        </div>
      </section>
    );
  });
}

/* ------------------------------------------------------------- the page */

/** A list in full, on its own page: the count under the title, then every case. */
export function ForYouListScreen({ id }: { id: ForYouListId }) {
  const docket = useCourtDocket();
  const [opening, setOpening] = React.useState<{ item: string; opens: string } | null>(null);
  return withList(id, docket, (spec) => {
    const n = spec.rows.length;
    return (
      <div className="flex min-w-0 flex-1 flex-col gap-8 p-6 md:p-8">
        <header className="flex flex-col gap-2">
          <h1 className="text-title text-balance font-semibold">{spec.title}</h1>
          <p className="text-body text-muted-foreground tabular-nums">
            {n ? `${formatCount(n)} ${caseWord(n)} · ${spec.fact}` : capitalise(spec.empty)}
          </p>
          {spec.rule ? <p className="text-body-compact text-muted-foreground">{spec.rule}</p> : null}
        </header>
        {n ? (
          <section aria-label={spec.title} className={PANEL}>
            <CaseTable
              id={`for-you-${spec.id}`}
              caption={spec.title}
              rows={spec.rows}
              columns={spec.full}
              onOpen={(c) => setOpening({ item: c.title, opens: spec.opens })}
            />
          </section>
        ) : null}
        <NotBuiltDialog
          item={opening?.item ?? null}
          opens={opening?.opens ?? "the case file"}
          open={opening !== null}
          onOpenChange={(next) => {
            if (!next) setOpening(null);
          }}
        />
      </div>
    );
  });
}
