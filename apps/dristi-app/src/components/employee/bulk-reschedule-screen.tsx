"use client";

import * as React from "react";
import {
  CalendarCheck2Icon,
  CalendarDaysIcon,
  CalendarX2Icon,
  CircleCheckIcon,
  SearchXIcon,
  XIcon,
} from "lucide-react";

import { RESOLVE_IN_PLACE } from "@/components/chrome/motion";
import {
  StagedOverlay,
  useStagedFlow,
} from "@/components/chrome/staged-overlay";

import { BulkRescheduleTable } from "@/components/employee/bulk-reschedule-table";
import {
  NewDateFilterField,
} from "@/components/employee/new-date-filter";
import { QueueAnnouncer } from "@/components/employee/queue-announcer";
import { QueueSearchField } from "@/components/employee/queue-search-field";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import type { DateRange } from "react-day-picker";
import {
  DescriptionDetails,
  DescriptionList,
  DescriptionRow,
  DescriptionTerm,
} from "@/components/ui/description-list";
import {
  Dialog,
  DialogClose,
  DialogDescription,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  boardAfterMoves,
  earliestNewListing,
  filterReschedulable,
  rescheduledDays,
  type ReschedulableHearing,
  type RescheduledDay,
} from "@/lib/employee/bulk-reschedule";
import {
  courtCaseStageLabel,
  courtHearingPurposeLabel,
  formatCourtDay,
  formatListingDate,
  isoDay,
  parseIsoDay,
} from "@/lib/employee/hearings";
import { cn } from "@/lib/utils";
import { Identifier } from "@/components/chrome/identifier";
import { QueueItemRow } from "@/components/employee/queue-item-row";
import { useCourtText } from "@/components/court/court-provider";

/**
 * The day the bench is standing on is the reader's, not the server's — the same clock
 * today's cause list reads: the server renders its own guess and the browser replaces it
 * on hydration, so there is no mismatch to suppress and no blank first paint.
 */
const NEVER_CHANGES = () => () => {};
const readToday = () => isoDay(new Date());

/** What the filter controls hold. `null` on either end means "the day the court is on". */
type RangeFilters = { from: string | null; to: string | null; query: string };

/**
 * What the screen opens on: **the day the court is standing on, and only that day**
 * (owner, 2026-09-16 — *"if today is the 16th, then I will see the 16th"*).
 *
 * This is a reversal, and the reason it is safe now is worth saying. The screen used to
 * open on today and was changed on 2026-09-13 to open unasked, because writing today into
 * both ends made the range control read as already answered: the calendar opened with a
 * day lit and the *next* click was taken as the far end of a span starting there, so there
 * was no way to ask for a different single day. That was a defect in what a click meant,
 * not in the default — and it is fixed (`nextRangeFromPick`: a finished span is finished,
 * and the next click begins a new one). With the click semantics right, a board that opens
 * on today is what the bench wants: the work is today's list, not the court's whole future.
 */
function todayOnly(today: string): RangeFilters {
  return { from: today, to: today, query: "" };
}

/** Matters this session has moved, and the day each one was moved to. */
type MovedTo = Readonly<Record<string, string>>;

/** Both ends of the span, either of which may be unasked. */
type Span = { from: string | null; to: string | null };

function plural(count: number, one: string, many: string): string {
  return count === 1 ? one : many;
}

/**
 * A span in words — **the same words the table's own date column uses**, so the field,
 * the surface drawing it and the rows it filters cannot describe one day three ways.
 *
 * Said twice on this screen: by the trigger, of the span the board is showing, and by the
 * calendar's footer, of the span the bench has drawn and not yet applied. A span of one
 * day is one date, not the same date written twice with a dash between it.
 */
function spanLabel(span: Span): string {
  if (span.from === null) return "Select date range";
  return span.to === null || span.from === span.to
    ? formatListingDate(span.from)
    : `${formatListingDate(span.from)} – ${formatListingDate(span.to)}`;
}

/**
 * What a click on the range calendar should mean — which is not what the calendar means
 * by it.
 *
 * `react-day-picker`'s range mode treats the first day as fixed and every later click as
 * dragging the far end: from 13–25, clicking the 22nd gives 13–22, and clicking the 23rd
 * gives 13–23. There is no click that starts somewhere else. The only way back to a fresh
 * span is to land exactly on the start date, which collapses it — a move nobody finds,
 * and the reason the control read as having no way to clear and pick again (owner,
 * 2026-09-13, measured on the render before this).
 *
 * So the rule every date-range control the bench has used elsewhere follows: **a finished
 * span is finished.** The next click begins a new one on the day clicked, and the click
 * after that closes it. Widening 13–19 to 13–22 costs one extra click; being unable to
 * ask for 20–25 at all cost the whole control.
 *
 * The day clicked is not handed over, so it is read back out of what changed — the
 * calendar has already moved exactly one end, or cleared the span because the click
 * landed on its start.
 *
 * **Whether an end is being held is told, not inferred.** It used to be read off the
 * value as `from !== to`, which is true of a span half-drawn and false of a span of one
 * day — two different things wearing one shape. Ask for a single day (click it twice),
 * reopen, and click the 5th meaning only the 5th: the click was taken as the *far end*
 * of a span that was already finished, and the board got `5 Sept – 14 Sept` — ten days,
 * nine of them behind the court, on the screen that moves twenty-two matters at once.
 * The caller knows which click this is because it watched the previous one, so it says.
 */
function nextRangeFromPick(
  current: Span,
  next: DateRange | undefined,
  /** One end is down and this click is the other. */
  holding: boolean,
): Span {
  if (!next?.from) {
    /* Cleared — which the calendar only does when the click landed on the span's own
       start. A span of one day is where that click was going. */
    return { from: current.from, to: current.from };
  }

  const from = isoDay(next.from);
  const to = next.to ? isoDay(next.to) : from;

  /* One day held, second day named: this is the span being closed, so take it —
     including when both names are the same day, which is a span of one. */
  if (holding) return { from, to };

  const clicked = !next.to ? from : from !== current.from ? from : to;
  return { from: clicked, to: clicked };
}

/**
 * Bulk reschedule — moving a span of this court's board to another date in one act.
 *
 * The job is the day the bench does not sit: leave, transfer, a holiday declared late.
 * The court pulls up everything listed across a range of days and lists it again
 * somewhere else, rather than opening twenty case files.
 *
 * Composed exactly as today's cause list is (`HearingsScreen`) — the two screens are
 * siblings in the same rail group and the bench should not have to learn a second layout.
 * The page title stands on the page, and **one** lifted panel holds the filters and the
 * table together (ui-craft §4: no box inside a box). What this screen adds is a sticky
 * action bar, because the act is committed once for a list long enough to scroll away
 * from its own button.
 *
 * **Nothing is picked when the screen opens, and the date is asked for inside the act.**
 * Both are the same correction, made on the render (owner, 2026-09-13). The screen used
 * to open with the whole range checked — twenty-two matters already committed to moving
 * before the bench had said anything — and it carried a second container above the table
 * holding a date picker and an Apply button, which wrote a new date into a column the
 * table then read back. That is two acts, a worksheet between them, and a page that had
 * already answered the question it was asking. Now: the bench picks, the footer counts
 * what was picked, and the one button opens an overlay that asks for the date and
 * commits. One flow, one date, one commitment.
 *
 * **The move is a demo move, and the board shows it.** Confirming writes the new date
 * onto the matters for this session, and the rows stay on the board they were picked out
 * of, now carrying both ends of the change — the day each was listed on, and the day it
 * goes to. That is the whole of the feedback for an act that touches twenty matters at
 * once, so it belongs on the thing that was acted on rather than only in the overlay that
 * closes over it. Nothing further happens: no notification is drawn up for the parties, nobody is
 * told, and a reload puts the board back. The settled stage of the overlay says so, in
 * the place it matters, rather than letting the screen imply the act is finished.
 */
