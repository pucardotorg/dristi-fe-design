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
import { suggestOption, type Suggestion } from "@/lib/bulk/value-suggest";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FieldLabel } from "@/components/ui/field";
import { Progress } from "@/components/ui/progress";
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

/**
 * How far Match values has got, for the footer: a slim bar and "1 of 3 translated". The
 * cards above carry each word's own state; this is the whole page at a glance.
 */
export function ValuesProgress({
  unknown,
  values,
}: {
  unknown: Partial<Record<ListName, string[]>>;
  values: ValueMap;
}) {
  const { total, done } = valuesTally(unknown, values);
  if (!total) return null;
  return (
    <span className="flex items-center gap-3 text-body-compact text-muted-foreground tabular-nums">
      <Progress aria-hidden value={(done / total) * 100} className="w-20" />
      <span aria-live="polite">
        {done} of {total} translated
      </span>
    </span>
  );
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
 * choice pills); long ones a select. Where one option plainly reads as the word, it is
 * suggested for the filer to confirm with one click; it is never applied unseen. A word
 * that equals an option (letter case aside) never comes here. Renders the body cards; the
 * page header sits above it.
 */
export function ValueMapping(props: Props) {
  const lists = (Object.keys(props.unknown) as ListName[]).filter((l) => props.unknown[l]?.length);
  const set = (l: ListName, picks: Record<string, string>) =>
    props.onChange({ ...props.values, [l]: { ...(props.values[l] ?? {}), ...picks } });
  return (
    <div className="flex flex-col gap-6">
      {lists.map((l) => (
        <ListCard
          key={l}
          list={l}
          words={props.unknown[l]!}
          use={listUse(l, props)}
          chosen={props.values[l] ?? {}}
          counted={lists.length > 1}
          onPick={(picks) => set(l, picks)}
        />
      ))}
    </div>
  );
}

/** Word, arrow, the court's option: the same grid for the heading row and every row. */
const ROW = "sm:grid-cols-[minmax(0,2fr)_1rem_minmax(0,3fr)] sm:gap-x-4";

