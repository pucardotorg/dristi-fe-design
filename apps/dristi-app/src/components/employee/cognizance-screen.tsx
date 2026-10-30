"use client";

import * as React from "react";
import { SearchXIcon, StampIcon } from "lucide-react";

import { ARRIVAL } from "@/components/chrome/motion";
import {
  CognizanceCaseLink,
  CognizanceTable,
  DelayCell,
} from "@/components/employee/cognizance-table";
import { CounselCell } from "@/components/employee/counsel-cell";
import { ListFooter } from "@/components/employee/list-footer";
import { QueueAnnouncer } from "@/components/employee/queue-announcer";
import { CourtFilters, CourtSortSelect } from "@/components/employee/court-filters";
import { useArrival } from "@/components/employee/use-arrival";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { rowActivation } from "@/lib/employee/row-activation";
import {
  caseSorts,
  compareCaseNumbers,
  sortOptions,
  sortRows,
  type CourtSortSpec,
} from "@/lib/employee/court-sort";
import {
  rememberCognizanceTab,
  useReturnedTab,
} from "@/components/employee/cognizance-return";
import { useCourt } from "@/components/court/court-provider";
import { courtProfile } from "@/lib/court/profiles";
import {
  casesOnTab,
  COGNIZANCE_NOTICE_OPTIONS,
  COGNIZANCE_QUEUE,
  cognizanceTabsFor,
  cognizanceTabCount,
  EMPTY_COGNIZANCE_FILTERS,
  filterCognizanceCases,
  type CognizanceCase,
  type CognizanceFilters,
  type CognizanceNoticeFilter,
  type CognizanceTab,
} from "@/lib/employee/cognizance";
import {
  counselFor,
  PAGE_SIZE,
  type HearingsPageSize,
} from "@/lib/employee/hearings";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { Identifier } from "@/components/chrome/identifier";

/**
 * Take cognizance — complaints on the register the magistrate has not yet decided to
 * proceed on.
 *
 * Deliberately the same screen as Register cases, one row down in the rail: the title
 * stands on the page, and **one** lifted panel holds the filters, the table and the
 * pagination footer together. Same recipe, same `gap-6` / `p-6`, same table treatment,
 * literally the same footer component. A magistrate moving from Register cases to Take
 * cognizance is looking at one complaint's life at two moments and should not have to
 * re-learn the furniture in between.
 *
 * **Two tabs inside one rail row.** Delay was a filter on one list until the PRD (v6,
 * §2) made the split decide the act: the positive action is configured per tab, and a
 * state may swap Take cognizance for Issue notice on either. That is not something you
 * narrow a list by. What the reference wanted and the PRD does not ask for — two counted
 * rail rows opening two near-identical screens — stays refused: one row, one screen, two
 * tabs in it.
 *
 * There is no teal on the page, and that is right: the Ration Teal Law spends a strong
 * action on the view's own act, and this view has none. Cognizance is taken at the foot
 * of a complaint's file, not on the list.
 */
