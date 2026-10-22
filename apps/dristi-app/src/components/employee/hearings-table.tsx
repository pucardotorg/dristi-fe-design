"use client";

import { useCourt } from "@/components/court/court-provider";
import * as React from "react";
import Link from "next/link";
import {
  ChevronDownIcon,
  GripVerticalIcon,
  FileCheckIcon,
  FilePenLineIcon,
  FileTextIcon,
  UserRoundXIcon,
} from "lucide-react";

import {
  TABLE_CELL,
  TABLE_HEAD,
  TABLE_HEAD_ROW,
  tableBodyClass,
  tableRowClass,
} from "@/components/chrome/table-plate";
import { Identifier } from "@/components/chrome/identifier";
import { CounselCell } from "@/components/employee/counsel-cell";
import {
  NextDateField,
  NextPurposeField,
} from "@/components/employee/next-hearing-fields";
import { useOrderDrafts } from "@/components/employee/use-order-draft";
import { hasDraftFor } from "@/lib/employee/order-drafts";
import {
  rowActivation,
  rowOpener,
  rowOpenerClass,
} from "@/lib/employee/row-activation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { CourtRole } from "@/lib/employee/content";
import {
  seatHasBenchControls,
  seatPostsNextHearing,
} from "@/lib/employee/court-role";
import {
  canDraftOrder,
  canEndHearing,
  canPassOver,
  canStartHearing,
  canTypeOrder,
  causeTitle,
  counselFor,
  courtCaseStageLabel,
  courtHearingPurposeLabel,
  courtHearingStatusLabel,
  courtHearingStatusVariant,
  type CourtHearing,
} from "@/lib/employee/hearings";
import {
  isCauseListColumnId,
  type CauseListColumn,
  type CauseListColumnId,
  type DropSide,
} from "@/lib/employee/cause-list-columns";
import { cn } from "@/lib/utils";

/**
 * Start hearing and End hearing live in the Action column, as one labelled outline
 * control — not teal (Join VC is the screen's one primary). Both are buttons: Start
 * marks the listing ongoing and opens that matter over the list; End marks it
 * completed. Neither leaves the day.
 *
 * It is the only bordered action on a callable row (ui-craft §2). Scheduled listings
 * start; the same slot ends the one that is ongoing. Completed listings have nothing
 * left to call, so the control stops taking a press — the same outline slot now
 * reads *Hearing ended*, disabled. A dash would read as missing data; the words say
 * the call is done. It stays the outline dress (not a second status chip) so the
 * Heard chip remains the one status mark (ui-craft §1.4). A passed-over listing is
 * called again later the same day, so it takes Start hearing again (`HRG-04`). An
 * abandoned one's day is over; its slot is empty and the Abandoned chip is the mark.
 *
 * Pass over is the other sitting outcome, not a second session verb: it lives
 * behind this control's chevron, on scheduled and ongoing rows only (`PassOverMenu`).
 *
 * **All of it belongs to the seat that runs the sitting.** A seat that does not gets no
 * slot at all, not a quieter one: this used to hand the typist a one-control version
 * that reported the sitting in three words, and three words for what the Status chip
 * two cells away already said is a column of nothing (owner, 2026-09-09). That seat's
 * cause list ends at Orders, and the trip into the order is what moves the matter
 * (`canTypeOrder`).
 *
 * `min-w-32` is a floor, not a fit: "Start hearing" measures 83px of ink and "End
 * hearing" / "Hearing ended" sit inside the same width, so 128px holds any of those
 * labels with room and neither the control nor the column jumps when the word
 * changes. It was `min-w-40`, which spent 45px per row on nothing and pushed the
 * table past the width of its own panel — see below.
 */
const SESSION_SLOT_CLASS = "min-w-32";
/**
 * The two right-hand columns are ordinary columns. They used to be pinned, and the pin
 * is what the bench read as a rendering fault.
 *
 * `sticky right-0` does not mean "hold still until scrolled past". It clamps the cell's
 * right edge to the scrollport's, so the moment the table is wider than the port the
 * cell is pulled *left*, over its neighbours, at scroll position zero — before anyone
 * has scrolled anything. Action covered Orders. Pinning Orders as well moved the same
 * collision one column left onto Status, where an opaque cell sliced the status chip
 * mid-word; pinning Status would have moved it onto Purpose. The pin was the bug, and
 * no pinning order was going to fix it.
 *
 * Measured on the render, and the numbers are the point. The panel is the viewport less
 * 385px with the rail open and less 193px folded. The table wanted 1182px, against
 * 1127px of panel at a 1512 viewport and 1055px at 1440 — past the threshold at every
 * laptop width this court has, which is why a chip that was in fact always clipped read
 * as an intermittent fault. Trimming the session control to its label (above) and the
 * action cell to its contents brings the table to 1086px, which fits outright from
 * about a 1471 viewport with the rail open, and from 1280 with it folded. Narrower than
 * that it scrolls, and the last column is cut at the port's own edge — which reads as
 * more to the right, where the same content covered mid-table read as broken. No cell
 * overlaps another at any width now, so the class of bug is gone rather than moved.
 *
 * `w-52` is the action group at the control metric — the session control's `min-w-32`,
 * its chevron's `size-10` joined to it, and the cell's `px-4`, with room to spare.
 * `w-18` is the orders icon button plus that same padding.
 *
 * In a seat with no session controls the Action column is not rendered at all, so the
 * same table asks 878px and Orders is the last column. That fits inside the panel at
 * every laptop width this court has, rail open or folded — the scroll, and the last
 * column's cut edge with it, is the bench's case only.
 */
const ACTION_COLUMN_CLASS = "w-52 min-w-52";
/**
 * The reader's Next hearing column: the date field over the purpose field, one field wide
 * (owner, 2026-10-15), at the Action column's width, so the reader's board fits a 1512px
 * laptop with the rail open. A longer purpose truncates in the field and reads whole in
 * its list.
 */
