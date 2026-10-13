"use client";

import * as React from "react";
import { FolderCheckIcon, SearchXIcon } from "lucide-react";

import { ListFooter } from "@/components/employee/list-footer";
import { QueueAnnouncer } from "@/components/employee/queue-announcer";
import { CourtFilters, CourtSortSelect } from "@/components/employee/court-filters";
import { SignBulkConfirmDialog } from "@/components/employee/sign-bulk-confirm-dialog";
import { SignFormDialog } from "@/components/employee/sign-form-dialog";
import { SignFormsTable } from "@/components/employee/sign-forms-table";
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
  formatListingDate,
  isoDay,
  parseIsoDay,
  PAGE_SIZE,
  type HearingsPageSize,
} from "@/lib/employee/hearings";
import {
  EMPTY_SIGN_FORM_FILTERS,
  SIGN_FORM_PROCESSES,
  SIGN_FORM_QUEUE,
  filterSignForms,
  formatSignFormDate,
  signFormProcessLabel,
  type SignForm,
  type SignFormFilters,
} from "@/lib/employee/sign-forms";
import { Identifier } from "@/components/chrome/identifier";
import {
  caseSorts,
  daySorts,
  sortOptions,
  sortRows,
  type CourtSortSpec,
} from "@/lib/employee/court-sort";
import { useCourtText } from "@/components/court/court-provider";

type SignFormSort = "oldest-created" | "newest-created" | "name";

/** Oldest form first, by the Date created column — what has waited longest for a signature. */
const SIGN_FORM_SORTS: CourtSortSpec<SignForm, SignFormSort>[] = [
  ...daySorts<SignForm, SignFormSort>(
    (row) => row.createdOn,
    { id: "oldest-created", label: "Oldest first", latest: false },
    { id: "newest-created", label: "Newest first" },
  ),
  caseSorts<SignForm>()[2] as CourtSortSpec<SignForm, SignFormSort>,
];

/**
 * Sign forms — the forms this court has drawn up and not yet signed.
 *
 * The same screen as its three siblings in the rail: the page title stands on the page,
 * and **one** lifted panel holds the filters, the table and the pagination footer
 * together. Same panel recipe, same `gap-6` / `p-6`, same table treatment, literally
 * the same footer component. A bench moving from "Register cases" to "Sign forms" is
 * looking at one court's work at two moments and should not have to re-learn the
 * furniture in between.
 *
 * What differs is that this queue is worked in bulk. Signing is the one court-side act
 * the reference does to many rows at once, so the rows carry checkboxes and the screen
 * grows a sticky bar — the order composer's own footer recipe — holding what is
 * selected and the one act. The single-document path is still there: the cause title
 * opens the form, and the bench reads it before signing.
 *
 * **Nothing on this screen signs anything.** Both paths drop their rows from the demo
 * queue and nothing else — see `lib/employee/sign-forms.ts`. No signature is applied,
 * no document is written, no provider is called, and nothing persists past a reload.
 */
