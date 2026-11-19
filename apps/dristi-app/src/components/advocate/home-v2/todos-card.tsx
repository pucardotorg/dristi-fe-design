"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowRightIcon, BookmarkIcon, CheckCheckIcon, ChevronDownIcon, GavelIcon, UserCheckIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { PageOutcome } from "@/components/ui/outcome";
import { SegmentedControl, SegmentedControlItem } from "@/components/ui/segmented-control";
import { HOME_CALENDAR, type HomeTask, type MustDoGroup, daysBetween, mustDo, waitingOnYou } from "@/lib/advocate/home-dashboard";
import { cn } from "@/lib/utils";

/** Rows shown per tab (filled in group order on Urgent); the rest are in Take action. */
const ROWS = 6;
const TASKS_HREF = "/tasks";

type Tab = "urgent" | "waiting";

/** Each group's heading ink. */
const TONE: Record<MustDoGroup["key"], { ink: string }> = {
  overdue: { ink: "text-destructive-ink" },
  today: { ink: "text-warning-ink" },
  tomorrow: { ink: "text-muted-foreground" },
};

/**
 * Card 2 of draft 2, "Your to-dos" (owner, 2026-11-19): Must do today and Waiting on you in one
 * card, a toggle between the two reasons something is yours to do. It sits under Your hearings.
 * - Urgent (decided by a date): Overdue, Due today and the next working day as groups split by
 *   hairlines, each heading carrying its count. Overdue oldest first; anything needed for a hearing today
 *   tops its group. Bookmarked tasks are marked, never moved.
 * - Waiting on you (decided by a person, no pressing date): bookmarked first, then longest wait.
 * Each task appears in one tab only (the shared rules in lib/advocate/home-dashboard).
 * A row: the task and its case (and, if a hearing today needs it, an amber tag saying so), the
 * timing in its own right-aligned column, and the task's own verb, which acts in place.
 */
