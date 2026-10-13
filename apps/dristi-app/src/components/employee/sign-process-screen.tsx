"use client";

import * as React from "react";
import {
  ArrowRightIcon,
  FileCheck2Icon,
  SearchXIcon,
  XIcon,
} from "lucide-react";

import {
  PILL_COUNT,
  PILL_ITEM,
  PILL_ROW,
} from "@/components/chrome/pill-plate";
import { QueueAnnouncer } from "@/components/employee/queue-announcer";
import {
  CourtFilters,
  CourtSortSelect,
  type CourtFilterField,
} from "@/components/employee/court-filters";
import { RecordReturnsDialog } from "@/components/employee/record-returns-dialog";
import { ProcessMoveDialog } from "@/components/employee/process-move-dialog";
import { SignProcessDialog } from "@/components/employee/sign-process-dialog";
import {
  ProcessStatusText,
  SignProcessTable,
} from "@/components/employee/sign-process-table";
import { QueueItemRow } from "@/components/employee/queue-item-row";
import { rowOpener, rowOpenerClass } from "@/lib/employee/row-activation";
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
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { isPendingFilterChange } from "@/lib/employee/filter-state";
import {
  causeTitle,
} from "@/lib/employee/hearings";
import {
  actsForSelection,
  bandByStatus,
  courtProcessTypeInline,
  courtProcessTypeLabel,
  COURT_PROCESS_TYPES,
  defaultProcessFilters,
  downloadProcessBundle,
  DEFAULT_PROCESS_TAB,
  filterProcesses,
  formatProcessDate,
  groupSelectionByCase,
  hasPills,
  NON_SERVICE_REASONS,
  OUTCOME_FILTERS,
  orderForView,
  pileFor,
  pilePool,
  PROCESS_CHANNELS,
  PROCESS_LINE,
  PROCESS_TABS,
  allCounted,
  DEFAULT_PROCESS_SORT,
  moveLine,
  PROCESS_SORTS,
  processAct,
  processChannelLabel,
  processesAt,
  processesElsewhere,
  processesIn,
  processIdsForCase,
  processStatus,
  processTab,
  rebaseFilters,
  sortProcesses,
  spansStatuses,
  recordProcessReturns,
  runProcessAct,
  singleCaseMatch,
  tabCount,
  todayIsoDay,
  type CourtProcess,
  type ProcessAct,
  type ProcessActId,
  type ProcessFilters,
  type ProcessOutcome,
  type ProcessPile,
  type ProcessSort,
  type ProcessStatus,
  type ProcessTab,
  type ProcessTabId,
  type ProcessView,
  type SelectedCase,
} from "@/lib/employee/sign-process";
import { Identifier } from "@/components/chrome/identifier";
import { useCourtText } from "@/components/court/court-provider";

function plural(count: number, one: string, many: string): string {
  return count === 1 ? one : many;
}

/**
 * Sign process — every summons, notice, warrant and proclamation this court has issued,
 * from the cover it waits on to the word its channel sends back.
 *
 * **Three tabs, by who the process is waiting on** (owner, 2026-10-06; see
 * `lib/employee/sign-process.ts`): RPAD collection waits on the advocate, Issuance on
 * the court, Service on the channel. Inside a tab the statuses are **pills** — the
 * pending-tasks row, one at a time, with All to see the tab whole and banded by status.
 * The tab is the job and the pill narrows it, so the bench never changes tab to finish
 * one.
 *
 * **Acts come from the selection, not from the pill.** A Issuance selection can hold
 * rows to sign, covers to post and failed sends at once; each gets its own button over its
 * own count, the first of them the one strong action (Ration teal). Under one pill that
 * is simply that pill's act.
 *
 * **Paper in hand is matched one number at a time.** Three statuses are the clerk holding
 * a stack — covers arriving, covers going to the post office, acknowledgements coming
 * back — and on each the search box takes a case number and Enter puts that envelope on
 * the pile, shown in a tray above the list. Same gesture, same tray, three moments.
 *
 * Everything below the tab strip is the court-side furniture the rest of the rail uses:
 * one lifted panel holding the controls, the list and the footer. **Selection does not
 * survive a change of tab or pill** — rows ticked to sign mean nothing under Service.
 *
 * **Nothing is signed, sent, posted or recorded.** Every act moves a row in the demo line.
 */
