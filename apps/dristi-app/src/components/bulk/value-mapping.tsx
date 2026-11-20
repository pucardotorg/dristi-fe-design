"use client";

import * as React from "react";
import { ArrowRightIcon } from "lucide-react";

import {
  instancesIn,
  sourceFor,
  type ColumnMap,
  type InstanceCounts,
  type ValueMap,
  type Workbookish,
} from "@/lib/bulk/excel";
import { COLUMNS, LISTS, type ListName } from "@/lib/bulk/excel-spec";
import { cn } from "@/lib/utils";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FieldLabel } from "@/components/ui/field";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { StatusMark } from "@/components/ui/status-mark";

/** The page's title and one line, for the page header above these cards. */
export const VALUES_TITLE = "Translate your file’s words";
export const VALUES_INTRO =
  "These fields take only the court’s options. Choose what each word in your file means; every case with that word follows.";

/** Up to this many options show at rest as pick-one pills; a longer list is a select. */
const PILLS_UP_TO = 6;

type Props = {
  book: Workbookish;
  map: ColumnMap;
  counts: InstanceCounts;
  /** Words each list does not know, as `unknownValues` reads them. */
  unknown: Partial<Record<ListName, string[]>>;
  /** list → the file's word → the court's option value. */
  values: ValueMap;
  onChange: (next: ValueMap) => void;
};

/** What Match values still waits on: words translated and words in all. */
export function valuesTally(unknown: Partial<Record<ListName, string[]>>, values: ValueMap) {
  let total = 0;
  let done = 0;
  for (const [l, words] of Object.entries(unknown) as [ListName, string[]][]) {
    total += words.length;
    done += words.filter((w) => values[l]?.[w]).length;
  }
  return { total, done, left: total - done };
}

/** For one list: the court fields that use it, the file's columns behind them, and how many cases use each word. */
function listUse(l: ListName, props: Props) {
  const { headers, rows } = props.book.cases;
  const instances = instancesIn(headers, props.counts);
  const fields: string[] = [];
  const columns: number[] = [];
  const fieldOf = new Map<number, Set<string>>();
  for (const c of COLUMNS.filter((x) => x.list === l)) {
    for (const i of instances[c.group]) {
      const src = sourceFor(c, i, props.map, headers);
      if (typeof src !== "number") continue;
      if (!fields.includes(c.header)) fields.push(c.header);
      if (!columns.includes(src)) columns.push(src);
      (fieldOf.get(src) ?? fieldOf.set(src, new Set()).get(src)!).add(c.header);
    }
  }
  const cases = new Map<string, number>();
  // Where the card serves more than one field, which of them each word turns up in.
  const where = new Map<string, Set<string>>();
  for (const row of rows) {
    const here = new Set<string>();
    for (const k of columns) {
      const w = row[k]?.trim();
      if (!w) continue;
      here.add(w);
      for (const f of fieldOf.get(k) ?? []) (where.get(w) ?? where.set(w, new Set()).get(w)!).add(f);
    }
    for (const w of here) cases.set(w, (cases.get(w) ?? 0) + 1);
  }
  return { fields, columns: columns.map((k) => headers[k] || `Column ${k + 1}`), cases, where };
}

const join = (xs: string[]) =>
  xs.length < 2 ? xs.join("") : `${xs.slice(0, -1).join(", ")} and ${xs[xs.length - 1]}`;

/**
 * Match values: for each court field whose answers come from the court's fixed list, every
 * word the filer's file uses that the list does not have, how many cases use it, and the
 * court's option it means. Short lists show every option at rest (the filing flows'
 * choice pills); long ones a select. A word that equals an option (letter case aside)
 * never comes here. Renders the body cards; the page header sits above it.
 */
export function ValueMapping(props: Props) {
  const lists = (Object.keys(props.unknown) as ListName[]).filter((l) => props.unknown[l]?.length);
  const set = (l: ListName, word: string, value: string) =>
    props.onChange({ ...props.values, [l]: { ...(props.values[l] ?? {}), [word]: value } });
  return (
    <div className="flex flex-col gap-6">
      {lists.map((l) => (
        <ListCard
          key={l}
          list={l}
          words={props.unknown[l]!}
          use={listUse(l, props)}
          chosen={props.values[l] ?? {}}
          onPick={(word, value) => set(l, word, value)}
        />
      ))}
    </div>
  );
}

