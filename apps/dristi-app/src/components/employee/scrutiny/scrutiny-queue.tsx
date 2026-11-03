"use client";

import * as React from "react";
import { FileSearchIcon, InboxIcon } from "lucide-react";

import {
  CourtFilters,
  CourtSortSelect,
  type CourtFilterField,
} from "@/components/employee/court-filters";
import { ListFooter } from "@/components/employee/list-footer";
import { QueueAnnouncer } from "@/components/employee/queue-announcer";
import {
  ScrutinyQueueItemList,
  ScrutinyQueueTable,
} from "@/components/employee/scrutiny/queue-table";
import { QUEUE, QUEUE_TABS } from "@/lib/employee/scrutiny/fixtures";
import {
  countByBall,
  filterQueue,
  SCRUTINY_QUEUE_COUNT,
} from "@/lib/employee/scrutiny/queue";
import type { Ball, Filing, QueueOwner } from "@/lib/employee/scrutiny/types";
import { PAGE_SIZE, type HearingsPageSize } from "@/lib/employee/hearings";
import { Button } from "@/components/ui/button";
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
  compareCaseNumbers,
  compareText,
  sortOptions,
  sortRows,
  type CourtSortSpec,
} from "@/lib/employee/court-sort";

type ScrutinySort = "longest" | "shortest" | "filing";

/** Longest waiting first — the queue's own order, and the Waiting column's. */
const SCRUTINY_SORTS: CourtSortSpec<Filing, ScrutinySort>[] = [
  {
    id: "longest",
    label: "Longest waiting first",
    compare: (a, b) => b.days - a.days || compareCaseNumbers(a.no, b.no),
  },
  {
    id: "shortest",
    label: "Shortest waiting first",
    compare: (a, b) => a.days - b.days || compareCaseNumbers(a.no, b.no),
  },
  {
    id: "filing",
    label: "Filing number",
    compare: (a, b) => compareCaseNumbers(a.no, b.no) || compareText(a.parties, b.parties),
  },
];

/** The distinct values of one column on this tab, as filter options. */
function columnOptions(rows: Filing[], key: "stage" | "type") {
  return [...new Set(rows.map((row) => row[key]))]
    .sort(compareText)
    .map((value) => ({ value, label: value }));
}

/**
 * The scrutiny queue — complaints waiting to be checked against the documents filed
 * with them.
 *
 * Composed as the court-side queue it is, not as the standalone prototype it came from:
 * the page title stands on the page, the tab strip is the line a filing travels along,
 * and **one** lifted panel below it holds the filters, the table and the pagination
 * footer together. Same panel recipe, same `gap-6` / `p-6`, same table treatment,
 * literally the same footer component as Register cases and Sign process. An officer
 * moving between the rail's rows should not have to re-learn the furniture in between.
 *
 * Three tabs, and what changes between them is only the list: who holds the ball is what
 * the tab selects, so nothing inside the table needs to repeat it.
 */
