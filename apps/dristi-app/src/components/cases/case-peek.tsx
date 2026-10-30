"use client";

import type { ReactNode } from "react";
import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { ExternalLinkIcon } from "lucide-react";

import { REGISTER_CARDS_QUERY } from "@/components/cases/register-layout";
import {
  SIDE_PANEL_INSET,
  SidePanel,
  SidePanelRegion,
} from "@/components/ui/side-panel";

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
 * Card that owns peek state in the tree, for surfaces where nothing makes room for the
 * panel: it docks over the page (advocate home, the case folders).
 * The cases landing and the Raise application chooser use `CasePeekPushRegion`.
 */
export function CasePeekSurface({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      {children}
      <CasePeek />
    </div>
  );
}

/**
 * Wraps the whole cases column, inside its page padding: the panel's push is measured
 * from the region's edge, so padding on the region itself would count twice. Only the light chrome given `SIDE_PANEL_PUSH` steps
 * aside; the wide table keeps its width and the panel slides over its right edge.
 *
 * Why: pushing the column with one margin meant the content-sized table re-measured
 * every cell on every frame of the 300ms animation, the choppiness the owner felt
 * (Sept 11). Nothing animates layout on the hot path, so the motion is smooth.
 */
export function CasePeekPushRegion({
  children,
  className,
  regionClassName,
  pushWhen = "(min-width: 640px)",
}: {
  children: ReactNode;
  /** The page's ground and padding, outside the region. */
  className?: string;
  /** Layout inside the padding: the column's own gaps. */
  regionClassName?: string;
  /** Where the docked panel makes room for itself. Elsewhere it lies over the
   *  page and nothing behind it moves. Defaults to `sm`, the panel's own width rule. */
  pushWhen?: string;
}) {
  const { record, closing } = useCasePeek();
  // Make room only while the panel is actually there. As soon as a close is asked for,
  // `closing` flips and the chrome eases back in step with the panel sliding out.
  const pushes = useMediaQuery(pushWhen);
  return (
    <>
      <div className={cn("flex min-w-0 flex-1 flex-col", className)}>
        <SidePanelRegion
          open={pushes && Boolean(record) && !closing}
          push="marked"
          className={cn("flex min-w-0 flex-1 flex-col", regionClassName)}
        >
          {children}
        </SidePanelRegion>
      </div>
      <CasePeek />
    </>
  );
}

/**
 * The design system's side panel: docked at the right edge, or a bottom drawer wherever
 * the list is cards (a phone, or a tablet held upright: owner, Sept 21). Not a Sheet:
 * no scrim and no focus trap, so another case number stays the switcher.
 */
export function CasePeek() {
  const isMobile = useMediaQuery(REGISTER_CARDS_QUERY);
  const { record, now, hideLongPendingFlag, closing, close } = useCasePeek();
  // The provider drops the record one exit after a close; keep showing the last one
  // so the panel slides out with its content rather than empty.
  const [last, setLast] = useState(record);
  if (record && record !== last) setLast(record);
  const shown = record ?? last;
  // Each case opens on Overview. Controlled, not keyed: a key would remount the panel
  // and replay its slide-in every time another case is peeked.
  const [tab, setTab] = useState("overview");
  const [tabFor, setTabFor] = useState(shown?.id);
  if (shown?.id !== tabFor) {
    setTabFor(shown?.id);
    setTab("overview");
  }
  const onOpenChange = useCallback(
    (open: boolean) => {
      if (!open) close();
    },
    [close]
  );

  if (!shown) return null;

  return (
    // The tab row is pinned in the panel's header and the tab panels sit in its body,
    // so the Tabs root wraps the panel; `contents` keeps it out of the page's layout.
    <Tabs value={tab} onValueChange={setTab} className="contents">
      <CasePeekPanel
        record={shown}
        open={Boolean(record) && !closing}
        onOpenChange={onOpenChange}
        now={now}
        hideLongPendingFlag={hideLongPendingFlag}
        mobileDrawer={isMobile}
      />
    </Tabs>
  );
}

function CasePeekPanel({
  record,
  open,
  onOpenChange,
  now,
  hideLongPendingFlag,
  mobileDrawer,
}: {
  record: CaseRecord;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  now: number;
  hideLongPendingFlag: boolean;
  mobileDrawer: boolean;
}) {
  const courtText = useCourtText();
  const extras = peekExtras(record.id);
  const stage = record.disposal
    ? outcomeLabel(record.disposal.outcome)
    : record.substage ?? stageLabel(record.stage);

  return (
    <SidePanel
      id={CASE_PEEK_ID}
      open={open}
      onOpenChange={onOpenChange}
      drawerWhen={REGISTER_CARDS_QUERY}
      // A thumb's reach on the drawer: its outline actions stand 40px tall.
      className={mobileDrawer ? "[&_[data-slot=button]]:min-h-10" : undefined}
      // No eyebrow: the panel is plainly a case, and "Case peek" only named the
      // mechanism (owner, Sept 11).
      title={partiesLabel(record)}
      subtitle={
        <>
          {/* Each `Identifier` holds a 14px box for its copy glyph, which read
              as a gap before the next dot. The second number rests pulled
              back over that box and steps aside while the first is hovered,
              focused or showing its tick: the header's `CaseNumberLine`
              move. The court has its own line, so nothing that can wrap
              ever carries the offset. */}
          <p className="flex flex-wrap items-baseline text-body-compact text-muted-foreground">
            <Identifier value={record.caseNumber} label="case number" />
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
        </>
      }
      header={
        <>
          <div className={cn(SIDE_PANEL_INSET, "flex flex-col gap-4 pb-4")}>
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
          </div>
          {/* The row's bottom edge is the tab mark's line, so the divider sits on it.
              Compact type: these are section tabs in a dense inspector, not page
              headings (owner, Sept 11). The panel portals away from the Tabs root,
              and the line variant draws its mark from the root's `group/tabs`
              orientation, so this row stands in for it. */}
          <div
            data-orientation="horizontal"
            className={cn("group/tabs border-b border-hairline", SIDE_PANEL_INSET)}
          >
            <TabsList
              variant="line"
              aria-label="Case peek sections"
              className="h-10 w-full justify-start rounded-none"
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
        </>
      }
    >
      <TabsContent value="overview" className="outline-none">
        <CasePeekOverview record={record} now={now} stage={stage} extras={extras} />
      </TabsContent>
      <TabsContent value="history" className="outline-none">
        <CasePeekHistory record={record} now={now} />
      </TabsContent>
    </SidePanel>
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
    <div className="flex flex-col gap-6 pt-6">
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
    <div className="pt-6">
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

