"use client";

import * as React from "react";
import {
  ArrowRightIcon,
  CheckIcon,
  CircleCheckIcon,
  PanelRightIcon,
  PlusIcon,
  XIcon,
} from "lucide-react";

import { Identifier } from "@/components/chrome/identifier";
import {
  StagedOverlay,
  useStagedFlow,
} from "@/components/chrome/staged-overlay";
import { DocumentPreview } from "@/components/cases/document-preview";
import { OrderBlockCard } from "@/components/employee/order-block-card";
import {
  OrderCasePanel,
  type PanelApplication,
} from "@/components/employee/order-case-panel";
import { OrderDraftFacsimile } from "@/components/employee/order-draft-facsimile";
import { OrderDatePicker } from "@/components/employee/order-item-fields";
import {
  OrderItemPicker,
  type PickerChoice,
} from "@/components/employee/order-item-picker";
import { OrderSaveIndicator } from "@/components/employee/order-save-indicator";
import {
  SIGN_SCENES,
  SIGN_STAGES,
  SignatureActions,
  SignatureStage,
  type SignStage,
} from "@/components/employee/sign-method-stage";
import { useSignatureChoice } from "@/components/employee/sign-signature-fields";
import { PANEL_CLASS } from "@/components/shell/panel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  SegmentedControl,
  SegmentedControlItem,
} from "@/components/ui/segmented-control";
import { Separator } from "@/components/ui/separator";
import {
  COURT_HEARING_PURPOSES,
  courtHearingPurposeLabel,
  formatListingDate,
  type CourtHearingPurposeId,
} from "@/lib/employee/hearings";
import type { ListingApplicationDecision } from "@/lib/employee/listing-applications";
import {
  blockGaps,
  blockLabel,
  blockSummary,
  changeBlockType,
  createItemBlock,
  createTextBlock,
  moveBlock,
  resetItemText,
  setItemRecipients,
  setItemText,
  setItemValue,
  type ComposerBlock,
  type ComposerContext,
} from "@/lib/employee/order-composer";
import type {
  Appearance,
  AttendanceMark,
  NextListingChoice,
  OrderDocument,
} from "@/lib/employee/order-draft";
import {
  combinationConflict,
  orderTemplate,
  unavailableReason,
  type OrderTemplate,
} from "@/lib/employee/order-templates";
import { cn } from "@/lib/utils";

export type ComposerFact = {
  label: string;
  value: string;
  identifier?: boolean;
};

/** The hearing's roll, when the order belongs to a hearing (`ATT-01`–`ATT-05`). */
export type ComposerAttendance = {
  appearances: Appearance[];
  marks: Readonly<Record<string, AttendanceMark | undefined>>;
  onMark: (id: string, mark: AttendanceMark | undefined) => void;
  onMarkAllPresent: () => void;
};

/** An application standing on the matter, with how it was decided (`APL-01`). */
export type ComposerApplication = {
  id: string;
  number: string;
  type: string;
  filed: string;
  decision: ListingApplicationDecision | undefined;
};

export type ComposerApplications = {
  list: ComposerApplication[];
  onDecide: (id: string, decision: ListingApplicationDecision | null) => void;
  onOpen: (id: string) => void;
};

/** Where the matter is posted to, when the order belongs to a hearing (`NXT-01`–`NXT-03`). */
export type ComposerNextHearing = {
  next: NextListingChoice;
  purpose: CourtHearingPurposeId | "";
  date: string | null;
  onChange: (change: {
    next?: NextListingChoice;
    purpose?: CourtHearingPurposeId | "";
    date?: string | null;
  }) => void;
};

/**
 * The order composer — one screen for every order (`ORD-08`), opened from a hearing or
 * from outside one.
 *
 * **Abhirami's screen** (v14, owner's pick 2026-10-12) for everything around the order:
 * the header with the case's name, its facts, the **Case file** toggle and the way on to
 * the next case; the **This order** index on the left; the order as one page in the middle;
 * the case file on the right. **Varun's block** for the order itself: each block a proper
 * block, an order item's fields on top and its text below, loosely coupled
 * (`order-composer.ts`).
 *
 * **Two versions, one screen.** An order tied to a hearing carries **Attendance** and
 * **Next hearing**; one raised outside a hearing carries neither, and sets a date through
 * the *Scheduling of hearing date* order item instead (`ORD-08`, `ORD-09`).
 *
 * The footer is the owner's own (2026-09-26): Saved, **Preview** with Sign now inside it,
 * and **Add to signing list**, which waits until nothing is left to fill (`SGN-04`). An
 * order on the signing list is not editable until it is moved back to draft (`SGN-05`).
 * Nothing here files, signs for real, or notifies.
 */
