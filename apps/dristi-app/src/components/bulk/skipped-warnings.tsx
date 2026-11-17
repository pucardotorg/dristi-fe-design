"use client";

/**
 * Warnings the filer chose to skip, where they can be put back (owner, 2026-11-17: "Skipped
 * checks" said nothing about what it was for). A skipped warning no longer counts against
 * its case; Undo makes it count again. Each step lists only its own: details on Case
 * details, files on Documents.
 *
 * Above the list, so it is never found only by scrolling to the end, but quiet (owner,
 * 2026-11-17: the full sentences made the page feel overwhelming): one closed line with the
 * count, opening to one line per warning, case · short reason · Undo.
 */

import * as React from "react";
import { ChevronDownIcon, TriangleAlertIcon } from "lucide-react";

import type { Flag } from "@/lib/bulk/scrutiny";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

import type { CaseView } from "./api";

/** A warning in a few words, for this list only; the full sentence is its title. */
const SHORT: Record<string, string> = {
  "dcm-poor": "Blurry scan",
  "pry-1-blanks": "Parts still to write",
};

const shortOf = (f: Flag) => SHORT[f.rule] ?? f.message.split(/(?<=\.)\s/)[0].replace(/\.$/, "");

export function SkippedWarnings({
  items,
  busy,
  onUndo,
}: {
  items: { c: CaseView; f: Flag }[];
  busy?: boolean;
  onUndo: (c: CaseView, f: Flag) => void;
}) {
  const [open, setOpen] = React.useState(false);
  const listId = React.useId();
  if (!items.length) return null;
  const n = items.length;
  return (
    <section aria-label="Warnings you chose to skip" className="flex flex-col gap-2">
          <button
            type="button"
            aria-expanded={open}
            aria-controls={listId}
            onClick={() => setOpen((o) => !o)}
            className="-mx-1 flex w-fit items-center gap-2 rounded-md px-1 py-0.5 text-body-compact text-muted-foreground outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-focus-ring"
          >
            <TriangleAlertIcon aria-hidden className="size-4 shrink-0 text-warning-ink" />
            <span className="tabular-nums">
              {n} {n === 1 ? "warning" : "warnings"} skipped
            </span>
            <ChevronDownIcon aria-hidden className={cn("size-4 transition-transform duration-200", open && "rotate-180")} />
          </button>
        {open ? (
          <ul id={listId} className="flex animate-in flex-col divide-y duration-200 fade-in-0 slide-in-from-top-1 divide-hairline rounded-lg border border-hairline bg-card px-4">
            {items.map(({ c, f }) => (
              <li key={`${c.id}-${f.id}`} className="flex min-h-12 items-center gap-3 py-1.5 text-body-compact">
                <span className="min-w-0 flex-1 truncate" title={`${c.title} · ${f.message}`}>
                  <span className="font-medium text-foreground">{c.accused || c.title}</span>
                  <span className="ml-2 font-mono text-muted-foreground">{c.draftNumber}</span>
                  <span className="text-muted-foreground">
                    {" "}
                    · {shortOf(f)}
                    {f.where ? ` · ${f.where}` : ""}
                  </span>
                </span>
                <Button variant="ghost" size="sm" disabled={busy} onClick={() => onUndo(c, f)}>
                  Undo
                </Button>
              </li>
            ))}
          </ul>
        ) : null}
    </section>
  );
}
