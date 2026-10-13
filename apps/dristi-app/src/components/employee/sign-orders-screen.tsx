"use client";

import * as React from "react";
import Link from "next/link";
import { FilePenLineIcon, FileSignatureIcon, SearchXIcon } from "lucide-react";

import { CounselCell } from "@/components/employee/counsel-cell";
import { DraftOrdersTable } from "@/components/employee/draft-orders-table";
import { ListFooter } from "@/components/employee/list-footer";
import { QueueAnnouncer } from "@/components/employee/queue-announcer";
import { SignBulkConfirmDialog } from "@/components/employee/sign-bulk-confirm-dialog";
import { SignOrderDialog } from "@/components/employee/sign-order-dialog";
import { SignOrdersTable } from "@/components/employee/sign-orders-table";
import { useCourtRole } from "@/components/employee/use-court-role";
import { useCourtToday } from "@/components/employee/use-court-today";
import { useHearingSession } from "@/components/employee/use-hearing-session";
import { useOrderDrafts } from "@/components/employee/use-order-draft";
import {
  rowOpener,
  rowOpenerClass,
} from "@/lib/employee/row-activation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  draftOrderHref,
  draftOrdersForSitting,
} from "@/lib/employee/draft-orders";
import {
  causeTitle,
  counselFor,
  courtHearingPurposeLabel,
  courtHearingStatusLabel,
  courtHearingStatusVariant,
  hearingsForDay,
  formatListingDate,
  isoDay,
  parseIsoDay,
  withHearingSession,
  PAGE_SIZE,
  type CourtHearing,
  type HearingsPageSize,
} from "@/lib/employee/hearings";
import {
  DEFAULT_SIGN_ORDER_FILTERS,
  SIGN_ORDER_QUEUE,
  SIGN_ORDER_STATUSES,
  SIGN_ORDER_TYPES,
  filterSignOrders,
  formatSignOrderDate,
  signOrderStatusLabel,
  signOrderTypeLabel,
  signSelectedOrders,
  todayIsoDay,
  type SignOrder,
  type SignOrderFilters,
} from "@/lib/employee/sign-orders";
import { cn } from "@/lib/utils";
import { Identifier } from "@/components/chrome/identifier";
import { QueueItemRow } from "@/components/employee/queue-item-row";
import {
  CourtFilters,
  CourtSortSelect,
  type CourtFilterField,
} from "@/components/employee/court-filters";
import {
  caseSorts,
  daySorts,
  sortOptions,
  sortRows,
  type CourtSortSpec,
} from "@/lib/employee/court-sort";
import {
  applyColumnFilters,
  columnFilterFields,
  emptyColumnFilters,
  hasColumnFilters,
  type ColumnFilter,
} from "@/lib/employee/court-column-filters";
import { useCourtText } from "@/components/court/court-provider";

const SIGN_ORDER_COLUMN_FILTERS: ColumnFilter<SignOrder>[] = [
  {
    id: "sign-orders-type",
    label: "Order type",
    allLabel: "All order types",
    options: SIGN_ORDER_TYPES.map((type) => ({ value: type.id, label: type.label })),
    test: (row, value) => row.type === value,
  },
];

type SignOrderSort = "oldest" | "newest" | "name";

/** Oldest first, by the day each order was added — what has waited longest to be signed. */
const SIGN_ORDER_SORTS: CourtSortSpec<SignOrder, SignOrderSort>[] = [
  ...daySorts<SignOrder, SignOrderSort>(
    (row) => row.addedOn,
    { id: "oldest", label: "Oldest first", latest: false },
    { id: "newest", label: "Newest first" },
  ),
  caseSorts<SignOrder>()[2] as CourtSortSpec<SignOrder, SignOrderSort>,
];

function plural(count: number, one: string, many: string): string {
  return count === 1 ? one : many;
}

