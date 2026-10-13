"use client";

import * as React from "react";
import {
  Archive,
  ChevronDown,
  ChevronRight,
  FileClock,
  FileUp,
  CalendarClock,
  IndianRupee,
  ListChecks,
  MailQuestion,
  PenLine,
  Undo2,
  X,
  type LucideIcon,
} from "lucide-react";

import {
  useLocalStorageValue,
  writeLocalStorageValue,
} from "@/hooks/use-local-storage-value";
import { Button } from "@/components/ui/button";
import { CONTROL_REVEAL } from "@/components/chrome/motion";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Drawer, DrawerContent, DrawerTitle } from "@/components/ui/drawer";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { Locale } from "@/lib/onboarding/content";
import { pick } from "@/lib/onboarding/content";
import { advHome, fillCopy } from "@/lib/advocate/content";
import {
  railCaseLineOf,
  railGroups,
  railTasks,
  type RailGroup,
} from "@/lib/advocate/home";
import { dueCueOf } from "@/lib/tasks/format";
import { caseOf, summaryOf, type World } from "@/lib/tasks/selectors";
import type { Task, TaskKind } from "@/lib/tasks/types";
import { cn } from "@/lib/utils";
import "./mobile-hearing.css";
import "./companion-rail.css";

/**
 * The companion rail — Gmail's model. A persistent icon strip on the far right
 * holds one entry per section: Pending tasks (what is owed) and Hearing prep (the
 * substantial postings coming, which need lead time rather than a deadline).
 * Clicking an icon opens that section's panel beside the strip; clicking it
 * again — or the panel's own close button — returns to the strip alone.
 *
 * The rail sits one step off the page so the cards inside it read as panels in a
 * container rather than white-on-white — and that step runs in opposite
 * directions per theme, because depth does. In light the rail *sinks*
 * (`surface-sunken`) under white cards; in dark, where elevation is lightness and
 * `surface-sunken` is in fact *lighter* than the page, the rail holds the page
 * colour and the cards rise to `surface-raised` instead. Get that backwards and
 * every card in here reads as a hole.
 *
 * The hover follows the same logic: in light a card lifts with a shadow (a
 * darker fill would sink it below its own container); in dark it lifts by
 * going a step lighter, since shadows do not read on near-black. The rail's own
 * chrome hovers to `accent-strong`, plain `accent` being invisible on a sunken fill.
 */

export type RailSection = "tasks";

/** A request to trace a case's tasks in the rail; the nonce re-triggers it. */
export type TaskHighlight = { caseId: string; taskIds: string[]; nonce: number } | null;

type TaskPanelGroup = { key: RailGroup["key"] | "related" | "hearing"; tasks: Task[] };

function matchesHighlight(task: Task, highlight: TaskHighlight): boolean {
  return !!highlight && task.caseId === highlight.caseId && highlight.taskIds.includes(task.id);
}

/**
 * The stroke that traces a highlighted task's card. A rounded rect drawn once
 * around the boundary (`stroke-dashoffset` off `pathLength`), held, then faded —
 * a deliberate "look here", so it runs longer than routine UI motion. The draw
 * uses a strong ease-out; reduced-motion drops the travel for a plain fade.
 */
function TaskTraceStyles() {
  return (
    <style>{`
      @keyframes task-trace-draw {
        /* A short delay lets the rail settle and the eye arrive; then the stroke
           travels at a steady, gentle pace (soft start, not a fast ease-out that
           is already half-drawn before it is noticed), holds, and fades. */
        0%   { stroke-dashoffset: 100; opacity: 1; animation-timing-function: cubic-bezier(0.45, 0, 0.55, 1); }
        55%  { stroke-dashoffset: 0;   opacity: 1; }
        74%  { stroke-dashoffset: 0;   opacity: 1; animation-timing-function: ease-out; }
        100% { stroke-dashoffset: 0;   opacity: 0; }
      }
      @keyframes task-trace-fade {
        0% { opacity: 0; } 20% { opacity: 1; } 72% { opacity: 1; } 100% { opacity: 0; }
      }
      .task-trace-rect {
        x: 1.5px; y: 1.5px;
        width: calc(100% - 3px);
        height: calc(100% - 3px);
        rx: 7px;
        fill: none;
        stroke: var(--brand-accent);
        stroke-width: 2px;
        stroke-dasharray: 100;
        stroke-dashoffset: 100;
        animation: task-trace-draw 2000ms 60ms forwards;
      }
      @media (prefers-reduced-motion: reduce) {
        .task-trace-rect {
          stroke-dashoffset: 0;
          animation: task-trace-fade 1500ms 60ms ease forwards;
        }
      }
    `}</style>
  );
}

/**
 * Traces that have already run. A trace plays once per request: collapsing a
 * bucket unmounts its cards, and reopening it must not replay the stroke. A
 * new click on a "pending task" chip brings a new nonce, so it plays again.
 */
const playedTraces = new Set<number>();

/** The rounded stroke overlay for one traced card; a new `nonce` replays it. */
function TaskTraceRing({ nonce }: { nonce: number }) {
  // Read on first render, so every card the same request lights plays together.
  const [fresh] = React.useState(() => !playedTraces.has(nonce));
  React.useEffect(() => {
    playedTraces.add(nonce);
  }, [nonce]);
  if (!fresh) return null;
  return (
    <svg
      key={nonce}
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 z-20 size-full overflow-visible"
    >
      <rect className="task-trace-rect" pathLength={100} />
    </svg>
  );
}

/** What the task asks for, at a glance — one icon per kind, all muted. */
const KIND_ICON: Record<TaskKind, LucideIcon> = {
  sign: PenLine,
  pay: IndianRupee,
  file: FileUp,
  returned: Undo2,
  review: MailQuestion,
  hearing: CalendarClock,
  draft: FileClock,
};

const MIN_WIDTH = 70;
const MAX_WIDTH = 120;
/** Widths are multiples of the DS spacing unit. The default is a comfortable
 *  reading width — wide enough for a task title on one line, short of the full
 *  pull the reader can drag to. It is never the panel's full width. */
const DEFAULT_WIDTH = 100;

