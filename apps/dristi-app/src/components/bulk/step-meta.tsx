"use client";

/**
 * The one quiet line under a step's title: where the batch's other cases are, as links to
 * those steps, and the warnings the filer skipped here, opening to their list (owner,
 * 2026-11-17: "Not shown: 71 at Fix & check; 157 at Pay", a skipped-warnings toggle and a
 * gate card with a clipboard icon each had their own shape, and the header read as loose
 * lines with no system). Documents, Sign and Fix & check all use it.
 *
 *    Not here  71 in Fix & check ›   157 at Pay ›   |   ⚠ 3 warnings skipped ⌄
 *
 * Counts in the foreground, the rest muted; each link is the step it names. The skipped list
 * opens below the line, one aligned row per warning.
 */

import * as React from "react";
import { ChevronDownIcon, ChevronRightIcon, TriangleAlertIcon } from "lucide-react";

import type { Flag } from "@/lib/bulk/scrutiny";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

import type { CaseView } from "./api";

export type ElsewhereItem = {
  count: number;
  /** After the count: "in Fix & check", "at Pay", "missing documents". */
  label: string;
  onGo: () => void;
};

/** The quiet ring every control on the line shares: keyboard focus only. */
const QUIET =
  "rounded-md outline-none transition-colors focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background";

/** A warning in a few words, for this list only; the full sentence is its title. */
const SHORT: Record<string, string> = {
  "dcm-poor": "Blurry scan",
  "pry-1-blanks": "Parts still to write",
};
const shortOf = (f: Flag) => SHORT[f.rule] ?? f.message.split(/(?<=\.)\s/)[0].replace(/\.$/, "");

export function StepMeta({
  lead,
  elsewhere = [],
  skipped,
}: {
  /** Names the links: "Not here", "Not ready yet". */
  lead?: string;
  elsewhere?: ElsewhereItem[];
  skipped?: {
    items: { c: CaseView; f: Flag }[];
    busy?: boolean;
    onUndo: (c: CaseView, f: Flag) => void;
  };
}) {
  const [open, setOpen] = React.useState(false);
  const listId = React.useId();
  const links = elsewhere.filter((x) => x.count > 0);
  const skips = skipped?.items ?? [];
  if (!links.length && !skips.length) return null;
  const n = skips.length;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-body-compact tabular-nums">
        {links.length ? (
          <nav aria-label={lead ?? "Other cases"} className="flex flex-wrap items-center gap-x-4 gap-y-2">
            {lead ? <span className="text-muted-foreground">{lead}</span> : null}
            {links.map((x) => (
              <button
                key={x.label}
                type="button"
                onClick={x.onGo}
                className={cn(QUIET, "group -mx-1 inline-flex items-center gap-1 px-1 text-muted-foreground hover:text-foreground")}
              >
                <span className="font-medium text-foreground">{x.count}</span>
                <span className="underline decoration-hairline underline-offset-4 group-hover:decoration-current">{x.label}</span>
                <ChevronRightIcon
                  aria-hidden
                  className="size-4 transition-transform duration-150 group-hover:translate-x-0.5 motion-reduce:transition-none"
                />
              </button>
            ))}
          </nav>
        ) : null}
        {links.length && n ? <span aria-hidden className="h-4 w-px bg-border" /> : null}
        {n ? (
          <button
            type="button"
            aria-expanded={open}
            aria-controls={listId}
            onClick={() => setOpen((o) => !o)}
            className={cn(QUIET, "-mx-1 inline-flex items-center gap-1.5 px-1 text-muted-foreground hover:text-foreground")}
          >
            <TriangleAlertIcon aria-hidden className="size-4 shrink-0 text-warning-ink" />
            <span>
              <span className="font-medium text-foreground">{n}</span> {n === 1 ? "warning" : "warnings"} skipped
            </span>
            <ChevronDownIcon aria-hidden className={cn("size-4 transition-transform duration-200", open && "rotate-180")} />
          </button>
        ) : null}
      </div>

      {n && open ? (
        <ul
          id={listId}
          aria-label="Warnings you chose to skip"
          className="flex animate-in flex-col divide-y divide-hairline rounded-lg border border-hairline bg-card px-4 duration-200 fade-in-0 slide-in-from-top-1 motion-reduce:animate-none"
        >
          {skips.map(({ c, f }) => (
            <li
              key={`${c.id}-${f.id}`}
              className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-0.5 py-2 text-body-compact sm:grid-cols-[minmax(0,13rem)_7rem_minmax(0,1fr)_auto] sm:py-1.5"
            >
              <span className="truncate font-medium text-foreground" title={c.title}>
                {c.accused || c.title}
              </span>
              <span className="order-3 col-span-2 font-mono text-muted-foreground sm:order-none sm:col-span-1">{c.draftNumber}</span>
              <span className="order-4 col-span-2 flex min-w-0 items-baseline gap-2 sm:order-none sm:col-span-1" title={f.message}>
                <span className="shrink-0 text-foreground">{shortOf(f)}</span>
                {f.where ? <span className="truncate text-muted-foreground">{f.where}</span> : null}
              </span>
              <Button
                variant="ghost"
                size="sm"
                className="order-2 -mr-2 justify-self-end text-muted-foreground hover:text-foreground sm:order-none"
                disabled={skipped?.busy}
                onClick={() => skipped?.onUndo(c, f)}
                aria-label={`Undo skip: ${shortOf(f)}, ${c.draftNumber}`}
              >
                Undo
              </Button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
