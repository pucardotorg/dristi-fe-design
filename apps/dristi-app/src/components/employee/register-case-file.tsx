"use client";

import * as React from "react";
import {
  EyeIcon,
  FilesIcon,
  SearchXIcon,
} from "lucide-react";

import { DocumentScroller } from "@/components/employee/document-scroller";
import { zoneFor, type ZoneRect } from "@/lib/employee/document-zones";
import { QueueSearchField } from "@/components/employee/queue-search-field";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  DescriptionDetails,
  DescriptionList,
  DescriptionRow,
  DescriptionTerm,
} from "@/components/ui/description-list";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useMinWidth } from "@/hooks/use-min-width";
import {
  caseBundleFor,
  caseFileGroups,
  chunkFacts,
  type CaseBundle,
  type CaseBundleDoc,
  type CaseFact,
  type CaseFactTerm,
  type CaseGroup,
  type CaseRecord,
  type CaseReview,
} from "@/lib/employee/case-review";
import { cn } from "@/lib/utils";

/**
 * The case file — everything the complaint was filed with, for a magistrate who is not
 * going to scrutinise it but may want to check one thing.
 *
 * **Not a workspace** (owner, 2026-09-11, on the three-pane build: *"it's almost like a
 * scrutiny officer view… it shouldn't look like another workspace… the magistrate is not
 * gonna really go and scrutinize things here. He just wants to quickly verify something,
 * if at all"*). So the file is a page that scrolls, in the same grammar as the summary —
 * a section eyebrow over one lifted panel, groups inside it, label beside value — and the
 * three ways to check something sit around it rather than in panes of their own:
 *
 * - **Search**, as the queues search: the file narrows as you type to the particulars and
 *   documents that match, with the match marked in each.
 * - **Contents**, as a rail of quiet ticks beside the file (owner's reference): one tick
 *   per group, the one you are reading darker; hover or tab into it and the group names
 *   open over it in a card.
 * - **The page, on request** — a panel beside the file, sticky as the file scrolls (the
 *   "floating preview" of the first build, owner's note). At rest it is the list of
 *   documents; pick one, or a particular that was read from one, and it shows that page
 *   with the values read from it listed underneath, so a value is checked against its
 *   source without leaving the line you were on. Below 1280px the same panel is a sheet.
 */
