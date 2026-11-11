"use client";

/**
 * The header and pager every list of a batch's cases shares: one search, one placeholder,
 * one way of reading 25 at a time (round 3: the Cases table and the Review list had none,
 * and the lists that had them disagreed on labels and order).
 */

import * as React from "react";
import { ChevronLeftIcon, ChevronRightIcon, SearchIcon } from "lucide-react";

import { toLongDate } from "@/lib/filing/format";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { Label } from "@/components/ui/label";

import type { CaseView } from "./api";

export const PAGE_SIZE = 25;

/** Whether a case answers a search: by accused, title, reference or cheque. */
export function caseMatches(c: CaseView, term: string): boolean {
  const t = term.trim().toLowerCase();
  return !t || [c.accused, c.title, c.reference, c.cheque].some((v) => v.toLowerCase().includes(t));
}

/** One page of a list, and the page actually shown when the list got shorter. */
export function pageOf<T>(list: T[], page: number) {
  const pages = Math.max(1, Math.ceil(list.length / PAGE_SIZE));
  const at = Math.min(page, pages - 1);
  return { pages, at, shown: list.slice(at * PAGE_SIZE, (at + 1) * PAGE_SIZE) };
}

export function CaseSearch({
  id,
  value,
  onChange,
  className,
}: {
  id: string;
  value: string;
  onChange: (v: string) => void;
  className?: string;
}) {
  return (
    <div className={cn("w-full sm:ml-auto sm:w-72", className)}>
      <Label htmlFor={id} className="sr-only">
        Search cases
      </Label>
      <InputGroup>
        <InputGroupAddon>
          <SearchIcon aria-hidden />
        </InputGroupAddon>
        <InputGroupInput
          id={id}
          type="search"
          autoComplete="off"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Accused, reference or cheque"
        />
      </InputGroup>
    </div>
  );
}

export function Pager({
  total,
  at,
  pages,
  onPage,
}: {
  total: number;
  at: number;
  pages: number;
  onPage: (p: number) => void;
}) {
  if (total <= PAGE_SIZE) return null;
  return (
    <div className="flex items-center justify-between gap-3 px-2 pt-3 pb-1 text-body-compact text-muted-foreground">
      <span className="tabular-nums">
        {at * PAGE_SIZE + 1}–{Math.min(total, (at + 1) * PAGE_SIZE)} of {total}
      </span>
      <span className="flex items-center gap-1">
        <Button variant="ghost" size="icon" aria-label="Previous page" disabled={at === 0} onClick={() => onPage(at - 1)}>
          <ChevronLeftIcon aria-hidden />
        </Button>
        <span className="tabular-nums">
          Page {at + 1} of {pages}
        </span>
        <Button variant="ghost" size="icon" aria-label="Next page" disabled={at >= pages - 1} onClick={() => onPage(at + 1)}>
          <ChevronRightIcon aria-hidden />
        </Button>
      </span>
    </div>
  );
}

/**
 * The last day to file, marked once it has gone by: a late complaint needs a
 * delay-condonation application, which the case's own sections prepare (round 3: a passed
 * date read like any other).
 */
export function FileBy({ c }: { c: Pick<CaseView, "fileBy" | "stage"> }) {
  if (!c.fileBy) return <span className="text-muted-foreground">Not yet known</span>;
  const passed = c.stage !== "filed" && c.fileBy < new Date().toISOString().slice(0, 10);
  return (
    <span className="flex flex-col">
      <span className="tabular-nums">{toLongDate(c.fileBy)}</span>
      {passed ? <span className="text-warning-ink">Passed · needs condonation</span> : null}
    </span>
  );
}

/** Under a case row, only when its last day to file has passed: said once, in amber. */
export function LimitPassed({ c }: { c: Pick<CaseView, "fileBy" | "stage"> }) {
  if (!c.fileBy || c.stage === "filed" || c.fileBy >= new Date().toISOString().slice(0, 10)) return null;
  return (
    <span className="block text-body-compact text-warning-ink tabular-nums">
      File by {toLongDate(c.fileBy)} passed · needs condonation
    </span>
  );
}
