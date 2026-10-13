"use client";

import Link from "next/link";
import { ArrowRightIcon, DownloadIcon } from "lucide-react";

import { FILINGS_HOME } from "@/lib/filing/steps";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { PANEL_CLASS } from "@/components/filing/form-card";

/**
 * A batch pushed in from a client's litigation system, and where its cases have reached.
 *
 * There is no source for this in the app yet — see docs/design/proposals/e-filing.md,
 * "do client batches exist as a product capability?". The shape is here because the
 * wireframe specifies it and the summary is the whole point of the card; nothing
 * fabricates one, so today the card renders its empty state.
 */
export type BulkBatch = {
  id: string;
  client: string;
  /** "50 × cheque bounce (S-138, NI Act)". */
  what: string;
  receivedOn: string;
  via: string;
  counts: { registered: number; scrutiny: number; defect: number; notFiled: number };
};

const LEGEND = [
  { key: "registered", label: "Registered", fill: "bg-success" },
  { key: "scrutiny", label: "In scrutiny", fill: "bg-warning" },
  { key: "defect", label: "Defect", fill: "bg-destructive" },
  { key: "notFiled", label: "Not filed", fill: "bg-track" },
] as const;

/**
 * Where a batch's cases stand, as one bar and a legend.
 *
 * The DS `Progress` is single-valued, so a stacked bar is composed rather than
 * hand-written as a primitive (logged as a DS request). Colour never carries the
 * meaning: the legend names every segment and the bar itself is `aria-hidden`.
 */
export function BatchProgress({ counts }: { counts: BulkBatch["counts"] }) {
  const total = LEGEND.reduce((sum, seg) => sum + counts[seg.key], 0);
  if (total === 0) return null;

  return (
    <div className="flex flex-col gap-3">
      <div aria-hidden className="flex h-2 overflow-hidden rounded-full bg-track">
        {LEGEND.map((seg) =>
          counts[seg.key] > 0 ? (
            <span
              key={seg.key}
              className={seg.fill}
              style={{ width: `${(counts[seg.key] / total) * 100}%` }}
            />
          ) : null
        )}
      </div>
      <ul className="flex flex-wrap gap-x-4 gap-y-2">
        {LEGEND.map((seg) => (
          <li key={seg.key} className="flex items-center gap-1.5 text-caption text-muted-foreground">
            <span aria-hidden className={cn("size-2 shrink-0 rounded-full", seg.fill)} />
            {seg.label}{" "}
            <span className="font-medium tabular-nums text-foreground">{counts[seg.key]}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Cases a client's system pushed across for filing, as one batch. */
export function BulkImportCard({ batch }: { batch: BulkBatch | null }) {
  return (
    <Card className={cn(PANEL_CLASS, "gap-0")}>
      <CardHeader className="flex flex-row items-start gap-3">
        <span
          aria-hidden
          className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-info-muted text-info-muted-foreground"
        >
          <DownloadIcon className="size-5" />
        </span>
        <div className="flex min-w-0 flex-col gap-0.5">
          <CardTitle className="text-body font-semibold">Bulk filing</CardTitle>
          <CardDescription className="text-body-compact">
            Bring in many cases from your client&apos;s system and file them together.
          </CardDescription>
        </div>
      </CardHeader>

      <CardContent className="flex flex-col gap-4 pt-4">
        {batch === null ? (
          <Empty className="items-start gap-0 border-0 p-0 text-left text-wrap">
            <EmptyHeader className="max-w-none items-start">
              <EmptyTitle className="text-body font-semibold">No imports yet</EmptyTitle>
              <EmptyDescription className="text-body-compact text-wrap">
                When a client sends cases, they appear here with their progress.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <div className="flex flex-col gap-3 rounded-lg bg-surface-sunken p-4">
            <p className="text-caption font-semibold text-muted-foreground uppercase">
              Most recent import
            </p>
            <div>
              <p className="text-body font-semibold">{batch.client}</p>
              <p className="text-caption text-muted-foreground">
                {batch.what} · received {batch.receivedOn} · via {batch.via}
              </p>
            </div>
            <BatchProgress counts={batch.counts} />
          </div>
        )}

        {/* New import is gone until bulk filing is built (owner, 2026-10-09); About bulk
            filing stays, on its own. */}
        <Button asChild variant="outline" className="self-start">
          <Link href={`${FILINGS_HOME}/bulk`}>
            {batch ? "Review batch" : "About bulk filing"}
            <ArrowRightIcon data-icon="inline-end" aria-hidden />
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}
