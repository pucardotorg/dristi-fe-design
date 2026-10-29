"use client";

import { useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { FileSearchIcon } from "lucide-react";

import { RestingCard } from "@/components/cases/case-overview-card";
import {
  RECENT_ROW,
  RowViewButton,
  useRecentRow,
} from "@/components/cases/register-controls";
import { OrderRecordDialog } from "@/components/cases/order-record-dialog";
import {
  TABLE_CELL,
  TABLE_HEAD,
  TABLE_HEAD_ROW,
  tableBodyClass,
  tableRowClass,
} from "@/components/chrome/table-plate";
import { Button } from "@/components/ui/button";
import { CardContent } from "@/components/ui/card";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import {
  SegmentedControl,
  SegmentedControlItem,
} from "@/components/ui/segmented-control";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  ORDER_KIND_DEFAULT,
  ORDER_KIND_FILTERS,
  isOrderKindFilter,
  ordersFile,
  type OrderKindFilter,
  type OrderRecord,
} from "@/lib/cases/orders";
import { formatCaseDate, type CaseRecord } from "@/lib/cases/types";
import { cn } from "@/lib/utils";
import { RegisterTrayCard, useOneOpen } from "@/components/cases/register-card";
import {
  REGISTER_CARDS_ONLY,
  REGISTER_SWITCH,
  REGISTER_TABLE_ONLY,
} from "@/components/cases/register-layout";
import { StatusLine } from "@/components/feedback";

const ORDER_PARAM = "order";

/**
 * Orders & Notifications (§8). A party sees published orders only (ORD-04);
 * the draft and pending-signature states belong to court staff and are not
 * designed in this pass. The open order lives in `?order=`, so a hearing or a
 * case update can link straight to it.
 */
