"use client";

import * as React from "react";
import { ArrowLeftRightIcon, ArrowRightIcon, MinusIcon, PencilLineIcon, PlusIcon } from "lucide-react";

import {
  autoMap,
  columnFit,
  firstInstance,
  instancesIn,
  mapKey,
  MUST_MAP,
  sourceFor,
  type ColumnMap,
  type ColumnSource,
  type InstanceCounts,
} from "@/lib/bulk/excel";
import {
  COLUMNS,
  GROUPS,
  LISTS,
  instanceKey,
  listValue,
  type Column,
  type GroupId,
  type Instance,
  type ListName,
} from "@/lib/bulk/excel-spec";
import { cn } from "@/lib/utils";
import { ConfirmDialog } from "@/components/shell/confirm-dialog";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusMark } from "@/components/ui/status-mark";
import {
  Combobox,
  ComboboxCollection,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxGroup,
  ComboboxInput,
  ComboboxItem,
  ComboboxLabel,
  ComboboxList,
  ComboboxTrigger,
  useComboboxAnchor,
} from "@/components/ui/combobox";
import { InputGroupAddon, InputGroupButton } from "@/components/ui/input-group";

type Props = {
  headers: string[];
  rows: string[][];
  map: ColumnMap;
  onChange: (next: ColumnMap) => void;
  /** How many of each repeating section the filer says there are. */
  counts: InstanceCounts;
  onCounts: (next: InstanceCounts) => void;
  /**
   * Fields the filer chose to fill in each case later. A field the file's names did not
   * match is unmatched, not decided, until the filer says so (v8: "Choose a column…").
   */
  later: Set<string>;
  onLater: (next: Set<string>) => void;
};

/** The page's one line under "Match columns": what the screen asks, in the filer's words. */
export const MAP_INTRO = "For each court field, choose the column in your file that holds it. Every case follows.";

/** Sections in the single filing's order. */
const ORDER: GroupId[] = [
  "case",
  "accused",
  "cheque",
  "notice",
  "jurisdiction",
  "otherCase",
  "witness",
];

/** "Accused", "Cheques": what a count of a section is called beside its stepper. */
const PLURAL: Partial<Record<GroupId, string>> = {
  accused: "Accused",
  cheque: "Cheques",
  notice: "Demand notices",
  witness: "Witnesses",
  otherCase: "Other pending cases",
};

/** Singular and plural names for a count in a sentence: "1 accused", "2 cheques". */
const NOUN: Partial<Record<GroupId, [string, string]>> = {
  accused: ["accused", "accused"],
  cheque: ["cheque", "cheques"],
  notice: ["demand notice", "demand notices"],
  witness: ["witness", "witnesses"],
  otherCase: ["other pending case", "other pending cases"],
};

const REPEATING = GROUPS.filter((g) => g.repeats && !g.parent);

/**
 * How many of each repeating section a case can have, as one fact: "Up to 2 cheques per
 * case, from your column names." The count is the most any one case has; it says where it
 * came from until the filer sets it.
 */
function repeatsLine(instances: Record<GroupId, { length: number }>, counts: InstanceCounts): string {
  const more = REPEATING.map((g) => ({ g, n: instances[g.id].length, noun: NOUN[g.id] }))
    .filter(({ g, n, noun }) => noun && (g.always ? n > 1 : n > 0))
    .map(({ n, noun }) => `${n} ${noun![n === 1 ? 0 : 1]}`);
  const join = (xs: string[]) =>
    xs.length < 2 ? xs.join("") : `${xs.slice(0, -1).join(", ")} and ${xs[xs.length - 1]}`;
  const from = Object.keys(counts).length ? "" : ", from your column names";
  return more.length
    ? `Up to ${join(more)} per case${from}.`
    : `1 accused, 1 cheque and 1 demand notice per case${from}.`;
}