export function BulkRescheduleScreen() {
  const today = React.useSyncExternalStore(NEVER_CHANGES, readToday, readToday);

  /* One applied state, which is what the board answers. The search reaches it as it is
     typed — free text is never half-formed and a letter at a time is how a bench finds a
     name. The span reaches it when the picker says so: a range is drawn over two clicks
     and the first of them, taken live, is a board narrowed to a single day the bench
     never asked for (owner, 2026-09-16). The draft lives inside `RangeField` and arrives
     here only on Apply, so there is still nothing here to keep in step. Nothing
     re-queries anything expensive either way: the range is a filter over rows already in
     the browser. */
  /* Initialised from `today` rather than held as a `null` that means today: the field
     above the board has to *show* the day it is filtering to, and a null that renders as
     "Select date range" while the board shows one day would be the control lying about
     its own value. The lazy initialiser reads the clock the reader is standing on —
     hydration runs it again on the client, so a server guess never sticks. */
  const [filters, setFilters] = React.useState<RangeFilters>(() =>
    todayOnly(today),
  );

  /**
   * What the bench has picked — held as what is *in*, and empty to start with.
   *
   * It was the inverse: a set of exclusions, so that the screen could open with
   * everything checked and widening the range would sweep new matters in. That default
   * was the defect. A court that opens this screen has a day it is not sitting, not
   * twenty-two decisions already made, and a list that arrives fully checked leaves the
   * bench unchecking its way to what it meant — the one interaction nobody can audit
   * afterwards. Storing what was chosen also means the count and the act can never
   * disagree: both read the same set, intersected with what is on screen.
   */
  const [selected, setSelected] = React.useState<ReadonlySet<string>>(
    () => new Set(),
  );

  const [moved, setMoved] = React.useState<MovedTo>({});

  /**
   * Which board is on screen.
   *
   * **All hearings is the default and the work; Recently scheduled is the receipt** (owner,
   * 2026-09-15). The board used to be one list with the moved matters sorted back into
   * it wearing an extra column, which made the bench read a whole range to find the four
   * rows it had just acted on — and put a New hearing date column over twenty matters
   * that had no new hearing date. Splitting them lets each list be about one thing: what
   * is still to move, and what moved.
   */
  const [tab, setTab] = React.useState<"unscheduled" | "scheduled">(
    "unscheduled",
  );

  /**
   * Which of the record's new dates is on screen — **all of them, to start with.**
   *
   * The record is one table now (owner, 2026-09-16), so a session that moved matters to
   * two days shows both, ordered by the day they go to, and this narrows it to one when
   * the bench asks. It was a set of open accordion days until this change; the resting
   * state is the same idea — nothing hidden, nothing pre-chosen.
   *
   * Held here rather than inside the record so that it survives a trip to the other tab
   * and back, which unmounts that pane. A bench that narrowed to October and went to find
   * more matters should not come back to the whole record.
   */
  const [shownDay, setShownDay] = React.useState<string | null>(null);

  const board = boardAfterMoves(today, moved);

  /**
   * The two lists, split by the one fact that tells them apart — and **only one of them
   * answers to the filters.**
   *
   * The range and the search are a lens for finding matters to move, so they narrow the
   * board being worked and nothing else. The record is what this session did, and work
   * already done cannot be un-done by narrowing a lens: move three matters to the 17th,
   * then set the range to the fortnight after to find the next eight, and the Scheduled
   * tab used to read zero — the court's own afternoon, gone, because a filter meant for
   * the other list reached it (owner, 2026-09-15).
   *
   * The controls sit above the tab strip, where they read as this panel's, and that is
   * where the owner wants them. They were briefly moved inside the Unscheduled pane so
   * that their scope would be structural rather than a rule — and it cost more than it
   * bought, because switching to Scheduled then took a row of controls off the page and
   * the tabs jumped up under the pointer (owner, 2026-09-15). Chrome does not move when
   * the content under it changes (ui-craft §2). So the scope is this one line below
   * instead: only `unscheduled` is filtered.
   */
  const unscheduled = filterReschedulable(board, filters).filter(
    (row) => row.newDate === undefined,
  );
  const scheduled = board.filter((row) => row.newDate !== undefined);

  /**
   * The days this session moved matters to, and which of them the record is showing.
   *
   * **Resolved against the days that exist, every render.** A date held in state that the
   * record no longer offers is not a filter, it is a way to show an empty table — so it
   * falls back to all of them rather than being trusted. Nothing in this build takes a
   * day away, which is exactly why the guard is cheap and worth having: the next thing
   * that does will not have to remember this.
   */
  const recordDays = rescheduledDays(scheduled);
  const shownRecordDay = recordDays.some((entry) => entry.day === shownDay)
    ? shownDay
    : null;
  const recordRows =
    shownRecordDay === null
      ? scheduled
      : scheduled.filter((row) => row.newDate === shownRecordDay);


  /* Derived from what is on screen, so the act can never reach a row the range has
     dropped — an id left in the set by a narrowed range simply stops counting, and a row
     that has just moved to the other tab stops counting with it. */
  const selectedRows = unscheduled.filter((row) => selected.has(row.id));

  const isSearched = filters.query.trim() !== "";

  /**
   * Give the board back — the filters, and only the filters.
   *
   * It used to drop the ticks as well, which made sense when the screen opened with
   * everything already ticked and clearing meant starting over. It does not now: a
   * selection is deliberate work, a span is a lens over it, and a control labelled
   * *Clear filters* that quietly unticked twenty matters would be taking something it
   * never said it would. Rows the filters hide stop counting on their own — the act reads
   * the selection intersected with what is on screen — so there is nothing to tidy.
   *
   * Its only caller is the empty state, because each field now gives its own value back
   * (see `RangeField`) and a row button that repeats both of them is a third way to do
   * what two controls already do.
   */
  /* **Back to the day the board rests on, not to no filter at all.** The court's day is
     not something the bench applied and cannot be cleared away (owner, 2026-09-16), so
     the widest this control reaches is the state the screen opens in: today, and the
     search box empty. A bench that wants more than one day asks the calendar for it. */
  function clearFilters() {
    setFilters(todayOnly(today));
  }

  function changeRange(from: string | null, to: string | null) {
    setFilters({ ...filters, from, to });
  }

  function toggleRow(id: string, next: boolean) {
    setSelected((current) => {
      const draft = new Set(current);
      if (next) draft.add(id);
      else draft.delete(id);
      return draft;
    });
  }

  /** The header box speaks for the unscheduled rows in range, and only those. */
  function toggleAll(next: boolean) {
    setSelected((current) => {
      const draft = new Set(current);
      for (const row of unscheduled) {
        if (next) draft.add(row.id);
        else draft.delete(row.id);
      }
      return draft;
    });
  }

  /**
   * The act, as far as this build performs it: the matters take the new date and the
   * selection is spent.
   *
   * It says nothing. The overlay reports what happened on its own confirmation — the
   * product's success panel, the one the advocate submission and every court-side signing
   * queue end on — and the board behind it carries the durable half in the Current / New
   * hearing date pair. A toast here was a third report nobody asked for.
   */
  function reschedule(day: string, moving: ReschedulableHearing[]) {
    setMoved((current) => {
      const next = { ...current };
      for (const row of moving) next[row.id] = day;
      return next;
    });
    setSelected(new Set());
  }

  /**
   * Follow the matters to the tab they are now on — **once the overlay has gone**.
   *
   * Not at the moment of the act, which is where this started and where it does not
   * work: the commit bar belongs to the Unscheduled tab, the overlay is mounted inside
   * it, and switching tabs mid-act therefore unmounts the bar, the dialog and the
   * confirmation the bench had not read yet. Caught on the render — the success panel
   * flashed and vanished.
   *
   * So the move happens on the way out, when the bench presses Done: it reads what
   * happened, dismisses it, and lands on the record of it. Which is the answer to "where
   * did those twenty rows go", given before it has to be asked.
   */
  /**
   * Where the keyboard is after the act — **the tab the matters went to.**
   *
   * The overlay used to hand focus back to the selection count in the commit bar. That
   * line does not exist by then: finishing follows the matters to the Scheduled tab,
   * which takes the bar and its count off the page, so the focus call landed on nothing
   * and the bench was left on `<body>` with a signed order behind it (measured). The
   * tab strip is mounted whichever tab is showing, and *Scheduled 44* is both where the
   * matters now are and a control that says so — so that is the landing place.
   */
  const scheduledTabRef = React.useRef<HTMLButtonElement>(null);

  function finish() {
    setTab("scheduled");
    /* And show the whole record. A bench that narrowed to the 17th and then moved eight
       more matters to 9 October would otherwise arrive on a record that does not contain
       what it just did — the same fault as a range left on the board after the matters in
       it have gone (owner, 2026-09-15). */
    setShownDay(null);
    /* And give the span back — to today, which is where the screen opens. It was drawn to
       find the matters that have just gone, so leaving it on the field means the next move
       starts inside a window that has already been dealt with, and the board behind it
       reads as if the court had nothing listed (owner, 2026-09-15). Back to no bound at
       all would be the other reading, and it is wrong now: it would leave the bench on a
       wider board than the one they arrived on. The search text is their own words and is
       left alone. */
    setFilters((current) => ({ ...current, from: today, to: today }));
  }

  return (
    <div className="flex min-w-0 flex-1 flex-col gap-8 p-6 md:p-8">
      <header className="flex flex-col gap-2">
        <h1 className="text-title text-balance font-semibold">
          Bulk reschedule hearings
        </h1>
      </header>

      {/* One panel: the range and the list are one unit of work, so they share one lifted
          sheet — the same recipe and the same `gap-6` / `p-6` today's cause list uses.
          Nothing inside draws a second frame. */}
      {/* `grow`, not `flex-1`: the panel fills the page it is the only thing on, so a
          record of two collapsed dates does not stop a third of the way down a screen with
          nothing under it (owner, 2026-09-16). `flex-1` would also let it *shrink*, and a
          board of forty rows would be squashed into the viewport instead of scrolling the
          page. The content stays top-aligned, so what grows is the sheet, not the gaps
          inside it. */}
      <section className="flex min-w-0 grow flex-col gap-6 rounded-xl border border-hairline bg-card shadow-raised p-6">
        <RangeFilters
          filters={filters}
          floor={{ from: today, to: today }}
          onQueryChange={(query) => setFilters({ ...filters, query })}
          onRangeChange={changeRange}
        />

        <Tabs
          value={tab}
          onValueChange={(value) =>
            setTab(value as "unscheduled" | "scheduled")
          }
          className="flex min-w-0 flex-col gap-6"
        >
          {/* Line `TabsList`, not the pill track — the same composition the process queue
              uses for the same job, down to the `after:-bottom-px` that sits the mark on
              the gutter's own rule instead of floating a second line above it. Two labels
              fit a phone, but the row scrolls rather than crushing them (RESPONSIVE). */}
          <div className="overflow-x-auto border-b border-hairline">
            <TabsList
              variant="line"
              aria-label="Which matters to show"
              className="h-10 w-max min-w-full justify-start rounded-none p-0 group-data-horizontal/tabs:h-10"
            >
              {(
                [
                  /* **All hearings**, and **Recently scheduled** for what this session
                     has moved (owner, 2026-09-16). *Unscheduled* was the wrong word —
                     nothing on the left tab is unscheduled; every matter there is listed
                     on the day being shown, and what makes it the working list is that
                     none of it has been moved yet.
 
                     *All cases* was the first replacement and it said two wrong things:
                     the rail already owns that phrase for a different screen, and what
                     the tab counts is **hearings**, not cases — two listings can belong
                     to one case, which is why the signing card states both. *Today's
                     hearings* was the owner's suggestion and is the rail's phrase for
                     another screen as well, and it would be false the moment the range
                     is anything but today: the field above says which days these are,
                     so the tab does not have to. The values behind the labels are
                     unchanged. */
                  ["unscheduled", "All hearings", unscheduled.length],
                  ["scheduled", "Recently scheduled", scheduled.length],
                ] as const
              ).map(([value, label, count]) => (
                <TabsTrigger
                  key={value}
                  ref={value === "scheduled" ? scheduledTabRef : undefined}
                  value={value}
                  className="h-10 flex-none gap-2 px-3 text-body-compact group-data-horizontal/tabs:after:-bottom-px"
                >
                  {label}
                  {/* How much is standing here, inheriting the trigger's colour so the
                      count and its label read as one thing rather than as a badge stuck
                      to a tab (ui-craft §2). */}
                  <span className="font-normal tabular-nums">{count}</span>
                </TabsTrigger>
              ))}
            </TabsList>
          </div>

          <TabsContent value="unscheduled" className="min-w-0 outline-none">
            {/* Mounted whatever the board is doing, including empty — see
                `QueueAnnouncer`. This screen paginates nothing, so the whole range is
                what is showing. One per tab, because switching tabs changes the answer
                and the inactive pane is unmounted. */}
            <QueueAnnouncer
              from={1}
              to={unscheduled.length}
              total={unscheduled.length}
            />

            {unscheduled.length === 0 ? (
              <NothingToMove
                range={filters}
                isSearched={isSearched}
                everythingMoved={scheduled.length > 0}
                onClear={clearFilters}
              />
            ) : (
              /* min-w-0 lets this flex item shrink below the table's content width, so a
                 wide table scrolls inside the panel instead of pushing the page
                 sideways. */
              <div className="min-w-0 overflow-x-auto">
                {/* Six columns do not survive a phone. Below `md` the same rows stack as
                    items — today's cause list's own answer. */}
                <div className="hidden md:block">
                  <BulkRescheduleTable
                    rows={unscheduled}
                    selection={{
                      selected,
                      onToggle: toggleRow,
                      onToggleAll: toggleAll,
                    }}
                  />
                </div>
                <div className="md:hidden">
                  <RescheduleItemList
                    rows={unscheduled}
                    selection={{ selected, onToggle: toggleRow }}
                  />
                </div>
              </div>
            )}
          </TabsContent>

          <TabsContent
            value="scheduled"
            className="flex min-w-0 flex-col gap-4 outline-none"
          >
            {/* Mounted whatever the record holds, including nothing — a live region has
                to be in the DOM before the change to be read out at all
                (`QueueAnnouncer`). Against the record's own total, so narrowing to one
                date is spoken as the window it is. */}
            <QueueAnnouncer
              from={1}
              to={recordRows.length}
              total={scheduled.length}
            />

            {scheduled.length === 0 ? (
              <NothingRescheduled />
            ) : (
              <RescheduledRecord
                rows={recordRows}
                days={recordDays}
                shownDay={shownRecordDay}
                onShowDay={setShownDay}
              />
            )}
          </TabsContent>
        </Tabs>
      </section>

      {/* Mounted whatever the Unscheduled board is holding, including nothing — it used
          to be gated on that board having rows, and the overlay reporting what had just
          happened went down with the bar it was mounted in the moment the board emptied.
          Chrome does not vanish from the layout (ui-craft §2).

          It does belong to one tab, though. The bar commits a selection, the Scheduled
          record has none to make, and a sticky teal button over a list of finished work
          would be offering an act that list cannot perform. */}
      {tab === "unscheduled" ? (
        <CommitBar
          selected={selectedRows}
          total={unscheduled.length}
          today={today}
          range={filters}
          onReschedule={reschedule}
          onFinished={finish}
          onReturnFocus={() => scheduledTabRef.current?.focus()}
        />
      ) : null}
    </div>
  );
}

