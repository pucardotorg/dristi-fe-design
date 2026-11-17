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
