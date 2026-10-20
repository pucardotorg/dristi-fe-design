"use client";

import * as React from "react";
import {
  CalendarX2Icon,
  ListChecksIcon,
  SearchXIcon,
  VideoIcon,
} from "lucide-react";

import {
  PILL_COUNT,
  PILL_ITEM,
  PILL_ROW,
} from "@/components/chrome/pill-plate";
import { CounselCell } from "@/components/employee/counsel-cell";
import {
  CauseListBulkBar,
  hasBulkActs,
  type BulkRoles,
} from "@/components/employee/cause-list-bulk";
import { usePendingOrders } from "@/components/employee/use-pending-orders";
import { useOrderDrafts } from "@/components/employee/use-order-draft";
import { hasDraftFor } from "@/lib/employee/order-drafts";
import { Checkbox } from "@/components/ui/checkbox";
import { useOrderSigning } from "@/components/employee/use-order-signing";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { HearingOverviewDialog } from "@/components/employee/hearing-overview-dialog";
import {
  HearingCaseButton,
  HearingRowActions,
  HearingsTable,
} from "@/components/employee/hearings-table";
import { ListFooter } from "@/components/employee/list-footer";
import { QueueAnnouncer } from "@/components/employee/queue-announcer";
import { useCourtRole } from "@/components/employee/use-court-role";
import { useCourtToday } from "@/components/employee/use-court-today";
import { useHearingSession } from "@/components/employee/use-hearing-session";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { CourtRole } from "@/lib/employee/content";
import {
  seatDraftsOrders,
  seatHasBenchControls,
  seatPostsNextHearing,
} from "@/lib/employee/court-role";
import { CauseListColumnsMenu } from "@/components/employee/cause-list-columns-menu";
import { useCauseListColumns } from "@/components/employee/use-cause-list-columns";
import { useReaderPostsNextHearing } from "@/components/employee/use-next-hearing-entry";
import { shownColumns } from "@/lib/employee/cause-list-columns";
import {
  markHearingEnded,
  markHearingOngoing,
  markHearingPassedOver,
} from "@/lib/employee/hearing-session";
import {
  advocatesOnList,
  boardForDay,
  causeTitle,
  counselFor,
  courtHearingPurposeLabel,
  courtHearingStatusLabel,
  courtHearingStatusVariant,
  filterHearings,
  formatCourtDay,
  groupByStatus,
  isoDay,
  parseIsoDay,
  COURT_CASE_STAGES,
  COURT_HEARING_PURPOSES,
  EMPTY_FILTERS,
  CAUSE_LIST_STATUS_ORDER,
  LISTING_ORDER_MARKS,
  NEXT_HEARING_MARKS,
  PAGE_SIZE,
  courtHearingStatusLabel as statusWord,
  type ListingFacts,
  type CourtHearing,
  type HearingFilters,
  type HearingsPageSize,
  type TodaysCauseStatus,
} from "@/lib/employee/hearings";
import { Identifier } from "@/components/chrome/identifier";
import { QueueItemRow } from "@/components/employee/queue-item-row";
import { CourtFilters, CourtSortSelect } from "@/components/employee/court-filters";
import {
  caseSorts,
  sortOptions,
  sortRows,
  type CourtSortSpec,
} from "@/lib/employee/court-sort";

type HearingSort = "item" | "name" | "newest";

/**
 * The cause list's own order — the court's serial, the S. no. column — by default: it is
 * the order the bench calls the matters in.
 */
const HEARING_SORTS: CourtSortSpec<CourtHearing, HearingSort>[] = [
  { id: "item", label: "Cause list order", compare: (a, b) => a.item - b.item },
  caseSorts<CourtHearing>()[2] as CourtSortSpec<CourtHearing, HearingSort>,
  caseSorts<CourtHearing>()[0] as CourtSortSpec<CourtHearing, HearingSort>,
];

/**
 * The status pills: All, then each status in the board's own grouping order (`CLS-07`,
 * `CLS-02`), each in the status's own word.
 */
const HEARING_PILLS: { id: TodaysCauseStatus; label: string }[] =
  CAUSE_LIST_STATUS_ORDER.map((id) => ({ id, label: statusWord(id) }));

