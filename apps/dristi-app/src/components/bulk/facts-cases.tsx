"use client";

/**
 * Facts of the case, every case at once (owner, 2026-11-17: the rows' own details took the
 * screen above the batch's text, read one at a time). A table of the batch's cases with
 * the facts each will hold and where they come from: the advocate's own, the batch text,
 * or written here for that case. Each can be switched or edited on its own, or several at
 * once from the selection, so nothing is decided by one question on Continue.
 *
 *  · The row opens the case beside the table (`SidePanel`): the whole text, and editing it.
 *  · The standing selection bar above the table, as on pending tasks: its acts show from
 *    the start and wait on a selection.
 */

import * as React from "react";
import { ChevronLeftIcon, ChevronRightIcon, EllipsisIcon, PencilLineIcon, Undo2Icon } from "lucide-react";

import type { FactsPicks } from "@/lib/bulk/types";
import { money } from "@/lib/filing/format";
import { cn } from "@/lib/utils";
import {
  TABLE_CELL,
  TABLE_HEAD,
  TABLE_HEAD_ROW,
  tableBodyClass,
  tableRowClass,
} from "@/components/chrome/table-plate";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SidePanel, SIDE_PANEL_INSET } from "@/components/ui/side-panel";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { RichTextEditor, type BracketMarks } from "@/components/filing/rich-text-editor";

import { CaseSearch, Pager, pageOf } from "./case-list-tools";
import { FilterPills } from "./filter-pills";

/** Where a case's facts come from, as the table says it. */
export type FactsSource = "own" | "batch" | "written" | "none";

export type FactsRow = {
  key: string;
  reference: string;
  title: string;
  cheque: string;
  cheques: number;
  amount: number;
  /** The facts as Create will write them, HTML. */
  facts: string;
  /** Its row brought its own text. */
  own: boolean;
  source: FactsSource;
};

export const NO_PICKS: FactsPicks = { batchFor: [], written: {} };

/** "Row 5", before the batch has draft numbers; a pushed case keeps its reference. */
export const rowLabel = (reference: string) => (/^R\d+$/.test(reference) ? `Row ${reference.slice(1)}` : reference);

const SOURCE_LABEL: Record<FactsSource, string> = {
  own: "Your own",
  batch: "Batch text",
  written: "Edited here",
  none: "None",
};

/** The facts as one run of text, for the table's two lines. */
function plainText(html: string): string {
  return html
    .replace(/<\/(p|li|h\d)>|<br\s*\/?>/gi, " ")
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

/** A part still to write, marked as the editor marks it. */
const BLANK_MARK =
  "rounded-sm border border-dashed border-warning-ink bg-warning-muted px-0.5 text-warning-muted-foreground";

/** Plain text with its `[parts still to write]` marked, as nodes (nothing set as HTML). */
function Marked({ text }: { text: string }) {
  const parts = text.split(/(\[[^\]\n]+\])/g);
  return (
    <>
      {parts.map((p, i) =>
        /^\[[^\]\n]+\]$/.test(p) ? (
          <mark key={i} className={BLANK_MARK}>
            {p.slice(1, -1)}
          </mark>
        ) : (
          <React.Fragment key={i}>{p}</React.Fragment>
        ),
      )}
    </>
  );
}

/** HTML with its `[parts still to write]` marked, for the panel's reading view. */
function markedHtml(html: string): string {
  return html.replace(/(^|>)([^<]*)/g, (_, open: string, text: string) =>
    open + text.replace(/\[([^\]\n]+)\]/g, (_w, name: string) => `<mark class="${BLANK_MARK}">${name}</mark>`),
  );
}

/** In one case's text every bracket is a part still to write: its fields are filled in. */
const NO_FIELDS: BracketMarks = { isField: () => false };

const READ_CLASS =
  "text-body leading-7 text-foreground [&_li]:mb-2 [&_li]:ml-5 [&_ol]:list-decimal [&_p]:mb-4 [&_p:last-child]:mb-0 [&_ul]:list-disc";

