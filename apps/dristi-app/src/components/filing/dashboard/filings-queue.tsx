"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  ArrowRightIcon,
  ChevronDownIcon,
  InboxIcon,
  PenToolIcon,
  SearchIcon,
  Trash2Icon,
  WalletIcon,
} from "lucide-react";

import {
  applyQueueFilters,
  courtsOf,
  defaultSortFor,
  isQueueTab,
  pageWindow,
  QUEUE_TABS,
  sortOptionFor,
  TAB_LAYOUT,
  TAB_SORTS,
  type ColumnId,
  type QueueRow,
  type QueueTab,
} from "@/lib/filing/queue";
import { money } from "@/lib/filing/format";
import { NEW_FILING } from "@/lib/filing/steps";
import { cn } from "@/lib/utils";
import { withOrigin } from "@/lib/nav/origin";
import { useMediaQuery } from "@/hooks/use-media-query";
import { RegisterTrayCard, useOneOpen } from "@/components/cases/register-card";
import {
  REGISTER_CARDS_ONLY,
  REGISTER_CARDS_QUERY,
  REGISTER_TABLE_ONLY,
  SHOW_MORE_STEP,
} from "@/components/cases/register-layout";
import { Identifier } from "@/components/chrome/identifier";
import { OverflowTabsList } from "@/components/chrome/overflow-tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { rowActivation, rowOpener } from "@/lib/employee/row-activation";
import { Tabs, TabsContent } from "@/components/ui/tabs";


/** The tone words, so a colour is never the only thing saying "this one is late". */
const TONE_CLASS: Record<QueueRow["info"]["tone"], string> = {
  default: "text-muted-foreground",
  warning: "text-warning-ink",
  danger: "text-destructive-ink",
};

/** Matches the cases list, so the app's two tables of cases page the same way. */
const PAGE_SIZES = [10, 15, 20, 25, 30] as const;
const DEFAULT_PAGE_SIZE = 10;

export type QueueData = Record<QueueTab, QueueRow[]>;

/* The desk layout, stated twice because Tailwind has no "or": a mouse from `md`, or any
   landscape screen from `md`. Everything else (phones, upright tablets) is the base. */
const DESK_TOOLBAR =
  "md:pointer-fine:flex md:pointer-fine:flex-wrap md:pointer-fine:gap-3 md:pointer-fine:px-6 md:landscape:flex md:landscape:flex-wrap md:landscape:gap-3 md:landscape:px-6";
const DESK_SEARCH =
  "md:pointer-fine:min-w-60 md:pointer-fine:flex-1 md:landscape:min-w-60 md:landscape:flex-1";
const DESK_AUTO = "md:pointer-fine:w-auto md:landscape:w-auto";
const DESK_GUTTER = "md:pointer-fine:px-6 md:landscape:px-6";
const DESK_HEAD = "md:pointer-fine:px-6 md:pointer-fine:pt-6 md:landscape:px-6 md:landscape:pt-6";
const DESK_PAGER = "hidden md:pointer-fine:flex md:landscape:flex";

/** The view, as it lives in the URL — so back, refresh and a shared link all restore it. */
type View = {
  tab: QueueTab;
  q: string;
  court: string;
  sort: string;
  page: number;
  size: number;
};

function readView(params: URLSearchParams): View {
  const tabParam = params.get("tab");
  const tab: QueueTab = isQueueTab(tabParam) ? tabParam : "drafts";
  const size = Number(params.get("size"));
  return {
    tab,
    q: params.get("q") ?? "",
    court: params.get("court") ?? "",
    sort: sortOptionFor(tab, params.get("sort")).value,
    page: Math.max(1, Number(params.get("page")) || 1),
    size: (PAGE_SIZES as readonly number[]).includes(size) ? size : DEFAULT_PAGE_SIZE,
  };
}

