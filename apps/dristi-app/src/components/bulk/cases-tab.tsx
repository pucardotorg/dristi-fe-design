"use client";

import * as React from "react";
import { FileTextIcon } from "lucide-react";

import { money, toLongDate } from "@/lib/filing/format";
import { cn } from "@/lib/utils";
import {
  TABLE_CELL,
  TABLE_HEAD,
  TABLE_HEAD_ROW,
  tableBodyClass,
  tableRowClass,
} from "@/components/chrome/table-plate";
import { PANEL_CLASS } from "@/components/filing/form-card";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

import { fileUrl, type CaseView } from "./api";
import type { BatchCtx } from "./batch-screen";
import { FlagLine } from "./scrutiny-tab";
import { StageBadge } from "./stage";

export function CasesTab({ batch, go }: BatchCtx) {
  const [open, setOpen] = React.useState<CaseView | null>(null);
  // Pending cases only; filed ones live under Filed.
  const pending = batch.cases.filter((c) => c.stage !== "filed");
  const filed = batch.cases.length - pending.length;

  return (
    <div className="flex flex-col gap-3">
    {filed ? (
      <p className="text-body-compact text-muted-foreground tabular-nums">
        {pending.length ? `${pending.length} pending. ` : "Nothing pending. "}
        {filed} filed.{" "}
        <button type="button" className="underline" onClick={() => go("filed")}>
          See filed cases
        </button>
      </p>
    ) : null}
    {pending.length ? (
    <Card className={cn(PANEL_CLASS, "gap-0 py-0")}>
      <div className="overflow-x-auto p-2">
        <Table className="border-separate border-spacing-0" aria-label="Cases in this batch">
          <TableHeader>
            <TableRow className={TABLE_HEAD_ROW}>
              <TableHead className={cn(TABLE_HEAD, "pl-4")}>Reference</TableHead>
              <TableHead className={TABLE_HEAD}>Parties</TableHead>
              <TableHead className={cn(TABLE_HEAD, "text-right")}>Cheque amount</TableHead>
              <TableHead className={TABLE_HEAD}>Cause of action</TableHead>
              <TableHead className={TABLE_HEAD}>File by</TableHead>
              <TableHead className={TABLE_HEAD}>Documents</TableHead>
              <TableHead className={cn(TABLE_HEAD, "pr-4")}>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody className={tableBodyClass()}>
            {pending.map((c) => (
              <TableRow key={c.id} className={cn(tableRowClass(), "cursor-pointer")} onClick={() => setOpen(c)}>
                <TableCell className={cn(TABLE_CELL, "pl-4 font-medium tabular-nums")}>
                  <button
                    type="button"
                    className="text-left hover:underline focus-visible:underline"
                    onClick={(e) => {
                      e.stopPropagation();
                      setOpen(c);
                    }}
                  >
                    {c.reference}
                  </button>
                </TableCell>
                <TableCell className={cn(TABLE_CELL, "min-w-56 whitespace-normal")}>{c.title}</TableCell>
                <TableCell className={cn(TABLE_CELL, "text-right tabular-nums")}>{money(c.amount)}</TableCell>
                <TableCell className={cn(TABLE_CELL, "tabular-nums")}>{c.causeDate ? toLongDate(c.causeDate) : "Not yet"}</TableCell>
                <TableCell className={cn(TABLE_CELL, "tabular-nums")}>{c.fileBy ? toLongDate(c.fileBy) : "—"}</TableCell>
                <TableCell className={cn(TABLE_CELL, "tabular-nums", c.docs.have < c.docs.need && "text-warning-ink")}>
                  {c.docs.have} of {c.docs.need}
                </TableCell>
                <TableCell className={cn(TABLE_CELL, "pr-4 whitespace-normal")}>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <StageBadge stage={c.stage} />
                    {c.stage !== "filed" && c.flags.length ? (
                      <span className="text-caption text-muted-foreground tabular-nums">
                        {c.flags.length} flag{c.flags.length === 1 ? "" : "s"}
                      </span>
                    ) : null}
                    {c.caseFileNumber ? (
                      <span className="text-caption text-muted-foreground tabular-nums">{c.caseFileNumber}</span>
                    ) : null}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Sheet open={!!open} onOpenChange={(v) => !v && setOpen(null)}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
          {open ? (
            <>
              <SheetHeader>
                <SheetTitle>{open.title}</SheetTitle>
                <SheetDescription className="tabular-nums">{open.reference}</SheetDescription>
              </SheetHeader>
              <div className="flex flex-col gap-6 px-4 pb-6">
                <div className="flex flex-wrap items-center gap-2">
                  <StageBadge stage={open.stage} />
                  {open.receiptNumber ? <Badge variant="secondary" className="tabular-nums">Receipt {open.receiptNumber}</Badge> : null}
                </div>
                <dl className="grid grid-cols-2 gap-4 text-body-compact">
                  <div>
                    <dt className="text-caption text-muted-foreground">Cheque amount</dt>
                    <dd className="tabular-nums">{money(open.amount)}</dd>
                  </div>
                  <div>
                    <dt className="text-caption text-muted-foreground">Court fees</dt>
                    <dd className="tabular-nums">{money(open.fee)}</dd>
                  </div>
                  <div>
                    <dt className="text-caption text-muted-foreground">Cause of action</dt>
                    <dd className="tabular-nums">{open.causeDate ? toLongDate(open.causeDate) : "Not yet"}</dd>
                  </div>
                  <div>
                    <dt className="text-caption text-muted-foreground">File by</dt>
                    <dd className="tabular-nums">{open.fileBy ? toLongDate(open.fileBy) : "—"}</dd>
                  </div>
                  {open.caseFileNumber ? (
                    <div>
                      <dt className="text-caption text-muted-foreground">Case file number</dt>
                      <dd className="tabular-nums">{open.caseFileNumber}</dd>
                    </div>
                  ) : null}
                  {open.filedAt ? (
                    <div>
                      <dt className="text-caption text-muted-foreground">Filed</dt>
                      <dd className="tabular-nums">
                        {new Date(open.filedAt).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "medium", timeStyle: "short" })} IST
                      </dd>
                    </div>
                  ) : null}
                </dl>

                {open.flags.length && open.stage !== "filed" ? (
                  <section className="flex flex-col gap-2">
                    <h3 className="text-body-compact font-semibold">Flags</h3>
                    <ul className="flex flex-col gap-2">
                      {open.flags.map((f) => (
                        <li key={f.id}>
                          <FlagLine flag={f} />
                        </li>
                      ))}
                    </ul>
                  </section>
                ) : null}

                <section className="flex flex-col gap-2">
                  <h3 className="text-body-compact font-semibold">Documents</h3>
                  <ul className="flex flex-col divide-y divide-hairline rounded-lg border border-hairline">
                    {open.documents.map((d) => (
                      <li key={`${d.group}-${d.name}`} className="flex items-center gap-3 px-3 py-2 text-body-compact">
                        <FileTextIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                        <span className="min-w-0 flex-1">{d.name}</span>
                        {d.file ? (
                          <a href={fileUrl(d.file.id)} target="_blank" rel="noreferrer" className="text-primary underline-offset-4 hover:underline">
                            View
                          </a>
                        ) : d.required ? (
                          <Badge variant="warning">Missing</Badge>
                        ) : (
                          <span className="text-caption text-muted-foreground">Optional</span>
                        )}
                      </li>
                    ))}
                  </ul>
                </section>
              </div>
            </>
          ) : null}
        </SheetContent>
      </Sheet>
    </Card>
    ) : null}
    </div>
  );
}
