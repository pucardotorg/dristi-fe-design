"use client";

import * as React from "react";
import { SearchIcon, SlidersHorizontalIcon, XIcon } from "lucide-react";

import { AppliedChip } from "@/components/shell/applied-chip";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { FieldLegend, FieldSet } from "@/components/ui/field";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  CASE_STATUSES,
  CASE_TYPES,
  advocateOptions,
  clearedFilters,
  countAppliedFilters,
  isNarrowed,
  stageGroupLabel,
  stageOptionsFor,
  type CaseStatus,
  type CasesQuery,
} from "@/lib/cases/query";
import { bucketLabel, type BucketKey, type CaseRecord } from "@/lib/cases/types";
import { cn } from "@/lib/utils";

import { CollapsibleLabel } from "./collapsible-label";

type FilterPatch = Partial<
  Pick<CasesQuery, "status" | "bookmarked" | "type" | "stage" | "advocates" | "search" | "filed">
>;

function toggleIn<T>(list: readonly T[], value: T, on: boolean): T[] {
  if (on) return list.includes(value) ? [...list] : [...list, value];
  return list.filter((entry) => entry !== value);
}

/**
 * One group of tick-boxes in the sheet. A `fieldset` with its legend, rows at the
 * 40px floor, the whole row a label so the words are the target too. Counts sit
 * after the label in muted `tabular-nums` where the group has them — same
 * presentation for every option, never a badge on one and text on the next.
 */
export function CheckGroup<T extends string>({
  id,
  legend,
  options,
  value,
  onChange,
  locked = false,
  note,
  searchable = false,
  collapseAfter,
}: {
  id: string;
  legend: string;
  options: { value: T; label: string; count?: number }[];
  value: readonly T[];
  onChange: (next: T[]) => void;
  /** Every option ticked and none of them changeable — a statement, not a choice. */
  locked?: boolean;
  note?: string;
  /** A long list gets a small type-to-narrow box beside its legend. */
  searchable?: boolean;
  /** A long list also shows only this many rows until "Show all" is pressed, so the
   *  sheet does not open to a wall of names. Searching overrides the cap. */
  collapseAfter?: number;
}) {
  const [needle, setNeedle] = React.useState("");
  const [expanded, setExpanded] = React.useState(false);
  const searching = searchable && Boolean(needle.trim());
  const filtered = searching
    ? options.filter((option) =>
        option.label.toLowerCase().includes(needle.trim().toLowerCase())
      )
    : options;
  // Cap the list only when it is long, not searched, and not already opened out. Ticked
  // rows float to the top of the capped slice so a prior selection is never hidden.
  const collapsed =
    collapseAfter !== undefined && !searching && !expanded && filtered.length > collapseAfter;
  const shown = collapsed
    ? [...filtered]
        .sort(
          (a, b) =>
            Number(value.includes(b.value)) - Number(value.includes(a.value))
        )
        .slice(0, collapseAfter)
    : filtered;
  const hiddenCount = collapsed ? filtered.length - shown.length : 0;
  return (
    <FieldSet className="gap-1">
      <div className="mb-1 flex items-center justify-between gap-3">
        <FieldLegend variant="label" className="mb-0 text-body-compact text-muted-foreground">
          {legend}
        </FieldLegend>
        {searchable ? (
          /* The narrow box sits on the legend's line, at the 36px step of the control
             ladder — a full-height field would read as a form inside the sheet. */
          <InputGroup className="h-9 w-40">
            <InputGroupAddon>
              <SearchIcon aria-hidden />
            </InputGroupAddon>
            <InputGroupInput
              type="search"
              value={needle}
              onChange={(event) => setNeedle(event.target.value)}
              placeholder="Find a name"
              aria-label={`Find in ${legend.toLowerCase()}`}
              autoComplete="off"
              className="h-full text-body-compact"
            />
          </InputGroup>
        ) : null}
      </div>
      {searchable && shown.length === 0 ? (
        <p className="px-2 py-2 text-body-compact text-muted-foreground">
          No names match.
        </p>
      ) : null}
      <ul className="flex flex-col">
        {shown.map((option) => {
          const checkboxId = `${id}-${option.value}`;
          return (
            <li key={option.value}>
              <Label
                htmlFor={checkboxId}
                className={cn(
                  /* Option labels at the button-label size (14px), so the sheet reads
                     as controls beside the list, not as body copy. */
                  "flex min-h-10 items-center gap-3 rounded-md px-2 text-body-compact font-normal",
                  locked ? "cursor-default" : "cursor-pointer hover:bg-accent"
                )}
              >
                <Checkbox
                  id={checkboxId}
                  checked={locked || value.includes(option.value)}
                  disabled={locked}
                  onCheckedChange={(checked) =>
                    onChange(toggleIn(value, option.value, checked === true))
                  }
                />
                <span className="min-w-0 flex-1">{option.label}</span>
                {option.count !== undefined ? (
                  <span className="text-body-compact text-muted-foreground tabular-nums">
                    {option.count}
                  </span>
                ) : null}
              </Label>
            </li>
          );
        })}
      </ul>
      {collapseAfter !== undefined && !searching && (collapsed || expanded) ? (
        <Button
          type="button"
          variant="link"
          size="sm"
          className="h-auto w-fit px-2 py-1"
          onClick={() => setExpanded((open) => !open)}
        >
          {collapsed ? `Show all ${filtered.length}` : "Show fewer"}
          {collapsed ? (
            <span className="text-muted-foreground tabular-nums">
              {" "}
              ({hiddenCount} more)
            </span>
          ) : null}
        </Button>
      ) : null}
      {note ? (
        <p className="px-2 text-caption text-muted-foreground">{note}</p>
      ) : null}
    </FieldSet>
  );
}

