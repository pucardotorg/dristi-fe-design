"use client";

import * as React from "react";
import { ArrowLeftRightIcon, ArrowRightIcon, MinusIcon, PencilLineIcon, PlusIcon } from "lucide-react";

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
  listValue,
  type Column,
  type GroupId,
  type Instance,
  type ListName,
} from "@/lib/bulk/excel-spec";
import { cn } from "@/lib/utils";
import { ConfirmDialog } from "@/components/shell/confirm-dialog";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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

/**
 * Under a section's own heading a field drops the words the heading already says: in
 * "Cheque 1", "Cheque date" is "Date"; in "Accused", "Accused pincode" is "Pincode".
 */
const SAID_BY_SECTION: Partial<Record<GroupId, string>> = {
  accused: "Accused ",
  cheque: "Cheque ",
  notice: "Notice ",
  witness: "Witness ",
  otherCase: "Other pending case ",
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
      className="flex flex-wrap gap-2 rounded-lg border border-hairline bg-surface-sunken p-2"
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

/** A sheet column as an option: its name, then its first value, muted as in the row's preview; "In use" if another field reads it. */
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
      <span className="min-w-0 flex-1 truncate text-body-compact text-muted-foreground tabular-nums">
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
 * A field's state. Not chosen: no mark at all, so the empty picker beside it is the one
 * thing that says so (an empty ring read as a radio button). Matched: the DS success mark.
 * Matched, but the column's values do not fit: the warning mark, with the reason under the
 * column. Left to each case: a neutral mark with a pencil, since each case is then typed
 * in by hand. Each says its state to assistive tech.
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
  if (state === "todo") return <span className="sr-only">{label}: </span>;
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

/** What one sheet column holds: a few of its values from different rows, and how many rows fill it. */
type ColumnFacts = { samples: string[]; filled: number };

/** Where a field stands, worked out once so the row and the section rail agree. */
type SlotInfo = {
  src: ColumnSource;
  state: RowState;
  fit: ColumnFit | null;
  /** Words of a court list the file uses and the court does not know: the next step's work. */
  words: number;
};

function infoOf(slot: Slot, props: Props): SlotInfo {
  const src = sourceFor(slot.c, slot.i, props.map, props.headers);
  // Not chosen at all, as opposed to chosen to fill in each case later.
  const unset = src === null && !props.later.has(slot.key);
  const values = typeof src === "number" ? props.rows.map((r) => r[src] ?? "") : null;
  const fit = values ? columnFit(slot.c, values) : null;
  // A list column whose words the court does not know fits: the next step translates them.
  const words =
    values && slot.c.list
      ? new Set(values.map((v) => v.trim()).filter((v) => v && listValue(slot.c.list!, v) === null)).size
      : 0;
  const state: RowState = unset ? "todo" : src === null ? "later" : fit && !fit.ok && !words ? "warn" : "ok";
  return { src, state, fit, words };
}

/**
 * Field, arrow, column, what the column holds: one grid for every row of every section, so
 * the pickers and the values stand in two clean columns down the page.
 */
const ROW =
  "sm:grid-cols-[minmax(0,0.85fr)_1rem_minmax(0,1.25fr)_minmax(0,0.9fr)] sm:items-center sm:gap-x-4";

/** A column's values as small wells, as many whole ones as fit on one line; the rest wrap out of sight. */
function Samples({ values }: { values: string[] }) {
  return (
    <div className="flex h-6 min-w-0 flex-wrap gap-2 overflow-hidden">
      <span className="sr-only">Values in this column: </span>
      {values.map((v, k) => (
        <span
          key={k}
          title={v}
          className="flex h-6 max-w-full items-center rounded-md bg-surface-sunken px-2 text-body-compact tabular-nums"
        >
          <span className="truncate">{v}</span>
        </span>
      ))}
    </div>
  );
}

/** One field of one instance: its name, the column it is read from, and what that column holds. */
function FieldRow({
  slot,
  info,
  props,
  facts,
  firsts,
}: {
  slot: Slot;
  info: SlotInfo;
  props: Props;
  facts: ColumnFacts[];
  firsts: string[];
}) {
  const { c: column, i: instance, key: selfKey, name } = slot;
  const { src, state, fit, words } = info;
  const id = `map-${column.key}-${instanceKey(instance) || "0"}`;
  const used = React.useContext(UsedContext);
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
  const held = typeof src === "number" ? facts[src] : null;
  const rows = props.rows.length;
  // A required column most rows leave blank is likely the wrong column; a few blanks are
  // cases Fix & check will ask about. A second cheque or accused is blank wherever a case has
  // only one, so only a section's first counts.
  const first = instance.every((n) => n === 1);
  const blanks = held && slot.required && first && held.filled > 0 && held.filled * 2 < rows ? rows - held.filled : 0;
  const note = words ? (
    <p className="text-body-compact text-muted-foreground">
      <span className="tabular-nums">{words}</span> {words === 1 ? "word" : "words"} to translate next
    </p>
  ) : fit && !fit.ok ? (
    <p className="text-body-compact text-warning-ink">{fit.note}</p>
  ) : blanks ? (
    <p className="text-body-compact text-muted-foreground tabular-nums">
      Empty in {blanks} of {rows} rows
    </p>
  ) : null;
  return (
    <li
      data-to-match={state === "todo" || undefined}
      // On a phone: the name, with "Not in my file" across from it; the column under both.
      className={cn("grid grid-cols-[minmax(0,1fr)_auto] items-center gap-y-2 py-3 max-sm:gap-x-3", ROW)}
    >
      <label htmlFor={id} className="flex min-w-0 items-center gap-2">
        {/* The mark's slot stays when there is no mark, so every name starts on one line. */}
        <span className="flex size-4 shrink-0 items-center justify-center">
          <RowMark state={state} />
        </span>
        <span className="min-w-0 text-body-compact font-medium break-words">{name}</span>
      </label>
      <ArrowRightIcon aria-hidden className="hidden size-4 text-muted-foreground sm:block" />
      <div className="min-w-0 max-sm:col-span-2 max-sm:pl-6">
        <ColumnPicker
          id={id}
          label={`${name}, ${slot.sectionTitle}`}
          value={state === "todo" ? "" : sourceValue(src) || NONE}
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
      <div
        className={cn(
          "min-w-0 max-sm:empty:hidden",
          state === "todo" ? "max-sm:col-start-2 max-sm:row-start-1" : "max-sm:col-span-2 max-sm:pl-6",
        )}
      >
        {state === "todo" ? (
          // The other answer, one press away rather than at the top of the list.
          <Button
            variant="ghost"
            className="px-3 text-body-compact font-normal max-sm:-mr-3 sm:-ml-3"
            onClick={(e) => {
              const row = e.currentTarget.closest("li");
              commit(NONE, []);
              // The button goes with the answer: focus walks on to the next field still to match.
              requestAnimationFrame(() => focusAfter(row));
            }}
            aria-label={`Not in my file: ${name}, ${slot.sectionTitle}`}
          >
            <span className="underline decoration-muted-foreground underline-offset-4">Not in my file</span>
          </Button>
        ) : held && held.samples.length ? (
          <Samples values={held.samples} />
        ) : null}
      </div>
      {note ? <div className="max-sm:col-span-2 max-sm:pl-6 sm:col-span-2 sm:col-start-3">{note}</div> : null}
      <ConfirmDialog
        open={pending !== null}
        onOpenChange={(open) => {
          if (!open) setPending(null);
        }}
        destructive={false}
        icon={ArrowLeftRightIcon}
        title={`Move "${pending ? props.headers[Number(pending.value)] : ""}" to ${slot.label}?`}
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

/** One section of a case, in the single filing's order: what the court calls it, and its fields. */
type Section = { id: string; title: string; slots: Slot[] };

function sectionsOf(slots: Slot[]): Section[] {
  const out: Section[] = [];
  for (const x of slots) {
    const last = out[out.length - 1];
    if (last?.id === x.section) last.slots.push(x);
    else out.push({ id: x.section, title: x.sectionTitle, slots: [x] });
  }
  return out;
}

/** Where a section stands: how many of its fields still wait, and whether any needs a look. */
function sectionState(section: Section, infos: Map<string, SlotInfo>) {
  const req = section.slots.filter((x) => x.required);
  const todo = req.filter((x) => infos.get(x.key)!.state === "todo").length;
  const warn = req.some((x) => infos.get(x.key)!.state === "warn");
  const later = req.some((x) => infos.get(x.key)!.state === "later");
  return { todo, warn, later, required: req.length };
}

const sectionDomId = (id: string) => `map-section-${id.replace(/[^a-z0-9]/gi, "-")}`;

/** After a row is answered: the next field still to match below it, else that row's own picker. */
function focusAfter(row: Element | null) {
  if (!row) return;
  const next = [...document.querySelectorAll<HTMLElement>("[data-to-match]")].find(
    (el) => row.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_FOLLOWING,
  );
  const target = (next ?? row).querySelector<HTMLInputElement>("input");
  if (!target) return;
  const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  (next ?? row).scrollIntoView({ block: "nearest", behavior: still ? "auto" : "smooth" });
  target.focus({ preventScroll: true });
}

/**
 * Take the filer to a field still to match: the first in `within` (a section), else the
 * first on the page. Its picker takes focus, so the next keys choose its column.
 */
export function focusNextToMatch(within?: string) {
  const root = within ? document.getElementById(sectionDomId(within)) : document;
  const row = root?.querySelector<HTMLElement>("[data-to-match]");
  const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (!row) {
    if (root instanceof HTMLElement) root.scrollIntoView({ block: "start", behavior: still ? "auto" : "smooth" });
    return;
  }
  row.scrollIntoView({ block: "center", behavior: still ? "auto" : "smooth" });
  row.querySelector<HTMLInputElement>("input")?.focus({ preventScroll: true });
}

function SectionCard({
  section,
  infos,
  props,
  facts,
  firsts,
}: {
  section: Section;
  infos: Map<string, SlotInfo>;
  props: Props;
  facts: ColumnFacts[];
  firsts: string[];
}) {
  const [open, setOpen] = React.useState(false);
  const titleId = React.useId();
  const { todo, required } = sectionState(section, infos);
  const optional = section.slots.filter((x) => !x.required);
  // A section the file brought only optional fields for shows them; the others keep them behind one link.
  const shown = required ? section.slots.filter((x) => x.required || open) : section.slots;
  return (
    <section
      id={sectionDomId(section.id)}
      data-map-section={section.id}
      aria-labelledby={titleId}
      className="scroll-mt-(--map-top)"
    >
      <Card variant="raised" className="gap-0 py-0">
        <div className="flex items-baseline justify-between gap-4 px-6 pt-6 pb-1">
          <h2 id={titleId} className="text-body font-semibold">
            {section.title}
          </h2>
          {todo ? (
            <span className="shrink-0 text-body-compact text-muted-foreground tabular-nums">{todo} to match</span>
          ) : !required ? (
            <span className="shrink-0 text-body-compact text-muted-foreground">Optional</span>
          ) : null}
        </div>
        <ul className="flex flex-col divide-y divide-hairline px-6">
          {shown.map((x) => (
            <FieldRow key={x.key} slot={x} info={infos.get(x.key)!} props={props} facts={facts} firsts={firsts} />
          ))}
        </ul>
        {required && optional.length ? (
          <div className="border-t border-hairline px-6 pt-2 pb-3">
            <Button
              variant="link"
              className="h-10 px-0 text-body-compact"
              aria-expanded={open}
              onClick={() => setOpen((v) => !v)}
            >
              {open ? "Hide optional fields" : `Show ${optional.length} optional ${optional.length === 1 ? "field" : "fields"}`}
            </Button>
          </div>
        ) : (
          <div className="pb-3" />
        )}
      </Card>
    </section>
  );
}

/** A section's state in the rail: what is left, or that it is answered. */
function RailMark({ state }: { state: ReturnType<typeof sectionState> }) {
  const tone = state.todo ? null : state.warn ? "warning" : state.later ? "neutral" : "success";
  // A section's mark plays once, when the filer's last answer in it lands.
  const [prev, setPrev] = React.useState(tone);
  const [play, setPlay] = React.useState(false);
  if (prev !== tone) {
    setPrev(tone);
    setPlay(tone === "success");
  }
  if (!state.required) return null;
  if (state.todo)
    return (
      <span className="flex h-6 min-w-6 shrink-0 items-center justify-center rounded-full border border-hairline bg-card px-2 text-body-compact tabular-nums">
        {state.todo}
        <span className="sr-only"> to match</span>
      </span>
    );
  const label = tone === "warning" ? "Matched, check the values" : tone === "neutral" ? "Answered, some in each case later" : "All matched";
  return (
    <StatusMark
      size={16}
      tone={tone!}
      icon={tone === "neutral" ? PencilLineIcon : undefined}
      still={!play}
      label={label}
    />
  );
}

/**
 * Where the page's pinned band ends (the top bar, then the batch's steps), as the bulk
 * lists measure it, so the rail stops under it and a section scrolled to lands clear of it.
 */
function pinnedBottom(): number {
  const rem = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
  const bar = 3.5 * rem;
  const steps = document.querySelector('nav[aria-label="Batch steps"]')?.parentElement;
  if (!steps) return bar;
  return (parseFloat(getComputedStyle(steps).top) || bar) + steps.offsetHeight;
}

/** The rail's place under the pinned band, and the room it has above the footer. */
function usePinned() {
  const [m, setM] = React.useState({ top: 0, room: 0 });
  React.useEffect(() => {
    const measure = () => {
      const top = Math.round(pinnedBottom());
      const footer = document.querySelector("footer")?.getBoundingClientRect().height ?? 0;
      const room = Math.round(window.innerHeight - top - footer);
      setM((p) => (p.top === top && p.room === room ? p : { top, room }));
    };
    measure();
    const ro = new ResizeObserver(measure);
    const steps = document.querySelector('nav[aria-label="Batch steps"]')?.parentElement;
    if (steps) ro.observe(steps);
    window.addEventListener("resize", measure);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, []);
  // 24px of air under the band, and as much over the footer.
  return {
    "--map-top": `${m.top + 24}px`,
    "--map-room": `${Math.max(0, m.room - 48)}px`,
  } as React.CSSProperties;
}

/** The section the filer is reading: the last whose top has passed a third of the way down the window. */
function useActiveSection(ids: string[]) {
  const [active, setActive] = React.useState<string | null>(ids[0] ?? null);
  const key = ids.join("|");
  React.useEffect(() => {
    const list = key.split("|").filter(Boolean);
    const els = list.map((id) => document.getElementById(sectionDomId(id))).filter((e): e is HTMLElement => !!e);
    if (!els.length) return;
    const pick = () => {
      const line = window.innerHeight / 3;
      let at = list[0];
      els.forEach((el, k) => {
        if (el.getBoundingClientRect().top <= line) at = list[k];
      });
      setActive(at);
    };
    const io = new IntersectionObserver(pick, { threshold: [0, 0.25, 0.5, 0.75, 1] });
    els.forEach((el) => io.observe(el));
    window.addEventListener("scroll", pick, { passive: true, capture: true });
    pick();
    return () => {
      io.disconnect();
      window.removeEventListener("scroll", pick, { capture: true });
    };
  }, [key]);
  return active;
}

/**
 * Match columns, as a match-the-following in the shape of a case: one panel per section
 * (Case, Accused, Cheque 1, Cheque 2…), each court field on the left, the column of the
 * filer's file that holds it on the right, and a few of that column's values beside it so
 * the match can be checked at a glance. A column whose name is the field's (or a known
 * alias, case and punctuation ignored) arrives chosen; nothing else is guessed. Beside
 * the sections, a rail says what is left in each and takes the filer to it.
 */
export function ColumnMapping(props: Props) {
  const [repeatsOpen, setRepeatsOpen] = React.useState(false);
  const instances = React.useMemo(() => instancesIn(props.headers, props.counts), [props.headers, props.counts]);
  const slots = React.useMemo(() => mappingSlots(props.headers, props.counts, true), [props.headers, props.counts]);
  // What each sheet column already feeds, so the dropdown can say so.
  const used = React.useMemo(() => {
    const out: Record<number, Use[]> = {};
    for (const x of slots) {
      const src = sourceFor(x.c, x.i, props.map, props.headers);
      if (typeof src === "number") (out[src] ??= []).push({ label: x.label, key: x.key });
    }
    return out;
  }, [slots, props.map, props.headers]);
  // What each column holds: up to three different values, from the top of the file down,
  // and how many rows have anything in it.
  const facts = React.useMemo<ColumnFacts[]>(
    () =>
      props.headers.map((_, k) => {
        const samples: string[] = [];
        let filled = 0;
        for (const r of props.rows) {
          const v = r[k]?.trim() ?? "";
          if (!v) continue;
          filled += 1;
          if (samples.length < 3 && !samples.includes(v)) samples.push(v);
        }
        return { samples, filled };
      }),
    [props.headers, props.rows],
  );
  const firsts = React.useMemo(() => facts.map((f) => f.samples[0] ?? ""), [facts]);
  const infos = React.useMemo(
    () => new Map(slots.map((x) => [x.key, infoOf(x, props)])),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- infoOf reads only these
    [slots, props.map, props.later, props.rows, props.headers],
  );
  const sections = React.useMemo(() => sectionsOf(slots), [slots]);
  const active = useActiveSection(sections.map((s) => s.id));
  const pinned = usePinned();
  const tallyRef = React.useRef<HTMLDivElement>(null);
  const required = slots.filter((x) => x.required);
  const tally = tallyOf(required, props);
  const unresolved = required.filter((x) => infos.get(x.key)!.state === "todo");

  return (
    <UsedContext.Provider value={used}>
      <div
        style={pinned}
        className="flex flex-col gap-4 lg:grid lg:grid-cols-[14rem_minmax(0,1fr)] lg:items-start lg:gap-8"
      >
        <aside aria-label="Progress" className="lg:sticky lg:top-(--map-top)">
          <Card
            variant="raised"
            size="sm"
            className="gap-3 sm:max-lg:flex-row sm:max-lg:items-center sm:max-lg:justify-between lg:max-h-(--map-room) lg:overflow-y-auto"
          >
            <CardHeader className="sm:max-lg:flex-1">
              {/* Takes focus when the one-move answer removes its own button. */}
              <CardTitle ref={tallyRef} tabIndex={-1} className="text-body font-semibold tabular-nums outline-none">
                {tally.matched} of {tally.total} matched
              </CardTitle>
              {tally.later ? (
                <CardDescription className="text-body-compact tabular-nums">
                  {tally.later} to fill in each case later
                </CardDescription>
              ) : null}
            </CardHeader>
            <nav aria-label="Sections" className="hidden px-2 lg:block">
              <ul className="flex flex-col gap-1">
                {sections.map((s) => {
                  const st = sectionState(s, infos);
                  return (
                    <li key={s.id}>
                      <Button
                        variant="ghost"
                        aria-current={active === s.id ? "location" : undefined}
                        onClick={() => focusNextToMatch(s.id)}
                        className="h-auto min-h-10 w-full justify-between gap-3 px-2 py-2 text-left text-body-compact font-normal whitespace-normal aria-[current=location]:bg-accent-strong aria-[current=location]:font-medium"
                      >
                        <span className="min-w-0">{s.title}</span>
                        <RailMark state={st} />
                      </Button>
                    </li>
                  );
                })}
              </ul>
            </nav>
            {/* Fields the file has nothing for, decided in one move: each case gets them typed in
                at Case details. Every row stays to change back. */}
            {unresolved.length > 1 ? (
              <div className="px-4 sm:max-lg:pl-0 lg:border-t lg:border-hairline lg:pt-3">
                <Button
                  variant="outline"
                  className="w-full text-body-compact"
                  onClick={() => {
                    const later = new Set(props.later);
                    for (const x of unresolved) later.add(x.key);
                    props.onLater(later);
                    props.onChange({ ...props.map, ...Object.fromEntries(unresolved.map((x) => [x.key, null])) });
                    requestAnimationFrame(() => tallyRef.current?.focus());
                  }}
                >
                  The rest aren&rsquo;t in my file
                </Button>
              </div>
            ) : null}
          </Card>
        </aside>
        <div className="flex min-w-0 flex-col gap-4">
          <p className="text-body-compact text-muted-foreground">
            {repeatsLine(instances, props.counts)}{" "}
            <Button
              variant="link"
              className="h-auto p-0 text-body-compact"
              aria-expanded={repeatsOpen}
              onClick={() => setRepeatsOpen((v) => !v)}
            >
              {repeatsOpen ? "Done" : "Edit"}
            </Button>
          </p>
          {repeatsOpen ? <RepeatSteppers props={props} instances={instances} /> : null}
          {sections.map((s) => (
            <SectionCard key={s.id} section={s} infos={infos} props={props} facts={facts} firsts={firsts} />
          ))}
        </div>
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
  /** The field's full name, with its section when that repeats ("Cheque 2 · Cheque date"). */
  label: string;
  /** The field's name under its section's heading ("Date" under "Cheque 2"). */
  name: string;
  /** The section it sits in, one per instance of a repeating section ("cheque:2"). */
  section: string;
  sectionTitle: string;
};

/** Every field the file can fill, section by section, in the single filing's order. */
function mappingSlots(headers: string[], counts: InstanceCounts, optional: boolean): Slot[] {
  const instances = instancesIn(headers, counts);
  const out: Slot[] = [];
  const top = ORDER.map((id) => GROUPS.find((g) => g.id === id)!).filter(Boolean);
  for (const g of top) {
    if (!g.always && instances[g.id].length === 0) continue;
    const tops = g.repeats ? instances[g.id] : [firstInstance(g)];
    for (const t of tops) {
      const sectionTitle = g.repeats && tops.length > 1 ? `${g.label} ${t[0]}` : g.label;
      const said = SAID_BY_SECTION[g.id];
      for (const part of [g, ...GROUPS.filter((x) => x.parent === g.id)]) {
        if (!part.always && instances[part.id].length === 0) continue;
        const list = part === g ? [t] : instances[part.id].filter((i) => i[0] === t[0]);
        for (const i of list) {
          const nested = part !== g && list.length > 1 ? `${part.label.replace(/^Accused /, "")} ${i[1]} · ` : "";
          for (const c of COLUMNS.filter((x) => x.group === part.id)) {
            const required = MUST_MAP.includes(c.key) && part.always;
            if (!required && !optional) continue;
            const own = said && c.header.startsWith(said) ? c.header.slice(said.length) : c.header;
            const name = `${nested}${own.charAt(0).toUpperCase()}${own.slice(1)}`;
            out.push({
              c,
              i,
              key: mapKey(c.key, i, part),
              required,
              label: `${sectionTitle === g.label ? "" : `${sectionTitle} · `}${nested}${c.header}`,
              name,
              section: `${g.id}:${instanceKey(t) || "0"}`,
              sectionTitle,
            });
          }
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