function ListCard({
  list,
  words,
  use,
  chosen,
  counted,
  onPick,
}: {
  list: ListName;
  words: string[];
  use: ReturnType<typeof listUse>;
  chosen: Record<string, string>;
  /** Several cards on the page: each says how far it has got. */
  counted: boolean;
  onPick: (picks: Record<string, string>) => void;
}) {
  const titleId = React.useId();
  // Where the card serves several fields, each field's words together, in the title's
  // order; within a field the most used first, since they settle the most cases.
  const fieldRank = (w: string) =>
    use.fields.length > 1 ? Math.min(...[...(use.where.get(w) ?? [])].map((f) => use.fields.indexOf(f))) : 0;
  const sorted = [...words].sort(
    (a, b) => fieldRank(a) - fieldRank(b) || (use.cases.get(b) ?? 0) - (use.cases.get(a) ?? 0),
  );
  const suggested = React.useMemo(
    () => new Map(words.map((w) => [w, suggestOption(list, w)] as const)),
    [list, words],
  );
  // Suggestions still waiting on the filer: a word with one and no choice yet.
  const open = sorted.filter((w) => !chosen[w] && suggested.get(w));
  const done = words.filter((w) => chosen[w]).length;
  const title = join(use.fields) || list;
  return (
    <Card variant="raised" aria-labelledby={titleId} role="group">
      {/* On a phone the bulk action drops under the title rather than squeezing it. */}
      <CardHeader className="max-sm:has-data-[slot=card-action]:grid-cols-1">
        <CardTitle id={titleId} className="flex items-center gap-2 text-body font-semibold">
          <span>
            {title}
            {counted && done < words.length ? (
              <span className="font-normal text-muted-foreground tabular-nums">
                {" "}
                · {done} of {words.length}
              </span>
            ) : null}
          </span>
          {done === words.length ? <StatusMark size={16} tone="success" still label="All translated" /> : null}
        </CardTitle>
        {use.columns.length ? (
          <CardDescription className="text-body-compact">
            From your {use.columns.length === 1 ? "column" : "columns"} {join(use.columns.map((c) => `“${c}”`))}
          </CardDescription>
        ) : null}
        {open.length > 1 ? (
          <CardAction className="max-sm:col-start-1 max-sm:row-span-1 max-sm:row-start-auto max-sm:mt-2 max-sm:justify-self-start">
            <Button
              variant="outline"
              onClick={() => onPick(Object.fromEntries(open.map((w) => [w, suggested.get(w)!.value])))}
            >
              Use {open.length} suggestions
            </Button>
          </CardAction>
        ) : null}
      </CardHeader>
      <CardContent className="flex flex-col">
        <div
          aria-hidden
          className={cn(
            "hidden border-b border-hairline pb-2 text-body-compact font-medium text-muted-foreground sm:grid",
            ROW,
          )}
        >
          <span className="pl-6">In your file</span>
          <span />
          <span>The court&rsquo;s option</span>
        </div>
        <ul className="flex flex-col divide-y divide-hairline">
          {sorted.map((w) => (
            <WordRow
              key={w}
              list={list}
              word={w}
              cases={use.cases.get(w) ?? 0}
              field={use.fields.length > 1 ? join([...(use.where.get(w) ?? [])]) : undefined}
              value={chosen[w] ?? ""}
              suggestion={suggested.get(w) ?? null}
              onPick={(v) => onPick({ [w]: v })}
            />
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

/**
 * A word's state, in front of it, as Match columns marks a field: not chosen, an empty
 * ring; chosen, the success mark, which plays only when the filer's own choice sets it.
 */
function RowMark({ done }: { done: boolean }) {
  const [prev, setPrev] = React.useState(done);
  const [play, setPlay] = React.useState(false);
  if (prev !== done) {
    setPrev(done);
    setPlay(done);
  }
  const label = done ? "Translated" : "Not translated yet";
  return done ? (
    <span title={label} className="flex shrink-0">
      <StatusMark size={16} tone="success" still={!play} label={label} />
    </span>
  ) : (
    <span role="img" aria-label={label} title={label} className="flex size-4 shrink-0 items-center justify-center">
      <span className="size-3.5 rounded-full border-2 border-input" />
    </span>
  );
}

/**
 * The file's word, set apart in mono as written, with how many cases use it; the court's
 * option it means; and, while nothing is chosen, the option it plainly reads as.
 */
function WordRow({
  list,
  word,
  cases,
  field,
  value,
  suggestion,
  onPick,
}: {
  list: ListName;
  word: string;
  cases: number;
  /** The field it turns up in, when the card serves more than one. */
  field?: string;
  value: string;
  suggestion: Suggestion | null;
  onPick: (value: string) => void;
}) {
  const id = React.useId();
  const options = LISTS[list];
  const pills = options.length <= PILLS_UP_TO;
  const offer = !value && suggestion ? suggestion : null;
  const Said = pills ? "div" : "label";
  return (
    <li className={cn("grid grid-cols-1 gap-x-4 gap-y-2 py-3 last:pb-0", ROW)}>
      <div className="flex min-h-10 min-w-0 items-center gap-2 self-start">
        <RowMark done={!!value} />
        <Said
          id={`${id}-word`}
          {...(pills ? {} : { htmlFor: id })}
          className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-1"
        >
          <span className="rounded-md border border-hairline bg-surface-sunken px-2 py-0.5 font-mono text-body-compact break-all text-foreground">
            {word}
          </span>
          <span className="text-body-compact text-muted-foreground tabular-nums">
            <span className="sr-only">, in </span>
            {cases} {cases === 1 ? "case" : "cases"}
            {field ? ` · ${field}` : null}
          </span>
        </Said>
      </div>
      <ArrowRightIcon aria-hidden className="mt-3 hidden size-4 text-muted-foreground sm:block" />
      {pills ? (
        <RadioGroup
          value={value}
          onValueChange={onPick}
          aria-labelledby={`${id}-word`}
          className="flex flex-row flex-wrap content-start items-start gap-2 max-sm:pl-6"
        >
          {options.map((o) => {
            // The tag stays whatever is chosen, so choosing never shifts the pills.
            const mine = suggestion?.value === o.value;
            return (
              <FieldLabel
                key={o.value}
                htmlFor={`${id}-${o.value}`}
                className={cn(
                  "min-h-10 w-full max-w-full items-center gap-3 rounded-lg border border-input bg-card px-4 py-2 text-body-compact sm:w-auto",
                  "hover:bg-accent has-data-checked:hover:bg-brand-muted",
                  "has-[:focus-visible]:border-ring has-[:focus-visible]:ring-3 has-[:focus-visible]:ring-ring/50",
                )}
              >
                <RadioGroupItem id={`${id}-${o.value}`} value={o.value} />
                <span className="min-w-0 flex-1 break-words font-normal">
                  {o.label}
                  {mine ? (
                    <>
                      {" "}
                      <span className="whitespace-nowrap text-muted-foreground">·&nbsp;Suggested</span>
                    </>
                  ) : null}
                </span>
              </FieldLabel>
            );
          })}
        </RadioGroup>
      ) : (
        <div className="flex min-w-0 flex-col gap-2 max-sm:pl-6">
          <NativeSelect id={id} value={value} onChange={(e) => onPick(e.target.value)} className="w-full">
            <NativeSelectOption value="" disabled>
              Choose what it means
            </NativeSelectOption>
            {options.map((o) => (
              <NativeSelectOption key={o.value} value={o.value}>
                {o.label}
                {/* Only while open: a chosen value reads as settled, not as a suggestion. */}
                {offer?.value === o.value ? " (suggested)" : ""}
              </NativeSelectOption>
            ))}
          </NativeSelect>
          {offer ? (
            <p className="flex flex-wrap items-center gap-x-2 px-3 text-body-compact">
              <span className="text-muted-foreground">Suggested:</span>
              <span className="font-medium">{offer.label}</span>
              <Button
                variant="link"
                // A 40px target that does not stretch the line: the margin gives the height back.
                className="-my-2.5 h-10 min-w-10 px-1 text-body-compact"
                aria-label={`Use “${offer.label}” for ${word}`}
                onClick={() => onPick(offer.value)}
              >
                Use
              </Button>
            </p>
          ) : null}
        </div>
      )}
    </li>
  );
}
