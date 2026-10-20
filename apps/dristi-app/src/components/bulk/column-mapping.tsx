"use client";

import * as React from "react";
import {
  ArrowDownIcon,
  SearchIcon,
  CheckIcon,
  HashIcon,
  ArrowRightIcon,
  ChevronDownIcon,
  FileSpreadsheetIcon,
  MinusIcon,
  PlusIcon,
} from "lucide-react";

import {
  columnFit,
  firstInstance,
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
import { BrandGlyph } from "@/components/brand-lockup";
import { ConfirmDialog } from "@/components/shell/confirm-dialog";
import { PANEL_CLASS } from "@/components/filing/form-card";
import { Card } from "@/components/ui/card";
import { SectionTabs } from "@/components/filing/section-tabs";
import { RAIL_ROW, RAIL_ROW_ACTIVE } from "@/components/filing/sections-rail";
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
};

/** Sections in the single filing's order. */
const ORDER: GroupId[] = [
  "case",
  "complainant",
  "accused",
  "cheque",
  "notice",
  "jurisdiction",
  "otherCase",
  "witness",
];

/** The single filing step each section belongs to, for its name, icon and place in the nav. */
const STEP: Partial<Record<GroupId, StepId>> = {
  complainant: "complainant",
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
  complainant: "Further complainants",
  accused: "Accused",
  cheque: "Cheques",
  notice: "Demand notices",
  witness: "Witnesses",
  otherCase: "Other pending cases",
};

/** Singular and plural names for a count in a sentence: "1 accused", "2 cheques". */
const NOUN: Partial<Record<GroupId, [string, string]>> = {
  complainant: ["further complainant", "further complainants"],
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
export const SKIP = "Skip (fill manually later)";

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
}: {
  id: string;
  label: string;
  value: string;
  headers: string[];
  firsts: string[];
  list?: ListName;
  onPick: (value: string) => void;
  /** Matched and fitting, matched but not fitting, or not matched: the field's outline says it. */
  state: Link;
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
  const selected = options.find((o) => o.value === value) ?? options[0];
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
        if (!query || query === selected.name.toLowerCase()) return true;
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
            // The same colours as the row's arrow, on the field itself.
            state === "ok" &&
              "border-success bg-success-muted ring-1 ring-success/40",
            state === "warn" &&
              "border-warning-ink bg-warning-muted ring-1 ring-warning/40",
            // Skipped: the same treatment in grey, so it reads as decided, not forgotten.
            state === "none" &&
              "border-muted-foreground/60 bg-muted ring-1 ring-muted-foreground/20",
          )}
          autoComplete="off"
          showTrigger={false}
          placeholder="Type to search columns"
          // A chosen column's name is selected on focus, so typing starts a new search.
          onFocus={(e) => e.currentTarget.select()}
        >
          <InputGroupAddon align="inline-start">
            <SearchIcon className="text-muted-foreground" aria-hidden />
          </InputGroupAddon>
          <InputGroupAddon align="inline-end">
            {selected.sample ? (
              <span className="max-w-40 truncate font-mono text-caption text-muted-foreground">
                {selected.sample}
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
}: {
  column: Column;
  instance: Instance;
  props: Props;
}) {
  const g = GROUPS.find((x) => x.id === column.group)!;
  const src = sourceFor(column, instance, props.map, props.headers);
  const id = `map-${column.key}-${instanceKey(instance) || "0"}`;
  const used = React.useContext(UsedContext);
  const selfKey = mapKey(column.key, instance, g);
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
  const state: Link = fit === null ? "none" : fit.ok ? "ok" : "warn";
  return (
    // One line per field, centred on its dropdown, with a hover band to follow the row across.
    <li
      className={cn("grid grid-cols-1 items-center gap-1.5 py-2 sm:gap-0", ROW)}
    >
      <label
        htmlFor={id}
        className="flex min-w-0 items-center justify-between gap-2"
      >
        <span className="min-w-0 truncate text-body-compact font-medium">
          {column.header}
        </span>
        <LinkNode state={state} className="sm:hidden" />
      </label>
      {/* The connector: a line between the two sides, and on it this field's arrow. */}
      <span className="relative hidden h-full items-center justify-center self-stretch sm:flex">
        <LinkNode state={state} />
      </span>
      <div className="flex min-w-0 flex-col">
        <ColumnPicker
          id={id}
          label={`Column in your sheet for ${column.header}`}
          value={sourceValue(src) || NONE}
          headers={props.headers}
          firsts={firsts}
          list={column.list}
          state={state}
          onPick={(v) => {
            // A column already matched elsewhere moves here only once the filer agrees.
            const others = /^\d+$/.test(v)
              ? (used[Number(v)] ?? []).filter((u) => u.key !== selfKey)
              : [];
            if (others.length) setPending({ value: v, others });
            else commit(v, []);
          }}
        />
        <ConfirmDialog
          open={pending !== null}
          onOpenChange={(open) => {
            if (!open) setPending(null);
          }}
          destructive={false}
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
          <span className="pt-1 pl-1 text-caption text-warning-ink">
            {fit.note}
          </span>
        ) : null}
      </div>
    </li>
  );
}