/** The counts behind that line, one stepper each, opened by its Edit. */
function RepeatSteppers({
  props,
  instances,
}: {
  props: Props;
  instances: Record<GroupId, Instance[]>;
}) {
  return (
    <ul
      aria-label="Most of each in one case"
      className="mb-2 flex flex-wrap gap-2 rounded-lg border border-hairline bg-surface-sunken p-2"
    >
      {REPEATING.map((g) => {
        const n = instances[g.id].length;
        const floor = g.always ? 1 : 0;
        const set = (next: number) =>
          props.onCounts({ ...props.counts, [g.id]: Math.max(floor, next) });
        const name = PLURAL[g.id] ?? g.label;
        return (
          <li
            key={g.id}
            className="flex items-center gap-1 rounded-lg border border-hairline bg-card py-1 pr-1 pl-3"
          >
            <span className="text-body-compact">{name}</span>
            <span
              className="min-w-6 text-center text-body-compact font-semibold tabular-nums"
              aria-live="polite"
            >
              {n}
            </span>
            <Button
              variant="ghost"
              size="icon"
              disabled={n <= floor}
              onClick={() => set(n - 1)}
              aria-label={`One fewer: ${name}`}
            >
              <MinusIcon aria-hidden />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => set(n + 1)}
              aria-label={`One more: ${name}`}
            >
              <PlusIcon aria-hidden />
            </Button>
          </li>
        );
      })}
    </ul>
  );
}

/** The choice that leaves a field to each case. */
const NONE = "none";
export const SKIP = "Fill in each case later";
const SKIP_OPTION = "Not in my file — fill in each case later";

/** A sheet column as an option: its name, then its first value in mono; "In use" if another field reads it. */
function ColumnOption({
  name,
  sample,
  usedFor = [],
}: {
  name: string;
  sample: string;
  usedFor?: string[];
}) {
  return (
    <span className="flex w-full min-w-0 items-center gap-3">
      <span className="max-w-[55%] shrink-0 truncate font-medium">{name}</span>
      <span className="min-w-0 flex-1 truncate font-mono text-body-compact text-muted-foreground">
        {sample || "empty"}
      </span>
      {/* A column can feed two fields, so it stays pickable; picking it asks first. */}
      {usedFor.length ? (
        <span className="shrink-0 text-body-compact text-muted-foreground" title={`Used for ${usedFor.join(", ")}`}>
          In use<span className="sr-only">, for {usedFor.join(", ")}</span>
        </span>
      ) : null}
    </span>
  );
}

/** Which fields each sheet column already feeds, by column number. */
type Use = { label: string; key: string };
const UsedContext = React.createContext<Record<number, Use[]>>({});

type PickOption = {
  value: string;
  name: string;
  sample?: string;
  kind: "none" | "column" | "every";
};

/** `label` heads the group; the lone "not in my file" choice needs none. */
type PickGroup = { value: string; label: string; items: PickOption[] };

/**
 * The column picker: the DS Combobox, so the filer can type to find a column by its name
 * or by what it holds. "Not in my file" first, so it never sinks under a long list of
 * columns; then the file's columns; then, for a field the court fills from its own list,
 * one of the court's values for every case (BLK-38b).
 */
