"use client";

import * as React from "react";
import { SearchIcon, SlidersHorizontalIcon, XIcon } from "lucide-react";

import {
  DUE_LABELS,
  CATEGORY_LABELS,
  CATEGORY_ORDER,
  type DueFilter,
  type Filters,
} from "@/lib/tasks/selectors";
import type { Person, TaskCategory } from "@/lib/tasks/types";
import { cn } from "@/lib/utils";
import { useMediaQuery } from "@/hooks/use-media-query";
import { CheckGroup } from "@/components/cases/cases-filters";
import { AppliedChip } from "@/components/shell/applied-chip";
import { Button } from "@/components/ui/button";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { Kbd } from "@/components/ui/kbd";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

const DUES: DueFilter[] = ["overdue", "today", "week", "before-hearing"];

/**
 * Where the kind pills show: a mouse at `md` and up. On a phone or a tablet the
 * row of six ran off the screen and scrolled sideways (owner, Sept 21), so there
 * the kinds move into the Filters sheet as its first group, and report
 * themselves as chips like every other filter the sheet holds.
 */
export const KIND_PILLS_ONLY = "hidden md:pointer-fine:block";
const KIND_IN_SHEET_ONLY = "md:pointer-fine:hidden";

/**
 * The list's own search — local to this screen, not app chrome (owner, 2026-08-24).
 *
 * It used to live in the global top bar and only *render* on this route, which is a
 * local search wearing chrome's clothes: it looked app-wide, sat far from the list it
 * narrowed, and vanished on every other page. Here it sits beside the thing it filters.
 * Typing echoes locally and the URL follows after a pause, so keystrokes never pile up
 * history or jump the page; `/` still focuses it.
 */
function SearchBox({ query, onChange }: { query: string; onChange: (q: string) => void }) {
  const ref = React.useRef<HTMLInputElement>(null);
  const [text, setText] = React.useState(query);
  // When the URL changes underneath (Clear, back/forward), follow it.
  const [seen, setSeen] = React.useState(query);
  if (seen !== query) {
    setSeen(query);
    setText(query);
  }

  React.useEffect(() => {
    if (text === query) return;
    const t = window.setTimeout(() => onChange(text), 200);
    return () => window.clearTimeout(t);
  }, [text, query, onChange]);

  React.useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "/" || event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      if (target?.closest("input, textarea, select, [contenteditable=true], [role=dialog]")) return;
      event.preventDefault();
      ref.current?.focus();
      ref.current?.select();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <InputGroup className="min-w-0 flex-1 md:pointer-fine:w-64 md:pointer-fine:flex-none">
      <InputGroupAddon>
        <SearchIcon aria-hidden />
      </InputGroupAddon>
      <InputGroupInput
        ref={ref}
        type="search"
        aria-label="Search these tasks"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Search case or task"
        autoComplete="off"
        enterKeyHint="search"
      />
      <InputGroupAddon align="inline-end" className={text ? "hidden" : "max-sm:hidden"}>
        <Kbd aria-hidden>/</Kbd>
      </InputGroupAddon>
    </InputGroup>
  );
}

/** A labelled control inside the peek — label above, full-width control below. */
/**
 * The task list's one control row: search, a way in to the filters, then whatever is
 * currently applied.
 *
 *   · **No sort control.** The list is always most-urgent first (`sortTasks`); the
 *     alternatives it once offered were table conventions, not needs.
 *   · **Search is local**, beside the list it narrows — see `SearchBox`.
 *   · **The three selects live in a peek.** Due · Court · Advocate sat on screen at
 *     their defaults on nearly every visit, costing a row of height for controls almost
 *     nobody had touched.
 *   · **What is applied never hides.** The old row's rule — an applied filter is always
 *     visible — was right: a filter you cannot see is a short list you cannot explain.
 *     The *controls* fold away and the *state* does not: every active filter stays out
 *     here as a removable chip, and the trigger carries a count.
 */
