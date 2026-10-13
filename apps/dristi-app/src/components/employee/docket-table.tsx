"use client";

import * as React from "react";
import { CircleAlertIcon } from "lucide-react";

import { Identifier } from "@/components/chrome/identifier";
import {
  TABLE_CELL,
  TABLE_HEAD,
  TABLE_HEAD_ROW,
  tableBodyClass,
  tableRowClass,
} from "@/components/chrome/table-plate";
import { ListFooter } from "@/components/employee/list-footer";
import { QueueAnnouncer } from "@/components/employee/queue-announcer";
import { useCourtToday } from "@/components/employee/use-court-today";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { courtDocket, type CourtDocket, type DocketCase } from "@/lib/employee/court-docket";
import { PAGE_SIZE, type HearingsPageSize } from "@/lib/employee/hearings";
import {
  formatCount,
  formatDocketDate,
  formatRupees,
  nextHearingCell,
  stageLabel,
  type CellValue,
  type RegisterColumn,
  type StatusTone,
} from "@/lib/employee/register-rows";
import { cn } from "@/lib/utils";

/**
 * The generated court for the reader's today (`court-docket.ts`).
 *
 * The day comes from `useCourtToday`, so the server renders its own day's court and the
 * browser hydrates with the same one whenever the two agree on the date — the contract
 * every dated court screen already keeps. The court itself is cached per day at module
 * level, so the dashboard and a register opened from it read the very same cases.
 */
export function useCourtDocket(): CourtDocket {
  return courtDocket(useCourtToday());
}

const TONE_VARIANT: Record<StatusTone, "success" | "warning" | "info" | "outline" | "destructive"> = {
  success: "success",
  warning: "warning",
  info: "info",
  neutral: "outline",
  destructive: "destructive",
};

/** A status in its DS fill pair, always with its word — and an alert mark when it warns. */
export function StatusBadge({ text, tone }: { text: string; tone: StatusTone }) {
  return (
    <Badge variant={TONE_VARIANT[tone]}>
      {tone === "warning" ? <CircleAlertIcon aria-hidden data-icon="inline-start" /> : null}
      {text}
    </Badge>
  );
}

/** One register cell, drawn for what it holds. */
export function CellView({ value }: { value: CellValue }) {
  switch (value.kind) {
    case "text":
      return <span className={value.strong ? "font-semibold" : undefined}>{value.text}</span>;
    case "id":
      return <Identifier value={value.text} label={value.label} />;
    case "case":
      return (
        <span className="flex min-w-0 flex-col gap-0.5">
          <Identifier
            value={value.number}
            label="case number"
            className="w-fit text-muted-foreground"
          />
          <span className="font-medium">{value.title}</span>
        </span>
      );
    case "date":
      return <span className="tabular-nums">{formatDocketDate(value.ms)}</span>;
    case "number":
      return (
        <span className={cn("tabular-nums", value.strong && "font-semibold")}>
          {formatCount(value.value)}
        </span>
      );
    case "money":
      return (
        <span className={cn("tabular-nums", value.strong && "font-semibold")}>
          {formatRupees(value.value)}
        </span>
      );
    case "status":
      return <StatusBadge text={value.text} tone={value.tone} />;
    case "empty":
      return (
        <span className="text-muted-foreground">
          <span aria-hidden>—</span>
          <span className="sr-only">None</span>
        </span>
      );
  }
}

/**
 * A register's rows on the shared table plate. Rows do nothing when pressed, so they
 * take no hover band (`hover: false`); a wide register scrolls inside the table's own
 * container rather than widening the page.
 */