/**
 * Which days to pull in, and what to look for inside them.
 *
 * Laid out the way today's cause list lays out its filters, and labelled the same way:
 * every control carries a visible label, because the reference labels none of them and
 * the accessibility floor treats a placeholder as a hint rather than a label
 * (ACCESSIBILITY §12).
 *
 * **There is no Search button on this row, and the span's confirmation is not one.**
 * The screen had a date picker and an Apply above the table, and they were taken out on
 * 2026-09-13 as "two acts, a worksheet between them"; a reference the owner brought on
 * 2026-09-14 offered named spans (`Last 7 days`) and an **Apply Custom Filter** beside
 * them, and neither came across — the spans were built, put beside the field, moved
 * inside the picker and dropped, because the calendar is the one question this filter
 * asks (owner, across 2026-09-14).
 *
 * What the picker now carries is a different thing in a different place: the **Apply
 * inside the calendar** that closes the span the bench drew (owner, 2026-09-16, and see
 * `RangeField`). A button on this row would be a second stop on the page, standing at
 * rest between the bench and a board it can already see. A button inside the surface is
 * the end of the one act the bench opened, on the surface it opened, and the row it
 * leaves behind is still two fields and nothing else.
 *
 * The teal is spent the same way it was. A page at rest paints one strong fill —
 * Reschedule in the commit bar, the act that moves twenty listings — because the picker's
 * Apply exists only while its overlay is open, which is the reading of the Ration Teal
 * Law this screen's own dialogs already take.
 */
function RangeFilters({
  filters,
  floor,
  onQueryChange,
  onRangeChange,
}: {
  filters: RangeFilters;
  /** Where the range rests when nothing has been drawn — see `RangeField`. */
  floor: Span;
  onQueryChange: (query: string) => void;
  onRangeChange: (from: string | null, to: string | null) => void;
}) {
  return (
    /* Two fields, each a label over one control — the shape today's cause list uses,
       so the bottoms line up. */
    <form
      className="flex min-w-0 flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-end"
      onSubmit={(event) => event.preventDefault()}
    >
      <RangeField
        id="reschedule-range"
        label="Hearing dates"
        range={filters}
        floor={floor}
        onChange={onRangeChange}
        className="sm:w-72"
      />

      <QueueSearchField
        label="Search cases"
        className="sm:w-64"
        value={filters.query}
        onChange={onQueryChange}
        placeholder="Case name or number"
      />
    </form>
  );
}

/**
 * The span of days the board is showing — **one control that says it is a range**.
 *
 * It was two fields once: `Listed from` and `Listed until`, each its own single-date
 * picker. They were read on the render as two unrelated date fields rather than as the
 * two ends of one thing — *"it was not apparent that this is a date range selector"*
 * (stakeholder, via the owner, 2026-09-13). Two adjacent controls can only ever be a
 * range by convention; one control whose value is a span says so before it is read.
 *
 * **Composed from `Popover` and `Calendar` rather than taken from `DateRangePicker`,
 * and that is a deliberate step away from the primitive.**
 *
 * It began as the only way to put a row of named spans inside the picker rather than
 * beside it (owner, 2026-09-14). The spans were then dropped — the calendar is the one
 * question this filter asks, and it did not want a second way of answering it — but the
 * composition stays, because what it actually bought was §19 itself.
 *
 * `DateRangePicker` renders its own `Popover` and its own `Calendar`, takes no
 * `children`, spreads its `className` onto the trigger `Button`, and portals its content
 * to `document.body`. So a screen using it cannot reach the calendar inside it, in props
 * or in CSS, and three of the four defects filed against it are unreachable from here —
 * which is the whole of `ds-requests` 19. Owning the popover fixes all three rather than
 * working around them:
 *
 * - **(a)** `showOutsideDays={false}`. Two adjacent months draw each other's edge days,
 *   so September's trailing cells and October's leading cells were the same dates drawn
 *   twice and lit twice — one span painting two ends.
 * - **(c)** the calendar dismisses on Apply. The primitive leaves it standing over the
 *   page after the one decision it exists for, and owning the surface is what lets the
 *   bench close it deliberately instead.
 * - **(e)** the `×` no longer costs the calendar. It sits outside the portalled content,
 *   so Radix's dismissable layer read the press as an outside click and closed the
 *   popover the bench was still using; with `open` held here, clearing clears and nothing
 *   else moves.
 *
 * **A one-day span is held as `to: undefined`.** That is what draws a single date rather
 * than the same day written twice with a dash between it, and it is the state the
 * calendar wants when the next click is going to set the other end. The board still reads
 * it as `from = to`: a court sitting on one day is a range of one, not an unfinished
 * question. What a click does to a span already finished is decided in
 * `nextRangeFromPick`, not by the calendar.
 *
 * **The span is drawn here and applied on a press.** The calendar holds a draft; the
 * board is not narrowed until *Apply*, and leaving the surface any other way — Escape,
 * a click on the page, the trigger again — abandons what was drawn and leaves the board
 * on what it was showing. A range takes two clicks, so a span applied as it is drawn
 * spends its first click narrowing the board to a single day nobody asked for, and its
 * second widening it back; the bench watched twenty-two rows vanish and return between
 * two clicks of one gesture, and never saw the finished span at all, because closing it
 * dismissed the calendar in the same motion (owner, 2026-09-16). Now the span is drawn,
 * shown in the surface's own footer in the words the rows use, and applied when the bench
 * says so.
 *
 * *Apply* is the only button here. A Cancel would be a second way to do what Escape, the
 * trigger and the rest of the page already do, on a surface whose draft costs nothing to
 * abandon. It carries no glyph — the label is the whole of it.
 *
 * It is disabled while there is no day on the calendar, and enabled from the first click
 * onwards — **including when the span drawn is the one already applied.** Gating on
 * *different from the board* was the other candidate and is what a Search button would
 * do, but this button is also the way out of the surface, and the dead end it makes is
 * easy to walk into: reopen on 14–20, click 14, click 20, and the press the footer is
 * asking for is refused for re-drawing what was wanted. Re-applying an identical span
 * costs a render of the same rows, so the honest gate is the one about the calendar
 * being empty.
 *
 * **The span is given back from the `×` on the field**, the way the search box beside it
 * gives its text back, and it appears only once there is a span to clear (owner,
 * 2026-09-13). `Clear filters` drops the search and the span together and is the empty
 * state's business; a field's own clear takes only what the field holds.
 *
 * The width is the caller's, and the id prefixes the label element it owns.
 */
