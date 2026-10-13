"use client";

import {
  TABLE_CELL,
  TABLE_HEAD,
  TABLE_HEAD_ROW,
  tableBodyClass,
  tableRowClass,
} from "@/components/chrome/table-plate";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { causeTitle } from "@/lib/employee/hearings";
import {
  rowActivation,
  rowOpener,
  rowOpenerClass,
} from "@/lib/employee/row-activation";
import {
  bandByStatus,
  courtProcessTypeInline,
  courtProcessTypeLabel,
  formatProcessDate,
  processChannelLabel,
  processStatusLine,
  type CourtProcess,
  type ProcessStatus,
  type ProcessTab,
} from "@/lib/employee/sign-process";
import { cn } from "@/lib/utils";
import { Identifier } from "@/components/chrome/identifier";
import { useCourtText } from "@/components/court/court-provider";

/** Seven columns on every tab — the checkbox and the reference's six. */
const COLUMNS = 7;

/**
 * A row's status, in the words its cell says it: what happened and when, or — for the
 * two that went wrong — what happened and why.
 *
 * The word carries the foreground and the day or reason stays muted, so a column of them
 * reads as statuses rather than as sentences. The two failures take the warning *ink* on
 * the word only; the word already says "failed", so colour is never the only signal
 * (DS Principles §6), and the ink pair is the one measured for text on a white panel.
 */
export function ProcessStatusText({
  process,
  inline = false,
}: {
  process: CourtProcess;
  /** Run into a sentence — the overlay's supporting line — rather than stacked in a cell. */
  inline?: boolean;
}) {
  const line = processStatusLine(process);
  const detail = line.day ? formatProcessDate(line.day) : line.reason;
  if (inline) {
    return (
      <span>
        <span className={line.warn ? "text-warning-ink" : undefined}>
          {line.word}
        </span>
        {detail ? ` ${line.day ? "" : "· "}${detail}` : null}
      </span>
    );
  }
  return (
    /* Two lines, always: the word, and under it the day or the reason. Inline, a narrow
       column broke a failure across three lines with its separator stranded at a line
       end; stacked, every status reads the same way at every width and needs no
       separator at all. */
    <span className="flex flex-col">
      <span
        className={cn(
          "font-medium",
          line.warn ? "text-warning-ink" : "text-foreground",
        )}
      >
        {line.word}
      </span>
      {detail ? (
        <span
          className={cn(
            "text-muted-foreground",
            line.day && "tabular-nums whitespace-nowrap",
          )}
        >
          {detail}
        </span>
      ) : null}
    </span>
  );
}

/**
 * One tab of the process line as a table: which rows are picked, the cause, its number,
 * which instrument it is, where it stands, how it goes out, and the listing it is
 * returnable for.
 *
 * **The fifth column is the tab's.** On RPAD collection every row is in the same status,
 * so the column is the day that status is about — "Payment made", as the reference
 * draws it. Where a tab holds several statuses the column is "Status", and the cell says
 * which one with its own day or reason (`ProcessStatusText`).
 *
 * **Under All, the rows band by status** in the tab's own order, each band a `tbody` with
 * its label heading the rows below it — the treatment the pending-tasks list gives its
 * due bands. Under one pill there is one status and nothing to band.
 *
 * Selection is the first column on every tab; the case name opens the row, and a pointer
 * anywhere else on it opens it too. The panel shell lives on the screen around this.
 */
