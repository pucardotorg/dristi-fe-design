"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDownIcon, SearchIcon, SettingsIcon } from "lucide-react";
import { toast } from "sonner";

import {
  useCourtRole,
  useCourtSession,
} from "@/components/employee/use-court-role";
import {
  courtRoleLabel,
  COURT_SEATS,
  type CourtRole,
} from "@/lib/employee/content";
import { setCourtRole } from "@/lib/employee/court-role";
import {
  COURT_NAV_LINKS,
  courtNavTrailing,
  courtNavRowsFor,
  courtNavGroupsFor,
  courtNavGroupsForCourt,
  courtNavGroupsForSeat,
  courtNavItemsForSeat,
  seatHasNarrowRail,
  isCourtNavActive,
  isCourtNavCombinedActive,
  isCourtNavCombinedRow,
  type CourtNavGroup,
  type CourtNavItem,
} from "@/lib/employee/navigation";
import { useCognizanceLayout } from "@/components/employee/use-cognizance-layout";
import type { CognizanceLayout } from "@/lib/employee/cognizance-layout";
import { useCourtNavLayout } from "@/components/employee/use-court-nav-layout";
import { useOrderDetailsPlacement } from "@/components/employee/use-order-details-placement";
import { useOrderFlow } from "@/components/employee/use-order-flow";
import { useOrderLayout } from "@/components/employee/use-order-layout";
import { useOrderSigning } from "@/components/employee/use-order-signing";
import { usePendingOrders } from "@/components/employee/use-pending-orders";
import { pendingOrderCountFor } from "@/lib/employee/pending-orders";
import { resetSandboxData } from "@/lib/employee/sandbox-reset";
import {
  ORDER_DETAILS_PLACEMENT_OPTIONS,
  type OrderDetailsPlacement,
} from "@/lib/employee/order-details-placement";
import { ORDER_FLOW_OPTIONS, type OrderFlow } from "@/lib/employee/order-flow";
import {
  CLASSIC_ORDER_LAYOUT_OPTIONS,
  type OrderLayout,
} from "@/lib/employee/order-layout";
import type { CourtNavLayout } from "@/lib/employee/nav-layout";
import { BrandGlyph } from "@/components/brand-lockup";
import { useCourtSearch } from "@/components/employee/court-search";
import {
  CHROME_FOLD_TRIGGER,
  ChromeRail,
  focusChromeFoldTrigger,
  RAIL_BRAND_ROW,
  RAIL_GROUP_LABEL,
  RAIL_ICON_BUTTON,
  RAIL_MUTED,
  RAIL_ROW,
  RAIL_SEAM,
  railRowNote,
  useFoldFocusHandoff,
  useRailCollapsed,
} from "@/components/chrome/app-chrome";
import { CHARCOAL_PLATE } from "@/components/chrome/rail-plate";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useCourt, useCourtText } from "@/components/court/court-provider";
import { COURT_IDS, courtProfile, isCourtId } from "@/lib/court/profiles";

/**
 * The court-side navigation rail — the magistrate's own, not the advocate's.
 *
 * Everything about how it looks comes from the shared chrome frame: the plate, the row
 * and section metrics, the seam, the fold to a 4rem strip, the off-canvas behaviour below
 * `md`. What lives here is only what is the bench's — the four groups of work, which of
 * them the court can actually reach yet, and who is sitting.
 *
 * The plate is charcoal, always. A magistrate's rail is institutional chrome; it does not
 * read a preference store and it offers no picker.
 */

/**
 * A menu column in this rail.
 *
 * `gap-2` rather than the DS sidebar default of `gap-1`. Four pixels between rows is
 * written for a menu of six; this rail renders twenty-two at once, and the owner's read of
 * the result was that it "adds a lot of visual noise". Noise is marks per unit area, and
 * with the red sparks already gone the remaining lever is area. Eight pixels is the next
 * step on the ladder — the micro steps (`1.5`, `2.5`) are for inside controls, not between
 * them — and it costs about 84px of scroll on a column that already overflows, which is
 * the trade this layout was chosen knowing.
 *
 * `items-center` is what keeps the 40px square honest once the rail is a strip: the rail
 * carries a hairline on its trailing edge, so centring by padding leaves 8px on one side
 * and 7px on the other. Centring by flex is immune to the border.
 */
const RAIL_MENU =
  "gap-2 group-data-[collapsible=icon]:gap-1 group-data-[collapsible=icon]:items-center";

/** What the row says out loud past its label. The count is a mark; the words go here. */
function spokenNote(item: CourtNavItem): string {
  return railRowNote([
    item.count !== undefined &&
      (item.count === 0 ? "nothing waiting" : `${item.count} waiting`),
    item.external && "opens outside DRISTI",
    !item.href && "not available yet",
  ]);
}

/**
 * What a row is made of, in both the link and the not-yet-a-link case.
 *
 * The label truncates and the count does not: a count is the whole point of the row, and
 * `1312` losing a digit would be a lie where a clipped label is only an inconvenience.
 *
 * A zero count renders no mark at all. The count exists to say how much is waiting, and
 * an empty queue has nothing to say — a spark against a nought would report an obligation
 * that is not there. The row stays and the absence is the answer; a screen reader is told
 * "nothing waiting" outright rather than left with silence.
 */
