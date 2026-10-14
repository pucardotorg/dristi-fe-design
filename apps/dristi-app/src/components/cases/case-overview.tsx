"use client";

import { REGISTER_TABLE_ONLY } from "@/components/cases/register-layout";
import { cn } from "@/lib/utils";
import { Fragment, useRef, useState, type ReactNode } from "react";
import { CaseLink as Link } from "@/components/cases/case-reader";
import { toast } from "sonner";

import { CaseHearingsDialog } from "@/components/cases/case-hearings-dialog";
import {
  DueStatusLine,
  PendingTaskRow,
  RestingCard,
  TaskNote,
} from "@/components/cases/case-overview-card";
import {
  BondTaskRow,
  useBondTaskVisible,
} from "@/components/cases/case-bail-flow";
import { useRemovalConsentTask } from "@/components/cases/removal-consent-task";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CardContent } from "@/components/ui/card";
import { ItemGroup, ItemSeparator } from "@/components/ui/item";
import { Separator } from "@/components/ui/separator";
import { Timeline, TimelineItem } from "@/components/ui/timeline";
import { TooltipProvider } from "@/components/ui/tooltip";
import {
  caseOverviewModel,
  type OverviewHearingStatus,
  type OverviewNextHearing,
  type OverviewTask,
  type OverviewUpdate,
} from "@/lib/cases/overview";
import { caseSectionHref } from "@/lib/cases/sections";
import { type CaseRecord } from "@/lib/cases/types";

const BOND_TASK_ID = "bond";
const CONSENT_TASK_ID = "removal-consent";

/**
 * Overview is two panels (§5): where the case stands (next hearing, then the
 * last three updates) and what is owed on it (pending tasks). The hearing
 * block never drops out, so the hearings record stays reachable on a case
 * with nothing listed, disposed ones included (OVW-04).
 */
export function CaseOverview({
  record,
  now,
}: {
  record: CaseRecord;
  now: number;
}) {
  const model = caseOverviewModel(record, now);
  const [archived, setArchived] = useState<string[]>([]);

  /* Archiving moves a task to the Archive tab of the Pending tasks page. The
     prototype keeps it in memory, so Undo is the way back. */
  function archive(id: string, title: string) {
    setArchived((current) => [...current, id]);
    toast("Task archived", {
      position: "bottom-center",
      description: `${title}. You can find it under Take action, Archive.`,
      action: {
        label: "Undo",
        onClick: () =>
          setArchived((current) => current.filter((item) => item !== id)),
      },
    });
  }

  const bondVisible = useBondTaskVisible();
  const bondTask =
    /* A disposed case takes no fresh bail filings, so it owes no bond. */
    bondVisible && !record.disposal && !archived.includes(BOND_TASK_ID) ? (
      <BondTaskRow
        nextHearingOn={record.nextHearing?.on ?? null}
        now={now}
        onArchive={() => archive(BOND_TASK_ID, "Bail bond")}
      />
    ) : null;
  const removalConsent = useRemovalConsentTask(record.id, () =>
    archive(CONSENT_TASK_ID, "Respond to a removal request")
  );
  const consentTask =
    removalConsent.visible && !archived.includes(CONSENT_TASK_ID)
      ? removalConsent.row
      : null;
  const tasks = model.tasks.filter((task) => !archived.includes(task.id));

  return (
    <TooltipProvider>
      <div className="grid min-w-0 grid-cols-1 items-start gap-4 lg:grid-cols-2">
        <RestingCard className="gap-4">
          <CardContent>
            <NextHearingBlock record={record} next={model.nextHearing} />
          </CardContent>
          {model.updates.length > 0 ? (
            <>
              <Separator className="bg-hairline" />
              <CardContent>
                <CaseUpdatesBlock record={record} updates={model.updates} />
              </CardContent>
            </>
          ) : null}
        </RestingCard>
        <RestingCard>
          <CardContent>
            <PendingTasksBlock
              tasks={tasks}
              caption={model.tasksCaption}
              bondTask={bondTask}
              consentTask={consentTask}
              onArchive={archive}
            />
          </CardContent>
        </RestingCard>
      </div>
    </TooltipProvider>
  );
}

const NEXT_HEARING_HEADING = "overview-next-hearing";
const PENDING_TASKS_HEADING = "overview-pending-tasks";
const CASE_UPDATES_HEADING = "overview-case-updates";

