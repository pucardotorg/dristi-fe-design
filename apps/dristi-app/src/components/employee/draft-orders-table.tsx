"use client";

import { Identifier } from "@/components/chrome/identifier";
import {
  TABLE_CELL,
  TABLE_HEAD,
  TABLE_HEAD_ROW,
  tableBodyClass,
  tableRowClass,
} from "@/components/chrome/table-plate";
import { CounselCell } from "@/components/employee/counsel-cell";
import {
  HearingOrdersButton,
  ORDERS_COLUMN_CLASS,
} from "@/components/employee/hearings-table";
import { useOrderDrafts } from "@/components/employee/use-order-draft";
import { hasDraftFor } from "@/lib/employee/order-drafts";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { CourtRole } from "@/lib/employee/content";
import {
  causeTitle,
  counselFor,
  courtHearingPurposeLabel,
  courtHearingStatusLabel,
  courtHearingStatusVariant,
  type CourtHearing,
} from "@/lib/employee/hearings";
import { rowActivation } from "@/lib/employee/row-activation";
import { cn } from "@/lib/utils";

/**
 * The orders open at today's sitting, drawn the way today's cause list draws the same
 * listings: the court's serial, the cause, its number, who appears, what it was listed
 * for, where it stands, and the order on it.
 *
 * **The same seven columns as `HearingsTable` in the typist's seat, on the owner's
 * instruction (2026-09-16)** — and composed out of that table's own cells rather than
 * beside them, so the two cannot drift: `CounselCell` for the advocates, the cause list's
 * own status variants, and `HearingOrdersButton` for the Orders column, which is where
 * the draft plate and the recorded tick already live. This tab is a view of the day's
 * board filtered to the matters with an order on them, so it should look like the board.
 *
 * What it is not is the cause list. There are no session controls in any seat: the bench
 * calls a matter from the cause list, and a screen in the Sign group that offered Start
 * hearing would be a second place to run the sitting. The Orders column is the row's one
 * act, which is the shape the typist's own cause list already takes.
 *
 * **No checkbox, either.** A draft cannot be signed, in bulk or at all: it has not been
 * sent for signature, and the act that finishes it is the composer's own. A column of
 * boxes feeding no button would offer an act this tab cannot perform.
 *
 * The panel shell (border, fill, shadow) lives on the screen around this, so the table is
 * one panel rather than a box inside a box.
 */
export function DraftOrdersTable({
  rows,
  seat,
}: {
  rows: CourtHearing[];
  seat: CourtRole;
}) {
  /* The same store the cause list reads for the same mark, so a listing cannot carry a
     draft plate on one screen and a plain page on the other. */
  const drafts = useOrderDrafts();

  return (
    <Table className="w-full border-separate border-spacing-0 text-body-compact">
      <TableHeader>
        <TableRow className={TABLE_HEAD_ROW}>
          <TableHead className={cn(TABLE_HEAD, "w-16 whitespace-nowrap")}>
            S. no.
          </TableHead>
          <TableHead className={cn(TABLE_HEAD, "min-w-40 whitespace-normal")}>
            Case name
          </TableHead>
          <TableHead className={cn(TABLE_HEAD, "whitespace-nowrap")}>
            Case number
          </TableHead>
          <TableHead className={cn(TABLE_HEAD, "min-w-48 whitespace-nowrap")}>
            Advocates
          </TableHead>
          <TableHead className={cn(TABLE_HEAD, "min-w-32 whitespace-normal")}>
            Purpose
          </TableHead>
          <TableHead className={cn(TABLE_HEAD, "min-w-32 whitespace-nowrap")}>
            Status
          </TableHead>
          <TableHead
            className={cn(
              TABLE_HEAD,
              ORDERS_COLUMN_CLASS,
              "whitespace-nowrap",
            )}
          >
            Orders
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody className={tableBodyClass()}>
        {/* The header is a well, not a band welded to the rows — it needs the panel's
            fill under it or its rounded bottom corners read as cut off (ui-craft §4).
            `border-separate` has no per-edge row gap, so the gap is one inert row held
            out of the accessibility tree. */}
        <tr aria-hidden="true">
          <td colSpan={7} className="h-2 p-0" />
        </tr>
        {rows.map((hearing) => (
          /* A click anywhere on the row opens the order it is here for. The Orders
             button is the named control and the keyboard's target; the row borrows its
             press (`row-activation.ts`), so there is one handler rather than two
             descriptions of the same act. */
          <TableRow key={hearing.id} {...rowActivation(tableRowClass())}>
            {/* Quiet, the way the cause list writes its own serial: it is how the bench
                finds the matter on the board, not what the row is about. */}
            <TableCell
              className={cn(
                TABLE_CELL,
                "w-16 tabular-nums text-muted-foreground",
              )}
            >
              {hearing.item}
            </TableCell>
            <TableCell
              className={cn(TABLE_CELL, "min-w-40 font-medium whitespace-normal")}
            >
              {causeTitle(hearing)}
            </TableCell>
            <TableCell className={cn(TABLE_CELL, "whitespace-nowrap")}>
              {/* This table reads the hearings table's cells, so it takes its
                  identifier treatment too — one face for one kind of fact. */}
              <Identifier value={hearing.caseNumber} label="case number" />
            </TableCell>
            <TableCell className={cn(TABLE_CELL, "min-w-48 whitespace-nowrap")}>
              <CounselCell
                complainant={counselFor(hearing, "complainant").map(
                  (counsel) => counsel.name,
                )}
                accused={counselFor(hearing, "accused").map(
                  (counsel) => counsel.name,
                )}
                dense
              />
            </TableCell>
            <TableCell className={cn(TABLE_CELL, "min-w-32 whitespace-normal")}>
              {courtHearingPurposeLabel(hearing.purpose)}
            </TableCell>
            {/* Where the listing stands on the day — the cause list's own chip, carrying
                its own word so status is never colour alone (ACCESSIBILITY §3). It is
                the hearing's status and not the order's: every row on this tab is a
                draft, which the tab says once, and the fact worth a column here is
                whether the matter it belongs to has been heard yet. */}
            <TableCell className={cn(TABLE_CELL, "min-w-32 whitespace-nowrap")}>
              <Badge
                variant={courtHearingStatusVariant(hearing.status)}
                className="w-fit"
              >
                {courtHearingStatusLabel(hearing.status)}
              </Badge>
            </TableCell>
            <TableCell
              className={cn(
                TABLE_CELL,
                ORDERS_COLUMN_CLASS,
                "whitespace-nowrap",
              )}
            >
              <div className="flex justify-center">
                <HearingOrdersButton
                  hearing={hearing}
                  seat={seat}
                  drafted={hasDraftFor(drafts, hearing.id)}
                  opensExisting
                  isRowOpener
                />
              </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
