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
import { IndexCard, IndexList, previewSections, sectionDomId, useActiveSection, usePinned } from "./column-mapping";
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

/** For one list: the court fields that use it, and how many cases use each word. */
function listUse(l: ListName, props: Props) {
  const { headers, rows } = props.book.cases;
  const instances = instancesIn(headers, props.counts);
  const fields: string[] = [];
  const columns: number[] = [];
  for (const c of COLUMNS.filter((x) => x.list === l)) {
    for (const i of instances[c.group]) {
      const src = sourceFor(c, i, props.map, headers);
      if (typeof src !== "number") continue;
      if (!fields.includes(c.header)) fields.push(c.header);
      if (!columns.includes(src)) columns.push(src);
    }
  }
  const cases = new Map<string, number>();
  for (const row of rows) {
    const here = new Set<string>();
    for (const k of columns) {
      const w = row[k]?.trim();
      if (w) here.add(w);
    }
    for (const w of here) cases.set(w, (cases.get(w) ?? 0) + 1);
  }
  return { fields, cases, columns: columns.map((k) => headers[k] || `Column ${k + 1}`) };
}

/** A list's name where it answers several fields: "Yes or no" for five yes/no questions. */
const LIST_NAME: Partial<Record<ListName, string>> = {
  yesNo: "Yes or no",
  accusedType: "Accused type",
  accusedEntity: "Institution type",
  returnReason: "Return reason",
  natureOfDebt: "Nature of debt",
  modeOfService: "Mode of service",
  nonDelivery: "Reason for non-delivery",
  payment: "Payment after notice",
};

/**
 * A panel's title that holds at any scale: the field's name when the list answers one
 * field, else the list's own name; the fields themselves go in the line after it.
 */
const listTitle = (l: ListName, fields: string[]) =>
  fields.length === 1 ? fields[0] : (LIST_NAME[l] ?? (join(fields) || l));

/** The file's columns behind a field, two at most and a count for the rest. */
const capped = (cols: string[]) => (cols.length > 2 ? `${cols.slice(0, 2).join(", ")} +${cols.length - 2}` : cols.join(", "));

const join = (xs: string[]) =>
  xs.length < 2 ? xs.join("") : `${xs.slice(0, -1).join(", ")} and ${xs[xs.length - 1]}`;

/**
 * Match values (BLK-39): every word of the filer's file that a court list does not know,
 * grouped by the field it answers, each with the court's option it means. Where one option
 * plainly reads as the word (A/C CLOSED → Account closed), it arrives chosen, as a column
 * arrives matched by its name on Match columns; every choice stays in plain view to change.
 */
export function ValueMapping(props: Props) {
  const lists = (Object.keys(props.unknown) as ListName[]).filter((l) => props.unknown[l]?.length);

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

  const active = useActiveSection(lists);
  const pinned = usePinned();
  const preview = props.previewOpen ?? false;
  const sections = React.useMemo(
    () => previewSections(props.book.cases.headers, props.counts),
    [props.book.cases.headers, props.counts],
  );
  const titleOf = (l: ListName) => listTitle(l, listUse(l, props).fields);

  return (
    <>
      <SidePanelRegion open={preview} push="content">
        <div
          style={pinned}
          className={cn("grid grid-cols-1 items-start gap-8", !preview && "lg:grid-cols-[16rem_minmax(0,1fr)]")}
        >
          {preview ? null : (
            <aside aria-label="Fields" className="hidden lg:sticky lg:top-(--map-top) lg:block">
              <IndexCard fileName={props.fileName} rows={props.book.cases.rows.length}>
              {/* The file always heads the column, so the panels stand where they stood on Match
                  columns; the list only when there is more than one field to move between. */}
              {lists.length > 1 ? (
              <IndexList
                label="to choose"
                active={active}
                onPick={(id) => focusNextToChoose(id)}
                items={lists.map((l) => ({
                  id: l,
                  title: titleOf(l),
                  left: props.unknown[l]!.filter((w) => !values[l]?.[w]).length,
                }))}
              />
              ) : null}
              </IndexCard>
            </aside>
          )}
          <div className="flex min-w-0 flex-col gap-4">
            {lists.map((l) => (
              <ListGroup
                key={l}
                list={l}
                words={props.unknown[l]!}
                use={listUse(l, props)}
                chosen={props.values[l] ?? {}}
                onPick={(w, v) => onChange({ ...values, [l]: { ...(values[l] ?? {}), [w]: v } })}
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
  "grid grid-cols-1 gap-y-2 sm:grid-cols-[minmax(0,12.5rem)_minmax(0,17.5rem)_minmax(0,1fr)] sm:items-center sm:gap-x-6";

function ListGroup({
  list,
  words,
  use,
  chosen,
  onPick,
}: {
  list: ListName;
  words: string[];
  use: ReturnType<typeof listUse>;
  chosen: Record<string, string>;
  onPick: (word: string, value: string) => void;
}) {
  const titleId = React.useId();
  // The most used first: they settle the most cases.
  const sorted = [...words].sort((a, b) => (use.cases.get(b) ?? 0) - (use.cases.get(a) ?? 0));
  return (
    <section id={sectionDomId(list)} aria-labelledby={titleId} className="scroll-mt-(--map-top)">
    <Card variant="raised" className="gap-0 px-6 py-0">
      <div className="flex min-h-14 items-center justify-between gap-4 border-b border-hairline pt-1">
        <h2 id={titleId} className="min-w-0 text-body font-semibold">
          {listTitle(list, use.fields)}
          <span
            className="text-body-compact font-normal text-muted-foreground"
            title={use.fields.length > 1 ? join(use.fields) : use.columns.join(", ")}
          >
            {" · "}
            {use.fields.length > 1 ? `${use.fields.length} fields` : capped(use.columns)}
          </span>
        </h2>
        {words.filter((w) => !chosen[w]).length ? (
          <span className="shrink-0 text-body-compact text-muted-foreground tabular-nums">
            {words.filter((w) => !chosen[w]).length} to choose
          </span>
        ) : null}
      </div>
      <ul className="flex flex-col divide-y divide-hairline pb-2">
        {sorted.map((w) => (
          <WordRow
            key={w}
            list={list}
            word={w}
            cases={use.cases.get(w) ?? 0}
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
