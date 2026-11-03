"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { FolderSearchIcon } from "lucide-react";

import {
  CourtCaseItemList,
  CourtCasesTable,
} from "@/components/employee/court-cases-table";
import { CourtFilters, CourtSortSelect } from "@/components/employee/court-filters";
import { ListFooter } from "@/components/employee/list-footer";
import { QueueAnnouncer } from "@/components/employee/queue-announcer";
import { useCourtToday } from "@/components/employee/use-court-today";
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
  COURT_CASE_COUNT,
  COURT_PRIORITIES,
  courtPriorityById,
  EMPTY_COURT_CASE_FILTERS,
  filterCourtCases,
  hasCourtCaseFilters,
  type CourtCaseFilters,
  type CourtCase,
  type CourtPriorityId,
} from "@/lib/employee/cases";
import {
  COURT_CASE_STAGES,
  PAGE_SIZE,
  type CourtCaseStage,
  type HearingsPageSize,
} from "@/lib/employee/hearings";
import {
  caseSorts,
  compareCaseNumbers,
  sortOptions,
  sortRows,
  type CourtSortSpec,
} from "@/lib/employee/court-sort";

const DEMO_CASE_HREF = "/employee/cases/c-1001";

type CourtCasesSort = "hearing" | "newest" | "oldest" | "name";

/**
 * Next hearing soonest by default — the column the register is worked by. A case with no
 * hearing listed goes to the foot rather than the top.
 */
const COURT_CASES_SORTS: CourtSortSpec<CourtCase, CourtCasesSort>[] = [
  {
    id: "hearing",
    label: "Next hearing soonest",
    compare: (a, b) =>
      Number(a.nextHearingInDays === null) - Number(b.nextHearingInDays === null) ||
      (a.nextHearingInDays ?? 0) - (b.nextHearingInDays ?? 0) ||
      compareCaseNumbers(a.caseNumber, b.caseNumber),
  },
  ...(caseSorts<CourtCase>() as CourtSortSpec<CourtCase, CourtCasesSort>[]),
];

/**
 * `/employee/cases` — this court's register, searchable.
 *
 * It was briefly the lower half of the dashboard. The owner split it out on 2026-09-14:
 * *"the dashboard is more of a health check… by mixing these two we are complicating
 * things for ourselves."* One screen answering "how is this court doing" and "where is
 * that file" had to compromise on the form of each, and it did.
 *
 * So this screen has one job and the plain shape every other court-side queue has: a
 * heading, a labelled filter row, one lifted table, a footer. **The priority categories
 * are a filter here, not cards** — a select in the row beside the search, which is what
 * a filter looks like on the other sixteen court screens. The version with pressable
 * cards above the list is what the owner rejected: a card cannot be both a summary and a
 * control, and the pressed state ended up stated twice because of it.
 *
 * The dashboard's tiles arrive here as `?priority=<id>`, already narrowed. That is the
 * same journey a card-press made, except the feedback is a whole new screen with the
 * category in its heading — which is the strongest answer a press can get, and the thing
 * the filtering version never managed.
 */
