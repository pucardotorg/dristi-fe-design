"use client";

import * as React from "react";
import {
  BriefcaseIcon,
  FileTextIcon,
  GavelIcon,
  InboxIcon,
  IndianRupeeIcon,
  SendIcon,
  TypeIcon,
} from "lucide-react";

import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  browsableTemplates,
  likelyTemplatesFor,
  ORDER_GROUPS,
  type OrderGroupId,
  type OrderTemplate,
  type OrderTemplateId,
} from "@/lib/employee/order-templates";

/** One icon per catalogue category, so an item reads as its kind at a glance. */
function blockIcon(group: OrderGroupId | null | "text"): React.ReactNode {
  const props = { className: "size-4" };
  switch (group) {
    case "text":
      return <TypeIcon {...props} />;
    case "filings":
      return <FileTextIcon {...props} />;
    case "disposal":
      return <GavelIcon {...props} />;
    case "case-management":
      return <BriefcaseIcon {...props} />;
    case "process":
      return <SendIcon {...props} />;
    case "misc":
      return <IndianRupeeIcon {...props} />;
    default:
      return <InboxIcon {...props} />;
  }
}

/** The icon tile a block wears on its header and in the picker. */
export function BlockIconTile({
  group,
}: {
  group: OrderGroupId | null | "text";
}) {
  return (
    <span
      aria-hidden
      className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-hairline bg-card text-muted-foreground"
    >
      {blockIcon(group)}
    </span>
  );
}

/** The category icon on its own, at the size of the text beside it — no tile. */
export function BlockGlyph({ group }: { group: OrderGroupId | null | "text" }) {
  return (
    <span aria-hidden className="flex size-4 shrink-0 text-muted-foreground">
      {blockIcon(group)}
    </span>
  );
}

export type PickerChoice = OrderTemplateId | "text";

/**
 * Choosing what a block is — Abhirami's insert menu (v14), on the DS `Command`.
 *
 * One searchable list: **Text** first, then what is **likely at this hearing** (only the
 * catalogue's hearing association, with no ranking behind it — `ITM-02`), then every
 * category in the catalogue's own order. An order item this order cannot take is listed
 * with the reason beside it rather than left out (`ITM-03`, `ITM-07`): the drafter learns
 * why, instead of wondering where it went.
 *
 * The same picker adds a block at the end of the order and changes what an existing
 * block is, so the list a drafter learns is the one list there is.
 */
export function OrderItemPicker({
  trigger,
  purpose,
  reasonFor,
  current,
  onChoose,
  open,
  onOpenChange,
  align = "start",
}: {
  trigger: React.ReactNode;
  /** What the hearing was listed for, when there is one. */
  purpose?: string;
  /** Why an order item cannot be chosen here, or `null`. */
  reasonFor: (template: OrderTemplate) => string | null;
  /** What the block already is, when the picker is changing one. */
  current?: PickerChoice;
  onChoose: (choice: PickerChoice) => void;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  align?: "start" | "end";
}) {
  const likely = purpose ? likelyTemplatesFor(purpose) : [];
  const browsable = browsableTemplates();

  function choose(choice: PickerChoice) {
    onOpenChange(false);
    onChoose(choice);
  }

  function row(template: OrderTemplate, keyPrefix: string) {
    const reason = template.id === current ? null : reasonFor(template);
    return (
      <CommandItem
        key={`${keyPrefix}-${template.id}`}
        value={`${keyPrefix} ${template.label}`}
        keywords={[template.label]}
        disabled={reason !== null}
        data-checked={template.id === current}
        onSelect={() => choose(template.id)}
        className="min-h-10 items-center gap-3 py-1"
      >
        <BlockIconTile group={template.group} />
        <span className="min-w-0 flex-1 text-body-compact font-medium text-foreground">
          {template.label}
        </span>
        {reason ? (
          <span className="shrink-0 text-right text-caption text-muted-foreground">
            {reason}
          </span>
        ) : null}
      </CommandItem>
    );
  }

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent
        align={align}
        collisionPadding={16}
        className="w-96 max-w-(--radix-popover-content-available-width) p-0"
      >
        <Command
          /* A plain match on the item's name, not cmdk's fuzzy score — "cost" should
             find Cost, not every name that happens to hold a c, an o, an s and a t. The
             group prefix on `value` only keeps an item listed under Likely and under its
             category from colliding as one value; it is not searched. */
          filter={(_, search, keywords) =>
            (keywords ?? []).some((keyword) =>
              keyword.toLowerCase().includes(search.trim().toLowerCase()),
            )
              ? 1
              : 0
          }
          className="max-h-[min(28rem,70vh)]"
        >
          <CommandInput placeholder="Search text and order items" />
          <CommandList className="max-h-none">
            <CommandEmpty>No order item matches that.</CommandEmpty>
            <CommandGroup heading="Write">
              <CommandItem
                value="write Text"
                keywords={["text", "paragraph", "free text"]}
                data-checked={current === "text"}
                onSelect={() => choose("text")}
                className="min-h-10 items-center gap-3 py-1"
              >
                <BlockIconTile group="text" />
                <span className="min-w-0 flex-1 text-body-compact font-medium text-foreground">
                  Text
                </span>
              </CommandItem>
            </CommandGroup>
            {likely.length > 0 ? (
              <CommandGroup heading="Likely at this hearing">
                {likely.map((template) => row(template, "likely"))}
              </CommandGroup>
            ) : null}
            {ORDER_GROUPS.map((group) => {
              const members = browsable.filter(
                (template) => template.group === group.id,
              );
              if (members.length === 0) return null;
              return (
                <CommandGroup key={group.id} heading={group.label}>
                  {members.map((template) => row(template, group.id))}
                </CommandGroup>
              );
            })}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