/**
 * The rail remembers itself, per user, across loads.
 *
 * Which panel is open is a working preference, not a per-visit question: someone
 * who closes the rail should find it closed next time, and today they did not.
 * On first run the tasks panel opens — §138 runs on clocks a missed day does not
 * give back, so the obligation surface is what an unconfigured rail shows. The
 * width, by contrast, is not remembered: the rail always opens at its default.
 */
const RAIL_SECTION_KEY = "dristi.advocate-rail-section";

/** The closed rail, written down — `null` is not a storable value. */
const CLOSED = "closed";

export function useRailSection(): [
  RailSection | null,
  (next: RailSection | null) => void,
] {
  // Server render and hydration agree on the default (the store's server
  // snapshot is null); the stored choice takes over immediately after.
  const stored = useLocalStorageValue(RAIL_SECTION_KEY);
  const section: RailSection | null = stored === CLOSED ? null : "tasks";

  const setSection = React.useCallback((next: RailSection | null) => {
    writeLocalStorageValue(RAIL_SECTION_KEY, next ?? CLOSED);
  }, []);

  return [section, setSection];
}

/**
 * Which rail treatment ships. Two candidates, one committed default; the
 * orchestrator flips this and screenshots both for the owner, and the loser is
 * deleted after the pick — there is no user-facing toggle.
 *
 *   A — "breathing card, overdue-anchored": the card container kept but fixed —
 *       a smaller kind icon, a full-width one-line title, the case name muted
 *       under it, and a compact right tag *only when overdue*. ~7 cards visible.
 *   B — "dense cause-list rows": the card containers dropped for a tight
 *       `divide-hairline` list on one panel surface; overdue as a small inline
 *       ink tag. ~40% more rows, reading as a worklist.
 */
const RAIL_VARIANT: "A" | "B" = "A";

/**
 * The two panels share one row frame, whichever variant is on — a task card and
 * a prep card were drifting apart one local `cn()` at a time, and that is the
 * defect the owner named. Both are top-aligned and let content set the height:
 * `min-h-24` (the old floor) held a 96px card around ~64px of content, which is
 * the sag the redesign removes. Nothing here reserves a fixed right column, so
 * the title spans nearly the full width and stops truncating at ~20 characters.
 */
const CARD_A =
  "group/row relative flex cursor-pointer items-start gap-3.5 px-4 py-4 transition-colors duration-200 hover:bg-muted has-focus-visible:bg-muted dark:hover:bg-accent dark:has-focus-visible:bg-accent";

const ROW_B =
  "group/row relative flex cursor-pointer items-start gap-2.5 px-3 py-2.5 transition-colors hover:bg-accent has-focus-visible:bg-accent";

/** The bucket's item list: gapped cards (A) or one divided panel surface (B). */
const LIST_A = "flex flex-col divide-y divide-hairline";
const LIST_B =
  "flex flex-col divide-y divide-hairline overflow-hidden rounded-lg border border-hairline bg-card pb-0 dark:bg-surface-raised";

/** Variant A's kind-icon tile — smaller than the old one, a small well inside the card. */
const CARD_ICON_A =
  "flex size-9 shrink-0 items-center justify-center self-center rounded-full bg-surface-sunken text-muted-foreground transition-colors group-hover/row:bg-card";

/** The title owns the whole card hit area and always shows in full, wrapping. */
const CARD_TITLE =
  "text-left text-body-compact font-medium whitespace-normal break-words after:absolute after:inset-0 after:rounded-lg focus-visible:outline-none focus-visible:after:ring-3 focus-visible:after:ring-ring/50";

/**
 * When something matters, in the place every repeated row on this screen puts
 * its time: the row-action cell, at rest.
 *
 * Two lines by construction — the relative phrase over the date — so the string
 * that used to wrap at a 320px rail ("6 days overdue · 22 Aug") cannot. Overdue
 * speaks in destructive ink and nothing else on the panel does, which is how the
 * worst item leads without a badge: `railTasks` sorts blocking-first to stay in
 * step with /tasks, so position cannot carry it and colour has to.
 *
 * Used by both panels. That is the entire point of it existing.
 */
function WhenBlock({
  lead,
  sub,
  tone,
}: {
  lead: string;
  sub?: string;
  tone: "muted" | "overdue";
}) {
  return (
    <span className="flex flex-col items-end gap-0.5 text-right">
      <span
        className={cn(
          "text-caption font-medium whitespace-nowrap tabular-nums",
          tone === "overdue" ? "text-destructive-ink" : "text-muted-foreground"
        )}
      >
        {lead}
      </span>
      {sub ? (
        <span className="text-caption whitespace-nowrap tabular-nums text-muted-foreground">
          {sub}
        </span>
      ) : null}
    </span>
  );
}

/** The case's number as the hearing card shows it: the CNR, else the ST. */
function caseNumberOf(world: World, task: Task | undefined): string | undefined {
  if (!task) return undefined;
  const found = caseOf(world, task);
  return found?.cnr || found?.stNumber || undefined;
}

function groupLabel(locale: Locale, group: TaskPanelGroup): string {
  if (group.key === "related") return pick({ en: "Other tasks for this case", ml: "ഈ കേസിന്റെ മറ്റ് ജോലികൾ" }, locale);
  if (group.key === "hearing") return pick({ en: "For this case", ml: "ഈ കേസിന്" }, locale);
  if (group.key === "today") return pick(advHome.groupToday, locale);
  return pick(advHome.groupSoon, locale);
}

/**
 * The panel's own header: the title and the way out. No icon (the strip beside it
 * already carries one, lit) and no caption unless the section's contents need
 * explaining — "Pending tasks" does not.
 */
function PanelHeader({
  title,
  caption,
  locale,
  onClose,
}: {
  title: string;
  /** Only where the selection rule is not obvious from the title. */
  caption?: string;
  locale: Locale;
  onClose: () => void;
}) {
  return (
    <div className="flex flex-col gap-1 px-4 pt-4 pb-3">
      <div className="flex items-center gap-2">
        <h2 className="flex-1 text-title-s font-semibold">{title}</h2>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={onClose}
          aria-label={pick(advHome.railClose, locale)}
          className="-mr-1 size-10 md:size-8 md:pointer-coarse:size-10 hover:bg-accent-strong"
        >
          <X aria-hidden="true" />
        </Button>
      </div>
      {caption ? (
        <p className="text-caption text-muted-foreground">{caption}</p>
      ) : null}
    </div>
  );
}