export function CaseFileView({ review }: { review: CaseReview }) {
  const bundle = React.useMemo(() => caseBundleFor(review), [review]);
  const [query, setQuery] = React.useState("");
  const [selected, setSelected] = React.useState<{
    key: string;
    rowId?: string;
    zone?: ZoneRect | null;
  } | null>(
    null,
  );
  const [sheetOpen, setSheetOpen] = React.useState(false);
  const wide = useMinWidth(1280);
  const asideRef = React.useRef<HTMLElement>(null);

  const needle = query.trim().toLowerCase();
  const groups = React.useMemo(
    () =>
      caseFileGroups(review)
        .map((group) => groupView(group, needle))
        .filter((view): view is GroupView => view !== null),
    [review, needle],
  );
  const matchCount = needle
    ? groups.reduce(
        (sum, view) =>
          sum +
          view.facts.length +
          view.records.reduce((recordSum, record) => recordSum + record.facts.length, 0),
        0,
      )
    : 0;
  const docMatches = needle
    ? [...bundle.docs, ...bundle.absent].filter((doc) => hit(doc.title, needle)).length
    : 0;

  const show = (key: string | null, rowId?: string, term?: string) => {
    if (!key) {
      setSelected(null);
      return;
    }
    /* The region the scroller marks: where this fact's term sits on that document's kind
       of page. A term with no fitting zone rings the whole page (`zoneFor` returns null). */
    const kind = bundle.docs.find((doc) => doc.key === key)?.kind;
    const zone = term && kind ? zoneFor(kind, term) : null;
    setSelected({ key, rowId, zone });
    if (!wide) setSheetOpen(true);
  };

  const panel = (
    <DocumentPanel bundle={bundle} selected={selected} query={needle} />
  );

  const visibleGroups = groups.map((view) => view.group);

  return (
    /* The documents take 24rem on a laptop and 28rem once the window can spare it: at
       1440 the wider panel left the file's comparisons too narrow to hold a bank's name
       on one line (measured). */
    <div className="grid items-start gap-x-6 gap-y-8 xl:grid-cols-[minmax(0,1fr)_1rem_24rem] 2xl:grid-cols-[minmax(0,1fr)_1rem_28rem]">
      <div className="flex min-w-0 flex-col gap-8">
        <div className="flex flex-wrap items-end gap-3">
          <QueueSearchField
            label="Search the case file"
            placeholder="A name, a number, a date or a document"
            value={query}
            onChange={setQuery}
            className="w-full max-w-md"
          />
          {/* Below 1280px the documents live in a sheet, and this is the way in. */}
          <Button
            type="button"
            variant="outline"
            className="xl:hidden"
            onClick={() => setSheetOpen(true)}
          >
            <FilesIcon aria-hidden />
            Documents
          </Button>
        </div>

        {needle && (matchCount > 0 || docMatches > 0) ? (
          <p role="status" className="-mt-4 text-body-compact text-muted-foreground">
            <span className="tabular-nums">{matchCount}</span>{" "}
            {matchCount === 1 ? "particular" : "particulars"}
            {docMatches > 0 ? (
              <>
                {" · "}
                <span className="tabular-nums">{docMatches}</span>{" "}
                {docMatches === 1 ? "document, in the list" : "documents, in the list"}
              </>
            ) : null}
          </p>
        ) : null}

        {groups.length === 0 && docMatches > 0 ? null : groups.length === 0 ? (
          <Empty className="border-0 p-0 py-12">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <SearchXIcon aria-hidden />
              </EmptyMedia>
              <EmptyTitle className="font-semibold text-title-s">
                Nothing in this file matches “{query.trim()}”
              </EmptyTitle>
              <EmptyDescription className="text-body-compact">
                Try part of a name, a number or a date, or clear the search to see the
                whole file.
              </EmptyDescription>
            </EmptyHeader>
            <Button type="button" variant="outline" onClick={() => setQuery("")}>
              Clear search
            </Button>
          </Empty>
        ) : (
          /* One card per group, in the e-filing's order, spaced apart — no section
             eyebrows over them (owner, 2026-09-11: *"those micro headers… not really
             helping… might as well have independent cards that are grouped and spaced
             out properly"*). */
          <div className="flex flex-col gap-6">
            {groups.map((view) => (
              <GroupCard
                key={view.group.id}
                view={view}
                needle={needle}
                bundle={bundle}
                selected={selected}
                onShow={show}
              />
            ))}
          </div>
        )}
      </div>

      {/* The contents rail sits in the gutter beside the file it indexes. */}
      <div className="hidden self-stretch xl:block">
        <ContentsRail groups={visibleGroups} />
      </div>

      {/* **Docked, not floating** (owner, design review: *"a whole section and not like a
          rounded off section"*, confirmed as a docked panel). It starts on the tab row's
          rule — `-mt-8` takes back the tabs' gap — runs to the window's right edge through
          the page margin and down to its foot, and sticks there under the tab row as the
          file scrolls. A straight hairline down its left is the clean edge the contents
          ticks sit against. Chrome, not a panel: card white, no radius, no shadow.

          **It sticks to the tab bar's foot, not 13px under it.** At `top-25` the panel
          stuck at 100px while the bar ends at 113, so its own heading spent every scroll
          behind the bar and the panel read as cut off at the top and short at the bottom
          (owner, 2026-09-12). `top-28` is the bar's foot, and the height is the window
          less that, so the panel's foot lands on the fold. */}
      <aside
        ref={asideRef}
        aria-label="Documents"
        /* The fill runs to the window's edge; the contents stop where the page's own
           right margin is, so "18 filed" and the document numbers line up with the
           Register button above them (owner, 2026-09-12). */
        className="sticky top-28 -mt-8 hidden h-[calc(100svh-7rem)] min-h-0 flex-col self-start border-l border-hairline bg-card xl:-mr-12 xl:flex xl:pr-6"
      >
        {panel}
      </aside>

      <Sheet open={sheetOpen && !wide} onOpenChange={setSheetOpen}>
        <SheetContent side="right" className="gap-0 p-0 data-[side=right]:sm:max-w-md">
          <SheetHeader className="sr-only">
            <SheetTitle>Documents</SheetTitle>
            <SheetDescription>The documents this complaint was filed with.</SheetDescription>
          </SheetHeader>
          <div className="flex min-h-0 flex-1 flex-col pt-12">{panel}</div>
        </SheetContent>
      </Sheet>
    </div>
  );
}

