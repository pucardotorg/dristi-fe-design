"use client";

import { CircleCheckIcon } from "lucide-react";

import { money } from "@/lib/filing/format";
import { cn } from "@/lib/utils";
import { TABLE_CELL, TABLE_HEAD, TABLE_HEAD_ROW, tableBodyClass, tableRowClass } from "@/components/chrome/table-plate";
import { PANEL_CLASS } from "@/components/filing/form-card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

import type { BatchCtx } from "./batch-screen";

export const ist = (iso: string) =>
  `${new Date(iso).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "medium", timeStyle: "short" })} IST`;

/**
 * The done pile: every case paid for, and so filed, with its receipt and case file number,
 * grouped by the payment that filed it. From here each case goes to scrutiny on its own.
 */
export function FiledTab({ batch, go }: BatchCtx) {
  const filed = batch.cases.filter((c) => c.stage === "filed");
  const left = batch.total - filed.length;

  if (filed.length === 0) {
    return (
      <Card className={PANEL_CLASS}>
        <CardContent className="text-body-compact text-muted-foreground">Nothing filed yet. Cases show here once they are paid for.</CardContent>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <Alert variant="success">
        <CircleCheckIcon aria-hidden />
        <AlertTitle className="tabular-nums">
          {left === 0 ? `Done: all ${filed.length} cases filed` : `${filed.length} of ${batch.total} cases filed`}
        </AlertTitle>
        <AlertDescription>
          Each case now goes to the court on its own for checking.
          {left ? (
            <>
              {" "}
              <span className="tabular-nums">{left}</span> still to go.{" "}
              <button type="button" className="underline" onClick={() => go(batch.counts.signed ? "pay" : "scrutiny")}>
                {batch.counts.signed ? "Go to payment" : "Open scrutiny"}
              </button>
            </>
          ) : null}
        </AlertDescription>
      </Alert>

      {[...batch.payments].reverse().map((p) => {
        const cases = batch.cases.filter((c) => p.caseIds.includes(c.id));
        return (
          <Card key={p.ref} className={cn(PANEL_CLASS, "gap-0 py-0")}>
            <CardHeader className="px-6 py-4">
              <CardTitle className="text-body font-semibold tabular-nums">
                {cases.length} filed at {ist(p.at)}
              </CardTitle>
              <CardDescription className="tabular-nums">
                Transaction {p.ref} · {money(p.amount)}
              </CardDescription>
            </CardHeader>
            <div className="overflow-x-auto px-2 pb-2">
              <Table className="border-separate border-spacing-0" aria-label={`Cases filed by ${p.ref}`}>
                <TableHeader>
                  <TableRow className={TABLE_HEAD_ROW}>
                    <TableHead className={cn(TABLE_HEAD, "pl-4")}>Reference</TableHead>
                    <TableHead className={TABLE_HEAD}>Parties</TableHead>
                    <TableHead className={TABLE_HEAD}>Case file number</TableHead>
                    <TableHead className={TABLE_HEAD}>Receipt</TableHead>
                    <TableHead className={cn(TABLE_HEAD, "pr-4 text-right")}>Paid</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody className={tableBodyClass({ hover: false })}>
                  {cases.map((c) => (
                    <TableRow key={c.id} className={tableRowClass({ hover: false })}>
                      <TableCell className={cn(TABLE_CELL, "pl-4 font-medium tabular-nums")}>
                        <span className="flex items-center gap-2">
                          <CircleCheckIcon className="size-4 text-success-ink" aria-label="Filed" />
                          {c.reference}
                        </span>
                      </TableCell>
                      <TableCell className={cn(TABLE_CELL, "min-w-56 whitespace-normal")}>{c.title}</TableCell>
                      <TableCell className={cn(TABLE_CELL, "tabular-nums")}>{c.caseFileNumber}</TableCell>
                      <TableCell className={cn(TABLE_CELL, "tabular-nums")}>{c.receiptNumber}</TableCell>
                      <TableCell className={cn(TABLE_CELL, "pr-4 text-right tabular-nums")}>{money(c.fee)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </Card>
        );
      })}
    </div>
  );
}
