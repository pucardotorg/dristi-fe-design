"use client";

import * as React from "react";
import { FileSpreadsheetIcon } from "lucide-react";

import {
  answerFor,
  instancesIn,
  sourceFor,
  type ColumnMap,
  type InstanceCounts,
  type ValueMap,
  type Workbookish,
} from "@/lib/bulk/excel";
import { COLUMNS, LISTS, listValue, type Column, type ListName } from "@/lib/bulk/excel-spec";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { SidePanelRegion } from "@/components/ui/side-panel";
import { Select, SelectContent, SelectItem, SelectSeparator, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SegmentedControl, SegmentedControlItem } from "@/components/ui/segmented-control";
import { CasePreview } from "./case-preview";
import {
  IndexCard,
  IndexList,
  IndexRail,
  indexGrid,
  previewSections,
  sectionDomId,
  useActiveSection,
  useIndexOpen,
  usePinned,
} from "./column-mapping";

/** The page's title and one line, for the page header above the tables. */
export const VALUES_TITLE = "Match values";
export const VALUES_INTRO = "Some words in your file aren’t on the court’s lists. Choose what each one means.";

type Props = {
  book: Workbookish;
  map: ColumnMap;
  counts: InstanceCounts;
  /** Words each list does not know, as `unknownValues` reads them. */
  unknown: Partial<Record<ListName, string[]>>;
  /** Court field → the file's word → the court's option value (BLK-39). */
  values: ValueMap;
  onChange: (next: ValueMap) => void;
  /** The file being matched, named at the head of the index. */
  fileName?: string;
  /** A row's number in the file ("Row 2"), for the case preview. */
  rowLabel?: (index: number) => string;
  /** The case preview, opened from the page header or from a word's case count. */
  previewOpen?: boolean;
  onPreviewOpen?: (open: boolean) => void;
};

/** One distinct value of the file in a field, and the rows that hold it. */
type Word = { word: string; rows: number[] };

/**
 * One court field whose answers come from a fixed list: the file's values that are not on
 * it (open, for the filer to translate), and those that already are, word for word (shown
 * settled, so the rule is visible: an exact word passes, anything else is asked).
 */
type FieldWords = {
  column: Column;
  key: string;
  title: string;
  list: ListName;
  open: Word[];
  matched: Word[];
  columns: string[];
  required: boolean;
};

function fieldGroups(props: Pick<Props, "book" | "map" | "counts" | "unknown">): FieldWords[] {
  const { headers, rows } = props.book.cases;
  const instances = instancesIn(headers, props.counts);
  const out: FieldWords[] = [];
  for (const c of COLUMNS) {
    if (!c.list || !props.unknown[c.list]?.length) continue;
    const cols: number[] = [];
    for (const i of instances[c.group]) {
      const src = sourceFor(c, i, props.map, headers);
      if (typeof src === "number" && !cols.includes(src)) cols.push(src);
    }
    if (!cols.length) continue;
    const at = new Map<string, number[]>();
    rows.forEach((row, k) => {
      for (const w of new Set(cols.map((x) => row[x]?.trim() ?? "").filter(Boolean)))
        (at.get(w) ?? at.set(w, []).get(w)!).push(k);
    });
    const words = [...at.entries()]
      .map(([word, r]) => ({ word, rows: r }))
      // The most cases first: a mistake there costs the most.
      .sort((a, b) => b.rows.length - a.rows.length);
    const open = words.filter((w) => listValue(c.list!, w.word) === null);
    if (!open.length) continue;
    out.push({
      column: c,
      key: c.key,
      title: c.header,
      list: c.list,
      open,
      matched: words.filter((w) => listValue(c.list!, w.word) !== null),
      columns: cols.map((k) => headers[k] || `Column ${k + 1}`),
      required: c.required.startsWith("Yes"),
    });
  }
  return out;
}