function RowContents({ item }: { item: CourtNavItem }) {
  const Icon = item.icon;
  const note = spokenNote(item);
  return (
    <>
      {/* The placeholder survives for a row that has no mark — nothing in
          `COURT_NAV_GROUPS` is bare any more, but `courtNavRowsFor` synthesises a
          combined row and a row promoted out of a group could lose its icon on some
          future edit. A row without one still has to start its label at the same x as
          the rest, which is the misalignment this rail was pulled up on. */}
      {Icon ? (
        /* 20px, which is what `RAIL_ROW` already declares for this rail's glyphs — the
           `size-4!` override that used to sit here was written for a rail where only two
           of twenty rows were marked, and where a 20px mark in full ink read as a louder
           species than the four section glyphs it sat above. Both halves of that are
           gone: every row is marked now, and the section label carries no glyph at all
           (`SidebarGroupLabel`), so there is nothing left for a row's mark to shout over.
           A 16px glyph in a 40px row is the lost mark `RAIL_ROW` sizes against.

           The ink stays muted while the label keeps the row's own, so the column reads
           label-first and the glyphs are a texture you scan rather than nineteen things
           competing with their own text. Folded there is no label left to be under, so
           the mark hands its ink back to the row — which is what lets the selected
           card's teal keep winning over it. */
        <Icon
          aria-hidden
          className={[
            "text-(--rail-muted)",
            "group-data-[collapsible=icon]:text-current",
          ].join(" ")}
        />
      ) : (
        <span aria-hidden className="size-5 shrink-0" />
      )}
      {/* The label leaves the layout rather than being clipped by the strip's overflow: a
          flex child of zero visible width is still a flex child, and it holds a centred
          glyph hard against the leading edge. */}
      <span className="min-w-0 flex-1 truncate group-data-[collapsible=icon]:hidden">
        {item.label}
      </span>
      {note ? <span className="sr-only">, {note}</span> : null}
      {item.count !== undefined && item.count > 0 ? (
        /* How much is waiting: a quiet numeral, and nothing else.
           **The red spark is gone** (owner, 2026-09-23: the rail "adds a lot of visual
           noise now"). It was adopted from the advocate rail's `TasksCount`, which had
           already been pulled back from a full red pill because that "read as an alarm
           bolted to the nav" — and the comment that stood here admitted the rest: that
           `--rail-badge` resolves to `--destructive-solid`, which the DS reserves for
           irreversible or dangerous actions, and that a signing queue is workload, not
           danger. The 6px dot was the concession that kept the red anyway.

           It does not survive the open layout. That concession was priced against a rail
           where one family disclosed at a time, so about seven sparks were on screen; with
           every queue visible there are seventeen, and a mark that appears on every row
           with work discriminates between nothing. This rail already makes that exact
           argument against four red dots on the folded strip (`CourtNavGroupMark`) — it
           was simply never applied to the expanded state. The numeral was always the
           thing carrying the count.

           The ink has to change with the row's ground. Idle, the numeral sits on the
           charcoal plate at `--rail-muted` (6.28:1). Selected, the row inverts to the
           white card and the same ink would fall to 2.08:1 — so it switches to the
           plate's `--rail-card-muted` (5.70:1), which `CARD` names for exactly this.
           `text-caption` carries the DS's 500 weight floor, so the numeral also stays
           at one weight while the selected row's label goes to 600.

           There is no folded register for it, because no folded row carries one: the only
           rows the strip renders are the two standalone links, and neither has a count.
           Where a count goes in a folded rail is answered in `CourtNavGroupMark` —
           nowhere, and for a reason. This hides it rather than trusting that, so a row
           that gains a count tomorrow cannot quietly squeeze four digits into 40px. */
        <span
          aria-hidden
          className={[
            "shrink-0",
            "group-data-[collapsible=icon]:hidden",
            "text-caption tabular-nums",
            RAIL_MUTED,
            "group-data-[active=true]/menu-button:text-(--rail-card-muted)",
          ].join(" ")}
        >
          {item.count}
        </span>
      ) : null}
    </>
  );
}

/**
 * What the tooltip on a row that goes nowhere says.
 *
 * Folded there is no label left on the row to explain, so the note names it first — the
 * same string the DS's own `tooltip` prop puts on a live row, with the reason after it.
 */
function deadRowNote(item: CourtNavItem, collapsed: boolean): string {
  if (item.external) {
    return collapsed
      ? `${item.label} — opens outside DRISTI, not available yet`
      : "Opens outside DRISTI — not available yet";
  }
  return collapsed
    ? `${item.label} — not available yet`
    : "Not available yet";
}

/**
 * One row: a link when it has somewhere to go, and an explained dead control when it does
 * not. The dead one is still a button and still takes focus — a control that can be
 * reached and asked why it does nothing is worth more than one that cannot be reached.
 *
 * A live row hands its label to the DS's `tooltip`, which shows only while the rail is
 * folded. None of the built rows stands outside a disclosure today, so none of them is on
 * screen in that state — but where a row sits is `navigation.ts`'s decision to change,
 * and a row promoted out of a group should not also have to remember to bring its folded
 * name with it.
 */
function CourtNavRow({
  item,
  active,
}: {
  item: CourtNavItem;
  /**
   * Overrides the row's own href match. The combined layouts' one row is not itself any
   * page's href — it stands for whatever `isCourtNavCombinedRow` folded into it
   * (`isCourtNavCombinedActive`) — so its caller passes the answer in rather than leaving
   * this row to ask a question its own href cannot answer.
   */
  active?: boolean;
}) {
  const pathname = usePathname();
  const collapsed = useRailCollapsed();

  if (item.href) {
    const isActive = active ?? isCourtNavActive(pathname, item.href);
    return (
      <SidebarMenuItem>
        <SidebarMenuButton
          asChild
          isActive={isActive}
          tooltip={item.label}
          className={RAIL_ROW}
        >
          <Link href={item.href} aria-current={isActive ? "page" : undefined}>
            <RowContents item={item} />
          </Link>
        </SidebarMenuButton>
        {/* Only Take cognizance carries these today, and only while the "split" setting
            (`cognizance-layout.ts`) is live — `courtNavGroupsFor` is what decides
            whether `children` is even present. Hidden with the rest of the row's own
            label when the rail folds (`SidebarMenuSub`'s own rule). */}
        {item.children && item.children.length > 0 ? (
          <SidebarMenuSub>
            {item.children.map((child) =>
              child.href ? (
                <SidebarMenuSubItem key={child.id}>
                  <SidebarMenuSubButton
                    asChild
                    isActive={isCourtNavActive(pathname, child.href)}
                  >
                    <Link
                      href={child.href}
                      aria-current={
                        isCourtNavActive(pathname, child.href) ? "page" : undefined
                      }
                    >
                      <span className="min-w-0 flex-1 truncate">{child.label}</span>
                      {child.count !== undefined && child.count > 0 ? (
                        <span className="shrink-0 text-caption text-muted-foreground tabular-nums">
                          {child.count}
                        </span>
                      ) : null}
                    </Link>
                  </SidebarMenuSubButton>
                </SidebarMenuSubItem>
              ) : null,
            )}
          </SidebarMenuSub>
        ) : null}
      </SidebarMenuItem>
    );
  }

  return (
    <SidebarMenuItem>
      <Tooltip>
        <TooltipTrigger asChild>
          <SidebarMenuButton type="button" aria-disabled className={RAIL_ROW}>
            <RowContents item={item} />
          </SidebarMenuButton>
        </TooltipTrigger>
        <TooltipContent side="right">
          {deadRowNote(item, collapsed)}
        </TooltipContent>
      </Tooltip>
    </SidebarMenuItem>
  );
}

/** A group is current when the page open is one of its rows, or one of a row's children. */
function isCourtNavGroupActive(
  pathname: string,
  group: CourtNavGroup,
): boolean {
  return group.items.some(
    (item) =>
      (item.href !== undefined && isCourtNavActive(pathname, item.href)) ||
      (item.children?.some(
        (child) => child.href !== undefined && isCourtNavActive(pathname, child.href),
      ) ??
        false),
  );
}

