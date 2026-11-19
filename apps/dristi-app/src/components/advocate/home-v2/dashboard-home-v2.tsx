"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRightIcon,
  ChevronDownIcon,
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
import { RecentCasesCard } from "@/components/advocate/home-v2/recent-card";
import { demoUpdates } from "@/components/advocate/home-v2/updates";
import { notify } from "@/components/feedback";
import { PANEL_CLASS } from "@/components/shell/panel";
import { useProfile } from "@/components/shell/profile";
import { createVak } from "@/lib/vakalatnama/store";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle, DrawerTrigger } from "@/components/ui/drawer";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
      /* Straight into a new filing, not the filings list (owner, 2026-11-19). */
      href: "/filings/new",
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



/* "Morning, Anjali": shorter than "Good morning" so a phone fits the greeting beside its Quick
   actions button (owner, 2026-11-19). */
function greetingFor(hour: number): string {
  if (hour < 12) return "Morning";
  if (hour < 17) return "Afternoon";
  return "Evening";
}

/** Draft 2: each card is redesigned on its own (?card=launcher|1|2|3|4|5|6), then brought together. */
export type V2Card = "launcher" | "1" | "2" | "3" | "4" | "5" | "6";

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

  const [todosOpen, setTodosOpen] = React.useState(false);

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
            {/* On a phone the Quick actions button sits at the greeting's right, centred on the
                greeting and date together (owner, 2026-11-19: level with the first line it sat too
                high); a long first name wraps under itself instead of pushing the button off. */}
            <div className="flex min-w-0 flex-1 items-center justify-between gap-3">
              <div className="flex min-w-0 flex-col gap-1">
                <h1 className="text-title font-semibold tracking-tight text-balance break-words">
                  {greetingFor(hour)}, {firstName}
                </h1>
                <p className="text-body-compact text-muted-foreground lg:sr-only">{longDay(base.today)}</p>
              </div>
              <QuickActions phone />
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
            {card === "6" ? <RecentCasesCard today={day.today} /> : null}
          </div>
        ) : (
          <>
            {/* Left: Your hearings, then Your to-dos (owner, 2026-11-19: it was cramped beside
                hearings). Right: Updates, Your week ahead, then Recent cases. Must do today and
                Waiting on you merged into Your to-dos; Insights is out of draft 2 for this release
                (tag home-v2-before-todos keeps it; draft 1 runs it). */}
            {/* On a desktop both columns run to the same bottom: the last card in each grows to meet the
                other column's end (owner, 2026-11-19: Your to-dos ends where Recent cases ends). */}
            <div className="grid min-w-0 gap-6 xl:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)] xl:items-stretch">
              <div className="flex min-w-0 flex-col gap-6">
                <HearingsTodayCard courts={DEMO_COURTS} nextCourts={DEMO_NEXT_COURTS} />
                <TodosCard tasks={day.tasks} today={day.today} onAct={act} className="xl:flex-1" onExpandedChange={setTodosOpen} />
              </div>
              {/* While Your to-dos shows its full list, this column keeps its own height instead of
                  stretching with it (owner, 2026-11-19). */}
              <div className={cn("flex min-w-0 flex-col gap-6", todosOpen && "xl:self-start")}>
                <UpdatesCarouselCard updates={updates} now={nowDate} />
                <ComingUpCard day={day} />
                <RecentCasesCard today={day.today} className="xl:flex-1" />
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
 * The four ways to start something (owner, 2026-11-19), two by two, as tall as the date component
 * beside the greeting (120px). No title: the space goes to the actions. Each says it can be
 * pressed: a straight arrow after its name, and a brand-tinted hover.
 * Four separate raised tiles, each a button of its own (owner's pick, 2026-11-19).
 */
function QuickActions({ phone }: { phone?: boolean }) {
  const router = useRouter();
  const { profileRole } = useProfile();
  /* Vakalatnama starts a new one, as the Vakalatnama page's own "New vakalatnama" does: create a
     blank instrument for whoever is signed in, then open it (owner, 2026-11-19). The link still
     points at the list, so opening it in a new tab lands somewhere sensible. */
  const newVak = (e: React.MouseEvent) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
    e.preventDefault();
    router.push(`/vakalatnama/${createVak(profileRole === "litigant" ? "litigant" : "advocate")}`);
  };
  const tiles = () =>
    START.map(({ label, href, icon: Icon }) => (
      <li key={label} className="flex min-w-0">
        <Link
          href={href}
          onClick={href === "/vakalatnama" ? newVak : undefined}
          className={cn(
            "group/qa flex h-14 min-w-0 flex-1 items-center gap-2 rounded-xl border bg-card px-2.5 text-body-compact font-semibold outline-none transition-colors hover:border-brand-muted-hover hover:bg-brand-muted/40 focus-visible:ring-3 focus-visible:ring-focus-ring motion-reduce:transition-none",
            PANEL_CLASS,
          )}
        >
          <span
            aria-hidden="true"
            className="flex size-7 shrink-0 items-center justify-center rounded-md bg-brand-muted text-brand-muted-foreground transition-colors group-hover/qa:bg-card motion-reduce:transition-none"
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
    ));
  /* Phones: one compact button beside the greeting; the four actions open in a bottom drawer, as
     the court timeline and the updates list do (owner and lead designer, 2026-11-19: on a phone,
     in court, the day's hearings matter more than starting something new). */
  if (phone)
    return (
      <Drawer>
        <DrawerTrigger asChild>
          {/* The page's one primary button, sized to its words (owner, 2026-11-19: full width was
              too heavy). The chevron points down, the usual "opens a menu" mark. */}
          <Button className="shrink-0 sm:hidden">
            Quick actions
            <ChevronDownIcon data-icon="inline-end" aria-hidden="true" />
          </Button>
        </DrawerTrigger>
        <DrawerContent style={{ paddingBottom: "calc(var(--spacing) * 4 + env(safe-area-inset-bottom))" }}>
          <DrawerHeader className="text-left">
            <DrawerTitle className="text-left">Quick actions</DrawerTitle>
            <DrawerDescription className="sr-only">Start something new.</DrawerDescription>
          </DrawerHeader>
          <ul className="flex flex-col gap-2 px-4">{tiles()}</ul>
        </DrawerContent>
      </Drawer>
    );
  return (
    <>
      {/* iPad and desktop: the four tiles, two by two. Two 56px rows and an 8px gap: 120px, the
          date component's height. */}
      <nav aria-label="Quick actions" className="min-w-0 max-sm:hidden">
        <ul className="grid grid-cols-2 gap-2">{tiles()}</ul>
      </nav>
    </>
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
      {/* The cards' own raised shadow, so the date sits on the page like they do (owner, 2026-11-19). */}
      <div className="flex h-18 w-full items-center justify-center rounded-xl border border-hairline bg-card text-brand-muted-foreground shadow-raised">
        {/* ds-typography-allow: the Hearings home's date size, larger than the DS display role. */}
        <span className="text-[3.5rem] leading-none font-semibold tracking-tight tabular-nums">{fmt({ day: "2-digit" })}</span>
      </div>
      <p className="text-body-compact text-muted-foreground">{fmt({ weekday: "long" })}</p>
    </div>
  );
}

/* ── ⑤ Your week ahead ──────────────────────────────────────────────────────── */

function ComingUpCard({ day }: { day: ReturnType<typeof homeDay> }) {
  const week = comingUp(HOME_CALENDAR, day);
  const max = Math.max(1, ...week.flatMap((d) => [d.hearings, d.tasks]));
  const hearings = week.reduce((n, d) => n + d.hearings, 0);
  const tasks = week.reduce((n, d) => n + d.tasks, 0);
  const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
  return (
    <Card
      variant="raised"
      role="region"
      aria-labelledby="home-week"
      /* 16px under the title, the next rung up from 12 (owner, 2026-11-19: it felt tight). */
      className="min-w-0 gap-4"
    >
      {/* Title and the week's totals, as Your hearings shows its day's (owner, 2026-11-19: "Coming
          up" said too little). Working days, so not "next 7 days": holidays are skipped. */}
      <CardHeader>
        <CardTitle className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
          <h2 id="home-week" className="text-body font-semibold">
            Your week ahead
          </h2>
          <span className="text-caption font-medium text-muted-foreground tabular-nums">
            {plural(hearings, "hearing", "hearings")} · {plural(tasks, "task", "tasks")}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {/* The bookmarked share is the base of each hearings bar, in full court colour, not a
            mark floating above it (owner, 2026-11-19). */}
        <ul aria-label="Legend" className="flex flex-wrap gap-x-4 gap-y-1">
          {[
            ["bg-chart-1/40", "Hearings"],
            ["bg-chart-1", "On bookmarked cases"],
            ["bg-muted-foreground/50", "Tasks due"],
          ].map(([fill, text]) => (
            <li key={text} className="flex items-center gap-1.5 text-caption font-medium text-muted-foreground">
              {/* The bookmarked share's key is the bookmark itself, in the bar's colour. */}
              {fill === "bg-chart-1" ? (
                <BookmarkIcon aria-hidden="true" className="size-3 fill-current text-chart-1" />
              ) : (
                <span aria-hidden="true" className={cn("size-2.5 rounded-xs", fill)} />
              )}
              {text}
            </li>
          ))}
        </ul>
        <ol aria-label="Today and the next six working days" className="grid h-40 grid-cols-7">
          {week.map((d, i) => {
            const today = i === 0;
            const [weekday, date] = (today ? `Today ${shortDay(d.day).split(" ")[1]}` : shortDay(d.day)).split(" ");
            const plain = d.hearings - d.bookmarked;
            return (
              <li key={d.day} className="flex min-w-0 flex-col items-stretch">
                <span className="sr-only">
                  {`${today ? "Today" : longDay(d.day)}: ${plural(d.hearings, "hearing", "hearings")}${d.bookmarked ? `, ${d.bookmarked} on bookmarked cases` : ""}, ${plural(d.tasks, "task", "tasks")} due`}
                </span>
                {/* Bars stand on one hairline across the week. */}
                <span aria-hidden="true" className="flex flex-1 items-end justify-center gap-1 border-b border-hairline">
                  {/* Hearings: the bookmarked part at the base, the rest lighter above it. One scale for
                      both bars, so a day reads as "8 hearings and 3 tasks" (owner, 2026-11-19).
                      Any bar is at least 4px so a small day beside a big one still shows; the
                      bookmarked part is always its true share of the bar (flex-grow), never a
                      fixed floor that would overstate it. */}
                  <span className="flex h-full w-3 flex-col items-center justify-end gap-0.5">
                    {/* ds-typography-allow: bar counts a step under caption (11px), owner 2026-11-19. */}
                    <span className="text-[0.6875rem] leading-4 font-semibold tabular-nums">{d.hearings}</span>
                    <span
                      className="flex w-full flex-col overflow-hidden rounded-t-xs"
                      style={{ height: `calc((100% - 1.25rem) * ${d.hearings / max})`, minHeight: d.hearings ? 4 : 0 }}
                    >
                      <span className="w-full bg-chart-1/40" style={{ flexGrow: plain }} />
                      {/* Hover the bookmarked part for its count (owner, 2026-11-19); the bar's
                          number is all hearings. Screen readers get it from the day's line above. */}
                      {d.bookmarked ? (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="w-full bg-chart-1" style={{ flexGrow: d.bookmarked }} />
                          </TooltipTrigger>
                          <TooltipContent side="right">
                            {plural(d.bookmarked, "hearing", "hearings")} on bookmarked cases
                          </TooltipContent>
                        </Tooltip>
                      ) : null}
                    </span>
                  </span>
                  <span className="flex h-full w-3 flex-col items-center justify-end gap-0.5">
                    {/* ds-typography-allow: bar counts a step under caption (11px), owner 2026-11-19. */}
                    <span className="text-[0.6875rem] leading-4 font-medium text-muted-foreground tabular-nums">{d.tasks}</span>
                    <span
                      className="w-full rounded-t-xs bg-muted-foreground/50"
                      style={{ height: `calc((100% - 1.25rem) * ${d.tasks / max})`, minHeight: d.tasks ? 4 : 0 }}
                    />
                  </span>
                </span>
                {/* The day, with today in the court tint, as on the Hearings home week strip. */}
                <span
                  aria-hidden="true"
                  className={cn(
                    "mx-0.5 mt-1.5 flex flex-col items-center rounded-md py-0.5 leading-tight",
                    today ? "bg-brand-muted text-brand-muted-foreground" : "text-muted-foreground",
                  )}
                >
                  <span className="text-caption font-medium">{weekday}</span>
                  <span className="text-caption font-semibold tabular-nums">{date}</span>
                </span>
              </li>
            );
          })}
        </ol>
      </CardContent>
    </Card>
  );
}
