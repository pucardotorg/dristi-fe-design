"use client";

/**
 * Warnings the filer chose to skip, where they can be put back (owner, 2026-11-17: "Skipped
 * checks" said nothing about what it was for). A skipped warning no longer counts against
 * its case; Undo makes it count again. Each step lists only its own: details on Case
 * details, files on Documents.
 *
 * It sits above the list, not under it (owner, 2026-11-17: below 25 rows it was found only
 * by scrolling to the end). One line with the count, opening to the warnings themselves;
 * open from the start while there are few.
 */

import * as React from "react";
import { ChevronDownIcon, TriangleAlertIcon, Undo2Icon } from "lucide-react";

import type { Flag } from "@/lib/bulk/scrutiny";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

import type { CaseView } from "./api";
import { FlagLine } from "./scrutiny-tab";

/** Up to this many, the list starts open. */
const OPEN_UP_TO = 3;

export function SkippedWarnings({
  items,
  busy,
  onUndo,
}: {
  items: { c: CaseView; f: Flag }[];
  busy?: boolean;
  onUndo: (c: CaseView, f: Flag) => void;
}) {
  const [open, setOpen] = React.useState(items.length <= OPEN_UP_TO);
  if (!items.length) return null;
  const n = items.length;
  return (
    <Collapsible open={open} onOpenChange={setOpen} asChild>
      <section aria-label="Warnings you chose to skip" className="rounded-lg border border-hairline bg-card">
        <CollapsibleTrigger asChild>
          <button
            type="button"
            className="flex w-full items-center gap-3 rounded-lg px-4 py-3 text-left text-body-compact outline-none hover:bg-surface-sunken/60 focus-visible:ring-3 focus-visible:ring-focus-ring"
          >
            <TriangleAlertIcon aria-hidden className="size-4 shrink-0 text-warning-ink" />
            <span className="min-w-0 flex-1 tabular-nums">
              <span className="font-medium text-foreground">
                {n} {n === 1 ? "warning" : "warnings"} skipped
              </span>
            </span>
            <span className="flex shrink-0 items-center gap-1 text-muted-foreground">
              {open ? "Hide" : "Show"}
              <ChevronDownIcon aria-hidden className={cn("size-4 transition-transform duration-200", open && "rotate-180")} />
            </span>
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <ul className="mx-4 flex flex-col divide-y divide-hairline border-t border-hairline">
            {items.map(({ c, f }) => (
              <li key={`${c.id}-${f.id}`} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center">
                <div className="min-w-0 flex-1">
                  <span className="text-body-compact font-medium">{c.title}</span>
                  <span className="ml-2 font-mono text-body-compact text-muted-foreground">{c.draftNumber}</span>
                  <FlagLine flag={f} />
                </div>
                <Button variant="ghost" size="sm" disabled={busy} onClick={() => onUndo(c, f)}>
                  <Undo2Icon data-icon="inline-start" aria-hidden />
                  Undo skip
                </Button>
              </li>
            ))}
          </ul>
        </CollapsibleContent>
      </section>
    </Collapsible>
  );
}