/**
 * Which one of the four sections is open, for the whole rail.
 *
 * One at a time. The rail holds seventeen rows, and with all four sections open at rest
 * the headers stopped being findable: the column read as one long list that happened to
 * have four labels in it. Single-open is what gives the four kinds of work their shape
 * back, and it costs exactly one thing — the magistrate can no longer keep two sections
 * in view — so which section is open has to be right without being asked for.
 *
 * **The route answers it, and is re-asked on every navigation.** Landing anywhere in the
 * court opens the section that page belongs to, so the rail points at where you are after
 * a deep link, a press on the folded strip, or a link a screen offers to somewhere outside
 * its own section. Between navigations the magistrate may open any other section and that
 * choice stands — reading the Sign queues from a hearings screen is an ordinary thing to
 * want, and a rail that sprang back would be unusable. The next navigation derives again,
 * because arriving somewhere new is precisely when "where am I" is the live question.
 *
 * `/employee` belongs to no section, so the court's home opens none: two links above four
 * shut headers. Picking one there would be an opinion about what a magistrate does first,
 * which is not something this build knows — and `courtTrail` says the same thing about the
 * same route by carrying no trail on it.
 *
 * All four shut is therefore a state the rail already has to be able to hold, which
 * settles the other end of it: pressing the open section's header closes it and leaves
 * none open. A header that refused would be a control that does nothing, and the rail
 * would be claiming a section is open because it has run out of ways to say otherwise.
 *
 * The area's layout outlives every route change inside it, so this state is never
 * remounted and a navigation cannot be inferred from mount order. The pathname it was
 * last derived from is kept beside it, which is what tells a navigation apart from an
 * ordinary re-render. Adjusting during render rather than in an effect is deliberate: the
 * section that opens has to be right in the same paint as the screen behind it, not one
 * frame later.
 */
function useCourtNavDisclosure(groups: CourtNavGroup[]) {
  const pathname = usePathname();
  const currentId =
    groups.find((group) => isCourtNavGroupActive(pathname, group))?.id ?? null;
  const [openId, setOpenId] = React.useState<string | null>(currentId);
  const [derivedFrom, setDerivedFrom] = React.useState(pathname);

  if (derivedFrom !== pathname) {
    setDerivedFrom(pathname);
    setOpenId(currentId);
  }

  return { openId, setOpenId, currentId };
}

/**
 * The group, folded: its mark alone, as a peer of the two standalone links.
 *
 * This is what a folded court rail *is*, and the data decided it rather than taste.
 * Fifteen of the seventeen rows carry no icon — deliberately, so the four section marks
 * do not flatten into their own contents — so there is no version of this strip that
 * shows the rows at all. Four marks and two links is the whole of what 4rem can hold, and
 * it turns out to be the right thing to say: which kind of work you are in, and how to
 * get back to the rest of it.
 *
 * So the mark answers "where am I" by taking the selected card whenever the page open is
 * one of its rows, and pressing it opens the rail on that section rather than toggling a
 * disclosure the strip has no room to show. A flyout listing the rows beside the strip
 * would say more, but it invents an interaction this product has nowhere else — and the
 * rail is already the disclosure, so it is one press either way.
 *
 * It is a button standing on its own, not a one-item list. A section header is not a list
 * item in the open rail either — it is a `SidebarGroupLabel`, a `div` — and wrapping each
 * of the four in its own `ul` to reuse the row primitives would have a screen reader
 * announce "list, 1 item" four times down a strip of six squares.
 *
 * **No count marks here.** The open rail annotates a *queue* with its length; a section
 * stands for three to six of them, and their sum is a figure this product states nowhere
 * — Sign alone runs to four digits on a 20px glyph. The alternative, a bare dot for "work
 * is waiting", is worse than nothing: all four sections have work waiting and always do,
 * so four red dots on six squares would discriminate between exactly nothing while
 * spending the rail's whole budget for alarm. Workload is what the magistrate opens the
 * rail to read; folded, it carries where-you-are and the way back.
 */
function CourtNavGroupMark({
  group,
  isActive,
  onPress,
  ref,
}: {
  group: CourtNavGroup;
  isActive: boolean;
  onPress: () => void;
  /** The section's header while the strip is closed — see `useFoldFocusHandoff`. */
  ref: React.Ref<HTMLButtonElement>;
}) {
  const Icon = group.icon;
  return (
    <SidebarMenuButton
      ref={ref}
      type="button"
      isActive={isActive}
      /* Not `page`: this is not the page's own link, it is the section the page sits in —
         the generic value, for the current item in a set of six. Without it the white card
         says "you are here" to everyone who can see the strip and to nobody who cannot. */
      aria-current={isActive ? true : undefined}
      tooltip={group.label}
      className={RAIL_ROW}
      onClick={onPress}
    >
      <Icon aria-hidden className="size-5!" />
      {/* The glyph is decorative, so the button needs words of its own — and they say more
          than the tooltip beside it does. The tooltip names the section for someone who
          can see the strip; this names it and its consequence for someone who cannot. */}
      <span className="sr-only">{group.label}, expands the navigation</span>
    </SidebarMenuButton>
  );
}

/**
 * The way into the search, at the head of the rail under every layout.
 *
 * A **row, not a field**. It opens a spotlight over the page rather than filtering the
 * column in place, and a text input that does not narrow what is under it as you type
 * into it is lying about itself. The advocate rail states the same control the same way
 * (`shell/app-sidebar.tsx`'s `Search` row), so this is one control the product already
 * has rather than a second idea about what search looks like.
 *
 * The shortcut is printed on the row instead of being taught somewhere: a keystroke
 * nobody can see is not an affordance. It is decorative — `aria-keyshortcuts` carries it
 * for anyone who cannot read the glyph, and the row's own label carries the rest.
 *
 * Folded, the keycap leaves with the labels and the 40px square is the whole row; the
 * DS tooltip on `SidebarMenuButton` names it there, which is what every other folded row
 * in this rail relies on.
 */
function CourtSearchRow() {
  const { open, shortcut } = useCourtSearch();
  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        type="button"
        tooltip="Search this court"
        aria-keyshortcuts="Meta+K Control+K"
        className={RAIL_ROW}
        onClick={open}
      >
        {/* The same two inks every other row's mark carries: muted while there is a
            label beside it to stay under, and the row's own ink once the strip has taken
            the labels away. Without the second half this was the one glyph in the folded
            column still painted muted while the other twenty-one had gone to full ink. */}
        <SearchIcon
          aria-hidden
          className={`${RAIL_MUTED} group-data-[collapsible=icon]:text-current`}
        />
        {/* **Leaves the layout when the rail folds**, which is the whole of why the
            folded search square looked wrong. This span had `flex-1` and no folded rule,
            so in a 40px square with `justify-center gap-0 p-0!` it still claimed every
            spare pixel and pushed the glyph off centre. Both rails already carry the
            warning — `RowContents` here and `LABEL` in the advocate's — that a flex child
            of zero visible width is still a flex child; this row was written fresh and did
            not inherit it. */}
        <span className="min-w-0 flex-1 truncate group-data-[collapsible=icon]:hidden">
          Search
        </span>
        {/* The advocate rail's own treatment (`SearchShortcut`), on the owner's call that
            the two should match: plain muted caption pushed to the trailing edge, not a
            bordered mono keycap. A stroked box in a rail whose only other strokes are its
            seams read as a control inside a control. `tabular-nums` is the one thing left
            behind — there are no numerals in "⌘K" for it to line up. */}
        <span
          aria-hidden
          className={`${RAIL_MUTED} ml-auto shrink-0 text-caption group-data-[collapsible=icon]:hidden`}
        >
          {shortcut}
        </span>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}

