"use client";

import * as React from "react";

import { CountButton } from "@/components/employee/court-dashboard-attention";
import { TABLE_CELL, TABLE_HEAD, TABLE_HEAD_ROW, tableBodyClass, tableRowClass } from "@/components/chrome/table-plate";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { STAGES, UNCONTESTED, type CourtDocket, type DisposalMethod, type StageKey } from "@/lib/employee/court-docket";
import { closedCases, outcomesIn, type PeriodReading } from "@/lib/employee/court-flow";
import { formatCount } from "@/lib/employee/register-rows";
import { cn } from "@/lib/utils";

/**
 * Dashboard parts the Court view and a seat's own view both draw, so the two never drift:
 * the Overview card, the stage cells, and the table of how cases ended.
 */

export type Opener = { expanded: boolean; controls: string; onOpen: (from: HTMLElement) => void };

const pct = (v: number) => `${Math.round(v * 100)}%`;

/** One Overview card: label, count, change, and one fact line — the same parts on all three. */
export function OverviewCard({
  label,
  count,
  change,
  fact,
}: {
  label: string;
  count: React.ReactNode;
  change: React.ReactNode;
  fact?: React.ReactNode;
}) {
  return (
    <div className="flex min-w-0 flex-col items-start gap-1 rounded-xl bg-surface-sunken p-4 sm:px-6">
      <p className="text-body-compact font-medium">{label}</p>
      {count}
      {change}
      {fact ? (
        <p className="mt-2 w-full border-t border-hairline pt-2 text-caption text-muted-foreground tabular-nums">{fact}</p>
      ) : null}
    </div>
  );
}

/* --------------------------------------------------------------- stages */

/** The two groups of the stage card, either side of cognizance. */
export const STAGE_GROUPS: { label: string; keys: StageKey[] }[] = [
  { label: "Before cognizance", keys: ["registration", "cognizance"] },
  { label: "After cognizance", keys: ["appearance", "bail", "trial", "judgement"] },
];

/**
 * One count in the age and stage cards: label, number that opens its cases, share of
 * pending. Rules between columns: every second one on phones, all but the first from md.
 */
export function PendingCount({
  label,
  count,
  total,
  name,
  opener,
  index,
  className,
}: {
  label: string;
  count: number;
  total: number;
  name: string;
  opener: Opener;
  index: number;
  className?: string;
}) {
  return (
    <li
      className={cn(
        "flex min-w-0 flex-col items-start gap-1 px-4",
        index % 2 === 1 ? "border-l border-hairline" : "max-md:pl-0",
        index === 0 && "pl-0",
        index === 2 && "md:border-l md:border-hairline",
        className,
      )}
    >
      <span className="text-body-compact font-medium">{label}</span>
      {count ? (
        <CountButton name={name} className="text-title-s font-semibold" {...opener}>
          {formatCount(count)}
        </CountButton>
      ) : (
        <span className="inline-flex min-h-10 items-center text-title-s font-semibold text-muted-foreground">0</span>
      )}
      <span className="text-caption text-muted-foreground">
        {count ? `${pct(count / Math.max(1, total))} of pending` : "None"}
      </span>
    </li>
  );
}

/**
 * The stage cells, grouped either side of cognizance: one row from xl, the groups stacked
 * below that. Cases at registration are not on the CMP register yet, so the groups are
 * named by cognizance, not by register. Every count opens its cases.
 */
export function StageCells({
  counts,
  total,
  opener,
  idPrefix,
}: {
  counts: Record<StageKey, number>;
  total: number;
  opener: (key: `stage-${StageKey}`) => Opener;
  /** Keeps the group labels' ids unique where two views could share a page. */
  idPrefix: string;
}) {
  return (
    <div aria-label="By stage" role="group" className="flex min-w-0 flex-col gap-6 xl:grid xl:grid-cols-6 xl:gap-0">
      {STAGE_GROUPS.map((group, g) => {
        const stages = STAGES.filter((stage) => group.keys.includes(stage.key));
        const count = stages.reduce((sum, stage) => sum + counts[stage.key], 0);
        const id = `${idPrefix}-${group.keys[0]}`;
        return (
          <div
            key={id}
            className={cn(
              "flex min-w-0 flex-col gap-3",
              g === 0 ? "xl:col-span-2 xl:pr-4" : "xl:col-span-4 xl:border-l xl:border-hairline xl:pl-4",
            )}
          >
            <p id={id} className="border-b border-hairline pb-1.5 text-caption text-muted-foreground tabular-nums">
              {group.label} · {formatCount(count)}
            </p>
            <ul aria-labelledby={id} className={cn("grid grid-cols-2 gap-y-4 tabular-nums md:grid-cols-4", g === 0 && "xl:grid-cols-2")}>
              {stages.map((stage, i) => (
                <PendingCount
                  key={stage.key}
                  label={stage.label}
                  count={counts[stage.key]}
                  total={total}
                  name={`pending at ${stage.label.toLowerCase()}`}
                  opener={opener(`stage-${stage.key}`)}
                  index={i}
                />
              ))}
            </ul>
          </div>
        );
      })}
    </div>
  );
}

