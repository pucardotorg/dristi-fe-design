"use client";

import * as React from "react";
import Link from "next/link";
import { PanelRightIcon } from "lucide-react";
import { toast } from "sonner";

import { Identifier } from "@/components/chrome/identifier";
import {
  RichTextField,
  RichTextValueView,
  type RichTextSuggestion,
  type RichTextValue,
} from "@/components/cases/rich-text-field";
import {
  OrderShortcutsDialog,
  useShortcutSuggestion,
} from "@/components/employee/order-shortcuts-dialog";
import {
  ApplicationsSection,
  AttendanceSection,
  NextHearingSection,
  type ComposerApplication,
  type ComposerFact,
} from "@/components/employee/order-composer";
import { OrderCasePanel } from "@/components/employee/order-case-panel";
import {
  ItemDialog,
  ItemsCard,
} from "@/components/employee/order-text-composer";
import { OrderSaveIndicator } from "@/components/employee/order-save-indicator";
import { useOrderFlow } from "@/components/employee/use-order-flow";
import { useOrderSigning } from "@/components/employee/use-order-signing";
import { usePendingOrders } from "@/components/employee/use-pending-orders";
import { PANEL_CLASS } from "@/components/shell/panel";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  SegmentedControl,
  SegmentedControlItem,
} from "@/components/ui/segmented-control";
import { Separator } from "@/components/ui/separator";
import type { ListingApplicationDecision } from "@/lib/employee/listing-applications";
import {
  createItemBlock,
  type ComposerContext,
  type ItemBlock,
} from "@/lib/employee/order-composer";
import type { Appearance, OrderDraft } from "@/lib/employee/order-draft";
import {
  combinationConflict,
  orderTemplate,
  unavailableReason,
  type OrderTemplate,
  type OrderTemplateId,
} from "@/lib/employee/order-templates";
import {
  markOrderReady,
  returnOrderToDraft,
} from "@/lib/employee/order-signing";
import {
  moveOrderBackToDraft,
  noteOrderDraft,
  noteOrderTextEdited,
  pendingOrderHref,
  pendingOrderStage,
  sendOrderForSigning,
  type PendingOrderMeta,
  type PendingOrderStage,
} from "@/lib/employee/pending-orders";
import { cn } from "@/lib/utils";

/* ───────────────────────────────── the header ───────────────────────────────── */

/**
 * The order screen's head band, as version D draws it (owner, 2026-10-14: "keep the top
 * panel as it is"): the cause title, the listing's facts, the side panel's switch and the
 * way on.
 */
