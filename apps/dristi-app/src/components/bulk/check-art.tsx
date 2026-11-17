"use client";

/**
 * The batch about to be made, drawn (owner, 2026-11-17: Check read as a bare card). The
 * same language as the format chooser's sheets (`format-choice.tsx`): hairline paper on a
 * tinted panel, text as placeholder bars, nothing to read. Here they are complaints, a
 * stack fanned from the back, the front one marked with the batch's own proportions, so
 * the picture says "these many cases, mostly fine" before a word is read.
 */

import { cn } from "@/lib/utils";

/** One complaint as drawn: a title bar, the parties, then the body's lines. */
function Sheet({ className, front = false, parts }: { className?: string; front?: boolean; parts?: Parts }) {
  return (
    <span
      aria-hidden
      className={cn(
        "absolute inset-0 flex flex-col gap-2.5 rounded-lg border border-hairline bg-card p-4 shadow-raised",
        className,
      )}
    >
      <span className="h-2 w-1/2 rounded-full bg-muted-foreground/35" />
      <span className="flex items-center gap-1.5">
        <span className="h-1.5 w-1/4 rounded-full bg-track" />
        <span className="text-caption leading-none text-muted-foreground/60">vs</span>
        <span className="h-1.5 w-1/4 rounded-full bg-track" />
      </span>
      <span className="mt-1 flex flex-col gap-2">
        {["w-full", "w-11/12", "w-full", "w-3/4"].map((w, i) => (
          <span key={i} className={cn("h-1.5 rounded-full bg-track", w)} />
        ))}
      </span>
      {front && parts ? (
        <span className="mt-auto flex h-1.5 w-full gap-0.5 overflow-hidden rounded-full">
          <Segment n={parts.ready} of={parts.total} className="bg-muted-foreground/45" />
          <Segment n={parts.check} of={parts.total} className="bg-warning" />
          <Segment n={parts.fix} of={parts.total} className="bg-destructive" />
        </span>
      ) : null}
    </span>
  );
}

type Parts = { total: number; ready: number; check: number; fix: number };

function Segment({ n, of, className }: { n: number; of: number; className: string }) {
  if (!n || !of) return null;
  return <span className={cn("h-full rounded-full", className)} style={{ flexGrow: n, flexBasis: 0 }} />;
}

export function CheckArt(parts: Parts) {
  return (
    <span aria-hidden className="relative block aspect-[4/3] w-full max-w-60">
      <Sheet className="-translate-x-5 translate-y-1 -rotate-6" />
      <Sheet className="translate-x-5 -translate-y-1 rotate-6" />
      <Sheet front parts={parts} />
    </span>
  );
}

/** The batch's proportions as one bar, in the same marks as the lines that name them. */
export function ProportionBar(parts: Parts) {
  return (
    <span aria-hidden className="flex h-2 w-full gap-0.5 overflow-hidden rounded-full bg-track">
      <Segment n={parts.ready} of={parts.total} className="bg-muted-foreground/45" />
      <Segment n={parts.check} of={parts.total} className="bg-warning" />
      <Segment n={parts.fix} of={parts.total} className="bg-destructive" />
    </span>
  );
}

/*
 * The facts question's two answers, drawn in the same language (owner, 2026-11-17: the
 * choice read as a minor radio question). Where the cases' text comes from: their own rows
 * of the Excel, each with its facts in its last column; or the one batch text, a page whose
 * lines carry a variable chip and a part to write, as the editor marks them.
 */

/** Rows of the Excel, each bringing its own facts. */
export function OwnTextArt() {
  return (
    <span
      aria-hidden
      className="flex w-full max-w-56 flex-col overflow-hidden rounded-lg border border-hairline bg-card shadow-raised"
    >
      <span className="flex bg-surface-sunken text-caption font-medium text-muted-foreground">
        <span className="w-12 shrink-0 border-r border-hairline px-2 py-1">Row</span>
        <span className="min-w-0 flex-1 px-2 py-1">Facts</span>
      </span>
      {["w-full", "w-11/12", "w-full"].map((w, r) => (
        <span key={r} className="flex border-t border-hairline">
          <span className="flex w-12 shrink-0 items-center border-r border-hairline px-2">
            <span className="h-1.5 w-4 rounded-full bg-track" />
          </span>
          <span className="flex min-w-0 flex-1 flex-col gap-1.5 px-2 py-2">
            <span className={cn("h-1.5 rounded-full bg-muted-foreground/35", w)} />
            <span className="h-1.5 w-2/3 rounded-full bg-muted-foreground/35" />
          </span>
        </span>
      ))}
    </span>
  );
}

/** The one batch text: a page with a variable and a part to write in its lines. */
export function BatchTextArt() {
  return (
    <span
      aria-hidden
      className="flex w-full max-w-56 flex-col gap-2.5 rounded-lg border border-hairline bg-card p-4 shadow-raised"
    >
      <span className="h-2 w-2/5 rounded-full bg-muted-foreground/35" />
      <span className="flex items-center gap-1.5">
        <span className="h-1.5 w-1/4 rounded-full bg-track" />
        <span className="h-3 w-1/3 rounded-sm bg-brand-muted" />
        <span className="h-1.5 flex-1 rounded-full bg-track" />
      </span>
      <span className="h-1.5 w-full rounded-full bg-track" />
      <span className="flex items-center gap-1.5">
        <span className="h-3 w-1/2 rounded-sm border border-dashed border-warning-ink bg-warning-muted" />
        <span className="h-1.5 flex-1 rounded-full bg-track" />
      </span>
      <span className="h-1.5 w-3/4 rounded-full bg-track" />
    </span>
  );
}
