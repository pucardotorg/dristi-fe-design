"use client";

import Link from "next/link";

import { Identifier } from "@/components/chrome/identifier";
import {
  TABLE_CELL,
  TABLE_HEAD,
  TABLE_HEAD_ROW,
  tableBodyClass,
  tableRowClass,
} from "@/components/chrome/table-plate";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { draftOrderHref } from "@/lib/employee/draft-orders";
import type { HearingOrder } from "@/lib/employee/hearing-orders";
import { causeTitle, courtHearingPurposeLabel } from "@/lib/employee/hearings";
import { rowActivation, rowOpener } from "@/lib/employee/row-activation";
import { cn } from "@/lib/utils";

/**
 * The orders being written and not yet sent for signature — a list of **orders**, not of
 * hearings (owner, 2026-10-14).
 *
 * It used to be today's cause list again: serial, advocates, purpose and the hearing's
 * own status. That read as a second hearings board, and the hearing's status said
 * nothing true about the order — a draft is a draft whether its hearing is ongoing,
 * done, or there was no hearing at all (an order taken up outside one and left
 * unfinished). So each row now says what the order is and what it still needs:
 *
 * - the matter (name and number);
 * - **Drawn up at** — where the order comes from;
 * - **In this order** — the order items pulled into it, the facts a bench recognises an
 *   order by;
 * - **Still to fill** — the gaps left in its words, or that nothing is;
 * - **Continue drafting**, a labelled button rather than an icon, because finishing the
 *   order is the one thing to do with a row here. The rest of the row opens it too.
 */
export function DraftOrdersTable({ rows }: { rows: HearingOrder[] }) {
  return (
    <Table className="w-full border-separate border-spacing-0 text-body-compact">
      <TableHeader>
        <TableRow className={TABLE_HEAD_ROW}>
          <TableHead className={cn(TABLE_HEAD, "min-w-48 whitespace-normal")}>
            Case name
          </TableHead>
          <TableHead className={cn(TABLE_HEAD, "whitespace-nowrap")}>
            Case number
          </TableHead>
          <TableHead className={cn(TABLE_HEAD, "min-w-40 whitespace-normal")}>
            Drawn up at
          </TableHead>
          <TableHead className={cn(TABLE_HEAD, "min-w-40 whitespace-normal")}>
            In this order
          </TableHead>
          <TableHead className={cn(TABLE_HEAD, "whitespace-nowrap")}>
            Still to fill
          </TableHead>
          <TableHead className={cn(TABLE_HEAD, "w-px whitespace-nowrap")}>
            <span className="sr-only">Action</span>
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody className={tableBodyClass()}>
        {/* The header is a well, not a band welded to the rows; `border-separate` has no
            per-edge row gap, so the gap is one inert row held out of the tree. */}
        <tr aria-hidden="true">
          <td colSpan={6} className="h-2 p-0" />
        </tr>
        {rows.map((order) => {
          const { hearing } = order;
          return (
            <TableRow key={hearing.id} {...rowActivation(tableRowClass())}>
              <TableCell
                className={cn(TABLE_CELL, "min-w-48 font-medium whitespace-normal")}
              >
                {causeTitle(hearing)}
              </TableCell>
              <TableCell className={cn(TABLE_CELL, "whitespace-nowrap")}>
                <Identifier value={hearing.caseNumber} label="case number" />
              </TableCell>
              <TableCell className={cn(TABLE_CELL, "min-w-40 whitespace-normal")}>
                <DrawnUpAt order={order} />
              </TableCell>
              <TableCell className={cn(TABLE_CELL, "min-w-40 whitespace-normal")}>
                <InThisOrder order={order} />
              </TableCell>
              <TableCell className={cn(TABLE_CELL, "whitespace-nowrap")}>
                <StillToFill order={order} />
              </TableCell>
              <TableCell className={cn(TABLE_CELL, "w-px whitespace-nowrap")}>
                <ContinueDrafting order={order} />
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}

/** Where the order comes from: the hearing it was taken at, and what that was for. */
export function DrawnUpAt({ order }: { order: HearingOrder }) {
  return (
    <span className="flex flex-col">
      <span>Hearing</span>
      <span className="text-muted-foreground">
        {courtHearingPurposeLabel(order.hearing.purpose)}
      </span>
    </span>
  );
}

/** The order items pulled into it, or that it is the typed words alone. */
export function InThisOrder({ order }: { order: HearingOrder }) {
  return order.items.length ? (
    <span>{order.items.join(", ")}</span>
  ) : (
    <span className="text-muted-foreground">Typed text only</span>
  );
}

/** What its words still leave open — said in words, the gaps named on hover. */
export function StillToFill({ order }: { order: HearingOrder }) {
  const count = order.gaps.length;
  return count ? (
    <span className="text-warning-ink tabular-nums" title={order.gaps.join("\n")}>
      {count} to fill
    </span>
  ) : (
    <span className="text-muted-foreground">Nothing left</span>
  );
}

/** The row's one act, named. It is also the row's opener for a pointer anywhere on it. */
export function ContinueDrafting({
  order,
  className,
}: {
  order: HearingOrder;
  className?: string;
}) {
  return (
    <Button asChild variant="outline" size="sm" className={cn("text-body-compact", className)}>
      <Link href={draftOrderHref(order.hearing)} {...rowOpener}>
        Continue drafting
        <span className="sr-only"> the order in {causeTitle(order.hearing)}</span>
      </Link>
    </Button>
  );
}