function RangeField({
  id,
  label,
  range,
  floor,
  onChange,
  className,
}: {
  id: string;
  label: string;
  range: Span;
  /**
   * The span the field can never be emptied below — **today, on this screen.**
   *
   * The court's own day is not a filter the bench applied, it is where the board starts
   * (owner, 2026-09-16: *"hearing dates will always show the current day's date, they
   * cannot cross that out"*). So the `×` is not a way to empty the field: it appears only
   * once the span has been drawn away from this, and it undoes that drawing rather than
   * the day underneath it.
   */
  floor: Span;
  onChange: (from: string | null, to: string | null) => void;
  className?: string;
}) {
  const [open, setOpen] = React.useState(false);
  /* What the calendar is showing, which is the applied span until the bench draws over
     it. Seeded every time the surface opens rather than once, so a span abandoned by an
     Escape is gone by the next opening and the calendar always arrives on the board. */
  const [draft, setDraft] = React.useState<Span>(range);
  /* One end is down and the calendar is waiting for the other. Held here rather than
     read off the value, because a span of one day and a span half-drawn are the same
     value — see `nextRangeFromPick`. True only between two clicks on the calendar:
     closing the surface abandons a half-drawn span rather than leaving it armed for the
     next time it opens. */
  const [holding, setHolding] = React.useState(false);
  const drawn = draft.from !== null;
  /* Something to give back: the applied span is not the one the field rests on. */
  const clearable =
    range.from !== floor.from || (range.to ?? range.from) !== (floor.to ?? floor.from);

  /* Undefined, not an empty `DateRange`: the calendar is handed the value directly here
     rather than through `DateRangePicker`, whose `value === undefined` meant "this
     control is uncontrolled" and made clearing impossible (`ds-requests` 19(b)). Nothing
     falls back to a remembered value any more, so the plain absence is the honest shape
     and the workaround it needed is gone with the primitive. */
  const selected: DateRange | undefined =
    draft.from === null
      ? undefined
      : {
          from: parseIsoDay(draft.from),
          to:
            draft.to === null || draft.from === draft.to
              ? undefined
              : parseIsoDay(draft.to),
        };

  function pick(next: DateRange | undefined) {
    /* Drawn, not applied: the board holds still until Apply. The second click closes the
       span, whichever day it landed on — a different day makes a range, the held day
       again makes a span of one — and a first click puts one end down and waits. */
    setDraft(nextRangeFromPick(draft, next, holding));
    setHolding(!holding);
  }

  function applyDraft() {
    onChange(draft.from, draft.to);
    /* The press is the decision this surface exists for, so it stands down on it (§19c). */
    setOpen(false);
  }

  return (
    <div className="flex min-w-0 flex-col gap-2">
      {/* A real `label`, not a `span`: a `button` is a labelable element, so this both
          names the trigger and opens it when pressed — which is what the search field
          40px to the right already does with its own label, and what a bench that
          clicks the words expects. The `aria-labelledby` on the trigger stays, because
          the accessible name wants the span as well as the field's name. */}
      <label
        id={`${id}-label`}
        htmlFor={`${id}-trigger`}
        data-range-part={id}
        className="w-fit text-body-compact font-medium"
      >
        {label}
      </label>
      <div className={cn("relative w-full min-w-0", className)}>
        <Popover
          open={open}
          onOpenChange={(next) => {
            setOpen(next);
            /* A half-drawn span does not survive the surface closing. Escaping out of
               one and reopening would otherwise take the first click as its far end. */
            setHolding(false);
            /* Opening starts from the board, which is also how a drawn-but-unapplied
               span is abandoned: nothing carries over but what was applied. */
            if (next) setDraft(range);
          }}
        >
          <PopoverTrigger asChild>
            {/* Named by the visible label *and* by its own content, the way a combobox
                is: "Hearing dates, 14 Sept 2026 – 20 Sept 2026". The label alone would
                drop the span; the content alone would drop what the span is of. */}
            <Button
              id={`${id}-trigger`}
              variant="outline"
              aria-labelledby={`${id}-label ${id}-trigger`}
              className={cn(
                "w-full justify-start gap-2 text-left font-normal",
                range.from === null && "text-muted-foreground",
                clearable && "pr-12",
              )}
            >
              <CalendarDaysIcon data-icon="inline-start" aria-hidden />
              <span className="truncate">{spanLabel(range)}</span>
            </Button>
          </PopoverTrigger>

          {/* Sized by what it holds rather than the popover's own `w-72` — but never
              wider than the room it has.

              A two-month calendar has a floor it cannot shrink past: the months stack
              into one column below `md`, which is enough at a phone's default text size,
              and is not once the text grows. Measured at 200% on a 375px viewport, the
              calendar alone wants 424px. Radix's popper hard-sets `min-width:
              max-content` on its wrapper, so without a ceiling the surface simply takes
              that width and hangs off the screen — and because a popover is
              `position: fixed`, there is no page scroll to go and get it
              (ACCESSIBILITY §10, RESPONSIVE.md 9).

              Radix's own available-width variable is that ceiling, and it is the reason
              this does not reproduce here while it still does under `DateRangePicker`,
              which sets no max width at all. `collisionPadding` keeps the surface off
              the viewport edge rather than flush against it.

              **Height needs the same ceiling now that the surface has a floor.** Two
              stacked months are 512px of calendar on a phone, and a footer under them
              put Apply at 834px down a 820px viewport — off the bottom of a
              `position: fixed` surface, which no amount of page scrolling reaches
              (measured at 375×820 before this line). So the content stops at the height
              Radix says is available, the calendar takes the scrolling, and the footer
              keeps its place at the bottom: the one action is on screen at every size.
              A footer that scrolls away is a footer the bench cannot press. */}
          <PopoverContent
            align="start"
            collisionPadding={16}
            /* Radix hard-sets `role="dialog"` on this surface, and ARIA 1.2 requires a
               dialog to carry a name — without one a reader enters it hearing "dialog"
               and then a grid of numbers. The field's own label is that name, so the
               surface is announced as the field it belongs to (ACCESSIBILITY §2). */
            aria-labelledby={`${id}-label`}
            className="max-h-(--radix-popover-content-available-height) w-auto max-w-(--radix-popover-content-available-width) gap-0 p-0"
            /* **This field's own parts are not outside clicks.** The label and the
               `×` both sit outside the portalled content in the DOM — the `×` laid
               over the trigger's padding, the label above it — so Radix's dismissable
               layer dismisses on both. Radix excludes the trigger itself
               (`targetIsTrigger`) and nothing else, which is how clearing used to cost
               the calendar (`ds-requests` 19(e)), and it is why a plain `label` would
               close the surface on pointer-down and then reopen it when the browser
               forwarded the click on to the button — a flicker that can never be shut.

               Refusing the dismiss for both fixes both: the `×` clears and the surface
               the bench is still reading stays put; the label's forwarded click reaches
               the trigger with the popover still open, so it toggles shut the way
               pressing the trigger does. Marked per field — a bare attribute would let a
               second range field suppress this one's legitimate dismiss. Covers focus as
               well as pointer, because pressing either does both. */
            onInteractOutside={(event) => {
              const target = event.detail.originalEvent.target;
              if (
                target instanceof Element &&
                target.closest(`[data-range-part="${id}"]`)
              ) {
                event.preventDefault();
              }
            }}
          >
            <div className="min-h-0 overflow-y-auto">
              <Calendar
                mode="range"
                numberOfMonths={2}
                /* §19a: two adjacent months otherwise draw each other's edge days, so
                   the same date appears in both panels and lights twice. Measured on
                   the render with 13 Sept – 2 Oct: no date now appears more than once. */
                showOutsideDays={false}
                selected={selected}
                onSelect={pick}
                /* Opening the surface puts the reader on a day, not on the chevron
                   that happens to come first in it. Radix focuses the first tabbable in
                   the content, which without this is *Previous month* — so a keyboard
                   user arrived one control short of the only question here. */
                autoFocus
              />
            </div>

            {/* The surface says what it is holding before it is asked to apply it — the
                calendar paints the span across two months, and a bench that has just
                clicked twice reads the dates back in one line rather than counting cells.
                Muted until there is one, so an empty picker does not state a value it
                does not have.

                Shaped like this screen's other overlay footer (`DialogFooter`): a tray
                fill under a hairline, the action to the end of the line, and stacked with
                the button full width where the two months stack — the calendar's own
                breakpoint, so the footer turns when the surface above it does. */}
            <div className="flex shrink-0 flex-col gap-2 rounded-b-lg border-t bg-muted p-2 md:flex-row md:items-center md:justify-between">
              <p
                id={`${id}-drawn`}
                className={cn(
                  "text-body-compact tabular-nums",
                  drawn ? "text-foreground" : "text-muted-foreground",
                )}
              >
                {spanLabel(draft)}
              </p>
              {/* Named by itself and described by the span, so it is announced as
                  "Apply, 14 Sept 2026 – 20 Sept 2026" — the visible label stays the whole
                  of the name (ACCESSIBILITY §12). */}
              <Button
                type="button"
                aria-describedby={`${id}-drawn`}
                disabled={!drawn}
                onClick={applyDraft}
                className="w-full md:w-auto"
              >
                Apply
              </Button>
            </div>
          </PopoverContent>
        </Popover>

        {clearable ? (
          /* **The same mark as the search box's clear, one control to the right.** It
             was drawn a third smaller and went unfound: `Button size="icon-xs"` shrinks
             its glyph to 12px, where the design system's own field-clear
             (`InputGroupButton`) draws 16px — so two controls doing the identical job in
             one row disagreed about how big that job looks (owner, 2026-09-13; measured
             at 12px against the search box's 16px). A size class on the icon is the
             sanctioned way out, because the size-setting selector steps aside for an svg
             that carries its own.

             Muted at rest, foreground on hover, matching the sibling again: a clear does
             not compete with the value it sits beside until the pointer is on it.

             The button is 32px drawn, under the 40×40 floor on its own, so it carries the
             same transparent `after:` inset the search box's clear uses to take the hit
             area back without changing what is drawn (ACCESSIBILITY §8). */
          <Button
            type="button"
            data-range-part={id}
            variant="ghost"
            size="icon-xs"
            /* Named for what it does, which is not "clear the field": it puts the board
               back on the court's own day. */
            aria-label={`Back to ${floor.from === null ? "no dates" : formatListingDate(floor.from)}`}
            onClick={() => {
              onChange(floor.from, floor.to);
              /* The field's own clear is not a draft: it gives the span back on the
                 spot, so the calendar behind it has nothing left to apply either. */
              setDraft(floor);
              setHolding(false);
            }}
            className="absolute top-1/2 right-2 -translate-y-1/2 text-muted-foreground after:absolute after:-inset-2 after:content-['']"
          >
            <XIcon aria-hidden className="size-4" />
          </Button>
        ) : null}
      </div>
    </div>
  );
}

