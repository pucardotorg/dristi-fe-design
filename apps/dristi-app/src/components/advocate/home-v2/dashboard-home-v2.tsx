"use client";

import * as React from "react";
import Link from "next/link";
import {
  ArrowRightIcon,
  BookmarkIcon,
  FilePlusIcon,
  FileTextIcon,
  ScrollTextIcon,
  UserPlusIcon,
  type LucideIcon,
} from "lucide-react";

import { HearingsTodayCard } from "@/components/advocate/home-v2/hearings-today-card";
import { DEMO_COURTS, DEMO_NEXT_COURTS } from "@/components/advocate/home-v2/hearings-today";
import { UpdatesCard as UpdatesCarouselCard } from "@/components/advocate/home-v2/updates-card";
import { TodosCard } from "@/components/advocate/home-v2/todos-card";
import { demoUpdates } from "@/components/advocate/home-v2/updates";
import { notify } from "@/components/feedback";
import { PANEL_CLASS } from "@/components/shell/panel";
import {
  Card,
  CardAction,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
} from "@/components/ui/segmented-control";
import {
} from "@/components/ui/tooltip";
import {
  comingUp,
  HOME_CALENDAR,
  homeDay,
  longDay,
  shortDay,
  type HomeTask,
} from "@/lib/advocate/home-dashboard";
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
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 pt-6 pb-12 lg:px-6 lg:pt-8">
        {/* The date box from the Hearings home (still, it doesn't change day here), the greeting
            beside it, and Quick actions (owner, 2026-11-19: the launcher's row of big cards pushed
            every card down). On the cards' own grid, so Quick actions is Updates' width, right
            above it, with the same 24px gap as between the cards. */}
        <header className="flex min-w-0 flex-col gap-4 xl:grid xl:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)] xl:items-center xl:gap-6">
          <div className="flex min-w-0 items-center gap-6">
            <TodayBox now={nowDate} />
            <span aria-hidden="true" className="hidden h-18 w-px shrink-0 bg-hairline lg:block" />
            <div className="flex min-w-0 flex-col gap-1">
              <h1 className="text-title font-semibold tracking-tight text-balance">
                {greetingFor(hour)}, {firstName}
              </h1>
              <p className="text-body-compact text-muted-foreground lg:sr-only">{longDay(base.today)}</p>
            </div>
          </div>
          <QuickActions />
        </header>

        {card ? (
          <div className="mx-auto flex w-full max-w-4xl min-w-0 flex-col gap-6">
            {card === "launcher" ? <QuickActions /> : null}
            {card === "1" ? (
              <HearingsTodayCard courts={DEMO_COURTS} nextCourts={DEMO_NEXT_COURTS} />
            ) : null}
            {/* Cards 2 and 3 are one card now, "Your to-dos" (owner, 2026-11-19). */}
            {card === "2" || card === "3" ? <TodosCard tasks={day.tasks} today={day.today} onAct={act} /> : null}
            {card === "4" ? <UpdatesCarouselCard updates={updates} now={nowDate} /> : null}
            {card === "5" ? <ComingUpCard day={day} /> : null}
          </div>
        ) : (
          <>
            {/* Left: Your hearings, then Your to-dos (owner, 2026-11-19: it was cramped beside
                hearings). Right: Updates, then Coming up (still blanked). Must do today and
                Waiting on you merged into Your to-dos; Insights is out of draft 2 for this release
                (tag home-v2-before-todos keeps it; draft 1 runs it). */}
            <div className="grid min-w-0 items-start gap-6 xl:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
              <div className="flex min-w-0 flex-col gap-6">
                <HearingsTodayCard courts={DEMO_COURTS} nextCourts={DEMO_NEXT_COURTS} />
                <TodosCard tasks={day.tasks} today={day.today} onAct={act} />
              </div>
              <div className="flex min-w-0 flex-col gap-6">
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



/* ── Launcher ─────────────────────────────────────────────────────────── */

/**
 * The four ways to start something (owner, 2026-11-19), two by two, as tall as the date component
 * beside the greeting (120px). No title: the space goes to the actions. Each says it can be
 * pressed: a straight arrow after its name, and a brand-tinted hover.
 * Four separate raised tiles, each a button of its own (owner's pick, 2026-11-19).
 */
function QuickActions() {
  return (
    <nav aria-label="Quick actions" className="min-w-0">
      {/* Two 56px rows and an 8px gap: 120px, the date component's height. */}
      <ul className="grid grid-cols-2 gap-2">
        {START.map(({ label, href, icon: Icon }) => (
          <li key={label} className="flex min-w-0">
            <Link
              href={href}
              className={cn(
                "group/qa flex h-14 min-w-0 flex-1 items-center gap-2 rounded-xl border bg-card px-2.5 text-body-compact font-semibold outline-none transition-colors hover:border-brand-muted-hover hover:bg-brand-muted/40 focus-visible:ring-3 focus-visible:ring-focus-ring motion-reduce:transition-none",
                PANEL_CLASS,
              )}
            >
              <span
                aria-hidden="true"
                className="flex size-7 shrink-0 items-center justify-center rounded-md bg-brand-muted text-brand-muted-foreground"
              >
                <Icon className="size-3.5" />
              </span>
              <span className="line-clamp-2 min-w-0 flex-1 leading-tight">{label}</span>
              {/* A straight arrow after the name (owner, 2026-11-19: not the corner ↗). */}
              <ArrowRightIcon
                aria-hidden="true"
                className="size-3.5 shrink-0 text-muted-foreground transition-[color,translate] group-hover/qa:translate-x-0.5 group-hover/qa:text-brand-muted-foreground motion-reduce:transition-none"
              />
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

/**
 * Today's date as the Hearings home draws it on a desktop: the month above, the day in a white
 * box, the weekday below, in the brand tint that means "today". Still here: no arrows, no scrub,
 * no calendar. Desktops only, as there; phones and iPads keep the date line under the greeting.
 */
function TodayBox({ now }: { now: Date }) {
  const fmt = (o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", ...o }).format(now);
  return (
    <div aria-hidden="true" className="hidden w-20 shrink-0 flex-col items-center gap-1.5 lg:flex">
      {/* ds-typography-allow: the Hearings home's month label, a step under caption (11px). */}
      <p className="text-[0.6875rem] leading-4 font-semibold tracking-wide text-brand-muted-foreground uppercase">
        {fmt({ month: "short", year: "numeric" })}
      </p>
      <div className="flex h-18 w-full items-center justify-center rounded-xl border border-hairline bg-card text-brand-muted-foreground">
        {/* ds-typography-allow: the Hearings home's date size, larger than the DS display role. */}
        <span className="text-[3.5rem] leading-none font-semibold tracking-tight tabular-nums">{fmt({ day: "2-digit" })}</span>
      </div>
      <p className="text-body-compact text-muted-foreground">{fmt({ weekday: "long" })}</p>
    </div>
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