/** What Match values still waits on, and how many cases a gap leaves needing fixing (BLK-34). */
export function valuesTally(props: Pick<Props, "book" | "map" | "counts" | "unknown" | "values">) {
  const groups = fieldGroups(props);
  let left = 0;
  const broken = new Set<number>();
  for (const g of groups)
    for (const w of g.open) {
      if (answerFor(props.values, g.column, w.word)) continue;
      left += 1;
      if (g.required) for (const r of w.rows) broken.add(r);
    }
  return { left, broken: broken.size };
}

/**
 * The footer's fact: how many words are left and what leaving them costs, as the way to the
 * next one. A gap never blocks Continue: the field is left empty and a required one sends
 * its cases to Needs fixing (BLK-39a, BLK-34).
 */
export function ValuesProgress(props: Pick<Props, "book" | "map" | "counts" | "unknown" | "values">) {
  const { left, broken } = valuesTally(props);
  if (!left) return <span className="text-body-compact text-muted-foreground">All matched</span>;
  return (
    <Button
      type="button"
      variant="ghost"
      onClick={() => {
        const next = document.querySelector<HTMLElement>("[data-to-choose] button");
        if (!next) return;
        const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        next.scrollIntoView({ block: "center", behavior: still ? "auto" : "smooth" });
        next.focus({ preventScroll: true });
      }}
      className="-mr-2 h-10 px-2 text-body-compact font-normal text-foreground tabular-nums"
    >
      {left} left
      {broken ? (
        <span className="text-muted-foreground">
          · {broken} {broken === 1 ? "case" : "cases"} will need fixing
        </span>
      ) : null}
    </Button>
  );
}

/** The file's columns behind a field, two at most and a count for the rest. */
const capped = (cols: string[]) => (cols.length > 2 ? `${cols.slice(0, 2).join(", ")} +${cols.length - 2}` : cols.join(", "));

/**
 * Match values (BLK-39): for each court field whose answers come from the court's fixed
 * list, a translation table. On the left, the file's column; on the right, the court field.
 * The file's values the list does not know come first, each with the court's options to
 * choose from; the values already on the list follow, settled as plain text. A chosen
 * answer keeps its control, so a control always means the filer's choice and plain text
 * means an exact match. Nothing is chosen for the filer, and a word left unanswered does
 * not hold the batch back (BLK-39a). A word's case count opens those cases.
 */
export function ValueMapping(props: Props) {
  const { values, onChange } = props;
  const groups = fieldGroups(props);
  const active = useActiveSection(groups.map((g) => g.key));
  const pinned = usePinned();
  const preview = props.previewOpen ?? false;
  const [indexOpen, setIndexOpen] = useIndexOpen();
  // The rows behind one word, when the filer opened its case count.
  const [only, setOnly] = React.useState<{ rows: number[]; field: string; word: string } | null>(null);
  const sections = React.useMemo(
    () => previewSections(props.book.cases.headers, props.counts),
    [props.book.cases.headers, props.counts],
  );
  const pick = (g: FieldWords, word: string, value: string) =>
    onChange({ ...values, [g.key]: { ...(values[g.key] ?? {}), [word]: value } });

  return (
    <>
      <SidePanelRegion open={preview} push="content">
        <div style={pinned} className={cn("grid grid-cols-1 items-start gap-8", indexGrid(preview, indexOpen))}>
          {preview ? null : !indexOpen ? (
            <IndexRail onOpen={() => setIndexOpen(true)} />
          ) : (
            <aside aria-label="Fields" className="hidden lg:sticky lg:top-(--map-top) lg:block">
              <IndexCard
                fileName={props.fileName}
                rows={props.book.cases.rows.length}
                onCollapse={() => setIndexOpen(false)}
              >
                {groups.length > 1 ? (
                  <IndexList
                    label="left"
                    active={active}
                    onPick={(id) => focusNextToChoose(id)}
                    items={groups.map((g) => ({
                      id: g.key,
                      title: g.title,
                      left: g.open.filter((w) => !answerFor(values, g.column, w.word)).length,
                    }))}
                  />
                ) : null}
              </IndexCard>
            </aside>
          )}
          <div className="flex min-w-0 flex-col gap-4">
            {groups.map((g) => (
              <FieldTable
                key={g.key}
                group={g}
                answer={(w) => answerFor(values, g.column, w) ?? ""}
                onPick={(w, v) => pick(g, w, v)}
                onShowCases={(w) => {
                  setOnly({ rows: w.rows, field: g.key, word: w.word });
                  props.onPreviewOpen?.(true);
                }}
              />
            ))}
          </div>
        </div>
      </SidePanelRegion>
      <CasePreview
        open={preview}
        onOpenChange={(o) => {
          if (!o) setOnly(null);
          props.onPreviewOpen?.(o);
        }}
        sections={sections}
        headers={props.book.cases.headers}
        rows={props.book.cases.rows}
        map={props.map}
        values={values}
        only={only}
        rowLabel={props.rowLabel ?? ((i) => `Row ${i + 2}`)}
      />
    </>
  );
}