/* ─────────────────────────────── the search ─────────────────────────────── */

type FactItem = { id: string; fact: CaseFact; label?: string };
type RecordView = { record: CaseRecord; facts: FactItem[] };
type GroupView = { group: CaseGroup; records: RecordView[]; facts: FactItem[] };

function hit(text: string | undefined, needle: string): boolean {
  return !!text && text.toLowerCase().includes(needle);
}

/**
 * A group as the search leaves it — or `null` when nothing in it matches.
 *
 * A match on the group's own name, or on a record's name, keeps everything under it: a
 * reader who types "accused" wants the accused, not the rows that happen to contain the
 * word. Otherwise a particular stays when its label or its value matches. Documents are
 * searched in the documents panel, which narrows by the same query. Row ids are the
 * particular's place in the file, not in the result, so a selection survives the search
 * changing.
 */
function groupView(group: CaseGroup, needle: string): GroupView | null {
  const whole = !needle || hit(group.title, needle);
  const keepFact = (fact: CaseFact, all: boolean) =>
    all || hit(fact.term, needle) || hit(fact.value, needle);

  const records = (group.records ?? [])
    .map((record) => {
      const all = whole || hit(record.heading, needle) || hit(record.tag, needle);
      return {
        record,
        facts: record.facts
          .map((fact, index) => ({ id: `${group.id}-${record.id}-${index}`, fact }))
          .filter((item) => keepFact(item.fact, all)),
        all,
      };
    })
    .filter((view) => view.all || view.facts.length > 0);

  const facts = (group.facts ?? [])
    .map((fact, index) => ({ id: `${group.id}-${index}`, fact }))
    .filter((item) => keepFact(item.fact, whole));

  if (!whole && records.length === 0 && facts.length === 0) return null;
  return { group, records, facts };
}

/** The text with every occurrence of the search marked. */
function Marked({ text, needle }: { text: string; needle: string }) {
  if (!needle) return <>{text}</>;
  const lower = text.toLowerCase();
  const parts: React.ReactNode[] = [];
  let from = 0;
  let at = lower.indexOf(needle);
  while (at !== -1) {
    if (at > from) parts.push(text.slice(from, at));
    parts.push(
      <mark key={at} className="rounded-sm bg-accent-strong px-0.5 text-foreground">
        {text.slice(at, at + needle.length)}
      </mark>,
    );
    from = at + needle.length;
    at = lower.indexOf(needle, from);
  }
  if (from < text.length) parts.push(text.slice(from));
  return <>{parts}</>;
}

/* ─────────────────────────────── the file ───────────────────────────────── */

/**
 * One group of the form as a card of its own.
 *
 * **Bands, not blocks.** The card is a header — the group's mark in a tile, its name at
 * the card-title role, the record it holds under it (the cheque's number, a party's name)
 * — and then one band per chunk of the e-filing's own sub-cards (`CASE_FILE_CHUNKS`),
 * each ruled from the next with a hairline. On a wide card a band's name sits in a
 * gutter to the left of its rows, so a card reads in three straight columns — what the
 * band is, what the field is, what was filed — and the eye runs down each; on a narrow
 * card the name moves above its rows. The two-abreast chunks this replaces stacked each
 * label over its value at half width, which made the eye zig-zag (owner, 2026-09-11).
 *
 * **One size.** Everything in a card is 14px except its 16px title — the band's name at
 * 600, the label muted, the value in the foreground. No 12px anywhere in the file (owner,
 * same day: *"I want that completely removed"*).
 *
 * **What is compared is laid out to be compared.** The two banks, and the witnesses, are
 * a grid with a column each (`MatrixBand`) rather than repeated lists.
 */
