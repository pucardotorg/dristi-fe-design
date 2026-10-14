"use client";

import * as React from "react";
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  PanelLeftOpenIcon,
  PanelRightOpenIcon,
  PencilIcon,
  PlusIcon,
  Trash2Icon,
} from "lucide-react";

import { Identifier } from "@/components/chrome/identifier";
import {
  RichTextField,
  type RichTextValue,
} from "@/components/cases/rich-text-field";
import {
  ApplicationsSection,
  AttendanceSection,
  FRAMED_BODY,
  FRAMED_HEAD,
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
import {
  Popover,
  PopoverAnchor,
  PopoverContent,
} from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
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
  /* The two side panels, each the user's to open and close (owner, 2026-10-13: "give
     the user control to bring back what they wish"). The case file's "closing" keeps
     the pane mounted while its column narrows back to a rail. */
  const [sideOpen, setSideOpen] = React.useState(true);
  const [caseFile, setCaseFile] = React.useState<"closed" | "open" | "closing">(
    "closed",
  );
  /* Opening the file tucks the workflow panel away where three columns will not fit;
     closing the file brings it back — but only if the file was what put it away. */
  const tuckedForCase = React.useRef(false);

  function openCaseFile() {
    setCaseFile("open");
    const narrow =
      window.matchMedia("(min-width: 64rem)").matches &&
      !window.matchMedia("(min-width: 112rem)").matches;
    if (narrow && sideOpen) {
      setSideOpen(false);
      tuckedForCase.current = true;
    }
  }

  function closeCaseFile() {
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    setCaseFile(still ? "closed" : "closing");
    if (!still)
      window.setTimeout(
        () =>
          setCaseFile((current) =>
            current === "closing" ? "closed" : current,
          ),
        320,
      );
    if (tuckedForCase.current) {
      setSideOpen(true);
      tuckedForCase.current = false;
    }
  }

  function toggleSide() {
    tuckedForCase.current = false;
    setSideOpen((open) => !open);
  }

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
      {/* Header, panels and footer share one 24px gutter, so their edges line up. */}
      <header className="sticky top-14 z-20 flex flex-col gap-3 border-b border-hairline bg-card px-4 py-4 sm:flex-row sm:items-start sm:justify-between md:px-6">
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
            aria-pressed={caseFile === "open"}
            aria-controls="order-case-file"
            className="w-full shrink-0 aria-pressed:bg-accent-strong sm:w-fit"
            onClick={() =>
              caseFile === "open" ? closeCaseFile() : openCaseFile()
            }
          >
            {caseFile === "open" ? "Hide case" : "View case"}
          </Button>
          {navAction}
        </div>
      </header>

      {/* Tighter than the screen this was: 16px between the boxes and around them on a
          phone, 24px from `md` (owner, 2026-10-12: "too much empty space between these
          boxes").

          Three columns from `lg`, always three, so they can move: the workflow panel, the
          order, the case file. A closed panel keeps 40px at its edge, holding one icon
          button — the way back to it — and the columns' widths animate between the two, so opening
          the file is seen to push in from the right while the workflow panel gives way on
          the left (owner, 2026-10-13). The workflow panel never narrows: its cards keep
          their own width and are clipped as the column closes, never reflowed (squeezed,
          they break). The case file takes 53% of what the panel leaves. */}
      <div
        className={cn(
          "grid min-w-0 flex-1 items-start gap-4 bg-muted p-4 md:p-6 dark:bg-background",
          "lg:grid-cols-[var(--side)_minmax(0,1fr)_var(--case)] motion-safe:transition-[grid-template-columns] motion-safe:duration-300 motion-safe:ease-out",
          sideOpen
            ? "[--side:26rem] xl:[--side:32rem] 2xl:[--side:36rem]"
            : "[--side:2.5rem]",
          caseFile === "open"
            ? "[--case:calc((100%_-_var(--side)_-_2rem)*0.53)]"
            : "[--case:2.5rem]",
        )}
      >
        <div
          id="order-workflow"
          className="relative min-w-0 lg:overflow-x-clip"
        >
          <div
            className={cn(
              "flex min-w-0 flex-col gap-4 lg:w-[26rem] xl:w-[32rem] 2xl:w-[36rem]",
              "motion-safe:transition-[opacity,translate,visibility] motion-safe:duration-300 motion-safe:ease-out",
              !sideOpen && "lg:invisible lg:-translate-x-8 lg:opacity-0",
            )}
          >
            {appearances ? (
              <Card className={cn(PANEL_CLASS, "min-w-0 gap-0 p-0")}>
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
                  framed
                />
              </Card>
            ) : null}

            {showNextHearing ? (
              <Card className={cn(PANEL_CLASS, "min-w-0 gap-0 p-0")}>
                <NextHearingSection
                  nextHearing={{
                    next: draft.next,
                    purpose: draft.nextPurpose,
                    date: draft.nextDate,
                    onChange: post,
                  }}
                  today={today}
                  disabled={locked}
                  framed
                />
              </Card>
            ) : null}

            {applications && applications.length > 0 ? (
              <Card className={cn(PANEL_CLASS, "min-w-0 gap-0 p-0")}>
                <ApplicationsSection
                  applications={{
                    list: applications,
                    onDecide: decide,
                    onOpen: (id) => onOpenApplication?.(id),
                  }}
                  disabled={locked}
                  framed
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
          {sideOpen ? null : (
            <PanelRail
              side="left"
              label="Workflow"
              controls="order-workflow"
              onOpen={toggleSide}
            />
          )}
        </div>

        <div className="relative min-w-0 lg:sticky lg:top-40">
          {/* The handles on the order's two edges: each panel can be put away or brought
              back from beside the order itself, not only from the header. */}
          {sideOpen ? (
            <EdgeHandle
              side="left"
              label="Hide workflow panel"
              controls="order-workflow"
              onClick={toggleSide}
            />
          ) : null}
          {caseFile === "open" ? (
            <EdgeHandle
              side="right"
              label="Hide case file"
              controls="order-case-file"
              onClick={closeCaseFile}
            />
          ) : null}
          <article
            aria-labelledby="order-paper"
            className={cn(
              PANEL_CLASS,
              "flex min-w-0 flex-col rounded-xl border bg-card text-card-foreground ",
            )}
          >
            <div className={cn(FRAMED_HEAD, "flex-wrap")}>
              <h2 id="order-paper" className="text-body-compact font-semibold">
                Order
              </h2>
              <PageViewSwitch value={view} onChange={setView} />
            </div>
            <div className={FRAMED_BODY}>
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
            </div>
          </article>
        </div>

        {/* The case file at the screen's right edge: it pushes in from the side it docks
            to and back out the same way (owner, 2026-10-13: "not in the bang middle"). */}
        {caseFile === "closed" ? (
          <PanelRail
            side="right"
            label="Case file"
            controls="order-case-file"
            onOpen={openCaseFile}
          />
        ) : (
          <OrderCaseFile
            id="order-case-file"
            onClose={closeCaseFile}
            className={cn(
              "lg:sticky lg:top-40 lg:h-[calc(100svh-16rem)]",
              "motion-safe:transition-opacity motion-safe:duration-200",
              caseFile === "closing"
                ? "opacity-0"
                : "motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-right-8 motion-safe:duration-300",
            )}
          />
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
        className="px-4 md:px-6"
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

/* ───────────────────────────────── the panels ────────────────────────────────── */

/**
 * A closed panel's way back: one icon button at the top of the 40px it keeps at its
 * screen edge, level with the panels' tops, held there as the page scrolls. The panel's
 * name is the button's accessible name and its tooltip — no lettering of its own.
 */
function PanelRail({
  side,
  label,
  controls,
  onOpen,
}: {
  side: "left" | "right";
  label: string;
  controls: string;
  onOpen: () => void;
}) {
  const Icon = side === "left" ? PanelLeftOpenIcon : PanelRightOpenIcon;
  const name = `Show ${label.toLowerCase()}`;
  return (
    <div
      className={cn(
        "hidden lg:block",
        side === "left"
          ? "absolute inset-y-0 left-0 w-10"
          : "sticky top-40 w-10",
        "motion-safe:animate-in motion-safe:fade-in-0 motion-safe:duration-300",
      )}
    >
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant="outline"
              size="icon"
              aria-expanded={false}
              aria-controls={controls}
              aria-label={name}
              onClick={onOpen}
              className={cn(
                "bg-card shadow-raised",
                side === "left" && "sticky top-40",
              )}
            >
              <Icon aria-hidden />
            </Button>
          </TooltipTrigger>
          <TooltipContent side={side === "left" ? "right" : "left"}>
            {name}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  );
}

/**
 * A round handle on the order's edge, half in the gap beside an open panel: put that
 * panel away. Its chevron points the way the panel goes. 24px drawn, 40px to press. A
 * closed panel's way back is its rail.
 */
function EdgeHandle({
  side,
  label,
  controls,
  onClick,
}: {
  side: "left" | "right";
  label: string;
  controls: string;
  onClick: () => void;
}) {
  const Icon = side === "left" ? ChevronLeftIcon : ChevronRightIcon;
  return (
    <button
      type="button"
      aria-label={label}
      aria-expanded
      aria-controls={controls}
      onClick={onClick}
      className={cn(
        "absolute top-4 z-10 hidden size-6 items-center justify-center rounded-full border border-hairline bg-card text-muted-foreground shadow-raised transition-colors after:absolute after:-inset-2 after:content-[''] hover:bg-accent hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none lg:flex",
        side === "left" ? "-left-5" : "-right-5",
      )}
    >
      <Icon aria-hidden className="size-3.5" />
    </button>
  );
}

/* ─────────────────────────────────── items ─────────────────────────────────── */

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
    <Card className={cn(PANEL_CLASS, "min-w-0 gap-0 p-0")}>
      <div className={FRAMED_HEAD}>
        <h2 className="text-body-compact font-semibold">Items</h2>
        <span className="text-body-compact tabular-nums text-muted-foreground">
          {items.length} in this order
        </span>
      </div>
      <div className={cn(FRAMED_BODY, "flex min-w-0 flex-col gap-4")}>
        {items.length > 0 ? (
          <ol className="flex min-w-0 flex-col divide-y divide-hairline rounded-xl border border-hairline">
            {items.map((block, index) => {
              const gaps = blockGaps(block, context).filter(
                (gap) => gap.key !== "text",
              );
              const template = orderTemplate(block.type);
              const asks = template.fields.some((field) => !field.derived);
              return (
                <li
                  key={block.id}
                  className="flex min-h-12 min-w-0 items-center gap-2 py-1 pr-1 pl-3"
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
  /** In place of the line saying where its sentence goes — order screen E writes none. */
  description?: string;
}) {
  /* What was last open, kept while the dialog animates out — otherwise its title and
     fields vanish a beat before it does. */
  const [shown, setShown] = React.useState(editing);
  if (editing && editing !== shown) setShown(editing);
  const block = shown?.block;
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
              (shown?.mode === "edit"
                ? "The corrected sentence replaces this item's words in the order."
                : "Its sentence is written into the order once these are answered.")}
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
            <div className="flex min-w-0 flex-col gap-2 rounded-xl border border-hairline bg-surface-sunken p-4">
              <span className="text-body-compact font-medium text-muted-foreground">
                In the order
              </span>
              <p className="text-body text-pretty">
                <SentenceWithBlanks text={block.text} />
              </p>
            </div>
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
            disabled={gaps.length > 0}
            onClick={onConfirm}
          >
            {shown?.mode === "edit" ? "Save" : "Add to order"}
          </Button>
          {gaps.length > 0 ? (
            <Badge
              variant="warning"
              className="self-start tabular-nums sm:order-first sm:mr-auto sm:self-auto"
            >
              {gaps.length} to fill
            </Badge>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * The item's sentence with each unanswered part — written in brackets by the catalogue —
 * marked as a blank, so what is still missing reads at a glance. The brackets stay in the
 * text, so the meaning never rests on the tint alone.
 */
function SentenceWithBlanks({ text }: { text: string }) {
  return text.split(/(\[[^\]]+\])/).map((part, index) =>
    /^\[[^\]]+\]$/.test(part) ? (
      <span
        key={index}
        className="rounded-sm bg-warning-muted px-1 text-warning-muted-foreground [box-decoration-break:clone]"
      >
        {part}
      </span>
    ) : (
      part
    ),
  );
}