/** A block's title with its one route out opposite. */
function BlockHeader({
  id,
  title,
  count,
  action,
}: {
  id: string;
  title: string;
  count?: number;
  action?: ReactNode;
}) {
  return (
    <div className="flex min-w-0 flex-wrap items-center justify-between gap-x-4 gap-y-1">
      <div className="flex min-w-0 items-center gap-2">
        <h2 id={id} className="text-body font-semibold text-foreground">
          {title}
        </h2>
        {count === undefined ? null : (
          <Badge variant="secondary" className="tabular-nums">
            {count}
          </Badge>
        )}
      </div>
      {action}
    </div>
  );
}

/** Line height at rest; the `after:` inset carries the 40px target. */
const BLOCK_LINK =
  "relative h-6 px-0 text-body-compact after:absolute after:-inset-x-2 after:-inset-y-2";

/**
 * Info and success stroke in their own colour; warning strokes in its ink,
 * because the warning hue stays under 3:1 on the sunken well in light theme
 * (ACCESSIBILITY 6).
 */
const WELL_CHIP_STROKE: Record<OverviewHearingStatus["variant"], string> = {
  info: "border-info",
  success: "border-success",
  warning: "border-warning-ink",
  secondary: "border-border",
};

function NextHearingBlock({
  record,
  next,
}: {
  record: CaseRecord;
  next: OverviewNextHearing;
}) {
  const [hearingsOpen, setHearingsOpen] = useState(false);
  const hearingsTriggerRef = useRef<HTMLAnchorElement | null>(null);
  const tile = next.tile;

  return (
    <section
      aria-labelledby={NEXT_HEARING_HEADING}
      className="@container flex min-w-0 flex-col gap-3"
    >
      <BlockHeader
        id={NEXT_HEARING_HEADING}
        title="Next hearing"
        action={
          /* Opens the hearings record over the case. Still an anchor with a
             real href, so modified clicks open the page they always have. */
          <Button variant="link" asChild className={BLOCK_LINK}>
            <Link
              ref={hearingsTriggerRef}
              href={caseSectionHref(record.id, "hearings")}
              onClick={(event) => {
                if (
                  event.defaultPrevented ||
                  event.metaKey ||
                  event.ctrlKey ||
                  event.shiftKey ||
                  event.altKey ||
                  event.button !== 0
                ) {
                  return;
                }
                event.preventDefault();
                setHearingsOpen(true);
              }}
            >
              View All Hearings
            </Link>
          </Button>
        }
      />

      {tile ? (
        /* The split is keyed to the well's own width, not the viewport's, and
           `@sm` is in rem, so at 200% text zoom it stacks instead of squeezing
           the purpose into a sliver (ACCESSIBILITY 10). */
        <div className="flex min-w-0 flex-col gap-3 rounded-lg bg-surface-sunken p-4 @sm:flex-row @sm:items-center @sm:gap-4">
          {/* One date, so one `<time>`: the face is split for the eye and the
              accessible name carries it whole. */}
          <time
            dateTime={tile.iso}
            className="flex shrink-0 items-center gap-3 @sm:w-36"
          >
            <span className="sr-only">{tile.full}</span>
            <span
              aria-hidden
              className="text-title font-semibold tabular-nums text-foreground"
            >
              {tile.day}
            </span>
            <span aria-hidden className="flex flex-col">
              {/* Month and year lead: with the day numeral they are the date.
                  The weekday is the aid, so it takes the quiet line. */}
              <span className="text-body-compact font-medium text-foreground">
                {tile.monthYear}
              </span>
              <span className="text-caption font-medium text-muted-foreground">
                {tile.weekday}
              </span>
            </span>
          </time>

          <Separator
            orientation="vertical"
            className="bg-hairline @max-sm:hidden"
          />

          <div className="flex min-w-0 flex-1 flex-col gap-1.5">
            <div className="flex flex-wrap items-center gap-1.5 empty:hidden">
              {tile.today ? (
                <Badge variant="warning" className={WELL_CHIP_STROKE.warning}>
                  Today
                </Badge>
              ) : null}
              {next.status ? (
                <Badge
                  variant={next.status.variant}
                  className={WELL_CHIP_STROKE[next.status.variant]}
                >
                  {next.status.label}
                </Badge>
              ) : null}
            </div>
            {/* Never clamped: this is the clause the day exists for, and it
                runs longer in Indic scripts (ACCESSIBILITY 13). */}
            {next.purpose ? (
              <p className="text-body-compact font-medium text-foreground">
                {next.purpose}
              </p>
            ) : null}
          </div>
        </div>
      ) : (
        <div className="flex min-w-0 flex-col gap-1 rounded-lg bg-surface-sunken p-4">
          <p className="text-body-compact font-medium text-foreground">
            {next.on}
          </p>
          {next.last ? (
            <p className="text-caption font-medium text-muted-foreground">
              Last heard on {next.last.on}
              {next.last.purpose ? ` · ${next.last.purpose}` : null}
            </p>
          ) : null}
        </div>
      )}

      <CaseHearingsDialog
        record={record}
        open={hearingsOpen}
        onOpenChange={setHearingsOpen}
        triggerRef={hearingsTriggerRef}
      />
    </section>
  );
}

