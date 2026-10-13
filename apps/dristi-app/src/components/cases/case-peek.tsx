"use client";

import type { CSSProperties, ReactNode } from "react";
import { useMemo, useRef, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { ExternalLinkIcon, XIcon } from "lucide-react";

import { REGISTER_CARDS_QUERY } from "@/components/cases/register-layout";
import { Drawer, DrawerContent, DrawerTitle } from "@/components/ui/drawer";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  DescriptionDetails,
  DescriptionList,
  DescriptionRow,
  DescriptionTerm,
} from "@/components/ui/description-list";
import {
  Item,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemTitle,
} from "@/components/ui/item";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Timeline, TimelineItem } from "@/components/ui/timeline";
import {
  formatChequeAmount,
  formatDueStatus,
  formatWeekdayDate,
  isSameDay,
  peekExtras,
  dayStamp,
  peekHistory,
  type CaseTask,
} from "@/lib/cases/peek";
import { hearingRecords } from "@/lib/cases/hearing-record";
import { caseDetailHref, caseSectionHref } from "@/lib/cases/sections";
import {
  formatCaseDate,
  formatCounselList,
  outcomeLabel,
  partiesLabel,
  stageLabel,
  counselFor,
  type CaseRecord,
} from "@/lib/cases/types";
import { useMediaQuery } from "@/hooks/use-media-query";
import { cn } from "@/lib/utils";
import { BotdText } from "@/components/cases/botd-text";

import { CaseFlags } from "./case-identity";
import { CASE_PEEK_ID, useCasePeek } from "./use-case-peek";
import { Identifier } from "@/components/chrome/identifier";
import { useCourtText } from "@/components/court/court-provider";

/**
 * Card that owns peek state in the tree, floating variant. The panel portals to the
 * document so it can float over the screen — the app shell clips `fixed` descendants.
 * Used by the surfaces that keep the inset floating peek (advocate home, folder/search).
 * The cases landing uses `CasePeekPushRegion` instead.
 */
export function CasePeekSurface({
  children,
  className,
  mobileDrawer = false,
}: {
  children: ReactNode;
  className?: string;
  /** Opt this surface into a modal bottom drawer on phones. */
  mobileDrawer?: boolean;
}) {
  return (
    <div className={className}>
      {children}
      <CasePeek mobileDrawer={mobileDrawer} />
    </div>
  );
}

/** Panel width, shared by the docked panel and the push margin so they coincide. */
const PEEK_WIDTH = "27rem";

/**
 * The class that makes an element step aside for the docked peek. It reads `--peek-mr`
 * (set on the push region, inherited down) as a right margin, transitioned so the
 * element eases left as the panel slides in. Only from `sm` up, where there is room; on
 * a phone the panel covers the column and nothing moves.
 *
 * A margin, not padding: the panel is wider than the spacing ladder's top rung and the
 * gate forbids raw-unit arbitrary spacing, but an arbitrary value that reads a CSS var
 * is allowed. Apply it ONLY to light chrome — the title row, the toolbar, the chips.
 * The table is deliberately left out (see `CasePeekPushRegion`).
 */
export const PEEK_PUSH_CLASS =
  "transition-[margin] duration-300 ease-out sm:mr-[var(--peek-mr,0px)]";

/**
 * Wraps the whole cases column and sets `--peek-mr` for everything under it — 0 when the
 * peek is closed, the panel's width when it is open. It does NOT itself take the margin.
 *
 * Why the split: pushing the column with one margin meant the wide, content-sized table
 * re-measured every cell on every frame of the 300ms animation — the choppiness the
 * owner felt (Sept 11). So only the light chrome carries `PEEK_PUSH_CLASS` and eases
 * aside; the heavy table keeps its full width and never re-lays-out. The docked panel,
 * opaque with its own shadow, simply slides over the table's right edge — a panel over
 * content, not a table reflowing under one. Nothing animates layout on the hot path, so
 * the motion is smooth.
 */
