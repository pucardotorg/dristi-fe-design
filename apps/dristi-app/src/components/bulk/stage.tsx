"use client";

import { CircleCheckIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import type { CaseStage } from "@/lib/bulk/types";
import { Badge } from "@/components/ui/badge";

import type { CaseView } from "./api";

/** What each stage is called, and the status pair it wears. Never colour alone: the word is always there. */
export const STAGE: Record<
  CaseStage,
  {
    label: string;
    variant: "warning" | "info" | "secondary" | "success";
    fill: string;
  }
> = {
  held: { label: "Needs fixing", variant: "warning", fill: "bg-warning" },
  ready: { label: "Ready to sign", variant: "info", fill: "bg-info" },
  signed: {
    label: "Signed, ready to pay",
    variant: "secondary",
    fill: "bg-primary",
  },
  filed: { label: "Filed", variant: "success", fill: "bg-success" },
};

export const STAGE_ORDER: CaseStage[] = ["held", "ready", "signed", "filed"];

/**
 * Where an open case stands, in numbers: how many fields are left to complete (or, when
 * only files are short, how many documents), or Complete. Signed and filed cases say so.
 */
export function CaseBadge({
  c,
  done = 0,
}: {
  c: CaseView;
  /** Fields filled on screen but not yet saved, so the count moves as they are filled. */
  done?: number;
}) {
  if (c.stage === "signed" || c.stage === "filed")
    return <StageBadge stage={c.stage} />;
  const holds = c.flags.filter((f) => f.level === "hold");
  const fields =
    holds.filter(
      (f) =>
        f.section !== "documents" &&
        f.fix?.kind !== "upload" &&
        f.fix?.kind !== "documents",
    ).length - done;
  const docs = c.docs.need - c.docs.have;
  if (fields)
    return (
      <Badge variant="warning" className="tabular-nums">
        {fields} field{fields === 1 ? "" : "s"} to complete
      </Badge>
    );
  if (docs > 0)
    return (
      <Badge variant="warning" className="tabular-nums">
        {docs} document{docs === 1 ? "" : "s"} missing
      </Badge>
    );
  return (
    <Badge variant="success">
      <CircleCheckIcon data-icon="inline-start" aria-hidden />
      Complete
    </Badge>
  );
}

export function StageBadge({ stage }: { stage: CaseStage }) {
  return (
    <Badge variant={STAGE[stage].variant}>
      {stage === "filed" ? (
        <CircleCheckIcon data-icon="inline-start" aria-hidden />
      ) : null}
      {STAGE[stage].label}
    </Badge>
  );
}

/** Where a batch's cases stand: one bar (decorative) and a legend that says it in words. */
export function StageBar({
  counts,
  className,
}: {
  counts: Record<CaseStage, number>;
  className?: string;
}) {
  const total = STAGE_ORDER.reduce((s, k) => s + counts[k], 0);
  if (total === 0) return null;
  return (
    <div className={cn("flex min-w-48 flex-col gap-2", className)}>
      <div
        aria-hidden
        className="flex h-2 overflow-hidden rounded-full bg-track"
      >
        {STAGE_ORDER.map((k) =>
          counts[k] ? (
            <span
              key={k}
              className={STAGE[k].fill}
              style={{ width: `${(counts[k] / total) * 100}%` }}
            />
          ) : null,
        )}
      </div>
      <ul className="flex flex-wrap gap-x-3 gap-y-1">
        {STAGE_ORDER.filter((k) => counts[k]).map((k) => (
          <li
            key={k}
            className="flex items-center gap-1.5 text-caption text-muted-foreground"
          >
            <span
              aria-hidden
              className={cn("size-2 shrink-0 rounded-full", STAGE[k].fill)}
            />
            {STAGE[k].label}
            <span className="font-medium tabular-nums text-foreground">
              {counts[k]}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
