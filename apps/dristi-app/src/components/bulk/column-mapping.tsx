"use client";

import * as React from "react";
import {
  ArrowLeftRightIcon,
  CheckIcon,
  ChevronDownIcon,
  FileSpreadsheetIcon,
  PanelLeftCloseIcon,
  PanelLeftOpenIcon,
  PlusIcon,
  TriangleAlertIcon,
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
  listValue,
  type Column,
  type GroupId,
  type Instance,
  type ListName,
} from "@/lib/bulk/excel-spec";
import { judgeColumn, type Verdict } from "@/lib/bulk/read-back";
import { cn } from "@/lib/utils";
import { SidePanelRegion } from "@/components/ui/side-panel";
import { CasePreview } from "./case-preview";
import { ConfirmDialog } from "@/components/shell/confirm-dialog";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
  /** A row's number in the file ("Row 2"), for the case preview. */
  rowLabel?: (index: number) => string;
  /** The case preview, opened from the page header. */
  previewOpen?: boolean;
  onPreviewOpen?: (open: boolean) => void;
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

/** The choice that leaves a field to each case. */
const NONE = "none";
export const SKIP = "Fill in each case later";
const SKIP_OPTION = "Not in my file — fill in each case later";

/** Which fields each sheet column already feeds, by column number. */
type Use = { label: string; key: string; section?: string };
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
  const anchor = useComboboxAnchor();
  const groups = React.useMemo<PickGroup[]>(
    () =>
      [
        { value: "later", label: "", items: [{ value: NONE, name: SKIP_OPTION, kind: "none" } as PickOption] },
        {
          value: "columns",
          label: "",
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
              "border-transparent bg-transparent hover:border-input hover:bg-card dark:bg-transparent [&_svg]:opacity-0 hover:[&_svg]:opacity-100 focus-within:[&_svg]:opacity-100",
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
        className="min-w-(--anchor-width) overflow-x-hidden"
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
                    <span className="min-w-0 truncate">{o.name}</span>
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
export const ROW =
  "grid grid-cols-1 gap-y-2 sm:grid-cols-[minmax(0,13rem)_minmax(0,15rem)_minmax(0,1fr)] sm:items-center sm:gap-x-4";

/**
 * A row's brief highlight: a soft fill that lands at once and fades over a second, only for
 * a field whose column was just taken by another field and so needs a new one. The fill
 * sits behind the row, wider than its text.
 */
export const FLASH =
  "relative isolate before:pointer-events-none before:absolute before:-inset-x-3 before:inset-y-1 before:-z-10 before:rounded-lg before:bg-brand-muted before:opacity-0 before:transition-opacity before:duration-1000 before:ease-out data-[flash]:before:opacity-100 data-[flash]:before:duration-150";

/** Flash the rows with these field ids, once the render that shows them lands. */
export function flash(ids: string[]) {
  const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  requestAnimationFrame(() =>
    requestAnimationFrame(() => {
      for (const id of ids) {
        for (const el of document.querySelectorAll<HTMLElement>(`[data-field="${CSS.escape(id)}"]`)) {
          el.setAttribute("data-flash", "");
          window.setTimeout(() => el.removeAttribute("data-flash"), still ? 1200 : 700);
        }
      }
    }),
  );
}

/**
 * What the chosen column holds, read as the court will file it: "₹1,40,500, ₹67,500".
 * A value its field cannot take shows in the warning colour with why ("Not a date").
 */
function VerdictLine({ verdict }: { verdict: Verdict }) {
  if (verdict.kind === "bad") return <Mismatch note={verdict.note} />;
  if (!verdict.examples.length) return <p className="max-sm:hidden" />;
  return (
    <p
      title={verdict.examples.join(", ")}
      // The filer's own cells, as typed, under a sheet mark that says where they come from.
      // No tick and no arrow: the choice of column is the filer's, and the screen does not
      // vouch for it; it speaks only when the values plainly do not fit (Mismatch).
      // While the case preview is open it reads them in full and this steps aside.
      className="flex min-w-0 items-center gap-1.5 text-body-compact in-data-[panel-open]:hidden"
    >
      <FileSpreadsheetIcon aria-hidden className="size-4 shrink-0 text-muted-foreground" />
      <span className="truncate">
        <span className="sr-only">In your file: </span>
        {verdict.examples.join(", ")}
      </span>
    </p>
  );
}

/** A column whose values its field cannot take: the mark and what is wrong, on one line. */
function Mismatch({ note }: { note: string }) {
  return (
    <p className="flex min-w-0 items-center gap-1.5 text-body-compact text-warning-ink">
      <TriangleAlertIcon aria-hidden className="size-4 shrink-0" />
      <span className="truncate">{note}</span>
    </p>
  );
}

/** One field of one instance: its name, the column it is read from, and what that column holds. */
function FieldRow({
  slot,
  props,
  firsts,
  fresh = false,
}: {
  slot: Slot;
  props: Props;
  firsts: string[];
  /** Just revealed: fades in rather than appearing at once. */
  fresh?: boolean;
}) {
  const { c: column, i: instance, key: selfKey, name } = slot;
  const { src, state, fit } = stateOf(slot, props);
  const id = pickerDomId(column.key, instance);
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
  const verdict = React.useMemo(
    () => (typeof src === "number" ? judgeColumn(column, props.headers[src] ?? "", props.rows.map((r) => r[src] ?? "")) : null),
    [column, src, props.headers, props.rows],
  );
  return (
    <li
      data-field={selfKey}
      data-to-match={state === "todo" || undefined}
      className={cn(ROW, FLASH, "min-h-14 py-2", fresh && "animate-in duration-200 fade-in-0")}
    >
      <label htmlFor={id} className="min-w-0 text-body-compact font-medium break-words">
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
      {verdict?.kind !== "bad" && state === "warn" && fit && !fit.ok ? (
        <Mismatch note={fit.note} />
      ) : verdict ? (
        <VerdictLine verdict={verdict} />
      ) : (
        <p className="max-sm:hidden" />
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
          if (pending) {
            commit(pending.value, pending.others);
            // Only the field the column was taken from flashes: it now needs a new column.
            flash(pending.others.map((o) => o.key));
          }
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

export const sectionDomId = (id: string) => `map-section-${id.replace(/[^a-z0-9]/gi, "-")}`;

/** A field's picker, by its column and instance. */
const pickerDomId = (key: string, i: Instance) => `map-${key}-${instanceKey(i) || "0"}`;

/** The event the case preview sends to bring a field into view. */
const REVEAL = "bulk-map-reveal";

/** Bring one field into view, unfolding its panel, and put focus on its picker. */
function revealField(key: string) {
  window.dispatchEvent(new CustomEvent(REVEAL, { detail: key }));
  requestAnimationFrame(() =>
    requestAnimationFrame(() => {
      const row = document.querySelector<HTMLElement>(`[data-field="${CSS.escape(key)}"]`);
      if (!row) return;
      const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      row.scrollIntoView({ block: "center", behavior: still ? "auto" : "smooth" });
      row.querySelector<HTMLInputElement>("input")?.focus({ preventScroll: true });
    }),
  );
}

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
 * A section's panel. At rest it lists only the fields that need the filer: not matched yet,
 * or matched to a column whose values do not fit. Fields matched by name fold into one line
 * ("5 matched") that opens them to check or change. A field answered here stays in place,
 * quiet, so rows never jump away under the filer's hand.
 */
function SectionPanel({
  section,
  props,
  firsts,
  onRemove,
}: {
  section: Section;
  props: Props;
  firsts: string[];
  /** A section the filer can take away (the last cheque, a witness): its Remove. */
  onRemove?: () => void;
}) {
  const titleId = React.useId();
  const required = section.slots.filter((x) => x.required);
  const optional = section.slots.filter((x) => !x.required);
  const stateOfKey = new Map(section.slots.map((x) => [x.key, stateOf(x, props).state]));
  const needs = required.filter((x) => {
    const st = stateOfKey.get(x.key);
    return st === "todo" || st === "warn";
  });
  const todo = required.filter((x) => stateOfKey.get(x.key) === "todo").length;
  // Rows that needed the filer at any point stay shown once answered.
  const [kept, setKept] = React.useState<Set<string>>(() => new Set(needs.map((x) => x.key)));
  const missing = needs.filter((x) => !kept.has(x.key));
  if (missing.length) setKept(new Set([...kept, ...missing.map((x) => x.key)]));
  const [showAll, setShowAll] = React.useState(false);
  // The case preview asks for a field: open the panel's folded rows so it can be reached.
  React.useEffect(() => {
    const onReveal = (e: Event) => {
      const key = (e as CustomEvent<string>).detail;
      if (section.slots.some((x) => x.key === key)) setShowAll(true);
    };
    window.addEventListener(REVEAL, onReveal);
    return () => window.removeEventListener(REVEAL, onReveal);
  }, [section.slots]);

  const onlyOptional = required.length === 0;
  const folded = required.filter((x) => !kept.has(x.key));
  const shown = onlyOptional
    ? section.slots
    : [...required.filter((x) => showAll || kept.has(x.key)), ...(showAll ? optional : [])];
  const later = folded.filter((x) => stateOfKey.get(x.key) === "later").length;
  const matched = folded.length - later;
  const foldLabel = [
    matched ? `${matched} matched` : "",
    later ? `${later} to fill per case` : "",
    optional.length ? `${optional.length} optional` : "",
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <section id={sectionDomId(section.id)} aria-labelledby={titleId} className="scroll-mt-(--map-top)">
      <Card variant="raised" className="gap-0 px-6 py-0">
        <div className={cn("flex min-h-14 items-center justify-between gap-4", shown.length && "border-b border-hairline pt-1")}>
          <h2 id={titleId} className="text-body font-semibold">
            {section.title}
          </h2>
          <div className="flex items-center gap-2">
            {todo ? (
              <span className="text-body-compact text-muted-foreground tabular-nums">{todo} to match</span>
            ) : null}
            {!shown.length && !onlyOptional ? (
              // Folded whole: the summary sits on the title's line, so the panel is one row.
              <Button
                variant="ghost"
                className="-mr-3 h-10 px-3 text-body-compact font-normal text-muted-foreground"
                aria-expanded={false}
                onClick={() => setShowAll(true)}
              >
                {foldLabel}
                <ChevronDownIcon aria-hidden />
              </Button>
            ) : null}
            {onRemove ? (
              <Button variant="ghost" className="-mr-3 h-10 px-3 text-body-compact font-normal" onClick={onRemove}>
                Remove
              </Button>
            ) : null}
          </div>
        </div>
        {shown.length ? (
          <ul className="flex flex-col divide-y divide-hairline">
            {shown.map((x) => (
              <FieldRow
                key={x.key}
                slot={x}
                props={props}
                firsts={firsts}
                fresh={showAll && !kept.has(x.key)}
              />
            ))}
          </ul>
        ) : null}
        {shown.length && !onlyOptional && (folded.length || optional.length) ? (
          <div className="flex flex-wrap items-center gap-x-2 border-t border-hairline pt-2 pb-2">
            <Button
              variant="ghost"
              className="-ml-3 h-10 px-3 text-body-compact font-normal text-muted-foreground aria-expanded:bg-transparent hover:aria-expanded:bg-accent"
              aria-expanded={showAll}
              onClick={() => setShowAll((v) => !v)}
            >
              {showAll ? "Hide" : foldLabel}
              <ChevronDownIcon aria-hidden className={cn("transition-transform duration-200", showAll && "rotate-180")} />
            </Button>
          </div>
        ) : shown.length ? (
          <div className="pb-2" />
        ) : null}
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

export function usePinned() {
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
export function useActiveSection(ids: string[]) {
  const [active, setActive] = React.useState<string | null>(ids[0] ?? null);
  const key = ids.join("|");
  React.useEffect(() => {
    const list = key.split("|").filter(Boolean);
    const els = list.map((id) => document.getElementById(sectionDomId(id))).filter((e): e is HTMLElement => !!e);
    if (!els.length) return;
    // A section chosen in the index stays current while the page scrolls to it, even when
    // the page ends before that section can reach the reading line.
    let holdUntil = 0;
    const pick = () => {
      if (Date.now() < holdUntil) return;
      const doc = document.scrollingElement ?? document.documentElement;
      const line = pinnedBottom() + (window.innerHeight - pinnedBottom()) * 0.4;
      let at = list[0];
      // At the very top the first section; at the very bottom the last, which a short last
      // panel could otherwise never reach the line to become.
      if (window.scrollY + window.innerHeight >= doc.scrollHeight - 4) at = list[list.length - 1];
      else if (window.scrollY > 4)
        els.forEach((el, k) => {
          if (el.getBoundingClientRect().top <= line) at = list[k];
        });
      setActive(at);
    };
    const onChoose = (e: Event) => {
      const id = (e as CustomEvent<string>).detail;
      if (!list.includes(id)) return;
      holdUntil = Date.now() + 900;
      setActive(id);
    };
    // The filer's own scrolling (wheel, touch, keys) ends the hold at once.
    const release = () => {
      holdUntil = 0;
    };
    window.addEventListener("scroll", pick, { passive: true, capture: true });
    window.addEventListener(CHOOSE, onChoose);
    window.addEventListener("wheel", release, { passive: true });
    window.addEventListener("touchmove", release, { passive: true });
    window.addEventListener("keydown", release);
    pick();
    return () => {
      window.removeEventListener("scroll", pick, { capture: true });
      window.removeEventListener(CHOOSE, onChoose);
      window.removeEventListener("wheel", release);
      window.removeEventListener("touchmove", release);
      window.removeEventListener("keydown", release);
    };
  }, [key]);
  return active;
}

/** The event an index sends when the filer picks a section, so it is current at once. */
const CHOOSE = "bulk-index-choose";

/**
 * A matching step's index, as one card beside the panels: the file being matched on a
 * spreadsheet tile, then (when there is more than one) the sections to move between. A
 * card, not loose text on the canvas, so it reads as part of the page and holds its edges.
 */
export function IndexCard({
  fileName,
  rows,
  onCollapse,
  children,
}: {
  fileName?: string;
  rows: number;
  /** Fold the index to a slim button, giving the panels its width. */
  onCollapse?: () => void;
  children?: React.ReactNode;
}) {
  return (
    <Card variant="raised" className="gap-0 py-0">
      <div className={cn("flex items-center gap-3 p-4", children && "border-b border-hairline")}>
        <span
          aria-hidden
          className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-surface-sunken text-muted-foreground"
        >
          <FileSpreadsheetIcon className="size-5" />
        </span>
        <div className="flex min-w-0 flex-col">
          {fileName ? (
            <p className="truncate text-body-compact font-semibold" title={fileName}>
              {fileName}
            </p>
          ) : null}
          <p className="text-body-compact text-muted-foreground tabular-nums">
            {rows} {rows === 1 ? "case" : "cases"}
          </p>
        </div>
        {onCollapse ? (
          <Button
            variant="ghost"
            size="icon-sm"
            className="-mr-1 ml-auto shrink-0 text-muted-foreground"
            aria-label="Hide sections"
            title="Hide sections"
            onClick={onCollapse}
          >
            <PanelLeftCloseIcon aria-hidden />
          </Button>
        ) : null}
      </div>
      {children}
    </Card>
  );
}

/** Whether the matching steps show their index; one choice for both steps, kept in this browser. */
const INDEX_KEY = "bulk-match-index";
const INDEX_EVENT = "bulk-match-index-change";

export function useIndexOpen(): [boolean, (open: boolean) => void] {
  // Folded unless the filer opened it: the panels get the width for their three columns.
  const [open, setOpen] = React.useState(false);
  React.useEffect(() => {
    const read = () => {
      try {
        setOpen(window.localStorage.getItem(INDEX_KEY) === "open");
      } catch {
        /* storage blocked: the index stays open */
      }
    };
    read();
    window.addEventListener(INDEX_EVENT, read);
    return () => window.removeEventListener(INDEX_EVENT, read);
  }, []);
  const set = React.useCallback((next: boolean) => {
    setOpen(next);
    try {
      window.localStorage.setItem(INDEX_KEY, next ? "open" : "closed");
      window.dispatchEvent(new Event(INDEX_EVENT));
    } catch {
      /* storage blocked: this page only */
    }
  }, []);
  return [open, set];
}

/** The folded index: one button at the panels' edge that opens it again. */
export function IndexRail({ onOpen }: { onOpen: () => void }) {
  return (
    <div className="hidden lg:sticky lg:top-(--map-top) lg:block">
      <Button variant="outline" size="icon" aria-label="Show sections" title="Show sections" onClick={onOpen}>
        <PanelLeftOpenIcon aria-hidden />
      </Button>
    </div>
  );
}

/** The index's grid column: the card's width, the rail's, or none while the case preview is open. */
export const indexGrid = (preview: boolean, open: boolean) =>
  preview ? "" : open ? "lg:grid-cols-[16rem_minmax(0,1fr)]" : "lg:grid-cols-[2.5rem_minmax(0,1fr)]";

/**
 * The index's list: each section with what it still needs as a plain number, or a muted
 * tick. The section in view is a filled row.
 */
export function IndexList({
  items,
  active,
  label,
  onPick,
}: {
  /** `warn`: a field in it is matched to a column its values do not fit. */
  items: { id: string; title: string; left: number; warn?: boolean }[];
  active: string | null;
  /** What a number counts, for assistive tech: "to match". */
  label: string;
  onPick: (id: string) => void;
}) {
  return (
    <nav aria-label="Sections" className="p-2">
      <ul className="flex flex-col gap-0.5">
        {items.map((s) => {
          const here = active === s.id;
          return (
            <li key={s.id}>
              <button
                type="button"
                aria-current={here ? "location" : undefined}
                onClick={() => {
                  window.dispatchEvent(new CustomEvent(CHOOSE, { detail: s.id }));
                  onPick(s.id);
                }}
                className={cn(
                  "flex min-h-10 w-full items-center justify-between gap-3 rounded-md px-3 py-2 text-left text-body-compact transition-colors outline-none hover:bg-accent focus-visible:ring-3 focus-visible:ring-ring/50",
                  here && "bg-accent font-medium",
                )}
              >
                <span className="min-w-0">{s.title}</span>
                {s.warn ? (
                  <span className="flex shrink-0 items-center gap-2">
                    <TriangleAlertIcon aria-label="A column to check" className="size-4 text-warning-ink" />
                    {s.left ? <span className="font-normal text-muted-foreground tabular-nums">{s.left}</span> : null}
                  </span>
                ) : s.left ? (
                  <span className="shrink-0 font-normal text-muted-foreground tabular-nums">
                    {s.left}
                    <span className="sr-only"> {label}</span>
                  </span>
                ) : (
                  <CheckIcon aria-label="Done" className="size-4 shrink-0 text-muted-foreground" />
                )}
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/** Match columns' index: the file, then each section with the fields it still needs. */
function MapIndex({
  fileName,
  rows,
  sections,
  active,
  props,
  onCollapse,
}: {
  fileName?: string;
  rows: number;
  sections: Section[];
  active: string | null;
  props: Props;
  onCollapse: () => void;
}) {
  return (
    <aside aria-label="Sections" className="hidden lg:sticky lg:top-(--map-top) lg:block">
      <IndexCard fileName={fileName} rows={rows} onCollapse={onCollapse}>
      <IndexList
        label="to match"
        active={active}
        onPick={(id) => focusNextToMatch(id)}
        items={sections.map((s) => ({
          id: s.id,
          title: s.title,
          left: s.slots.filter((x) => x.required && stateOf(x, props).state === "todo").length,
          warn: s.slots.some((x) => {
            const src = sourceFor(x.c, x.i, props.map, props.headers);
            if (typeof src !== "number") return false;
            return (
              stateOf(x, props).state === "warn" ||
              judgeColumn(x.c, props.headers[src] ?? "", props.rows.map((r) => r[src] ?? "")).kind === "bad"
            );
          }),
        }))}
      />
      </IndexCard>
    </aside>
  );
}

/** "Add a section": one more of a repeating section, for a file that holds more than its columns say (BLK-38c). */
function AddSections({ instances, props }: { instances: Record<GroupId, Instance[]>; props: Props }) {
  return (
    <div className="flex flex-wrap items-center gap-x-1 gap-y-2 px-2">
      <span className="pr-2 text-body-compact text-muted-foreground">Add</span>
      {REPEATING.map((g) => {
        const n = instances[g.id].length;
        const noun = NOUN[g.id]?.[0] ?? g.label;
        return (
          <Button
            key={g.id}
            variant="ghost"
            className="h-10 px-3 text-body-compact font-normal"
            onClick={() => props.onCounts({ ...props.counts, [g.id]: n + 1 })}
          >
            <PlusIcon aria-hidden className="text-muted-foreground" />
            {noun.charAt(0).toUpperCase() + noun.slice(1)}
          </Button>
        );
      })}
    </div>
  );
}

/**
 * Match columns (BLK-38): an index of the case's sections beside one panel per section.
 * Each panel shows only the fields that need the filer; fields matched by their column's
 * name fold into one line to check. The file's numbered columns decide how many cheques or
 * accused a case has; a section can be removed, or another added, where that is wrong.
 */
export function ColumnMapping(props: Props) {
  const instances = React.useMemo(() => instancesIn(props.headers, props.counts), [props.headers, props.counts]);
  const slots = React.useMemo(() => mappingSlots(props.headers, props.counts, true), [props.headers, props.counts]);
  // What each sheet column already feeds, so moving one can ask first.
  const used = React.useMemo(() => {
    const out: Record<number, Use[]> = {};
    for (const x of slots) {
      const src = sourceFor(x.c, x.i, props.map, props.headers);
      if (typeof src === "number") (out[src] ??= []).push({ label: x.label, key: x.key, section: x.section });
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
  const preview = props.previewOpen ?? false;
  const setPreview = (open: boolean) => props.onPreviewOpen?.(open);
  const [indexOpen, setIndexOpen] = useIndexOpen();
  // The last of each repeating section, where a case can do with one fewer.
  const removable = new Map<string, () => void>();
  for (const g of REPEATING) {
    const list = instances[g.id];
    const floor = g.always ? 1 : 0;
    if (list.length <= floor) continue;
    const id = `${g.id}:${instanceKey(list[list.length - 1]) || "0"}`;
    removable.set(id, () => props.onCounts({ ...props.counts, [g.id]: list.length - 1 }));
  }

  return (
    <UsedContext.Provider value={used}>
      <SidePanelRegion open={preview} push="content">
        <div
          style={pinned}
          className={cn(
            "grid grid-cols-1 items-start gap-8",
            // With the preview open the index steps out, so the panels keep their width.
            indexGrid(preview, indexOpen),
          )}
        >
          {preview ? null : indexOpen ? (
            <MapIndex
              fileName={props.fileName}
              rows={props.rows.length}
              sections={sections}
              active={active}
              props={props}
              onCollapse={() => setIndexOpen(false)}
            />
          ) : (
            <IndexRail onOpen={() => setIndexOpen(true)} />
          )}
          <div className="flex min-w-0 flex-col gap-4">
            {sections.map((s) => (
              <SectionPanel
                key={s.id}
                section={s}
                props={props}
                firsts={firsts}
                onRemove={removable.get(s.id)}
              />
            ))}
            <AddSections instances={instances} props={props} />
          </div>
        </div>
      </SidePanelRegion>
      <CasePreview
        open={preview}
        onOpenChange={setPreview}
        sections={sections}
        headers={props.headers}
        rows={props.rows}
        map={props.map}
        rowLabel={props.rowLabel ?? ((i) => `Row ${i + 2}`)}
        onReveal={(x) => revealField(x.key)}
      />
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

/** The case's sections and fields as the case preview reads them (optional fields included). */
export function previewSections(headers: string[], counts: InstanceCounts) {
  return sectionsOf(mappingSlots(headers, counts, true));
}

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
