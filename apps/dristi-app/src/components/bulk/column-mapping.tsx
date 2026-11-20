"use client";

import * as React from "react";
import { ArrowLeftRightIcon, CheckIcon, ChevronDownIcon } from "lucide-react";

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
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
  /** The file being matched, named at the head of the index. */
  fileName?: string;
};

/** The page's one line under "Match columns": what the screen asks, in the filer's words. */
export const MAP_INTRO = "Choose the column in your file that holds each court field.";

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
 * How many of each repeating section a case holds (BLK-38c), as one line that edits in
 * place: "1 accused · 2 cheques · 1 demand notice". Each number is a quiet select. It heads
 * the page because it decides which sections exist below.
 */
function PerCase({ props, instances }: { props: Props; instances: Record<GroupId, Instance[]> }) {
  return (
    <Card variant="raised" className="flex-row flex-wrap items-center gap-x-6 gap-y-1 px-6 py-2">
      <h2 className="text-body-compact font-medium text-muted-foreground">Per case</h2>
      <ul className="-ml-2 flex flex-wrap items-center gap-x-4 gap-y-1">
        {REPEATING.map((g) => {
          const n = instances[g.id].length;
          const floor = g.always ? 1 : 0;
          const noun = NOUN[g.id] ?? [g.label, g.label];
          const choices = Array.from({ length: Math.max(n + 3, 5) - floor + 1 }, (_, j) => floor + j);
          return (
            <li key={g.id}>
              <Select value={String(n)} onValueChange={(v) => props.onCounts({ ...props.counts, [g.id]: Number(v) })}>
                <SelectTrigger
                  aria-label={`How many ${noun[1]}`}
                  className="gap-1.5 border-transparent bg-transparent px-2 text-body-compact shadow-none hover:bg-accent dark:bg-transparent [&_svg]:opacity-60"
                >
                  <SelectValue>
                    <span className="font-semibold tabular-nums">{n}</span> {noun[n === 1 ? 0 : 1]}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent position="popper" className="min-w-24">
                  {choices.map((c) => (
                    <SelectItem key={c} value={String(c)} className="text-body-compact tabular-nums">
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </li>
          );
        })}
      </ul>
    </Card>
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
  tone = "open",
  onPick,
}: {
  id: string;
  label: string;
  value: string;
  headers: string[];
  firsts: string[];
  list?: ListName;
  /**
   * Open: a bordered field, the one question on its row. Set (a column, or one value for
   * every case): a quiet statement that shows its border on hover and focus. Later: as set,
   * with the answer muted, as no column.
   */
  tone?: "open" | "set" | "later";
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
            "w-full [&_input]:text-body-compact",
            tone !== "open" &&
              "border-transparent bg-transparent hover:border-input hover:bg-card dark:bg-transparent [&_svg]:opacity-50 hover:[&_svg]:opacity-100 focus-within:[&_svg]:opacity-100",
            tone === "later" && "[&_input]:text-muted-foreground",
            // Open, the field and its list read as one box: the field's lower corners square off.
            "has-[[data-popup-open]]:border-ring",
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
        sideOffset={4}
        className="w-90! max-w-(--available-width) overflow-x-hidden"
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
                      <span>{o.name}</span>
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
 * A field's state, carried by the picker alone: empty (still to match), a column, one
 * value for every case, or "Fill in each case later" in muted text. No marks beside it.
 */
type RowState = "todo" | "ok" | "warn" | "later";

function stateOf(slot: Slot, props: Props): { src: ColumnSource; state: RowState; fit: ColumnFit | null } {
  const src = sourceFor(slot.c, slot.i, props.map, props.headers);
  if (src === null) return { src, state: props.later.has(slot.key) ? "later" : "todo", fit: null };
  const values = typeof src === "number" ? props.rows.map((r) => r[src] ?? "") : null;
  const fit = values ? columnFit(slot.c, values) : null;
  // A list column whose words the court does not know fits: Match values takes them.
  const words =
    values && slot.c.list ? values.some((v) => v.trim() && listValue(slot.c.list!, v) === null) : false;
  return { src, state: fit && !fit.ok && !words ? "warn" : "ok", fit };
}

/**
 * Field, column, what the column holds: one grid for every panel, so the pickers stand on
 * one line down the page and the header labels sit over them.
 */
const ROW =
  "grid grid-cols-1 gap-y-2 sm:grid-cols-[minmax(0,12.5rem)_minmax(0,17.5rem)_minmax(0,1fr)] sm:items-center sm:gap-x-6";

/** One field of one instance: its name, the column it is read from, and what that column holds. */
function FieldRow({
  slot,
  props,
  samples,
  firsts,
  fresh = false,
}: {
  slot: Slot;
  props: Props;
  samples: string[][];
  firsts: string[];
  /** Just revealed: fades in rather than appearing at once. */
  fresh?: boolean;
}) {
  const { c: column, i: instance, key: selfKey, name } = slot;
  const { src, state, fit } = stateOf(slot, props);
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
  const held = typeof src === "number" ? samples[src] : [];
  return (
    <li
      data-to-match={state === "todo" || undefined}
      className={cn(ROW, "min-h-14 py-2", fresh && "animate-in duration-200 fade-in-0")}
    >
      <label htmlFor={id} className="min-w-0 text-body-compact break-words">
        {name}
      </label>
      <ColumnPicker
        id={id}
        label={`${name}, ${slot.sectionTitle}`}
        value={state === "todo" ? "" : sourceValue(src) || NONE}
        headers={props.headers}
        firsts={firsts}
        list={column.list}
        tone={state === "todo" ? "open" : state === "later" ? "later" : "set"}
        onPick={(v) => {
          // A column already matched elsewhere moves here only once the filer agrees.
          const others = /^\d+$/.test(v) ? (used[Number(v)] ?? []).filter((u) => u.key !== selfKey) : [];
          if (others.length) setPending({ value: v, others });
          else commit(v, []);
        }}
      />
      {state === "warn" && fit && !fit.ok ? (
        <p className="min-w-0 text-body-compact text-warning-ink">{fit.note}</p>
      ) : (
        <p
          title={held.join(", ")}
          className="min-w-0 truncate text-body-compact text-muted-foreground tabular-nums max-sm:empty:hidden"
        >
          {held.length ? <span className="sr-only">Holds: </span> : null}
          {held.join(", ")}
        </p>
      )}
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

/** One section of a case, in the single filing's order (§4.3's column groups): its name and fields. */
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

const sectionDomId = (id: string) => `map-section-${id.replace(/[^a-z0-9]/gi, "-")}`;

/** Take the filer to a field still to match, in `within` (a section) or on the page; its picker takes focus. */
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

/**
 * A section's panel: its name over the column labels, then its fields. A field's name drops
 * what the section's name says ("Date" under "Cheque 2").
 */
function SectionPanel({
  section,
  props,
  samples,
  firsts,
}: {
  section: Section;
  props: Props;
  samples: string[][];
  firsts: string[];
}) {
  const [open, setOpen] = React.useState(false);
  const titleId = React.useId();
  const required = section.slots.filter((x) => x.required).length;
  const optional = section.slots.length - required;
  // A section the file brought only optional fields for shows them; the rest keep them behind one button.
  const shown = required ? section.slots.filter((x) => x.required || open) : section.slots;
  const holds = shown.some((x) => {
    const src = sourceFor(x.c, x.i, props.map, props.headers);
    return typeof src === "number" && samples[src]?.length;
  });
  return (
    <section id={sectionDomId(section.id)} aria-labelledby={titleId} className="scroll-mt-(--map-top)">
      <Card variant="raised" className="gap-0 px-6 py-0">
        <div className={cn(ROW, "border-b border-hairline pt-5 pb-3 max-sm:pb-2")}>
          <h2 id={titleId} className="text-body font-semibold">
            {section.title}
          </h2>
          <span aria-hidden className="hidden pl-3 text-body-compact font-medium text-muted-foreground sm:block">
            Your column
          </span>
          {holds ? (
            <span aria-hidden className="hidden text-body-compact font-medium text-muted-foreground sm:block">
              Holds
            </span>
          ) : null}
        </div>
        <ul className="flex flex-col divide-y divide-hairline">
          {shown.map((x) => (
            <FieldRow
              key={x.key}
              slot={x}
              props={props}
              samples={samples}
              firsts={firsts}
              fresh={open && !x.required}
            />
          ))}
        </ul>
        {required && optional ? (
          <div className="border-t border-hairline py-2">
            <Button
              variant="ghost"
              className="-ml-3 h-10 px-3 text-body-compact font-normal"
              aria-expanded={open}
              onClick={() => setOpen((v) => !v)}
            >
              {open ? "Hide optional fields" : `${optional} optional ${optional === 1 ? "field" : "fields"}`}
              <ChevronDownIcon
                aria-hidden
                className={cn("text-muted-foreground transition-transform duration-200", open && "rotate-180")}
              />
            </Button>
          </div>
        ) : (
          <div className="pb-2" />
        )}
      </Card>
    </section>
  );
}

/**
 * Where the page's pinned band ends (the top bar, then the batch's steps), so the index
 * stops under it and a section scrolled to lands clear of it.
 */
function pinnedBottom(): number {
  const rem = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
  const bar = 3.5 * rem;
  const steps = document.querySelector('nav[aria-label="Batch steps"]')?.parentElement;
  if (!steps) return bar;
  return (parseFloat(getComputedStyle(steps).top) || bar) + steps.offsetHeight;
}

function usePinned() {
  const [top, setTop] = React.useState(0);
  React.useEffect(() => {
    const measure = () => setTop(Math.round(pinnedBottom()));
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
  return { "--map-top": `${top + 24}px` } as React.CSSProperties;
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
      const line = pinnedBottom() + 120;
      let at = list[0];
      els.forEach((el, k) => {
        if (el.getBoundingClientRect().top <= line) at = list[k];
      });
      setActive(at);
    };
    window.addEventListener("scroll", pick, { passive: true, capture: true });
    pick();
    return () => window.removeEventListener("scroll", pick, { capture: true });
  }, [key]);
  return active;
}

/**
 * The index beside the panels: the file being matched, then each section with what it still
 * waits on, a plain number, or a muted tick once nothing does. Clicking a section takes the
 * filer to its first open field, or to the section.
 */
function MapIndex({
  fileName,
  rows,
  columns,
  sections,
  active,
  props,
}: {
  fileName?: string;
  rows: number;
  columns: number;
  sections: Section[];
  active: string | null;
  props: Props;
}) {
  return (
    <aside aria-label="Sections" className="hidden lg:sticky lg:top-(--map-top) lg:flex lg:flex-col lg:gap-4">
      <div className="flex flex-col gap-0.5 px-3 pt-1">
        {fileName ? <p className="truncate text-body-compact font-semibold" title={fileName}>{fileName}</p> : null}
        <p className="text-body-compact text-muted-foreground tabular-nums">
          {rows} {rows === 1 ? "case" : "cases"} · {columns} columns
        </p>
      </div>
      <nav>
        <ul className="flex flex-col gap-0.5">
          {sections.map((s) => {
            const todo = s.slots.filter((x) => x.required && stateOf(x, props).state === "todo").length;
            return (
              <li key={s.id}>
                <Button
                  variant="ghost"
                  aria-current={active === s.id ? "location" : undefined}
                  onClick={() => focusNextToMatch(s.id)}
                  className="h-auto min-h-10 w-full justify-between gap-3 border border-transparent px-3 py-2 text-left text-body-compact font-normal whitespace-normal hover:bg-card/60 aria-[current=location]:border-hairline aria-[current=location]:bg-card aria-[current=location]:font-medium"
                >
                  <span className="min-w-0">{s.title}</span>
                  {todo ? (
                    <span className="shrink-0 text-muted-foreground tabular-nums">
                      {todo}
                      <span className="sr-only"> to match</span>
                    </span>
                  ) : (
                    <CheckIcon aria-label="Done" className="size-4 shrink-0 text-muted-foreground" />
                  )}
                </Button>
              </li>
            );
          })}
        </ul>
      </nav>
    </aside>
  );
}

/**
 * Match columns (BLK-38): an index of the case's sections beside one panel per section,
 * each court field with the column of the filer's file that holds it and a few of that
 * column's values. A column whose name is the field's (or a known alias) arrives chosen
 * and reads as a quiet statement; a field still open is the one bordered control on its
 * row. What is left shows in the index and the footer.
 */
export function ColumnMapping(props: Props) {
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
  // Up to three different values from each column, from the top of the file down.
  const samples = React.useMemo(
    () =>
      props.headers.map((_, k) => {
        const out: string[] = [];
        for (const r of props.rows) {
          const v = r[k]?.trim() ?? "";
          if (v && !out.includes(v)) out.push(v);
          if (out.length === 3) break;
        }
        return out;
      }),
    [props.headers, props.rows],
  );
  const firsts = React.useMemo(() => samples.map((s) => s[0] ?? ""), [samples]);
  const sections = React.useMemo(() => sectionsOf(slots), [slots]);
  const active = useActiveSection(sections.map((s) => s.id));
  const pinned = usePinned();

  return (
    <UsedContext.Provider value={used}>
      <div style={pinned} className="grid grid-cols-1 items-start gap-8 lg:grid-cols-[14rem_minmax(0,1fr)]">
        <MapIndex
          fileName={props.fileName}
          rows={props.rows.length}
          columns={props.headers.length}
          sections={sections}
          active={active}
          props={props}
        />
        <div className="flex min-w-0 flex-col gap-6">
          <PerCase props={props} instances={instances} />
          {sections.map((s) => (
            <SectionPanel key={s.id} section={s} props={props} samples={samples} firsts={firsts} />
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

/**
 * Every required field still without an answer, left to each case in one move (BLK-38a):
 * the footer's "Fill in the rest later". Each stays to change back.
 */
export function leaveRestForLater(
  headers: string[],
  map: ColumnMap,
  counts: InstanceCounts,
  later: Set<string>,
): { map: ColumnMap; later: Set<string> } {
  const open = mappingSlots(headers, counts, false).filter(
    (x) => sourceFor(x.c, x.i, map, headers) === null && !later.has(x.key),
  );
  return {
    map: { ...map, ...Object.fromEntries(open.map((x) => [x.key, null])) },
    later: new Set([...later, ...open.map((x) => x.key)]),
  };
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
