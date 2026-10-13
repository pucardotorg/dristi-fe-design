"use client";

import * as React from "react";
import { SearchXIcon, UserCheckIcon } from "lucide-react";

import {
  CourtFilters,
  CourtSortSelect,
  type CourtFilterField,
} from "@/components/employee/court-filters";
import { ListFooter } from "@/components/employee/list-footer";
import { QueueAnnouncer } from "@/components/employee/queue-announcer";
import { QueueItemRow } from "@/components/employee/queue-item-row";
import { RegistrationDialog } from "@/components/employee/approve-registrations-dialog";
import {
  DecidedRegistrationsTable,
  RegistrationsTable,
  decidedOnLabel,
  waitClass,
} from "@/components/employee/approve-registrations-table";
import {
  rowActivation,
  rowOpener,
  rowOpenerClass,
} from "@/lib/employee/row-activation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import {
  PAGE_SIZE,
  formatListingDate,
  type HearingsPageSize,
} from "@/lib/employee/hearings";
import {
  ACCOUNT_TYPE_OPTIONS,
  DECIDED_REGISTRATIONS,
  DECIDED_SORTS,
  EMPTY_REGISTRATIONS_FILTERS,
  PENDING_SORTS,
  REGISTRATIONS_QUEUE,
  REQUEST_TYPE_OPTIONS,
  WAIT_OPTIONS,
  decisionDay,
  filterDecided,
  filterRegistrations,
  formatDaysWaitingSpoken,
  nextInQueue,
  registrationWaitTone,
  accountTypeVariant,
  roleLabel,
  sortDecided,
  sortPending,
  APPROVE_REGISTRATIONS_TITLE,
  type DecidedRegistration,
  type DecidedSort,
  type PendingSort,
  type RegistrationOutcome,
  type RegistrationRequest,
  type RegistrationsFilters,
} from "@/lib/employee/approve-registrations";
import { cn } from "@/lib/utils";
import { Identifier } from "@/components/chrome/identifier";

type RegistrationsTab = "pending" | RegistrationOutcome;

const TABS: { id: RegistrationsTab; label: string }[] = [
  { id: "pending", label: "Pending" },
  { id: "approved", label: "Approved" },
  { id: "rejected", label: "Rejected" },
];

/**
 * Approve registrations — the registration requests waiting on this court's scrutiny officer.
 *
 * Deliberately the same screen as its siblings in the rail: the page title stands on the
 * page, and **one** lifted panel holds the search, the table and the pagination footer
 * together. Same panel recipe, same `gap-6` / `p-6`, same table treatment, same empty
 * states, literally the same footer component. An officer moving from "Register cases" to
 * this row should not have to re-learn the furniture in between.
 *
 * What this screen adds is a decision taken **without leaving the list**. The legacy path
 * was row → Verify → a detail page → Accept → a confirmation → a success dialog → "Go to
 * home": six steps per request and a trip back to a home nobody asked for, at the
 * reference's own count of thirty-nine pending. Here the application number opens an
 * overlay, the officer decides in it, the row leaves, the overlay settles on what happened
 * and offers the next request — so a queue can be cleared without coming back to the list
 * — and when it closes the search box takes the focus back.
 *
 * **There is no bulk path, and that is the one place this screen breaks from its nearest
 * sibling.** `ApproveCopyApplicationScreen` clears its queue with checkboxes and a sticky
 * bar, because there the evidence is a document the court itself composed. Here the
 * evidence is a photograph of a Bar ID card, collected for the sole reason that a human
 * looks at it (handover `REG-14`), and the outcome is a credential: the person may then
 * act as an advocate on real §138 files. A control that let an officer clear thirty-nine
 * registrations without opening a single photograph would void the only identity check
 * the product has. Clearing the queue is therefore slow by construction.
 *
 * **Three tabs** (owner, 2026-10-07): Pending is the work; Approved and Rejected are the
 * record of it, read-only. A decision taken here moves the row from Pending to the tab it
 * belongs on, so the officer can see what they just did.
 *
 * **Nothing here is approved or refused.** Both paths move their rows between demo lists
 * and nothing else — see `lib/employee/approve-registrations.ts`. No account is opened, no
 * access is granted or withheld, no reason is sent, and nothing persists past a reload.
 */
