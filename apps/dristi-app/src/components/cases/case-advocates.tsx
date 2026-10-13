"use client";

import * as React from "react";

import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import {
  counselFor,
  type CaseRecord,
  type CounselSide,
} from "@/lib/cases/types";
import { displayName } from "@/lib/cases/names";

const SIDES: readonly CounselSide[] = ["complainant", "accused"];

const SIDE_COPY: Record<
  CounselSide,
  { mark: string; one: string; many: string; list: string }
> = {
  complainant: {
    mark: "(C)",
    one: "complainant advocate",
    many: "complainant advocates",
    list: "Other complainant advocates",
  },
  accused: {
    mark: "(A)",
    one: "accused advocate",
    many: "accused advocates",
    list: "Other accused advocates",
  },
};

/**
 * Both sides in one cell — one name each, complainant above accused, so the
 * pair reads in the order the cause title does. `(C)` / `(A)` carries the
 * side; without it a merged column would be an unattributed list of names.
 * A side with no vakalat on record still gets its line (owner, Sept 24): with
 * it left out, a party in person read their own case as having only an
 * accused side. Worded as the case header words it.
 */
export function CaseAdvocatesPair({
  record,
  dense = false,
}: {
  record: CaseRecord;
  /** Dense table row — see `dense` on CaseAdvocates. */
  dense?: boolean;
}) {
  /* Comfortable surfaces expand each chip to a 40px-tall target, so the two
     lines need a 40px pitch or the two targets overlap. min-h-6 + gap-4 is
     exactly that. The dense table's chips are their own 24px box and stay
     tight. */
  return (
    <div className={cn("flex flex-col", dense ? "gap-1" : "gap-4")}>
      {SIDES.map((side) =>
        counselFor(record, side).length > 0 ? (
          <CaseAdvocates
            key={side}
            record={record}
            side={side}
            markSide
            dense={dense}
            /* The header's dotted text pattern, not a chip (owner, Sept 18);
               in the dense table it reads "+2" without the word. */
            more="text"
          />
        ) : (
          <NoCounsel key={side} side={side} />
        )
      )}
    </div>
  );
}

/** The case header's wording for a side with no advocate: the complainant
 *  filed the complaint themselves, so they appear in person; the accused may
 *  simply not have appeared yet. */
const NO_COUNSEL: Record<CounselSide, string> = {
  complainant: "Party in person",
  accused: "None on record",
};

function NoCounsel({ side }: { side: CounselSide }) {
  const copy = SIDE_COPY[side];
  return (
    <div className="flex min-h-6 min-w-0 items-center gap-1 text-body-compact text-muted-foreground">
      <span className="truncate">{NO_COUNSEL[side]}</span>
      <span aria-hidden className="shrink-0">
        {copy.mark}
      </span>
      <span className="sr-only">{`, ${copy.one}`}</span>
    </div>
  );
}

/**
 * Hover opens the +N list on pointer devices; click, tap and Enter keep working
 * exactly as before. Hover is strictly additive — ACCESSIBILITY.md §7 forbids
 * hover being the only path to information, which is why this stays a Popover
 * rather than becoming a HoverCard (a HoverCard would show a touch user nothing).
 * The close is delayed so the pointer can travel from the chip onto the list, and
 * a hover-open does not steal focus the way a click-open should.
 */
