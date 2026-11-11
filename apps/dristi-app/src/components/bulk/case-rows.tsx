"use client";

/**
 * The one case list of the Cases step: Check before the batch is created, and the same
 * list when the step is revisited after (owner, 2026-11-11: coming back to a step shows
 * the step, never a different view of it). A filter, the shared search, 25 at a time.
 *
 * Each row is the case row of the audit: every accused, then cheque and amount (the
 * total, "2 cheques" when there are more), the reference, and the status in its one form.
 * On a phone the same order stacks, so nothing scrolls sideways.
 */

import * as React from "react";
import Link from "next/link";

import { money } from "@/lib/filing/format";
import { cn } from "@/lib/utils";
import {
  TABLE_CELL,
  TABLE_HEAD,
  TABLE_HEAD_ROW,
  tableBodyClass,
  tableRowClass,
} from "@/components/chrome/table-plate";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

import { CaseSearch, Pager, pageOf } from "./case-list-tools";
import { FilterPills } from "./filter-pills";

export type CaseRow = {
  key: string;
  reference: string;
  /** Every accused, joined. */
  accused: string;
  cheque: string;
  cheques: number;
  /** The total of every cheque. */
  amount: number;
  /** Which filter the row is in. */
  state: string;
  status: React.ReactNode;
  /** Under the cheque line: the last day to file, for a case near it. */
  extra?: React.ReactNode;
  /** Opens the case; absent before the cases exist. */
  href?: string;
};

/** "Cheque 204511 · ₹1,48,500", or "2 cheques · ₹3,34,000". */
export function chequeLine(r: Pick<CaseRow, "cheque" | "cheques" | "amount">): string {
  const which = r.cheques > 1 ? `${r.cheques} cheques` : r.cheque ? `Cheque ${r.cheque}` : "";
  return [which, r.amount ? money(r.amount) : ""].filter(Boolean).join(" · ");
}

export function CaseRows({
  rows,
  filters,
  label,
  searchId,
}: {
  rows: CaseRow[];
  /** In the order the steps meet them; one with nothing in it is left out. */
  filters: { id: string; label: string }[];
  label: string;
  searchId: string;
}) {
  const [show, setShow] = React.useState("all");
  const [q, setQ] = React.useState("");
  const [page, setPage] = React.useState(0);
  const inFilter = (r: CaseRow, id: string) => r.state === id;
  const count = (id: string) => rows.filter((r) => inFilter(r, id)).length;
  const term = q.trim().toLowerCase();
  const list = rows
    .filter((r) => show === "all" || inFilter(r, show))
    .filter((r) => !term || [r.accused, r.reference, r.cheque].some((v) => v.toLowerCase().includes(term)));
  const { pages, at, shown } = pageOf(list, page);

  const who = (r: CaseRow) =>
    r.href ? (
      <Link href={r.href} className="font-medium hover:underline">
        {r.accused || "—"}
      </Link>
    ) : (
      <span className="font-medium">{r.accused || "—"}</span>
    );

  return (
    <section aria-label={label} className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-3">
        <FilterPills
          value={show}
          onChange={(v) => {
            setShow(v);
            setPage(0);
          }}
          total={rows.length}
          filters={filters.map((f) => ({ ...f, count: count(f.id) }))}
        />
        <CaseSearch
          id={searchId}
          value={q}
          onChange={(v) => {
            setQ(v);
            setPage(0);
          }}
        />
      </div>
      <Card variant="raised" className="gap-0 p-2">
        {shown.length === 0 ? (
          <p className="p-4 text-body-compact text-muted-foreground">
            {term ? `No case matches “${q.trim()}”.` : "No case here."}
          </p>
        ) : (
          <>
            <div className="hidden md:block">
              <Table className="border-separate border-spacing-0" aria-label={label}>
                <TableHeader>
                  <TableRow className={TABLE_HEAD_ROW}>
                    <TableHead className={TABLE_HEAD}>Accused</TableHead>
                    <TableHead className={TABLE_HEAD}>Your reference</TableHead>
                    <TableHead className={TABLE_HEAD}>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody className={tableBodyClass({ hover: false })}>
                  {shown.map((r) => (
                    <TableRow key={r.key} className={tableRowClass({ hover: false })}>
                      <TableCell className={cn(TABLE_CELL, "min-w-64 whitespace-normal")}>
                        {who(r)}
                        <span className="block text-body-compact text-muted-foreground tabular-nums">{chequeLine(r)}</span>
                        {r.extra}
                      </TableCell>
                      <TableCell className={cn(TABLE_CELL, "font-mono")}>{r.reference || "—"}</TableCell>
                      <TableCell className={cn(TABLE_CELL, "w-full min-w-64 whitespace-normal")}>{r.status}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <ul className="flex flex-col divide-y divide-hairline md:hidden">
              {shown.map((r) => (
                <li key={r.key} className="flex flex-col gap-1 px-2 py-3 text-body-compact">
                  {who(r)}
                  <span className="text-muted-foreground tabular-nums">
                    <span className="font-mono">{r.reference}</span>
                    {chequeLine(r) ? ` · ${chequeLine(r)}` : ""}
                  </span>
                  {r.extra}
                  <span>{r.status}</span>
                </li>
              ))}
            </ul>
          </>
        )}
        <Pager total={list.length} at={at} pages={pages} onPage={setPage} />
      </Card>
    </section>
  );
}