export function CourtCasesScreen() {
  const today = useCourtToday();
  const searchParams = useSearchParams();

  /* The category the dashboard sent us to, read once on arrival. It seeds the filter and
     is then the reader's to change — a URL that kept overriding the select would make the
     control fight the address bar. An unknown value is ignored rather than shown as a
     broken filter. */
  const [filters, setFilters] = React.useState<CourtCaseFilters>(() => {
    const asked = searchParams.get("priority");
    const known = COURT_PRIORITIES.some((priority) => priority.id === asked);
    return {
      ...EMPTY_COURT_CASE_FILTERS,
      /* The dashboard opens a specific case here with `?q=<case number>` and a category
         with `?priority=<id>`. Both only seed the filters — once here they are the
         reader's to change, so the address bar never fights the controls. */
      query: searchParams.get("q") ?? "",
      priority: known ? (asked as CourtPriorityId) : null,
    };
  });
  const [pageSize, setPageSize] = React.useState<HearingsPageSize>(PAGE_SIZE);
  const [page, setPage] = React.useState(1);
  /* A case opens its case view (owner, 2026-10-23). The register's rows are demo data
     with no case record behind them, so each opens the one demo case — the same bargain
     the cause list's View case makes (`HEARING_DEMO_CASE`). */
  const router = useRouter();
  const openCase = () => router.push(DEMO_CASE_HREF);
  const searchRef = React.useRef<HTMLInputElement>(null);

  const [sort, setSort] = React.useState<CourtCasesSort>("hearing");

  const rows = sortRows(filterCourtCases(filters), COURT_CASES_SORTS, sort);
  const pageCount = Math.max(1, Math.ceil(rows.length / pageSize));
  /* Clamped rather than reset in an effect: a filter that shortens the list must not
     leave the reader on page three of nothing, and deriving it means there is no render
     where the page number and the rows disagree. */
  const currentPage = Math.min(page, pageCount);
  const start = (currentPage - 1) * pageSize;
  const pageRows = rows.slice(start, start + pageSize);

  const active = filters.priority
    ? courtPriorityById(filters.priority)
    : undefined;
  const isFiltered = hasCourtCaseFilters(filters);

  /**
   * Change some of the filters. A patch, merged into the latest state: the Filters sheet
   * applies every field it changed in one go, and a whole set built by each field from
   * this render's `filters` kept only the last field's change.
   */
  function change(patch: Partial<CourtCaseFilters>) {
    setFilters((current) => ({ ...current, ...patch }));
    setPage(1);
  }

  function clearFilters() {
    change(EMPTY_COURT_CASE_FILTERS);
    searchRef.current?.focus();
  }

  return (
    <div className="flex min-w-0 flex-1 flex-col gap-8 p-6 md:p-8">
      <header className="flex flex-col gap-2">
        <h1 className="text-title text-balance font-semibold">
          All cases
        </h1>
        {/* The count line says what is in view and what the court holds, in that order,
            because when a filter is on the first number is the one being read. */}
        <p className="text-body text-muted-foreground tabular-nums">
          {isFiltered
            ? `${rows.length} of ${COURT_CASE_COUNT} cases match.`
            : `${COURT_CASE_COUNT} cases on this court's file.`}
        </p>
      </header>

      {/* One panel: filter, list and footer are one unit of work, so they share one
          lifted sheet — the same recipe every other court-side list uses. Nothing inside
          draws a second frame. */}
      <section className="flex min-w-0 flex-col gap-6 rounded-xl border border-hairline bg-card p-6 shadow-raised">
        <CourtFilters
          search={{
            label: "Search cases",
            value: filters.query,
            onChange: (query) => change({ query }),
            placeholder: "Case number, complainant or accused",
          }}
          searchRef={searchRef}
          fields={[
            {
              id: "court-cases-priority",
              label: "Priority",
              value: filters.priority ?? "any",
              all: "any",
              allLabel: "Any priority",
              options: COURT_PRIORITIES.map((priority) => ({
                value: priority.id,
                label: priority.tile,
              })),
              onApply: (value) =>
                change({
                  priority: value === "any" ? null : (value as CourtPriorityId),
                }),
            },
            {
              id: "court-cases-stage",
              label: "Stage",
              value: filters.stage ?? "all",
              all: "all",
              allLabel: "All stages",
              options: COURT_CASE_STAGES.map((stage) => ({
                value: stage.id,
                label: stage.label,
              })),
              onApply: (value) =>
                change({
                  stage: value === "all" ? null : (value as CourtCaseStage),
                }),
            },
          ]}
          trailing={
            <CourtSortSelect
              id="court-cases-sort"
              value={sort}
              options={sortOptions(COURT_CASES_SORTS)}
              onChange={(next) => {
                setSort(next);
                setPage(1);
              }}
            />
          }
          onClearAll={clearFilters}
        />

        {/* The category's own sentence, when one is chosen. The select says which
            category; this says what being in it means, which a 56px control cannot. */}
        {active ? (
          <p className="text-body-compact text-muted-foreground">
            <span className="font-semibold text-foreground">{active.title}.</span>{" "}
            {active.meaning}
          </p>
        ) : null}

        {/* Mounted whatever the list is doing, including empty — see `QueueAnnouncer`. */}
        <QueueAnnouncer
          from={start + 1}
          to={start + pageRows.length}
          total={rows.length}
        />

        {pageRows.length === 0 ? (
          <Empty className="px-0 py-6">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <FolderSearchIcon aria-hidden />
              </EmptyMedia>
              <EmptyTitle className="text-body font-semibold">
                No case matches
              </EmptyTitle>
              <EmptyDescription className="text-body-compact">
                Nothing on this court&rsquo;s file answers the filters set above.
              </EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <Button type="button" variant="outline" onClick={clearFilters}>
                Clear filters
              </Button>
            </EmptyContent>
          </Empty>
        ) : (
          <div className="flex min-w-0 flex-col gap-4">
            {/* `min-w-0` lets this flex item shrink below the table's content width, so a
                wide table scrolls inside the panel instead of pushing the page
                sideways. */}
            <div className="min-w-0 overflow-x-auto">
              <div className="hidden md:block">
                <CourtCasesTable rows={pageRows} today={today} onOpen={openCase} />
              </div>
              <div className="md:hidden">
                <CourtCaseItemList
                  rows={pageRows}
                  today={today}
                  onOpen={openCase}
                />
              </div>
            </div>

            <ListFooter
              id="court-cases-page-size"
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

    </div>
  );
}
