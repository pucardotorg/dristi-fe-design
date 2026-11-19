"use client";

import * as React from "react";
import Link from "next/link";
import {
  BookmarkIcon,
  FilePlusIcon,
  FileTextIcon,
  GavelIcon,
  HistoryIcon,
  ScrollTextIcon,
  UserPlusIcon,
  type LucideIcon,
} from "lucide-react";

import { HearingsTodayCard } from "@/components/advocate/home-v2/hearings-today-card";
import { DEMO_COURTS, DEMO_NEXT_COURTS } from "@/components/advocate/home-v2/hearings-today";
import { UpdatesCard as UpdatesCarouselCard } from "@/components/advocate/home-v2/updates-card";
import { demoUpdates } from "@/components/advocate/home-v2/updates";
import { PreparedAheadInsights } from "@/components/advocate/prepared-ahead";
import { notify } from "@/components/feedback";
import { PANEL_CLASS } from "@/components/shell/panel";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  SegmentedControl,
  SegmentedControlItem,
} from "@/components/ui/segmented-control";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  comingUp,
  daysBetween,
  HOME_CALENDAR,
  homeDay,
  longDay,
  mustDo,
  shortDay,
  waitingOnYou,
  type HomeTask,
  type MustDoGroup,
} from "@/lib/advocate/home-dashboard";
import { preparedAhead } from "@/lib/advocate/prepared-ahead";
import { cn } from "@/lib/utils";

/**
 * The advocate Home (owner, 2026-11-13 to 11-16; agreed frame: board round 5, with round 8's
 * ②). On the first visit of the day it says how the day looks, and gives one easy way in:
 * act on a thing here, or open the page that owns it. It is not any of those pages.
 *
 * Five fixed questions, one order, every card a fixed size: the size never changes with the
 * data, so an empty card keeps its place and just says nothing is there. Lists are capped;
 * what does not fit is a count and a link, never an inner scroll.
 *
 * Bookmarked cases carry one mark everywhere (the Cases page's bookmark, filled). ① and ②
 * keep their own order and are only marked; ③ and ④ put bookmarked cases first; ⑤ counts
 * them above the day.
 *
 * Demo: reads `homeDay()`; acting on a task completes it for this visit only (a refresh
 * restores the day), so ②'s list, its insights and ⑤ move together.
 */

const START: { label: string; hint: string; href: string; icon: LucideIcon }[] =
  [
    {
      label: "File a case",
      hint: "New complaint",
      href: "/filings",
      icon: FilePlusIcon,
    },
    {
      label: "Raise application",
      hint: "On a case you're on",
      href: "/raise-application",
      icon: FileTextIcon,
    },
    {
      label: "Join a case",
      hint: "With case number or code",
      href: "/cases?join=1",
      icon: UserPlusIcon,
    },
    {
      label: "Vakalatnama",
      hint: "Prepare, sign, share",
      href: "/vakalatnama",
      icon: ScrollTextIcon,
    },
  ];

const TASKS_HREF = "/tasks";
const MUST_DO_CAP = 6;
const WAITING_CAP = 4;

/** Group ink: the rail beside each row and its heading. Words carry the meaning too. */
const GROUP_TONE: Record<MustDoGroup["key"], { rail: string; ink: string }> = {
  overdue: { rail: "bg-destructive", ink: "text-destructive-ink" },
  today: { rail: "bg-warning", ink: "text-warning-ink" },
  tomorrow: { rail: "bg-muted-foreground", ink: "text-muted-foreground" },
};

