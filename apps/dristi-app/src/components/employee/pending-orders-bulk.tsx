"use client";

import * as React from "react";
import { PlusIcon } from "lucide-react";

import { useCourtToday } from "@/components/employee/use-court-today";
import { Button } from "@/components/ui/button";
import {
  Combobox,
  ComboboxChip,
  ComboboxChips,
  ComboboxChipsInput,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxItem,
  ComboboxList,
  ComboboxValue,
  useComboboxAnchor,
} from "@/components/ui/combobox";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { hearingById } from "@/lib/employee/hearings";
import {
  addItemsToDraft,
  bulkOrderItems,
  itemAsksDetails,
} from "@/lib/employee/order-bulk-items";
import { composerContextFor } from "@/lib/employee/order-context";
import { appearancesFor } from "@/lib/employee/order-draft";
import { initialOrderDraft } from "@/lib/employee/order-demo";
import { variantInitialDraft } from "@/lib/employee/order-door";
import {
  editorDraftKey,
  readOrderDraft,
  writeOrderDraft,
} from "@/lib/employee/order-drafts";
import {
  likelyTemplatesFor,
  orderTemplate,
  type OrderTemplate,
  type OrderTemplateId,
} from "@/lib/employee/order-templates";
import type { PendingOrder } from "@/lib/employee/pending-orders";

function plural(count: number, one: string, many: string): string {
  return count === 1 ? one : many;
}

/**
 * Add the same order items to every selected order's order data (owner, 2026-10-15) —
 * a multi-select of the catalogue's items in a modal, applied to each order the way its
 * own order data panel would add them. Hearing orders only: an item is filled against the
 * hearing's case and people.
 */
export function AddOrderItemsDialog({
  open,
  orders,
  onOpenChange,
  onDone,
}: {
  open: boolean;
  orders: PendingOrder[];
  onOpenChange: (open: boolean) => void;
  onDone: (message: string) => void;
}) {
  const today = useCourtToday();
  const anchor = useComboboxAnchor();
  const [picked, setPicked] = React.useState<OrderTemplate[]>([]);
  const options = React.useMemo(() => bulkOrderItems(), []);
  const hearingOrders = orders.filter((order) => hearingById(order.key));
  const left = orders.length - hearingOrders.length;
  const needDetails = picked.filter((template) => itemAsksDetails(template.id));
  /* Likely at these hearings — the order data panel's own suggestions, by each selected
     hearing's purpose, gathered once and offered while not yet picked. */
  const likely = options.filter(
    (template) =>
      !picked.some((entry) => entry.id === template.id) &&
      hearingOrders.some((order) =>
        likelyTemplatesFor(hearingById(order.key)!.purpose).some(
          (entry) => entry.id === template.id,
        ),
      ),
  );

  function apply() {
    const types = picked.map((template) => template.id);
    let added = 0;
    const skipped: string[] = [];
    for (const order of hearingOrders) {
      const hearing = hearingById(order.key)!;
      const key = editorDraftKey(hearing.id);
      const initial = variantInitialDraft(
        "editor",
        initialOrderDraft(hearing, "completed", today),
        appearancesFor(hearing),
      );
      const result = addItemsToDraft(
        readOrderDraft(key, initial),
        types,
        composerContextFor(hearing),
      );
      if (result.added.length) writeOrderDraft(key, result.draft);
      added += result.added.length;
      for (const skip of result.skipped) {
        skipped.push(`${order.heading}: ${orderTemplate(skip.type).label} — ${skip.reason}`);
      }
    }
    onDone(
      `${added} ${plural(added, "item", "items")} added across ${hearingOrders.length} ${plural(hearingOrders.length, "order", "orders")}.` +
        (skipped.length ? ` ${skipped.length} left out: ${skipped.join("; ")}.` : ""),
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-title-s font-semibold">
            Add order items
          </DialogTitle>
          <DialogDescription className="text-body-compact">
            Added to the order data of {hearingOrders.length} selected{" "}
            {plural(hearingOrders.length, "order", "orders")}. An item an order already
            has, or cannot hold beside its other items, is left out of that order.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-2">
          <Label id="bulk-items-label">Order items</Label>
          <Combobox
            multiple
            items={options}
            value={picked}
            itemToStringLabel={(template: OrderTemplate) => template.label}
            isItemEqualToValue={(a: OrderTemplate, b: OrderTemplate) => a.id === b.id}
            onValueChange={(next: OrderTemplate[]) => setPicked(next)}
          >
            <ComboboxChips ref={anchor}>
              <ComboboxValue>
                {(chosen: OrderTemplate[]) => (
                  <>
                    {chosen.map((template) => (
                      <ComboboxChip key={template.id}>{template.label}</ComboboxChip>
                    ))}
                    <ComboboxChipsInput
                      aria-labelledby="bulk-items-label"
                      placeholder={chosen.length ? undefined : "Choose items"}
                    />
                  </>
                )}
              </ComboboxValue>
            </ComboboxChips>
            <ComboboxContent anchor={anchor} className="pointer-events-auto">
              <ComboboxEmpty>No item matches.</ComboboxEmpty>
              <ComboboxList>
                {(template: OrderTemplate) => (
                  <ComboboxItem key={template.id} value={template}>
                    {template.label}
                  </ComboboxItem>
                )}
              </ComboboxList>
            </ComboboxContent>
          </Combobox>
          {likely.length > 0 ? (
            <section
              aria-labelledby="bulk-items-likely"
              className="flex min-w-0 flex-col gap-1"
            >
              <h3
                id="bulk-items-likely"
                className="text-body-compact text-muted-foreground"
              >
                Likely at these hearings
              </h3>
              <ul className="-mx-2 flex min-w-0 flex-col">
                {likely.map((template) => (
                  <li key={template.id} className="min-w-0">
                    <button
                      type="button"
                      onClick={() => setPicked((current) => [...current, template])}
                      className="flex min-h-10 w-full min-w-0 items-center gap-2 rounded-lg px-2 text-left text-body-compact transition-colors hover:bg-accent focus-visible:bg-accent focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
                    >
                      <PlusIcon
                        aria-hidden
                        className="size-4 shrink-0 text-muted-foreground"
                      />
                      <span className="sr-only">Add </span>
                      {template.label}
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
          {needDetails.length ? (
            <p className="text-caption text-muted-foreground">
              {needDetails.map((template) => template.label).join(", ")}{" "}
              {plural(needDetails.length, "has", "have")} details of {plural(needDetails.length, "its", "their")}{" "}
              own; fill them in each order before marking its order data complete.
            </p>
          ) : null}
          {left > 0 ? (
            <p className="text-caption text-muted-foreground">
              {left} selected {plural(left, "order is", "orders are")} not from a
              hearing and {plural(left, "is", "are")} left out; open{" "}
              {plural(left, "it", "them")} to add items.
            </p>
          ) : null}
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline">
              Cancel
            </Button>
          </DialogClose>
          <Button
            type="button"
            disabled={picked.length === 0 || hearingOrders.length === 0}
            onClick={apply}
          >
            Add to {hearingOrders.length} {plural(hearingOrders.length, "order", "orders")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export type { OrderTemplateId };