/**
 * Why there is nothing to move, and what to do about it.
 *
 * Two different facts, so two different states: a span the court has nothing listed in is
 * not the same as a search that matched nothing, and only the second has an action worth
 * offering. Borderless and unpadded — the panel around it is already the frame.
 */
function NothingToMove({
  range,
  isSearched,
  everythingMoved,
  onClear,
}: {
  range: Span;
  isSearched: boolean;
  /**
   * The board is empty because the bench emptied it, not because the court had nothing
   * listed. Two different facts that look identical from a row count, and telling the
   * bench "this court has nothing it could move" after it has just moved everything
   * would be the screen forgetting the act it performed a second ago.
   */
  everythingMoved: boolean;
  onClear: () => void;
}) {
  /* With no span asked for, the board is everything this court has listed — so there is
     no window to name and the sentence does without one. */
  const span =
    range.from === null
      ? ""
      : range.from === range.to || range.to === null
        ? ` on ${formatCourtDay(range.from)}`
        : ` between ${formatCourtDay(range.from)} and ${formatCourtDay(range.to)}`;

  return (
    <Empty className="border-0 p-0">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          {isSearched ? (
            <SearchXIcon aria-hidden />
          ) : everythingMoved ? (
            <CalendarCheck2Icon aria-hidden />
          ) : (
            <CalendarX2Icon aria-hidden />
          )}
        </EmptyMedia>
        <EmptyTitle className="text-title-s font-semibold">
          {isSearched
            ? "No matters match this search"
            : everythingMoved
              ? "Everything here has been rescheduled"
              : "Nothing to move"}
        </EmptyTitle>
        <EmptyDescription className="text-body">
          {isSearched
            ? `No matter listed${span} matches the case name or number you asked for.`
            : everythingMoved
              ? `Every matter listed${span} is on the Recently scheduled tab.`
              : `This court has nothing listed${span} that it could move.`}
        </EmptyDescription>
      </EmptyHeader>
      {isSearched ? (
        <EmptyContent>
          <Button variant="outline" onClick={onClear}>
            Clear filters
          </Button>
        </EmptyContent>
      ) : null}
    </Empty>
  );
}

/**
 * What this session moved, and where it moved it — **one table** (owner, 2026-09-16).
 *
 * It was a stack of tables, one per day the bench had moved matters to, each under a
 * heading with its own tally and shut until opened. That shape answered "what did I just
 * do" by making the days the subject, and it cost the thing a record is for: a bench
 * could not read its own afternoon without opening it a day at a time, and the *New
 * hearing date* the rows had just been given was nowhere in the rows — it was the heading
 * above them.
 *
 * So the record is the board's own table with that column restored, and the several days
 * a session may hold are answered inside it: the column header filters (`NewDateFilter`),
 * and the line above says how much of the record is on screen.
 *
 * **Nothing here states a count.** A line above the table did, twice over: at rest it
 * repeated the tab strip's own total, and narrowed it reported the window the filter had
 * made. Both went (owner, 2026-09-16, on each in turn), and the second one's job is done
 * instead by what is already on screen — every row in the column reading one date, and a
 * mark on the filter that says it is set. `QueueAnnouncer` still speaks "Showing 1–35 of
 * 41" for a reader who cannot see either.
 */
function RescheduledRecord({
  rows,
  days,
  shownDay,
  onShowDay,
}: {
  /** The rows on screen — the whole record, or one date of it. */
  rows: ReschedulableHearing[];
  days: RescheduledDay[];
  shownDay: string | null;
  onShowDay: (day: string | null) => void;
}) {
  const newDate = { days, value: shownDay, onChange: onShowDay };

  return (
    <div className="flex min-w-0 flex-col gap-4">
      {/* **A field of its own wherever the header's own filter cannot be reached.**
          Below `md` that is because there is no table at all — the rows are items, and a
          filter needs a label saying which column it means. Between `md` and `xl` it is
          because six columns are wider than the panel, so the table scrolls horizontally
          and the header's chevron is the first thing off the right edge (measured: 946px
          of table in a 910px panel before the columns were trimmed). At `xl` the table
          fits, the header is reachable, and this goes away. */}
      {days.length > 1 ? (
        <div className="flex flex-col gap-2 xl:hidden">
          <span className="text-body font-medium" id="record-date-filter">
            New hearing date
          </span>
          <div className="sm:w-64">
            <NewDateFilterField
              days={days}
              value={shownDay}
              onChange={onShowDay}
            />
          </div>
        </div>
      ) : null}

      {/* min-w-0 lets this flex item shrink below the table's content width, so a wide
          table scrolls inside the panel instead of pushing the page sideways — the same
          wrapper every other court-side list uses.

          It briefly carried two more classes, to neutralise the DS `Table`'s own
          `overflow-x-auto` container and to clip a phantom vertical scrollbar. Both are
          gone, because neither was the fault: the filter's hit-area pseudo-element was
          positioning against that `relative` container instead of its own button and
          adding 8px of width and 10px of height to the table's scrollable area, which is
          what drew a bar on each edge of a table that needed neither (owner, 2026-09-16;
          fixed in `NewDateFilter`). Measured after: no overflow on either axis at 1440 or
          1280, and one honest horizontal bar at 1100 where six columns genuinely do not
          fit. */}
      <div className="min-w-0 overflow-x-auto">
        {/* Seven columns do not survive a phone. Below `md` the same rows stack as
            items — today's cause list's own answer. */}
        <div className="hidden md:block">
          <BulkRescheduleTable
            rows={rows}
            newDate={newDate}
            caption={
              shownDay === null
                ? "Hearings this session has rescheduled"
                : `Hearings rescheduled to ${formatCourtDay(shownDay)}`
            }
          />
        </div>
        <div className="md:hidden">
          <RescheduleItemList rows={rows} showNewDate />
        </div>
      </div>
    </div>
  );
}

/**
 * The Scheduled tab before anything has been scheduled.
 *
 * Says what would put something here rather than apologising for the blank. No control:
 * the thing to do is on the other tab, and a button that only switched tabs would be a
 * third way to press a tab.
 */
function NothingRescheduled() {
  return (
    <Empty className="border-0 p-0">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <CalendarCheck2Icon aria-hidden />
        </EmptyMedia>
        <EmptyTitle className="text-title-s font-semibold">
          Nothing rescheduled yet
        </EmptyTitle>
        <EmptyDescription className="text-body">
          Matters you move from the All hearings tab appear here, with the date
          they were listed on and the date they go to.
        </EmptyDescription>
      </EmptyHeader>
    </Empty>
  );
}

/**
 * The same rows below `md`, stacked.
 *
 * A board read on a phone is still the cause, its number and the day it stands listed on.
 * The columns that only support scanning (stage, hearing type) drop to a caption line
 * rather than forcing a six-column table through a 375px screen.
 *
 * `selection` is omitted on the Scheduled tab for the same reason the table drops its
 * checkbox column there: it is a record of what was done, not a board to work. What the
 * date line says changes with it — on the board, the day the matter stands on; on the
 * record, both ends of the move, because the day it went to is no longer a heading above
 * the rows to read it off (owner, 2026-09-16).
 */
function RescheduleItemList({
  rows,
  selection,
  showNewDate = false,
}: {
  rows: ReschedulableHearing[];
  selection?: {
    selected: ReadonlySet<string>;
    onToggle: (id: string, next: boolean) => void;
  };
  /** The record's rows say where they went as well as where they were. */
  showNewDate?: boolean;
}) {
  const courtText = useCourtText();
  return (
    <ul className="flex flex-col gap-3">
      {rows.map((row) => {
        const isSelected = selection?.selected.has(row.id) ?? false;

        return (
          /* The queue's own line item, not a fourth hand-rolled one: `QueueItemRow`
             carries the fill, the radius, the padding and the hover that every other
             stacked list wears (owner, 2026-09-15 — this one had picked up a stray
             hairline and lost the hover). Selection reads from the box, as it does on
             the sign queues; the row toggles it so twenty-three matters are not
             twenty-three small targets. Passing `onClick` replaces the shell's opener
             delegation, which has nothing to open here. */
          <QueueItemRow
            key={row.id}
            className="flex gap-3"
            onClick={
              selection
                ? (event) => {
                    const target = event.target as HTMLElement;
                    if (target.closest("button, a, [role=checkbox], label")) return;
                    selection.onToggle(row.id, !isSelected);
                  }
                : undefined
            }
          >
            {/* The design system's box expands its own hit area to 40×40; the name it
                carries is the matter, not the column, because a row read aloud has no
                column header. */}
            {selection ? (
              <span className="pt-0.5">
                <Checkbox
                  checked={isSelected}
                  onCheckedChange={(next) =>
                    selection.onToggle(row.id, next === true)
                  }
                  aria-label={`Select ${row.title}, ${courtText(row.caseNumber)}`}
                />
              </span>
            ) : null}
            <div className="flex min-w-0 flex-1 flex-col gap-2">
              <p className="text-body-compact font-medium">{row.title}</p>
              <p className="text-caption text-muted-foreground">
                <Identifier value={row.caseNumber} label="case number" /> ·{" "}
                {courtCaseStageLabel(row.stage)} ·{" "}
                {courtHearingPurposeLabel(row.purpose)}
              </p>
              <p className="text-body-compact tabular-nums text-muted-foreground">
                {selection ? "" : "Previously "}
                {formatListingDate(row.date)}
              </p>
              {/* The move's other end, in the row's one emphasised line — the same
                  weight the table gives that column, for the same reason: it is the fact
                  the record exists to state. */}
              {showNewDate && row.newDate ? (
                <p className="text-body-compact font-medium tabular-nums">
                  New hearing date · {formatListingDate(row.newDate)}
                </p>
              ) : null}
            </div>
          </QueueItemRow>
        );
      })}
    </ul>
  );
}