function GroupCard({
  view,
  needle,
  bundle,
  selected,
  onShow,
}: {
  view: GroupView;
  needle: string;
  bundle: CaseBundle;
  selected: { key: string; rowId?: string } | null;
  onShow: (key: string | null, rowId?: string, term?: string) => void;
}) {
  const { group } = view;
  const Icon = group.icon;
  const docNo = (key: string) => bundle.docs.find((doc) => doc.key === key);
  const single = (group.records ?? []).length === 1 ? view.records[0] : undefined;
  const many = !single && view.records.length > 0;
  const chunks = [
    ...(single ? chunkFacts(group.id, single.facts) : []),
    ...chunkFacts(group.id, view.facts),
  ];
  const row = { needle, docNo, selected, onShow };
  /* The gutter is for band names. A card none of whose bands has one — the notice, the
     delay, the complaint, the fee, the witnesses — runs its rows from its own edge; an
     empty 11rem gutter there was an awkward gap, bought only to line labels up with the
     next card (owner, 2026-09-11). */
  const gutter = chunks.some((chunk) => chunk.title);

  return (
    <Card
      variant="raised"
      size="sm"
      id={`file-group-${group.id}`}
      className="@container scroll-mt-32 gap-0 py-0"
    >
      {/* A heading band, not a first row: the card's name on the sunken fill the rest of
          the app uses for a well, so a long card reads as headed rather than as a list
          that happens to start with bigger text (owner, 2026-09-12). It holds the name
          and nothing else — who the record is now sits in the body as labelled rows,
          where a reader can tell which field each value came from. The icon keeps the far
          corner, and on the tinted band it takes the card's own white with a hairline.
          No rule under it: the fill change is the separation, and a hairline on top of it
          read as a drop shadow (owner, 2026-09-12). */}
      <div className="flex items-center justify-between gap-4 bg-surface-sunken px-6 py-4 md:px-8">
        <h2 id={`file-group-${group.id}-title`} className="min-w-0 text-body font-semibold">
          <Marked text={group.title} needle={needle} />
        </h2>
        <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-lg border border-hairline bg-card text-muted-foreground">
          <Icon aria-hidden className="size-5" />
        </span>
      </div>

      {group.empty && !needle ? (
        <Band gutter={gutter}>
          <p className="py-2 text-body-compact text-muted-foreground">
            {group.empty.explanation ??
              (group.empty.reason === "none-named" ? "None named" : "None on record")}
          </p>
        </Band>
      ) : null}

      {many ? (
        <Band gutter={gutter}>
          <MatrixBand
            rowHeading="Name"
            records
            columns={recordColumns(view.records)}
            rows={view.records.map((record) => ({
              key: record.record.id,
              label: record.record.heading,
              cells: recordColumns(view.records).map((term) =>
                record.facts.find((item) => item.fact.term === term),
              ),
            }))}
            {...row}
          />
        </Band>
      ) : null}

      {chunks.map((chunk, index) => (
        <Band
          key={`${chunk.title ?? "rest"}-${index}`}
          title={chunk.title}
          needle={needle}
          gutter={gutter}
        >
          {chunk.kind === "compare" ? (
            <MatrixBand
              columns={chunk.columns}
              rows={chunk.rows.map((matrixRow) => ({
                key: matrixRow.label,
                label: matrixRow.label,
                cells: matrixRow.cells,
              }))}
              {...row}
            />
          ) : (
            <DescriptionList>
              {chunk.items.map((item) => (
                <FactRow key={item.id} item={item} {...row} />
              ))}
            </DescriptionList>
          )}
        </Band>
      ))}
    </Card>
  );
}

/** The terms a group's records carry, in the order the first one states them. */
function recordColumns(records: RecordView[]): CaseFactTerm[] {
  const terms: CaseFactTerm[] = [];
  for (const record of records) {
    for (const item of record.facts) {
      if (!terms.includes(item.fact.term)) terms.push(item.fact.term);
    }
  }
  return terms;
}

/**
 * A band of a card: ruled from what is above it, its name in the gutter on a wide card
 * and above its content on a narrow one. The name's `pt-2` is the rows' own top padding,
 * so it sits on the first row's line. `gutter` is the card's: when any band in it is
 * named, every band keeps the gutter so the card's labels share one vertical; when none
 * is, there is no gutter at all and the rows start at the card's edge.
 */
function Band({
  title,
  needle = "",
  gutter,
  children,
}: {
  title?: string;
  needle?: string;
  gutter: boolean;
  children: React.ReactNode;
}) {
  return (
    <section
      className={cn(
        "grid gap-x-8 gap-y-2 border-t border-hairline px-6 py-4 md:px-8 md:py-6",
        gutter && "@3xl:grid-cols-[11rem_minmax(0,1fr)]",
      )}
    >
      {title ? (
        <h3 className="text-body-compact font-semibold @3xl:pt-2">
          <Marked text={title} needle={needle} />
        </h3>
      ) : gutter ? (
        <span aria-hidden className="hidden @3xl:block" />
      ) : null}
      <div className="min-w-0">{children}</div>
    </section>
  );
}