export function CaseOrders({ record }: { record: CaseRecord }) {
  const orders = useMemo(() => {
    try {
      return ordersFile(record)
        .orders.filter((order) => order.status === "published")
        .sort((a, b) => {
          const byDate = b.issuedOn.localeCompare(a.issuedOn);
          return byDate !== 0 ? byDate : b.id.localeCompare(a.id);
        });
    } catch {
      return null;
    }
  }, [record]);

  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [kind, setKind] = useState<OrderKindFilter>(ORDER_KIND_DEFAULT);
  const tray = useOneOpen<string>();
  const { recentId, markRecent, recentRowRef } = useRecentRow();
  /* The mark is for a reader a link dropped here (a round's triggering order,
     a hearing's order): it shows where that order sits in the list. A row the
     reader opened themselves needs no pointing back to (owner, Sept 18). */
  const openedHere = useRef(false);

  if (!orders) {
    return (
      <OrdersPanel>
        <StatusLine tone="error" still title="Orders and notifications could not be loaded">
          Refresh the page to try again.
        </StatusLine>
      </OrdersPanel>
    );
  }

  const openOrder =
    orders.find((order) => order.id === searchParams.get(ORDER_PARAM)) ?? null;
  const rows = orders.filter((order) => order.kind === kind);

  function setOpenOrder(order: OrderRecord | null) {
    const next = new URLSearchParams(searchParams);
    if (order) {
      openedHere.current = true;
      next.set(ORDER_PARAM, order.id);
    } else next.delete(ORDER_PARAM);
    router.replace(`${pathname}?${next.toString()}`, { scroll: false });
  }

  return (
    <OrdersPanel
      action={
        <SegmentedControl
          type="single"
          size="compact"
          className={REGISTER_SWITCH}
          value={kind}
          onValueChange={(next) => {
            if (isOrderKindFilter(next)) setKind(next);
          }}
          aria-label="Show orders or notifications"
        >
          {ORDER_KIND_FILTERS.map((item) => (
            <SegmentedControlItem key={item.id} value={item.id}>
              {item.label}
            </SegmentedControlItem>
          ))}
        </SegmentedControl>
      }
    >
      {rows.length === 0 ? (
        <Empty className="border border-dashed border-border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <FileSearchIcon aria-hidden />
            </EmptyMedia>
            <EmptyTitle className="text-body font-semibold">
              {kind === "notification"
                ? "No notifications yet"
                : "No orders yet"}
            </EmptyTitle>
            <EmptyDescription>
              {kind === "notification"
                ? "Notices from the court about listings appear here."
                : "Orders appear here once the court publishes them."}
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <>
        {/* Under a finger held upright: a card per order. Date and title lead,
            the business of the day follows in full rather than cut at two
            lines, and the card itself opens the order. */}
        <ul className={cn("flex flex-col gap-3", REGISTER_CARDS_ONLY)}>
          {rows.map((order) => (
            <li key={order.id}>
              <RegisterTrayCard
                title={order.title}
                open={tray.isOpen(order.id)}
                onOpenChange={tray.toggle(order.id)}
                marked={openOrder?.id === order.id}
                className={cn(recentId === order.id && RECENT_ROW)}
                actions={
                  <Button type="button" onClick={() => setOpenOrder(order)}>
                    View order
                  </Button>
                }
              >
                <time
                  dateTime={order.issuedOn}
                  className="-mt-2 text-caption tabular-nums text-muted-foreground"
                >
                  {formatCaseDate(order.issuedOn)}
                </time>
                {order.botd ? (
                  <p className="border-t border-hairline pt-3 text-body-compact text-muted-foreground">
                    {order.botd}
                  </p>
                ) : null}
              </RegisterTrayCard>
            </li>
          ))}
        </ul>
        <div className={REGISTER_TABLE_ONLY}>
        <Table>
          <TableHeader>
            <TableRow className={TABLE_HEAD_ROW}>
              <TableHead className={cn(TABLE_HEAD, "w-36")}>Date</TableHead>
              <TableHead className={cn(TABLE_HEAD, "w-1/3")}>Title</TableHead>
              <TableHead className={TABLE_HEAD}>BoTD</TableHead>
              <TableHead className={cn(TABLE_HEAD, "w-24")}>Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody className={tableBodyClass({ marksOpenRow: true })}>
            {rows.map((order) => (
              <TableRow
                key={order.id}
                ref={recentId === order.id ? recentRowRef : undefined}
                aria-current={openOrder?.id === order.id ? "true" : undefined}
                className={cn(
                  tableRowClass({ open: openOrder?.id === order.id }),
                  "cursor-pointer",
                  recentId === order.id && RECENT_ROW
                )}
                onClick={() => setOpenOrder(order)}
              >
                <TableCell
                  className={cn(TABLE_CELL, "tabular-nums")}
                >
                  <time dateTime={order.issuedOn}>
                    {formatCaseDate(order.issuedOn)}
                  </time>
                </TableCell>
                <TableCell
                  className={cn(
                    TABLE_CELL,
                    "font-medium whitespace-normal"
                  )}
                >
                  {order.title}
                </TableCell>
                <TableCell
                  className={cn(
                    TABLE_CELL,
                    "whitespace-normal text-muted-foreground"
                  )}
                >
                  {order.botd ? (
                    <span className="line-clamp-2">{order.botd}</span>
                  ) : (
                    <>
                      <span aria-hidden>—</span>
                      <span className="sr-only">Not recorded</span>
                    </>
                  )}
                </TableCell>
                <TableCell className={TABLE_CELL}>
                  <RowViewButton
                    label={order.title}
                    onClick={() => setOpenOrder(order)}
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        </div>
        </>
      )}

      <OrderRecordDialog
        order={openOrder}
        onOpenChange={(open) => {
          if (open) return;
          if (openOrder && !openedHere.current) markRecent(openOrder.id);
          openedHere.current = false;
          setOpenOrder(null);
        }}
      />
    </OrdersPanel>
  );
}

export function OrdersLoading() {
  return (
    <OrdersPanel busy>
      <span className="sr-only" role="status">
        Loading orders and notifications
      </span>
      <div className="flex flex-col gap-2">
        {Array.from({ length: 5 }, (_, index) => (
          <Skeleton key={index} className="h-10 w-full rounded-lg" />
        ))}
      </div>
    </OrdersPanel>
  );
}

function OrdersPanel({
  action,
  busy,
  children,
}: {
  action?: React.ReactNode;
  busy?: boolean;
  children: React.ReactNode;
}) {
  return (
    <RestingCard>
      <CardContent className="flex flex-col gap-4" aria-busy={busy}>
        <div className="flex min-w-0 flex-wrap items-center justify-between gap-x-4 gap-y-3">
          <h2 className="w-full text-body font-semibold text-foreground md:pointer-fine:w-auto md:landscape:w-auto">
            Orders & Notifications
          </h2>
          {action}
        </div>
        {children}
      </CardContent>
    </RestingCard>
  );
}
