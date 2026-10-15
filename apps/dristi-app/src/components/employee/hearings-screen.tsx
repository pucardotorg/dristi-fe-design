"use client";

import * as React from "react";
import {
  CalendarX2Icon,
  FilePenLineIcon,
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
  type BulkSeat,
} from "@/components/employee/cause-list-bulk";
import { usePendingOrders } from "@/components/employee/use-pending-orders";
import { Checkbox } from "@/components/ui/checkbox";
import {
  HearingOrdersItemList,
  HearingOrdersTable,
} from "@/components/employee/hearing-orders-table";
import { SignBulkConfirmDialog } from "@/components/employee/sign-bulk-confirm-dialog";
import { useOrderDrafts } from "@/components/employee/use-order-draft";
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
import { seatPostsNextHearing } from "@/lib/employee/court-role";
import {
  HEARING_ORDER_STATUSES,
  ordersForSitting,
  type HearingOrder,
  type HearingOrderStatus,
} from "@/lib/employee/hearing-orders";
import { markOrdersSigned } from "@/lib/employee/order-signing";
import { useOrderFlow } from "@/components/employee/use-order-flow";
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
  causeTitle,
  counselFor,
  courtHearingPurposeLabel,
  courtHearingStatusLabel,
  courtHearingStatusVariant,
  filterHearings,
  formatCourtDay,
  hearingsForDay,
  isoDay,
  parseIsoDay,
  COURT_CASE_STAGES,
  COURT_HEARING_PURPOSES,
  EMPTY_FILTERS,
  PAGE_SIZE,
  withHearingSession,
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
 * The Hearings view's status pills, in the owner's order (2026-10-12). "Not started" is
 * the pill's word for a scheduled listing — the row's chip still says Scheduled.
 */
const HEARING_PILLS: { id: TodaysCauseStatus; label: string }[] = [
  { id: "scheduled", label: "Not started" },
  { id: "passed-over", label: "Passed over" },
  { id: "completed", label: "Completed" },
  { id: "ongoing", label: "Ongoing" },
];

type ScreenView = "hearings" | "orders";
type OrderPill = HearingOrderStatus | "all";

/* Which view the bench last chose, held past the screen so Edit → composer → back lands
   on the Orders view it left from. Dies on a reload, like the sitting's other marks. */
let rememberedView: ScreenView = "hearings";
function rememberView(next: ScreenView) {
  rememberedView = next;
}

function plural(count: number, one: string, many: string): string {
  return count === 1 ? one : many;
}