/**
 * The break between one section of the rail and the next.
 *
 * **Air when the rail is open, a rule when it is folded** (owner, 2026-09-23: *"remove
 * the rules"*). Expanded, 24px of clean space above a muted caption label is the whole
 * separation — which is what the owner's reference screen does, and what `ui-craft` asks
 * for in that order: spacing, then fill, then a justified divider. Five rules in a
 * twenty-two row column read as ruling rather than grouping.
 *
 * Folded, that inverts exactly, and this is the one place the rule still earns itself:
 * `SidebarGroupLabel` takes itself out of the strip, so there is no label left to do the
 * grouping and the rule is the only thing holding twenty-two marks apart. It insets to the
 * width of the squares so it underlines its group instead of cutting the strip.
 *
 * It is one component rather than a class string repeated five times, because the four
 * families and Configurations have to break the same way — the moment they are written
 * out separately, one of them drifts.
 */
function CourtNavBreak() {
  return (
    <div
      aria-hidden
      className={[
        "mt-6",
        /* Folded, the rule has to be exactly a square wide, and it is stated rather than
           inferred. `mx-3` looked right and was not: this sits inside `SidebarGroup`'s
           `p-2`, so a 12px-a-side margin measures against a 48px content box and drew a
           24px rule under a 40px square — narrower than the thing it was underlining,
           which is the near-miss that reads as a mistake. `w-10 mx-auto` matches the
           squares by construction, whatever padding the parent grows. */
        "group-data-[collapsible=icon]:mx-auto group-data-[collapsible=icon]:mt-4",
        "group-data-[collapsible=icon]:w-10",
        /* And matching space *below* the rule, so a group of squares is centred between
           its two rules rather than pressed against the one above it (owner, 2026-09-23:
           "it feels cramped otherwise"). The 16px above came from this element's own
           margin; the 16px below has to come from here too, because the label that would
           otherwise sit in the gap has no height once the strip takes it — so `pb` on the
           break is the one place that keeps all five sections symmetric by construction. */
        "group-data-[collapsible=icon]:pb-4",
        `group-data-[collapsible=icon]:border-t ${RAIL_SEAM}`,
      ].join(" ")}
    />
  );
}

/**
 * One family under the `"open"` layout: a rule, a label that stays put, and every row.
 *
 * There is no disclosure and therefore no state — which is the whole of what this layout
 * answers. `"grouped"` shuts whatever you had open on every navigation, so the second
 * visit to a queue costs what the first did; nothing here can shut.
 *
 * **The label is the DS `SidebarGroupLabel`, used as designed** — a 32px row, the
 * caption size at weight 500, in the sidebar's own muted ink, and it takes itself out of
 * the column when the rail folds. The grouped layout has to override all of that (`RAIL_GROUP_LABEL`)
 * because there the label is a 40px disclosure control carrying a glyph and a chevron.
 * Here it is a label and nothing else, so the primitive already is the thing. It also
 * carries no mark: every row below it has one now, and a nineteenth glyph on the header
 * would put the label back into the list it is supposed to be naming.
 *
 * It pins. Twenty rows run past the fold, so the column scrolls, and a family label that
 * scrolled away with its rows would leave the reader in an unnamed middle. `SidebarContent`
 * is the scrollport and carries no padding of its own, so `top-0` sits flush against it —
 * worth knowing, because the same thing written against a padded scroller leaves a band
 * above the pinned label that rows scroll through.
 *
 * The rule is its own element rather than a border on the label, for two reasons. The
 * break belongs *between* families and the label belongs to the family under it, so a
 * border-top would travel with the label and, once pinned, sit as a doubled line under
 * the header's own seam. And as a flow element it scrolls away when the label pins, which
 * is right: a pinned label has stopped being a break in the column and become its header.
 * Folded it insets to the width of the squares, because there the labels are gone and it
 * is the only thing left holding twenty marks in groups.
 */
function CourtNavOpenSection({ group }: { group: CourtNavGroup }) {
  return (
    /* `gap-0` folded, because the label is still a flex child there. The DS takes it out
       of view with `-mt-8 opacity-0` rather than `display:none` — so its height cancels
       but it keeps its two 4px gaps, an invisible 8px per section and 32px down a strip
       that is already taller than the window. Spacing that works by accident breaks on
       the next edit; folded, the break's own margin is the whole separation. */
    <div className="flex flex-col gap-1 group-data-[collapsible=icon]:gap-0">
      <CourtNavBreak />
      <SidebarGroupLabel className="sticky top-0 z-10 bg-sidebar">
        {group.label}
      </SidebarGroupLabel>
      <SidebarMenu className={RAIL_MENU}>
        {group.items.map((item) => (
          <CourtNavRow key={item.id} item={item} />
        ))}
      </SidebarMenu>
    </div>
  );
}