/**
 * A collapsible bucket header: a filled bar, so the buckets read as sections
 * before the cards do. The nearest bucket ("Due today") is amber, later ones
 * sunken grey; label in caps with its count in a pill, chevron at the end.
 */
function BucketTrigger({
  label,
  sub,
  count,
  lead,
}: {
  label: string;
  /** A quieter line under the label: the case "For this case" means. */
  sub?: string;
  count: number;
  /** The nearest bucket, whose header carries the warning ink. */
  lead?: boolean;
}) {
  return (
    <CollapsibleTrigger
      className={cn(
        "group/bucket flex min-h-10 w-full shrink-0 items-center gap-2 rounded-lg border px-4 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        lead
          ? "border-warning/20 bg-warning-muted/40 hover:bg-warning-muted/70"
          : "border-hairline bg-surface-sunken hover:bg-accent-strong"
      )}
    >
      <span className={cn("flex min-w-0 flex-col items-start", sub && "py-2")}>
        <span className="flex items-center gap-2">
          <span
            className={cn(
              /* Sentence case, as every heading in the product (owner, Oct 8). */
              "text-caption font-semibold",
              lead ? "text-warning-ink" : "text-muted-foreground"
            )}
          >
            {label}
          </span>
          <span
            className={cn(
              "flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-caption font-semibold tabular-nums",
              lead ? "bg-warning-muted text-warning-ink" : "bg-accent-strong text-muted-foreground"
            )}
          >
            {count}
          </span>
        </span>
        {/* Which case "this case" is, at a note's weight (owner, Oct 8). */}
        {sub ? (
          <span className="truncate font-mono text-caption font-normal text-muted-foreground">
            {sub}
          </span>
        ) : null}
      </span>
      <ChevronDown
        aria-hidden="true"
        className={cn(
          "ml-auto size-4 transition-transform group-data-open/bucket:rotate-180",
          lead ? "text-warning-ink" : "text-muted-foreground"
        )}
      />
    </CollapsibleTrigger>
  );
}

/* ───────────────────────────── pending tasks ───────────────────────────── */

/**
 * One pending task: a single-line title over the matter line. The kind icon
 * carries the what; the hover action carries the verb this viewer holds.
 *
 * Only overdue carries a per-card time signal — the bucket header already says
 * "Due today", so repeating it on every card inside was duplication that also
 * cost the title its width. An on-time card therefore has no right-hand tag, and
 * the title runs nearly full width.
 */
/**
 * True inside the bottom sheet (phone and tablet). There is no hover there, so a
 * task card opens a tray on tap, the same disclosure the hearing cards use, with
 * the task's action as the button and Archive beside it.
 */
const SheetModeContext = React.createContext(false);

function TaskCard({
  world,
  task,
  verb,
  onAct,
  onArchive,
  traceNonce,
}: {
  world: World;
  task: Task;
  verb: string;
  onAct: (task: Task) => void;
  /** Put the task away — revealed beside the action on hover. */
  onArchive?: (task: Task) => void;
  /** When set, this card is being traced — the stroke runs, keyed by the nonce. */
  traceNonce?: number | null;
}) {
  const Icon = KIND_ICON[task.kind];
  const due = dueCueOf(task, new Date(world.now));
  const dense = RAIL_VARIANT === "B";
  const sheet = React.useContext(SheetModeContext);
  const [open, setOpen] = React.useState(false);

  if (sheet) {
    return (
      <Collapsible open={open} onOpenChange={setOpen}>
        <div className={cn(CARD_A, "relative z-10")} data-task-trace={traceNonce != null ? "1" : undefined}>
          {traceNonce != null ? <TaskTraceRing key={traceNonce} nonce={traceNonce} /> : null}
          <span aria-hidden="true" className={CARD_ICON_A}>
            <Icon className="size-4" />
          </span>
          <div className="flex min-w-0 flex-1 flex-col items-stretch gap-0.5">
            <CollapsibleTrigger title={task.title} className={cn(CARD_TITLE, "group/task")}>
              {task.title}
            </CollapsibleTrigger>
            <span className="w-full text-caption break-words text-muted-foreground">
              {railCaseLineOf(world, task)}
            </span>
            {due.overdue ? (
              <span className="mt-1 text-caption font-medium tabular-nums text-destructive-ink">
                {due.primary} · {due.date}
              </span>
            ) : null}
          </div>
          <span aria-hidden="true" className="flex size-5 shrink-0 items-center justify-center self-center rounded-full border border-border bg-accent-strong text-muted-foreground">
            <ChevronDown className={cn("size-3.5 transition-transform duration-200 motion-reduce:transition-none", open && "rotate-180")} />
          </span>
        </div>
        <CollapsibleContent className="hearing-reveal mx-3 overflow-hidden">
          <div className="hearing-actions flex items-center gap-2 rounded-b-xl bg-secondary p-3">
            <Button className="min-w-0 flex-1" onClick={() => onAct(task)}>
              <span className="truncate">{verb}</span>
            </Button>
            {onArchive ? (
              <Button variant="outline" className="shrink-0 border-transparent bg-card" onClick={() => onArchive(task)}>
                <Archive aria-hidden="true" />Archive
              </Button>
            ) : null}
          </div>
        </CollapsibleContent>
      </Collapsible>
    );
  }

  return (
    <div
      className={dense ? ROW_B : CARD_A}
      data-task-trace={traceNonce != null ? "1" : undefined}
    >
      {traceNonce != null ? <TaskTraceRing key={traceNonce} nonce={traceNonce} /> : null}
      {dense ? (
        <span aria-hidden="true" className="mt-0.5 shrink-0 text-muted-foreground">
          <Icon className="size-4" />
        </span>
      ) : (
        <span aria-hidden="true" className={CARD_ICON_A}>
          <Icon className="size-4" />
        </span>
      )}

      <div className="flex min-w-0 flex-1 flex-col items-stretch gap-0.5">
        <button
          type="button"
          onClick={() => onAct(task)}
          title={task.title}
          className={CARD_TITLE}
        >
          {task.title}
        </button>
        <span className="w-full text-caption break-words text-muted-foreground md:truncate md:pointer-coarse:overflow-visible md:pointer-coarse:whitespace-normal">
          {railCaseLineOf(world, task)}
        </span>
        {due.overdue ? (
          <span className="mt-1 text-caption font-medium tabular-nums text-destructive-ink md:hidden md:pointer-coarse:block">
            {due.primary} · {due.date}
          </span>
        ) : null}
      </div>

      {/* Overdue is the only time signal on a task card, and it is ink, not a
          badge: a red chip on every overdue row would spend the panel's whole
          destructive budget before the count is read. At rest the cell holds
          the overdue ink or a chevron; on hover the action and Archive take the
          same cell. Both states share one grid cell, so the cell is as wide as
          the wider of them: the rest state sits flush right and the title never
          rewraps when the buttons appear. */}
      <div className="flex shrink-0 items-center self-center">
        <span className="hidden grid-cols-1 items-center justify-items-end md:grid md:pointer-coarse:hidden">
          <span className="col-start-1 row-start-1 flex items-center transition-opacity group-hover/row:opacity-0 group-focus-within/row:opacity-0">
            {due.overdue ? (
              dense ? (
                <span className="text-caption font-medium whitespace-nowrap tabular-nums text-destructive-ink">
                  {due.primary}
                </span>
              ) : (
                <WhenBlock lead={due.primary} sub={due.date} tone="overdue" />
              )
            ) : (
              <ChevronRight aria-hidden="true" className="size-4 text-muted-foreground" />
            )}
          </span>
          <span className="pointer-events-none col-start-1 row-start-1 flex items-center gap-1 opacity-0 transition-opacity group-hover/row:pointer-events-auto group-hover/row:opacity-100 group-focus-within/row:pointer-events-auto group-focus-within/row:opacity-100">
            <Button
              variant="outline"
              size={dense ? "xs" : "sm"}
              tabIndex={-1}
              aria-hidden="true"
              onClick={() => onAct(task)}
              className="relative z-10"
            >
              {verb}
            </Button>
            {onArchive ? (
              <ArchiveButton task={task} onArchive={onArchive} className="size-8" />
            ) : null}
          </span>
        </span>
        {/* Touch: no hover, so Archive stands on its own. */}
        {onArchive ? (
          <ArchiveButton task={task} onArchive={onArchive} className="size-10 md:hidden md:pointer-coarse:flex" />
        ) : null}
      </div>
    </div>
  );
}

