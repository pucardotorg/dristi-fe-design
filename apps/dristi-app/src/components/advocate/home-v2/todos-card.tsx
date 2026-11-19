"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowRightIcon, BookmarkIcon, CheckCheckIcon, ChevronDownIcon, RotateCcwClockIcon, UserCheckIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { PageOutcome } from "@/components/ui/outcome";
import { SegmentedControl, SegmentedControlItem } from "@/components/ui/segmented-control";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { HOME_CALENDAR, type HomeTask, type MustDoGroup, daysBetween, mustDo, waitingOnYou } from "@/lib/advocate/home-dashboard";
import { cn } from "@/lib/utils";

/** Waiting on you shows at least six rows (more when Urgent leaves room); each Urgent group two. */
const ROWS = 6;
const PER_GROUP = 2;
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

  /* Each Urgent group shows its first two rows and its own "Show N more", so every group's
     heading and first tasks are always in view (owner, 2026-11-19). Waiting on you is one list:
     six rows, then its own "Show N more". Each opens in place, as Your hearings does. */
  const [open, setOpen] = React.useState<Record<string, boolean>>({});
  const toggle = (key: string) => setOpen((o) => ({ ...o, [key]: !o[key] }));

  /* Waiting on you fills the height Urgent sets, as many rows as fit, rather than a fixed six
     (owner, 2026-11-19); its "Show N more" sits in the footer. Measured, so it holds at any width. */
  const urgentRef = React.useRef<HTMLDivElement>(null);
  const waitingRef = React.useRef<HTMLUListElement>(null);
  const [fit, setFit] = React.useState(ROWS);
  React.useLayoutEffect(() => {
    const u = urgentRef.current;
    if (!u) return;
    const measure = () => {
      const row = waitingRef.current?.querySelector("li")?.offsetHeight;
      if (!row) return;
      setFit(Math.max(ROWS, Math.floor(u.offsetHeight / row)));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(u);
    return () => ro.disconnect();
  }, []);
  const waitingShown = open.waiting ? waiting : waiting.slice(0, fit);
  const waitingMore = waiting.length - Math.min(waiting.length, fit);

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
          /* Switching tabs closes anything opened with "Show N more", so the hidden tab is always
             short and only the tab in view can make the card grow (owner, 2026-11-19: an opened
             Waiting list kept Urgent's card tall). */
          onValueChange={(v) => {
            if (!v) return;
            setTab(v as Tab);
            setOpen({});
          }}
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
          ref={urgentRef}
          className={cn("flex min-w-0 flex-col gap-3 self-start [grid-area:1/1]", tab !== "urgent" && "pointer-events-none opacity-0")}
          aria-hidden={tab !== "urgent" || undefined}
          inert={tab !== "urgent"}
        >
          {urgentCount ? (
            <>
              <div className="flex flex-col">
                {groups
                  .filter((g) => g.tasks.length)
                  .map((g) => (
                    <section
                      key={g.key}
                      aria-labelledby={`todo-${g.key}`}
                      className="flex flex-col not-first:mt-1 not-first:border-t not-first:border-hairline not-first:pt-4"
                    >
                      <h3 id={`todo-${g.key}`} className={cn("text-body-compact font-semibold", TONE[g.key].ink)}>
                        {/* Each group's full count rides its heading (owner, 2026-11-19: the legend row
                            above went, to give the rows its space). */}
                        {g.label} · <span className="tabular-nums">{g.tasks.length}</span>
                      </h3>
                      <ul className="flex flex-col">
                        {(open[g.key] ? g.tasks : g.tasks.slice(0, PER_GROUP)).map((t) => (
                          <UrgentRow key={t.id} task={t} group={g} today={today} onAct={onAct} />
                        ))}
                      </ul>
                      <MoreToggle total={g.tasks.length} cap={PER_GROUP} open={!!open[g.key]} onToggle={() => toggle(g.key)} />
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
              <ul ref={waitingRef} className="flex flex-col">
                {waitingShown.map((t) => (
                  <WaitingRow key={t.id} task={t} today={today} onAct={onAct} />
                ))}
              </ul>
            </>
          ) : (
            <Empty icon={UserCheckIcon} title="Nobody is waiting on you" body="Nothing prepared for you or asked of you is open." />
          )}
        </div>
      </CardContent>

      {/* Footer as on Your hearings: Waiting on you's "Show N more" on the left (Urgent's groups open
          their own, above), where every task lives on the right. */}
      <CardFooter className="justify-between gap-4 py-3">
        {tab === "waiting" && (waitingMore > 0 || open.waiting) ? (
          <Button variant="ghost" size="sm" className="-ml-3" aria-expanded={!!open.waiting} onClick={() => toggle("waiting")}>
            {open.waiting ? "Show fewer" : `Show ${waitingMore} more`}
            <ChevronDownIcon
              data-icon="inline-end"
              aria-hidden="true"
              className={cn("motion-safe:transition-transform", open.waiting && "rotate-180")}
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

/** "Show 3 more ⌄" under a section, "Show fewer ⌃" once open; nothing when all already fit. */
function MoreToggle({ total, cap, open, onToggle }: { total: number; cap: number; open: boolean; onToggle: () => void }) {
  if (total <= cap) return null;
  const more = total - cap;
  return (
    /* Your hearings' own "Show N more courts" button, so it reads as a control, not a caption. */
    <Button variant="ghost" size="sm" className="-ml-3 self-start" aria-expanded={open} onClick={onToggle}>
      {open ? "Show fewer" : `Show ${more} more`}
      <ChevronDownIcon
        data-icon="inline-end"
        aria-hidden="true"
        className={cn("motion-safe:transition-transform", open && "rotate-180")}
      />
    </Button>
  );
}

function Count({ n }: { n: number }) {
  return <span className="ml-1.5 tabular-nums text-muted-foreground">{n}</span>;
}

function UrgentRow({ task: t, group, today, onAct }: { task: HomeTask; group: MustDoGroup; today: string; onAct: (t: HomeTask) => void }) {
  /* Only overdue rows say when: "Due today" and "Due tomorrow" rows sit under headings that
     already say it (owner, 2026-11-19). */
  const late = group.key === "overdue" ? daysBetween(t.dueOn!, today) : 0;
  return (
    <Row
      task={t}
      onAct={onAct}
      detail={<span className="truncate">{t.caseTitle}</span>}
      flag={
        t.blocks ? (
          /* Short, no icon (owner, 2026-11-19: the long line and the gavel didn't read). The amber
             tag under Due today says a hearing today needs this; the full sentence is on hover and
             for screen readers. */
          <Badge
            variant="warning"
            className="h-auto max-w-full py-0.5 whitespace-normal"
            title={`Needed for item ${t.blocks.item} at ${t.blocks.court} today`}
          >
            <span className="sr-only">Needed today </span>
            For item {t.blocks.item} · {t.blocks.court}
          </Badge>
        ) : null
      }
      when={
        group.key === "overdue" ? (
          <span className="font-semibold text-destructive-ink">
            {late} {late === 1 ? "day" : "days"} late
          </span>
        ) : null
      }
    />
  );
}

/** "Today" · "5D" (under a month) · "2M" (30 days and more). */
export function waitAge(days: number): string {
  if (days <= 0) return "Today";
  if (days < 30) return `${days}D`;
  return `${Math.floor(days / 30)}M`;
}
function waitWords(days: number): string {
  if (days < 30) return `${days} ${days === 1 ? "day" : "days"}`;
  const m = Math.floor(days / 30);
  return `${m} ${m === 1 ? "month" : "months"}`;
}

/** "Waiting for 5 days, since 14 Nov" · "Waiting since today". */
function waitLine(days: number, since: string): string {
  if (days <= 0) return "Waiting since today";
  const on = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short" }).format(new Date(since));
  return `Waiting for ${waitWords(days)}, since ${on}`;
}

function WaitingRow({ task: t, today, onAct }: { task: HomeTask; today: string; onAct: (t: HomeTask) => void }) {
  const days = daysBetween(t.waiting!.since.slice(0, 10), today);
  return (
    <Row
      task={t}
      onAct={onAct}
      detail={
        /* Bookmark, then the case, then who (owner, 2026-11-19), as the Urgent rows lead with
           the case. */
        <span className="truncate">
          {t.caseTitle} · {t.waiting!.how === "prepared" ? "Prepared by" : "Raised by"} {t.waiting!.by}
        </span>
      }
      when={
        /* A clock and a short age: "Today", "5D", "2M" (owner, 2026-11-19). Hover gives it in words
           with the day it started; screen readers get the same. No bold: the list is already
           ordered bookmarked first, then longest wait (owner, 2026-11-19). */
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="inline-flex items-center justify-end gap-1">
              {/* The clock from a case's header (its history button), Dristi's "time since" mark. */}
              <RotateCcwClockIcon aria-hidden="true" className="size-3.5 shrink-0" />
              <span aria-hidden="true">{waitAge(days)}</span>
              <span className="sr-only">{waitLine(days, t.waiting!.since)}</span>
            </span>
          </TooltipTrigger>
          <TooltipContent>{waitLine(days, t.waiting!.since)}</TooltipContent>
        </Tooltip>
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
  when?: React.ReactNode;
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
      {when ? (
        <span className="w-20 shrink-0 text-right text-caption text-muted-foreground tabular-nums max-sm:w-auto">{when}</span>
      ) : null}
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
