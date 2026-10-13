"use client";

import * as React from "react";
import { useSearchParams } from "next/navigation";
import { DownloadIcon, FileSearchIcon } from "lucide-react";

import {
  TABLE_CELL,
  TABLE_HEAD,
  TABLE_HEAD_ROW,
  tableBodyClass,
  tableRowClass,
} from "@/components/chrome/table-plate";
import { DocketTable, useCourtDocket } from "@/components/employee/docket-table";
import { ListFooter } from "@/components/employee/list-footer";
import { QueueAnnouncer } from "@/components/employee/queue-announcer";
import { QueueSearchField } from "@/components/employee/queue-search-field";
import { useCourtToday } from "@/components/employee/use-court-today";
import { AppliedChip } from "@/components/shell/applied-chip";
import { PANEL_CLASS } from "@/components/shell/panel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Label } from "@/components/ui/label";
import {
  SegmentedControl,
  SegmentedControlItem,
} from "@/components/ui/segmented-control";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { localizeForDownload } from "@/lib/court/browser";
import { PAGE_SIZE, type HearingsPageSize } from "@/lib/employee/hearings";
import {
  formatCount,
  REGISTER_PERIODS,
  registerCsv,
  registerView,
  type RegisterPeriod,
  type RegisterResult,
} from "@/lib/employee/register-rows";
import { registerById, type RegisterMeta } from "@/lib/employee/registers";
import { cn } from "@/lib/utils";

const PANEL = cn("flex min-w-0 flex-col gap-6 rounded-xl border bg-card p-6", PANEL_CLASS);

/**
 * `/employee/registers/<id>` — one register of the owner's note, section B.
 *
 * Registers 1–10 are read from the generated court: a sub-view where the register has
 * one, search, a period, a CSV of every row in view, and a "Sl. no." column, paged by
 * the shared `ListFooter` (statements and fees are read whole). Registers 11–18 show the note's columns and an honest empty state:
 * where DRISTI would get their data has not been confirmed, so they have no rows.
 *
 * A dashboard tile arrives with `?view=` — a sub-view (`st`, `cmp`, `monthly`…) or, on
 * the calendar, `lpr` for the long-pending cases. Like every court screen, the address
 * only seeds the controls; after that they are the reader's.
 */
export function RegisterScreen({ registerId }: { registerId: string }) {
  const register = registerById(registerId);
  /* The route answers not-found for an unknown id before this renders. */
  if (!register) return null;
  return <Register register={register} />;
}