/**
 * A group of rows behind its own disclosure. One section open at a time; the whole header
 * toggles. Which one that is belongs to the rail — see `useCourtNavDisclosure` — because
 * a section can no longer decide it alone.
 *
 * **Still `Collapsible`, and the DS `Accordion` was read before that was kept.** Single
 * open plus the disclosure semantics is what `type="single" collapsible` exists to give,
 * so it was the first candidate and it does not survive contact with this rail. Its
 * trigger renders its own pair of chevrons as children, with no prop to withhold them,
 * and this header's sign is a plus and a minus for a stated reason; suppressing a
 * primitive's glyph in order to draw a different one is editing it at a distance. Its
 * content pane styles descendant anchors with an underline, which every row in a section
 * is. And an item is only operable through that trigger, while these headers swap to
 * `CourtNavGroupMark` when the rail folds — a control that opens the rail rather than a
 * disclosure, and one that must not be wearing accordion semantics while it does. Its
 * root also moves a roving tab stop between the four triggers, which in a column where
 * links sit between the headers would take the arrow keys away from half the rail. That
 * is four overrides and a semantic mismatch to buy a behaviour that is one shared piece
 * of state. Radix `Collapsible` already carries the whole of the disclosure contract the
 * accordion pattern asks of a header — `aria-expanded`, `aria-controls`, and a panel that
 * leaves the document — so what is coordinated here is which section is open, not the
 * accessibility of a section. The DS accordion is a prose component; this is chrome.
 *
 * No nested `SidebarGroup`: each one carries `p-2`, and stacking a group per section
 * doubled the air between "All cases" and "Hearings" (and between every closed
 * disclosure) while the rows inside a menu only had `gap-1`. The outer group owns the
 * inset; this section is just another beat in that same `gap-1` column.
 *
 * The toggle is a plus when the group is shut and a minus when it is open — the sign
 * names what pressing it does, which a chevron only implies. It is decorative on purpose:
 * `aria-expanded` on the header already carries the state, and announcing the glyph too
 * would say the same thing twice and disagree with it half the time.
 *
 * The disclosure is controlled rather than `defaultOpen` so that folding the rail is not
 * an opinion about it: the strip forces every section shut, and what each one returns to
 * is the state the rail is holding. Radix unmounts a closed section's rows, so the folded
 * strip holds no invisible links for the keyboard to walk into — which is also why the
 * header swaps component rather than hides. Hiding it would have left
 * `aria-expanded="true"` on a trigger whose panel is not in the document.
 *
 * **A shut section still says whether you are standing in it.** That is the bill single
 * open runs up: open Hearings from a signing queue and the selected row leaves with the
 * rows it sat among, and an expanded rail that shows the current page nowhere is worse
 * than the four open sections it replaced. The folded strip already answers this by
 * giving the mark the selected card; here the card is the wrong strength twice over —
 * it is the loudest mark the rail owns, sitting among open content rather than alone in a
 * strip, and the moment the section opens its own current row takes a card, so two would
 * be two answers to one question. The plate offers no fill between its ground and that
 * card except the hover fill, and hover and selection are deliberately different kinds of
 * mark in this rail, not two strengths of one. The ink is already at full strength on
 * every header. What is left is the weight, which is a strict part of what the selected
 * row does anyway — so the header goes semibold, and `aria-current` says the same thing
 * to a reader that cannot see it. Both only while the section is shut, so they hand the
 * question back to the row the instant the row can answer it.
 */
function CourtNavGroupSection({
  group,
  isCurrent,
  open,
  onOpenChange,
}: {
  group: CourtNavGroup;
  /** The page open is one of this group's rows. Worked out once, for the whole rail. */
  isCurrent: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const Icon = group.icon;
  const collapsed = useRailCollapsed();
  const { setOpen: setRailOpen } = useSidebar();
  /* One ref for whichever header is mounted. The two never coexist, and React detaches
     the outgoing one before it attaches the incoming one, so by the time the handoff
     effect runs this points at the header that is actually on screen. */
  const headerRef = React.useRef<HTMLButtonElement>(null);
  const focusHeader = React.useCallback(() => headerRef.current?.focus(), []);
  /* Two ways this section can lose the element holding the keyboard, and they are not the
     same event. The fold swaps the header itself and can strand focus whether the section
     was open or shut. Single open added the second: these rows now also leave when some
     *other* section opens, at a moment when nothing about the fold has changed — so the
     first handoff never hears about it. Both land the keyboard on this section's header,
     which is the element that took the place of what went away. Each keeps its own record
     of whether it held focus, and both bail unless focus actually fell to the document
     body, so the one that did not cause the loss stays out of it. Ordinary presses never
     reach either: pressing a header to close it, or another section's header to open it,
     leaves focus on a header that is still mounted. */
  const foldHandoff = useFoldFocusHandoff(collapsed, focusHeader);
  const closeHandoff = useFoldFocusHandoff(open, focusHeader);
  const handoff = {
    onFocus: () => {
      foldHandoff.onFocus();
      closeHandoff.onFocus();
    },
    onBlur: (event: React.FocusEvent) => {
      foldHandoff.onBlur(event);
      closeHandoff.onBlur(event);
    },
  };

  return (
    <Collapsible
      open={open && !collapsed}
      onOpenChange={onOpenChange}
      {...handoff}
      /* The section's own column carries the folded centring that `RAIL_MENU` gives the
         lists, because folded the header stands in this column directly rather than
         inside one. */
      className="group/court-group flex flex-col gap-1 group-data-[collapsible=icon]:items-center"
    >
      {collapsed ? (
        <CourtNavGroupMark
          ref={headerRef}
          group={group}
          isActive={isCurrent}
          /* Unfolding on a section is now also a choice of which section, and it is the
             one the magistrate just pointed at. Whatever was open closes, so the rail
             opens on the thing that was pressed rather than beside it. */
          onPress={() => {
            onOpenChange(true);
            setRailOpen(true);
          }}
        />
      ) : (
        <SidebarGroupLabel
          asChild
          className={`${RAIL_GROUP_LABEL} ${isCurrent && !open ? "font-semibold" : ""}`}
        >
          <CollapsibleTrigger
            ref={headerRef}
            /* Not `page`, for the reason the folded mark is not: the section is the set
               this page is in, not the page. It goes quiet the moment the section opens
               and the row inside can say `page` for itself. */
            aria-current={isCurrent && !open ? true : undefined}
          >
            <Icon aria-hidden />
            <span className="min-w-0 flex-1 truncate text-left">
              {group.label}
            </span>
            {/* One mark turned rather than two swapped: the toggle's width is constant
                by construction, so the label's truncation point cannot move as the
                section flips. Down closed, up open, as every other disclosure here. */}
            <ChevronDownIcon
              aria-hidden
              className="transition-transform group-data-[state=open]/court-group:rotate-180"
            />
          </CollapsibleTrigger>
        </SidebarGroupLabel>
      )}
      <CollapsibleContent>
        <SidebarMenu className={RAIL_MENU}>
          {group.items.map((item) => (
            <CourtNavRow key={item.id} item={item} />
          ))}
        </SidebarMenu>
      </CollapsibleContent>
    </Collapsible>
  );
}

/**
 * The rail's head: the mark at the page origin, and the control that folds the rail.
 *
 * The brand row is the bar's own height and carries the plate's seam, so the rule under it
 * and the rule under the top bar are one continuous line, in both rail widths.
 *
 * **The mark is pinned and the control is the one that gives way.** Folded, 4rem has room
 * for exactly one thing in this row, and the two candidates are not equals. A fold control
 * has somewhere else it can live — the bar carries it, as the advocate's does — while the
 * mark has nowhere: fold the rail with the mark hidden and DRISTI has no brand anywhere on
 * screen, on precisely the wide-table screens a magistrate spends the day in. The strip
 * below is also seven identical 40px squares on charcoal, and a mark at the top of it is a
 * different *kind* of thing, which is what makes a header read as a header rather than as
 * an eighth square. So this control leaves with the labels and the bar's takes over.
 *
 * **The glyph, not the lockup, in both states.** The lockup stacks "24×7 ON COURTS" under
 * the mark and the wordmark is 120 of its 735 viewBox units — at the 32px a 56px row can
 * spare, that is a 5px smudge, not a word. No height that fits this row makes it legible,
 * so the row carries the mark alone at both widths, as the advocate's rail does. `onDark`
 * follows the plate, not the app's mode — charcoal stays charcoal at night.
 *
 * In the sheet there is no trigger at all: the sheet appends its own close control at the
 * top right, and a second one 40px from it in the same row would overlap it and mean the
 * same thing. That gate is `isMobile` rather than a media query because it decides what to
 * *render*, and nothing depends on it being right before hydration — the sheet is shut at
 * first paint, and the column this also empties is `hidden` below `md`.
 */
/**
 * The mark at the page origin, and which court this is.
 *
 * The court used to be the third line of the rail's foot, under the person and the seat.
 * It is not a fact about the person: `CURRENT_STAFF.court` is one value for the whole
 * deployment and `session.ts` carries it as a single string spelled the way a court
 * document prints it. Three facts will not fit two lines in a 148px column — the seat and
 * the court together run past 180px at caption size — so the one that is a constant moves
 * to the chrome and is stated once, beside the mark, where a constant belongs. The foot is
 * then exactly two lines and cannot grow a third however long a name or a seat's title
 * gets (owner, 2026-09-18).
 *
 * **A deviation worth recording.** The foot deliberately never truncated this string —
 * "an ellipsis here has nothing behind it", and every order the sign queues produce is
 * headed with the court — so it wrapped and the footer grew. This row is a fixed 56px
 * matched to the top bar, so it cannot grow, and the column here is no wider. The demo
 * value fits ("JMFC Court 1" is well inside the ~152px available); a longer
 * bench truncates, and `title` is what stands behind the ellipsis that the foot had
 * nothing to offer. Folded, it goes `sr-only` rather than disappearing — the same trade
 * every other label in this rail makes when the strip takes over.
 */
function CourtRailHeader() {
  const courtText = useCourtText();
  const { isMobile } = useSidebar();
  const { court } = useCourtSession();
  const handoff = useFoldFocusHandoff(
    useRailCollapsed(),
    focusChromeFoldTrigger,
  );
  return (
    <div className={RAIL_BRAND_ROW}>
      <BrandGlyph className="h-6 shrink-0" onDark={CHARCOAL_PLATE.darkPlate} />
      <span
        title={courtText(court)}
        className="min-w-0 flex-1 truncate text-body-compact font-medium group-data-[collapsible=icon]:sr-only"
      >
        {courtText(court)}
      </span>
      {isMobile ? null : (
        <SidebarTrigger
          {...CHROME_FOLD_TRIGGER}
          {...handoff}
          /* Only ever on screen while the rail is open, so the label states the one thing
             it does. Its counterpart on the bar names the other direction. */
          aria-label="Collapse court navigation"
          className={`${RAIL_ICON_BUTTON} group-data-[collapsible=icon]:hidden`}
        />
      )}
    </div>
  );
}

/**
 * The monogram.
 *
 * One initial for a single name, two for a compound one. The advocate rail's
 * first-and-last rule reads "Uddipan" as "UU", which is not a pair of initials, it is a
 * stutter — and the court side runs as one staff member whose name is one word, so the
 * case that rail never meets is the only case this one has.
 */
function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "";
  const first = parts[0].charAt(0);
  const last = parts.length > 1 ? parts[parts.length - 1].charAt(0) : "";
  return (first + last).toUpperCase();
}