function ColumnPicker({
  id,
  label,
  value,
  headers,
  firsts,
  list,
  onPick,
}: {
  id: string;
  label: string;
  value: string;
  headers: string[];
  firsts: string[];
  list?: ListName;
  onPick: (value: string) => void;
}) {
  const used = React.useContext(UsedContext);
  const anchor = useComboboxAnchor();
  const groups = React.useMemo<PickGroup[]>(
    () =>
      [
        { value: "later", label: "", items: [{ value: NONE, name: SKIP_OPTION, kind: "none" } as PickOption] },
        {
          value: "columns",
          label: "Columns in your file",
          items: headers.map((h, k): PickOption => ({
            value: String(k),
            name: h || `Column ${k + 1}`,
            sample: firsts[k],
            kind: "column",
          })),
        },
        {
          value: "every",
          label: "Or the same for every case",
          items: list
            ? LISTS[list].map((o): PickOption => ({ value: `every:${o.label}`, name: o.label, kind: "every" }))
            : [],
        },
      ].filter((g) => g.items.length),
    [headers, firsts, list],
  );
  const options = React.useMemo(() => groups.flatMap((g) => g.items), [groups]);
  // Nothing chosen yet: the field waits with a placeholder, not a decision (v8).
  const selected = value === "" ? null : (options.find((o) => o.value === value) ?? options.find((o) => o.kind === "none")!);
  return (
    <Combobox
      items={groups}
      value={selected}
      onValueChange={(o) => {
        if (o) onPick((o as PickOption).value);
      }}
      itemToStringLabel={(o) => {
        const opt = o as PickOption;
        return opt.kind === "every" ? `Every case: ${opt.name}` : opt.kind === "none" ? SKIP : opt.name;
      }}
      isItemEqualToValue={(a, b) => (a as PickOption).value === (b as PickOption).value}
      // Opening shows the whole list; typing narrows it by name or by value.
      filter={(o, q) => {
        const opt = o as PickOption;
        const query = q.trim().toLowerCase();
        if (!query || query === SKIP.toLowerCase() || query === selected?.name.toLowerCase()) return true;
        return `${opt.name} ${opt.sample ?? ""}`.toLowerCase().includes(query);
      }}
    >
      <div ref={anchor} className="w-full">
        <ComboboxInput
          id={id}
          aria-label={label}
          className={cn(
            "w-full",
            // Open, the field and its list read as one box: the field's lower corners square off.
            "has-[[data-popup-open]]:border-ring has-[[data-popup-open]]:ring-0 has-[[data-popup-side=bottom]]:rounded-b-none has-[[data-popup-side=top]]:rounded-t-none",
          )}
          autoComplete="off"
          showTrigger={false}
          placeholder="Choose a column"
          // A chosen column's name is selected on focus, so typing starts a new search.
          onFocus={(e) => e.currentTarget.select()}
        >
          <InputGroupAddon align="inline-end">
            <InputGroupButton size="icon-xs" variant="ghost" asChild>
              <ComboboxTrigger aria-label={`Show columns for ${label}`} />
            </InputGroupButton>
          </InputGroupAddon>
        </ComboboxInput>
      </div>
      {/* Hung from the whole field, flush against it and as wide, so the field and the list
          read as one box whichever way it opens. Vertical only: options never run wider
          than the list. */}
      <ComboboxContent
        anchor={anchor}
        sideOffset={-1}
        className="min-w-(--anchor-width) overflow-x-hidden border border-ring ring-0 data-[side=bottom]:rounded-t-none data-[side=bottom]:border-t-0 data-[side=top]:rounded-b-none data-[side=top]:border-b-0"
      >
        <ComboboxEmpty>No column matches</ComboboxEmpty>
        <ComboboxList className="overflow-x-hidden overscroll-x-none">
          {(group: PickGroup) => (
            // A hairline between groups, so a heading never reads as one more option.
            <ComboboxGroup
              key={group.value}
              items={group.items}
              className="not-first:mt-1 not-first:border-t not-first:border-hairline not-first:pt-1"
            >
              {group.label ? (
                <ComboboxLabel className="text-body-compact font-medium">{group.label}</ComboboxLabel>
              ) : null}
              <ComboboxCollection>
                {(o: PickOption) => (
                  <ComboboxItem
                    key={o.value}
                    value={o}
                    // Room for the tick only on the chosen option; the rest use the full width.
                    className="pr-2.5 text-body-compact aria-selected:pr-8"
                  >
                    {o.kind === "column" ? (
                      <ColumnOption
                        name={o.name}
                        sample={o.sample ?? ""}
                        usedFor={o.value === value ? [] : (used[Number(o.value)] ?? []).map((u) => u.label)}
                      />
                    ) : o.kind === "every" ? (
                      <span>{o.name}</span>
                    ) : (
                      <span className="text-muted-foreground">{o.name}</span>
                    )}
                  </ComboboxItem>
                )}
              </ComboboxCollection>
            </ComboboxGroup>
          )}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  );
}

function sourceValue(src: ColumnSource): string {
  if (typeof src === "number") return String(src);
  if (src && typeof src === "object") return `every:${src.every}`;
  return "";
}

/**
 * A field's state, in front of its name. Not chosen: an empty ring. Matched: the DS
 * success mark. Matched, but the column's values do not fit: the warning mark, with the
 * reason under the column. Left to each case: a neutral mark with a pencil, since each
 * case is then typed in by hand. Each says its state to assistive tech.
 */
type RowState = "todo" | "ok" | "warn" | "later";

const STATE_LABEL: Record<RowState, string> = {
  todo: "Not matched yet",
  ok: "Matched",
  warn: "Matched, check the values",
  later: "Filled in each case later",
};

function RowMark({ state }: { state: RowState }) {
  // A mark plays only when the filer's own choice changes it; at rest every mark is still.
  const [prev, setPrev] = React.useState(state);
  const [play, setPlay] = React.useState(false);
  if (prev !== state) {
    setPrev(state);
    setPlay(state === "ok");
  }
  const label = STATE_LABEL[state];
  if (state === "todo")
    return (
      <span role="img" aria-label={label} title={label} className="flex size-4 shrink-0 items-center justify-center">
        <span className="size-3.5 rounded-full border-2 border-input" />
      </span>
    );
  return (
    <span title={label} className="flex shrink-0">
      <StatusMark
        size={16}
        tone={state === "ok" ? "success" : state === "warn" ? "warning" : "neutral"}
        icon={state === "later" ? PencilLineIcon : undefined}
        still={!play}
        label={label}
      />
    </span>
  );
}

