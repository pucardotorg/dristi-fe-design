"use client";

import * as React from "react";

import type { ReturnedItem } from "@/lib/employee/scrutiny/types";
import {
  verdictOf,
  type ScrutinyController,
  type Verdict,
} from "@/lib/employee/scrutiny/use-scrutiny-state";
import { cn } from "@/lib/utils";
import { FlagComposer } from "@/components/employee/scrutiny/flag-composer";
import { ReturnedValue } from "@/components/employee/scrutiny/returned-value";
import { useScrutinyCase } from "@/components/employee/scrutiny/scrutiny-case-context";
import { SHEET } from "@/components/employee/scrutiny/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  DescriptionDetails,
  DescriptionList,
  DescriptionRow,
  DescriptionTerm,
} from "@/components/ui/description-list";

/**
 * Re-scrutiny: the items that went back, and what came back for each.
 *
 * The advocate's correction screen shows them only the flagged parts of the filing, with
 * the officer's note on each (`correction-screen.tsx`). This is the same list seen from
 * the desk that raised it. Only these items can differ from what the officer last saw —
 * every other field was locked on the advocate's side — so the list is the whole of
 * "what changed", and the full filing is one switch away for anything else.
 *
 * Each card asks the officer for one answer: Accept, or Raise again. Raising again is an
 * ordinary flag on the same row, written by the ordinary composer, so the send-back path
 * and the advocate's screen need nothing new.
 */
export function ChangesList({
  controller,
  onShowItem,
  onGoToItem,
  acceptEach = true,
}: {
  controller: ScrutinyController;
  /** Selects the item and brings its document up in the bundle. */
  onShowItem: (fieldId: string) => void;
  onGoToItem: (fieldId: string) => void;
  /**
   * Whether each item takes an explicit Accept. Without it (`?resub=inline`), an item the
   * officer leaves alone is accepted and Raise again is the only act (Anshumanth,
   * 2026-10-28: "Do we need to add an accept option at each individual level?").
   */
  acceptEach?: boolean;
}) {
  const { returned } = useScrutinyCase();
  if (!returned) return null;
  const n = returned.items.length;

  return (
    <section className="flex flex-col gap-3" aria-labelledby="changes-title">
      {/* The section label the full filing uses, so the two views read as one family. */}
      <h2
        id="changes-title"
        className="flex items-center gap-3 px-4 py-2 text-caption font-medium text-muted-foreground after:h-px after:flex-1 after:bg-hairline after:content-['']"
      >
        <span>Returned items</span>
      </h2>
      <p className="px-4 text-body-compact text-muted-foreground">
        {`${n} item${n === 1 ? "" : "s"} went back on ${returned.sentBack}. ${returned.resubmittedBy} resubmitted on ${returned.resubmitted}. Every other field is as you last saw it.`}
      </p>
      <ul className="flex flex-col gap-4">
        {returned.items.map((item) => (
          <li key={item.fieldId}>
            <ChangeCard
              item={item}
              sentBack={returned.sentBack}
              controller={controller}
              onShowItem={onShowItem}
              onGoToItem={onGoToItem}
              acceptEach={acceptEach}
            />
          </li>
        ))}
      </ul>
    </section>
  );
}

const VERDICT_BADGE: Record<
  Verdict,
  { label: string; variant: "outline" | "success" | "destructive" }
> = {
  unchecked: { label: "To check", variant: "outline" },
  accepted: { label: "Accepted", variant: "success" },
  raised: { label: "Raised again", variant: "destructive" },
};

