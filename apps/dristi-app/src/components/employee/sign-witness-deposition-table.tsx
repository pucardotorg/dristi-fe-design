"use client";

import {
  TABLE_CELL,
  TABLE_HEAD,
  TABLE_HEAD_ROW,
  tableBodyClass,
  tableRowClass,
} from "@/components/chrome/table-plate";
import { CounselCell } from "@/components/employee/counsel-cell";
import {
  rowActivation,
  rowOpener,
  rowOpenerClass,
} from "@/lib/employee/row-activation";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { causeTitle, counselFor } from "@/lib/employee/hearings";
import {
  formatDepositionDate,
  witnessRoleLabel,
  witnessTag,
  type WitnessDeposition,
} from "@/lib/employee/sign-witness-deposition";
import { cn } from "@/lib/utils";
import { Identifier } from "@/components/chrome/identifier";
import { useCourtText } from "@/components/court/court-provider";

/**
 * The evidence queue as a table: which sheets are picked for signature, the cause, its
 * number, who was in the box, when the evidence was recorded, and who appeared.
 *
 * Six columns, in the reference's own order. The witness column is the one this table
 * has that no sibling queue does, and it is the column that does the work: a case with
 * four witnesses puts four rows in this list under one cause title, and the witness is
 * what tells them apart. Its `PW1` / `DW4` tag rides beside the name because that tag
 * is how the bench, the bar and the record all refer to the sheet — muted, because the
 * name is the fact and the tag is its label.
 *
 * **The row is not the click target here.** Its sibling queues open a dialog from
 * anywhere on the row; this one cannot, because the row already owns a control. A row
 * that both selects and opens on the same click has to guess which the bench meant. So
 * the checkbox selects, the cause title opens, and nothing else in the row is
 * clickable — the reference's own division.
 *
 * There is no status column: a row in this queue is in exactly one state, waiting for
 * signature, so a chip repeating that on every row would carry no information. There is
 * no row menu either — sign is the only act, and it is already in two places.
 *
 * The panel shell (border, fill, shadow) lives on the screen around this, so the table
 * is one panel rather than a box inside a box.
 */
export function SignWitnessDepositionTable({
  rows,
  selectedIds,
  onToggle,
  onToggleAll,
  onOpen,
}: {
  rows: WitnessDeposition[];
  selectedIds: ReadonlySet<string>;
  onToggle: (deposition: WitnessDeposition) => void;
  /** Select or clear every row currently in view — the header checkbox. */
  onToggleAll: (select: boolean) => void;
  onOpen: (deposition: WitnessDeposition) => void;
}) {
  const courtText = useCourtText();
  const selectedOnPage = rows.filter((row) => selectedIds.has(row.id)).length;
  const allSelected = rows.length > 0 && selectedOnPage === rows.length;
  const someSelected = selectedOnPage > 0 && !allSelected;

  return (
    <Table className="w-full border-separate border-spacing-0 text-body-compact">
      <TableHeader>
        <TableRow className={TABLE_HEAD_ROW}>
          <TableHead className={cn(TABLE_HEAD, "w-12")}>
            <Checkbox
              checked={
                allSelected ? true : someSelected ? "indeterminate" : false
              }
              onCheckedChange={(next) => onToggleAll(next === true)}
              /* Names what the control does to what is on screen, not to the whole
                 queue — the header checkbox reaches this page of rows only, and a label
                 that said "all depositions" would be a promise the control does not
                 keep once the list is paged. */
              aria-label={
                allSelected
                  ? "Clear the depositions on this page"
                  : "Select the depositions on this page"
              }
            />
          </TableHead>
          <TableHead className={cn(TABLE_HEAD, "min-w-64 whitespace-normal")}>
            Case name
          </TableHead>
          <TableHead className={cn(TABLE_HEAD, "whitespace-nowrap")}>
            Case number
          </TableHead>
          <TableHead className={cn(TABLE_HEAD, "min-w-40 whitespace-normal")}>
            Witness name
          </TableHead>
          <TableHead className={cn(TABLE_HEAD, "whitespace-nowrap")}>
            Date of deposition
          </TableHead>
          <TableHead className={cn(TABLE_HEAD, "min-w-48 whitespace-nowrap")}>
            Advocates
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody className={tableBodyClass({ selectable: true })}>
        {/* The header is a well, not a band welded to the rows — it needs the panel's
            fill under it or its rounded bottom corners read as cut off (ui-craft §4).
            `border-separate` has no per-edge row gap, so the gap is one inert row held
            out of the accessibility tree. */}
        <tr aria-hidden="true">
          <td colSpan={6} className="h-2 p-0" />
        </tr>
        {rows.map((deposition) => {
          const selected = selectedIds.has(deposition.id);
          const tag = witnessTag(deposition);
          return (
            <TableRow
              key={deposition.id}
              data-state={selected ? "selected" : undefined}
              {...rowActivation(tableRowClass({ selectable: true }))}
            >
              <TableCell className={cn(TABLE_CELL, "w-12")}>
                <Checkbox
                  checked={selected}
                  onCheckedChange={() => onToggle(deposition)}
                  /* The sheet, not the row: one case can put four of these in the list,
                     and a label naming only the cause would read aloud four times
                     identically. */
                  aria-label={`Select the deposition of ${deposition.witness.name}, ${tag}, in ${courtText(deposition.caseNumber)}`}
                />
              </TableCell>
              {/* The row's one emphasised cell, and its only opener. Quiet
                  `text-foreground` rather than the reference's teal underline: the
                  sibling court queues already name their opener this way, and ten
                  underlined teal names down a column is the colour ui-craft §4 rations.
                  The underline now arrives on the *row's* hover, wherever the pointer
                  sits, and on this control's own focus — see `rowOpenerClass`. */}
              <TableCell
                className={cn(
                  TABLE_CELL,
                  "min-w-64 font-medium whitespace-normal",
                )}
              >
                <button
                  type="button"
                  onClick={() => onOpen(deposition)}
                  {...rowOpener}
                className={rowOpenerClass}
                >
                  <span className="sr-only">
                    Read and sign the deposition of {deposition.witness.name} in{" "}
                  </span>
                  {causeTitle(deposition)}
                </button>
              </TableCell>
              <TableCell
                className={cn(TABLE_CELL, "whitespace-nowrap")}
              >
                <Identifier value={deposition.caseNumber} label="case number" />
              </TableCell>
              {/* The name carries the fact; the tag labels it, so it recedes to muted
                  the way the `(C)` / `(A)` marks do in the advocates cell beside it.
                  Spoken in full, because "PW1" read aloud is not a sentence. */}
              <TableCell className={cn(TABLE_CELL, "min-w-40 whitespace-normal")}>
                <span className="text-foreground">
                  {deposition.witness.name}
                </span>{" "}
                <span aria-hidden className="text-muted-foreground">
                  {tag}
                </span>
                <span className="sr-only">{`, ${tag}, ${witnessRoleLabel(deposition)}`}</span>
              </TableCell>
              <TableCell
                className={cn(TABLE_CELL, "tabular-nums whitespace-nowrap")}
              >
                {formatDepositionDate(deposition.depositionOn)}
              </TableCell>
              <TableCell className={cn(TABLE_CELL, "min-w-48 whitespace-nowrap")}>
                <CounselCell
                  complainant={counselFor(deposition, "complainant").map(
                    (counsel) => counsel.name,
                  )}
                  accused={counselFor(deposition, "accused").map(
                    (counsel) => counsel.name,
                  )}
                  dense
                />
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