/**
 * Settings — which seat the court side is being worked from, and which shape its rail
 * takes.
 *
 * It used to be a dead control with a tooltip saying so, because there is no court
 * settings route: the one `/settings` this app has belongs to the citizen half, and a
 * stub route would have been a promise this branch cannot keep. That is still true, and
 * this is still not a route — it is a menu, because what the court side actually has to
 * set is small enough to answer in place.
 *
 * **Four seats** (`COURT_SEATS`) — the same four `/employee/login` signs in to, so the
 * menu can always name the seat the person arrived in. Same rail, same queues, same
 * screens, nothing granted
 * and nothing hidden; what differs is what a cause-list row offers — the bench's session
 * controls, or a row that ends at its order (`court-role.ts`). Beyond the sitting, what a
 * typist's work is as against a bench clerk's comes from product, and this build must not
 * answer that by quietly showing a different app. The menu is honest by being small.
 *
 * **Rail layout** (`nav-layout.ts`) — four shapes for the same rail, kept side by side
 * (owner, 2026-09-21 and 2026-09-23) rather than settled on one: "All queues" is the
 * default and shows every queue with no disclosures at all; "Grouped by type" is the rail
 * as it was, four disclosures with one open at a time; "Today's actions" keeps hearings a
 * tab of its own and folds the rest into one row; "Today's schedule" folds hearings in
 * with that same rest instead — see `courtNavRowsFor`. A second section rather than a
 * second control, because both are one person's preference about how their own rail looks,
 * not two different kinds of setting.
 *
 * **Take cognizance** (`cognizance-layout.ts`) — a third, narrower preference: whether
 * that one row keeps its reference-split queues as tabs inside one screen (today's
 * built default) or gives each its own row under it (owner, 2026-09-26, added as a
 * setting rather than a replacement — see `courtNavGroupsFor`). Its own section rather
 * than folded into Rail layout, because it answers a different question — the shape of
 * one row, not the shape of the whole rail — and the two must stay choosable
 * independently of each other.
 *
 * **Court** — which state's court the whole app runs as (`lib/court/profiles.ts`). The
 * same choice as the court icon on the advocate's Settings page (`CourtSwitch`), through
 * the same provider: the court side has no settings page to hold it, and a demo moves
 * between the two halves without signing out.
 *
 * All four sections are radio groups rather than plain items: each is one mutually
 * exclusive answer, and the menu has to show which one is live without being opened
 * twice. `w-auto min-w-48` because the primitive otherwise inherits the trigger's
 * width, and a 40px trigger would pinch "Bench clerk" to a column of letters.
 *
 * The tooltip stays, and now names the control rather than excusing it. Its trigger
 * wraps the menu's so one button carries both — the hover name and the click.
 *
 * It leaves with the labels when the rail folds. A strip has room for one mark at its
 * foot, and that mark is the person.
 */
