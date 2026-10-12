"use client";

import * as React from "react";
import { PencilIcon, PlusIcon, Trash2Icon } from "lucide-react";

import { Identifier } from "@/components/chrome/identifier";
import {
  RichTextField,
  type RichTextValue,
} from "@/components/cases/rich-text-field";
import {
  ApplicationsSection,
  AttendanceSection,
  NextHearingSection,
  OrderFooter,
  PageViewSwitch,
  type ComposerApplication,
  type ComposerFact,
  type PageView,
  type SigningStatus,
} from "@/components/employee/order-composer";
import { OrderCaseFile } from "@/components/employee/order-case-file";
import { OrderDraftFacsimile } from "@/components/employee/order-draft-facsimile";
import { OrderItemFields } from "@/components/employee/order-item-fields";
import { QueueSearchField } from "@/components/employee/queue-search-field";
import { PANEL_CLASS } from "@/components/shell/panel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Popover,
  PopoverAnchor,
  PopoverContent,
} from "@/components/ui/popover";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { ListingApplicationDecision } from "@/lib/employee/listing-applications";
import {
  blockGaps,
  createItemBlock,
  setItemRecipients,
  setItemValue,
  type ComposerContext,
  type ItemBlock,
} from "@/lib/employee/order-composer";
import {
  attendanceRecital,
  nextListingRecital,
  type Appearance,
  type AttendanceMark,
  type OrderDocument,
  type OrderDraft,
} from "@/lib/employee/order-draft";
import {
  browsableTemplates,
  combinationConflict,
  likelyTemplatesFor,
  ORDER_GROUPS,
  orderTemplate,
  unavailableReason,
  type OrderTemplate,
  type OrderTemplateId,
} from "@/lib/employee/order-templates";
import {
  appendRichText,
  replaceOrderItemText,
  richTextFromPlain,
  richTextWithoutItem,
  upsertRichTextFact,
} from "@/lib/employee/order-text";
import { cn } from "@/lib/utils";

/**
 * Version B of the order composer — the text-box screen the court side already had,
 * kept beside the block composer for A/B testing (owner, 2026-10-12), with three changes:
 *
 * 1. **Tighter.** The space between the boxes is cut: a 16px canvas gap and 16px card
 *    padding where there were 32px and 24px.
 * 2. **The right side is only the text box.** Attendance and Next hearing move to the left
 *    column, beside Applications and the catalogue, and the order is one large editor.
 * 3. **"Items".** The catalogue card is called Items, the word the catalogue uses.
 *
 * It runs on the same catalogue and the same fields as version A (`order-templates.ts`,
 * `order-composer.ts`): choosing an item asks for its fields first and writes its
 * sentence into the text once they are answered (`VAR-05`, `VAR-06`); the pencil reopens
 * them and writes the corrected sentence where the old one stood; the bin takes the item
 * and its words out. Attendance and the posting recite themselves into the text as they
 * are answered (`TXT-05`).
 */
