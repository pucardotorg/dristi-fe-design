"use client";

import * as React from "react";

import {
  instancesIn,
  sourceFor,
  type ColumnMap,
  type InstanceCounts,
  type ValueMap,
  type Workbookish,
} from "@/lib/bulk/excel";
import { COLUMNS, LISTS, type ListName } from "@/lib/bulk/excel-spec";
import { suggestOption } from "@/lib/bulk/value-suggest";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { SidePanelRegion } from "@/components/ui/side-panel";
import { CasePreview } from "./case-preview";
import { IndexCard, IndexList, IndexRail, indexGrid, previewSections, useIndexOpen, sectionDomId, useActiveSection, usePinned } from "./column-mapping";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

/** The page's title and one line, for the page header above the list. */
export const VALUES_TITLE = "Match values";
export const VALUES_INTRO = "Choose the court’s option for each word in your file.";

type Props = {
  book: Workbookish;
  map: ColumnMap;
  counts: InstanceCounts;
  /** Words each list does not know, as `unknownValues` reads them. */
  unknown: Partial<Record<ListName, string[]>>;
  /** list → the file's word → the court's option value. */
  values: ValueMap;
  onChange: (next: ValueMap) => void;
  /** The file being matched, named at the head of the index. */
  fileName?: string;
  /** A row's number in the file ("Row 2"), for the case preview. */
  rowLabel?: (index: number) => string;
  /** The case preview, opened from the page header. */
  previewOpen?: boolean;
  onPreviewOpen?: (open: boolean) => void;
};

/** What Match values still waits on: words matched and words in all. */
export function valuesTally(unknown: Partial<Record<ListName, string[]>>, values: ValueMap) {
  let total = 0;
  let done = 0;
  for (const [l, words] of Object.entries(unknown) as [ListName, string[]][]) {
    total += words.length;
    done += words.filter((w) => values[l]?.[w]).length;
  }
  return { total, done, left: total - done };
}

/** The footer's one fact: how many words still need an option, as the way to the next. */
export function ValuesProgress({
  unknown,
  values,
}: {
  unknown: Partial<Record<ListName, string[]>>;
  values: ValueMap;
}) {
  const { left } = valuesTally(unknown, values);
  if (!left) return <span className="text-body-compact text-muted-foreground">All chosen</span>;
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
      {left} to choose
    </Button>
  );
}

/**
 * One court field whose answers come from a fixed list, with the words of the filer's file
 * it holds that the list does not know, and how many cases use each. One panel each:
 * "Notice delivered" holds DLVD and RTO, "Accused replied" holds Y and N. A word two fields
 * share (Y) is one choice for its list, so choosing it in one panel settles it in both.
 */
type FieldWords = { key: string; title: string; list: ListName; words: string[]; cases: Map<string, number>; columns: string[] };

function fieldGroups(props: Props): FieldWords[] {
  const { headers, rows } = props.book.cases;
  const instances = instancesIn(headers, props.counts);
  const out: FieldWords[] = [];
  for (const c of COLUMNS) {
    if (!c.list || !props.unknown[c.list]?.length) continue;
    const unknown = new Set(props.unknown[c.list]);
    const cols: number[] = [];
    for (const i of instances[c.group]) {
      const src = sourceFor(c, i, props.map, headers);
      if (typeof src === "number" && !cols.includes(src)) cols.push(src);
    }
    if (!cols.length) continue;
    const cases = new Map<string, number>();
    for (const row of rows) {
      const here = new Set(cols.map((k) => row[k]?.trim() ?? "").filter((w) => w && unknown.has(w)));
      for (const w of here) cases.set(w, (cases.get(w) ?? 0) + 1);
    }
    if (!cases.size) continue;
    out.push({
      key: c.key,
      title: c.header,
      list: c.list,
      // The most used first: they settle the most cases.
      words: [...cases.keys()].sort((x, y) => cases.get(y)! - cases.get(x)!),
      cases,
      columns: cols.map((k) => headers[k] || `Column ${k + 1}`),
    });
  }
  return out;
}

/** The file's columns behind a field, two at most and a count for the rest. */
const capped = (cols: string[]) => (cols.length > 2 ? `${cols.slice(0, 2).join(", ")} +${cols.length - 2}` : cols.join(", "));

/**
 * Match values (BLK-39): every word of the filer's file that a court list does not know,
 * grouped by the field it answers, each with the court's option it means. Where one option
 * plainly reads as the word (A/C CLOSED → Account closed), it arrives chosen, as a column
 * arrives matched by its name on Match columns; every choice stays in plain view to change.
 */