function Register({ register }: { register: RegisterMeta }) {
  const docket = useCourtDocket();
  const today = useCourtToday();
  const searchParams = useSearchParams();
  const asked = searchParams.get("view");

  const [view, setView] = React.useState<string | undefined>(() =>
    register.views?.some((v) => v.id === asked) ? (asked ?? undefined) : undefined,
  );
  const [longPendingOnly, setLongPendingOnly] = React.useState(
    () => register.id === "calendar" && asked === "lpr",
  );
  const [query, setQuery] = React.useState("");
  const [period, setPeriod] = React.useState<RegisterPeriod>("all");
  const [page, setPage] = React.useState(1);
  const [chosenPageSize, setChosenPageSize] = React.useState<HearingsPageSize>(PAGE_SIZE);
  const [year, setYear] = React.useState<number | undefined>(undefined);
  const searchRef = React.useRef<HTMLInputElement>(null);

  const result = registerView(docket, register.id, { view, query, period, longPendingOnly, year })!;
  const isFiltered = query.trim() !== "" || period !== "all";

  /* A statement is read whole at inspection, so the period summaries never split. */
  const summary = register.id === "statements" || register.id === "fees";
  const pageSize = summary ? Math.max(1, result.rows.length) : chosenPageSize;
  const pageCount = Math.max(1, Math.ceil(result.rows.length / pageSize));
  /* Clamped rather than reset in an effect, as the other court lists do. */
  const currentPage = Math.min(page, pageCount);
  const start = (currentPage - 1) * pageSize;
  const pageRows = result.rows.slice(start, start + pageSize);

  /* The court side's one list footer, as All cases composes it. A summary register is
     read whole, so it has no page size to choose and no pages to turn. */
  const footer = summary ? null : (
    <ListFooter
      id="register-page-size"
      from={start + 1}
      to={start + pageRows.length}
      total={result.rows.length}
      page={currentPage}
      pageCount={pageCount}
      onPageChange={setPage}
      pageSize={chosenPageSize}
      onPageSizeChange={(size) => {
        setChosenPageSize(size);
        setPage(1);
      }}
    />
  );

  function clearFilters() {
    setQuery("");
    setPeriod("all");
    setPage(1);
    searchRef.current?.focus();
  }

  function download() {
    const csv = localizeForDownload(registerCsv(result));
    const blob = new Blob([`﻿${csv}`], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = [
      `register-${register.no}-${register.id}`,
      result.view,
      register.id === "pending" && result.year ? String(result.year) : null,
      today,
    ]
      .filter(Boolean)
      .join("-")
      .concat(".csv");
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
  }

  return (
    <div className="flex min-w-0 flex-1 flex-col gap-8 p-6 md:p-8">
      <header className="flex flex-col gap-2">
        <h1 className="text-title text-balance font-semibold">
          {register.no}. {register.name}
        </h1>
        <p className="text-body text-muted-foreground tabular-nums">{countLine(result, isFiltered)}</p>
        <p className="max-w-3xl text-body-compact text-muted-foreground">{register.description}</p>
      </header>

      {register.sourceToConfirm ? (
        <SourceToConfirm result={result} />
      ) : (
        <section aria-label={register.name} className={PANEL}>
          <div className="flex min-w-0 flex-col gap-4">
            {/* One row of controls, wrapping as the width runs out; the sub-view leads
                because it decides what the rest of the row filters. */}
            <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
              {register.views ? (
                <div className="-m-1 max-w-full overflow-x-auto p-1">
                  <SegmentedControl
                    type="single"
                    aria-label="View"
                    value={result.view ?? undefined}
                    onValueChange={(next) => {
                      if (!next) return;
                      setView(next);
                      setYear(undefined);
                      setPage(1);
                    }}
                  >
                    {register.views.map((option) => (
                      <SegmentedControlItem key={option.id} value={option.id}>
                        {option.label}
                      </SegmentedControlItem>
                    ))}
                  </SegmentedControl>
                </div>
              ) : null}
              {result.search ? (
                <QueueSearchField
                  ref={searchRef}
                  label="Search this register"
                  labelClassName="sr-only"
                  className="sm:w-80"
                  placeholder="Case, number or name"
                  value={query}
                  onChange={(next) => {
                    setQuery(next);
                    setPage(1);
                  }}
                />
              ) : null}
              {result.period ? (
                <div className="flex min-w-0 flex-col gap-2">
                  <Label htmlFor="register-period" className="sr-only">
                    Period
                  </Label>
                  <Select
                    value={period}
                    onValueChange={(next) => {
                      setPeriod(next as RegisterPeriod);
                      setPage(1);
                    }}
                  >
                    <SelectTrigger id="register-period" className="w-full sm:w-52">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {REGISTER_PERIODS.map((option) => (
                        <SelectItem key={option.id} value={option.id}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ) : null}
              {isFiltered ? (
                <Button type="button" variant="ghost" onClick={clearFilters}>
                  Clear filters
                </Button>
              ) : null}
              <Button
                type="button"
                variant="outline"
                className="sm:ml-auto"
                disabled={result.rows.length === 0}
                onClick={download}
              >
                <DownloadIcon aria-hidden data-icon="inline-start" />
                Download CSV
              </Button>
            </div>
            {longPendingOnly ? (
              <div className="flex flex-wrap items-center gap-2">
                <AppliedChip
                  label="Long pending only"
                  onClear={() => {
                    setLongPendingOnly(false);
                    setPage(1);
                  }}
                />
              </div>
            ) : null}
            {register.id === "fees" ? (
              /* Kept as written whichever state is selected: these are Kerala's amounts. */
              <p data-court-raw className="text-body-compact text-muted-foreground">
                Amounts from Kerala&rsquo;s fee schedule. The application fee is a demo rate; no
                source gives one.
              </p>
            ) : null}
          </div>

          <QueueAnnouncer
            from={start + 1}
            to={start + pageRows.length}
            total={result.rows.length}
          />

          {register.id === "pending" ? (
            <PendingByYear
              result={result}
              onYear={(next) => {
                setYear(next);
                setPage(1);
              }}
            >
              <RegisterRows
                caption={`${result.view === "cmp" ? "CMP" : "ST"} cases pending from ${result.year ?? ""}`}
                result={result}
                rows={pageRows}
                start={start}
                footer={footer}
                onClear={clearFilters}
              />
            </PendingByYear>
          ) : (
            <RegisterRows
              caption={register.name}
              result={result}
              rows={pageRows}
              start={start}
              footer={footer}
              onClear={clearFilters}
            />
          )}
        </section>
      )}
    </div>
  );
}

function plural(count: number, unit: [string, string]) {
  return `${formatCount(count)} ${count === 1 ? unit[0] : unit[1]}`;
}

/** The muted line under the heading: what the register holds, and what is in view. */
function countLine(result: RegisterResult, isFiltered: boolean): string {
  if (result.register.sourceToConfirm) return "Columns as listed in the note";
  if (result.entries !== undefined) {
    return isFiltered
      ? `${formatCount(result.entries)} of ${plural(result.total, result.unit)} match`
      : plural(result.total, result.unit);
  }
  if (result.register.id === "pending") return `${plural(result.total, result.unit)} pending`;
  return isFiltered
    ? `${formatCount(result.rows.length)} of ${plural(result.total, result.unit)} match`
    : plural(result.total, result.unit);
}

function RegisterRows({
  caption,
  result,
  rows,
  start,
  footer,
  onClear,
}: {
  caption: string;
  result: RegisterResult;
  rows: unknown[];
  start: number;
  /** The shared `ListFooter`, or nothing for a summary read whole. */
  footer: React.ReactNode;
  onClear: () => void;
}) {
  if (rows.length === 0) {
    return (
      <Empty className="px-0 py-6">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <FileSearchIcon aria-hidden />
          </EmptyMedia>
          <EmptyTitle className="text-body font-semibold">No entries match</EmptyTitle>
          <EmptyDescription className="text-body-compact">
            Clear the search or widen the period.
          </EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Button type="button" variant="outline" onClick={onClear}>
            Clear filters
          </Button>
        </EmptyContent>
      </Empty>
    );
  }

  /* The month-wise and statement views are summaries, numbered by their own periods. */
  const serial = !(result.view === "month" || result.register.id === "statements" || result.register.id === "fees");

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <div className="min-w-0 overflow-x-auto">
        <DocketTable
          caption={caption}
          columns={result.columns}
          rows={rows}
          firstIndex={start}
          serial={serial}
        />
      </div>
      {footer}
    </div>
  );
}

/**
 * Register 6: pending cases counted by the year they were numbered — ST by cognizance,
 * CMP by registration. Choosing a year lists that year's cases beside it.
 */
function PendingByYear({
  result,
  onYear,
  children,
}: {
  result: RegisterResult;
  onYear: (year: number) => void;
  children: React.ReactNode;
}) {
  const years = result.years ?? [];
  const kind = result.view === "cmp" ? "CMP" : "ST";
  const chosen = years.find((y) => y.year === result.year);
  return (
    <div className="grid min-w-0 gap-6 lg:grid-cols-3 lg:items-start">
      <div className="min-w-0">
        <Table className="w-full border-separate border-spacing-0 text-body-compact">
          <caption className="sr-only">{kind} cases pending, by the year they were numbered</caption>
          <TableHeader>
            <TableRow className={TABLE_HEAD_ROW}>
              <TableHead className={cn(TABLE_HEAD, "whitespace-nowrap")}>Year</TableHead>
              <TableHead className={cn(TABLE_HEAD, "text-right whitespace-nowrap")}>Pending</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody className={tableBodyClass({ selectable: true })}>
            <tr aria-hidden="true">
              <td colSpan={2} className="h-2 p-0" />
            </tr>
            {years.map((entry) => {
              const selected = entry.year === result.year;
              return (
                <TableRow
                  key={entry.year}
                  data-state={selected ? "selected" : undefined}
                  className={cn("group/row cursor-pointer", tableRowClass({ selectable: true }))}
                  onClick={(event) => {
                    if ((event.target as HTMLElement).closest("button")) return;
                    onYear(entry.year);
                  }}
                >
                  <TableCell className={cn(TABLE_CELL, "whitespace-nowrap")}>
                    <button
                      type="button"
                      aria-pressed={selected}
                      onClick={() => onYear(entry.year)}
                      className="min-h-10 w-full cursor-pointer rounded-sm text-left font-medium tabular-nums underline-offset-4 outline-none group-hover/row:underline focus-visible:ring-3 focus-visible:ring-focus-ring"
                    >
                      <span className="sr-only">Show {kind} cases pending from </span>
                      {entry.year}
                    </button>
                  </TableCell>
                  <TableCell className={cn(TABLE_CELL, "text-right tabular-nums")}>{formatCount(entry.count)}</TableCell>
                </TableRow>
              );
            })}
            <TableRow className={tableRowClass({ hover: false })}>
              <TableCell className={cn(TABLE_CELL, "font-semibold")}>Total</TableCell>
              <TableCell className={cn(TABLE_CELL, "text-right font-semibold tabular-nums")}>
                {formatCount(result.total)}
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </div>
      <section aria-labelledby="pending-year" className="flex min-w-0 flex-col gap-4 lg:col-span-2">
        <h2 id="pending-year" className="text-body font-semibold">
          {kind} cases pending from {result.year}
          {chosen ? (
            <span className="font-normal text-muted-foreground tabular-nums"> · {formatCount(chosen.count)}</span>
          ) : null}
        </h2>
        {children}
      </section>
    </div>
  );
}

/** Registers 11–18: the note's columns, no rows, and why. */
function SourceToConfirm({ result }: { result: RegisterResult }) {
  return (
    <section aria-label={result.register.name} className={PANEL}>
      <div className="min-w-0">
        <DocketTable caption={`${result.register.name}, columns`} columns={result.columns} rows={[]} />
      </div>
      <Empty className="px-0 py-6">
        <EmptyHeader>
          <Badge variant="outline">Source to confirm</Badge>
          <EmptyTitle className="text-body font-semibold">No entries to show</EmptyTitle>
          <EmptyDescription className="text-body-compact">
            These columns are from the note. Where DRISTI would get this register&rsquo;s data
            has not been confirmed, so it holds no entries.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    </section>
  );
}