/**
 * Today's hearings — the court's cause list for the day it is sitting, its pills
 * narrowing by status — the sign process and pending-tasks row. The orders that come out
 * of it have a row of their own, Pending orders (owner, 2026-10-14).
 *
 * Composed the way the advocate's cases list is composed (`CasesListScreen`), because it
 * is the same kind of screen and the bench should not have to learn a second layout: the
 * page title stands on the page, and **one** lifted panel holds the filters, the table
 * and the pagination footer together. The filters live inside that panel rather than
 * floating on the page — they belong to the list they filter, and a second framed box
 * below them would be the box-in-box the layering model rules out (ui-craft §4).
 */
export function HearingsScreen() {
  const today = useCourtToday();
  /* Which seat the court side is being worked from. It decides what the rows offer, not
     what they say: the same board, with the acts that move the sitting on it or not
     (`lib/employee/court-role.ts`). */
  const seat = useCourtRole();

  /* `null` means "the day the court is sitting" — resolved against the reader's clock
     rather than frozen at first render, so the screen is right whenever it is opened. */
  const [day, setDay] = React.useState<string | null>(null);
  const activeDay = day ?? today;

  /* One state, not a draft and an applied one: the board answers the controls as they are
     used — status, purpose and free text alike, so the row has one rule rather than a live
     date beside three deferred filters. Every change resets to page one; the old Search
     button did that, and a keystroke that narrows the list to four rows must not leave the
     reader on page three of nothing. */
  const [filters, setFilters] = React.useState<HearingFilters>(EMPTY_FILTERS);
  const [pageSize, setPageSize] = React.useState<HearingsPageSize>(PAGE_SIZE);
  const [page, setPage] = React.useState(1);
  /* Which listing the bench has called, which it has ended, and which it has passed
     over. Held outside this component because the marks have to outlive it: the cause
     title and the order composer both navigate away, and the matter must still read as
     ongoing when the bench lands there — see `lib/employee/hearing-session.ts`. None of
     the three writes a court record; that part of the bargain is unchanged. */
  const session = useHearingSession();
  const [liveMessage, setLiveMessage] = React.useState<string | null>(null);
  /* The matter being read over the list — opened by the cause title, or by the call
     that also marks it ongoing. Held as an id rather than a row because in the second
     case the row it names has just changed status, and a copy taken at click time would
     show the overlay a listing that is still scheduled. */
  const [openHearingId, setOpenHearingId] = React.useState<string | null>(null);

  /* Today's board is live; a past day this browser worked is shown closed, with what
     was left unheard Abandoned (`HRG-05`, `boardForDay`). */
  const listed = boardForDay(activeDay, today, session);
  const pastDay = activeDay < today;
  const [sort, setSort] = React.useState<HearingSort>("item");

  /* What the Orders and Next hearing filters read: the same facts the Orders glyph and
     the Next hearing fields show (`hearings-table.tsx`). */
  const drafts = useOrderDrafts();
  const facts: ListingFacts = {
    orderMark: (hearing) =>
      hasDraftFor(drafts, hearing.id)
        ? "draft"
        : hearing.status === "completed"
          ? "recorded"
          : "none",
    nextHearingSet: (hearing) => {
      const posting = session.postings[hearing.id];
      return !!posting && (posting.next === "none" || posting.nextDate !== null);
    },
  };
  /* Who enters the next hearing is a court setting (owner, 2026-10-15): the reader, on
     this board, or the steno, on the order screen. */
  const postsNextHearing = useReaderPostsNextHearing();
  /* The Next hearing filter goes with its column: where the column is not offered, a
     choice made in another seat narrows nothing. */
  const nextHearingColumn =
    postsNextHearing && seatPostsNextHearing(seat) && !pastDay;
  /* Grouped by status, and within each group in the chosen order — the cause list's
     own sequence by default (`CLS-02`). Array sort is stable, so grouping the sorted
     rows keeps that order inside each group. */
  const rows = groupByStatus(
    sortRows(
      filterHearings(
        listed,
        nextHearingColumn ? filters : { ...filters, nextHearing: [] },
        facts,
      ),
      HEARING_SORTS,
      sort,
    ),
    () => 0,
  );
  /* Which columns show, and in what order — this seat's own choice, opening on its
     default (`cause-list-columns.ts`). */
  const columnState = useCauseListColumns(seat, postsNextHearing);
  /* A past day is a record: nothing on it can be started, ended, posted or drafted. */
  const tableColumns = shownColumns(columnState.columns).filter(
    (column) =>
      !pastDay ||
      (column.id !== "action" &&
        column.id !== "orders" &&
        column.id !== "nextHearing"),
  );
  /* Bulk mode follows the roles this seat stands for (`CLS-06`, `CLS-09`): a hearing
     controller ends or passes over many listings; a next hearing setter, where the
     next hearing is entered here, posts them in the same pop-up; an order drafter adds
     one piece of text to many orders. A seat with none of them has no bulk mode, and a
     past day has none for anyone. */
  const bulkRoles: BulkRoles = {
    hearing: seatHasBenchControls(seat),
    next: postsNextHearing && seatPostsNextHearing(seat),
    text: seatDraftsOrders(seat),
  };
  const bulkOffered = hasBulkActs(bulkRoles) && !pastDay;
  const [bulkOn, setBulkOn] = React.useState(false);
  const bulk = bulkOffered && bulkOn;
  const [bulkIds, setBulkIds] = React.useState<ReadonlySet<string>>(
    () => new Set(),
  );
  const [bulkNotice, setBulkNotice] = React.useState("");
  const pendingOrders = usePendingOrders();
  const signing = useOrderSigning();
  const searchRef = React.useRef<HTMLInputElement>(null);

  /**
   * Reading a matter without calling it — the cause title on the row, and the row
   * itself, which delegates to it.
   *
   * The whole of it is opening the overlay. It writes no session mark, announces
   * nothing and touches no status: a reader who opens item 4 to see what it is has not
   * started hearing item 4, and a screen that recorded otherwise would be lying about
   * the one thing this list is for. That is also why it needs no seat test — reading is
   * not one of the acts a seat has or lacks (`lib/employee/court-role.ts`), so the
   * typist gets the same overview from the same cell the bench does.
   */
  function openCase(hearing: CourtHearing) {
    setOpenHearingId(hearing.id);
  }

  /**
   * Calling a matter. It marks the listing ongoing and nothing else.
   *
   * **It does not open the overlay** (owner, 2026-09-12). It used to, on the argument
   * that the bench would want the matter in front of them the moment they called it —
   * but that made one press do two things, and the second one was the one nobody asked
   * for: a sheet over the day, to be dismissed, before the next item could be called.
   * Calling the list is a run of presses down a column, and a modal between each of them
   * is a modal in the way. Reading a matter is its own act, with its own control on the
   * same row (`openCase`), and now they are cleanly separated — press to call, click the
   * name to read.
   *
   * The row says it happened without any of that: the chip turns Ongoing, the slot the
   * press landed on becomes End hearing under the pointer, and the Orders control opens.
   * Three changes on the row the eye is already on, which is what an in-place outcome is
   * supposed to look like.
   *
   * All three marks announce from here, and here is where the announcement belongs now
   * that none of them opens anything: the list is what stays on screen. None of the
   * three runs in a seat that does not run the sitting — the controls that call them are
   * simply not on the row, so the mark never happens there.
   */
  function startHearing(hearing: CourtHearing) {
    markHearingOngoing(hearing.id);
    setLiveMessage(`Hearing started for ${causeTitle(hearing)}`);
  }

  /*
   * **Opening an order marks nothing, since 2026-09-15.**
   *
   * The typist's trip into a listing used to mark the matter heard on the way in, so the
   * row would read Completed when the trail brought them back. Two things were wrong with
   * it, and the owner hit the second: *"whenever I click on an order icon and land in the
   * order page, on default the order is already typed out. That shouldn't happen."*
   *
   * It was doing exactly that, and this line was why. `initialOrderDraft` opens a
   * **completed** listing on a written order (D23) — the roll called, the applications
   * allowed, a paragraph per purpose — and it reads the *live* status, which this made
   * `completed` at the instant of arrival. So the typist reached a composer that had
   * already written the order they came to type, and the words were not theirs.
   *
   * The other thing was quieter and worse: Completed is a claim about a sitting, and
   * opening a screen is not a sitting. "What a court record must not do is quietly imply a
   * fact nobody entered" is this area's own rule, and a status set by navigation breaks it.
   *
   * Nothing takes its place, because nothing needs to: a listing the typist has actually
   * dictated on now carries the draft mark in the Orders column (`hearings-table.tsx`), so
   * the trail is drawn by work that exists rather than by a trip that happened. A listing
   * opened and left shows no mark, which is the truth about it.
   */

  function endHearing(hearing: CourtHearing) {
    markHearingEnded(hearing.id);
    setLiveMessage(`Hearing ended for ${causeTitle(hearing)}`);
  }

  function passOverHearing(hearing: CourtHearing) {
    markHearingPassedOver(hearing.id);
    setLiveMessage(`Hearing passed over for ${causeTitle(hearing)}`);
  }

  /* What a bulk act takes: the ticked listings still in the filtered list. A tick hidden
     by a narrower filter is not acted on — nothing happens to a row the reader cannot
     see. */
  const bulkSelected = rows.filter((hearing) => bulkIds.has(hearing.id));
  const bulkAll: boolean | "indeterminate" =
    rows.length > 0 && bulkSelected.length === rows.length
      ? true
      : bulkSelected.length > 0
        ? "indeterminate"
        : false;

  function toggleBulk(id: string) {
    setBulkNotice("");
    setBulkIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleBulkAll(select: boolean) {
    setBulkNotice("");
    setBulkIds(select ? new Set(rows.map((hearing) => hearing.id)) : new Set());
  }

  function setBulkMode(on: boolean) {
    setBulkOn(on);
    setBulkIds(new Set());
    setBulkNotice("");
  }

  const pageCount = Math.max(1, Math.ceil(rows.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const start = (currentPage - 1) * pageSize;
  const pageRows = rows.slice(start, start + pageSize);
  const isFiltered =
    filters.statuses.length > 0 ||
    filters.orders.length > 0 ||
    (nextHearingColumn && filters.nextHearing.length > 0) ||
    filters.purposes.length > 0 ||
    filters.advocates.length > 0 ||
    filters.stages.length > 0 ||
    filters.query !== "";

  /* Read from `listed`, not from `rows`: a filter set to Scheduled drops the matter
     the bench has just called out of the filtered list, and the overlay reading it
     should not close because of that. */
  const openHearing =
    listed.find((hearing) => hearing.id === openHearingId) ?? null;

  /**
   * Change some of the filters. A patch, merged into the latest state: the Filters sheet
   * applies every field it changed in one go, and a whole set built by each field from
   * this render's `filters` kept only the last field's change.
   */
  function changeFilters(patch: Partial<HearingFilters>) {
    setFilters((current) => ({ ...current, ...patch }));
    setPage(1);
  }

  function clearFilters() {
    changeFilters(EMPTY_FILTERS);
    setDay(null);
  }

  return (
    <div className="flex min-w-0 flex-1 flex-col gap-8 p-6 md:p-8">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 flex-col gap-2">
          <h1 className="text-title text-balance font-semibold">
            Today&rsquo;s hearings
          </h1>
          <p className="text-body text-muted-foreground">
            {formatCourtDay(activeDay)}
          </p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <JoinVideoCourt />
        </div>
      </header>

      {/* One panel: filters, list and footer are one unit of work, so they share one
          lifted sheet — the same recipe and the same `gap-6` / `p-6` the cases panel
          uses. Nothing inside draws a second frame. */}
      <div className="flex min-w-0 flex-col gap-6 rounded-xl border border-hairline bg-card p-6 shadow-raised">
        <HearingsFilters
          searchRef={searchRef}
          leading={
            <StatusPills
                label="Hearing status"
                /* The pills are the quick form of the Status filter: one status, or All.
                   Several statuses picked in the Filters panel light no pill. */
                value={
                  filters.statuses.length === 0
                    ? "all"
                    : filters.statuses.length === 1
                      ? filters.statuses[0]
                      : ""
                }
                onChange={(status) =>
                  changeFilters({
                    statuses:
                      status === "all" ? [] : [status as TodaysCauseStatus],
                  })
                }
                total={listed.length}
                options={HEARING_PILLS.map((pill) => ({
                  value: pill.id,
                  label: pill.label,
                  count: listed.filter((hearing) => hearing.status === pill.id)
                    .length,
                }))}
              />
          }
          filters={filters}
          advocates={advocatesOnList(listed)}
          nextHearingColumn={nextHearingColumn}
          onChange={(patch) => {
            setBulkNotice("");
            changeFilters(patch);
          }}
          day={activeDay}
          today={today}
          onDayChange={(next) => {
            setDay(next);
            setPage(1);
          }}
          onClearDay={() => {
            setDay(null);
            setPage(1);
          }}
          onClear={clearFilters}
          trailing={
            <>
              {bulkOffered ? (
                <Button
                  type="button"
                  variant="outline"
                  aria-pressed={bulk}
                  onClick={() => setBulkMode(!bulk)}
                  className={
                    bulk
                      ? "border-primary bg-brand-muted text-brand-muted-foreground hover:bg-brand-muted"
                      : undefined
                  }
                >
                  <ListChecksIcon data-icon="inline-start" aria-hidden />
                  {bulk ? "Exit bulk" : "Bulk"}
                </Button>
              ) : null}
              {/* The board's columns, as the advocate Cases list offers them. */}
              <CauseListColumnsMenu state={columnState} />
              <CourtSortSelect
                id="hearings-sort"
                value={sort}
                options={sortOptions(HEARING_SORTS)}
                onChange={(next) => {
                  setSort(next);
                  setPage(1);
                }}
              />
            </>
          }
        />

        {/* Mounted whatever the list is doing, including empty — see `QueueAnnouncer`. */}
        <QueueAnnouncer
          from={start + 1}
          to={start + pageRows.length}
          total={rows.length}
        />

        {pageRows.length === 0 ? (
          <HearingsEmpty
            day={activeDay}
            isFiltered={isFiltered}
            onClear={clearFilters}
          />
        ) : (
          <div className="flex min-w-0 flex-col gap-4">
            {/* min-w-0 lets this flex item shrink below the table's content width, so a
                wide table scrolls inside the panel instead of pushing the page sideways. */}
            <div className="min-w-0">
              {/* Seven or eight columns do not survive a phone. Below `md` the same rows
                  stack as items — the advocate list's own answer. `min-w-0` lets the
                  table's own scrollport shrink instead of blowing the page sideways. */}
              <div className="hidden min-w-0 md:block">
                <HearingsTable
                  rows={pageRows}
                  seat={seat}
                  columns={tableColumns}
                  onMoveColumn={columnState.move}
                  onShiftColumn={columnState.shift}
                  onOpenCase={openCase}
                  onStartHearing={startHearing}
                  onEndHearing={endHearing}
                  onPassOver={passOverHearing}
                  selection={
                    bulk
                      ? {
                          selected: bulkIds,
                          onToggle: toggleBulk,
                          all: bulkAll,
                          onToggleAll: toggleBulkAll,
                        }
                      : undefined
                  }
                />
              </div>
              <div className="md:hidden">
                <HearingsItemList
                  rows={pageRows}
                  seat={seat}
                  onOpenCase={openCase}
                  onStartHearing={startHearing}
                  onEndHearing={endHearing}
                  onPassOver={passOverHearing}
                  postsNextHearing={postsNextHearing}
                  selection={
                    bulk ? { selected: bulkIds, onToggle: toggleBulk } : undefined
                  }
                />
              </div>
            </div>

            {liveMessage ? (
              <p className="sr-only" aria-live="polite">
                {liveMessage}
              </p>
            ) : null}

            <ListFooter
              id="hearings-page-size"
              from={start + 1}
              to={start + pageRows.length}
              total={rows.length}
              page={currentPage}
              pageCount={pageCount}
              onPageChange={setPage}
              pageSize={pageSize}
              onPageSizeChange={(size) => {
                setPageSize(size);
                setPage(1);
              }}
            />
          </div>
        )}
      </div>

      {bulk ? (
        <CauseListBulkBar
          roles={bulkRoles}
          selected={bulkSelected}
          notice={bulkNotice}
          onNotice={setBulkNotice}
          onDone={() => setBulkIds(new Set())}
          pending={pendingOrders}
          signing={signing}
        />
      ) : null}

      {/* Focus goes back to the cause title that opened it — the only thing that opens
          it now. Radix restores that; nothing here has to. */}
      <HearingOverviewDialog
        hearing={openHearing}
        seat={seat}
        /* The same two handlers the row presses, so a sitting called from the overlay
           and one called from the row are one act with one set of marks — including
           the announcement, which the overlay makes again inside itself because a
           modal hides this screen's announcer from assistive tech.
           Neither handler opens anything, which is what lets them be shared: pressed
           from in here the overlay is already open and stays open, and pressed from the
           row it does not open. */
        onStartHearing={startHearing}
        onEndHearing={endHearing}
        postsNextHearing={postsNextHearing}
        onOpenChange={(open) => {
          if (!open) setOpenHearingId(null);
        }}
      />
    </div>
  );
}

/**
 * The filter row: search inline, everything else behind a Filters button (owner,
 * 2026-09-15 — the advocate Cases pattern). The free text filters live where it is typed;
 * Purpose and the hearing date fold into a right-hand sheet (status moved to the pills
 * heading the row, 2026-10-12), and what is applied is
 * spelled out in removable chips on the row, so the folded controls never hide a narrowed
 * list. The court-level action (`JoinVideoCourt`) stays in the page header, not here.
 */
function HearingsFilters({
  leading,
  searchRef,
  filters,
  advocates,
  onChange,
  day,
  today,
  onDayChange,
  onClearDay,
  onClear,
  trailing,
  nextHearingColumn,
}: {
  /** Whether Next hearing is a column for this person — its filter goes with it. */
  nextHearingColumn: boolean;
  /** The view's status pills, on a row above the filters. */
  leading: React.ReactNode;
  searchRef: React.RefObject<HTMLInputElement | null>;
  filters: HearingFilters;
  /** Every advocate on the day's list, for the Advocate filter. */
  advocates: string[];
  /** Merge a change into the filters — a patch, not a whole set. */
  onChange: (patch: Partial<HearingFilters>) => void;
  /** The day in view, already resolved to today when none is picked. */
  day: string;
  today: string;
  onDayChange: (day: string) => void;
  onClearDay: () => void;
  onClear: () => void;
  /** The list's sort control (`CourtSortSelect`), at the end of the row. */
  trailing?: React.ReactNode;
}) {
  /* The pills take a row of their own above the filters: sharing one, the last pill
     was clipped off the end at desktop width once there were five of them. */
  return (
    <div className="flex min-w-0 flex-col gap-4">
      {leading}
      <CourtFilters
        searchRef={searchRef}
        search={{
          label: "Search cases",
          value: filters.query,
          onChange: (query) => onChange({ query }),
          placeholder: "Case name or number",
        }}
        fields={[]}
        /* Every one takes several values, as a multi-select dropdown (owner, 2026-10-15). */
        multi={[
          {
            id: "hearings-status",
            label: "Status",
            values: filters.statuses,
            placeholder: "All statuses",
            options: CAUSE_LIST_STATUS_ORDER.map((status) => ({
              value: status,
              label: statusWord(status),
            })),
            onApply: (values) =>
              onChange({ statuses: values as HearingFilters["statuses"] }),
          },
          {
            id: "hearings-advocate",
            label: "Advocate",
            values: filters.advocates,
            options: advocates.map((name) => ({ value: name, label: name })),
            placeholder: "All advocates",
            onApply: (values) => onChange({ advocates: values }),
          },
          {
            id: "hearings-stage",
            label: "Case stage",
            values: filters.stages,
            placeholder: "All stages",
            options: COURT_CASE_STAGES.map((stage) => ({
              value: stage.id,
              label: stage.label,
            })),
            onApply: (values) =>
              onChange({ stages: values as HearingFilters["stages"] }),
          },
          {
            id: "hearings-purpose",
            label: "Purpose",
            values: filters.purposes,
            placeholder: "All purposes",
            options: COURT_HEARING_PURPOSES.map((purpose) => ({
              value: purpose.id,
              label: purpose.label,
            })),
            onApply: (values) =>
              onChange({ purposes: values as HearingFilters["purposes"] }),
          },
          {
            id: "hearings-orders",
            label: "Orders",
            values: filters.orders,
            placeholder: "All orders",
            options: LISTING_ORDER_MARKS.map((mark) => ({
              value: mark.id,
              label: mark.label,
            })),
            onApply: (values) =>
              onChange({ orders: values as HearingFilters["orders"] }),
          },
          ...(nextHearingColumn
            ? [
                {
                  id: "hearings-next-hearing",
                  label: "Next hearing",
                  values: filters.nextHearing,
                  placeholder: "Set or not",
                  options: NEXT_HEARING_MARKS.map((mark) => ({
                    value: mark.id,
                    label: mark.label,
                  })),
                  onApply: (values: string[]) =>
                    onChange({
                      nextHearing: values as HearingFilters["nextHearing"],
                    }),
                },
              ]
            : []),
        ]}
        date={{
          label: "Hearing date",
          value: parseIsoDay(day),
          active: day !== today,
          chipLabel: formatCourtDay(day),
          draftActive: (value) => !!value && isoDay(value) !== today,
          cleared: parseIsoDay(today),
          onApply: (value) => {
            if (value && isoDay(value) !== today) onDayChange(isoDay(value));
            else onClearDay();
          },
        }}
        trailing={trailing}
        onClearAll={onClear}
      />
    </div>
  );
}

/**
 * The court's own action, in the page header beside the title.
 *
 * It belongs to the page, not to the list: joining the video court acts on the sitting
 * itself, so its scope is the screen and its home is the page chrome (ui-craft §0 —
 * placement encodes scope). Sat on the filter row it had no natural width, and once the
 * labelled filters filled that row it wrapped underneath them and read as a fifth filter.
 * The header also keeps it visible without scrolling past the controls.
 *
 * It is the screen's single teal action, and it is `aria-disabled` with a tooltip that
 * says why: video conferencing is not available yet. Primary paint still marks the
 * court-level act; the disabled state keeps the promise honest.
 */
function JoinVideoCourt() {
  return (
    <TooltipProvider delayDuration={300}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button aria-disabled className="w-full shrink-0 sm:w-fit">
            <VideoIcon data-icon="inline-start" aria-hidden />
            Join VC
          </Button>
        </TooltipTrigger>
        <TooltipContent>Not available yet</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

/**
 * Why the list is empty, and what to do about it.
 *
 * Two different facts, so two different states: a day the court has no listing for is not
 * the same as a filter that matched nothing, and only the second one has an action worth
 * offering. Borderless and unpadded — the panel around it is already the frame.
 */
function HearingsEmpty({
  day,
  isFiltered,
  onClear,
}: {
  day: string;
  isFiltered: boolean;
  onClear: () => void;
}) {
  return (
    <Empty className="border-0 p-0">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          {isFiltered ? (
            <SearchXIcon aria-hidden />
          ) : (
            <CalendarX2Icon aria-hidden />
          )}
        </EmptyMedia>
        <EmptyTitle className="text-title-s font-semibold">
          {isFiltered ? "No matters match these filters" : "Nothing listed"}
        </EmptyTitle>
        <EmptyDescription className="text-body">
          {isFiltered
            ? "No matter on this day's list matches the filters or search you chose."
            : `This court has no hearings listed for ${formatCourtDay(day)}.`}
        </EmptyDescription>
      </EmptyHeader>
      {isFiltered ? (
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
 * The same rows below `md`, stacked.
 *
 * A cause list read on a phone is still the court's serial, the cause, and where it
 * stands — the columns that only support scanning (counsel, purpose) drop to a caption
 * line rather than forcing a seven-column table through a 375px screen.
 */
function HearingsItemList({
  rows,
  seat,
  onOpenCase,
  onStartHearing,
  onEndHearing,
  onPassOver,
  onOpenOrder,
  postsNextHearing,
  selection,
}: {
  rows: CourtHearing[];
  seat: CourtRole;
  onOpenCase: (hearing: CourtHearing) => void;
  onStartHearing: (hearing: CourtHearing) => void;
  onEndHearing: (hearing: CourtHearing) => void;
  onPassOver: (hearing: CourtHearing) => void;
  postsNextHearing: boolean;
  /** Bulk mode: a checkbox at the head of each item. */
  selection?: { selected: ReadonlySet<string>; onToggle: (id: string) => void };
  /** Optional, and unsupplied: see the note where `openOrder` used to be. */
  onOpenOrder?: (hearing: CourtHearing) => void;
}) {
  return (
    <ul className="flex flex-col gap-3">
      {rows.map((hearing) => {
        const complainant = counselFor(hearing, "complainant");
        const accused = counselFor(hearing, "accused");
        return (
          <QueueItemRow key={hearing.id} className="flex flex-col gap-2">
            {/* The serial and the cause stay one reading — a block opener would orphan
                the number on a line of its own. It is a flex row rather than inline
                flow because the opener is now a button, and a button does not flow
                between words the way an anchor's text did: the row keeps the number
                at the left and lets the cause wrap beside it. `min-h-0` drops the
                40×40 floor `rowOpenerClass` sets for the table cell — on a phone the
                whole item is the target (`rowActivation`), and a 40px box here would
                only lift the title off the number's baseline. */}
            <p className="flex min-w-0 items-baseline gap-1 text-body-compact font-medium">
              {selection ? (
                <Checkbox
                  className="mr-2 self-center"
                  checked={selection.selected.has(hearing.id)}
                  onCheckedChange={() => selection.onToggle(hearing.id)}
                  aria-label={`Select item ${hearing.item}, ${causeTitle(hearing)}`}
                />
              ) : null}
              <span className="shrink-0 text-muted-foreground tabular-nums">
                {hearing.item}.
              </span>
              <HearingCaseButton
                hearing={hearing}
                onOpen={onOpenCase}
                className="min-h-0 w-fit"
              />
            </p>
            <Badge
              variant={courtHearingStatusVariant(hearing.status)}
              className="w-fit"
            >
              {courtHearingStatusLabel(hearing.status)}
            </Badge>
            <p className="text-caption text-muted-foreground">
              <Identifier value={hearing.caseNumber} label="case number" /> ·{" "}
              {courtHearingPurposeLabel(hearing.purpose)}
            </p>
            {/* Comfortable, not dense: on a phone the +N chip gets the full 40×40
                target, and a tap opens the same list the pointer hover does. */}
            <CounselCell
              complainant={complainant.map((counsel) => counsel.name)}
              accused={accused.map((counsel) => counsel.name)}
            />
            <HearingRowActions
              hearing={hearing}
              seat={seat}
              onStartHearing={onStartHearing}
              onEndHearing={onEndHearing}
              onPassOver={onPassOver}
              onOpenOrder={onOpenOrder}
              postsNextHearing={postsNextHearing}
            />
          </QueueItemRow>
        );
      })}
    </ul>
  );
}

/**
 * A view's statuses as a single-select pill row, All first — the pending-tasks row
 * (`chrome/pill-plate.ts`) the sign process already uses. Counts are what each pill holds
 * before search or filters; an empty status cannot narrow anything, so it is disabled
 * unless it is the one chosen.
 */
function StatusPills({
  label,
  value,
  onChange,
  total,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  total: number;
  options: { value: string; label: string; count: number; hint?: string }[];
}) {
  return (
    <TooltipProvider delayDuration={300}>
      <ToggleGroup
        type="single"
        size="lg"
        variant="default"
        value={value}
        onValueChange={(next) => {
          if (next) onChange(next);
        }}
        aria-label={label}
        className={PILL_ROW}
      >
        <Pill value="all" label="All" count={total} />
        {options.map((option) => (
          <Pill
            key={option.value}
            value={option.value}
            label={option.label}
            count={option.count}
            hint={option.hint}
            disabled={option.count === 0 && value !== option.value}
          />
        ))}
      </ToggleGroup>
    </TooltipProvider>
  );
}

function Pill({
  value,
  label,
  count,
  hint,
  disabled,
}: {
  value: string;
  label: string;
  count: number;
  hint?: string;
  disabled?: boolean;
}) {
  const item = (
    <ToggleGroupItem
      value={value}
      disabled={disabled}
      aria-label={`${label}, ${count}`}
      className={PILL_ITEM}
    >
      <span>{label}</span>
      <span aria-hidden className={PILL_COUNT}>
        {count}
      </span>
    </ToggleGroupItem>
  );
  if (!hint) return item;
  return (
    <Tooltip>
      {/* A wrapper, not the pill: Radix writes its own `data-state` onto the trigger,
          which would overwrite the pill's `on` — the sign process' note. */}
      <TooltipTrigger asChild>
        <span className="inline-flex">{item}</span>
      </TooltipTrigger>
      <TooltipContent side="bottom">{hint}</TooltipContent>
    </Tooltip>
  );
}
