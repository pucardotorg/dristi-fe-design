"use client";

import * as React from "react";
import {
  ArrowDownIcon,
  ArrowUpIcon,
  CheckIcon,
  ChevronDownIcon,
  RotateCcwIcon,
  Trash2Icon,
} from "lucide-react";

import {
  BlockIconTile,
  OrderItemPicker,
  type PickerChoice,
} from "@/components/employee/order-item-picker";
import { OrderItemFields } from "@/components/employee/order-item-fields";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  blockGaps,
  blockLabel,
  type ComposerBlock,
  type ComposerContext,
} from "@/lib/employee/order-composer";
import {
  orderTemplate,
  type OrderTemplate,
} from "@/lib/employee/order-templates";
import type { ProcessRecipients } from "@/lib/employee/process-variables";

/**
 * One block of the order — a proper block with its own frame, whether it is free text or
 * an order item (owner, 2026-10-12: "everything is a proper block with text", rather
 * than an item box sitting inside running prose).
 *
 * Head: what the block is, as a button that opens the order-item picker (Abhirami's
 * searchable list), how much is left to fill, and Move up / Move down / Remove — Varun's
 * block tools, always visible, never on hover alone. No title: the owner did not want one.
 *
 * Body, for an order item: its **fields on top, its text below** (Varun's shape). The
 * text follows the fields until it is typed into; after that it is the drafter's, and the
 * foot of the block says so and offers to write it from the fields again.
 */
export function OrderBlockCard({
  block,
  index,
  count,
  context,
  today,
  purpose,
  fixed,
  disabled,
  reasonFor,
  onChangeType,
  onMove,
  onRemove,
  onText,
  onResetText,
  onValue,
  onRecipients,
}: {
  block: ComposerBlock;
  index: number;
  count: number;
  context: ComposerContext;
  today: string;
  purpose?: string;
  /** Loaded by the act the screen was opened for, and not the drafter's to take out. */
  fixed: boolean;
  disabled: boolean;
  reasonFor: (template: OrderTemplate, blockId: string) => string | null;
  onChangeType: (choice: PickerChoice) => void;
  onMove: (by: -1 | 1) => void;
  onRemove: () => void;
  onText: (text: string) => void;
  onResetText: () => void;
  onValue: (key: string, value: string) => void;
  onRecipients: (recipients: ProcessRecipients) => void;
}) {
  const [pickerOpen, setPickerOpen] = React.useState(false);
  const label = blockLabel(block);
  const gaps = blockGaps(block, context);
  const template = block.kind === "item" ? orderTemplate(block.type) : null;
  const headingId = `${block.id}-heading`;
  const textId = `${block.id}-text`;
  const hasFields =
    template !== null && template.fields.some((field) => !field.derived);

  const typeButton = (
    <Button
      type="button"
      variant="ghost"
      disabled={disabled || fixed}
      aria-label={`${label}. Change what this block is`}
      className="h-10 min-w-0 justify-start gap-2 px-1.5 text-left disabled:opacity-100"
    >
      <BlockIconTile group={template ? template.group : "text"} />
      <span
        id={headingId}
        className="min-w-0 truncate text-body-compact font-semibold text-foreground"
      >
        {label}
      </span>
      {fixed || disabled ? null : (
        <ChevronDownIcon
          data-icon="inline-end"
          aria-hidden
          className="text-muted-foreground"
        />
      )}
    </Button>
  );

  return (
    <section
      id={`block-${block.id}`}
      aria-labelledby={headingId}
      tabIndex={-1}
      className="min-w-0 scroll-mt-40 rounded-xl border border-hairline bg-card outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
    >
      <header className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 p-2">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          {fixed || disabled ? (
            typeButton
          ) : (
            <OrderItemPicker
              open={pickerOpen}
              onOpenChange={setPickerOpen}
              purpose={purpose}
              current={block.kind === "item" ? block.type : "text"}
              reasonFor={(entry) => reasonFor(entry, block.id)}
              onChoose={onChangeType}
              trigger={typeButton}
            />
          )}
          {block.kind === "item" ? (
            gaps.length > 0 ? (
              <Badge variant="warning" className="tabular-nums">
                {gaps.length} to fill
              </Badge>
            ) : (
              <Badge variant="success">
                <CheckIcon data-icon="inline-start" aria-hidden />
                Ready
              </Badge>
            )
          ) : gaps.length > 0 ? (
            <Badge variant="warning" className="tabular-nums">
              {gaps.length} to fill
            </Badge>
          ) : null}
        </div>
        {disabled ? null : (
          <div className="flex shrink-0 items-center">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label={`Move ${label} up`}
              disabled={index === 0}
              onClick={() => onMove(-1)}
            >
              <ArrowUpIcon aria-hidden />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label={`Move ${label} down`}
              disabled={index === count - 1}
              onClick={() => onMove(1)}
            >
              <ArrowDownIcon aria-hidden />
            </Button>
            <Button
              type="button"
              variant="destructive-ghost"
              size="icon"
              aria-label={`Remove ${label}`}
              disabled={fixed}
              onClick={onRemove}
            >
              <Trash2Icon aria-hidden />
            </Button>
          </div>
        )}
      </header>

      {block.kind === "item" && hasFields ? (
        <div className="border-t border-hairline bg-surface-sunken p-4">
          <OrderItemFields
            block={block}
            context={context}
            today={today}
            disabled={disabled}
            onValue={onValue}
            onRecipients={onRecipients}
          />
        </div>
      ) : null}

      <div className="flex min-w-0 flex-col gap-2 border-t border-hairline p-4">
        <Label htmlFor={textId} className="text-body-compact">
          {block.kind === "item" ? "Text in the order" : "Text"}
        </Label>
        <Textarea
          id={textId}
          value={block.text}
          disabled={disabled}
          rows={2}
          placeholder={
            block.kind === "text"
              ? "Write what the court directs"
              : template && !template.botd
                ? "This order item has no standing words. Write them here."
                : undefined
          }
          className="text-body md:text-body"
          onChange={(event) => onText(event.target.value)}
        />
        {block.kind === "item" && template?.botd ? (
          <div className="flex min-h-10 min-w-0 flex-wrap items-center justify-between gap-x-4 gap-y-1">
            <p className="min-w-0 text-caption text-muted-foreground">
              {block.edited
                ? "Edited by hand. Field changes no longer update this text."
                : "Written from the fields above, and follows them."}
            </p>
            {block.edited && !disabled ? (
              <Button
                type="button"
                variant="ghost"
                className="-mr-2 shrink-0"
                onClick={onResetText}
              >
                <RotateCcwIcon data-icon="inline-start" aria-hidden />
                Reset wording
              </Button>
            ) : null}
          </div>
        ) : null}
      </div>
    </section>
  );
}