const NEXT_HEARING_COLUMN_CLASS = "w-52 min-w-52";
/** Exported because the Sign orders draft queue draws the same column at the same width. */
export const ORDERS_COLUMN_CLASS = "w-18";
/**
 * A listing already being written on, marked in the Orders column it was always in.
 *
 * **A second column was built for this and thrown out** (owner, 2026-09-15: *"we don't
 * need a draft column"*). It was the wrong instrument twice over. It put the answer in
 * *which* of two adjacent 72px columns an icon sat in, which is a single channel and the
 * weakest one — the reader has to track a row back to a header to read it — and it cost
 * 72px of a table whose width is already measured to the pixel, which is why it could
 * only be given to one of the two seats. Marking the glyph costs no width, so **both
 * seats get it**, and the mark is on the thing you were already looking at.
 */
const DRAFT_MARK_CLASS =
  "rounded-lg bg-destructive-muted text-destructive-muted-foreground hover:bg-destructive-muted-hover hover:text-destructive-muted-foreground";

/**
 * The cause title, as the way into that matter's case overview.
 *
 * It opens that overview **over the list** (`hearing-overview-dialog.tsx`) rather than
 * navigating to it (owner, 2026-09-12). Start hearing had already won this argument for
 * the call: the day is what the bench is working, and the cause list has no business
 * unmounting for a move made inside it. Reading item 4 is such a move — the reader wants
 * to know what is in the matter before it is called, and then wants the day back. That
 * is a dismissal, not a trip through the trail.
 *
 * Reading a case and calling it are still two different acts, and that is now the only
 * difference between them: this one opens the same overlay **without marking the
 * listing ongoing**. The chip in the overlay's header therefore says what the row said —
 * a scheduled matter stays scheduled — and the seat that has no session controls reads a
 * matter exactly the way the bench does, which is what it could never do through a
 * control it does not have.
 *
 * A button, not an anchor, and the change of element is the honest part: it opens a
 * surface on this page rather than going anywhere, so there is nothing for a middle
 * click or a new tab to carry (`ACCESSIBILITY.md` — keep the semantic element the act
 * asks for). The route survives underneath for a bookmark or a typed URL; no control
 * hands one out any more.
 *
 * `rowOpenerClass` is the dress the queues' dialog openers already share — quiet name,
 * underline on the *row's* hover — and this is now one of them rather than the one
 * exception that had to keep its own copy.
 *
 * The caller still supplies the box, because the two call sites need different ones: in
 * the table it fills the cell as a 40×40 target, and in the phone list it sits on the
 * line after the item number. Only the box is theirs.
 */
export function HearingCaseButton({
  hearing,
  onOpen,
  className,
}: {
  hearing: CourtHearing;
  onOpen: (hearing: CourtHearing) => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={() => onOpen(hearing)}
      {...rowOpener}
      className={cn(rowOpenerClass, className)}
    >
      {/* The cause title alone is the whole of what a sighted reader needs under a
          column headed "Case name"; out of that column it is a control named after two
          parties and nothing else. */}
      <span className="sr-only">Open case overview for </span>
      {causeTitle(hearing)}
    </button>
  );
}