export function CasePeekPushRegion({
  children,
  className,
  mobileDrawer = false,
  pushWhen = "(min-width: 640px)",
}: {
  children: ReactNode;
  className?: string;
  /** On a phone the peek rises as a bottom drawer instead of covering the screen. */
  mobileDrawer?: boolean;
  /** Where the docked panel makes room for itself. Elsewhere it lies over the
   *  page and nothing behind it moves. Defaults to `sm`, the panel's own width rule. */
  pushWhen?: string;
}) {
  const { record, closing } = useCasePeek();
  // Make room only while the panel is actually there. As soon as a close is asked for,
  // `closing` flips and the chrome eases back in step with the panel sliding out.
  const pushes = useMediaQuery(pushWhen);
  const open = pushes && Boolean(record) && !closing;
  return (
    <>
      <div
        data-peek-open={open || undefined}
        className={className}
        style={{ "--peek-mr": open ? PEEK_WIDTH : "0px" } as CSSProperties}
      >
        {children}
      </div>
      <CasePeek mobileDrawer={mobileDrawer} />
    </>
  );
}

/**
 * Two shapes, one panel. Docked (the cases landing): right edge, full height, over the
 * column it pushed — modal elevation and a hairline seam sell the lift the owner found
 * missing, and it enters on a short slide from the right in step with the column
 * reflowing left. Floating (advocate home, folder/search): inset from the edges, rounded,
 * overlay elevation — the original shape those surfaces were built around. Not a Sheet in
 * either shape: no scrim and no focus trap, so another case number stays the switcher;
 * and not the Card primitive, whose hover fill would wash the whole panel.
 */
/** A subscription with nothing to report — the mount state never changes back. */
const emptySubscribe = () => () => {};

export function CasePeek({ mobileDrawer = false }: { mobileDrawer?: boolean } = {}) {
  // A phone, or a tablet held upright (owner, Sept 21): wherever the list is
  // cards, the peek rises from the bottom instead of docking at the side.
  const isMobile = useMediaQuery(REGISTER_CARDS_QUERY);
  const returnFocus = useRef<HTMLElement | null>(null);
  const { record, now, hideLongPendingFlag, docked, closing, close } = useCasePeek();
  // Portal guard: the server (and the hydration render) has no document.body to
  // portal into, so both report unmounted; the client re-renders once after
  // hydration. The store shape of the old mounted-flag effect.
  const mounted = useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false
  );

  if (!record || !mounted) return null;

  if (mobileDrawer && isMobile) {
    return (
      <Drawer open={!closing} onOpenChange={(open) => { if (!open) close(); }} autoFocus>
        <DrawerContent
          id={CASE_PEEK_ID}
          aria-labelledby="case-peek-title"
          aria-describedby={undefined}
          className="h-[80dvh] overflow-hidden data-[vaul-drawer-direction=bottom]:max-h-[80dvh] [&_[data-slot=button]]:min-h-10"
          style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
          onOpenAutoFocus={() => {
            returnFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
          }}
          onCloseAutoFocus={(event) => {
            // There is no DrawerTrigger: the hearing card opens the shared provider.
            // Keep its 300ms exit, then return to the actual invoking control.
            event.preventDefault();
            if (returnFocus.current?.isConnected) returnFocus.current.focus({ preventScroll: true });
          }}
        >
          <CasePeekBody
            record={record}
            now={now}
            hideLongPendingFlag={hideLongPendingFlag}
            onClose={close}
            mobileDrawer
          />
        </DrawerContent>
      </Drawer>
    );
  }

  return createPortal(
    // The panel slides both ways. Enter is a keyframe that plays on mount; exit is the
    // matching keyframe, played while `closing` holds the record mounted (the provider
    // drops it one exit later). Unmounting on close instead snapped the covered table
    // columns back in a single frame — the "glitch" the owner saw (Sept 11). No fade
    // and no per-frame layout, so open and close read as the same smooth motion.
    // Docked: w-[27rem] must equal PEEK_WIDTH so the panel fills the margin the chrome
    // reserved. Floating: the original inset overlay.
    <aside
      id={CASE_PEEK_ID}
      role="region"
      aria-labelledby="case-peek-title"
      data-state={closing ? "closed" : "open"}
      className={cn(
        "fixed z-50 flex flex-col overflow-hidden bg-popover text-popover-foreground fill-mode-forwards duration-300 ease-out motion-reduce:animate-none",
        closing ? "animate-out" : "animate-in",
        docked
          ? cn(
              "inset-y-0 right-0 w-full border-l border-hairline shadow-modal sm:w-[27rem]",
              closing ? "slide-out-to-right-full" : "slide-in-from-right-full"
            )
          : cn(
              "inset-y-6 right-6 w-3/4 max-w-md rounded-xl border border-border shadow-overlay",
              closing
                ? "fade-out-0 slide-out-to-right-2"
                : "fade-in-0 slide-in-from-right-2"
            )
      )}
    >
      <CasePeekBody
        record={record}
        now={now}
        hideLongPendingFlag={hideLongPendingFlag}
        onClose={close}
      />
    </aside>,
    document.body
  );
}