/** Only what differs from the default is written, so a plain `/filings` stays plain. */
function writeView(view: View): string {
  const params = new URLSearchParams();
  if (view.tab !== "drafts") params.set("tab", view.tab);
  if (view.q) params.set("q", view.q);
  if (view.court) params.set("court", view.court);
  if (view.sort !== defaultSortFor(view.tab)) params.set("sort", view.sort);
  if (view.page > 1) params.set("page", String(view.page));
  if (view.size !== DEFAULT_PAGE_SIZE) params.set("size", String(view.size));
  const query = params.toString();
  return query ? `?${query}` : "";
}

/**
 * Everything filed, in four states, over one row model.
 *
 * The tab carries the status, so no row repeats it as a badge — the cure for the constant
 * Status column the old dashboard had. Each row gets one action, which links into the
 * screen that owns that work rather than restating it here.
 *
 * View state lives in the URL, the way `/cases` already does it: open a case from a row,
 * come back, and the tab, search, filter and page are still there.
 */
/** The one bulk act each selectable tab offers — never more than one at a time. */
const BULK_KIND: Partial<Record<QueueTab, "discard" | "sign" | "pay">> = {
  drafts: "discard",
  pendingSignature: "sign",
  pendingPayment: "pay",
};

/**
 * Whether one row can join this tab's bulk act. Every drafts row can be discarded and
 * every pending-payment row can be paid, but a pending-signature row is only yours to
 * bulk-sign when you are one of the people still asked — ticking it would otherwise
 * promise a signature the batch cannot actually collect.
 */
function rowBulkable(tab: QueueTab, row: QueueRow): boolean {
  return tab === "pendingSignature" ? !!row.youPending : true;
}