export function HearingSessionButton({
  hearing,
  seat,
  variant = "outline",
  onStartHearing,
  onEndHearing,
  onPassOver,
  className,
}: {
  hearing: CourtHearing;
  seat: CourtRole;
  /**
   * The dress **Start hearing** wears. `outline` on a row — a teal edge rather than a
   * teal fill, because twenty-three filled buttons down a column would be the Ration
   * Teal Law broken twenty-three times. `default` in the cause-list overlay, which is
   * its own view with its own single primary: there the call is the act the surface is
   * for, and it is filled.
   *
   * The other two states do not take it. End hearing is always destructive and the
   * spent state is always outline — each said where it is built.
   */
  variant?: "outline" | "default";
  onStartHearing: (hearing: CourtHearing) => void;
  onEndHearing: (hearing: CourtHearing) => void;
  /** Pass over, behind the control's chevron (`PassOverMenu`). */
  onPassOver: (hearing: CourtHearing) => void;
  className?: string;
}) {
  const { court } = useCourt();
  /* One ref for whichever of Start and End is showing, so focus can land on the control
     after Pass over takes the chevron away (`PassOverMenu`). */
  const sessionRef = React.useRef<HTMLButtonElement>(null);
  /* No slot in a seat that does not run the sitting — see above. The row still says
     where the matter stands; that is the Status chip's job and it was never this
     control's. */
  if (!seatHasBenchControls(seat, court)) return null;

  /* The chevron joins on the right, and it draws the seam (`PassOverMenu`), so the
     button gives up its own right edge: the teal outline's 2px there was a second
     frame down the middle of one control, and a fill's transparent 1px let the page
     show through as a crack between two. */
  const split = canPassOver(hearing.status);
  let session: React.ReactNode = null;
  if (canStartHearing(hearing.status)) {
    session = (
      /* A button, and no longer a link. Calling the matter has been two other things in
         its life and is now neither: it navigated to that case's overview, then it
         opened the same overview as a sheet over the list. It opens nothing at all
         (owner, 2026-09-12). One press, one mark — the bench calls its way down a
         column, and neither a page nor a sheet gets between two items.
         What the press returns is this slot: it reads End hearing on the next paint,
         under the pointer that is still on it. Reading the matter is the cause title
         two cells to the left, which is where that act lives and always did.

         **A teal edge on the outline dress** (owner, 2026-09-12). Brand ink on the
         border, not a brand fill: the board keeps no `bg-primary` in its rows, so the
         Ration Teal Law is untouched, and the column reads as a column of live controls
         rather than of disabled-looking ones. It is the same mark the DS already puts on
         a chosen control — `border-primary` is how checkbox, radio and the field label
         say "this one" — so the edge means here what it means everywhere else.

         Only on the outline dress. In the overlay's footer this control is already the
         surface's filled primary, and a teal edge around a teal fill is a border drawn
         on nothing. */
      <Button
        ref={sessionRef}
        type="button"
        variant={variant}
        {...SESSION_CONTROL}
        className={cn(
          SESSION_SLOT_CLASS,
          "flex-1",
          /* `border-2` costs no layout: the DS button is `border-box` at a fixed `h-10`,
             and the label sits ~13px inside `min-w-32`, so the extra pixel each side is
             absorbed rather than paid for. The slot does not move when the state changes
             to the filled destructive, whose own edge is a transparent 1px.

             **The hover is the brand's own tint, not the neutral one.** The outline
             variant hovers to `accent` with `text-foreground`, which on a teal-edged
             button drops the label to near-black and leaves the border stranded — the
             control loses its identity at the one moment the reader is pointing at it
             (owner, 2026-09-12). Keeping the teal label over `accent` was not the fix
             either: brand solid measures 4.31:1 on that fill and would have put a
             sub-AA label under every pointer on the board.
             So the fill moves to the brand instead of the neutral, and the label takes
             that fill's own ink — the pairing the Laws ask for on any tinted surface,
             never grey-on-colour. It measures 5.83:1 in light and 8.07:1 in dark, both
             better than the 4.90:1 the label sits at when at rest. `dark:hover:` is
             restated because the variant carries its own `dark:hover:bg-accent`, which
             would otherwise win the cascade in dark and put brand ink back on a neutral.

             `text-primary` is the brand's only text role: the status families each name
             an ink (`success-ink`, `warning-ink`) and brand names none, so this is what
             the DS itself uses for brand text — see the `link` button variant. */
          variant === "outline" &&
            "border-2 border-primary text-primary hover:bg-brand-muted hover:text-brand-muted-foreground dark:hover:bg-brand-muted",
          /* After the edge, or the merge lets `border-2` take the right side back. */
          split && "border-r-0",
        )}
        onClick={() => onStartHearing(hearing)}
      >
        Start hearing
      </Button>
    );
  } else if (canEndHearing(hearing.status)) {
    session = (
      /**
       * Destructive and filled, wherever it appears (owner, 2026-09-12).
       *
       * The slot it replaces is a teal-edged outline button, so the change of state is a
       * change of everything: edge to fill, brand to destructive, wait to stop. It used
       * to be the same outline box with one word swapped, which is what the owner was
       * looking at — and the hazard behind it is real, because the two live in one box
       * one press apart and ending a sitting cannot be undone.
       *
       * `destructive` and not `destructive-solid`. Every one of the nine solid
       * destructives in this app sits in an `AlertDialogAction` — the button you press
       * *after* confirming a discard or a removal — and the DS reserves that weight for
       * exactly that. This one is pressed straight off the row with nothing in between,
       * which is the soft variant's job here and in the registrations overlay's Reject.
       *
       * Recorded because it was argued: ending a hearing is the ordinary and correct
       * close of a sitting rather than a rejection, and the reading offered was a fill
       * that says *stop* without borrowing the ink the product rejects people with. The
       * owner heard it and chose this, which settles it — the act is irreversible, it is
       * the one thing on the board that stops something, and the fill says so.
       */
      <Button
        ref={sessionRef}
        type="button"
        variant="destructive"
        {...SESSION_CONTROL}
        className={cn(SESSION_SLOT_CLASS, "flex-1", split && "border-r-0")}
        onClick={() => onEndHearing(hearing)}
      >
        End hearing
      </Button>
    );
  }
  if (session) {
    /* Start's dress, or End's, carried onto the chevron so the pair reads as one
       control. A passed-over listing takes Start again but cannot be passed over
       twice, so its group holds the one button — kept as a group all the same, so
       the button is not remounted when the chevron leaves and focus has somewhere
       to land. */
    const dress = canEndHearing(hearing.status) ? "destructive" : variant;
    return (
      <ButtonGroup aria-label={`Hearing, item ${hearing.item}`} className={className}>
        {session}
        {split ? (
          <PassOverMenu
            hearing={hearing}
            dress={dress}
            onPassOver={onPassOver}
            sessionRef={sessionRef}
          />
        ) : null}
      </ButtonGroup>
    );
  }
  /* An abandoned listing's day is over: nothing is left to call or end, and the
     sitting was not finished, so the slot stays empty — the Abandoned chip is the mark. */
  if (hearing.status !== "completed") return null;
  return (
    /* The sitting is done and there is nothing left to call: outline dress,
       disabled, the words *Hearing ended*. `disabled` rather than
       `aria-disabled` — a live precondition, not an unbuilt promise; the
       Completed chip on the row still carries the fact for a reader who
       cannot tab onto it.
       Outline whatever the caller asked for, because `variant` names the dress of
       an *act* and there is no act here. A spent slot painted teal would be the one
       primary on the overlay spent on a control that does nothing, and the dimming
       would be doing the work colour is supposed to do. */
    <Button
      type="button"
      disabled
      variant="outline"
      className={cn(SESSION_SLOT_CLASS, className)}
    >
      Hearing ended
    </Button>
  );
}