export function SignProcessScreen() {
  /* One list, so the tabs, the pills, the rail count and the bar can never disagree
     about where a row is. */
  const [line, setLine] = React.useState<CourtProcess[]>(PROCESS_LINE);
  const [tabId, setTabId] = React.useState<ProcessTabId>(DEFAULT_PROCESS_TAB);
  const tab = processTab(tabId);
  const [view, setView] = React.useState<ProcessView>(tab.defaultView);

  const [filters, setFilters] = React.useState<ProcessFilters>(() =>
    defaultProcessFilters(tab),
  );
  const [selectedIds, setSelectedIds] = React.useState<ReadonlySet<string>>(
    () => new Set(),
  );
  /* The row open in the overlay, by id: the overlay reads the live row off the line, so
     an act taken in it shows its new status without closing. */
  const [openId, setOpenId] = React.useState<string | null>(null);
  const open = openId ? (line.find((process) => process.id === openId) ?? null) : null;
  const openRow = (process: CourtProcess) => setOpenId(process.id);
  /* Which act's confirmation is open. One at a time; each has its own rows. */
  const [confirming, setConfirming] = React.useState<ProcessActId | null>(null);
  /* The act the shared confirmation last opened on. Held past closing so the dialog keeps
     its verb while it closes and hands focus back. */
  const [shown, setShown] =
    React.useState<Exclude<ProcessActId, "record">>("sign");
  const [notice, setNotice] = React.useState("");
  /* What the last Enter did with the paper in the clerk's hand. Spoken, not shown — the
     chip arriving in the tray is what says it on screen. */
  const [picked, setPicked] = React.useState("");
  /* How the list is ordered — kept across tabs and pills: it is how the bench likes to
     read, not a question about one view. */
  const [sort, setSort] = React.useState<ProcessSort>(DEFAULT_PROCESS_SORT);
  /* What the last act took, by id, so the confirmation's success can say where the rows
     are now — read back off the line once they have moved. */
  const [actedIds, setActedIds] = React.useState<ReadonlySet<string>>(
    () => new Set(),
  );
  const searchRef = React.useRef<HTMLInputElement>(null);
  /* The bar button a confirmation was opened from, for focus to return to. Set on the
     press, because the bar can carry up to three act buttons. */
  const actRef = React.useRef<HTMLButtonElement | null>(null);

  const viewRows = processesIn(line, tab, view);
  /* Sorted first, then grouped: under All the bands keep the sort inside each. */
  const sorted = sortProcesses(viewRows, sort);
  const ordered = view === "all" ? orderForView(sorted, tab) : sorted;
  const rows = filterProcesses(ordered, filters);
  /* Banded when the view holds more than one status. */
  const banded = view === "all" && spansStatuses(rows);

  /* No pages (owner, 2026-10-06). This is a bulk screen — a pile is picked across the
     whole view and acted on at once — and paging hid half of it: under All the first ten
     rows were all To sign, so the other statuses sat on a page nobody opened. The view is
     already cut by tab, pill and filter; what is left is one list. */

  const defaults = defaultProcessFilters(tab);
  const isFiltered = isPendingFilterChange(filters, defaults);

  /* What the bar acts on: the selection, minus anything that has since moved on. */
  const selected = viewRows.filter((process) => selectedIds.has(process.id));
  const groups = actsForSelection(tab, selected);

  /* The paper this view is matched against, and the selection read back as envelopes. */
  const pile = pileFor(view);
  const pool = pilePool(line, view);
  const selectedCases = pile ? groupSelectionByCase(pool, selectedIds) : [];

  const elsewhere =
    rows.length === 0 && isFiltered
      ? processesElsewhere(line, filters, { tab: tabId, view })
      : [];

  /** Put the selection and the last word down — what any change of view does. */
  function resetWork() {
    setSelectedIds(new Set());
    setNotice("");
    setPicked("");
  }

  /**
   * Move to another tab, and optionally a status in it.
   *
   * `carry` is the filters to arrive with, and only the empty state passes it: following
   * "1 in To post" out of a search that found nothing here has to land on that search
   * still applied. The tab strip passes nothing and resets, which is what picking a tab
   * off the strip means.
   */
  function changeTab(
    next: ProcessTabId,
    nextView?: ProcessView,
    carry?: ProcessFilters,
  ) {
    const nextTab = processTab(next);
    setTabId(next);
    setView(nextView ?? nextTab.defaultView);
    setFilters(
      carry
        ? rebaseFilters(carry, tab, nextTab)
        : defaultProcessFilters(nextTab),
    );
    resetWork();
  }

  /** A pill. The filters stay: a question asked of one status is often next asked of
   *  the one beside it. */
  function changeView(next: ProcessView) {
    setView(next);
    resetWork();
  }

  /**
   * Change some of the filters. A patch, merged into the latest state rather than a whole
   * new set: the Filters sheet applies every field it changed in one go, and a whole set
   * built from this render's `filters` by each field in turn kept only the last field's
   * change — Process type and Channel applied together came back as Channel alone.
   */
  function changeFilters(patch: Partial<ProcessFilters>) {
    if (patch.query !== undefined && patch.query !== filters.query) setPicked("");
    setFilters((current) => ({ ...current, ...patch }));
  }

  /**
   * Enter, in the search box: put this envelope on the pile.
   *
   * Only where the view is paper in hand. **It commits only when the number names one
   * case** — two cases still matching means the clerk has not finished typing — and every
   * process of that case in the pile goes on together, because they travel in one cover.
   * The box empties on the way out, ready for the next cover. A case already on the pile
   * is said aloud rather than silently ignored.
   */
  function submitSearch() {
    const query = filters.query.trim();
    if (!pile || !query) return;

    const matches = singleCaseMatch(pool, { ...filters, query });
    if (!matches) return;

    const caseNumber = matches[0].caseNumber;
    const already = matches.every((process) => selectedIds.has(process.id));
    if (!already) {
      setSelectedIds((current) => {
        const next = new Set(current);
        for (const process of matches) next.add(process.id);
        return next;
      });
    }

    setFilters((current) => ({ ...current, query: "" }));
    setNotice("");
    setPicked(
      already
        ? `${caseNumber} is already on the pile.`
        : `${caseNumber} added to the pile.`,
    );
  }

  function clearFilters() {
    changeFilters(defaults);
  }

  function toggle(process: CourtProcess) {
    setNotice("");
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(process.id)) next.delete(process.id);
      else next.add(process.id);
      return next;
    });
  }

  /** The header checkbox: every row in view, or none of them. */
  function toggleAllInView(select: boolean) {
    setNotice("");
    setSelectedIds((current) => {
      const next = new Set(current);
      for (const process of rows) {
        if (select) next.add(process.id);
        else next.delete(process.id);
      }
      return next;
    });
  }

  /** Take an envelope back out of the pile — every process of the case, since the
   *  entry *is* the envelope. */
  function removeCase(caseNumber: string) {
    setNotice("");
    const ids = processIdsForCase(pool, caseNumber);
    setSelectedIds((current) => {
      const next = new Set(current);
      for (const id of ids) next.delete(id);
      return next;
    });
  }

  function clearSelection() {
    setNotice("");
    setSelectedIds(new Set());
  }

  function forget(ids: Iterable<string>) {
    setSelectedIds((current) => {
      const next = new Set(current);
      for (const id of ids) next.delete(id);
      return next;
    });
  }

  /**
   * An act from the bar or the single-row overlay. It runs over the given rows in the
   * demo line, clears what it consumed and says what it did — nothing leaves the browser.
   */
  function act(
    actId: Exclude<ProcessActId, "record">,
    ids: ReadonlySet<string>,
  ) {
    const next = runProcessAct(line, actId, ids, todayIsoDay());
    const moved = line.filter(
      (process, index) => ids.has(process.id) && next[index] !== process,
    );
    if (moved.length === 0) return;
    setActedIds(new Set(moved.map((process) => process.id)));
    setLine(next);
    forget(ids);
    setNotice(processAct(actId).notice(moved.length));
  }

  function record(outcomes: Map<string, ProcessOutcome>, on: string) {
    setLine((current) => recordProcessReturns(current, outcomes, on));
    forget(outcomes.keys());
    setNotice(processAct("record").notice(outcomes.size));
  }

  function returnFocus() {
    searchRef.current?.focus();
  }

  const confirmingGroup = confirming
    ? groups.find((group) => group.act.id === confirming)
    : undefined;
  const confirmingRows = confirmingGroup?.rows ?? [];
  const shownAct = processAct(shown);
  /* Where the last act's rows are now — what the confirmation's success says. */
  const actedRows = line.filter((process) => actedIds.has(process.id));


  return (
    <div className="flex min-w-0 flex-1 flex-col gap-8 p-6 md:p-8">
      <header className="flex flex-col gap-2">
        {/* No supporting line (owner, 2026-10-06): the tab counts and the pills already
            say how much is standing where, and a sentence restating them was noise. */}
        <h1 className="text-title text-balance font-semibold">Sign process</h1>
      </header>

      <Tabs
        value={tabId}
        onValueChange={(value) => changeTab(value as ProcessTabId)}
        className="flex min-w-0 flex-col gap-6"
      >
        {/* Line TabsList: the mark sits on the gutter's own rule (`after:-bottom-px`),
            because `overflow-x-auto` clips the primitive's padded-track hang. */}
        {/* No scrollbar for the same reason as the pill row (`chrome/pill-plate.ts`). */}
        <div className="overflow-x-auto border-b border-hairline [scrollbar-width:none]">
          <TabsList
            variant="line"
            aria-label="Process line"
            className="h-10 w-max min-w-full justify-start rounded-none p-0 group-data-horizontal/tabs:h-10"
          >
            {PROCESS_TABS.map((entry) => {
              const count = tabCount(line, entry);
              return (
                <TabsTrigger
                  key={entry.id}
                  value={entry.id}
                  className="h-10 flex-none gap-2 px-3 text-body-compact group-data-horizontal/tabs:after:-bottom-px"
                >
                  {entry.label}
                  {/* Counts mean work: Service carries none — see `ProcessTab.counted`. */}
                  {count === null ? null : (
                    <span className="font-normal tabular-nums">{count}</span>
                  )}
                </TabsTrigger>
              );
            })}
          </TabsList>
        </div>

        {PROCESS_TABS.map((entry) => (
          <TabsContent
            key={entry.id}
            value={entry.id}
            className="min-w-0 outline-none"
          >
            {entry.id !== tabId ? null : (
              /* One panel: pills, filters, list and footer are one unit of work. */
              <section className="flex min-w-0 flex-col gap-6 rounded-xl border border-hairline bg-card p-6 shadow-raised">
                {/* One row, edge to edge: the pills lead, the search and Filters sit at
                    the far end — the pending-tasks row (owner, 2026-10-06). */}
                <ProcessFiltersForm
                  sort={sort}
                  onSortChange={setSort}
                  leading={
                    hasPills(tab) ? (
                      <ProcessPills
                        tab={tab}
                        line={line}
                        view={view}
                        onChange={changeView}
                      />
                    ) : undefined
                  }
                  tab={tab}
                  pile={pile}
                  filters={filters}
                  searchRef={searchRef}
                  onChange={changeFilters}
                  onClear={clearFilters}
                  onSubmit={submitSearch}
                />

                <QueueAnnouncer
                  from={1}
                  to={rows.length}
                  total={rows.length}
                />

                {/* The pile, above the list it was picked from — and outside the branch
                    below, so searching a case with nothing here empties the table without
                    emptying the clerk's hands. Shown only when it holds something. */}
                {pile && selectedCases.length > 0 ? (
                  <ProcessSelectionTray
                    pile={pile}
                    cases={selectedCases}
                    onRemoveCase={removeCase}
                    onClearSelection={clearSelection}
                  />
                ) : null}

                {/* One height for both branches, so narrowing a search does not walk the
                    footer up the screen under the clerk. */}
                <div className="flex min-h-96 min-w-0 flex-col">
                  {rows.length === 0 ? (
                    <ProcessEmpty
                      empty={
                        view === "all" ? tab.empty : processStatus(view).empty
                      }
                      isFiltered={isFiltered}
                      elsewhere={elsewhere}
                      onClear={clearFilters}
                      onGoTo={(status) =>
                        changeTab(status.tab, status.id, filters)
                      }
                    />
                  ) : (
                    <div className="flex min-w-0 flex-col gap-4">
                      <div className="min-w-0 overflow-x-auto">
                        {/* Seven columns do not survive a phone. Below `md` the same rows
                            stack as items. */}
                        <div className="hidden md:block">
                          <SignProcessTable
                            tab={tab}
                            rows={rows}
                            banded={banded}
                            selectedIds={selectedIds}
                            onToggle={toggle}
                            onToggleAll={toggleAllInView}
                            onOpen={openRow}
                          />
                        </div>
                        <div className="md:hidden">
                          <ProcessItemList
                            tab={tab}
                            rows={rows}
                            banded={banded}
                            selectedIds={selectedIds}
                            onToggle={toggle}
                            onOpen={openRow}
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </section>
            )}
          </TabsContent>
        ))}
      </Tabs>

      {viewRows.length > 0 ? (
        <ProcessBar
          tab={tab}
          view={view}
          count={selected.length}
          groups={groups}
          notice={notice}
          onDownload={() => downloadProcessBundle(selected)}
          onRequestAct={(actId, button) => {
            actRef.current = button;
            if (actId !== "record") setShown(actId);
            setConfirming(actId);
          }}
        />
      ) : null}

      {/* The product's plain confirmation: the question and where the rows go. It hangs
          off the screen rather than off the bar, because an act on the last row in view
          takes the bar away with it. Recording a return asks more than a yes, so it has
          its own. */}
      <ProcessMoveDialog
        act={shownAct}
        count={confirmingRows.length}
        line={moveLine(shown, confirmingRows)}
        landed={actedRows}
        open={confirming !== null && confirming === shown}
        onOpenChange={(next) => {
          if (!next) setConfirming(null);
        }}
        triggerRef={actRef}
        onConfirm={() =>
          act(shown, new Set(confirmingRows.map((process) => process.id)))
        }
        /* Only off signing: a signed paper is worth having in hand the moment it is
           done (owner, 2026-09-07), and the rows have left the view. */
        onDownload={
          shown === "sign" ? () => downloadProcessBundle(actedRows) : undefined
        }
        onReturnFocus={returnFocus}
      />

      <RecordReturnsDialog
        rows={confirming === "record" ? (confirmingGroup?.rows ?? []) : []}
        open={confirming === "record"}
        onOpenChange={(next) => {
          if (!next) setConfirming(null);
        }}
        onRecord={record}
        triggerRef={actRef}
        onReturnFocus={returnFocus}
      />

      <SignProcessDialog
        process={open}
        onOpenChange={(next) => setOpenId(next ? next.id : null)}
        onSign={(process) => act("sign", new Set([process.id]))}
        onAct={(actId, process) => act(actId, new Set([process.id]))}
        onRecord={(process, outcome, on) =>
          record(new Map([[process.id, outcome]]), on)
        }
        onReturnFocus={returnFocus}
      />

      {/* What the last Enter did with the paper in the clerk's hand — the one thing the
          eye cannot catch, since a second cover for a case already picked changes nothing
          on screen. Outside every panel so it survives the view it was spoken on. */}
      <p aria-live="polite" className="sr-only">
        {picked}
      </p>
    </div>
  );
}

/**
 * The tab's statuses as a single-select pill row, All first — the pending-tasks row
 * (`chrome/pill-plate.ts`), one at a time (owner, 2026-10-06: *"the whole point of having
 * an All is so that I can see it collapse"*).
 *
 * `ToggleGroup type="single"` is the DS's own single choice: one tab stop, arrow keys
 * between pills. Pressing the pill already chosen would clear the group; the row always
 * has an answer, so that press is ignored. The counts are what each pill holds — the
 * number pressing it yields before any filter.
 */
function ProcessPills({
  tab,
  line,
  view,
  onChange,
}: {
  tab: ProcessTab;
  line: CourtProcess[];
  view: ProcessView;
  onChange: (view: ProcessView) => void;
}) {
  return (
    /* One provider for the row, so moving along the pills hands the tooltip straight
       from one to the next instead of waiting out the delay on each. */
    <TooltipProvider delayDuration={300}>
      <ToggleGroup
        type="single"
        size="lg"
        variant="default"
        value={view}
        onValueChange={(next) => {
          if (next) onChange(next as ProcessView);
        }}
        aria-label="Status"
        className={PILL_ROW}
      >
        <Pill
          value="all"
          label="All"
          hint={tab.allHint}
          /* All counts only where every status in it is work (Issuance); on Service it
             would be a total of mostly finished things. */
          count={allCounted(tab) ? processesIn(line, tab, "all").length : null}
        />
        {tab.statuses.map((id) => {
          const status = processStatus(id);
          const count = processesAt(line, id).length;
          return (
            <Pill
              key={id}
              value={id}
              label={status.label}
              hint={status.hint}
              count={status.counted ? count : null}
              /* An empty status cannot narrow anything — the pending-tasks rule — but
                 the pill you are standing on stays pressable. */
              disabled={count === 0 && view !== id}
            />
          );
        })}
      </ToggleGroup>
    </TooltipProvider>
  );
}

/**
 * One pill, and what it means on hover or focus (owner, 2026-10-06). The tooltip is a
 * gloss, not the only route to the meaning — the label says the status and the list says
 * the rest — so a touch screen without hover loses nothing it needs (ACCESSIBILITY §7).
 */
function Pill({
  value,
  label,
  hint,
  count,
  disabled,
}: {
  value: string;
  label: string;
  hint: string;
  /** `null` where the pill carries no count. */
  count: number | null;
  disabled?: boolean;
}) {
  return (
    <Tooltip>
      {/* The trigger is a wrapper, not the pill: Radix writes the tooltip's own
          `data-state` onto its trigger, which would overwrite the pill's `on` and drop
          the chosen tint. Focus on the pill still bubbles up and opens the tooltip. */}
      <TooltipTrigger asChild>
        <span className="inline-flex">
          <ToggleGroupItem
            value={value}
            disabled={disabled}
            aria-label={count === null ? label : `${label}, ${count}`}
            className={PILL_ITEM}
          >
            <span>{label}</span>
            {count === null ? null : (
              <span aria-hidden className={PILL_COUNT}>
                {count}
              </span>
            )}
          </ToggleGroupItem>
        </span>
      </TooltipTrigger>
      <TooltipContent side="bottom">{hint}</TooltipContent>
    </Tooltip>
  );
}

/**
 * Type, channel, hearing date and the search box — the court side's one filter surface,
 * applied as they are used.
 *
 * The channel select is absent on RPAD collection, where every row is RPAD and the
 * control would have one possible answer; the hearing-date picker is absent there too, as
 * the reference draws it. Every control carries a visible label (ACCESSIBILITY §12). The
 * placeholder names the one field the box matches — case number — and, where the view is
 * paper in hand, the Enter that puts a cover on the pile: a gesture nobody is told about
 * is a gesture nobody uses.
 */
function ProcessFiltersForm({
  leading,
  sort,
  onSortChange,
  tab,
  pile,
  filters,
  searchRef,
  onChange,
  onClear,
  onSubmit,
}: {
  /** The tab's status pills, heading the row. */
  leading?: React.ReactNode;
  sort: ProcessSort;
  onSortChange: (sort: ProcessSort) => void;
  tab: ProcessTab;
  pile: ProcessPile | undefined;
  filters: ProcessFilters;
  searchRef: React.RefObject<HTMLInputElement | null>;
  /** Merge a change into the filters — see `changeFilters`. */
  onChange: (patch: Partial<ProcessFilters>) => void;
  onClear: () => void;
  /** Enter in the box. Where the view is paper in hand it is the pile's fast path. */
  onSubmit: () => void;
}) {
  const fields: CourtFilterField[] = [
    {
      id: "sign-process-type",
      label: "Process type",
      value: filters.type,
      all: "all",
      allLabel: "All process types",
      options: COURT_PROCESS_TYPES.map((type) => ({
        value: type.id,
        label: type.label,
      })),
      onApply: (value) =>
        onChange({ type: value as ProcessFilters["type"] }),
    },
  ];
  if (tab.onlyChannel === undefined) {
    fields.push({
      id: "sign-process-channel",
      label: "Delivery channel",
      value: filters.channel,
      all: "all",
      allLabel: "All channels",
      options: PROCESS_CHANNELS.map((channel) => ({
        value: channel.id,
        label: channel.label,
      })),
      onApply: (value) =>
        onChange({ channel: value as ProcessFilters["channel"] }),
    });
  }

  if (tab.outcomeFilters) {
    fields.push(
      {
        id: "sign-process-outcome",
        label: "Outcome",
        value: filters.outcome,
        all: "all",
        allLabel: "All outcomes",
        options: OUTCOME_FILTERS.map((outcome) => ({
          value: outcome.id,
          label: outcome.label,
        })),
        onApply: (value) =>
          onChange({
            outcome: value as ProcessFilters["outcome"],
            /* A reason is a kind of failure; asking for successes drops it. */
            ...(value === "served" ? { reason: "all" as const } : {}),
          }),
      },
      {
        id: "sign-process-reason",
        label: "Reason not served",
        value: filters.reason,
        all: "all",
        allLabel: "All reasons",
        options: NON_SERVICE_REASONS.map((reason) => ({
          value: reason,
          label: reason,
        })),
        onApply: (value) =>
          onChange({
            reason: value as ProcessFilters["reason"],
            /* …and a reason only exists on a failure, so it says Failed for you. */
            ...(value === "all" ? {} : { outcome: "unserved" as const }),
          }),
      },
    );
  }

  return (
    <CourtFilters
      leading={leading}
      search={{
        label: "Search cases",
        value: filters.query,
        onChange: (query) => onChange({ query }),
        /* Says the gesture where there is one: on a pile view, Enter is what puts the
           cover in hand onto the pile. */
        placeholder: pile
          ? "Case number, then Enter"
          : "Search by case number",
        onSubmit,
      }}
      searchRef={searchRef}
      fields={fields}
      trailing={
        <CourtSortSelect
          id="sign-process-sort"
          value={sort}
          options={PROCESS_SORTS}
          onChange={onSortChange}
        />
      }
      onClearAll={onClear}
    />
  );
}

/**
 * The pile of envelopes, on screen — covers in hand, covers to post, or returns in hand.
 *
 * The clerk works a stack one cover at a time: type its case number, press Enter, put it
 * down, pick up the next — or tick it in the table, which feeds the same pile. The pile
 * survives search and every filter change, so seven envelopes in there is still a way to
 * tell whether the third went on. Each chip is a case — an envelope — with how many of
 * its processes are inside; the bar counts the processes the act will move.
 *
 * **A well, not a bordered box** — a sunken fill inside the panel, the entries flat white
 * on it (ui-craft §4).
 */
function ProcessSelectionTray({
  pile,
  cases,
  onRemoveCase,
  onClearSelection,
}: {
  pile: ProcessPile;
  cases: SelectedCase[];
  onRemoveCase: (caseNumber: string) => void;
  onClearSelection: () => void;
}) {
  const courtText = useCourtText();
  return (
    /* The chips and the one control that puts them all down, on one line: no count
       sentence above them (owner, 2026-10-06) — the chips are the count, and the bar
       already says how many processes are selected. */
    <section
      aria-label={`The pile: ${pile.noun}`}
      className="flex items-start gap-3 rounded-lg bg-surface-sunken p-3"
    >
      <ul className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
        {cases.map((entry) => (
          <li key={entry.caseNumber}>
            {/* The DS chip shape, inverted onto the well. 40px below `md`
                (ACCESSIBILITY §8). */}
            <span className="flex h-10 items-center gap-1.5 rounded-md bg-card pl-2.5 pr-1 text-caption md:h-8">
              <Identifier
                value={entry.caseNumber}
                label="case number"
                copyable={false}
              />
              <span className="tabular-nums text-muted-foreground">
                {entry.processes.length}
              </span>
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                className="max-md:size-10"
                aria-label={`Take ${courtText(entry.caseNumber)} out of the selection`}
                onClick={() => onRemoveCase(entry.caseNumber)}
              >
                <XIcon aria-hidden />
              </Button>
            </span>
          </li>
        ))}
      </ul>
      {/* The chips' own 32px from `md`, so the button sits level with the first line of
          chips rather than floating taller than them; 40px below `md`, like the chips.
          The default size keeps its text at the DS 14px — `xs` and `sm` drop to 12px. */}
      <Button
        type="button"
        variant="ghost"
        className="shrink-0 md:h-8"
        onClick={onClearSelection}
      >
        Clear selection
      </Button>
    </section>
  );
}

/**
 * What is selected, and what can be done to it.
 *
 * Sticky, because the list it commits is longer than a screen. Chrome, so it is `bg-card`
 * over a hairline seam; `z-30` is the chrome layer the app already uses.
 *
 * **One button per act the selection holds**, in the tab's own status order, each over
 * its own count. The first is the strong one and the rest are bordered — the Ration teal
 * Law, with the teal on the work that comes first in the line. With nothing selected the
 * view's own act stands disabled, so the bar says what it is for before anything is
 * picked; a view with no act (Completed, Failed) carries Download alone, which is the
 * truthful shape of a record.
 *
 * The line beside the buttons is `aria-live`: the selection changing, and what an act
 * did, are heard without going looking for them.
 */
function ProcessBar({
  tab,
  view,
  count,
  groups,
  notice,
  onDownload,
  onRequestAct,
}: {
  tab: ProcessTab;
  view: ProcessView;
  count: number;
  groups: { act: ProcessAct; rows: CourtProcess[] }[];
  notice: string;
  onDownload: () => void;
  /** Opens the act's confirmation. The button is handed over for focus to return to. */
  onRequestAct: (act: ProcessActId, button: HTMLButtonElement) => void;
}) {
  /* What the bar offers before anything is picked: the view's own act, or under All the
     first one the tab has. */
  const idleActId =
    view === "all"
      ? tab.statuses.map((id) => processStatus(id).act).find(Boolean)
      : processStatus(view).act;
  const idle = idleActId ? processAct(idleActId) : undefined;

  /* Rows the selection holds that no act takes — an SMS out with its channel, say, under
     a selection being recorded. Said, so the count on the buttons adds up. */
  const taken = groups.reduce((sum, group) => sum + group.rows.length, 0);
  const untaken = groups.length > 0 ? count - taken : 0;

  const summary =
    notice ||
    (count === 0
      ? idle
        ? "Select the processes to act on."
        : "Select the processes to download."
      : `${count} ${plural(count, "process", "processes")} selected${
          untaken > 0
            ? ` · ${untaken} ${plural(untaken, "is reported by its channel", "are reported by their channels")}`
            : ""
        }.`);

  return (
    /* `mt-auto`: with no pages a short list ends partway down the screen, and the bar
       followed it there with bare canvas beneath (owner, 2026-10-06). The page column is
       already the viewport's height, so the auto margin seats the bar on its floor;
       a long list still pushes it down and `sticky` takes over. */
    <div className="sticky bottom-0 z-30 -mx-6 -mb-6 mt-auto border-t border-hairline bg-card px-6 py-3 md:-mx-8 md:-mb-8 md:px-8 md:py-4">
      <div className="flex flex-wrap items-center justify-end gap-3">
        <p
          className="mr-auto text-body-compact text-muted-foreground tabular-nums"
          aria-live="polite"
        >
          {summary}
        </p>

        <Button
          type="button"
          variant="outline"
          disabled={count === 0}
          className="w-full sm:w-fit"
          onClick={onDownload}
        >
          {count > 0
            ? `Download ${count} ${plural(count, "document", "documents")}`
            : "Download selected documents"}
        </Button>

        {groups.length > 0 ? (
          groups.map((group, index) => (
            <Button
              key={group.act.id}
              type="button"
              variant={index === 0 ? "default" : "outline"}
              className="w-full sm:w-fit"
              onClick={(event) =>
                onRequestAct(group.act.id, event.currentTarget)
              }
            >
              {group.act.bar(group.rows.length)}
            </Button>
          ))
        ) : idle ? (
          <Button type="button" disabled className="w-full sm:w-fit">
            {idle.idle}
          </Button>
        ) : null}
      </div>
    </div>
  );
}

/**
 * Why the list is empty, and what to do about it.
 *
 * Three facts, so three states: the view is clear (its own words), a filter matched
 * nothing anywhere, or — the one a line has that a queue does not — **the row is in the
 * line, just not here**. A process moves, so a case number typed where the row was last
 * seen finds it one pill or one tab over; the statuses that have it say so by name, with
 * their counts, and take the search along when the bench follows them.
 *
 * Borderless and unpadded; the panel is already the frame.
 */
function ProcessEmpty({
  empty,
  isFiltered,
  elsewhere,
  onClear,
  onGoTo,
}: {
  empty: { title: string; description: string };
  isFiltered: boolean;
  elsewhere: { tab: ProcessTab; status: ProcessStatus; count: number }[];
  onClear: () => void;
  onGoTo: (status: ProcessStatus) => void;
}) {
  const found = isFiltered && elsewhere.length > 0;
  const total = elsewhere.reduce((sum, entry) => sum + entry.count, 0);

  return (
    <Empty className="border-0 p-0">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          {found ? (
            <ArrowRightIcon aria-hidden />
          ) : isFiltered ? (
            <SearchXIcon aria-hidden />
          ) : (
            <FileCheck2Icon aria-hidden />
          )}
        </EmptyMedia>
        <EmptyTitle className="text-title-s font-semibold">
          {found
            ? "Elsewhere in the line"
            : isFiltered
              ? "No process matches these filters"
              : empty.title}
        </EmptyTitle>
        <EmptyDescription className="text-body">
          {found
            ? `Nothing here matches, but ${total === 1 ? "1 process does" : `${total} processes do`} under another status. A process moves on as the court works it.`
            : isFiltered
              ? "No process anywhere in this line matches the type, channel, date or search you asked for."
              : empty.description}
        </EmptyDescription>
      </EmptyHeader>
      {isFiltered ? (
        <EmptyContent>
          <div className="flex flex-wrap items-center justify-center gap-2">
            {elsewhere.map((entry) => (
              <Button
                key={entry.status.id}
                variant="outline"
                onClick={() => onGoTo(entry.status)}
              >
                <span className="tabular-nums">
                  {entry.count} in {entry.status.label}
                </span>
              </Button>
            ))}
            <Button variant={found ? "ghost" : "outline"} onClick={onClear}>
              Clear filters
            </Button>
          </div>
        </EmptyContent>
      ) : null}
    </Empty>
  );
}

/**
 * The same rows below `md`, stacked — and under All, under the same status headings the
 * table bands by.
 *
 * The checkbox and the opener stay separate controls: one tap cannot mean both. The case
 * name is the keyboard button, with the instrument, channel, number, status and hearing
 * spelled out under it because there is no column header to name them.
 */
function ProcessItemList({
  tab,
  rows,
  banded,
  selectedIds,
  onToggle,
  onOpen,
}: {
  tab: ProcessTab;
  rows: CourtProcess[];
  banded: boolean;
  selectedIds: ReadonlySet<string>;
  onToggle: (process: CourtProcess) => void;
  onOpen: (process: CourtProcess) => void;
}) {
  const courtText = useCourtText();
  const bands: { status: ProcessStatus | null; rows: CourtProcess[] }[] = banded
    ? bandByStatus(rows, tab)
    : [{ status: null, rows }];
  const statusLine = tab.statuses.length > 1;

  return (
    <div className="flex flex-col gap-4">
      {bands.map((band) => (
        <section
          key={band.status?.id ?? "rows"}
          aria-label={band.status?.label}
          className="flex flex-col gap-3"
        >
          {band.status ? (
            <h3 className="flex items-baseline gap-2 text-body-compact font-semibold">
              {band.status.label}
              <span className="tabular-nums font-normal text-muted-foreground">
                {band.rows.length}
              </span>
            </h3>
          ) : null}
          <ul className="flex flex-col gap-3">
            {band.rows.map((process) => {
              const inline = courtProcessTypeInline(process.type);
              return (
                <QueueItemRow key={process.id} className="flex gap-3">
                  <span className="pt-0.5">
                    <Checkbox
                      checked={selectedIds.has(process.id)}
                      onCheckedChange={() => onToggle(process)}
                      aria-label={`Select the ${inline} in ${courtText(process.caseNumber)}`}
                    />
                  </span>
                  <div className="flex min-w-0 flex-1 flex-col gap-2">
                    <button
                      type="button"
                      onClick={() => onOpen(process)}
                      {...rowOpener}
                      className={rowOpenerClass}
                    >
                      <span className="sr-only">Read the {inline} in </span>
                      {causeTitle(process)}
                    </button>
                    <p className="min-w-0 text-body-compact">
                      {courtProcessTypeLabel(process.type)} ·{" "}
                      {processChannelLabel(process.channel)}
                    </p>
                    {statusLine ? (
                      <p className="min-w-0 text-body-compact">
                        <ProcessStatusText process={process} />
                      </p>
                    ) : null}
                    <p className="text-caption text-muted-foreground">
                      <Identifier
                        value={process.caseNumber}
                        label="case number"
                      />
                      {statusLine ? null : (
                        <>
                          {` · ${tab.dateColumn} `}
                          <span className="tabular-nums">
                            {formatProcessDate(process.paidOn)}
                          </span>
                        </>
                      )}
                      {" · Hearing "}
                      <span className="tabular-nums">
                        {formatProcessDate(process.hearingDate)}
                      </span>
                    </p>
                  </div>
                </QueueItemRow>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