/** Field, arrow, column, example: the same grid for the heading row and every row. */
const ROW = "sm:grid-cols-[minmax(0,1fr)_1rem_minmax(0,1.15fr)_minmax(0,0.85fr)] sm:gap-x-4";

/** One field of one instance: its name, the column it is read from, and that column's first value. */
function FieldRow({
  slot,
  props,
  firsts,
}: {
  slot: Slot;
  props: Props;
  firsts: string[];
}) {
  const { c: column, i: instance, key: selfKey, label } = slot;
  const src = sourceFor(column, instance, props.map, props.headers);
  const id = `map-${column.key}-${instanceKey(instance) || "0"}`;
  const used = React.useContext(UsedContext);
  // Not chosen at all, as opposed to chosen to fill in each case later.
  const unset = src === null && !props.later.has(selfKey);
  const [pending, setPending] = React.useState<{ value: string; others: Use[] } | null>(null);
  const commit = (v: string, clear: Use[]) => {
    const next: ColumnSource = v === NONE ? null : v.startsWith("every:") ? { every: v.slice(6) } : Number(v);
    props.onChange({
      ...props.map,
      ...Object.fromEntries(clear.map((o) => [o.key, null])),
      [selfKey]: next,
    });
    const later = new Set(props.later);
    if (v === NONE) later.add(selfKey);
    else later.delete(selfKey);
    props.onLater(later);
  };
  const values = typeof src === "number" ? props.rows.map((r) => r[src] ?? "") : null;
  const fit = values ? columnFit(column, values) : null;
  // A list column whose words the court does not know fits: the next step translates them.
  const words =
    values && column.list
      ? new Set(values.map((v) => v.trim()).filter((v) => v && listValue(column.list!, v) === null)).size
      : 0;
  const state: RowState = unset
    ? "todo"
    : src === null
      ? "later"
      : fit && !fit.ok && !words
        ? "warn"
        : "ok";
  const example = typeof src === "number" ? firsts[src] : "";
  return (
    <li className={cn("grid grid-cols-1 items-center gap-x-4 gap-y-1.5 py-2", ROW)}>
      <label htmlFor={id} className="flex min-w-0 items-center gap-3">
        <RowMark state={state} />
        <span className="min-w-0 text-body-compact font-medium break-words">{label}</span>
      </label>
      <ArrowRightIcon aria-hidden className="hidden size-4 text-muted-foreground sm:block" />
      <div className="min-w-0">
        <ColumnPicker
          id={id}
          label={`${label}: your column`}
          value={unset ? "" : sourceValue(src) || NONE}
          headers={props.headers}
          firsts={firsts}
          list={column.list}
          onPick={(v) => {
            // A column already matched elsewhere moves here only once the filer agrees.
            const others = /^\d+$/.test(v) ? (used[Number(v)] ?? []).filter((u) => u.key !== selfKey) : [];
            if (others.length) setPending({ value: v, others });
            else commit(v, []);
          }}
        />
      </div>
      <span
        className="min-w-0 truncate pl-7 font-mono text-body-compact text-muted-foreground sm:pl-0"
        title={example || undefined}
      >
        {example ? (
          <>
            <span className="sr-only">Example: </span>
            {example}
          </>
        ) : null}
      </span>
      {words ? (
        <p className="text-body-compact text-muted-foreground sm:col-span-2 sm:col-start-3">
          <span className="tabular-nums">{words}</span> {words === 1 ? "word" : "words"} to translate next
        </p>
      ) : fit && !fit.ok ? (
        <p className="text-body-compact text-warning-ink sm:col-span-2 sm:col-start-3">{fit.note}</p>
      ) : null}
      <ConfirmDialog
        open={pending !== null}
        onOpenChange={(open) => {
          if (!open) setPending(null);
        }}
        destructive={false}
        icon={ArrowLeftRightIcon}
        title={`Move "${pending ? props.headers[Number(pending.value)] : ""}" to ${label}?`}
        description={
          pending
            ? `It is matched to ${pending.others.map((o) => o.label).join(", ")}. Matching it here removes it from there, and that field will need another column.`
            : undefined
        }
        confirmLabel="Move it here"
        onConfirm={() => {
          if (pending) commit(pending.value, pending.others);
          setPending(null);
        }}
      />
    </li>
  );
}

