"use client";

import * as React from "react";
import { useSearchParams } from "next/navigation";
import {
  ChevronRightIcon,
  FlagIcon,
} from "lucide-react";

import { money } from "@/lib/filing/format";
import { cn } from "@/lib/utils";
import { ChromeDialogContent } from "@/components/chrome/app-chrome";
import { Identifier } from "@/components/chrome/identifier";
import {
  TABLE_CELL,
  TABLE_HEAD,
  TABLE_HEAD_ROW,
  tableBodyClass,
  tableRowClass,
} from "@/components/chrome/table-plate";
import { OutcomeAmount, OutcomeHeader, StatusLine } from "@/components/feedback";
import { PaymentFacts } from "@/components/payment/payment-steps";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardAction,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import { bulkApi, type BatchView } from "./api";
import { PaymentGateway } from "./payment-gateway";
import { BatchFooter } from "./batch-footer";
import type { BatchCtx } from "./batch-screen";
import { FilingFooter } from "@/components/filing/filing-footer";
import { CaseBadge } from "./stage";
import { caseState } from "./batch-marks";

const ist = (iso: string) =>
  `${new Date(iso).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "medium", timeStyle: "short" })} IST`;

function Receipts({
  batch,
  payment,
  fees = true,
}: {
  batch: BatchView;
  payment: BatchView["payments"][number];
  /** The per-case fee. Off in the payment window, which states the total above. */
  fees?: boolean;
}) {
  const cases = batch.cases.filter((c) => payment.caseIds.includes(c.id));
  return (
    <div className="overflow-x-auto">
      <Table
        className="border-separate border-spacing-0"
        aria-label={`Receipts for ${payment.ref}`}
      >
        <TableHeader>
          <TableRow className={TABLE_HEAD_ROW}>
            <TableHead className={cn(TABLE_HEAD, "pl-4")}>Reference</TableHead>
            <TableHead className={TABLE_HEAD}>Receipt</TableHead>
            <TableHead className={cn(TABLE_HEAD, !fees && "pr-4")}>
              Case file number
            </TableHead>
            {fees ? (
              <TableHead className={cn(TABLE_HEAD, "pr-4 text-right")}>
                Paid
              </TableHead>
            ) : null}
          </TableRow>
        </TableHeader>
        <TableBody className={tableBodyClass({ hover: false })}>
          {cases.map((c) => (
            <TableRow key={c.id} className={tableRowClass({ hover: false })}>
              <TableCell
                className={cn(TABLE_CELL, "pl-4 font-medium tabular-nums")}
              >
                {c.reference}
              </TableCell>
              <TableCell className={cn(TABLE_CELL, "tabular-nums")}>
                {c.receiptNumber}
              </TableCell>
              <TableCell
                className={cn(TABLE_CELL, "tabular-nums", !fees && "pr-4")}
              >
                {c.caseFileNumber}
              </TableCell>
              {fees ? (
                <TableCell
                  className={cn(TABLE_CELL, "pr-4 text-right tabular-nums")}
                >
                  {money(c.fee)}
                </TableCell>
              ) : null}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

/**
 * Bulk payment (PRD §4.2): the selected cases' bills clubbed into one gateway transaction.
 * The reference goes on every case, each gets its own receipt, and payment files the case,
 * exactly as it does for a single filing.
 */
export function PayTab({ batch, setBatch, go }: BatchCtx) {
  const due = batch.cases.filter((c) => c.stage === "signed");
  // Arriving from signing, only the cases just signed are ticked; otherwise every one due.
  const asked = useSearchParams().get("case")?.split(",").filter(Boolean) ?? [];
  const start = () => {
    const only = due.filter((c) => asked.includes(c.id));
    return new Set((only.length ? only : due).map((c) => c.id));
  };
  const [picked, setPicked] = React.useState<Set<string>>(start);
  const [dialog, setDialog] = React.useState<
    "confirm" | "processing" | "done" | null
  >(null);
  const [error, setError] = React.useState<string | null>(null);

  // Re-select everything when the set on offer changes — adjusted during render, not in
  // an effect, since it derives from props (the pattern BatchFilingDialog uses).
  const offerKey = due.map((c) => c.id).join();
  const [offered, setOffered] = React.useState(offerKey);
  if (offerKey !== offered) {
    setOffered(offerKey);
    setPicked(start());
  }

  const chosen = due.filter((c) => picked.has(c.id));
  const total = chosen.reduce((s, c) => s + c.fee, 0);
  // The fee's parts across the chosen cases: each shown as cases × rate when every case
  // pays the same, else as a sum the list breaks down (round 3: one unexplained lump).
  const parts = (
    [
      ["court", "Court fee"],
      ["condonation", "Delay condonation fee"],
      ["process", "Process fee"],
      ["delivery", "Summons delivery"],
    ] as const
  )
    .map(([key, label]) => {
      const paying = chosen.filter((c) => (c.feeParts?.[key] ?? 0) > 0);
      const amounts = paying.map((c) => c.feeParts[key]);
      const sum = amounts.reduce((n, a) => n + a, 0);
      const rate = amounts.length && amounts.every((a) => a === amounts[0]) ? amounts[0] : null;
      return { key, label, sum, n: paying.length, rate };
    })
    .filter((p) => p.sum > 0);
  // Payments recorded before the parts existed fall back to the one sum.
  const unexplained = total - parts.reduce((n, p) => n + p.sum, 0);
  const [listOpen, setListOpen] = React.useState(false);
  const last = batch.payments.at(-1);
  // What the batch still has to do after this payment, shown on the success screen.
  const pendingAfter = batch.cases.filter((c) => c.stage !== "filed");
  /** The step a case waits on: paying, fixing or checking, or signing. */
  const openPending = (c: (typeof pendingAfter)[number]) => {
    setDialog(null);
    const state = caseState(c);
    go(state === "signed" ? "pay" : state === "fix" || state === "check" ? "scrutiny" : state === "docs" ? "documents" : "sign");
    window.setTimeout(
      () =>
        document
          .getElementById(`bulk-case-${c.id}`)
          ?.scrollIntoView({ behavior: "smooth", block: "start" }),
      300,
    );
  };

  const pay = async () => {
    setDialog("processing");
    setError(null);
    try {
      await new Promise((r) => setTimeout(r, 1800));
      setBatch(
        await bulkApi.act(batch.id, {
          action: "pay",
          caseIds: chosen.map((c) => c.id),
        }),
      );
      setDialog("done");
    } catch (e) {
      setError((e as Error).message);
      setDialog(null);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      {error ? (
        <StatusLine tone="error">{error}</StatusLine>
      ) : null}

      {due.length === 0 ? (
        <>
          <Card variant="raised">
            <CardContent className="text-body-compact text-muted-foreground">
              Nothing to pay yet. Cases come here once every party has signed them.{" "}
              <button type="button" className="text-foreground underline" onClick={() => go("sign")}>
                Go to Review and sign
              </button>
            </CardContent>
          </Card>
          <BatchFooter>
            <FilingFooter showSaveState={false} onBack={() => go("sign")} continueLabel="Pay" continueDisabled />
          </BatchFooter>
        </>
      ) : (
        <>
          {/* The fees first, as one sum (v8); the cases it covers behind "Review the list". */}
          <Card variant="raised">
            <CardHeader>
              <CardTitle className="text-body font-semibold">Fees</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <dl className="flex flex-col gap-2 text-body-compact">
                {parts.map((p) => (
                  <div key={p.key} className="flex items-baseline justify-between gap-4">
                    <dt>
                      {p.label}
                      <span className="text-muted-foreground tabular-nums">
                        {" "}
                        · {p.n} {p.n === 1 ? "case" : "cases"}
                        {p.rate !== null ? ` × ${money(p.rate)}` : ", varies by case"}
                      </span>
                    </dt>
                    <dd className="tabular-nums">{money(p.sum)}</dd>
                  </div>
                ))}
                {unexplained > 0 ? (
                  <div className="flex items-baseline justify-between gap-4">
                    <dt>Fees</dt>
                    <dd className="tabular-nums">{money(unexplained)}</dd>
                  </div>
                ) : null}
              </dl>
              <div className="flex items-baseline justify-between gap-4 border-t border-hairline pt-3">
                <span className="text-title-s font-semibold">Total</span>
                <span className="text-title-s font-semibold tabular-nums">{money(total)}</span>
              </div>
            </CardContent>
          </Card>

          <Card variant="raised" className={cn(listOpen && "gap-4")}>
            <CardHeader>
              <CardTitle className="text-body font-semibold tabular-nums">
                {chosen.length === due.length
                  ? `All ${due.length} signed ${due.length === 1 ? "case" : "cases"}`
                  : `${chosen.length} of ${due.length} signed cases`}
              </CardTitle>
              <CardDescription>
                {listOpen ? "Untick any to pay for later." : "One payment files every case you keep ticked."}
              </CardDescription>
              <CardAction>
                <Button variant="outline" size="sm" onClick={() => setListOpen((v) => !v)}>
                  {listOpen ? "Hide the list" : "Review the list"}
                </Button>
              </CardAction>
            </CardHeader>
            {listOpen ? (
          <div className="overflow-x-auto px-2 pb-2">
            <Table
              className="border-separate border-spacing-0"
              aria-label="Cases to pay for"
            >
              <TableHeader>
                <TableRow className={TABLE_HEAD_ROW}>
                  <TableHead className={cn(TABLE_HEAD, "w-12 pl-4")}>
                    <Checkbox
                      checked={
                        chosen.length === due.length
                          ? true
                          : chosen.length
                            ? "indeterminate"
                            : false
                      }
                      onCheckedChange={(v) =>
                        setPicked(
                          v === true
                            ? new Set(due.map((c) => c.id))
                            : new Set(),
                        )
                      }
                      aria-label="Select every case"
                    />
                  </TableHead>
                  <TableHead className={TABLE_HEAD}>Accused</TableHead>
                  <TableHead className={TABLE_HEAD}>Your reference</TableHead>
                  <TableHead className={cn(TABLE_HEAD, "pr-4 text-right")}>
                    Fees
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody className={tableBodyClass({ selectable: true })}>
                {due.map((c) => (
                  <TableRow
                    key={c.id}
                    className={tableRowClass({ selectable: true })}
                    data-state={picked.has(c.id) ? "selected" : undefined}
                  >
                    <TableCell className={cn(TABLE_CELL, "w-12 pl-4")}>
                      <Checkbox
                        checked={picked.has(c.id)}
                        onCheckedChange={(v) =>
                          setPicked((prev) => {
                            const next = new Set(prev);
                            if (v === true) next.add(c.id);
                            else next.delete(c.id);
                            return next;
                          })
                        }
                        aria-label={`Select ${c.reference}`}
                      />
                    </TableCell>
                    <TableCell className={cn(TABLE_CELL, "whitespace-normal")}>{c.accused || c.title}</TableCell>
                    <TableCell className={cn(TABLE_CELL, "font-mono")}>{c.reference}</TableCell>
                    <TableCell className={cn(TABLE_CELL, "pr-4 text-right tabular-nums")}>{money(c.fee)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
            ) : null}
          </Card>

          <BatchFooter>
            <FilingFooter
              showSaveState={false}
              onBack={() => go("sign")}
              status={
                <span className="text-body-compact text-muted-foreground">
                  You&apos;ll go to the payment gateway and come back here.
                </span>
              }
              continueLabel={`Pay ${money(total)}`}
              continueDisabled={!chosen.length || !!batch.clubbedInto}
              onContinue={() => setDialog("confirm")}
            />
          </BatchFooter>
        </>
      )}

      {batch.counts.filed ? (
        <p className="text-body-compact text-muted-foreground">
          <span className="tabular-nums">{batch.counts.filed}</span> already
          paid and filed.{" "}
          <button
            type="button"
            className="underline"
            onClick={() => go("filed")}
          >
            See them under Filed
          </button>
        </p>
      ) : null}

      <Dialog
        open={!!dialog}
        onOpenChange={(v) => !v && dialog !== "processing" && setDialog(null)}
      >
        {/* Capped to the viewport: a batch's receipts can run to hundreds of rows. */}
        <ChromeDialogContent
          onInteractOutside={(event) => event.preventDefault()}
          mobileSheet
          showCloseButton={dialog !== "done"}
          className={cn(
            // The gateway and the outcome each lay out their own edges: no dialog padding.
            "flex max-h-[90dvh] flex-col gap-0 overflow-hidden p-0 sm:max-w-lg",
          )}
        >
          {dialog === "done" && last ? (
            <>
              {/* The payment's outcome takes the window over (skill `feedback-states`). */}
              <OutcomeHeader
                compact
                titleFrom="dialog"
                focusTitle
                title="Payment successful"
                body={
                  <>
                    <span className="tabular-nums">{last.caseIds.length}</span>{" "}
                    case file{last.caseIds.length === 1 ? " is" : "s are"}{" "}
                    complete.
                  </>
                }
              >
                <OutcomeAmount label="Amount paid" value={money(last.amount)} />
              </OutcomeHeader>

              <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-6">
                <PaymentFacts
                  rows={[
                    {
                      label: "Payment reference",
                      value: <Identifier value={last.ref} label="payment reference" />,
                    },
                    { label: "Filed on", value: <span className="tabular-nums">{ist(last.at)}</span> },
                  ]}
                />

                {/* Filed and still pending on tabs: the window scrolls, never a box inside it. */}
                <Tabs defaultValue="filed" className="gap-3">
                  <TabsList variant="line">
                    <TabsTrigger value="filed">
                      Filed{" "}
                      <span className="tabular-nums">
                        {last.caseIds.length}
                      </span>
                    </TabsTrigger>
                    {pendingAfter.length ? (
                      <TabsTrigger value="pending">
                        Still pending{" "}
                        <span className="tabular-nums">
                          {pendingAfter.length}
                        </span>
                      </TabsTrigger>
                    ) : null}
                  </TabsList>
                  <TabsContent value="filed">
                    <Receipts batch={batch} payment={last} fees={false} />
                  </TabsContent>
                  {pendingAfter.length ? (
                    <TabsContent value="pending">
                      <ul className="flex flex-col divide-y divide-hairline overflow-hidden rounded-lg border border-hairline">
                        {pendingAfter.map((c) => (
                          <li key={c.id}>
                            {/* Each opens the step the case waits on, scrolled to it. */}
                            <button
                              type="button"
                              onClick={() => openPending(c)}
                              className="flex w-full items-center gap-3 px-3 py-2 text-left transition-colors hover:bg-accent focus-visible:ring-3 focus-visible:ring-focus-ring focus-visible:outline-none"
                            >
                              <span className="flex min-w-0 flex-1 flex-col gap-1">
                                <span className="flex flex-wrap items-center gap-2">
                                  <span className="text-body-compact font-medium tabular-nums">
                                    {c.reference}
                                  </span>
                                  <CaseBadge c={c} />
                                </span>
                                {c.flags.slice(0, 2).map((f) => (
                                  <span
                                    key={f.id}
                                    className="flex items-start gap-1.5 text-caption text-muted-foreground"
                                  >
                                    <FlagIcon
                                      className={cn(
                                        "mt-0.5 size-3 shrink-0",
                                        f.level === "hold"
                                          ? "text-destructive-ink"
                                          : "text-warning-ink",
                                      )}
                                      aria-label={
                                        f.level === "hold"
                                          ? "Needs fixing"
                                          : "To check"
                                      }
                                    />
                                    {f.message}
                                  </span>
                                ))}
                                {c.flags.length > 2 ? (
                                  <span className="text-caption text-muted-foreground tabular-nums">
                                    and {c.flags.length - 2} more
                                  </span>
                                ) : null}
                              </span>
                              <ChevronRightIcon
                                className="size-4 shrink-0 text-muted-foreground"
                                aria-hidden
                              />
                            </button>
                          </li>
                        ))}
                      </ul>
                    </TabsContent>
                  ) : null}
                </Tabs>
              </div>

              {/* The warm band every outcome closes on; it stays put while the lists scroll. */}
              <footer className="flex shrink-0 flex-col gap-3 border-t border-hairline bg-surface-sunken px-6 pt-4 pb-[calc(--spacing(4)+env(safe-area-inset-bottom))] sm:flex-row">
                  {pendingAfter.length ? (
                    <Button
                      variant="outline"
                      size="lg"
                      className="sm:flex-1"
                      onClick={() => {
                        setDialog(null);
                        go(
                          pendingAfter.some((c) => c.stage === "signed")
                            ? "pay"
                            : pendingAfter.some(
                                  (c) => c.stage === "ready" && !c.flags.length,
                                )
                              ? "sign"
                              : "scrutiny",
                        );
                      }}
                    >
                      Finish the pending{" "}
                      {pendingAfter.length === 1 ? "case" : "cases"}
                    </Button>
                  ) : null}
                  <Button
                    variant="outline"
                    size="lg"
                    className="sm:flex-1"
                    onClick={() => {
                      setDialog(null);
                      go("filed");
                    }}
                  >
                    See filed cases
                  </Button>
              </footer>
            </>
          ) : (
            /* A sandbox payment gateway: UPI, card or NEFT, each ending in the payment. */
            <PaymentGateway
              amount={total}
              cases={chosen.length}
              onPaid={() => void pay()}
              onCancel={() => setDialog(null)}
            />
          )}
        </ChromeDialogContent>
      </Dialog>
    </div>
  );
}
