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
import { useCourtText } from "@/components/court/court-provider";
import { CounselCell } from "@/components/employee/counsel-cell";
import { QueueItemRow } from "@/components/employee/queue-item-row";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { draftOrderHref } from "@/lib/employee/draft-orders";
import {
  hearingOrderStatusLabel,
  hearingOrderStatusVariant,
  type HearingOrder,
} from "@/lib/employee/hearing-orders";
import {
  causeTitle,
  counselFor,
  courtHearingPurposeLabel,
  formatListingDate,
} from "@/lib/employee/hearings";
import { rowActivation, rowOpener } from "@/lib/employee/row-activation";
import { cn } from "@/lib/utils";

const COLUMNS = 9;

function toFill(count: number): string {
  return `${count} to fill`;
}

/**
 * Today's orders, one row per listing — the Orders view of today's hearings.
 *
 * Columns from the owner's reference (2026-10-12), changed three ways on instruction:
 * Status stays, because the All pill mixes every status in one list; Advocates is added;
 * Purpose replaces Stage. The case number leads the Case cell with the cause under it, as
 * the reference draws it.
 *
 * **Only a Ready to sign order can be selected** — a draft has not been added to the
 * signing list, and a signed order is done. The checkbox feeds the screen's sign bar. A
 * click anywhere else on the row opens the order in the composer, through its Edit
 * control (`row-activation.ts`).
 */
