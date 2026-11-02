"use client";

import * as React from "react";
import {
  PencilIcon,
  PlusIcon,
  Trash2Icon,
} from "lucide-react";

import { FRAMED_BODY, FRAMED_HEAD } from "@/components/employee/order-sections";
import { OrderItemFields } from "@/components/employee/order-item-fields";
import { QueueSearchField } from "@/components/employee/queue-search-field";
import {
  Popover,
  PopoverAnchor,
  PopoverContent,
} from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  missingMandatory,
  setItemRecipients,
  setItemValue,
  type ComposerContext,
  type ItemBlock,
} from "@/lib/employee/order-composer";
import {
  browsableTemplates,
  likelyTemplatesFor,
  ORDER_GROUPS,
  orderTemplate,
  type OrderTemplate,
  type OrderTemplateId,
} from "@/lib/employee/order-templates";
import { cn } from "@/lib/utils";

/**
 * **Items** — what is in this order, then the catalogue to add from: the screen's own
 * card, renamed (owner, 2026-10-12: "just make sure that you call it items").
 */
export function ItemsCard({
  items,
  context,
  purpose,
  fixedIds,
  disabled,
  reasonFor,
  onChoose,
  onEdit,
  onRemove,
  pinned,
}: {
  /**
   * An item the order always carries ahead of the catalogue's — an application order's
   * Application item. Its own pop-up, never removed.
   */
  pinned?: { label: string; gaps: number; onEdit: () => void };
  items: ItemBlock[];
  context: ComposerContext;
  purpose?: string;
  fixedIds: readonly string[];
  disabled: boolean;
  reasonFor: (template: OrderTemplate) => string | null;
  onChoose: (type: OrderTemplateId) => void;
  onEdit: (block: ItemBlock) => void;
  onRemove: (block: ItemBlock) => void;
}) {
  return (
    <Card variant="raised" className="min-w-0 gap-0 p-0">
      <div className={FRAMED_HEAD}>
        <h2 className="text-body-compact font-semibold">Items</h2>
        <span className="text-body-compact tabular-nums text-muted-foreground">
          {items.length + (pinned ? 1 : 0)} in this order
        </span>
      </div>
      <div className={cn(FRAMED_BODY, "flex min-w-0 flex-col gap-4")}>
        {items.length > 0 || pinned ? (
          <ol className="flex min-w-0 flex-col divide-y divide-hairline rounded-xl border border-hairline">
            {pinned ? (
              <li className="flex min-h-12 min-w-0 items-center gap-2 py-1 pr-1 pl-3">
                <span className="text-body-compact tabular-nums text-muted-foreground">
                  1.
                </span>
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="text-body-compact">{pinned.label}</span>
                  {pinned.gaps > 0 ? (
                    <span className="text-caption text-warning-ink">
                      {pinned.gaps} mandatory to fill
                    </span>
                  ) : null}
                </span>
                {disabled ? null : (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={`Edit ${pinned.label}`}
                    onClick={pinned.onEdit}
                  >
                    <PencilIcon aria-hidden />
                  </Button>
                )}
              </li>
            ) : null}
            {items.map((block, index) => {
              const gaps = missingMandatory(block, context);
              const template = orderTemplate(block.type);
              const asks = template.fields.some((field) => !field.derived);
              return (
                <li
                  key={block.id}
                  className="flex min-h-12 min-w-0 items-center gap-2 py-1 pr-1 pl-3"
                >
                  <span className="text-body-compact tabular-nums text-muted-foreground">
                    {index + (pinned ? 2 : 1)}.
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="text-body-compact">{template.label}</span>
                    {gaps.length > 0 ? (
                      <span className="text-caption text-warning-ink">
                        {gaps.length} mandatory to fill
                      </span>
                    ) : null}
                  </span>
                  {disabled ? null : (
                    <>
                      {asks ? (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          aria-label={`Edit ${template.label}`}
                          onClick={() => onEdit(block)}
                        >
                          <PencilIcon aria-hidden />
                        </Button>
                      ) : null}
                      {fixedIds.includes(block.id) ? null : (
                        <Button
                          type="button"
                          variant="destructive-ghost"
                          size="icon"
                          aria-label={`Remove ${template.label}`}
                          onClick={() => onRemove(block)}
                        >
                          <Trash2Icon aria-hidden />
                        </Button>
                      )}
                    </>
                  )}
                </li>
              );
            })}
          </ol>
        ) : null}

        {disabled ? null : (
          <ItemSearch
            purpose={purpose}
            reasonFor={reasonFor}
            onChoose={onChoose}
          />
        )}
      </div>
    </Card>
  );
}

