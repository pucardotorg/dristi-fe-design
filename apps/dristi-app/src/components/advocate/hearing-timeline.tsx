"use client";

import * as React from "react";
import {
  ChevronDown,
  ChevronRight,
  Clock,
  CircleCheck,
  ListFilter,
  ScrollText,
  SlidersHorizontal,
  TriangleAlert,
  Info,
  Users,
  Video,
} from "lucide-react";

import { useCompactBoard } from "./use-compact-board";
import { useCanHover } from "./use-can-hover";
import { Identifier } from "@/components/chrome/identifier";
import { LocateHearingIcon } from "./locate-hearing-icon";
import "./filter-roll.css";
import { MobileHearingCard } from "@/components/advocate/mobile-hearing-card";
import { AccessButton } from "@/components/advocate/access-button";
import { QueueTag } from "@/components/advocate/queue-tag";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PANEL_CLASS } from "@/components/filing/form-card";
import { HOME_PANEL_PAD, HOME_RAIL_COLS } from "@/components/advocate/home-layout";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SegmentedControl, SegmentedControlItem } from "@/components/ui/segmented-control";
import { HearingFiltersSheet } from "@/components/advocate/hearing-filters";
import { OverflowTabsList } from "@/components/chrome/overflow-tabs";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { Locale } from "@/lib/onboarding/content";
import { pick } from "@/lib/onboarding/content";
import { advHome, fillCopy } from "@/lib/advocate/content";
import {
  isFiltered,
  NO_SLOT_FILTER,
  type DaySlot,
  type HearingAccess,
  type HearingQueue,
  type PeopleOption,
  type PeopleScope,
  type SlotFilter,
  type TimelineHearing,
  type TimeSlot,
} from "@/lib/advocate/home";
import type { Case, PersonId } from "@/lib/tasks/types";
import { cn } from "@/lib/utils";
import { ItemChip } from "@/components/advocate/home-bits";
import { HomeRefreshButton } from "@/components/advocate/refresh-button";
import type { AvatarSurface } from "@/components/tasks/person-avatar";
import { courtIdentity, courtNumberFor } from "@/lib/advocate/courts";
import { passedOverLabel } from "@/lib/advocate/passed-over";
import { useCourtText } from "@/components/court/court-provider";

/**
 * Clicking a hearing's pending flag opens the tasks rail and traces its tasks.
 * Threaded by context rather than through every slot component down to the row.
 * Null when the screen wires no handler — the flag then renders as a plain tag.
 */
const OpenTasksContext = React.createContext<((caseId: string, taskIds: string[]) => void) | null>(
  null
);

/**
 * Whether the board surfaces listed times. Off in the launch view: a hearing is a
 * plain list item and the slot headers drop their clock label. Threaded by context
 * so every row and slot header need not take the flag as a prop. On (the full
 * view) it restores the times everywhere.
 */
const ShowTimesContext = React.createContext<boolean>(true);
function useShowTimes(): boolean {
  return React.useContext(ShowTimesContext);
}

/**
 * Whether the deployment runs one court (`CourtProfile.singleCourt`). The title then
 * names it, so no row repeats it, no count says "across 1 court", and there is no
 * court filter to offer.
 */
const SingleCourtContext = React.createContext<boolean>(false);

/**
 * Opens the cause list and traces this matter's row there — the per-hearing "where
 * does my matter stand in the docket?" jump. Threaded by context so every row can
 * reach it. Null when the screen wires no handler (the icon then does not render).
 */
const ViewInCauseListContext = React.createContext<((caseId: string) => void) | null>(null);

/**
 * How the viewer reaches a matter (Vakalatnama or office access) and who holds
 * its Vakalatnama: what each row's access button shows. Null hides the button.
 */
const AccessContext = React.createContext<((kase: Case) => HearingAccess) | null>(null);
/** Where a scheduled matter stands in its court's queue today; null hides the tag. */
const QueueContext = React.createContext<((hearing: TimelineHearing) => HearingQueue | null) | null>(null);

/** A court the filter can offer — its full name, short label, and count. */
export type CourtOption = { court: string; label: string; count: number };

/** How many scheduled hearings show before the rest fold into "N more". */
const SCHEDULED_SHOWN = 3;

function timeOf(at: string): string {
  return new Intl.DateTimeFormat("en-IN", { timeStyle: "short" }).format(
    new Date(at)
  );
}

/** "4 hearings" — the count a rail label carries. */
function hearingsCount(n: number, locale: Locale): string {
  return fillCopy(advHome.phaseCount, locale, {
    n: String(n),
    hw: pick(n === 1 ? advHome.statHearingOne : advHome.statHearingMany, locale),
  });
}

/**
 * A listed time, marked when it is only approximate. Courts rarely fix a clock
 * time, so an upcoming matter's slot is a rough order, not a promise: it shows
 * with a "~" and an "approx" tag so it can never be read as exact. Concluded and
 * ongoing times have happened or are happening, and a specially-rescheduled
 * upcoming matter carries a court-given slot, so those show plainly.
 */
function HearingTime({
  at,
  approx,
  locale,
  className,
}: {
  at: string;
  approx: boolean;
  locale: Locale;
  className?: string;
}) {
  if (!approx) {
    return <span className={cn("tabular-nums", className)}>{timeOf(at)}</span>;
  }
  return (
    <span className={cn("inline-flex items-center gap-1", className)}>
      <span className="tabular-nums">~{timeOf(at)}</span>
      <span className="font-medium text-muted-foreground">
        {pick(advHome.approxLabel, locale)}
      </span>
    </span>
  );
}

/** The court a hearing sits in, as plain words: "24×7 ON Court · 1". */
function CourtLabel({ court, label, number, className }: {
  court: string;
  label: string;
  number?: string;
  className?: string;
}) {
  const courtText = useCourtText();
  const identity = courtIdentity(court, courtNumberFor(court, number));
  return (
    <span title={court} className={cn("inline-flex max-w-full items-baseline gap-1 text-body-compact", className)}>
      <span className="truncate">{courtText(identity.number ? courtIdentity(label, number).name : label)}</span>
      <span aria-hidden="true">·</span>
      <span className="shrink-0 tabular-nums">{identity.number ?? "N/A"}</span>
    </span>
  );
}

function SlotCount({ slot, locale, className, padded = false }: { slot: TimeSlot; locale: Locale; className?: string; padded?: boolean }) {
  // Stays one unit ("N hearings across M courts") rather than shrinking to wrap
  // mid-phrase; on a narrow slot header it drops to its own line intact. The
  // nouns are pluralised for the counts so it reads right at one ("1 hearing
  // across 1 court").
  const singleCourt = React.useContext(SingleCourtContext);
  const n = slot.hearings.length;
  const c = slot.courts.length;
  return <span className={cn("text-body-compact text-muted-foreground lg:whitespace-nowrap", className)}>
    {fillCopy(singleCourt ? advHome.phaseCount : advHome.slotAcrossCourts, locale, {
      n: padded ? String(n).padStart(2, "0") : String(n),
      hw: pick(n === 1 ? advHome.statHearingOne : advHome.statHearingMany, locale),
      c: padded ? String(c).padStart(2, "0") : String(c),
      cw: pick(c === 1 ? advHome.statCourtOne : advHome.statCourtMany, locale),
    })}
  </span>;
}

/* ─────────────────────────── summary strip (phone) ─────────────────────────── */



/* ─────────────────────────── day actions ─────────────────────────── */

/*
 * Desktop label rules for the day's actions, read off the board's own width (a
 * container query, so the side nav and the tasks panel count). The words show
 * from @5xl (1024px), where the title and labelled actions fit together. Fold
 * to icons below that width in the same render as the panel opens.
 */
const ACTION_FIT = {
  roomy: {
    label: "lg:ml-0 lg:max-w-0 lg:opacity-0 lg:@5xl:ml-1.5 lg:@5xl:max-w-40 lg:@5xl:opacity-100",
  },
  tight: {
    label: "lg:ml-0 lg:max-w-0 lg:opacity-0 lg:@5xl:ml-1.5 lg:@5xl:max-w-40 lg:@5xl:opacity-100",
  },
} as const;

/**
 * On a desktop each button is one 36px height in both states, with constant
 * padding. Words fold in the same layout pass as the rail changes width;
 * interpolating their width squeezed the title for several frames. The words
 * stay in the accessibility tree either way.
 */
const ACTION_BUTTON =
  "h-auto min-h-10 min-w-0 flex-1 gap-1.5 px-3 py-2 text-body-compact whitespace-normal lg:h-9 lg:min-h-0 lg:flex-none lg:gap-0 lg:px-2.5 lg:py-0 lg:whitespace-nowrap lg:transition-none";
const ACTION_LABEL =
  "min-w-0 wrap-anywhere lg:overflow-hidden";

/**
 * The three actions that belong to the whole day, not to one sitting: the full
 * cause list, joining a hearing, and refresh. On a desktop they share the slot
 * tabs' row, at its right end; on a phone they run full width above the tabs.
 */
export function DayActions({
  onViewCauseList,
  onJoinCourt,
  onRefresh,
  fit = "roomy",
  locale,
}: {
  onViewCauseList: () => void;
  onJoinCourt: () => void;
  onRefresh: () => void;
  /** How many tabs share the row: "tight" folds the words away sooner. */
  fit?: keyof typeof ACTION_FIT;
  locale: Locale;
}) {
  const { label } = ACTION_FIT[fit];
  return (
    <div className="flex w-full items-center gap-2 lg:w-auto">
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            onClick={onViewCauseList}
            className={cn(ACTION_BUTTON, "border-border")}
          >
            <ScrollText aria-hidden="true" />
            <span className={cn(ACTION_LABEL, label)}>{pick(advHome.viewCauseList, locale)}</span>
          </Button>
        </TooltipTrigger>
        <TooltipContent side="top">{pick(advHome.viewCauseList, locale)}</TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            size="sm"
            onClick={onJoinCourt}
            className={ACTION_BUTTON}
          >
            <Video aria-hidden="true" />
            <span className={cn(ACTION_LABEL, label)}>{pick(advHome.joinCourtroom, locale)}</span>
          </Button>
        </TooltipTrigger>
        <TooltipContent side="top">{pick(advHome.joinCourtroom, locale)}</TooltipContent>
      </Tooltip>
      {/* The day's-list refresh — always an icon, with the three-beat gesture and
          the last-refreshed reveal. */}
      <HomeRefreshButton onRefresh={onRefresh} locale={locale} />
    </div>
  );
}

