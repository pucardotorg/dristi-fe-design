"use client";

import * as React from "react";
import { FileSignatureIcon, SearchXIcon } from "lucide-react";

import { ListFooter } from "@/components/employee/list-footer";
import { QueueAnnouncer } from "@/components/employee/queue-announcer";
import { SignBailBondDialog } from "@/components/employee/sign-bail-bond-dialog";
import { SignBulkConfirmDialog } from "@/components/employee/sign-bulk-confirm-dialog";
import { SignBailBondsTable } from "@/components/employee/sign-bail-bonds-table";
import { QueueItemRow } from "@/components/employee/queue-item-row";
import {
  rowOpener,
  rowOpenerClass,
} from "@/lib/employee/row-activation";
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
import {
  causeTitle,
  PAGE_SIZE,
  type HearingsPageSize,
} from "@/lib/employee/hearings";
import {
  EMPTY_SIGN_BAIL_BOND_FILTERS,
  SIGN_BAIL_BOND_QUEUE,
  filterSignBailBonds,
  rejectBailBond,
  signSelectedBailBonds,
  todayIsoDay,
  type SignBailBond,
  type SignBailBondFilters,
} from "@/lib/employee/sign-bail-bonds";
import { Identifier } from "@/components/chrome/identifier";
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
  type ColumnFilter,
} from "@/lib/employee/court-column-filters";
import { useCourtText } from "@/components/court/court-provider";

/** No column on this queue divides it — every bond is the same act — so no filters. */
const BAIL_BOND_COLUMN_FILTERS: ColumnFilter<SignBailBond>[] = [];

type BailBondSort = "oldest" | "newest" | "name";

/** Oldest bond first — the one that has waited longest for the signature. */
const BAIL_BOND_SORTS: CourtSortSpec<SignBailBond, BailBondSort>[] = [
  ...daySorts<SignBailBond, BailBondSort>(
    (row) => row.addedOn,
    { id: "oldest", label: "Oldest first", latest: false },
    { id: "newest", label: "Newest first" },
  ),
  caseSorts<SignBailBond>()[2] as CourtSortSpec<SignBailBond, BailBondSort>,
];

function plural(count: number, one: string, many: string): string {
  return count === 1 ? one : many;
}

/**
 * Sign bail bonds — the bonds executed in this court and not yet signed by the bench.
 *
 * Deliberately the same screen as the signing queues above it in the rail, and as the
 * three review queues before those: the page title stands on the page, and **one** lifted
 * panel holds the search, the table and the pagination footer together. Same panel
 * recipe, same `gap-6` / `p-6`, same table treatment, same empty states, literally the
 * same footer component and the same shared confirmation. A bench moving between the
 * rail's rows is looking at one court's work through several windows, and should not have
 * to re-learn the furniture in between.
 *
 * What it does *not* borrow is the sibling's filter row. The reference gives this queue
 * one control — the case — and no status, date or type filter, so there is one field here
 * and Clear search returns the screen to the whole queue. A bond signed or rejected leaves
 * the list rather than staying behind a status this screen has no control to reach.
 *
 * Signing is the one court-side job the reference does in bulk, so selection lives in the
 * table and the commit lives in a sticky footer — `SignEvidenceScreen`'s recipe, and
 * persistent for its reason: a bar that materialises on the first tick shifts the row the
 * bench just clicked. Both paths end at the same Add signature step — e-sign, or upload
 * the bond the litigant and surety put their hands to — so the bench cannot be asked for
 * a signature two different ways. The bulk path confirms the count first, because those
 * bonds have not been read; the single path has just shown the document instead.
 *
 * The case name of each row opens the bond first, because a bench that cannot read what it
 * is signing should not be offered a signature.
 *
 * **Nothing is signed, published or refused.** Every path only moves a row's status in the
 * demo queue — see `lib/employee/sign-bail-bonds.ts`.
 */
