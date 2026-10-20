"use client";

import * as React from "react";
import { ArrowLeftIcon, CheckIcon, ChevronDownIcon, CircleAlertIcon, FileSpreadsheetIcon } from "lucide-react";

import {
  firstInstance,
  instancesIn,
  mapKey,
  MUST_MAP,
  sourceFor,
  type ColumnMap,
  type ColumnSource,
} from "@/lib/bulk/excel";
import { COLUMNS, GROUPS, LISTS, instanceKey, type Column, type Group, type GroupId, type Instance } from "@/lib/bulk/excel-spec";
import { cn } from "@/lib/utils";
import { BrandGlyph } from "@/components/brand-lockup";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

type Props = {
  headers: string[];
  rows: string[][];
  map: ColumnMap;
  onChange: (next: ColumnMap) => void;
};

const label = (g: Group, i: Instance) => (g.parent ? `${g.label} ${i[1]} of accused ${i[0]}` : `${g.label} ${i[0]}`);

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
  missing,
}: {
  column: Column;
  instance: Instance;
  props: Props;
  missing: boolean;
}) {
  const g = GROUPS.find((x) => x.id === column.group)!;
  const src = sourceFor(column, instance, props.map, props.headers);
  const sample = typeof src === "number" ? props.rows.find((r) => r[src]?.trim())?.[src] : src && typeof src === "object" ? src.every : undefined;
  const id = `map-${column.key}-${instanceKey(instance) || "0"}`;
  return (
    <li className={cn("grid grid-cols-1 items-center gap-1 py-2 sm:gap-3", ROW)}>
      <label htmlFor={id} className="flex min-w-0 flex-col">
        <span className="flex items-center gap-1.5 text-body-compact font-medium">
          {src !== null ? (
            <CheckIcon className="size-4 shrink-0 text-success-ink" aria-label="Matched" />
          ) : missing ? (
            <CircleAlertIcon className="size-4 shrink-0 text-warning-ink" aria-label="Still to match" />
          ) : null}
          <span className="truncate">{column.header}</span>
        </span>
        {column.field !== "—" ? <span className="text-caption text-muted-foreground tabular-nums">{column.field}</span> : null}
      </label>
      <ArrowLeftIcon className="hidden size-4 text-muted-foreground sm:block" aria-hidden />
      <NativeSelect
        id={id}
        size="sm"
        aria-label={`Column in your sheet for ${column.header}`}
        value={sourceValue(src)}
        onChange={(e) => {
          const v = e.target.value;
          const next: ColumnSource = v === "" ? null : v.startsWith("every:") ? { every: v.slice(6) } : Number(v);
          props.onChange({ ...props.map, [mapKey(column.key, instance, g)]: next });
        }}
      >
        <NativeSelectOption value="">Not in my file</NativeSelectOption>
        {props.headers.map((h, k) => (
          <NativeSelectOption key={`${h}-${k}`} value={String(k)}>
            {h || `Column ${k + 1}`}
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
      <span className="truncate text-caption text-muted-foreground">{sample ? `e.g. ${sample}` : "No value yet"}</span>
    </li>
  );
}

/** Field, arrow, column, sample: the same grid for the header and every row. */
const ROW = "sm:grid-cols-[minmax(0,1fr)_1rem_minmax(0,1fr)_minmax(0,0.8fr)]";

/**
 * Which side is which, said with the two marks: the field in the case (ON Courts mark) on
 * the left takes its value from the column of your sheet (Excel mark) on the right. The
 * label avoids the product name, which the court text layer re-voices per state.
 */
function SidesHeader() {
  return (
    <div className={cn("hidden items-center gap-3 border-b border-hairline pb-2 sm:grid", ROW)}>
      <span className="flex items-center gap-2 text-caption font-semibold text-foreground">
        <BrandGlyph className="h-4 w-auto" />
        Field in the case
      </span>
      <ArrowLeftIcon className="size-4 text-muted-foreground" aria-hidden />
      <span className="flex items-center gap-2 text-caption font-semibold text-foreground">
        <FileSpreadsheetIcon className="size-4 text-success-ink" aria-hidden />
        Column in your sheet
      </span>
      <span className="text-caption font-semibold text-muted-foreground">First value in your sheet</span>
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
      {heading ? <h4 className="text-caption font-semibold text-muted-foreground uppercase">{group.label}</h4> : null}
      <ul className="flex flex-col divide-y divide-hairline">
        {columns.map((c) => (
          <FieldRow key={c.key} column={c} instance={instance} props={props} missing={MUST_MAP.includes(c.key)} />
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
  const instances = React.useMemo(() => instancesIn(props.headers), [props.headers]);

  const required = COLUMNS.filter((c) => MUST_MAP.includes(c.key));
  const optional = COLUMNS.filter((c) => !MUST_MAP.includes(c.key));
  const matched = required.filter((c) => sourceFor(c, firstInstance(GROUPS.find((g) => g.id === c.group)!), props.map, props.headers) !== null).length;

  // Instances beyond the first, for sections the file repeats.
  const repeated = GROUPS.filter((g) => g.repeats)
    .map((g) => ({ g, extra: instances[g.id].filter((i) => instanceKey(i) !== instanceKey(firstInstance(g))) }))
    .filter((x) => x.extra.length > 0);
  const [repeatTab, setRepeatTab] = React.useState<GroupId | "">(repeated[0]?.g.id ?? "");

  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <h3 className="text-body font-semibold">Required fields</h3>
          <Badge variant={matched === required.length ? "success" : "warning"} className="tabular-nums">
            {matched} of {required.length} matched
          </Badge>
        </div>
        <div className="flex flex-col gap-4 rounded-lg border border-hairline p-4">
          <SidesHeader />
          {GROUPS.map((g) => (
            <Section key={g.id} group={g} columns={required.filter((c) => c.group === g.id)} instance={firstInstance(g)} props={props} />
          ))}
        </div>
      </section>

      {repeated.length ? (
        <section className="flex flex-col gap-3">
          <div className="flex flex-col gap-1">
            <h3 className="text-body font-semibold">Repeated sections in your file</h3>
            <p className="text-caption text-muted-foreground">
              Read from the same columns with _2, _3 after the name. Change any that came from elsewhere.
            </p>
          </div>
          <Tabs value={repeatTab || repeated[0].g.id} onValueChange={(v) => setRepeatTab(v as GroupId)} className="gap-3">
            <div className="overflow-x-auto">
              <TabsList className="w-max">
                {repeated.map(({ g, extra }) => (
                  <TabsTrigger key={g.id} value={g.id}>
                    {g.label} <span className="tabular-nums text-muted-foreground">+{extra.length}</span>
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
                        <TabsTrigger key={instanceKey(i)} value={instanceKey(i)}>
                          {label(g, i)}
                        </TabsTrigger>
                      ))}
                    </TabsList>
                  </div>
                  {extra.map((i) => (
                    <TabsContent key={instanceKey(i)} value={instanceKey(i)} className="flex flex-col gap-2 rounded-lg border border-hairline p-4">
                      <SidesHeader />
                      <Section group={g} columns={COLUMNS.filter((c) => c.group === g.id)} instance={i} props={props} heading={false} />
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
          <ChevronDownIcon data-icon="inline-start" className={cn("transition-transform", showOptional && "rotate-180")} aria-hidden />
          {showOptional ? "Hide optional fields" : `Show optional fields (${optional.length})`}
        </Button>
        {showOptional ? (
          <div className="flex flex-col gap-4 rounded-lg border border-hairline p-4">
            <SidesHeader />
            {GROUPS.map((g) => (
              <Section key={g.id} group={g} columns={optional.filter((c) => c.group === g.id)} instance={firstInstance(g)} props={props} />
            ))}
          </div>
        ) : null}
      </section>
    </div>
  );
}
