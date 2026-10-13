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
  evidenceDocumentLabel,
  evidenceNumber,
  type SignEvidence,
} from "@/lib/employee/sign-evidence";
import { cn } from "@/lib/utils";
import { Identifier } from "@/components/chrome/identifier";
import { useCourtText } from "@/components/court/court-provider";

/**
 * The evidence signing queue as a table: which markings are picked for signature, the
 * cause, its number, the document that was marked, and the exhibit number it took.
 *
 * Five columns, and selection is the first one, because signing is the one court-side act
 * the reference does in bulk — a magistrate clears a queue of twenty-five markings by
 * checking them, not by opening twenty-five dialogs. Both signing queues beside it work
 * the same way for the same reason.
 *
 * **The cause title opens the row, as the reference draws it — but it is not what
 * identifies one.** Five rows of this queue are the same case, told apart only by the
 * document and the exhibit number beside the name. So the name keeps the reference's
 * click, and the *accessible* name of that button carries the document and the number:
 * five links reading "Mustanki Cooperative Co. v. Rajesh Varma" and nothing else is a
 * screen reader being handed five identical choices for five different acts
 * (ACCESSIBILITY §2, §9). That is the one deviation in this table, and it is additive —
 * nothing on screen changes.
 *
 * There is no status column: a row in this queue is in exactly one state, waiting for
 * signature, so a chip repeating that on every row would carry no information. There is
 * no row menu either — signing is already in two places, and changing a marking lives
 * inside the dialog the name opens, beside the facts it changes.
 *
 * The panel shell (border, fill, shadow) lives on the screen around this, so the table is
 * one panel rather than a box inside a box.
 */
export function SignEvidenceTable({
  rows,
  selectedIds,
  onToggle,
  onToggleAll,
  onOpen,
}: {
  rows: SignEvidence[];
  selectedIds: ReadonlySet<string>;
  onToggle: (row: SignEvidence) => void;
  /** Select or clear every row currently in view — the header checkbox. */
  onToggleAll: (select: boolean) => void;
  onOpen: (row: SignEvidence) => void;
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
                 that said "all evidence" would be a promise the control does not keep
                 once the list is paged. */
              aria-label={
                allSelected
                  ? "Clear the documents on this page"
                  : "Select the documents on this page"
              }
            />
          </TableHead>
          <TableHead className={cn(TABLE_HEAD, "min-w-64 whitespace-normal")}>
            Case name
          </TableHead>
          <TableHead className={cn(TABLE_HEAD, "whitespace-nowrap")}>
            Case number
          </TableHead>
          <TableHead className={cn(TABLE_HEAD, "min-w-56 whitespace-normal")}>
            Document
          </TableHead>
          <TableHead className={cn(TABLE_HEAD, "whitespace-nowrap")}>
            Evidence number
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody className={tableBodyClass({ selectable: true })}>
        {/* The header is a well, not a band welded to the rows — it needs the panel's fill
            under it or its rounded bottom corners read as cut off (ui-craft §4).
            `border-separate` has no per-edge row gap, so the gap is one inert row held out
            of the accessibility tree. */}
        <tr aria-hidden="true">
          <td colSpan={5} className="h-2 p-0" />
        </tr>
        {rows.map((row) => {
          const selected = selectedIds.has(row.id);
          const document = evidenceDocumentLabel(row.document);
          const exhibit = evidenceNumber(row);
          return (
            <TableRow
              key={row.id}
              data-state={selected ? "selected" : undefined}
              {...rowActivation(tableRowClass({ selectable: true }))}
            >
              <TableCell className={cn(TABLE_CELL, "w-12")}>
                <Checkbox
                  checked={selected}
                  onCheckedChange={() => onToggle(row)}
                  aria-label={`Select ${document}, ${exhibit}, in ${courtText(row.caseNumber)}`}
                />
              </TableCell>
              {/* The row's one emphasised cell, and its only opener. Quiet
                  `text-foreground` rather than the reference's teal underline: the teal is
                  rationed for the one strong action on the screen, and twenty-five
                  underlined teal names down a column is the colour ui-craft §4 spends it
                  on instead. The underline now arrives on the *row's* hover, wherever
                  the pointer sits, and on this control's own focus — see
                  `rowOpenerClass`. */}
              <TableCell
                className={cn(TABLE_CELL, "min-w-64 font-medium whitespace-normal")}
              >
                <button
                  type="button"
                  onClick={() => onOpen(row)}
                  {...rowOpener}
                className={rowOpenerClass}
                >
                  <span className="sr-only">{`Read and sign ${document}, ${exhibit}, in `}</span>
                  {causeTitle(row)}
                </button>
              </TableCell>
              <TableCell
                className={cn(TABLE_CELL, "whitespace-nowrap")}
              >
                <Identifier value={row.caseNumber} label="case number" />
              </TableCell>
              {/* Plain text, not a chip. Ten document heads tinted down a column is
                  decoration, and the words are already the whole fact (ui-craft §4). */}
              <TableCell className={cn(TABLE_CELL, "min-w-56 whitespace-normal")}>
                {document}
              </TableCell>
              <TableCell
                className={cn(TABLE_CELL, "tabular-nums whitespace-nowrap")}
              >
                {exhibit}
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