function ArchiveButton({
  task,
  onArchive,
  className,
}: {
  task: Task;
  onArchive: (task: Task) => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      aria-label={`Archive: ${task.title}`}
      title="Archive"
      onClick={(event) => {
        event.stopPropagation();
        onArchive(task);
      }}
      className={cn(
        "relative z-10 flex shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent-strong hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none",
        className
      )}
    >
      <Archive aria-hidden="true" className="size-4" />
    </button>
  );
}

/** One due-date bucket. Opens on its own when a trace lands inside it. */
function TaskBucket({
  group,
  world,
  locale,
  verbOf,
  onAct,
  onArchive,
  highlight,
  groupTrace = null,
}: {
  group: TaskPanelGroup;
  world: World;
  locale: Locale;
  verbOf: (task: Task) => string;
  onAct: (task: Task) => void;
  onArchive: (task: Task) => void;
  highlight: TaskHighlight;
  /** Set on the "For this hearing" group: draw one outline around all of it. */
  groupTrace?: number | null;
}) {
  const hasTrace = group.tasks.some((task) => matchesHighlight(task, highlight));
  const traceNonce = hasTrace ? highlight?.nonce : undefined;
  // A reader's choice lasts until a new targeted alert arrives. Deriving this
  // from the request avoids a post-paint reopen and still permits manual collapse.
  const [manual, setManual] = React.useState<{ nonce: number | undefined; open: boolean } | null>(null);
  const open = manual && manual.nonce === traceNonce
    ? manual.open
    : group.key === "today" || group.key === "hearing" || hasTrace;

  return (
    <Collapsible
      open={open}
      onOpenChange={(open) => setManual({ nonce: traceNonce, open })}
      className="flex flex-col gap-3"
    >
      <BucketTrigger
        label={groupLabel(locale, group)}
        sub={group.key === "hearing" ? caseNumberOf(world, group.tasks[0]) : undefined}
        count={group.tasks.length}
        lead={group.key === "today"}
      />
      <CollapsibleContent>
        <ul className={cn("relative", RAIL_VARIANT === "B" ? LIST_B : LIST_A)}>
          {/* One outline around the whole group, once its cards have arrived. */}
          {groupTrace != null ? <TaskTraceRing key={groupTrace} nonce={groupTrace} /> : null}
          {group.tasks.map((task) => (
            <li key={task.id} data-task-id={task.id}>
              <TaskCard
                world={world}
                task={task}
                verb={verbOf(task)}
                onAct={onAct}
                onArchive={onArchive}
                traceNonce={
                  highlight && matchesHighlight(task, highlight)
                    ? highlight.nonce
                    : null
                }
              />
            </li>
          ))}
        </ul>
      </CollapsibleContent>
    </Collapsible>
  );
}

