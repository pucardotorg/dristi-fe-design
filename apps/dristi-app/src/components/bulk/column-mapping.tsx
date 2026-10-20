"use client";

import * as React from "react";
import {
  ArrowLeftIcon,
  ChevronDownIcon,
  FileSpreadsheetIcon,
  MinusIcon,
  PlusIcon,
} from "lucide-react";

import {
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
  type Column,
  type Group,
  type GroupId,
  type Instance,
} from "@/lib/bulk/excel-spec";
import { cn } from "@/lib/utils";
import { BrandGlyph } from "@/components/brand-lockup";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

type Props = {
  headers: string[];
  rows: string[][];
  map: ColumnMap;
  onChange: (next: ColumnMap) => void;
  /** How many of each repeating section the filer says there are. */
  counts: InstanceCounts;
  onCounts: (next: InstanceCounts) => void;
};

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
function foundSentence(groups: Group[], instances: Record<GroupId, Instance[]>): string[] {
  const more = groups
    .map((g) => ({ g, n: instances[g.id].length, noun: NOUN[g.id] }))
    .filter(({ g, n, noun }) => noun && (g.always ? n > 1 : n > 0))
    .map(({ n, noun }) => `${n} ${noun![n === 1 ? 0 : 1]}`);
  const join = (xs: string[]) => (xs.length < 2 ? xs.join("") : `${xs.slice(0, -1).join(", ")} and ${xs[xs.length - 1]}`);
  return [
    more.length ? `Some cases have up to ${join(more)}.` : "Each case has 1 accused, 1 cheque and 1 demand notice.",
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

const label = (g: Group, i: Instance) =>
  g.parent ? `${g.label} ${i[1]} of accused ${i[0]}` : `${g.label} ${i[0]}`;

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
  const sample =
    typeof src === "number"
      ? props.rows.find((r) => r[src]?.trim())?.[src]
      : src && typeof src === "object"
        ? src.every
        : undefined;
  const id = `map-${column.key}-${instanceKey(instance) || "0"}`;
  // Each column's first value, so the choice can be made by what the column holds.
  const firsts = React.useMemo(
    () =>
      props.headers.map(
        (_, k) => props.rows.find((r) => r[k]?.trim())?.[k]?.trim() ?? "",
      ),
    [props.headers, props.rows],
  );
  return (
    <li className={cn("grid grid-cols-1 items-start gap-1 py-2 sm:gap-3", ROW)}>
      <label htmlFor={id} className="flex min-w-0 flex-col">
        {/* No status marks: the dropdown shows what is matched, and the section badge counts it. */}
        <span className="truncate text-body-compact font-medium">{column.header}</span>
        {column.field !== "—" ? (
          <span className="text-caption text-muted-foreground tabular-nums">
            {column.field}
          </span>
        ) : null}
      </label>
      <ArrowLeftIcon
        className="hidden size-4 text-muted-foreground sm:block"
        aria-hidden
      />
      <div className="flex min-w-0 flex-col gap-1">
        <NativeSelect
          id={id}
          size="sm"
          className="w-full"
          aria-label={`Column in your sheet for ${column.header}`}
          value={sourceValue(src)}
          onChange={(e) => {
            const v = e.target.value;
            const next: ColumnSource =
              v === ""
                ? null
                : v.startsWith("every:")
                  ? { every: v.slice(6) }
                  : Number(v);
            props.onChange({
              ...props.map,
              [mapKey(column.key, instance, g)]: next,
            });
          }}
        >
          <NativeSelectOption value="">Not in my file</NativeSelectOption>
          {props.headers.map((h, k) => (
            <NativeSelectOption key={`${h}-${k}`} value={String(k)}>
              {h || `Column ${k + 1}`}
              {firsts[k]
                ? ` · e.g. ${firsts[k].length > 28 ? `${firsts[k].slice(0, 27)}…` : firsts[k]}`
                : " · empty"}
            </NativeSelectOption>
          ))}
          {column.list
            ? LISTS[column.list].map((o) => (
                <NativeSelectOption key={o.value} value={`every:${o.label}`}>
                  Every row: {o.label}
                </NativeSelectOption>
              ))
            : null}
        </NativeSelect>
        {sample ? (
          <span
            className="truncate pl-1 text-caption text-muted-foreground"
            title={sample}
          >
            e.g. <span className="text-foreground">{sample}</span>
          </span>
        ) : null}
      </div>
    </li>
  );
}

/** Field, arrow, column (its first value under it): the same grid for the header and every row. */
const ROW = "sm:grid-cols-[minmax(0,1fr)_1rem_minmax(0,1.2fr)]";

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
    <div
      className={cn(
        "hidden items-center gap-3 border-b border-hairline pb-3 sm:grid",
        ROW,
      )}
    >
      <span className="flex items-center gap-3 text-body-compact font-semibold text-foreground">
        <AppTile />
        Field in the case
      </span>
      <ArrowLeftIcon className="size-4 text-muted-foreground" aria-hidden />
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
          <FieldRow
            key={c.key}
            column={c}
            instance={instance}
            props={props}
          />
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

  const required = COLUMNS.filter((c) => MUST_MAP.includes(c.key));
  // Optional fields of the sections a case always has; the rest are mapped on their tabs.
  const optional = COLUMNS.filter(
    (c) =>
      !MUST_MAP.includes(c.key) &&
      !(
        GROUPS.find((g) => g.id === c.group)!.repeats &&
        !GROUPS.find((g) => g.id === c.group)!.always &&
        !GROUPS.find((g) => g.id === c.group)!.parent
      ),
  );
  const matched = required.filter(
    (c) =>
      sourceFor(
        c,
        firstInstance(GROUPS.find((g) => g.id === c.group)!),
        props.map,
        props.headers,
      ) !== null,
  ).length;

  // Instances beyond the first, for sections the file repeats.
  // On tabs: every instance of a section a case does not always have (witnesses, further
  // complainants, other pending cases), and the second onwards of one it does.
  const onTabs = (g: Group) => g.repeats && !g.always && !g.parent;
  const repeated = GROUPS.filter((g) => g.repeats)
    .map((g) => ({
      g,
      extra: instances[g.id].filter(
        (i) => onTabs(g) || instanceKey(i) !== instanceKey(firstInstance(g)),
      ),
    }))
    .filter((x) => x.extra.length > 0);
  const [repeatTab, setRepeatTab] = React.useState<GroupId | "">(
    repeated[0]?.g.id ?? "",
  );

  return (
    <div className="flex flex-col gap-6">
      <FoundInFile props={props} instances={instances} />

      <section className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <h3 className="text-body font-semibold">Required fields</h3>
          <Badge
            variant={matched === required.length ? "success" : "warning"}
            className="tabular-nums"
          >
            {matched} of {required.length} matched
          </Badge>
        </div>
        <div className="flex flex-col gap-4 rounded-lg border border-hairline p-4">
          <SidesHeader />
          {GROUPS.map((g) => (
            <Section
              key={g.id}
              group={g}
              columns={required.filter((c) => c.group === g.id)}
              instance={firstInstance(g)}
              props={props}
            />
          ))}
        </div>
      </section>

      {repeated.length ? (
        <section className="flex flex-col gap-3">
          <div className="flex flex-col gap-1">
            <h3 className="text-body font-semibold">Repeated sections</h3>
            <p className="text-caption text-muted-foreground">
              Each is read from the same columns with _2, _3 after the name.
              Pick another column where yours are named differently.
            </p>
          </div>
          <Tabs
            value={
              repeated.some((r) => r.g.id === repeatTab)
                ? repeatTab
                : repeated[0].g.id
            }
            onValueChange={(v) => setRepeatTab(v as GroupId)}
            className="gap-3"
          >
            <div className="overflow-x-auto">
              <TabsList className="w-max">
                {repeated.map(({ g, extra }) => (
                  <TabsTrigger key={g.id} value={g.id}>
                    {g.always ? g.label : (PLURAL[g.id] ?? g.label)}{" "}
                    <span className="tabular-nums text-muted-foreground">
                      {g.always ? `+${extra.length}` : extra.length}
                    </span>
                  </TabsTrigger>
                ))}
              </TabsList>
            </div>
            {repeated.map(({ g, extra }) => (
              <TabsContent key={g.id} value={g.id}>
                <Tabs defaultValue={instanceKey(extra[0])} className="gap-3">
                  <div className="overflow-x-auto">
                    <TabsList variant="line" className="w-max">
                      {extra.map((i) => (
                        <TabsTrigger
                          key={instanceKey(i)}
                          value={instanceKey(i)}
                        >
                          {label(g, i)}
                        </TabsTrigger>
                      ))}
                    </TabsList>
                  </div>
                  {extra.map((i) => (
                    <TabsContent
                      key={instanceKey(i)}
                      value={instanceKey(i)}
                      className="flex flex-col gap-2 rounded-lg border border-hairline p-4"
                    >
                      <SidesHeader />
                      <Section
                        group={g}
                        columns={COLUMNS.filter((c) => c.group === g.id)}
                        instance={i}
                        props={props}
                        heading={false}
                      />
                    </TabsContent>
                  ))}
                </Tabs>
              </TabsContent>
            ))}
          </Tabs>
        </section>
      ) : null}

      <section className="flex flex-col gap-3">
        <Button
          variant="ghost"
          className="self-start"
          aria-expanded={showOptional}
          onClick={() => setShowOptional((v) => !v)}
        >
          <ChevronDownIcon
            data-icon="inline-start"
            className={cn("transition-transform", showOptional && "rotate-180")}
            aria-hidden
          />
          {showOptional
            ? "Hide optional fields"
            : `Show optional fields (${optional.length})`}
        </Button>
        {showOptional ? (
          <div className="flex flex-col gap-4 rounded-lg border border-hairline p-4">
            <SidesHeader />
            {GROUPS.map((g) => (
              <Section
                key={g.id}
                group={g}
                columns={optional.filter((c) => c.group === g.id)}
                instance={firstInstance(g)}
                props={props}
              />
            ))}
          </div>
        ) : null}
      </section>
    </div>
  );
}
