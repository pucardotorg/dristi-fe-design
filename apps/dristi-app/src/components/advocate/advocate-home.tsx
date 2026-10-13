"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { CauseListRow, TimelineHearing } from "@/lib/advocate/home";
import { courtIdentity, courtNumberFor } from "@/lib/advocate/courts";
import { CloudAlert, RotateCw } from "lucide-react";

import { useIsMobile } from "@/hooks/use-mobile";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";
import type { Locale } from "@/lib/onboarding/content";
import { pick } from "@/lib/onboarding/content";
import { advHome, fillCopy } from "@/lib/advocate/content";
import {
  accessOf,
  caseRecordFor,
  dayKeyOf,
  daySlotsOn,
  inOneCourt,
  nextHearingDayAfter,
  peopleOptionsOf,
  queueOf,
  weekOf,
  type PeopleScope,
  NO_SLOT_FILTER,
  type SlotFilter,
} from "@/lib/advocate/home";
import { ADVOCATE_HOME_CONFIG, type AdvocateHomeConfig } from "@/lib/advocate/config";
import type { Case } from "@/lib/tasks/types";
import { useTasks } from "@/lib/tasks/store";
import { TASKS_HOME } from "@/lib/tasks/routes";
import { caseOf, type World } from "@/lib/tasks/selectors";
import type { Task } from "@/lib/tasks/types";
import { archive } from "@/lib/tasks/transitions";
import { useTaskActions } from "@/components/tasks/use-task-actions";
import { verbFor } from "@/lib/tasks/permissions";
import { useTaskAct } from "@/components/tasks/task-act-layer";
import { CasePeekSurface } from "@/components/cases/case-peek";
import { CasePeekProvider, useCasePeek } from "@/components/cases/use-case-peek";
import { HomeGreeting } from "@/components/advocate/home-greeting";
import { useCourt } from "@/components/court/court-provider";
import {
  CompanionRail,
  useRailSection,
} from "@/components/advocate/companion-rail";
import { DayActions, HearingTimeline, type FilterVariant } from "@/components/advocate/hearing-timeline";
import { HOME_FRAME } from "@/components/advocate/home-layout";
import { CauseListDialog } from "@/components/advocate/cause-list-dialog";
import { JoinHearingDialog } from "@/components/advocate/join-hearing-dialog";

/** The shell top bar is `h-14`; the sticky rail hangs below it. */
const TOP_BAR = "3.5rem";
/** How far below the top bar the pending-tasks side tab hangs: centred on the
    greeting block (greeting and title) on a desktop. */
const TASK_TAB_TOP = 84;

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * The home's clock. The sandbox lists a normal court day (10:00–17:00); pinning
 * the clock to mid-afternoon makes the day always read as one in progress — a
 * morning already concluded, a slot being called now, an afternoon still to come —
 * whatever the wall-clock hour the demo is opened at. The calendar date stays
 * real, so the greeting and week strip are still today. Drop the `setHours` line
 * to run on the live clock.
 */
function useNow(): number {
  const [now] = React.useState(() => {
    const d = new Date();
    d.setHours(14, 10, 0, 0);
    return d.getTime();
  });
  return now;
}

/** Where the sittings' filters are remembered — cleared when the calendar day turns. */
const FILTERS_KEY = "advocate-home:day-filter";

/**
 * The stored filters read through `useSyncExternalStore` rather than an effect that sets state:
 * that keeps the server render (no selection) and the client's stored value from
 * disagreeing at hydration, and same-tab writes announce themselves with a
 * `storage` event so the read re-runs. The raw string is the stable snapshot;
 * parsing happens in the component, cached against it.
 */
function subscribeFilters(onChange: () => void): () => void {
  window.addEventListener("storage", onChange);
  return () => window.removeEventListener("storage", onChange);
}

function filtersSnapshot(): string {
  try {
    return window.localStorage.getItem(FILTERS_KEY) ?? "";
  } catch {
    return "";
  }
}

const strings = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : [];