function CaseUpdatesBlock({
  record,
  updates,
}: {
  record: CaseRecord;
  updates: OverviewUpdate[];
}) {
  return (
    <section
      id="case-timeline"
      aria-labelledby={CASE_UPDATES_HEADING}
      className="flex min-w-0 scroll-mt-6 flex-col gap-3"
    >
      <BlockHeader
        id={CASE_UPDATES_HEADING}
        title="Case updates"
        action={
          <Button variant="link" asChild className={BLOCK_LINK}>
            <Link href={caseSectionHref(record.id, "case-history")}>
              View all updates
            </Link>
          </Button>
        }
      />
      <Timeline aria-label="Case updates, newest first">
        {updates.map((update) => (
          <TimelineItem key={update.id} status={update.status}>
            {/* The whole row is the link, bled out so the hover fill clears
                the text while the text stays on the column. */}
            <Link
              href={update.href}
              className="-mx-2 -my-1.5 flex min-h-10 min-w-0 flex-col gap-1 rounded-lg px-2 py-1.5 outline-none hover:bg-surface-sunken focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <p className="text-body-compact font-medium text-foreground">
                {update.title}
              </p>
              <span className="flex flex-wrap items-center gap-2">
                <Badge variant="secondary">{update.category}</Badge>
                <span className="text-caption font-medium tabular-nums text-muted-foreground">
                  {update.date}
                </span>
              </span>
            </Link>
          </TimelineItem>
        ))}
      </Timeline>
    </section>
  );
}

function PendingTasksBlock({
  tasks,
  caption,
  bondTask,
  consentTask,
  onArchive,
}: {
  tasks: OverviewTask[];
  caption: string | null;
  bondTask?: ReactNode;
  consentTask?: ReactNode;
  onArchive: (id: string, title: string) => void;
}) {
  const count = tasks.length + (bondTask ? 1 : 0) + (consentTask ? 1 : 0);
  return (
    <section
      aria-labelledby={PENDING_TASKS_HEADING}
      className="flex min-w-0 flex-col gap-1"
    >
      <BlockHeader
        id={PENDING_TASKS_HEADING}
        title="Take action"
        count={count}
      />
      {count === 0 ? (
        <p className="pt-2 text-body-compact text-muted-foreground">
          Nothing is pending on this case.
        </p>
      ) : (
        <>
          {caption ? (
            <p className="text-caption font-medium text-muted-foreground">
              {caption}
            </p>
          ) : null}
          {/* One divided list, not N stacked panels. */}
          <ItemGroup aria-label="Take action">
            {consentTask}
            {tasks.map((task, index) => (
              <Fragment key={task.id}>
                {index > 0 || consentTask ? (
                  <ItemSeparator className={cn("my-0 bg-hairline", REGISTER_TABLE_ONLY)} />
                ) : null}
                <PendingTaskRow
                  title={task.title}
                  respond={{
                    href: task.respondHref ?? task.action?.href ?? task.href,
                  }}
                  onArchive={() => onArchive(task.id, task.title)}
                >
                  {task.due ? <DueStatusLine {...task.due} /> : null}
                  {task.detail ? <TaskNote>{task.detail}</TaskNote> : null}
                </PendingTaskRow>
              </Fragment>
            ))}
            {bondTask ? (
              <>
                {tasks.length > 0 || consentTask ? (
                  <ItemSeparator className={cn("my-0 bg-hairline", REGISTER_TABLE_ONLY)} />
                ) : null}
                {bondTask}
              </>
            ) : null}
          </ItemGroup>
        </>
      )}
    </section>
  );
}
