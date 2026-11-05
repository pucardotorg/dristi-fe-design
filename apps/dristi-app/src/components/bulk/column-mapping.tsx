"use client";

import * as React from "react";
import { ArrowLeftRightIcon, ArrowRightIcon, CheckIcon, FileSpreadsheetIcon, MinusIcon, PlusIcon, SearchIcon, WandSparklesIcon } from "lucide-react";

import {
  autoMap,
  columnFit,
  firstInstance,
  suggestColumn,
  instancesIn,
  mapKey,
  MUST_MAP,
  sourceFor,
  type ColumnFit,
  type ColumnMap,
  type ColumnSource,
  type InstanceCounts,
} from "@/lib/bulk/excel";
import {
  COLUMNS,
  GROUPS,
  LISTS,
  instanceKey,
  type Column,
  type Group,
  type GroupId,
  type Instance,
  type ListName,
} from "@/lib/bulk/excel-spec";
import { cn } from "@/lib/utils";
import { ConfirmDialog } from "@/components/shell/confirm-dialog";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getStep, type StepId } from "@/lib/filing/steps";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
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

/** The single filing step each section belongs to, for its name, icon and place in the nav. */
const STEP: Partial<Record<GroupId, StepId>> = {
  accused: "accused",
  cheque: "cheque",
  notice: "demand-notice",
  jurisdiction: "jurisdiction",
  otherCase: "jurisdiction",
  witness: "witnesses",
};

const cardTitle = (g: Group) =>
  g.id === "otherCase"
    ? "Other pending cases"
    : STEP[g.id]
      ? getStep(STEP[g.id]!).title
      : g.label;

/** "Accused", "Cheques": what a count of a section is called. */
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

/**
 * What the file allows, in one line: "Some cases have up to 2 cheques." A count is the
 * most any one case has; the rest leave the extra columns blank.
 */
function foundSentence(
  groups: Group[],
  instances: Record<GroupId, Instance[]>,
): string[] {
  const more = groups
    .map((g) => ({ g, n: instances[g.id].length, noun: NOUN[g.id] }))
    .filter(({ g, n, noun }) => noun && (g.always ? n > 1 : n > 0))
    .map(({ n, noun }) => `${n} ${noun![n === 1 ? 0 : 1]}`);
  const join = (xs: string[]) =>
    xs.length < 2
      ? xs.join("")
      : `${xs.slice(0, -1).join(", ")} and ${xs[xs.length - 1]}`;
  return [
    more.length
      ? `Some cases have up to ${join(more)}.`
      : "Each case has 1 accused, 1 cheque and 1 demand notice.",
    "These are the most any one case has. Cases with fewer leave the extra columns blank.",
  ];
}

/**
 * What the file holds of each repeating section, read from its column names, with a
 * stepper to correct it where the names do not make it clear. The sections below follow
 * the count.
 */