function CasePeekBody({
  record,
  now,
  hideLongPendingFlag,
  onClose,
  mobileDrawer = false,
}: {
  record: CaseRecord;
  now: number;
  hideLongPendingFlag: boolean;
  onClose: () => void;
  mobileDrawer?: boolean;
}) {
  const courtText = useCourtText();
  const Title = mobileDrawer ? DrawerTitle : "h2";
  const title = partiesLabel(record);
  const extras = peekExtras(record.id);
  const stage = record.disposal
    ? outcomeLabel(record.disposal.outcome)
    : record.substage ?? stageLabel(record.stage);

  return (
    <>
      {/* No eyebrow — the panel is plainly a case, and "Case peek" only named the
          mechanism (owner, Sept 11). Close is the bare cross, top-right on the title's
          line. The tab row below carries the only divider; the header runs into it. */}
      <header className={cn("flex shrink-0 flex-col gap-4 p-6 pb-4", mobileDrawer && "p-4")}>
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 flex-col gap-1.5">
            <Title
              id="case-peek-title"
              className="text-title-s font-semibold text-balance"
            >
              {title}
            </Title>
            {/* Each `Identifier` holds a 14px box for its copy glyph, which read
                as a gap before the next dot. The second number rests pulled
                back over that box and steps aside while the first is hovered,
                focused or showing its tick: the header's `CaseNumberLine`
                move. The court has its own line, so nothing that can wrap
                ever carries the offset. */}
            <p className="flex flex-wrap items-baseline text-body-compact text-muted-foreground">
              <Identifier
                value={record.caseNumber}
                label="case number"
              />
              {extras.altCaseNumber ? (
                <>
                  <span aria-hidden className="whitespace-pre">
                    {" · "}
                  </span>
                  <Identifier
                    value={extras.altCaseNumber}
                    label="other case number"
                  />
                </>
              ) : null}
            </p>
            {/* A step of air and a step of weight, so the court reads as its
                own fact and not as a third number (owner, Sept 18). */}
            <p className="mt-1.5 text-body-compact font-medium text-foreground">
              {courtText(record.court)}
            </p>
          </div>
          <Button
            variant="ghost"
            size={mobileDrawer ? "icon" : "icon-sm"}
            className="-mr-1 -mt-1 shrink-0 text-muted-foreground"
            onClick={onClose}
            aria-label="Close"
          >
            <XIcon aria-hidden />
          </Button>
        </div>

        {hideLongPendingFlag ? null : <CaseFlags record={record} />}

        <Button variant="secondary" className="w-fit" asChild>
          <Link
            href={caseDetailHref(
              record.id,
              hideLongPendingFlag ? "long-pending" : undefined
            )}
          >
            <ExternalLinkIcon data-icon="inline-start" aria-hidden />
            Open case file
          </Link>
        </Button>
      </header>

      <Tabs
        key={record.id}
        defaultValue="overview"
        className="flex min-h-0 flex-1 flex-col gap-0"
      >
        {/* The active mark is the DS line variant's `after`, drawn 5px below the
            trigger; the divider must land on that exact line or the two read as two
            rules. The trigger fills the row (`h-full`, not the DS 1px-short default) so
            its bottom is the row's bottom, and `pb-1` puts the hairline rule where the
            mark's centre sits. Compact type: these are section tabs in a dense inspector,
            not page headings (owner, Sept 11). */}
        <div className="shrink-0 border-b border-hairline px-6 pb-1">
          <TabsList
            variant="line"
            aria-label="Case peek sections"
            className="h-10 w-full justify-start rounded-none p-0 group-data-horizontal/tabs:h-10"
          >
            <TabsTrigger
              value="overview"
              className="h-full flex-none px-3 text-body-compact"
            >
              Overview
            </TabsTrigger>
            <TabsTrigger
              value="history"
              className="h-full flex-none px-3 text-body-compact"
            >
              Case History
            </TabsTrigger>
          </TabsList>
        </div>

        <ScrollArea className="min-h-0 flex-1">
          <TabsContent value="overview" className="outline-none">
            <CasePeekOverview
              record={record}
              now={now}
              stage={stage}
              extras={extras}
            />
          </TabsContent>
          <TabsContent value="history" className="outline-none">
            <CasePeekHistory record={record} now={now} />
          </TabsContent>
        </ScrollArea>
      </Tabs>
    </>
  );
}

