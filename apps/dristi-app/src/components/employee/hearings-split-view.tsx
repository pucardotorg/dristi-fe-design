"use client";

import * as React from "react";
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";

import { useCourt } from "@/components/court/court-provider";
import { Identifier } from "@/components/chrome/identifier";
import { HearingSessionButton } from "@/components/employee/hearings-table";
import {
  NextDateField,
  NextPurposeField,
} from "@/components/employee/next-hearing-fields";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DescriptionDetails,
  DescriptionList,
  DescriptionRow,
  DescriptionTerm,
} from "@/components/ui/description-list";
import { Kbd } from "@/components/ui/kbd";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { CourtRole } from "@/lib/employee/content";
import { seatPostsNextHearing } from "@/lib/employee/court-role";
import {
  causeTitle,
  counselFor,
  courtCaseStageLabel,
  courtHearingPurposeLabel,
  courtHearingStatusLabel,
  courtHearingStatusVariant,
  type CourtHearing,
} from "@/lib/employee/hearings";
import { cn } from "@/lib/utils";

/**
 * Today's hearings as a list beside one matter (owner, 2026-11-02 — an exploration of
 * the board as list and detail, alongside the table rather than replacing it).
 *
 * The left pane is the day's list, filtered and sorted by the same controls as the
 * table; the right pane is the matter chosen in it, with the same acts the row carries —
 * the session control with Pass over behind its chevron, the order, and, in the seat
 * that posts it, the next hearing. Nothing here is a second way of doing those acts:
 * each is the row's own component, writing to the same store, so the table and this
 * view cannot disagree.
 *
 * J and K step down and up the list, the way a mail list does, while focus is not in a
 * field or a pop-up.
 *
 * Desktop only (`lg` and up). Two panes do not survive a tablet, so below that the
 * screen keeps its table and phone list whichever layout was chosen.
 */
export function HearingsSplitView({
  rows,
  listedCount,
  seat,
  header,
  empty,
  selectedId,
  onSelect,
  onStartHearing,
  onEndHearing,
  onPassOver,
  postsNextHearing,
  sitting,
}: {
  /** The filtered, sorted list — every row, not a page of it. */
  rows: CourtHearing[];
  /** How many are listed for the day before any filter. */
  listedCount: number;
  seat: CourtRole;
  /** The status pills and the filter row, as the table's panel carries them. */
  header: React.ReactNode;
  /** What the list says when it is empty. */
  empty: React.ReactNode;
  selectedId: string | null;
  onSelect: (hearing: CourtHearing) => void;
  onStartHearing: (hearing: CourtHearing) => void;
  onEndHearing: (hearing: CourtHearing) => void;
  onPassOver: (hearing: CourtHearing) => void;
  /** Whether the next hearing is entered on this board — a court setting. */
  postsNextHearing: boolean;
  /** Whether the list is the day being sat. Another day is for reading only. */
  sitting: boolean;
}) {
  const index = rows.findIndex((hearing) => hearing.id === selectedId);
  const selected = index >= 0 ? rows[index] : null;

  const step = React.useCallback(
    (delta: number) => {
      if (rows.length === 0) return;
      const from = index < 0 ? (delta > 0 ? -1 : rows.length) : index;
      const to = Math.min(rows.length - 1, Math.max(0, from + delta));
      onSelect(rows[to]);
    },
    [rows, index, onSelect],
  );

  React.useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const key = event.key.toLowerCase();
      if (key !== "j" && key !== "k") return;
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      if (
        target?.closest(
          "input, textarea, select, [contenteditable=true], [role=dialog], [role=menu], [role=listbox]",
        )
      ) {
        return;
      }
      event.preventDefault();
      step(key === "j" ? 1 : -1);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [step]);

  /* Keep the chosen matter in view in the list as J and K walk it. */
  const listRef = React.useRef<HTMLUListElement>(null);
  React.useEffect(() => {
    listRef.current
      ?.querySelector('[aria-current="true"]')
      ?.scrollIntoView({ block: "nearest" });
  }, [selectedId]);

  return (
    /* Even halves (owner, 2026-11-02, after 40 / 60): the five status pills need 524px
       in one row, which a 40% pane does not have at a 1512 laptop, nor 48% once a
       scrollbar is drawn. Narrower than that they wrap rather than clip. */
    /* The card fills the height the page leaves it (`HearingsScreen`), and neither pane
       grows past it: the list scrolls inside its own pane, and the matter stays put
       beside it (owner, 2026-11-02). */
    <div className="grid min-h-0 min-w-0 flex-1 grid-cols-2 overflow-hidden rounded-xl border border-hairline bg-card shadow-raised">
      <section
        aria-label="Hearings list"
        className="col-span-1 flex min-h-0 min-w-0 flex-col border-r border-hairline"
      >
        <div className="flex shrink-0 flex-col gap-4 p-6 pb-4">
        {header}
        <p className="text-body-compact text-muted-foreground tabular-nums">
          {rows.length === listedCount
            ? `${rows.length} ${rows.length === 1 ? "matter" : "matters"}`
            : `${rows.length} of ${listedCount} matters`}
        </p>
        </div>
        {rows.length === 0 ? (
          <div className="p-6 pt-2">{empty}</div>
        ) : (
          <ul
            ref={listRef}
            /* No drawn scrollbar (owner, 2026-11-02) — the pill row's own treatment
               (`pill-plate.ts`). Wheel, trackpad and keyboard still scroll it, and J / K
               bring the chosen matter into view. */
            className="flex min-h-0 flex-1 flex-col overflow-y-auto border-t border-hairline [scrollbar-width:none]"
          >
            {rows.map((hearing) => (
              <SplitListItem
                key={hearing.id}
                hearing={hearing}
                current={hearing.id === selectedId}
                onSelect={onSelect}
              />
            ))}
          </ul>
        )}
      </section>

      <section
        aria-label="Selected matter"
        className="col-span-1 min-h-0 min-w-0 overflow-y-auto [scrollbar-width:none]"
      >
        {selected ? (
          /* One rhythm down the pane: 24px between its parts, the list pane's padding. */
          <div className="flex flex-col gap-6 p-6">
            <SplitDetail
              /* Keyed so a new matter opens its own fields, not the last one's. */
              key={selected.id}
              hearing={selected}
              position={index + 1}
              count={rows.length}
              seat={seat}
              onPrevious={index > 0 ? () => step(-1) : undefined}
              onNext={index < rows.length - 1 ? () => step(1) : undefined}
              onStartHearing={onStartHearing}
              onEndHearing={onEndHearing}
              onPassOver={onPassOver}
              postsNextHearing={postsNextHearing}
              sitting={sitting}
            />
          </div>
        ) : null}
      </section>
    </div>
  );
}