/** Take the filer to the first word still without an answer in a field's table, else to the table. */
function focusNextToChoose(field: string) {
  const panel = document.getElementById(sectionDomId(field));
  if (!panel) return;
  const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const open = panel.querySelector<HTMLElement>("[data-to-choose] button");
  (open?.closest("li") ?? panel).scrollIntoView({ block: open ? "center" : "start", behavior: still ? "auto" : "smooth" });
  open?.focus({ preventScroll: true });
}

/** The file's word, the court's option: the left column matches Match columns' field column. */
const ROW = "grid grid-cols-1 gap-y-2 sm:grid-cols-[minmax(0,13rem)_minmax(0,1fr)] sm:items-center sm:gap-x-4";

function FieldTable({
  group,
  answer,
  onPick,
  onShowCases,
}: {
  group: FieldWords;
  answer: (word: string) => string;
  onPick: (word: string, value: string) => void;
  onShowCases: (word: Word) => void;
}) {
  const titleId = React.useId();
  const options = LISTS[group.list];
  return (
    <section id={sectionDomId(group.key)} aria-labelledby={titleId} className="scroll-mt-(--map-top)">
      <Card variant="raised" className="gap-0 px-6 py-0">
        {/* One heading, the court field being answered; where its words come from is a fact
            about the panel, so it sits at the right, quiet, under the file's sheet mark. */}
        <div className="flex min-h-14 items-center justify-between gap-4 border-b border-hairline pt-1">
          <h2 id={titleId} className="min-w-0 text-body font-semibold">
            {group.title}
          </h2>
          <p
            className="flex min-w-0 shrink items-center gap-1.5 text-body-compact text-muted-foreground"
            title={group.columns.join(", ")}
          >
            <FileSpreadsheetIcon aria-hidden className="size-4 shrink-0" />
            <span className="truncate">
              <span className="sr-only">From your column </span>
              {capped(group.columns)}
            </span>
          </p>
        </div>
        <ul className="flex flex-col divide-y divide-hairline">
          {group.open.map((w) => (
            <WordRow
              key={w.word}
              word={w}
              options={options}
              value={answer(w.word)}
              onPick={(v) => onPick(w.word, v)}
              onShowCases={() => onShowCases(w)}
            />
          ))}
          {group.matched.map((w) => (
            // Already on the court's list, word for word: nothing to decide, so no control.
            <li key={w.word} className={cn(ROW, "min-h-14 py-2")}>
              <WordCell word={w} onShowCases={() => onShowCases(w)} />
              {options.length <= 3 ? (
                // Under a toggle, the plain answer stands centred under its own segment, on
                // the same track as the toggles above: its position says which option it is.
                <p className={cn("grid text-body-compact", options.length === 2 ? "w-60 grid-cols-2" : "w-80 grid-cols-3")}>
                  <span className="sr-only">Already the court&rsquo;s option: </span>
                  {options.map((o) => (
                    <span key={o.value} className="text-center">
                      {o.value === listValue(group.list, w.word) ? o.label : null}
                    </span>
                  ))}
                </p>
              ) : (
                // Under a select, it starts where a select's text does.
                <p className="text-body-compact sm:pl-3">
                  <span className="sr-only">Already the court&rsquo;s option: </span>
                  {options.find((o) => o.value === listValue(group.list, w.word))?.label}
                </p>
              )}
            </li>
          ))}
        </ul>
        <div className="pb-2" />
      </Card>
    </section>
  );
}

