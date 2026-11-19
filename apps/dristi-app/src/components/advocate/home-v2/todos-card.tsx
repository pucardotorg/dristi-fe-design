"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowRightIcon, BookmarkIcon, CheckCheckIcon, GavelIcon, UserCheckIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { PageOutcome } from "@/components/ui/outcome";
import { SegmentedControl, SegmentedControlItem } from "@/components/ui/segmented-control";
import { HOME_CALENDAR, type HomeTask, type MustDoGroup, daysBetween, mustDo, waitingOnYou } from "@/lib/advocate/home-dashboard";
import { cn } from "@/lib/utils";

/** Rows shown per tab; the rest are in Take action. */
const ROWS = 4;
const TASKS_HREF = "/tasks";

type Tab = "urgent" | "waiting";

/** The edge colour for an urgent row: red overdue, amber today, grey tomorrow. */
const EDGE: Record<MustDoGroup["key"], string> = {
  overdue: "bg-destructive",
  today: "bg-warning",
  tomorrow: "bg-muted-foreground/40",
};

/**
 * Card 2 of draft 2, "Your to-dos" (owner, 2026-11-19): Must do today and Waiting on you in one
 * card, a toggle between the two reasons something is yours to do.
 * - Urgent: decided by a date. Overdue (oldest first), due today (anything blocking a hearing
 *   today on top), then the next working day. Bookmarked tasks are marked, never moved.
 * - Waiting on you: decided by a person, with no pressing date. Bookmarked first, then longest
 *   wait. Each task appears in one tab only (the shared rules in lib/advocate/home-dashboard).
 * Four rows, then Take action. Each row's button is the task's own verb and acts in place.
 */
