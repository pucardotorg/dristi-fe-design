"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FileClockIcon } from "lucide-react";
import { toast } from "sonner";

import { Identifier } from "@/components/chrome/identifier";
import {
  TABLE_CELL,
  TABLE_HEAD,
  TABLE_HEAD_ROW,
  tableBodyClass,
  tableRowClass,
} from "@/components/chrome/table-plate";
import { QueueAnnouncer } from "@/components/employee/queue-announcer";
import { useCourtRole } from "@/components/employee/use-court-role";
import { useOrderSigning } from "@/components/employee/use-order-signing";
import { usePendingOrders } from "@/components/employee/use-pending-orders";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { CourtRole } from "@/lib/employee/content";
import { markOrdersSigned } from "@/lib/employee/order-signing";
import {
  PENDING_ORDER_STAGES,
  pendingOrderHref,
  pendingOrderStage,
  type PendingOrder,
  type PendingOrderStage,
} from "@/lib/employee/pending-orders";
import {
  rowActivation,
  rowOpener,
  rowOpenerClass,
} from "@/lib/employee/row-activation";
import { cn } from "@/lib/utils";

type Tab = PendingOrderStage | "all";

/** Where each seat opens: on its own move (owner, 2026-10-14). */
function openingTab(seat: CourtRole): Tab {
  if (seat === "magistrate") return "awaiting-signature";
  if (seat === "typist") return "workflow-to-fill";
  return "all";
}

type Row = PendingOrder & { stage: PendingOrderStage };

/**
 * Pending orders — one list for the magistrate and the steno (owner, 2026-10-14), in
 * place of the Orders toggle on Today's hearings and the steno's separate workflow queue.
 *
 * Every order typed on the full-page editor, a hearing's or not, with where it stands in
 * the same two columns for everyone — its **signature** and its **workflows** — so each
 * seat sees the other's step. The tabs are the four stages; each seat opens on the one
 * that is its move: the magistrate on Awaiting signature, the steno on Workflow to fill.
 *
 * The magistrate signs here, one order or a selection. The steno opens an order to fill
 * its workflow and trigger it. A draft opens back on the order screen.
 */
