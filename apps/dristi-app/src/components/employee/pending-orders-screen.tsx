"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FileClockIcon, PenLineIcon } from "lucide-react";

import { Identifier } from "@/components/chrome/identifier";
import {
  TABLE_CELL,
  TABLE_HEAD,
  TABLE_HEAD_ROW,
  tableBodyClass,
  tableRowClass,
} from "@/components/chrome/table-plate";
import { QueueAnnouncer } from "@/components/employee/queue-announcer";
import { useCourt } from "@/components/court/court-provider";
import { useCourtRole } from "@/components/employee/use-court-role";
import { AddOrderItemsDialog } from "@/components/employee/pending-orders-bulk";
import { useOrderDrafts } from "@/components/employee/use-order-draft";
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
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import type { CourtId } from "@/lib/court/profiles";
import type { CourtRole } from "@/lib/employee/content";
import { seatHolds } from "@/lib/employee/seat-roles";
import { orderTextPreview } from "@/lib/employee/order-bulk-items";
import { editorDraftKey, updateOrderDraft } from "@/lib/employee/order-drafts";
import { markOrdersSigned } from "@/lib/employee/order-signing";
import type { OrderType } from "@/lib/employee/order-draft";
import {
  companionKey,
  companionSignedEach,
  companionText,
  orderTypeLabel,
  orderTypeOf,
} from "@/lib/employee/order-type";
import {
  PENDING_ORDER_STAGES,
  pendingOrderHref,
  inPendingStage,
  pendingOrderStageFor,
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
import { ConfirmMark, IrreversibleNote, notify } from "@/components/feedback";

type Tab = PendingOrderStage | "all";

/** Where each seat opens: on its own move (`PND-04`), from its state's roles. */
function openingTab(seat: CourtRole, court: CourtId): Tab {
  return pendingOrderStageFor(seat, court) ?? "all";
}

type Row = PendingOrder & {
  stage: PendingOrderStage;
  type: OrderType;
  /** What the Type column says: "Order", "Roznama", "Zimni". */
  typeLabel: string;
  /**
   * A regular order's companion document, signed on its own (Gujarat's Roznama): the key
   * of the order it belongs to. Its own key is `companionKey(order)`. It has no order
   * data and no workflows; it is listed once its order's data is marked complete.
   */
  companionOf?: string;
};

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
export function PendingOrdersScreen({
  initialTab,
}: {
  /** `?tab=` — the editor's Sent for signing returns to Drafting, not the seat's move. */
  initialTab?: PendingOrderStage;
} = {}) {
  const router = useRouter();
  const seat = useCourtRole();
  const { court, profile } = useCourt();
  const rules = profile.orderTypes;
  /* The Type column, where the state has more than one type of order. */
  const showType = Boolean(rules.alternative);
  const pending = usePendingOrders();
  const signing = useOrderSigning();
  const move = pendingOrderStageFor(seat, court);
  const [tab, setTab] = React.useState<Tab>(
    () => initialTab ?? openingTab(seat, court),
  );
  const [selected, setSelected] = React.useState<ReadonlySet<string>>(
    () => new Set(),
  );
  const [askSign, setAskSign] = React.useState(false);
  const [askItems, setAskItems] = React.useState(false);
  const [itemsOpening, setItemsOpening] = React.useState(0);
  const [notice, setNotice] = React.useState("");
  const drafts = useOrderDrafts();
  const [reading, setReading] = React.useState<Row | null>(null);

  const orderRows: Row[] = Object.values(pending).map((order) => {
    const type = orderTypeOf(drafts[editorDraftKey(order.key)], order.key, rules);
    return {
      ...order,
      stage: pendingOrderStage(order, signing),
      type,
      typeLabel: orderTypeLabel(type, rules),
    };
  });
  /* Gujarat: a regular order's Roznama, to be signed on its own once the order is
     triggered — signed and its order data complete (order-types `RZN-01`). Listed after
     the orders. */
  const companionRows: Row[] = orderRows
    .filter(
      (row) =>
        row.stage === "triggered" && companionSignedEach(row.type, rules),
    )
    .map((row) => ({
      ...row,
      key: companionKey(row.key),
      companionOf: row.key,
      typeLabel: rules.companion?.label ?? "Roznama",
      stage:
        signing[companionKey(row.key)] === "signed"
          ? "triggered"
          : "awaiting-signature",
    }));
  const all: Row[] = [...orderRows, ...companionRows];
  /* A sent order sits in Awaiting signature and Order data to fill at once (`PND-02`).
     A companion document is only ever awaiting a signature, or done. */
  const inTab = (row: Row, stage: Tab) => {
    if (stage === "all") return true;
    if (row.companionOf)
      return stage === "awaiting-signature" && row.stage === "awaiting-signature";
    return inPendingStage(row, signing, stage);
  };
  const rows = all.filter((row) => inTab(row, tab));
  const count = (stage: PendingOrderStage) =>
    all.filter((row) => inTab(row, stage)).length;
  /* Who can pick rows, and which: the magistrate the orders awaiting a signature, to sign
     them; the steno every order with order data to fill, signed or not, to add items to
     them in bulk (`ITM-10`, `PND-07`) — the two are worked in parallel (`SND-07`; owner,
     2026-10-21). A row is pickable by the same test as its tab, `inPendingStage`. */
  const signer = seatHolds(seat, court, "order-signer");
  const filler = seatHolds(seat, court, "order-data-filler");
  const pickStage: PendingOrderStage | null = signer
    ? "awaiting-signature"
    : filler
      ? "workflow-to-fill"
      : null;
  const picking = pickStage !== null;
  /* A companion document is picked only to sign it. */
  const pickable = (row: Row) =>
    pickStage !== null &&
    (row.companionOf
      ? signer && row.stage === "awaiting-signature"
      : inPendingStage(row, signing, pickStage));
  const signable = rows.filter(pickable);
  const chosen = signable.filter((row) => selected.has(row.key));
  /* The order's first words, on the tab where the steno works through them. */
  const showText = tab === "workflow-to-fill";
  const columns = 5 + (picking ? 1 : 0) + (showText ? 1 : 0) + (showType ? 1 : 0);
  const awaitingCompanions = companionRows.filter(
    (row) => row.stage === "awaiting-signature",
  ).length;
  const chosenCompanions = chosen.filter((row) => row.companionOf).length;
  const chosenOrders = chosen.length - chosenCompanions;
  const companionName = rules.companion?.label ?? "Roznama";
  const chosenWhat = [
    chosenOrders ? `${chosenOrders} ${chosenOrders === 1 ? "order" : "orders"}` : "",
    chosenCompanions
      ? `${chosenCompanions} ${chosenCompanions === 1 ? companionName : `${companionName}s`}`
      : "",
  ]
    .filter(Boolean)
    .join(" and ");

  function open(row: Row) {
    if (row.companionOf) {
      setReading(row);
      return;
    }
    if (row.stage === "drafting") {
      /* A draft goes back to the editor it was typed on — the Pending orders flow's only
         order screen. */
      router.push(row.orderHref);
      return;
    }
    router.push(pendingOrderHref(row.key));
  }

  function toggle(key: string) {
    setNotice("");
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
          {move === "awaiting-signature" && awaitingCompanions > 0
            ? `${count("awaiting-signature") - awaitingCompanions} orders and ${awaitingCompanions} ${companionName}${awaitingCompanions === 1 ? " are" : "s are"} awaiting your signature.`
            : headline(move, count)}
        </p>
      </header>

      <section className="flex min-w-0 flex-col gap-6 rounded-xl border border-hairline bg-card p-6 shadow-raised">
        <Tabs
          value={tab}
          onValueChange={(value) => {
            setTab(value as Tab);
            setSelected(new Set());
            setNotice("");
          }}
          className="flex min-w-0 flex-col gap-6"
        >
          <div className="overflow-x-auto border-b border-hairline">
            <TabsList
              variant="line"
              aria-label="Which orders to show"
              className="h-10 w-max min-w-full justify-start rounded-none"
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
                  className="h-10 flex-none gap-2 text-body-compact"
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
                  {picking ? (
                    <TableHead className={cn(TABLE_HEAD, "w-px")}>
                      <Checkbox
                        aria-label={
                          signer
                            ? "Select the orders awaiting your signature in this list"
                            : "Select the orders with order data to fill in this list"
                        }
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
                    Title
                  </TableHead>
                  {showType ? (
                    <TableHead className={cn(TABLE_HEAD, "whitespace-nowrap")}>
                      Type
                    </TableHead>
                  ) : null}
                  {showText ? (
                    <TableHead
                      className={cn(TABLE_HEAD, "min-w-56 whitespace-normal")}
                    >
                      Order
                    </TableHead>
                  ) : null}
                  <TableHead className={cn(TABLE_HEAD, "whitespace-nowrap")}>
                    Status
                  </TableHead>
                  <TableHead className={cn(TABLE_HEAD, "w-px whitespace-nowrap")}>
                    <span className="sr-only">Action</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody className={tableBodyClass({ selectable: picking })}>
                <tr aria-hidden="true">
                  <td colSpan={columns} className="h-2 p-0" />
                </tr>
                {rows.map((row) => (
                  <TableRow
                    key={row.key}
                    data-state={selected.has(row.key) ? "selected" : undefined}
                    {...rowActivation(tableRowClass({ selectable: picking }))}
                  >
                    {picking ? (
                      <TableCell className={cn(TABLE_CELL, "w-px")}>
                        {pickable(row) ? (
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
                      {/* The order's title (`PND-03`, `TIT-06`) — where it came from is no
                          longer shown. */}
                      {row.title ?? "Order"}
                    </TableCell>
                    {showType ? (
                      <TableCell className={cn(TABLE_CELL, "whitespace-nowrap")}>
                        {row.typeLabel}
                      </TableCell>
                    ) : null}
                    {showText ? (
                      <TableCell
                        className={cn(
                          TABLE_CELL,
                          "min-w-56 whitespace-normal text-muted-foreground",
                        )}
                      >
                        {orderTextPreview(
                          drafts[editorDraftKey(row.key)]?.body?.text ?? "",
                        ) || "No text yet"}
                      </TableCell>
                    ) : null}
                    {/* Signature and order data, two pills side by side in one column
                        (owner, 2026-10-15). Each pill says which it is. */}
                    <TableCell className={cn(TABLE_CELL, "whitespace-nowrap")}>
                      <div className="flex items-center gap-1.5">
                      <SignatureBadge stage={row.stage} />
                      {row.companionOf ? null : (
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
                          ? "Data triggered"
                          : row.workflowComplete
                            ? "Data complete"
                            : "Data to fill"}
                      </Badge>
                      )}
                      </div>
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
                        {row.companionOf
                          ? signer && row.stage === "awaiting-signature"
                            ? "Read and sign"
                            : "View"
                          : actionLabel(move, tab, row.stage)}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        {filler && (signable.length > 0 || notice) ? (
          <div className="flex flex-col gap-3 border-t border-hairline pt-4 sm:flex-row sm:items-center sm:justify-between">
            <p
              className="text-body-compact text-muted-foreground"
              aria-live="polite"
            >
              {notice ||
                (chosen.length
                  ? `${chosen.length} selected.`
                  : "Select orders to add the same items to their order data.")}
            </p>
            <Button
              type="button"
              disabled={chosen.length === 0}
              onClick={() => {
                setItemsOpening((count) => count + 1);
                setAskItems(true);
              }}
            >
              Add order items
            </Button>
          </div>
        ) : null}

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
              {chosen.length === 0
                ? "Sign"
                : `Sign ${chosenWhat}`}
            </Button>
          </div>
        ) : null}
      </section>

      <AddOrderItemsDialog
        key={itemsOpening}
        open={askItems}
        orders={chosen}
        onOpenChange={setAskItems}
        onDone={(message) => {
          setAskItems(false);
          setSelected(new Set());
          setNotice(message);
        }}
      />

      <Dialog
        open={reading !== null}
        onOpenChange={(open) => {
          if (!open) setReading(null);
        }}
      >
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {companionName} · {reading?.heading}
            </DialogTitle>
            <DialogDescription>
              {reading?.caseNumber} · from its order
              {reading?.title ? ` “${reading.title}”` : ""}, signed and triggered.
              Signing it doesn't trigger workflows.
            </DialogDescription>
          </DialogHeader>
          {/* Editable until it is signed, by the order data filler or the order signer
              (order-types `RZN-04`). An edit makes it its own text. */}
          {reading?.stage === "awaiting-signature" && (signer || filler) ? (
            <Textarea
              aria-label={companionName}
              rows={8}
              value={companionText(drafts[editorDraftKey(reading.companionOf ?? "")])}
              onChange={(event) => {
                const aDiaryText = event.target.value;
                if (!reading.companionOf) return;
                updateOrderDraft(editorDraftKey(reading.companionOf), (current) => ({
                  ...current,
                  aDiarySame: false,
                  aDiaryText,
                }));
              }}
            />
          ) : (
            <div className="max-h-[50vh] overflow-y-auto whitespace-pre-wrap rounded-lg border border-hairline bg-muted p-4 text-body">
              {companionText(
                reading?.companionOf
                  ? drafts[editorDraftKey(reading.companionOf)]
                  : undefined,
              ) || "No text."}
            </div>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setReading(null)}>
              Close
            </Button>
            {signer && reading?.stage === "awaiting-signature" ? (
              <Button
                type="button"
                onClick={() => {
                  if (!reading) return;
                  markOrdersSigned([reading.key]);
                  setReading(null);
                  notify.success(`${companionName} signed.`);
                }}
              >
                Sign {companionName}
              </Button>
            ) : null}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={askSign} onOpenChange={setAskSign}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <ConfirmMark icon={PenLineIcon} />
            <AlertDialogTitle>
              {chosen.length === 1
                ? chosenCompanions
                  ? `Sign this ${companionName}?`
                  : "Sign this order?"
                : `Sign ${chosenWhat}?`}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {chosenOrders ? (
                <span className="block">
                  Your signature issues{" "}
                  {chosenOrders === 1 ? "the order" : "each order"}. Its order
                  data is triggered once it is complete — at once, for any the
                  steno has already completed.
                </span>
              ) : null}
              {chosenCompanions ? (
                <span className="block">
                  Each {companionName} is signed on its own, and joins the case
                  record.
                </span>
              ) : null}
              <IrreversibleNote>This cannot be reversed.</IrreversibleNote>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Back</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                markOrdersSigned(chosen.map((row) => row.key));
                setSelected(new Set());
                notify.success(`Signed: ${chosenWhat}.`);
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
  move: PendingOrderStage | null,
  count: (stage: PendingOrderStage) => number,
): string {
  const plural = (n: number, one: string, many: string) =>
    `${n} ${n === 1 ? one : many}`;
  if (move === "awaiting-signature")
    return `${plural(count("awaiting-signature"), "order is", "orders are")} awaiting your signature.`;
  if (move === "workflow-to-fill")
    return `${plural(count("workflow-to-fill"), "order has its", "orders have their")} order data still to complete.`;
  return "Orders being typed, awaiting a signature, or with order data still to trigger.";
}

function SignatureBadge({ stage }: { stage: PendingOrderStage }) {
  if (stage === "drafting") return <Badge variant="secondary">Not sent</Badge>;
  if (stage === "awaiting-signature")
    return <Badge variant="warning">Awaiting signature</Badge>;
  return <Badge variant="success">Signed</Badge>;
}

/**
 * The row's one act, for this person's move on the tab they are on (`PND-05`). An order
 * awaiting signature is signed by an order signer and filled by an order data filler —
 * the same row offers each their own act.
 */
function actionLabel(
  move: PendingOrderStage | null,
  tab: Tab,
  stage: PendingOrderStage,
): string {
  if (stage === "drafting") return "Continue typing";
  if (stage === "triggered") return "View";
  if (move === "awaiting-signature" && stage === "awaiting-signature" && tab !== "workflow-to-fill")
    return "Read and sign";
  if (move === "workflow-to-fill") return "Fill order data";
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