export function SignFormsScreen() {
  /* One state, not a draft and an applied one: the list answers the controls as they
     are used — every one of them, so the screen has a single rule rather than a live
     one and a deferred one. Every change resets to page one; the old Search button did
     that, and a keystroke that narrows the list to four rows must not leave the reader
     on page three of nothing. */
  const [filters, setFilters] = React.useState<SignFormFilters>(
    EMPTY_SIGN_FORM_FILTERS,
  );
  const [pageSize, setPageSize] = React.useState<HearingsPageSize>(PAGE_SIZE);
  const [page, setPage] = React.useState(1);
  const [signedIds, setSignedIds] = React.useState<ReadonlySet<string>>(
    () => new Set(),
  );
  const [picked, setPicked] = React.useState<ReadonlySet<string>>(
    () => new Set(),
  );
  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const [open, setOpen] = React.useState<SignForm | null>(null);
  const [announcement, setAnnouncement] = React.useState("");
  const searchRef = React.useRef<HTMLInputElement>(null);
  /* The bulk confirmation hands focus back here on the way out — see its `triggerRef`. */
  const signRef = React.useRef<HTMLButtonElement>(null);

  const remaining = SIGN_FORM_QUEUE.filter((form) => !signedIds.has(form.id));
  const [sort, setSort] = React.useState<SignFormSort>("oldest-created");

  const rows = sortRows(filterSignForms(remaining, filters), SIGN_FORM_SORTS, sort);

  const pageCount = Math.max(1, Math.ceil(rows.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const start = (currentPage - 1) * pageSize;
  const pageRows = rows.slice(start, start + pageSize);
  const isFiltered =
    filters.process !== "all" || filters.createdOn !== "" || filters.query !== "";

  /**
   * What is selected *and* still in the list.
   *
   * Selection survives paging — a bench clearing a queue works down it page by page —
   * but never reaches past a filter. A stored id whose row the current filter excludes
   * is held rather than dropped (clearing the filter brings the selection back) and is
   * excluded from every count and from the act itself, so the bar can never offer to
   * sign a form that is not on screen to be checked.
   */
  const selectedForms = rows.filter((form) => picked.has(form.id));
  const selectedIds = new Set(selectedForms.map((form) => form.id));

  /**
   * Change some of the filters. A patch, merged into the latest state: the Filters sheet
   * applies every field it changed in one go, and a whole set built by each field from
   * this render's `filters` kept only the last field's change.
   */
  function changeFilters(patch: Partial<SignFormFilters>) {
    setFilters((current) => ({ ...current, ...patch }));
    setPage(1);
  }

  function clearFilters() {
    changeFilters(EMPTY_SIGN_FORM_FILTERS);
  }

  function toggle(form: SignForm) {
    setPicked((current) => {
      const next = new Set(current);
      if (next.has(form.id)) next.delete(form.id);
      else next.add(form.id);
      return next;
    });
  }

  /** The header checkbox: every row on the page in view, not the whole queue. */
  function toggleAll(select: boolean) {
    setPicked((current) => {
      const next = new Set(current);
      for (const form of pageRows) {
        if (select) next.add(form.id);
        else next.delete(form.id);
      }
      return next;
    });
  }

  /** Both paths end here: the rows leave the demo queue, and nothing else happens. */
  function removeFromQueue(ids: string[], spoken: string) {
    setSignedIds((current) => {
      const next = new Set(current);
      for (const id of ids) next.add(id);
      return next;
    });
    setPicked((current) => {
      const next = new Set(current);
      for (const id of ids) next.delete(id);
      return next;
    });
    setAnnouncement(spoken);
  }

  function signSelected() {
    const ids = selectedForms.map((form) => form.id);
    removeFromQueue(
      ids,
      ids.length === 1
        ? "1 form left the signing queue."
        : `${ids.length} forms left the signing queue.`,
    );
  }

  function signOne(form: SignForm) {
    setOpen(null);
    removeFromQueue([form.id], `${causeTitle(form)} left the signing queue.`);
  }

  function returnFocus() {
    searchRef.current?.focus();
  }

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      <div className="flex min-w-0 flex-1 flex-col gap-8 p-6 pb-0 md:p-8 md:pb-0">
        <header className="flex flex-col gap-2">
          <h1 className="text-title text-balance font-semibold">
            Sign forms
          </h1>
          {/* The count is the whole point of the queue, so the supporting line carries
              it rather than restating the title. Singular is spelled out because
              "1 forms" is the kind of thing a court notices. */}
          <p className="text-body text-muted-foreground">
            {remaining.length === 1
              ? "1 form is waiting for your signature."
              : `${remaining.length} forms are waiting for your signature.`}
          </p>
        </header>

        {/* One panel: filters, list and footer are one unit of work, so they share one
            lifted sheet — the same recipe every other court-side list uses. Nothing
            inside draws a second frame. */}
        <section className="flex min-w-0 flex-col gap-6 rounded-xl border border-hairline bg-card shadow-raised p-6">
          <SignFormsFilters
            filters={filters}
            searchRef={searchRef}
            onChange={changeFilters}
            onClear={clearFilters}
            trailing={
              <CourtSortSelect
                id="sign-forms-sort"
                value={sort}
                options={sortOptions(SIGN_FORM_SORTS)}
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
            <SignFormsEmpty isFiltered={isFiltered} onClear={clearFilters} />
          ) : (
            <div className="flex min-w-0 flex-col gap-4">
              {/* min-w-0 lets this flex item shrink below the table's content width, so
                  a wide table scrolls inside the panel instead of pushing the page
                  sideways. */}
              <div className="min-w-0 overflow-x-auto">
                {/* Five columns do not survive a phone. Below `md` the same rows stack
                    as items, each keeping its own checkbox. */}
                <div className="hidden md:block">
                  <SignFormsTable
                    rows={pageRows}
                    selectedIds={selectedIds}
                    onToggle={toggle}
                    onToggleAll={toggleAll}
                    onOpen={setOpen}
                  />
                </div>
                <div className="md:hidden">
                  <SignFormsItemList
                    rows={pageRows}
                    selectedIds={selectedIds}
                    onToggle={toggle}
                    onOpen={setOpen}
                  />
                </div>
              </div>

              <ListFooter
                id="sign-forms-page-size"
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

      {/* What is selected, and the one act. The order composer's footer recipe — the
          court side's own chrome for a screen whose act lives at the bottom.

          Persistent rather than appearing on the first tick: a bar that materialises
          under the cursor shifts the row the bench just clicked. Empty-handed it holds
          a disabled button and says what to do instead. */}
      <footer className="sticky bottom-0 z-30 mt-8 border-t border-hairline bg-card px-6 py-3 md:px-8 md:py-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <p
            className="text-body-compact text-muted-foreground sm:mr-auto"
            aria-live="polite"
          >
            {selectedIds.size === 0
              ? "Select forms to sign them together."
              : selectedIds.size === 1
                ? "1 form selected."
                : `${selectedIds.size} forms selected.`}
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
              onClick={() => setConfirmOpen(true)}
            >
              {selectedIds.size > 0
                ? `Sign ${selectedIds.size} ${selectedIds.size === 1 ? "form" : "forms"}`
                : "Sign selected forms"}
            </Button>
          </div>
        </div>
      </footer>

      {/* What actually changed, for anyone not watching the list. The count line in the
          panel footer is polite too, but it reports a total rather than an act. */}
      <p aria-live="polite" className="sr-only">
        {announcement}
      </p>

      {/* Confirm the count, then say what became of it — the shared bulk confirmation
          every signing queue runs. The signature method is not asked for here: this
          path opened no document, and only the single-form path still asks. */}
      <SignBulkConfirmDialog
        noun="form"
        count={selectedForms.length}
        selection={{
          cases: selectedForms.map((form) => form.caseNumber),
          kinds: selectedForms.map((form) => signFormProcessLabel(form.process)),
        }}
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        onConfirm={signSelected}
        triggerRef={signRef}
        onReturnFocus={returnFocus}
      />

      <SignFormDialog
        form={open}
        onOpenChange={setOpen}
        onSign={signOne}
        onReturnFocus={returnFocus}
      />
    </div>
  );
}

/**
 * Process, date and free text, then apply — the reference's three controls, laid out
 * the way every other court-side queue lays out its own.
 *
 * Every control carries a visible label. The reference labels the search box with the
 * things it searches, which is a hint rather than a name; ACCESSIBILITY §12 wants a
 * permanent label, so "Search cases" is the deviation, and the smallest one available.
 * The placeholder keeps the reference's reach.
 *
 * "Search" is not the teal one here, and that is the one place this screen departs from
 * the reference's colour. The Ration Teal Law allows a single strong action per view,
 * and on a screen whose whole purpose is signing it belongs to Sign selected forms in
 * the bar below. Search drops to outline.
 */
function SignFormsFilters({
  filters,
  searchRef,
  onChange,
  onClear,
  trailing,
}: {
  filters: SignFormFilters;
  searchRef: React.Ref<HTMLInputElement>;
  /** Merge a change into the filters — a patch, not a whole set. */
  onChange: (patch: Partial<SignFormFilters>) => void;
  onClear: () => void;
  /** The list's sort control (`CourtSortSelect`), at the end of the row. */
  trailing?: React.ReactNode;
}) {
  return (
    <CourtFilters
      search={{
        label: "Search cases",
        value: filters.query,
        onChange: (query) => onChange({ query }),
        placeholder: "Case name, number or advocate",
      }}
      searchRef={searchRef}
      fields={[
        {
          id: "sign-forms-process",
          label: "Process type",
          value: filters.process,
          all: "all",
          allLabel: "All process types",
          options: SIGN_FORM_PROCESSES.map((process) => ({
            value: process.id,
            label: process.label,
          })),
          onApply: (value) =>
            onChange({ process: value as SignFormFilters["process"] }),
        },
      ]}
      date={{
        label: "Date created",
        value: filters.createdOn ? parseIsoDay(filters.createdOn) : undefined,
        active: filters.createdOn !== "",
        chipLabel: filters.createdOn ? formatListingDate(filters.createdOn) : "",
        draftActive: (value) => !!value,
        cleared: undefined,
        onApply: (value) =>
          onChange({ createdOn: value ? isoDay(value) : "" }),
      }}
      trailing={trailing}
      onClearAll={onClear}
    />
  );
}

/**
 * Why the list is empty, and what to do about it.
 *
 * Two different facts, so two different states: a filter that matched nothing is a dead
 * end with an action worth offering, while an empty queue is the bench being up to
 * date — the same good-empty the register queue already uses. Borderless and unpadded;
 * the panel is already the frame.
 */
function SignFormsEmpty({
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
            <FolderCheckIcon aria-hidden />
          )}
        </EmptyMedia>
        <EmptyTitle className="text-title-s font-semibold">
          {isFiltered ? "No forms match these filters" : "Nothing left to sign"}
        </EmptyTitle>
        <EmptyDescription className="text-body">
          {isFiltered
            ? "No form waiting for signature matches the process, date or search you asked for."
            : "Every form drawn up by this court has been signed."}
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
 * A signing queue read on a phone is still what to sign and what it is about, so the
 * checkbox stays — bulk signing is the point of the screen and dropping it on small
 * screens would make the phone a read-only view of a queue that cannot be worked.
 */
function SignFormsItemList({
  rows,
  selectedIds,
  onToggle,
  onOpen,
}: {
  rows: SignForm[];
  selectedIds: ReadonlySet<string>;
  onToggle: (form: SignForm) => void;
  onOpen: (form: SignForm) => void;
}) {
  const courtText = useCourtText();
  return (
    <ul className="flex flex-col gap-3">
      {rows.map((form) => (
        <QueueItemRow
          key={form.id}
          className="flex items-start gap-3"
        >
          <Checkbox
            checked={selectedIds.has(form.id)}
            onCheckedChange={() => onToggle(form)}
            aria-label={`Select ${causeTitle(form)}, ${courtText(form.caseNumber)}`}
            className="mt-1"
          />
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <button
              type="button"
              onClick={() => onOpen(form)}
              {...rowOpener}
                className={rowOpenerClass}
            >
              <span className="sr-only">Read and sign </span>
              {causeTitle(form)}
            </button>
            <p className="text-caption text-muted-foreground">
              <Identifier value={form.caseNumber} label="case number" />
              {" · "}
              {signFormProcessLabel(form.process)}
              {" · "}
              <span className="tabular-nums">
                {formatSignFormDate(form.createdOn)}
              </span>
            </p>
          </div>
        </QueueItemRow>
      ))}
    </ul>
  );
}
