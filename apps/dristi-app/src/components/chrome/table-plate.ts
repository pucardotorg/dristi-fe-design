import { cn } from "@/lib/utils";

/**
 * The one treatment every table on the product wears.
 *
 * Sixteen queues had grown their own copy of the same four class strings. The strings
 * agreed — and then one of them learned something the other fifteen did not. The
 * process queue worked out how to round a hovered row; the register kept painting a
 * square band under a rounded header well for weeks, and nothing failed, because a
 * duplicated constant is not a drift a gate can see. This module is the collapse the
 * `register-cases-table` comment promised: the treatment lives once, every table reads
 * it from here, and `check:table-rows` fails the next table that writes its own.
 *
 * ## Why a row's fill lives on its cells
 *
 * `border-radius` is ignored on a `tr` in every engine, and under `border-separate` —
 * which these tables need so the header strip can round itself into a well — a row's
 * own fill paints as a square rectangle *behind* its cells. So a fill on the row can
 * never have corners, however the row is styled. Every state below therefore sends its
 * fill to `[&>td]` and rounds the two end cells, and cancels the DS `TableRow`'s own
 * fill for that state (`hover:bg-transparent` and friends) — otherwise the row's square
 * paints the corners straight back in.
 *
 * Three consequences, each of which cost a round of "why is there still a line there":
 *
 * 1. The hairline a row carries curves with the corner once the cell rounds, so it
 *    fades to transparent while the row is lit.
 * 2. The hairline of the row *above* cuts across the band's top corners. A row cannot
 *    ask about its predecessor, so that rule is reached from the body — which is why
 *    `tableBodyClass` exists and has to be given the same options as the row.
 * 3. `border-radius` is part of what changes, so it is named in the cells' transition
 *    beside the two colours. Leave it out and the corners snap square while the fill is
 *    still fading, and the row leaves a square ghost behind the pointer.
 *
 * ## Which states light a row
 *
 * `hover` and an open row menu (`has-aria-expanded`) are the transient ones and share
 * the `surface-sunken` tone — the warm well the header strip already wears, lighter than
 * `accent`. It was `accent` until the owner found that grey too heavy for a row under the
 * pointer (Sept 11, first answered on the cases table by design's round 2) and chose the
 * lighter tone as the standard, keeping the rounded band (2026-09-11). The open record
 * keeps `accent`, so the row you are looking at stays a step stronger than the one the
 * pointer is passing over. Selection is `accent-strong` and persistent. They are not interchangeable: brand fill means
 * "current / now", never "selected" (ui-craft §2), and a queue whose rows do nothing
 * gets `hover: false` rather than a fill that promises an act it cannot perform.
 *
 * Selection rounds **as a run, not per row**: a row rounds its top only when the row
 * above is not selected and its bottom only when the row below is not, so one pick
 * reads as a band and twelve consecutive picks read as one block with two rounded ends
 * rather than a scalloped stack of pills.
 *
 * ## Why it lives in `components/chrome`
 *
 * The court side must not reach into the citizen side or the reverse, and the queues
 * that share this treatment sit on both — `/employee`'s sixteen and the advocate's
 * `cases-table`. Each side previously kept its own copy rather than import across the
 * boundary, which is a correct instinct about the boundary and the wrong conclusion
 * about the fix. `chrome/` is neither side's, so both can read from it without either
 * becoming the other's parent — the arrangement the old comments kept promising.
 *
 * Every class is written out in full rather than composed from a template, because
 * Tailwind finds utilities by scanning source text: a class assembled at runtime is a
 * class that never reaches the stylesheet.
 */

/**
 * Header cells. The strip is a well inside the panel, so it carries the sunken fill.
 *
 * The label reads at `text-body-compact` (14px), the same size as the data below it, not
 * a step smaller. 12px column headers were the last 12px left in the staff tables, and the
 * owner does not want that size doing label work in the product (2026-09-14). The header
 * still recedes under the data — it is `font-semibold` on the muted ink, over the sunken
 * fill, against foreground-weight body text — so the hierarchy now comes from weight and
 * colour rather than from a size the eye has to squint at.
 */
export const TABLE_HEAD =
  "h-10 bg-surface-sunken px-4 py-3 text-body-compact font-semibold text-muted-foreground";

/**
 * Body cells. Add `align-top` where rows are tall enough that centring strands the
 * short cells (the A-Diary); everything else takes this unchanged.
 */