/** The file's word as written, and its case count as the way to those cases. */
function WordCell({ word, onShowCases, labelId }: { word: Word; onShowCases: () => void; labelId?: string }) {
  const n = word.rows.length;
  return (
    <div className="flex min-w-0 flex-col items-start">
      <span id={labelId} className="text-body-compact font-medium break-words text-foreground">
        {word.word}
      </span>
      <button
        type="button"
        onClick={onShowCases}
        // A quiet dotted underline says it opens something; the cases are one click away.
        className="-mx-1 rounded-sm px-1 text-body-compact text-muted-foreground tabular-nums underline decoration-muted-foreground/40 decoration-dotted underline-offset-4 outline-none hover:text-foreground hover:decoration-solid focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        {n} {n === 1 ? "case" : "cases"}
      </button>
    </div>
  );
}

/** The value a select uses for "nothing chosen", since a select item cannot be empty. */
const NONE = "__none";

/** One file word to translate: the word and its cases, then the court's options. */
function WordRow({
  word,
  options,
  value,
  onPick,
  onShowCases,
}: {
  word: Word;
  options: { value: string; label: string }[];
  value: string;
  onPick: (value: string) => void;
  onShowCases: () => void;
}) {
  const id = React.useId();
  return (
    <li data-to-choose={!value || undefined} className={cn(ROW, "min-h-14 py-2")}>
      <WordCell word={word} onShowCases={onShowCases} labelId={`${id}-word`} />
      {options.length <= 3 ? (
        // Two or three answers: all in view, none chosen until the filer picks one; picking
        // the chosen one again clears it.
        <SegmentedControl
          type="single"
          value={value}
          onValueChange={(v) => onPick(v)}
          aria-labelledby={`${id}-word`}
          // Equal segments, the DS pill and inset untouched: a fixed track split evenly, so
          // Yes and No (or Individual and Institution) weigh the same.
          className={options.length === 2 ? "w-60" : "w-80"}
        >
          {options.map((o) => (
            // Unanswered, both labels stay in the body colour so the toggle reads as a live
            // choice, not a disabled one; once answered, the DS mutes the option not taken.
            <SegmentedControlItem key={o.value} value={o.value} className={cn("flex-1 basis-0", !value && "text-foreground")}>
              {o.label}
            </SegmentedControlItem>
          ))}
        </SegmentedControl>
      ) : (
        // A longer list, in the court's own order. A chosen answer keeps its border: it is
        // the filer's choice, not a fact the app settled. "Not chosen" takes it back.
        // An empty select shows a muted placeholder, never an answer-like "Not chosen"; once
        // something is chosen, "Clear" sits apart at the end of the list to take it back.
        <Select value={value} onValueChange={(v) => onPick(v === NONE ? "" : v)}>
          <SelectTrigger id={id} aria-labelledby={`${id}-word`} className="w-full max-w-80 text-body-compact">
            <SelectValue placeholder="Choose" />
          </SelectTrigger>
          <SelectContent position="popper">
            {options.map((o) => (
              <SelectItem key={o.value} value={o.value} className="text-body-compact">
                {o.label}
              </SelectItem>
            ))}
            {value ? (
              <>
                <SelectSeparator />
                <SelectItem value={NONE} className="text-body-compact text-muted-foreground">
                  Clear
                </SelectItem>
              </>
            ) : null}
          </SelectContent>
        </Select>
      )}
    </li>
  );
}