export function FilingsQueue({
  data,
  ready,
  onDiscard,
  onBulk,
}: {
  data: QueueData;
  ready: boolean;
  /** Throwing drafts away is the one destructive act here; the screen owns the
      confirmation, the row (or the selection) only asks for it. */
  onDiscard: (ids: string[]) => void;
  /** Bulk sign or bulk pay — the screen owns the one-OTP / one-transaction dialog,
      the row (or the selection) only names what it acts on. */
  onBulk: (kind: "sign" | "pay", rows: QueueRow[]) => void;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const view = readView(new URLSearchParams(searchParams.toString()));

  /* Drafts, pending-signature and pending-payment rows can be ticked and acted on
     together; the other tabs have no bulk act to offer. The selection is this screen's,
     not the URL's, and it empties when the tab changes — a row ticked on Drafts means
     nothing on Registered. */
  const bulkKind = BULK_KIND[view.tab];
  const selectable = !!bulkKind;
  const [selected, setSelected] = React.useState<ReadonlySet<string>>(() => new Set());
  const [selectedTab, setSelectedTab] = React.useState(view.tab);
  /* Under a finger the list is cards that grow by "Show more" and has no pages (owner,
     Sept 21); the table keeps its pager. One tray open at a time. */
  const cards = useMediaQuery(REGISTER_CARDS_QUERY);
  const [visible, setVisible] = React.useState(SHOW_MORE_STEP);
  const tray = useOneOpen<string>();
  if (selectedTab !== view.tab) {
    setSelectedTab(view.tab);
    setSelected(new Set());
    setVisible(SHOW_MORE_STEP);
  }
  const toggleSelected = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const setManySelected = (ids: string[], on: boolean) =>
    setSelected((prev) => {
      const next = new Set(prev);
      for (const id of ids) {
        if (on) next.add(id);
        else next.delete(id);
      }
      return next;
    });

  const go = React.useCallback(
    (next: Partial<View>) => {
      router.replace(`${pathname}${writeView({ ...view, ...next })}`, { scroll: false });
    },
    [router, pathname, view]
  );

  /*
   * Every row action leaves this screen, and three of the four leave the area entirely —
   * the scrutiny correction round lives under `/tasks`. The view is recorded on the link
   * so the breadcrumb over there can bring the person back to this tab, this search, this
   * page, rather than to whichever root that screen's route happens to sit under.
   */
  const here = `${pathname}${writeView(view)}`;

  const rows = data[view.tab];
  const layout = TAB_LAYOUT[view.tab];
  const courts = React.useMemo(() => courtsOf(rows), [rows]);
  const sort = sortOptionFor(view.tab, view.sort);

  // A court chosen on one tab may not exist on the next. Rather than silently filtering
  // everything out, the filter drops itself — the search carries over, because a party
  // name means the same thing on every tab.
  const court = courts.includes(view.court) ? view.court : "";

  const filtered = React.useMemo(
    () => applyQueueFilters(rows, { q: view.q, court, sort }),
    [rows, view.q, court, sort]
  );

  const pageCount = Math.max(1, Math.ceil(filtered.length / view.size));
  const page = Math.min(view.page, pageCount);
  const start = (page - 1) * view.size;
  const slice = cards ? filtered.slice(0, visible) : filtered.slice(start, start + view.size);

  /* Rows that were ticked and then filtered or paged away still count — the bulk
     button names how many, and (for a discard) the confirmation names them again. */
  const selectedRows = rows.filter((row) => selected.has(row.id));
  const selectedIds = selectedRows.map((row) => row.id);
  // Only a bulkable row can be part of "select all" — ticking a pending-signature row
  // that is waiting entirely on other parties would let the page promise a signature
  // the batch has no way to collect.
  const pageIds = slice.filter((row) => rowBulkable(view.tab, row)).map((row) => row.id);
  const selectedOnPage = pageIds.filter((id) => selected.has(id)).length;
  const pageState: boolean | "indeterminate" =
    selectedOnPage === 0
      ? false
      : selectedOnPage === pageIds.length
        ? true
        : "indeterminate";

  const body = (
    <>
      <div className={cn("grid grid-cols-2 items-center gap-2 px-4 py-4", DESK_TOOLBAR)}>
        {bulkKind === "discard" && selectedIds.length > 0 && !cards ? (
          <Button
            variant="destructive"
            onClick={() => onDiscard(selectedIds)}
            className={cn("col-span-2 shrink-0", DESK_AUTO)}
          >
            <Trash2Icon data-icon="inline-start" aria-hidden />
            Discard {selectedIds.length} {selectedIds.length === 1 ? "draft" : "drafts"}
          </Button>
        ) : bulkKind === "sign" && selectedRows.length > 0 && !cards ? (
          <Button onClick={() => onBulk("sign", selectedRows)} className="shrink-0 tabular-nums">
            <PenToolIcon data-icon="inline-start" aria-hidden />
            Sign {selectedRows.length} {selectedRows.length === 1 ? "document" : "documents"}
          </Button>
        ) : bulkKind === "pay" && selectedRows.length > 0 && !cards ? (
          <Button onClick={() => onBulk("pay", selectedRows)} className="shrink-0 tabular-nums">
            <WalletIcon data-icon="inline-start" aria-hidden />
            Pay {money(selectedRows.reduce((sum, row) => sum + (row.amount ?? 0), 0))}
          </Button>
        ) : null}
        <div className={cn("relative col-span-2", DESK_SEARCH)}>
          <SearchIcon
            aria-hidden
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            value={view.q}
            onChange={(event) => go({ q: event.target.value, page: 1 })}
            placeholder="Search by party name or number"
            aria-label="Filter this list by party name or number"
            className="pl-9"
          />
        </div>
        {courts.length > 1 ? (
          <NativeSelect
            value={court}
            onChange={(event) => go({ court: event.target.value, page: 1 })}
            aria-label="Filter by court"
            className={cn("w-full", DESK_AUTO)}
          >
            <NativeSelectOption value="">All courts</NativeSelectOption>
            {courts.map((name) => (
              <NativeSelectOption key={name} value={name}>
                {name}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        ) : null}
        <NativeSelect
          value={sort.value}
          onChange={(event) => go({ sort: event.target.value, page: 1 })}
          aria-label="Order this list"
          className={cn("w-full", courts.length > 1 ? null : "col-span-2", DESK_AUTO)}
        >
          {TAB_SORTS[view.tab].map((option) => (
            <NativeSelectOption key={option.value} value={option.value}>
              {option.label}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </div>

      {!ready ? (
        <div className={cn("flex flex-col gap-3 px-4 pb-8", DESK_GUTTER)} aria-hidden>
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
      ) : slice.length === 0 ? (
        <Empty className="border-0 px-6 pb-10">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              {rows.length === 0 ? <InboxIcon aria-hidden /> : <SearchIcon aria-hidden />}
            </EmptyMedia>
            <EmptyTitle className="text-body font-semibold">
              {rows.length === 0 ? emptyTitle(view.tab) : "No filings match your search"}
            </EmptyTitle>
            <EmptyDescription className="text-body-compact">
              {rows.length === 0
                ? emptyHint(view.tab)
                : "Try a different name or number, or clear the filters."}
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            {rows.length === 0 ? (
              view.tab === "drafts" ? (
                <Button asChild>
                  <Link href={NEW_FILING}>
                    Start a cheque-bounce filing
                    <ArrowRightIcon data-icon="inline-end" aria-hidden />
                  </Link>
                </Button>
              ) : null
            ) : (
              <Button variant="outline" onClick={() => go({ q: "", court: "", page: 1 })}>
                Clear filters
              </Button>
            )}
          </EmptyContent>
        </Empty>
      ) : (
        <>
          <ul className={cn("flex flex-col gap-3 px-4 pb-4", REGISTER_CARDS_ONLY)}>
            {slice.map((row) => (
              <li key={row.id}>
                <RegisterTrayCard
                  title={row.parties}
                  open={tray.isOpen(row.id)}
                  onOpenChange={tray.toggle(row.id)}
                  marked={selected.has(row.id)}
                  // OPEN DECISION (see PR #31): selected is a light teal wash here, while
                  // Cases and Pending tasks keep the DS beige `accent-strong`. The product
                  // needs one; settle it before copying either to another screen.
                  className={cn(
                    "relative",
                    selected.has(row.id) && "border-primary/40 bg-brand-muted/50"
                  )}
                  leading={
                    selectable && rowBulkable(view.tab, row) ? (
                      <Checkbox
                        checked={selected.has(row.id)}
                        onCheckedChange={() => toggleSelected(row.id)}
                        aria-label={`Select ${row.parties}`}
                        className="size-5"
                      />
                    ) : undefined
                  }
                  actions={
                    <>
                      <Button asChild>
                        <Link href={withOrigin(row.action.href, here)}>
                          {row.action.label}
                          <ArrowRightIcon data-icon="inline-end" aria-hidden />
                        </Link>
                      </Button>
                      {row.discardable ? (
                        <Button variant="outline" onClick={() => onDiscard([row.id])}>
                          <Trash2Icon data-icon="inline-start" aria-hidden />
                          Discard
                        </Button>
                      ) : null}
                    </>
                  }
                >
                  {/* The Pending tasks card's grammar: under the title, the one line
                      that says how urgent this is; under a hairline, what identifies
                      it (or, for a draft, how far along it is). */}
                  <p
                    className={cn(
                      "-mt-2 text-body-compact text-muted-foreground",
                      selectable && "pl-8"
                    )}
                  >
                    {layout.info}{" "}
                    {row.count !== undefined ? (
                      <Badge variant="secondary" className="tabular-nums">
                        {row.count}
                      </Badge>
                    ) : (
                      <span
                        className={cn(
                          "font-medium tabular-nums",
                          row.info.lead === "NA"
                            ? "font-normal text-muted-foreground"
                            : row.info.tone === "default"
                              ? "text-foreground"
                              : TONE_CLASS[row.info.tone]
                        )}
                      >
                        {row.info.lead}
                      </span>
                    )}
                    {row.info.sub ? (
                      <span className={TONE_CLASS[row.info.tone]}>
                        <span aria-hidden> · </span>
                        {row.info.sub}
                      </span>
                    ) : null}
                  </p>
                  <div className="flex items-center justify-between gap-3 border-t border-hairline pt-3">
                    {row.progress ? (
                      <>
                        <span className="text-body-compact">{row.caseType}</span>
                        <span className="text-caption text-muted-foreground tabular-nums">
                          Last saved {row.progress.savedOn}
                        </span>
                      </>
                    ) : (
                      <>
                        <span className="text-body-compact">{row.caseType}</span>
                        <span className="text-caption text-muted-foreground">
                          {row.ref ? <Identifier value={row.ref} copyable={false} /> : null}
                          {row.ref && row.court ? <span aria-hidden> · </span> : null}
                          {row.court || (row.ref ? null : "Court not assigned")}
                        </span>
                      </>
                    )}
                  </div>
                  {/* While picking, the whole card is the toggle, as on Cases. Pointer
                      only: the checkbox is the same control for a keyboard. */}
                  {selectable && rowBulkable(view.tab, row) && selected.size > 0 ? (
                    <button
                      type="button"
                      tabIndex={-1}
                      aria-hidden
                      onClick={() => toggleSelected(row.id)}
                      className="absolute inset-0 z-20 cursor-pointer rounded-xl"
                    />
                  ) : null}
                </RegisterTrayCard>
              </li>
            ))}
          </ul>

          {cards && filtered.length > slice.length ? (
            <div className="px-4 pb-4">
              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={() => setVisible((count) => count + SHOW_MORE_STEP)}
              >
                Show more
                <ChevronDownIcon data-icon="inline-end" aria-hidden />
              </Button>
            </div>
          ) : null}

          {/* Touch: ticking a draft raises one bar from the bottom edge, where the thumb
              is, in the selection bar's own grammar (count and Clear left, the act
              right). Zero height, so it never moves the list; it rides the bottom of the
              screen while the list is on it. Same travel and curve as the bottom sheets.
              Reduced motion keeps the fade and drops the travel. */}
          {cards && selectable ? (
            <div className="pointer-events-none sticky bottom-0 z-30 h-0">
              <div
                role="region"
                aria-label="Selected filings"
                inert={selectedIds.length === 0 || undefined}
                className={cn(
                  "border-hairline shadow-modal pointer-events-auto absolute inset-x-4 bottom-[calc(--spacing(4)+env(safe-area-inset-bottom))] flex items-center justify-between gap-3 rounded-xl border bg-card px-4 py-3 transition-[translate,opacity] duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] motion-reduce:transition-opacity",
                  selectedIds.length === 0 &&
                    "translate-y-[calc(100%+--spacing(8))] opacity-0 duration-200 motion-reduce:translate-y-0"
                )}
              >
                <p className="flex flex-wrap items-center gap-x-3 text-body-compact text-muted-foreground" aria-live="polite">
                  <span className="tabular-nums">{selectedIds.length} selected</span>
                  <Button
                    variant="link"
                    className="h-auto p-0 font-normal underline"
                    onClick={() => setSelected(new Set())}
                  >
                    Clear
                  </Button>
                </p>
                {bulkKind === "discard" ? (
                  <Button variant="destructive" onClick={() => onDiscard(selectedIds)}>
                    <Trash2Icon data-icon="inline-start" aria-hidden />Discard
                  </Button>
                ) : (
                  <Button onClick={() => onBulk(bulkKind === "sign" ? "sign" : "pay", selectedRows)}>
                    {bulkKind === "sign" ? <PenToolIcon data-icon="inline-start" aria-hidden /> : <WalletIcon data-icon="inline-start" aria-hidden />}
                    {bulkKind === "sign" ? "Sign" : "Pay"}
                  </Button>
                )}
              </div>
            </div>
          ) : null}

          <div className={cn("overflow-x-auto", REGISTER_TABLE_ONLY)}>
            <Table aria-label={layout.label}>
              <TableHeader>
                <TableRow className="border-hairline">
                  {selectable ? (
                    <TableHead className="w-10 pl-6">
                      <Checkbox
                        checked={pageState}
                        onCheckedChange={(checked) => setManySelected(pageIds, checked === true)}
                        aria-label={
                          pageState === true
                            ? "Clear the selection on this page"
                            : "Select every row on this page that can be acted on"
                        }
                      />
                    </TableHead>
                  ) : null}
                  {layout.columns.map((column) => (
                    <TableHead
                      key={column}
                      className={cn(
                        column === layout.columns[0] && !selectable && "pl-6",
                        column === "action" && "pr-6 text-right"
                      )}
                    >
                      {headingFor(column, layout)}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {slice.map((row) => (
                  <TableRow
                    key={row.id}
                    /* The whole row opens the filing (owner, 2026-10-13: "don't force me
                       to click Fix defects"). Delegated in script by the product's row
                       pattern — a link stretched over a `relative` <tr> does not reach
                       across the row in every browser. Checkboxes and buttons keep their
                       own clicks. */
                    // OPEN DECISION (see PR #31): the cards' light teal wash, not the DS
                    // beige `accent-strong` that Cases and Pending tasks still use.
                    {...rowActivation(
                      "border-hairline data-[state=selected]:bg-brand-muted/50 data-[state=selected]:hover:bg-brand-muted/75",
                    )}
                    data-state={selected.has(row.id) ? "selected" : undefined}
                  >
                    {selectable ? (
                      <TableCell className="w-10 pl-6">
                        {/* Waiting entirely on other parties, on Pending signature, is
                            not something a bulk sign can act on — the cell stays, so the
                            column still lines up, but there is nothing to tick. */}
                        {rowBulkable(view.tab, row) ? (
                          // z-10 lifts the box above the row's stretched action link, so
                          // a click ticks the row instead of opening it.
                          <div className="relative z-10 flex items-center">
                            <Checkbox
                              checked={selected.has(row.id)}
                              onCheckedChange={() => toggleSelected(row.id)}
                              aria-label={`Select ${row.parties}`}
                            />
                          </div>
                        ) : null}
                      </TableCell>
                    ) : null}
                    {layout.columns.map((column) => (
                      <TableCell
                        key={column}
                        className={cn(
                          column === layout.columns[0] && !selectable && "pl-6",
                          column === "action" && "pr-6",
                          column === "parties" && "font-medium",
                          column === "court" && "text-muted-foreground"
                        )}
                      >
                        {renderCell(column, row, onDiscard, here)}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <p className={cn("px-4 pb-4 text-caption text-muted-foreground", REGISTER_CARDS_ONLY)}>
            Showing <span className="tabular-nums">{slice.length}</span> of{" "}
            <span className="tabular-nums">{filtered.length}</span>
          </p>

          <div
            className={cn(
              "flex-wrap items-center justify-between gap-4 border-t border-hairline px-6 py-4",
              DESK_PAGER
            )}
          >
            {/* `items-center` on one line, and the select at the DS `sm` height with
                caption type, so the count and the size read as one sentence. */}
            <div className="flex items-center gap-3">
              <p className="text-caption leading-none text-muted-foreground">
                Showing <span className="tabular-nums">{start + 1}</span>–
                <span className="tabular-nums">
                  {Math.min(start + view.size, filtered.length)}
                </span>{" "}
                of <span className="tabular-nums">{filtered.length}</span>
              </p>
              <NativeSelect
                value={String(view.size)}
                onChange={(event) => go({ size: Number(event.target.value), page: 1 })}
                aria-label="Rows per page"
                size="sm"
                className="w-auto [&_select]:text-caption"
              >
                {PAGE_SIZES.map((size) => (
                  <NativeSelectOption key={size} value={String(size)}>
                    {size} per page
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </div>
            {pageCount > 1 ? (
              <Pagination className="mx-0 w-auto justify-end">
                <PaginationContent>
                  {page > 1 ? (
                    <PaginationItem>
                      <PaginationPrevious href="#" onClick={goto(go, page - 1)} />
                    </PaginationItem>
                  ) : null}
                  {pageWindow(page, pageCount).map((entry, index) => (
                    <PaginationItem key={`${entry}-${index}`}>
                      {entry === "gap" ? (
                        <PaginationEllipsis />
                      ) : (
                        <PaginationLink
                          href="#"
                          onClick={goto(go, entry)}
                          isActive={entry === page}
                          aria-label={`Go to page ${entry}`}
                        >
                          {entry}
                        </PaginationLink>
                      )}
                    </PaginationItem>
                  ))}
                  {page < pageCount ? (
                    <PaginationItem>
                      <PaginationNext href="#" onClick={goto(go, page + 1)} />
                    </PaginationItem>
                  ) : null}
                </PaginationContent>
              </Pagination>
            ) : null}
          </div>
        </>
      )}
    </>
  );

  // `overflow-visible` undoes the Card master's own `overflow-hidden`: a clipping ancestor
  // makes `position: sticky` inert, so the tab strip would scroll away. Nothing sits on a
  // rounded corner here, so nothing needs the clip. Logged upstream.
  return (
    <Card variant="raised" className="gap-0 overflow-visible py-0">
      <div className={cn("flex flex-col gap-1 px-4 pt-4 pb-4", DESK_HEAD)}>
        <h2 className="text-title-s font-semibold text-foreground">Your filings</h2>
        <p className="text-body-compact text-muted-foreground">
          All your filings, finished and in progress. Each tab is a stage.
        </p>
      </div>

      <Tabs
        value={view.tab}
        onValueChange={(value) => {
          // More hands over a value no tab owns when nothing is folded behind it.
          if (!isQueueTab(value)) return;
          const tab = value;
          // The order belongs to the tab, so it resets with the tab; the search follows.
          go({ tab, sort: defaultSortFor(tab), page: 1 });
        }}
      >
        {/* Only the strip pins: the heading above it is read once, and keeping it on
            screen cost 90px of every scroll. */}
        <div className={cn("sticky top-14 z-10 border-b border-hairline bg-card px-4", DESK_GUTTER)}>
          {/* Never a sideways scroll: what does not fit folds into More (owner, Sept 21). */}
          <OverflowTabsList
            aria-label="Filing states"
            value={view.tab}
            onSelect={(value) => {
              if (!isQueueTab(value)) return;
              go({ tab: value, sort: defaultSortFor(value), page: 1 });
            }}
            className="h-10 w-full justify-start rounded-none"
            triggerClassName="h-10 flex-none gap-2 text-body-compact"
            items={QUEUE_TABS.map((entry) => {
              const count = ready ? String(data[entry.id].length) : "–";
              return {
                value: entry.id,
                measure: count,
                label: (
                  <>
                    {entry.label}
                    <span className="tabular-nums text-muted-foreground">{count}</span>
                  </>
                ),
              };
            })}
          />
        </div>

        {/* One panel per tab so the tablist actually controls something; only the
            selected one mounts. */}
        {QUEUE_TABS.map((entry) => (
          <TabsContent key={entry.id} value={entry.id}>
            {body}
          </TabsContent>
        ))}
      </Tabs>
    </Card>
  );
}

function headingFor(column: ColumnId, layout: (typeof TAB_LAYOUT)[QueueTab]): React.ReactNode {
  switch (column) {
    case "ref":
      return layout.ref;
    case "parties":
      return "Parties";
    case "caseType":
      return "Case type";
    case "court":
      return "Court";
    case "info":
      return layout.info;
    case "progress":
      return "Last saved";
    case "action":
      return <span className="sr-only">Action</span>;
  }
}

function renderCell(
  column: ColumnId,
  row: QueueRow,
  onDiscard: (ids: string[]) => void,
  here: string
): React.ReactNode {
  switch (column) {
    case "ref":
      /* Not copyable: the row's stretched action link lies over this cell (see the
         z-index note on the checkbox), so a button here would be unreachable. With the
         affordance off there is no accessible name to give — and the heading it would
         borrow is "E-filing no." on one tab and "Case no." on the next. */
      return row.ref ? (
        <Identifier value={row.ref} copyable={false} className="font-medium" />
      ) : null;
    case "parties":
      return row.parties;
    case "caseType":
      return row.caseType ?? "—";
    case "court":
      return row.court || "—";
    case "info":
      if (row.count !== undefined) {
        /* A lone number reads as a badge rather than a stray digit. The chip is
           neutral — the count is a fact; the cure date under it is the status,
           and it keeps the destructive ink (ui-craft: one status cue per row). */
        return (
          <>
            <Badge variant="secondary" className="tabular-nums">
              {row.count}
            </Badge>
            {row.info.sub ? (
              <span className={cn("mt-1 block text-caption", TONE_CLASS[row.info.tone])}>
                {row.info.sub}
              </span>
            ) : null}
          </>
        );
      }
      return (
        <>
          {/* The date takes the tone too: inside the last two days it is the date that
              is urgent, not the caption. An NA reads muted — nothing to act on yet. */}
          <span
            className={cn(
              "block tabular-nums",
              row.info.lead === "NA" && "text-muted-foreground",
              row.info.tone !== "default" && TONE_CLASS[row.info.tone]
            )}
          >
            {row.info.lead}
          </span>
          {row.info.sub ? (
            <span className={cn("block text-caption", TONE_CLASS[row.info.tone])}>
              {row.info.sub}
            </span>
          ) : null}
        </>
      );
    case "progress":
      return row.progress ? (
        <span className="tabular-nums">{row.progress.savedOn}</span>
      ) : (
        "—"
      );
    case "action":
      return (
        <div className="flex items-center justify-end gap-1">
          <Button asChild variant="outline" size="sm">
            {/* The row's opener: a click anywhere on the row is handed to it
                (`rowActivation`), so the button is only where it is visible. */}
            <Link href={withOrigin(row.action.href, here)} {...rowOpener}>
              {row.action.label}
              <ArrowRightIcon data-icon="inline-end" aria-hidden />
            </Link>
          </Button>
          {row.discardable ? (
            <Button
              variant="ghost"
              size="icon-sm"
              className="relative z-10 text-muted-foreground hover:text-destructive"
              onClick={() => onDiscard([row.id])}
              aria-label={`Discard draft ${row.parties}`}
            >
              <Trash2Icon aria-hidden />
            </Button>
          ) : null}
        </div>
      );
  }
}

function goto(go: (next: { page: number }) => void, page: number) {
  return (event: React.MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault();
    go({ page });
  };
}

function emptyTitle(tab: QueueTab): string {
  switch (tab) {
    case "drafts":
      return "No drafts yet";
    case "pendingSignature":
      return "Nothing out for signature";
    case "pendingPayment":
      return "Nothing awaiting the court fee";
    case "scrutiny":
      return "Nothing with the registry";
    case "returned":
      return "Nothing sent back";
    case "registered":
      return "No registered cases yet";
  }
}

function emptyHint(tab: QueueTab): string {
  switch (tab) {
    case "drafts":
      return "A filing you start is saved here until you submit it.";
    case "pendingSignature":
      return "A filing sent for signature stays here until every signature is in.";
    case "pendingPayment":
      return "A filing everyone has signed waits here until the court fee is paid.";
    case "scrutiny":
      return "Filings waiting on the registry's check will appear here.";
    case "returned":
      return "If scrutiny sends a filing back, it lands here with the defects to fix.";
    case "registered":
      return "Cases the court has numbered will appear here with their next hearing.";
  }
}