function TasksPanel({
  world,
  locale,
  verbOf,
  onAct,
  onArchive,
  onClose,
  onViewAll,
  highlight,
}: {
  world: World;
  locale: Locale;
  verbOf: (task: Task) => string;
  onAct: (task: Task) => void;
  onArchive: (task: Task) => void;
  onClose: () => void;
  onViewAll: () => void;
  highlight: TaskHighlight;
}) {
  const now = Number(new Date(world.now));
  const baseGroups: TaskPanelGroup[] = railGroups(world, now);
  const visibleIds = new Set(baseGroups.flatMap((group) => group.tasks.map((task) => task.id)));
  const related = railTasks(world).filter((task) => matchesHighlight(task, highlight) && !visibleIds.has(task.id));
  const count = summaryOf(world).action;
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const nonce = highlight?.nonce ?? null;

  /*
   * A hearing's "N pending tasks" pill gathers its tasks. The panel first shows
   * the usual urgency order; a beat later the hearing's tasks slide up into a
   * "For this hearing" group at the top (the others close the gap), and one
   * outline is drawn around the group. Closing the panel clears the highlight,
   * and the list falls back to urgency order.
   */
  const [pinned, setPinned] = React.useState<number | null>(null);
  const [groupTrace, setGroupTrace] = React.useState<number | null>(null);
  const firstRects = React.useRef<Map<string, DOMRect> | null>(null);
  if (pinned !== null && pinned !== nonce) {
    setPinned(null);
    setGroupTrace(null);
  }

  React.useEffect(() => {
    if (nonce == null) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const timer = window.setTimeout(() => {
      const box = scrollRef.current;
      if (box) {
        box.scrollTop = 0;
        firstRects.current = reduced
          ? null
          : new Map(
              [...box.querySelectorAll<HTMLElement>("[data-task-id]")].map((el) => [
                el.dataset.taskId as string,
                el.getBoundingClientRect(),
              ])
            );
      }
      setPinned(nonce);
    }, reduced ? 0 : 450);
    return () => window.clearTimeout(timer);
  }, [nonce]);

  // FLIP: every card that moved glides from where it was to where it is now;
  // a card that was out of view (a closed bucket) rises in. Then the outline.
  React.useLayoutEffect(() => {
    if (pinned == null) return;
    const box = scrollRef.current;
    const first = firstRects.current;
    firstRects.current = null;
    const DURATION = 520;
    if (box && first) {
      box.querySelectorAll<HTMLElement>("[data-task-id]").forEach((el) => {
        const last = el.getBoundingClientRect();
        const from = first.get(el.dataset.taskId as string);
        const keyframes = from
          ? [{ transform: `translateY(${from.top - last.top}px)` }, { transform: "translateY(0)" }]
          : [{ transform: "translateY(16px)", opacity: 0 }, { transform: "translateY(0)", opacity: 1 }];
        if (from && Math.abs(from.top - last.top) < 1) return;
        el.animate(keyframes, { duration: DURATION, easing: "cubic-bezier(0.2, 0.8, 0.2, 1)" });
      });
    }
    const timer = window.setTimeout(() => setGroupTrace(pinned), first ? DURATION : 0);
    return () => window.clearTimeout(timer);
  }, [pinned]);

  let groups: TaskPanelGroup[];
  if (pinned != null && highlight) {
    const mine = railTasks(world).filter((task) => matchesHighlight(task, highlight));
    const ids = new Set(mine.map((task) => task.id));
    groups = [
      { key: "hearing", tasks: mine },
      ...baseGroups
        .map((group) => ({ ...group, tasks: group.tasks.filter((task) => !ids.has(task.id)) }))
        .filter((group) => group.tasks.length > 0),
    ];
  } else {
    groups = related.length ? [{ key: "related", tasks: related }, ...baseGroups] : baseGroups;
  }

  return (
    // min-h-0 lets the panel shrink to its container (the bottom sheet caps its
    // height), so the list in the middle scrolls instead of being clipped.
    <div className="flex h-full min-h-0 min-w-0 flex-1 flex-col">
      <TaskTraceStyles />
      <PanelHeader
        title={pick(advHome.railTitle, locale)}
        caption={related.length ? pick({ en: "Due in the next 3 days and tasks for this case", ml: "അടുത്ത 3 ദിവസത്തെ ജോലികളും ഈ കേസിന്റെ ജോലികളും" }, locale) : pick(advHome.railScope, locale)}
        locale={locale}
        onClose={onClose}
      />

      {groups.length ? (
        <div
          ref={scrollRef}
          className="flex min-h-0 flex-1 flex-col gap-3 overflow-auto px-3 pb-3"
        >
          {groups.map((group) => (
            <TaskBucket
              key={group.key}
              group={group}
              world={world}
              locale={locale}
              verbOf={verbOf}
              onAct={onAct}
              onArchive={onArchive}
              // Cards are never traced one by one here: the gathered group
              // gets a single outline once it has formed.
              highlight={null}
              groupTrace={group.key === "hearing" ? groupTrace : null}
            />
          ))}
        </div>
      ) : (
        <div className="flex flex-1 flex-col justify-center gap-1 px-6 pb-8 text-center">
          <p className="text-body-compact font-medium">
            {pick(advHome.railEmptyTitle, locale)}
          </p>
          <p className="text-caption text-muted-foreground">
            {pick(advHome.railEmptyBody, locale)}
          </p>
        </div>
      )}

      <div className="border-t border-hairline bg-surface-sunken px-4 py-3 dark:bg-transparent">
        {/* A full-width button, per the lead's wireframe: the way out to /tasks. */}
        <Button variant="outline" className="h-10 w-full border-hairline" onClick={onViewAll}>
          {fillCopy(advHome.railViewAll, locale, { n: String(count) })}
          <ChevronRight aria-hidden="true" />
        </Button>
      </div>
    </div>
  );
}

/* ───────────────────────────── the strip ───────────────────────────── */

/** One entry on the strip: icon, count, active state — like Gmail's side apps. */
function StripButton({
  icon: Icon,
  label,
  count,
  countTone,
  active,
  onClick,
}: {
  icon: LucideIcon;
  label: string;
  count: number;
  /** Only a count that reports a *status* is coloured; a tally is neutral. */
  countTone: "destructive" | "neutral";
  active: boolean;
  onClick: () => void;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          aria-label={label}
          aria-pressed={active}
          onClick={onClick}
          className={cn(
            "relative flex size-10 items-center justify-center rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            active
              ? "bg-brand-muted text-brand-muted-foreground"
              : "text-muted-foreground hover:bg-accent-strong"
          )}
        >
          {/* The open section is marked twice over: the tinted tile, and a brand
              bar on the strip's edge — the same marker a mail client puts against
              the row you are in, readable at a glance down the whole strip. */}
          {active ? (
            <span
              aria-hidden="true"
              className="absolute -left-2 h-6 w-0.5 rounded-full bg-brand-accent"
            />
          ) : null}
          <Icon aria-hidden="true" className="size-5" />
          {count ? (
            <span
              aria-hidden="true"
              className={cn(
                "absolute -top-1 -right-1 flex min-w-4 items-center justify-center rounded-full px-1 text-caption tabular-nums",
                countTone === "destructive"
                  ? "bg-destructive text-destructive-foreground"
                  : // Substantial hearings ahead is a tally, not a warning. On the
                    // rail's own sunken fill a neutral pill has to rise to read at
                    // all — the card step, with a hairline to hold its edge.
                    "bg-card font-medium text-muted-foreground ring-1 ring-hairline dark:bg-surface-raised"
              )}
            >
              {count}
            </span>
          ) : null}
        </button>
      </TooltipTrigger>
      <TooltipContent side="left">{label}</TooltipContent>
    </Tooltip>
  );
}