/**
 * Pass over — set this listing aside unheard, to call it again later the same day
 * with Start hearing (`HRG-04`).
 *
 * **The session control's split, not a button of its own** (owner, 2026-10-23). It
 * was the only item behind a ⋮, which the bench did not find; then a `user-round-x`
 * icon beside the session control (2026-10-22). Now it is the chevron half of that
 * control — the DS Button Group's split primary/dropdown pair — so it reads as one
 * more way to settle the same listing and costs the row no second box. The glyph
 * stays, on the menu item, where it has a word beside it.
 *
 * **One control, so one frame and a lighter seam** (owner, 2026-10-23: the first
 * build took the reference too literally). The chevron wears the session control's
 * dress — the teal edge beside Start, the soft destructive beside End, the filled
 * primary in the overlay's footer — and the session button gives up its right edge to
 * it (`HearingSessionButton`). What parts the two halves is one rule, drawn the same
 * way in all three dresses: 1px, in the dress's own ink, inset to the height of the
 * glyph (`h-4`, the 16px the chevron itself is drawn in, centred). It stops short
 * of the frame, so the frame runs unbroken round both halves and the eye reads one
 * box with a division in it. The full-height seam it replaces was the outline's 2px
 * edge down the middle — as heavy as the frame, which is what made the chevron read
 * as a second button — and in red, on End hearing, a cut through the fill.
 *
 * The 40px square is the floor, not a style: it is the touch target (`ACCESSIBILITY.md`
 * §8), and at 128 + 40 the pair still sits inside the Action column's measure.
 *
 * Hover and open are one state, in every dress: the brand tint beside Start, as Start's
 * own hover (and for the same contrast reason, given there), and each fill's own hover
 * step beside End and in the footer. Without it the open trigger of a filled dress
 * would look exactly like a closed one while its menu hangs off it.
 *
 * **The name says what is behind it.** One item lives here, so the trigger is named
 * for it — "Pass over item 13, …" — rather than "More actions", which promised a list
 * that is not there. A screen reader adds "menu button", which is the honest part: the
 * press opens the menu, it does not pass anything over. The word comes first so a voice
 * user can say it (`ACCESSIBILITY.md` §9), as on the icon this replaced.
 *
 * **Where focus goes once it is done.** Pass over takes this chevron away (a listing
 * cannot be passed over twice), and on the list it takes the row too: a passed-over
 * listing sits last (`HRG-04`), often on another page. Returning focus to the trigger,
 * the menu's default, would drop it on the page. So it goes to the session control now
 * standing where this one stood — the next matter down, which is where the bench was
 * going — and to the passed-over matter's own Start hearing only when nothing moved,
 * as in the overlay's footer. The list's announcer says what happened ("Hearing passed
 * over for …"), and the group's name says which item focus is now on.
 */