export function OrderEditorHeader({
  heading,
  facts,
  panelOpen,
  onPanelToggle,
  navAction,
}: {
  heading: string;
  facts: ComposerFact[];
  panelOpen?: boolean;
  /** Absent where the screen has no side panel to put away. */
  onPanelToggle?: () => void;
  navAction?: React.ReactNode;
}) {
  return (
    <header
      data-order-head=""
      className="sticky top-14 z-20 flex flex-col gap-3 border-b border-hairline bg-card px-6 py-4 sm:flex-row sm:items-start sm:justify-between md:px-8"
    >
      <div className="flex min-w-0 flex-col gap-2">
        <h1 className="min-w-0 text-title font-semibold text-balance">
          {heading}
        </h1>
        <div className="flex min-w-0 flex-wrap items-baseline gap-x-6 gap-y-1">
          {facts.map((fact) => (
            <p
              key={fact.label}
              className="flex min-w-0 items-baseline gap-2 text-body-compact"
            >
              <span className="text-muted-foreground">{fact.label}</span>
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
      </div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
{onPanelToggle ? (
        <Button
          type="button"
          variant="outline"
          aria-pressed={panelOpen}
          aria-controls="order-case-file"
          className="w-full shrink-0 aria-pressed:bg-accent-strong sm:w-fit"
          onClick={onPanelToggle}
        >
          <PanelRightIcon data-icon="inline-start" aria-hidden />
          Side panel
        </Button>
        ) : null}
        {navAction}
      </div>
    </header>
  );
}

/**
 * The heights of the sticky head and foot bands, as CSS variables on the root — so the
 * side panel and the editor's toolbar sit level under the head as the page scrolls.
 */
function useBands(rootRef: React.RefObject<HTMLDivElement | null>) {
  const [bands, setBands] = React.useState({ head: 0, foot: 0 });
  React.useEffect(() => {
    const root = rootRef.current;
    const head = root?.querySelector<HTMLElement>("header[data-order-head]");
    const foot = root?.querySelector<HTMLElement>("footer[data-order-foot]");
    if (!head || !foot) return;
    const measure = () =>
      setBands((current) =>
        current.head === head.offsetHeight && current.foot === foot.offsetHeight
          ? current
          : { head: head.offsetHeight, foot: foot.offsetHeight },
      );
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(head);
    observer.observe(foot);
    return () => observer.disconnect();
  }, [rootRef]);
  return {
    "--order-head-bottom": `calc(3.5rem + ${bands.head}px)`,
    "--order-panel-top": `calc(3.5rem + ${bands.head}px + 2rem)`,
    "--order-panel-fill": `calc(100svh - 3.5rem - ${bands.head}px - ${bands.foot}px - 2rem)`,
  } as React.CSSProperties;
}

/* ───────────────────────────────── the paper ────────────────────────────────── */

export type OrderPaperFrame = {
  /** The court, centred at the head of the page. */
  courtLine: string;
  /** Case number, cause title and the day. */
  subLine: string;
  /** Who signs, at the foot of the page. */
  signatory: string;
};

/* The page's own margins, shared by the fixed lines and the typed text so the three read
   as one column of one document. */
const PAGE_X = "px-6 md:px-12";

function PaperHead({ frame }: { frame: OrderPaperFrame }) {
  return (
    <div className={cn("flex flex-col pt-8 md:pt-12", PAGE_X)}>
      <div className="flex flex-col items-center gap-1 text-center">
        <p className="text-body-compact font-semibold">{frame.courtLine}</p>
        <p className="text-body-compact text-muted-foreground">
          {frame.subLine}
        </p>
      </div>
      <Separator className="mt-6 bg-hairline" />
    </div>
  );
}

function PaperFoot({
  frame,
  status = "Not signed",
}: {
  frame: OrderPaperFrame;
  status?: string;
}) {
  return (
    <div className={cn("pt-4 pb-8 md:pb-12", PAGE_X)}>
      <p className="text-right text-body-compact">
        {frame.signatory}
        <br />
        <span className="text-muted-foreground">{status}</span>
      </p>
    </div>
  );
}

/** The paper's frame: a lifted card at a document's width. */
const PAPER = cn(
  PANEL_CLASS,
  "mx-auto w-full max-w-4xl rounded-xl border bg-card text-card-foreground",
);

/**
 * The order as one page: the court's heading and the signature block are fixed — shown,
 * never typed into — and everything between them is the order's own rich text (owner,
 * 2026-10-14). The formatting toolbar rides at the top of the page and stays under the
 * head band as a long order scrolls.
 */
export function OrderPaperEditor({
  frame,
  value,
  onChange,
  revision,
  suggestion,
}: {
  frame: OrderPaperFrame;
  value: RichTextValue;
  onChange: (value: RichTextValue) => void;
  /** Bumped when the text is replaced from outside, so the editor re-reads it. */
  revision?: number;
  /** The `/` shortcuts (`order-shortcuts.ts`). */
  suggestion?: RichTextSuggestion;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-2">
      <span id="order-paper-label" className="sr-only">
        Order text
      </span>
      <RichTextField
        key={revision}
        value={value}
        onChange={onChange}
        labelId="order-paper-label"
        suggestion={suggestion}
        header={<PaperHead frame={frame} />}
        footer={<PaperFoot frame={frame} />}
        className={cn(
          PAPER,
          "border-hairline",
          /* The toolbar holds under the head band while the page scrolls. */
          "[&_[role=toolbar]]:sticky [&_[role=toolbar]]:top-(--order-head-bottom) [&_[role=toolbar]]:z-10 [&_[role=toolbar]]:rounded-t-xl [&_[role=toolbar]]:bg-card [&_[role=toolbar]]:px-3",
          /* The typed text on the page's margins, a paragraph's breath between lines. */
          "[&_[data-slot=input-group-control]]:min-h-[55svh] [&_[data-slot=input-group-control]]:px-6 [&_[data-slot=input-group-control]]:py-6 md:[&_[data-slot=input-group-control]]:px-12 [&_[data-slot=input-group-control]>*+*]:mt-4",
        )}
      />
    </div>
  );
}

/** The same page, read only — once drafting is finished, and beside the workflow. */
export function OrderPaperView({
  frame,
  value,
  status,
  className,
}: {
  frame: OrderPaperFrame;
  value: RichTextValue;
  status?: string;
  className?: string;
}) {
  return (
    <article aria-label="Order text" className={cn(PAPER, className)}>
      <PaperHead frame={frame} />
      {value.text.trim() ? (
        <RichTextValueView
          value={value}
          className={cn("py-6 text-body [&>*+*]:mt-4", PAGE_X)}
        />
      ) : (
        <p className={cn("py-6 text-body text-muted-foreground", PAGE_X)}>
          Nothing has been typed in this order.
        </p>
      )}
      <PaperFoot frame={frame} status={status} />
    </article>
  );
}

/* ─────────────────────────────── the progress ──────────────────────────────── */

/** What the signature block says under the signatory. */
export function paperStatus(stage: PendingOrderStage): string {
  if (stage === "drafting") return "Not signed";
  if (stage === "awaiting-signature") return "Sent for signing";
  return "Signed";
}

/**
 * Where an order stands, the same for every seat (owner, 2026-10-14: "transparency
 * between both users as to whether the order is signed and whether the workflows are
 * triggered"): its signature, then its workflows.
 */
export function OrderProgress({
  stage,
  workflowComplete,
}: {
  stage: PendingOrderStage;
  workflowComplete: boolean;
}) {
  const signed = stage === "workflow-to-fill" || stage === "triggered";
  const triggered = stage === "triggered";
  return (
    <ul
      aria-label="Where this order stands"
      className="flex flex-wrap items-center gap-x-6 gap-y-1 text-body-compact"
    >
      <li className="inline-flex items-center gap-2">
        <span className="text-muted-foreground">Signature</span>
        <Badge variant={signed ? "success" : "warning"}>
          {signed ? "Signed" : stage === "drafting" ? "Not sent" : "Awaiting"}
        </Badge>
      </li>
      <li className="inline-flex items-center gap-2">
        <span className="text-muted-foreground">Workflow</span>
        <Badge
          variant={
            triggered ? "success" : workflowComplete ? "info" : "secondary"
          }
        >
          {triggered ? "Triggered" : workflowComplete ? "Complete" : "To fill"}
        </Badge>
      </li>
    </ul>
  );
}

/* ─────────────────────────────── the workflow ──────────────────────────────── */

/**
 * The order's workflow details — who appeared, when the matter comes back, what was
 * decided on the applications — as version B's cards ask for them. They write to the
 * draft's record, never into the order's words: in E the text is the steno's alone.
 */
export function OrderWorkflowFields({
  draft,
  setDraft,
  today,
  appearances,
  applications,
  onOpenApplication,
  context,
  purpose,
  inHearing,
  fixedIds = [],
  disabled = false,
}: {
  draft: OrderDraft;
  setDraft: (update: (current: OrderDraft) => OrderDraft) => void;
  today: string;
  /** A hearing's roll; absent outside a hearing. */
  appearances?: Appearance[];
  applications?: ComposerApplication[];
  onOpenApplication?: (id: string) => void;
  /** The matter the catalogue's items are filled against. */
  context: ComposerContext;
  /** The hearing's purpose, for the items likely at it. */
  purpose?: string;
  inHearing: boolean;
  /** Items the act that opened the order loaded and that cannot be removed. */
  fixedIds?: readonly string[];
  disabled?: boolean;
}) {
  const [editing, setEditing] = React.useState<{
    block: ItemBlock;
    mode: "add" | "edit";
  } | null>(null);
  const items = draft.blocks.filter(
    (block): block is ItemBlock => block.kind === "item",
  );

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

  /* Items are the order's workflow, as the catalogue defines them: each carries its own
     fields and what it sets moving once the order is signed. In E they are recorded here
     and never written into the text — the words are the steno's (owner, 2026-10-14). */
  function commit(block: ItemBlock, mode: "add" | "edit") {
    setDraft((current) => ({
      ...current,
      blocks:
        mode === "add"
          ? [...current.blocks, block]
          : current.blocks.map((entry) => (entry.id === block.id ? block : entry)),
    }));
  }

  function choose(type: OrderTemplateId) {
    const block = createItemBlock(type, context);
    const asks = orderTemplate(type).fields.some((field) => !field.derived);
    if (asks) setEditing({ block, mode: "add" });
    else commit(block, "add");
  }

  return (
    <div className="flex min-w-0 flex-col gap-6">
      {appearances ? (
        <Card className={cn(PANEL_CLASS, "min-w-0 gap-0 p-0")}>
          <AttendanceSection
            attendance={{
              appearances,
              marks: draft.marks,
              onMark: (id, mark) =>
                setDraft((current) => ({
                  ...current,
                  marks: { ...current.marks, [id]: mark },
                })),
              onMarkAllPresent: () =>
                setDraft((current) => ({
                  ...current,
                  marks: Object.fromEntries(
                    appearances.map((appearance) => [
                      appearance.id,
                      current.marks[appearance.id] ?? "present",
                    ]),
                  ),
                })),
            }}
            disabled={disabled}
            framed
          />
        </Card>
      ) : null}

      <Card className={cn(PANEL_CLASS, "min-w-0 gap-0 p-0")}>
        <NextHearingSection
          nextHearing={{
            next: draft.next,
            purpose: draft.nextPurpose,
            date: draft.nextDate,
            onChange: (change) =>
              setDraft((current) => ({
                ...current,
                next: change.next ?? current.next,
                nextPurpose:
                  change.purpose !== undefined
                    ? change.purpose
                    : current.nextPurpose,
                nextDate:
                  change.date !== undefined ? change.date : current.nextDate,
              })),
          }}
          today={today}
          disabled={disabled}
          framed
        />
      </Card>

      {applications && applications.length > 0 ? (
        <Card className={cn(PANEL_CLASS, "min-w-0 gap-0 p-0")}>
          <ApplicationsSection
            applications={{
              list: applications,
              onDecide: (id, decision) => decideOnly(setDraft, id, decision),
              onOpen: (id) => onOpenApplication?.(id),
            }}
            disabled={disabled}
            framed
          />
        </Card>
      ) : null}

      <ItemsCard
        items={items}
        context={context}
        purpose={purpose}
        fixedIds={fixedIds}
        disabled={disabled}
        reasonFor={reasonFor}
        onChoose={choose}
        onEdit={(block) => setEditing({ block, mode: "edit" })}
        onRemove={(block) =>
          setDraft((current) => ({
            ...current,
            blocks: current.blocks.filter((entry) => entry.id !== block.id),
          }))
        }
      />

      <ItemDialog
        editing={editing}
        context={context}
        today={today}
        onChange={(block) =>
          setEditing((current) => (current ? { ...current, block } : current))
        }
        onClose={() => setEditing(null)}
        description="Recorded in this order's workflow, and set moving once the order is signed and its workflow complete. Nothing is written into the order's text."
        onConfirm={() => {
          if (!editing) return;
          commit(editing.block, editing.mode);
          setEditing(null);
        }}
      />
    </div>
  );
}

/** Record an application's decision — the record only; E's words are the steno's. */
export function decideOnly(
  setDraft: (update: (current: OrderDraft) => OrderDraft) => void,
  id: string,
  decision: ListingApplicationDecision | null,
) {
  setDraft((current) => ({
    ...current,
    applications: { ...current.applications, [id]: decision ?? undefined },
  }));
}

/* ─────────────────────────────── version E ─────────────────────────────────── */

type EditorView = "order" | "workflow";

/**
 * Version E of the order screen — the order as one full-page document (owner,
 * 2026-10-14). D's head band and side panel (the case file and its history); between
 * them, the page: a fixed heading and signature block with the order's rich text in
 * between. A switch above the page turns it to the order's workflow — attendance, the
 * next date, the applications — for a steno who would rather enter those than type.
 *
 * Drafting ends with **Send for signing**: the order goes to the magistrate in Pending
 * orders (`pending-orders.ts`). Its workflow can be filled here at any time, and is
 * triggered from Pending orders once the order is signed.
 */
export function OrderEditorComposer({
  queue,
  heading,
  facts,
  navAction,
  frame,
  today,
  draft,
  setDraft,
  appearances,
  applications,
  onOpenApplication,
  applicationDialog,
  overview,
  overviewContent,
  historyContent,
  context,
  purpose,
  fixedIds,
}: {
  /** The matter, for the catalogue's items in the workflow. */
  context: ComposerContext;
  purpose?: string;
  fixedIds?: readonly string[];
  /** What the steno's queue lists this order as, less where it is typed. */
  queue: Omit<PendingOrderMeta, "orderHref">;
  heading: string;
  facts: ComposerFact[];
  navAction: React.ReactNode;
  frame: OrderPaperFrame;
  today: string;
  draft: OrderDraft;
  setDraft: (update: (current: OrderDraft) => OrderDraft) => void;
  appearances?: Appearance[];
  applications?: ComposerApplication[];
  onOpenApplication?: (id: string) => void;
  applicationDialog?: (
    decide: (id: string, decision: ListingApplicationDecision | null) => void,
  ) => React.ReactNode;
  overview: { label: string; value: string }[];
  overviewContent?: React.ReactNode;
  historyContent?: React.ReactNode;
}) {
  const rootRef = React.useRef<HTMLDivElement>(null);
  const bands = useBands(rootRef);
  const [panelOpen, setPanelOpen] = React.useState(true);
  const [view, setView] = React.useState<EditorView>("order");
  const [askOpen, setAskOpen] = React.useState(false);
  const [shortcutsOpen, setShortcutsOpen] = React.useState(false);
  const shortcuts = useShortcutSuggestion();
  const pending = usePendingOrders();
  const signing = useOrderSigning();
  const [flow] = useOrderFlow();
  const entry = pending[queue.key];
  const stage = entry ? pendingOrderStage(entry, signing) : "drafting";
  const finished = stage !== "drafting";
  const body: RichTextValue = draft.body ?? { html: "", text: "" };
  const empty = body.text.trim().length === 0;
  const { key, heading: queueHeading, caseNumber, origin } = queue;

  /* Once there are words, the order is in Pending orders — every order, a hearing's or
     not (owner, 2026-10-14). */
  React.useEffect(() => {
    if (empty) return;
    noteOrderDraft({
      key,
      heading: queueHeading,
      caseNumber,
      origin,
      orderHref: window.location.pathname + window.location.search,
    });
  }, [empty, key, queueHeading, caseNumber, origin]);

  function finish() {
    if (empty) {
      setView("order");
      toast("Type the order before sending it for signing.");
      return;
    }
    sendOrderForSigning({
      ...queue,
      orderHref: window.location.pathname + window.location.search,
    });
    markOrderReady(queue.key);
    toast(
      flow === "pending"
        ? "Sent for signing. It is in Pending orders, awaiting the magistrate."
        : "Sent for signing. It is on the signing list.",
    );
  }

  return (
    <div
      ref={rootRef}
      className="flex min-h-0 min-w-0 flex-1 flex-col"
      style={bands}
    >
      <OrderEditorHeader
        heading={heading}
        facts={facts}
        panelOpen={view === "order" && panelOpen}
        onPanelToggle={() => {
          /* In Workflow the right is the workflow's; the case file comes back with the
             order view. */
          if (view === "workflow") {
            setView("order");
            setPanelOpen(true);
          } else setPanelOpen((open) => !open);
        }}
        navAction={navAction}
      />

      <div
        className={cn(
          "grid min-w-0 flex-1 items-start gap-6 bg-muted p-6 md:p-8 lg:pb-0 dark:bg-background",
          /* Workflow: the order stays where it was, read only, and the workflow takes
             the right — the main work, so the wider share (owner, 2026-10-14). */
          view === "workflow"
            ? "lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] 2xl:grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)]"
            : panelOpen &&
                "lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)] xl:grid-cols-[minmax(0,1fr)_24rem] 2xl:grid-cols-[minmax(0,1fr)_28rem]",
        )}
      >
        <div className="flex min-w-0 flex-col gap-4 lg:pb-8">
          <div className="mx-auto flex w-full max-w-4xl items-center justify-between gap-4">
            <SegmentedControl
              type="single"
              size="compact"
              value={view}
              onValueChange={(next) => {
                if (next === "order" || next === "workflow") setView(next);
              }}
              aria-label="What to work on"
            >
              <SegmentedControlItem value="order">Order</SegmentedControlItem>
              <SegmentedControlItem value="workflow">
                Workflow
              </SegmentedControlItem>
            </SegmentedControl>
            {finished ? (
              <OrderProgress
                stage={stage}
                workflowComplete={Boolean(entry?.workflowComplete)}
              />
            ) : view === "order" ? (
              <div className="flex items-center gap-3">
                <span className="hidden text-body-compact text-muted-foreground sm:inline">
                  Type <kbd className="font-mono">/</kbd> for a shortcut
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setShortcutsOpen(true)}
                >
                  Shortcuts
                </Button>
              </div>
            ) : null}
          </div>

          {view === "workflow" || finished ? (
            <OrderPaperView
              frame={frame}
              value={body}
              status={paperStatus(stage)}
            />
          ) : (
            <OrderPaperEditor
              frame={frame}
              value={body}
              onChange={(value) => {
                setDraft((current) => ({ ...current, body: value }));
                /* Edited after its workflow was completed: the workflow goes back to
                   incomplete (owner, 2026-10-14). */
                noteOrderTextEdited(queue.key);
              }}
              suggestion={shortcuts}
            />
          )}
        </div>

        {view === "workflow" ? (
          <div className="min-w-0 lg:pb-8">
            <OrderWorkflowFields
              draft={draft}
              setDraft={setDraft}
              today={today}
              appearances={appearances}
              applications={applications}
              onOpenApplication={onOpenApplication}
              context={context}
              purpose={purpose}
              inHearing={Boolean(appearances)}
              fixedIds={fixedIds}
              disabled={stage === "triggered" || Boolean(entry?.workflowComplete)}
            />
          </div>
        ) : panelOpen ? (
          <OrderCasePanel
            className="lg:sticky lg:top-(--order-panel-top) lg:h-(--order-panel-fill) lg:rounded-b-none lg:border-b-0"
            overview={overview}
            links={draft.links}
            onLinksChange={(links) =>
              setDraft((current) => ({ ...current, links }))
            }
            disabled={false}
            overviewContent={overviewContent}
            historyContent={historyContent}
          />
        ) : null}
      </div>

      <footer
        data-order-foot=""
        className="sticky bottom-0 z-30 border-t border-hairline bg-card px-6 py-3 md:px-8 md:py-4"
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
          <div className="flex min-h-10 items-center">
            {finished && flow === "pending" ? (
              <Button asChild variant="link" className="-ml-3">
                <Link href={pendingOrderHref(queue.key)}>
                  Open in Pending orders
                </Link>
              </Button>
            ) : null}
          </div>
          {stage === "awaiting-signature" ? (
            /* Not signed yet: it can come back to be edited further (owner,
               2026-10-14). */
            <Button
              type="button"
              variant="outline"
              className="w-full sm:w-fit"
              onClick={() => {
                moveOrderBackToDraft(queue.key, signing);
                returnOrderToDraft(queue.key);
                setView("order");
                toast(
                  "Back to draft. Send it for signing again when it is ready.",
                );
              }}
            >
              Move back to draft
            </Button>
          ) : null}
          {finished ? null : (
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <OrderSaveIndicator />
              <Button
                type="button"
                className="w-full sm:w-fit"
                onClick={() => {
                  if (empty) {
                    finish();
                    return;
                  }
                  setAskOpen(true);
                }}
              >
                Send for signing
              </Button>
            </div>
          )}
        </div>
      </footer>

      <AlertDialog open={askOpen} onOpenChange={setAskOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Send this order for signing?</AlertDialogTitle>
            <AlertDialogDescription>
              It goes to the magistrate
              {flow === "pending" ? " in Pending orders" : " for signing"}. Until it is signed
              it can be moved back to draft and edited. Its workflows go out
              once it is signed and its workflow is marked complete.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Back</AlertDialogCancel>
            <AlertDialogAction onClick={() => finish()}>
              Send for signing
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <OrderShortcutsDialog
        open={shortcutsOpen}
        onOpenChange={setShortcutsOpen}
      />

      {applicationDialog?.((id, decision) => decideOnly(setDraft, id, decision))}
    </div>
  );
}