export function SignProcessTable({
  tab,
  rows,
  banded,
  selectedIds,
  onToggle,
  onToggleAll,
  onOpen,
}: {
  tab: ProcessTab;
  rows: CourtProcess[];
  /** Whether the view is All across several statuses, and so bands by status. */
  banded: boolean;
  selectedIds: ReadonlySet<string>;
  onToggle: (process: CourtProcess) => void;
  /** Select or clear every row currently in view — the header checkbox. */
  onToggleAll: (select: boolean) => void;
  onOpen: (process: CourtProcess) => void;
}) {
  const selectedOnPage = rows.filter((row) => selectedIds.has(row.id)).length;
  const allSelected = rows.length > 0 && selectedOnPage === rows.length;
  const someSelected = selectedOnPage > 0 && !allSelected;
  const bands = banded ? bandByStatus(rows, tab) : null;
  const statusColumn = tab.statuses.length > 1;

  const row = (process: CourtProcess) => (
    <ProcessRow
      key={process.id}
      process={process}
      statusColumn={statusColumn}
      selected={selectedIds.has(process.id)}
      onToggle={onToggle}
      onOpen={onOpen}
    />
  );

  return (
    <Table className="w-full border-separate border-spacing-0 text-body-compact">
      <TableHeader>
        <TableRow className={TABLE_HEAD_ROW}>
          <TableHead className={cn(TABLE_HEAD, "w-12")}>
            <Checkbox
              checked={
                allSelected ? true : someSelected ? "indeterminate" : false
              }
              disabled={rows.length === 0}
              onCheckedChange={(next) => onToggleAll(next === true)}
              /* Every row in view — the list is not paged. */
              aria-label={
                allSelected
                  ? "Clear every process shown"
                  : "Select every process shown"
              }
            />
          </TableHead>
          <TableHead className={cn(TABLE_HEAD, "min-w-48 whitespace-normal")}>
            Case name
          </TableHead>
          <TableHead className={cn(TABLE_HEAD, "whitespace-nowrap")}>
            Case number
          </TableHead>
          <TableHead className={cn(TABLE_HEAD, "min-w-36 whitespace-normal")}>
            Process type
          </TableHead>
          <TableHead
            className={cn(
              TABLE_HEAD,
              statusColumn ? "min-w-32 whitespace-normal" : "whitespace-nowrap",
            )}
          >
            {tab.dateColumn}
          </TableHead>
          <TableHead className={cn(TABLE_HEAD, "whitespace-nowrap")}>
            Delivery channel
          </TableHead>
          <TableHead className={cn(TABLE_HEAD, "whitespace-nowrap")}>
            Hearing date
          </TableHead>
        </TableRow>
      </TableHeader>
      {bands ? (
        /* Each band is a `tbody` so the plate's neighbour rules — the last row's rule, a
           run of picked rows rounding as one — stay inside the band they belong to. */
        bands.map((band) => (
          <TableBody
            key={band.status.id}
            className={tableBodyClass({ selectable: true })}
          >
            <tr>
              <th scope="rowgroup" colSpan={COLUMNS} className="p-0 text-left">
                <BandLabel status={band.status} count={band.rows.length} />
              </th>
            </tr>
            {band.rows.map(row)}
          </TableBody>
        ))
      ) : (
        <TableBody className={tableBodyClass({ selectable: true })}>
          {/* The header is a well, not a band welded to the rows — it needs the panel's
              fill under it or its rounded bottom corners read as cut off (ui-craft §4).
              `border-separate` has no per-edge row gap, so the gap is one inert row held
              out of the accessibility tree. */}
          <tr aria-hidden="true">
            <td colSpan={COLUMNS} className="h-2 p-0" />
          </tr>
          {rows.map(row)}
        </TableBody>
      )}
    </Table>
  );
}

/**
 * A band's label: the status and how many it holds in this view. The rule sits
 * above the label, between this band and the one before, so nothing runs between a label
 * and its own rows; more air above than below does the rest.
 */
function BandLabel({ status, count }: { status: ProcessStatus; count: number }) {
  return (
    <div className="flex w-full items-baseline gap-2 border-b border-hairline px-4 pt-4 pb-2">
      {/* 14px, the table's own size: a band names the rows under it and must not read
          smaller than the data it heads. */}
      <span className="text-body-compact font-semibold text-foreground">
        {status.label}
      </span>
      <span className="text-body-compact tabular-nums text-muted-foreground">
        {count}
      </span>
    </div>
  );
}

function ProcessRow({
  process,
  statusColumn,
  selected,
  onToggle,
  onOpen,
}: {
  process: CourtProcess;
  statusColumn: boolean;
  selected: boolean;
  onToggle: (process: CourtProcess) => void;
  onOpen: (process: CourtProcess) => void;
}) {
  const courtText = useCourtText();
  const type = courtProcessTypeLabel(process.type);
  const inline = courtProcessTypeInline(process.type);
  return (
    <TableRow
      data-state={selected ? "selected" : undefined}
      {...rowActivation(tableRowClass({ selectable: true }))}
    >
      <TableCell className={cn(TABLE_CELL, "w-12")}>
        <Checkbox
          checked={selected}
          onCheckedChange={() => onToggle(process)}
          aria-label={`Select the ${inline} in ${courtText(process.caseNumber)}`}
        />
      </TableCell>
      {/* The row's opener. Quiet `text-foreground` rather than a teal underline: the teal
          is rationed for the one strong action on the screen. */}
      <TableCell
        className={cn(TABLE_CELL, "min-w-48 font-medium whitespace-normal")}
      >
        <button
          type="button"
          onClick={() => onOpen(process)}
          {...rowOpener}
          className={rowOpenerClass}
        >
          <span className="sr-only">Read the {inline} in </span>
          {causeTitle(process)}
        </button>
      </TableCell>
      <TableCell className={cn(TABLE_CELL, "whitespace-nowrap")}>
        <Identifier value={process.caseNumber} label="case number" />
      </TableCell>
      {/* Which instrument this is — the fact that tells three rows of one case apart. */}
      <TableCell className={cn(TABLE_CELL, "min-w-36 whitespace-normal")}>
        {type}
      </TableCell>
      {statusColumn ? (
        <TableCell className={cn(TABLE_CELL, "min-w-32 whitespace-normal")}>
          <ProcessStatusText process={process} />
        </TableCell>
      ) : (
        <TableCell className={cn(TABLE_CELL, "tabular-nums whitespace-nowrap")}>
          {/* The one-status tab is RPAD collection, and its day is the fee's. */}
          {formatProcessDate(process.paidOn)}
        </TableCell>
      )}
      <TableCell className={cn(TABLE_CELL, "whitespace-nowrap")}>
        {processChannelLabel(process.channel)}
      </TableCell>
      <TableCell className={cn(TABLE_CELL, "tabular-nums whitespace-nowrap")}>
        {formatProcessDate(process.hearingDate)}
      </TableCell>
    </TableRow>
  );
}
