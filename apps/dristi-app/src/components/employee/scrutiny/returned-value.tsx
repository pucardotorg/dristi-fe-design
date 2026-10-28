"use client";

import { TriangleAlertIcon } from "lucide-react";

import { ANSWER_LABEL } from "@/lib/employee/scrutiny/returns";
import type { FlatField, ReturnedItem } from "@/lib/employee/scrutiny/types";
import { FieldValue } from "@/components/employee/scrutiny/record-rows";
import { Badge } from "@/components/ui/badge";

/**
 * The change, where the eye already is: in the value. A correction reads old → new with
 * the old struck through, so what moved is the first thing seen, not a label about it.
 * The chip names the advocate's answer in words — the tint around it never carries it
 * alone (owner, 2026-10-28: highlight the change so it "grabs the eye immediately").
 *
 * One component for the change card and the full-filing row, so the two cannot drift.
 * `detail` adds when it was answered — the card has no record box to say so — and, for
 * a value kept as filed, that no reason was given.
 */
export function ReturnedValue({
  field,
  item,
  detail = false,
}: {
  field: FlatField;
  item: ReturnedItem;
  detail?: boolean;
}) {
  return (
    <div className="flex flex-col items-start gap-1.5">
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-body-compact">
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
      </div>
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        {/* Sits on the same tint as its own fill, so it takes its solid as an edge (DS 6a)
            — without it the pill vanished and only the word was left. */}
        <Badge variant="info" className="border-info">
          {ANSWER_LABEL[item.answer]}
        </Badge>
        {detail ? (
          <span className="text-caption font-medium text-muted-foreground tabular-nums">
            {item.answered}
          </span>
        ) : null}
      </div>
      {detail && item.answer === "kept" ? (
        /* The advocate is not asked for a reason when they keep a value, so the card
           says there is none rather than inventing a "contested" claim. */
        <span className="flex items-start gap-1.5 text-caption font-medium text-warning-muted-foreground">
          <TriangleAlertIcon className="mt-px size-3.5 shrink-0" aria-hidden="true" />
          No reason given
        </span>
      ) : null}
    </div>
  );
}
