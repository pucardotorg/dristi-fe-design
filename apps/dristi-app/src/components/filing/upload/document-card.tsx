"use client";

/**
 * One panel of document rows — a cheque, a party, or the supporting documents.
 *
 * Two things this card owns beyond laying out rows:
 *
 * 1. **Optional documents collapse.** Only the required rows are open at rest, so a
 *    first screen is a handful of slots to fill rather than a column of empty boxes.
 *    A card whose optional slot already holds a file opens itself, so nothing is hidden.
 * 2. **The card is a drop target too.** Files dropped anywhere on it fill its empty
 *    required slots in order. A row inside it wins its own drop (the row stops the event
 *    propagating) and tells the card, so only one target is ever lit.
 */

import * as React from "react";
import { ChevronDownIcon, type LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import type { IntakeSlot } from "@/lib/filing/types";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { useInCorrection } from "@/components/filing/posture";
import { IntakeSlotRow } from "@/components/filing/upload/slot-row";
import {
  useDropTarget,
  type DroppedFiles,
} from "@/components/filing/upload/use-drop-target";

/** Slots a dropped file can still go into, required ones first. */
function openSlotKeys(slots: IntakeSlot[]): string[] {
  const free = slots.filter((s) => !s.file && !s.processing);
  const required = free.filter((s) => s.required).map((s) => s.key);
  return required.length ? required : free.map((s) => s.key);
}

export function DocumentCard({
  icon: Icon,
  title,
  slots,
  onRemove,
  removeLabel,
  onChoose,
  onPreview,
  onDelete,
  onDropFiles,
  optionalFooter,
}: {
  icon: LucideIcon;
  title: string;
  slots: IntakeSlot[];
  onRemove?: () => void;
  removeLabel?: string;
  onChoose: (key: string) => void;
  onPreview: (key: string) => void;
  onDelete: (key: string) => void;
  /** Fill `keys` in order from the dropped files. */
  onDropFiles: (keys: string[], dropped: DroppedFiles) => void;
  /** Rendered at the end of the optional group — e.g. "Add other documents". */
  optionalFooter?: React.ReactNode;
}) {
  const headingId = React.useId();

  const inCorrection = useInCorrection();
  const required = slots.filter((s) => s.required);
  const optional = slots.filter((s) => !s.required);
  /* A card with nothing but optional slots is already an optional group — hiding it
     behind a disclosure would leave a panel containing one button. In a correction round
     nothing collapses either: "Add optional documents" is intake language, the unflagged
     rows hide themselves, and a flagged optional slot must never sit behind a disclosure. */
  const collapseOptional = !inCorrection && required.length > 0 && optional.length > 0;

  /* `null` = nobody has touched the disclosure, so it follows the draft: a card that
     already holds an optional file opens itself rather than hiding it. Once the person
     has an opinion, their opinion wins. */
  const [userOpen, setUserOpen] = React.useState<boolean | null>(null);
  const optionalHasFile = optional.some((s) => s.file);
  const open = userOpen ?? optionalHasFile;

  /* Drops only ever land somewhere the person can see. */
  const openKeys = openSlotKeys(collapseOptional && !open ? required : slots);

  // Which row, if any, is currently claiming the drag — the card yields its highlight.
  const [overRow, setOverRow] = React.useState<string | null>(null);
  const claimRow = React.useCallback(
    (key: string, over: boolean) =>
      setOverRow((current) => (over ? key : current === key ? null : current)),
    []
  );

  const cardDrop = React.useCallback(
    (dropped: DroppedFiles) => onDropFiles(openKeys, dropped),
    [onDropFiles, openKeys]
  );
  const { isOver, dropProps } = useDropTarget({ onFiles: cardDrop });

  const row = (slot: IntakeSlot) => (
    <IntakeSlotRow
      key={slot.key}
      slot={slot}
      onChoose={() => onChoose(slot.key)}
      onPreview={() => onPreview(slot.key)}
      onDelete={() => onDelete(slot.key)}
      onFiles={(dropped) =>
        onDropFiles([slot.key, ...openKeys.filter((k) => k !== slot.key)], dropped)
      }
      onOverChange={(over) => claimRow(slot.key, over)}
    />
  );

  const optionalLabel = open
    ? "Hide optional documents"
    : optionalHasFile
      ? `Show optional documents (${optional.length})`
      : `Add optional documents (${optional.length})`;

  return (
    <Card
      variant="raised"
      role="group"
      aria-labelledby={headingId}
      {...dropProps}
      className={cn(
        "gap-6 transition-shadow",
        isOver && overRow === null && "ring-3 ring-focus-ring"
      )}
    >
      <CardHeader>
        <CardTitle className="text-body font-semibold">
          <h3 id={headingId} className="flex items-center gap-3">
            {/* The card's anchor: a well on the DS control metric, so it sits on the same
                rhythm as the row media below it rather than reading as a stray glyph. */}
            <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-surface-sunken text-muted-foreground">
              <Icon className="size-5" aria-hidden />
            </span>
            {title}
          </h3>
        </CardTitle>
        {onRemove ? (
          <CardAction>
            <Button
              type="button"
              variant="ghost"
              onClick={onRemove}
              aria-label={removeLabel ?? `Remove ${title}`}
              className="text-muted-foreground hover:text-destructive"
            >
              Remove
            </Button>
          </CardAction>
        ) : null}
      </CardHeader>

      <CardContent className="flex flex-col gap-4">
        {(collapseOptional ? required : slots).map(row)}
        {/* The footer is an intake affordance ("add other documents") — not part of a
            correction round's record. */}
        {collapseOptional || inCorrection ? null : optionalFooter}

        {collapseOptional ? (
          <Collapsible open={open} onOpenChange={setUserOpen} className="flex flex-col gap-4">
            <CollapsibleTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                className="group/disclosure w-fit tabular-nums text-muted-foreground hover:text-foreground"
              >
                <ChevronDownIcon
                  data-icon="inline-start"
                  aria-hidden
                  className="transition-transform group-data-[state=open]/disclosure:rotate-180"
                />
                {optionalLabel}
              </Button>
            </CollapsibleTrigger>
            {/* Radix hides the closed content with `hidden`; a display utility on the
                content itself would beat it, so the layout lives on an inner wrapper. */}
            <CollapsibleContent>
              <div className="flex flex-col gap-4">
                {optional.map(row)}
                {optionalFooter}
              </div>
            </CollapsibleContent>
          </Collapsible>
        ) : null}
      </CardContent>
    </Card>
  );
}