export function ApproveRegistrationsScreen() {
  const [tab, setTab] = React.useState<RegistrationsTab>("pending");
  /* One state, filtered as typed; every change resets to page one, so a narrowed list
     never leaves the reader on page three of nothing. */
  const [filters, setFilters] = React.useState<RegistrationsFilters>(
    EMPTY_REGISTRATIONS_FILTERS,
  );
  const [pendingSort, setPendingSort] = React.useState<PendingSort>("longest");
  const [decidedSort, setDecidedSort] = React.useState<DecidedSort>("recent");
  const [pageSize, setPageSize] = React.useState<HearingsPageSize>(PAGE_SIZE);
  const [page, setPage] = React.useState(1);
  /* Decisions taken on this screen, newest first — they lead their tab. */
  const [decided, setDecided] = React.useState<DecidedRegistration[]>([]);
  const [open, setOpen] = React.useState<RegistrationRequest | null>(null);
  const [announcement, setAnnouncement] = React.useState("");
  const searchRef = React.useRef<HTMLInputElement>(null);

  const decidedIds = new Set(decided.map((entry) => entry.request.id));
  const remaining = REGISTRATIONS_QUEUE.filter(
    (request) => !decidedIds.has(request.id),
  );
  const pendingRows = sortPending(
    filterRegistrations(remaining, filters),
    pendingSort,
  );
  const record = [...decided, ...DECIDED_REGISTRATIONS];
  const decidedRows =
    tab === "pending"
      ? []
      : sortDecided(
          filterDecided(
            record.filter((entry) => entry.outcome === tab),
            filters,
          ),
          decidedSort,
        );

  const total = tab === "pending" ? pendingRows.length : decidedRows.length;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const currentPage = Math.min(page, pageCount);
  const start = (currentPage - 1) * pageSize;
  const pagePending = pendingRows.slice(start, start + pageSize);
  const pageDecided = decidedRows.slice(start, start + pageSize);
  const shown = tab === "pending" ? pagePending.length : pageDecided.length;
  const isFiltered =
    filters.query.trim() !== "" ||
    filters.accountType !== "all" ||
    (tab === "pending" &&
      (filters.requestType !== "all" ||
        filters.wait !== "all"));

  function changeFilters(next: Partial<RegistrationsFilters>) {
    setFilters((current) => ({ ...current, ...next }));
    setPage(1);
  }

  function clearFilters() {
    setFilters(EMPTY_REGISTRATIONS_FILTERS);
    setPage(1);
  }

  /* A tab is a different list: the search carries over (it is the same person being
     looked for), the pending-only filters reset so a hidden filter cannot narrow a tab
     that does not show it. */
  function changeTab(next: RegistrationsTab) {
    setTab(next);
    setFilters((current) => ({
      ...EMPTY_REGISTRATIONS_FILTERS,
      query: current.query,
      accountType: current.accountType,
    }));
    setPage(1);
  }

  function decide(entry: DecidedRegistration, spoken: string) {
    setDecided((current) => [entry, ...current]);
    setAnnouncement(spoken);
  }

  /* The overlay stays open through both: it ends on a settled stage that offers the next
     request, and the row has already left the list behind it. */
  function approveOne(request: RegistrationRequest) {
    decide(
      { request, outcome: "approved", daysAgo: 0 },
      `${request.fullName} approved on this screen and moved to Approved. No account was opened and nobody was told.`,
    );
  }

  function rejectOne(request: RegistrationRequest, reason: string) {
    decide(
      { request, outcome: "rejected", daysAgo: 0, reason },
      `${request.fullName} rejected on this screen and moved to Rejected. The reason was not sent to anyone.`,
    );
  }

  function returnFocus() {
    searchRef.current?.focus();
  }

  return (
    /* The beige canvas — the product default (owner, 2026-09-11; ui-craft §1.0). */
    <div className="flex min-w-0 flex-1 flex-col gap-8 p-6 md:p-8">
      <header className="flex flex-col gap-2">
        {/* `APPROVE_REGISTRATIONS_TITLE` is shared with the rail and the tab, so the
            three can never disagree. */}
        <h1 className="text-title text-balance font-semibold">
          {APPROVE_REGISTRATIONS_TITLE}
        </h1>
        <p className="text-body text-muted-foreground">
          {remaining.length === 1
            ? "1 registration is waiting for approval."
            : `${remaining.length} registrations are waiting for approval.`}
        </p>
      </header>

      <Tabs
        value={tab}
        onValueChange={(value) => changeTab(value as RegistrationsTab)}
        className="flex min-w-0 flex-col gap-6"
      >
        {/* Line TabsList: the mark sits on the gutter's own rule (`after:-bottom-px`). */}
        <div className="overflow-x-auto border-b border-hairline [scrollbar-width:none]">
          <TabsList
            variant="line"
            aria-label="Registrations"
            className="h-10 w-max min-w-full justify-start rounded-none p-0 group-data-horizontal/tabs:h-10"
          >
            {TABS.map((entry) => (
              <TabsTrigger
                key={entry.id}
                value={entry.id}
                className="h-10 flex-none gap-2 px-3 text-body-compact group-data-horizontal/tabs:after:-bottom-px"
              >
                {entry.label}
                {/* Counts mean work: only Pending carries one. */}
                {entry.id === "pending" ? (
                  <span className="font-normal tabular-nums">{remaining.length}</span>
                ) : null}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>

        {TABS.map((entry) => (
          <TabsContent key={entry.id} value={entry.id} className="min-w-0 outline-none">
            {entry.id !== tab ? null : (
              /* One panel: filters, list and footer are one unit of work. */
              <section className="flex min-w-0 flex-col gap-6 rounded-xl border border-hairline bg-card p-6 shadow-raised">
                <RegistrationFilters
                  tab={tab}
                  filters={filters}
                  searchRef={searchRef}
                  onChange={changeFilters}
                  onClear={clearFilters}
                  pendingSort={pendingSort}
                  onPendingSortChange={(next) => {
                    setPendingSort(next);
                    setPage(1);
                  }}
                  decidedSort={decidedSort}
                  onDecidedSortChange={(next) => {
                    setDecidedSort(next);
                    setPage(1);
                  }}
                />

                {/* Mounted whatever the list is doing, including empty — see `QueueAnnouncer`. */}
                <QueueAnnouncer from={start + 1} to={start + shown} total={total} />

                {shown === 0 ? (
                  <RegistrationsEmpty
                    tab={tab}
                    isFiltered={isFiltered}
                    onClear={clearFilters}
                  />
                ) : (
                  <div className="flex min-w-0 flex-col gap-4">
                    {/* The table swaps to stacked items below `xl`: measured on the render,
                        the columns first fit the panel around 1150px. */}
                    <div className="min-w-0 overflow-x-auto">
                      {tab === "pending" ? (
                        <>
                          <div className="hidden xl:block">
                            <RegistrationsTable rows={pagePending} onOpen={setOpen} />
                          </div>
                          <div className="xl:hidden">
                            <RegistrationItemList rows={pagePending} onOpen={setOpen} />
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="hidden xl:block">
                            <DecidedRegistrationsTable rows={pageDecided} outcome={tab} />
                          </div>
                          <div className="xl:hidden">
                            <DecidedItemList rows={pageDecided} outcome={tab} />
                          </div>
                        </>
                      )}
                    </div>

                    <ListFooter
                      id="approve-registrations-page-size"
                      from={start + 1}
                      to={start + shown}
                      total={total}
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
              </section>
            )}
          </TabsContent>
        ))}
      </Tabs>

      {/* What actually changed, for anyone not watching the list. */}
      <p aria-live="polite" className="sr-only">
        {announcement}
      </p>

      <RegistrationDialog
        request={open}
        next={open ? nextInQueue(pendingRows, open) : null}
        onOpenChange={setOpen}
        onApprove={approveOne}
        onReject={rejectOne}
        onNext={setOpen}
        onReturnFocus={returnFocus}
      />
    </div>
  );
}

/**
 * The court side's filter row (`CourtFilters`): search inline, the structured filters in
 * the Filters sheet with chips for what is applied, and the order at the end of the row.
 *
 * **Contextual by tab.** Pending is read by what needs a decision — account type, request
 * type and how long they have waited (the same bands the wait
 * column colours by). A decided request is no longer read by any of those but who it was,
 * so Approved and Rejected keep only the account type — one control, which `CourtFilters`
 * shows on the row rather than behind a button.
 */
function RegistrationFilters({
  tab,
  filters,
  searchRef,
  onChange,
  onClear,
  pendingSort,
  onPendingSortChange,
  decidedSort,
  onDecidedSortChange,
}: {
  tab: RegistrationsTab;
  filters: RegistrationsFilters;
  searchRef: React.Ref<HTMLInputElement>;
  onChange: (filters: Partial<RegistrationsFilters>) => void;
  onClear: () => void;
  pendingSort: PendingSort;
  onPendingSortChange: (sort: PendingSort) => void;
  decidedSort: DecidedSort;
  onDecidedSortChange: (sort: DecidedSort) => void;
}) {
  const fields: CourtFilterField[] = [
    {
      id: "registrations-account-type",
      label: "Account type",
      value: filters.accountType,
      all: "all",
      allLabel: "All account types",
      options: ACCOUNT_TYPE_OPTIONS,
      onApply: (value) =>
        onChange({ accountType: value as RegistrationsFilters["accountType"] }),
    },
  ];
  if (tab === "pending") {
    fields.push(
      {
        id: "registrations-request-type",
        label: "Request type",
        value: filters.requestType,
        all: "all",
        allLabel: "All request types",
        options: REQUEST_TYPE_OPTIONS,
        onApply: (value) =>
          onChange({ requestType: value as RegistrationsFilters["requestType"] }),
      },
      {
        id: "registrations-wait",
        label: "Waiting",
        value: filters.wait,
        all: "all",
        allLabel: "Any wait",
        options: WAIT_OPTIONS,
        onApply: (value) => onChange({ wait: value as RegistrationsFilters["wait"] }),
      },
    );
  }

  return (
    <CourtFilters
      search={{
        label: "Search registrations",
        value: filters.query,
        onChange: (query) => onChange({ query }),
        placeholder: "Name or registration number",
      }}
      searchRef={searchRef}
      fields={fields}
      trailing={
        tab === "pending" ? (
          <CourtSortSelect
            id="registrations-sort"
            value={pendingSort}
            options={PENDING_SORTS}
            onChange={onPendingSortChange}
          />
        ) : (
          <CourtSortSelect
            id="registrations-sort"
            value={decidedSort}
            options={DECIDED_SORTS}
            onChange={onDecidedSortChange}
          />
        )
      }
      onClearAll={onClear}
    />
  );
}

const EMPTY_COPY: Record<RegistrationsTab, { title: string; description: string }> = {
  pending: {
    title: "No registrations waiting",
    description: "Everyone who has applied to this court has been dealt with.",
  },
  approved: {
    title: "No approved registrations",
    description: "Registrations this court approves are listed here.",
  },
  rejected: {
    title: "No rejected registrations",
    description: "Registrations this court rejects are listed here until they are resubmitted.",
  },
};

/**
 * Why the list is empty, and what to do about it: a filter that matched nothing offers
 * its way back; an empty tab is simply the state of the office. Borderless and unpadded;
 * the panel is already the frame.
 */
function RegistrationsEmpty({
  tab,
  isFiltered,
  onClear,
}: {
  tab: RegistrationsTab;
  isFiltered: boolean;
  onClear: () => void;
}) {
  return (
    <Empty className="border-0 p-0">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          {isFiltered ? <SearchXIcon aria-hidden /> : <UserCheckIcon aria-hidden />}
        </EmptyMedia>
        <EmptyTitle className="text-title-s font-semibold">
          {isFiltered ? "No registrations match" : EMPTY_COPY[tab].title}
        </EmptyTitle>
        <EmptyDescription className="text-body">
          {isFiltered
            ? "Nothing on this tab matches the search and filters you have applied."
            : EMPTY_COPY[tab].description}
        </EmptyDescription>
      </EmptyHeader>
      {isFiltered ? (
        <EmptyContent>
          <Button variant="outline" onClick={onClear}>
            Clear all
          </Button>
        </EmptyContent>
      ) : null}
    </Empty>
  );
}

/**
 * The same rows below `xl`, stacked. The column headers are gone, so each fact is spelled
 * out where the header would have said it — "19 days waiting", not "19".
 */
function RegistrationItemList({
  rows,
  onOpen,
}: {
  rows: RegistrationRequest[];
  onOpen: (request: RegistrationRequest) => void;
}) {
  return (
    <ul className="flex flex-col gap-3">
      {rows.map((request) => (
        <li
          key={request.id}
          {...rowActivation(
            "flex flex-col gap-2 rounded-lg bg-surface-sunken p-4 transition-colors hover:bg-accent-strong",
          )}
        >
          <button
            type="button"
            onClick={() => onOpen(request)}
            {...rowOpener}
            className={rowOpenerClass}
          >
            <span className="sr-only">Review </span>
            <span lang={request.fullNameLang}>{request.fullName}</span>
          </button>
          <div className="flex flex-wrap items-center gap-2 text-caption text-muted-foreground">
            <Badge variant={accountTypeVariant(request.registrantKind)}>
              {roleLabel(request.registrantKind)}
            </Badge>
            <Identifier value={request.registrationNumber} label="registration number" />
            <span aria-hidden>·</span>
            <span
              className={cn(
                "tabular-nums",
                waitClass[registrationWaitTone(request.daysWaiting)],
              )}
            >
              {formatDaysWaitingSpoken(request.daysWaiting)}
            </span>
          </div>
        </li>
      ))}
    </ul>
  );
}

function DecidedItemList({
  rows,
  outcome,
}: {
  rows: DecidedRegistration[];
  outcome: RegistrationOutcome;
}) {
  return (
    <ul className="flex flex-col gap-3">
      {rows.map((entry) => (
        <QueueItemRow key={entry.request.id} className="flex flex-col gap-2">
          <p
            className="text-body-compact font-medium text-foreground"
            lang={entry.request.fullNameLang}
          >
            {entry.request.fullName}
          </p>
          <div className="flex flex-wrap items-center gap-2 text-caption text-muted-foreground">
            <Badge variant={accountTypeVariant(entry.request.registrantKind)}>
              {roleLabel(entry.request.registrantKind)}
            </Badge>
            <Identifier
              value={entry.request.registrationNumber}
              label="registration number"
            />
            <span aria-hidden>·</span>
            <span className="tabular-nums">
              {decidedOnLabel(outcome)} {formatListingDate(decisionDay(entry))}
            </span>
          </div>
          {entry.reason ? (
            <p className="text-body-compact text-muted-foreground">{entry.reason}</p>
          ) : null}
        </QueueItemRow>
      ))}
    </ul>
  );
}