/**
 * Each sitting's filter (courts, people scope, people), backed by localStorage
 * so it survives a refresh and clears when the day turns. One record, keyed by
 * sitting, so narrowing the morning leaves the afternoon as it was.
 */
function useStoredFilters(todayKey: string): [SlotFilter, (next: SlotFilter) => void] {
  const raw = React.useSyncExternalStore(subscribeFilters, filtersSnapshot, () => "");
  const filter = React.useMemo((): SlotFilter => {
    try {
      const parsed = raw ? (JSON.parse(raw) as { day?: string; filter?: Record<string, unknown> }) : null;
      if (parsed && parsed.day === todayKey && parsed.filter && typeof parsed.filter === "object") {
        const v = parsed.filter;
        return {
          courts: strings(v.courts),
          scope: (v.scope === "mine" || v.scope === "office" ? v.scope : "all") as PeopleScope,
          people: strings(v.people),
          hidden: strings(v.hidden),
        };
      }
    } catch {
      /* A corrupt entry just reads as no filter. */
    }
    return NO_SLOT_FILTER;
  }, [raw, todayKey]);

  const setFilter = React.useCallback(
    (next: SlotFilter) => {
      try {
        window.localStorage.setItem(FILTERS_KEY, JSON.stringify({ day: todayKey, filter: next }));
        // A same-tab write does not fire `storage` on its own — announce it so
        // the store subscription re-reads and the view updates at once.
        window.dispatchEvent(new StorageEvent("storage", { key: FILTERS_KEY }));
      } catch {
        /* No store, no persistence — the selection simply will not survive a refresh. */
      }
    },
    [todayKey]
  );

  return [filter, setFilter];
}

/**
 * The advocate home — the day in court, and what stands in its way.
 *
 * One world, three surfaces: the unified cause-list timeline (from
 * `Case.nextHearingAt`, grouped by time across every court), the pending-tasks
 * rail (the coming week of the Needs-action tab), and the case peek — the same
 * peek Your Cases uses, over the bridged record. Acting on a task happens in
 * place, through the same modal-and-flow table /tasks runs.
 */
export function AdvocateHome(props: {
  locale: Locale;
  profileFirstName: string;
  /** Which sittings and surfaces the board shows; the launch config unless a demo asks. */
  config?: AdvocateHomeConfig;
  /** Demo: the people filter as one menu (default) or a scope switch plus names. */
  filterVariant?: FilterVariant;
}) {
  const now = useNow();
  return (
    // Docked: the redesigned full-height panel that slides in from the right and
    // sits over the screen, the same shape the cases landing uses — not the older
    // inset floating card.
    <CasePeekProvider now={now} docked>
      <HomeBody {...props} now={now} />
    </CasePeekProvider>
  );
}