/** A run of rows under a quiet heading: what the file's names left to the filer, then what they found. */
function Block({
  title,
  slots,
  props,
  firsts,
}: {
  title?: string;
  slots: Slot[];
  props: Props;
  firsts: string[];
}) {
  const id = React.useId();
  if (!slots.length) return null;
  return (
    <section aria-labelledby={title ? id : undefined} className="flex flex-col">
      {title ? (
        <h3 id={id} className="pt-4 pb-1 text-body-compact font-medium text-muted-foreground">
          {title}
        </h3>
      ) : null}
      <ul className="flex flex-col divide-y divide-hairline">
        {slots.map((x) => (
          <FieldRow key={x.key} slot={x} props={props} firsts={firsts} />
        ))}
      </ul>
    </section>
  );
}

/**
 * Match columns, as a match-the-following: each court field on the left, the column of the
 * filer's file that holds it on the right, and that column's first value beside it so the
 * match can be checked at a glance. A column whose name is the field's (or a known alias,
 * case and punctuation ignored) arrives chosen; nothing else is guessed. Fields the names
 * did not find come first. Optional fields wait behind one link.
 */
export function ColumnMapping(props: Props) {
  const [showOptional, setShowOptional] = React.useState(false);
  const [repeatsOpen, setRepeatsOpen] = React.useState(false);
  const instances = React.useMemo(() => instancesIn(props.headers, props.counts), [props.headers, props.counts]);
  // What each sheet column already feeds, so the dropdown can say so.
  const used = React.useMemo(() => {
    const out: Record<number, Use[]> = {};
    for (const x of mappingSlots(props.headers, props.counts, true)) {
      const src = sourceFor(x.c, x.i, props.map, props.headers);
      if (typeof src === "number") (out[src] ??= []).push({ label: x.label, key: x.key });
    }
    return out;
  }, [props.map, props.headers, props.counts]);
  // Each column's first value, so a choice can be checked by what the column holds.
  const firsts = React.useMemo(
    () => props.headers.map((_, k) => props.rows.find((r) => r[k]?.trim())?.[k]?.trim() ?? ""),
    [props.headers, props.rows],
  );
  // Found by the file's own column names: a fact of the file, so rows never jump as the filer works.
  const auto = React.useMemo(() => autoMap(props.headers), [props.headers]);
  const slots = mappingSlots(props.headers, props.counts, true);
  const byName = (x: Slot) => sourceFor(x.c, x.i, auto, props.headers) !== null;
  const required = slots.filter((x) => x.required);
  const optional = slots.filter((x) => !x.required);
  const tally = tallyOf(required, props);
  const unresolved = required.filter(
    (x) => sourceFor(x.c, x.i, props.map, props.headers) === null && !props.later.has(x.key),
  );

  return (
    <UsedContext.Provider value={used}>
      <Card variant="raised">
        {/* On a phone the bulk act drops under the count rather than squeezing it. */}
        <CardHeader className="max-sm:has-data-[slot=card-action]:grid-cols-1">
          <CardTitle className="text-body font-semibold tabular-nums">
            {tally.matched} of {tally.total} matched
            {tally.later ? (
              <span className="font-normal text-muted-foreground"> · {tally.later} to fill in each case later</span>
            ) : null}
          </CardTitle>
          <CardDescription className="text-body-compact">
            {repeatsLine(instances, props.counts)}{" "}
            <Button
              variant="link"
              className="h-auto p-0 text-body-compact"
              aria-expanded={repeatsOpen}
              onClick={() => setRepeatsOpen((v) => !v)}
            >
              {repeatsOpen ? "Done" : "Edit"}
            </Button>
          </CardDescription>
          {/* Fields the file has nothing for, decided in one move: each case gets them typed in
              at Case details. Every row stays below to change back. */}
          {unresolved.length > 1 ? (
            <CardAction className="max-sm:col-start-1 max-sm:row-span-1 max-sm:row-start-auto max-sm:mt-2 max-sm:justify-self-start">
              <Button
                variant="outline"
                onClick={() => {
                  const later = new Set(props.later);
                  for (const x of unresolved) later.add(x.key);
                  props.onLater(later);
                  props.onChange({ ...props.map, ...Object.fromEntries(unresolved.map((x) => [x.key, null])) });
                }}
              >
                Fill the rest in each case later
              </Button>
            </CardAction>
          ) : null}
        </CardHeader>
        <CardContent className="flex flex-col">
          {repeatsOpen ? <RepeatSteppers props={props} instances={instances} /> : null}
          <div
            aria-hidden
            className={cn(
              "hidden border-b border-hairline pt-2 pb-2 text-body-compact font-medium text-muted-foreground sm:grid",
              ROW,
            )}
          >
            <span className="pl-7">Court&rsquo;s field</span>
            <span />
            <span>Your column</span>
            <span>Example</span>
          </div>
          {(() => {
            const todo = required.filter((x) => !byName(x));
            const found = required.filter(byName);
            const both = todo.length > 0 && found.length > 0;
            return (
              <>
                <Block title={both ? "Not found by name" : undefined} slots={todo} props={props} firsts={firsts} />
                <Block title={both ? "Found by name" : undefined} slots={found} props={props} firsts={firsts} />
              </>
            );
          })()}
          {showOptional ? <Block title="Optional" slots={optional} props={props} firsts={firsts} /> : null}
          {optional.length ? (
            <Button
              variant="link"
              className="mt-4 h-auto w-fit p-0 text-body-compact"
              aria-expanded={showOptional}
              onClick={() => setShowOptional((v) => !v)}
            >
              {showOptional ? "Hide optional fields" : `Show ${optional.length} optional fields`}
            </Button>
          ) : null}
        </CardContent>
      </Card>
    </UsedContext.Provider>
  );
}