/** Field, arrow, column (each option shows its first value): the same grid for the header and every row. */
const ROW = "sm:grid-cols-[minmax(0,1fr)_3.5rem_minmax(0,1.2fr)]";

type Link = "ok" | "warn" | "none";

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
        : "Skipped, fill manually later";
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
        className,
      )}
    >
      <ArrowRightIcon className="size-4" aria-hidden />
    </span>
  );
}

/** The two sides as tiles, the way the batch list marks a source: app mark, Excel mark. */
function AppTile() {
  return (
    <span
      aria-hidden
      className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-hairline bg-card"
    >
      <BrandGlyph className="h-5 w-auto" />
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
 * Which side is which, said with the two marks: the field in the case (ON Courts mark) on
 * the left takes its value from the column of your sheet (Excel mark) on the right. The
 * label avoids the product name, which the court text layer re-voices per state.
 */
function SidesHeader() {
  return (
    // On a phone the rows stack (field, then its column below), so the header stacks too.
    <div
      className={cn(
        "flex flex-col gap-2 sm:grid sm:items-center sm:gap-3",
        ROW,
      )}
    >
      <span className="flex items-center gap-3 text-body-compact font-semibold text-foreground">
        <AppTile />
        Field in the case
      </span>
      <span className="hidden sm:block" />
      <ArrowDownIcon
        className="ml-3 size-4 text-muted-foreground sm:hidden"
        aria-hidden
      />
      <span className="flex items-center gap-3 text-body-compact font-semibold text-foreground">
        <SheetTile />
        Column in your sheet
      </span>
    </div>
  );
}

/** Fields of one section, under a small heading. */
function Section({
  group,
  columns,
  instance,
  props,
  heading = true,
}: {
  group: Group;
  columns: Column[];
  instance: Instance;
  props: Props;
  heading?: boolean;
}) {
  if (!columns.length) return null;
  return (
    <section className="flex flex-col">
      {heading ? (
        <h4 className="text-caption font-semibold text-muted-foreground uppercase">
          {group.label}
        </h4>
      ) : null}
      <ul className="flex flex-col divide-y divide-hairline">
        {columns.map((c) => (
          <FieldRow key={c.key} column={c} instance={instance} props={props} />
        ))}
      </ul>
    </section>
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
  // Which tab is open in each repeating section; kept while counts change.
  const [openTab, setOpenTab] = React.useState<
    Partial<Record<GroupId, string>>
  >({});

  const isRequired = (c: Column) => MUST_MAP.includes(c.key);
  const fieldsOf = (g: Group) =>
    COLUMNS.filter(
      (c) => c.group === g.id && (showOptional || isRequired(c) || !g.always),
    );

  // Required fields across every case-level section and every tab of one a case always has.
  const requiredSlots = GROUPS.flatMap((g) =>
    COLUMNS.filter((c) => c.group === g.id && isRequired(c)).flatMap((c) =>
      (g.always ? instances[g.id] : []).map((i) => ({ c, i })),
    ),
  );
  const matched = requiredSlots.filter(
    ({ c, i }) => sourceFor(c, i, props.map, props.headers) !== null,
  ).length;

  // The single filing's order and names, so the two read the same.
  const top = ORDER.map((id) => GROUPS.find((g) => g.id === id)!).filter(
    Boolean,
  );
  const children = (g: Group) => GROUPS.filter((x) => x.parent === g.id);
  // A section a case may not have at all (witnesses, further complainants, other pending
  // cases) shows once it has a count, or with the optional fields.
  const visible = (g: Group) =>
    g.always || instances[g.id].length > 0 || showOptional;
  const optionalCount = COLUMNS.filter((c) => !isRequired(c)).length;

  const navKey = (g: Group) => STEP[g.id] ?? g.id;
  const shown = top.filter(visible);
  const nav = shown.filter(
    (g, k) => shown.findIndex((x) => navKey(x) === navKey(g)) === k,
  );
  // How many of a section's required fields are matched, across its tabs and the parts
  // inside them (an accused's address). A section with none required counts every field.
  const navCount = (key: string): { n: number; of: number } => {
    const gs = shown
      .filter((g) => navKey(g) === key)
      .flatMap((g) => [g, ...children(g).filter((c) => c.always)]);
    const slots = gs.flatMap((g) => {
      const cols = COLUMNS.filter((c) => c.group === g.id);
      const need = cols.filter(isRequired);
      const inst = g.repeats ? instances[g.id] : [firstInstance(g)];
      return (need.length ? need : cols).flatMap((c) =>
        inst.map((i) => ({ c, i })),
      );
    });
    return {
      n: slots.filter(
        ({ c, i }) => sourceFor(c, i, props.map, props.headers) !== null,
      ).length,
      of: slots.length,
    };
  };
  const [activeNav, setActiveNav] = React.useState("case");
  const cardsRef = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    const root = cardsRef.current;
    if (!root) return;
    // The section nearest the top of the screen is the one the nav marks.
    const seen = new IntersectionObserver(
      (entries) => {
        const first = entries
          .filter((e) => e.isIntersecting)
          .sort(
            (x, y) => x.boundingClientRect.top - y.boundingClientRect.top,
          )[0];
        if (first)
          setActiveNav((first.target as HTMLElement).dataset.nav ?? "case");
      },
      { rootMargin: "-80px 0px -60% 0px" },
    );
    root.querySelectorAll("[data-nav]").forEach((el) => seen.observe(el));
    return () => seen.disconnect();
  }, [shown.length]);

  // A tab is done when its required fields are matched (or, for an optional section, any field).
  const tabDone = (g: Group, i: Instance) => {
    const cols = COLUMNS.filter((c) => c.group === g.id);
    const need = cols.filter(isRequired);
    const has = (c: Column) =>
      sourceFor(c, i, props.map, props.headers) !== null;
    return need.length ? need.every(has) : cols.some(has);
  };

  const addOne = (g: Group) => {
    const n = instances[g.id].length + 1;
    props.onCounts({ ...props.counts, [g.id]: n });
    setOpenTab((t) => ({ ...t, [g.id]: instanceKey([g.first + n - 1]) }));
  };

  return (
    <UsedContext.Provider value={used}>
      <div className="flex flex-col gap-6">
        <FoundInFile props={props} instances={instances} />

        <section className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <h3 className="text-body font-semibold">
              Match each field to a column
            </h3>
            <Badge
              variant={matched === requiredSlots.length ? "success" : "warning"}
              className="tabular-nums"
            >
              {matched} of {requiredSlots.length} required matched
            </Badge>
            <Button
              variant="ghost"
              className="ml-auto"
              aria-expanded={showOptional}
              onClick={() => setShowOptional((v) => !v)}
            >
              <ChevronDownIcon
                data-icon="inline-start"
                className={cn(
                  "transition-transform",
                  showOptional && "rotate-180",
                )}
                aria-hidden
              />
              {showOptional
                ? "Hide optional fields"
                : `Show optional fields (${optionalCount})`}
            </Button>
          </div>

          <div className="xl:grid xl:grid-cols-[13rem_minmax(0,1fr)] xl:items-start xl:gap-6">
            {/* Secondary nav: the single filing's sections, to jump between them. */}
            <nav
              aria-label="Sections to match"
              className="sticky top-20 hidden xl:block"
            >
              <ul className="flex flex-col gap-1">
                {nav.map((g) => {
                  const key = navKey(g);
                  const step = STEP[g.id] ? getStep(STEP[g.id]!) : null;
                  const Icon = step?.icon ?? HashIcon;
                  const active = activeNav === key;
                  return (
                    <li key={key}>
                      <Button
                        variant="ghost"
                        className={cn(RAIL_ROW, active && RAIL_ROW_ACTIVE)}
                        aria-current={active ? "location" : undefined}
                        onClick={() => {
                          setActiveNav(key);
                          document
                            .getElementById(`map-sec-${key}`)
                            ?.scrollIntoView({
                              behavior: "smooth",
                              block: "start",
                            });
                        }}
                      >
                        <Icon
                          aria-hidden
                          className={
                            active ? undefined : "text-muted-foreground"
                          }
                        />
                        <span className="min-w-0 truncate">
                          {step?.title ?? "Case"}
                        </span>
                        {(() => {
                          // Said in numbers, not a mark to decode: "2 of 5", or a tick when all are.
                          const { n, of } = navCount(key);
                          return n === of && of > 0 ? (
                            <span className="ml-auto flex items-center gap-1 text-caption text-success-ink">
                              <CheckIcon className="size-4" aria-hidden />
                              <span className="sr-only">all {of} matched</span>
                            </span>
                          ) : (
                            <span className="ml-auto text-caption tabular-nums text-muted-foreground">
                              {n} of {of}
                              <span className="sr-only"> matched</span>
                            </span>
                          );
                        })()}
                      </Button>
                    </li>
                  );
                })}
              </ul>
            </nav>

            <div ref={cardsRef} className="flex flex-col gap-8">
              <div className="px-6">
                <SidesHeader />
              </div>
              {shown.map((g) => {
                // Every section that can repeat has numbered tabs, even with one: Accused 1,
                // then Accused 2 once the file (or the filer) says there is a second.
                const list = g.repeats ? instances[g.id] : [firstInstance(g)];
                const keys = list.map(instanceKey);
                const chosen = openTab[g.id];
                const current =
                  chosen !== undefined && keys.includes(chosen)
                    ? chosen
                    : keys[0];
                const name = (i: Instance) => `${g.label} ${i[0]}`;
                return (
                  // Laid out as the single filing lays out a section: heading, tabs, then cards.
                  <section
                    key={g.id}
                    id={nav.includes(g) ? `map-sec-${navKey(g)}` : undefined}
                    data-nav={navKey(g)}
                    className="flex scroll-mt-20 flex-col gap-4"
                  >
                    <h3 className="text-title-s font-semibold">
                      {cardTitle(g)}
                    </h3>
                    {g.repeats ? (
                      <SectionTabs
                        tabs={list.map((i, k) => ({
                          id: instanceKey(i),
                          label: name(i),
                          status: tabDone(g, i) ? "complete" : "attention",
                          // Only the last can go: the numbers are the sheet's _2, _3.
                          removable:
                            k === list.length - 1 &&
                            list.length > (g.always ? 1 : 0),
                        }))}
                        activeId={current ?? ""}
                        onSelect={(v) =>
                          setOpenTab((t) => ({ ...t, [g.id]: v }))
                        }
                        onRemove={() =>
                          props.onCounts({
                            ...props.counts,
                            [g.id]: list.length - 1,
                          })
                        }
                        addLabel={`Add ${g.label.toLowerCase()}`}
                        onAdd={() => addOne(g)}
                      />
                    ) : null}
                    {list
                      .filter((i) => instanceKey(i) === current)
                      .flatMap((i) => [
                        {
                          key: `${g.id}-${instanceKey(i)}`,
                          // The section heading or the tab already names the main part.
                          title: null as string | null,
                          group: g,
                          inst: i,
                        },
                        ...children(g)
                          .flatMap((c) =>
                            instances[c.id]
                              .filter(([p]) => p === i[0])
                              .map((ci) => ({ c, ci })),
                          )
                          .filter(
                            ({ c }) =>
                              fieldsOf(c).length && (c.always || showOptional),
                          )
                          .map(({ c, ci }) => ({
                            key: `${c.id}-${instanceKey(ci)}`,
                            title: `${c.label} ${ci[1]}`,
                            group: c,
                            inst: ci,
                          })),
                      ])
                      .map((part) => (
                        // Titles sit outside the card, so the card is only rows and the line
                        // runs from its top edge to its bottom edge.
                        <div key={part.key} className="flex flex-col gap-2">
                          {part.title ? (
                            <h4 className="text-body font-semibold">
                              {part.title}
                            </h4>
                          ) : null}
                          <Card
                            className={cn(
                              PANEL_CLASS,
                              "relative gap-0 px-6 py-2",
                            )}
                          >
                            {/* The middle column of field 1fr, 3.5rem, column 1.2fr, inside px-6. */}
                            <span
                              aria-hidden
                              className="absolute inset-y-0 hidden w-px bg-hairline sm:block"
                              style={{
                                left: "calc(1.5rem + (100% - 6.5rem) / 2.2 + 1.75rem)",
                              }}
                            />
                            <Section
                              group={part.group}
                              columns={fieldsOf(part.group)}
                              instance={part.inst}
                              props={props}
                              heading={false}
                            />
                          </Card>
                        </div>
                      ))}
                  </section>
                );
              })}
            </div>
          </div>
        </section>
      </div>
    </UsedContext.Provider>
  );
}
