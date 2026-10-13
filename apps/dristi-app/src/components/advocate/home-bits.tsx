"use client";

import type { ReactNode } from "react";
import { ChevronRight } from "lucide-react";

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { AvatarGroup, AvatarGroupCount } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import type { Locale } from "@/lib/onboarding/content";
import { advHome, fillCopy } from "@/lib/advocate/content";
import type { TeamMember } from "@/lib/advocate/home";
import type { Task } from "@/lib/tasks/types";
import { dueCueOf } from "@/lib/tasks/format";
import { cn } from "@/lib/utils";
import { PersonAvatar, type AvatarSurface } from "@/components/tasks/person-avatar";

/**
 * Shared atoms of the advocate home: the team avatars, the cause-list item chip,
 * the row's hover action, and the task row that repeats inside hearing cards, the
 * case peek and the rail.
 *
 * `surface` is the one vocabulary the insets share. An avatar disc and an item
 * chip sitting in the same card used to answer "how does an inset read on this
 * fill?" two different ways — the chip stepped to white on a tint, the disc did
 * not — so the disc vanished into the beige card it sat on. One prop on both
 * makes that mismatch unrepresentable.
 */

/**
 * `AvatarGroup` rings in `background`, which is only right on the bare page; a
 * ring's job is to punch a hole in the overlap, so it has to equal the surface
 * the stack is standing on. Tailwind cannot take a token through an arbitrary
 * variant, so the three surfaces are a static map. (Raised with the DS as
 * request 16 — the fix belongs on the primitive.)
 */
const GROUP_RING: Record<AvatarSurface, string> = {
  card: "*:data-[slot=avatar]:ring-card",
  sunken: "*:data-[slot=avatar]:ring-surface-sunken",
  brand: "*:data-[slot=avatar]:ring-brand-muted",
};

/** The `+n` follows the discs' own rule: one step off the surface it sits on. */
const COUNT_FILL: Record<AvatarSurface, string> = {
  card: "bg-surface-sunken ring-card",
  sunken: "bg-card ring-surface-sunken",
  brand: "bg-card ring-brand-muted",
};

/**
 * What "this is the matter the peek is showing" looks like, on a card and on a
 * table row alike — one quiet neutral bar at the leading edge.
 *
 * Selection is the quietest rung of the loudness ladder: a ring, a border and a
 * fill at once is a costume. Brand is not available for it either — on this
 * screen brand fill means *now / live*, and a selected card wearing it would
 * claim to be in session. The rail strip already marks its active section this
 * way, so the screen gains a pattern rather than inventing one.
 */
export const SELECTED_BAR =
  "before:absolute before:inset-y-4 before:-left-2 before:w-0.5 before:rounded-full before:bg-border";

/**
 * Everyone on the matter, as overlapping discs — a case is rarely one advocate's,
 * and a single avatar told the row a lie about that. Vakalatnama holders come
 * first (the signed-in account first among them), then the advocates with case
 * access; the tooltip on each says which of the two they are. Past `max` the
 * remainder collapses into a count that names them.
 *
 * The discs are the DS `Avatar`, not hand-rolled spans. That matters for one
 * reason the hand-rolled version could not solve: the primitive carries an
 * `after:border-border mix-blend-darken` edge which darkens whatever fill it
 * lands on, so a disc reads on beige, on the brand tint and on white alike. A
 * white ring on a beige card was the wrong colour, not the wrong weight.
 *
 * The viewer's own disc is off by default. On a board it appeared on every row —
 * the viewer can see all of them — so it said nothing, while spending the brand
 * tint that elsewhere on this screen means "now". Surfaces where the subject
 * *is* who is on the matter, and the set is read once, pass `includeSelf`.
 */