export function CognizanceScreen() {
  /* Returning from a complaint, the queue slides in from the left — the direction it was
     left in, so coming back reads as coming back. */
  const arrival = useArrival();
  /* One state, not a draft and an applied one: the list answers as it is typed, so there
     is never a moment where what the bench has asked for and what the table shows
     disagree. Every change resets to page one. */
  const [filters, setFilters] = React.useState<CognizanceFilters>(
    EMPTY_COGNIZANCE_FILTERS,
  );
  /* The tab the magistrate left on, when they are coming back from a complaint; the
     first tab otherwise. Taken once on mount, then this screen's own. */
  /* Kerala splits the queue by delay; Gujarat by the type the case was registered as
     (`cognizanceTabsFor`, owner 2026-10-13). */
  const { court } = useCourt();
  const tabs = cognizanceTabsFor(court);
  const returned = useReturnedTab(tabs);
  const [chosenTab, setTab] = React.useState<CognizanceTab>(returned);
  /* A court switched while on the screen leaves a tab the new split does not have. */
  const tab = tabs.some((entry) => entry.id === chosenTab) ? chosenTab : tabs[0].id;
  React.useEffect(() => rememberCognizanceTab(tab), [tab]);
  const [pageSize, setPageSize] = React.useState<HearingsPageSize>(PAGE_SIZE);
  const [page, setPage] = React.useState(1);

  const [sort, setSort] = React.useState<CognizanceSort>("oldest");

  const rows = sortRows(
    filterCognizanceCases(casesOnTab(COGNIZANCE_QUEUE, tab, court), filters),
    cognizanceSorts(tab),
    sort,
  );

  const pageCount = Math.max(1, Math.ceil(rows.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const start = (currentPage - 1) * pageSize;
  const pageRows = rows.slice(start, start + pageSize);
  const isFiltered =
    filters.query !== "" || (filters.notice ?? "all") !== "all";

  function changeFilters(next: CognizanceFilters) {
    setFilters(next);
    setPage(1);
  }

  function clearFilters() {
    changeFilters(EMPTY_COGNIZANCE_FILTERS);
  }

  /* Switching tabs is a different list, so it starts at its own first page. The search
     survives the move: it is the bench's question, not the tab's. */
  function changeTab(next: CognizanceTab) {
    setTab(next);
    if (next !== "with-delay" && sort === "delay") setSort("oldest");
    setPage(1);
  }

  return (
    <div
      className={cn(
        "flex min-w-0 flex-1 flex-col gap-8 p-6 md:p-8",
        arrival && ARRIVAL[arrival],
      )}
    >
      <header className="flex flex-col gap-2">
        <h1 className="text-title text-balance font-semibold">
          Take cognizance
        </h1>
        {/* The count is the point of a queue, so the supporting line carries it rather
            than restating the title. Singular is spelled out, because "1 complaints" is
            the kind of thing a court notices. */}
        <p className="text-body text-muted-foreground">
          {COGNIZANCE_QUEUE.length === 1
            ? "1 complaint is on the register waiting for cognizance."
            : `${COGNIZANCE_QUEUE.length} complaints are on the register waiting for cognizance.`}
        </p>
      </header>

      <Tabs
        value={tab}
        onValueChange={(value) => changeTab(value as CognizanceTab)}
        activationMode="automatic"
        className="flex min-w-0 flex-col gap-6"
      >
        {/* Line TabsList, not the pill track: these are two halves of one register
            rather than alternative views of it, and the underline is what a line looks
            like. The primitive hangs its mark at `after:bottom-[-5px]` for a padded
            track, so the mark is sat at `after:-bottom-px` to land on the gutter's own
            rule instead of floating above it as a second horizontal line — the same
            correction Scrutinise submitted cases carries. */}
        <div className="overflow-x-auto border-b border-hairline">
          <TabsList
            variant="line"
            aria-label={
              courtProfile(court).cognizanceSplit === "delay"
                ? "Whether the complaint was filed in time"
                : "The type the case was registered as"
            }
            className="h-10 w-max min-w-full justify-start rounded-none"
          >
            {tabs.map((queueTab) => (
              <TabsTrigger
                key={queueTab.id}
                value={queueTab.id}
                className="h-10 flex-none gap-2 text-body-compact"
              >
                {queueTab.label}
                {/* How many stand here, counted over the whole queue so the number does
                    not move as the search box is typed into. It inherits the trigger's
                    colour, so the count and its label read as one thing. */}
                <span className="font-normal tabular-nums">
                  {cognizanceTabCount(queueTab.id, court)}
                </span>
              </TabsTrigger>
            ))}
          </TabsList>
        </div>

        {tabs.map((queueTab) => (
          <TabsContent
            key={queueTab.id}
            value={queueTab.id}
            className="min-w-0 outline-none"
          >
            {queueTab.id !== tab ? null : (
              /* One panel: filters, list and footer are one unit of work, so they share
                 one lifted sheet. Nothing inside draws a second frame. */
              <section className="flex min-w-0 flex-col gap-6 rounded-xl border border-hairline bg-card shadow-raised p-6">
                <CognizanceFiltersRow
                  filters={filters}
                  onChange={changeFilters}
                  onClear={clearFilters}
                  tab={tab}
                  sort={sort}
                  onSortChange={(next) => {
                    setSort(next);
                    setPage(1);
                  }}
                />

                <QueueAnnouncer
                  from={start + 1}
                  to={start + pageRows.length}
                  total={rows.length}
                />

                {pageRows.length === 0 ? (
                  <CognizanceEmpty
                    tab={tab}
                    isFiltered={isFiltered}
                    onClear={clearFilters}
                  />
                ) : (
                  <div className="flex min-w-0 flex-col gap-4">
                    {/* min-w-0 lets this flex item shrink below the table's content
                        width, so a wide table scrolls inside the panel instead of
                        pushing the page sideways. */}
                    <div className="min-w-0 overflow-x-auto">
                      <div className="hidden md:block">
                        <CognizanceTable rows={pageRows} tab={tab} />
                      </div>
                      <div className="md:hidden">
                        <CognizanceItemList rows={pageRows} tab={tab} />
                      </div>
                    </div>

                    <ListFooter
                      id="cognizance-page-size"
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
              </section>
            )}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}

/**
 * Free text over the tab's own rows, narrowing as it is typed.
 *
 * One control now the tabs carry delay: the select that used to sit beside it asked the
 * same question the tab strip answers, and two ways to say one thing is one of them
 * being wrong. No Search button either — with nothing to compose before asking, a button
 * only stands between the bench and the answer, and the way back to the whole tab is the
 * `×` in the box.
 *
 * The form element stays so Enter in the box is swallowed rather than reloading the page.
 */
export function CognizanceFiltersRow({
  filters,
  onChange,
  onClear,
  tab,
  sort,
  onSortChange,
}: {
  tab: CognizanceTab;
  filters: CognizanceFilters;
  onChange: (filters: CognizanceFilters) => void;
  onClear: () => void;
  sort: CognizanceSort;
  onSortChange: (sort: CognizanceSort) => void;
}) {
  return (
    <CourtFilters
      search={{
        label: "Search cases",
        value: filters.query,
        onChange: (query) => onChange({ ...filters, query }),
        placeholder: "Case name, number or advocate",
      }}
      fields={[
        {
          /* Whether the demand notice reached the accused decides how cause of action is
             reckoned, so it is the one fact on the file the bench sorts a pile by. */
          id: "cognizance-notice",
          label: "Demand notice",
          value: filters.notice ?? "all",
          all: "all",
          allLabel: "Any notice",
          options: COGNIZANCE_NOTICE_OPTIONS,
          onApply: (value) =>
            onChange({ ...filters, notice: value as CognizanceNoticeFilter }),
        },
      ]}
      trailing={
        <CourtSortSelect
          id="cognizance-sort"
          value={sort}
          options={sortOptions(cognizanceSorts(tab))}
          onChange={onSortChange}
        />
      }
      onClearAll={onClear}
    />
  );
}

export type CognizanceSort = "oldest" | "newest" | "name" | "delay";

/**
 * Register order — oldest case first — by default, read off the case number on the row.
 * "Longest delay first" exists only where there is a delay to read: the late tab, whose
 * Days of delay column it sorts.
 */
export function cognizanceSorts(tab: CognizanceTab): CourtSortSpec<CognizanceCase, CognizanceSort>[] {
  const [newest, oldest, name] = caseSorts<CognizanceCase>();
  const base = [oldest, newest, name] as CourtSortSpec<CognizanceCase, CognizanceSort>[];
  if (tab !== "with-delay") return base;
  return [
    ...base,
    {
      id: "delay",
      label: "Longest delay first",
      compare: (a, b) =>
        b.filedAfterCauseDays - a.filedAfterCauseDays ||
        compareCaseNumbers(a.caseNumber, b.caseNumber),
    },
  ];
}

/**
 * Why the list is empty, and what to do about it.
 *
 * Two different facts, so two different states: a search that matched nothing is a dead
 * end with an action worth offering, while an empty tab is the bench being up to date on
 * that half of the register — and the two halves are up to date about different things,
 * so each says its own. Borderless and unpadded; the panel is already the frame.
 */
export function CognizanceEmpty({
  tab,
  isFiltered,
  onClear,
}: {
  tab: CognizanceTab;
  isFiltered: boolean;
  onClear: () => void;
}) {
  const clear =
    tab === "with-delay"
      ? "No complaint filed beyond the month is waiting for a decision."
      : "No complaint filed in time is waiting for a decision.";
  return (
    <Empty className="border-0 p-0">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          {isFiltered ? <SearchXIcon aria-hidden /> : <StampIcon aria-hidden />}
        </EmptyMedia>
        <EmptyTitle className="text-title-s font-semibold">
          {isFiltered ? "No complaints match this search" : "Nothing waiting"}
        </EmptyTitle>
        <EmptyDescription className="text-body">
          {isFiltered
            ? "No complaint on this tab matches what you have asked for."
            : clear}
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
 * Four columns do not survive a 375px screen, so the cause keeps its line, the number
 * and the delay share the one under it, and the advocates drop to their own. The delay
 * is spelled out with its unit here — on a phone there is no column header to name it —
 * and only on the tab that has one to show.
 */
export function CognizanceItemList({
  rows,
  tab,
}: {
  rows: CognizanceCase[];
  tab: CognizanceTab;
}) {
  const showDelay = tab === "with-delay";
  return (
    <ul className="flex flex-col gap-3">
      {rows.map((matter) => (
        <li
          key={matter.id}
          {...rowActivation(
            "flex flex-col gap-2 rounded-lg bg-surface-sunken p-4 transition-colors hover:bg-accent-strong",
          )}
        >
          <CognizanceCaseLink
            matter={matter}
            className="flex min-h-10 min-w-0 items-center"
          />
          <p className="text-caption text-muted-foreground">
            <Identifier value={matter.caseNumber} label="case number" />
            {showDelay ? (
              <>
                {" · "}
                <DelayCell matter={matter} standalone />
              </>
            ) : null}
          </p>
          <CounselCell
            complainant={counselFor(matter, "complainant").map(
              (counsel) => counsel.name,
            )}
            accused={counselFor(matter, "accused").map((counsel) => counsel.name)}
          />
        </li>
      ))}
    </ul>
  );
}
