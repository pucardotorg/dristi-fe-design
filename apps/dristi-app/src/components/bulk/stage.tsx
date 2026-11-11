"use client";

import * as React from "react";
import { CircleCheckIcon, CircleDashedIcon, CircleDotIcon, CircleXIcon, TriangleAlertIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

import type { CaseView } from "./api";
import { caseState, detailFlags, documentFlags, type CaseState } from "./batch-marks";

/**
 * The six words a case's status is ever said in, each with one colour (audit rule 4,
 * owner 2026-11-11). Red only for what blocks filing, amber only for what can be skipped.
 * Replaces "Not ready yet", "Details done", "Complete", "ready complaints" and the rest.
 */
export const STATE: Record<
  CaseState,
  { word: string; icon: React.ComponentType<{ className?: string; "aria-hidden"?: boolean }>; ink: string; fill: string }
> = {
  fix: { word: "To fix", icon: CircleXIcon, ink: "text-destructive-ink", fill: "bg-destructive" },
  docs: { word: "Missing documents", icon: CircleDashedIcon, ink: "text-destructive-ink", fill: "bg-destructive/60" },
  check: { word: "To check", icon: TriangleAlertIcon, ink: "text-warning-ink", fill: "bg-warning" },
  complete: { word: "Ready to sign", icon: CircleDotIcon, ink: "text-info-ink", fill: "bg-info" },
  signed: { word: "Signed", icon: CircleCheckIcon, ink: "text-foreground", fill: "bg-primary" },
  filed: { word: "Filed", icon: CircleCheckIcon, ink: "text-success-ink", fill: "bg-success" },
};

export const STATE_ORDER: CaseState[] = ["fix", "docs", "check", "complete", "signed", "filed"];

/**
 * One status, said the one way: its mark, the state's word in its colour, then a short
 * muted reason and how many more. The same on Check, Cases, Case details, Documents and
 * inside a case.
 */
export function StatusWord({
  state,
  word,
  reason,
  more = 0,
}: {
  state: CaseState;
  /** Only Check, before the cases exist, says "Details done" for a case with nothing open. */
  word?: string;
  reason?: React.ReactNode;
  more?: number;
}) {
  const s = STATE[state];
  const Icon = s.icon;
  return (
    <span className="inline-flex min-w-0 items-start gap-1.5 text-body-compact">
      <Icon aria-hidden className={cn("mt-0.5 size-4 shrink-0", s.ink)} />
      <span className="min-w-0">
        <span className={cn("font-medium", s.ink)}>{word ?? s.word}</span>
        {reason ? <span className="text-muted-foreground"> · {reason}</span> : null}
        {more > 0 ? <span className="text-muted-foreground tabular-nums"> +{more} more</span> : null}
      </span>
    </span>
  );
}

/** A flag's first sentence: the row says what, the case says the rest. */
export function shortReason(message: string): string {
  const m = /^(.+?[.?!])(\s|$)/.exec(message.trim());
  return (m ? m[1] : message).replace(/[.]$/, "");
}

/** Why a case is where it is, in a few words, and how many more reasons it has. */
export function caseReason(c: CaseView, done = 0): { reason?: string; more: number } {
  const state = caseState(c);
  if (state === "fix" || state === "check") {
    const f = detailFlags(c);
    const holds = f.filter((x) => x.level === "hold");
    const first = state === "fix" ? holds[0] : f[0];
    const left = Math.max(1, (state === "fix" ? holds.length : f.length) - done);
    return first ? { reason: shortReason(first.message), more: left - 1 } : { more: 0 };
  }
  if (state === "docs") {
    const missing = c.docs.need - c.docs.have;
    if (missing > 0) return { reason: `${missing} to add`, more: 0 };
    const scans = documentFlags(c).length;
    return { reason: `${scans} hard to read`, more: 0 };
  }
  return { more: 0 };
}

/**
 * Where a case stands, used everywhere the flow shows one case. `reason={false}` for a
 * tight spot (the open case's strip), where the word alone is said.
 */
export function CaseBadge({
  c,
  done = 0,
  reason = true,
}: {
  c: CaseView;
  /** Fields filled on screen but not yet saved, so the count moves as they are filled. */
  done?: number;
  reason?: boolean;
}) {
  const state = caseState(c);
  const r = reason ? caseReason(c, done) : { more: 0 };
  return <StatusWord state={state} reason={r.reason} more={r.more} />;
}

/** Where a batch's cases stand: one bar (decorative) and a legend that says it in words. */
/** On hover or focus, what a stage bar shows: each stage and its count, in words. */
export function StageTip({
  counts,
  children,
}: {
  counts: Record<CaseState, number>;
  children: React.ReactNode;
}) {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            tabIndex={0}
            className="rounded-full focus-visible:ring-3 focus-visible:ring-focus-ring focus-visible:outline-none"
          >
            {children}
          </span>
        </TooltipTrigger>
        <TooltipContent side="top">
          <ul className="flex flex-col gap-0.5">
            {STATE_ORDER.filter((k) => counts[k]).map((k) => (
              <li key={k} className="flex items-center gap-2 tabular-nums">
                <span
                  aria-hidden
                  className={cn("size-2 rounded-full", STATE[k].fill)}
                />
                {STATE[k].word}: {counts[k]}
              </li>
            ))}
          </ul>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export function StageBar({
  counts,
  className,
}: {
  counts: Record<CaseState, number>;
  className?: string;
}) {
  const total = STATE_ORDER.reduce((s, k) => s + counts[k], 0);
  if (total === 0) return null;
  return (
    <div className={cn("flex min-w-48 flex-col gap-2", className)}>
      <StageTip counts={counts}>
        {" "}
        <div
          aria-hidden
          className="flex h-2 divide-x-2 divide-card overflow-hidden rounded-full bg-track"
        >
          {STATE_ORDER.map((k) =>
            counts[k] ? (
              <span
                key={k}
                className={STATE[k].fill}
                style={{ width: `${(counts[k] / total) * 100}%` }}
              />
            ) : null,
          )}
        </div>{" "}
      </StageTip>
      <ul className="flex flex-wrap gap-x-3 gap-y-1">
        {STATE_ORDER.filter((k) => counts[k]).map((k) => (
          <li
            key={k}
            className="flex items-center gap-1.5 text-body-compact text-muted-foreground"
          >
            <span
              aria-hidden
              className={cn("size-2 shrink-0 rounded-full", STATE[k].fill)}
            />
            {STATE[k].word}
            <span className="font-medium tabular-nums text-foreground">
              {counts[k]}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