export function AdvocateStack({
  locale,
  team,
  max = 3,
  includeSelf = false,
  surface = "card",
}: {
  locale: Locale;
  team: TeamMember[];
  max?: number;
  /** Keep the signed-in account's disc — for "who is on this case", not for lists. */
  includeSelf?: boolean;
  /** The fill this stack is standing on — it sets both the disc and the ring. */
  surface?: AvatarSurface;
}) {
  const others = includeSelf ? team : team.filter((member) => !member.you);
  if (others.length === 0) return null;
  const shown = others.slice(0, max);
  const rest = others.slice(max);

  return (
    // Overlapped by 4px, not the DS default 8: two-letter initials sit dead
    // centre, so any deeper overlap covers the very thing the disc exists to say.
    <AvatarGroup className={cn("w-fit shrink-0 -space-x-1", GROUP_RING[surface])}>
      {shown.map((member) => (
        <Tooltip key={member.person.id}>
          <TooltipTrigger asChild>
            {/* Self is in the stack but not brand-tinted — brand means "live"
                on this screen, and the viewer sits on every one of their own
                matters, so a tinted self-disc would light up the whole board.
                The initials and the "(you)" tooltip name it; `acts` styles it
                like anyone else, so your own disc shows your own vakalatnama
                standing. Holder solid, case-access hollow — the note lives in
                the stack. */}
            <PersonAvatar
              person={member.person}
              size="default"
              surface={surface}
              variant={member.acts ? "solid" : "outline"}
              label={labelOf(locale, member)}
            />
          </TooltipTrigger>
          <TooltipContent>{labelOf(locale, member)}</TooltipContent>
        </Tooltip>
      ))}
      {rest.length ? (
        <Tooltip>
          <TooltipTrigger asChild>
            {/* No size class: `AvatarGroupCount` sizes its own numeral with the
                group, and a named role passed in here is silently dropped in
                the merge rather than winning — the count reads at the discs'
                own size, which is what a peer of an initial should do. */}
            <AvatarGroupCount
              className={cn(
                "font-medium tabular-nums text-muted-foreground",
                COUNT_FILL[surface]
              )}
            >
              +{rest.length}
            </AvatarGroupCount>
          </TooltipTrigger>
          <TooltipContent>
            {rest.map((m) => m.person.name).join(", ")}
          </TooltipContent>
        </Tooltip>
      ) : null}
    </AvatarGroup>
  );
}

/** Who this is, and which side of the vakalatnama line they stand on. */
function labelOf(locale: Locale, member: TeamMember): string {
  const name = member.you
    ? fillCopy(advHome.switcherYou, locale, { name: member.person.name })
    : member.person.name;
  return fillCopy(
    member.acts ? advHome.teamHoldsVakalatnama : advHome.teamCaseAccess,
    locale,
    { name }
  );
}

/**
 * The one hover affordance every repeated row on this screen shares.
 *
 * The button itself holds the cell open — invisible and inert at rest, with a
 * chevron sitting in its place — so revealing it moves nothing and masks nothing.
 * (The earlier version floated the button over the row on an opaque patch; on a
 * card with content beside it, that read as a button stranded in mid-air.) It is
 * `aria-hidden` on purpose: it repeats the row title's own action, which is the
 * accessible path and the thing focus reveals it from.
 *
 * **It has no always-visible coarse-pointer fallback, deliberately.** The usual
 * rule — reveal-on-hover clusters must be permanently visible on touch — exists
 * so no action is reachable *only* by pointer. Here none is: every surface that
 * uses this puts `after:absolute after:inset-0` on its title button, so the whole
 * card is the tap target, and the list row's parties cell is itself a visible
 * button. Making the duplicate permanent would trade a bug that does not exist
 * for clutter on every repeated row. Decided in brief §15.3 D25; do not "fix" it.
 */