function greetingFor(hour: number): string {
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

/** Draft 2: each card is redesigned on its own (?card=launcher|1|2|3|4|5), then brought together. */
export type V2Card = "launcher" | "1" | "2" | "3" | "4" | "5";

export function DashboardHomeV2({
  firstName,
  card,
}: {
  firstName: string;
  card?: V2Card | null;
}) {
  const [base] = React.useState(() => homeDay());
  /* Completed on this visit: task id → when. Held in memory, so a refresh restores the day. */
  const [doneNow, setDoneNow] = React.useState<Record<string, string>>({});

  const tasks = React.useMemo(
    () =>
      base.tasks.map((t) =>
        doneNow[t.id]
          ? {
              ...t,
              completions: [
                ...(t.completions ?? []),
                { at: doneNow[t.id], type: "completed" as const },
              ],
            }
          : t,
      ),
    [base.tasks, doneNow],
  );
  const day = React.useMemo(() => ({ ...base, tasks }), [base, tasks]);
  const nowDate = React.useMemo(() => new Date(base.now), [base.now]);
  const updates = React.useMemo(() => demoUpdates(nowDate), [nowDate]);

  const act = (task: HomeTask) => {
    setDoneNow((prev) => ({
      ...prev,
      [task.id]: new Date(base.now).toISOString(),
    }));
    notify.success(`${task.title}: done`);
  };

  const hour = Number(
    new Intl.DateTimeFormat("en-IN", {
      hour: "numeric",
      hour12: false,
      timeZone: "Asia/Kolkata",
    }).format(base.now),
  );

  return (
    <main className="@container flex min-w-0 flex-1 flex-col bg-muted dark:bg-background">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 pt-6 pb-12 lg:gap-8 lg:px-6 lg:pt-8">
        <header className="flex min-w-0 flex-col gap-1">
          <h1 className="text-title font-semibold tracking-tight text-balance">
            {greetingFor(hour)}, {firstName}
          </h1>
          <p className="text-body-compact text-muted-foreground">
            {longDay(base.today)}
          </p>
        </header>

        {card ? (
          <div className="mx-auto flex w-full max-w-4xl min-w-0 flex-col gap-6">
            {card === "launcher" ? <Launcher /> : null}
            {card === "1" ? (
              <HearingsTodayCard courts={DEMO_COURTS} nextCourts={DEMO_NEXT_COURTS} />
            ) : null}
            {card === "2" ? <MustDoCard day={day} onAct={act} /> : null}
            {card === "3" ? <WaitingCard day={day} onAct={act} /> : null}
            {card === "4" ? <UpdatesCarouselCard updates={updates} now={nowDate} /> : null}
            {card === "5" ? <ComingUpCard day={day} /> : null}
          </div>
        ) : (
          <>
            <Blank>
              <Launcher />
            </Blank>

            <div className="grid min-w-0 items-start gap-6 xl:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
              <div className="flex min-w-0 flex-col gap-6">
                <HearingsTodayCard courts={DEMO_COURTS} nextCourts={DEMO_NEXT_COURTS} />
                <Blank>
                  <MustDoCard day={day} onAct={act} />
                </Blank>
              </div>
              <div className="flex min-w-0 flex-col gap-6">
                <Blank>
                  <WaitingCard day={day} onAct={act} />
                </Blank>
                {/* Card 4 is being redesigned now (owner, 2026-11-19), so it shows. */}
                <UpdatesCarouselCard updates={updates} now={nowDate} />
                <Blank>
                  <ComingUpCard day={day} />
                </Blank>
              </div>
            </div>
          </>
        )}
      </div>
    </main>
  );
}

/* ── Shared pieces ────────────────────────────────────────────────────── */

/**
 * TEMPORARY (owner, 2026-11-18): blank out the cards around card 1 so it can be judged in
 * place. Boxes keep their size and outline; their contents are hidden and inert.
 * Set FOCUS_CARD_1 to false to bring them back.
 */
const FOCUS_CARD_1 = true;

function Blank({ className, children }: { className?: string; children: React.ReactNode }) {
  if (!FOCUS_CARD_1) return className ? <div className={className}>{children}</div> : <>{children}</>;
  return (
    <div
      aria-hidden="true"
      inert
      className={cn(
        "pointer-events-none [&_[data-slot=card]>*]:invisible [&_a>*]:invisible",
        className,
      )}
    >
      {children}
    </div>
  );
}

/** The mark a bookmarked case carries everywhere: the Cases page's bookmark, filled. */
function Bookmarked({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex shrink-0 text-chart-3", className)}>
      <BookmarkIcon aria-hidden="true" className="size-3.5 fill-current" />
      <span className="sr-only">Bookmarked case</span>
    </span>
  );
}

/** A Home card: numbered question, title, one control on the right, capped body, footer link. */
function HomeCard({
  n,
  title,
  id,
  action,
  footer,
  className,
  children,
}: {
  n: number;
  title: string;
  id: string;
  action?: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <Card
      variant="raised"
      aria-labelledby={id}
      role="region"
      className={cn("min-w-0 gap-4", className)}
    >
      <CardHeader className="items-center">
        <CardTitle>
          <h2
            id={id}
            className="flex items-center gap-2 text-body font-semibold"
          >
            <span
              aria-hidden="true"
              className="flex size-6 shrink-0 items-center justify-center rounded-full bg-surface-sunken text-caption font-semibold text-muted-foreground tabular-nums"
            >
              {n}
            </span>
            {title}
          </h2>
        </CardTitle>
        {action ? (
          <CardAction className="row-span-1 self-center">{action}</CardAction>
        ) : null}
      </CardHeader>
      <CardContent className="flex min-h-0 flex-1 flex-col">
        {children}
      </CardContent>
      {footer ? (
        <CardFooter className="justify-start py-3">{footer}</CardFooter>
      ) : null}
    </Card>
  );
}

/** "+3 more · Take action": what did not fit, and the page that holds all of it. */
function MoreLink({
  more,
  label,
  href,
}: {
  more?: string | null;
  label: string;
  href: string;
}) {
  return (
    <p className="flex min-w-0 flex-wrap items-center gap-x-2 text-body-compact text-muted-foreground">
      {more ? (
        <>
          <span className="tabular-nums">{more}</span>
          <span aria-hidden="true">·</span>
        </>
      ) : null}
      <Link
        href={href}
        className="inline-flex min-h-10 items-center gap-1 rounded-sm font-medium text-primary underline decoration-border underline-offset-4 outline-none hover:decoration-current focus-visible:ring-3 focus-visible:ring-focus-ring"
      >
        {label}
      </Link>
    </p>
  );
}

/** Nothing here today: the card keeps its size and says so. */
function Nothing({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-1 items-center justify-center rounded-lg bg-surface-sunken p-6 text-center text-body-compact text-muted-foreground">
      {children}
    </div>
  );
}

/* ── Launcher ─────────────────────────────────────────────────────────── */

function Launcher() {
  return (
    <nav aria-label="Start something">
      <ul className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
        {START.map(({ label, hint, href, icon: Icon }) => (
          <li key={label} className="flex min-w-0">
            <Link
              href={href}
              className={cn(
                "group/start flex min-w-0 flex-1 flex-col gap-3 rounded-xl border bg-card p-4 outline-none transition-colors hover:bg-accent focus-visible:ring-3 focus-visible:ring-focus-ring motion-reduce:transition-none",
                PANEL_CLASS,
              )}
            >
              <span
                aria-hidden="true"
                className="flex size-10 items-center justify-center rounded-lg border border-hairline bg-surface-sunken text-foreground group-hover/start:bg-card"
              >
                <Icon className="size-5" />
              </span>
              <span className="flex min-w-0 flex-col gap-0.5">
                <span className="text-body font-semibold">{label}</span>
                <span className="text-caption font-medium text-muted-foreground">
                  {hint}
                </span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

/* ── ② Must do today ──────────────────────────────────────────────────── */

function MustDoCard({
  day,
  onAct,
}: {
  day: ReturnType<typeof homeDay>;
  onAct: (t: HomeTask) => void;
}) {
  const [view, setView] = React.useState<"list" | "insights">("list");
  const groups = mustDo(HOME_CALENDAR, day.tasks, day.today);
  const insights = React.useMemo(
    () => preparedAhead(HOME_CALENDAR, day.tasks, day.today),
    [day.tasks, day.today],
  );

  /* Fill the cap in group order: overdue first, then today, then tomorrow. */
  const shown = groups.map((g, i) => {
    const before = groups.slice(0, i).reduce((n, x) => n + x.tasks.length, 0);
    return { ...g, shown: g.tasks.slice(0, Math.max(0, MUST_DO_CAP - before)) };
  });
  const hidden = shown.flatMap((g) => g.tasks.slice(g.shown.length));
  const total = groups.reduce((n, g) => n + g.tasks.length, 0);

  return (
    <HomeCard
      n={2}
      id="home-must-do"
      title="Must do today"
      className="xl:h-164"
      action={
        <SegmentedControl
          type="single"
          size="compact"
          value={view}
          onValueChange={(v) => v && setView(v as "list" | "insights")}
          aria-label="Show as"
        >
          <SegmentedControlItem value="list">List</SegmentedControlItem>
          <SegmentedControlItem value="insights">Insights</SegmentedControlItem>
        </SegmentedControl>
      }
      footer={
        view === "list" ? (
          <MoreLink
            more={hidden.length ? `+${hidden.length} more` : null}
            label="Take action"
            href={TASKS_HREF}
          />
        ) : null
      }
    >
      {view === "insights" ? (
        <PreparedAheadInsights data={insights} tasksHref={TASKS_HREF} />
      ) : total === 0 ? (
        <Nothing>Nothing due today or tomorrow.</Nothing>
      ) : (
        <div className="flex min-h-0 flex-col gap-4">
          <ul aria-label="Counts" className="flex flex-wrap gap-x-4 gap-y-1">
            {groups.map((g) => (
              <li
                key={g.key}
                className="flex items-center gap-1.5 text-caption font-medium text-muted-foreground"
              >
                <span
                  aria-hidden="true"
                  className={cn("size-2.5 rounded-xs", GROUP_TONE[g.key].rail)}
                />
                <span className="font-semibold text-foreground tabular-nums">
                  {g.tasks.length}
                </span>
                {g.label.toLowerCase()}
              </li>
            ))}
          </ul>
          <div className="flex flex-col gap-3">
            {shown
              .filter((g) => g.shown.length)
              .map((g) => (
                <section
                  key={g.key}
                  aria-labelledby={`must-${g.key}`}
                  className="flex flex-col gap-1"
                >
                  <h3
                    id={`must-${g.key}`}
                    className={cn(
                      "text-caption font-semibold",
                      GROUP_TONE[g.key].ink,
                    )}
                  >
                    {g.label}
                  </h3>
                  <ul className="flex flex-col">
                    {g.shown.map((t) => (
                      <MustDoRow
                        key={t.id}
                        task={t}
                        group={g}
                        today={day.today}
                        onAct={onAct}
                      />
                    ))}
                  </ul>
                </section>
              ))}
          </div>
        </div>
      )}
    </HomeCard>
  );
}

function MustDoRow({
  task: t,
  group,
  today,
  onAct,
}: {
  task: HomeTask;
  group: MustDoGroup;
  today: string;
  onAct: (t: HomeTask) => void;
}) {
  const late = group.key === "overdue" ? daysBetween(t.dueOn!, today) : 0;
  const due =
    group.key === "overdue"
      ? `${late} ${late === 1 ? "day" : "days"} overdue`
      : group.key === "today"
        ? "Today"
        : group.label.replace(/^Due (\w)/, (_, c: string) => c.toUpperCase());
  const blocks = t.blocks
    ? `Blocks item ${t.blocks.item} in ${t.blocks.court} today`
    : null;
  const dueTone =
    group.key === "overdue"
      ? "font-semibold text-destructive-ink"
      : "font-medium text-muted-foreground";
  return (
    <li className="flex min-h-14 items-center gap-3 rounded-lg py-2 pr-1">
      <span
        aria-hidden="true"
        className={cn(
          "w-1 self-stretch rounded-full",
          GROUP_TONE[group.key].rail,
        )}
      />
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <p className="flex min-w-0 items-center gap-1.5 text-body-compact font-medium">
          {t.bookmarked ? <Bookmarked /> : null}
          <span className="line-clamp-2 min-w-0">{t.title}</span>
          {blocks ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  className="relative inline-flex shrink-0 rounded-sm text-warning-ink outline-none after:absolute after:-inset-3 focus-visible:ring-3 focus-visible:ring-focus-ring pointer-coarse:hidden"
                >
                  <GavelIcon aria-hidden="true" className="size-4" />
                  <span className="sr-only">{blocks}</span>
                </button>
              </TooltipTrigger>
              <TooltipContent>{blocks}</TooltipContent>
            </Tooltip>
          ) : null}
        </p>
        <p className="line-clamp-2 text-caption font-medium text-muted-foreground">
          {t.caseTitle}
          {/* Touch has no hover: the hearing it blocks is said in the line. */}
          {blocks && t.blocks ? (
            <span aria-hidden="true" className="hidden pointer-coarse:inline">
              {" "}
              · Blocks item {t.blocks.item}, {t.blocks.court}
            </span>
          ) : null}
        </p>
        {/* Phones: the due cue joins the text, so the title keeps the width. */}
        <p className={cn("text-caption tabular-nums sm:hidden", dueTone)}>
          {due}
        </p>
      </div>
      <span
        className={cn(
          "shrink-0 text-caption tabular-nums max-sm:hidden",
          dueTone,
        )}
      >
        {due}
      </span>
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

/* ── ③ Waiting on you ─────────────────────────────────────────────────── */

function WaitingCard({
  day,
  onAct,
}: {
  day: ReturnType<typeof homeDay>;
  onAct: (t: HomeTask) => void;
}) {
  const all = waitingOnYou(HOME_CALENDAR, day.tasks, day.today);
  const shown = all.slice(0, WAITING_CAP);
  const more = all.length - shown.length;
  return (
    <HomeCard
      n={3}
      id="home-waiting"
      title="Waiting on you"
      className="xl:h-118"
      action={
        <span className="text-caption font-medium text-muted-foreground">
          Bookmarked first
        </span>
      }
      footer={
        <MoreLink
          more={more > 0 ? `+${more} more` : null}
          label="Take action"
          href={`${TASKS_HREF}?view=waiting`}
        />
      }
    >
      {shown.length ? (
        <ul className="flex flex-col divide-y divide-hairline">
          {shown.map((t) => {
            const days = daysBetween(t.waiting!.since.slice(0, 10), day.today);
            const age =
              days === 0 ? "Today" : `${days} ${days === 1 ? "day" : "days"}`;
            const long = days >= 3;
            return (
              <li key={t.id} className="flex min-h-14 items-center gap-3 py-2">
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <p className="flex min-w-0 items-center gap-1.5 text-body-compact font-medium">
                    {t.bookmarked ? <Bookmarked /> : null}
                    <span className="line-clamp-2 min-w-0">{t.title}</span>
                  </p>
                  <p className="line-clamp-2 text-caption font-medium text-muted-foreground">
                    {t.caseTitle} ·{" "}
                    {t.waiting!.how === "prepared"
                      ? "Prepared by"
                      : "Raised by"}{" "}
                    {t.waiting!.by}
                  </p>
                  <p
                    className={cn(
                      "flex items-center gap-1 text-caption tabular-nums sm:sr-only",
                      long
                        ? "font-semibold text-foreground"
                        : "font-medium text-muted-foreground",
                    )}
                  >
                    <HistoryIcon
                      aria-hidden="true"
                      className="size-3.5 shrink-0"
                    />
                    {days === 0 ? "Waiting since today" : `Waiting ${age}`}
                  </p>
                </div>
                <span
                  aria-hidden="true"
                  className={cn(
                    "flex w-16 shrink-0 items-center gap-1 text-caption tabular-nums max-sm:hidden",
                    long
                      ? "font-semibold text-foreground"
                      : "font-medium text-muted-foreground",
                  )}
                >
                  <HistoryIcon
                    aria-hidden="true"
                    className="size-3.5 shrink-0"
                  />
                  <span>{age}</span>
                </span>
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
          })}
        </ul>
      ) : (
        <Nothing>Nobody is waiting on you.</Nothing>
      )}
    </HomeCard>
  );
}



/* ── ⑤ Coming up ──────────────────────────────────────────────────────── */

function ComingUpCard({ day }: { day: ReturnType<typeof homeDay> }) {
  const week = comingUp(HOME_CALENDAR, day);
  const max = Math.max(1, ...week.flatMap((d) => [d.hearings, d.tasks]));
  return (
    <HomeCard n={5} id="home-coming-up" title="Coming up" className="xl:h-84">
      <div className="flex min-h-0 flex-1 flex-col gap-3">
        <ul aria-label="Legend" className="flex flex-wrap gap-x-4 gap-y-1">
          <li className="flex items-center gap-1.5 text-caption font-medium text-muted-foreground">
            <span
              aria-hidden="true"
              className="size-2.5 rounded-xs bg-chart-1"
            />
            Hearings
          </li>
          <li className="flex items-center gap-1.5 text-caption font-medium text-muted-foreground">
            <span
              aria-hidden="true"
              className="size-2.5 rounded-xs bg-muted-foreground"
            />
            Tasks due
          </li>
          <li className="flex items-center gap-1.5 text-caption font-medium text-muted-foreground">
            <BookmarkIcon
              aria-hidden="true"
              className="size-3.5 fill-current text-chart-3"
            />
            Bookmarked hearings
          </li>
        </ul>
        <ol
          aria-label="Today and the next six working days"
          className="grid min-h-40 flex-1 grid-cols-7 gap-1"
        >
          {week.map((d, i) => {
            const today = i === 0;
            const label = today ? "Today" : shortDay(d.day);
            return (
              <li
                key={d.day}
                className={cn(
                  "flex min-w-0 flex-col items-center gap-1 rounded-lg px-0.5 pt-1 pb-1.5",
                  today && "bg-surface-sunken",
                )}
              >
                <span className="sr-only">
                  {`${today ? "Today" : longDay(d.day)}: ${d.hearings} ${d.hearings === 1 ? "hearing" : "hearings"}${d.bookmarked ? `, ${d.bookmarked} on bookmarked cases` : ""}, ${d.tasks} ${d.tasks === 1 ? "task" : "tasks"} due`}
                </span>
                <span
                  aria-hidden="true"
                  className="flex h-4 items-center gap-0.5 text-caption font-semibold text-chart-3 tabular-nums"
                >
                  {d.bookmarked ? (
                    <>
                      <BookmarkIcon className="size-3.5 fill-current" />
                      {d.bookmarked}
                    </>
                  ) : null}
                </span>
                <span
                  aria-hidden="true"
                  className="flex w-full flex-1 items-end justify-center gap-1"
                >
                  {[
                    [d.hearings, "bg-chart-1"],
                    [d.tasks, "bg-muted-foreground"],
                  ].map(([n, fill]) => (
                    <span
                      key={fill as string}
                      className="flex h-full w-2.5 flex-col items-center justify-end gap-0.5 sm:w-3"
                    >
                      <span className="text-caption font-medium tabular-nums">
                        {n as number}
                      </span>
                      <span
                        className={cn("w-full rounded-t-xs", fill as string)}
                        style={{
                          height: `calc((100% - 1.25rem) * ${(n as number) / max})`,
                          minHeight: (n as number) ? 2 : 0,
                        }}
                      />
                    </span>
                  ))}
                </span>
                <span
                  aria-hidden="true"
                  className={cn(
                    "text-caption whitespace-nowrap",
                    today
                      ? "font-semibold"
                      : "font-medium text-muted-foreground",
                  )}
                >
                  {label}
                </span>
              </li>
            );
          })}
        </ol>
      </div>
    </HomeCard>
  );
}