/** "Cheque 204511 · ₹1,48,500", or "2 cheques · ₹3,34,000". */
const chequeLine = (r: FactsRow) =>
  [r.cheques > 1 ? `${r.cheques} cheques` : r.cheque ? `Cheque ${r.cheque}` : "", r.amount ? money(r.amount) : ""]
    .filter(Boolean)
    .join(" · ");

/* ───────────────────────────── The choices ───────────────────────────── */

/** The batch text for these cases: their own set aside, any edit dropped. */
export function pickBatch(picks: FactsPicks, rows: FactsRow[]): FactsPicks {
  const written = { ...picks.written };
  const batchFor = new Set(picks.batchFor);
  for (const r of rows) {
    delete written[r.reference];
    if (r.own) batchFor.add(r.reference);
  }
  return { batchFor: [...batchFor], written };
}

/** Back to what each case came with: its own text, or the batch's when it brought none. */
export function pickOwn(picks: FactsPicks, rows: FactsRow[]): FactsPicks {
  const written = { ...picks.written };
  const batchFor = new Set(picks.batchFor);
  for (const r of rows) {
    delete written[r.reference];
    batchFor.delete(r.reference);
  }
  return { batchFor: [...batchFor], written };
}

export function pickWritten(picks: FactsPicks, r: FactsRow, html: string): FactsPicks {
  return { ...picks, written: { ...picks.written, [r.reference]: html } };
}

/** What a case's menu offers, in the words of its source. */
function actsFor(r: FactsRow, hasBatch: boolean) {
  return {
    toBatch: hasBatch && r.source !== "batch" ? (r.source === "written" && !r.own ? "Go back to the batch text" : "Use the batch text") : null,
    toOwn: r.own && r.source !== "own" ? "Use its own text again" : null,
  };
}

/* ───────────────────────────── The table ───────────────────────────── */