function CasePeekOverview({
  record,
  now,
  stage,
  extras,
}: {
  record: CaseRecord;
  now: number;
  stage: string;
  extras: ReturnType<typeof peekExtras>;
}) {
  const tasks = extras.tasks ?? [];
  // The latest sitting that has a business of the day recorded.
  const latest = useMemo(
    () => hearingRecords(record).find((h) => h.summary && h.on <= dayStamp(now)),
    [record, now]
  );
  const complainantCounsel = counselFor(record, "complainant");
  const accusedCounsel = counselFor(record, "accused");

  return (
    <div className="flex flex-col gap-6 p-6">
      <DescriptionList>
        <PeekRow term="Stage">{stage}</PeekRow>
        {record.nextHearing ? (
          <PeekRow term="Next posting">
            {isSameDay(record.nextHearing.on, now)
              ? "Today"
              : formatCaseDate(record.nextHearing.on)}
            {record.nextHearing.purpose ? (
              <> — {record.nextHearing.purpose}</>
            ) : null}
          </PeekRow>
        ) : null}
        <PartyRow
          term="Complainant"
          name={record.parties.complainant}
          counsel={complainantCounsel}
          appearing={extras.appearingFor === "complainant"}
        />
        <PartyRow
          term="Accused"
          name={record.parties.accused}
          counsel={accusedCounsel}
          appearing={extras.appearingFor === "accused"}
        />
        {extras.chequeAmount ? (
          <PeekRow term="Cheque amount">
            {formatChequeAmount(extras.chequeAmount)}
          </PeekRow>
        ) : null}
        <PeekRow term="Filed">{formatCaseDate(record.filedOn)}</PeekRow>
      </DescriptionList>

      {/* Pending work comes before the last hearing: what still has to be done
          before the next posting outranks the record of the one that passed. */}
      {tasks.length > 0 ? (
        <section className="flex flex-col gap-4">
          <SectionHeading count={tasks.length}>Pending before the hearing</SectionHeading>
          <ItemGroup className="gap-3">
            {tasks.map((task) => (
              <TaskRow key={task.id} caseId={record.id} task={task} now={now} />
            ))}
          </ItemGroup>
        </section>
      ) : null}

      {latest ? (
        <LastHearingCard
          on={latest.on}
          purpose={latest.purpose}
          order={latest.summary as string}
          label="Business of the day"
        />
      ) : record.previousHearingOn ? (
        <LastHearingCard
          on={record.previousHearingOn}
          purpose={record.substage ?? stageLabel(record.stage)}
          order={extras.orderOfTheDay ?? record.latestUpdate}
          label={extras.orderOfTheDay ? "Order of the day" : "Latest update"}
        />
      ) : null}
    </div>
  );
}