/**
 * What is picked, and the act itself.
 *
 * Sticky, because the list it commits is longer than a screen and a button that scrolls
 * away from its own selection is a button the bench has to hunt for. Chrome, so it is
 * `bg-card` over a hairline seam and never carries the panel's full-strength edge
 * (ui-craft §4, layer 2); the negative margins let it span the page's own padding.
 *
 * `z-30` is the chrome layer this app already uses — the top bar and the filing footer
 * both sit there — so the bar is never painted over by rows scrolling under it.
 *
 * The count beside the button is `aria-live`, so a screen reader hears the selection
 * change without going looking for the number, and the button carries the same count in
 * its own label once there is one: a button that says what pressing it will do needs no
 * sentence beside it, and a button that says "Reschedule hearings" over an empty
 * selection would be promising an act it cannot perform, which is why it is off.
 */
function CommitBar({
  selected,
  total,
  today,
  range,
  onReschedule,
  onFinished,
  onReturnFocus,
}: {
  selected: ReschedulableHearing[];
  total: number;
  today: string;
  range: Span;
  onReschedule: (day: string, moving: ReschedulableHearing[]) => void;
  /**
   * The act is over and its window has closed.
   *
   * Separate from `onReschedule` because the two happen at different moments and one of
   * them is allowed to unmount this bar. Anything the screen does that takes this bar off
   * the page — following the matters to the other tab — has to wait until the overlay
   * mounted inside it is no longer needed.
   */
  onFinished: () => void;
  /**
   * Where to put the keyboard once the act's window has closed.
   *
   * The screen's, not this bar's: committing takes this bar off the page with the
   * selection it was counting, so it cannot be the place focus comes back to.
   */
  onReturnFocus: () => void;
}) {
  const [open, setOpen] = React.useState(false);
  const summaryRef = React.useRef<HTMLParagraphElement>(null);
  const count = selected.length;
  /** Whether this opening of the overlay actually committed anything. */
  const committed = React.useRef(false);

  /**
   * Which opening of the overlay this is — **a number, where there used to be an
   * unmount.**
   *
   * The overlay has to start every session on the first stage, with no date and no
   * outcome held over from the last one, and it used to get that by not existing between
   * sessions (`{open ? <RescheduleOverlay /> : null}`). That reset worked and cost the
   * keyboard: the component was gone before Radix closed it, and Radix hands
   * `onCloseAutoFocus` out from inside its own unmount cleanup, on a `setTimeout` — so
   * the one handler that can say where focus should land never ran, and a bench that
   * signed with the keyboard was left on `<body>` with the board behind it (measured;
   * true of this screen before the overlay was restaged, and not something the restaging
   * introduced). Nothing a parent does beats that timeout either: it is queued after the
   * handler that would race it.
   *
   * So the overlay stays mounted and is *told* when a new session starts. It resets
   * during render on the change, which is React's own "adjusting state when a prop
   * changes" — the pattern the registrations overlay uses for a different request
   * arriving in the same window, and it never paints a frame of the last session.
   */
  const [session, setSession] = React.useState(0);

  return (
    <div className="sticky bottom-0 z-30 -mx-6 -mb-6 border-t border-hairline bg-card px-6 py-3 md:-mx-8 md:-mb-8 md:px-8 md:py-4">
      <div className="flex flex-wrap items-center justify-end gap-3">
        <p
          ref={summaryRef}
          tabIndex={-1}
          className="mr-auto text-body-compact text-muted-foreground tabular-nums outline-none"
          aria-live="polite"
        >
          {total === 0
            ? "Nothing listed in this range."
            : count === 0
              ? "Select the matters to move."
              : `${count} of ${total} ${plural(total, "matter", "matters")} selected`}
        </p>

        <Dialog
          open={open}
          onOpenChange={(next) => {
            setOpen(next);
            if (next) {
              setSession((count) => count + 1);
              return;
            }
            if (!committed.current) return;
            committed.current = false;
            onFinished();
          }}
        >
          <DialogTrigger asChild>
            <Button disabled={count === 0} className="w-full sm:w-fit">
              {count > 0
                ? `Reschedule ${count} ${plural(count, "hearing", "hearings")}`
                : "Reschedule hearings"}
            </Button>
          </DialogTrigger>
          {/* Always mounted; `session` is what starts it over — see above. Radix takes
              the content out of the page on close on its own. */}
          <RescheduleOverlay
            session={session}
            rows={selected}
            today={today}
            range={range}
            onReschedule={(day, moving) => {
              committed.current = true;
              onReschedule(day, moving);
            }}
            onReturnFocus={onReturnFocus}
          />
        </Dialog>
      </div>
    </div>
  );
}

/** What the act committed, read before it spends the selection that says so. */
type Outcome = { day: string; moved: number; cases: number };

/**
 * Where the act is. The first two are the bench still deciding; the last is settled, and
 * the only way out of it is Done.
 */
type Stage = "day" | "sign" | "signed";

/**
 * **Three stages, two scenes** — and the second fact is the one that matters.
 *
 * A scene is what the reader is looking at. Asking for a date and asking for a signature
 * are two of them, so moving between them travels. Signing is not: the card stating what
 * is about to be signed is the same card that states what was signed, in the same place,
 * at the same size, with a band resolving across its top and the footer changing under
 * it. Keying the stage's entrance on the scene rather than on the stage is what makes
 * that true — a remount is what plays a slide, so the settled stage never gets one.
 *
 * Borrowed whole from `approve-registrations-dialog.tsx`, where the owner settled it on
 * 2026-09-11: a guarded act and its outcome are one beat, not two screens.
 */
const SCENE: Record<Stage, "day" | "sign"> = {
  day: "day",
  sign: "sign",
  signed: "sign",
};

/**
 * The act's shape, which is what `useStagedFlow` reads the direction off: later in the
 * list is forward, earlier is back. Signing goes through the same `go` as everything else
 * and is deliberately *not* a direction — it shares a scene with the question before it,
 * so the flow leaves the entrance alone and the class never gets a chance to replay.
 */
const ORDER = ["day", "sign", "signed"] as const satisfies readonly Stage[];

/**
 * The act: how many are moving, what date they move to, and the signature.
 *
 * **One overlay, three stages, no dialog on a dialog** (ui-craft §7). Asking for the
 * date, taking the signature and reporting what happened are stages of the same window.
 *
 * **And now they read as one window, which they did not.** The frame was rebuilt on the
 * registrations overlay's interaction at the owner's instruction (2026-09-16: *"right now
 * it abruptly changes to a new modal — that shouldn't happen at all, everything should
 * happen in one modal with all those motion+interaction"*). Three things were doing the
 * damage, and all three are measured on the render before this:
 *
 * - **The window resized under the reader.** The calendar stage stood 640px tall, the
 *   signing stage 258px, the outcome 448px — and because a dialog is centred, each change
 *   moved the whole panel up or down the screen as well (top 130 → 321 → 226). The stage
 *   canvas now carries a floor, so pressing on does not shrink the window by 382px.
 * - **Nothing moved, so nothing said a stage had changed.** The body was swapped where it
 *   stood. It now travels: `STAGE_SLIDE`, forward from the right, back from the left,
 *   with the header and footer holding still — that is what makes them chrome rather than
 *   part of the thing that changed.
 * - **The frame itself disappeared at the end.** The header was dropped on the outcome so
 *   the success panel could carry its own heading, which is precisely the moment the
 *   overlay stopped looking like the overlay. The header now states every stage,
 *   including the outcome, and the panel below it no longer repeats itself.
 *
 * **The outcome settles in the scene it was signed in; it does not arrive in a new one.**
 * Signing does not slide, because nothing progressed — the card the bench is looking at
 * stays exactly where it is and a band resolves across the top of it. The second screen
 * is the first screen with a stamp on it, which is the registrations overlay's own rule
 * (owner, 2026-09-11: approving *"takes two screens that feel like one act"*) and as close
 * to one step as a signed act honestly gets.
 *
 * **What that cost, and why it is still the product's confirmation.** The old ending was
 * the detached solid `bg-success` panel carrying its own heading and tick, with the facts
 * in a sunken well beneath — the shape the advocate side ends a submission on
 * (`cases/add-signature-dialog.tsx`) and every court-side signing queue ends on
 * (`sign-bulk-confirm-dialog.tsx`), adopted on 2026-09-15 because a bulk act and a
 * submission must not end on two different kinds of object, and a toast invented for this
 * screen alone was exactly that. That ruling stands and the object still holds: solid
 * success fill, a tick, and the facts directly under it. What changed is that it is the
 * top band of the card those facts were already in rather than a panel that replaces the
 * window — the composition survives the frame staying up, and the heading moves to the
 * header because two headings saying one outcome is one too many. The queues
 * (`sign-bulk-confirm-dialog.tsx`, which still swaps its content wholesale) are the next
 * ones to bring across; that is a separate pass and is not done here.
 *
 * **The signature is the finalisation, and nothing moves before it.** Anshumanth's note
 * (2026-09-15) is that a bulk reschedule needs a document drawn up and signed before it
 * is finalised — which is how the act actually works: a court moves twenty matters by
 * passing one order, and the order is what the files carry. So picking a date commits
 * nothing; the matters move when the signature goes on.
 *
 * **It is an e-sign, and it asks for nothing.** No method group, because there is no
 * second route to choose between — the order is drawn up by the court at the moment of
 * the act, so there is no paper to upload — and no code, because the bench is not
 * authenticating a document it has opened. Pressing Sign signs, the way the court's own
 * bulk path does (`sign-bulk-confirm-dialog.tsx`, which asks for neither).
 *
 * The order document itself (`bulk-reschedule.ts`) is drawn up and tested but has no
 * surface on this screen: the bench is not offered a copy before signing or after it.
 *
 * **The calendar is composed here rather than hidden behind a picker trigger.** Three
 * things fall out of that, and each was a defect on the version this replaces. A day
 * already past can be refused by the control instead of by a sentence after the fact —
 * `DatePicker` takes no matcher, so the screen used to catch a past date and complain
 * about it. The date is written out by the court's own registers (`formatCourtDay`)
 * rather than by the picker's fixed `en-US` trigger, which disagreed with every other
 * date on the page. And a stage whose whole question is "which day" should not open a
 * second layer to ask it.
 */
