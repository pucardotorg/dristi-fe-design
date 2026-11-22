"use client";

import * as React from "react";
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";

import { sourceFor, type ColumnMap, type ValueMap } from "@/lib/bulk/excel";
import type { Column, Instance } from "@/lib/bulk/excel-spec";
import { readBack, type ReadBack } from "@/lib/bulk/read-back";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { SidePanel } from "@/components/ui/side-panel";

/** One field of one section, as Match columns lists it. */
export type PreviewSlot = { c: Column; i: Instance; key: string; name: string };
export type PreviewSection = { id: string; title: string; slots: PreviewSlot[] };

/**
 * Docks between the app's top bar and the filing footer, so the page's primary action and
 * what is left to match stay in view while the filer checks a case.
 */
function useDock(open: boolean) {
  React.useEffect(() => {
    if (!open) return;
    const root = document.documentElement;
    const measure = () => {
      const footer = document.querySelector("footer")?.getBoundingClientRect().height ?? 0;
      root.style.setProperty("--case-preview-bottom", `${Math.round(footer)}px`);
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [open]);
}

/**
 * One row of the filer's file read back as the case it becomes: each section in the
 * court's order, each matched field with its value as the court will file it. A value its
 * field cannot take shows in the warning colour; a field's name takes the filer to it.
 * Previous and Next step through rows, and "Next problem" to the next row with a warning.
 * It updates as columns are matched.
 */
export function CasePreview({
  open,
  onOpenChange,
  sections,
  headers,
  rows,
  map,
  rowLabel,
  onReveal,
  values,
  only,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sections: PreviewSection[];
  headers: string[];
  rows: string[][];
  map: ColumnMap;
  /** The row's number in the file ("Row 2"), as the filer sees it in Excel. */
  rowLabel: (index: number) => string;
  /** Take the filer to a field's picker on the page. */
  onReveal?: (slot: PreviewSlot) => void;
  /** The filer's own words matched to the court's options so far (Match values). */
  values?: ValueMap;
  /**
   * Only the rows holding one word of the filer's file in one field (Match values' "13
   * cases"): the pager steps through those rows, and that field is marked in each.
   */
  only?: { rows: number[]; field: string; word: string } | null;
}) {
  useDock(open);
  const [at, setAt] = React.useState(0);
  // A new word to look at starts the pager on its first row.
  const onlyKey = only ? `${only.field}|${only.word}` : "";
  const [seen, setSeen] = React.useState(onlyKey);
  if (seen !== onlyKey) {
    setSeen(onlyKey);
    if (only?.rows.length) setAt(only.rows[0]);
  }
  const slots = React.useMemo(() => sections.flatMap((s) => s.slots), [sections]);
  const readAt = React.useCallback(
    (x: PreviewSlot, index: number): ReadBack | null => {
      const src = sourceFor(x.c, x.i, map, headers);
      if (src === null) return null;
      if (typeof src === "object") return readBack(x.c, src.every, values);
      return readBack(x.c, rows[index]?.[src] ?? "", values);
    },
    [map, headers, rows, values],
  );
  // Rows with a value the court cannot take, for "Next problem".
  const troubled = React.useMemo(
    () => rows.map((_, k) => k).filter((k) => slots.some((x) => readAt(x, k)?.kind === "bad")),
    [rows, slots, readAt],
  );
  const nextProblem = troubled.find((k) => k > at) ?? troubled.find((k) => k !== at);

  const index = Math.min(at, rows.length - 1);
  // The rows the pager steps through: all of them, or only those holding the word.
  const pool = only?.rows.length ? only.rows : null;
  const pos = pool ? Math.max(0, pool.indexOf(index)) : index;
  const total = pool ? pool.length : rows.length;
  const go = (p: number) => setAt(pool ? pool[p] : p);
  const filled = sections
    .map((s) => ({ ...s, fields: s.slots.map((x) => ({ x, v: readAt(x, index) })).filter((f) => f.v !== null) }))
    // A section with nothing in this row is not in this case (BLK-28): a second cheque on
    // a one-cheque row.
    .filter((s) => s.fields.some((f) => f.v!.kind !== "empty"));
  const name = slots.find((x) => x.c.key === "accusedName");
  const nameValue = name ? readAt(name, index) : null;
  const title = nameValue && "text" in nameValue ? nameValue.text : rowLabel(index);

  return (
    <SidePanel
      open={open}
      onOpenChange={onOpenChange}
      className="sm:top-14! sm:bottom-(--case-preview-bottom)! sm:border-t sm:border-hairline sm:shadow-overlay"
      title={title}
      subtitle={
        <div className="flex items-center justify-between gap-3">
          <p className="text-body-compact text-muted-foreground">{rowLabel(index)} in your file</p>
        </div>
      }
      header={
        <div className="flex items-center gap-3 border-b border-hairline px-6 pb-3">
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="icon-sm"
              aria-label="Previous row"
              disabled={pos === 0}
              onClick={() => go(Math.max(0, pos - 1))}
            >
              <ChevronLeftIcon aria-hidden />
            </Button>
            <span className="min-w-14 text-center text-body-compact text-muted-foreground tabular-nums" aria-live="polite">
              {pos + 1} / {total}
            </span>
            <Button
              variant="outline"
              size="icon-sm"
              aria-label="Next row"
              disabled={pos >= total - 1}
              onClick={() => go(Math.min(total - 1, pos + 1))}
            >
              <ChevronRightIcon aria-hidden />
            </Button>
          </div>
          {pool ? (
            <span className="truncate text-body-compact text-muted-foreground">
              with <span className="font-medium text-foreground">{only!.word}</span>
            </span>
          ) : nextProblem !== undefined ? (
            <Button
              variant="ghost"
              className="h-9 px-3 text-body-compact font-normal text-warning-ink"
              onClick={() => setAt(nextProblem)}
            >
              Next problem
              <span className="text-muted-foreground tabular-nums">· {troubled.length}</span>
            </Button>
          ) : null}
        </div>
      }
    >
      <div className="flex flex-col gap-6 pt-5">
        {filled.map((s) => (
          <section key={s.id} aria-label={s.title} className="flex flex-col gap-1">
            <h3 className="pb-1 text-body-compact font-semibold">{s.title}</h3>
            <dl className="grid grid-cols-[11rem_minmax(0,1fr)] gap-x-4 text-body-compact">
              {s.fields.map(({ x, v }) => (
                <React.Fragment key={x.key}>
                  <dt className={cn("min-w-0", only?.field === x.c.key && "-ml-2 rounded-l-md bg-accent pl-2")}>
                    {onReveal ? (
                      // The field's name takes the filer to its picker, to change the column.
                      <button
                        type="button"
                        onClick={() => onReveal(x)}
                        className="min-h-8 w-full truncate rounded-sm py-1.5 text-left text-muted-foreground outline-none hover:text-foreground hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
                        title={`Change the column for ${x.name}`}
                      >
                        {x.name}
                      </button>
                    ) : (
                      <span className="block truncate py-1.5 text-muted-foreground">{x.name}</span>
                    )}
                  </dt>
                  <dd
                    className={cn(
                      "min-w-0 py-1.5 break-words",
                      // The field being decided on Match values, marked in this case.
                      only?.field === x.c.key && "-mr-2 rounded-r-md bg-accent pr-2 font-medium",
                    )}
                  >
                    {v!.kind === "empty" ? (
                      <span className="text-muted-foreground">Empty</span>
                    ) : v!.kind === "bad" ? (
                      <span className="text-warning-ink">
                        {v!.note}
                        <span className="text-muted-foreground"> · {v!.text}</span>
                      </span>
                    ) : v!.kind === "word" ? (
                      // Not settled yet: Match values gives it the court's option next.
                      <span className="text-muted-foreground">{v!.text}</span>
                    ) : (
                      v!.text
                    )}
                  </dd>
                </React.Fragment>
              ))}
            </dl>
          </section>
        ))}
      </div>
    </SidePanel>
  );
}