export function DocketTable({
  caption,
  columns,
  rows,
  firstIndex = 0,
  serial = true,
}: {
  /** Names the table for a screen reader; not drawn. */
  caption: string;
  columns: RegisterColumn[];
  rows: unknown[];
  /** The serial number of the first row, less one — the page's offset. */
  firstIndex?: number;
  /** Lead with the register's "Sl. no." column. */
  serial?: boolean;
}) {
  const span = columns.length + (serial ? 1 : 0);
  return (
    <Table className="w-full border-separate border-spacing-0 text-body-compact">
      <caption className="sr-only">{caption}</caption>
      <TableHeader>
        <TableRow className={TABLE_HEAD_ROW}>
          {serial ? (
            <TableHead className={cn(TABLE_HEAD, "w-px text-right whitespace-nowrap")}>Sl. no.</TableHead>
          ) : null}
          {columns.map((column) => (
            <TableHead
              key={column.header}
              className={cn(
                TABLE_HEAD,
                /* A figure is narrow and its header is long ("Uncontested disposals"):
                   the header wraps over the column instead of setting its width. */
                column.numeric
                  ? "h-auto min-w-24 text-right whitespace-normal"
                  : column.wrap
                    ? "min-w-56 whitespace-normal"
                    : "whitespace-nowrap",
              )}
            >
              {column.header}
            </TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody className={tableBodyClass({ hover: false })}>
        {/* The header strip is a well; an inert spacer row keeps the panel's fill under
            its rounded corners, as every other court table does. */}
        <tr aria-hidden="true">
          <td colSpan={span} className="h-2 p-0" />
        </tr>
        {rows.map((row, index) => (
          <TableRow key={firstIndex + index} className={tableRowClass({ hover: false })}>
            {serial ? (
              <TableCell className={cn(TABLE_CELL, "text-right text-muted-foreground tabular-nums whitespace-nowrap")}>
                {formatCount(firstIndex + index + 1)}
              </TableCell>
            ) : null}
            {columns.map((column) => (
              <TableCell
                key={column.header}
                className={cn(
                  TABLE_CELL,
                  column.numeric ? "text-right" : undefined,
                  column.wrap ? "min-w-56 whitespace-normal" : "whitespace-nowrap",
                )}
              >
                <CellView value={column.cell(row)} />
              </TableCell>
            ))}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

/** A case and the one number this list is about. */
export type CaseListRow = { case: DocketCase; days: number };

/**
 * The dashboard's case lists — under an overdue stage, a process check, and the undated
 * cases: case, stage, the list's own days column, and the next hearing. Composed the way
 * All cases is (`court-cases-screen.tsx`): the announcer, the table in its own scroll
 * container, then the shared `ListFooter` with its page size and pager. Rows are not
 * links — there is no court case-detail page to open yet.
 */
export function DocketCaseList({
  id,
  caption,
  rows,
  daysHeader,
}: {
  /** Unique on the page: the footer's page-size control is labelled by it. */
  id: string;
  caption: string;
  rows: CaseListRow[];
  daysHeader: string;
}) {
  const [pageSize, setPageSize] = React.useState<HearingsPageSize>(PAGE_SIZE);
  const [page, setPage] = React.useState(1);
  const pageCount = Math.max(1, Math.ceil(rows.length / pageSize));
  /* Clamped rather than reset in an effect, as All cases does. */
  const currentPage = Math.min(page, pageCount);
  const start = (currentPage - 1) * pageSize;
  const pageRows = rows.slice(start, start + pageSize);

  const columns: RegisterColumn[] = [
    {
      header: "Case",
      wrap: true,
      cell: (row) => {
        const c = (row as CaseListRow).case;
        return { kind: "case", number: c.caseNumber, title: c.title };
      },
    },
    { header: "Stage", cell: (row) => ({ kind: "text", text: stageLabel((row as CaseListRow).case) }) },
    {
      header: daysHeader,
      numeric: true,
      cell: (row) => ({ kind: "number", value: (row as CaseListRow).days }),
    },
    { header: "Next hearing", cell: (row) => nextHearingCell((row as CaseListRow).case) },
  ];

  if (rows.length === 0) {
    return <p className="text-body-compact text-muted-foreground">No cases.</p>;
  }

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <QueueAnnouncer from={start + 1} to={start + pageRows.length} total={rows.length} />
      <div className="min-w-0 overflow-x-auto">
        <DocketTable caption={caption} columns={columns} rows={pageRows} serial={false} />
      </div>
      <ListFooter
        id={`${id}-page-size`}
        from={start + 1}
        to={start + pageRows.length}
        total={rows.length}
        page={currentPage}
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