export function TodosCard({
  tasks,
  today,
  onAct,
  className,
}: {
  tasks: HomeTask[];
  today: string;
  onAct: (t: HomeTask) => void;
  className?: string;
}) {
  const groups = React.useMemo(() => mustDo(HOME_CALENDAR, tasks, today), [tasks, today]);
  const waiting = React.useMemo(() => waitingOnYou(HOME_CALENDAR, tasks, today), [tasks, today]);
  const urgentCount = groups.reduce((n, g) => n + g.tasks.length, 0);
  const pressing = groups.filter((g) => g.key !== "tomorrow").reduce((n, g) => n + g.tasks.length, 0);
  /* Opens on Urgent when anything is overdue or due today, otherwise on Waiting on you. */
  const [tab, setTab] = React.useState<Tab>(() => (pressing > 0 || !waiting.length ? "urgent" : "waiting"));

  /* "Show N more" opens a tab's whole list in place, as Your hearings does with its courts. */
  const [all, setAll] = React.useState<Record<Tab, boolean>>({ urgent: false, waiting: false });

  /* Overdue and due today always show in full: hiding either would hide what is pressing (owner,
     2026-11-19). The next working day fills what is left of the six rows; the rest wait behind
     "Show N more". */
  const shown = groups.map((g) => ({
    ...g,
    shown: all.urgent || g.key !== "tomorrow" ? g.tasks : g.tasks.slice(0, Math.max(0, ROWS - pressing)),
  }));
  const hidden = {
    urgent: urgentCount - shown.reduce((n, g) => n + g.shown.length, 0),
    waiting: all.waiting ? 0 : Math.max(0, waiting.length - ROWS),
  };
  const expandable = hidden[tab] > 0 || all[tab];

  return (
    <Card variant="raised" role="region" aria-labelledby="home-todos" className={cn("w-full min-w-0 gap-4", className)}>
      {/* Title left, the toggle across the right half (owner: it was too small); stacked on phones. */}
      <CardHeader className="flex flex-wrap items-center justify-between gap-3">
        <CardTitle>
          <h2 id="home-todos" className="text-body font-semibold">
            Your to-dos
          </h2>
        </CardTitle>
        <SegmentedControl
          type="single"
          value={tab}
          onValueChange={(v) => v && setTab(v as Tab)}
          aria-label="Which to-dos"
          /* Compact (32px well) so it's slimmer than a form control, with each pill filling its
             half end to end; the DS compact pill hugs its label by default (owner, 2026-11-19). */
          size="compact"
          className="w-full sm:w-1/2 [&>*]:flex-1 [&>*>span]:w-full"
        >
          <SegmentedControlItem value="urgent">
            Urgent <Count n={urgentCount} />
          </SegmentedControlItem>
          <SegmentedControlItem value="waiting">
            Waiting on you <Count n={waiting.length} />
          </SegmentedControlItem>
        </SegmentedControl>
      </CardHeader>

      {/* Both tabs drawn in one grid cell, the inactive one hidden, so the card is always as tall as
          its taller tab and switching never moves the page (owner, 2026-11-19). */}
      <CardContent className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)]">
        <div
          className={cn("flex min-w-0 flex-col gap-3 [grid-area:1/1]", tab !== "urgent" && "pointer-events-none opacity-0")}
          aria-hidden={tab !== "urgent" || undefined}
          inert={tab !== "urgent"}
        >
          {urgentCount ? (
            <>
              <div className="flex flex-col">
                {shown
                  .filter((g) => g.shown.length)
                  .map((g) => (
                    <section
                      key={g.key}
                      aria-labelledby={`todo-${g.key}`}
                      className="flex flex-col not-first:mt-1 not-first:border-t not-first:border-hairline not-first:pt-3"
                    >
                      <h3 id={`todo-${g.key}`} className={cn("text-caption font-semibold", TONE[g.key].ink)}>
                        {/* Each group's full count rides its heading (owner, 2026-11-19: the legend row
                            above went, to give the rows its space). */}
                        {g.label} · <span className="tabular-nums">{g.tasks.length}</span>
                      </h3>
                      <ul className="flex flex-col">
                        {g.shown.map((t) => (
                          <UrgentRow key={t.id} task={t} group={g} today={today} onAct={onAct} />
                        ))}
                      </ul>
                    </section>
                  ))}
              </div>
            </>
          ) : (
            <Empty icon={CheckCheckIcon} title="Nothing urgent" body="Nothing is overdue or due before the next working day." />
          )}
        </div>
        <div
          className={cn("flex min-w-0 flex-col gap-3 [grid-area:1/1]", tab !== "waiting" && "pointer-events-none opacity-0")}
          aria-hidden={tab !== "waiting" || undefined}
          inert={tab !== "waiting"}
        >
          {waiting.length ? (
            <>
              <p className="text-caption font-medium text-muted-foreground tabular-nums">{waitingSummary(waiting, today)}</p>
              <ul className="flex flex-col">
                {(all.waiting ? waiting : waiting.slice(0, ROWS)).map((t) => (
                  <WaitingRow key={t.id} task={t} today={today} onAct={onAct} />
                ))}
              </ul>
            </>
          ) : (
            <Empty icon={UserCheckIcon} title="Nobody is waiting on you" body="Nothing prepared for you or asked of you is open." />
          )}
        </div>
      </CardContent>

      {/* Footer as on Your hearings: what's left on the left, where it all lives on the right. */}
      <CardFooter className="justify-between gap-4 py-3">
        {expandable ? (
          <Button
            variant="ghost"
            size="sm"
            className="-ml-3"
            aria-expanded={all[tab]}
            onClick={() => setAll((a) => ({ ...a, [tab]: !a[tab] }))}
          >
            {all[tab] ? "Show fewer" : `Show ${hidden[tab]} more ${hidden[tab] === 1 ? "task" : "tasks"}`}
            <ChevronDownIcon
              data-icon="inline-end"
              aria-hidden="true"
              className={cn("motion-safe:transition-transform", all[tab] && "rotate-180")}
            />
          </Button>
        ) : (
          <span />
        )}
        <Button asChild variant="outline" size="sm" className="-mr-3">
          <Link href={tab === "waiting" ? `${TASKS_HREF}?view=waiting` : TASKS_HREF}>
            {/* Named for what it opens, like Recent cases' "All cases" (owner, 2026-11-19). */}
            All tasks
            <ArrowRightIcon data-icon="inline-end" aria-hidden="true" />
          </Link>
        </Button>
      </CardFooter>
    </Card>
  );
}

function Count({ n }: { n: number }) {
  return <span className="ml-1.5 tabular-nums text-muted-foreground">{n}</span>;
}