function CourtSettingsControl() {
  const seat = useCourtRole();
  const { court, setCourt } = useCourt();
  const [layout, setLayout] = useCourtNavLayout();
  const [cognizanceLayout, setCognizanceLayout] = useCognizanceLayout();
  const [orderLayout, setOrderLayout] = useOrderLayout();
  const [orderFlow, setOrderFlow] = useOrderFlow();
  const [detailsPlacement, setDetailsPlacement] = useOrderDetailsPlacement();
  const [confirmReset, setConfirmReset] = React.useState(false);
  return (
    <DropdownMenu>
      <Tooltip>
        <TooltipTrigger asChild>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="Court settings"
              className={`${RAIL_ICON_BUTTON} group-data-[collapsible=icon]:hidden`}
            >
              <SettingsIcon aria-hidden />
            </Button>
          </DropdownMenuTrigger>
        </TooltipTrigger>
        <TooltipContent side="top">Court settings</TooltipContent>
      </Tooltip>
      {/* Opens upward off the rail's foot, and aligned to the trigger's own edge — there
          is no room below it and the menu would otherwise be pinned against the bottom
          of the window. */}
      <DropdownMenuContent side="top" align="end" className="w-auto min-w-48">
        {/* No dress on it: the DS label is already the muted eyebrow this wants, and a
            named role over the primitive's own size would be two sizes on one element. */}
        <DropdownMenuLabel>Working as</DropdownMenuLabel>
        <DropdownMenuRadioGroup
          value={seat}
          onValueChange={(next) => setCourtRole(next as CourtRole)}
        >
          {COURT_SEATS.map((role) => (
            <DropdownMenuRadioItem key={role} value={role}>
              {courtRoleLabel(role, court)}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
        <DropdownMenuSeparator />
        <DropdownMenuLabel>Rail layout</DropdownMenuLabel>
        <DropdownMenuRadioGroup
          value={layout}
          onValueChange={(next) => setLayout(next as CourtNavLayout)}
        >
          <DropdownMenuRadioItem value="open">All queues</DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="grouped">
            Grouped by type
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="actions">
            Today’s actions
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="schedule">
            Today’s schedule
          </DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
        {/* Only the delay split has two rows to split into; Gujarat's three case-type
            tabs stay on the one screen (owner, 2026-10-13). */}
        {courtProfile(court).cognizanceSplit === "delay" ? (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuLabel>Take cognizance</DropdownMenuLabel>
            <DropdownMenuRadioGroup
              value={cognizanceLayout}
              onValueChange={(next) => setCognizanceLayout(next as CognizanceLayout)}
            >
              <DropdownMenuRadioItem value="tabs">
                Combined, with tabs
              </DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="split">
                Split into two rows
              </DropdownMenuRadioItem>
            </DropdownMenuRadioGroup>
          </>
        ) : null}
        <DropdownMenuSeparator />
        {/* The new order flow, or the way it was (owner, 2026-10-14). */}
        <DropdownMenuLabel>Order flow</DropdownMenuLabel>
        <DropdownMenuRadioGroup
          value={orderFlow}
          onValueChange={(next) => setOrderFlow(next as OrderFlow)}
        >
          {ORDER_FLOW_OPTIONS.map((option) => (
            <DropdownMenuRadioItem key={option.id} value={option.id}>
              {option.label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
        {/* Pending orders' screen E only: attendance and the next hearing on the order's
            page, or back among its order data (owner, 2026-10-14). */}
        {orderFlow === "pending" ? (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuLabel>Attendance and next hearing</DropdownMenuLabel>
            <DropdownMenuRadioGroup
              value={detailsPlacement}
              onValueChange={(next) =>
                setDetailsPlacement(next as OrderDetailsPlacement)
              }
            >
              {ORDER_DETAILS_PLACEMENT_OPTIONS.map((option) => (
                <DropdownMenuRadioItem key={option.id} value={option.id}>
                  {option.label}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </>
        ) : null}
        {/* A–D are Classic's alone; Pending orders always opens E (owner, 2026-10-14). */}
        {orderFlow === "classic" ? (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuLabel>Order screen</DropdownMenuLabel>
            <DropdownMenuRadioGroup
              value={orderLayout}
              onValueChange={(next) => setOrderLayout(next as OrderLayout)}
            >
              {CLASSIC_ORDER_LAYOUT_OPTIONS.map((option) => (
                <DropdownMenuRadioItem key={option.id} value={option.id}>
                  {option.label}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </>
        ) : null}
        <DropdownMenuSeparator />
        <DropdownMenuLabel>Court</DropdownMenuLabel>
        <DropdownMenuRadioGroup
          data-court-raw=""
          value={court}
          onValueChange={(next) => {
            if (isCourtId(next)) setCourt(next);
          }}
        >
          {COURT_IDS.map((id) => (
            <DropdownMenuRadioItem key={id} value={id}>
              {courtProfile(id).name}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
        <DropdownMenuSeparator />
        {/* A demo control, last and apart: everything filed and drafted in this browser
            goes, so it asks first (owner, 2026-10-14). */}
        <DropdownMenuItem
          variant="destructive"
          onSelect={() => setConfirmReset(true)}
        >
          Reset sandbox data
        </DropdownMenuItem>
      </DropdownMenuContent>
      {/* The menu's root renders nothing of its own, so the confirmation can sit inside
          it; it portals out and outlives the menu closing. */}
      <AlertDialog open={confirmReset} onOpenChange={setConfirmReset}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reset sandbox data?</AlertDialogTitle>
            <AlertDialogDescription>
              The sample applications come back. Applications filed in this browser,
              order drafts, pending orders and signatures are removed. This cannot be
              undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => {
                resetSandboxData();
                toast("Sandbox data reset. The sample applications are back.");
              }}
            >
              Reset
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DropdownMenu>
  );
}

/**
 * The rail's foot: who is sitting, and on which bench.
 *
 * A block, not a menu. The advocate's footer is a popover because an advocate's account
 * has things to switch between — a litigant profile, a sandbox user, a rail plate. None
 * of those exist here: the court side runs as whoever came through `/employee/login`,
 * and the plate is charcoal by decision rather than by preference (`rail-plate.ts`). The one
 * thing there *is* to switch — the seat — belongs to the settings control beside this
 * block, where a court would look for a setting; folding it into the person's name would
 * hide it behind an identity that is not itself a menu.
 *
 * So the block reports and does not act. The role line is the live seat rather than the
 * fixture's, because the two must not disagree about the same visit: the switch is one
 * control away, and a footer still reading Bench clerk after the menu says Typist would
 * be the screen contradicting itself.
 *
 * Three lines rather than the advocate's two. Which bench the staff member is sitting on
 * is part of who they are on this screen — every order and form the sign queues produce
 * is headed with that court — and the chrome says it nowhere else, because the mark at
 * the head of the rail is the product's and not the court's.
 *
 * The name is the signed-in account's demo given name (`session.ts`), falling back to
 * `CURRENT_STAFF` when nobody has signed in; no honorific and no designation are added
 * to it here.
 *
 * Folded, the text goes `sr-only` rather than `hidden`. The disc keeps the initial, and
 * the identity stays in the accessibility tree in both states — which is what a static
 * block can offer in place of the tooltip a control would get, and it beats hanging a
 * person's name off a hover the keyboard cannot reach.
 */
function CourtIdentityFooter() {
  const { name } = useCourtSession();
  const role = useCourtRole();
  const { court: state } = useCourt();
  /* The settings control leaves the layout with the labels, so folding while it holds
     focus drops the keyboard the same way a section's rows do. Its fallback is the fold
     control — the one thing that caused the change and is on screen either side of it,
     though not the same element either side: see `focusChromeFoldTrigger`. The identity
     block itself is static and takes no focus to lose. */
  const handoff = useFoldFocusHandoff(
    useRailCollapsed(),
    focusChromeFoldTrigger,
  );
  return (
    <div
      {...handoff}
      className={`flex items-center gap-3 border-t ${RAIL_SEAM} p-3 group-data-[collapsible=icon]:justify-center`}
    >
      <span
        aria-hidden
        className="flex size-8 shrink-0 items-center justify-center rounded-full bg-(--rail-avatar) text-caption font-semibold text-(--rail-avatar-ink)"
      >
        {initialsOf(name)}
      </span>
      {/* Two lines, and it cannot grow a third: the court moved to the brand row (see
          `CourtRailHeader`), so what is left is one person and one seat, both short by
          nature. Neither truncates — the lines still wrap and the footer still grows, per
          `ACCESSIBILITY.md` §10 and §13, and `wrap-break-word` still catches the long
          unspaced compounds an Indic script produces that a space-based wrap would push
          past the rail's edge. A wrapped name costs a line here; it does not cost the
          court, which is the thing that had nowhere to be clipped to. */}
      <div className="flex min-w-0 flex-1 flex-col leading-tight group-data-[collapsible=icon]:sr-only">
        <span className="wrap-break-word text-body-compact font-medium">
          {name}
        </span>
        {/* One weight down, so a long seat title never starts competing with the
            person's name; the step between them is size and ink. */}
        <span className={`wrap-break-word text-caption font-medium ${RAIL_MUTED}`}>
          {courtRoleLabel(role, state)}
        </span>
      </div>
      <CourtSettingsControl />
    </div>
  );
}

/**
 * Pending orders' live count, set on its row: the orders live in this browser, so the
 * rail's data cannot carry the number (`pendingOrderCountFor`).
 */
function withPendingCount(
  groups: CourtNavGroup[],
  count: number | undefined,
): CourtNavGroup[] {
  return groups.map((group) =>
    group.items.some((item) => item.id === "pending-orders")
      ? {
          ...group,
          items: group.items.map((item) =>
            item.id === "pending-orders" ? { ...item, count } : item,
          ),
        }
      : group,
  );
}

export function EmployeeNav() {
  const [cognizanceLayout] = useCognizanceLayout();
  const seat = useCourtRole();
  const { court } = useCourt();
  /* The split rows are the delay split's; a case-type deployment keeps its tabs. */
  const pendingCount = pendingOrderCountFor(
    seat,
    usePendingOrders(),
    useOrderSigning(),
  );
  const [flow] = useOrderFlow();
  const groups = withPendingCount(
    courtNavGroupsForSeat(
      courtNavGroupsForCourt(
        courtNavGroupsFor(
          courtProfile(court).cognizanceSplit === "delay" ? cognizanceLayout : "tabs",
          flow,
        ),
        court,
      ),
      seat,
      flow,
    ),
    pendingCount,
  );
  const { openId, setOpenId, currentId } = useCourtNavDisclosure(groups);
  const [savedLayout] = useCourtNavLayout();
  /* A seat cut down to a few rows has nothing to fold into a combined row, so it shows
     them open whatever layout is saved. */
  const layout = seatHasNarrowRail(seat) ? "open" : savedLayout;
  const pathname = usePathname();
  return (
    /* Rows that go nowhere explain themselves on hover and on focus; at the DS default of
       0ms that turns a sweep down the rail into a strobe. */
    <TooltipProvider delayDuration={500}>
      <ChromeRail
        plate={CHARCOAL_PLATE}
        navLabel="Court navigation"
        sheetTitle="Court navigation"
        sheetDescription="Hearings, actions, applications and signing for this court."
        header={<CourtRailHeader />}
        footer={<CourtIdentityFooter />}
      >
        {/* One group, one inset, one gap: standalone links and disclosures share the
            same vertical rhythm instead of each section padding itself. */}
        <SidebarGroup className="gap-1">
          <SidebarMenu className={RAIL_MENU}>
            <CourtSearchRow />
            {courtNavItemsForSeat(COURT_NAV_LINKS, seat, flow).map((item) => (
              <CourtNavRow key={item.id} item={item} />
            ))}
          </SidebarMenu>
          {layout === "open" ? (
            groups.map((group) => (
              <CourtNavOpenSection key={group.id} group={group} />
            ))
          ) : layout === "grouped" ? (
            groups.map((group) => (
              <CourtNavGroupSection
                key={group.id}
                group={group}
                isCurrent={currentId === group.id}
                open={openId === group.id}
                /* Opening one closes whichever was open; closing the open one leaves
                   none. Both fall out of storing the id rather than four booleans —
                   there is no state here that could represent two sections open at
                   once. */
                onOpenChange={(next) => setOpenId(next ? group.id : null)}
              />
            ))
          ) : (
            /* The two combined layouts have no groups left to disclose: the rows
               `courtNavKeptApart` stands apart, and the one row everything else folds
               into (`courtNavRowsFor`), flat — the same list primitive the standalone
               links above already use. */
            <SidebarMenu className={RAIL_MENU}>
              {courtNavRowsFor(layout, court, seat, flow)
                .map((item) =>
                  item.id === "pending-orders" ? { ...item, count: pendingCount } : item,
                )
                .map((item) => (
                <CourtNavRow
                  key={item.id}
                  item={item}
                  active={
                    isCourtNavCombinedRow(item)
                      ? isCourtNavCombinedActive(pathname, layout, court, flow)
                      : undefined
                  }
                />
              ))}
            </SidebarMenu>
          )}
          {/* Configurations, last under every layout — it is the one row here that is
              not somewhere the bench works, so it closes the rail rather than heading
              it (owner, 2026-09-23). The seam is what says it is a different species
              from the queues above it; without one it reads as a fifth kind of work. */}
          <CourtNavBreak />
          <SidebarMenu className={RAIL_MENU}>
            {courtNavItemsForSeat(courtNavTrailing(flow), seat, flow).map((item) => (
              <CourtNavRow key={item.id} item={item} />
            ))}
          </SidebarMenu>
        </SidebarGroup>
      </ChromeRail>
    </TooltipProvider>
  );
}