export function OrderComposer({
  heading,
  facts,
  courtLine,
  subLine,
  navAction,
  context,
  today,
  purpose,
  inHearing,
  blocks,
  onBlocks,
  fixedIds = [],
  links,
  onLinks,
  attendance,
  applications,
  nextHearing,
  overview,
  panelApplications,
  document,
  notice,
}: {
  heading: string;
  facts: ComposerFact[];
  courtLine: string;
  subLine: string;
  navAction: React.ReactNode;
  context: ComposerContext;
  today: string;
  purpose?: string;
  inHearing: boolean;
  blocks: readonly ComposerBlock[];
  onBlocks: (
    update: (blocks: readonly ComposerBlock[]) => readonly ComposerBlock[],
  ) => void;
  fixedIds?: readonly string[];
  links: readonly string[];
  onLinks: (links: string[]) => void;
  attendance?: ComposerAttendance;
  applications?: ComposerApplications;
  nextHearing?: ComposerNextHearing;
  overview: { label: string; value: string }[];
  panelApplications?: PanelApplication[];
  document: OrderDocument;
  /** A line under the header — what the act that opened the order does, say. */
  notice?: React.ReactNode;
}) {
  const [panelOpen, setPanelOpen] = React.useState(true);
  const [view, setView] = React.useState<PageView>("drafting");
  const [pickerOpen, setPickerOpen] = React.useState(false);
  const [signingStatus, setSigningStatus] =
    React.useState<SigningStatus>("draft");
  const [removed, setRemoved] = React.useState<{
    block: ComposerBlock;
    index: number;
  } | null>(null);
  const [announcement, setAnnouncement] = React.useState("");
  const locked = signingStatus !== "draft";

  /* ── what is left to do ─────────────────────────────────────────────────────── */

  const blockRows = blocks.map((block, index) => ({
    block,
    index,
    gaps: blockGaps(block, context),
  }));
  const unmarked = attendance
    ? attendance.appearances.filter(
        (appearance) => !attendance.marks[appearance.id],
      )
    : [];
  const posting = nextHearing
    ? nextHearing.next === "none"
      ? "settled"
      : nextHearing.date && nextHearing.purpose
        ? "settled"
        : "open"
    : null;
  /* Attendance and applications never hold the order back (`ATT-05`, `APL-12`); the
     posting is half an answer until both halves are given (`NXT-02`); a block's gaps are
     what the workflow behind it needs (`VAR-06`, `VAR-11`). */
  const firstGap =
    blockRows.find((row) => row.gaps.length > 0)?.block.id ?? null;
  const toFill =
    blockRows.reduce((sum, row) => sum + row.gaps.length, 0) +
    (posting === "open" ? 1 : 0);
  const written = document.paragraphs.length > 0;
  const ready = toFill === 0 && written;

  /* ── changing blocks ────────────────────────────────────────────────────────── */

  function reasonFor(
    template: OrderTemplate,
    replacing?: string,
  ): string | null {
    const others = blocks
      .filter((block) => block.id !== replacing && block.kind === "item")
      .map((block) =>
        block.kind === "item"
          ? { type: block.type, applicationId: block.applicationId }
          : null,
      )
      .filter((entry) => entry !== null);
    return (
      unavailableReason(template, { hearingOngoing: inHearing }) ??
      combinationConflict(template.id, others)
    );
  }

  function focusBlock(id: string) {
    /* After React has put the block on the page. */
    requestAnimationFrame(() => {
      const node = window.document.getElementById(`block-${id}`);
      node?.scrollIntoView({
        block: "center",
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
          ? "auto"
          : "smooth",
      });
      const first = node?.querySelector<HTMLElement>(
        "input:not([disabled]), textarea:not([disabled]), button[role=radio]:not([disabled]), [data-slot=segmented-control-item]:not([disabled]), [data-slot=select-trigger]:not([disabled])",
      );
      (first ?? node)?.focus({ preventScroll: true });
    });
  }

  function update(id: string, change: (block: ComposerBlock) => ComposerBlock) {
    onBlocks((current) =>
      current.map((block) => (block.id === id ? change(block) : block)),
    );
  }

  function add(choice: PickerChoice) {
    const block =
      choice === "text" ? createTextBlock() : createItemBlock(choice, context);
    onBlocks((current) => [...current, block]);
    setRemoved(null);
    setAnnouncement(`${blockLabel(block)} added at the end of the order.`);
    focusBlock(block.id);
  }

  function remove(index: number) {
    const block = blocks[index];
    onBlocks((current) => current.filter((entry) => entry.id !== block.id));
    setRemoved({ block, index });
    setAnnouncement(`${blockLabel(block)} removed. Undo is in the footer.`);
  }

  function undoRemove() {
    if (!removed) return;
    const { block, index } = removed;
    onBlocks((current) => [
      ...current.slice(0, index),
      block,
      ...current.slice(index),
    ]);
    setRemoved(null);
    setAnnouncement(`${blockLabel(block)} is back in the order.`);
    focusBlock(block.id);
  }

  function jumpTo(id: string) {
    const node = window.document.getElementById(id);
    if (!node) return;
    node.scrollIntoView({
      block: "center",
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "auto"
        : "smooth",
    });
    node.focus({ preventScroll: true });
  }

  /* ── the index ──────────────────────────────────────────────────────────────── */

  const indexRows: IndexRow[] = [];
  if (attendance) {
    const marked = attendance.appearances.length - unmarked.length;
    const present = attendance.appearances.filter(
      (appearance) => attendance.marks[appearance.id] === "present",
    ).length;
    indexRows.push({
      target: "order-attendance",
      state: marked === 0 ? "open" : unmarked.length > 0 ? "open" : "done",
      title: "Attendance",
      detail:
        marked === 0
          ? "Not marked"
          : unmarked.length > 0
            ? `${unmarked.length} not marked`
            : `${present} present, ${attendance.appearances.length - present} absent`,
    });
  }
  for (const application of applications?.list ?? []) {
    indexRows.push({
      target: `order-application-${application.id}`,
      state: application.decision ? "done" : "open",
      title: `${application.type} · ${application.number}`,
      detail:
        application.decision === "allowed"
          ? "Accepted"
          : application.decision === "dismissed"
            ? "Rejected"
            : "Pending",
    });
  }
  let itemNumber = 0;
  for (const row of blockRows) {
    const numbered = row.block.kind === "item" ? `${++itemNumber}. ` : "";
    indexRows.push({
      target: `block-${row.block.id}`,
      state: row.gaps.length > 0 ? "todo" : "done",
      title: `${numbered}${blockLabel(row.block)}`,
      detail:
        row.gaps.length > 0
          ? `${row.gaps.length} to fill`
          : blockSummary(row.block, context),
    });
  }
  if (nextHearing) {
    indexRows.push({
      target: "order-next-hearing",
      state: posting === "open" ? "todo" : "done",
      title: "Next hearing",
      detail:
        nextHearing.next === "none"
          ? "Not listed again"
          : posting === "settled" && nextHearing.date && nextHearing.purpose
            ? `${formatListingDate(nextHearing.date)} · ${courtHearingPurposeLabel(nextHearing.purpose)}`
            : !nextHearing.date && !nextHearing.purpose
              ? "Date and purpose not set"
              : !nextHearing.date
                ? "Date not set"
                : "Purpose not set",
    });
  }

  /* ── layout ─────────────────────────────────────────────────────────────────── */

  const headerRef = React.useRef<HTMLElement | null>(null);
  const footerRef = React.useRef<HTMLElement | null>(null);
  const [bands, setBands] = React.useState({ header: 0, footer: 0 });
  React.useEffect(() => {
    const header = headerRef.current;
    const footer = footerRef.current;
    if (!header || !footer) return;
    const measure = () => {
      const next = { header: header.offsetHeight, footer: footer.offsetHeight };
      setBands((current) =>
        current.header === next.header && current.footer === next.footer
          ? current
          : next,
      );
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(header);
    observer.observe(footer);
    return () => observer.disconnect();
  }, []);

  const addRow = locked ? null : (
    <div className="flex flex-wrap items-center gap-2">
      <Button type="button" variant="outline" onClick={() => add("text")}>
        <PlusIcon data-icon="inline-start" aria-hidden />
        Text
      </Button>
      <OrderItemPicker
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        purpose={purpose}
        reasonFor={(template) => reasonFor(template)}
        onChoose={add}
        trigger={
          <Button type="button" variant="outline">
            <PlusIcon data-icon="inline-start" aria-hidden />
            Order item
          </Button>
        }
      />
    </div>
  );

  return (
    <div
      className="flex min-h-0 min-w-0 flex-1 flex-col"
      style={
        {
          "--order-panel-top": `calc(3.5rem + ${bands.header}px + 2rem)`,
          "--order-panel-height": `calc(100svh - 3.5rem - ${bands.header}px - ${bands.footer}px - 4rem)`,
        } as React.CSSProperties
      }
    >
      {/* The case and the way on — Abhirami's header. `top-14`: the chrome's own bar is
          `sticky top-0` and 3.5rem tall, so this comes to rest under it. */}
      <header
        ref={headerRef}
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
          {notice}
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <Button
            type="button"
            variant="outline"
            aria-pressed={panelOpen}
            aria-controls="order-case-file"
            className="w-full shrink-0 aria-pressed:bg-accent-strong sm:w-fit"
            onClick={() => setPanelOpen((open) => !open)}
          >
            <PanelRightIcon data-icon="inline-start" aria-hidden />
            Case file
          </Button>
          {navAction}
        </div>
      </header>

      <div
        className={cn(
          "grid min-w-0 flex-1 items-start gap-6 bg-muted p-6 md:p-8 dark:bg-background",
          panelOpen
            ? "lg:grid-cols-[minmax(0,13rem)_minmax(0,1fr)_minmax(0,20rem)] xl:grid-cols-[14rem_minmax(0,1fr)_22rem] 2xl:grid-cols-[16rem_minmax(0,1fr)_24rem]"
            : "lg:grid-cols-[minmax(0,15rem)_minmax(0,1fr)]",
        )}
      >
        <OrderIndex
          className="order-2 lg:sticky lg:top-(--order-panel-top) lg:order-none lg:max-h-(--order-panel-height) lg:overflow-y-auto"
          rows={indexRows}
          toFill={toFill}
          onJump={jumpTo}
        />

        <article
          aria-label="Order"
          className={cn(
            PANEL_CLASS,
            "flex min-w-0 flex-col gap-8 rounded-xl border bg-card p-6 text-card-foreground md:p-8",
          )}
        >
          <PageViewSwitch value={view} onChange={setView} />
          {view === "preview" ? (
            <OrderDraftFacsimile document={document} />
          ) : (
            <>
              <header className="flex flex-col items-center gap-1 text-center">
                <p className="text-body-compact font-semibold">{courtLine}</p>
                <p className="text-body-compact text-muted-foreground">
                  {subLine}
                </p>
              </header>

              {attendance ? (
                <>
                  <Separator className="bg-hairline" />
                  <AttendanceSection
                    attendance={attendance}
                    disabled={locked}
                  />
                </>
              ) : null}

              {applications && applications.list.length > 0 ? (
                <>
                  <Separator className="bg-hairline" />
                  <ApplicationsSection
                    applications={applications}
                    disabled={locked}
                  />
                </>
              ) : null}

              <Separator className="bg-hairline" />
              <section
                aria-labelledby="order-blocks"
                className="flex min-w-0 flex-col gap-4"
              >
                <h2
                  id="order-blocks"
                  className="text-body-compact font-semibold"
                >
                  Order
                </h2>
                {blocks.length === 0 ? (
                  <p className="text-body-compact text-muted-foreground">
                    Nothing in the order yet. Add text, or an order item from
                    the catalogue.
                  </p>
                ) : (
                  <div className="flex min-w-0 flex-col gap-4">
                    {blocks.map((block, index) => (
                      <OrderBlockCard
                        key={block.id}
                        block={block}
                        index={index}
                        count={blocks.length}
                        context={context}
                        today={today}
                        purpose={purpose}
                        fixed={fixedIds.includes(block.id)}
                        disabled={locked}
                        reasonFor={reasonFor}
                        onChangeType={(choice) => {
                          update(block.id, (current) =>
                            changeBlockType(current, choice, context),
                          );
                          setAnnouncement(
                            `This block is now ${choice === "text" ? "text" : orderTemplate(choice).label}.`,
                          );
                        }}
                        onMove={(by) => {
                          onBlocks((current) => moveBlock(current, index, by));
                          setAnnouncement(
                            `${blockLabel(block)} moved ${by < 0 ? "up" : "down"}.`,
                          );
                        }}
                        onRemove={() => remove(index)}
                        onText={(text) =>
                          update(block.id, (current) =>
                            current.kind === "text"
                              ? { ...current, text }
                              : setItemText(current, text, context),
                          )
                        }
                        onResetText={() =>
                          update(block.id, (current) =>
                            current.kind === "item"
                              ? resetItemText(current, context)
                              : current,
                          )
                        }
                        onValue={(key, value) =>
                          update(block.id, (current) =>
                            current.kind === "item"
                              ? setItemValue(current, key, value, context)
                              : current,
                          )
                        }
                        onRecipients={(recipients) =>
                          update(block.id, (current) =>
                            current.kind === "item"
                              ? setItemRecipients(current, recipients, context)
                              : current,
                          )
                        }
                      />
                    ))}
                  </div>
                )}
                {addRow}
              </section>

              {nextHearing ? (
                <>
                  <Separator className="bg-hairline" />
                  <NextHearingSection
                    nextHearing={nextHearing}
                    today={today}
                    disabled={locked}
                  />
                </>
              ) : null}
            </>
          )}
        </article>

        {panelOpen ? (
          <OrderCasePanel
            className="order-3 lg:sticky lg:top-(--order-panel-top) lg:order-none lg:h-(--order-panel-height)"
            overview={overview}
            applications={panelApplications}
            links={links}
            onLinksChange={onLinks}
            disabled={locked}
          />
        ) : null}
      </div>

      <OrderFooter
        footerRef={footerRef}
        signingStatus={signingStatus}
        onSigningStatus={(status, message) => {
          setSigningStatus(status);
          setAnnouncement(message);
        }}
        toFill={toFill}
        ready={ready}
        onJumpToGap={() =>
          firstGap ? focusBlock(firstGap) : jumpTo("order-next-hearing")
        }
        undo={
          removed && !locked
            ? {
                label: `${blockLabel(removed.block)} removed.`,
                onUndo: undoRemove,
              }
            : null
        }
        document={document}
      />

      <p aria-live="polite" className="sr-only">
        {announcement}
      </p>
    </div>
  );
}

/* ──────────────────────────── drafting or preview ──────────────────────────── */

export type PageView = "drafting" | "preview";

/**
 * **Drafting | Preview order** — Abhirami's switch at the head of the order page (owner,
 * 2026-10-12, for both versions). Preview order is the paper as it will print, read in
 * place; the footer's Preview still opens it with Sign now beside it.
 */
export function PageViewSwitch({
  value,
  onChange,
}: {
  value: PageView;
  onChange: (view: PageView) => void;
}) {
  return (
    <SegmentedControl
      type="single"
      aria-label="View"
      value={value}
      onValueChange={(next) => {
        if (next) onChange(next as PageView);
      }}
      className="self-start"
    >
      <SegmentedControlItem value="drafting">Drafting</SegmentedControlItem>
      <SegmentedControlItem value="preview">Preview order</SegmentedControlItem>
    </SegmentedControl>
  );
}

/* ───────────────────────────────── the footer ──────────────────────────────── */

export type SigningStatus = "draft" | "added" | "signed";

/**
 * The composer's footer — the owner's own (2026-09-26), shared by versions A and B so the
 * two are compared on how the order is written and never on how it is sent.
 *
 * Left: what is left to fill, as a jump to the first gap, or Ready to sign; and the Undo
 * for a removal. Right: Saved, **Preview** (the order as paper, with Sign now in it —
 * `PRV-04`), and **Add to signing list**, which waits until nothing is left to fill
 * (`SGN-04`). An order on the list is moved back to draft before it is edited again
 * (`SGN-05`).
 */
export function OrderFooter({
  footerRef,
  signingStatus,
  onSigningStatus,
  toFill,
  ready,
  onJumpToGap,
  undo,
  document,
}: {
  footerRef?: React.Ref<HTMLElement>;
  signingStatus: SigningStatus;
  onSigningStatus: (status: SigningStatus, announcement: string) => void;
  toFill: number;
  ready: boolean;
  onJumpToGap: () => void;
  undo: { label: string; onUndo: () => void } | null;
  document: OrderDocument;
}) {
  const [signOpen, setSignOpen] = React.useState(false);
  const previewRef = React.useRef<HTMLButtonElement>(null);
  const signature = useSignatureChoice("order");
  const signFlow = useStagedFlow<SignStage>({
    order: SIGN_STAGES,
    scene: SIGN_SCENES,
  });
  const locked = signingStatus !== "draft";

  function openPreview() {
    signFlow.go("read");
    signature.reset();
    setSignOpen(true);
  }

  return (
    <>
      <footer
        ref={footerRef}
        className="sticky bottom-0 z-30 border-t border-hairline bg-card px-6 py-3 md:px-8 md:py-4"
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
          <div className="flex min-h-10 min-w-0 flex-wrap items-center gap-x-4 gap-y-1">
            {locked ? (
              <span className="inline-flex items-center gap-1.5 text-body-compact font-medium text-success-ink">
                <CircleCheckIcon className="size-4" aria-hidden />
                {signingStatus === "signed"
                  ? "Signed for this sitting"
                  : "On the signing list"}
              </span>
            ) : ready ? (
              <span className="inline-flex items-center gap-1.5 text-body-compact font-medium text-success-ink">
                <CheckIcon className="size-4" aria-hidden />
                Ready to sign
              </span>
            ) : toFill > 0 ? (
              <Button
                type="button"
                variant="ghost"
                className="-ml-3 text-body-compact font-medium text-warning-ink hover:text-warning-ink"
                onClick={onJumpToGap}
              >
                {toFill} to fill
                <ArrowRightIcon data-icon="inline-end" aria-hidden />
              </Button>
            ) : (
              <span className="text-body-compact text-muted-foreground">
                Nothing in the order yet
              </span>
            )}
            {undo ? (
              <span className="inline-flex items-center gap-1 text-body-compact text-muted-foreground">
                {undo.label}
                <Button
                  type="button"
                  variant="ghost"
                  className="px-2 text-body-compact font-medium text-foreground"
                  onClick={undo.onUndo}
                >
                  Undo
                </Button>
              </span>
            ) : null}
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <OrderSaveIndicator />
            <Button
              ref={previewRef}
              type="button"
              variant="outline"
              className="w-full sm:w-fit"
              onClick={openPreview}
            >
              Preview
            </Button>
            {signingStatus === "added" ? (
              <Button
                type="button"
                variant="outline"
                className="w-full sm:w-fit"
                onClick={() =>
                  onSigningStatus(
                    "draft",
                    "Moved back to draft. The order can be edited again.",
                  )
                }
              >
                Move back to draft
              </Button>
            ) : null}
            <Button
              type="button"
              className="w-full sm:w-fit"
              disabled={locked || !ready}
              onClick={() =>
                onSigningStatus(
                  "added",
                  "Added to the signing list. Nothing has been filed or published.",
                )
              }
            >
              {signingStatus === "signed"
                ? "Signed"
                : signingStatus === "added"
                  ? "Added to signing list"
                  : "Add to signing list"}
            </Button>
          </div>
        </div>
      </footer>

      <Dialog open={signOpen} onOpenChange={setSignOpen}>
        <StagedOverlay
          className="h-[85dvh] sm:max-w-4xl"
          title={signFlow.stage === "read" ? document.title : "Add signature"}
          titleRef={signFlow.titleRef}
          description={`${document.matter} · ${document.caseNumber}`}
          sceneKey={signFlow.sceneKey}
          motion={signFlow.motion}
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            previewRef.current?.focus();
          }}
          footer={
            signFlow.stage === "read" ? (
              <Button
                type="button"
                disabled={!ready || signingStatus === "signed"}
                onClick={() => signFlow.go("sign")}
              >
                Sign now
              </Button>
            ) : (
              <SignatureActions
                choice={signature}
                onBack={() => signFlow.go("read")}
                onSubmit={() => {
                  setSignOpen(false);
                  onSigningStatus(
                    "signed",
                    "Signature recorded for this sitting. Nothing has been filed or published.",
                  );
                }}
              />
            )
          }
        >
          {signFlow.stage === "read" ? (
            <DocumentPreview
              className="min-h-0 flex-1"
              height="fill"
              title={document.title}
              source={{
                kind: "composed",
                content: <OrderDraftFacsimile document={document} />,
              }}
            />
          ) : (
            <SignatureStage
              noun="order"
              subject={`You are adding your signature to the order in ${document.caseNumber}.`}
              warning="This records how the order is to be signed. Nothing is issued from this screen."
              choice={signature}
            />
          )}
        </StagedOverlay>
      </Dialog>
    </>
  );
}

