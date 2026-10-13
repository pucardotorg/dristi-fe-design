"use client";

import {
  TABLE_CELL,
  TABLE_HEAD,
  TABLE_HEAD_ROW,
  tableBodyClass,
  tableRowClass,
} from "@/components/chrome/table-plate";
import { Badge } from "@/components/ui/badge";
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
  formatSignOrderDate,
  signOrderStatusLabel,
  signOrderTypeLabel,
  type SignOrder,
} from "@/lib/employee/sign-orders";
import { cn } from "@/lib/utils";
import { Identifier } from "@/components/chrome/identifier";
import { useCourtText } from "@/components/court/court-provider";

/**
 * The signing queue for orders as a table: which orders are picked for signature, the
 * cause, its number, which decision the order carries, whether the signature is already
 * on it, and when it was drawn up.
 *
 * Six columns, and selection is the first one, because signing is the one court-side act
 * the reference does in bulk — a magistrate clears a queue of eighteen orders by
 * checking them, not by opening eighteen dialogs. `SignFormsTable` beside it works the
 * same way for the same reason.
 *
 * **The cause name opens the row, matching Sign forms.** The title is still the fact
 * that tells four rows of one case apart, so it stays in its own column as plain text.
 * The click lives on the cause, and the accessible name of that button carries the
 * title as well, so four links are not read as the same case four times
 * (ACCESSIBILITY §2, §9).
 *
 * **The case name and its number stay two columns.** The reference joins them into one
 * ("AdvocateTest and 1 Other vs Automate Company , ST/198/2026"); every court-side queue
 * we have splits them, and a bench scanning a column of numbers should not have to read
 * past a party name to find one (owner instruction, 2026-09-03).
 *
 * **A pointer on the rest of the row opens it too.** The checkbox still selects, and
 * keyboard still lands on the case name — a row that was itself a button would steal
 * the checkbox's target and add a second tab stop. Mouse and touch do not have that
 * problem, so a click anywhere else on the row opens the order, matching Sign forms
 * from the first column the bench reaches (owner, 2026-09-06).
 *
 * There is no row menu. The reference draws a kebab in a trailing Actions column, but
 * every act it could hold is already here — signing is the checkbox and the dialog, and
 * Download lives inside the preview the case name opens — so it would be furniture
 * around a hole (deviation logged in the build report).
 *
 * The panel shell (border, fill, shadow) lives on the screen around this, so the table
 * is one panel rather than a box inside a box.
 */
export function SignOrdersTable({
  rows,
  selectedIds,
  onToggle,
  onToggleAll,
  onOpen,
}: {
  rows: SignOrder[];
  selectedIds: ReadonlySet<string>;
  onToggle: (order: SignOrder) => void;
  /** Select or clear every *signable* row currently in view — the header checkbox. */
  onToggleAll: (select: boolean) => void;
  onOpen: (order: SignOrder) => void;
}) {
  const courtText = useCourtText();
  /* Only a pending order can be signed, so only a pending order can be selected — the
     header box speaks for those rows alone, and a page of already-signed orders has
     nothing for it to do. */
  const signable = rows.filter((order) => order.status === "pending-signature");
  const selectedOnPage = signable.filter((order) =>
    selectedIds.has(order.id),
  ).length;
  const allSelected =
    signable.length > 0 && selectedOnPage === signable.length;
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
              disabled={signable.length === 0}
              onCheckedChange={(next) => onToggleAll(next === true)}
              /* Names what the control does to what is on screen, not to the whole
                 queue — the header checkbox reaches this page of rows only, and a label
                 that said "all orders" would be a promise the control does not keep once
                 the list is paged. */
              aria-label={
                allSelected
                  ? "Clear the orders on this page"
                  : "Select the orders on this page"
              }
            />
          </TableHead>
          <TableHead className={cn(TABLE_HEAD, "min-w-56 whitespace-normal")}>
            Case name
          </TableHead>
          <TableHead className={cn(TABLE_HEAD, "whitespace-nowrap")}>
            Case number
          </TableHead>
          <TableHead className={cn(TABLE_HEAD, "min-w-56 whitespace-normal")}>
            Title
          </TableHead>
          <TableHead className={cn(TABLE_HEAD, "whitespace-nowrap")}>
            Status
          </TableHead>
          <TableHead className={cn(TABLE_HEAD, "whitespace-nowrap")}>
            Date added
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
        {rows.map((order) => {
          const pending = order.status === "pending-signature";
          const selected = selectedIds.has(order.id);
          const title = signOrderTypeLabel(order.type);
          return (
            <TableRow
              key={order.id}
              data-state={selected ? "selected" : undefined}
              {...rowActivation(tableRowClass({ selectable: true }))}
            >
              <TableCell className={cn(TABLE_CELL, "w-12")}>
                {/* A signed order has nothing to select. The cell stays for the column,
                    and the status beside it is what says why it is empty. */}
                {pending ? (
                  <Checkbox
                    checked={selected}
                    onCheckedChange={() => onToggle(order)}
                    aria-label={`Select ${title} in ${courtText(order.caseNumber)}`}
                  />
                ) : null}
              </TableCell>
              {/* The row's opener, matching Sign forms. Quiet `text-foreground` rather
                  than a teal underline: the teal is rationed for the one strong action
                  on the screen, and eighteen underlined teal names down a column is the
                  colour ui-craft §4 spends it on instead. The underline now arrives on
                  the *row's* hover, wherever the pointer sits, and on this control's
                  own focus — see `rowOpenerClass`. */}
              <TableCell
                className={cn(TABLE_CELL, "min-w-56 font-medium whitespace-normal")}
              >
                <button
                  type="button"
                  onClick={() => onOpen(order)}
                  {...rowOpener}
                className={rowOpenerClass}
                >
                  <span className="sr-only">
                    {pending ? "Read and sign " : "Read "}
                    {title} in{" "}
                  </span>
                  {causeTitle(order)}
                </button>
              </TableCell>
              <TableCell
                className={cn(TABLE_CELL, "whitespace-nowrap")}
              >
                <Identifier value={order.caseNumber} label="case number" />
              </TableCell>
              {/* Which decision this is — the fact that tells four rows of one case
                  apart. Plain text, like process type on Sign forms: the opener already
                  carries the row's weight. */}
              <TableCell className={cn(TABLE_CELL, "min-w-56 whitespace-normal")}>
                {title}
              </TableCell>
              {/* Status is the one tinted mark in the row, and it carries its own word —
                  never colour alone (ACCESSIBILITY §3). `warning` is the variant the
                  court-side overlays already spend on a pending state. */}
              <TableCell className={cn(TABLE_CELL, "whitespace-nowrap")}>
                <Badge variant={pending ? "warning" : "success"}>
                  {signOrderStatusLabel(order.status)}
                </Badge>
              </TableCell>
              <TableCell
                className={cn(TABLE_CELL, "tabular-nums whitespace-nowrap")}
              >
                {formatSignOrderDate(order.addedOn)}
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