/* ─────────────────────────── sitting filters ─────────────────────────── */

const FILTER_TRIGGER =
  "h-auto min-h-10 min-w-0 gap-1.5 border-border py-2 text-body-compact whitespace-normal lg:h-9 lg:min-h-0 lg:py-0 lg:whitespace-nowrap";
const FILTER_ITEM = "min-h-10 text-body-compact lg:min-h-0";
/**
 * A filter that is hiding some of the sitting's hearings reads in brand teal —
 * border, label and icons — so a narrowed board is never mistaken for the
 * whole day and a hearing is not missed.
 */
export const FILTER_ON =
  "border-brand-accent bg-brand-muted text-brand-muted-foreground hover:bg-brand-muted hover:text-brand-muted-foreground [&_svg]:text-brand-muted-foreground [&_.text-muted-foreground]:text-brand-muted-foreground";

function CourtFilter({
  courts,
  selected,
  onChange,
  locale,
}: {
  courts: CourtOption[];
  selected: readonly string[];
  onChange: (next: string[]) => void;
  locale: Locale;
}) {
  const labelOf = React.useCallback(
    (court: string) => courts.find((c) => c.court === court)?.label ?? court,
    [courts]
  );

  // Empty means every court. A court is ticked while "All courts" is, and the
  // last ticked court cannot be unticked (nothing ticked would show nothing).
  const all = selected.length === 0;
  const isOn = (court: string) => all || selected.includes(court);
  const toggle = (court: string) => {
    const current = all ? courts.map((c) => c.court) : [...selected];
    const next = current.includes(court) ? current.filter((c) => c !== court) : [...current, court];
    if (next.length === 0) return;
    onChange(next.length === courts.length ? [] : next);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className={cn(FILTER_TRIGGER, selected.length > 0 && FILTER_ON)}>
          <ListFilter aria-hidden="true" className="text-muted-foreground" />
          {selected.length === 0 ? (
            pick(advHome.courtFilterAll, locale)
          ) : (
            <span className="flex min-w-0 items-center gap-1.5">
              <span className="truncate">{labelOf(selected[0])}</span>
              {selected.length > 1 ? (
                <span className="text-muted-foreground">
                  {fillCopy(advHome.courtFilterMore, locale, {
                    n: String(selected.length - 1),
                  })}
                </span>
              ) : null}
            </span>
          )}
          <ChevronDown aria-hidden="true" className="text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" collisionPadding={16} className="max-h-80 max-w-[calc(100vw-2rem)] min-w-56 overflow-y-auto">
        {/* The access menu's shape: "All courts" the parent, each court a branch. */}
        <DropdownMenuCheckboxItem
          checked={all}
          onSelect={(e) => e.preventDefault()}
          onCheckedChange={() => onChange([])}
          className={cn(FILTER_ITEM, BOX_ITEM)}
        >
          <MenuBox checked={all} />
          {courts.length ? <BranchStem /> : null}
          <span className="flex-1">{pick(advHome.courtFilterAll, locale)}</span>
        </DropdownMenuCheckboxItem>
        {courts.map((option, i) => (
          <DropdownMenuCheckboxItem
            key={option.court}
            checked={isOn(option.court)}
            onSelect={(e) => e.preventDefault()}
            onCheckedChange={() => toggle(option.court)}
            className={cn(FILTER_ITEM, BOX_ITEM, "pl-8")}
          >
            <BranchElbow last={i === courts.length - 1} />
            <MenuBox checked={isOn(option.court)} />
            <span className="flex-1 truncate">{option.label}</span>
            <span className="ml-auto tabular-nums text-muted-foreground">
              {option.count}
            </span>
          </DropdownMenuCheckboxItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/**
 * Whose hearings this sitting shows. Two scopes, each with its reason written
 * under it (a phone has no hover, so the hint is never a tooltip alone): "My
 * hearings", through the viewer's own Vakalatnama, and "All I can access", which
 * adds the matters reached through office access. Under them, everyone else on
 * those Vakalatnamas, by name, to tick in any combination. A ticked name keeps
 * the matters that person holds the Vakalatnama on, never ones they only have
 * office access to; the viewer stays the common link in every one.
 */
function PeopleFilter({
  people,
  options,
  onChange,
  locale,
}: {
  people: readonly PersonId[];
  options: PeopleOption[];
  onChange: (people: PersonId[]) => void;
  locale: Locale;
}) {
  const chosen = options.filter((o) => people.includes(o.person.id));
  const toggle = (id: PersonId) =>
    onChange(people.includes(id) ? people.filter((p) => p !== id) : [...people, id]);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className={FILTER_TRIGGER}>
          <ListFilter aria-hidden="true" className="text-muted-foreground" />
          {chosen.length
            ? fillCopy(advHome.peopleCount, locale, { n: String(chosen.length) })
            : pick(advHome.peopleFilter, locale)}
          <ChevronDown aria-hidden="true" className="text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>
      {/* Names only, every one a checkbox: the whose-cases question lives on the
          switch beside this menu, so nothing here reads as pick-one. */}
      <DropdownMenuContent align="end" className="max-h-96 max-w-[calc(100vw-2rem)] min-w-64 overflow-y-auto">
        <DropdownMenuLabel className="text-caption text-muted-foreground">
          {pick(advHome.peopleHeading, locale)}
        </DropdownMenuLabel>
        {options.length ? (
          options.map((option) => (
            <DropdownMenuCheckboxItem
              key={option.person.id}
              checked={people.includes(option.person.id)}
              onSelect={(e) => e.preventDefault()}
              onCheckedChange={() => toggle(option.person.id)}
              className={FILTER_ITEM}
            >
              <span className="flex-1 truncate">{option.person.name}</span>
              <span className="ml-auto tabular-nums text-muted-foreground">{option.count}</span>
            </DropdownMenuCheckboxItem>
          ))
        ) : (
          <p className="px-2.5 py-2 text-body-compact text-muted-foreground">
            {pick(advHome.peopleNone, locale)}
          </p>
        )}
        {chosen.length ? (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => onChange([])} className={cn(FILTER_ITEM, "text-muted-foreground")}>
              {pick(advHome.clearPeople, locale)}
            </DropdownMenuItem>
          </>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** How the sitting's people filter is laid out (demo choice between two designs). */
export type FilterVariant = "menu" | "switch";

/** One kind of access, as a tick in the access menu. */
const ACCESS_KINDS = [
  { value: "mine", label: advHome.accessMine, tip: advHome.accessMineTip },
  { value: "office", label: advHome.accessOfficeOnly, tip: advHome.accessOfficeTip },
] as const;

/**
 * The access menu's rows lead with a checkbox, as a checklist does, so the
 * info marks can stand at the far right. The menu item stays the DS checkbox
 * item (its role, keyboard and checked state); only its trailing tick is
 * hidden in favour of the leading box.
 */
const BOX_ITEM = "pr-2.5 [&>[data-slot=dropdown-menu-checkbox-item-indicator]]:hidden";
/** The x of the branch line: the centre of the parent's box (10px inset + 8px). */
const BRANCH_X = 17;

/** In a parent row: the branch line from under its box to the row's foot. */
function BranchStem() {
  return (
    <span
      aria-hidden="true"
      style={{ left: BRANCH_X, top: "calc(50% + 0.5rem)" }}
      className="pointer-events-none absolute bottom-0 border-l border-border"
    />
  );
}

/** In a child row: the elbow into its box, and the line on to the next child. */
function BranchElbow({ last }: { last: boolean }) {
  return (
    <>
      <span
        aria-hidden="true"
        style={{ left: BRANCH_X, width: `calc(2rem - ${BRANCH_X}px)` }}
        className="pointer-events-none absolute top-0 h-1/2 rounded-bl-md border-b border-l border-border"
      />
      {last ? null : (
        <span aria-hidden="true" style={{ left: BRANCH_X }} className="pointer-events-none absolute top-1/2 bottom-0 border-l border-border" />
      )}
    </>
  );
}

function MenuBox({ checked }: { checked: boolean }) {
  // The menu item recolours everything inside it while highlighted; the tick
  // keeps the checkbox's own white on teal.
  return (
    <Checkbox
      checked={checked}
      tabIndex={-1}
      aria-hidden="true"
      className="pointer-events-none **:text-primary-foreground!"
    />
  );
}

/** An option's name, with its one-line meaning written beneath it on touch screens. */
function OptionLabel({ label, tip }: { label: string; tip: string }) {
  return (
    <span className="flex min-w-0 flex-1 flex-col py-0.5">
      <span>{label}</span>
      <span className="hidden text-caption text-muted-foreground pointer-coarse:block">{tip}</span>
    </span>
  );
}

/** An option's one-line meaning on an info mark, opening to the right of the menu. */
function InfoTip({ text }: { text: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          role="img"
          aria-label={text}
          // Touch has no hover: there the line shows under the label instead.
          className="ml-2 flex size-5 shrink-0 items-center justify-center text-muted-foreground hover:text-foreground pointer-coarse:hidden"
        >
          <Info aria-hidden="true" className="size-3.5" />
        </span>
      </TooltipTrigger>
      {/* Always to the right, so it never covers the option's own label. */}
      <TooltipContent side="right" sideOffset={12} avoidCollisions={false} className="max-w-44">
        {text}
      </TooltipContent>
    </Tooltip>
  );
}

/**
 * "Custom filters" and the count take turns on the button (filter-roll.css).
 * Both faces share one grid cell so the button keeps the wider one's width and
 * never jumps. A phone shows the short count ("1 excluded") to stay on one
 * line. Screen readers get both, once.
 */
function CustomLabel({ custom, excluded, short }: { custom: string; excluded: string; short: string }) {
  const faces = [custom, excluded, custom];
  return (
    <>
      <span className="sr-only">{`${custom}: ${excluded}`}</span>
      <span aria-hidden="true" className="relative inline-grid h-[1lh] overflow-hidden whitespace-nowrap">
        <span className="filter-roll-track col-start-1 row-start-1 flex flex-col items-center">
          {faces.map((face, i) => (
            <span key={i} className="h-[1lh]">
              {face === excluded ? (
                <>
                  <span className="lg:hidden">{short}</span>
                  <span className="hidden lg:inline">{excluded}</span>
                </>
              ) : (
                face
              )}
            </span>
          ))}
        </span>
      </span>
    </>
  );
}

/**
 * Which of the sitting's hearings to show. "All hearings" is everything and
 * ticks both kinds; the two kinds below it can each be ticked off (one always
 * stays). Anything finer, by person, lives in the advanced filters sheet; once
 * set, the button counts who is left out ("2 people excluded") and "All hearings" is no longer ticked,
 * so the menu never claims "all" while people are left out. Picking "All
 * hearings" again clears everything.
 */
function AccessMenu({
  scope,
  hidden,
  onChange,
  onAdvanced,
  locale,
}: {
  scope: PeopleScope;
  hidden: readonly PersonId[];
  onChange: (next: { scope: PeopleScope; hidden: PersonId[] }) => void;
  onAdvanced: () => void;
  locale: Locale;
}) {
  const on = { mine: scope !== "office", office: scope !== "mine" };
  const custom = hidden.length > 0;
  const setKind = (kind: "mine" | "office") => {
    // From a custom setup, a kind is a fresh pick: just that kind, everyone in.
    if (custom) return onChange({ scope: kind, hidden: [] });
    const next = { ...on, [kind]: !on[kind] };
    // Never both off: the last tick stays.
    if (!next.mine && !next.office) return;
    onChange({ scope: next.mine && next.office ? "all" : next.mine ? "mine" : "office", hidden: [...hidden] });
  };

  const n = String(hidden.length);
  const excluded = hidden.length === 1 ? pick(advHome.excludedOne, locale) : fillCopy(advHome.excludedMany, locale, { n });
  const label = custom ? (
    <CustomLabel
      custom={pick(advHome.customFilter, locale)}
      excluded={excluded}
      short={fillCopy(advHome.excludedShort, locale, { n })}
    />
  ) : (
    pick(scope === "all" ? advHome.accessAll : scope === "mine" ? advHome.accessMine : advHome.accessOfficeOnly, locale)
  );

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className={cn(FILTER_TRIGGER, (custom || scope !== "all") && FILTER_ON)}>
          <Users aria-hidden="true" className="text-muted-foreground" />
          {label}
          <ChevronDown aria-hidden="true" className="text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" collisionPadding={16} className="max-w-[calc(100vw-2rem)] min-w-64">
        {/* "All hearings" is the parent; a branch runs from under its box. */}
        <DropdownMenuCheckboxItem
          checked={scope === "all" && !custom}
          onSelect={(e) => e.preventDefault()}
          onCheckedChange={() => onChange({ scope: "all", hidden: [] })}
          className={cn(FILTER_ITEM, BOX_ITEM)}
        >
          <MenuBox checked={scope === "all" && !custom} />
          <BranchStem />
          <span className="flex-1">{pick(advHome.accessAll, locale)}</span>
        </DropdownMenuCheckboxItem>
        {/* The two kinds hang off it: both ticked is "all", unticking one
            leaves just the other. Each branch ends at its child's box. */}
        {ACCESS_KINDS.map((kind, i) => (
          <DropdownMenuCheckboxItem
            key={kind.value}
            checked={!custom && on[kind.value]}
            onSelect={(e) => e.preventDefault()}
            onCheckedChange={() => setKind(kind.value)}
            className={cn(FILTER_ITEM, BOX_ITEM, "pl-8")}
          >
            <BranchElbow last={i === ACCESS_KINDS.length - 1} />
            <MenuBox checked={!custom && on[kind.value]} />
            <OptionLabel label={pick(kind.label, locale)} tip={pick(kind.tip, locale)} />
            <InfoTip text={pick(kind.tip, locale)} />
          </DropdownMenuCheckboxItem>
        ))}
        <DropdownMenuSeparator />
        {/* An action, not a choice: it opens the sheet. While people are left
            out the presets above are all unticked and this row says "On". */}
        <DropdownMenuItem onSelect={onAdvanced} className={FILTER_ITEM}>
          <SlidersHorizontal aria-hidden="true" className="text-muted-foreground" />
          <span className="flex-1">{pick(advHome.advancedFilters, locale)}</span>
          {custom ? (
            <span className="rounded-md bg-brand-muted px-1.5 text-caption font-medium text-brand-muted-foreground">
              {pick(advHome.customBadge, locale)}
            </span>
          ) : null}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/**
 * Whose hearings the sitting shows: those where the viewer is on the
 * Vakalatnama, or everything they can open (office access too). Always in view
 * and one click to change; each side explains itself on hover.
 */
function ScopeSwitch({
  scope,
  onChange,
  locale,
}: {
  scope: PeopleScope;
  onChange: (scope: PeopleScope) => void;
  locale: Locale;
}) {
  return (
    <SegmentedControl
      size="compact"
      type="single"
      value={scope}
      onValueChange={(value) => value && onChange(value as PeopleScope)}
      aria-label={pick(advHome.scopeSwitch, locale)}
      className="col-span-2 lg:col-span-1"
    >
      {(["mine", "all"] as const).map((value) => (
        // The tooltip hangs on the label, not the item: a trigger wrapping the
        // item would overwrite the item's own data-state and hide the selection.
        <SegmentedControlItem key={value} value={value}>
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="px-2.5">{pick(value === "mine" ? advHome.scopeMine : advHome.scopeAll, locale)}</span>
            </TooltipTrigger>
            <TooltipContent side="top">
              {pick(value === "mine" ? advHome.scopeMineHint : advHome.scopeAllHint, locale)}
            </TooltipContent>
          </Tooltip>
        </SegmentedControlItem>
      ))}
    </SegmentedControl>
  );
}

/* ─────────────────────────────── rail ─────────────────────────────── */

type RailTone = "neutral" | "conflict" | "now" | "concluded";

/** The keyframes for the "now" dot's pulse — scoped here, off under reduced motion. */
function RailStyles() {
  return (
    <style>{`
      .now-dot { box-shadow: 0 0 0 3px var(--halo); }
      @keyframes pucar-now-pulse {
        0%, 100% { box-shadow: 0 0 0 2px var(--halo); }
        50% { box-shadow: 0 0 0 6px color-mix(in srgb, var(--halo) 45%, transparent); }
      }
      @media (prefers-reduced-motion: no-preference) {
        .now-dot { animation: pucar-now-pulse 2.5s ease-in-out infinite; }
      }
    `}</style>
  );
}

/**
 * One row of a sitting's timeline. On a desktop the rail runs down the left
 * (HOME_RAIL_COLS): a dot and the phase's name, centred on the first line of the
 * block beside it (`railHeight` is that line's box: 40 for the filter row, 64
 * for the concluded bar, 48 for the live band, 56 for a hearing row), with the
 * count hanging under the name. The line is drawn through the whole row so the
 * rows join into one unbroken line however tall each grows (opening the
 * scheduled list stretches it). `edge` trims it at the sitting's first and last
 * mark. A phone has no rail; the content stands alone.
 */
function PhaseRow({
  tone = "neutral",
  marker = "dot",
  label,
  sub,
  edge,
  last = false,
  railHeight = "h-12",
  children,
}: {
  tone?: RailTone;
  marker?: "dot" | "ring";
  label: React.ReactNode;
  sub?: React.ReactNode;
  edge?: "start" | "end";
  /** The last phase before the end mark: it keeps only a short run of line. */
  last?: boolean;
  railHeight?: "h-10" | "h-12" | "h-14" | "h-16";
  children?: React.ReactNode;
}) {
  return (
    <div className={cn("lg:grid", HOME_RAIL_COLS)}>
      <div className="relative hidden lg:block">
        <span
          aria-hidden="true"
          className={cn(
            "absolute left-1.5 w-0.5 -translate-x-1/2 bg-hairline",
            edge === "start" ? "top-5 bottom-0" : edge === "end" ? "top-0 h-5" : "inset-y-0"
          )}
        />
        <div className={cn("relative flex items-center gap-2", railHeight)}>
          <span
            aria-hidden="true"
            className={cn(
              "shrink-0 rounded-full",
              marker === "ring"
                ? "size-3 border-2 border-hairline bg-card"
                : tone === "now"
                  ? "now-dot size-3 bg-primary"
                  : // A step smaller than the live dot, still centred on the rail.
                    cn("mx-px size-2.5", tone === "conflict" ? "bg-warning" : "bg-muted-foreground")
            )}
          />
          <span
            className={cn(
              // The name may run into the gap before the hearings (84 + 24px), so
              // "Scheduled next" holds one line; a longer translation wraps there.
              "relative max-w-27 shrink-0",
              marker === "ring"
                ? "text-caption text-muted-foreground"
                : "text-body-compact font-medium text-foreground",
              tone === "now" && "text-primary",
              // What is behind reads quieter: only "Scheduled next" stays black.
              tone === "concluded" && "text-muted-foreground"
            )}
          >
            {label}
            {sub ? (
              <span className="absolute top-full left-0 mt-0.5 text-caption font-normal whitespace-nowrap text-muted-foreground">
                {sub}
              </span>
            ) : null}
          </span>
        </div>
      </div>
      <div className={cn("min-w-0", edge === "start" ? "pb-4 lg:pb-6" : edge ? "pb-3 lg:pb-0" : last ? "pb-2 lg:pb-1" : "pb-2 lg:pb-3")}>{children}</div>
    </div>
  );
}

/* ─────────────────────────── hearing row ─────────────────────────── */

/**
 * The flag for a hearing that still owes work before it is called — "N pending
 * tasks". When the screen wires an open-tasks handler it is a filled amber pill
 * with a trailing chevron that says it opens something; it opens the tasks rail
 * and traces this case's tasks. Without a handler it is a plain tag.
 */
function PendingChip({
  count,
  caseId,
  taskIds,
  locale,
}: {
  count: number;
  caseId: string;
  taskIds: string[];
  locale: Locale;
}) {
  const onOpenTasks = React.useContext(OpenTasksContext);
  if (count <= 0) return null;
  const label = fillCopy(
    count === 1 ? advHome.blockingOne : advHome.blockingMany,
    locale,
    { n: String(count) }
  );

  if (!onOpenTasks) {
    return (
      <Badge variant="warning" className="gap-1">
        <TriangleAlert aria-hidden="true" />
        {label}
      </Badge>
    );
  }

  // On touch the chip keeps its drawn height; an invisible ::after stretches its
  // tap area to 40px instead of the chip itself growing tall.
  return (
    <Badge asChild variant="warning" className="relative z-10 gap-1 rounded-md border-transparent hover:bg-warning-muted-hover pointer-coarse:after:absolute pointer-coarse:after:inset-x-0 pointer-coarse:after:-inset-y-2">
      <button
        type="button"
        aria-label={`${label}: ${pick(advHome.pendingOpen, locale)}`}
        onClick={(event) => {
          event.stopPropagation();
          onOpenTasks(caseId, taskIds);
        }}
      >
        <TriangleAlert aria-hidden="true" className="size-3.5" />
        {label}
        <ChevronRight aria-hidden="true" className="size-3.5" />
      </button>
    </Badge>
  );
}

/** A matter called and passed over today, or carried from an earlier day. */
function PassedOverTag({ locale }: { locale: Locale }) {
  return (
    // A status, not a warning: the dark-beige chip the court badge used, so it
    // reads apart from the amber pending-task chip beside it.
    <Badge variant="secondary" className="border border-border bg-accent-strong">
      {passedOverLabel(locale)}
    </Badge>
  );
}

/** The quiet icon button style a row's two trailing actions share. */
const ROW_ICON =
  "size-8 border-hairline bg-card text-muted-foreground hover:bg-accent-strong hover:text-foreground pointer-coarse:size-10";

/**
 * The icon button that opens the cause list and traces this matter's row there,
 * so an advocate can jump from the board to where the matter stands in the day's
 * full docket. Renders nothing when no handler is wired.
 */
function ViewInCauseListButton({ caseId, locale }: { caseId: string; locale: Locale }) {
  const onView = React.useContext(ViewInCauseListContext);
  if (!onView) return null;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="icon"
          aria-label={pick(advHome.viewOnCauseList, locale)}
          onClick={(event) => {
            event.stopPropagation();
            onView(caseId);
          }}
          className={cn(
            "relative z-10",
            ROW_ICON
          )}
        >
          <LocateHearingIcon aria-hidden="true" className="size-4" />
        </Button>
      </TooltipTrigger>
      <TooltipContent side="top">{pick(advHome.viewOnCauseList, locale)}</TooltipContent>
    </Tooltip>
  );
}

/**
 * One hearing: its cause-list item on the left, then the matter (bold), the
 * stage and case number, and any pending or passed-over pill under them. The
 * court sits at the top right on a wide board; in a narrower column it moves
 * below the metadata, keeping the matter name and case number readable.
 */
function HearingRow({
  hearing,
  onOpenCase,
  locale,
  selected,
  showTime = false,
  boxSurface = "card",
  className,
}: {
  hearing: TimelineHearing;
  onOpenCase: (caseId: string) => void;
  locale: Locale;
  selected: boolean;
  showTime?: boolean;
  /** The surface the row sits on, so the item box insets the right way. */
  boxSurface?: AvatarSurface;
  className?: string;
}) {
  const showTimes = useShowTimes();
  const singleCourt = React.useContext(SingleCourtContext);
  const isMobile = useCompactBoard();
  const canHover = useCanHover();
  const onOpenTasks = React.useContext(OpenTasksContext);
  const onViewInCauseList = React.useContext(ViewInCauseListContext);
  const accessOf = React.useContext(AccessContext);
  const access = accessOf ? accessOf(hearing.kase) : null;
  const queueFor = React.useContext(QueueContext);
  const queue = queueFor ? queueFor(hearing) : null;
  if (isMobile) return <MobileHearingCard hearing={hearing} locale={locale} selected={selected} queue={queue} onOpenCase={onOpenCase} onOpenTasks={onOpenTasks} onViewInCauseList={onViewInCauseList} access={access} showCourt={!singleCourt} time={showTime && showTimes ? <HearingTime at={hearing.at} approx={hearing.approxTime} locale={locale} /> : null} />;
  const hasPills = hearing.blockers.length > 0 || hearing.passedOver;
  return (
    <div
      className={cn(
        "group/row relative grid grid-cols-[auto_minmax(0,1fr)] items-start gap-x-4 gap-y-2 px-4 py-4 transition-colors hover:bg-accent has-focus-visible:bg-accent active:bg-accent-strong lg:grid-cols-[auto_minmax(0,1fr)_auto]",
        // No ring for the case open in the peek: that cue belongs to View case,
        // not Home (owner, Oct 8).
        className
      )}
    >
      <ItemChip item={hearing.item} size="lg" surface={boxSurface} />
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        {/* The matter's flags stand beside its name, wrapping under it only when
            the line runs out. */}
        <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <button
          type="button"
          onClick={() => onOpenCase(hearing.kase.id)}
          className="text-left text-body font-semibold after:absolute after:inset-0 focus-visible:outline-none focus-visible:after:ring-3 focus-visible:after:ring-inset focus-visible:after:ring-ring/50"
        >
          {hearing.kase.parties}
        </button>
        {hasPills ? (
          <>
            {/* Passed over describes the hearing itself, so it sits next to the
                name; the pending-task chip, an action, follows it. */}
            {hearing.passedOver ? <PassedOverTag locale={locale} /> : null}
            <PendingChip
              count={hearing.blockers.length}
              taskIds={hearing.blockers.map((task) => task.id)}
              caseId={hearing.kase.id}
              locale={locale}
            />
          </>
        ) : null}
        </span>
        {/* The case number is never cut short: when the line runs out of room it is
            the stage that truncates. The number is an Identifier (mono, and on a
            mouse-driven screen click-to-copy); it sits above the row's full-bleed
            click target so copying it does not open the case. */}
        <span className="flex h-5 min-w-0 items-baseline text-body-compact text-muted-foreground">
          <span className="min-w-0 truncate" title={hearing.kase.stage}>{hearing.kase.stage}</span>
          <span aria-hidden="true" className="shrink-0 whitespace-pre"> · </span>
          <Identifier
            value={hearing.kase.stNumber || hearing.kase.cnr}
            label="case number"
            copyable={canHover}
            className="relative z-10 shrink-0 whitespace-nowrap"
          />
        </span>
        {showTime && showTimes ? (
          <HearingTime
            at={hearing.at}
            approx={hearing.approxTime}
            locale={locale}
            className="text-caption text-muted-foreground"
          />
        ) : null}
      </div>
      {/* The court and the two row actions. From @2xl (the board still has room
          with both side panels open) they stand at the top right, centred on the
          matter's text, as the wireframe draws them; the icons' glyphs, not their
          hit areas, line up with the court's right edge. Narrower, they drop under
          the matter. */}
      <div className="col-start-2 flex min-w-0 items-center justify-between gap-3 lg:col-start-3 lg:row-start-1 lg:flex-col lg:items-end lg:gap-1 lg:self-start">
        {/* On the wide layout the pair is exactly as tall as the name and detail
            lines (24 + 22 + 32 - 6 = 48), so the court sits on the name's line and
            the icons on the detail's, and the row keeps the text's height. */}
        {singleCourt ? (
          // Holds the court's line so the icons stay on the detail line.
          <span aria-hidden="true" className="hidden lg:block lg:h-6" />
        ) : (
          <CourtLabel court={hearing.court} label={hearing.courtLabel} number={hearing.kase.courtNumber} className="relative z-10 font-medium text-muted-foreground lg:leading-6" />
        )}
        <div className="flex items-center gap-2">
          {/* Access, then the queue, then the cause-list jump (owner, Oct 8). */}
          {access ? (
            <AccessButton access={access} locale={locale} variant="outline" className={ROW_ICON} />
          ) : null}
          {queue ? <QueueTag queue={queue} locale={locale} /> : null}
          <ViewInCauseListButton caseId={hearing.kase.id} locale={locale} />
        </div>
      </div>
    </div>
  );
}

/** A run of rows on white, parted by hairlines (desktop) or as cards (phone). */
function HearingBody({
  hearings,
  selectedCaseId,
  onOpenCase,
  locale,
}: {
  hearings: TimelineHearing[];
  selectedCaseId: string | null;
  onOpenCase: (caseId: string) => void;
  locale: Locale;
}) {
  return (
    <div className="flex flex-col gap-2 lg:block lg:gap-0 lg:divide-y lg:divide-hairline lg:bg-card">
      {hearings.map((hearing) => (
        <HearingRow
          key={hearing.kase.id}
          hearing={hearing}
          onOpenCase={onOpenCase}
          locale={locale}
          selected={hearing.kase.id === selectedCaseId}
          boxSurface="card"
          className="hover:bg-muted has-focus-visible:bg-muted"
        />
      ))}
    </div>
  );
}

/** A small status tag — "Conflict" (amber) — on white so it reads on any tint. */
function StatusTag({ label, className }: { label: string; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 rounded-full border border-warning bg-card px-2 py-0.5 text-caption font-medium text-warning-ink",
        className
      )}
    >
      <span aria-hidden="true" className="size-1.5 rounded-full bg-warning" />
      {label}
    </span>
  );
}

/**
 * The live group: a teal-tinted band naming it ("Live now across 3 courts", with
 * the pulsing dot), and the hearings on white below it, a teal edge down the
 * left of the whole block. Always open on a desktop: what is being called needs
 * no click. A phone keeps its collapsible card.
 */
function NowSlot({
  slot,
  selectedCaseId,
  onOpenCase,
  locale,
}: {
  slot: TimeSlot;
  selectedCaseId: string | null;
  onOpenCase: (caseId: string) => void;
  locale: Locale;
}) {
  const showTimes = useShowTimes();
  const singleCourt = React.useContext(SingleCourtContext);
  const isMobile = useCompactBoard();
  const [pointerMotion, setPointerMotion] = React.useState(true);
  if (isMobile) return (
    <Collapsible defaultOpen data-pointer-motion={pointerMotion} className="relative overflow-hidden rounded-xl bg-brand-muted">
      <span aria-hidden="true" className="absolute inset-y-3 left-0 w-0.5 rounded-full bg-brand-accent" />
      <CollapsibleTrigger onPointerDown={() => setPointerMotion(true)} onKeyDown={() => setPointerMotion(false)} className="group/ongoing flex min-h-12 w-full items-center gap-3 px-4 py-3 text-left text-brand-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring">
        <span aria-hidden="true" className="now-dot size-2.5 shrink-0 rounded-full bg-primary" />
        <span className="sr-only">{pick(advHome.ongoingTag, locale)}: </span>
        {showTimes ? <span className="text-body-compact font-semibold tabular-nums">{timeOf(slot.at)}</span> : null}
        {/* The desktop band's wording: "Live now across 3 courts". */}
        <span className="flex-1 text-body-compact font-semibold text-brand-muted-foreground">
          {singleCourt
            ? pick(advHome.zoneLive, locale)
            : fillCopy(advHome.liveAcross, locale, {
                c: String(slot.courts.length),
                cw: pick(slot.courts.length === 1 ? advHome.statCourtOne : advHome.statCourtMany, locale),
              })}
        </span>
        <ChevronDown aria-hidden="true" className="size-4 shrink-0 transition-transform duration-200 group-data-[state=closed]/ongoing:-rotate-90 motion-reduce:transition-none" />
      </CollapsibleTrigger>
      <CollapsibleContent className="hearing-reveal overflow-hidden">
        <div className="px-2 pb-2"><HearingBody hearings={slot.hearings} selectedCaseId={selectedCaseId} onOpenCase={onOpenCase} locale={locale} /></div>
      </CollapsibleContent>
    </Collapsible>
  );
  const c = slot.courts.length;
  return (
    <div className="relative overflow-hidden rounded-lg border border-brand-accent/50">
      <span aria-hidden="true" className="absolute inset-y-0 left-0 z-20 w-0.5 bg-brand-accent" />
      <div className="flex items-center gap-3 bg-brand-muted px-4 py-3">
        {showTimes ? (
          <span className="shrink-0 text-body font-semibold tabular-nums text-brand-muted-foreground">
            {timeOf(slot.at)}
          </span>
        ) : null}
        <span className="min-w-0 text-body font-semibold text-brand-muted-foreground">
          {singleCourt
            ? pick(advHome.zoneLive, locale)
            : fillCopy(advHome.liveAcross, locale, {
                c: String(c),
                cw: pick(c === 1 ? advHome.statCourtOne : advHome.statCourtMany, locale),
              })}
        </span>
        <span aria-hidden="true" className="now-dot ml-auto size-2 shrink-0 rounded-full bg-primary" />
      </div>
      <HearingBody
        hearings={slot.hearings}
        selectedCaseId={selectedCaseId}
        onOpenCase={onOpenCase}
        locale={locale}
      />
    </div>
  );
}

/**
 * A conflict slot (full view only) — quiet when collapsed: a sunken card with a
 * thin amber strip and a "Conflict" tag. Expands to the hearings.
 */
function ConflictSlot({
  slot,
  selectedCaseId,
  onOpenCase,
  locale,
}: {
  slot: TimeSlot;
  selectedCaseId: string | null;
  onOpenCase: (caseId: string) => void;
  locale: Locale;
}) {
  const [open, setOpen] = React.useState(false);
  const [pointerMotion, setPointerMotion] = React.useState(true);
  return (
    // The amber strip is an overlay, not a flex sibling, so the header trigger
    // spans the full card width and its hover reaches the card's boundary rather
    // than stopping short of the strip.
    <div className="relative overflow-hidden rounded-xl bg-surface-sunken lg:my-2">
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-y-0 left-0 z-10 w-0.5 bg-warning"
      />
      <div className="min-w-0 flex-1">
        <Collapsible data-pointer-motion={pointerMotion} onPointerDownCapture={() => setPointerMotion(true)} onKeyDownCapture={() => setPointerMotion(false)} open={open} onOpenChange={setOpen}>
          <CollapsibleTrigger
            aria-label={fillCopy(advHome.slotExpand, locale, { time: slot.key })}
            className="group/collapsible flex min-h-12 w-full flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2.5 text-left transition-colors hover:bg-accent-strong"
          >
            <HearingTime
              at={slot.at}
              approx={slot.approx}
              locale={locale}
              className="shrink-0 text-body-compact font-medium text-foreground"
            />
            <span aria-hidden="true" className="text-muted-foreground">·</span>
            <SlotCount slot={slot} locale={locale} />
            <StatusTag label={pick(advHome.conflictTag, locale)} className="ml-auto" />
            <ChevronDown
              aria-hidden="true"
              className="size-4 shrink-0 text-muted-foreground transition-transform group-data-[state=open]/collapsible:rotate-180"
            />
          </CollapsibleTrigger>
          <CollapsibleContent className="hearing-reveal overflow-hidden">
            <div className="p-1.5 pt-0">
              <HearingBody
                hearings={slot.hearings}
                selectedCaseId={selectedCaseId}
                onOpenCase={onOpenCase}
                locale={locale}
              />
            </div>
          </CollapsibleContent>
        </Collapsible>
      </div>
    </div>
  );
}

/** One scheduled slot: a lone matter as a row, a shared time (full view) as a conflict. */
function ScheduledSlot({
  slot,
  selectedCaseId,
  onOpenCase,
  locale,
}: {
  slot: TimeSlot;
  selectedCaseId: string | null;
  onOpenCase: (caseId: string) => void;
  locale: Locale;
}) {
  if (slot.conflict) {
    return <ConflictSlot slot={slot} selectedCaseId={selectedCaseId} onOpenCase={onOpenCase} locale={locale} />;
  }
  const hearing = slot.hearings[0];
  return (
    <div className="lg:border-b lg:border-hairline">
      <HearingRow
        hearing={hearing}
        onOpenCase={onOpenCase}
        locale={locale}
        selected={hearing.kase.id === selectedCaseId}
        showTime
        boxSurface="card"
        className="cursor-pointer hover:bg-muted has-focus-visible:bg-muted lg:rounded-lg"
      />
    </div>
  );
}

/**
 * The scheduled hearings: the first three, then the rest folded behind "N more
 * scheduled hearings". Opening it lays the rest out above the toggle, so the
 * row grows and the rail's line stretches with it.
 */
function ScheduledList({
  slots,
  selectedCaseId,
  onOpenCase,
  locale,
}: {
  slots: TimeSlot[];
  selectedCaseId: string | null;
  onOpenCase: (caseId: string) => void;
  locale: Locale;
}) {
  const [open, setOpen] = React.useState(false);
  const [pointerMotion, setPointerMotion] = React.useState(true);
  const shown = slots.slice(0, SCHEDULED_SHOWN);
  const rest = slots.slice(SCHEDULED_SHOWN);
  const restCount = rest.reduce((n, s) => n + s.hearings.length, 0);
  const item = (slot: TimeSlot) => (
    <ScheduledSlot key={slot.key} slot={slot} selectedCaseId={selectedCaseId} onOpenCase={onOpenCase} locale={locale} />
  );
  return (
    <div className="flex flex-col gap-2 lg:gap-0">
      {shown.map(item)}
      {rest.length ? (
        <Collapsible
          open={open}
          onOpenChange={setOpen}
          data-pointer-motion={pointerMotion}
          onPointerDownCapture={() => setPointerMotion(true)}
          onKeyDownCapture={() => setPointerMotion(false)}
          className="flex flex-col gap-2 lg:gap-0"
        >
          <CollapsibleContent className="hearing-reveal overflow-hidden">
            <div className="flex flex-col gap-2 lg:gap-0">{rest.map(item)}</div>
          </CollapsibleContent>
          <CollapsibleTrigger className="group/more flex min-h-12 w-full items-center justify-between gap-3 rounded-lg px-4 py-3 text-left text-body-compact text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring max-lg:border max-lg:border-hairline">
            <span>
              {open
                ? pick(advHome.showFewer, locale)
                : fillCopy(restCount === 1 ? advHome.moreScheduledOne : advHome.moreScheduledMany, locale, {
                    n: String(restCount),
                  })}
            </span>
            <ChevronDown
              aria-hidden="true"
              className="size-4 shrink-0 transition-transform duration-200 group-data-[state=open]/more:rotate-180 motion-reduce:transition-none"
            />
          </CollapsibleTrigger>
        </Collapsible>
      ) : null}
    </div>
  );
}

/* ─────────────────────────── concluded block ─────────────────────────── */

/** One concluded time slot inside the pile — consolidated, opening to its cases. */
function ConcludedSlot({
  slot,
  selectedCaseId,
  onOpenCase,
  locale,
}: {
  slot: TimeSlot;
  selectedCaseId: string | null;
  onOpenCase: (caseId: string) => void;
  locale: Locale;
}) {
  const [open, setOpen] = React.useState(false);
  const [pointerMotion, setPointerMotion] = React.useState(true);

  // Each concluded slot is its own white card — a single matter reads like a
  // scheduled row, a cluster opens to its cases — so a day's pile carries the
  // same card-and-gap rhythm, and every row hovers the one light-beige way.
  if (slot.hearings.length === 1) {
    const hearing = slot.hearings[0];
    return (
      <div className="lg:overflow-hidden lg:rounded-lg lg:border lg:border-hairline lg:bg-card">
        <HearingRow
          hearing={hearing}
          onOpenCase={onOpenCase}
          locale={locale}
          selected={hearing.kase.id === selectedCaseId}
          showTime
          boxSurface="card"
          className="cursor-pointer hover:bg-muted has-focus-visible:bg-muted"
        />
      </div>
    );
  }

  return (
    <div className="relative overflow-hidden rounded-lg border border-hairline bg-card">
      <span aria-hidden="true" className="pointer-events-none absolute inset-y-0 left-0 z-10 w-0.5 bg-input" />
      <Collapsible data-pointer-motion={pointerMotion} onPointerDownCapture={() => setPointerMotion(true)} onKeyDownCapture={() => setPointerMotion(false)} open={open} onOpenChange={setOpen}>
        <CollapsibleTrigger className="group/collapsible flex min-h-10 w-full flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2.5 text-left text-muted-foreground transition-colors hover:bg-muted">
          <span className="w-16 shrink-0 text-caption font-semibold tabular-nums text-foreground">{timeOf(slot.at)}</span>
          <span aria-hidden="true">·</span>
          <SlotCount slot={slot} locale={locale} />
          <ChevronDown
            aria-hidden="true"
            className="ml-auto size-4 shrink-0 transition-transform group-data-[state=open]/collapsible:rotate-180"
          />
        </CollapsibleTrigger>
        <CollapsibleContent className="hearing-reveal overflow-hidden">
          <div className="border-t border-hairline">
            <HearingBody
              hearings={slot.hearings}
              selectedCaseId={selectedCaseId}
              onOpenCase={onOpenCase}
              locale={locale}
            />
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}

/** The concluded pile: one summary row, opening to the day's earlier slots. */
function ConcludedBlock({
  slots,
  dayPhase,
  ended,
  selectedCaseId,
  onOpenCase,
  locale,
}: {
  slots: TimeSlot[];
  dayPhase: "past" | "today" | "future";
  /** The sitting is over (a past day, or today after its end). */
  ended: boolean;
  selectedCaseId: string | null;
  onOpenCase: (caseId: string) => void;
  locale: Locale;
}) {
  // A past day, or a sitting today has moved past, is nothing but its concluded
  // list, so it opens expanded. In a sitting under way the pile is just what is
  // behind the live group, so it stays collapsed until asked for.
  const isPast = dayPhase === "past" || ended;
  const [open, setOpen] = React.useState(isPast);
  const [pointerMotion, setPointerMotion] = React.useState(true);
  const showTimes = useShowTimes();
  const singleCourt = React.useContext(SingleCourtContext);
  const hearings = slots.flatMap((s) => s.hearings);
  const courts = new Set(hearings.map((h) => h.court)).size;
  const concludedPart = `${hearings.length} ${pick(advHome.concludedWord, locale)}`;
  // With one court the title has named it; a count of it says nothing.
  const courtsPart = singleCourt
    ? null
    : `${courts} ${pick(courts === 1 ? advHome.statCourtOne : advHome.statCourtMany, locale)}`;
  // The full view leads with the time range and slot count; the launch view has
  // neither (no times, one matter per slot), so it states just the two counts.
  const summaryLine = showTimes
    ? [
        hearings.length > 1
          ? `${timeOf(hearings[0].at)} – ${timeOf(hearings[hearings.length - 1].at)}`
          : timeOf(hearings[0].at),
        concludedPart,
        `${slots.length} ${pick(slots.length === 1 ? advHome.slotOne : advHome.slotMany, locale)}`,
        courtsPart,
      ].filter(Boolean).join(" · ")
    : [concludedPart, courtsPart].filter(Boolean).join(" · ");

  return (
    <Collapsible data-pointer-motion={pointerMotion} onPointerDownCapture={() => setPointerMotion(true)} onKeyDownCapture={() => setPointerMotion(false)} open={open} onOpenChange={setOpen} className="relative">
      {/* The stacked-card edge says "more behind this" on a phone; the desktop
          rail already says it with its count. */}
      {open ? null : (
        <span
          aria-hidden="true"
          className="absolute inset-x-3 -top-1.5 h-3 rounded-t-xl bg-accent-strong"
        />
      )}
      {/* A dark-beige hairline holds the bar's edge, so its hover fill never
          merges with the stacked edge behind it. */}
      <CollapsibleTrigger className="group/collapsible relative flex min-h-10 w-full items-center gap-2.5 rounded-xl border border-border bg-surface-sunken px-4 py-2 text-left text-muted-foreground transition-colors hover:bg-accent-strong">
        <CircleCheck aria-hidden="true" className="size-4 shrink-0" />
        <span className="min-w-0 flex-1 text-body-compact lg:truncate">{summaryLine}</span>
        <ChevronDown
          aria-hidden="true"
          className="size-4 shrink-0 text-muted-foreground transition-transform group-data-[state=open]/collapsible:rotate-180"
        />
      </CollapsibleTrigger>
      <CollapsibleContent className="hearing-reveal overflow-hidden">
        <div className="mt-1 flex flex-col gap-2 rounded-lg bg-surface-sunken p-2">
          {slots.map((slot) => (
            <ConcludedSlot
              key={slot.key}
              slot={slot}
              selectedCaseId={selectedCaseId}
              onOpenCase={onOpenCase}
              locale={locale}
            />
          ))}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

/** The heading that opens the scheduled zone on a phone — a quiet rule extending
 *  right, with a count. A desktop names the zone on its rail instead. */
function ScheduledSeparator({ label, count }: { label: string; count: number }) {
  return (
    <div className="flex items-center gap-2.5 pt-2 pb-1 lg:hidden">
      <span className="text-caption font-semibold text-muted-foreground">
        {label}
      </span>
      <Badge variant="secondary" className="tabular-nums">{count}</Badge>
      <span aria-hidden="true" className="h-px flex-1 bg-hairline" />
    </div>
  );
}

/* ─────────────────────────── the board ─────────────────────────── */

/**
 * One sitting's timeline, bracketed by the sitting's start and end on the rail:
 * the concluded pile, the live group, then what is scheduled next. The first row
 * carries the sitting's own filters, so each tab narrows only itself.
 */
function Board({
  slot,
  dayPhase,
  filters,
  selectedCaseId,
  onOpenCase,
  locale,
}: {
  slot: DaySlot;
  dayPhase: "past" | "today" | "future";
  filters: React.ReactNode;
  selectedCaseId: string | null;
  onOpenCase: (caseId: string) => void;
  locale: Locale;
}) {
  const { concluded, now, upcoming } = slot.board;
  const count = (slots: TimeSlot[]) => slots.reduce((n, s) => n + s.hearings.length, 0);
  return (
    <div className="flex flex-col gap-2 lg:gap-0">
      <PhaseRow marker="ring" edge="start" railHeight="h-10" label={slot.startLabel}>
        <div className="lg:py-0.5">{filters}</div>
      </PhaseRow>

      {concluded.length ? (
        <PhaseRow
          railHeight="h-10"
          tone="concluded"
          last={!now.length && !upcoming.length}
          label={pick(advHome.zoneConcluded, locale)}
          sub={hearingsCount(count(concluded), locale)}
        >
          {/* Keyed by phase so the pile re-mounts when the day moves between today
              and a past day — that is what lets its open-by-default state
              (expanded on a past day, collapsed on today) take effect. */}
          <ConcludedBlock
            key={`${dayPhase}-${slot.ended}`}
            slots={concluded}
            dayPhase={dayPhase}
            ended={slot.ended}
            selectedCaseId={selectedCaseId}
            onOpenCase={onOpenCase}
            locale={locale}
          />
        </PhaseRow>
      ) : null}

      {now.length ? (
        <PhaseRow
          tone="now"
          railHeight="h-12"
          last={!upcoming.length}
          label={pick(advHome.zoneLive, locale)}
          sub={hearingsCount(count(now), locale)}
        >
          {now.map((s) => (
            <NowSlot
              key={s.key}
              slot={s}
              selectedCaseId={selectedCaseId}
              onOpenCase={onOpenCase}
              locale={locale}
            />
          ))}
        </PhaseRow>
      ) : dayPhase === "today" && slot.live ? (
        // "Nothing is being called" only makes sense in the sitting under way. A
        // past day is wholly concluded and a future day wholly scheduled, so
        // neither carries a live gap to explain.
        <PhaseRow railHeight="h-12" last={!upcoming.length} label={pick(advHome.zoneLive, locale)} sub={hearingsCount(0, locale)}>
          <p className="px-4 py-2 text-body-compact text-muted-foreground lg:flex lg:h-12 lg:items-center lg:py-0">
            {pick(upcoming.length ? advHome.nowEmpty : advHome.noUpcoming, locale)}
          </p>
        </PhaseRow>
      ) : null}

      {upcoming.length ? (
        <PhaseRow
          railHeight="h-14"
          last
          label={pick(advHome.zoneUpcoming, locale)}
          sub={hearingsCount(count(upcoming), locale)}
        >
          <ScheduledSeparator label={pick(advHome.zoneUpcoming, locale)} count={count(upcoming)} />
          <ScheduledList
            slots={upcoming}
            selectedCaseId={selectedCaseId}
            onOpenCase={onOpenCase}
            locale={locale}
          />
        </PhaseRow>
      ) : null}

      <div className="hidden lg:block">
        <PhaseRow marker="ring" edge="end" railHeight="h-10" label={slot.endLabel} />
      </div>
    </div>
  );
}

/** Shown when a sitting's filters narrow it to nothing. */
function EmptyBoard({ locale, onClear }: { locale: Locale; onClear: () => void }) {
  return (
    <Empty className="bg-surface-sunken">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <SlidersHorizontal aria-hidden="true" />
        </EmptyMedia>
        <EmptyTitle>{pick(advHome.emptyFilteredTitle, locale)}</EmptyTitle>
        <EmptyDescription>{pick(advHome.emptyFilteredBody, locale)}</EmptyDescription>
      </EmptyHeader>
      <Button variant="outline" size="sm" onClick={onClear}>
        {pick(advHome.clearFilters, locale)}
      </Button>
    </Empty>
  );
}

/* ─────────────────────────── slot tabs ─────────────────────────── */

/** The live dot a sitting's tab wears while a matter in it is being called. */
/**
 * A clock before each sitting's time, so the tabs read as time slots (a
 * designer could not tell). The live sitting's clock is teal and carries the
 * "now" pulse as a ring around it, in place of the separate dot; the others
 * are a quiet beige clock, fainter once the sitting has ended (desktop only;
 * phones and tablets keep just the live one, for width).
 */
function SlotClock({ live, ended, locale }: { live: boolean; ended: boolean; locale: Locale }) {
  if (!live) {
    return (
      <Clock
        aria-hidden="true"
        // Desktop only: on a tablet the three short ranges need the width.
        className={cn("hidden size-3.5 shrink-0 text-muted-foreground lg:block", ended && "opacity-60")}
      />
    );
  }
  return (
    <>
      <Tooltip>
        <TooltipTrigger asChild>
          <span aria-hidden="true" className="-m-1 flex shrink-0 p-1">
            <span className="now-dot flex size-3.5 items-center justify-center rounded-full text-primary">
              <Clock className="size-3.5" />
            </span>
          </span>
        </TooltipTrigger>
        <TooltipContent side="top">{pick(advHome.slotLiveTip, locale)}</TooltipContent>
      </Tooltip>
      <span className="sr-only">{pick(advHome.slotLive, locale)}</span>
    </>
  );
}

/**
 * The concave join from a tab into its panel. Both the tab's top corners and
 * this cutout use the container radius token, rather than SVG control points
 * that made the corners independent of the design system.
 */
function TabSide({ side }: { side: "left" | "right" }) {
  return (
    // Inline size: the tab trigger shrinks any unsized svg to 16px.
    <svg
      aria-hidden="true"
      viewBox="0 0 20 40"
      style={{ width: 20, height: 40 }}
      className={cn(
        "pointer-events-none absolute bottom-0 overflow-visible",
        side === "right" ? "left-full" : "right-full -scale-x-100"
      )}
    >
      {/* A slight lean from the top corner down to a curve into the panel. */}
      <path d="M0 0 C7 0 10.2 3.6 10.6 12 L11.4 27 C11.8 35.5 14.5 39.5 20 39.5 V40 H0 Z" fill="var(--color-card)" />
      <path d="M0 0.5 C6.7 0.5 9.7 4 10.1 12.1 L10.9 27.1 C11.3 36 14.1 39.5 20 39.5" fill="none" stroke="var(--color-hairline)" />
    </svg>
  );
}

/**
 * A closed tab's hover fill. Beside the open tab, the side it shares leans at
 * the open tab's slant (about 3°) and sits 4px off it all the way down; a
 * skewed end piece carries the lean while the body stays square to the row.
 */
function TabHover({ lean }: { lean: "left" | "right" | null }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "pointer-events-none absolute inset-y-1 -z-10 hidden group-hover/slot:block",
        lean === "left" ? "-left-4 right-0" : lean === "right" ? "-right-4 left-0" : "inset-x-0"
      )}
    >
      <span
        className={cn(
          "absolute inset-y-0 bg-accent-strong",
          lean === "left" ? "right-0 left-3 rounded-r-lg" : lean === "right" ? "right-3 left-0 rounded-l-lg" : "inset-x-0 rounded-lg"
        )}
      />
      {lean ? (
        <span
          className={cn(
            "absolute inset-y-0 w-6 rounded-lg bg-accent-strong",
            lean === "left" ? "left-0 skew-x-3" : "right-0 -skew-x-3"
          )}
        />
      ) : null}
    </span>
  );
}

/* ─────────────────────────── the timeline ─────────────────────────── */

export function HearingTimeline({
  daySlots,
  showTimes,
  singleCourt = false,
  dayPhase,
  filters,
  onFilterChange,
  peopleOptionsOf,
  accessOf,
  queueOf,
  onViewCauseList,
  onJoinCourt,
  onRefresh,
  selectedCaseId,
  onOpenCase,
  onOpenTasks,
  onViewInCauseList,
  tabActions,
  filterVariant = "menu",
  locale,
}: {
  /** The day's sittings — one tab each. Version 0 has one. */
  daySlots: DaySlot[];
  /** Surface each hearing's listed time (full view) or not (launch). */
  showTimes: boolean;
  /** State conflicts in the summary (full view) or the slot count instead (launch). */
  showConflicts: boolean;
  /** The deployment runs one court: no court on each row, no court filter. */
  singleCourt?: boolean;
  /** Where the selected day sits relative to today. */
  dayPhase: "past" | "today" | "future";
  /** Each sitting's own filter, by sitting key. */
  filters: Readonly<Record<string, SlotFilter>>;
  onFilterChange: (slotKey: string, next: SlotFilter) => void;
  /** The colleagues a sitting's people filter offers under a scope. */
  peopleOptionsOf: (hearings: TimelineHearing[], scope: PeopleScope) => PeopleOption[];
  /** How the viewer reaches a matter, for each row's access button. */
  accessOf: (kase: Case) => HearingAccess;
  /** Today's queue position for a scheduled matter (null: no tag). */
  queueOf?: (hearing: TimelineHearing) => HearingQueue | null;
  onViewCauseList: () => void;
  onJoinCourt: () => void;
  onRefresh: () => void;
  selectedCaseId: string | null;
  onOpenCase: (caseId: string) => void;
  /** Open the tasks rail and trace this case's tasks (the pending-flag click). */
  onOpenTasks: (caseId: string, taskIds: string[]) => void;
  /** Open the cause list and trace this matter's row (the per-hearing icon). */
  onViewInCauseList: (caseId: string) => void;
  /** The day's actions, at the right end of the sitting tabs' row (desktop). */
  tabActions?: React.ReactNode;
  filterVariant?: FilterVariant;
  locale: Locale;
}) {
  return (
    <OpenTasksContext.Provider value={onOpenTasks}>
      <ShowTimesContext.Provider value={showTimes}>
      <SingleCourtContext.Provider value={singleCourt}>
      <ViewInCauseListContext.Provider value={onViewInCauseList}>
      <AccessContext.Provider value={accessOf}>
      <QueueContext.Provider value={queueOf ?? null}>
        <div className="flex flex-col gap-4 pb-16 lg:gap-4 lg:pb-8">
          <RailStyles />
          {/* The day's own actions, above the tabs on a phone or tablet, full
              width. (The day's stats strip is retired: the tabs and the rail
              already say how the day is made up.) The extra bottom margin holds
              the refresh button's refreshed caption clear of the tabs. */}
          {/* The top margin keeps Refresh clear of the week strip's calendar
              button, so the two never meet under a thumb. */}
          <div className="mt-4 mb-2 flex flex-col gap-4 lg:hidden">
            <DayActions
              onViewCauseList={onViewCauseList}
              onJoinCourt={onJoinCourt}
              onRefresh={onRefresh}
              locale={locale}
            />
          </div>

          {/* Keyed by phase so a new day re-opens on its live sitting. */}
          <SlotTabs
            key={dayPhase}

            daySlots={daySlots}
            dayPhase={dayPhase}
            filters={filters}
            onFilterChange={onFilterChange}
            peopleOptionsOf={peopleOptionsOf}
            selectedCaseId={selectedCaseId}
            onOpenCase={onOpenCase}
            tabActions={tabActions}
            filterVariant={filterVariant}
            locale={locale}
          />
        </div>
      </QueueContext.Provider>
      </AccessContext.Provider>
      </ViewInCauseListContext.Provider>
      </SingleCourtContext.Provider>
      </ShowTimesContext.Provider>
    </OpenTasksContext.Provider>
  );
}

/**
 * The day's sittings as tabs over one panel. A desktop draws them the way a
 * browser does: the open sitting is a white tab joined to the white panel, the
 * others stack behind it, darker and overlapped, in clock order. A phone keeps
 * its underline tabs. Each panel holds its sitting's filters and timeline.
 */
function SlotTabs({
  daySlots: allSlots,
  dayPhase,
  filters,
  onFilterChange,
  peopleOptionsOf,
  selectedCaseId,
  onOpenCase,
  tabActions,
  filterVariant,
  locale,
}: {
  daySlots: DaySlot[];
  dayPhase: "past" | "today" | "future";
  filters: Readonly<Record<string, SlotFilter>>;
  onFilterChange: (slotKey: string, next: SlotFilter) => void;
  peopleOptionsOf: (hearings: TimelineHearing[], scope: PeopleScope) => PeopleOption[];
  selectedCaseId: string | null;
  onOpenCase: (caseId: string) => void;
  tabActions?: React.ReactNode;
  filterVariant: FilterVariant;
  locale: Locale;
}) {
  // Which sitting's advanced-filters sheet is open, if any.
  const [advancedFor, setAdvancedFor] = React.useState<string | null>(null);
  const singleCourt = React.useContext(SingleCourtContext);
  // A sitting with nothing listed has no tab: a future day with matters only in
  // the afternoon shows just the afternoon.
  const listed = allSlots.filter((s) => s.hearings.length > 0);
  const daySlots = listed.length ? listed : allSlots;
  // The sitting being called now leads; on a past or future day, the first.
  const [active, setActive] = React.useState(
    () => (daySlots.find((s) => s.live) ?? daySlots[0]).key
  );
  // A different sitting configuration can arrive without remounting the page.
  // Never leave Radix pointing at a panel that is no longer in the list.
  const selectedSlot = daySlots.find((s) => s.key === active)
    ?? daySlots.find((s) => s.live)
    ?? daySlots[0];
  const activeIndex = daySlots.indexOf(selectedSlot);

  return (
    // At least a screen tall (less the app header), so a shorter sitting
    // never shrinks the page under a reader who has scrolled down: the
    // browser would clamp the scroll and jump them back up.
    <Tabs value={selectedSlot.key} onValueChange={setActive} className="min-h-[calc(100svh-3.5rem)] gap-6 md:gap-0">
      {/* Phone: the Case view's tab row. The sittings that fit stay on one
          line; the rest fold into More, so the row never wraps to two lines. */}
      <div className="md:hidden">
        <OverflowTabsList
          aria-label={pick(advHome.sittingsLabel, locale)}
          value={selectedSlot.key}
          onSelect={(value) => {
            if (daySlots.some((s) => s.key === value)) setActive(value);
          }}
          moreLabel={pick(advHome.moreSittings, locale)}
          className="h-10 w-full justify-start rounded-none"
          triggerClassName="flex-none gap-1.5 group-data-[variant=line]/tabs-list:px-2.5"
          items={daySlots.map((slot) => ({
            value: slot.key,
            measure: `${shortSitting(slot.window)}${slot.live ? "*" : ""}`,
            label: (
              <>
                {/* Phone: only the live sitting carries a clock, for width. */}
                {slot.live ? <SlotClock live ended={false} locale={locale} /> : null}
                <span className="tabular-nums">{shortSitting(slot.window)}</span>
              </>
            ),
          }))}
        />
      </div>

      {/* Tablet and desktop: one stable hit area per tab; the active fill joins the panel. */}
      <div className="hidden items-end justify-between gap-4 md:flex">
      <TabsList className="flex h-auto min-w-0 flex-1 items-end justify-start gap-0 rounded-none border-0 bg-transparent p-0 group-data-horizontal/tabs:h-auto">
        {daySlots.map((slot, i) => {
          const isActive = i === activeIndex;
          // Chrome's thin divider between two closed tabs; none beside the open one.
          const divider = i > 0 && !isActive && i - 1 !== activeIndex;
          return (
            <TabsTrigger
              key={slot.key}
              value={slot.key}
              style={{ zIndex: isActive ? 30 : 20 }}
              // Every tab reserves its joins in both states. Selection changes
              // paint, never height, margins or label position.
              className={cn(
                "group/slot -mb-px h-10 rounded-none border-0 bg-transparent p-0 text-body-compact font-medium transition-none data-active:bg-transparent dark:data-active:border-0 dark:data-active:bg-transparent group-data-[variant=default]/tabs-list:data-active:shadow-none",
                // As in Chrome: the open tab keeps its full width; closed tabs
                // give way, truncating, when the row runs short.
                isActive ? "flex-none" : "min-w-16 flex-initial",
                divider &&
                  "before:absolute before:top-2 before:bottom-2 before:-left-px before:w-px before:bg-border"
              )}
            >
              {/* Each tab reserves 16px a side for the open tab's 20px side (a
                  12px top corner, a near-upright lean, a 9px foot), so a
                  neighbour's hover fill stops about 4px short of it. */}
              <SlotTabTip label={slot.label} enabled={!isActive}>
              <span className={cn(
                "relative mr-4 flex h-full min-w-0 flex-1 items-center justify-center gap-2 border-t border-transparent px-3",
                i > 0 && "ml-4",
                isActive && "border-hairline bg-card",
                isActive && i === 0 && "rounded-tl-xl border-l"
              )}>
              {!isActive ? (
                <TabHover lean={i === activeIndex + 1 ? "left" : i === activeIndex - 1 ? "right" : null} />
              ) : null}
              <SlotClock live={slot.live} ended={slot.ended} locale={locale} />
              {/* Short on a tablet, where three full ranges cannot share the row. */}
              <span className="min-w-0 truncate tabular-nums lg:hidden">{shortSitting(slot.window)}</span>
              <span className="hidden min-w-0 truncate tabular-nums lg:inline">{slot.label}</span>
              {isActive ? (
                <>
                  {/* The first tab's left edge runs into the panel's edge. */}
                  {i > 0 ? <TabSide side="left" /> : null}
                  <TabSide side="right" />
                </>
              ) : null}
              </span>
              </SlotTabTip>
            </TabsTrigger>
          );
        })}
      </TabsList>
      {/* Lifted 8px off the panel so the buttons breathe above it. */}
      {tabActions ? <div className="shrink-0 pb-2">{tabActions}</div> : null}
      </div>

      {daySlots.map((slot, i) => {
        const filter = filters[slot.key] ?? NO_SLOT_FILTER;
        const change = (patch: Partial<SlotFilter>) => onFilterChange(slot.key, { ...filter, ...patch });
        const people = peopleOptionsOf(slot.hearings, filter.scope);
        const courts = courtOptionsOf(slot.hearings);
        const hiddenCount = slot.hiddenByAccess;
        const filterRow = (
          <div className="grid grid-cols-2 gap-2 lg:flex lg:items-start">
            {filterVariant === "menu" ? (
              <>
                <span aria-hidden="true" className="hidden flex-1 lg:block" />
                {/* How much the filters are holding back, with a one-click undo,
                    right under the button doing the hiding, from its left edge,
                    so cause and effect read as one unit. Counts only what this
                    button hides, never the courts filter. On desktop the button
                    stretches to the line's width so the two share edges. */}
                <div className="contents lg:flex lg:flex-col lg:gap-1.5">
                  <AccessMenu
                    scope={filter.scope}
                    hidden={filter.hidden}
                    onChange={({ scope, hidden }) => change({ scope, people: [], hidden })}
                    onAdvanced={() => setAdvancedFor(slot.key)}
                    locale={locale}
                  />
                  {hiddenCount > 0 ? (
                    <p className="order-last col-span-2 flex items-center gap-x-1 text-caption font-normal whitespace-nowrap text-brand-muted-foreground">
                      <span>
                        {hiddenCount === 1
                          ? pick(advHome.hiddenOne, locale)
                          : fillCopy(advHome.hiddenMany, locale, { n: String(hiddenCount) })}
                      </span>
                      <span aria-hidden="true">·</span>
                      <button
                        type="button"
                        onClick={() => onFilterChange(slot.key, NO_SLOT_FILTER)}
                        className="relative font-medium underline underline-offset-2 after:absolute after:-inset-2 hover:text-foreground"
                      >
                        {pick(advHome.showAllHearings, locale)}
                      </button>
                    </p>
                  ) : null}
                </div>
                <HearingFiltersSheet
                  open={advancedFor === slot.key}
                  onOpenChange={(open) => setAdvancedFor(open ? slot.key : null)}
                  sittingLabel={slot.label}
                  scope={filter.scope}
                  hidden={filter.hidden}
                  peopleFor={(scope) => peopleOptionsOf(slot.hearings, scope)}
                  onApply={({ scope, hidden }) => change({ scope, people: [], hidden })}
                  locale={locale}
                />
              </>
            ) : (
            <>
            <ScopeSwitch
              scope={filter.scope}
              onChange={(scope) => {
                // Drop any ticked name the new scope no longer offers.
                const offered = new Set(peopleOptionsOf(slot.hearings, scope).map((o) => o.person.id));
                change({ scope, people: filter.people.filter((id) => offered.has(id)) });
              }}
              locale={locale}
            />
            <span aria-hidden="true" className="hidden flex-1 lg:block" />
            <PeopleFilter
              people={filter.people}
              options={people}
              onChange={(picked) => change({ people: picked })}
              locale={locale}
            />
            </>
            )}
            {singleCourt ? null : (
              <CourtFilter
                courts={courts}
                selected={filter.courts}
                onChange={(next) => change({ courts: next })}
                locale={locale}
              />
            )}
          </div>
        );
        const empty = slot.board.slots.length === 0;
        return (
          <TabsContent
            key={slot.key}
            value={slot.key}
            className="relative z-10"
          >
            {/* From a tablet up the sitting sits in the white panel its tab joins. */}
            <Card className={cn(PANEL_CLASS, "max-md:contents md:gap-0 md:overflow-visible md:px-4 md:pt-4 md:pb-4", HOME_PANEL_PAD, i === 0 && "md:rounded-tl-none")}>
              {empty && isFiltered(filter) ? (
                <div className="flex flex-col gap-4 pb-4">
                  {filterRow}
                  <EmptyBoard locale={locale} onClear={() => onFilterChange(slot.key, NO_SLOT_FILTER)} />
                </div>
              ) : (
                <Board
                  slot={slot}
                  dayPhase={dayPhase}
                  filters={filterRow}
                  selectedCaseId={selectedCaseId}
                  onOpenCase={onOpenCase}
                  locale={locale}
                />
              )}
            </Card>
          </TabsContent>
        );
      })}
    </Tabs>
  );
}

/**
 * The courts a sitting's filter offers: those with a matter in it. Labels are
 * the short court names the rows already carry.
 */
/**
 * A sitting's range as short as it reads, for the phone and tablet tab row:
 * minutes only when they are not :00, am/pm on both ends ("9 am–10 am",
 * "10 am–3 pm", "3 pm–5:30 pm"), so a three-sitting day fits on one line.
 */
function shortSitting(window: { start: string; end: string }): string {
  const part = (hhmm: string) => {
    const [h, m] = hhmm.split(":").map(Number);
    const hour = h % 12 || 12;
    return { text: m ? `${hour}:${String(m).padStart(2, "0")}` : String(hour), ap: h < 12 ? "am" : "pm" };
  };
  const a = part(window.start);
  const b = part(window.end);
  return `${a.text} ${a.ap}–${b.text} ${b.ap}`;
}

/**
 * A closed tab's hover tip: the sitting's full time range, which a closed tab
 * may have truncated to make room for the open one. It hangs on the tab's inner
 * face, not the trigger, so it never overwrites the trigger's own data-state.
 */
function SlotTabTip({ label, enabled, children }: { label: string; enabled: boolean; children: React.ReactElement }) {
  if (!enabled) return children;
  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent side="top">{label}</TooltipContent>
    </Tooltip>
  );
}

function courtOptionsOf(hearings: TimelineHearing[]): CourtOption[] {
  const byCourt = new Map<string, CourtOption>();
  for (const h of hearings) {
    const entry = byCourt.get(h.court) ?? { court: h.court, label: h.courtLabel, count: 0 };
    entry.count += 1;
    byCourt.set(h.court, entry);
  }
  return [...byCourt.values()].sort((a, b) => a.label.localeCompare(b.label));
}
