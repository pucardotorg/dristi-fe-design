"use client";

/**
 * Finding one case among hundreds (owner, 2026-11-17: Previous and Next don't carry a
 * filer across 300 to 400 cases, and a case is read by its full title, Party vs Party).
 *
 *  · `CaseFinder`: the current case's full title and draft number, as a button; it opens
 *    a list of the batch's cases to search by party, draft number or cheque, narrowed by
 *    the screen's own filters (To fix, To check; From the Excel, Batch text), each row
 *    with its status. The keyboard moves through it and Enter opens one.
 *  · `CaseStepper`: the position, "7 of 300", where the number can be typed to jump, with
 *    the case either side.
 *
 * Shared by the case strip (`case-flow.tsx`) and Facts of the case (`check-step.tsx`), so a
 * filer finds a case the same way wherever they are.
 */

import * as React from "react";
import { Command as CommandPrimitive } from "cmdk";
import { ChevronDownIcon, ChevronLeftIcon, ChevronRightIcon, SearchIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

import { FilterPills } from "./filter-pills";

export type FinderCase = {
  id: string;
  /** "Tata Capital Ltd vs. Paresh V. Panchal": how a case is read. */
  title: string;
  draftNumber: string;
  cheque?: string;
  /** Which of the screen's filters it is in. */
  group: string;
  /**
   * Its status as a mark, the word and its icon only (owner, 2026-11-17: the list flags a
   * case; the case itself says what is wrong). Nothing for a case with nothing open.
   */
  status?: React.ReactNode;
};

/** Rows drawn at once; the search narrows the rest. */
const SHOWN = 60;

export function CaseFinder({
  cases,
  groups,
  value,
  onSelect,
  label = "Find a case",
  className,
}: {
  cases: FinderCase[];
  /** The screen's filters, in order, with their names; "All" comes first on its own. */
  groups: { id: string; label: string }[];
  value: string;
  onSelect: (id: string) => void;
  label?: string;
  className?: string;
}) {
  const [open, setOpen] = React.useState(false);
  const [q, setQ] = React.useState("");
  const current = cases.find((c) => c.id === value) ?? null;
  // Opens on the current case's own filter, so its neighbours come first.
  const [group, setGroup] = React.useState("all");
  const term = q.trim().toLowerCase();
  const inGroup = cases.filter((c) => group === "all" || c.group === group);
  const matches = term
    ? inGroup.filter((c) => [c.title, c.draftNumber, c.cheque ?? ""].some((v) => v.toLowerCase().includes(term)))
    : inGroup;
  const shown = matches.slice(0, SHOWN);

  return (
    <Popover
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) {
          setQ("");
          setGroup(current?.group ?? "all");
        }
      }}
    >
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          // A field on the card, not a pressed button: it keeps the card's white when open and
          // shows it is open by its edge (owner, 2026-11-17: the grey fill read as dirty).
          className={cn(
            "h-10 min-w-0 max-w-full justify-between gap-3 px-3 text-left font-normal hover:bg-card aria-expanded:border-ring aria-expanded:bg-card dark:bg-card",
            className,
          )}
          aria-label={current ? `${label}: ${current.title}, ${current.draftNumber}` : label}
        >
          <span className="flex min-w-0 items-baseline gap-2">
            <span className="truncate font-medium">{current?.title ?? label}</span>
            {current ? <span className="shrink-0 font-mono text-body-compact text-muted-foreground tabular-nums">{current.draftNumber}</span> : null}
          </span>
          <ChevronDownIcon className="shrink-0 text-muted-foreground" aria-hidden />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[min(32rem,calc(100vw-2rem))] gap-0 overflow-hidden p-0">
        <Command shouldFilter={false} label={label} className="rounded-none bg-transparent p-0">
          {/* A quiet search line, not a filled box: the hairline under it is its edge. */}
          <label className="flex h-11 items-center gap-2 border-b border-hairline px-3 text-muted-foreground">
            <SearchIcon className="size-4 shrink-0" aria-hidden />
            <CommandPrimitive.Input
              value={q}
              onValueChange={setQ}
              placeholder="Search by party, draft number or cheque"
              className="h-full min-w-0 flex-1 bg-transparent text-body-compact text-foreground outline-none placeholder:text-muted-foreground"
            />
          </label>
          {groups.length ? (
            <div className="flex border-b border-hairline px-3 py-2">
              <FilterPills
                size="sm"
                value={group}
                onChange={setGroup}
                total={cases.length}
                filters={groups.map((g) => ({ ...g, count: cases.filter((c) => c.group === g.id).length }))}
                label="Show cases"
              />
            </div>
          ) : null}
          <CommandList className="max-h-[min(22rem,50vh)] p-1.5">
            <CommandEmpty className="py-6 text-center text-body-compact text-muted-foreground">
              {term ? `No case matches “${q.trim()}”.` : "No case here."}
            </CommandEmpty>
            {shown.map((c) => (
              <CommandItem
                key={c.id}
                value={c.id}
                onSelect={() => {
                  onSelect(c.id);
                  setOpen(false);
                }}
                // One height for every row: two lines, nothing wraps (title truncates).
                data-checked={c.id === value}
                className="h-14 gap-3 rounded-md px-2.5 py-0 data-selected:bg-surface-sunken"
              >
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="truncate text-body-compact font-medium text-foreground">{c.title}</span>
                  <span className="flex min-w-0 items-center gap-3 text-body-compact text-muted-foreground">
                    <span className="shrink-0 font-mono tabular-nums">{c.draftNumber}</span>
                    {c.status ? <span className="min-w-0 truncate">{c.status}</span> : null}
                  </span>
                </span>
                {c.id === value ? <span className="sr-only">(this case)</span> : null}
              </CommandItem>
            ))}
          </CommandList>
          {/* Said only when the list is cut short, and quietly. */}
          {matches.length > SHOWN ? (
            <p className="border-t border-hairline px-3 py-2 text-body-compact text-muted-foreground tabular-nums">
              First {SHOWN} of {matches.length}. Search to find the rest.
            </p>
          ) : null}
        </Command>
      </PopoverContent>
    </Popover>
  );
}

