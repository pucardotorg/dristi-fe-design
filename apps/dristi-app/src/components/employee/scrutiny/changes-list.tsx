"use client";

import { FlagIcon } from "lucide-react";

import type { ReturnedItem } from "@/lib/employee/scrutiny/types";
import type { ScrutinyController } from "@/lib/employee/scrutiny/use-scrutiny-state";
import { cn } from "@/lib/utils";
import { RaisedItem } from "@/components/employee/scrutiny/field-row";
import { FlagComposer } from "@/components/employee/scrutiny/flag-composer";
import {
  RecordList,
  RecordRow,
} from "@/components/employee/scrutiny/record-rows";
import { ReturnedValue } from "@/components/employee/scrutiny/returned-value";
import { useScrutinyCase } from "@/components/employee/scrutiny/scrutiny-case-context";
import { SHEET } from "@/components/employee/scrutiny/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

/**
 * Re-scrutiny: the items that went back, and what came back for each.
 *
 * The advocate's correction screen shows them only the flagged parts of the filing, with
 * the officer's note on each (`correction-screen.tsx`). This is the same list seen from
 * the desk that raised it. Only these items can differ from what the officer last saw —
 * every other field was locked on the advocate's side — so the list is the whole of
 * "what changed", and the full filing is one switch away for anything else.
 *
 * Raise again is the only act: an item the officer leaves alone is accepted (Anshumanth,
 * 2026-10-28: "Do we need to add an accept option at each individual level?"; owner,
 * same day: no Accept on the cards). Raising again is an ordinary flag on the same row,
 * written by the ordinary composer, so the send-back path and the advocate's screen need
 * nothing new.
 */
export function ChangesList({
  controller,
  onShowItem,
  onGoToItem,
}: {
  controller: ScrutinyController;
  /** Selects the item and brings its document up in the bundle. */
  onShowItem: (fieldId: string) => void;
  onGoToItem: (fieldId: string) => void;
}) {
  const { returned } = useScrutinyCase();
  if (!returned) return null;

  return (
    <section className="flex flex-col gap-3" aria-labelledby="changes-title">
      {/* The section label the full filing uses, so the two views read as one family. */}
      <h2
        id="changes-title"
        className="flex items-center gap-3 px-4 py-2 text-caption font-medium text-muted-foreground after:h-px after:flex-1 after:bg-hairline after:content-['']"
      >
        {/* Not "returned": in these cases that already means the cheque that came back
            unpaid (Anshumanth, 2026-10-29: "They are 'errors marked.'"). */}
        <span>Errors marked</span>
      </h2>
      <ul className="flex flex-col gap-4">
        {returned.items.map((item) => (
          <li key={item.fieldId}>
            <ChangeCard
              item={item}
              controller={controller}
              onShowItem={onShowItem}
              onGoToItem={onGoToItem}
            />
          </li>
        ))}
      </ul>
    </section>
  );
}

function ChangeCard({
  item,
  controller,
  onShowItem,
  onGoToItem,
}: {
  item: ReturnedItem;
  controller: ScrutinyController;
  onShowItem: (fieldId: string) => void;
  onGoToItem: (fieldId: string) => void;
}) {
  const { fieldById } = useScrutinyCase();
  const field = fieldById[item.fieldId];
  if (!field) return null;

  const flag = controller.flags[field.id];
  const composing = controller.composeField === field.id;
  const selected = controller.selectedId === field.id;
  const titleId = `chg-${field.id}`;

  return (
    <Card
      /* `row-` like the field row it stands for: only one view is mounted at a time, so a
         history item or the review dialog lands here by the same id in either. */
      id={`row-${field.id}`}
      aria-labelledby={titleId}
      className={cn(
        SHEET,
        // `group/frow`: the raised record's Edit / Remove reveal keys off its host.
        "group/frow relative w-full scroll-mt-3",
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
        {/* With no per-item Accept, only a re-raise earns a badge. */}
        {flag ? <Badge variant="destructive">Raised again</Badge> : null}
        {/* Raise again is the flag the full filing's row carries, in the header where
            the row keeps it — not a button row under the record (owner, 2026-10-28). */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="destructive-ghost"
              size="icon-sm"
              className="-my-1 shrink-0 [@media(pointer:coarse)]:size-10"
              aria-label={`${flag ? "Edit this flag" : "Raise again"}: ${field.label}`}
              onClick={(event) => {
                event.stopPropagation();
                if (flag) controller.openComposer(field.id);
                else controller.raiseAgain(field.id, item.note);
              }}
            >
              <FlagIcon />
            </Button>
          </TooltipTrigger>
          <TooltipContent>{flag ? "Edit this flag" : "Raise again"}</TooltipContent>
        </Tooltip>
      </div>

      <div className="flex flex-col gap-3 border-t border-hairline px-4 py-3">
        {/* The change first, in the colour that means "came back" — the same value
            and chip the full filing's row carries (`ReturnedValue`). A tint with its
            solid as an edge (DS 6a), so the band holds on the white card. */}
        <div className="rounded-lg border border-info bg-info-muted px-3 py-2">
          <ReturnedValue field={field} item={item} />
        </div>
        {/* Same stacked record as the full-filing returned well (`RecordList`). */}
        <RecordList>
          <RecordRow label="You asked">{item.note}</RecordRow>
          {/* A corrected value shows its before in the band; a document's before is a
              file, so it is said here. */}
          {item.answer === "replaced" ? (
            <RecordRow label="Before">
              <span className="text-muted-foreground line-through decoration-muted-foreground">
                {item.was}
              </span>
            </RecordRow>
          ) : null}
        </RecordList>

        {composing ? (
          <FlagComposer
            field={field}
            controller={controller}
            onGoToItem={onGoToItem}
          />
        ) : flag ? (
          <RaisedItem
            field={field}
            flag={flag}
            controller={controller}
            onGoToItem={onGoToItem}
          />
        ) : null}
      </div>
    </Card>
  );
}