function PassOverMenu({
  hearing,
  dress,
  onPassOver,
  sessionRef,
}: {
  hearing: CourtHearing;
  dress: "outline" | "default" | "destructive";
  onPassOver: (hearing: CourtHearing) => void;
  /** The session control beside the chevron — focus's place when the row stays put. */
  sessionRef: React.RefObject<HTMLButtonElement | null>;
}) {
  const triggerRef = React.useRef<HTMLButtonElement>(null);
  /* Where the row stood when Pass over was chosen; `undefined` while the menu closes
     any other way, and Radix's own return to the trigger is left alone. */
  const passedFrom = React.useRef<RowSpot | null | undefined>(undefined);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          ref={triggerRef}
          type="button"
          variant={dress}
          size="icon"
          aria-label={`Pass over item ${hearing.item}, ${causeTitle(hearing)}`}
          className={cn(
            "relative before:absolute before:top-1/2 before:left-0 before:h-4 before:w-px before:-translate-y-1/2",
            dress === "outline" &&
              "border-2 border-primary text-primary before:bg-primary hover:bg-brand-muted hover:text-brand-muted-foreground aria-expanded:bg-brand-muted aria-expanded:text-brand-muted-foreground dark:hover:bg-brand-muted dark:aria-expanded:bg-brand-muted",
            dress === "default" &&
              "before:bg-primary-foreground aria-expanded:bg-primary-hover",
            dress === "destructive" &&
              "before:bg-destructive-muted-foreground aria-expanded:bg-destructive-muted-hover",
          )}
        >
          <ChevronDownIcon aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="w-auto"
        /* The menu is portalled, but React still bubbles its clicks to the row, and the
           row opens the case overview on any click that is not on a control. A click
           on the menu's own padding is not one the reader meant for the row. */
        onClick={(event) => event.stopPropagation()}
        onCloseAutoFocus={(event) => {
          const from = passedFrom.current;
          if (from === undefined) return;
          passedFrom.current = undefined;
          event.preventDefault();
          requestAnimationFrame(() =>
            sessionControlAfterPassOver(from, sessionRef)?.focus(),
          );
        }}
      >
        <DropdownMenuItem
          onSelect={() => {
            passedFrom.current = rowSpot(triggerRef.current);
            onPassOver(hearing);
          }}
        >
          <UserRoundXIcon aria-hidden />
          Pass over
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** Marks a live Start or End hearing, so focus can find the one in a given row. */
const SESSION_CONTROL = { "data-session-control": "" } as const;

/** A row's place in its list: the table body, or the phone list. */
type RowSpot = { list: Element; index: number };

function rowSpot(control: Element | null): RowSpot | null {
  const row = control?.closest("tr, li");
  const list = row?.parentElement;
  if (!row || !list) return null;
  return { list, index: Array.prototype.indexOf.call(list.children, row) };
}

/**
 * The session control to focus after a pass over — see `PassOverMenu`. Out of a list
 * (the overlay's footer), the control beside the chevron, which stays where it was. On
 * a list, the first live session control from the row's old place downwards, then
 * upwards: the row now standing there may be one with nothing to call (ended, or
 * abandoned), or the passed-over row may have been the last.
 */
function sessionControlAfterPassOver(
  from: RowSpot | null,
  sessionRef: React.RefObject<HTMLButtonElement | null>,
): HTMLElement | null {
  if (!from) return sessionRef.current;
  if (!from.list.isConnected) return null;
  const rows = Array.from(from.list.children);
  const order = [
    ...rows.slice(from.index),
    ...rows.slice(0, from.index).reverse(),
  ];
  for (const row of order) {
    const control = row.querySelector<HTMLElement>("[data-session-control]");
    if (control) return control;
  }
  return null;
}

/**
 * Orders on this listing. Opens the composer for it — issuing the order is still a real
 * judicial act this build does not perform, and the composer itself says so.
 *
 * **`file-text`, and the reason is the plus it replaced.** This wore `file-plus` because
 * the old cause list drew a document-with-plus, and the plus was the wrong half of it:
 * `file-plus` is already this app's mark for *start a new filing* — the rail's File a
 * case row and the filing dashboard's own card both use it — so one glyph meant two
 * things, and on a court screen the one it did not mean was "open this matter's order".
 * A sheet of text is what an order is, and it stays true in every state the control has:
 * drafting one, and opening the finished one the typist lands on.
 *
 * It is deliberately not `gavel`. That reads "judicial order" fastest to an eye raised
 * on American courtrooms, and Indian courts do not use gavels — this is a Kerala
 * district court. It is also already the court home's own mark, where it means the court
 * itself. `stamp` was the near miss: an order does go out under seal, and it is the only
 * candidate that is not another variation on a sheet. It sits in the signing vocabulary
 * already (the Sign evidence empty state), which is what decided it (owner, 2026-09-12).
 *
 * The column header carries the noun, so the glyph's whole job is not to lie.
 *
 * **Once the sitting is over the mark says the order is in** (owner, 2026-09-12): the
 * sheet gains a tick and goes `success-ink`, so a clerk scanning the column can see
 * which matters have their order without opening any of them. Before that the column
 * said only whether the control was pressable, and a heard matter looked exactly like
 * one still waiting to be called.
 *
 * **`completed` is the honest test, not a stand-in for one.** The composer opens on a
 * written order exactly when the sitting is over and on an empty one otherwise
 * (`initialOrderDraft`) — so in this build the order *is* where the status says it is,
 * and this reads the same fact that screen does rather than guessing at it from the
 * chip. The day that stops being true — an order drafted before the sitting ends, or a
 * matter heard with none written — the test has to move to the draft store
 * (`order-drafts.ts`), and this is the one line that has to change.
 *
 * Three carriers, because a green glyph alone would be none for most readers: the
 * colour, the tick (greyscale- and colour-blind-safe) and the accessible name. Colour is
 * never the only one (`ACCESSIBILITY.md`).
 *
 * It is keyed to the listing and not to the seat, because the fact is about the matter:
 * the typist's board shows the same mark on the same rows. What stays seat-shaped is
 * *when the control opens*, below.
 *
 * **When it opens depends on the seat, because what has to happen first does.** For a
 * seat that runs the sitting the control follows the sitting: a matter nobody has called
 * yet has no hearing to pass an order in, so on a scheduled row the icon holds the
 * column disabled and Start hearing beside it is what opens it (`canDraftOrder`). The
 * typist has no such control — this column is that seat's whole row — so there the trip
 * into the order is itself the sitting and a listing still on the day's call opens
 * (`canTypeOrder`). Both seats still close on a listing that was never heard.
 *
 * Disabled by the DS `disabled` prop rather than an `aria-disabled` mark, because this
 * is a live precondition and not a missing build — the same distinction as Sign selected
 * forms with nothing ticked.
 *
 * The reason lives in the accessible name: an icon-only control has no room to
 * carry it, and a tooltip cannot be hovered through the DS's
 * `disabled:pointer-events-none`. It names the status's own reason rather than the
 * seat's, because that is what a reader is being told about — a scheduled row is
 * waiting on the call, and a passed-over one is not going to get one today. Sighted
 * readers get it from the row: the chip and the start control sit inches away.
 *
 * `onOpen` is the caller's chance to act on the trip itself. The cause list uses it for
 * the typist, where walking into the order is what moves the matter; for the bench it is
 * not supplied and opening the composer changes nothing.
 *
 * `named` is for the one place the icon has nothing to lean on. In the table the column
 * header says *Orders* and the glyph is read under it; on a phone row there is no header,
 * and in the typist's seat this is the row's only control — a bare glyph with the name
 * only in `aria-label` leaves a sighted reader guessing at the one act the row has
 * (`ACCESSIBILITY.md` §8). So there it takes the session slot's dress and the words
 * instead: outline, text-only, at the control metric.
 */
export function HearingOrdersButton({
  hearing,
  seat,
  named = false,
  drafted = false,
  opensExisting = false,
  isRowOpener = false,
  onOpen,
  className,
}: {
  hearing: CourtHearing;
  seat: CourtRole;
  /** Carry the words rather than the glyph — a row with no column header over it. */
  named?: boolean;
  /**
   * There is work in progress on this listing — a key in the draft store.
   *
   * It changes the glyph and the words, not just which column the button sits in.
   * Position alone is a single channel, and on a phone row there is no column at all.
   */
  drafted?: boolean;
  /**
   * The order this control opens already exists, so the seat's drafting precondition
   * does not apply to it.
   *
   * The gate below asks *may an order be drafted on this listing from this seat* — a
   * question about starting one, which is why it turns on whether the matter has been
   * called. The Sign orders draft queue asks nothing of the kind: a row is on that list
   * because an order on it has already been started or recorded, and a control disabled
   * over an order that is sitting right there would be a row the court can see and
   * cannot open. It is off by default, so the cause list is untouched.
   */
  opensExisting?: boolean;
  /**
   * This control is what its row hands a click to (`row-activation.ts`).
   *
   * Opt-in, and off here: on the cause list the row already has an opener — the cause
   * title, which reads the case — and a row cannot have two. The Sign orders draft queue
   * turns it on, because there the order *is* what the row is for and the case name
   * carries no link of its own.
   */
  isRowOpener?: boolean;
  onOpen?: (hearing: CourtHearing) => void;
  className?: string;
}) {
  const { court } = useCourt();
  const label = drafted
    ? `Resume draft order for item ${hearing.item}, ${causeTitle(hearing)}`
    : `Order for item ${hearing.item}, ${causeTitle(hearing)}`;
  /* One column, two preconditions — see above — and neither of them is asked about an
     order that has already been drawn up. */
  const open =
    opensExisting ||
    (seatHasBenchControls(seat, court)
      ? canDraftOrder(hearing.status)
      : canTypeOrder(hearing.status));
  /* Whether this listing has an order on it — see the note above on why `completed` is
     the honest test for that and not a stand-in for one.
     A started draft outranks it in the glyph: a typist who has been editing a completed
     listing needs to know the editing is what is unsaved, which is the more urgent of
     the two facts. */
  const recorded = hearing.status === "completed";
  const dressClass = named
    ? cn(SESSION_SLOT_CLASS, className)
    : cn(
        "shrink-0",
        /* `hover:text-success-ink` restates the colour because the ghost variant's own
           `hover:text-foreground` would otherwise drop the mark under the pointer — the
           one moment the reader is asking about this row. It wins the merge: the DS
           Button appends `className` last (`button.tsx`). */
        /* **The draft is the one state that gets a plate**, on the owner's instruction: the
           same paper glyph the row has always had, on a rounded square in the red family.
           It is the DS `destructive` button's own pair — `destructive-muted` under
           `destructive-muted-foreground` — so the glyph measures 4.54:1 on its own fill in
           light and 7.75:1 in dark, and the hover comes with it rather than being invented.
           Applied as classes rather than by switching the button to `variant="destructive"`
           so the control stays a quiet `ghost` in every other state and only the plate is
           added; the variant would also have swapped the focus ring for the destructive
           one, which says "this press destroys something" about a press that opens a draft.

           The glyph changes with it: a page with a pen on it (owner, 2026-09-15), which is
           the one of the three that says *being written* rather than naming a state you
           have to already know. So the column reads without the plate too — three glyphs,
           one per state — and the plate is emphasis on the one state that wants it rather
           than the only thing carrying it. A mark that needs its colour to be read is a
           mark that fails for the reader who cannot see the colour (ACCESSIBILITY §3).

           *Noted for the owner, once:* red here is the destructive family, and a draft is
           unfinished rather than wrong. The mark is unmistakable, which is what was asked
           for, and this is the one place the word for the state disagrees with its colour.

           Recorded keeps `success-ink` and no plate — it reports an outcome, and two
           plates in one column would stop either of them meaning anything. */
        drafted
          ? DRAFT_MARK_CLASS
          : recorded
            ? "text-success-ink hover:text-success-ink"
            : "text-muted-foreground",
        className,
      );
  const content = named ? (
    drafted ? (
      "Resume draft"
    ) : (
      "Open order"
    )
  ) : drafted ? (
    <FilePenLineIcon aria-hidden />
  ) : recorded ? (
    <FileCheckIcon aria-hidden />
  ) : (
    <FileTextIcon aria-hidden />
  );

  if (!open) {
    return (
      <Button
        type="button"
        disabled
        variant={named ? "outline" : "ghost"}
        size={named ? undefined : "icon"}
        className={dressClass}
        /* Named or not, the reason travels in the accessible name: the words say what
           the control is, not why it will not open. */
        aria-label={`${label} (${
          canStartHearing(hearing.status)
            ? "available once the hearing starts"
            : "the matter was not heard"
        })`}
      >
        {content}
      </Button>
    );
  }

  const control = (
    <Button
      asChild
      variant={named ? "outline" : "ghost"}
      size={named ? undefined : "icon"}
      className={dressClass}
    >
      <Link
        href={`/employee/hearings/${hearing.id}/order`}
        {...(isRowOpener ? rowOpener : {})}
        /* The mark travels in the name as well as in the colour. A green glyph is the
           whole of the signal for a sighted reader and none of it for anyone else, and
           colour is never allowed to be the only carrier (`ACCESSIBILITY.md` — status
           without colour-alone). The tick is the third carrier: it survives greyscale
           and every form of colour blindness, which the green on its own does not. */
        aria-label={recorded ? `${label} (order recorded)` : label}
        onClick={() => onOpen?.(hearing)}
      >
        {content}
      </Link>
    </Button>
  );

  /* The red plate, said in a word (owner, 2026-09-16). The glyph is the only thing the
     column shows for a listing being written on, and a clerk reading it has to already
     know what the pen and the red mean; the tooltip is where the state stops being a
     convention and becomes the word for it. It hangs only on the icon, because the
     control that carries words already says "Resume draft" on its face.

     No delay: the owner asked for it on arrival, and this is a column a clerk sweeps a
     pointer down rather than rests on. The provider is mounted on the control and its
     `delayDuration` written out, rather than left to an ancestor — the court chrome
     scopes its own provider to the rail (`employee-nav.tsx`), so a table row is outside
     every provider on this screen and would have thrown without one.

     It is emphasis, not the carrier: a pointer is the one input that has it, so the
     state still travels in the glyph, the plate and the accessible name for every
     reader who never hovers (`ACCESSIBILITY.md`). That is also why a drafted row the
     seat cannot open yet loses nothing by not having it — the DS
     `disabled:pointer-events-none` means a disabled control cannot be hovered through,
     and the name has carried the reason there all along. */
  if (!drafted || named) {
    return control;
  }

  return (
    <TooltipProvider delayDuration={0}>
      <Tooltip>
        <TooltipTrigger asChild>{control}</TooltipTrigger>
        <TooltipContent>Draft</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

/**
 * Mobile stack: the start/end control, with Pass over behind its chevron, then orders.
 * The split takes the width the orders icon leaves, so the row's one act is the card's
 * widest target and the chevron still sits at the 40px square it has everywhere.
 *
 * In the typist's seat the session control renders nothing, so the row's actions are the orders
 * control alone — the same thing the table does by dropping a column, said in the shape
 * a phone row has. Standing alone it takes the words and the slot the session control
 * would have had, because a lone glyph on a card with no column header over it names
 * nothing.
 */
export function HearingRowActions({
  hearing,
  seat,
  onStartHearing,
  onEndHearing,
  onPassOver,
  onOpenOrder,
  postsNextHearing = false,
  className,
}: {
  hearing: CourtHearing;
  seat: CourtRole;
  onStartHearing: (hearing: CourtHearing) => void;
  onEndHearing: (hearing: CourtHearing) => void;
  onPassOver: (hearing: CourtHearing) => void;
  onOpenOrder?: (hearing: CourtHearing) => void;
  /** The phone row's own next-hearing fields, in the reader's seat — see `HearingsTable`. */
  postsNextHearing?: boolean;
  className?: string;
}) {
  const { court } = useCourt();
  const ordersIsTheRow = !seatHasBenchControls(seat, court);
  /* The phone row has no columns to move between, so the state has to be in the control
     itself: this is where "Open order" becomes "Resume draft". */
  const drafts = useOrderDrafts();
  const drafted = hasDraftFor(drafts, hearing.id);

  const posts = postsNextHearing && seatPostsNextHearing(seat, court);
  return (
    <div className={cn("flex flex-col gap-2", className)}>
      {posts ? (
        <div className="grid grid-cols-2 gap-2">
          <NextDateField hearing={hearing} />
          <NextPurposeField hearing={hearing} />
        </div>
      ) : null}
    <div className="flex items-center gap-2">
      <HearingSessionButton
        hearing={hearing}
        seat={seat}
        onStartHearing={onStartHearing}
        onEndHearing={onEndHearing}
        onPassOver={onPassOver}
        className="min-w-0 flex-1"
      />
      <HearingOrdersButton
        hearing={hearing}
        seat={seat}
        named={ordersIsTheRow}
        drafted={drafted}
        onOpen={onOpenOrder}
        className={ordersIsTheRow ? "min-w-0 flex-1" : undefined}
      />
    </div>
    </div>
  );
}

/** Each column's width, at the metrics the board was measured at. */
const COLUMN_CLASS: Record<CauseListColumnId, string> = {
  item: "w-16 whitespace-nowrap",
  caseName: "min-w-40 whitespace-normal",
  caseNumber: "whitespace-nowrap",
  advocates: "min-w-48 whitespace-nowrap",
  purpose: "min-w-32 whitespace-normal",
  stage: "min-w-28 whitespace-normal",
  status: "min-w-32 whitespace-nowrap",
  orders: cn(ORDERS_COLUMN_CLASS, "whitespace-nowrap"),
  action: cn(ACTION_COLUMN_CLASS, "whitespace-nowrap"),
  nextHearing: cn(NEXT_HEARING_COLUMN_CLASS, "whitespace-nowrap"),
};

const COLUMNS_HINT_ID = "cause-list-columns-hint";

/* How close to the scroller's edge a heading drag scrolls the board, and how fast —
   the Cases list's numbers. */
const AUTOSCROLL_EDGE = 64;
const AUTOSCROLL_STEP = 24;

/**
 * Today's cause list as a table, drawn from the columns this seat has chosen
 * (`cause-list-columns.ts`; owner, 2026-10-15) — which show and in what order, from the
 * Edit columns menu and the grip on each heading, as the advocate Cases list does it.
 * Each seat opens on its own default: the reader's board ends Action, Next hearing; the
 * magistrate's and the steno's are the board as it was.
 *
 * Headings drag to reorder; with a heading focused, Alt and an arrow key moves it.
 *
 * The panel shell (border, fill, shadow) lives on the screen around this, so the table is
 * one panel rather than a box inside a box.
 */
export function HearingsTable({
  rows,
  seat,
  columns,
  onMoveColumn,
  onShiftColumn,
  onOpenCase,
  onStartHearing,
  onEndHearing,
  onPassOver,
  onOpenOrder,
  selection,
}: {
  rows: CourtHearing[];
  seat: CourtRole;
  /**
   * Bulk mode (owner, 2026-10-15): a checkbox column ahead of the chosen columns. Not one
   * of them — it cannot be hidden or moved, and it is gone when bulk mode is.
   */
  selection?: {
    selected: ReadonlySet<string>;
    onToggle: (id: string) => void;
    /** The header box: all of the filtered list, every page — or none. */
    all: boolean | "indeterminate";
    onToggleAll: (select: boolean) => void;
  };
  /** The columns on screen, in order. */
  columns: readonly CauseListColumn[];
  onMoveColumn: (
    from: CauseListColumnId,
    to: CauseListColumnId,
    side?: DropSide,
  ) => void;
  onShiftColumn: (id: CauseListColumnId, delta: -1 | 1) => void;
  onOpenCase: (hearing: CourtHearing) => void;
  onStartHearing: (hearing: CourtHearing) => void;
  onEndHearing: (hearing: CourtHearing) => void;
  onPassOver: (hearing: CourtHearing) => void;
  onOpenOrder?: (hearing: CourtHearing) => void;
}) {
  const drafts = useOrderDrafts();
  const [dragging, setDragging] = React.useState<CauseListColumnId | null>(null);
  const [over, setOver] = React.useState<{
    id: CauseListColumnId;
    side: DropSide;
  } | null>(null);

  function onDragStart(
    event: React.DragEvent<HTMLTableCellElement>,
    id: CauseListColumnId,
  ) {
    event.dataTransfer.setData("text/plain", id);
    event.dataTransfer.effectAllowed = "move";
    setDragging(id);
  }

  /* Native drag-and-drop does not scroll a container; near either edge of the table's
     scroller, nudge it, so a column can be carried across a board wider than the panel. */
  function autoScroll(event: React.DragEvent<HTMLElement>) {
    const scroller = (event.currentTarget as HTMLElement).closest<HTMLElement>(
      '[data-slot="table-container"]',
    );
    if (!scroller) return;
    const rect = scroller.getBoundingClientRect();
    if (event.clientX < rect.left + AUTOSCROLL_EDGE) {
      scroller.scrollLeft -= AUTOSCROLL_STEP;
    } else if (event.clientX > rect.right - AUTOSCROLL_EDGE) {
      scroller.scrollLeft += AUTOSCROLL_STEP;
    }
  }

  function onDragOver(
    event: React.DragEvent<HTMLTableCellElement>,
    id: CauseListColumnId,
  ) {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    const rect = event.currentTarget.getBoundingClientRect();
    const side: DropSide =
      event.clientX < rect.left + rect.width / 2 ? "before" : "after";
    setOver((current) =>
      current?.id === id && current.side === side ? current : { id, side },
    );
  }

  function onDrop(
    event: React.DragEvent<HTMLTableCellElement>,
    id: CauseListColumnId,
  ) {
    event.preventDefault();
    const from = event.dataTransfer.getData("text/plain");
    if (isCauseListColumnId(from)) {
      onMoveColumn(from, id, over?.id === id ? over.side : undefined);
    }
    setDragging(null);
    setOver(null);
  }

  function onDragEnd() {
    setDragging(null);
    setOver(null);
  }

  function onHeaderKeyDown(
    event: React.KeyboardEvent<HTMLTableCellElement>,
    id: CauseListColumnId,
  ) {
    if (!event.altKey) return;
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      onShiftColumn(id, -1);
    }
    if (event.key === "ArrowRight") {
      event.preventDefault();
      onShiftColumn(id, 1);
    }
  }

  function cell(id: CauseListColumnId, hearing: CourtHearing): React.ReactNode {
    switch (id) {
      case "item":
        return <span className="tabular-nums text-muted-foreground">{hearing.item}</span>;
      case "caseName":
        /* The row's opener: it reads this matter's case overview over the list,
           without calling the matter. `rowOpenerClass` fills the cell so the target is
           the row's height (`ACCESSIBILITY.md` §8). */
        return (
          <HearingCaseButton
            hearing={hearing}
            onOpen={onOpenCase}
            className="flex items-center"
          />
        );
      case "caseNumber":
        /* The product's one identifier treatment; it stops its own click from reaching
           the row opener. */
        return <Identifier value={hearing.caseNumber} label="case number" />;
      case "advocates":
        return (
          <CounselCell
            complainant={counselFor(hearing, "complainant").map(
              (counsel) => counsel.name,
            )}
            accused={counselFor(hearing, "accused").map((counsel) => counsel.name)}
            dense
          />
        );
      case "purpose":
        return courtHearingPurposeLabel(hearing.purpose);
      case "stage":
        return courtCaseStageLabel(hearing.stage);
      case "status":
        return (
          <Badge
            variant={courtHearingStatusVariant(hearing.status)}
            className="w-fit"
          >
            {courtHearingStatusLabel(hearing.status)}
          </Badge>
        );
      case "orders":
        return (
          <div className="flex justify-center">
            <HearingOrdersButton
              hearing={hearing}
              seat={seat}
              drafted={hasDraftFor(drafts, hearing.id)}
              onOpen={onOpenOrder}
            />
          </div>
        );
      case "action":
        return (
          <HearingSessionButton
            hearing={hearing}
            seat={seat}
            onStartHearing={onStartHearing}
            onEndHearing={onEndHearing}
            onPassOver={onPassOver}
          />
        );
      case "nextHearing":
        /* Date over purpose: one column the width of one field (owner, 2026-10-15). */
        return (
          <div className="flex flex-col gap-2">
            <NextDateField hearing={hearing} />
            <NextPurposeField hearing={hearing} />
          </div>
        );
    }
  }

  return (
    <>
      <p id={COLUMNS_HINT_ID} className="sr-only">
        Drag a column heading to change its order. With a heading focused, press Alt
        and Left arrow or Alt and Right arrow to move it. Show, hide or reset columns
        from Edit columns.
      </p>
      <Table
        className="w-full border-separate border-spacing-0 text-body-compact"
        aria-describedby={COLUMNS_HINT_ID}
      >
        <TableHeader>
          <TableRow
            className={TABLE_HEAD_ROW}
            onDragOver={dragging ? autoScroll : undefined}
          >
            {selection ? (
              <TableHead className={cn(TABLE_HEAD, "w-12")}>
                <Checkbox
                  checked={selection.all}
                  onCheckedChange={(next) => selection.onToggleAll(next === true)}
                  aria-label={
                    selection.all === true
                      ? "Clear the selection"
                      : "Select every hearing in this list"
                  }
                />
              </TableHead>
            ) : null}
            {columns.map((column) => {
              const landing =
                dragging && dragging !== column.id && over?.id === column.id
                  ? over.side
                  : null;
              return (
                <TableHead
                  key={column.id}
                  draggable
                  tabIndex={0}
                  onDragStart={(event) => onDragStart(event, column.id)}
                  onDragOver={(event) => onDragOver(event, column.id)}
                  onDrop={(event) => onDrop(event, column.id)}
                  onDragEnd={onDragEnd}
                  onKeyDown={(event) => onHeaderKeyDown(event, column.id)}
                  className={cn(
                    TABLE_HEAD,
                    COLUMN_CLASS[column.id],
                    "relative cursor-grab select-none active:cursor-grabbing",
                    dragging === column.id && "opacity-50",
                  )}
                >
                  {/* Where the dragged column will land — the Cases list's mark. */}
                  {landing ? (
                    <span
                      aria-hidden
                      className={cn(
                        "pointer-events-none absolute inset-y-1 z-10 w-0.5 rounded-full bg-brand-accent",
                        landing === "before" ? "-left-px" : "-right-px",
                      )}
                    />
                  ) : null}
                  {/* The grip sits in the heading's own left padding rather than beside
                      the label, so it costs the board no width — the reader's board is
                      measured to fit a 1512px laptop. */}
                  <GripVerticalIcon
                    aria-hidden
                    className="absolute top-1/2 left-0.5 size-3.5 -translate-y-1/2 text-muted-foreground"
                  />
                  {column.label}
                </TableHead>
              );
            })}
          </TableRow>
        </TableHeader>
        <TableBody className={tableBodyClass({ selectable: Boolean(selection) })}>
          {/* The header is a well, not a band welded to the rows (ui-craft §4);
              `border-separate` has no per-edge row gap, so the gap is one inert row. */}
          <tr aria-hidden="true">
            <td
              colSpan={columns.length + (selection ? 1 : 0)}
              className="h-2 p-0"
            />
          </tr>
          {rows.map((hearing) => (
            <TableRow
              key={hearing.id}
              data-state={
                selection?.selected.has(hearing.id) ? "selected" : undefined
              }
              {...rowActivation(
                tableRowClass({ selectable: Boolean(selection) }),
              )}
            >
              {selection ? (
                <TableCell className={cn(TABLE_CELL, "w-12")}>
                  <Checkbox
                    checked={selection.selected.has(hearing.id)}
                    onCheckedChange={() => selection.onToggle(hearing.id)}
                    onClick={(event) => event.stopPropagation()}
                    aria-label={`Select item ${hearing.item}, ${causeTitle(hearing)}`}
                  />
                </TableCell>
              ) : null}
              {columns.map((column) => (
                <TableCell
                  key={column.id}
                  className={cn(
                    TABLE_CELL,
                    COLUMN_CLASS[column.id],
                    column.id === "caseName" && "font-medium",
                  )}
                >
                  {cell(column.id, hearing)}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </>
  );
}