/**
 * Sign orders — the orders this bench has drawn up and not yet signed.
 *
 * Deliberately the same screen as the signing queue for forms one row above it in the
 * rail, and as the three review queues before that: the page title stands on the page,
 * and **one** lifted panel holds the filters, the table and the pagination footer
 * together. Same panel recipe, same `gap-6` / `p-6`, same table treatment, same empty
 * states, literally the same footer component. A bench moving between the rail's rows is
 * looking at one court's work through several windows, and should not have to re-learn
 * the furniture in between.
 *
 * What this screen adds is the act. Signing is the one court-side job the reference does
 * in bulk, so selection lives in the table and the commit lives in a sticky bar — the
 * shape `BulkRescheduleScreen` already established for an act committed once over a list
 * longer than a screen. Clicking a row (the case name, or anywhere but the checkbox)
 * opens the order first, the way Sign forms does, because a bench that cannot read what
 * it is signing should not be offered a signature. Sign and publish then asks how — e-sign
 * or upload — the same second step the forms queue already runs.
 *
 * The status filter opens on Pending signature, as the reference draws it: the bench
 * comes here to clear work. Signed orders stay reachable through the same filter rather
 * than disappearing, so an order signed last month can be read without leaving.
 *
 * **Two tabs, because an order has a life before this queue** (owner, 2026-09-16). What
 * is waiting for a signature is only half of what the bench has drawn up: the other half
 * is being written at today's sitting, in the order composer, and until now it was
 * reachable only by going back to the cause list and finding the right row. So the screen
 * splits — the signing queue it has always been, and the day's open drafts beside it —
 * and opens on the queue, because that is what the rail sends the bench here for.
 *
 * The strip is composed the way `SignProcessScreen` composes its stages one row below in
 * the rail, and for the same reason: the tab is the *screen's* question, so it stands
 * above the panel and each tab's panel holds its own controls. Nothing above the strip
 * moves when the tab changes but the line that describes it, and no control is left
 * standing over a list it cannot narrow — the status filter belongs to the signing queue
 * and there is nothing for it to say about a draft.
 *
 * **Nothing is signed, published or sent.** Both signing paths only move a row's status
 * in the demo queue (`lib/employee/sign-orders.ts`), and the drafts tab lists work in
 * progress without acting on it — the way to finish a draft is the composer it came from
 * (`lib/employee/draft-orders.ts`).
 */
