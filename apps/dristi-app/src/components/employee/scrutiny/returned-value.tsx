"use client";

import { TriangleAlertIcon } from "lucide-react";

import { ANSWER_LABEL } from "@/lib/employee/scrutiny/returns";
import type { FlatField, ReturnedItem } from "@/lib/employee/scrutiny/types";
import { cn } from "@/lib/utils";
import { FieldValue } from "@/components/employee/scrutiny/record-rows";
import { Badge } from "@/components/ui/badge";

/**
 * The change, where the eye already is: in the value. A correction reads old → new with
 * the old struck through, so what moved is the first thing seen, not a label about it.
 * (owner, 2026-10-28: highlight the change so it "grabs the eye immediately").
 *
 * Corrected is the assumed answer, so it carries no chip — old → new already says it, and
 * a re-uploaded document is a change the same way. Only an item resubmitted unchanged
 * gets one: a compact amber "Unchanged", inline after the value, because that is the one
 * the officer has to weigh (owner, 2026-10-28). Amber, not red: it is the advocate's
 * override awaiting a look, not a new flag. A kept value carries the advocate's reason
 * under it — the one thing that earns a second line.
 *
 * One component for the change card and the full-filing row, so the two cannot drift.
 * The row sets the reason across its full width instead (`withReason={false}` plus
 * `KeptReason`): in the value column a phone gave it about a hundred pixels.
 */
export function ReturnedValue({
  field,
  item,
  withReason = true,
}: {
  field: FlatField;
  item: ReturnedItem;
  withReason?: boolean;
}) {
  const kept = item.answer === "kept";
  return (
    <div className="flex flex-col items-start gap-1">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-body-compact">
        {item.answer === "edited" ? (
          <>
            <span className="text-muted-foreground line-through decoration-muted-foreground">
              <FieldValue field={field} value={item.was} copyable={false} />
            </span>
            <span aria-hidden="true" className="text-muted-foreground">
              →
            </span>
            <span className="sr-only">changed to</span>
          </>
        ) : null}
        <span className="font-semibold break-words">
          <FieldValue field={field} value={field.value} />
        </span>
        {kept ? (
          /* On the info tint, so it takes its own solid as an edge (DS 6a). */
          <Badge variant="warning" className="border-warning">
            Unchanged
          </Badge>
        ) : (
          /* No chip, but a screen reader still hears the answer. */
          <span className="sr-only">{ANSWER_LABEL[item.answer]}</span>
        )}
        {kept && !item.reason ? (
          /* A keep answered before the advocate's side asked why carries no reason, so
             the line says there is none rather than inventing a "contested" claim. */
          <span className="flex items-center gap-1 text-caption font-medium text-warning-muted-foreground">
            <TriangleAlertIcon className="size-3.5 shrink-0" aria-hidden="true" />
            No reason given
          </span>
        ) : null}
      </div>
      {withReason ? <KeptReason item={item} /> : null}
    </div>
  );
}

/** Why the advocate kept the filed value, as they wrote it. Nothing for any other answer. */
export function KeptReason({
  item,
  className,
}: {
  item: ReturnedItem;
  className?: string;
}) {
  if (item.answer !== "kept" || !item.reason) return null;
  /* Paper on the info tint (change band / returned row): a white well with a hairline so
     the advocate's words lift off the wash instead of sitting in it. Label above the
     quote — same vertical stack as "You asked" on the card (owner, 2026-10-28). */
  return (
    <div
      className={cn(
        "flex w-full flex-col gap-1 rounded-md border border-hairline bg-card px-2.5 py-2",
        className,
      )}
    >
      <p className="text-body-compact font-medium text-muted-foreground">
        Advocate’s reason
      </p>
      <p className="text-body-compact break-words">{item.reason}</p>
    </div>
  );
}
