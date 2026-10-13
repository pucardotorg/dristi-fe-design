"use client";

import {
  TABLE_CELL,
  TABLE_HEAD,
  TABLE_HEAD_ROW,
  tableBodyClass,
  tableRowClass,
} from "@/components/chrome/table-plate";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  rowActivation,
  rowOpener,
  rowOpenerClass,
} from "@/lib/employee/row-activation";
import {
  formatADiaryDate,
  type ADiaryEntry,
} from "@/lib/employee/sign-a-diary";
import { cn } from "@/lib/utils";
import { Identifier } from "@/components/chrome/identifier";
import { useCourtText } from "@/components/court/court-provider";

/* The A-Diary's rows run to several lines, and centring strands the short
 * cells against them. */
const cellClass = cn(TABLE_CELL, "align-top");

/**
 * One day of the A-Diary as a table: the case, what the court did, and when it comes
 * back.
 *
 * Three columns, the reference's own, and the narrowest table on the court side. It reads
 * that way because the register itself does: a diary is not a list of cases with facts
 * hung off them, it is a list of *what was done*, and the business of the day is the row.
 * So the business takes the width, carries the row's emphasis and is the only opener —
 * the cause title, the stage, who appeared and the rest of the case's particulars are in
 * the entry the bench opens, where they are read once rather than scanned down a column.
 *
 * **The cause title is not a fourth column here**, though every other court-side queue
 * leads with it. The bench is signing its own day: the number is the register's index
 * and the business is what it is checking, and a party name between them would push the
 * one cell that matters off the right of a laptop. It heads the entry dialog instead.
 *
 * **The business is clamped to two lines, not truncated away.** A day's proceedings run
 * to a paragraph, and a column that grew to fit the longest one would leave four
 * one-line rows floating in it. The full text is in the button's accessible name and in
 * the entry the button opens, so nothing is only available to a sighted reader who can
 * hover (ACCESSIBILITY §7, §10).
 *
 * Cells align to the top rather than the middle, which is the one place this table
 * departs from the shared treatment: a number centred against a two-line paragraph
 * floats, and a register is read across its first line.
 *
 * There is no actions column and no row menu. Signing is the act, it lives on the entry
 * the row opens, and drawing a kebab for it would be furniture around a hole.
 *
 * The panel shell (border, fill, shadow) lives on the screen around this, so the table is
 * one panel rather than a box inside a box.
 */
export function SignADiaryTable({
  rows,
  onOpen,
}: {
  rows: ADiaryEntry[];
  onOpen: (entry: ADiaryEntry) => void;
}) {
  const courtText = useCourtText();
  return (
    <Table className="w-full border-separate border-spacing-0 text-body-compact">
      <TableHeader>
        <TableRow className={TABLE_HEAD_ROW}>
          <TableHead className={cn(TABLE_HEAD, "whitespace-nowrap")}>
            Case number
          </TableHead>
          <TableHead className={cn(TABLE_HEAD, "min-w-80 whitespace-normal")}>
            Proceedings / business of the day
          </TableHead>
          <TableHead className={cn(TABLE_HEAD, "whitespace-nowrap")}>
            Next hearing date
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody className={tableBodyClass()}>
        {/* The header is a well, not a band welded to the rows — it needs the panel's fill
            under it or its rounded bottom corners read as cut off (ui-craft §4).
            `border-separate` has no per-edge row gap, so the gap is one inert row held out
            of the accessibility tree. */}
        <tr aria-hidden="true">
          <td colSpan={3} className="h-2 p-0" />
        </tr>
        {rows.map((entry) => (
          <TableRow key={entry.id} {...rowActivation(tableRowClass())}>
            <TableCell
              className={cn(cellClass, "whitespace-nowrap")}
            >
              <Identifier value={entry.caseNumber} label="case number" />
            </TableCell>
            {/* The row's one emphasised cell, and its only opener. Quiet
                `text-foreground` rather than the reference's teal underline: the teal is
                rationed for the one strong action on the screen, and a column of
                underlined teal paragraphs is not what ui-craft §4 spends it on. The
                underline now arrives on the *row's* hover, wherever the pointer sits,
                and on this control's own focus — see `rowOpenerClass`. */}
            <TableCell className={cn(cellClass, "min-w-80 whitespace-normal")}>
              <button
                type="button"
                onClick={() => onOpen(entry)}
                {...rowOpener}
                className={rowOpenerClass}
              >
                <span className="sr-only">
                  Read and sign the entry in {courtText(entry.caseNumber)}.{" "}
                </span>
                <span className="line-clamp-2">{entry.business}</span>
              </button>
            </TableCell>
            <TableCell
              className={cn(cellClass, "tabular-nums whitespace-nowrap")}
            >
              {formatADiaryDate(entry.nextHearing)}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
