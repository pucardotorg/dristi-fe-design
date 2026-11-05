"use client";

import * as React from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

import { money } from "@/lib/filing/format";
import { cn } from "@/lib/utils";
import {
  TABLE_CELL,
  TABLE_HEAD,
  TABLE_HEAD_ROW,
  tableBodyClass,
  tableRowClass,
} from "@/components/chrome/table-plate";
import { FilingFooter } from "@/components/filing/filing-footer";
import { Card } from "@/components/ui/card";
import { SegmentedControl, SegmentedControlItem } from "@/components/ui/segmented-control";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

import { caseFlowHref, type CaseView } from "./api";
import { BatchFooter } from "./batch-footer";
import { batchTallies, caseState, type CaseState } from "./batch-marks";
import type { BatchCtx } from "./batch-screen";
import { CaseSearch, FileBy, Pager, caseMatches, pageOf } from "./case-list-tools";
import { CaseBadge } from "./stage";

type Show = "all" | CaseState;

/** The filters, in the order the steps meet them; a filter with nothing in it is left out. */
const FILTERS: { id: CaseState; label: string }[] = [
  { id: "fix", label: "To fix" },
  { id: "check", label: "To check" },
  { id: "docs", label: "Missing documents" },
  { id: "complete", label: "Complete" },
  { id: "signed", label: "Signed" },
];

/**
 * Every case still to be filed, read the way Case details reads them: a filter, the shared
 * search, 25 at a time. One fact per column and only the case's own facts; what the batch
 * shares (the complainant) is in Common details. A case opens in its sections.
 */
export function CasesTab({ batch, go }: BatchCtx) {
  const ai = useSearchParams().get("ai");
  const pending = batch.cases.filter((c) => c.stage !== "filed");
  const filed = batch.cases.length - pending.length;
  const [show, setShow] = React.useState<Show>("all");
  const [search, setSearch] = React.useState("");
  const [page, setPage] = React.useState(0);

  // "Missing documents" is the Documents step's own count, so it can include a case that
  // also has a detail to check: the same number the steps show.
  const docs = new Set(batchTallies(batch).docsCases.map((c) => c.id));
  const inFilter = (c: CaseView, s: CaseState) => (s === "docs" ? docs.has(c.id) : caseState(c) === s);
  const count = (s: CaseState) => pending.filter((c) => inFilter(c, s)).length;
  const listed = pending.filter((c) => (show === "all" || inFilter(c, show)) && caseMatches(c, search));
  const { pages, at, shown } = pageOf(listed, page);
  const open = (c: CaseView) => caseFlowHref(batch.id, c, undefined, ai);

  return (
    <div className="flex flex-col gap-4">
      {filed ? (
        <p className="text-body-compact text-muted-foreground tabular-nums">
          {filed} filed, listed under{" "}
          <button type="button" className="underline" onClick={() => go("filed")}>
            Filed
          </button>
          .
        </p>
      ) : null}
      {pending.length ? (
        <>
          <div className="flex flex-wrap items-center gap-3">
            <SegmentedControl
              type="single"
              value={show}
              onValueChange={(v) => {
                if (!v) return;
                setShow(v as Show);
                setPage(0);
              }}
              aria-label="Show cases"
              className="max-w-full overflow-x-auto"
            >
              <SegmentedControlItem value="all">All {pending.length}</SegmentedControlItem>
              {FILTERS.filter((f) => count(f.id)).map((f) => (
                <SegmentedControlItem key={f.id} value={f.id}>
                  {f.label} {count(f.id)}
                </SegmentedControlItem>
              ))}
            </SegmentedControl>
            <CaseSearch
              id="cases-search"
              value={search}
              onChange={(v) => {
                setSearch(v);
                setPage(0);
              }}
            />
          </div>
          <Card variant="raised" className="gap-0 p-2">
            {shown.length === 0 ? (
              <p className="p-4 text-body-compact text-muted-foreground">
                {search.trim() ? `No case matches “${search.trim()}”.` : "No case here."}
              </p>
            ) : (
              <>
                <div className="hidden md:block">
                  <Table className="border-separate border-spacing-0" aria-label="Cases in this batch">
                    <TableHeader>
                      <TableRow className={TABLE_HEAD_ROW}>
                        <TableHead className={TABLE_HEAD}>Accused</TableHead>
                        <TableHead className={TABLE_HEAD}>Your reference</TableHead>
                        <TableHead className={cn(TABLE_HEAD, "text-right")}>Cheque amount</TableHead>
                        <TableHead className={TABLE_HEAD}>File by</TableHead>
                        <TableHead className={TABLE_HEAD}>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody className={tableBodyClass()}>
                      {shown.map((c) => (
                        <TableRow key={c.id} className={tableRowClass()}>
                          <TableCell className={cn(TABLE_CELL, "whitespace-normal")}>
                            <Link href={open(c)} className="font-medium hover:underline">
                              {c.accused || c.title}
                            </Link>
                          </TableCell>
                          <TableCell className={cn(TABLE_CELL, "font-mono")}>{c.reference}</TableCell>
                          <TableCell className={cn(TABLE_CELL, "text-right tabular-nums")}>{money(c.amount)}</TableCell>
                          <TableCell className={cn(TABLE_CELL, "whitespace-normal")}>
                            <FileBy c={c} />
                          </TableCell>
                          <TableCell className={cn(TABLE_CELL, "whitespace-normal")}>
                            <CaseBadge c={c} />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                <ul className="flex flex-col divide-y divide-hairline md:hidden">
                  {shown.map((c) => (
                    <li key={c.id}>
                      <Link
                        href={open(c)}
                        className="flex flex-col gap-1 rounded-lg px-2 py-3 hover:bg-accent focus-visible:ring-3 focus-visible:ring-focus-ring focus-visible:outline-none"
                      >
                        <span className="text-body-compact font-medium">{c.accused || c.title}</span>
                        <span className="text-body-compact text-muted-foreground">
                          <span className="font-mono">{c.reference}</span>
                          <span className="tabular-nums"> · {money(c.amount)}</span>
                        </span>
                        <span>
                          <CaseBadge c={c} />
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </>
            )}
            <Pager total={listed.length} at={at} pages={pages} onPage={setPage} />
          </Card>
        </>
      ) : (
        <p className="text-body-compact text-muted-foreground">Every case in this batch is filed.</p>
      )}
      <BatchFooter>
        <FilingFooter
          showSaveState={false}
          onBack={() => go("common")}
          continueLabel="Case details"
          onContinue={() => go("scrutiny")}
        />
      </BatchFooter>
    </div>
  );
}