type RowProps = {
  needle: string;
  docNo: (key: string) => CaseBundleDoc | undefined;
  selected: { key: string; rowId?: string } | null;
  onShow: (key: string | null, rowId?: string, term?: string) => void;
};

/**
 * One particular — label beside value on anything wider than a phone, label over value on
 * a phone. The label is muted, the value is in the foreground; both are 14px.
 *
 * **The eye is pinned to the row, not the value** (owner: *"the eye icon hover in some of
 * those are not aligned properly"*). Inside the value it followed the value's line, so in
 * a row whose label sat above its value it hung in the lower half of the lit row. It is
 * now centred on the row itself — its 32px hover square centred in the band whatever the
 * row's height — and the value keeps clear of it. It comes up with the row's hover, on
 * focus, and always on touch; the row itself answers a click for a mouse.
 *
 * The lit row takes the tables' lighter tone on hover and `accent` while its page is the
 * one on show — the same pair the queues use.
 */
function FactRow({
  item,
  needle,
  docNo,
  selected,
  onShow,
}: RowProps & { item: FactItem }) {
  const { id, fact, label } = item;
  const source = fact.source ? docNo(fact.source) : undefined;
  const current = selected?.rowId === id;
  return (
    <DescriptionRow
      id={`fact-${id}`}
      className={cn(
        "group/row relative -mx-3 grid-cols-1 gap-0.5 rounded-lg border-0 px-3 py-2 transition-colors @md:grid-cols-[minmax(0,12rem)_minmax(0,1fr)] @md:gap-6",
        source && "cursor-pointer hover:bg-surface-sunken",
        current && "bg-accent hover:bg-accent",
      )}
      onClick={source ? () => onShow(source.key, id, fact.term) : undefined}
    >
      <DescriptionTerm className="text-body-compact">
        <Marked text={label ?? fact.term} needle={needle} />
      </DescriptionTerm>
      <DescriptionDetails className={cn("min-w-0 text-body-compact", source && "pr-8")}>
        <Value fact={fact} needle={needle} />
        {source ? (
          <EyeButton
            title={source.title}
            no={source.no}
            shown={current}
            onClick={() => onShow(source.key, id, fact.term)}
          />
        ) : null}
      </DescriptionDetails>
    </DescriptionRow>
  );
}

/** A value as filed — or, where the form was left empty, the words for that. */
function Value({ fact, needle }: { fact: CaseFact; needle: string }) {
  return (
    <span
      className={cn(
        "block min-w-0 break-words whitespace-pre-line",
        !fact.value && "text-muted-foreground",
        fact.numeric && "tabular-nums",
        /* The identifier face set by hand, and the one place in the app that is allowed
           to: the value goes through `Marked` for the search highlight, and `Identifier`
           takes a string with no slot for children. The treatment still belongs to
           `components/chrome/identifier.tsx` — anything past these two classes changes
           there, and then here. */
        fact.id && "font-mono tabular-nums",
        fact.exception && "text-warning-ink",
      )}
    >
      {fact.value ? <Marked text={fact.value} needle={needle} /> : "Not provided"}
    </span>
  );
}

/** The quiet eye at a row's or a cell's right edge, centred on it. */
function EyeButton({
  title,
  no,
  shown,
  onClick,
  group = "row",
}: {
  title: string;
  no: number;
  shown: boolean;
  onClick: () => void;
  group?: "row" | "cell";
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      className={cn(
        "absolute top-1/2 right-1 -translate-y-1/2 text-muted-foreground opacity-0 transition-opacity focus-visible:opacity-100 [@media(hover:none)]:opacity-100",
        group === "row" ? "group-hover/row:opacity-100" : "group-hover/cell:opacity-100",
        shown && "opacity-100",
      )}
      aria-label={`Show ${title}, document ${no}`}
      onClick={(event) => {
        event.stopPropagation();
        onClick();
      }}
    >
      <EyeIcon aria-hidden />
    </Button>
  );
}

/**
 * What is compared, laid out to be compared: a label column, then a column per thing —
 * the payer's bank and the payee's bank, or each witness's fields — with a hairline
 * between rows so the eye can travel across one.
 *
 * On a card too narrow for three columns the same list stacks: the row's label on top,
 * then each value on its own line with its column's name before it. The names are in the
 * markup either way — shown when stacked, read out by a screen reader when not — so a
 * value is never announced without the column it belongs to.
 *
 * A value read from a document is its own target: the cell lights on hover and its eye
 * opens the page, as a row does.
 */