function FoundInFile({
  props,
  instances,
}: {
  props: Props;
  instances: Record<GroupId, Instance[]>;
}) {
  const groups = GROUPS.filter((g) => g.repeats && !g.parent);
  return (
    <section
      className="flex flex-col gap-3 rounded-lg border border-hairline bg-surface-sunken p-4"
      aria-labelledby="found-in-file"
    >
      <div className="flex flex-col gap-0.5">
        <h3
          id="found-in-file"
          className="flex items-center gap-2 text-body-compact font-semibold"
        >
          <SheetTile small />
          Found in your file
        </h3>
        {foundSentence(groups, instances).map((line) => (
          <p key={line} className="text-caption text-muted-foreground">
            {line}
          </p>
        ))}
      </div>
      <ul className="flex flex-wrap gap-2">
        {groups.map((g) => {
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
                className="size-8"
                disabled={n <= floor}
                onClick={() => set(n - 1)}
                aria-label={`One fewer: ${name}`}
              >
                <MinusIcon aria-hidden />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="size-8"
                onClick={() => set(n + 1)}
                aria-label={`One more: ${name}`}
              >
                <PlusIcon aria-hidden />
              </Button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/** The choice that leaves a field unmatched: the default whenever no column fits. */
const NONE = "none";
export const SKIP = "Fill in each case later";

/** A sheet column as an option: its name, then its first value, smaller and in mono. */
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
    <span className="flex w-full min-w-0 items-center gap-2">
      <span className="max-w-[60%] shrink-0 truncate font-medium">{name}</span>
      <span className="min-w-0 flex-1 truncate font-mono text-caption text-muted-foreground">
        {sample || "empty"}
      </span>
      {/* Already matched elsewhere: a column can feed two fields, so it stays pickable. */}
      {usedFor.length ? (
        <Badge
          variant="success"
          className="min-w-0 max-w-[50%] shrink truncate"
          title={`Used for ${usedFor.join(", ")}`}
        >
          <CheckIcon data-icon="inline-start" aria-hidden />
          <span className="truncate">
            {usedFor[0]}
            {usedFor.length > 1 ? ` +${usedFor.length - 1}` : ""}
          </span>
        </Badge>
      ) : null}
    </span>
  );
}

/** Which fields each sheet column already feeds, by column number: "Accused name", "Cheque 2 · Cheque number". */
type Use = { label: string; key: string };
const UsedContext = React.createContext<Record<number, Use[]>>({});

type PickOption = {
  value: string;
  name: string;
  sample?: string;
  kind: "none" | "column" | "every";
};

/**
 * The column picker: the DS Combobox, as ComboField uses it in the filing forms, so the
 * filer can type to find a column by its name or by what it holds. Each option is the
 * column's name with its first value set apart; the chosen one shows the same way.
 */
function ColumnPicker({
  id,
  label,
  value,
  headers,
  firsts,
  list,
  onPick,
  state,
  suggestion,
}: {
  id: string;
  label: string;
  value: string;
  headers: string[];
  firsts: string[];
  list?: ListName;
  onPick: (value: string) => void;
  /** Matched but not fitting, or left to each case: the field's outline says it. */
  state: Link;
  /** A likely column, shown in the empty field until it is accepted or another is chosen (v8). */
  suggestion?: number | null;
}) {
  const used = React.useContext(UsedContext);
  const anchor = useComboboxAnchor();
  const options = React.useMemo<PickOption[]>(
    () => [
      { value: NONE, name: SKIP, kind: "none" },
      ...headers.map((h, k): PickOption => ({
        value: String(k),
        name: h || `Column ${k + 1}`,
        sample: firsts[k],
        kind: "column",
      })),
      ...(list
        ? LISTS[list].map((o): PickOption => ({
            value: `every:${o.label}`,
            name: o.label,
            kind: "every",
          }))
        : []),
    ],
    [headers, firsts, list],
  );
  // Nothing chosen yet: the field waits with a placeholder, not a decision (v8).
  const selected = value === "" ? null : (options.find((o) => o.value === value) ?? options[0]);
  return (
    <Combobox
      items={options}
      value={selected}
      onValueChange={(o) => {
        if (o) onPick((o as PickOption).value);
      }}
      itemToStringLabel={(o) =>
        (o as PickOption).kind === "every"
          ? `Every row: ${(o as PickOption).name}`
          : (o as PickOption).name
      }
      isItemEqualToValue={(a, b) =>
        (a as PickOption).value === (b as PickOption).value
      }
      // Opening shows the whole list; typing narrows it by name or by value.
      filter={(o, q) => {
        const opt = o as PickOption;
        const query = q.trim().toLowerCase();
        if (!query || query === selected?.name.toLowerCase()) return true;
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
            // A match stays a plain field with its value (round 3: green fields read as
            // alerts); only values that don't fit, or a field left to each case, are marked.
            state === "warn" &&
              "border-warning-ink bg-warning-muted ring-1 ring-warning/40",
            // Skipped: the same treatment in grey, so it reads as decided, not forgotten.
            state === "none" &&
              "border-muted-foreground/60 bg-muted ring-1 ring-muted-foreground/20",
          )}
          autoComplete="off"
          showTrigger={false}
          placeholder={suggestion != null ? `Suggested: ${headers[suggestion]}` : "Choose a column…"}
          // A chosen column's name is selected on focus, so typing starts a new search.
          onFocus={(e) => e.currentTarget.select()}
        >
          <InputGroupAddon align="inline-start">
            <SearchIcon className="text-muted-foreground" aria-hidden />
          </InputGroupAddon>
          <InputGroupAddon align="inline-end">
            {selected?.sample || (!selected && suggestion != null && firsts[suggestion]) ? (
              <span className="max-w-40 truncate font-mono text-body-compact text-muted-foreground">
                {selected ? selected.sample : firsts[suggestion!]}
              </span>
            ) : null}
            <InputGroupButton size="icon-xs" variant="ghost" asChild>
              <ComboboxTrigger aria-label="Show columns" />
            </InputGroupButton>
          </InputGroupAddon>
        </ComboboxInput>
      </div>
      {/* Hung from the whole field, flush against it and as wide, below or above as there is
          room; the touching corners of both square off, so the field and the list read as one
          box whichever way it opens. Vertical only: options never run wider than the
          list, so a trackpad cannot drift it sideways. */}
      <ComboboxContent
        anchor={anchor}
        sideOffset={-1}
        className="min-w-(--anchor-width) overflow-x-hidden border border-ring ring-0 data-[side=bottom]:rounded-t-none data-[side=bottom]:border-t-0 data-[side=top]:rounded-b-none data-[side=top]:border-b-0"
      >
        <ComboboxEmpty>No column matches</ComboboxEmpty>
        <ComboboxList className="overflow-x-hidden overscroll-x-none">
          {(o: PickOption) => (
            <ComboboxItem
              key={o.value}
              value={o}
              // Room for the tick only on the chosen option; the rest use the full width.
              className="pr-2.5 aria-selected:pr-8"
            >
              {o.kind === "column" ? (
                <ColumnOption
                  name={o.name}
                  sample={o.sample ?? ""}
                  usedFor={
                    o.value === value
                      ? []
                      : (used[Number(o.value)] ?? []).map((u) => u.label)
                  }
                />
              ) : o.kind === "every" ? (
                <span>
                  <span className="text-muted-foreground">Every row: </span>
                  {o.name}
                </span>
              ) : (
                <span className="text-muted-foreground">{o.name}</span>
              )}
            </ComboboxItem>
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

/** One field of one instance: its name, where it is read from, and the first value found. */
function FieldRow({
  column,
  instance,
  props,
  label,
  suggested,
}: {
  column: Column;
  instance: Instance;
  props: Props;
  /** The field's name with its instance when the file repeats the section. */
  label?: string;
  /** A likely column the filer can accept (`suggestColumn`). */
  suggested?: number | null;
}) {
  const g = GROUPS.find((x) => x.id === column.group)!;
  const src = sourceFor(column, instance, props.map, props.headers);
  const id = `map-${column.key}-${instanceKey(instance) || "0"}`;
  const used = React.useContext(UsedContext);
  const selfKey = mapKey(column.key, instance, g);
  // Not chosen at all, as opposed to chosen to fill in each case later.
  const unset = src === null && !props.later.has(selfKey);
  const [pending, setPending] = React.useState<{
    value: string;
    others: Use[];
  } | null>(null);
  const commit = (v: string, clear: Use[]) => {
    const next: ColumnSource =
      v === NONE
        ? null
        : v.startsWith("every:")
          ? { every: v.slice(6) }
          : Number(v);
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
  // Each column's first value, so the choice can be made by what the column holds.
  const firsts = React.useMemo(
    () =>
      props.headers.map(
        (_, k) => props.rows.find((r) => r[k]?.trim())?.[k]?.trim() ?? "",
      ),
    [props.headers, props.rows],
  );
  const fit: ColumnFit | null =
    src === null
      ? null
      : typeof src === "number"
        ? columnFit(
            column,
            props.rows.map((r) => r[src] ?? ""),
          )
        : { ok: true };
  const state: Link = unset ? "todo" : fit === null ? "none" : fit.ok ? "ok" : "warn";
  return (
    // One line per field, centred on its dropdown, with a hover band to follow the row across.
    <li
      className={cn("grid grid-cols-1 items-center gap-1.5 py-2 sm:gap-0", ROW)}
    >
      <label
        htmlFor={id}
        className="flex min-w-0 items-center justify-between gap-2"
      >
        <span className="flex min-w-0 flex-col">
          <span className="truncate text-body-compact font-medium">{label ?? column.header}</span>
          {unset && suggested == null ? (
            <span className="text-body-compact text-muted-foreground">Not in your file</span>
          ) : null}
        </span>
        <LinkNode state={state} className="sm:hidden" />
      </label>
      {/* The connector: a line between the two sides, and on it this field's arrow. */}
      <span className="relative hidden h-full items-center justify-center self-stretch sm:flex">
        <LinkNode state={state} />
      </span>
      <div className="flex min-w-0 flex-col">
        <div className="flex min-w-0 items-center gap-2">
        <div className="min-w-0 flex-1">
        <ColumnPicker
          id={id}
          label={`Column in your sheet for ${column.header}`}
          value={unset ? "" : sourceValue(src) || NONE}
          headers={props.headers}
          firsts={firsts}
          list={column.list}
          state={state}
          suggestion={unset ? suggested : null}
          onPick={(v) => {
            // A column already matched elsewhere moves here only once the filer agrees.
            const others = /^\d+$/.test(v)
              ? (used[Number(v)] ?? []).filter((u) => u.key !== selfKey)
              : [];
            if (others.length) setPending({ value: v, others });
            else commit(v, []);
          }}
        />
        </div>
        {/* Accepting the suggestion in the field, on the same line, so every row stays one row tall (v8). */}
        {unset && suggested != null ? (
          <Button variant="outline" className="shrink-0" onClick={() => commit(String(suggested), [])}>
            Accept
          </Button>
        ) : null}
        </div>
        <ConfirmDialog
          open={pending !== null}
          onOpenChange={(open) => {
            if (!open) setPending(null);
          }}
          destructive={false}
          icon={ArrowLeftRightIcon}
          title={`Move "${pending ? props.headers[Number(pending.value)] : ""}" to ${column.header}?`}
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
        {fit && !fit.ok ? (
          <span className="pt-1 pl-1 text-body-compact text-warning-ink">
            {fit.note}
          </span>
        ) : null}
      </div>
    </li>
  );
}

/** Field, arrow, column (each option shows its first value): the same grid for the header and every row. */
const ROW = "sm:grid-cols-[minmax(0,1fr)_3.5rem_minmax(0,1.2fr)]";

type Link = "ok" | "warn" | "none" | "todo";

/**
 * A field's arrow on the connector. Green with a white arrow: matched, and the column's
 * values fit the field. Amber: matched, but the values do not fit (the reason is under the
 * column). Grey with a white arrow: skipped, to fill manually later. The shape stays the
 * same; the label says the state.
 */
function LinkNode({ state, className }: { state: Link; className?: string }) {
  const label =
    state === "ok"
      ? "Matched"
      : state === "warn"
        ? "Matched, check the values"
        : state === "todo"
          ? "Not matched yet"
          : "Filled in each case later";
  return (
    <span
      role="img"
      aria-label={label}
      title={label}
      className={cn(
        "relative z-10 flex size-7 shrink-0 items-center justify-center rounded-full",
        state === "ok" && "bg-success text-success-foreground",
        state === "warn" && "bg-warning text-warning-foreground",
        state === "none" && "bg-muted-foreground text-background",
        state === "todo" && "border border-input bg-card text-muted-foreground",
        className,
      )}
    >
      <ArrowRightIcon className="size-4" aria-hidden />
    </span>
  );
}


function SheetTile({ small = false }: { small?: boolean }) {
  return (
    <span
      aria-hidden
      className={cn(
        "flex shrink-0 items-center justify-center rounded-lg bg-success-muted text-success-muted-foreground",
        small ? "size-7" : "size-9",
      )}
    >
      <FileSpreadsheetIcon className={small ? "size-4" : "size-5"} />
    </span>
  );
}



/**
 * Column matching for a sheet that is not the template. Required fields come first; the
 * repeated sections the file has (accused 2, cheque 2, witnesses…) follow on tabs; every
 * optional field is behind "Show optional fields". A later instance reads the same column
 * with its `_n` suffix unless the filer picks another.
 */
export function ColumnMapping(props: Props) {
  const [showOptional, setShowOptional] = React.useState(false);
  const instances = React.useMemo(
    () => instancesIn(props.headers, props.counts),
    [props.headers, props.counts],
  );
  // What each sheet column already feeds, so the dropdown can show it.
  const used = React.useMemo(() => {
    const out: Record<number, Use[]> = {};
    for (const g of GROUPS) {
      const list = g.repeats ? instances[g.id] : [firstInstance(g)];
      for (const i of list) {
        // Numbers only where there is more than one: "Cheque 2 · Cheque number", else "Cheque number".
        const siblings = g.parent
          ? instances[g.id].filter(([p]) => p === i[0]).length
          : 0;
        const where = g.parent
          ? `${instances.accused.length > 1 ? `Accused ${i[0]} · ` : ""}${siblings > 1 ? `${g.label.replace(/^Accused /, "")} ${i[1]} · ` : ""}`
          : g.repeats && list.length > 1
            ? `${g.label} ${i[0]} · `
            : "";
        for (const c of COLUMNS.filter((x) => x.group === g.id)) {
          const src = sourceFor(c, i, props.map, props.headers);
          if (typeof src === "number")
            (out[src] ??= []).push({
              label: `${where}${c.header}`,
              key: mapKey(c.key, i, g),
            });
        }
      }
    }
    return out;
  }, [instances, props.map, props.headers]);
  // Every field the file has to fill, instance by instance, sorted into the ones its
  // column names found and the ones that need the filer (v8's two cards).
  const auto = React.useMemo(() => autoMap(props.headers), [props.headers]);
  const slots = mappingSlots(props.headers, props.counts, showOptional);
  // Found by its column name: the reader matched it and the filer has not changed it.
  const byName = (x: Slot) =>
    typeof auto[x.c.key] === "number" &&
    props.map[x.c.key] === auto[x.c.key] &&
    (x.key === x.c.key || props.map[x.key] === undefined) &&
    sourceFor(x.c, x.i, props.map, props.headers) !== null;
  const isUnset = (x: Slot) =>
    sourceFor(x.c, x.i, props.map, props.headers) === null && !props.later.has(x.key);
  const need = slots.filter((x) => x.required && !byName(x));
  const found = slots.filter((x) => byName(x));
  const optional = slots.filter((x) => !x.required && !byName(x));
  const left = need.filter(isUnset).length;
  // A likely column for each field still unset, each column offered once.
  const suggestions = React.useMemo(() => {
    const taken = new Set(
      Object.values(props.map).filter((v): v is number => typeof v === "number"),
    );
    const out = new Map<string, number>();
    for (const x of need.filter(isUnset)) {
      const k = suggestColumn(x.c, props.headers, props.rows, taken);
      if (k !== null) {
        out.set(x.key, k);
        taken.add(k);
      }
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.map, props.headers, props.rows, need.length]);
  // Unset with nothing to suggest: the file has no column for them.
  const unfound = need.filter((x) => isUnset(x) && !suggestions.has(x.key));
  const [found_open, setFoundOpen] = React.useState(false);
  const [repeatsOpen, setRepeatsOpen] = React.useState(false);

  const sections = (list: Slot[]) =>
    [...new Set(list.map((x) => x.section))].map((section) => (
      <div key={section} className="flex flex-col">
        <h3 className="pt-2 text-body-compact font-medium text-muted-foreground">{section}</h3>
        <ul className="flex flex-col divide-y divide-hairline">
          {list
            .filter((x) => x.section === section)
            .map((x) => (
              <FieldRow
                key={x.key}
                column={x.c}
                instance={x.i}
                props={props}
                label={x.label}
                suggested={suggestions.get(x.key) ?? null}
              />
            ))}
        </ul>
      </div>
    ));

  const groupsWithRepeats = GROUPS.filter((g) => g.repeats && !g.parent);
  const repeatLine = foundSentence(groupsWithRepeats, instances)[0];

  return (
    <UsedContext.Provider value={used}>
      <div className="flex flex-col gap-6">
        <Card variant="raised">
          <CardHeader>
            <CardTitle className="text-body font-semibold tabular-nums">
              {left ? `${left} ${left === 1 ? "field needs" : "fields need"} you` : "Every field is matched"}
            </CardTitle>
            <CardDescription>
              {repeatLine}{" "}
              <Button variant="link" className="h-auto p-0" onClick={() => setRepeatsOpen((v) => !v)}>
                {repeatsOpen ? "Done" : "Change"}
              </Button>
            </CardDescription>
            {suggestions.size ? (
              <CardAction>
                <Button
                  onClick={() =>
                    props.onChange({ ...props.map, ...Object.fromEntries(suggestions) })
                  }
                >
                  <WandSparklesIcon data-icon="inline-start" aria-hidden />
                  Accept {suggestions.size} suggestion{suggestions.size === 1 ? "" : "s"}
                </Button>
              </CardAction>
            ) : null}
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {repeatsOpen ? <FoundInFile props={props} instances={instances} /> : null}
            {/* The fields the file has nothing for, decided in one move: each case gets them
                filled in at Case details (round 3: one dropdown per field). Still a choice the
                filer makes, and any can be changed back. */}
            {unfound.length > 1 ? (
              <div className="flex flex-col gap-3 rounded-lg bg-surface-sunken px-4 py-3 sm:flex-row sm:items-center">
                <p className="min-w-0 flex-1 text-body-compact text-muted-foreground">
                  <span className="tabular-nums">{unfound.length}</span> fields have no column in your file:{" "}
                  {unfound.map((x) => x.label).join(", ")}.
                </p>
                <Button
                  variant="outline"
                  className="w-fit shrink-0"
                  onClick={() => {
                    const later = new Set(props.later);
                    for (const x of unfound) later.add(x.key);
                    props.onLater(later);
                    props.onChange({ ...props.map, ...Object.fromEntries(unfound.map((x) => [x.key, null])) });
                  }}
                >
                  Fill these in each case later
                </Button>
              </div>
            ) : null}
            {need.length ? sections(need) : (
              <p className="text-body-compact text-muted-foreground">Every required field was found by its column name.</p>
            )}
          </CardContent>
        </Card>

        <Card variant="raised">
          <CardHeader>
            <CardTitle className="text-body font-semibold tabular-nums">
              {found.length} found by name
            </CardTitle>
            {found_open ? null : (
              <CardDescription>Matched by their column names. Open them to check or change one.</CardDescription>
            )}
            <CardAction>
              <Button variant="ghost" size="sm" aria-expanded={found_open} onClick={() => setFoundOpen((v) => !v)}>
                {found_open ? "Hide" : "Show"}
              </Button>
            </CardAction>
          </CardHeader>
          {found_open ? (
            <CardContent className="flex flex-col gap-4">
              {sections(found)}
              {showOptional ? (
                optional.length ? sections(optional) : null
              ) : (
                <Button variant="link" className="h-auto w-fit p-0" onClick={() => setShowOptional(true)}>
                  Match optional fields too
                </Button>
              )}
            </CardContent>
          ) : null}
        </Card>
      </div>
    </UsedContext.Provider>
  );
}

/** One field of one instance, where the file has to say which column fills it. */
type Slot = {
  c: Column;
  i: Instance;
  key: string;
  required: boolean;
  /** Its section, as the single filing names it. */
  section: string;
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
          out.push({ c, i, key: mapKey(c.key, i, part), required, section: cardTitle(g), label: `${prefix}${c.header}` });
        }
      }
    }
  }
  return out;
}

/** Required fields not yet matched or set to fill in each case later: Match columns' "still to match". */
export function mappingLeft(
  headers: string[],
  map: ColumnMap,
  counts: InstanceCounts,
  later: Set<string>,
): number {
  return mappingSlots(headers, counts, false).filter(
    (x) => x.required && sourceFor(x.c, x.i, map, headers) === null && !later.has(x.key),
  ).length;
}