export function HearingOrdersTable({
  rows,
  selectedIds,
  onToggle,
  onToggleAll,
}: {
  rows: HearingOrder[];
  selectedIds: ReadonlySet<string>;
  onToggle: (order: HearingOrder) => void;
  /** Select or clear every Ready to sign row in view — the header checkbox. */
  onToggleAll: (select: boolean) => void;
}) {
  const courtText = useCourtText();
  const signable = rows.filter((order) => order.status === "ready");
  const selectedInView = signable.filter((order) =>
    selectedIds.has(order.hearing.id),
  ).length;
  const allSelected = signable.length > 0 && selectedInView === signable.length;
  const someSelected = selectedInView > 0 && !allSelected;

  return (
    <Table className="w-full border-separate border-spacing-0 text-body-compact">
      <TableHeader>
        <TableRow className={TABLE_HEAD_ROW}>
          <TableHead className={cn(TABLE_HEAD, "w-12")}>
            <Checkbox
              checked={allSelected ? true : someSelected ? "indeterminate" : false}
              disabled={signable.length === 0}
              onCheckedChange={(next) => onToggleAll(next === true)}
              aria-label={
                allSelected
                  ? "Clear the orders ready to sign in this list"
                  : "Select the orders ready to sign in this list"
              }
            />
          </TableHead>
          <TableHead className={cn(TABLE_HEAD, "w-12 whitespace-nowrap")}>
            S. no.
          </TableHead>
          <TableHead className={cn(TABLE_HEAD, "min-w-44 whitespace-normal")}>
            Case
          </TableHead>
          <TableHead className={cn(TABLE_HEAD, "min-w-48 whitespace-nowrap")}>
            Advocates
          </TableHead>
          <TableHead className={cn(TABLE_HEAD, "min-w-32 whitespace-normal")}>
            Purpose
          </TableHead>
          <TableHead className={cn(TABLE_HEAD, "min-w-40 whitespace-nowrap")}>
            In this order
          </TableHead>
          <TableHead className={cn(TABLE_HEAD, "whitespace-nowrap")}>
            Status
          </TableHead>
          <TableHead className={cn(TABLE_HEAD, "whitespace-nowrap")}>
            Next date
          </TableHead>
          <TableHead className={cn(TABLE_HEAD, "whitespace-nowrap")}>
            <span className="sr-only">Action</span>
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody className={tableBodyClass({ selectable: true })}>
        {/* The header well's gap — one inert row, as every table on the plate has. */}
        <tr aria-hidden="true">
          <td colSpan={COLUMNS} className="h-2 p-0" />
        </tr>
        {rows.map((order) => {
          const { hearing } = order;
          const ready = order.status === "ready";
          const selected = selectedIds.has(hearing.id);
          return (
            <TableRow
              key={hearing.id}
              data-state={selected ? "selected" : undefined}
              {...rowActivation(tableRowClass({ selectable: true }))}
            >
              <TableCell className={cn(TABLE_CELL, "w-12 align-top")}>
                {ready ? (
                  <Checkbox
                    checked={selected}
                    onCheckedChange={() => onToggle(order)}
                    aria-label={`Select the order in ${courtText(hearing.caseNumber)}`}
                  />
                ) : null}
              </TableCell>
              <TableCell
                className={cn(
                  TABLE_CELL,
                  "w-12 align-top tabular-nums text-muted-foreground",
                )}
              >
                {hearing.item}
              </TableCell>
              <TableCell className={cn(TABLE_CELL, "min-w-44 align-top whitespace-normal")}>
                <div className="flex min-w-0 flex-col gap-0.5">
                  <span className="font-semibold">
                    <Identifier value={hearing.caseNumber} label="case number" />
                  </span>
                  <span>{causeTitle(hearing)}</span>
                </div>
              </TableCell>
              <TableCell className={cn(TABLE_CELL, "min-w-48 align-top whitespace-nowrap")}>
                <CounselCell
                  complainant={counselFor(hearing, "complainant").map((c) => c.name)}
                  accused={counselFor(hearing, "accused").map((c) => c.name)}
                  dense
                />
              </TableCell>
              <TableCell className={cn(TABLE_CELL, "min-w-32 align-top whitespace-normal")}>
                {courtHearingPurposeLabel(hearing.purpose)}
              </TableCell>
              <TableCell className={cn(TABLE_CELL, "min-w-40 align-top whitespace-normal")}>
                <OrderContents order={order} />
              </TableCell>
              <TableCell className={cn(TABLE_CELL, "align-top whitespace-nowrap")}>
                <OrderStatus order={order} />
              </TableCell>
              <TableCell className={cn(TABLE_CELL, "align-top tabular-nums whitespace-nowrap")}>
                {order.nextDate ? (
                  formatListingDate(order.nextDate)
                ) : (
                  <>
                    <span aria-hidden>—</span>
                    <span className="sr-only">No next date</span>
                  </>
                )}
              </TableCell>
              <TableCell className={cn(TABLE_CELL, "align-top whitespace-nowrap")}>
                <OrderEditLink order={order} />
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}

/**
 * What the order carries: a warning chip for each thing still to fill, then a quiet chip
 * for each template in it. Gaps lead because they are what stands between the order and
 * the signing list. Each chip carries its own words, never colour alone.
 */
function OrderContents({ order }: { order: HearingOrder }) {
  const gaps = order.status === "signed" ? [] : order.gaps;
  if (gaps.length === 0 && order.items.length === 0) {
    return <span className="text-muted-foreground">Nothing added yet</span>;
  }
  return (
    <ul className="flex min-w-0 flex-wrap gap-1.5">
      {gaps.map((gap) => (
        <li key={`gap-${gap}`}>
          <Badge variant="warning" className="h-auto whitespace-normal text-left">
            {gap}
          </Badge>
        </li>
      ))}
      {order.items.map((item, index) => (
        <li key={`item-${index}`}>
          <Badge variant="outline" className="h-auto whitespace-normal text-left">
            {item}
          </Badge>
        </li>
      ))}
    </ul>
  );
}

function OrderStatus({ order }: { order: HearingOrder }) {
  const open = order.status === "signed" ? 0 : order.gaps.length;
  return (
    <div className="flex flex-col items-start gap-1">
      <Badge variant={hearingOrderStatusVariant(order.status)}>
        {hearingOrderStatusLabel(order.status)}
      </Badge>
      {open > 0 ? (
        <span className="text-caption tabular-nums text-muted-foreground">
          {toFill(open)}
        </span>
      ) : null}
    </div>
  );
}

/** The row's opener: the composer that owns the words. A signed order is read, not edited. */
function OrderEditLink({
  order,
  className,
}: {
  order: HearingOrder;
  className?: string;
}) {
  const verb = order.status === "signed" ? "View" : "Edit";
  return (
    <Button asChild variant="outline" className={className}>
      <Link href={draftOrderHref(order.hearing)} {...rowOpener}>
        {verb}
        <span className="sr-only"> the order in {causeTitle(order.hearing)}</span>
      </Link>
    </Button>
  );
}

/**
 * The same rows below `md`, stacked — today's cause list's own phone answer. The
 * checkbox keeps its own column so one tap never means both select and open.
 */
export function HearingOrdersItemList({
  rows,
  selectedIds,
  onToggle,
}: {
  rows: HearingOrder[];
  selectedIds: ReadonlySet<string>;
  onToggle: (order: HearingOrder) => void;
}) {
  const courtText = useCourtText();
  return (
    <ul className="flex flex-col gap-3">
      {rows.map((order) => {
        const { hearing } = order;
        return (
          <QueueItemRow key={hearing.id} className="flex gap-3">
            {order.status === "ready" ? (
              <span className="pt-0.5">
                <Checkbox
                  checked={selectedIds.has(hearing.id)}
                  onCheckedChange={() => onToggle(order)}
                  aria-label={`Select the order in ${courtText(hearing.caseNumber)}`}
                />
              </span>
            ) : (
              <span className="size-4 shrink-0" aria-hidden />
            )}
            <div className="flex min-w-0 flex-1 flex-col gap-2">
              <p className="flex min-w-0 items-baseline gap-1 text-body-compact font-medium">
                <span className="shrink-0 text-muted-foreground tabular-nums">
                  {hearing.item}.
                </span>
                <span className="min-w-0">{causeTitle(hearing)}</span>
              </p>
              <p className="text-caption text-muted-foreground">
                <Identifier value={hearing.caseNumber} label="case number" />
                {" · "}
                {courtHearingPurposeLabel(hearing.purpose)}
                {order.nextDate ? ` · Next ${formatListingDate(order.nextDate)}` : ""}
              </p>
              <OrderStatus order={order} />
              <OrderContents order={order} />
              <CounselCell
                complainant={counselFor(hearing, "complainant").map((c) => c.name)}
                accused={counselFor(hearing, "accused").map((c) => c.name)}
              />
              <OrderEditLink order={order} className="w-full" />
            </div>
          </QueueItemRow>
        );
      })}
    </ul>
  );
}