/**
 * Compact rows (owner, Sept 11) — the peek is a staff inspector, not citizen copy, and
 * at 16px the term and value sat one step under the 20px title with the same weight, so
 * the panel read flat. At 14px the rows drop a clear step below the title, the term goes
 * quiet and the value carries the line. The primitive's per-row full border softens to a
 * hairline so the list reads as a spec, not a grid.
 */
function PeekRow({
  term,
  children,
}: {
  term: string;
  children: ReactNode;
}) {
  return (
    <DescriptionRow className="border-hairline py-2.5">
      <DescriptionTerm>{term}</DescriptionTerm>
      <DescriptionDetails className="font-medium">
        {children}
      </DescriptionDetails>
    </DescriptionRow>
  );
}

/** A side of the cause title: who they are, whether you appear, who is on record. */
function PartyRow({
  term,
  name,
  counsel,
  appearing,
}: {
  term: string;
  name: string;
  counsel: string[];
  /** The signed-in advocate appears for this side. */
  appearing: boolean;
}) {
  return (
    <DescriptionRow className="border-hairline py-2.5">
      <DescriptionTerm>{term}</DescriptionTerm>
      <DescriptionDetails className="flex flex-col gap-0.5">
        <span className="font-medium">
          {name}
          {appearing ? (
            <>
              <span aria-hidden> · </span>you appear
            </>
          ) : null}
        </span>
        {counsel.length > 0 ? (
          <span className="text-caption text-muted-foreground">
            Counsel: {formatCounselList(counsel)}
          </span>
        ) : null}
      </DescriptionDetails>
    </DescriptionRow>
  );
}

/** Group label, not a page heading — the design keeps these quiet. */
function SectionHeading({
  count,
  children,
}: {
  count?: number;
  children: string;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <h3 className="text-caption text-muted-foreground">{children}</h3>
      {count === undefined ? null : <Badge variant="secondary">{count}</Badge>}
    </div>
  );
}

/**
 * Heading and order label follow one signal, and Overview applies the
 * same rule: it is a direction only when the court actually directed
 * something. Without an order of the day this is the latest update on
 * the hearing that happened, not a direction.
 */
function LastHearingCard({
  on,
  purpose,
  order,
  label,
}: {
  on: string;
  purpose: string;
  order: string;
  /** What the text is: the business of the day, or a fallback note. */
  label: string;
}) {
  const day = new Date(`${on}T00:00:00`).toLocaleDateString("en-IN", {
    day: "numeric",
  });
  const month = new Date(`${on}T00:00:00`).toLocaleDateString("en-IN", {
    month: "short",
  });

  return (
    <section className="flex flex-col gap-4">
      <SectionHeading>
        Last hearing
      </SectionHeading>
      <Card size="sm">
        <CardHeader>
          <div className="flex items-start gap-4">
            <div
              className="flex size-12 shrink-0 flex-col items-center justify-center rounded-lg bg-brand-muted"
              aria-hidden
            >
              <span className="text-body font-semibold text-brand-muted-foreground">
                {day}
              </span>
              <span className="text-caption text-brand-muted-foreground">
                {month}
              </span>
            </div>
            <div className="flex min-w-0 flex-col gap-1">
              <CardTitle className="text-body font-medium">
                {formatWeekdayDate(on)}
              </CardTitle>
              <CardDescription className="text-body-compact">
                {purpose}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-2 rounded-md bg-surface-sunken p-4">
            <p className="text-body-compact font-medium text-foreground">
              {label}
            </p>
            <p className="text-body-compact text-muted-foreground">{order}</p>
          </div>
        </CardContent>
      </Card>
    </section>
  );
}