/**
 * One matter in the list. The whole row is the control that opens it on the right.
 *
 * A scheduled row carries no chip — eleven "Scheduled" chips would say nothing. Every
 * other status keeps its chip, so a mixed list under All still says where each matter
 * stands. (A "Next" mark on the first one to call was tried and removed, owner
 * 2026-11-02: it is the first scheduled row in cause list order already.)
 */
function SplitListItem({
  hearing,
  current,
  onSelect,
}: {
  hearing: CourtHearing;
  current: boolean;
  onSelect: (hearing: CourtHearing) => void;
}) {
  return (
    <li className="border-b border-hairline last:border-b-0">
      <button
        type="button"
        aria-current={current ? "true" : undefined}
        onClick={() => onSelect(hearing)}
        className={cn(
          "flex w-full min-w-0 items-start gap-4 border-l-2 py-4 pr-6 pl-6 text-left transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:ring-inset",
          current
            ? "border-primary bg-brand-muted"
            : "border-transparent hover:bg-accent",
        )}
      >
        <span className="w-6 shrink-0 text-body-compact text-muted-foreground tabular-nums">
          {hearing.item}
        </span>
        <span className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="text-body-compact font-medium text-balance">
            {causeTitle(hearing)}
          </span>
          <span className="text-caption text-muted-foreground">
            <span className="font-mono">{hearing.caseNumber}</span> ·{" "}
            {courtHearingPurposeLabel(hearing.purpose)}
          </span>
        </span>
        {hearing.status !== "scheduled" ? (
          <Badge
            variant={courtHearingStatusVariant(hearing.status)}
            className="shrink-0"
          >
            {courtHearingStatusLabel(hearing.status)}
          </Badge>
        ) : null}
      </button>
    </li>
  );
}