function RescheduleOverlay({
  session,
  rows,
  today,
  range,
  onReschedule,
  onReturnFocus,
}: {
  /** Which opening of the overlay this is; a change starts the act over. */
  session: number;
  rows: ReschedulableHearing[];
  today: string;
  /** The span the board is holding — read only, and only to floor the calendar. */
  range: Span;
  onReschedule: (day: string, moving: ReschedulableHearing[]) => void;
  onReturnFocus: () => void;
}) {
  const [day, setDay] = React.useState<string | null>(null);
  /**
   * What the act did, captured at the moment it ran.
   *
   * The confirmation reports the selection the act consumed, which by then is no longer
   * live: signing empties it, so `rows` is `[]` on the very next render and every live
   * figure is zero. These are the ones that were committed.
   */
  const [outcome, setOutcome] = React.useState<Outcome | null>(null);

  /**
   * The stage, its direction and the focus that follows it — `chrome/staged-overlay.tsx`,
   * shared with the registrations overlay this interaction came from and with every other
   * court-side modal since the owner asked for it on all of them (2026-09-16).
   *
   * The `session` is the record: a **new opening** of the same component is the first
   * question again, nothing picked and nothing signed. Adjusted during render rather than
   * in an effect, so no frame of the last session is ever painted.
   *
   * Focus lands on the title on every stage change — it is the line that rewrites itself,
   * so it is what announces the change, and a stage that slides away takes its controls
   * with it. The flow leaves the *first* render alone, which is what the dialog's own
   * `onOpenAutoFocus` is for.
   */
  const flow = useStagedFlow({
    order: ORDER,
    scene: SCENE,
    record: session,
    /* A new *opening*, not a new record inside an open window: the panel is already rising
       on its own, so the stage inside it just enters. A rise within a rise is one gesture
       played twice (measured: a 500ms stage rise inside the 300ms panel rise). */
    arrival: "forward",
    onRecordChange: () => {
      setDay(null);
      setOutcome(null);
    },
  });
  const { stage, go } = flow;

  /* Whether the act is what closed this, rather than Cancel, Escape or the X. The two
     want different things afterwards and the dialog cannot tell them apart on its own —
     the selection it was working on has already been spent by the parent. */
  const committed = React.useRef(false);

  const count = rows.length;
  /* The matters are listings, and two of them can belong to one case — so the receipt
     counts both, and counts them the same way before the act and after it. */
  const caseCount = new Set(rows.map((row) => row.caseNumber)).size;

  /* The fact the signing stage states, named so the dialog can be described by it rather
     than by a second sentence written to have something to point at. */
  const factId = React.useId();

  /* The days the calendar will not offer — the span the bench asked the board for, and
     everything in it. See `earliestNewListing`. */
  const earliestNewDay = earliestNewListing(rows, range.to, today);

  return (
    <StagedOverlay
      /* Narrow: this act is one question at a time, not a document to read. No definite
         height either, so the canvas carries a `floor` — see the frame, which explains why
         it arrives in viewport-height steps rather than unconditionally. */
      className="sm:max-w-md"
      floor
      /* The one line that rewrites itself, and it carries the outcome too — the success
         band below states the signature, not the count, so the two no longer say the same
         thing twice. */
      title={
        stage === "signed" && outcome
          ? `${outcome.moved} ${plural(outcome.moved, "hearing", "hearings")} rescheduled`
          : stage === "sign"
            ? "Sign the rescheduling order"
            : "Pick a new date"
      }
      titleRef={flow.titleRef}
      sceneKey={flow.sceneKey}
      motion={flow.motion}
      /* Past the first question there is no `DialogDescription`; the facts in the card
         are what describe this window, before the signature and after it, so they are
         pointed at directly. Left unset the primitive would go looking for a description
         that is deliberately not there. */
      aria-describedby={stage === "day" ? undefined : factId}
      /* The question, not the first control the overlay happens to contain — which is
         the calendar's previous-month arrow, and a ring around that on open reads as a
         starting point the bench does not have. */
      onOpenAutoFocus={(event) => {
        event.preventDefault();
        flow.titleRef.current?.focus();
      }}
      /* Cancelling leaves the trigger standing, so the primitive's own restore is right.
         Committing spends the selection and turns that button off, so the restore has
         nothing to land on and the keyboard would be left on `<body>` — it goes to the
         count instead, which is the line that just changed. This is the handler the old
         unmount was throwing away; see `session` in `CommitBar`. */
      onCloseAutoFocus={(event) => {
        if (!committed.current) return;
        committed.current = false;
        event.preventDefault();
        onReturnFocus();
      }}
      /* Only the first question has a line here. What the bench needs at the other two
         moments is the facts in the card below — how many matters, and the day they go
         to — and a sentence above them restating that a signature signs things was the
         header talking over the only thing it had to say. The dialog is described by
         those facts instead (`aria-describedby` above).

         **The count moved down here when the title stopped carrying it.** The title read
         *Reschedule 35 hearings*, which is the board's own button repeated back at a
         bench that had just pressed it (owner, 2026-09-16); it asks the question instead.
         The scale of the act is still worth stating before a date is chosen, so the line
         below says it — and says that one date takes all of them, which is what this
         window is for. */
      description={
        stage === "day" ? (
          <DialogDescription className="text-body-compact tabular-nums text-muted-foreground">
            {count} selected {plural(count, "hearing", "hearings")}{" "}
            {plural(count, "moves", "move")} to one new date.
          </DialogDescription>
        ) : null
      }
      footer={
        stage === "signed" ? (
          <>
            {/* The half of the truth the screen would otherwise imply, and it belongs
                here rather than in the card: moving a day's board is communicated to the
                parties by a notification the court draws up, and this build draws none.
                In the footer it is an aside beside the way out — where the registrations
                overlay puts what is left of its queue — so the card's footprint is
                identical before the signature and after it, which is the whole claim the
                resolving band is making. */}
            <p className="text-body-compact text-muted-foreground sm:mr-auto sm:self-center">
              No notification has gone to the parties yet.
            </p>
            {/* One way out, and it is the way back to the board — where the rows the act
                moved are now carrying both of their dates. */}
            <DialogClose asChild>
              <Button type="button">Done</Button>
            </DialogClose>
          </>
        ) : stage === "sign" ? (
          <>
            {/* Ghost, like the step back on the registrations overlay: retracing is not
                an alternative to the act beside it. */}
            <Button type="button" variant="ghost" onClick={() => go("day")}>
              Back
            </Button>
            {/* **Sign and reschedule** — the verb and what it achieves, which is the
                shape the court side already uses for a signature that does something
                beyond being a signature: an order's footer says *Sign and publish*
                (`sign-order-dialog.tsx`), a diary entry's says *Sign the entry*. The four
                signing queues say a bare *Sign* because there the signature **is** the
                whole act — the document is drawn up and waiting, and signing only clears
                it (`sign-bulk-confirm-dialog.tsx`, `confirm: "Sign"`). Here it is not:
                nothing has moved until this press, and what the signature does is move
                thirty listings, so the button says so (owner, 2026-09-16).

                It replaced *Confirm and sign*, which was the outlier — no other signing
                button on the court side opens with *Confirm*. That shape belongs to the
                registrations overlay's decisions (*Confirm approval*, *Confirm
                rejection*), where there is no signature and the press is the decision. */}
            <Button
              type="button"
              disabled={day === null}
              onClick={() => {
                if (day === null) return;
                committed.current = true;
                setOutcome({
                  day,
                  moved: rows.length,
                  cases: new Set(rows.map((row) => row.caseNumber)).size,
                });
                onReschedule(day, rows);
                /* Through the same `go` as every other step, and it still does not slide:
                   `signed` shares a scene with `sign`, so the flow leaves the entrance
                   alone. A slide here would be the window claiming something moved when
                   nothing did. */
                go("signed");
              }}
            >
              Sign and reschedule
            </Button>
          </>
        ) : (
          <>
            <DialogClose asChild>
              <Button type="button" variant="ghost">
                Cancel
              </Button>
            </DialogClose>
            {/* Off until a day is held. Nothing else can be wrong with it: the calendar
                offers no day that any of these matters is already on or past.

                **Next** (owner, 2026-09-16, the third and settled reading of this one
                button). It moves the bench on and nothing else: the date is not applied
                by it, no order is drawn by it, and the act itself is a press away on the
                stage that performs it — so a verb here would be claiming something. The
                title above asks a question; this answers *asked and answered, carry on*.
                The two together are the honest shape of a step that commits nothing.

                It is a departure from the registrations overlay, which names its steps
                with verbs (*Approve* → *Confirm approval*) because each of its stages is a
                decision. This one is not: picking a day is data collection, and the
                decision is single and lives at the end. */}
            <Button
              type="button"
              disabled={day === null}
              onClick={() => go("sign")}
            >
              Next
            </Button>
          </>
        )
      }
    >
      {/* Centred in the canvas while there is room for it, and pushed back to the top by
          its own content when there is not — `my-auto` gives way to overflow, which a
          `justify-center` on the scroller would not: that clips the top of a stage taller
          than the window and puts it out of reach. */}
      <div className="mx-auto my-auto flex w-full max-w-sm flex-col gap-4">
        {stage === "day" || day === null ? (
          <PickDay day={day} onDayChange={setDay} earliest={earliestNewDay} />
        ) : (
          <SignOrder
            cases={outcome?.cases ?? caseCount}
            day={outcome?.day ?? day}
            signed={stage === "signed"}
            factId={factId}
          />
        )}
      </div>
    </StagedOverlay>
  );
}