export function ValueMapping(props: Props) {
  // Fill each open word with the option it plainly reads as, once per word: a word the
  // filer has answered is never touched.
  const { unknown, values, onChange } = props;
  React.useEffect(() => {
    let next: ValueMap | null = null;
    for (const [l, words] of Object.entries(unknown) as [ListName, string[]][]) {
      for (const w of words ?? []) {
        if (values[l]?.[w]) continue;
        const s = suggestOption(l, w);
        if (!s) continue;
        next ??= { ...values };
        next[l] = { ...(next[l] ?? {}), [w]: s.value };
      }
    }
    if (next) onChange(next);
  }, [unknown, values, onChange]);

  const groups = fieldGroups(props);
  const active = useActiveSection(groups.map((g) => g.key));
  const pinned = usePinned();
  const preview = props.previewOpen ?? false;
  const [indexOpen, setIndexOpen] = useIndexOpen();
  const sections = React.useMemo(
    () => previewSections(props.book.cases.headers, props.counts),
    [props.book.cases.headers, props.counts],
  );

  return (
    <>
      <SidePanelRegion open={preview} push="content">
        <div
          style={pinned}
          className={cn("grid grid-cols-1 items-start gap-8", indexGrid(preview, indexOpen))}
        >
          {preview ? null : !indexOpen ? (
            <IndexRail onOpen={() => setIndexOpen(true)} />
          ) : (
            <aside aria-label="Fields" className="hidden lg:sticky lg:top-(--map-top) lg:block">
              <IndexCard
                fileName={props.fileName}
                rows={props.book.cases.rows.length}
                onCollapse={() => setIndexOpen(false)}
              >
              {/* The file always heads the column, so the panels stand where they stood on Match
                  columns; the list only when there is more than one field to move between. */}
              {groups.length > 1 ? (
              <IndexList
                label="to choose"
                active={active}
                onPick={(id) => focusNextToChoose(id)}
                items={groups.map((g) => ({
                  id: g.key,
                  title: g.title,
                  left: g.words.filter((w) => !values[g.list]?.[w]).length,
                }))}
              />
              ) : null}
              </IndexCard>
            </aside>
          )}
          <div className="flex min-w-0 flex-col gap-4">
            {groups.map((g) => (
              <FieldGroup
                key={g.key}
                group={g}
                chosen={values[g.list] ?? {}}
                onPick={(w, v) => onChange({ ...values, [g.list]: { ...(values[g.list] ?? {}), [w]: v } })}
              />
            ))}
          </div>
        </div>
      </SidePanelRegion>
      <CasePreview
        open={preview}
        onOpenChange={(o) => props.onPreviewOpen?.(o)}
        sections={sections}
        headers={props.book.cases.headers}
        rows={props.book.cases.rows}
        map={props.map}
        values={values}
        rowLabel={props.rowLabel ?? ((i) => `Row ${i + 2}`)}
      />
    </>
  );
}

/** Take the filer to the first word still without an option in a field's panel, else to the panel. */
function focusNextToChoose(list: string) {
  const panel = document.getElementById(sectionDomId(list));
  if (!panel) return;
  const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const open = panel.querySelector<HTMLElement>("[data-to-choose] button");
  (open?.closest("li") ?? panel).scrollIntoView({ block: open ? "center" : "start", behavior: still ? "auto" : "smooth" });
  open?.focus({ preventScroll: true });
}

/** Word, option, cases: Match columns' grid, so the pickers stand where they stood on the step before. */
const ROW =
  "grid grid-cols-1 gap-y-2 sm:grid-cols-[minmax(0,13rem)_minmax(0,15rem)_minmax(0,1fr)] sm:items-center sm:gap-x-4";

function FieldGroup({
  group,
  chosen,
  onPick,
}: {
  group: FieldWords;
  chosen: Record<string, string>;
  onPick: (word: string, value: string) => void;
}) {
  const titleId = React.useId();
  const left = group.words.filter((w) => !chosen[w]).length;
  return (
    <section id={sectionDomId(group.key)} aria-labelledby={titleId} className="scroll-mt-(--map-top)">
      <Card variant="raised" className="gap-0 px-6 py-0">
        <div className="flex min-h-14 items-center justify-between gap-4 border-b border-hairline pt-1">
          <h2 id={titleId} className="min-w-0 text-body font-semibold">
            {group.title}
            <span className="text-body-compact font-normal text-muted-foreground" title={group.columns.join(", ")}>
              {" · "}
              {capped(group.columns)}
            </span>
          </h2>
          {left ? (
            <span className="shrink-0 text-body-compact text-muted-foreground tabular-nums">{left} to choose</span>
          ) : null}
        </div>
        <ul className="flex flex-col divide-y divide-hairline pb-2">
          {group.words.map((w) => (
            <WordRow
              key={w}
              list={group.list}
              word={w}
              cases={group.cases.get(w) ?? 0}
              value={chosen[w] ?? ""}
              onPick={(v) => onPick(w, v)}
            />
          ))}
        </ul>
      </Card>
    </section>
  );
}

/** The file's word as written, how many cases use it, and the court's option it means. */
function WordRow({
  list,
  word,
  cases,
  value,
  onPick,
}: {
  list: ListName;
  word: string;
  cases: number;
  value: string;
  onPick: (value: string) => void;
}) {
  const id = React.useId();
  return (
    <li data-to-choose={!value || undefined} className={cn(ROW, "min-h-14 py-2")}>
      {/* The word with how many cases use it: both describe the word, so both sit before its option. */}
      <label htmlFor={id} className="flex min-w-0 flex-col text-body-compact">
        <span className="font-medium break-words text-foreground">{word}</span>
        <span className="text-muted-foreground tabular-nums">
          <span className="sr-only">, </span>
          {cases} {cases === 1 ? "case" : "cases"}
        </span>
      </label>
      <Select value={value || undefined} onValueChange={onPick}>
        <SelectTrigger
          id={id}
          className={cn(
            "w-full text-body-compact",
            // Chosen: a quiet statement that shows its border on hover and focus.
            value &&
              "border-transparent bg-transparent hover:border-input hover:bg-card dark:bg-transparent [&_svg]:opacity-50 hover:[&_svg]:opacity-100 focus-visible:[&_svg]:opacity-100",
          )}
        >
          <SelectValue placeholder="Choose an option" />
        </SelectTrigger>
        <SelectContent position="popper">
          {LISTS[list].map((o) => (
            <SelectItem key={o.value} value={o.value} className="text-body-compact">
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </li>
  );
}