function ListCard({
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
  // The most used words first: they settle the most cases.
  const sorted = [...words].sort((a, b) => (use.cases.get(b) ?? 0) - (use.cases.get(a) ?? 0));
  const done = words.filter((w) => chosen[w]).length;
  const title = join(use.fields) || list;
  return (
    <Card variant="raised" aria-labelledby={titleId} role="group">
      {/* On a phone the count drops under the title rather than squeezing it. */}
      <CardHeader className="max-sm:has-data-[slot=card-action]:grid-cols-1">
        <CardTitle id={titleId} className="text-body font-semibold">
          {title}
        </CardTitle>
        {use.columns.length ? (
          <CardDescription className="text-body-compact">
            From your {use.columns.length === 1 ? "column" : "columns"} {join(use.columns.map((c) => `“${c}”`))}
          </CardDescription>
        ) : null}
        <CardAction className="flex items-center gap-2 max-sm:col-start-1 max-sm:row-span-1 max-sm:row-start-auto max-sm:justify-self-start text-body-compact text-muted-foreground tabular-nums">
          {done === words.length ? <StatusMark size={16} tone="success" still /> : null}
          <span aria-live="polite">
            {done} of {words.length} translated
          </span>
        </CardAction>
      </CardHeader>
      <CardContent>
        <ul className="flex flex-col divide-y divide-hairline">
          {sorted.map((w) => (
            <WordRow
              key={w}
              list={list}
              word={w}
              cases={use.cases.get(w) ?? 0}
              field={use.fields.length > 1 ? join([...(use.where.get(w) ?? [])]) : undefined}
              value={chosen[w] ?? ""}
              onPick={(v) => onPick(w, v)}
            />
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

/** The file's word, set apart in mono as written; how many cases use it; the court's option it means. */
function WordRow({
  list,
  word,
  cases,
  field,
  value,
  onPick,
}: {
  list: ListName;
  word: string;
  cases: number;
  /** The field it turns up in, when the card serves more than one. */
  field?: string;
  value: string;
  onPick: (value: string) => void;
}) {
  const id = React.useId();
  const options = LISTS[list];
  const pills = options.length <= PILLS_UP_TO;
  const said = (
    <>
      <span className="inline-flex max-w-full rounded-md border border-hairline bg-surface-sunken px-2 py-0.5 font-mono text-body-compact break-all text-foreground">
        {word}
      </span>
      <span className="text-body-compact text-muted-foreground tabular-nums">
        <span className="sr-only">, </span>in {cases} {cases === 1 ? "case" : "cases"}
        {field ? ` · ${field}` : null}
      </span>
    </>
  );
  return (
    <li className="grid grid-cols-1 gap-x-4 gap-y-2 py-4 first:pt-0 last:pb-0 sm:grid-cols-[minmax(0,13rem)_1rem_minmax(0,1fr)]">
      {pills ? (
        <>
          <div id={`${id}-word`} className="flex min-w-0 flex-col items-start gap-1 sm:pt-2">
            {said}
          </div>
          <ArrowRightIcon aria-hidden className="mt-3 hidden size-4 text-muted-foreground sm:block" />
          <RadioGroup
            value={value}
            onValueChange={onPick}
            aria-labelledby={`${id}-word`}
            className="flex flex-row flex-wrap content-start items-start gap-2"
          >
            {options.map((o) => (
              <FieldLabel
                key={o.value}
                htmlFor={`${id}-${o.value}`}
                className={cn(
                  "min-h-10 w-full max-w-full items-center gap-3 rounded-lg border border-input bg-card px-4 py-2 text-body-compact sm:w-auto",
                  "has-[:focus-visible]:border-ring has-[:focus-visible]:ring-3 has-[:focus-visible]:ring-ring/50",
                )}
              >
                <RadioGroupItem id={`${id}-${o.value}`} value={o.value} />
                <span className="min-w-0 flex-1 break-words font-normal">{o.label}</span>
              </FieldLabel>
            ))}
          </RadioGroup>
        </>
      ) : (
        <>
          <label htmlFor={id} className="flex min-w-0 flex-col items-start gap-1 sm:pt-2">
            {said}
          </label>
          <ArrowRightIcon aria-hidden className="mt-3 hidden size-4 text-muted-foreground sm:block" />
          <NativeSelect
            id={id}
            value={value}
            onChange={(e) => onPick(e.target.value)}
            className="w-full self-start sm:max-w-sm"
          >
            <NativeSelectOption value="" disabled>
              Choose what it means
            </NativeSelectOption>
            {options.map((o) => (
              <NativeSelectOption key={o.value} value={o.value}>
                {o.label}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </>
      )}
    </li>
  );
}
