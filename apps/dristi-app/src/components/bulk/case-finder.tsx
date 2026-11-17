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
import { CheckIcon, ChevronDownIcon, ChevronLeftIcon, ChevronRightIcon, SearchIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Input } from "@/components/ui/input";
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
  /** Its status in a few words, as the screen's list says it. */
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
          className={cn("h-10 min-w-0 max-w-full justify-between gap-3 px-3 text-left font-normal", className)}
          aria-label={current ? `${label}: ${current.title}, ${current.draftNumber}` : label}
        >
          <span className="flex min-w-0 items-baseline gap-2">
            <span className="truncate font-medium">{current?.title ?? label}</span>
            {current ? <span className="shrink-0 font-mono text-body-compact text-muted-foreground">{current.draftNumber}</span> : null}
          </span>
          <ChevronDownIcon className="shrink-0 text-muted-foreground" aria-hidden />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[min(36rem,calc(100vw-2rem))] p-0">
        <Command shouldFilter={false} label={label}>
          <CommandInput value={q} onValueChange={setQ} placeholder="Search by party, draft number or cheque" />
          {groups.length ? (
            <div className="flex border-b border-hairline px-2 py-2">
              <FilterPills
                value={group}
                onChange={setGroup}
                total={cases.length}
                filters={groups.map((g) => ({ ...g, count: cases.filter((c) => c.group === g.id).length }))}
                label="Show cases"
              />
            </div>
          ) : null}
          <CommandList className="max-h-[min(24rem,50vh)]">
            <CommandEmpty>{term ? `No case matches “${q.trim()}”.` : "No case here."}</CommandEmpty>
            {shown.map((c) => (
              <CommandItem
                key={c.id}
                value={c.id}
                onSelect={() => {
                  onSelect(c.id);
                  setOpen(false);
                }}
                className="items-start gap-3 py-2.5"
              >
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="truncate text-body-compact font-medium text-foreground">{c.title}</span>
                  <span className="flex flex-wrap items-center gap-x-2 text-body-compact text-muted-foreground">
                    <span className="font-mono">{c.draftNumber}</span>
                    {c.status ? (
                      <>
                        <span aria-hidden>·</span>
                        {c.status}
                      </>
                    ) : null}
                  </span>
                </span>
                {c.id === value ? <CheckIcon className="mt-1 shrink-0" aria-label="This case" /> : null}
              </CommandItem>
            ))}
          </CommandList>
          {matches.length > SHOWN ? (
            <p className="flex items-center gap-2 border-t border-hairline px-3 py-2 text-body-compact text-muted-foreground tabular-nums">
              <SearchIcon className="size-4" aria-hidden />
              {SHOWN} of {matches.length} shown. Type a name or draft number to narrow them.
            </p>
          ) : null}
        </Command>
      </PopoverContent>
    </Popover>
  );
}

/**
 * "‹ [7] of 300 ›": the case's place among `count`, where the number can be typed and Enter
 * goes there, with the case before and after.
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
  /** What the count is of: "to fix or check". */
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
  return (
    <div className="flex shrink-0 items-center gap-1 text-body-compact tabular-nums">
      <Button variant="ghost" size="icon-sm" disabled={at <= 0} onClick={() => onGo(at - 1)} aria-label={prevLabel ?? "Previous case"}>
        <ChevronLeftIcon aria-hidden />
      </Button>
      <Input
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
        className="h-8 w-14 px-2 text-center"
      />
      <span className="whitespace-nowrap text-muted-foreground">
        of {count}
        {of ? ` ${of}` : ""}
      </span>
      <Button variant="ghost" size="icon-sm" disabled={at >= count - 1} onClick={() => onGo(at + 1)} aria-label={nextLabel ?? "Next case"}>
        <ChevronRightIcon aria-hidden />
      </Button>
    </div>
  );
}