export function OrderTextComposer({
  heading,
  facts,
  navAction,
  notice,
  context,
  today,
  purpose,
  inHearing,
  draft,
  setDraft,
  fixedIds = [],
  appearances,
  applications,
  onOpenApplication,
  decisionFor,
  showNextHearing,
  document,
  applicationDialog,
}: {
  heading: string;
  facts: ComposerFact[];
  navAction: React.ReactNode;
  notice?: React.ReactNode;
  context: ComposerContext;
  today: string;
  purpose?: string;
  inHearing: boolean;
  draft: OrderDraft;
  setDraft: (update: (current: OrderDraft) => OrderDraft) => void;
  fixedIds?: readonly string[];
  /** A hearing's roll; absent outside a hearing. */
  appearances?: Appearance[];
  applications?: ComposerApplication[];
  onOpenApplication?: (id: string) => void;
  /** The decision block an application decision adds. */
  decisionFor?: (id: string, decision: ListingApplicationDecision) => ItemBlock;
  showNextHearing: boolean;
  document: OrderDocument;
  /** The application's own dialog, handed the same decide as the Applications card. */
  applicationDialog?: (
    decide: (id: string, decision: ListingApplicationDecision | null) => void,
  ) => React.ReactNode;
}) {
  const [caseFileOpen, setCaseFileOpen] = React.useState(false);
  const [view, setView] = React.useState<PageView>("drafting");
  const [signingStatus, setSigningStatus] =
    React.useState<SigningStatus>("draft");
  const [announcement, setAnnouncement] = React.useState("");
  /** Bumped by every write the screen makes, so the editor re-reads its HTML. */
  const [bodyWrites, setBodyWrites] = React.useState(0);
  const [editing, setEditing] = React.useState<{
    block: ItemBlock;
    mode: "add" | "edit";
  } | null>(null);
  const locked = signingStatus !== "draft";
  const body: RichTextValue = draft.body ?? { html: "", text: "" };
  const items = draft.blocks.filter(
    (block): block is ItemBlock => block.kind === "item",
  );

  function write(change: (current: OrderDraft) => OrderDraft) {
    setDraft(change);
    setBodyWrites((count) => count + 1);
  }

  function bodyOf(current: OrderDraft): RichTextValue {
    return current.body ?? { html: "", text: "" };
  }

  /* ── what is left ───────────────────────────────────────────────────────────── */

  const posting =
    showNextHearing &&
    draft.next === "list" &&
    !(draft.nextDate && draft.nextPurpose);
  const itemGaps = items.reduce(
    (sum, block) =>
      sum +
      blockGaps(block, context).filter((gap) => gap.key !== "text").length,
    0,
  );
  const bracketGaps = (body.text.match(/\[[^\]]+\]/g) ?? []).length;
  const toFill = itemGaps + bracketGaps + (posting ? 1 : 0);
  const ready = toFill === 0 && body.text.trim().length > 0;

  /* ── items ──────────────────────────────────────────────────────────────────── */

  function reasonFor(template: OrderTemplate): string | null {
    return (
      unavailableReason(template, { hearingOngoing: inHearing }) ??
      combinationConflict(
        template.id,
        items.map((block) => ({
          type: block.type,
          applicationId: block.applicationId,
        })),
      )
    );
  }

  function choose(type: OrderTemplateId) {
    const block = createItemBlock(type, context);
    const asks = orderTemplate(type).fields.some((field) => !field.derived);
    if (asks) setEditing({ block, mode: "add" });
    else commitAdd(block);
  }

  function commitAdd(block: ItemBlock) {
    write((current) => ({
      ...current,
      blocks: [...current.blocks, block],
      body: appendRichText(
        bodyOf(current),
        richTextFromPlain(block.text, block.id),
      ),
    }));
    setAnnouncement(
      `${orderTemplate(block.type).label} added. Its words are at the end of the order.`,
    );
  }

  function commitEdit(block: ItemBlock) {
    write((current) => ({
      ...current,
      blocks: current.blocks.map((entry) =>
        entry.id === block.id ? block : entry,
      ),
      body: replaceOrderItemText(
        bodyOf(current),
        block.id,
        richTextFromPlain(block.text, block.id),
      ),
    }));
    setAnnouncement(`${orderTemplate(block.type).label} updated in the order.`);
  }

  function removeItem(block: ItemBlock) {
    write((current) => ({
      ...current,
      blocks: current.blocks.filter((entry) => entry.id !== block.id),
      body: richTextWithoutItem(bodyOf(current), block.id),
    }));
    setAnnouncement(
      `${orderTemplate(block.type).label} removed with its words.`,
    );
  }

  /* ── the sitting ────────────────────────────────────────────────────────────── */

  function mark(id: string, value: AttendanceMark | undefined) {
    if (!appearances) return;
    write((current) => {
      const marks = { ...current.marks, [id]: value };
      return {
        ...current,
        marks,
        body: upsertRichTextFact(
          bodyOf(current),
          "attendance",
          attendanceRecital(appearances, marks),
        ),
      };
    });
  }

  function decide(id: string, decision: ListingApplicationDecision | null) {
    const existing = items.find((block) => block.applicationId === id);
    const added = decision && decisionFor ? decisionFor(id, decision) : null;
    write((current) => {
      let next = bodyOf(current);
      let blocks = current.blocks;
      if (existing) {
        next = richTextWithoutItem(next, existing.id);
        blocks = blocks.filter((block) => block.id !== existing.id);
      }
      if (added) {
        next = appendRichText(next, richTextFromPlain(added.text, added.id));
        blocks = [...blocks, added];
      }
      return {
        ...current,
        blocks,
        body: next,
        applications: { ...current.applications, [id]: decision ?? undefined },
      };
    });
  }

  function post(change: {
    next?: OrderDraft["next"];
    purpose?: OrderDraft["nextPurpose"];
    date?: string | null;
  }) {
    write((current) => {
      const posting = {
        next: change.next ?? current.next,
        nextPurpose:
          change.purpose !== undefined ? change.purpose : current.nextPurpose,
        nextDate: change.date !== undefined ? change.date : current.nextDate,
      };
      return {
        ...current,
        ...posting,
        body: upsertRichTextFact(
          bodyOf(current),
          "next",
          nextListingRecital(posting),
        ),
      };
    });
  }

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      <header className="sticky top-14 z-20 flex flex-col gap-3 border-b border-hairline bg-card px-6 py-4 sm:flex-row sm:items-start sm:justify-between md:px-8">
        <div className="flex min-w-0 flex-col gap-2">
          <h1 className="min-w-0 text-title font-semibold text-balance">
            Order: {heading}
          </h1>
          <div className="flex min-w-0 flex-wrap items-baseline gap-x-6 gap-y-1">
            {facts.map((fact) => (
              <p
                key={fact.label}
                className="flex min-w-0 items-baseline gap-2 text-body-compact"
              >
                <span className="font-medium text-muted-foreground">{`${fact.label}:`}</span>
                {fact.identifier ? (
                  <Identifier
                    value={fact.value}
                    label={fact.label.toLowerCase()}
                  />
                ) : (
                  <span className="tabular-nums">{fact.value}</span>
                )}
              </p>
            ))}
          </div>
          {notice}
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <Button
            type="button"
            variant="outline"
            className="w-full shrink-0 sm:w-fit"
            onClick={() => setCaseFileOpen((open) => !open)}
          >
            {caseFileOpen ? "Back to order" : "View case"}
          </Button>
          {navAction}
        </div>
      </header>

      {/* Tighter than the screen this was: 16px between the boxes and around them on a
          phone, 24px from `md` (owner, 2026-10-12: "too much empty space between these
          boxes"). */}
      <div className="grid min-w-0 flex-1 items-start gap-4 bg-muted p-4 md:p-6 lg:grid-cols-3 dark:bg-background">
        <div className="flex min-w-0 flex-col gap-4">
          {appearances ? (
            <Card className={cn(PANEL_CLASS, "min-w-0 gap-0 p-4")}>
              <AttendanceSection
                attendance={{
                  appearances,
                  marks: draft.marks,
                  onMark: mark,
                  onMarkAllPresent: () => {
                    for (const appearance of appearances) {
                      if (!draft.marks[appearance.id])
                        mark(appearance.id, "present");
                    }
                  },
                }}
                disabled={locked}
              />
            </Card>
          ) : null}

          {showNextHearing ? (
            <Card className={cn(PANEL_CLASS, "min-w-0 gap-0 p-4")}>
              <NextHearingSection
                nextHearing={{
                  next: draft.next,
                  purpose: draft.nextPurpose,
                  date: draft.nextDate,
                  onChange: post,
                }}
                today={today}
                disabled={locked}
              />
            </Card>
          ) : null}

          {applications && applications.length > 0 ? (
            <Card className={cn(PANEL_CLASS, "min-w-0 gap-0 p-4")}>
              <ApplicationsSection
                applications={{
                  list: applications,
                  onDecide: decide,
                  onOpen: (id) => onOpenApplication?.(id),
                }}
                disabled={locked}
              />
            </Card>
          ) : null}

          <ItemsCard
            items={items}
            context={context}
            purpose={purpose}
            fixedIds={fixedIds}
            disabled={locked}
            reasonFor={reasonFor}
            onChoose={choose}
            onEdit={(block) => setEditing({ block, mode: "edit" })}
            onRemove={removeItem}
          />
        </div>

        {caseFileOpen ? (
          <OrderCaseFile className="lg:sticky lg:top-40 lg:col-span-2 lg:h-[calc(100svh-16rem)]" />
        ) : (
          <article
            aria-labelledby="order-paper"
            className={cn(
              PANEL_CLASS,
              "flex min-w-0 flex-col gap-3 rounded-xl border bg-card p-4 text-card-foreground md:p-6 lg:sticky lg:top-40 lg:col-span-2",
            )}
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2
                id="order-paper"
                className="text-body-compact font-semibold tracking-wide uppercase"
              >
                Order
              </h2>
              <PageViewSwitch value={view} onChange={setView} />
            </div>
            {view === "preview" ? (
              <OrderDraftFacsimile document={document} />
            ) : (
              <RichTextField
                key={bodyWrites}
                value={body}
                onChange={(value) => {
                  if (!locked)
                    setDraft((current) => ({ ...current, body: value }));
                }}
                labelId="order-paper"
                className="[&_[data-slot=input-group-control]]:min-h-[60svh] [&_[data-slot=input-group-control]>*+*]:mt-4"
              />
            )}
          </article>
        )}
      </div>

      <OrderFooter
        signingStatus={signingStatus}
        onSigningStatus={(status, message) => {
          setSigningStatus(status);
          setAnnouncement(message);
        }}
        toFill={toFill}
        ready={ready}
        onJumpToGap={() => {
          const first = items.find(
            (block) =>
              blockGaps(block, context).filter((gap) => gap.key !== "text")
                .length > 0,
          );
          if (first) setEditing({ block: first, mode: "edit" });
          else window.document.getElementById("order-paper")?.scrollIntoView();
        }}
        undo={null}
        document={document}
      />

      <p aria-live="polite" className="sr-only">
        {announcement}
      </p>

      {applicationDialog?.(decide)}

      <ItemDialog
        editing={editing}
        context={context}
        today={today}
        onChange={(block) =>
          setEditing((current) => (current ? { ...current, block } : current))
        }
        onClose={() => setEditing(null)}
        onConfirm={() => {
          if (!editing) return;
          if (editing.mode === "add") commitAdd(editing.block);
          else commitEdit(editing.block);
          setEditing(null);
        }}
      />
    </div>
  );
}