/**
 * Pending tasks as a side tab hung off the screen's right edge: white, its top
 * and bottom leaning in and curving into the edge the way the sitting tabs meet
 * their panel. Replaces the rail's strip where a screen opts in.
 */
function PendingTasksTab({
  count,
  label,
  open,
  accent = false,
  onToggle,
  buttonRef,
}: {
  count: number;
  label: string;
  open: boolean;
  /** The panel's resize edge is lit: the outline takes its colour. */
  accent?: boolean;
  onToggle: () => void;
  buttonRef?: React.Ref<HTMLButtonElement>;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          ref={buttonRef}
          type="button"
          aria-label={label}
          aria-pressed={open}
          onClick={onToggle}
          className={cn(
            "group/tasktab relative flex size-12 items-center justify-center transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
            open ? "text-brand-muted-foreground" : "text-muted-foreground"
          )}
        >
          <TaskTabShape accent={accent} />
          {/* The icon and its count read as the strip's button did. */}
          {/* Nudged left so the count keeps 8px off the edge. */}
          <span className="relative mr-2">
            <ListChecks aria-hidden="true" className="size-5" />
            {count ? (
              <span aria-hidden="true" className="absolute -top-2 -right-2.5 flex min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-caption text-destructive-foreground tabular-nums">
                {count}
              </span>
            ) : null}
          </span>
        </button>
      </TooltipTrigger>
      <TooltipContent side="left">{label}</TooltipContent>
    </Tooltip>
  );
}

/** A soft shadow cast left, following the tab's outline, to lift it a plane. */
const TASK_TAB_SHADOW =
  "drop-shadow(-1px 1px 1px color-mix(in oklab, var(--color-foreground) 8%, transparent))";

/**
 * The side tab's outline, drawn as one piece: a 48px body with a rounded far
 * side, and a foot above and below that leans in and curves onto the attaching
 * edge (x = 48). One fill and one hairline stroke, so nothing meets at a seam.
 * The stroke leaves the attaching edge open; the fill runs to it, covering the
 * rail's own 1px seam where the tab sits on it.
 */
const TASK_TAB_EDGE =
  "M47.5 0 C47.5 5.5 43.5 8.2 35 8.6 L12 9.4 C3.6 9.8 0.5 13 0.5 20 V68 C0.5 75 3.6 78.2 12 78.6 L35 79.4 C43.5 79.8 47.5 82.5 47.5 88";

/** The side tab's body height and the reach of each foot along the edge. */
const TASK_TAB_BODY = 48;
const TASK_TAB_FOOT = 20;

function TaskTabShape({ accent }: { accent: boolean }) {
  return (
    // Inline size: an unsized svg in a button can be shrunk by its styles.
    <svg
      aria-hidden="true"
      viewBox="0 0 48 88"
      style={{ width: 48, height: 88, top: -20 }}
      className="pointer-events-none absolute left-0 overflow-visible"
    >
      <path d={`${TASK_TAB_EDGE} H48 V0 Z`} fill="var(--color-card)" />
      <path
        d={TASK_TAB_EDGE}
        fill="none"
        stroke={accent ? "var(--color-brand-accent)" : "var(--color-hairline)"}
        strokeWidth={accent ? 2 : 1}
        className={cn("transition-[stroke] duration-150", !accent && "task-tab-edge")}
      />
    </svg>
  );
}

/** Whether the tasks panel opens as a bottom sheet (phone, tablet, touch). */
export function useTasksAsSheet(): boolean {
  const isMobile = useIsMobile();
  return useMediaQuery(SHEET_QUERY) || isMobile;
}

/** Narrower than xl, or touch-first: the tasks panel is a bottom sheet there. */
const SHEET_QUERY = "(max-width: 1279px), (pointer: coarse)";

function useMediaQuery(query: string): boolean {
  return React.useSyncExternalStore(
    (callback) => {
      const media = window.matchMedia(query);
      media.addEventListener("change", callback);
      return () => media.removeEventListener("change", callback);
    },
    () => window.matchMedia(query).matches,
    () => false
  );
}