/* ─────────────────────────────────── the index ─────────────────────────────── */

type IndexRow = {
  target: string;
  state: "done" | "todo" | "open";
  title: string;
  detail: string;
};

/**
 * **This order** — Abhirami's index: every part of the order in page order, each with
 * where it stands, and one count of what is left. A row takes you to the part.
 *
 * Three marks, each with its words beside it (never colour alone): done, still to fill,
 * and not answered yet — the last for the parts that do not hold the order back
 * (attendance, an application left standing).
 */
function OrderIndex({
  className,
  rows,
  toFill,
  onJump,
}: {
  className?: string;
  rows: IndexRow[];
  toFill: number;
  onJump: (id: string) => void;
}) {
  return (
    <Card className={cn(PANEL_CLASS, "min-w-0 gap-2 p-4", className)}>
      <nav
        aria-labelledby="order-index"
        className="flex min-w-0 flex-col gap-2"
      >
        <div className="flex items-baseline justify-between gap-2 px-2">
          <h2 id="order-index" className="text-body-compact font-semibold">
            This order
          </h2>
          <span
            className={cn(
              "text-body-compact tabular-nums",
              toFill > 0 ? "text-warning-ink" : "text-success-ink",
            )}
          >
            {toFill > 0 ? `${toFill} to fill` : "Ready"}
          </span>
        </div>
        <ul className="flex min-w-0 flex-col">
          {rows.map((row) => (
            <li key={row.target}>
              <button
                type="button"
                onClick={() => onJump(row.target)}
                className="flex min-h-10 w-full min-w-0 items-start gap-3 rounded-lg px-2 py-2 text-left transition-colors hover:bg-accent focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
              >
                <IndexMark state={row.state} />
                <span className="flex min-w-0 flex-col">
                  <span className="line-clamp-2 text-body-compact font-medium">
                    {row.title}
                  </span>
                  {row.detail ? (
                    <span
                      className={cn(
                        "line-clamp-2 text-body-compact",
                        row.state === "todo"
                          ? "text-warning-ink"
                          : "text-muted-foreground",
                      )}
                    >
                      {row.detail}
                    </span>
                  ) : null}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </nav>
    </Card>
  );
}

function IndexMark({ state }: { state: IndexRow["state"] }) {
  if (state === "done") {
    return (
      <span
        aria-hidden
        className="mt-px flex size-5 shrink-0 items-center justify-center rounded-full bg-success-muted text-success-muted-foreground"
      >
        <CheckIcon className="size-3" />
      </span>
    );
  }
  if (state === "todo") {
    return (
      <span
        aria-hidden
        className="mt-px flex size-5 shrink-0 items-center justify-center rounded-full bg-warning-muted"
      >
        <span className="size-1.5 rounded-full bg-warning-ink" />
      </span>
    );
  }
  return (
    <span
      aria-hidden
      className="mt-px size-5 shrink-0 rounded-full border border-dashed border-input"
    />
  );
}

/* ───────────────────────────────── the sections ────────────────────────────── */

export function AttendanceSection({
  attendance,
  disabled,
}: {
  attendance: ComposerAttendance;
  disabled: boolean;
}) {
  return (
    <section
      id="order-attendance"
      tabIndex={-1}
      aria-labelledby="order-attendance-heading"
      className="flex min-w-0 scroll-mt-40 flex-col gap-3 outline-none"
    >
      <div className="flex items-center justify-between gap-4">
        <h2
          id="order-attendance-heading"
          className="text-body-compact font-semibold"
        >
          Attendance
        </h2>
        {disabled ? null : (
          <Button
            type="button"
            variant="ghost"
            className="-mr-3 text-body-compact"
            onClick={attendance.onMarkAllPresent}
          >
            Mark all present
          </Button>
        )}
      </div>
      <ul className="flex min-w-0 flex-col divide-y divide-hairline rounded-xl border border-hairline">
        {attendance.appearances.map((appearance) => {
          const mark = attendance.marks[appearance.id];
          return (
            <li
              key={appearance.id}
              className="flex min-w-0 flex-wrap items-center justify-between gap-x-3 gap-y-1 py-1 pr-1 pl-3"
            >
              <p className="min-w-0 text-body-compact">
                <span className="font-medium">{appearance.name}</span>{" "}
                <span className="text-muted-foreground">
                  {appearance.role.toLowerCase()}
                </span>
              </p>
              <div
                role="radiogroup"
                aria-label={appearance.name}
                className="flex shrink-0 gap-1"
              >
                <MarkButton
                  label="Present"
                  checked={mark === "present"}
                  tone="present"
                  disabled={disabled}
                  onClick={() =>
                    attendance.onMark(
                      appearance.id,
                      mark === "present" ? undefined : "present",
                    )
                  }
                />
                <MarkButton
                  label="Absent"
                  checked={mark === "absent"}
                  tone="absent"
                  disabled={disabled}
                  onClick={() =>
                    attendance.onMark(
                      appearance.id,
                      mark === "absent" ? undefined : "absent",
                    )
                  }
                />
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/**
 * Present or Absent — a mark pressed again is cleared, because no answer for a person is
 * a real state and an uncorrectable one is not (`ATT-02`).
 */
function MarkButton({
  label,
  checked,
  tone,
  disabled,
  onClick,
}: {
  label: string;
  checked: boolean;
  tone: "present" | "absent";
  disabled: boolean;
  onClick: () => void;
}) {
  const Icon = tone === "present" ? CheckIcon : XIcon;
  return (
    <button
      type="button"
      role="radio"
      aria-checked={checked}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "inline-flex h-10 items-center gap-1.5 rounded-lg px-3 text-body-compact font-medium transition-colors focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50",
        checked
          ? tone === "present"
            ? "bg-success-muted text-success-muted-foreground hover:bg-success-muted-hover"
            : "bg-destructive-muted text-destructive-muted-foreground hover:bg-destructive-muted-hover"
          : "text-muted-foreground hover:bg-accent hover:text-foreground",
      )}
    >
      <Icon className="size-4" aria-hidden />
      {label}
    </button>
  );
}

export function ApplicationsSection({
  applications,
  disabled,
}: {
  applications: ComposerApplications;
  disabled: boolean;
}) {
  return (
    <section
      aria-labelledby="order-applications-heading"
      className="flex min-w-0 flex-col gap-3"
    >
      <h2
        id="order-applications-heading"
        className="text-body-compact font-semibold"
      >
        Applications
      </h2>
      <ul className="flex min-w-0 flex-col divide-y divide-hairline rounded-xl border border-hairline">
        {applications.list.map((application) => (
          <li
            key={application.id}
            id={`order-application-${application.id}`}
            tabIndex={-1}
            className="flex min-w-0 scroll-mt-40 flex-wrap items-center justify-between gap-x-3 gap-y-2 py-2 pr-2 pl-3 outline-none"
          >
            <button
              type="button"
              onClick={() => applications.onOpen(application.id)}
              className="flex min-w-0 flex-col rounded-md text-left focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
            >
              <span className="text-body-compact">
                <span className="font-mono">{application.number}</span>{" "}
                <span className="font-medium hover:underline">
                  {application.type}
                </span>
              </span>
              <span className="text-body-compact text-muted-foreground">
                {application.filed}
              </span>
            </button>
            <div className="flex shrink-0 items-center gap-2">
              {application.decision ? (
                <>
                  <Badge
                    variant={
                      application.decision === "allowed"
                        ? "success"
                        : "destructive"
                    }
                  >
                    {application.decision === "allowed"
                      ? "Accepted"
                      : "Rejected"}
                  </Badge>
                  {disabled ? null : (
                    <Button
                      type="button"
                      variant="ghost"
                      className="text-body-compact"
                      onClick={() =>
                        applications.onDecide(application.id, null)
                      }
                    >
                      Undo
                    </Button>
                  )}
                </>
              ) : disabled ? null : (
                <>
                  <Button
                    type="button"
                    variant="outline"
                    className="text-destructive-ink"
                    onClick={() =>
                      applications.onDecide(application.id, "dismissed")
                    }
                  >
                    Reject
                  </Button>
                  <Button
                    type="button"
                    variant="success"
                    onClick={() =>
                      applications.onDecide(application.id, "allowed")
                    }
                  >
                    Accept
                  </Button>
                </>
              )}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function NextHearingSection({
  nextHearing,
  today,
  disabled,
}: {
  nextHearing: ComposerNextHearing;
  today: string;
  disabled: boolean;
}) {
  const id = "order-next";
  return (
    <section
      id="order-next-hearing"
      tabIndex={-1}
      aria-labelledby={`${id}-heading`}
      className="flex min-w-0 scroll-mt-40 flex-col gap-3 outline-none"
    >
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
        <h2 id={`${id}-heading`} className="text-body-compact font-semibold">
          Next hearing
        </h2>
        <div className="flex min-h-10 items-center gap-2">
          <Checkbox
            id={`${id}-none`}
            checked={nextHearing.next === "none"}
            disabled={disabled}
            onCheckedChange={(checked) =>
              nextHearing.onChange({ next: checked === true ? "none" : "list" })
            }
          />
          <Label
            htmlFor={`${id}-none`}
            className="cursor-pointer text-body-compact font-normal"
          >
            Not listed again
          </Label>
        </div>
      </div>
      {nextHearing.next === "none" ? null : (
        <div className="grid min-w-0 gap-4 sm:grid-cols-2">
          <OrderDatePicker
            id={`${id}-date`}
            label={
              <span
                id={`${id}-date-label`}
                className="text-body-compact font-medium"
              >
                Date
              </span>
            }
            value={nextHearing.date ?? ""}
            today={today}
            disabled={disabled}
            onChange={(date) => nextHearing.onChange({ date: date || null })}
          />
          <div className="flex min-w-0 flex-col gap-1">
            <span
              id={`${id}-purpose-label`}
              className="text-body-compact font-medium"
            >
              Purpose
            </span>
            <Select
              value={nextHearing.purpose || undefined}
              disabled={disabled}
              onValueChange={(value) =>
                nextHearing.onChange({
                  purpose: value as CourtHearingPurposeId,
                })
              }
            >
              <SelectTrigger
                aria-labelledby={`${id}-purpose-label`}
                className="w-full"
              >
                <SelectValue placeholder="Choose a purpose">
                  {nextHearing.purpose
                    ? courtHearingPurposeLabel(nextHearing.purpose)
                    : null}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {COURT_HEARING_PURPOSES.map((entry) => (
                  <SelectItem key={entry.id} value={entry.id}>
                    {entry.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      )}
    </section>
  );
}