export function SignOrdersScreen() {
  /* The queue is state because signing changes it. One list, so the table, the rail
     count on the next render and the bar can never disagree about what is still
     pending. */
  const [orders, setOrders] = React.useState<SignOrder[]>(SIGN_ORDER_QUEUE);
  /* One state, not a draft and an applied one: the list answers the controls as they
     are used — every one of them, so the screen has a single rule rather than a live
     one and a deferred one. Every change resets to page one; the old Search button did
     that, and a keystroke that narrows the list to four rows must not leave the reader
     on page three of nothing. */
  const [filters, setFilters] = React.useState<SignOrderFilters>(
    DEFAULT_SIGN_ORDER_FILTERS,
  );
  const [pageSize, setPageSize] = React.useState<HearingsPageSize>(PAGE_SIZE);
  const [page, setPage] = React.useState(1);
  const [selectedIds, setSelectedIds] = React.useState<ReadonlySet<string>>(
    () => new Set(),
  );
  const [open, setOpen] = React.useState<SignOrder | null>(null);
  const [bulkOpen, setBulkOpen] = React.useState(false);
  const [notice, setNotice] = React.useState("");
  const searchRef = React.useRef<HTMLInputElement>(null);
  /* The bulk confirmation hands focus back here on the way out — see its `triggerRef`. */
  const signRef = React.useRef<HTMLButtonElement>(null);

  /**
   * Which list is on screen.
   *
   * **The signing queue is the default and the work; the drafts are the day's other
   * half** (owner, 2026-09-16). The rail sends the bench here with a count of orders
   * waiting for a signature, so that is what the screen opens on — a tab that landed on
   * today's drafts would answer a question the rail did not ask.
   */
  const [tab, setTab] = React.useState<"pending" | "drafts">("pending");

  /**
   * The orders drawn up at today's sitting and not yet sent for signature.
   *
   * Derived from the day's own board rather than held as a list, so this tab and the
   * cause list cannot disagree about which matters have an order on them — the rule for
   * that is one function, in `lib/employee/draft-orders.ts`. The three stores it reads
   * are the same three the cause list reads: the reader's day, this sitting's marks, and
   * the composer's own text.
   */
  const today = useCourtToday();
  const seat = useCourtRole();
  const session = useHearingSession();
  const orderDrafts = useOrderDrafts();
  const draftRows = draftOrdersForSitting(
    withHearingSession(hearingsForDay(today, today), session),
    orderDrafts,
  );

  const pending = orders.filter(
    (order) => order.status === "pending-signature",
  );
  const [columns, setColumns] = React.useState(() =>
    emptyColumnFilters(SIGN_ORDER_COLUMN_FILTERS),
  );
  const [sort, setSort] = React.useState<SignOrderSort>("oldest");

  const rows = sortRows(
    applyColumnFilters(filterSignOrders(orders, filters), SIGN_ORDER_COLUMN_FILTERS, columns),
    SIGN_ORDER_SORTS,
    sort,
  );

  const pageCount = Math.max(1, Math.ceil(rows.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const start = (currentPage - 1) * pageSize;
  const pageRows = rows.slice(start, start + pageSize);
  const isFiltered =
    filters.status !== DEFAULT_SIGN_ORDER_FILTERS.status ||
    filters.addedOn !== "" ||
    filters.query !== "" ||
    hasColumnFilters(columns);

  /* What the bar will actually sign: the selection, minus anything that has since been
     signed or filtered out of existence. A stale id is dropped rather than counted. */
  const selected = pending.filter((order) => selectedIds.has(order.id));
  const signableInView = pageRows.filter(
    (order) => order.status === "pending-signature",
  ).length;

  function changeFilters(next: SignOrderFilters) {
    setFilters(next);
    setPage(1);
  }

  function clearFilters() {
    setColumns(emptyColumnFilters(SIGN_ORDER_COLUMN_FILTERS));
    changeFilters(DEFAULT_SIGN_ORDER_FILTERS);
  }

  function toggle(order: SignOrder) {
    setNotice("");
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(order.id)) next.delete(order.id);
      else next.add(order.id);
      return next;
    });
  }

  /** The header checkbox: every signable row in view, or none of them. */
  function toggleAllInView(select: boolean) {
    setNotice("");
    setSelectedIds((current) => {
      const next = new Set(current);
      for (const order of pageRows) {
        if (order.status !== "pending-signature") continue;
        if (select) next.add(order.id);
        else next.delete(order.id);
      }
      return next;
    });
  }

  /**
   * The act, from either path. It marks the orders signed in this demo queue, clears the
   * selection it consumed and says what it did — nothing leaves the browser.
   */
  function sign(ids: ReadonlySet<string>) {
    const count = orders.filter(
      (order) => ids.has(order.id) && order.status === "pending-signature",
    ).length;
    if (count === 0) return;
    setOrders((current) => signSelectedOrders(current, ids, todayIsoDay()));
    setSelectedIds((current) => {
      const next = new Set(current);
      for (const id of ids) next.delete(id);
      return next;
    });
    setNotice(
      `${count} ${plural(count, "order is", "orders are")} marked signed on this screen. Nothing was published.`,
    );
  }

  function returnFocus() {
    searchRef.current?.focus();
  }

  return (
    <div className="flex min-w-0 flex-1 flex-col gap-8 p-6 md:p-8">
      <header className="flex flex-col gap-2">
        <h1 className="text-title text-balance font-semibold">
          Sign orders
        </h1>
        {/* The count is the whole point of the queue, so the supporting line carries it
            rather than restating the title. Singular is spelled out because "1 orders"
            is the kind of thing a court notices.

            **The line belongs to the tab, not to the page** — the same call
            `SignProcessScreen` makes for the same reason: what is worth saying under the
            title is how much work is standing in the list the bench is actually looking
            at, and that sentence is a different one on each tab. */}
        <p className="text-body text-muted-foreground">
          {tab === "pending"
            ? pending.length === 1
              ? "1 order is waiting for your signature."
              : `${pending.length} orders are waiting for your signature.`
            : draftRows.length === 1
              ? "1 order from today's sitting has not been sent for signature."
              : `${draftRows.length} orders from today's sitting have not been sent for signature.`}
        </p>
      </header>

      {/* One panel: the filters, the two lists and the pagination are one unit of work,
          so they share one lifted sheet — the same recipe every other court-side queue
          uses, and the tab strip sits **inside** it, under the filters, exactly where
          bulk reschedule puts its own (owner, 2026-09-16). Nothing inside draws a second
          frame. */}
      <section className="flex min-w-0 flex-col gap-6 rounded-xl border border-hairline bg-card shadow-raised p-6">
        {/* The controls sit above the tab strip, where they read as this panel's — and
            **they narrow the signing queue only.** That is the same scope bulk reschedule
            gives its own range: a status, a date added and a case search are facts the
            queue carries, and the draft list is one day of this court's board, which none
            of them has anything to cut on. Chrome does not move when the content under it
            changes (ui-craft §2), so they stay put rather than appearing and disappearing
            with the tab. */}
        <SignOrderFiltersForm
          filters={filters}
          searchRef={searchRef}
          onChange={changeFilters}
          onClear={clearFilters}
          fields={columnFilterFields(SIGN_ORDER_COLUMN_FILTERS, columns, (id, value) => {
            setColumns((current) => ({ ...current, [id]: value }));
            setPage(1);
          })}
          trailing={
            <CourtSortSelect
              id="sign-orders-sort"
              value={sort}
              options={sortOptions(SIGN_ORDER_SORTS)}
              onChange={(next) => {
                setSort(next);
                setPage(1);
              }}
            />
          }
        />

        <Tabs
          value={tab}
          onValueChange={(value) => setTab(value as "pending" | "drafts")}
          className="flex min-w-0 flex-col gap-6"
        >
          {/* Line `TabsList`, not the pill track — the same composition bulk reschedule
              and the process queue both use for the same job, down to the
              `after:-bottom-px` that sits the mark on the gutter's own rule instead of
              floating a second line above it. Two labels fit a phone, but the row scrolls
              rather than crushing them (RESPONSIVE). */}
          <div className="overflow-x-auto border-b border-hairline">
            <TabsList
              variant="line"
              aria-label="Which orders to show"
              className="h-10 w-max min-w-full justify-start rounded-none p-0 group-data-horizontal/tabs:h-10"
            >
              {(
                [
                  ["pending", "Pending signature", pending.length],
                  ["drafts", "Draft orders", draftRows.length],
                ] as const
              ).map(([value, label, count]) => (
                <TabsTrigger
                  key={value}
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

          <TabsContent value="pending" className="min-w-0 outline-none">
            {/* Mounted whatever the list is doing, including empty — see
                `QueueAnnouncer`. One per tab, because switching tabs changes the answer
                and the inactive pane is unmounted. */}
            <QueueAnnouncer
              from={start + 1}
              to={start + pageRows.length}
              total={rows.length}
            />

            {pageRows.length === 0 ? (
              <SignOrdersEmpty isFiltered={isFiltered} onClear={clearFilters} />
            ) : (
              <div className="flex min-w-0 flex-col gap-4">
                {/* min-w-0 lets this flex item shrink below the table's content width, so
                    a wide table scrolls inside the panel instead of pushing the page
                    sideways. */}
                <div className="min-w-0 overflow-x-auto">
                  {/* Six columns do not survive a phone. Below `md` the same rows stack
                      as items — the answer the rest of the court side already gives. */}
                  <div className="hidden md:block">
                    <SignOrdersTable
                      rows={pageRows}
                      selectedIds={selectedIds}
                      onToggle={toggle}
                      onToggleAll={toggleAllInView}
                      onOpen={setOpen}
                    />
                  </div>
                  <div className="md:hidden">
                    <SignOrdersItemList
                      rows={pageRows}
                      selectedIds={selectedIds}
                      onToggle={toggle}
                      onOpen={setOpen}
                    />
                  </div>
                </div>

                <ListFooter
                  id="sign-orders-page-size"
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
          </TabsContent>

          <TabsContent
            value="drafts"
            className="flex min-w-0 flex-col gap-4 outline-none"
          >
            {/* Mounted whatever the list holds, including nothing — a live region has to
                be in the DOM before the change to be read out at all. */}
            <QueueAnnouncer
              from={1}
              to={draftRows.length}
              total={draftRows.length}
            />

            {draftRows.length === 0 ? (
              <DraftOrdersEmpty />
            ) : (
              /* No pager under it: this tab is one day of one court's board — twenty-three
                 listings at the outside, and only the ones with an order open — so a
                 footer would be paging a page that cannot fill. The same call bulk
                 reschedule makes about its own record. */
              <div className="min-w-0 overflow-x-auto">
                {/* Seven columns do not survive a phone. Below `md` the same rows stack
                    as items — today's cause list's own answer for the same table. */}
                <div className="hidden md:block">
                  <DraftOrdersTable rows={draftRows} seat={seat} />
                </div>
                <div className="md:hidden">
                  <DraftOrdersItemList rows={draftRows} />
                </div>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </section>

      {/* The bar belongs to one tab. It commits a selection, the drafts have none to
          make, and a sticky teal signature over a list of unfinished orders would be
          offering an act that list cannot perform — the same call bulk reschedule makes
          about its own commit bar. */}
      {tab === "pending" && (selected.length > 0 || signableInView > 0) ? (
        <SignBar
          count={selected.length}
          notice={notice}
          onRequestSign={() => setBulkOpen(true)}
          signRef={signRef}
        />
      ) : null}

      {/* Confirm the count, then say what became of it — the shared bulk confirmation
          every signing queue runs. It hangs off the screen rather than off the bar,
          because signing the last signable row in view takes the bar away with it. */}
      <SignBulkConfirmDialog
        noun="order"
        count={selected.length}
        selection={{
          cases: selected.map((order) => order.caseNumber),
          kinds: selected.map((order) => signOrderTypeLabel(order.type)),
        }}
        open={bulkOpen}
        onOpenChange={setBulkOpen}
        triggerRef={signRef}
        onConfirm={() => sign(selectedIds)}
        onReturnFocus={returnFocus}
      />

      <SignOrderDialog
        order={open}
        onOpenChange={setOpen}
        onSign={(order) => {
          sign(new Set([order.id]));
          setOpen(null);
        }}
        onReturnFocus={returnFocus}
      />
    </div>
  );
}

/**
 * The court-side filter row (`CourtFilters`): the search, then status, order type and the
 * day it was added in the Filters sheet, with chips for what is applied, and the order on
 * the end of the row. Status opens on Pending signature, as the reference draws it, so its
 * chip shows from the start — the list *is* narrowed, and the chip says so.
 */
function SignOrderFiltersForm({
  filters,
  searchRef,
  onChange,
  onClear,
  fields,
  trailing,
}: {
  filters: SignOrderFilters;
  searchRef: React.RefObject<HTMLInputElement | null>;
  onChange: (filters: SignOrderFilters) => void;
  onClear: () => void;
  /** The screen's column filters, after Status. */
  fields: CourtFilterField[];
  /** The list's sort control (`CourtSortSelect`). */
  trailing: React.ReactNode;
}) {
  return (
    <CourtFilters
      search={{
        label: "Search cases",
        value: filters.query,
        onChange: (query) => onChange({ ...filters, query }),
        placeholder: "Case name or number",
      }}
      searchRef={searchRef}
      fields={[
        {
          id: "sign-orders-status",
          label: "Status",
          value: filters.status,
          all: "all",
          allLabel: "All statuses",
          options: SIGN_ORDER_STATUSES.map((status) => ({
            value: status.id,
            label: status.label,
          })),
          onApply: (value) =>
            onChange({ ...filters, status: value as SignOrderFilters["status"] }),
        },
        ...fields,
      ]}
      date={{
        label: "Date added",
        value: filters.addedOn ? parseIsoDay(filters.addedOn) : undefined,
        active: filters.addedOn !== "",
        chipLabel: filters.addedOn ? formatListingDate(filters.addedOn) : "",
        draftActive: (value) => !!value,
        cleared: undefined,
        onApply: (value) =>
          onChange({ ...filters, addedOn: value ? isoDay(value) : "" }),
      }}
      trailing={trailing}
      onClearAll={onClear}
    />
  );
}

/**
 * What is selected, and the act itself.
 *
 * Sticky, because the list it commits is longer than a screen and a button that scrolls
 * away from its own selection is a button the bench has to hunt for. Chrome, so it is
 * `bg-card` over a hairline seam and never carries the panel's full-strength edge
 * (ui-craft §4, layer 2); the negative margins let it span the page's own padding.
 * `z-30` is the chrome layer this app already uses — the top bar and the filing footer
 * both sit there.
 *
 * The line beside the button is `aria-live`, so a screen reader hears the selection
 * change, and what signing did, without going looking for either.
 */
function SignBar({
  count,
  notice,
  onRequestSign,
  signRef,
}: {
  count: number;
  notice: string;
  /** Opens the shared confirmation. The act itself lives on the screen. */
  onRequestSign: () => void;
  /** Handed down so the confirmation can give the keyboard back to this button. */
  signRef: React.Ref<HTMLButtonElement>;
}) {
  const summary =
    notice ||
    (count === 0
      ? "Select the orders to sign."
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
 * Why the list is empty, and what to do about it.
 *
 * Two different facts, so two different states: a filter that matched nothing is a dead
 * end with an action worth offering, while an empty pending queue is the bench being up
 * to date — the same good-empty the sibling queues use. Borderless and unpadded; the
 * panel is already the frame.
 */
function SignOrdersEmpty({
  isFiltered,
  onClear,
}: {
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
            <FileSignatureIcon aria-hidden />
          )}
        </EmptyMedia>
        <EmptyTitle className="text-title-s font-semibold">
          {isFiltered ? "No orders match these filters" : "Nothing to sign"}
        </EmptyTitle>
        <EmptyDescription className="text-body">
          {isFiltered
            ? "No order matches the status, date or search you asked for."
            : "Every order this court has drawn up has been signed."}
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
 * The checkbox and the opener stay separate controls here too, for the same reason they
 * do in the table: one tap cannot mean both. The checkbox takes the leading column at
 * its full 40px target, and a tap anywhere else on the card opens the order — the case
 * name is the keyboard button, matching Sign forms, with the title, number and date
 * under it spelled out because there is no column header to name them.
 */
function SignOrdersItemList({
  rows,
  selectedIds,
  onToggle,
  onOpen,
}: {
  rows: SignOrder[];
  selectedIds: ReadonlySet<string>;
  onToggle: (order: SignOrder) => void;
  onOpen: (order: SignOrder) => void;
}) {
  const courtText = useCourtText();
  return (
    <ul className="flex flex-col gap-3">
      {rows.map((order) => {
        const pending = order.status === "pending-signature";
        const title = signOrderTypeLabel(order.type);
        return (
          <QueueItemRow key={order.id} className="flex gap-3">
            {/* The DS box expands its own hit area to 40×40; the name it carries is the
                order and its case, not the column, because a row read aloud has no
                column header. A signed order has nothing to select. */}
            {pending ? (
              <span className="pt-0.5">
                <Checkbox
                  checked={selectedIds.has(order.id)}
                  onCheckedChange={() => onToggle(order)}
                  aria-label={`Select ${title} in ${courtText(order.caseNumber)}`}
                />
              </span>
            ) : (
              /* A signed order has nothing to select, but it keeps the box's width so
                 the titles down the list still start on one line. */
              <span className="size-4 shrink-0" aria-hidden />
            )}
            <div className="flex min-w-0 flex-1 flex-col gap-2">
              <button
                type="button"
                onClick={() => onOpen(order)}
                {...rowOpener}
                className={rowOpenerClass}
              >
                <span className="sr-only">
                  {pending ? "Read and sign " : "Read "}
                  {title} in{" "}
                </span>
                {causeTitle(order)}
              </button>
              <p className="min-w-0 text-body-compact">{title}</p>
              <p className="text-caption text-muted-foreground">
                <Identifier value={order.caseNumber} label="case number" />
                {" · Added "}
                <span className="tabular-nums">
                  {formatSignOrderDate(order.addedOn)}
                </span>
              </p>
              <Badge variant={pending ? "warning" : "success"} className="w-fit">
                {signOrderStatusLabel(order.status)}
              </Badge>
            </div>
          </QueueItemRow>
        );
      })}
    </ul>
  );
}

/**
 * The drafts tab with nothing on it — which is the ordinary state of a morning.
 *
 * One state, not two: there are no filters on this tab, so an empty list can only mean
 * that nothing has been drawn up yet. It says where orders come from and offers the trip
 * there, because the answer is on another screen — today's cause list — rather than on
 * this one. (Bulk reschedule's record refuses the equivalent button, correctly: there the
 * answer was the tab next door, and a button that only switched tabs would be a third
 * way to press a tab.)
 *
 * Borderless and unpadded; the panel is already the frame.
 */
function DraftOrdersEmpty() {
  return (
    <Empty className="border-0 p-0">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <FilePenLineIcon aria-hidden />
        </EmptyMedia>
        <EmptyTitle className="text-title-s font-semibold">
          No orders are being written
        </EmptyTitle>
        <EmptyDescription className="text-body">
          An order is drawn up at the sitting it belongs to. Orders you start on
          today&apos;s cause list appear here until they are sent for signature.
        </EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <Button asChild variant="outline">
          <Link href="/employee/hearings">Go to today&apos;s hearings</Link>
        </Button>
      </EmptyContent>
    </Empty>
  );
}

/**
 * The same draft rows below `md`, stacked.
 *
 * Today's cause list's own phone row, carrying the same facts the table above carries:
 * the serial and the cause on one reading, where the matter stands, who appears, and what
 * it was listed for. Seven columns do not survive 375px, and this is the shape the court
 * side already answers that with.
 *
 * The cause name is the opener here rather than the Orders control: there is no column
 * for a glyph to sit under on a phone, and the whole card opens the order in any case
 * (`rowActivation`). `min-h-0` drops the 40×40 floor `rowOpenerClass` sets for a table
 * cell — the card is the target, and a 40px box on a baseline row would only lift the
 * title off the number's baseline, which is the correction the cause list's phone row
 * already makes.
 */
function DraftOrdersItemList({ rows }: { rows: CourtHearing[] }) {
  return (
    <ul className="flex flex-col gap-3">
      {rows.map((hearing) => (
        <QueueItemRow key={hearing.id} className="flex min-w-0 flex-col gap-2">
          <p className="flex min-w-0 items-baseline gap-1 text-body-compact font-medium">
            <span className="shrink-0 text-muted-foreground tabular-nums">
              {hearing.item}.
            </span>
            <Link
              href={draftOrderHref(hearing)}
              {...rowOpener}
              className={cn(rowOpenerClass, "min-h-0 w-fit")}
            >
              <span className="sr-only">Open the order in </span>
              {causeTitle(hearing)}
            </Link>
          </p>
          <Badge
            variant={courtHearingStatusVariant(hearing.status)}
            className="w-fit"
          >
            {courtHearingStatusLabel(hearing.status)}
          </Badge>
          <CounselCell
            complainant={counselFor(hearing, "complainant").map(
              (counsel) => counsel.name,
            )}
            accused={counselFor(hearing, "accused").map(
              (counsel) => counsel.name,
            )}
          />
          <p className="text-caption text-muted-foreground">
            <Identifier value={hearing.caseNumber} label="case number" />
            {" · Listed for "}
            {courtHearingPurposeLabel(hearing.purpose)}
          </p>
        </QueueItemRow>
      ))}
    </ul>
  );
}