/** The four filter groups the sheet controls, as a draft the sheet edits before it is
 *  applied. Bookmarked and search live outside the sheet, so they are not part of it. */
type FilterDraft = Pick<CasesQuery, "status" | "type" | "stage" | "advocates">;

function draftFrom(query: CasesQuery): FilterDraft {
  return {
    status: query.status,
    type: query.type,
    stage: query.stage,
    advocates: query.advocates,
  };
}

/**
 * The Filters button and its sheet. Ticking a box no longer sorts the list — the real
 * backend cannot re-sort on every tick, and a list reshuffling under the sheet is its
 * own noise. The sheet edits a draft; Show cases hands the whole draft over at once
 * (`onApply`), which the page then applies behind a short loading state. The button
 * carries the count of what is actually applied, not the draft. The four groups are the
 * four questions people answered with tabs and a column menu before: which status,
 * which case type, which stage, whose.
 */
export function CasesFiltersButton({
  query,
  cases,
  totals,
  onApply,
  compact = false,
}: {
  query: CasesQuery;
  cases: CaseRecord[];
  totals: Record<CaseStatus | "bookmarked", number>;
  onApply: (patch: FilterPatch) => void;
  /** Collapse the trigger to the icon alone (the count rides as a corner badge) —
   *  used when the case peek squeezes the toolbar. */
  compact?: boolean;
}) {
  const [draft, setDraft] = React.useState<FilterDraft>(() => draftFrom(query));

  function set<K extends keyof FilterDraft>(key: K, next: FilterDraft[K]) {
    setDraft((current) => ({ ...current, [key]: next }));
  }

  const applied = countAppliedFilters(query);
  // Stage options and the group's label depend on the type/status in play — read them
  // off the draft so ticking a type reshapes the stage list before anything applies.
  const draftQuery: CasesQuery = { ...query, ...draft };
  const stages = stageOptionsFor(draftQuery);
  const draftCount = countAppliedFilters(draftQuery);

  return (
    // Re-seed the draft to what is applied each time the sheet opens, so a sheet closed
    // without Show cases does not carry a stale draft into the next visit.
    <Sheet onOpenChange={(next) => next && setDraft(draftFrom(query))}>
      <SheetTrigger asChild>
        <Button
          variant="outline"
          data-toolbar-action
          className={"shrink-0 gap-0 duration-300 " + (compact ? "px-2.5" : "px-4")}
          aria-label={`Filters${applied ? `, ${applied} applied` : ""}`}
        >
          <SlidersHorizontalIcon aria-hidden />
          <CollapsibleLabel show={!compact}>Filters</CollapsibleLabel>
          {applied ? (
            <span className="ms-1.5 inline-flex min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-caption font-medium tabular-nums text-primary-foreground">
              {applied}
            </span>
          ) : null}
        </Button>
      </SheetTrigger>
      {/* The DS sheet slides in full from the right with no dissolve, as the case peek
          does (owner, Sept 11). `aria-describedby` is cleared since the how-to copy is gone. */}
      <SheetContent
        side="right"
        aria-describedby={undefined}
        className="w-full sm:max-w-sm"
      >
        <SheetHeader>
          <SheetTitle className="text-title-s font-semibold">Filters</SheetTitle>
        </SheetHeader>

        <div className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto px-4 pb-4">
          <CheckGroup
            id="cases-filter-status"
            legend="Status"
            options={CASE_STATUSES.map((status) => ({
              ...status,
              count: totals[status.value],
            }))}
            value={draft.status}
            onChange={(status) => set("status", status)}
          />
          {/* One case type today, so the box is ticked and locked: every case on
              the list is this kind, and a box that could be unticked would promise
              a second kind that does not exist yet. */}
          <CheckGroup
            id="cases-filter-type"
            legend="Case type"
            options={CASE_TYPES}
            value={draft.type}
            onChange={(type) => set("type", type)}
            locked={CASE_TYPES.length === 1}
            note={
              CASE_TYPES.length === 1
                ? "The only case type this court files, for now."
                : undefined
            }
          />
          <CheckGroup<BucketKey>
            id="cases-filter-stage"
            legend={stageGroupLabel(draftQuery)}
            options={stages}
            value={draft.stage}
            onChange={(stage) => set("stage", stage)}
          />
          <CheckGroup
            id="cases-filter-advocate"
            legend="Advocates on the case"
            options={advocateOptions(cases).map((name) => ({ value: name, label: name }))}
            value={draft.advocates}
            onChange={(advocates) => set("advocates", advocates)}
            searchable
            collapseAfter={6}
          />
        </div>

        <SheetFooter className="flex-row items-center justify-between border-t border-hairline">
          {draftCount ? (
            <Button
              variant="ghost"
              onClick={() =>
                setDraft({ status: [], type: query.type, stage: [], advocates: [] })
              }
            >
              Clear filters
            </Button>
          ) : (
            <span />
          )}
          <SheetClose asChild>
            <Button onClick={() => onApply(draft)}>Show cases</Button>
          </SheetClose>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

/**
 * What is applied, always out on the card — the sheet hides controls, never state.
 * A filter you cannot see is a short list you cannot explain. Search is not a chip:
 * it sits in its own box on the same card.
 */
export function CasesAppliedFilters({
  query,
  onChange,
}: {
  query: CasesQuery;
  onChange: (patch: FilterPatch) => void;
}) {
  if (!isNarrowed(query)) return null;
  const chips: { key: string; label: string; clear: () => void }[] = [];

  if (query.bookmarked) {
    chips.push({
      key: "bookmarked",
      label: "Bookmarked",
      clear: () => onChange({ bookmarked: false }),
    });
  }
  for (const status of query.status) {
    chips.push({
      key: `status-${status}`,
      label: CASE_STATUSES.find((entry) => entry.value === status)?.label ?? status,
      clear: () => onChange({ status: query.status.filter((entry) => entry !== status) }),
    });
  }
  for (const type of query.type) {
    chips.push({
      key: `type-${type}`,
      label: CASE_TYPES.find((entry) => entry.value === type)?.label ?? type,
      clear: () => onChange({ type: query.type.filter((entry) => entry !== type) }),
    });
  }
  for (const stage of query.stage) {
    chips.push({
      key: `stage-${stage}`,
      label: bucketLabel(stage),
      clear: () => onChange({ stage: query.stage.filter((entry) => entry !== stage) }),
    });
  }
  for (const name of query.advocates) {
    chips.push({
      key: `adv-${name}`,
      label: name,
      clear: () =>
        onChange({ advocates: query.advocates.filter((entry) => entry !== name) }),
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-2" aria-label="Applied filters">
      {chips.map((chip) => (
        <AppliedChip key={chip.key} label={chip.label} onClear={chip.clear} />
      ))}
      <Button
        variant="ghost"
        onClick={() => onChange(clearedFilters())}
        className="text-muted-foreground"
      >
        <XIcon data-icon="inline-start" aria-hidden />
        Clear all
      </Button>
    </div>
  );
}
