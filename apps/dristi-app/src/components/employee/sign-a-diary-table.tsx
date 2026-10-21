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
  causeTitle,
  courtHearingPurposeLabel,
  type CourtHearingPurposeId,
} from "@/lib/employee/hearings";
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
 * One day of the A-Diary as a table — the four columns of `a-diary.md` `ADY-03a`: the
 * case (name and number), the hearing the order was passed in (date and purpose, blank
 * outside a hearing), the proceedings, and the next hearing (date and purpose).
 *
 * The proceedings take the width and are the row's only opener: they are what the bench
 * reads and corrects. They are clamped to two lines here; the full text is in the
 * button's accessible name and in the entry it opens, so nothing depends on hover
 * (ACCESSIBILITY §7, §10). The A-Diary text itself is never shortened (`ADY-04`).
 *
 * Cells align to the top: a register is read across its first line.
 *
 * There is no actions column and no row menu. A row's one act is correcting its entry,
 * on the entry the row opens; signing is for the whole day, above the table.
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
          <TableHead className={cn(TABLE_HEAD, "whitespace-nowrap")}>Case</TableHead>
          <TableHead className={cn(TABLE_HEAD, "whitespace-nowrap")}>Hearing</TableHead>
          <TableHead className={cn(TABLE_HEAD, "min-w-80 whitespace-normal")}>
            Proceedings
          </TableHead>
          <TableHead className={cn(TABLE_HEAD, "whitespace-nowrap")}>
            Next hearing
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody className={tableBodyClass()}>
        {/* The header is a well, not a band welded to the rows — it needs the panel's fill
            under it or its rounded bottom corners read as cut off (ui-craft §4).
            `border-separate` has no per-edge row gap, so the gap is one inert row held out
            of the accessibility tree. */}
        <tr aria-hidden="true">
          <td colSpan={4} className="h-2 p-0" />
        </tr>
        {rows.map((entry) => (
          <TableRow key={entry.id} {...rowActivation(tableRowClass())}>
            <TableCell className={cn(cellClass, "min-w-48 whitespace-normal")}>
              <div className="flex flex-col gap-1">
                <span>{causeTitle(entry)}</span>
                <span className="text-caption text-muted-foreground">
                  <Identifier value={entry.caseNumber} label="case number" />
                </span>
              </div>
            </TableCell>
            <TableCell className={cn(cellClass, "min-w-36 whitespace-normal")}>
              {entry.hearing ? (
                <DateAndPurpose day={entry.hearing.day} purpose={entry.hearing.purpose} />
              ) : (
                /* Blank, as `ADY-03a` asks — said for a screen reader, which would
                   otherwise read nothing and leave the row ambiguous. */
                <span className="sr-only">Passed outside a hearing</span>
              )}
            </TableCell>
            <TableCell className={cn(cellClass, "min-w-80 whitespace-normal")}>
              <button
                type="button"
                onClick={() => onOpen(entry)}
                {...rowOpener}
                className={rowOpenerClass}
              >
                <span className="sr-only">
                  Read and correct the entry in {courtText(entry.caseNumber)}.{" "}
                </span>
                <span className="line-clamp-2">{entry.business}</span>
              </button>
            </TableCell>
            <TableCell className={cn(cellClass, "min-w-36 whitespace-normal")}>
              <DateAndPurpose day={entry.nextHearing} purpose={entry.nextPurpose} />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

/** A date over what it is for — the hearing and next-hearing cells. */
function DateAndPurpose({
  day,
  purpose,
}: {
  day: string;
  purpose: CourtHearingPurposeId;
}) {
  return (
    <div className="flex flex-col gap-1">
      <span className="tabular-nums whitespace-nowrap">{formatADiaryDate(day)}</span>
      <span className="text-caption text-muted-foreground">
        {courtHearingPurposeLabel(purpose)}
      </span>
    </div>
  );
}