export function PendingOrdersScreen() {
  const router = useRouter();
  const seat = useCourtRole();
  const pending = usePendingOrders();
  const signing = useOrderSigning();
  const [tab, setTab] = React.useState<Tab>(() => openingTab(seat));
  const [selected, setSelected] = React.useState<ReadonlySet<string>>(
    () => new Set(),
  );
  const [askSign, setAskSign] = React.useState(false);

  const all: Row[] = Object.values(pending).map((order) => ({
    ...order,
    stage: pendingOrderStage(order, signing),
  }));
  const rows = tab === "all" ? all : all.filter((row) => row.stage === tab);
  const count = (stage: PendingOrderStage) =>
    all.filter((row) => row.stage === stage).length;
  const signer = seat === "magistrate";
  const signable = rows.filter((row) => row.stage === "awaiting-signature");
  const chosen = signable.filter((row) => selected.has(row.key));

  function open(row: Row) {
    if (row.stage === "drafting") {
      /* A draft goes back to the editor it was typed on — the Pending orders flow's only
         order screen. */
      router.push(row.orderHref);
      return;
    }
    router.push(pendingOrderHref(row.key));
  }

  function toggle(key: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  return (
    <div className="flex min-w-0 flex-1 flex-col gap-8 p-6 md:p-8">
      <header className="flex flex-col gap-2">
        <h1 className="text-title text-balance font-semibold">
          Pending orders
        </h1>
        <p className="text-body text-muted-foreground">
          {headline(seat, count)}
        </p>
      </header>

      <section className="flex min-w-0 flex-col gap-6 rounded-xl border border-hairline bg-card p-6 shadow-raised">
        <Tabs
          value={tab}
          onValueChange={(value) => {
            setTab(value as Tab);
            setSelected(new Set());
          }}
          className="flex min-w-0 flex-col gap-6"
        >
          <div className="overflow-x-auto border-b border-hairline">
            <TabsList
              variant="line"
              aria-label="Which orders to show"
              className="h-10 w-max min-w-full justify-start rounded-none p-0 group-data-horizontal/tabs:h-10"
            >
              {[
                ...PENDING_ORDER_STAGES.map(
                  (stage) => [stage.id, stage.label, count(stage.id)] as const,
                ),
                ["all", "All", all.length] as const,
              ].map(([value, label, total]) => (
                <TabsTrigger
                  key={value}
                  value={value}
                  className="h-10 flex-none gap-2 px-3 text-body-compact group-data-horizontal/tabs:after:-bottom-px"
                >
                  {label}
                  <span className="font-normal tabular-nums">{total}</span>
                </TabsTrigger>
              ))}
            </TabsList>
          </div>
        </Tabs>

        <QueueAnnouncer from={1} to={rows.length} total={rows.length} />
        {rows.length === 0 ? (
          <PendingEmpty tab={tab} />
        ) : (
          <div className="min-w-0 overflow-x-auto">
            <Table className="w-full border-separate border-spacing-0 text-body-compact">
              <TableHeader>
                <TableRow className={TABLE_HEAD_ROW}>
                  {signer ? (
                    <TableHead className={cn(TABLE_HEAD, "w-px")}>
                      <Checkbox
                        aria-label="Select the orders awaiting your signature in this list"
                        disabled={signable.length === 0}
                        checked={
                          signable.length > 0 &&
                          chosen.length === signable.length
                        }
                        onCheckedChange={(checked) =>
                          setSelected(
                            checked
                              ? new Set(signable.map((row) => row.key))
                              : new Set(),
                          )
                        }
                      />
                    </TableHead>
                  ) : null}
                  <TableHead
                    className={cn(TABLE_HEAD, "min-w-48 whitespace-normal")}
                  >
                    Case name
                  </TableHead>
                  <TableHead className={cn(TABLE_HEAD, "whitespace-nowrap")}>
                    Case number
                  </TableHead>
                  <TableHead
                    className={cn(TABLE_HEAD, "min-w-40 whitespace-normal")}
                  >
                    From
                  </TableHead>
                  <TableHead className={cn(TABLE_HEAD, "whitespace-nowrap")}>
                    Signature
                  </TableHead>
                  <TableHead className={cn(TABLE_HEAD, "whitespace-nowrap")}>
                    Order data
                  </TableHead>
                  <TableHead className={cn(TABLE_HEAD, "w-px whitespace-nowrap")}>
                    <span className="sr-only">Action</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody className={tableBodyClass({ selectable: signer })}>
                <tr aria-hidden="true">
                  <td colSpan={signer ? 7 : 6} className="h-2 p-0" />
                </tr>
                {rows.map((row) => (
                  <TableRow
                    key={row.key}
                    {...rowActivation(tableRowClass({ selectable: signer }))}
                  >
                    {signer ? (
                      <TableCell className={cn(TABLE_CELL, "w-px")}>
                        {row.stage === "awaiting-signature" ? (
                          <Checkbox
                            aria-label={`Select ${row.heading}`}
                            checked={selected.has(row.key)}
                            onCheckedChange={() => toggle(row.key)}
                          />
                        ) : null}
                      </TableCell>
                    ) : null}
                    <TableCell
                      className={cn(TABLE_CELL, "min-w-48 whitespace-normal")}
                    >
                      <button
                        type="button"
                        {...rowOpener}
                        className={rowOpenerClass}
                        onClick={() => open(row)}
                      >
                        {row.heading}
                      </button>
                    </TableCell>
                    <TableCell className={cn(TABLE_CELL, "whitespace-nowrap")}>
                      <Identifier value={row.caseNumber} label="case number" />
                    </TableCell>
                    <TableCell
                      className={cn(TABLE_CELL, "min-w-40 whitespace-normal")}
                    >
                      {row.origin}
                    </TableCell>
                    <TableCell className={cn(TABLE_CELL, "whitespace-nowrap")}>
                      <SignatureBadge stage={row.stage} />
                    </TableCell>
                    <TableCell className={cn(TABLE_CELL, "whitespace-nowrap")}>
                      <Badge
                        variant={
                          row.stage === "triggered"
                            ? "success"
                            : row.workflowComplete
                              ? "info"
                              : "secondary"
                        }
                      >
                        {row.stage === "triggered"
                          ? "Triggered"
                          : row.workflowComplete
                            ? "Complete"
                            : "To fill"}
                      </Badge>
                    </TableCell>
                    <TableCell
                      className={cn(TABLE_CELL, "w-px whitespace-nowrap")}
                    >
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        tabIndex={-1}
                        aria-hidden
                        onClick={() => open(row)}
                      >
                        {actionLabel(seat, row.stage)}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        {signer && signable.length > 0 ? (
          <div className="flex flex-col gap-3 border-t border-hairline pt-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-body-compact text-muted-foreground">
              {chosen.length
                ? `${chosen.length} selected.`
                : "Select the orders to sign, or open one to read it first."}
            </p>
            <Button
              type="button"
              disabled={chosen.length === 0}
              onClick={() => setAskSign(true)}
            >
              {chosen.length === 1
                ? "Sign 1 order"
                : `Sign ${chosen.length || ""} orders`.replace("  ", " ")}
            </Button>
          </div>
        ) : null}
      </section>

      <AlertDialog open={askSign} onOpenChange={setAskSign}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {chosen.length === 1
                ? "Sign this order?"
                : `Sign ${chosen.length} orders?`}
            </AlertDialogTitle>
            <AlertDialogDescription>
              Your signature issues{" "}
              {chosen.length === 1 ? "the order" : "each order"}. Its order
              data is triggered once it is complete — at once, for any the
              steno has already completed.
              This cannot be reversed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Back</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                markOrdersSigned(chosen.map((row) => row.key));
                setSelected(new Set());
                toast(
                  chosen.length === 1
                    ? "Signed and issued."
                    : `${chosen.length} orders signed and issued.`,
                );
              }}
            >
              Sign
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function headline(
  seat: CourtRole,
  count: (stage: PendingOrderStage) => number,
): string {
  const plural = (n: number, one: string, many: string) =>
    `${n} ${n === 1 ? one : many}`;
  if (seat === "magistrate")
    return `${plural(count("awaiting-signature"), "order is", "orders are")} awaiting your signature.`;
  if (seat === "typist")
    return `${plural(count("workflow-to-fill"), "signed order has its", "signed orders have their")} order data still to complete.`;
  return "Orders being typed, awaiting a signature, or with order data still to trigger.";
}

function SignatureBadge({ stage }: { stage: PendingOrderStage }) {
  if (stage === "drafting") return <Badge variant="secondary">Not sent</Badge>;
  if (stage === "awaiting-signature")
    return <Badge variant="warning">Awaiting</Badge>;
  return <Badge variant="success">Signed</Badge>;
}

/** The row's one act, for this seat at this stage. */
function actionLabel(seat: CourtRole, stage: PendingOrderStage): string {
  if (stage === "drafting") return "Continue typing";
  if (stage === "awaiting-signature")
    return seat === "magistrate"
      ? "Read and sign"
      : seat === "typist"
        ? "Open order data"
        : "View";
  if (stage === "workflow-to-fill")
    return seat === "typist" ? "Fill order data" : "View";
  return "View";
}

function PendingEmpty({ tab }: { tab: Tab }) {
  return (
    <Empty className="border-0 p-0">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <FileClockIcon aria-hidden />
        </EmptyMedia>
        <EmptyTitle className="text-title-s font-semibold">
          {tab === "awaiting-signature"
            ? "Nothing is awaiting a signature"
            : tab === "workflow-to-fill"
              ? "No order data to fill"
              : tab === "triggered"
                ? "No order data triggered yet"
                : "No orders pending"}
        </EmptyTitle>
        <EmptyDescription className="text-body">
          Orders typed on the full-page editor appear here as soon as they are
          started, and stay until their order data is triggered.
        </EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <Button asChild variant="outline">
          <Link href="/employee/hearings">Go to today&apos;s hearings</Link>
        </Button>
      </EmptyContent>
    </Empty>
  );
}
