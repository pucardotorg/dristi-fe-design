"use client";

import * as React from "react";

import { ARRIVAL } from "@/components/chrome/motion";
import {
  CognizanceEmpty,
  CognizanceFiltersRow,
  CognizanceItemList,
  cognizanceSorts,
  type CognizanceSort,
} from "@/components/employee/cognizance-screen";
import { sortRows } from "@/lib/employee/court-sort";
import { CognizanceTable } from "@/components/employee/cognizance-table";
import { ListFooter } from "@/components/employee/list-footer";
import { QueueAnnouncer } from "@/components/employee/queue-announcer";
import { useArrival } from "@/components/employee/use-arrival";
import {
  casesOnTab,
  cognizanceTabCount,
  COGNIZANCE_QUEUE,
  cognizanceTabSpec,
  EMPTY_COGNIZANCE_FILTERS,
  filterCognizanceCases,
  type CognizanceFilters,
  type CognizanceTab,
} from "@/lib/employee/cognizance";
import { PAGE_SIZE, type HearingsPageSize } from "@/lib/employee/hearings";
import { cn } from "@/lib/utils";
import { useRouter } from "next/navigation";
import { useCourt } from "@/components/court/court-provider";
import { courtProfile } from "@/lib/court/profiles";

/**
 * One half of Take cognizance, as its own screen — the "split" reading of
 * `cognizance-layout.ts`, alongside `CognizanceScreen`'s tabbed one.
 *
 * Same queue, same rows, same act (`cognizance.ts` is the one source for both): this
 * screen just fixes `tab` instead of switching it, because the rail row it opens from
 * already said which half. Filters and paging are this screen's own, not shared with
 * the tabbed reading or the other tab's screen — each is a fresh page with a fresh
 * question, the same way any other single-purpose queue in this rail works.
 */
export function CognizanceTabScreen({ tab }: { tab: CognizanceTab }) {
  const { court } = useCourt();
  const router = useRouter();
  /* The split rows are the delay split's. A deployment that splits by case type keeps
     its tabs on the one screen (owner, 2026-10-13), so a split row's address leads
     there. */
  const delaySplit = courtProfile(court).cognizanceSplit === "delay";
  React.useEffect(() => {
    if (!delaySplit) router.replace("/employee/cognizance");
  }, [delaySplit, router]);
  if (!delaySplit) return null;
  return <SplitQueue tab={tab} />;
}

function SplitQueue({ tab }: { tab: CognizanceTab }) {
  const arrival = useArrival();
  const [filters, setFilters] = React.useState<CognizanceFilters>(
    EMPTY_COGNIZANCE_FILTERS,
  );
  const [pageSize, setPageSize] = React.useState<HearingsPageSize>(PAGE_SIZE);
  const [page, setPage] = React.useState(1);

  const [sort, setSort] = React.useState<CognizanceSort>("oldest");

  const rows = sortRows(
    filterCognizanceCases(casesOnTab(COGNIZANCE_QUEUE, tab), filters),
    cognizanceSorts(tab),
    sort,
  );
  const pageCount = Math.max(1, Math.ceil(rows.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const start = (currentPage - 1) * pageSize;
  const pageRows = rows.slice(start, start + pageSize);
  const isFiltered =
    filters.query !== "" || (filters.notice ?? "all") !== "all";
  const total = cognizanceTabCount(tab);
  const label = cognizanceTabSpec(tab).label;

  function changeFilters(next: CognizanceFilters) {
    setFilters(next);
    setPage(1);
  }

  function clearFilters() {
    changeFilters(EMPTY_COGNIZANCE_FILTERS);
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
          Take cognizance — {label}
        </h1>
        <p className="text-body text-muted-foreground">
          {total === 1
            ? "1 complaint is on the register waiting for cognizance."
            : `${total} complaints are on the register waiting for cognizance.`}
        </p>
      </header>

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
          <CognizanceEmpty tab={tab} isFiltered={isFiltered} onClear={clearFilters} />
        ) : (
          <div className="flex min-w-0 flex-col gap-4">
            <div className="min-w-0 overflow-x-auto">
              <div className="hidden md:block">
                <CognizanceTable rows={pageRows} tab={tab} />
              </div>
              <div className="md:hidden">
                <CognizanceItemList rows={pageRows} tab={tab} />
              </div>
            </div>

            <ListFooter
              id={`cognizance-${tab}-page-size`}
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