/**
 * The one question the overlay exists to ask.
 *
 * A white card on the tinted stage, holding a labelled calendar and nothing else.
 *
 * It held two more lines and both have gone. A hint reading "Pick the day these matters
 * move to" sat directly under a label reading "New hearing date", which is the same
 * instruction twice and the second one in the weaker voice. And a line confirming that
 * *n* matters move to the day just picked restated the count in the title against the day
 * already lit in the grid — a sentence the reader could have written themselves.
 *
 * A third line went the same way. It reported that part of the selection was already
 * listed on the day chosen, so the act was smaller than the title said — a sentence that
 * only existed because the calendar was offering a day it should never have offered. The
 * floor under the calendar (`earliest`) removes the case instead of narrating it.
 *
 * **One question, and only one.** The span being moved was briefly a second control here,
 * so the bench could correct it without cancelling. It came out again on the render: the
 * overlay is opened *after* the board has been narrowed and the matters ticked, so a
 * second date control beside the first — one naming days being left, one naming the day
 * being chosen — read as two questions where the flow has one (owner, 2026-09-13). The
 * span belongs to the board, and the board is where it is set.
 */
function PickDay({
  day,
  onDayChange,
  earliest,
}: {
  day: string | null;
  onDayChange: (day: string) => void;
  /**
   * The first day the act can land on — the day after the span the board is showing.
   * Everything before it is drawn but refused, which is the point: the bench sees the
   * days it asked for, greyed, and the choice begins where they end.
   */
  earliest: string;
}) {
  return (
    <Card size="sm" className="border-hairline px-4 shadow-raised">
      <div className="flex flex-col gap-3">
        {/* **No visible label over the grid any more.** It read *New hearing date*, 40px
            under a title that now reads *Pick a new date* — two lines naming the same
            thing, and the card holds nothing else for a label to tell apart. The window's
            title is the label. The group keeps its accessible name so a screen reader
            still hears what the grid is for, rather than a bare calendar
            (ACCESSIBILITY §12: a name, whether or not it is drawn).

            A 40px grid is wider than a phone-width dialog's card once three paddings have
            been taken out of 375px, and the week clipped its last column on the render.
            The calendar reaches back into the card's own gutter rather than shrinking its
            cells below the control height or making the card's text cramped — only the
            grid moves, and only where it has to. */}
        <div
          role="group"
          aria-label="New hearing date"
          className="-mx-3 sm:mx-0"
        >
          <Calendar
            mode="single"
            /* The one variable the primitive exposes for this, and the reason to reach
               for it: the design system's calendar draws 28px day cells, which is fine
               under a picker trigger and below the 40×40 floor the same system sets for
               anything a finger has to hit (ACCESSIBILITY §8). Here the calendar is not a
               detail inside a field — it is the question the overlay was opened to ask —
               so the cell takes the control height every other control on the screen
               has. Logged upstream; nothing is forked to do it. */
            className="mx-auto [--cell-size:--spacing(10)]"
            selected={day ? parseIsoDay(day) : undefined}
            /* Opens where the choice is, not where the work was — a month whose days are
               all refused is a month nobody needs to look at. */
            defaultMonth={parseIsoDay(earliest)}
            /* Every day up to the end of the span is refused: a day already gone, a day
               one of these matters is already on, and a day inside the span the bench
               just drew are all the same wrong answer, and the control gives none of them
               rather than explaining afterwards.

               **And every day the court is closed** (owner, 2026-09-16, on Sunday; the
               product's own `isSittingDay` also closes Saturday, and an order's next
               listing has rolled off both since before this screen existed). The board
               carries no weekend listings for the same reason, so a calendar that offered
               one would be the only place in the product able to fix a hearing on a day
               nobody is there for. Holidays are not modelled, so the control refuses what
               it has been told and nothing it has not. */
            disabled={[{ before: parseIsoDay(earliest) }, { dayOfWeek: [0, 6] }]}
            startMonth={parseIsoDay(earliest)}
            onSelect={(next) => {
              if (next) onDayChange(isoDay(next));
            }}
          />
        </div>
      </div>
    </Card>
  );
}

/**
 * What is about to be signed, and — **in the same card, in the same place** — what was.
 *
 * One object across the last two stages of the act. Before the signature it states the
 * move: a strip naming what the bench is doing, over the three facts it cannot get
 * anywhere else at this moment, having come from a board it has already scrolled away
 * from. After it, the identical rows stay exactly where they are and the strip resolves
 * into the outcome. Nothing is replaced, nothing collapses, and the only thing that moves
 * is the band that changed — which is the registrations overlay's rule, borrowed with its
 * reason (owner, 2026-09-11 and 2026-09-16).
 *
 * **The copy is the owner's, and it is a sentence the card finishes** (2026-09-16):
 * *Preparing to move* across the top, then *Cases* and *To new hearing date* under it. The
 * band is the verb and the rows are its object, so the bench reads one line rather than
 * three labels — which is what the first pass got wrong by stating the move as a heading
 * ("You are rescheduling") over three unrelated facts.
 *
 * **Two rows, because the third was the same number twice.** A *Hearings* row sat above
 * *Cases* and on this board they are almost always equal, so it read as the card saying
 * one thing twice (owner, 2026-09-16). The count of listings is not lost: the first
 * question's title carries it going in, and the receipt's title carries it coming out.
 * Where listings do outnumber cases, this card states the cases only.
 *
 * **The band is the product's success treatment, at the size a band can carry it.** Solid
 * `bg-success` with the tick and its own ink, the facts directly beneath — the composition
 * the advocate submission and the signing queues end on (2026-09-15). What it is not is a
 * detached panel that replaces the window and carries its own heading: the heading is the
 * dialog's, because the frame stays up now, and a 40px tick chip inside a 40px-tall strip
 * would be the whole strip.
 *
 * Before the act the strip is white over a rule rather than a tint — the tint it would
 * otherwise carry is the stage's own tone, which is how the top of a card ends up
 * dissolving into the page (measured on the registrations overlay, 2026-09-11) — and the
 * words are the plain "what you are about to do", never a colour.
 *
 * **The facts do not change across the act, and are not read from live state after it.**
 * Signing empties the selection, so the case count comes from the captured `Outcome` once
 * there is one; passed in rather than read here, because this card is the one place both
 * sides of the act are stated and it must not be able to disagree with itself. The e-sign asks for nothing further — no method, no code — the way the court's
 * own bulk path signs a queue (`sign-bulk-confirm-dialog.tsx`, which asks for neither).
 */
function SignOrder({
  cases,
  day,
  signed,
  factId,
}: {
  cases: number;
  day: string;
  /** The act has run: the same card, stamped. */
  signed: boolean;
  /** Named so the dialog can point `aria-describedby` at the facts rather than at prose. */
  factId: string;
}) {
  return (
    /* Flush: the strip and the rows draw their own rules edge to edge, so the card's own
       padding is off and `overflow-hidden` is what keeps the band inside the radius. */
    <Card
      size="sm"
      className="gap-0 overflow-hidden border-hairline py-0 shadow-raised"
    >
      <div
        /* Keyed on the act so the band mounts when it changes and plays its entrance;
           the rows below it are not keyed and do not move. */
        key={signed ? "signed" : "unsigned"}
        className={cn(
          "flex items-center gap-2 px-4 py-2.5 text-body-compact",
          signed
            /* The transparent rule is load-bearing: the unsigned band carries a
               hairline, and a solid band without one is 1px shorter — which is 1px of
               the card moving at the exact moment this design is claiming that nothing
               does (measured before this). */
            ? cn(
                "border-b border-transparent bg-success text-success-foreground",
                RESOLVE_IN_PLACE,
              )
            : "border-b border-hairline text-muted-foreground",
        )}
      >
        {signed ? (
          <>
            <CircleCheckIcon aria-hidden className="size-4 shrink-0" />
            {/* `role="status"` is what gets the outcome spoken: focus lands on the header
                title, which announces itself and nothing under it. */}
            <span role="status" className="font-medium">
              Order signed
            </span>
          </>
        ) : (
          <span className="font-medium">Preparing to move</span>
        )}
      </div>

      {/* **Subgrid, so the term column is as wide as the longest term and not a pixel
          more.** The DS row reserves up to 10rem for the term, which left *Thursday, 17
          September 2026* 176px to live in and broke a court date across two lines inside a
          448px dialog (measured). Sizing the column to its content gives the date the rest
          of the card, and the list owning the columns is what keeps the two rows aligned
          with each other while it does.

          **On a phone the pair stacks instead.** Two columns inside a 280px card leave
          the date 136px however tightly the term is measured, and it broke across two
          lines again; stacked, it has the card's full width and reads as one date. The
          rows keep the list's columns through `grid-cols-subgrid`, so one breakpoint on
          the list turns both of them. */}
      <DescriptionList
        id={factId}
        className="grid grid-cols-1 px-4 sm:grid-cols-[auto_1fr] [&>*]:col-span-1 [&>*]:gap-x-4 [&>*]:gap-y-0.5 sm:[&>*]:col-span-2 [&>*]:grid-cols-subgrid"
      >
        <DescriptionRow className="border-hairline">
          <DescriptionTerm className="text-body-compact">Cases</DescriptionTerm>
          <DescriptionDetails className="text-body-compact tabular-nums">
            {cases} {plural(cases, "case", "cases")}
          </DescriptionDetails>
        </DescriptionRow>
        <DescriptionRow className="border-hairline">
          <DescriptionTerm className="text-body-compact">
            To new hearing date
          </DescriptionTerm>
          {/* The court's own register writes the day, weekday and all: the bench is
              committing to a sitting day, and which day of the week it is is half of
              what makes that answer right. */}
          <DescriptionDetails className="text-body-compact tabular-nums">
            {formatCourtDay(day)}
          </DescriptionDetails>
        </DescriptionRow>
      </DescriptionList>
    </Card>
  );
}