export function CompanionRail({
  world,
  locale,
  section,
  topOffset,
  onSectionChange,
  highlight,
  verbOf,
  onAct,
  onArchive,
  onViewAllTasks,
  stripless = false,
  tabTop = 0,
}: {
  world: World;
  locale: Locale;
  /** Which panel is open; null = strip only. */
  section: RailSection | null;
  /** The shell top bar's height — the rail hangs below it. */
  topOffset: string;
  onSectionChange: (section: RailSection | null) => void;
  /** A pending-flag click asking the tasks panel to trace a case's tasks. */
  highlight: TaskHighlight;
  /** The viewer's verb for a task — resolved by the screen that owns the world. */
  verbOf: (task: Task) => string;
  onAct: (task: Task) => void;
  onArchive: (task: Task) => void;
  onViewAllTasks: () => void;
  /** No strip: the screen hangs its own opener (a side tab) on its board. */
  stripless?: boolean;
  /** Stripless: how far below the rail's top the side tab hangs. */
  tabTop?: number;
}) {
  const tasksCount = summaryOf(world).action;
  const isMobile = useIsMobile();
  // The panel stands beside the board only where there is room for both: a wide
  // screen driven by a mouse. On a phone, and on a tablet in either orientation
  // (narrower than xl, or touch-first), it is a bottom sheet instead, so it never
  // covers or crushes the board.
  const asSheet = useMediaQuery(SHEET_QUERY) || isMobile;
  // Opening the desktop rail is a saved workspace preference. A sheet opens only
  // after an explicit task trigger or a hearing's pending flag.
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const highlightNonce = highlight?.nonce ?? null;
  const [seenHighlight, setSeenHighlight] = React.useState(highlightNonce);
  if (seenHighlight !== highlightNonce) {
    setSeenHighlight(highlightNonce);
    if (highlightNonce !== null && asSheet) setMobileOpen(true);
  }
  const panelRef = React.useRef<HTMLDivElement>(null);
  const dragFrom = React.useRef<{ x: number; width: number; unit: number } | null>(null);

  const clamp = (w: number) => Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, w));

  // The rail always opens at the comfortable default width. A drag holds while the
  // panel is open (`dragging` is the live value; `restingWidth` the committed one),
  // but the width is deliberately NOT remembered across opens: closing and reopening
  // returns to the default rather than the last width the reader dragged to.
  const [restingWidth, setRestingWidth] = React.useState(DEFAULT_WIDTH);
  const [dragging, setDragging] = React.useState<number | null>(null);
  // Reset to the default whenever the panel opens or closes — adjusted from a
  // `section` change during render (the React pattern, not an effect), so a reopen
  // always starts at the default while a drag (which does not change `section`) holds.
  const [widthEpoch, setWidthEpoch] = React.useState(section);
  if (section !== widthEpoch) {
    setWidthEpoch(section);
    setRestingWidth(DEFAULT_WIDTH);
    if (dragging !== null) setDragging(null);
  }
  const width = dragging ?? restingWidth;

  const commitWidth = React.useCallback((w: number) => setRestingWidth(w), []);

  function onPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    if (e.button !== 0 || !panelRef.current) return;
    dragFrom.current = { x: e.clientX, width, unit: panelRef.current.getBoundingClientRect().width / width };
    setDragging(width);
    e.currentTarget.setPointerCapture(e.pointerId);
  }
  function onPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!dragFrom.current) return;
    // The panel sits on the right, so dragging left grows it.
    setDragging(clamp(dragFrom.current.width + (dragFrom.current.x - e.clientX) / dragFrom.current.unit));
  }
  function onPointerUp() {
    if (dragFrom.current && dragging !== null) commitWidth(dragging);
    dragFrom.current = null;
    setDragging(null);
  }
  function cancelResize() {
    dragFrom.current = null;
    setDragging(null);
  }
  function onHandleKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    const next = e.key === "ArrowLeft" ? width + 4
      : e.key === "ArrowRight" ? width - 4
      : e.key === "Home" ? MIN_WIDTH
      : e.key === "End" ? MAX_WIDTH : null;
    if (e.key === "Escape") cancelResize();
    if (next !== null) {
      e.preventDefault();
      commitWidth(clamp(next));
    }
  }

  // The panel slides in and out as one solid piece: the rail's width grows from
  // nothing with the panel pinned to its left edge, pushing the board aside. No
  // fade; reduced motion snaps.
  const asideRef = React.useRef<HTMLDivElement>(null);
  const taskTabRef = React.useRef<HTMLButtonElement>(null);
  // The resize edge is lit while hovered, focused or dragged; stripless, the
  // light runs around the side tab's outline instead of through it.
  const [edgeHot, setEdgeHot] = React.useState(false);
  const openedFrom = React.useRef(section);
  const slide = { duration: 380, easing: "cubic-bezier(0.32, 0.72, 0, 1)" };
  const reduced = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  React.useLayoutEffect(() => {
    const was = openedFrom.current;
    openedFrom.current = section;
    const el = asideRef.current;
    if (!stripless || was || !section || asSheet || !el || reduced()) return;
    el.animate([{ width: "0px" }, { width: `${el.offsetWidth}px` }], slide);
  });

  const toggle = (next: RailSection) => {
    // On a tablet the strip stays, but its button raises the sheet.
    if (asSheet) {
      setMobileOpen((open) => !open);
      return;
    }
    onSectionChange(section === next ? null : next);
  };
  const finishClose = () => {
    // The collapsed panel is inert; return a focused close/resize control to
    // the persistent tab before hiding its subtree.
    if (panelRef.current?.contains(document.activeElement)) taskTabRef.current?.focus({ preventScroll: true });
    onSectionChange(null);
  };
  const close = () => {
    const el = asideRef.current;
    if (!stripless || asSheet || !el || reduced()) return finishClose();
    el.animate([{ width: `${el.offsetWidth}px` }, { width: "0px" }], { ...slide, duration: 300, fill: "forwards" })
      .onfinish = (event) => {
        finishClose();
        (event.target as Animation).cancel();
      };
  };

  return (
    <>
    <aside
      aria-label={pick(advHome.railTitle, locale)}
      data-closed={stripless && !section}
      style={{ top: topOffset, height: `calc(100svh - ${topOffset})`, "--rail-peek-duration": `${CONTROL_REVEAL.duration}ms`, "--rail-peek-easing": CONTROL_REVEAL.easing } as React.CSSProperties}
      // The strip, and the panel pushing the board aside, belong to wide mouse-driven
      // screens only; a phone or tablet gets the floating button and the sheet.
      className={cn(
        "pending-tasks-rail sticky hidden shrink-0 self-start bg-card dark:bg-background",
        !asSheet && (!stripless || section) && "md:flex",
        // Stripless, the rail is always there, zero wide while closed, so the
        // side tab on its left edge rests on the screen edge and rides out with
        // the panel when it opens.
        stripless ? !asSheet && "z-20 md:flex" : "border-l border-hairline",
        stripless && section && "border-l border-hairline"
      )}
    >
      {stripless && !asSheet && section ? (
        // The lit edge as two runs over the rail's seam, above and below the
        // side tab; the tab's outline lights in the gap, so the light goes
        // around the tab rather than through it.
        <>
          <span
            aria-hidden="true"
            style={{ left: -1, height: tabTop - TASK_TAB_FOOT }}
            className={cn("pointer-events-none absolute top-0 z-30 w-0.5 transition-colors", edgeHot || dragging !== null ? "bg-brand-accent" : "bg-transparent")}
          />
          <span
            aria-hidden="true"
            style={{ left: -1, top: tabTop + TASK_TAB_BODY + TASK_TAB_FOOT }}
            className={cn("pointer-events-none absolute bottom-0 z-30 w-0.5 transition-colors", edgeHot || dragging !== null ? "bg-brand-accent" : "bg-transparent")}
          />
        </>
      ) : null}
      {stripless && !asSheet ? (
        // An absolute child is placed from the rail's padding box, which starts
        // just inside its 1px seam: `right-full` lays the tab's body over the seam
        // and lands the feet's strokes on the seam's centre line.
        <div
          // Above the peek, so the tab covers the peek's edge as it covers the
          // open panel's seam.
          className="pending-rail-trigger absolute right-full z-10 cursor-pointer"
          style={{ top: tabTop, filter: TASK_TAB_SHADOW }}
          onClick={(event) => {
            // Keep the original outer-edge hit area clickable after the tab
            // moves inward. Native button clicks already call onToggle.
            if (event.target !== event.currentTarget) return;
            if (section) close();
            else onSectionChange("tasks");
          }}
        >
          <div className="pending-rail-tab">
            <PendingTasksTab
              buttonRef={taskTabRef}
              count={tasksCount}
              label={fillCopy(advHome.railOpen, locale, { n: String(tasksCount) })}
              open={section === "tasks"}
              accent={(edgeHot || dragging !== null) && section === "tasks"}
              onToggle={() => (section ? close() : onSectionChange("tasks"))}
            />
          </div>
        </div>
      ) : null}
      {stripless && !asSheet && !section ? (
        // A clipped glimpse of the panel edge. It never reserves layout space,
        // exposes task actions, or changes the saved open/closed preference.
        // The clip runs 8px past the sliver so the edge's shadow is not cut off.
        <div aria-hidden="true" className="pointer-events-none absolute inset-y-0 right-0 w-6 overflow-hidden">
          <div className="pending-rail-peek ml-2 h-full w-4 border-l border-hairline bg-card dark:bg-background" />
        </div>
      ) : null}
      <div
        ref={asideRef}
        inert={stripless && !section ? true : undefined}
        aria-hidden={stripless && !section ? true : undefined}
        className={cn("flex h-full", stripless && "overflow-hidden")}
        style={stripless && !section ? { width: 0 } : undefined}
      >
      {/* Stripless, the panel stays built while the rail is hidden, so a click
          starts the slide at once instead of waiting on the list to render. */}
      {(section || stripless) && !asSheet ? (
        <div
          // Keyed by section so opening the strip — or switching panels — plays a
          // short slide-and-fade rather than snapping in, the same easing the case
          // peek uses. Motion is suppressed for reduced-motion readers.
          key={stripless ? "tasks" : section}
          ref={panelRef}
          className={cn("relative flex h-full shrink-0", !stripless && "duration-200 ease-out animate-in fade-in-0 slide-in-from-right-4 motion-reduce:animate-none")}
          style={{ width: `calc(var(--spacing) * ${width})` }}
        >
          {/* The resize handle: an invisible grab strip on the panel's edge with
              a visible thumb on hover — drag, or arrows when focused. */}
          <div
            role="separator"
            aria-orientation="vertical"
            aria-valuemin={MIN_WIDTH}
            aria-valuemax={MAX_WIDTH}
            aria-valuenow={width}
            aria-label={pick(advHome.railResize, locale)}
            tabIndex={0}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={cancelResize}
            onLostPointerCapture={cancelResize}
            onKeyDown={onHandleKeyDown}
            onPointerEnter={() => setEdgeHot(true)}
            onPointerLeave={() => setEdgeHot(dragging !== null)}
            onFocus={() => setEdgeHot(true)}
            onBlur={() => setEdgeHot(false)}
            className="group/handle absolute inset-y-0 left-0 z-10 w-2 touch-none cursor-col-resize outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
          >
            {stripless ? null : (
              <span
                aria-hidden="true"
                className="absolute inset-y-0 left-0 w-0.5 bg-transparent transition-colors group-hover/handle:bg-brand-accent group-focus-visible/handle:bg-brand-accent"
              />
            )}
          </div>

          <TasksPanel
            world={world}
            locale={locale}
            verbOf={verbOf}
            onAct={onAct}
            onArchive={onArchive}
            onClose={close}
            onViewAll={onViewAllTasks}
            highlight={highlight}
          />
        </div>
      ) : null}
      </div>

      {/* The strip — always present, the one section's icon. The seam only
          appears once the panel stands beside it. */}
      {stripless ? null : <div
        className={cn(
          "flex w-14 flex-col items-center gap-2 pt-4",
          section && "border-l border-hairline"
        )}
      >
        <StripButton
          icon={ListChecks}
          label={fillCopy(advHome.railOpen, locale, { n: String(tasksCount) })}
          count={tasksCount}
          countTone="destructive"
          active={section === "tasks"}
          onClick={() => toggle("tasks")}
        />
      </div>}
    </aside>

      {/* On a phone the rail has no room to stand beside the board, so it becomes a
          bottom-sheet Drawer: opened by a hearing's blocking-task flag (with the
          trace) or by this floating trigger — the strip's job, on a phone. */}
      <button
        type="button"
        aria-label={fillCopy(advHome.railOpen, locale, { n: String(tasksCount) })}
        onClick={() => setMobileOpen(true)}
        style={{ bottom: "calc(env(safe-area-inset-bottom) + var(--spacing) * 4)" }}
        className={cn("fixed right-4 z-40 flex size-12 items-center justify-center rounded-full border border-hairline bg-card text-muted-foreground shadow-modal transition-colors hover:bg-accent", !asSheet && "md:hidden", mobileOpen && "hidden")}
      >
        <ListChecks aria-hidden="true" className="size-5" />
        {tasksCount ? (
          <span className="absolute -top-1 -right-1 flex min-w-5 items-center justify-center rounded-full bg-destructive px-1 text-caption font-medium text-destructive-foreground tabular-nums">
            {tasksCount}
          </span>
        ) : null}
      </button>

      <Drawer
        open={asSheet && mobileOpen}
        onOpenChange={setMobileOpen}
      >
        <DrawerContent style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
          <DrawerTitle className="sr-only">{pick(advHome.railTitle, locale)}</DrawerTitle>
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
            <SheetModeContext.Provider value={true}>
            <TasksPanel
              world={world}
              locale={locale}
              verbOf={verbOf}
              onAct={onAct}
              onArchive={onArchive}
              onClose={() => setMobileOpen(false)}
              onViewAll={onViewAllTasks}
              highlight={highlight}
            />
            </SheetModeContext.Provider>
          </div>
        </DrawerContent>
      </Drawer>
    </>
  );
}
