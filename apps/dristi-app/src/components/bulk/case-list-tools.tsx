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
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";

import type { CaseView } from "./api";
import { toListTop } from "./list-dock";

export const PAGE_SIZE = 25;

/** Whether a case answers a search: by accused, title, draft number or cheque. */
export function caseMatches(c: CaseView, term: string): boolean {
  const t = term.trim().toLowerCase();
  return !t || [c.accused, c.title, c.draftNumber, c.cheque].some((v) => v.toLowerCase().includes(t));
}

/** One page of a list, and the page actually shown when the list got shorter. */
export function pageOf<T>(list: T[], page: number, size: number = PAGE_SIZE) {
  const pages = Math.max(1, Math.ceil(list.length / size));
  const at = Math.min(page, pages - 1);
  return { pages, at, shown: list.slice(at * size, (at + 1) * size) };
}

export function CaseSearch({
  id,
  value,
  onChange,
  className,
  placeholder = "Accused, draft number or cheque",
  label = "Search cases",
}: {
  id: string;
  /** The field's name for a screen reader (the placeholder is only a hint). */
  label?: string;
  value: string;
  onChange: (v: string) => void;
  className?: string;
  placeholder?: string;
}) {
  return (
    <div className={cn("w-full sm:ml-auto sm:w-72", className)}>
      <Label htmlFor={id} className="sr-only">
        {label}
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
          placeholder={placeholder}
        />
      </InputGroup>
    </div>
  );
}

/**
 * A list's place in its pages, at the top of the list where the eye already is (owner,
 * 2026-11-17: at 25 tall rows a page runs two screens, and a pager only at its foot was
 * found only by scrolling past it all). "1–25 of 229" with the page either side.
 */
export function PagerTop({
  total,
  at,
  pages,
  onPage,
  size = PAGE_SIZE,
}: {
  total: number;
  at: number;
  pages: number;
  onPage: (p: number) => void;
  /** Rows a page holds, where the list lets the filer choose (`Pager`'s `sizes`). */
  size?: number;
}) {
  const ref = React.useRef<HTMLDivElement>(null);
  if (total <= size) return null;
  // Pinned with the list's toolbar, a page turned from here starts at its first row.
  const go = (p: number) => {
    onPage(p);
    toListTop(ref.current);
  };
  return (
    <div ref={ref} className="flex shrink-0 items-center gap-1 text-body-compact text-muted-foreground">
      <span className="px-1 tabular-nums">
        <span className="text-foreground">
          {at * size + 1}–{Math.min(total, (at + 1) * size)}
        </span>{" "}
        of {total}
      </span>
      <Button variant="ghost" size="icon-sm" aria-label="Previous page" disabled={at === 0} onClick={() => go(at - 1)}>
        <ChevronLeftIcon aria-hidden />
      </Button>
      <Button variant="ghost" size="icon-sm" aria-label="Next page" disabled={at >= pages - 1} onClick={() => go(at + 1)}>
        <ChevronRightIcon aria-hidden />
      </Button>
    </div>
  );
}

/** The page numbers to show: the first, the last, and the current one with its neighbours. */
function pageNumbers(at: number, pages: number): (number | "gap")[] {
  const keep = new Set([0, pages - 1, at - 1, at, at + 1].filter((p) => p >= 0 && p < pages));
  const out: (number | "gap")[] = [];
  [...keep]
    .sort((x, y) => x - y)
    .forEach((p, i, all) => {
      if (i && p - all[i - 1] > 1) out.push(p - all[i - 1] === 2 ? p - 1 : "gap");
      out.push(p);
    });
  return out;
}

/**
 * The foot of a list: the range, and every page within reach by number, so page 7 of 10 is
 * one press, not six. Changing page from here brings the list's top back into view. A list
 * whose rows are tall can offer a choice of page size (`sizes`), read beside the range.
 */
export function Pager({
  total,
  at,
  pages,
  onPage,
  size = PAGE_SIZE,
  sizes,
  onSize,
}: {
  total: number;
  at: number;
  pages: number;
  onPage: (p: number) => void;
  size?: number;
  /** The page sizes on offer, smallest first; with `onSize`, a "10 per page" select. */
  sizes?: readonly number[];
  onSize?: (n: number) => void;
}) {
  const ref = React.useRef<HTMLElement>(null);
  const choose = sizes && onSize && sizes.length > 1;
  // A choice of size stays on offer while the list is longer than the smallest page.
  if (total <= (choose ? sizes[0] : size)) return null;
  const go = (p: number) => {
    onPage(p);
    // A docked list goes back to its pinned toolbar's place; any other to its panel's top.
    if (toListTop(ref.current)) return;
    const list = ref.current?.closest("[data-slot=card]") ?? ref.current?.parentElement;
    requestAnimationFrame(() => list?.scrollIntoView({ block: "start", behavior: "smooth" }));
  };
  return (
    <nav
      ref={ref}
      aria-label="Pages"
      data-list-pager
      className="flex flex-wrap items-center justify-between gap-3 border-t border-hairline px-2 pt-3 pb-1 text-body-compact text-muted-foreground"
    >
      <span className="flex items-center gap-3">
        <span className="tabular-nums">
          {at * size + 1}–{Math.min(total, (at + 1) * size)} of {total}
        </span>
        {choose ? (
          <NativeSelect
            size="sm"
            aria-label="Cases per page"
            value={String(size)}
            onChange={(e) => onSize(Number(e.target.value))}
            className="w-auto [&_select]:text-body-compact"
          >
            {sizes.map((n) => (
              <NativeSelectOption key={n} value={String(n)}>
                {n} per page
              </NativeSelectOption>
            ))}
          </NativeSelect>
        ) : null}
      </span>
      <span className="flex items-center gap-1 tabular-nums">
        <Button variant="ghost" size="icon-sm" aria-label="Previous page" disabled={at === 0} onClick={() => go(at - 1)}>
          <ChevronLeftIcon aria-hidden />
        </Button>
        {pageNumbers(at, pages).map((p, i) =>
          p === "gap" ? (
            <span key={`gap-${i}`} aria-hidden className="w-6 text-center">
              …
            </span>
          ) : (
            <Button
              key={p}
              variant="ghost"
              size="sm"
              aria-label={`Page ${p + 1}`}
              aria-current={p === at ? "page" : undefined}
              onClick={() => p !== at && go(p)}
              className={cn(
                "min-w-8 px-2 font-normal text-muted-foreground",
                p === at && "bg-accent font-medium text-foreground hover:bg-accent",
              )}
            >
              {p + 1}
            </Button>
          ),
        )}
        <Button variant="ghost" size="icon-sm" aria-label="Next page" disabled={at >= pages - 1} onClick={() => go(at + 1)}>
          <ChevronRightIcon aria-hidden />
        </Button>
      </span>
    </nav>
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