export function FilterRow({
  filters,
  courts,
  people,
  categoryCounts,
  narrowed,
  onChange,
  onClear,
}: {
  filters: Filters;
  courts: string[];
  people: Person[];
  /** What ticking each kind would list, the same numbers the pills carry. */
  categoryCounts: Record<TaskCategory, number> | null;
  /** Whether anything (including a pressed card or the search) narrows the view. */
  narrowed: boolean;
  onChange: (patch: Partial<Filters>) => void;
  onClear: () => void;
}) {
  /* What the sheet holds. The search lives outside it and shows its own box.
     Kinds count only where the sheet is what holds them; with a mouse the
     pressed pills already say so, one row up. */
  const pillsShown = useMediaQuery("(min-width: 768px) and (pointer: fine)");
  const applied =
    filters.dues.length +
    filters.courts.length +
    filters.advocates.length +
    (pillsShown ? 0 : filters.kinds.length);

  const without = <T,>(list: readonly T[], value: T) => list.filter((item) => item !== value);

  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* Search and Filters hold one line at every width. Wherever the kind
          pills are gone (any touch screen, either way up) the pair owns the
          row, so the search takes everything the button leaves. Chips wrap onto the lines below. */}
      <div className="flex w-full min-w-0 items-center gap-2 md:pointer-fine:w-auto">
      <SearchBox query={filters.query} onChange={(q) => onChange({ query: q })} />

      <Sheet>
        <SheetTrigger asChild>
          <Button variant="outline" aria-label={`Filters${applied ? `, ${applied} applied` : ""}`}>
            <SlidersHorizontalIcon data-icon="inline-start" aria-hidden />
            Filters
            {applied ? (
              <span className="ml-1 inline-flex min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-caption font-medium tabular-nums text-primary-foreground">
                {applied}
              </span>
            ) : null}
          </Button>
        </SheetTrigger>
        <SheetContent side="right" className="w-full sm:max-w-sm">
          <SheetHeader>
            <SheetTitle className="text-title-s font-semibold">Filters</SheetTitle>
            <SheetDescription className="text-body-compact">
              Narrow the list. Anything you set stays visible on the row behind this.
            </SheetDescription>
          </SheetHeader>

          {/* Checkboxes, as on the Cases filters: any combination can be asked
              for, and what is on is visible without opening a menu. */}
          <div className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto px-4 pb-4">
            <div className={KIND_IN_SHEET_ONLY}>
              <CheckGroup
                id="tasks-filter-kind"
                legend="Category"
                options={CATEGORY_ORDER.map((kind) => ({
                  value: kind,
                  label: CATEGORY_LABELS[kind],
                  count: categoryCounts?.[kind],
                }))}
                value={filters.kinds}
                onChange={(kinds) => onChange({ kinds })}
              />
            </div>
            <CheckGroup
              id="tasks-filter-due"
              legend="Due"
              options={DUES.map((due) => ({ value: due, label: DUE_LABELS[due] }))}
              value={filters.dues}
              onChange={(dues) => onChange({ dues })}
            />
            <CheckGroup
              id="tasks-filter-court"
              legend="Court"
              options={courts.map((court) => ({ value: court, label: court }))}
              value={filters.courts}
              onChange={(next) => onChange({ courts: next })}
            />
            <CheckGroup
              id="tasks-filter-advocate"
              legend="Advocate on the case"
              options={people.map((person) => ({ value: person.id, label: person.name }))}
              value={filters.advocates}
              onChange={(advocates) => onChange({ advocates })}
              searchable={people.length > 8}
              collapseAfter={8}
            />
          </div>

          <SheetFooter>
            {narrowed ? (
              <Button variant="outline" onClick={onClear}>
                Clear all filters
              </Button>
            ) : null}
            <SheetClose asChild>
              <Button>Show the tasks</Button>
            </SheetClose>
          </SheetFooter>
        </SheetContent>
      </Sheet>
      </div>

      {/* Applied state, always out here — the peek hides controls, never what is on.
          The kind is not among these: it has its own pill row directly above, and a
          pressed pill saying "Pay" over a chip saying "Pay" was the same state twice
          (2026-09-15). Everything the sheet hides still reports itself here. */}
      {pillsShown
        ? null
        : filters.kinds.map((kind) => (
            <AppliedChip
              key={kind}
              label={CATEGORY_LABELS[kind]}
              onClear={() => onChange({ kinds: without(filters.kinds, kind) })}
            />
          ))}
      {filters.dues.map((due) => (
        <AppliedChip
          key={due}
          label={DUE_LABELS[due]}
          onClear={() => onChange({ dues: without(filters.dues, due) })}
        />
      ))}
      {filters.courts.map((court) => (
        <AppliedChip
          key={court}
          label={court}
          onClear={() => onChange({ courts: without(filters.courts, court) })}
        />
      ))}
      {filters.advocates.map((id) => (
        <AppliedChip
          key={id}
          label={people.find((p) => p.id === id)?.name ?? "Advocate"}
          onClear={() => onChange({ advocates: without(filters.advocates, id) })}
        />
      ))}

      {narrowed ? (
        <Button variant="ghost" onClick={onClear} className={cn("text-muted-foreground")}>
          <XIcon data-icon="inline-start" aria-hidden />
          Clear
        </Button>
      ) : null}
    </div>
  );
}