export function SignBailBondsScreen() {
  const courtText = useCourtText();
  /* The queue is state because signing and rejecting change it. One list, so the table,
     the count in the header and the footer can never disagree about what is still
     pending. */
  const [bonds, setBonds] = React.useState<SignBailBond[]>(
    SIGN_BAIL_BOND_QUEUE,
  );
  /* One state, not a draft and an applied one: the list answers the controls as they
     are used, so there is never a moment where what the bench has asked for and what
     the table is showing disagree. Every change resets to page one — the old Search
     button did that, and a keystroke that narrows the list to four rows must not leave
     the reader on page three of nothing. */
  const [filters, setFilters] = React.useState<SignBailBondFilters>(
    EMPTY_SIGN_BAIL_BOND_FILTERS,
  );
  const [pageSize, setPageSize] = React.useState<HearingsPageSize>(PAGE_SIZE);
  const [page, setPage] = React.useState(1);
  const [picked, setPicked] = React.useState<ReadonlySet<string>>(
    () => new Set(),
  );
  /* The open bond is held by id, not by object: the queue is state, and a row captured
     before a signature would go stale the moment its status moved. */
  const [openId, setOpenId] = React.useState<string | null>(null);
  const [bulkOpen, setBulkOpen] = React.useState(false);
  const [announcement, setAnnouncement] = React.useState("");
  const searchRef = React.useRef<HTMLInputElement>(null);
  /* The bulk confirmation hands focus back here on the way out — see its `triggerRef`. */
  const signRef = React.useRef<HTMLButtonElement>(null);

  const pending = filterSignBailBonds(bonds, EMPTY_SIGN_BAIL_BOND_FILTERS);
  const [columns, setColumns] = React.useState(() =>
    emptyColumnFilters(BAIL_BOND_COLUMN_FILTERS),
  );
  const [sort, setSort] = React.useState<BailBondSort>("oldest");

  const rows = sortRows(
    applyColumnFilters(filterSignBailBonds(bonds, filters), BAIL_BOND_COLUMN_FILTERS, columns),
    BAIL_BOND_SORTS,
    sort,
  );
  const openBond = bonds.find((bond) => bond.id === openId) ?? null;

  const pageCount = Math.max(1, Math.ceil(rows.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const start = (currentPage - 1) * pageSize;
  const pageRows = rows.slice(start, start + pageSize);
  const isSearched = filters.query !== "";

  /* What the footer will actually sign: only bonds the bench can currently see. A row
     signed out from under the selection, or searched out of view, is dropped rather than
     counted — the button must never promise more than the list in front of it. It reaches
     across pages, so ten picked on page one still sign from page two. */
  const visibleIds = new Set(rows.map((bond) => bond.id));
  const selectedIds = new Set([...picked].filter((id) => visibleIds.has(id)));
  /* In list order, so the signature step's note reads the way the table does. */
  const selectedBonds = rows.filter((bond) => selectedIds.has(bond.id));

  function changeFilters(next: SignBailBondFilters) {
    setFilters(next);
    setPage(1);
  }

  function clearFilters() {
    changeFilters(EMPTY_SIGN_BAIL_BOND_FILTERS);
    setColumns(emptyColumnFilters(BAIL_BOND_COLUMN_FILTERS));
  }

  function toggle(bond: SignBailBond) {
    setPicked((current) => {
      const next = new Set(current);
      if (next.has(bond.id)) next.delete(bond.id);
      else next.add(bond.id);
      return next;
    });
  }

  /** The header checkbox: every row in view, or none of them. */
  function toggleAllInView(select: boolean) {
    setPicked((current) => {
      const next = new Set(current);
      for (const bond of pageRows) {
        if (select) next.add(bond.id);
        else next.delete(bond.id);
      }
      return next;
    });
  }

  /**
   * Both signing paths end here: the bonds are marked signed in this demo queue, the
   * selection that fed them is cleared, and what happened is spoken. Nothing leaves the
   * browser.
   */
  function sign(ids: ReadonlySet<string>) {
    const count = bonds.filter(
      (bond) => ids.has(bond.id) && bond.status === "pending-signature",
    ).length;
    if (count === 0) return;
    setBonds((current) => signSelectedBailBonds(current, ids, todayIsoDay()));
    setPicked((current) => {
      const next = new Set(current);
      for (const id of ids) next.delete(id);
      return next;
    });
    setAnnouncement(
      `${count} ${plural(count, "bail bond is", "bail bonds are")} marked signed on this screen. Nothing was published.`,
    );
  }

  /** Refusing one bond, from the preview. It leaves the queue unsigned. */
  function reject(bond: SignBailBond) {
    setBonds((current) => rejectBailBond(current, bond.id));
    setPicked((current) => {
      const next = new Set(current);
      next.delete(bond.id);
      return next;
    });
    setOpenId(null);
    setAnnouncement(
      `The bail bond of ${bond.litigant} in ${courtText(bond.caseNumber)} is marked rejected on this screen. Nothing was sent.`,
    );
  }

  function returnFocus() {
    searchRef.current?.focus();
  }

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      <div className="flex min-w-0 flex-1 flex-col gap-8 p-6 pb-0 md:p-8 md:pb-0">
        <header className="flex flex-col gap-2">
          <h1 className="text-title text-balance font-semibold">
            Sign bail bonds
          </h1>
          {/* The count is the whole point of the queue, so the supporting line carries it
              rather than restating the title. Singular is spelled out because "1 bail
              bonds" is the kind of thing a court notices. */}
          <p className="text-body text-muted-foreground">
            {pending.length === 1
              ? "1 bail bond is waiting for your signature."
              : `${pending.length} bail bonds are waiting for your signature.`}
          </p>
        </header>

        {/* One panel: the search, the list and the pager are one unit of work, so they
            share one lifted sheet — the same recipe every other court-side list uses.
            Nothing inside draws a second frame. */}
        <section className="flex min-w-0 flex-col gap-6 rounded-xl border border-hairline bg-card shadow-raised p-6">
          <SignBailBondSearch
            filters={filters}
            searchRef={searchRef}
            onChange={changeFilters}
            onClear={clearFilters}
            fields={columnFilterFields(BAIL_BOND_COLUMN_FILTERS, columns, (id, value) => {
              setColumns((current) => ({ ...current, [id]: value }));
              setPage(1);
            })}
            trailing={
              <CourtSortSelect
                id="bail-bonds-sort"
                value={sort}
                options={sortOptions(BAIL_BOND_SORTS)}
                onChange={(next) => {
                  setSort(next);
                  setPage(1);
                }}
              />
            }
          />

          {/* Mounted whatever the list is doing, including empty — see `QueueAnnouncer`. */}
          <QueueAnnouncer
            from={start + 1}
            to={start + pageRows.length}
            total={rows.length}
          />

          {pageRows.length === 0 ? (
            <SignBailBondsEmpty isSearched={isSearched} onClear={clearFilters} />
          ) : (
            <div className="flex min-w-0 flex-col gap-4">
              {/* min-w-0 lets this flex item shrink below the table's content width, so a
                  wide table scrolls inside the panel instead of pushing the page
                  sideways. */}
              <div className="min-w-0 overflow-x-auto">
                {/* Four columns do not survive a phone. Below `md` the same rows stack as
                    items — the answer the rest of the court side already gives. */}
                <div className="hidden md:block">
                  <SignBailBondsTable
                    rows={pageRows}
                    selectedIds={selectedIds}
                    onToggle={toggle}
                    onToggleAll={toggleAllInView}
                    onOpen={(bond) => setOpenId(bond.id)}
                  />
                </div>
                <div className="md:hidden">
                  <SignBailBondsItemList
                    rows={pageRows}
                    selectedIds={selectedIds}
                    onToggle={toggle}
                    onOpen={(bond) => setOpenId(bond.id)}
                  />
                </div>
              </div>

              <ListFooter
                id="sign-bail-bonds-page-size"
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

      {/* What is selected, and the one act. The court side's own chrome for a screen whose
          act lives at the bottom: `bg-card` over a hairline seam, never the panel's
          full-strength edge (ui-craft §4, layer 2). `z-30` is the chrome layer this app
          already uses — the top bar and the filing footer both sit there.

          Persistent rather than appearing on the first tick: a bar that materialises under
          the cursor shifts the row the bench just clicked. Empty-handed it holds a
          disabled button and says what to do instead. */}
      <footer className="sticky bottom-0 z-30 mt-8 border-t border-hairline bg-card px-6 py-3 md:px-8 md:py-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <p
            className="text-body-compact text-muted-foreground tabular-nums sm:mr-auto"
            aria-live="polite"
          >
            {selectedIds.size === 0
              ? "Select the bail bonds to sign them together."
              : `${selectedIds.size} ${plural(selectedIds.size, "bail bond", "bail bonds")} selected.`}
          </p>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            {selectedIds.size > 0 ? (
              <Button
                type="button"
                variant="ghost"
                className="w-full sm:w-fit"
                onClick={() => setPicked(new Set())}
              >
                Clear selection
              </Button>
            ) : null}
            {/* The count rides the label once there is one, the way every signing
                queue's bar does — the button the bench presses says the same number the
                confirmation is about to ask them to confirm. */}
            <Button
              ref={signRef}
              type="button"
              className="w-full sm:w-fit"
              disabled={selectedIds.size === 0}
              onClick={() => setBulkOpen(true)}
            >
              {selectedIds.size > 0
                ? `Sign ${selectedIds.size} ${plural(selectedIds.size, "bail bond", "bail bonds")}`
                : "Sign selected bail bonds"}
            </Button>
          </div>
        </div>
      </footer>

      {/* What actually changed, for anyone not watching the list. The count line in the
          footer is polite too, but it reports a total rather than an act. */}
      <p aria-live="polite" className="sr-only">
        {announcement}
      </p>

      {/* Confirm the count, then say what became of it — the shared bulk confirmation
          every signing queue runs. One bond sees the confirmation like any other count:
          the signature method is not asked for on this path, so there is no longer a
          step for a single selection to skip ahead to. */}
      <SignBulkConfirmDialog
        noun="bail bond"
        count={selectedBonds.length}
        selection={{ cases: selectedBonds.map((bond) => bond.caseNumber) }}
        open={bulkOpen}
        onOpenChange={setBulkOpen}
        onConfirm={() => sign(selectedIds)}
        triggerRef={signRef}
        onReturnFocus={returnFocus}
      />

      <SignBailBondDialog
        bond={openBond}
        onOpenChange={(bond) => setOpenId(bond?.id ?? null)}
        onSign={(bond) => {
          setOpenId(null);
          sign(new Set([bond.id]));
        }}
        onReject={reject}
        onReturnFocus={returnFocus}
      />
    </div>
  );
}

/**
 * The search box and the order on the end of the row — the court-side filter row
 * (`CourtFilters`). The label is "Search cases", like every other court list.
 */
function SignBailBondSearch({
  filters,
  searchRef,
  onChange,
  onClear,
  fields,
  trailing,
}: {
  filters: SignBailBondFilters;
  searchRef: React.RefObject<HTMLInputElement | null>;
  onChange: (filters: SignBailBondFilters) => void;
  onClear: () => void;
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
        placeholder: "Case name, number or litigant",
      }}
      searchRef={searchRef}
      fields={fields}
      trailing={trailing}
      onClearAll={onClear}
    />
  );
}

/**
 * Why the list is empty, and what to do about it.
 *
 * Two different facts, so two different states: a search that matched nothing is a dead
 * end with an action worth offering, while an empty queue is the bench being up to date —
 * the same good-empty the sibling queues use. Borderless and unpadded; the panel is
 * already the frame.
 */
function SignBailBondsEmpty({
  isSearched,
  onClear,
}: {
  isSearched: boolean;
  onClear: () => void;
}) {
  return (
    <Empty className="border-0 p-0">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          {isSearched ? (
            <SearchXIcon aria-hidden />
          ) : (
            <FileSignatureIcon aria-hidden />
          )}
        </EmptyMedia>
        <EmptyTitle className="text-title-s font-semibold">
          {isSearched ? "No bail bond matches this search" : "Nothing to sign"}
        </EmptyTitle>
        <EmptyDescription className="text-body">
          {isSearched
            ? "No bail bond in this queue matches the case name, number or litigant you asked for."
            : "No bail bond is waiting for your signature."}
        </EmptyDescription>
      </EmptyHeader>
      {isSearched ? (
        <EmptyContent>
          <Button variant="outline" onClick={onClear}>
            Clear search
          </Button>
        </EmptyContent>
      ) : null}
    </Empty>
  );
}

/**
 * The same rows below `md`, stacked.
 *
 * The checkbox and the opener stay separate controls here too, for the same reason they do
 * in the table: one tap cannot mean both. The checkbox takes the leading column at its
 * full 40px target, and the case name beside it is the button that opens the bond — with
 * the litigant and the number under it, spelled out because there is no column header to
 * name them.
 */
function SignBailBondsItemList({
  rows,
  selectedIds,
  onToggle,
  onOpen,
}: {
  rows: SignBailBond[];
  selectedIds: ReadonlySet<string>;
  onToggle: (bond: SignBailBond) => void;
  onOpen: (bond: SignBailBond) => void;
}) {
  const courtText = useCourtText();
  return (
    <ul className="flex flex-col gap-3">
      {rows.map((bond) => (
        <QueueItemRow
          key={bond.id}
          className="flex gap-3"
        >
          {/* The DS box expands its own hit area to 40×40; the name it carries is the bond
              and its case, not the column, because a row read aloud has no column
              header. */}
          <span className="pt-0.5">
            <Checkbox
              checked={selectedIds.has(bond.id)}
              onCheckedChange={() => onToggle(bond)}
              aria-label={`Select the bail bond of ${bond.litigant} in ${courtText(bond.caseNumber)}`}
            />
          </span>
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <button
              type="button"
              onClick={() => onOpen(bond)}
              {...rowOpener}
                className={rowOpenerClass}
            >
              <span className="sr-only">
                {`Read the bail bond of ${bond.litigant} in `}
              </span>
              {causeTitle(bond)}
            </button>
            <p className="min-w-0 text-body-compact">
              Litigant: {bond.litigant}
            </p>
            <Identifier
              value={bond.caseNumber}
              label="case number"
              className="self-start text-caption text-muted-foreground"
            />
          </div>
        </QueueItemRow>
      ))}
    </ul>
  );
}