/* --------------------------------------------------------- how cases ended */

export type EndedKey = "contested" | "uncontested" | `method-${DisposalMethod}` | "toLongPending";

const METHODS: DisposalMethod[] = ["Convicted", "Acquitted", "Settled", "Withdrawn", "Dismissed", "Returned"];

/* Four columns fit a phone only with narrower cell padding, and headings allowed to wrap,
   there. */
const TIGHT = "max-sm:px-2 max-sm:whitespace-normal";

/**
 * How cases ended in a period: one table, the two groups as subtotal rows with their methods
 * under them, then all disposed, then moves to the long pending register, which are not
 * disposals and stay out of the shares. A column for the baseline gives every row its
 * comparison. Contested means a judgment, as UNCONTESTED defines it for the statement of
 * pendency.
 */
export function EndedTable({
  docket,
  reading,
  baseline,
  opener,
  labelledBy,
}: {
  docket: CourtDocket;
  reading: PeriodReading;
  /** The baseline's name for the last column ("1–15 Oct"); `null` hides the column. */
  baseline: string | null;
  opener: (key: EndedKey) => Opener;
  labelledBy: string;
}) {
  const isContested = (method: DisposalMethod) => !UNCONTESTED.has(method);
  const disposedRows = closedCases(docket, reading.selection).filter((r) => r.outcome !== "toLongPending");
  const baseDisposed = reading.baseline.flatMap((p) => closedCases(docket, p).filter((r) => r.outcome !== "toLongPending"));
  const toLongPending = outcomesIn(docket, reading.selection).toLongPending;
  const baseToLongPending = reading.baseline.length
    ? Math.round(
        reading.baseline.reduce((sum, p) => sum + closedCases(docket, p).filter((r) => r.outcome === "toLongPending").length, 0) /
          reading.baseline.length,
      )
    : null;
  const shareOf = (part: number, whole: number) => (whole ? Math.round((part / whole) * 100) : null);
  const methodCount = (key: DisposalMethod) => disposedRows.filter((r) => r.method === key).length;
  const showBase = reading.compare !== "none" && baseline !== null && reading.baseline.length > 0;
  const baseCount = (key: "contested" | "uncontested" | "all" | DisposalMethod) => {
    const rows =
      key === "all"
        ? baseDisposed
        : key === "contested"
          ? baseDisposed.filter((r) => isContested(r.method as DisposalMethod))
          : key === "uncontested"
            ? baseDisposed.filter((r) => !isContested(r.method as DisposalMethod))
            : baseDisposed.filter((r) => r.method === key);
    return Math.round(rows.length / Math.max(1, reading.baseline.length));
  };
  const shown = METHODS.map((key) => ({ key, n: methodCount(key) }));
  /* Contested in a fixed order; uncontested largest first. */
  const groups = [
    {
      key: "contested" as const,
      label: "Contested",
      rows: disposedRows.filter((r) => isContested(r.method as DisposalMethod)),
      methods: shown.filter((m) => isContested(m.key)),
    },
    {
      key: "uncontested" as const,
      label: "Uncontested",
      rows: disposedRows.filter((r) => !isContested(r.method as DisposalMethod)),
      methods: shown.filter((m) => !isContested(m.key)).sort((a, b) => b.n - a.n),
    },
  ];

  if (!disposedRows.length) {
    return <p className="text-body-compact text-muted-foreground">No cases disposed in this period</p>;
  }
  const last = (cls: string, isLast: boolean) => cn(cls, isLast && "border-b-0");
  return (
    <div className="min-w-0">
      <Table aria-labelledby={labelledBy} className="tabular-nums">
        <TableHeader>
          <TableRow className={TABLE_HEAD_ROW}>
            <TableHead scope="col" className={cn(TABLE_HEAD, TIGHT)}>Outcome</TableHead>
            <TableHead scope="col" className={cn(TABLE_HEAD, TIGHT, "text-right")}>Cases</TableHead>
            <TableHead scope="col" className={cn(TABLE_HEAD, TIGHT, "text-right")}>Share</TableHead>
            {showBase ? (
              <TableHead scope="col" className={cn(TABLE_HEAD, TIGHT, "text-right")}>
                {/* Breaks only at a space on phones: "1–14" over "Oct". */}
                {baseline?.split(" ").map((word, k) => (
                  <React.Fragment key={k}>
                    {k ? " " : null}
                    <span className="whitespace-nowrap">{word}</span>
                  </React.Fragment>
                ))}
              </TableHead>
            ) : null}
          </TableRow>
        </TableHeader>
        <TableBody className={tableBodyClass({ hover: false })}>
          {groups.map((g) => (
            <React.Fragment key={g.key}>
              <TableRow className={tableRowClass({ hover: false })}>
                <th scope="row" className={cn(TABLE_CELL, TIGHT, "font-semibold")}>{g.label}</th>
                <TableCell className={cn(TABLE_CELL, TIGHT, "text-right font-semibold")}>
                  {g.rows.length ? (
                    <CountButton name={g.key} {...opener(g.key)}>
                      {formatCount(g.rows.length)}
                    </CountButton>
                  ) : (
                    <span className="text-muted-foreground">0</span>
                  )}
                </TableCell>
                <TableCell className={cn(TABLE_CELL, TIGHT, "text-right font-semibold")}>{shareOf(g.rows.length, disposedRows.length)}%</TableCell>
                {showBase ? <TableCell className={cn(TABLE_CELL, TIGHT, "text-right text-muted-foreground")}>{formatCount(baseCount(g.key))}</TableCell> : null}
              </TableRow>
              {g.methods.map((m) => (
                <TableRow key={m.key} className={tableRowClass({ hover: false })}>
                  <th scope="row" className={cn(TABLE_CELL, TIGHT, "pl-8 font-normal")}>{m.key}</th>
                  <TableCell className={cn(TABLE_CELL, TIGHT, "text-right")}>
                    {m.n ? (
                      <CountButton name={m.key.toLowerCase()} {...opener(`method-${m.key}`)}>
                        {formatCount(m.n)}
                      </CountButton>
                    ) : (
                      <span className="text-muted-foreground">0</span>
                    )}
                  </TableCell>
                  <TableCell className={cn(TABLE_CELL, TIGHT, "text-right", !m.n && "text-muted-foreground")}>
                    {m.n ? `${shareOf(m.n, disposedRows.length)}%` : "–"}
                  </TableCell>
                  {showBase ? <TableCell className={cn(TABLE_CELL, TIGHT, "text-right text-muted-foreground")}>{formatCount(baseCount(m.key))}</TableCell> : null}
                </TableRow>
              ))}
            </React.Fragment>
          ))}
          <TableRow className={tableRowClass({ hover: false })}>
            <th scope="row" className={last(cn(TABLE_CELL, TIGHT, "font-semibold"), !toLongPending)}>All disposed</th>
            <TableCell className={last(cn(TABLE_CELL, TIGHT, "text-right font-semibold"), !toLongPending)}>{formatCount(disposedRows.length)}</TableCell>
            <TableCell className={last(cn(TABLE_CELL, TIGHT, "text-right font-semibold"), !toLongPending)}>100%</TableCell>
            {showBase ? <TableCell className={last(cn(TABLE_CELL, TIGHT, "text-right font-semibold"), !toLongPending)}>{formatCount(baseCount("all"))}</TableCell> : null}
          </TableRow>
          {toLongPending ? (
            <TableRow className={tableRowClass({ hover: false })}>
              <th scope="row" className={cn(TABLE_CELL, TIGHT, "border-b-0 font-normal")}>
                <span className="flex flex-col">
                  Moved to the long pending register
                  <span className="text-caption text-muted-foreground">Not a disposal</span>
                </span>
              </th>
              <TableCell className={cn(TABLE_CELL, TIGHT, "border-b-0 text-right")}>
                <CountButton name="moved to long pending" {...opener("toLongPending")}>
                  {formatCount(toLongPending)}
                </CountButton>
              </TableCell>
              <TableCell className={cn(TABLE_CELL, TIGHT, "border-b-0 text-right text-muted-foreground")}>–</TableCell>
              {showBase ? (
                <TableCell className={cn(TABLE_CELL, TIGHT, "border-b-0 text-right text-muted-foreground")}>{formatCount(baseToLongPending ?? 0)}</TableCell>
              ) : null}
            </TableRow>
          ) : null}
        </TableBody>
      </Table>
    </div>
  );
}