export function ScrutinyQueue() {
  const [tab, setTab] = React.useState<Ball>("registry");
  const [owner, setOwner] = React.useState<QueueOwner>("anyone");
  const [text, setText] = React.useState("");
  const [pageSize, setPageSize] = React.useState<HearingsPageSize>(PAGE_SIZE);
  const [page, setPage] = React.useState(1);

  const [stage, setStage] = React.useState("all");
  const [caseType, setCaseType] = React.useState("all");
  const [sort, setSort] = React.useState<ScrutinySort>("longest");

  const onTab = React.useMemo(() => filterQueue(QUEUE, tab, "anyone", ""), [tab]);
  const rows = React.useMemo(
    () =>
      sortRows(
        filterQueue(QUEUE, tab, owner, text).filter(
          (row) =>
            (stage === "all" || row.stage === stage) &&
            (caseType === "all" || row.type === caseType),
        ),
        SCRUTINY_SORTS,
        sort,
      ),
    [tab, owner, text, stage, caseType, sort],
  );
  const filtered =
    !!text.trim() || owner !== "anyone" || stage !== "all" || caseType !== "all";

  const pageCount = Math.max(1, Math.ceil(rows.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const start = (currentPage - 1) * pageSize;
  const pageRows = rows.slice(start, start + pageSize);

  /* A tab is a different list with its own stages and types, so those reset; the search
     and the claim survive — they are the officer's question, not the tab's. */
  function changeTab(next: Ball) {
    setTab(next);
    setStage("all");
    setCaseType("all");
    setPage(1);
  }

  function clearFilters() {
    setText("");
    setOwner("anyone");
    setStage("all");
    setCaseType("all");
    setPage(1);
  }

  return (
    <div className="flex min-w-0 flex-1 flex-col gap-8 p-6 md:p-8">
      <header className="flex flex-col gap-2">
        {/* The rail's label, word for word — the court screens' own convention. */}
        <h1 className="text-title text-balance font-semibold">
          Scrutinise submitted cases
        </h1>
        {/* The count is the whole point of the queue, so the supporting line carries it
            rather than restating the title — and it counts what the rail counts: the
            filings sitting with the registry, which is this desk's actual inbox.
            Singular is spelled out because "1 complaints" is the kind of thing a court
            notices. */}
        <p className="text-body text-muted-foreground">
          {SCRUTINY_QUEUE_COUNT === 1
            ? "1 complaint is waiting to be scrutinised."
            : `${SCRUTINY_QUEUE_COUNT} complaints are waiting to be scrutinised.`}
        </p>
      </header>

      <Tabs
        value={tab}
        onValueChange={(value) => changeTab(value as Ball)}
        activationMode="automatic"
        className="flex min-w-0 flex-col gap-6"
      >
        {/* Line TabsList, not the pill track: these are stages of one thing rather than
            alternative views of it, and the underline is what a line looks like. The
            primitive hangs its mark at `after:bottom-[-5px]` for a padded track, so the
            mark is sat at `after:-bottom-px` to land on the gutter's own rule instead of
            floating above it as a second horizontal line (ui-craft §2). */}
        <div className="overflow-x-auto border-b border-hairline">
          <TabsList
            variant="line"
            aria-label="Whose hands the filing is in"
            className="h-10 w-max min-w-full justify-start rounded-none"
          >
            {QUEUE_TABS.map((queueTab) => (
              <TabsTrigger
                key={queueTab.id}
                value={queueTab.id}
                className="h-10 flex-none gap-2 text-body-compact"
              >
                {queueTab.label}
                {/* How much is standing here. One presentation across all three —
                    Closed included, because a count shown two ways is two data types
                    to the eye — and it inherits the trigger's colour so the count and
                    its label read as one thing (ui-craft §2). */}
                <span className="font-normal tabular-nums">
                  {countByBall(QUEUE, queueTab.id)}
                </span>
              </TabsTrigger>
            ))}
          </TabsList>
        </div>

        {QUEUE_TABS.map((queueTab) => (
          <TabsContent
            key={queueTab.id}
            value={queueTab.id}
            className="min-w-0 outline-none"
          >
            {queueTab.id !== tab ? null : (
              /* One panel: filters, list and footer are one unit of work, so they share
                 one lifted sheet — the recipe every other court-side queue uses. Nothing
                 inside draws a second frame, and nothing inside scrolls on its own. */
              <section className="flex min-w-0 flex-col gap-6 rounded-xl border border-hairline bg-card p-6 shadow-raised">
                <QueueFilters
                  text={text}
                  owner={owner}
                  onTextChange={(next) => {
                    setText(next);
                    setPage(1);
                  }}
                  onOwnerChange={(next) => {
                    setOwner(next);
                    setPage(1);
                  }}
                  onClear={clearFilters}
                  extraFields={[
                    {
                      id: "scrutiny-stage",
                      label: "Stage",
                      value: stage,
                      all: "all",
                      allLabel: "All stages",
                      options: columnOptions(onTab, "stage"),
                      onApply: (value) => {
                        setStage(value);
                        setPage(1);
                      },
                    },
                    {
                      id: "scrutiny-case-type",
                      label: "Case type",
                      value: caseType,
                      all: "all",
                      allLabel: "All case types",
                      options: columnOptions(onTab, "type"),
                      onApply: (value) => {
                        setCaseType(value);
                        setPage(1);
                      },
                    },
                  ]}
                  trailing={
                    <CourtSortSelect
                      id="scrutiny-sort"
                      value={sort}
                      options={sortOptions(SCRUTINY_SORTS)}
                      onChange={(next) => {
                        setSort(next);
                        setPage(1);
                      }}
                    />
                  }
                />

                {/* Mounted whatever the queue is doing, including empty — this screen
                    already filtered as you type, and the live region it relied on used to
                    sit in the footer, which is not rendered when nothing matches. See
                    `QueueAnnouncer`. */}
                <QueueAnnouncer
                  from={start + 1}
                  to={start + pageRows.length}
                  total={rows.length}
                />

                {pageRows.length === 0 ? (
                  <QueueEmpty
                    tab={tab}
                    filtered={filtered}
                    onClearFilters={clearFilters}
                    onGoToAdvocate={() => changeTab("advocate")}
                  />
                ) : (
                  <div className="flex min-w-0 flex-col gap-4">
                    {/* min-w-0 lets this flex item shrink below the table's content
                        width, so a wide table scrolls inside the panel instead of
                        pushing the page sideways. */}
                    <div className="min-w-0 overflow-x-auto">
                      <div className="hidden md:block">
                        <ScrutinyQueueTable rows={pageRows} />
                      </div>
                      <div className="md:hidden">
                        <ScrutinyQueueItemList rows={pageRows} />
                      </div>
                    </div>

                    <ListFooter
                      id="scrutiny-page-size"
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
 * Free text and who holds it — the two questions this queue is filtered by.
 *
 * Both filter as you type rather than on a button, which is this screen's own behaviour
 * and the one thing that differs from the sibling queues. Every control still carries a
 * visible label: a placeholder is a hint, not a name, and ACCESSIBILITY §12 wants a
 * permanent one.
 */
function QueueFilters({
  text,
  owner,
  onTextChange,
  onOwnerChange,
  onClear,
  extraFields,
  trailing,
}: {
  text: string;
  owner: QueueOwner;
  onTextChange: (value: string) => void;
  onOwnerChange: (value: QueueOwner) => void;
  onClear: () => void;
  /** The tab's own column filters, after Claimed by. */
  extraFields: CourtFilterField[];
  /** The sort control (`CourtSortSelect`). */
  trailing: React.ReactNode;
}) {
  return (
    <CourtFilters
      search={{
        label: "Search filings",
        value: text,
        onChange: onTextChange,
        placeholder: "filing no., party or advocate",
      }}
      fields={[
        {
          id: "scrutiny-claimed-by",
          label: "Claimed by",
          value: owner,
          all: "anyone",
          allLabel: "Anyone",
          options: [
            { value: "me", label: "Me" },
            { value: "unclaimed", label: "Unclaimed" },
          ],
          onApply: (value) => onOwnerChange(value as QueueOwner),
        },
        ...extraFields,
      ]}
      trailing={trailing}
      onClearAll={onClear}
    />
  );
}

/**
 * A genuinely empty tab and a filtered-empty tab are different situations and get
 * different copy: one teaches where the work is, the other offers the way back out of
 * the filter. Borderless and unpadded; the panel is already the frame.
 */
function QueueEmpty({
  tab,
  filtered,
  onClearFilters,
  onGoToAdvocate,
}: {
  tab: Ball;
  filtered: boolean;
  onClearFilters: () => void;
  onGoToAdvocate: () => void;
}) {
  if (filtered) {
    return (
      <Empty className="border-0 p-0">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <FileSearchIcon aria-hidden />
          </EmptyMedia>
          <EmptyTitle className="text-title-s font-semibold">
            No filings match these filters
          </EmptyTitle>
          <EmptyDescription className="text-body">
            Nothing in this tab matches the search or the claim filter.
          </EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Button variant="outline" onClick={onClearFilters}>
            Clear filters
          </Button>
        </EmptyContent>
      </Empty>
    );
  }

  const withAdvocates = countByBall(QUEUE, "advocate");
  return (
    <Empty className="border-0 p-0">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <InboxIcon aria-hidden />
        </EmptyMedia>
        <EmptyTitle className="text-title-s font-semibold">
          {tab === "registry"
            ? "Nothing awaiting scrutiny"
            : tab === "advocate"
              ? "Nothing with advocates"
              : "No cases closed yet"}
        </EmptyTitle>
        {tab === "registry" ? (
          <EmptyDescription className="text-body">
            {withAdvocates === 1
              ? "1 filing is with an advocate."
              : `${withAdvocates} filings are with advocates.`}
          </EmptyDescription>
        ) : null}
      </EmptyHeader>
      {tab === "registry" ? (
        <EmptyContent>
          <Button variant="outline" onClick={onGoToAdvocate}>
            View filings with advocates
          </Button>
        </EmptyContent>
      ) : null}
    </Empty>
  );
}