function MatrixBand({
  rowHeading,
  records = false,
  columns,
  rows,
  needle,
  docNo,
  selected,
  onShow,
}: RowProps & {
  rowHeading?: string;
  /** The rows are records — the witnesses — so each row's name is read as a value. */
  records?: boolean;
  columns: string[];
  rows: { key: string; label: string; cells: (FactItem | undefined)[] }[];
}) {
  const grid =
    columns.length === 3
      ? "@lg:grid-cols-[minmax(0,12rem)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)]"
      : "@lg:grid-cols-[minmax(0,12rem)_minmax(0,1fr)_minmax(0,1fr)]";
  return (
    <div>
      <div
        aria-hidden
        className={cn(
          "hidden gap-6 border-b border-hairline pt-2 pb-3 text-body-compact text-muted-foreground @lg:grid",
          grid,
        )}
      >
        <span className={cn(records && "font-semibold text-foreground")}>{rowHeading}</span>
        {columns.map((column) => (
          <span key={column} className="font-semibold text-foreground">
            {column}
          </span>
        ))}
      </div>
      <DescriptionList>
        {rows.map((matrixRow) => (
          <DescriptionRow
            key={matrixRow.key}
            className={cn(
              "grid-cols-1 gap-1 border-b border-hairline py-2 last:border-b-0 @lg:gap-6 @lg:py-1",
              grid,
            )}
          >
            {/* A record's name is a value, not a label: the witnesses' names read in the
                foreground, where the banks' field names stay muted. */}
            <DescriptionTerm
              className={cn("text-body-compact @lg:py-2", records && "text-foreground")}
            >
              <Marked text={matrixRow.label} needle={needle} />
            </DescriptionTerm>
            {matrixRow.cells.map((cell, index) => (
              <MatrixCell
                key={columns[index]}
                column={columns[index]}
                cell={cell}
                needle={needle}
                docNo={docNo}
                selected={selected}
                onShow={onShow}
              />
            ))}
          </DescriptionRow>
        ))}
      </DescriptionList>
    </div>
  );
}

function MatrixCell({
  column,
  cell,
  needle,
  docNo,
  selected,
  onShow,
}: RowProps & { column: string; cell: FactItem | undefined }) {
  const source = cell?.fact.source ? docNo(cell.fact.source) : undefined;
  const current = !!cell && selected?.rowId === cell.id;
  return (
    <DescriptionDetails
      id={cell ? `fact-${cell.id}` : undefined}
      className={cn(
        "group/cell relative -mx-2 flex min-w-0 gap-2 rounded-lg px-2 text-body-compact transition-colors @lg:py-2",
        source && "cursor-pointer pr-8 hover:bg-surface-sunken",
        current && "bg-accent hover:bg-accent",
      )}
      onClick={source && cell ? () => onShow(source.key, cell.id, cell.fact.term) : undefined}
    >
      <span className="w-28 shrink-0 text-muted-foreground @lg:sr-only">{column}</span>
      {cell ? (
        <Value fact={cell.fact} needle={needle} />
      ) : (
        <span className="text-muted-foreground">Not provided</span>
      )}
      {source && cell ? (
        <EyeButton
          group="cell"
          title={source.title}
          no={source.no}
          shown={current}
          onClick={() => onShow(source.key, cell.id, cell.fact.term)}
        />
      ) : null}
    </DescriptionDetails>
  );
}

/* ─────────────────────────────── the contents ───────────────────────────── */

/**
 * The file's contents as a rail of ticks (owner's reference, 2026-09-11) — one per group,
 * the one being read darker. Hover it, or tab into it, and the group names open over it in
 * a card; picking one scrolls the file there.
 *
 * The card is the real navigation and is always in the tab order — it is transparent, not
 * hidden, until hover or focus brings it up — so a keyboard reaches every group and a
 * screen reader hears a list of them. The ticks are only its picture.
 */