function useHoverPopover() {
  const [open, setOpen] = React.useState(false);
  const closeTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const openedByHover = React.useRef(false);

  const canHover = () =>
    typeof window !== "undefined" &&
    window.matchMedia("(hover: hover) and (pointer: fine)").matches;

  const cancelClose = () => {
    if (closeTimer.current) {
      clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
  };

  React.useEffect(() => cancelClose, []);

  return {
    open,
    openedByHover,
    onOpenChange: (next: boolean) => {
      cancelClose();
      if (!next) openedByHover.current = false;
      setOpen(next);
    },
    hoverProps: {
      onMouseEnter: () => {
        if (!canHover()) return;
        cancelClose();
        openedByHover.current = true;
        setOpen(true);
      },
      onMouseLeave: () => {
        if (!canHover()) return;
        cancelClose();
        closeTimer.current = setTimeout(() => {
          openedByHover.current = false;
          setOpen(false);
        }, 150);
      },
    },
  };
}

/**
 * First name on the row; remaining count as +N. The popover lists only the
 * names that are not already on the row — open on hover, click, tap or Enter.
 */
export function CaseAdvocates({
  record,
  side,
  className,
  markSide = false,
  dense = false,
  more = "chip",
}: {
  record: CaseRecord;
  side: CounselSide;
  className?: string;
  /** How the remaining names are offered: the +N chip of the dense table, or
   *  "+N others" as dotted-underlined text (case header; PM wording). */
  more?: "chip" | "text";
  /** Append `(C)` / `(A)`. On for the merged column, off where a label names
   *  the side already (case header). */
  markSide?: boolean;
  /** Dense table row: the chip keeps its own 24px box instead of expanding to
   *  a 40x40 target. Two chips stacked 4px apart would overlap each other's
   *  hit area, and a 40px trigger sets the row height for the whole table. */
  dense?: boolean;
}) {
  /* Above the early return — hooks run on every render or not at all. */
  const { open, openedByHover, onOpenChange, hoverProps } = useHoverPopover();
  const names = counselFor(record, side);
  if (names.length === 0) return null;

  const extra = names.length - 1;
  const copy = SIDE_COPY[side];

  /* z-10 keeps the +N trigger above the row's peek overlay. min-h-6 holds the
     line to the chip's own height, so a side with a +N and a side without one
     occupy the same band and the table keeps one row rhythm. */
  return (
    <div className="relative z-10 flex min-h-6 min-w-0 items-center gap-1">
      <span
        className={cn("truncate text-body-compact text-foreground", className)}
      >
        {displayName(names[0])}
      </span>
      {markSide ? (
        <>
          <span
            aria-hidden
            className="shrink-0 text-body-compact text-muted-foreground"
          >
            {copy.mark}
          </span>
          <span className="sr-only">{`, ${copy.one}`}</span>
        </>
      ) : null}
      {/*
        The chip is the trigger. Wrapping a Badge in a 40px Button made the
        cell the tallest thing in the row (109px against 65px for rows with no
        +N) and pushed the bookmark column out of the panel. Chip-sized, the
        row keeps its rhythm. Comfortable surfaces still expand to a 40x40
        target with an `after:` inset (ACCESSIBILITY.md, minimum interactive
        target); the dense table opts out — the 24px chip already clears WCAG
        2.2's 24x24, and inset targets would overlap the line below.
      */}
      {extra > 0 ? (
        <Popover open={open} onOpenChange={onOpenChange}>
          <PopoverTrigger asChild {...hoverProps}>
            {more === "text" ? (
              /* Reads as part of the line; the dotted rule says there is more
                 behind it. The `after:` inset carries the 40px target. */
              <button
                type="button"
                aria-label={`${names[0]} and ${extra} more ${
                  extra === 1 ? copy.one : copy.many
                }`}
                className={cn(
                  "relative shrink-0 cursor-pointer rounded-sm text-muted-foreground underline decoration-dotted underline-offset-4 outline-none transition-colors hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50",
                  /* A step down in the dense table, where it trails a name in
                     a narrow column; the case header keeps the line's size. */
                  dense ? "text-caption font-medium" : "text-body-compact",
                  /* The dense table stacks two of these 4px apart, so the
                     expanded target would overlap the line below; there the
                     24px line box is the target, as it was for the chip. */
                  dense
                    ? "after:absolute after:-inset-x-1.5 after:inset-y-0"
                    : "after:absolute after:-inset-x-1.5 after:-inset-y-2"
                )}
                onClick={(event) => event.stopPropagation()}
              >
                {/* The dense table says just "+2" (owner, Sept 21): the
                    column is narrow and the dotted rule already says there is
                    more. The case header keeps the PM's "+2 others". */}
                {dense ? `+${extra}` : `+${extra} ${extra === 1 ? "other" : "others"}`}
              </button>
            ) : (
              <Badge
                asChild
                variant="ghost"
                className={cn(
                  "relative shrink-0 cursor-pointer bg-brand-muted text-brand-muted-foreground transition-colors hover:bg-brand-muted-hover hover:text-brand-muted-foreground",
                  /* overflow-visible: the primitive clips to the pill, which
                     would swallow the `after:` target. Nothing but text is in
                     the chip, so there is nothing left to clip. */
                  !dense &&
                    "overflow-visible after:absolute after:-inset-x-1.5 after:-inset-y-2"
                )}
              >
                <button
                  type="button"
                  aria-label={`${names[0]} and ${extra} more ${
                    extra === 1 ? copy.one : copy.many
                  }`}
                  onClick={(event) => event.stopPropagation()}
                >
                  +{extra}
                </button>
              </Badge>
            )}
          </PopoverTrigger>
          <PopoverContent
            align="start"
            className="w-64 text-body-compact"
            {...hoverProps}
            onOpenAutoFocus={(event) => {
              /* A click or Enter should land focus in the list; a pointer merely
                 passing over the chip should not yank it out of the table. */
              if (openedByHover.current) event.preventDefault();
            }}
          >
            <PopoverHeader>
              <PopoverTitle className="text-body-compact font-medium">
                {copy.list}
              </PopoverTitle>
            </PopoverHeader>
            <ul className="flex max-h-64 flex-col gap-2 overflow-y-auto">
              {names.slice(1).map((name, index) => (
                <li
                  key={`${name}-${index}`}
                  className="text-body-compact text-foreground"
                >
                  {displayName(name)}
                </li>
              ))}
            </ul>
          </PopoverContent>
        </Popover>
      ) : null}
    </div>
  );
}