function TaskRow({
  caseId,
  task,
  now,
}: {
  caseId: string;
  task: CaseTask;
  now: number;
}) {
  const due = formatDueStatus(task.dueOn, now);
  /* Who holds it beats when it is due — the due status is already on the
     right, and it now carries the formatted date, so the fallback takes
     that rather than formatting the same day a second time. The drawer
     states the deadline as one line and does not rank it: it is a glance at
     a case, not the case file's queue of work. */
  const detail = task.note
    ? task.note
    : task.assignedTo && task.markedOn
      ? `Assigned to ${task.assignedTo} · marked ${formatCaseDate(task.markedOn)}`
      : due.on;

  const dueLabel = (
    <p
      className={cn(
        "shrink-0 text-caption",
        due.overdue ? "text-destructive-ink" : "text-muted-foreground"
      )}
    >
      {due.label}
    </p>
  );

  // When the task names its verb, the row states the task and offers that action
  // as its own outline button — the deadline sits quietly beside it. Without a
  // named verb the whole row is the link to where the task is handled.
  if (task.action) {
    // The statement leads on its own line so it is never squeezed by the action
    // beside it; the deadline and the action then sit together on a second line,
    // the button anchored to the right.
    return (
      <Item variant="muted" size="sm" className="min-h-10 p-4">
        <ItemContent className="min-w-0 gap-1.5">
          <ItemTitle className="line-clamp-none text-body-compact font-medium text-foreground">
            {task.title}
          </ItemTitle>
          <ItemDescription className="line-clamp-none text-caption">
            {detail}
          </ItemDescription>
          <div className="mt-1.5 flex items-center justify-between gap-3">
            {dueLabel}
            <Button variant="outline" size="xs" asChild>
              <Link href={caseSectionHref(caseId, task.action.section)}>
                {task.action.label}
              </Link>
            </Button>
          </div>
        </ItemContent>
      </Item>
    );
  }

  // items-baseline puts the due status on the title's first-line baseline, so the date
  // reads as sitting on the same plane as the heading rather than floating a little low
  // (owner, Sept 11).
  return (
    <Item asChild variant="muted" size="sm" className="min-h-10 items-baseline p-4">
      <Link href={caseSectionHref(caseId, "applications")} role="listitem">
        <ItemContent className="min-w-0">
          <ItemTitle className="line-clamp-none text-body-compact font-medium text-foreground">
            {task.title}
          </ItemTitle>
          <ItemDescription className="line-clamp-none text-caption">
            {detail}
          </ItemDescription>
        </ItemContent>
        {dueLabel}
      </Link>
    </Item>
  );
}

/**
 * The case so far, oldest first: the filing, every hearing with its business
 * of the day, and the disposal. A long BOTD shows two lines and opens in place.
 */
function CasePeekHistory({ record, now }: { record: CaseRecord; now: number }) {
  const items = useMemo(() => {
    const today = dayStamp(now);
    const milestones = peekHistory(record, now);
    const filed = milestones[0];
    const disposal = record.disposal
      ? milestones.find((item) => item.on === record.disposal?.on)
      : undefined;
    const hearings = hearingRecords(record)
      .filter((h) => !(record.disposal && h.on === dayStamp(record.disposal.on)))
      .reverse()
      .map((h) => ({
        key: h.id,
        on: h.on,
        title: h.purpose,
        botd: h.summary,
        status: (h.on > today ? "future" : h.on === today ? "current" : "past") as
          | "past"
          | "current"
          | "future",
      }));
    return [
      { key: "filed", on: filed.on, title: filed.title, botd: undefined, status: filed.status },
      ...hearings,
      ...(disposal
        ? [{ key: "disposal", on: disposal.on, title: disposal.title, botd: undefined, status: disposal.status }]
        : []),
    ];
  }, [record, now]);

  return (
    <div className="p-6">
      <Timeline>
        {items.map((item) => (
          <TimelineItem
            key={item.key}
            status={item.status}
            title={item.title}
            description={formatCaseDate(item.on)}
          >
            {item.botd ? <BotdText text={item.botd} /> : null}
          </TimelineItem>
        ))}
      </Timeline>
    </div>
  );
}