/**
 * Adding an item, without the catalogue standing open on the card (owner, 2026-10-12:
 * "the scroll has become too much"). At rest the card offers only what is likely at this
 * hearing, as one-press suggestions. Entering the field opens the whole catalogue as a
 * dropdown; typing narrows it. No one-line descriptions — the names carry it. An item the
 * order cannot take still says why, under its name (`ITM-03`).
 *
 * **A raised dropdown, below the field** (owner, 2026-10-13). The list grown in place
 * looked exactly like the suggestions at rest, so nothing said it had opened or that it
 * scrolled. A lifted panel with its own edge and shadow is the shape everyone reads as
 * "a list opened". The earlier popover's glitch is kept out two ways: the suggestions
 * stay where they are under the panel, so the card never shrinks and the field never
 * slides from under the pointer; and the field is scrolled up first when it sits low, so
 * the panel always opens downward with room, never flipped over the card above.
 */
function ItemSearch({
  purpose,
  reasonFor,
  onChoose,
}: {
  purpose?: string;
  reasonFor: (template: OrderTemplate) => string | null;
  onChoose: (type: OrderTemplateId) => void;
}) {
  const [query, setQuery] = React.useState("");
  /* Open the moment the field is entered, not only once something is typed (owner,
     2026-10-12): a drafter looks at what is available before knowing what to search. */
  const [open, setOpen] = React.useState(false);
  /* Whether the list has more below what shows — drawn as a fade over the last row. */
  const [more, setMore] = React.useState(false);
  const scrollerRef = React.useRef<HTMLDivElement>(null);
  const anchorRef = React.useRef<HTMLDivElement>(null);
  const listRef = React.useRef<HTMLDivElement>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const needle = query.trim().toLowerCase();
  const matches = (template: OrderTemplate) =>
    !needle || template.label.toLowerCase().includes(needle);
  const likely = purpose ? likelyTemplatesFor(purpose) : [];
  const groups = [
    {
      id: "likely",
      label: "Likely at this hearing",
      rows: likely.filter(matches),
    },
    ...ORDER_GROUPS.map((group) => ({
      id: group.id,
      label: group.label,
      rows: browsableTemplates().filter(
        (template) => template.group === group.id && matches(template),
      ),
    })),
  ].filter((group) => group.rows.length > 0);
  const count = groups.reduce(
    (sum, group) => sum + (group.id === "likely" ? 0 : group.rows.length),
    0,
  );

  /* The fade follows the list's size as well as its scroll: the panel takes its height
     from the room the popper finds, a beat after it opens. */
  React.useEffect(() => {
    const node = scrollerRef.current;
    if (!open || !node) return;
    const measure = () =>
      setMore(node.scrollHeight - node.scrollTop - node.clientHeight > 1);
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    measure();
    return () => observer.disconnect();
  }, [open, query]);

  /* When the field sits low, lift it so the panel opens downward with room. Runs after
     the press has focused the field, so moving it cannot swallow the click. */
  React.useEffect(() => {
    if (!open) return;
    const field = anchorRef.current;
    if (!field) return;
    const below = window.innerHeight - field.getBoundingClientRect().bottom;
    const footer =
      window.document.querySelector("footer.sticky")?.getBoundingClientRect()
        .height ?? 0;
    if (below - footer >= 360) return;
    const headers = [...window.document.querySelectorAll("header")]
      .filter((node) => getComputedStyle(node).position === "sticky")
      .map((node) => node.getBoundingClientRect().bottom);
    const top = Math.max(0, ...headers) + 16;
    window.scrollBy({
      top: field.getBoundingClientRect().top - top,
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "auto"
        : "smooth",
    });
  }, [open]);

  function close() {
    setOpen(false);
    setQuery("");
  }

  function choose(type: OrderTemplateId) {
    close();
    onChoose(type);
  }

  /** Up and down walk the field and the rows that can be chosen. */
  function onKeyDown(event: React.KeyboardEvent) {
    if (event.key === "Escape" && open) {
      event.preventDefault();
      event.stopPropagation();
      close();
      const field = inputRef.current;
      if (field && window.document.activeElement !== field) {
        field.dataset.quiet = "1";
        field.focus();
      }
      return;
    }
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
    const stops = [
      inputRef.current,
      ...(listRef.current?.querySelectorAll<HTMLButtonElement>(
        "button:not([disabled])",
      ) ?? []),
    ].filter((node): node is HTMLInputElement | HTMLButtonElement => !!node);
    const at = stops.indexOf(window.document.activeElement as never);
    if (at < 0) return;
    event.preventDefault();
    setOpen(true);
    const next = event.key === "ArrowDown" ? at + 1 : at - 1;
    stops[Math.max(0, Math.min(stops.length - 1, next))]?.focus();
  }

  function inside(node: Node | null) {
    return (
      !!node &&
      (!!anchorRef.current?.contains(node) || !!listRef.current?.contains(node))
    );
  }

  return (
    <div className="flex min-w-0 flex-col gap-3" onKeyDown={onKeyDown}>
      <Popover open={open}>
        <PopoverAnchor asChild>
          <div
            ref={anchorRef}
            data-order-item-search=""
            className="min-w-0"
            onClick={() => setOpen(true)}
            onFocus={(event) => {
              /* Focus handed back by a closing dialog is not the drafter entering the
                 field: the catalogue stays shut until they press or type into it. */
              const field = event.target as HTMLElement;
              if (field.dataset.quiet) {
                delete field.dataset.quiet;
                return;
              }
              setOpen(true);
            }}
            onBlur={(event) => {
              /* Tabbing out of the field and the panel closes it; moving between them
                 does not. A press outside is handled by the panel itself. */
              if (event.relatedTarget && !inside(event.relatedTarget as Node))
                close();
            }}
          >
            <QueueSearchField
              ref={inputRef}
              label="Add an item"
              value={query}
              onChange={(value) => {
                setQuery(value);
                setOpen(true);
              }}
              placeholder="Search the catalogue"
              className="w-full"
            />
          </div>
        </PopoverAnchor>
        <PopoverContent
          ref={listRef}
          side="bottom"
          align="start"
          collisionPadding={16}
          /* The field keeps the caret: the list follows what is typed. */
          onOpenAutoFocus={(event) => event.preventDefault()}
          onCloseAutoFocus={(event) => event.preventDefault()}
          onEscapeKeyDown={close}
          onInteractOutside={(event) => {
            /* Pressing back into the field is not leaving the search. */
            if (inside(event.target as Node)) {
              event.preventDefault();
              return;
            }
            close();
          }}
          onBlur={(event) => {
            if (event.relatedTarget && !inside(event.relatedTarget as Node))
              close();
          }}
          className="relative max-h-[min(24rem,var(--radix-popover-content-available-height))] w-(--radix-popover-trigger-width) min-w-72 gap-0 overflow-hidden p-0"
        >
          {/* What the panel holds, so it reads as the catalogue and not as more card. */}
          <div className="flex shrink-0 items-center justify-between gap-2 border-b border-hairline px-3 py-2 text-body-compact text-muted-foreground">
            <span>{needle ? "Matching items" : "Order items"}</span>
            <span className="tabular-nums">{count}</span>
          </div>
          <div
            ref={scrollerRef}
            onScroll={(event) => {
              const node = event.currentTarget;
              setMore(
                node.scrollHeight - node.scrollTop - node.clientHeight > 1,
              );
            }}
            className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-1"
          >
            {groups.length === 0 ? (
              <p className="px-2 py-3 text-body-compact text-muted-foreground">
                No item matches “{query.trim()}”.
              </p>
            ) : (
              groups.map((group) => (
                <section
                  key={group.id}
                  aria-labelledby={`catalogue-${group.id}`}
                  className="flex min-w-0 flex-col"
                >
                  <h3
                    id={`catalogue-${group.id}`}
                    className="px-2 pt-2 pb-1 text-body-compact text-muted-foreground"
                  >
                    {group.label}
                  </h3>
                  <ul className="flex min-w-0 flex-col">
                    {group.rows.map((template) => (
                      <CatalogueRow
                        key={template.id}
                        template={template}
                        reason={reasonFor(template)}
                        onChoose={choose}
                      />
                    ))}
                  </ul>
                </section>
              ))
            )}
          </div>
          {more ? (
            <div
              aria-hidden
              className="pointer-events-none absolute inset-x-0 bottom-0 h-12 rounded-b-lg bg-linear-to-t from-popover to-transparent"
            />
          ) : null}
        </PopoverContent>
      </Popover>

      {likely.length > 0 ? (
        <section
          aria-labelledby="catalogue-suggested"
          className="flex min-w-0 flex-col gap-1"
        >
          <h3
            id="catalogue-suggested"
            className="text-body-compact text-muted-foreground"
          >
            Likely at this hearing
          </h3>
          <ul className="-mx-2 flex min-w-0 flex-col">
            {likely.map((template) => (
              <CatalogueRow
                key={template.id}
                template={template}
                reason={reasonFor(template)}
                onChoose={choose}
              />
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

/** One catalogue item: its name, and — only when it cannot be added — why not, under it. */
function CatalogueRow({
  template,
  reason,
  onChoose,
}: {
  template: OrderTemplate;
  reason: string | null;
  onChoose: (type: OrderTemplateId) => void;
}) {
  return (
    <li className="min-w-0">
      <button
        type="button"
        disabled={reason !== null}
        onClick={() => onChoose(template.id)}
        className="flex min-h-10 w-full min-w-0 items-start gap-2 rounded-lg px-2 py-2.5 text-left text-body-compact transition-colors hover:bg-accent focus-visible:bg-accent focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none disabled:pointer-events-none"
      >
        <PlusIcon
          aria-hidden
          className={cn(
            "mt-0.5 size-4 shrink-0 text-muted-foreground",
            reason && "invisible",
          )}
        />
        <span className="flex min-w-0 flex-1 flex-col">
          <span className={cn(reason && "text-muted-foreground")}>
            {template.label}
          </span>
          {reason ? (
            <span className="text-muted-foreground">{reason}</span>
          ) : null}
        </span>
      </button>
    </li>
  );
}

/**
 * An item's fields, asked for before its sentence is written into the order (`VAR-05`),
 * with the sentence they make shown as they are answered. It goes in only once every
 * required field is answered (`VAR-06`).
 */
export function ItemDialog({
  editing,
  context,
  today,
  onChange,
  onClose,
  onConfirm,
  description,
}: {
  editing: { block: ItemBlock; mode: "add" | "edit" } | null;
  context: ComposerContext;
  today: string;
  onChange: (block: ItemBlock) => void;
  onClose: () => void;
  onConfirm: () => void;
  /** What the dialog says about where the item goes. */
  description?: string;
}) {
  /* What was last open, kept while the dialog animates out — otherwise its title and
     fields vanish a beat before it does. */
  const [shown, setShown] = React.useState(editing);
  if (editing && editing !== shown) setShown(editing);
  const block = shown?.block;
  /* Only mandatory fields are counted (`VAR-05`), and they no longer hold back
     adding the item: it can be added half-filled and finished later (`VAR-06`). */
  const gaps = block ? missingMandatory(block, context) : [];
  const label = block ? orderTemplate(block.type).label : "";
  return (
    <Dialog
      open={editing !== null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent
        className="flex max-h-[90dvh] flex-col gap-4 sm:max-w-2xl"
        onCloseAutoFocus={(event) => {
          /* An item added from the catalogue: the row it was chosen from has gone with the
             closed list, so focus comes back to the search, ready for the next one. */
          if (shown?.mode !== "add") return;
          const search = window.document.querySelector<HTMLInputElement>(
            "[data-order-item-search] input",
          );
          if (!search) return;
          event.preventDefault();
          search.dataset.quiet = "1";
          search.focus();
        }}
      >
        <DialogHeader>
          <DialogTitle className="text-title-s font-semibold">
            {label}
          </DialogTitle>
          <DialogDescription>
            {description ??
              "Recorded in this order's data. Nothing is written into the order's text."}
          </DialogDescription>
        </DialogHeader>
        {block ? (
          /* `-mx-1 px-1`: room for the fields' focus rings inside the scroll. */
          <div className="-mx-1 flex min-h-0 flex-col gap-6 overflow-y-auto px-1 pb-1">
            <OrderItemFields
              block={block}
              context={context}
              today={today}
              disabled={false}
              onValue={(key, value) =>
                onChange(setItemValue(block, key, value, context))
              }
              onRecipients={(recipients) =>
                onChange(setItemRecipients(block, recipients, context))
              }
            />
          </div>
        ) : null}
        {/* On a phone the footer stacks with the action on top; the count of what is
            left leads it there, and sits at the left on a wider screen. */}
        <DialogFooter className="sm:items-center">
          <Button
            type="button"
            variant="outline"
            className="w-full sm:w-auto"
            onClick={onClose}
          >
            Cancel
          </Button>
          <Button
            type="button"
            className="w-full sm:w-auto"
            onClick={onConfirm}
          >
            {shown?.mode === "edit" ? "Save" : "Add to order"}
          </Button>
          {gaps.length > 0 ? (
            <Badge
              variant="warning"
              className="self-start tabular-nums sm:order-first sm:mr-auto sm:self-auto"
            >
              {gaps.length} mandatory to fill
            </Badge>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

