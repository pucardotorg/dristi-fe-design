"use client";

/**
 * **How the cases come in: our template, or the firm's own Excel.**
 *
 * Asked once, as two illustrated cards rather than a field, because it decides how much
 * work follows: the template goes straight in, while an own layout is matched column by
 * column and usually leaves gaps to fill by hand. The template is the recommended path and
 * looks it (wider, primary border, its sheet's headers in green). The own file stays an
 * honest option, with its cost said up front (owner, v6–v8 explorations).
 *
 * The sheets are drawn, not pictured: a header row and three rows of placeholder bars, so
 * the two layouts can be told apart at a glance without reading.
 */

import * as React from "react";
import { ArrowRightIcon, CheckIcon, MinusIcon, StarIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

export type UploadFormat = "template" | "own";

const TEMPLATE_HEADERS = ["Reference", "Accused", "Cheque", "Amount"];
const OWN_HEADERS = ["Loan A/c", "Cust", "Chq"];

/** A few rows of a spreadsheet: its header row named, its cells as placeholder bars. */
function SheetArt({ headers, ours }: { headers: string[]; ours: boolean }) {
  return (
    <span
      aria-hidden
      className="flex w-full flex-col overflow-hidden rounded-lg border border-hairline bg-card shadow-raised"
    >
      <span className="flex">
        {headers.map((h) => (
          <span
            key={h}
            className={cn(
              "min-w-0 flex-1 truncate border-r border-hairline px-2 py-1.5 text-caption font-medium last:border-r-0",
              ours
                ? "bg-success-muted text-success-muted-foreground"
                : "bg-surface-sunken text-muted-foreground",
            )}
          >
            {h}
          </span>
        ))}
      </span>
      {[0, 1, 2].map((r) => (
        <span key={r} className="flex">
          {headers.map((h) => (
            <span
              key={h}
              className="min-w-0 flex-1 border-t border-r border-hairline px-2 py-2 last:border-r-0"
            >
              <span className="block h-1.5 rounded-full bg-track" />
            </span>
          ))}
        </span>
      ))}
    </span>
  );
}

export function FormatChoice({
  onChoose,
  remembered,
}: {
  onChoose: (format: UploadFormat) => void;
  /** A layout matched before for this complainant, so their own file needs no matching. */
  remembered?: string | null;
}) {
  return (
    <div className="grid gap-4 md:grid-cols-[3fr_2fr]">
      <button
        type="button"
        onClick={() => onChoose("template")}
        className="group flex min-w-0 flex-col gap-6 rounded-xl border border-primary bg-card p-6 text-left shadow-raised transition-colors outline-none hover:bg-accent focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <span className="flex items-center justify-center rounded-lg bg-brand-muted p-6">
          <SheetArt headers={TEMPLATE_HEADERS} ours />
        </span>
        <Badge variant="success" className="w-fit">
          <StarIcon aria-hidden />
          Recommended
        </Badge>
        <span className="flex flex-col gap-1.5">
          <span className="text-title-s font-semibold text-foreground">Use our template</span>
          <span className="text-body-compact text-muted-foreground">
            Download it, fill one row per case, and upload it back.
          </span>
        </span>
        <span className="flex flex-col gap-2 text-body-compact text-foreground">
          {["No matching: the cases go straight in", "The fewest corrections afterwards"].map((t) => (
            <span key={t} className="flex items-center gap-2">
              <CheckIcon className="size-4 shrink-0 text-success-ink" aria-hidden />
              {t}
            </span>
          ))}
        </span>
        <span className="mt-auto inline-flex items-center gap-1 text-body-compact font-medium text-primary">
          Use the template
          <ArrowRightIcon className="size-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
        </span>
      </button>

      <button
        type="button"
        onClick={() => onChoose("own")}
        className="group flex min-w-0 flex-col gap-6 rounded-xl border border-hairline bg-card p-6 text-left transition-colors outline-none hover:bg-accent focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <span className="flex items-center justify-center rounded-lg bg-surface-sunken p-6">
          <SheetArt headers={OWN_HEADERS} ours={false} />
        </span>
        <span className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary">Takes longer</Badge>
          {remembered ? <Badge variant="info">Matched before: {remembered}</Badge> : null}
        </span>
        <span className="flex flex-col gap-1.5">
          <span className="text-title-s font-semibold text-foreground">Use your own Excel</span>
          <span className="text-body-compact text-muted-foreground">
            Upload a file from your own system as it is.
          </span>
        </span>
        <span className="flex flex-col gap-2 text-body-compact text-muted-foreground">
          {["You match its columns to the case's fields", "What it lacks is filled in by hand"].map((t) => (
            <span key={t} className="flex items-center gap-2">
              <MinusIcon className="size-4 shrink-0" aria-hidden />
              {t}
            </span>
          ))}
        </span>
        <span className="mt-auto inline-flex items-center gap-1 text-body-compact font-medium text-foreground">
          Use my own file
          <ArrowRightIcon className="size-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
        </span>
      </button>
    </div>
  );
}