function waitingSummary(tasks: HomeTask[], today: string) {
  const people = new Set(tasks.map((t) => t.waiting!.by)).size;
  const longest = Math.max(...tasks.map((t) => daysBetween(t.waiting!.since.slice(0, 10), today)));
  return `${people} ${people === 1 ? "person" : "people"} waiting · longest ${longest === 0 ? "since today" : `${longest} ${longest === 1 ? "day" : "days"}`}`;
}

function UrgentRow({ task: t, group, today, onAct }: { task: HomeTask; group: MustDoGroup; today: string; onAct: (t: HomeTask) => void }) {
  const late = group.key === "overdue" ? daysBetween(t.dueOn!, today) : 0;
  const when =
    group.key === "overdue"
      ? `${late} ${late === 1 ? "day" : "days"} late`
      : group.key === "today"
        ? "Today"
        : group.label.replace(/^Due (\w)/, (_, c: string) => c.toUpperCase());
  return (
    <Row
      task={t}
      onAct={onAct}
      detail={<span className="truncate">{t.caseTitle}</span>}
      flag={
        t.blocks ? (
          /* In words (owner: the gavel alone didn't say it): a hearing today needs this done. */
          <Badge variant="warning" className="h-auto max-w-full py-0.5 whitespace-normal">
            <GavelIcon data-icon="inline-start" aria-hidden="true" />
            Needed for item {t.blocks.item} at {t.blocks.court} today
          </Badge>
        ) : null
      }
      when={<span className={group.key === "overdue" ? "font-semibold text-destructive-ink" : undefined}>{when}</span>}
    />
  );
}

function WaitingRow({ task: t, today, onAct }: { task: HomeTask; today: string; onAct: (t: HomeTask) => void }) {
  const days = daysBetween(t.waiting!.since.slice(0, 10), today);
  return (
    <Row
      task={t}
      onAct={onAct}
      detail={
        <span className="truncate">
          {t.waiting!.how === "prepared" ? "Prepared by" : "Raised by"} {t.waiting!.by} · {t.caseTitle}
        </span>
      }
      when={
        <span className={days >= 3 ? "font-semibold text-foreground" : undefined}>
          {days === 0 ? "Today" : `${days} ${days === 1 ? "day" : "days"}`}
        </span>
      }
    />
  );
}

/**
 * The shared row: the task and a detail line (plus an optional flag) on the left, the timing in
 * its own right-aligned column so it scans straight down, then the task's own verb.
 */
function Row({
  task: t,
  detail,
  flag,
  when,
  onAct,
}: {
  task: HomeTask;
  detail: React.ReactNode;
  flag?: React.ReactNode;
  when: React.ReactNode;
  onAct: (t: HomeTask) => void;
}) {
  return (
    <li className="flex items-center gap-4 py-3">
      <div className="flex min-w-0 flex-1 flex-col items-start gap-1">
        <p className="line-clamp-2 w-full text-body-compact font-medium" title={t.title}>
          {t.title}
        </p>
        <span className="flex w-full min-w-0 items-center gap-1.5 text-caption text-muted-foreground">
          {t.bookmarked ? (
            <>
              <BookmarkIcon aria-hidden="true" className="size-3.5 shrink-0 fill-current" />
              <span className="sr-only">Bookmarked case. </span>
            </>
          ) : null}
          {detail}
        </span>
        {flag}
      </div>
      <span className="w-20 shrink-0 text-right text-caption text-muted-foreground tabular-nums max-sm:w-auto">{when}</span>
      <Button
        variant="outline"
        size="xs"
        className="w-16 shrink-0 pointer-coarse:h-10 pointer-coarse:px-4"
        onClick={() => onAct(t)}
      >
        {t.verb}
        <span className="sr-only">: {t.title}</span>
      </Button>
    </li>
  );
}

/** An empty tab: the DS neutral outcome, as on the other cards, stepped down to sit in a card. */
function Empty({ icon, title, body }: { icon: React.ComponentProps<typeof PageOutcome>["icon"]; title: string; body: string }) {
  return (
    <div className="flex flex-1 items-center justify-center py-6">
      <PageOutcome tone="neutral" icon={icon} as="p" still title={title} body={body} className="py-0 [&_p:first-of-type]:text-body" />
    </div>
  );
}