function ChangeCard({
  item,
  sentBack,
  controller,
  onShowItem,
  onGoToItem,
  acceptEach,
}: {
  item: ReturnedItem;
  sentBack: string;
  controller: ScrutinyController;
  onShowItem: (fieldId: string) => void;
  onGoToItem: (fieldId: string) => void;
  acceptEach: boolean;
}) {
  const { fieldById } = useScrutinyCase();
  const field = fieldById[item.fieldId];
  if (!field) return null;

  const verdict = verdictOf(controller, field.id);
  const flag = controller.flags[field.id];
  const composing = controller.composeField === field.id;
  const selected = controller.selectedId === field.id;
  // An accepted item has had its answer; it folds to its header and can be undone.
  const folded = verdict === "accepted" && !composing;
  const badge = VERDICT_BADGE[verdict];
  const titleId = `chg-${field.id}`;

  return (
    <Card
      /* `row-` like the field row it stands for: only one view is mounted at a time, so a
         history item or the review dialog lands here by the same id in either. */
      id={`row-${field.id}`}
      aria-labelledby={titleId}
      className={cn(
        SHEET,
        "relative w-full scroll-mt-3",
        // The field row's selection mark — one quiet inset bar, no fill.
        selected &&
          "before:absolute before:inset-y-0 before:start-0 before:z-1 before:w-0.5 before:bg-primary before:content-['']",
      )}
      /* Picking the card is how its document comes up in the bundle — no "Show in
         bundle" / "Show in filing" buttons beside it, which read as two names for one
         job (owner, 2026-10-28). The title is the keyboard path to the same act. */
      onClick={() => onShowItem(field.id)}
    >
      <div className="flex items-center gap-3 bg-surface-sunken px-4 py-3">
        <div className="flex min-w-0 flex-1 flex-col">
          <h3 id={titleId} className="text-body-compact font-semibold">
            <button
              type="button"
              className="rounded-sm text-start focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              aria-current={selected ? "true" : undefined}
              onClick={(event) => {
                event.stopPropagation();
                onShowItem(field.id);
              }}
            >
              {field.label}
            </button>
          </h3>
          <p className="text-caption font-medium text-muted-foreground">
            {field.section} › {field.group}
          </p>
        </div>
        {/* Without a per-item Accept, "To check" would never clear, so only a re-raise
            earns a badge. */}
        {acceptEach || verdict === "raised" ? (
          <Badge variant={badge.variant}>{badge.label}</Badge>
        ) : null}
        {folded ? (
          <Button
            variant="ghost"
            onClick={(event) => {
              event.stopPropagation();
              controller.undoAccept(field.id);
            }}
            aria-label={`Undo accepting ${field.label}`}
          >
            Undo
          </Button>
        ) : null}
      </div>

      {folded ? null : (
        <div className="flex flex-col gap-3 border-t border-hairline px-4 py-3">
          {/* The change first, in the colour that means "came back" — the same value
              and chip the full filing's row carries (`ReturnedValue`). A tint with its
              solid as an edge (DS 6a), so the band holds on the white card. */}
          <div className="rounded-lg border border-info bg-info-muted px-3 py-2">
            <ReturnedValue field={field} item={item} detail />
          </div>
          <DescriptionList>
            <Row term="You asked">
              <span className="flex flex-col gap-0.5">
                <span>{item.note}</span>
                <span className="text-caption font-medium text-muted-foreground">
                  Sent back {sentBack}
                </span>
              </span>
            </Row>
            {/* A corrected value shows its before in the band; a document's before is a
                file, so it is said here. */}
            {item.answer === "replaced" ? (
              <Row term="Before">
                <span className="text-muted-foreground line-through decoration-muted-foreground">
                  {item.was}
                </span>
              </Row>
            ) : null}
            {flag && !composing ? (
              <Row term="Your note now">
                {flag.comment ?? flag.reason ?? "Raised without a note"}
              </Row>
            ) : null}
          </DescriptionList>

          {composing ? (
            <FlagComposer
              field={field}
              controller={controller}
              onGoToItem={onGoToItem}
            />
          ) : (
            <div className="flex flex-wrap items-center gap-2">
              <span className="flex-1" />
              {flag ? (
                <>
                  <Button
                    variant="ghost"
                    onClick={(event) => {
                      event.stopPropagation();
                      controller.removeFlag(field.id);
                    }}
                  >
                    Withdraw
                  </Button>
                  <Button
                    variant="outline"
                    onClick={(event) => {
                      event.stopPropagation();
                      controller.openComposer(field.id);
                    }}
                  >
                    Edit note
                  </Button>
                </>
              ) : (
                <>
                  <Button
                    variant="outline"
                    onClick={(event) => {
                      event.stopPropagation();
                      controller.raiseAgain(field.id, item.note);
                    }}
                  >
                    Raise again
                  </Button>
                  {acceptEach ? (
                    <Button
                      variant="outline"
                      onClick={(event) => {
                        event.stopPropagation();
                        controller.accept(field.id);
                      }}
                    >
                      Accept
                    </Button>
                  ) : null}
                </>
              )}
            </div>
          )}
        </div>
      )}
    </Card>
  );
}

function Row({ term, children }: { term: string; children: React.ReactNode }) {
  return (
    <DescriptionRow className="grid-cols-[minmax(5.5rem,7rem)_1fr] border-hairline">
      <DescriptionTerm>{term}</DescriptionTerm>
      <DescriptionDetails className="min-w-0 break-words">{children}</DescriptionDetails>
    </DescriptionRow>
  );
}
