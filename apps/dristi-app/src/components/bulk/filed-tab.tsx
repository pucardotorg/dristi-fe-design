"use client";

import * as React from "react";
import { CircleCheckIcon } from "lucide-react";

import type { FilingDraft } from "@/lib/filing/types";

import { money } from "@/lib/filing/format";
import { cn } from "@/lib/utils";
import {
  TABLE_CELL,
  TABLE_HEAD,
  TABLE_HEAD_ROW,
  tableBodyClass,
  tableRowClass,
} from "@/components/chrome/table-plate";
import { PANEL_CLASS } from "@/components/filing/form-card";
import { ChromeDialogContent } from "@/components/chrome/app-chrome";
import { CourtDocument } from "@/components/filing/sections/preview/court-document";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Dialog, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Spinner } from "@/components/ui/spinner";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import type { BatchCtx } from "./batch-screen";
import { bulkFetch } from "./api";

export const ist = (iso: string) =>
  `${new Date(iso).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "medium", timeStyle: "short" })} IST`;

/**
 * The done pile: every case paid for, and so filed, with its receipt and case file number,
 * grouped by the payment that filed it. From here each case goes to scrutiny on its own.
 */
export function FiledTab({ batch, go }: BatchCtx) {
  const filed = batch.cases.filter((c) => c.stage === "filed");
  const left = batch.total - filed.length;
  // A filed case opens read-only, as the court will read it.
  const [openId, setOpenId] = React.useState<string | null>(null);
  const [drafts, setDrafts] = React.useState<Record<
    string,
    FilingDraft
  > | null>(null);
  React.useEffect(() => {
    if (!openId || drafts) return;
    let live = true;
    bulkFetch(`/api/bulk/batches/${batch.id}/drafts`, { cache: "no-store" })
      .then((r) => r.json())
      .then((json) => live && setDrafts(json.drafts ?? {}))
      .catch(() => live && setDrafts({}));
    return () => {
      live = false;
    };
  }, [openId, drafts, batch.id]);
  const opened = filed.find((c) => c.id === openId);

  if (filed.length === 0) {
    return (
      <Card className={PANEL_CLASS}>
        <CardContent className="text-body-compact text-muted-foreground">
          Nothing filed yet. Cases show here once they are paid for.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {left ? (
        <Alert variant="success">
          <CircleCheckIcon aria-hidden />
          <AlertTitle className="tabular-nums">
            {`${filed.length} of ${batch.total} cases filed`}
          </AlertTitle>
          <AlertDescription>
            Each case now goes to the court on its own for checking.
            {left ? (
              <>
                {" "}
                <span className="tabular-nums">{left}</span> still to go.{" "}
                <button
                  type="button"
                  className="underline"
                  onClick={() => go(batch.counts.signed ? "pay" : "scrutiny")}
                >
                  {batch.counts.signed ? "Go to payment" : "Open scrutiny"}
                </button>
              </>
            ) : null}
          </AlertDescription>
        </Alert>
      ) : null}

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
              <Table
                className="border-separate border-spacing-0"
                aria-label={`Cases filed by ${p.ref}`}
              >
                <TableHeader>
                  <TableRow className={TABLE_HEAD_ROW}>
                    <TableHead className={cn(TABLE_HEAD, "pl-4")}>
                      Reference
                    </TableHead>
                    <TableHead className={TABLE_HEAD}>Parties</TableHead>
                    <TableHead className={TABLE_HEAD}>
                      Case file number
                    </TableHead>
                    <TableHead className={TABLE_HEAD}>Receipt</TableHead>
                    <TableHead className={cn(TABLE_HEAD, "pr-4 text-right")}>
                      Paid
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody className={tableBodyClass({ hover: true })}>
                  {cases.map((c) => (
                    <TableRow
                      key={c.id}
                      className={cn(
                        tableRowClass({ hover: true }),
                        "cursor-pointer",
                      )}
                      onClick={() => setOpenId(c.id)}
                    >
                      <TableCell
                        className={cn(
                          TABLE_CELL,
                          "pl-4 font-medium tabular-nums",
                        )}
                      >
                        <button
                          type="button"
                          className="underline-offset-2 hover:underline focus-visible:underline focus-visible:outline-none"
                          onClick={(e) => {
                            e.stopPropagation();
                            setOpenId(c.id);
                          }}
                        >
                          {c.reference}
                        </button>
                      </TableCell>
                      <TableCell
                        className={cn(TABLE_CELL, "min-w-56 whitespace-normal")}
                      >
                        {c.title}
                      </TableCell>
                      <TableCell className={cn(TABLE_CELL, "tabular-nums")}>
                        {c.caseFileNumber}
                      </TableCell>
                      <TableCell className={cn(TABLE_CELL, "tabular-nums")}>
                        {c.receiptNumber}
                      </TableCell>
                      <TableCell
                        className={cn(
                          TABLE_CELL,
                          "pr-4 text-right tabular-nums",
                        )}
                      >
                        {money(c.fee)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </Card>
        );
      })}

      <Dialog open={!!opened} onOpenChange={(v) => !v && setOpenId(null)}>
        <ChromeDialogContent className="flex h-[92dvh] flex-col gap-0 overflow-hidden p-0 sm:max-w-4xl">
          {opened ? (
            <>
              <div className="flex shrink-0 flex-col gap-0.5 border-b border-hairline px-6 py-4 pr-12">
                <DialogTitle className="truncate text-title-s font-semibold">
                  {opened.title}
                </DialogTitle>
                <DialogDescription className="tabular-nums">
                  {opened.reference} · Case file {opened.caseFileNumber} ·
                  Receipt {opened.receiptNumber}
                </DialogDescription>
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto bg-surface-sunken p-4 sm:p-6">
                {drafts?.[opened.id] ? (
                  <CourtDocument draft={drafts[opened.id]} />
                ) : drafts ? (
                  <p className="text-body-compact text-muted-foreground">
                    This case could not be loaded.
                  </p>
                ) : (
                  <div className="flex justify-center py-12">
                    <Spinner className="size-6" />
                  </div>
                )}
              </div>
            </>
          ) : null}
        </ChromeDialogContent>
      </Dialog>
    </div>
  );
}
