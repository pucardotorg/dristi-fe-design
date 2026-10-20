"use client";

import * as React from "react";
import { CheckCircle2Icon, WalletIcon } from "lucide-react";

import { money } from "@/lib/filing/format";
import { cn } from "@/lib/utils";
import { ChromeDialogContent } from "@/components/chrome/app-chrome";
import { TABLE_CELL, TABLE_HEAD, TABLE_HEAD_ROW, tableBodyClass, tableRowClass } from "@/components/chrome/table-plate";
import { PANEL_CLASS } from "@/components/filing/form-card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Spinner } from "@/components/ui/spinner";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

import { bulkApi, type BatchView } from "./api";
import type { BatchCtx } from "./batch-screen";

const ist = (iso: string) =>
  `${new Date(iso).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "medium", timeStyle: "short" })} IST`;

function Receipts({ batch, payment }: { batch: BatchView; payment: BatchView["payments"][number] }) {
  const cases = batch.cases.filter((c) => payment.caseIds.includes(c.id));
  return (
    <div className="overflow-x-auto">
      <Table className="border-separate border-spacing-0" aria-label={`Receipts for ${payment.ref}`}>
        <TableHeader>
          <TableRow className={TABLE_HEAD_ROW}>
            <TableHead className={cn(TABLE_HEAD, "pl-4")}>Reference</TableHead>
            <TableHead className={TABLE_HEAD}>Receipt</TableHead>
            <TableHead className={TABLE_HEAD}>Case file number</TableHead>
            <TableHead className={cn(TABLE_HEAD, "pr-4 text-right")}>Paid</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody className={tableBodyClass({ hover: false })}>
          {cases.map((c) => (
            <TableRow key={c.id} className={tableRowClass({ hover: false })}>
              <TableCell className={cn(TABLE_CELL, "pl-4 font-medium tabular-nums")}>{c.reference}</TableCell>
              <TableCell className={cn(TABLE_CELL, "tabular-nums")}>{c.receiptNumber}</TableCell>
              <TableCell className={cn(TABLE_CELL, "tabular-nums")}>{c.caseFileNumber}</TableCell>
              <TableCell className={cn(TABLE_CELL, "pr-4 text-right tabular-nums")}>{money(c.fee)}</TableCell>
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
export function PayTab({ batch, setBatch }: BatchCtx) {
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
          <CardContent className="text-body-compact text-muted-foreground">No signed case is waiting for payment.</CardContent>
        </Card>
      ) : (
        <Card className={cn(PANEL_CLASS, "gap-0 py-0")}>
          <CardHeader className="px-6 py-4">
            <CardTitle className="text-body font-semibold">Signed, waiting for payment</CardTitle>
            <CardDescription>Court fees and process fees per case, from the Gujarat fee schedule.</CardDescription>
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

      {batch.payments.length ? (
        <Card className={PANEL_CLASS}>
          <CardHeader>
            <CardTitle className="text-body font-semibold">Payments</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-6">
            {[...batch.payments].reverse().map((p) => (
              <section key={p.ref} className="flex flex-col gap-3">
                <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1 text-body-compact">
                  <span className="font-medium tabular-nums">{p.ref}</span>
                  <span className="tabular-nums text-muted-foreground">{ist(p.at)}</span>
                  <span className="tabular-nums">{money(p.amount)}</span>
                  <span className="text-muted-foreground tabular-nums">{p.caseIds.length} receipts</span>
                </div>
                <Receipts batch={batch} payment={p} />
              </section>
            ))}
          </CardContent>
        </Card>
      ) : null}

      <Dialog open={!!dialog} onOpenChange={(v) => !v && dialog !== "processing" && setDialog(null)}>
        <ChromeDialogContent className="sm:max-w-lg">
          {dialog === "done" && last ? (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <CheckCircle2Icon className="size-5 text-success-ink" aria-hidden />
                  {last.caseIds.length} case{last.caseIds.length === 1 ? "" : "s"} filed
                </DialogTitle>
                <DialogDescription>
                  Transaction <span className="tabular-nums">{last.ref}</span>, {money(last.amount)}, at {ist(last.at)}. Each case has its
                  own receipt and goes to scrutiny on its own.
                </DialogDescription>
              </DialogHeader>
              <Receipts batch={batch} payment={last} />
              <DialogFooter>
                <Button onClick={() => setDialog(null)}>Done</Button>
              </DialogFooter>
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
