"use client";

import * as React from "react";

import { money, toLongDate } from "@/lib/filing/format";
import { cn } from "@/lib/utils";
import {
  TABLE_CELL,
  TABLE_HEAD,
  TABLE_HEAD_ROW,
  tableBodyClass,
  tableRowClass,
} from "@/components/chrome/table-plate";

import { Card } from "@/components/ui/card";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import type { BatchCtx } from "./batch-screen";

import { CaseBadge } from "./stage";

export function CasesTab({ batch, go }: BatchCtx) {
  // Pending cases only; filed ones live under Filed.
  const pending = batch.cases.filter((c) => c.stage !== "filed");
  const filed = batch.cases.length - pending.length;

  return (
    <div className="flex flex-col gap-3">
      {filed ? (
        <p className="text-body-compact text-muted-foreground tabular-nums">
          {pending.length ? `${pending.length} pending. ` : "Nothing pending. "}
          {filed} filed.{" "}
          <button
            type="button"
            className="underline"
            onClick={() => go("filed")}
          >
            See filed cases
          </button>
        </p>
      ) : null}
      {pending.length ? (
        <Card variant="raised" className="gap-0 py-0">
          <div className="overflow-x-auto p-2">
            <Table
              className="border-separate border-spacing-0"
              aria-label="Cases in this batch"
            >
              <TableHeader>
                <TableRow className={TABLE_HEAD_ROW}>
                  <TableHead className={cn(TABLE_HEAD, "pl-4")}>
                    Reference
                  </TableHead>
                  <TableHead className={TABLE_HEAD}>Parties</TableHead>
                  <TableHead className={cn(TABLE_HEAD, "text-right")}>
                    Cheque amount
                  </TableHead>
                  <TableHead className={TABLE_HEAD}>Cause of action</TableHead>
                  <TableHead className={TABLE_HEAD}>File by</TableHead>
                  <TableHead className={TABLE_HEAD}>Documents</TableHead>
                  <TableHead className={cn(TABLE_HEAD, "pr-4")}>
                    Status
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody className={tableBodyClass()}>
                {pending.map((c) => (
                  <TableRow
                    key={c.id}
                    className={cn(tableRowClass(), "cursor-pointer")}
                    onClick={() => go("scrutiny", c.id)}
                  >
                    <TableCell
                      className={cn(
                        TABLE_CELL,
                        "pl-4 font-medium tabular-nums",
                      )}
                    >
                      <button
                        type="button"
                        className="text-left hover:underline focus-visible:underline"
                        onClick={(e) => {
                          e.stopPropagation();
                          go("scrutiny", c.id);
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
                    <TableCell
                      className={cn(TABLE_CELL, "text-right tabular-nums")}
                    >
                      {money(c.amount)}
                    </TableCell>
                    <TableCell className={cn(TABLE_CELL, "tabular-nums")}>
                      {c.causeDate ? toLongDate(c.causeDate) : "Not yet"}
                    </TableCell>
                    <TableCell className={cn(TABLE_CELL, "tabular-nums")}>
                      {c.fileBy ? toLongDate(c.fileBy) : "—"}
                    </TableCell>
                    <TableCell
                      className={cn(
                        TABLE_CELL,
                        "tabular-nums",
                        c.docs.have < c.docs.need && "text-warning-ink",
                      )}
                    >
                      {c.docs.have} of {c.docs.need}
                    </TableCell>
                    <TableCell
                      className={cn(TABLE_CELL, "pr-4 whitespace-normal")}
                    >
                      <div className="flex flex-wrap items-center gap-1.5">
                        <CaseBadge c={c} />
                        {c.stage !== "filed" && c.flags.length ? (
                          <span className="text-caption text-muted-foreground tabular-nums">
                            {c.flags.length} flag
                            {c.flags.length === 1 ? "" : "s"}
                          </span>
                        ) : null}
                        {c.caseFileNumber ? (
                          <span className="text-caption text-muted-foreground tabular-nums">
                            {c.caseFileNumber}
                          </span>
                        ) : null}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </Card>
      ) : null}
    </div>
  );
}
