"use client";

import * as React from "react";
import { CheckIcon, ChevronRightIcon, FlagIcon, WalletIcon } from "lucide-react";

import { money } from "@/lib/filing/format";
import { cn } from "@/lib/utils";
import { ChromeDialogContent } from "@/components/chrome/app-chrome";
import { Identifier } from "@/components/chrome/identifier";
import { TABLE_CELL, TABLE_HEAD, TABLE_HEAD_ROW, tableBodyClass, tableRowClass } from "@/components/chrome/table-plate";
import { PANEL_CLASS } from "@/components/filing/form-card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Spinner } from "@/components/ui/spinner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

import { bulkApi, type BatchView } from "./api";
import type { BatchCtx } from "./batch-screen";
import { StageBadge } from "./stage";

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
      <Table className="border-separate border-spacing-0" aria-label={`Receipts for ${payment.ref}`}>
        <TableHeader>
          <TableRow className={TABLE_HEAD_ROW}>
            <TableHead className={cn(TABLE_HEAD, "pl-4")}>Reference</TableHead>
            <TableHead className={TABLE_HEAD}>Receipt</TableHead>
            <TableHead className={cn(TABLE_HEAD, !fees && "pr-4")}>Case file number</TableHead>
            {fees ? <TableHead className={cn(TABLE_HEAD, "pr-4 text-right")}>Paid</TableHead> : null}
          </TableRow>
        </TableHeader>
        <TableBody className={tableBodyClass({ hover: false })}>
          {cases.map((c) => (
            <TableRow key={c.id} className={tableRowClass({ hover: false })}>
              <TableCell className={cn(TABLE_CELL, "pl-4 font-medium tabular-nums")}>{c.reference}</TableCell>
              <TableCell className={cn(TABLE_CELL, "tabular-nums")}>{c.receiptNumber}</TableCell>
              <TableCell className={cn(TABLE_CELL, "tabular-nums", !fees && "pr-4")}>{c.caseFileNumber}</TableCell>
              {fees ? <TableCell className={cn(TABLE_CELL, "pr-4 text-right tabular-nums")}>{money(c.fee)}</TableCell> : null}
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
  const [picked, setPicked] = React.useState<Set<string>>(() => new Set(due.map((c) => c.id)));
  const [dialog, setDialog] = React.useState<"confirm" | "processing" | "done" | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  // Re-select everything when the set on offer changes — adjusted during render, not in
  // an effect, since it derives from props (the pattern BatchFilingDialog uses).
  const offerKey = due.map((c) => c.id).join();
  const [offered, setOffered] = React.useState(offerKey);
  if (offerKey !== offered) {
    setOffered(offerKey);
    setPicked(new Set(due.map((c) => c.id)));
  }

  const chosen = due.filter((c) => picked.has(c.id));
  const total = chosen.reduce((s, c) => s + c.fee, 0);
  const last = batch.payments.at(-1);
  // What the batch still has to do after this payment, shown on the success screen.
  const pendingAfter = batch.cases.filter((c) => c.stage !== "filed");
  /** The step a case waits on: paying, fixing or checking, or signing. */
  const openPending = (c: (typeof pendingAfter)[number]) => {
    setDialog(null);
    go(c.stage === "signed" ? "pay" : c.flags.length ? "scrutiny" : "sign");
    window.setTimeout(() => document.getElementById(`bulk-case-${c.id}`)?.scrollIntoView({ behavior: "smooth", block: "start" }), 300);
  };

  const pay = async () => {
    setDialog("processing");
    setError(null);
    try {
      await new Promise((r) => setTimeout(r, 1800));
      setBatch(await bulkApi.act(batch.id, { action: "pay", caseIds: chosen.map((c) => c.id) }));
      setDialog("done");
    } catch (e) {
      setError((e as Error).message);
      setDialog(null);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      {due.length === 0 ? (
        <Card className={PANEL_CLASS}>
          <CardContent className="text-body-compact text-muted-foreground">Nothing to pay yet. Sign the cases first.</CardContent>
        </Card>
      ) : (
        <Card className={cn(PANEL_CLASS, "gap-0 py-0")}>
          <CardHeader className="px-6 py-4">
            <CardTitle className="text-body font-semibold">Signed, waiting for payment</CardTitle>
            <CardDescription>Fees for each case. One payment covers every case you tick.</CardDescription>
          </CardHeader>
          <div className="overflow-x-auto px-2">
            <Table className="border-separate border-spacing-0" aria-label="Cases to pay for">
              <TableHeader>
                <TableRow className={TABLE_HEAD_ROW}>
                  <TableHead className={cn(TABLE_HEAD, "w-12 pl-4")}>
                    <Checkbox
                      checked={chosen.length === due.length ? true : chosen.length ? "indeterminate" : false}
                      onCheckedChange={(v) => setPicked(v === true ? new Set(due.map((c) => c.id)) : new Set())}
                      aria-label="Select every case"
                    />
                  </TableHead>
                  <TableHead className={TABLE_HEAD}>Reference</TableHead>
                  <TableHead className={TABLE_HEAD}>Parties</TableHead>
                  <TableHead className={cn(TABLE_HEAD, "pr-4 text-right")}>Fees</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody className={tableBodyClass({ selectable: true })}>
                {due.map((c) => (
                  <TableRow key={c.id} className={tableRowClass({ selectable: true })} data-state={picked.has(c.id) ? "selected" : undefined}>
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
                    <TableCell className={cn(TABLE_CELL, "font-medium tabular-nums")}>{c.reference}</TableCell>
                    <TableCell className={cn(TABLE_CELL, "whitespace-normal")}>{c.title}</TableCell>
                    <TableCell className={cn(TABLE_CELL, "pr-4 text-right tabular-nums")}>{money(c.fee)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <div className="flex flex-col gap-3 px-6 py-4 sm:flex-row sm:items-center">
            <div className="flex flex-col">
              <span className="text-caption text-muted-foreground">
                <span className="tabular-nums">{chosen.length}</span> case{chosen.length === 1 ? "" : "s"}, one transaction
              </span>
              <span className="text-title-s font-semibold tabular-nums">{money(total)}</span>
            </div>
            <Button size="lg" className="sm:ml-auto" disabled={!chosen.length || !!batch.clubbedInto} onClick={() => setDialog("confirm")}>
              <WalletIcon data-icon="inline-start" aria-hidden />
              Pay {money(total)}
            </Button>
          </div>
        </Card>
      )}

      {batch.counts.filed ? (
        <p className="text-body-compact text-muted-foreground">
          <span className="tabular-nums">{batch.counts.filed}</span> already paid and filed.{" "}
          <button type="button" className="underline" onClick={() => go("filed")}>
            See them under Filed
          </button>
        </p>
      ) : null}

      <Dialog open={!!dialog} onOpenChange={(v) => !v && dialog !== "processing" && setDialog(null)}>
        {/* Capped to the viewport: a batch's receipts can run to hundreds of rows. */}
        <ChromeDialogContent
          mobileSheet
          showCloseButton={dialog !== "done"}
          className={cn(
            "flex max-h-[90dvh] flex-col sm:max-w-lg",
            // The outcome is the single filing's "Payment successful" window, case for case.
            dialog === "done" && "gap-0 overflow-hidden p-0"
          )}
        >
          {dialog === "done" && last ? (
            <>
              <div className="flex shrink-0 flex-col items-center gap-2 bg-success p-6 text-center text-success-foreground">
                <span className="flex size-12 items-center justify-center rounded-full bg-success-foreground text-success">
                  <CheckIcon className="size-6" aria-hidden />
                </span>
                <DialogTitle className="text-title-s font-semibold">Payment successful</DialogTitle>
                <DialogDescription className="text-body-compact text-success-foreground">
                  <span className="tabular-nums">{last.caseIds.length}</span> case file{last.caseIds.length === 1 ? " is" : "s are"} complete.
                </DialogDescription>
              </div>

              <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-6">
                <div className="flex items-center justify-between gap-4 text-body-compact">
                  <span className="text-muted-foreground">Amount paid</span>
                  <span className="font-semibold text-foreground tabular-nums">{money(last.amount)}</span>
                </div>
                <div className="flex items-center justify-between gap-4 text-body-compact">
                  <span className="text-muted-foreground">Payment reference</span>
                  <span className="text-foreground">
                    <Identifier value={last.ref} label="payment reference" />
                  </span>
                </div>
                <div className="flex items-center justify-between gap-4 text-body-compact">
                  <span className="text-muted-foreground">Filed on</span>
                  <span className="text-foreground tabular-nums">{ist(last.at)}</span>
                </div>

                {/* Filed and still pending on tabs: the window scrolls, never a box inside it. */}
                <Tabs defaultValue="filed" className="gap-3">
                  <TabsList variant="line">
                    <TabsTrigger value="filed">
                      Filed <span className="tabular-nums">{last.caseIds.length}</span>
                    </TabsTrigger>
                    {pendingAfter.length ? (
                      <TabsTrigger value="pending">
                        Still pending <span className="tabular-nums">{pendingAfter.length}</span>
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
                                  <span className="text-body-compact font-medium tabular-nums">{c.reference}</span>
                                  <StageBadge stage={c.stage} />
                                </span>
                                {c.flags.slice(0, 2).map((f) => (
                                  <span key={f.id} className="flex items-start gap-1.5 text-caption text-muted-foreground">
                                    <FlagIcon
                                      className={cn("mt-0.5 size-3 shrink-0", f.level === "hold" ? "text-destructive-ink" : "text-warning-ink")}
                                      aria-label={f.level === "hold" ? "Needs fixing" : "To check"}
                                    />
                                    {f.message}
                                  </span>
                                ))}
                                {c.flags.length > 2 ? (
                                  <span className="text-caption text-muted-foreground tabular-nums">and {c.flags.length - 2} more</span>
                                ) : null}
                            </span>
                            <ChevronRightIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                          </button>
                        </li>
                        ))}
                      </ul>
                    </TabsContent>
                  ) : null}
                </Tabs>

                <div className="flex flex-col gap-3 sm:flex-row">
                  {pendingAfter.length ? (
                    <Button
                      variant="outline"
                      size="lg"
                      className="flex-1"
                      onClick={() => {
                        setDialog(null);
                        go(pendingAfter.some((c) => c.stage === "signed") ? "pay" : pendingAfter.some((c) => c.stage === "ready" && !c.flags.length) ? "sign" : "scrutiny");
                      }}
                    >
                      Finish the pending {pendingAfter.length === 1 ? "case" : "cases"}
                    </Button>
                  ) : null}
                  <Button
                    variant="outline"
                    size="lg"
                    className="flex-1"
                    onClick={() => {
                      setDialog(null);
                      go("filed");
                    }}
                  >
                    See filed cases
                  </Button>
                </div>
              </div>
            </>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle>Pay {money(total)}</DialogTitle>
                <DialogDescription>
                  One transaction for {chosen.length} case{chosen.length === 1 ? "" : "s"}. Sandbox gateway: no money moves.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button variant="outline" disabled={dialog === "processing"} onClick={() => setDialog(null)}>
                  Cancel
                </Button>
                <Button disabled={dialog === "processing"} onClick={() => void pay()}>
                  {dialog === "processing" ? <Spinner data-icon="inline-start" /> : null}
                  {dialog === "processing" ? "Processing" : `Pay ${money(total)}`}
                </Button>
              </DialogFooter>
            </>
          )}
        </ChromeDialogContent>
      </Dialog>
    </div>
  );
}