/**
 * "‹ 7 / 300 ›": the case's place among `count` as one quiet control. The number is a
 * borderless field that shows its edge on hover and focus; typing a number and Enter goes
 * there, Escape puts it back (owner, 2026-11-17: the boxed input read as unpolished).
 */
export function CaseStepper({
  at,
  count,
  onGo,
  of = "",
  prevLabel,
  nextLabel,
}: {
  /** Zero-based. */
  at: number;
  count: number;
  onGo: (index: number) => void;
  /** What the count is of, for the field's label: "to fix or check". */
  of?: string;
  prevLabel?: string;
  nextLabel?: string;
}) {
  const [draft, setDraft] = React.useState<string | null>(null);
  const go = () => {
    const n = Number(draft);
    if (Number.isInteger(n) && n >= 1 && n <= count && n - 1 !== at) onGo(n - 1);
    setDraft(null);
  };
  // Wide enough for the batch's largest number, so the control never shifts as it changes.
  const digits = String(count).length;
  return (
    <div className="flex h-8 shrink-0 items-center rounded-lg border border-hairline bg-card text-body-compact tabular-nums">
      <Button
        variant="ghost"
        size="icon-sm"
        className="rounded-r-none text-muted-foreground"
        disabled={at <= 0}
        onClick={() => onGo(at - 1)}
        aria-label={prevLabel ?? "Previous case"}
      >
        <ChevronLeftIcon aria-hidden />
      </Button>
      <span className="flex h-full items-center gap-1 border-x border-hairline pr-2.5 pl-1">
        <input
          inputMode="numeric"
          aria-label={`Case number, of ${count}${of ? ` ${of}` : ""}. Type a number and press Enter to go to it.`}
          value={draft ?? String(at + 1)}
          onFocus={(e) => {
            setDraft(String(at + 1));
            e.currentTarget.select();
          }}
          onChange={(e) => setDraft(e.target.value.replace(/\D/g, "").slice(0, 4))}
          onBlur={go}
          onKeyDown={(e) => {
            if (e.key === "Enter") e.currentTarget.blur();
            if (e.key === "Escape") {
              setDraft(null);
              e.currentTarget.blur();
            }
          }}
          style={{ width: `calc(${digits}ch + 0.75rem)` }}
          className="h-6 rounded-sm border border-transparent bg-transparent px-1 text-right font-medium text-foreground outline-none transition-colors hover:border-input focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-focus-ring"
        />
        <span className="text-muted-foreground">/ {count}</span>
      </span>
      <Button
        variant="ghost"
        size="icon-sm"
        className="rounded-l-none text-muted-foreground"
        disabled={at >= count - 1}
        onClick={() => onGo(at + 1)}
        aria-label={nextLabel ?? "Next case"}
      >
        <ChevronRightIcon aria-hidden />
      </Button>
    </div>
  );
}