function HomeBody({
  locale,
  profileFirstName,
  now,
  config = ADVOCATE_HOME_CONFIG,
  filterVariant = "menu",
}: {
  locale: Locale;
  profileFirstName: string;
  now: number;
  config?: AdvocateHomeConfig;
  filterVariant?: FilterVariant;
}) {
  const isMobile = useIsMobile();
  const store = useTasks();
  const { state, people, cases, tasks, user, reload } = store;
  const router = useRouter();
  const { run: actOn, layer: actLayer } = useTaskAct();
  const { act: runTaskAction } = useTaskActions();

  // Archive a task straight from the rail — it drops out of Pending and lands in
  // the Archived tab on the tasks page (restorable there).
  const onArchiveTask = React.useCallback(
    (task: Task) => {
      void runTaskAction(
        task.id,
        archive,
        "Archived — find it under the Archived tab"
      );
    },
    [runTaskAction]
  );
  const peek = useCasePeek();

  // A deployment that runs one courtroom names it once (the title) rather than
  // filtering by it and labelling every hearing with it.
  const singleCourt = useCourt().profile.singleCourt;
  const world = React.useMemo<World>(() => {
    const all: World = { people, cases, tasks, user, now: new Date(now) };
    return singleCourt ? inOneCourt(all, singleCourt) : all;
  }, [people, cases, tasks, user, now, singleCourt]);

  const todayKey = dayKeyOf(now);
  const [selectedDay, setSelectedDay] = React.useState<string>(todayKey);
  /** Which week the strip shows — pages independently of today. */
  const [weekAnchor, setWeekAnchor] = React.useState<number>(now);
  // Not `useState`: which panel stands open is remembered per user, so a rail
  // closed last week is still closed. First run opens the tasks panel.
  const [railSection, setRailSection] = useRailSection();

  // Clicking a hearing's "pending" flag opens the tasks rail and traces a stroke
  // around that case's tasks. The nonce lets the same case re-trigger the trace.
  // (One of two competing patterns on show — the peek also lists pending work —
  // to be resolved with the team.)
  const [taskHighlight, setTaskHighlight] = React.useState<{
    caseId: string;
    taskIds: string[];
    nonce: number;
  } | null>(null);
  const openTasksForCase = React.useCallback(
    (caseId: string, taskIds: string[]) => {
      if (!isMobile) setRailSection("tasks");
      setTaskHighlight({ caseId, taskIds, nonce: Date.now() });
    },
    [isMobile, setRailSection]
  );

  // One filter for the whole day: every sitting shows it and reads it, so a
  // choice made on one tab is never silently missing (or lingering) on another.
  // No selection means everything the viewer can open. It survives a refresh
  // (localStorage) but resets when the day turns.
  const [storedFilter, setDayFilter] = useStoredFilters(todayKey);
  // With one court there is no court filter, so a court picked under another
  // deployment must not go on hiding hearings no control can bring back.
  const dayFilter = React.useMemo(
    () => (singleCourt && storedFilter.courts.length ? { ...storedFilter, courts: [] } : storedFilter),
    [singleCourt, storedFilter]
  );
  const filters = React.useMemo(
    () =>
      Object.fromEntries(
        (config.sittings.length ? config.sittings : [null]).map((_, i) => [`sitting-${i}`, dayFilter])
      ) as Record<string, SlotFilter>,
    [config.sittings, dayFilter]
  );
  const changeFilter = React.useCallback((_slotKey: string, next: SlotFilter) => setDayFilter(next), [setDayFilter]);

  const week = React.useMemo(
    () => weekOf(world, now, weekAnchor),
    [world, now, weekAnchor]
  );

  // The full day cause list opens in a near-fullscreen modal over the board.
  const [causeListOpen, setCauseListOpen] = React.useState(false);
  const onViewCauseList = React.useCallback(() => setCauseListOpen(true), []);
  // Clicking a hearing's cause-list icon opens the list and traces that matter's
  // row — the per-hearing "where does my matter stand in the docket?" jump. The
  // nonce lets the same matter re-trigger the trace.
  const [causeListHighlight, setCauseListHighlight] = React.useState<{
    caseId: string;
    nonce: number;
  } | null>(null);
  const onViewInCauseList = React.useCallback((caseId: string) => {
    setCauseListHighlight({ caseId, nonce: Date.now() });
    setCauseListOpen(true);
  }, []);
  // The "Join hearing" button opens a picker of the advocate's own hearings being
  // called now; the cause list is the wider door (any ongoing hearing). No courtroom
  // URL is supplied yet (§16.6 Q11), so a join is an honest, explicit stub.
  const [joinOpen, setJoinOpen] = React.useState(false);
  const onJoinCourt = React.useCallback(() => setJoinOpen(true), []);
  const announceJoin = React.useCallback(
    (parties: string, courtLabel: string, courtNumber: string | null) => {
      toast.info(pick({ en: "Hearing link unavailable", ml: "വിചാരണ ലിങ്ക് ലഭ്യമല്ല" }, locale), {
        description: `${parties} · ${courtLabel}${courtNumber ? ` · ${courtNumber}` : ""}`,
      });
    },
    [locale]
  );
  const onJoinHearing = React.useCallback(
    (row: CauseListRow) => announceJoin(row.parties, row.courtLabel, row.courtNumber),
    [announceJoin]
  );
  const onJoinFromModal = React.useCallback(
    (hearing: TimelineHearing) => {
      setJoinOpen(false);
      announceJoin(
        hearing.kase.parties,
        courtIdentity(hearing.courtLabel).name,
        courtNumberFor(hearing.court, hearing.kase.courtNumber)
      );
    },
    [announceJoin]
  );

  // The board pages between days like a carousel. Before the day changes, a
  // still copy of the shown board is taken; once the new day has rendered, the
  // copy slides out one side while the live board slides in from the other, on
  // the same curve. Translate only, never a fade, and nothing waits on a render
  // mid-motion. A click mid-slide carries on from where the board is.
  const boardDay = selectedDay;
  const boardRef = React.useRef<HTMLDivElement>(null);
  const boardAnimation = React.useRef<Animation | null>(null);
  const ghost = React.useRef<{ node: HTMLElement; dir: number; from: string } | null>(null);
  const liveGhost = React.useRef<HTMLElement | null>(null);
  function snapshotBoard(nextKey: string) {
    const el = boardRef.current;
    if (!el || nextKey === selectedDay || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const from = getComputedStyle(el).transform;
    ghost.current = {
      node: el.cloneNode(true) as HTMLElement,
      dir: nextKey > selectedDay ? 1 : -1,
      from: from === "none" ? "translateX(0)" : from,
    };
  }
  React.useLayoutEffect(() => {
    const shot = ghost.current;
    ghost.current = null;
    const el = boardRef.current;
    if (!shot || !el?.parentElement) return;
    liveGhost.current?.remove();
    const copy = shot.node;
    copy.setAttribute("aria-hidden", "true");
    copy.inert = true;
    Object.assign(copy.style, { position: "absolute", top: "0", left: "0", right: "0", pointerEvents: "none" });
    el.parentElement.append(copy);
    liveGhost.current = copy;
    const timing = { duration: 720, easing: "cubic-bezier(0.45, 0, 0.15, 1)" };
    copy.animate([{ transform: shot.from }, { transform: `translateX(${-shot.dir * 100}%)` }], { ...timing, fill: "forwards" })
      .onfinish = () => {
        copy.remove();
        if (liveGhost.current === copy) liveGhost.current = null;
      };
    boardAnimation.current?.cancel();
    boardAnimation.current = el.animate(
      [{ transform: `translateX(${shot.dir * 100}%)` }, { transform: "translateX(0)" }],
      timing
    );
  }, [selectedDay]);
  React.useEffect(() => () => boardAnimation.current?.cancel(), []);

  // The day as court sittings — one board each, built to the config (flat
  // lists, no times or conflicts at launch) and narrowed by each sitting's own
  // filter.
  const daySlots = React.useMemo(
    () => daySlotsOn(world, boardDay, now, config, filters),
    [world, boardDay, now, config, filters]
  );
  const peopleOf = React.useCallback(
    (hearings: Parameters<typeof peopleOptionsOf>[1], scope: PeopleScope) =>
      peopleOptionsOf(world, hearings, scope, filterVariant === "menu"),
    [world, filterVariant]
  );
  const accessFor = React.useCallback((kase: Case) => accessOf(world, kase), [world]);
  // Today's scheduled matters carry how many are still before them in court.
  const queueFor = React.useCallback(
    (hearing: TimelineHearing) =>
      boardDay === todayKey && hearing.status === "upcoming"
        ? queueOf(world, hearing.court, boardDay, hearing.item, now)
        : null,
    [world, boardDay, todayKey, now]
  );

  // The advocate's hearings being called now, across every sitting — what the
  // Join picker lists.
  const nowHearings = React.useMemo(
    () => daySlots.flatMap((slot) => slot.board.now.flatMap((s) => s.hearings)),
    [daySlots]
  );

  // Where the selected day sits relative to today. `dayKeyOf` is a zero-padded
  // YYYY-MM-DD, so a plain string compare orders the days. A past day is wholly
  // concluded; a future day is wholly upcoming — the timeline drops the
  // "nothing is being called" line off today and opens the concluded pile behind.
  const dayPhase: "past" | "today" | "future" =
    boardDay === todayKey ? "today" : boardDay < todayKey ? "past" : "future";

  const jump = React.useMemo(() => {
    const next = nextHearingDayAfter(world, boardDay);
    if (!next) return null;
    const label = new Intl.DateTimeFormat(locale === "ml" ? "ml-IN" : "en-IN", {
      weekday: "long",
      day: "numeric",
      month: "short",
    }).format(new Date(`${next.key}T12:00:00`));
    return { ...next, label };
  }, [world, boardDay, locale]);

  function selectDay(key: string, animate = true) {
    if (animate) snapshotBoard(key);
    setSelectedDay(key);
    peek.close();
    // Selecting a day in another week re-anchors the strip to it.
    setWeekAnchor(new Date(`${key}T12:00:00`).getTime());
  }

  /** Open the shared case peek for any matter in the world, via the bridge. */
  const openCase = React.useCallback(
    (caseId: string) => {
      const kase = world.cases.find((c) => c.id === caseId);
      if (!kase) return;
      const record = caseRecordFor(kase, kase.nextHearingAt);
      if (record) peek.open(record);
    },
    [world.cases, peek]
  );

  /** The viewer's verb for a task — what the rail's hover overlay names. */
  const verbOf = React.useCallback(
    (task: (typeof tasks)[number]) => {
      const kase = caseOf({ cases }, task);
      return kase ? verbFor(user, task, kase) : "Open";
    },
    [cases, user]
  );

  const selectedCaseId = React.useMemo(() => {
    const id = peek.record?.id;
    return id?.startsWith("tw-") ? id.slice(3) : null;
  }, [peek.record]);

  // A failure and a slow load are not the same screen. One spinner stood for
  // both, so a failed load spun forever with no way out of it.
  if (state === "error") {
    return (
      <main className="flex min-w-0 flex-1 items-center justify-center px-4">
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <CloudAlert aria-hidden="true" />
            </EmptyMedia>
            <EmptyTitle>{pick(advHome.loadErrorTitle, locale)}</EmptyTitle>
            <EmptyDescription>
              {pick(advHome.loadErrorBody, locale)}
            </EmptyDescription>
          </EmptyHeader>
          <Button variant="outline" size="sm" onClick={() => void reload()}>
            <RotateCw aria-hidden="true" />
            {pick(advHome.retry, locale)}
          </Button>
        </Empty>
      </main>
    );
  }

  // A reload keeps the board on screen (stale while it re-reads) rather than
  // dropping to a spinner: the store holds the last data through the load, so a
  // refresh updates the list in place instead of blanking the whole page. The
  // spinner is only for the very first load, when there is nothing to show yet.
  if (state !== "ready" && cases.length === 0) {
    return (
      <main className="flex min-w-0 flex-1 items-center justify-center">
        <Spinner className="size-6 text-muted-foreground" />
      </main>
    );
  }

  const hasDay = daySlots.some((slot) => slot.hearings.length > 0);

  return (
    <CasePeekSurface mobileDrawer className="flex min-h-0 min-w-0 flex-1">
      {/* A container, not just a column: the rail narrows the board without
          narrowing the viewport, so what the timeline puts on one line has to
          answer to its own width. */}
      {/* A desktop sets the board on a grey page (surface-sunken, the nearest
          token to the wireframe's #f1f1f1) so the white panel and its front tab
          stand out from it, the other slot tabs behind them. */}
      <main className="@container flex min-w-0 flex-1 flex-col md:bg-surface-sunken dark:md:bg-background">
        {/* Header and board share one frame (HOME_FRAME), so the big date sits
            over the timeline rail and the title, strip and hearings share one
            left edge, as in the owner's wireframe. */}
        <div className={cn("px-4 pt-6 pb-0 lg:pt-12 lg:pb-6", HOME_FRAME)}>
          <HomeGreeting
            locale={locale}
            firstName={profileFirstName}
            court={singleCourt}
            now={now}
            week={week}
            selectedDay={selectedDay}
            onSelectDay={selectDay}
            onShiftWeek={(delta) => setWeekAnchor((a) => a + delta * 7 * DAY_MS)}
            onPickDate={(date, animate) => selectDay(dayKeyOf(date), animate)}
          />
        </div>

        {/* Clipped sideways so the slide between days never adds a page scrollbar. */}
        <div className="relative overflow-x-clip">
        <div ref={boardRef}>
        {hasDay ? (
          <div className={cn("px-4 pt-0", HOME_FRAME)}>
            <HearingTimeline
              daySlots={daySlots}
              showTimes={config.showHearingTimes}
              showConflicts={config.showConflicts}
              singleCourt={singleCourt !== null}
              dayPhase={dayPhase}
              filters={filters}
              onFilterChange={changeFilter}
              peopleOptionsOf={peopleOf}
              filterVariant={filterVariant}
              accessOf={accessFor}
              queueOf={queueFor}
              onViewCauseList={onViewCauseList}
              onJoinCourt={onJoinCourt}
              onRefresh={() => void reload()}
              selectedCaseId={selectedCaseId}
              onOpenCase={openCase}
              onOpenTasks={openTasksForCase}
              onViewInCauseList={onViewInCauseList}
              tabActions={
                hasDay ? (
                  <div className="hidden lg:block">
                    <DayActions
                      onViewCauseList={onViewCauseList}
                      onJoinCourt={onJoinCourt}
                      onRefresh={() => void reload()}
                      fit="roomy"
                      locale={locale}
                    />
                  </div>
                ) : null
              }
              locale={locale}
            />
          </div>
        ) : (
          <div className={cn("px-4 pt-4 pb-8", HOME_FRAME)}>
            <Empty className="bg-surface-sunken">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <CloudAlert aria-hidden="true" />
                </EmptyMedia>
                <EmptyTitle>{pick(advHome.emptyDayTitle, locale)}</EmptyTitle>
                <EmptyDescription>
                  {pick(advHome.emptyDayBody, locale)}
                </EmptyDescription>
              </EmptyHeader>
              {jump ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={(event) => selectDay(jump.key, event.detail > 0)}
                >
                  {fillCopy(advHome.jumpNext, locale, {
                    day: jump.label,
                    n: String(jump.count),
                  })}
                </Button>
              ) : null}
            </Empty>
          </div>
        )}
        </div>
        </div>
      </main>

      <CompanionRail
        world={world}
        locale={locale}
        section={railSection}
        topOffset={TOP_BAR}
        onSectionChange={(section) => {
          setTaskHighlight(null);
          setRailSection(section);
        }}
        highlight={taskHighlight}
        verbOf={verbOf}
        onAct={actOn}
        onArchive={onArchiveTask}
        onViewAllTasks={() => router.push(TASKS_HOME)}
        stripless
        tabTop={TASK_TAB_TOP}
      />

      <CauseListDialog
        open={causeListOpen}
        onOpenChange={(open) => {
          setCauseListOpen(open);
          if (!open) setCauseListHighlight(null);
        }}
        world={world}
        now={now}
        day={selectedDay}
        singleCourt={singleCourt}
        highlight={causeListHighlight}
        onJoin={onJoinHearing}
        locale={locale}
      />

      <JoinHearingDialog
        open={joinOpen}
        onOpenChange={setJoinOpen}
        hearings={nowHearings}
        showCourt={singleCourt === null}
        onJoin={onJoinFromModal}
        onViewCauseList={() => {
          setJoinOpen(false);
          setCauseListOpen(true);
        }}
        locale={locale}
      />

      {actLayer}
    </CasePeekSurface>
  );
}