/**
 * Today's hearings — the court's cause list for the day it is sitting.
 *
 * **Two views of the same day** (owner, 2026-10-12): the cause list, and the orders that
 * came out of it. A toggle in the header switches between them; inside each, pills
 * narrow by status — the sign process and pending-tasks row. On Orders, an order Ready to
 * sign can be selected and signed in bulk from here.
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

  const listed = withHearingSession(hearingsForDay(activeDay, today), session);
  const [sort, setSort] = React.useState<HearingSort>("item");

  const rows = sortRows(filterHearings(listed, filters), HEARING_SORTS, sort);

  /* The Orders view is Classic's (`order-flow.ts`). In the new flow orders have a row of
     their own, Pending orders, right below this one (owner, 2026-10-14). */
  const [flow] = useOrderFlow();
  const [chosenView, setViewState] = React.useState<ScreenView>(
    () => rememberedView,
  );
  const view: ScreenView = flow === "classic" ? chosenView : "hearings";
  /* Who enters the next hearing is a court setting (owner, 2026-10-15): the reader, on
     this board, or the steno, in order screen E. Classic keeps it in the order. */
  const postsNextHearing = useReaderPostsNextHearing();
  /* Which columns show, and in what order — this seat's own choice, opening on its
     default (`cause-list-columns.ts`). */
  const columnState = useCauseListColumns(seat, postsNextHearing);
  const tableColumns = shownColumns(columnState.columns);
  /* Bulk mode (owner, 2026-10-15): the reader, when the reader enters the next hearing,
     marks and posts many listings at once; the steno, in the Pending orders flow, adds
     one piece of text to many orders. Other seats have no bulk mode. */
  const bulkSeat: BulkSeat | null =
    view === "hearings" && postsNextHearing && seatPostsNextHearing(seat)
      ? "reader"
      : view === "hearings" && flow === "pending" && seat === "typist"
        ? "steno"
        : null;
  const [bulkOn, setBulkOn] = React.useState(false);
  const bulk = bulkSeat !== null && bulkOn;
  const [bulkIds, setBulkIds] = React.useState<ReadonlySet<string>>(
    () => new Set(),
  );
  const [bulkNotice, setBulkNotice] = React.useState("");
  const pendingOrders = usePendingOrders();
  function setView(next: ScreenView) {
    rememberView(next);
    setViewState(next);
    setSelectedIds(new Set());
    setNotice("");
  }

  /* The Orders view: the same board, read through the composer's two stores. The
     hearing status pill does not apply here — Orders has its own. */
  const drafts = useOrderDrafts();
  const signing = useOrderSigning();
  const [orderPill, setOrderPill] = React.useState<OrderPill>("all");
  const [selectedIds, setSelectedIds] = React.useState<ReadonlySet<string>>(
    () => new Set(),
  );
  const [bulkOpen, setBulkOpen] = React.useState(false);
  const [notice, setNotice] = React.useState("");
  const signRef = React.useRef<HTMLButtonElement>(null);
  const searchRef = React.useRef<HTMLInputElement>(null);

  const allOrders = ordersForSitting(listed, drafts, signing, today);
  const orderSortKey = new Map(
    sortRows(listed, HEARING_SORTS, sort).map((hearing, index) => [hearing.id, index]),
  );
  const orderRows = filterHearings(
    allOrders.map((order) => order.hearing),
    { ...filters, status: "all" },
  )
    .map((hearing) => allOrders.find((order) => order.hearing.id === hearing.id)!)
    .filter((order) => orderPill === "all" || order.status === orderPill)
    .sort(
      (a, b) =>
        (orderSortKey.get(a.hearing.id) ?? 0) - (orderSortKey.get(b.hearing.id) ?? 0),
    );
  const ordersReady = allOrders.filter((order) => order.status === "ready");
  const selectedOrders = ordersReady.filter((order) =>
    selectedIds.has(order.hearing.id),
  );
  const readyInView = orderRows.some((order) => order.status === "ready");

  function toggleOrder(order: HearingOrder) {
    setNotice("");
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(order.hearing.id)) next.delete(order.hearing.id);
      else next.add(order.hearing.id);
      return next;
    });
  }

  function toggleAllOrders(select: boolean) {
    setNotice("");
    setSelectedIds((current) => {
      const next = new Set(current);
      for (const order of orderRows) {
        if (order.status !== "ready") continue;
        if (select) next.add(order.hearing.id);
        else next.delete(order.hearing.id);
      }
      return next;
    });
  }

  /** Marks the selection signed in this sitting's store. Nothing is published. */
  function signOrders() {
    const ids = selectedOrders.map((order) => order.hearing.id);
    if (ids.length === 0) return;
    markOrdersSigned(ids);
    setSelectedIds(new Set());
    setNotice(
      `${ids.length} ${plural(ids.length, "order is", "orders are")} marked signed on this screen. Nothing was published.`,
    );
  }

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
    filters.status !== "all" ||
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
          {flow === "classic" ? (
            <ViewToggle
              value={view}
              onChange={setView}
              hearings={listed.length}
              orders={allOrders.length}
            />
          ) : null}
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
            view === "hearings" ? (
              <StatusPills
                label="Hearing status"
                value={filters.status}
                onChange={(status) =>
                  changeFilters({ status: status as HearingFilters["status"] })
                }
                total={listed.length}
                options={HEARING_PILLS.map((pill) => ({
                  value: pill.id,
                  label: pill.label,
                  count: listed.filter((hearing) => hearing.status === pill.id)
                    .length,
                }))}
              />
            ) : (
              <StatusPills
                label="Order status"
                value={orderPill}
                onChange={(next) => {
                  setOrderPill(next as OrderPill);
                  setSelectedIds(new Set());
                  setNotice("");
                }}
                total={allOrders.length}
                options={HEARING_ORDER_STATUSES.map((status) => ({
                  value: status.id,
                  label: status.pill,
                  hint: status.hint,
                  count: allOrders.filter((order) => order.status === status.id)
                    .length,
                }))}
              />
            )
          }
          filters={filters}
          advocates={advocatesOnList(listed)}
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
              {/* The board's columns, as the advocate Cases list offers them. Only on
                  the hearings view: the Orders view is its own table. */}
              {bulkSeat ? (
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
              {view === "hearings" ? (
                <CauseListColumnsMenu state={columnState} />
              ) : null}
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

        {view === "orders" ? (
          <>
            <QueueAnnouncer from={1} to={orderRows.length} total={orderRows.length} />
            {orderRows.length === 0 ? (
              <OrdersEmpty
                hasAny={allOrders.length > 0}
                onClear={() => {
                  setOrderPill("all");
                  clearFilters();
                }}
              />
            ) : (
              /* No pager: one day of one court's orders, and the bulk act picks across
                 the whole view — the Sign process rule. */
              <div className="min-w-0">
                <div className="hidden min-w-0 md:block">
                  <HearingOrdersTable
                    rows={orderRows}
                    selectedIds={selectedIds}
                    onToggle={toggleOrder}
                    onToggleAll={toggleAllOrders}
                  />
                </div>
                <div className="md:hidden">
                  <HearingOrdersItemList
                    rows={orderRows}
                    selectedIds={selectedIds}
                    onToggle={toggleOrder}
                  />
                </div>
              </div>
            )}
          </>
        ) : (
          <>
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
          </>
        )}
      </div>

      {bulk && bulkSeat ? (
        <CauseListBulkBar
          seat={bulkSeat}
          selected={bulkSelected}
          notice={bulkNotice}
          onNotice={setBulkNotice}
          onDone={() => setBulkIds(new Set())}
          pending={pendingOrders}
          signing={signing}
        />
      ) : null}

      {view === "orders" && (selectedOrders.length > 0 || readyInView || notice) ? (
        <SignBar
          count={selectedOrders.length}
          notice={notice}
          onRequestSign={() => setBulkOpen(true)}
          signRef={signRef}
        />
      ) : null}

      <SignBulkConfirmDialog
        noun="order"
        count={selectedOrders.length}
        selection={{
          cases: selectedOrders.map((order) => order.hearing.caseNumber),
        }}
        open={bulkOpen}
        onOpenChange={setBulkOpen}
        triggerRef={signRef}
        onConfirm={signOrders}
        onReturnFocus={() => searchRef.current?.focus()}
      />

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
}: {
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
            ? "No matter on this day's list matches the status, purpose or search you asked for."
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
 * Hearings or Orders — the screen's own question, so it stands in the page header beside
 * the court-level action rather than inside the panel it switches. A segmented
 * `ToggleGroup`: one tab stop, arrow keys between the two, and pressing the side already
 * chosen is ignored because the screen always shows one of them.
 */
function ViewToggle({
  value,
  onChange,
  hearings,
  orders,
}: {
  value: ScreenView;
  onChange: (view: ScreenView) => void;
  hearings: number;
  orders: number;
}) {
  return (
    <ToggleGroup
      type="single"
      variant="outline"
      size="lg"
      spacing={0}
      value={value}
      onValueChange={(next) => {
        if (next) onChange(next as ScreenView);
      }}
      aria-label="Show"
      className="w-full sm:w-fit"
    >
      {(
        [
          ["hearings", "Hearings", hearings],
          ["orders", "Orders", orders],
        ] as const
      ).map(([id, label, count]) => (
        <ToggleGroupItem
          key={id}
          value={id}
          aria-label={`${label}, ${count}`}
          className="h-10 flex-1 gap-2 px-4 data-[state=on]:bg-brand-muted data-[state=on]:font-semibold data-[state=on]:text-brand-muted-foreground sm:flex-none"
        >
          <span>{label}</span>
          <span aria-hidden className={PILL_COUNT}>
            {count}
          </span>
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
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

/**
 * What is selected, and the act — the Sign orders bar, on the Orders view only. Sticky,
 * because the list it commits can be longer than a screen; the line beside the button is
 * live, so the selection and the outcome are heard without going looking.
 */
function SignBar({
  count,
  notice,
  onRequestSign,
  signRef,
}: {
  count: number;
  notice: string;
  onRequestSign: () => void;
  signRef: React.Ref<HTMLButtonElement>;
}) {
  const summary =
    notice ||
    (count === 0
      ? "Select the orders ready to sign."
      : `${count} ${plural(count, "order", "orders")} selected.`);
  return (
    <div className="sticky bottom-0 z-30 -mx-6 -mb-6 border-t border-hairline bg-card px-6 py-3 md:-mx-8 md:-mb-8 md:px-8 md:py-4">
      <div className="flex flex-wrap items-center justify-end gap-3">
        <p
          className="mr-auto text-body-compact text-muted-foreground tabular-nums"
          aria-live="polite"
        >
          {summary}
        </p>
        <Button
          ref={signRef}
          type="button"
          disabled={count === 0}
          className="w-full sm:w-fit"
          onClick={onRequestSign}
        >
          {count > 0
            ? `Sign ${count} ${plural(count, "order", "orders")}`
            : "Sign selected orders"}
        </Button>
      </div>
    </div>
  );
}

/**
 * The Orders view with nothing in it. Two facts: no order has been started today — the
 * ordinary morning, answered by the Hearings view — or the pill and search matched none.
 */
function OrdersEmpty({
  hasAny,
  onClear,
}: {
  hasAny: boolean;
  onClear: () => void;
}) {
  return (
    <Empty className="border-0 p-0">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          {hasAny ? <SearchXIcon aria-hidden /> : <FilePenLineIcon aria-hidden />}
        </EmptyMedia>
        <EmptyTitle className="text-title-s font-semibold">
          {hasAny ? "No orders match" : "No orders yet"}
        </EmptyTitle>
        <EmptyDescription className="text-body">
          {hasAny
            ? "No order matches the status, purpose or search you asked for."
            : "An order is drawn up at the hearing it belongs to. Start a hearing and open its order, and it appears here."}
        </EmptyDescription>
      </EmptyHeader>
      {hasAny ? (
        <EmptyContent>
          <Button variant="outline" onClick={onClear}>
            Clear filters
          </Button>
        </EmptyContent>
      ) : null}
    </Empty>
  );
}