function ContentsRail({ groups }: { groups: CaseGroup[] }) {
  const [active, setActive] = React.useState(groups[0]?.id ?? "");

  React.useEffect(() => {
    let frame = 0;
    const sync = () => {
      frame = 0;
      /* The group whose heading has passed under the sticky tab row. */
      let current = groups[0]?.id ?? "";
      for (const group of groups) {
        const el = document.getElementById(`file-group-${group.id}`);
        if (el && el.getBoundingClientRect().top <= 160) current = group.id;
      }
      if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4) {
        current = groups[groups.length - 1]?.id ?? current;
      }
      setActive(current);
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(sync);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    sync();
    return () => {
      window.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(frame);
    };
  }, [groups]);

  if (groups.length < 2) return null;

  return (
    <nav aria-label="Case file contents" className="group/toc sticky top-32 w-4">
      <div aria-hidden className="flex flex-col items-end gap-3 py-2">
        {groups.map((group) => (
          <span
            key={group.id}
            className={cn(
              "h-0.5 w-4 rounded-full transition-colors",
              active === group.id ? "bg-foreground" : "bg-border",
            )}
          />
        ))}
      </div>
      <ul
        className={cn(
          "absolute top-0 right-0 z-30 flex w-64 flex-col gap-0.5 rounded-xl border border-hairline bg-card p-2 shadow-overlay transition-opacity duration-150",
          "pointer-events-none opacity-0",
          "group-hover/toc:pointer-events-auto group-hover/toc:opacity-100",
          "group-focus-within/toc:pointer-events-auto group-focus-within/toc:opacity-100",
        )}
      >
        {groups.map((group) => (
          <li key={group.id}>
            <button
              type="button"
              aria-current={active === group.id ? "true" : undefined}
              onClick={() =>
                document
                  .getElementById(`file-group-${group.id}`)
                  ?.scrollIntoView({ behavior: "smooth", block: "start" })
              }
              className={cn(
                "w-full rounded-lg px-3 py-1.5 text-start text-body-compact transition-colors hover:bg-accent focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring",
                active === group.id
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {group.title}
            </button>
          </li>
        ))}
      </ul>
    </nav>
  );
}

/* ─────────────────────────────── the page ───────────────────────────────── */

/**
 * The documents panel's contents — flat, inside the dock.
 *
 * At rest it is the list: every filed document, numbered in the file's order, and the slots
 * left empty under "Not filed", narrowed by the same search as the file. Picking a
 * document, or a particular read from one, turns the panel to that document: a bar with
 * the way back and the arrows through the bundle, then one scroll holding the document's
 * name with its full view, the drawing of its page, and the particulars read from it —
 * label over value and ruled apart, so a long prayer or a paragraph of complaint wraps in
 * place and the panel scrolls, rather than a card below the page being cut off (owner,
 * design review).
 */
/**
 * The documents panel — one long scroll of the whole bundle, the scrutiny bundle's
 * grammar (`document-scroller.tsx`).
 *
 * It replaced the thumbnail-list-then-single-page viewer: every filed document is stacked
 * in the file's order on its own paper sheet, the slots left empty listed as "Not filed"
 * at the foot, and the column scrolls through all of them (owner, 2026-09-14). A
 * particular clicked on the file still sets `selected`; the scroller brings that document
 * to the top and rings it, and the facts read from each page sit under it as captions —
 * so "which document is this value from" is answered by the page itself lighting up.
 *
 * The search narrows the stack to the documents whose title matches, the same box that
 * narrows the file beside it.
 */
function DocumentPanel({
  bundle,
  selected,
  query,
}: {
  bundle: CaseBundle;
  selected: { key: string; rowId?: string; zone?: ZoneRect | null } | null;
  query: string;
}) {
  const docs = bundle.docs.filter((candidate) => !query || hit(candidate.title, query));
  const absent = bundle.absent.filter(
    (candidate) => !query || hit(candidate.title, query),
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex shrink-0 items-baseline justify-between gap-3 border-b border-hairline px-8 py-4">
        <h2 className="text-body font-semibold">Documents</h2>
        <span className="text-body-compact tabular-nums text-muted-foreground">
          {bundle.docs.length} filed
        </span>
      </div>
      {docs.length === 0 && absent.length === 0 ? (
        <p className="px-8 py-4 text-body-compact text-muted-foreground">
          No document matches.
        </p>
      ) : (
        <DocumentScroller
          docs={docs}
          absent={absent}
          active={
            selected ? { doc: selected.key, zone: selected.zone ?? null } : null
          }
        />
      )}
    </div>
  );
}
