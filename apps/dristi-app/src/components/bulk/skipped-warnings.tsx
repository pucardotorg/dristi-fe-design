"use client";

/**
 * Warnings the filer chose to skip, where they can be put back (owner, 2026-11-17: "Skipped
 * checks" said nothing about what it was for). A skipped warning no longer counts against
 * its case; Undo makes it count again. Each step lists only its own: details on Case
 * details, files on Documents.
 */

import { Undo2Icon } from "lucide-react";

import type { Flag } from "@/lib/bulk/scrutiny";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

import type { CaseView } from "./api";
import { FlagLine } from "./scrutiny-tab";

export function SkippedWarnings({
  items,
  busy,
  onUndo,
}: {
  items: { c: CaseView; f: Flag }[];
  busy?: boolean;
  onUndo: (c: CaseView, f: Flag) => void;
}) {
  if (!items.length) return null;
  return (
    <section className="flex flex-col gap-2" aria-labelledby="skipped-warnings">
      <div className="flex flex-col gap-0.5">
        <h3 id="skipped-warnings" className="text-body font-semibold tabular-nums">
          Warnings you chose to skip · {items.length}
        </h3>
        <p className="text-body-compact text-muted-foreground">
          They no longer count against these cases. Undo puts a warning back.
        </p>
      </div>
      <Card variant="raised" className="gap-0 px-4 py-1">
        <ul className="flex flex-col divide-y divide-hairline">
          {items.map(({ c, f }) => (
            <li key={`${c.id}-${f.id}`} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center">
              <div className="min-w-0 flex-1">
                <span className="text-body-compact font-medium">{c.title}</span>
                <span className="ml-2 font-mono text-body-compact text-muted-foreground">{c.draftNumber}</span>
                <FlagLine flag={f} />
              </div>
              <Button variant="ghost" disabled={busy} onClick={() => onUndo(c, f)}>
                <Undo2Icon data-icon="inline-start" aria-hidden />
                Undo skip
              </Button>
            </li>
          ))}
        </ul>
      </Card>
    </section>
  );
}