/**
 * Data cells. `h-16` is the row's floor, and it is the reason a queue reads the same
 * on two screens.
 *
 * Nothing here used to name a height, so a row was as tall as whatever its tallest column
 * happened to hold. Most queues land at 65px by accident: `/employee/hearings/schedule`
 * because its Advocates column stacks two counsel, `sign-process` because the cause title
 * wraps in a 315px column, `/cases` at 77px because it stacks two counsel *and* a chip.
 * Bulk reschedule has no column that stacks anything, so the same table on the same plate
 * collapsed to 46px and read as a different component (owner, 2026-09-17: *"the same
 * information structure — why can't you just match the same height"*).
 *
 * 64px of cell plus the hairline is the 65px the court queues already sit at, so this
 * lifts the short rows and moves nothing else: a row with two lines in any column is
 * already past the floor and stays where it was, `/cases` included.
 *
 * **The padding is `2.5`, and that is what makes the floor bind.** A row opener carries
 * `min-h-10` for the touch target, so with `py-3` an opener row measured 40 + 24 + 1 =
 * 65 and sailed past a 64 floor — every queue with a clickable row sat 1px above every
 * queue without one, which is where the bulk board's odd height came from (measured,
 * 2026-09-18). At `py-2.5` the opener fits inside the floor and every single-line queue
 * lands on 64 exactly, bulk reschedule included.
 *
 * Lowering the floor was the other candidate and it does not work: at `h-14` only the
 * bulk board moves, to 56, because every other table is held up by its opener. Measured
 * across the queues, 56 restores the mismatch rather than removing it.
 *
 * It is `h-16` and not `min-h-16` because this is a table cell. The CSS table model
 * treats a cell's `height` as a *minimum* — the row takes the tallest cell and grows past
 * it for content — while `min-height` on a cell is simply ignored, which is how the first
 * attempt at this floor changed nothing.
 */
export const TABLE_CELL =
  "h-16 border-b border-hairline px-4 py-2.5 align-middle text-left text-body-compact";

/**
 * The header row: no hover (nothing in it is live) and rounded ends, so the strip reads
 * as a well the panel insets rather than a band welded across it.
 *
 * No rule under it either. The sunken fill already separates the strip from the rows,
 * and the DS hairline ran square under a rounded well, past both its corners (owner,
 * 2026-09-18). The DS sets that border's width from `TableHeader` with a selector this
 * row cannot outrank, so the row clears its colour instead.
 */
export const TABLE_HEAD_ROW =
  "border-transparent hover:bg-transparent [&>th:first-child]:rounded-l-lg [&>th:last-child]:rounded-r-lg";

/**
 * The rest state: the fill the row sits on, the properties that animate off it, and the
 * three fills the DS `TableRow` paints on the `<tr>` itself.
 *
 * Those three are cancelled **unconditionally**, including on a table that does not use
 * the state yet. Scoping each cancellation to the option that needs it was the first
 * shape of this module, and it left every non-selectable queue carrying a live
 * `data-[state=selected]:bg-accent-strong`: inert only until someone adds a checkbox
 * column, at which point the square band is back and the options look like they should
 * have covered it. A fill on the `<tr>` is never wanted here, so it is never left on.
 */
const REST = [
  "[&>td]:bg-card",
  "[&>td]:transition-[background-color,border-color,border-radius]",
  "hover:bg-transparent",
  "has-aria-expanded:bg-transparent",
  "data-[state=selected]:bg-transparent",
].join(" ");

/** Under the pointer — the lighter warm tone, rounded (see "Which states light a row"). */
const HOVER = [
  "hover:[&>td]:border-transparent",
  "hover:[&>td]:bg-surface-sunken",
  "hover:[&>td:first-child]:rounded-l-lg",
  "hover:[&>td:last-child]:rounded-r-lg",
].join(" ");

/**
 * An inert row (`hover: false`). The DS `TableRow` paints its own hover band on the cells
 * and the DS `TableBody` clears the rule above a hovered row, so leaving `HOVER` out was
 * not enough: inert rows still lit up under the pointer (measured, owner, 2026-11-15).
 * These name the same properties at rest values, so `cn` replaces the DS ones.
 */
const INERT = [
  "hover:[&>td]:border-hairline",
  "hover:[&>td]:bg-card",
  "hover:[&>td:first-child]:rounded-none",
  "hover:[&>td:last-child]:rounded-none",
].join(" ");

/** The body's half of an inert row: keep the rule above it. */
const BODY_INERT = "[&>tr:has(+_tr:hover)>td]:border-hairline";