export function RowAction({
  label,
  onClick,
  rest,
  className,
}: {
  label: string;
  onClick: () => void;
  /** What stands in the cell at rest — a chevron unless the row has better to say. */
  rest?: ReactNode;
  className?: string;
}) {
  return (
    // Both states occupy the same grid cell, so the cell is as wide as the wider
    // of them and nothing reflows when they trade places.
    <span className={cn("grid shrink-0 items-center justify-items-end", className)}>
      <span className="col-start-1 row-start-1 flex items-center transition-opacity group-hover/row:opacity-0 group-focus-within/row:opacity-0">
        {rest ?? (
          <ChevronRight aria-hidden="true" className="size-4 text-muted-foreground" />
        )}
      </span>
      <Button
        variant="outline"
        size="xs"
        tabIndex={-1}
        aria-hidden="true"
        onClick={onClick}
        className="col-start-1 row-start-1 pointer-events-none opacity-0 transition-opacity group-hover/row:pointer-events-auto group-hover/row:opacity-100 group-focus-within/row:pointer-events-auto group-focus-within/row:opacity-100"
      >
        {label}
      </Button>
    </span>
  );
}

/**
 * The listed item number. A plain card tile on any tinted card — the brand
 * hero, the beige queue — a sunken well on white — the fill change is the
 * depth, so neither variant carries a shadow inside its already-lifted card.
 * Same `surface` vocabulary as the avatar discs beside it, so the two insets in
 * one card can never disagree about how deep they sit.
 */
export function ItemChip({
  item,
  size = "default",
  surface = "card",
  bare = false,
}: {
  item: number;
  size?: "default" | "lg";
  surface?: AvatarSurface;
  /** No well: the label and number stand on the row as they are (desktop board). */
  bare?: boolean;
}) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "flex shrink-0 flex-col items-center justify-center rounded-md",
        // On a card-surface row the box is a sunken beige well; when the row is
        // hovered it turns white so it separates from the row's hover tint.
        bare
          ? "bg-transparent"
          : surface === "card"
            ? "bg-surface-sunken group-hover/row:bg-card"
            : "bg-card",
        size === "lg" ? "size-11" : "size-11"
      )}
    >
      {size === "lg" ? (
        <>
          <span className="text-caption text-muted-foreground">Item</span>
          <span className="text-title-s font-semibold tabular-nums">{item}</span>
        </>
      ) : (
        <span className="text-body font-medium tabular-nums">{item}</span>
      )}
    </span>
  );
}

/**
 * The due wording a task row carries — words in ink, never a solid badge: these
 * rows repeat, and a red chip on each would spend the screen's whole
 * destructive budget before the rail count is read.
 */
export function DueCue({
  children,
  overdue,
}: {
  children: ReactNode;
  overdue?: boolean;
}) {
  return (
    <span
      className={cn(
        "text-caption tabular-nums",
        overdue ? "font-medium text-destructive-ink" : "text-muted-foreground"
      )}
    >
      {children}
    </span>
  );
}

/**
 * One pending task inside a hearing card. Nothing appears or disappears on
 * hover — the due cue and the row's one bordered action are both always there
 * (a repeated row carries at most one visible bordered action, and this is it),
 * so the row never changes shape under the pointer.
 */
export function HomeTaskRow({
  task,
  now,
  sub,
  action,
  onOpen,
  className,
}: {
  task: Task;
  now: Date | string | number;
  /** Optional second line — e.g. the matter, where the card does not already say it. */
  sub?: string;
  /** The task's own verb — "Pay", "Sign", "Open". */
  action: string;
  onOpen: () => void;
  className?: string;
}) {
  const due = dueCueOf(task, new Date(now));
  return (
    <div
      className={cn(
        "group/task relative flex min-h-16 items-center gap-3 rounded-lg px-4 py-3 transition-colors hover:bg-accent has-focus-visible:bg-accent",
        className
      )}
    >
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <button
          type="button"
          onClick={onOpen}
          className="text-left text-body-compact font-medium after:absolute after:inset-0 after:rounded-lg focus-visible:outline-none focus-visible:after:ring-3 focus-visible:after:ring-ring/50"
        >
          {task.title}
        </button>
        {sub ? (
          <span className="text-caption text-muted-foreground">{sub}</span>
        ) : null}
      </div>
      <div className="relative z-10 flex shrink-0 items-center gap-3">
        <DueCue overdue={due.overdue}>{due.primary}</DueCue>
        <Button variant="outline" size="xs" onClick={onOpen}>
          {action}
        </Button>
      </div>
    </div>
  );
}