export function TodosCard({ tasks, today, onAct }: { tasks: HomeTask[]; today: string; onAct: (t: HomeTask) => void }) {
  const groups = React.useMemo(() => mustDo(HOME_CALENDAR, tasks, today), [tasks, today]);
  const urgent = React.useMemo(() => groups.flatMap((g) => g.tasks.map((t) => ({ task: t, group: g }))), [groups]);
  const waiting = React.useMemo(() => waitingOnYou(HOME_CALENDAR, tasks, today), [tasks, today]);
  const pressing = (groups.find((g) => g.key === "overdue")?.tasks.length ?? 0) + (groups.find((g) => g.key === "today")?.tasks.length ?? 0);
  /* Opens on Urgent when anything is overdue or due today, otherwise on Waiting on you. */
  const [tab, setTab] = React.useState<Tab>(() => (pressing > 0 || !waiting.length ? "urgent" : "waiting"));

  const total = tab === "urgent" ? urgent.length : waiting.length;
  const more = Math.max(0, total - ROWS);

  return (
    <Card variant="raised" role="region" aria-labelledby="home-todos" className="w-full min-w-0 gap-2 xl:h-full">
      <CardHeader className="gap-2">
        <CardTitle>
          <h2 id="home-todos" className="text-body font-semibold">
            Your to-dos
          </h2>
        </CardTitle>
        <SegmentedControl
          type="single"
          size="compact"
          value={tab}
          onValueChange={(v) => v && setTab(v as Tab)}
          aria-label="Which to-dos"
          className="w-full [&>*]:flex-1"
        >
          <SegmentedControlItem value="urgent">
            Urgent <Count n={urgent.length} />
          </SegmentedControlItem>
          <SegmentedControlItem value="waiting">
            Waiting on you <Count n={waiting.length} />
          </SegmentedControlItem>
        </SegmentedControl>
      </CardHeader>

      <CardContent className="flex min-h-0 flex-1 flex-col gap-1">
        {tab === "urgent" ? (
          urgent.length ? (
            <>
              <Summary>{urgentSummary(groups)}</Summary>
              <ul className="flex flex-col divide-y divide-hairline">
                {urgent.slice(0, ROWS).map(({ task, group }) => (
                  <UrgentRow key={task.id} task={task} group={group} today={today} onAct={onAct} />
                ))}
              </ul>
            </>
          ) : (
            <Empty icon={CheckCheckIcon} title="Nothing urgent" body="Nothing is overdue or due before the next working day." />
          )
        ) : waiting.length ? (
          <>
            <Summary>{waitingSummary(waiting, today)}</Summary>
            <ul className="flex flex-col divide-y divide-hairline">
              {waiting.slice(0, ROWS).map((t) => (
                <WaitingRow key={t.id} task={t} today={today} onAct={onAct} />
              ))}
            </ul>
          </>
        ) : (
          <Empty icon={UserCheckIcon} title="Nobody is waiting on you" body="Nothing prepared for you or asked of you is open." />
        )}
      </CardContent>

      {/* Footer as on Your hearings: what's left on the left, where it all lives on the right. */}
      <CardFooter className="justify-between gap-4 py-3">
        {more ? <span className="text-caption font-medium text-muted-foreground tabular-nums">+{more} more</span> : <span />}
        <Button asChild variant="outline" size="sm" className="-mr-3">
          <Link href={tab === "waiting" ? `${TASKS_HREF}?view=waiting` : TASKS_HREF}>
            Take action
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

/** One line that reads the whole tab at a glance. */
function Summary({ children }: { children: React.ReactNode }) {
  return <p className="text-caption font-medium text-muted-foreground tabular-nums">{children}</p>;
}

function urgentSummary(groups: MustDoGroup[]) {
  const word = (g: MustDoGroup) => (g.key === "overdue" ? "overdue" : g.key === "today" ? "today" : g.label.replace(/^Due /, "").toLowerCase());
  return groups
    .filter((g) => g.tasks.length)
    .map((g) => `${g.tasks.length} ${word(g)}`)
    .join(" · ");
}

function waitingSummary(tasks: HomeTask[], today: string) {
  const people = new Set(tasks.map((t) => t.waiting!.by)).size;
  const longest = Math.max(...tasks.map((t) => daysBetween(t.waiting!.since.slice(0, 10), today)));
  return `${people} ${people === 1 ? "person" : "people"} waiting · longest ${longest === 0 ? "since today" : `${longest} ${longest === 1 ? "day" : "days"}`}`;
}

/**
 * An urgent row: a coloured edge (red overdue, amber today, grey tomorrow), the task, then the
 * case on the left and the due cue pinned right. A task that blocks a hearing today says so in
 * place of the case: it is the most urgent fact, so it's spelled out, not left to a hover.
 */
function UrgentRow({ task: t, group, today, onAct }: { task: HomeTask; group: MustDoGroup; today: string; onAct: (t: HomeTask) => void }) {
  const late = group.key === "overdue" ? daysBetween(t.dueOn!, today) : 0;
  const due =
    group.key === "overdue"
      ? `${late} ${late === 1 ? "day" : "days"} late`
      : group.key === "today"
        ? "Today"
        : group.label.replace(/^Due (\w)/, (_, c: string) => c.toUpperCase());
  return (
    <Row
      edge={EDGE[group.key]}
      task={t}
      onAct={onAct}
      left={
        t.blocks ? (
          <span className="flex min-w-0 items-center gap-1 font-medium text-warning-ink">
            <GavelIcon aria-hidden="true" className="size-3.5 shrink-0" />
            <span className="truncate">
              Blocks item {t.blocks.item} · {t.blocks.court}
            </span>
          </span>
        ) : (
          <span className="truncate">{t.caseTitle}</span>
        )
      }
      right={<span className={group.key === "overdue" ? "font-semibold text-destructive-ink" : undefined}>{due}</span>}
    />
  );
}

/** A waiting row: the task, then who prepared or raised it on the left and how long it's waited on the right. */
function WaitingRow({ task: t, today, onAct }: { task: HomeTask; today: string; onAct: (t: HomeTask) => void }) {
  const days = daysBetween(t.waiting!.since.slice(0, 10), today);
  const wait = days === 0 ? "Today" : `${days} ${days === 1 ? "day" : "days"}`;
  return (
    <Row
      task={t}
      onAct={onAct}
      left={
        <span className="truncate">
          {t.waiting!.how === "prepared" ? "Prepared by" : "Raised by"} {t.waiting!.by}
        </span>
      }
      right={<span className={days >= 3 ? "font-semibold text-foreground" : undefined}>{wait}</span>}
    />
  );
}

/** The shared row: [edge] task / left · right, then the task's own verb. */
function Row({
  edge,
  task: t,
  left,
  right,
  onAct,
}: {
  edge?: string;
  task: HomeTask;
  left: React.ReactNode;
  right: React.ReactNode;
  onAct: (t: HomeTask) => void;
}) {
  return (
    <li className="flex items-center gap-3 py-1.5">
      {edge ? <span aria-hidden="true" className={cn("w-1 self-stretch rounded-full", edge)} /> : null}
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <p className="flex min-w-0 items-center gap-1.5 text-body-compact font-medium" title={t.title}>
          {t.bookmarked ? (
            <>
              <BookmarkIcon aria-hidden="true" className="size-3.5 shrink-0 fill-current text-muted-foreground" />
              <span className="sr-only">Bookmarked case. </span>
            </>
          ) : null}
          <span className="truncate">{t.title}</span>
        </p>
        <span className="flex min-w-0 items-center justify-between gap-3 text-caption text-muted-foreground tabular-nums">
          <span className="flex min-w-0">{left}</span>
          <span className="shrink-0 whitespace-nowrap">{right}</span>
        </span>
      </div>
      <Button
        variant="outline"
        size="xs"
        className="shrink-0 pointer-coarse:h-10 pointer-coarse:px-4"
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
    <div className="flex flex-1 items-center justify-center">
      <PageOutcome tone="neutral" icon={icon} as="p" still title={title} body={body} className="py-0 [&_p:first-of-type]:text-body" />
    </div>
  );
}