/** One field of one instance, where the file has to say which column fills it. */
type Slot = {
  c: Column;
  i: Instance;
  key: string;
  required: boolean;
  /** The field's name, with the instance when the section repeats ("Cheque 2 · Cheque date"). */
  label: string;
};

/** Every field the file can fill, instance by instance, in the single filing's order. */
function mappingSlots(headers: string[], counts: InstanceCounts, optional: boolean): Slot[] {
  const instances = instancesIn(headers, counts);
  const out: Slot[] = [];
  const top = ORDER.map((id) => GROUPS.find((g) => g.id === id)!).filter(Boolean);
  for (const g of top) {
    const parts = [g, ...GROUPS.filter((x) => x.parent === g.id)];
    for (const part of parts) {
      if (!part.always && instances[part.id].length === 0) continue;
      const list = part.repeats ? instances[part.id] : [firstInstance(part)];
      for (const i of list) {
        const many = part.repeats && list.length > 1;
        const prefix = part.parent
          ? `${instances[part.parent].length > 1 ? `${GROUPS.find((x) => x.id === part.parent)!.label} ${i[0]} · ` : ""}${many ? `${part.label.replace(/^Accused /, "")} ${i[1]} · ` : ""}`
          : many
            ? `${part.label} ${i[0]} · `
            : "";
        for (const c of COLUMNS.filter((x) => x.group === part.id)) {
          const required = MUST_MAP.includes(c.key) && part.always;
          if (!required && !optional) continue;
          out.push({ c, i, key: mapKey(c.key, i, part), required, label: `${prefix}${c.header}` });
        }
      }
    }
  }
  return out;
}

type Tally = { total: number; matched: number; later: number; left: number };

function tallyOf(slots: Slot[], s: { headers: string[]; map: ColumnMap; later: Set<string> }): Tally {
  let matched = 0;
  let later = 0;
  for (const x of slots) {
    if (sourceFor(x.c, x.i, s.map, s.headers) !== null) matched += 1;
    else if (s.later.has(x.key)) later += 1;
  }
  return { total: slots.length, matched, later, left: slots.length - matched - later };
}

/**
 * Match columns' progress over the required fields: how many have a column (or one value
 * for every case), how many are left to each case, and how many still wait on the filer.
 */
export function mappingTally(
  headers: string[],
  map: ColumnMap,
  counts: InstanceCounts,
  later: Set<string>,
): Tally {
  return tallyOf(mappingSlots(headers, counts, false), { headers, map, later });
}

/** Required fields not yet matched or set to fill in each case later: Match columns' "still to match". */
export function mappingLeft(
  headers: string[],
  map: ColumnMap,
  counts: InstanceCounts,
  later: Set<string>,
): number {
  return mappingTally(headers, map, counts, later).left;
}