/**
 * A row whose own menu is open. The pointer has usually left the row by then, so
 * without this the band vanishes while the menu it belongs to is still standing.
 */
const MENU_OPEN = [
  "has-aria-expanded:[&>td]:border-transparent",
  "has-aria-expanded:[&>td]:bg-surface-sunken",
  "has-aria-expanded:[&>td:first-child]:rounded-l-lg",
  "has-aria-expanded:[&>td:last-child]:rounded-r-lg",
].join(" ");

/** Picked. `accent-strong` and persistent; the run's ends are rounded from the body. */
const SELECTED = "data-[state=selected]:[&>td]:bg-accent-strong";

/**
 * The row whose record is open in the panel beside the table — a persistent "you are
 * looking at this one" mark, so it is passed in rather than read off `:hover`. The
 * caller decides what it loses to (selection outranks it), which is why this is a
 * boolean and not an `aria-current` variant that would race selection on source order.
 */
const OPEN = [
  "[&>td]:border-transparent",
  "[&>td]:bg-accent",
  "[&>td:first-child]:rounded-l-lg",
  "[&>td:last-child]:rounded-r-lg",
].join(" ");

/** The last row's hairline would double against the panel edge below it. */
const BODY_REST = "[&_tr:last-child_td]:border-b-0";

/** Clear the rule above whichever row is lit — reached from the body (see §2 above). */
const BODY_HOVER = [
  "[&>tr:has(+_tr:hover)>td]:border-transparent",
  "[&>tr:has(+_tr:has([aria-expanded=true]))>td]:border-transparent",
].join(" ");

/** Above an open row, for the same reason. */
const BODY_OPEN = "[&>tr:has(+_tr[aria-current=true])>td]:border-transparent";

/**
 * A run of picked rows paints as one block: no rules inside it, none above its first
 * row, and rounded ends. Each rule is reached from the body so it can ask about a row's
 * neighbours, which a row cannot ask about itself.
 */
const BODY_SELECTED = [
  "[&>tr[data-state=selected]>td]:border-transparent",
  "[&>tr:has(+_tr[data-state=selected])>td]:border-transparent",
  "[&>tr:not([data-state=selected])+tr[data-state=selected]>td:first-child]:rounded-tl-lg",
  "[&>tr:not([data-state=selected])+tr[data-state=selected]>td:last-child]:rounded-tr-lg",
  "[&>tr[data-state=selected]:not(:has(+_tr[data-state=selected]))>td:first-child]:rounded-bl-lg",
  "[&>tr[data-state=selected]:not(:has(+_tr[data-state=selected]))>td:last-child]:rounded-br-lg",
].join(" ");

/** What the table does, asked of the whole body. */
export type TableBodyOptions = {
  /**
   * Does the pointer landing on a row mean anything? `false` for a queue where the row
   * is inert and only a cell inside it is live — a fill there would promise an act the
   * row does not perform. Defaults to `true`.
   */
  hover?: boolean;
  /** Rows carry `data-state="selected"`. Defaults to `false`. */
  selectable?: boolean;
  /** Rows can be marked `aria-current` as the record open beside the table. */
  marksOpenRow?: boolean;
};

/** The same questions asked of one row — `open` is this row, not the table's ability. */
export type TableRowOptions = Omit<TableBodyOptions, "marksOpenRow"> & {
  /**
   * This row's record is the one open beside the table. Pass the caller's own
   * precedence (a selected row stays selected), not just "is it open".
   */
  open?: boolean;
};

/**
 * The class for one body row. Pair it with `tableBodyClass` given the same options —
 * the two halves of the treatment are split only because CSS cannot look upwards.
 */
export function tableRowClass({
  hover = true,
  selectable = false,
  open = false,
}: TableRowOptions = {}): string {
  return cn(
    REST,
    hover ? HOVER : INERT,
    hover && MENU_OPEN,
    selectable && SELECTED,
    /* Last, so it outranks the rest fill it replaces. */
    open && OPEN,
  );
}

/** The `TableBody` half: every rule that has to see a row's neighbours. */
export function tableBodyClass({
  hover = true,
  selectable = false,
  marksOpenRow = false,
}: TableBodyOptions = {}): string {
  return cn(
    BODY_REST,
    hover ? BODY_HOVER : BODY_INERT,
    selectable && BODY_SELECTED,
    marksOpenRow && BODY_OPEN,
  );
}
