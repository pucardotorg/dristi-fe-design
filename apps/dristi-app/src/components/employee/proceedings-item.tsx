"use client";

import * as React from "react";
import { CheckIcon, ChevronDownIcon } from "lucide-react";

import { OrderItemFields } from "@/components/employee/order-item-fields";
import { BlockGlyph } from "@/components/employee/order-item-picker";
import { ItemWording } from "@/components/employee/proceedings-editable";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { ComposerContext, ItemBlock } from "@/lib/employee/order-composer";
import {
  itemDefaultParts,
  itemGapCount,
  itemParts,
  itemValuePiece,
  samePartList,
  type WordPart,
} from "@/lib/employee/order-proceedings";
import { orderTemplate } from "@/lib/employee/order-templates";
import type { ProcessRecipients } from "@/lib/employee/process-variables";
import { cn } from "@/lib/utils";

/**
 * An order item in the proceedings — a box of its own, so it reads apart from the typed
 * text (order-screen v14). The whole header row opens and closes it. Inside, the sentence
 * it adds to the order: its words can be edited in place; its values are locked pieces
 * from its fields, and pressing one opens that field. The fields open below.
 *
 * Typed during the hearing, an item drops in closed and the typing carries on below it;
 * its details can wait.
 */
export function ProceedingsItem({
  block,
  context,
  today,
  open,
  rev,
  onToggle,
  onDone,
  onRemove,
  onValue,
  onRecipients,
  onWording,
  onLostValue,
  onValueClick,
}: {
  block: ItemBlock;
  context: ComposerContext;
  today: string;
  open: boolean;
  rev: number;
  onToggle: () => void;
  onDone: () => void;
  /** Absent for a fixed item, which cannot be removed. */
  onRemove?: () => void;
  onValue: (key: string, value: string) => void;
  onRecipients: (recipients: ProcessRecipients) => void;
  onWording: (parts: WordPart[] | null) => void;
  onLostValue: () => void;
  onValueClick: (key: string) => void;
}) {
  const template = orderTemplate(block.type);
  const asks = template.fields.some((field) => !field.derived);
  const gaps = asks ? itemGapCount(block, context) : 0;
  const parts = itemParts(block, context);
  const fieldsId = `fx-${block.id}`;
  /* The field with focus, so its value in the sentence can be marked. */
  const [active, setActive] = React.useState<string | null>(null);

  const head = (
    <>
      {/* The kind, as a glyph the size of the name: it marks the item without
          pushing the name or the words below off the box's own edge. */}
      <BlockGlyph group={template.group} />
      <span className="min-w-0 truncate text-body-compact font-medium">
        {template.label}
      </span>
      {asks ? (
        gaps ? (
          <Badge variant="warning" className="shrink-0 tabular-nums">
            {gaps} to fill
          </Badge>
        ) : (
          <Badge variant="success" className="shrink-0">
            <CheckIcon data-icon="inline-start" aria-hidden />
            Ready
          </Badge>
        )
      ) : null}
    </>
  );

  return (
    <div
      className={cn(
        "@container overflow-hidden rounded-xl border bg-card transition-[border-color,box-shadow]",
        open
          ? "border-input shadow-raised"
          : "border-hairline hover:border-input",
      )}
    >
      {asks ? (
        <button
          type="button"
          data-toggle={block.id}
          aria-expanded={open}
          aria-controls={fieldsId}
          aria-label={`${template.label}, ${open ? "close" : "open"} details`}
          onClick={onToggle}
          /* The item's head is a row of its own, ruled off from its words, and opens
             the way every expanding row in the product does (the DS accordion, the
             case file's folders): the whole row takes the hover fill, and a chevron at
             its end says which way it goes (owner, 2026-10-14). */
          className="group/head flex min-h-12 w-full cursor-pointer items-center gap-2 border-b border-hairline px-4 py-2 text-left transition-colors hover:bg-accent focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none focus-visible:ring-inset"
        >
          {head}
          <ChevronDownIcon
            aria-hidden
            className={cn(
              "ml-auto size-4 shrink-0 text-muted-foreground transition-transform group-hover/head:text-foreground",
              open && "rotate-180",
            )}
          />
        </button>
      ) : (
        <div className="flex min-h-12 items-center gap-2 border-b border-hairline px-4 py-2">
          {head}
        </div>
      )}

      {/* The words keep the box's own edge: the glyph above starts there too. */}
      <div className="flex flex-col gap-1 px-4 pt-3 pb-3">
        {parts.length ? (
          <ItemWording
            id={block.id}
            rev={rev}
            parts={parts}
            piece={(key) => itemValuePiece(block, key, context)}
            name={template.label}
            active={open ? active : null}
            onWording={(next) =>
              onWording(
                samePartList(next, itemDefaultParts(block, context))
                  ? null
                  : next,
              )
            }
            onLostValue={onLostValue}
            onValue={onValueClick}
          />
        ) : (
          <p className="text-body text-muted-foreground">
            Written on the judgement screen.
          </p>
        )}
        {block.wording ? (
          <div className="flex justify-end">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-body-compact text-muted-foreground"
              onClick={() => onWording(null)}
            >
              Reset wording
            </Button>
          </div>
        ) : null}
      </div>

      {open && asks ? (
        <div
          id={fieldsId}
          className="flex flex-col gap-4 rounded-b-xl border-t border-hairline bg-surface-sunken p-4 motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-top-1"
          onFocus={(event) => {
            const key = (event.target as HTMLElement).closest<HTMLElement>(
              "[data-field]",
            )?.dataset.field;
            setActive(key ?? null);
          }}
          onBlur={(event) => {
            if (
              !event.currentTarget.contains(event.relatedTarget as Node | null)
            )
              setActive(null);
          }}
          onKeyDown={(event) => {
            const target = event.target as HTMLElement;
            if (
              event.key === "Escape" ||
              (event.key === "Enter" &&
                target.matches("input:not([type=radio]):not([type=checkbox])"))
            ) {
              event.preventDefault();
              event.stopPropagation();
              onDone();
            }
          }}
        >
          <OrderItemFields
            block={block}
            context={context}
            today={today}
            disabled={false}
            onValue={onValue}
            onRecipients={onRecipients}
          />
          <div className="flex items-center justify-between gap-3">
            {onRemove ? (
              <Button
                type="button"
                variant="destructive-ghost"
                size="sm"
                className="-ml-3 text-body-compact"
                onClick={onRemove}
              >
                Remove
              </Button>
            ) : (
              <span aria-hidden />
            )}
            <Button type="button" variant="outline" onClick={onDone}>
              Done
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