/** The chosen matter: who, where it stands, and the acts the row carries. */
function SplitDetail({
  hearing,
  position,
  count,
  seat,
  onPrevious,
  onNext,
  onStartHearing,
  onEndHearing,
  onPassOver,
  postsNextHearing,
  sitting,
}: {
  hearing: CourtHearing;
  position: number;
  count: number;
  seat: CourtRole;
  onPrevious?: () => void;
  onNext?: () => void;
  onStartHearing: (hearing: CourtHearing) => void;
  onEndHearing: (hearing: CourtHearing) => void;
  onPassOver: (hearing: CourtHearing) => void;
  postsNextHearing: boolean;
  sitting: boolean;
}) {
  const { court } = useCourt();
  const complainant = counselFor(hearing, "complainant").map((entry) => entry.name);
  const accused = counselFor(hearing, "accused").map((entry) => entry.name);
  const posts = sitting && postsNextHearing && seatPostsNextHearing(seat, court);

  return (
    <>
      <header className="flex items-start justify-between gap-6">
        <div className="flex min-w-0 flex-col gap-2">
          {/* The chip rides on the case line rather than after the title: a long cause
              title wrapped it onto a line of its own. */}
          <div className="flex flex-wrap items-center gap-2 text-body-compact text-muted-foreground">
            <span>
              <Identifier value={hearing.caseNumber} label="case number" /> · Item{" "}
              <span className="tabular-nums">{hearing.item}</span>
            </span>
            <Badge variant={courtHearingStatusVariant(hearing.status)}>
              {courtHearingStatusLabel(hearing.status)}
            </Badge>
          </div>
          <h2 className="text-title font-semibold text-balance">
            {causeTitle(hearing)}
          </h2>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span className="text-body-compact text-muted-foreground tabular-nums">
            {position} of {count}
          </span>
          <TooltipProvider delayDuration={0}>
            <StepButton
              label="Previous matter"
              shortcut="K"
              onClick={onPrevious}
            >
              <ChevronLeftIcon aria-hidden />
            </StepButton>
            <StepButton label="Next matter" shortcut="J" onClick={onNext}>
              <ChevronRightIcon aria-hidden />
            </StepButton>
          </TooltipProvider>
        </div>
      </header>

      {sitting ? (
        <div className="flex flex-wrap items-center gap-3">
          <HearingSessionButton
            hearing={hearing}
            seat={seat}
            variant="default"
            onStartHearing={onStartHearing}
            onEndHearing={onEndHearing}
            onPassOver={onPassOver}
            passOver="button"
          />
        </div>
      ) : null}

      {/* Hairline rules, the card's own divider weight, so the list beside it and this
          read as one sheet. */}
      <DescriptionList>
        <DescriptionRow className="border-hairline">
          <DescriptionTerm>Today&rsquo;s purpose</DescriptionTerm>
          <DescriptionDetails>{courtHearingPurposeLabel(hearing.purpose)}</DescriptionDetails>
        </DescriptionRow>
        <DescriptionRow className="border-hairline">
          <DescriptionTerm>Case stage</DescriptionTerm>
          <DescriptionDetails>{courtCaseStageLabel(hearing.stage)}</DescriptionDetails>
        </DescriptionRow>
        <DescriptionRow className="border-hairline">
          <DescriptionTerm>Complainant side</DescriptionTerm>
          <DescriptionDetails>
            {complainant.length > 0 ? complainant.join(", ") : "No advocate on record"}
          </DescriptionDetails>
        </DescriptionRow>
        <DescriptionRow>
          <DescriptionTerm>Accused side</DescriptionTerm>
          <DescriptionDetails>
            {accused.length > 0 ? accused.join(", ") : "No advocate on record"}
          </DescriptionDetails>
        </DescriptionRow>
      </DescriptionList>

      {posts ? <SplitNextHearing hearing={hearing} /> : null}
    </>
  );
}

/** Previous or next, as an icon with its key in an instant tooltip. */
function StepButton({
  label,
  shortcut,
  onClick,
  children,
}: {
  label: string;
  shortcut: string;
  onClick?: () => void;
  children: React.ReactNode;
}) {
  const button = (
    <Button
      type="button"
      variant="outline"
      size="icon"
      aria-label={label}
      aria-keyshortcuts={shortcut}
      disabled={!onClick}
      onClick={onClick}
    >
      {children}
    </Button>
  );
  /* A disabled button takes no pointer, so it would never show the tip. */
  if (!onClick) return button;
  return (
    <Tooltip>
      <TooltipTrigger asChild>{button}</TooltipTrigger>
      <TooltipContent>
        {label} <Kbd>{shortcut}</Kbd>
      </TooltipContent>
    </Tooltip>
  );
}

/**
 * The next hearing: the table column's own two fields, so a date picked here is the date
 * the column shows, and both save as they change. The date's calendar already shows how
 * many hearings each day holds (`listing-load.ts`).
 */
function SplitNextHearing({ hearing }: { hearing: CourtHearing }) {
  const id = React.useId();

  return (
    <section aria-labelledby={`${id}-title`} className="flex flex-col gap-4 border-t border-hairline pt-6">
      <h3 id={`${id}-title`} className="text-title-s font-semibold">
        Next hearing
      </h3>
      <div className="grid min-w-0 gap-4 xl:grid-cols-2">
        <div className="flex min-w-0 flex-col gap-2">
          <span id={`${id}-date`} className="text-body-compact font-medium">
            Date
          </span>
          <NextDateField hearing={hearing} labelledBy={`${id}-date`} />
        </div>
        <div className="flex min-w-0 flex-col gap-2">
          <span id={`${id}-purpose`} className="text-body-compact font-medium">
            Purpose
          </span>
          <NextPurposeField hearing={hearing} labelledBy={`${id}-purpose`} />
        </div>
      </div>
    </section>
  );
}