export function FactsCases({
  rows,
  from,
  hasBatch,
  picks,
  onPicks,
}: {
  rows: FactsRow[];
  /** "the Excel", or the system that sent the cases. */
  from: string;
  /** The batch has text to give. */
  hasBatch: boolean;
  picks: FactsPicks;
  onPicks: (next: FactsPicks) => void;
}) {
  const [show, setShow] = React.useState("all");
  const [q, setQ] = React.useState("");
  const [page, setPage] = React.useState(0);
  const [selected, setSelected] = React.useState<Set<string>>(() => new Set());
  const [openKey, setOpenKey] = React.useState<string | null>(null);

  const term = q.trim().toLowerCase();
  const list = rows
    .filter((r) => show === "all" || r.source === show)
    .filter((r) => !term || [r.title, r.reference, rowLabel(r.reference), r.cheque].some((v) => v.toLowerCase().includes(term)));
  const { pages, at, shown } = pageOf(list, page);
  const chosen = rows.filter((r) => selected.has(r.key));
  const pageKeys = shown.map((r) => r.key);
  const pageOn = pageKeys.filter((k) => selected.has(k)).length;
  const open = rows.find((r) => r.key === openKey) ?? null;

  const apply = (next: FactsPicks) => {
    onPicks(next);
    setSelected(new Set());
  };
  const toggle = (key: string, on: boolean) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (on) next.add(key);
      else next.delete(key);
      return next;
    });
  const count = (s: FactsSource) => rows.filter((r) => r.source === s).length;
  const canOwn = chosen.some((r) => r.own && r.source !== "own");
  const canBatch = hasBatch && chosen.some((r) => r.source !== "batch");

  return (
    <section aria-label="Every case's facts" className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-3">
        <FilterPills
          value={show}
          onChange={(v) => {
            setShow(v);
            setPage(0);
          }}
          total={rows.length}
          filters={(["own", "batch", "written", "none"] as const).map((s) => ({ id: s, label: SOURCE_LABEL[s], count: count(s) }))}
          label="Show cases by where their facts come from"
        />
        <CaseSearch
          id="facts-search"
          placeholder="Party, row or cheque"
          value={q}
          onChange={(v) => {
            setQ(v);
            setPage(0);
          }}
        />
      </div>

      {/* Standing, not summoned: its acts wait on a selection (as on pending tasks). */}
      <div
        role="region"
        aria-label="Selected cases"
        className="@container sticky top-14 z-20 rounded-lg border border-hairline bg-card px-4 py-3"
      >
        <div className="flex flex-col gap-3 @2xl:flex-row @2xl:items-center">
          <p className="flex min-w-0 flex-wrap items-center gap-x-3 text-body-compact text-muted-foreground @2xl:mr-auto" aria-live="polite">
            <span className="tabular-nums">
              {chosen.length
                ? `${chosen.length} case${chosen.length === 1 ? "" : "s"} selected.`
                : "Select cases to switch several at once."}
            </span>
            {chosen.length ? (
              <Button variant="link" className="h-auto p-0 font-normal underline" onClick={() => setSelected(new Set())}>
                Clear
              </Button>
            ) : null}
          </p>
          <div className="flex flex-wrap gap-2 @2xl:flex-nowrap [&>button]:flex-1 @2xl:[&>button]:flex-none">
            <Button variant="outline" disabled={!canOwn} onClick={() => apply(pickOwn(picks, chosen))}>
              Use their own text
            </Button>
            <Button variant="outline" disabled={!canBatch} onClick={() => apply(pickBatch(picks, chosen))}>
              Use the batch text
            </Button>
          </div>
        </div>
      </div>

      <Card variant="raised" className="gap-0 p-2">
        {shown.length === 0 ? (
          <p className="p-4 text-body-compact text-muted-foreground">
            {term ? `No case matches “${q.trim()}”.` : "No case here."}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <Table className="table-fixed border-separate border-spacing-0" aria-label="Every case's facts">
              <colgroup>
                <col className="w-12" />
                <col className="w-[30%]" />
                <col />
                <col className="w-32" />
                <col className="w-14" />
              </colgroup>
              <TableHeader>
                <TableRow className={TABLE_HEAD_ROW}>
                  <TableHead className={TABLE_HEAD}>
                    <Checkbox
                      aria-label="Every case on this page"
                      checked={pageOn && pageOn === pageKeys.length ? true : pageOn ? "indeterminate" : false}
                      onCheckedChange={(v) =>
                        setSelected((prev) => {
                          const next = new Set(prev);
                          for (const k of pageKeys) {
                            if (v === true) next.add(k);
                            else next.delete(k);
                          }
                          return next;
                        })
                      }
                    />
                  </TableHead>
                  <TableHead className={TABLE_HEAD}>Case</TableHead>
                  <TableHead className={TABLE_HEAD}>Facts of the case</TableHead>
                  <TableHead className={TABLE_HEAD}>From</TableHead>
                  <TableHead className={TABLE_HEAD}>
                    <span className="sr-only">More</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody className={tableBodyClass({ selectable: true, marksOpenRow: true })}>
                {shown.map((r) => {
                  const on = selected.has(r.key);
                  const text = plainText(r.facts).replace(/^Facts of the case\s*/i, "");
                  return (
                    <TableRow
                      key={r.key}
                      data-state={on ? "selected" : undefined}
                      aria-current={openKey === r.key ? "true" : undefined}
                      className={cn(tableRowClass({ selectable: true, open: openKey === r.key && !on }), "cursor-pointer")}
                      onClick={() => setOpenKey(r.key)}
                    >
                      <TableCell className={TABLE_CELL} onClick={(e) => e.stopPropagation()}>
                        <Checkbox aria-label={`Select ${r.title}`} checked={on} onCheckedChange={(v) => toggle(r.key, v === true)} />
                      </TableCell>
                      <TableCell className={cn(TABLE_CELL, "whitespace-normal")}>
                        <button
                          type="button"
                          className="block max-w-full truncate text-left font-medium text-foreground outline-none hover:underline focus-visible:underline"
                          onClick={(e) => {
                            e.stopPropagation();
                            setOpenKey(r.key);
                          }}
                        >
                          {r.title}
                        </button>
                        <span className="block truncate text-muted-foreground tabular-nums">
                          {rowLabel(r.reference)}
                          {chequeLine(r) ? ` · ${chequeLine(r)}` : ""}
                        </span>
                      </TableCell>
                      <TableCell className={cn(TABLE_CELL, "whitespace-normal")}>
                        {text ? (
                          <span className="line-clamp-2 text-foreground">
                            <Marked text={text} />
                          </span>
                        ) : (
                          <span className="text-muted-foreground">No facts of the case</span>
                        )}
                      </TableCell>
                      <TableCell className={cn(TABLE_CELL, r.source === "own" ? "text-foreground" : "text-muted-foreground")}>
                        {SOURCE_LABEL[r.source]}
                      </TableCell>
                      <TableCell className={cn(TABLE_CELL, "px-2")} onClick={(e) => e.stopPropagation()}>
                        <RowMenu
                          row={r}
                          hasBatch={hasBatch}
                          onEdit={() => setOpenKey(r.key)}
                          onBatch={() => onPicks(pickBatch(picks, [r]))}
                          onOwn={() => onPicks(pickOwn(picks, [r]))}
                        />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
        <Pager total={list.length} at={at} pages={pages} onPage={setPage} />
      </Card>

      <FactsPanel
        row={open}
        list={list}
        from={from}
        hasBatch={hasBatch}
        picks={picks}
        onPicks={onPicks}
        onGo={(key) => {
          setOpenKey(key);
          const i = list.findIndex((r) => r.key === key);
          if (i >= 0) setPage(Math.floor(i / 25));
        }}
        onClose={() => setOpenKey(null)}
      />
    </section>
  );
}

function RowMenu({
  row,
  hasBatch,
  onEdit,
  onBatch,
  onOwn,
}: {
  row: FactsRow;
  hasBatch: boolean;
  onEdit: () => void;
  onBatch: () => void;
  onOwn: () => void;
}) {
  const acts = actsFor(row, hasBatch);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon-sm" className="text-muted-foreground" aria-label={`More for ${row.title}`}>
          <EllipsisIcon aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuItem onSelect={onEdit}>
          <PencilLineIcon aria-hidden />
          Read and edit
        </DropdownMenuItem>
        {acts.toOwn || acts.toBatch ? <DropdownMenuSeparator /> : null}
        {acts.toOwn ? (
          <DropdownMenuItem onSelect={onOwn}>
            <Undo2Icon aria-hidden />
            {acts.toOwn}
          </DropdownMenuItem>
        ) : null}
        {acts.toBatch ? (
          <DropdownMenuItem onSelect={onBatch}>
            <Undo2Icon aria-hidden className={cn(row.source === "own" && "invisible")} />
            {acts.toBatch}
          </DropdownMenuItem>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/* ───────────────────────────── One case beside the table ───────────────────────────── */

function FactsPanel({
  row,
  list,
  from,
  hasBatch,
  picks,
  onPicks,
  onGo,
  onClose,
}: {
  row: FactsRow | null;
  list: FactsRow[];
  from: string;
  hasBatch: boolean;
  picks: FactsPicks;
  onPicks: (next: FactsPicks) => void;
  onGo: (key: string) => void;
  onClose: () => void;
}) {
  // The text being edited, for the case it was started on; reading otherwise.
  const [editing, setEditing] = React.useState<{ key: string; html: string } | null>(null);
  // The last case shown, kept through the panel's exit so it doesn't empty as it slides.
  const [last, setLast] = React.useState<FactsRow | null>(row);
  if (row && row !== last) setLast(row);
  const r = row ?? last;
  const at = r ? list.findIndex((x) => x.key === r.key) : -1;
  const draft = editing && editing.key === r?.key ? editing.html : null;
  const setDraft = (html: string | null) => setEditing(html === null || !r ? null : { key: r.key, html });

  const acts = r ? actsFor(r, hasBatch) : { toBatch: null, toOwn: null };
  const whence =
    r?.source === "own"
      ? `Its own text, from ${from}.`
      : r?.source === "batch"
        ? r.own
          ? `The batch text, in place of its own from ${from}.`
          : "The batch text, filled in for this case."
        : r?.source === "written"
          ? "Edited here for this case only."
          : "No facts of the case yet.";

  return (
    <SidePanel
      open={!!row}
      onOpenChange={(o) => !o && onClose()}
      className="sm:w-[36rem]"
      title={r?.title ?? ""}
      subtitle={
        r ? (
          <p className="text-body-compact text-muted-foreground tabular-nums">
            {rowLabel(r.reference)}
            {chequeLine(r) ? ` · ${chequeLine(r)}` : ""}
          </p>
        ) : null
      }
      header={
        r ? (
          <div className={cn(SIDE_PANEL_INSET, "flex flex-col gap-3 border-b border-hairline pb-4")}>
            <div className="flex items-center gap-3">
              <p className="min-w-0 flex-1 text-body-compact text-muted-foreground">{draft !== null ? "Editing for this case only. The batch text doesn't change." : whence}</p>
              {list.length > 1 && at >= 0 && draft === null ? (
                <div className="-mr-2 flex shrink-0 items-center gap-1 text-body-compact text-muted-foreground tabular-nums">
                  <Button variant="ghost" size="icon-sm" disabled={at <= 0} onClick={() => onGo(list[at - 1].key)} aria-label="Previous case">
                    <ChevronLeftIcon aria-hidden />
                  </Button>
                  <span className="min-w-16 text-center">
                    {at + 1} of {list.length}
                  </span>
                  <Button variant="ghost" size="icon-sm" disabled={at >= list.length - 1} onClick={() => onGo(list[at + 1].key)} aria-label="Next case">
                    <ChevronRightIcon aria-hidden />
                  </Button>
                </div>
              ) : null}
            </div>
            {/* The acts sit above the text, pinned: the facts run long, and a button under
                them would be off the screen. */}
            {draft !== null ? (
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  disabled={!plainText(draft)}
                  onClick={() => {
                    onPicks(pickWritten(picks, r, draft));
                    setDraft(null);
                  }}
                >
                  Save for this case
                </Button>
                <Button size="sm" variant="outline" onClick={() => setDraft(null)}>
                  Cancel
                </Button>
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline" onClick={() => setDraft(r.facts)}>
                  <PencilLineIcon data-icon="inline-start" aria-hidden />
                  {plainText(r.facts) ? "Edit for this case" : "Write for this case"}
                </Button>
                {acts.toOwn ? (
                  <Button size="sm" variant="outline" onClick={() => onPicks(pickOwn(picks, [r]))}>
                    {acts.toOwn}
                  </Button>
                ) : null}
                {acts.toBatch ? (
                  <Button size="sm" variant="outline" onClick={() => onPicks(pickBatch(picks, [r]))}>
                    {acts.toBatch}
                  </Button>
                ) : null}
              </div>
            )}
          </div>
        ) : null
      }
    >
      {r ? (
        draft !== null ? (
          <div className="pt-5">
            <RichTextEditor
              value={draft}
              onChange={setDraft}
              ariaLabel={`Facts of the case for ${r.title}`}
              minHeightClassName="min-h-80"
              marks={NO_FIELDS}
              contentClassName="px-4 py-3 text-body leading-7 [&_li]:mb-2 [&_li]:pl-1 [&_ol]:ml-1 [&_p]:mb-4"
            />
          </div>
        ) : (
          <div key={r.key} className="animate-in pt-5 duration-200 fade-in-0">
            {plainText(r.facts) ? (
              <div className={READ_CLASS} dangerouslySetInnerHTML={{ __html: markedHtml(r.facts) }} />
            ) : (
              <p className="text-body text-muted-foreground">Nothing written for this case.</p>
            )}
          </div>
        )
      ) : null}
    </SidePanel>
  );
}