/* ─────────────────────────────────── items ─────────────────────────────────── */

/**
 * **Items** — what is in this order, then the catalogue to add from: the screen's own
 * card, renamed (owner, 2026-10-12: "just make sure that you call it items").
 */
function ItemsCard({
  items,
  context,
  purpose,
  fixedIds,
  disabled,
  reasonFor,
  onChoose,
  onEdit,
  onRemove,
}: {
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
    <Card className={cn(PANEL_CLASS, "min-w-0 gap-4 p-4")}>
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-body-compact font-semibold">Items</h2>
        <span className="text-body-compact tabular-nums text-muted-foreground">
          {items.length} in this order
        </span>
      </div>

      {items.length > 0 ? (
        <ol className="flex min-w-0 flex-col gap-2">
          {items.map((block, index) => {
            const gaps = blockGaps(block, context).filter(
              (gap) => gap.key !== "text",
            );
            const template = orderTemplate(block.type);
            const asks = template.fields.some((field) => !field.derived);
            return (
              <li
                key={block.id}
                className="flex min-w-0 items-center gap-2 rounded-lg border border-hairline bg-surface-sunken py-1 pr-1 pl-3"
              >
                <span className="text-body-compact tabular-nums text-muted-foreground">
                  {index + 1}.
                </span>
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="text-body-compact">{template.label}</span>
                  {gaps.length > 0 ? (
                    <span className="text-caption text-warning-ink">
                      {gaps.length} to fill
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
    </Card>
  );
}

/**
 * Adding an item, without the catalogue standing open on the card (owner, 2026-10-12:
 * "the scroll has become too much"). At rest the card offers only what is likely at this
 * hearing, as one-press suggestions; typing turns the field into a searchable dropdown
 * over the whole catalogue. No one-line descriptions — the names carry it. An item the
 * order cannot take still says why, beside its name (`ITM-03`).
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
  const anchorRef = React.useRef<HTMLDivElement>(null);
  const needle = query.trim().toLowerCase();
  const matches = (template: OrderTemplate) =>
    !needle || template.label.toLowerCase().includes(needle);
  const likely = purpose ? likelyTemplatesFor(purpose) : [];
  const groups = [
    { id: "likely", label: "Likely at this hearing", rows: likely.filter(matches) },
    ...ORDER_GROUPS.map((group) => ({
      id: group.id,
      label: group.label,
      rows: browsableTemplates().filter(
        (template) => template.group === group.id && matches(template),
      ),
    })),
  ].filter((group) => group.rows.length > 0);

  function close() {
    setOpen(false);
    setQuery("");
  }

  function choose(type: OrderTemplateId) {
    close();
    onChoose(type);
  }

  return (
    <div className="flex min-w-0 flex-col gap-3">
      <Popover open={open}>
        <PopoverAnchor asChild>
          <div
            ref={anchorRef}
            className="min-w-0"
            onFocus={() => setOpen(true)}
            onClick={() => setOpen(true)}
            onKeyDown={(event) => {
              if (event.key === "Escape" && open) {
                event.stopPropagation();
                close();
              }
            }}
          >
            <QueueSearchField
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
          align="start"
          collisionPadding={16}
          /* The field keeps the caret: the list follows what is typed, it does not take
             over from it. */
          onOpenAutoFocus={(event) => event.preventDefault()}
          onEscapeKeyDown={close}
          onInteractOutside={(event) => {
            /* Clicking back into the field is not leaving the search. */
            if (anchorRef.current?.contains(event.target as Node)) {
              event.preventDefault();
              return;
            }
            close();
          }}
          className="flex max-h-[min(20rem,var(--radix-popover-content-available-height))] w-(--radix-popover-trigger-width) min-w-72 flex-col gap-2 overflow-y-auto overscroll-contain p-1"
        >
          {groups.length === 0 ? (
            <p className="px-2 py-2 text-body-compact text-muted-foreground">
              No item matches that.
            </p>
          ) : (
            groups.map((group) => (
              <section key={group.id} className="flex min-w-0 flex-col">
                <h3 className="px-2 pt-1 text-caption font-semibold text-muted-foreground">
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
        </PopoverContent>
      </Popover>

      {!open && likely.length > 0 ? (
        <section className="flex min-w-0 flex-col gap-1">
          <h3 className="text-caption font-semibold text-muted-foreground">
            Likely at this hearing
          </h3>
          <ul className="flex min-w-0 flex-col">
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

/** One catalogue item: its name, and — only when it cannot be added — why not. */
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
        className="flex min-h-10 w-full min-w-0 items-center gap-2 rounded-lg px-2 text-left transition-colors hover:bg-accent focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none disabled:pointer-events-none"
      >
        <PlusIcon
          aria-hidden
          className={cn(
            "size-4 shrink-0 text-muted-foreground",
            reason && "invisible",
          )}
        />
        <span
          className={cn(
            "min-w-0 flex-1 text-body-compact",
            reason && "text-muted-foreground",
          )}
        >
          {template.label}
        </span>
        {reason ? (
          <span className="shrink-0 text-right text-caption text-muted-foreground">
            {reason}
          </span>
        ) : null}
      </button>
    </li>
  );
}

/**
 * An item's fields, asked for before its sentence is written into the order (`VAR-05`),
 * with the sentence they make shown as they are answered. It goes in only once every
 * required field is answered (`VAR-06`).
 */
function ItemDialog({
  editing,
  context,
  today,
  onChange,
  onClose,
  onConfirm,
}: {
  editing: { block: ItemBlock; mode: "add" | "edit" } | null;
  context: ComposerContext;
  today: string;
  onChange: (block: ItemBlock) => void;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const block = editing?.block;
  const gaps = block
    ? blockGaps(block, context).filter((gap) => gap.key !== "text")
    : [];
  const label = block ? orderTemplate(block.type).label : "";
  return (
    <Dialog
      open={editing !== null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="flex max-h-[90dvh] flex-col gap-4 sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-title-s font-semibold">
            {label}
          </DialogTitle>
          <DialogDescription>
            {editing?.mode === "edit"
              ? "The corrected sentence replaces this item's words in the order."
              : "Its sentence is written into the order once these are answered."}
          </DialogDescription>
        </DialogHeader>
        {block ? (
          <div className="flex min-h-0 flex-col gap-4 overflow-y-auto">
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
            <div className="flex min-w-0 flex-col gap-1 rounded-lg border border-hairline bg-surface-sunken p-3">
              <span className="text-caption font-semibold text-muted-foreground">
                In the order
              </span>
              <p className="text-body">{block.text}</p>
            </div>
          </div>
        ) : null}
        <DialogFooter className="items-center">
          {gaps.length > 0 ? (
            <Badge variant="warning" className="mr-auto tabular-nums">
              {gaps.length} to fill
            </Badge>
          ) : null}
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="button" disabled={gaps.length > 0} onClick={onConfirm}>
            {editing?.mode === "edit" ? "Save" : "Add to order"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Version B's opening text: each item's words in order, marked with its id. */
export function bodyFromBlocks(
  blocks: OrderDraft["blocks"],
  recitals?: {
    attendance: Parameters<typeof upsertRichTextFact>[2];
    next: Parameters<typeof upsertRichTextFact>[2];
  },
): RichTextValue {
  let body = blocks.reduce<RichTextValue>(
    (passage, block) =>
      appendRichText(
        passage,
        richTextFromPlain(
          block.text,
          block.kind === "item" ? block.id : undefined,
        ),
      ),
    { html: "", text: "" },
  );
  if (recitals) {
    body = upsertRichTextFact(body, "attendance", recitals.attendance);
    body = upsertRichTextFact(body, "next", recitals.next);
  }
  return body;
}
