"use client";

import * as React from "react";
import { TriangleAlertIcon } from "lucide-react";

import { ANSWER_LABEL } from "@/lib/employee/scrutiny/returns";
import type { FlatField, ReturnedItem } from "@/lib/employee/scrutiny/types";
import { wordDiff, type DiffPart } from "@/lib/employee/scrutiny/word-diff";
import { cn } from "@/lib/utils";
import { useCourtText } from "@/components/court/court-provider";
import { FieldValue } from "@/components/employee/scrutiny/record-rows";
import { Badge } from "@/components/ui/badge";
import {
  SegmentedControl,
  SegmentedControlItem,
} from "@/components/ui/segmented-control";

/**
 * The change, where the eye already is: in the value. A correction shows the new value
 * once, with the words that are new in it underlined, so a paragraph reads once rather
 * than twice, old above new (Anshumanth, 2026-10-29: "what if it is a larger text
 * field?"). Now is only what is on file now — no struck-through old words in it (owner,
 * 2026-10-29: "Now should show only the current stuff not the old one"); a Now / Before
 * switch shows the value as it went back, in the same spot. The documents in the bundle
 * flip the same way (`bundle-view.tsx`), so fields and files share one pattern. There
 * are no rules by field type or length.
 *
 * Corrected is the assumed answer, so it carries no chip, and a re-uploaded document is
 * a change the same way. Only an item resubmitted unchanged gets one: a compact amber
 * "Unchanged", inline after the value, because that is the one the officer has to weigh
 * (owner, 2026-10-28). Amber, not red: it is the advocate's override awaiting a look, not
 * a new flag. A kept value carries the advocate's reason under it — the one thing that
 * earns a second line.
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
      {item.answer === "edited" ? (
        <CorrectedValue field={field} was={item.was} />
      ) : (
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-body-compact">
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
      )}
      {withReason ? <KeptReason item={item} /> : null}
    </div>
  );
}

type Version = "now" | "before";

/**
 * Now is the default and the switch never remembers Before: the officer is here to check
 * the new value, and the old one is reference. A value that was empty has nothing to flip
 * to, so it says so in words instead of offering a switch that reveals "Empty".
 */
function CorrectedValue({ field, was }: { field: FlatField; was: string }) {
  const [version, setVersion] = React.useState<Version>("now");
  const showing = was ? version : "now";

  return (
    <div className="flex w-full min-w-0 flex-col items-start gap-1.5">
      {was ? (
        /* The switch sits inside a selectable row and a clickable card: flipping it is
           its own act, and must not also select the row or turn the bundle. */
        <div onClick={(event) => event.stopPropagation()}>
          <SegmentedControl
            size="compact"
            type="single"
            value={showing}
            onValueChange={(value) => value && setVersion(value as Version)}
            aria-label={`Which version of ${field.label}`}
          >
            <SegmentedControlItem value="now">Now</SegmentedControlItem>
            <SegmentedControlItem value="before">Before</SegmentedControlItem>
          </SegmentedControl>
        </div>
      ) : (
        <span className="text-caption font-medium text-muted-foreground">
          Previously empty
        </span>
      )}
      {showing === "now" ? (
        <MarkedValue field={field} was={was} />
      ) : (
        /* No caption: the switch right above it already says Before, and the send-back
           date lives in case history, not under every item (owner, 2026-10-28 and
           2026-10-29). */
        <div
          className={cn(
            "text-body-compact break-words text-muted-foreground",
            field.long && "whitespace-pre-line",
          )}
        >
          <FieldValue field={field} value={was} copyable={false} />
        </div>
      )}
    </div>
  );
}

/**
 * The new value with its new words marked. Removed words are left out — they are what
 * Before is for — so a sentence that was only deleted marks nothing here. An identifier
 * keeps its copy pill, which a word diff would break apart, and is a single token
 * anyway, so it reads whole. An empty old value marks nothing either: the whole value is
 * new, and "Previously empty" has said so.
 */
function MarkedValue({ field, was }: { field: FlatField; was: string }) {
  const courtText = useCourtText();
  if (field.ident || !was) {
    return (
      <span className="text-body-compact font-semibold break-words">
        <FieldValue field={field} value={field.value} />
      </span>
    );
  }
  return (
    <div
      className={cn(
        "text-body-compact break-words",
        // Prose keeps the paragraph breaks it was filed with; a datum reads as one.
        field.long ? "whitespace-pre-line" : "font-medium",
      )}
    >
      {wordDiff(courtText(was), courtText(field.value)).map((part, index) =>
        part.kind === "same" ? (
          <React.Fragment key={index}>{part.text}</React.Fragment>
        ) : part.kind === "added" ? (
          <AddedMark key={index} part={part} />
        ) : null,
      )}
    </div>
  );
}

/**
 * One run of new words: weight and an info underline — form, not a fill, since an alpha
 * wash is what DS Laws rule out for status, and the value already sits on the info tint.
 * The spaces around the run stay outside the mark. Screen readers do not announce `ins`,
 * so the run names itself.
 */
function AddedMark({ part }: { part: DiffPart }) {
  const [, lead, words, trail] = /^(\s*)([\s\S]*?)(\s*)$/.exec(part.text) ?? [];
  return (
    <>
      {lead}
      <ins className="font-semibold text-foreground underline decoration-info decoration-2 underline-offset-4">
        <span className="sr-only">Added: </span>
        {words}
      </ins>
      {trail}
    </>
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
