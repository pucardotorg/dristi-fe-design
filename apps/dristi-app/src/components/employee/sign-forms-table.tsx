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
  formatSignFormDate,
  signFormProcessLabel,
  type SignForm,
} from "@/lib/employee/sign-forms";
import { cn } from "@/lib/utils";
import { Identifier } from "@/components/chrome/identifier";
import { useCourtText } from "@/components/court/court-provider";

/**
 * The signing queue as a table: which forms are picked for signature, the cause, its
 * number, which process the form belongs to, and when it was drawn up.
 *
 * Five columns, and the first one is the point of the screen. Unlike the other
 * court-side queues this table carries selection, because signing is the one court-side
 * act the reference does in bulk — a magistrate clears a queue of forty-five forms by
 * checking them, not by opening forty-five dialogs.
 *
 * **The row is not the click target here.** Its three sibling queues open a dialog from
 * anywhere on the row; this one cannot, because the row already owns a control. A row
 * that both selects and opens on the same click has to guess which the bench meant.
 * So the checkbox selects, the cause title opens, and nothing else in the row is
 * clickable — the reference's own division.
 *
 * There is no status column: a row in this queue is in exactly one state, waiting for
 * signature, so a chip repeating that on every row would carry no information. There is
 * no row menu either — sign is the only act, and it is already in two places.
 *
 * The panel shell (border, fill, shadow) lives on the screen around this, so the table
 * is one panel rather than a box inside a box.
 */
export function SignFormsTable({
  rows,
  selectedIds,
  onToggle,
  onToggleAll,
  onOpen,
}: {
  rows: SignForm[];
  selectedIds: ReadonlySet<string>;
  onToggle: (form: SignForm) => void;
  /** Select or clear every row currently in view — the header checkbox. */
  onToggleAll: (select: boolean) => void;
  onOpen: (form: SignForm) => void;
}) {
  const courtText = useCourtText();
  const selectedOnPage = rows.filter((form) => selectedIds.has(form.id)).length;
  const allSelected = rows.length > 0 && selectedOnPage === rows.length;
  const someSelected = selectedOnPage > 0 && !allSelected;

  return (
    <Table className="w-full border-separate border-spacing-0 text-body-compact">
      <TableHeader>
        <TableRow className={TABLE_HEAD_ROW}>
          <TableHead className={cn(TABLE_HEAD, "w-12")}>
            <Checkbox
              checked={allSelected ? true : someSelected ? "indeterminate" : false}
              onCheckedChange={(next) => onToggleAll(next === true)}
              /* Names what the control does to what is on screen, not to the whole
                 queue — the header checkbox reaches this page of rows only, and a
                 label that said "all forms" would be a promise the control does not
                 keep once the list is paged. */
              aria-label={
                allSelected
                  ? "Clear the forms on this page"
                  : "Select the forms on this page"
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
            Process type
          </TableHead>
          <TableHead className={cn(TABLE_HEAD, "whitespace-nowrap")}>
            Date created
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody className={tableBodyClass({ selectable: true })}>
        {/* The header is a well, not a band welded to the rows — it needs the panel's
            fill under it or its rounded bottom corners read as cut off (ui-craft §4).
            `border-separate` has no per-edge row gap, so the gap is one inert row held
            out of the accessibility tree. */}
        <tr aria-hidden="true">
          <td colSpan={5} className="h-2 p-0" />
        </tr>
        {rows.map((form) => {
          const selected = selectedIds.has(form.id);
          return (
            <TableRow
              key={form.id}
              data-state={selected ? "selected" : undefined}
              {...rowActivation(tableRowClass({ selectable: true }))}
            >
              <TableCell className={cn(TABLE_CELL, "w-12")}>
                <Checkbox
                  checked={selected}
                  onCheckedChange={() => onToggle(form)}
                  aria-label={`Select ${causeTitle(form)}, ${courtText(form.caseNumber)}`}
                />
              </TableCell>
              {/* The row's one emphasised cell, and its only opener. Quiet
                  `text-foreground` rather than the reference's teal underline: three
                  sibling court queues already name their opener this way, and ten
                  underlined teal names down a column is the colour ui-craft §4
                  rations. The underline now arrives on the *row's* hover, wherever the
                  pointer sits, and on this control's own focus — see `rowOpenerClass`. */}
              <TableCell
                className={cn(TABLE_CELL, "min-w-64 font-medium whitespace-normal")}
              >
                <button
                  type="button"
                  onClick={() => onOpen(form)}
                  {...rowOpener}
                className={rowOpenerClass}
                >
                  <span className="sr-only">Read and sign </span>
                  {causeTitle(form)}
                </button>
              </TableCell>
              <TableCell
                className={cn(TABLE_CELL, "whitespace-nowrap")}
              >
                <Identifier value={form.caseNumber} label="case number" />
              </TableCell>
              {/* Plain text, not a chip. Three tinted process types down a column is
                  decoration, and the word is already the whole fact (ui-craft §4). */}
              <TableCell className={cn(TABLE_CELL, "min-w-40 whitespace-normal")}>
                {signFormProcessLabel(form.process)}
              </TableCell>
              <TableCell
                className={cn(TABLE_CELL, "tabular-nums whitespace-nowrap")}
              >
                {formatSignFormDate(form.createdOn)}
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
