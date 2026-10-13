"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { ChevronDownIcon } from "lucide-react";

import { useTasks } from "@/lib/tasks/store";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger, useSidebar } from "@/components/ui/sidebar";
import { taskHref } from "@/lib/tasks/routes";
import { areaOf } from "@/lib/nav/origin";
import { cn } from "@/lib/utils";
import { COLLAPSE_MOTION } from "@/components/cases/motion";
import { Collapsible, CollapsibleContent } from "@/components/ui/collapsible";
import { caseOf, tasksInView } from "@/lib/tasks/selectors";
import { compareUrgency, daysUntil, isOverdue } from "@/lib/tasks/urgency";
import { useChrome, type Crumb } from "@/components/shell/chrome";
import { CourtSwitch } from "@/components/court/court-switch";
import { useLocale } from "@/components/shell/locale";
import { useProfile } from "@/components/shell/profile";
import {
  NotificationsBell,
  type ShellNotification,
} from "@/components/shell/notifications";
import {
  SegmentedControl,
  SegmentedControlItem,
} from "@/components/ui/segmented-control";
import { pick, ui, type Locale } from "@/lib/onboarding/content";
import { LANGUAGE_NAME, SECOND_LANGUAGES } from "@/lib/locale-config";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useCourtText } from "@/components/court/court-provider";

/**
 * The one breadcrumb in the app. Route-aware: Tasks › the task › the action. The task
 * crumb is a link back to the list with that task open; the action is text.
 */
/**
 * A crumb that names a record by its number wears the identifier face, the same as the
 * number does on the screen below. No copy affordance here: a crumb is already a link,
 * and a control cannot hold another one.
 */
const idFace = (crumb: Crumb) => (crumb.mono ? "font-mono tabular-nums" : undefined);

function useTrail() {
  const { crumbs, crumbRoot } = useChrome();
  const pathname = usePathname();
  /*
   * The trail's root. A screen that knows which door it was reached through publishes
   * that door and it wins — the way back is where the person actually was, down to the
   * tab and the search they had running. Everything else names its area from the path,
   * which is what a screen reached directly deserves.
   */
  const root = crumbRoot ?? areaOf(pathname);
  /* Screens publish their crumbs in the fixtures' Kerala terms — a case number, a step
     name. The trail shows them as the selected court does (`CourtSwitch`). */
  const courtText = useCourtText();
  return {
    crumbs: crumbs.map((crumb) => ({ ...crumb, label: courtText(crumb.label) })),
    root: { ...root, label: courtText(root.label) },
  };
}

/** Every crumb, linked, in order. Shared by the wide bar and the phone's opened row. */
function TrailList({
  className,
  skip = 0,
  lead,
}: {
  className?: string;
  /** Leading entries left out (the root is the first), when the bar is short. */
  skip?: number;
  /** What stands in for the entries left out. */
  lead?: React.ReactNode;
}) {
  const { crumbs, root } = useTrail();
  const last = crumbs.length - 1;
  return (
    <BreadcrumbList className={cn("flex-nowrap", className)}>
      {lead ? <BreadcrumbItem className="shrink-0">{lead}</BreadcrumbItem> : null}
      {skip > 0 ? null : (
      <BreadcrumbItem className="shrink-0" data-trail-entry>
        {crumbs.length && root.href ? (
          <BreadcrumbLink asChild>
            <Link href={root.href} className={idFace(root)}>
              {root.label}
            </Link>
          </BreadcrumbLink>
        ) : (
          <BreadcrumbPage className={idFace(root)}>{root.label}</BreadcrumbPage>
        )}
      </BreadcrumbItem>
      )}
      {crumbs.map((crumb, i) => {
        const isLast = i === last;
        // Entry 0 is the root, so crumb `i` is entry `i + 1`.
        if (i + 1 < skip) return null;
        return (
          <React.Fragment key={`${i}-${crumb.label}`}>
            <BreadcrumbSeparator className="shrink-0" data-trail-separator />
            <BreadcrumbItem
              className={isLast ? "min-w-0" : "shrink-0"}
              data-trail-entry
            >
              {isLast ? (
                <BreadcrumbPage className={cn("truncate font-medium", idFace(crumb))}>
                  {crumb.label}
                </BreadcrumbPage>
              ) : crumb.href ? (
                <BreadcrumbLink asChild>
                  <Link href={crumb.href} className={idFace(crumb)}>
                    {crumb.label}
                  </Link>
                </BreadcrumbLink>
              ) : (
                <span className={idFace(crumb)}>{crumb.label}</span>
              )}
            </BreadcrumbItem>
          </React.Fragment>
        );
      })}
    </BreadcrumbList>
  );
}

const TRAIL_ROW_ID = "chrome-trail-row";

/**
 * Where the bar has room it shows the trail whole. Where it does not (a phone,
 * often a tablet held upright with the rail open) the language switch and the
 * bell leave the trail a few words, and it used to answer by dropping the
 * middle and cutting the end: "Cases › CMP/18…".
 *
 * So there the trail folds from its start: as many of the last entries as fit
 * stay, and a small disc button stands for the rest (owner, Sept 21). Tapping
 * it opens the whole trail on a row of its own under the bar.
 * The row is in the flow, so the page moves down rather than being covered, and
 * a long trail scrolls sideways inside it. Going anywhere closes it.
 */
function ChromeBreadcrumb({
  open,
  onToggle,
  onFitsChange,
  after,
}: {
  open: boolean;
  onToggle: () => void;
  /** Reports whether the whole trail fits the bar, so the opened row can stand down. */
  onFitsChange: (fits: boolean) => void;
  /** A quiet control that belongs to the page the trail names, set just after it. */
  after?: React.ReactNode;
}) {
  const { crumbs, root } = useTrail();
  const slotRef = React.useRef<HTMLDivElement>(null);
  const measureRef = React.useRef<HTMLDivElement>(null);
  // How many leading entries are folded away. 0 = the whole trail shows.
  const [skip, setSkip] = React.useState(0);
  const entries = crumbs.length + 1;
  const trailKey = `${root.label}|${crumbs.map((crumb) => crumb.label).join("|")}`;

  // Room decides, not a breakpoint (owner, Sept 21: an iPad with space to
  // spare was still getting the folded trail). The whole trail is drawn once,
  // unseen; entries fold away from the START, one at a time, until what is
  // left fits beside the fold button. Where you are is the last thing to go.
  React.useLayoutEffect(() => {
    const slot = slotRef.current;
    const measure = measureRef.current;
    if (!slot || !measure) return;
    const check = () => {
      const list = measure.firstElementChild as HTMLElement | null;
      if (!list) return;
      const room = slot.clientWidth;
      const gap = parseFloat(getComputedStyle(list).columnGap) || 0;
      const widths = [...list.querySelectorAll<HTMLElement>("[data-trail-entry]")].map(
        (node) => node.getBoundingClientRect().width
      );
      const separator =
        list.querySelector<HTMLElement>("[data-trail-separator]")?.getBoundingClientRect()
          .width ?? 0;
      const step = separator + gap * 2;
      const total = widths.reduce((sum, w) => sum + w, 0) + step * (widths.length - 1);
      let next = 0;
      if (total > room) {
        // The fold button (its 20px disc in a 40px target) and a separator.
        let used = FOLD_BUTTON_WIDTH + step;
        let kept = 0;
        for (let i = widths.length - 1; i >= 0; i -= 1) {
          const cost = widths[i] + (kept ? step : 0);
          if (used + cost > room && kept > 0) break;
          used += cost;
          kept += 1;
        }
        next = widths.length - kept;
      }
      setSkip(next);
      onFitsChange(next === 0);
    };
    check();
    const observer = new ResizeObserver(check);
    observer.observe(slot);
    return () => observer.disconnect();
  }, [trailKey, entries, onFitsChange]);

  return (
    <div ref={slotRef} className="relative flex min-w-0 flex-1 items-center">
      {/* The measuring copy: out of sight, out of the tab order, out of the
          accessibility tree. */}
      <div
        ref={measureRef}
        aria-hidden
        inert
        className="pointer-events-none invisible absolute inset-x-0 top-0 h-0 overflow-hidden"
      >
        <TrailList className="w-max" />
      </div>
      <Breadcrumb className={cn("min-w-0", !after && "flex-1")}>
        <TrailList
          skip={skip}
          lead={
            skip > 0 ? (
              <button
                type="button"
                aria-expanded={open}
                aria-controls={TRAIL_ROW_ID}
                aria-label="Show the full path"
                onClick={onToggle}
                className="-mx-2 flex size-10 cursor-pointer items-center justify-center rounded-lg outline-none transition-colors active:bg-accent focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                <span
                  aria-hidden
                  className="flex size-5 items-center justify-center rounded-full border border-border bg-accent-strong text-muted-foreground"
                >
                  <ChevronDownIcon
                    className={cn(
                      "size-3.5 transition-transform duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] motion-reduce:transition-none",
                      open && "rotate-180"
                    )}
                  />
                </span>
              </button>
            ) : undefined
          }
        />
      </Breadcrumb>
      {after ? <div className="ml-2 flex shrink-0 items-center">{after}</div> : null}
    </div>
  );
}

/** The fold button's footprint in the row: a 40px target pulled in 8px a side. */
const FOLD_BUTTON_WIDTH = 24;

/**
 * The DS trigger. No `aria-expanded`: the ghost Button paints `aria-expanded` as its
 * pressed fill, so the trigger would read as a filled square on every view where the
 * rail is open — the DS's own `SidebarTrigger` carries the state in its label instead.
 */
function NavTrigger() {
  const { open, isMobile } = useSidebar();
  // An open rail carries its own collapse control, in its header. Repeating it here
  // would put it back at the head of the breadcrumb row — which is what made it read as
  // the trail's first crumb. It returns only when the rail is a strip with no room.
  if (!isMobile && open) return null;
  return (
    <>
      <SidebarTrigger
        size="icon"
        aria-label="Expand main navigation"
        className="shrink-0 text-muted-foreground [&_svg]:size-5"
      />
      {/* The trigger belongs to the rail, the crumbs to the page. With the rail collapsed
          they sit side by side with nothing between them and the button reads as the
          trail's first item. A hairline is the least that separates them — and it lives
          here, with the trigger, so the two appear and disappear together. */}
      <Separator
        orientation="vertical"
        className="h-5! shrink-0 self-center! bg-hairline"
      />
    </>
  );
}

/**
 * What the bell reports, derived from the tasks already on screen.
 *
 * There is no notification service yet, so rather than invent events this reads the one
 * source of truth the app has: a task past its date is a thing that needs attention, and
 * saying so is a restatement of the person's own data rather than a fabricated feed.
 * Overdue items are `persistent` — they do not stop mattering because the panel was
 * opened — which also means nothing here is clearable until a real source lands.
 */
function useTaskNotifications() {
  const world = useTasks();
  const [readIds, setReadIds] = React.useState<ReadonlySet<string>>(new Set());

  const { state, people, cases, tasks, user } = world;

  const items = React.useMemo<ShellNotification[]>(() => {
    if (state !== "ready") return [];
    const now = new Date();
    const w = { people, cases, tasks, user, now };
    const pending = tasksInView(w, "needs-action");
    const overdue: ShellNotification[] = pending
      .filter((t) => isOverdue(t, now))
      .sort((a, b) => compareUrgency(a, b, now))
      .slice(0, 8)
      .map((t) => {
        const days = t.dueAt ? Math.abs(daysUntil(t.dueAt, now)) : 0;
        const kase = caseOf(w, t);
        return {
          id: t.id,
          title: t.title,
          body: `${days === 0 ? "Due today" : `${days} day${days === 1 ? "" : "s"} overdue`}${
            kase ? ` · ${kase.parties}` : ""
          }`,
          unread: !readIds.has(t.id),
          tone: "warning" as const,
          persistent: true,
          // Every task notification opens the task itself — the row is a
          // doorway to the action, not a status readout.
          href: taskHref(t.id),
        };
      });
    // A request addressed to this person is a thing that needs attention the moment it
    // arrives, deadline or none — still a restatement of their own data, not a feed.
    const requests: ShellNotification[] = pending
      .filter((t) => t.kind === "review" && !isOverdue(t, now))
      .map((t) => {
        const kase = caseOf(w, t);
        return {
          id: t.id,
          title: t.title,
          body: `Awaiting your decision${kase ? ` · ${kase.parties}` : ""}`,
          unread: !readIds.has(t.id),
          tone: "info" as const,
          persistent: true,
          href: taskHref(t.id),
        };
      });
    return [...requests, ...overdue];
  }, [state, people, cases, tasks, user, readIds]);

  const markAllRead = React.useCallback(() => {
    setReadIds((prev) => {
      const next = new Set(prev);
      for (const n of items) next.add(n.id);
      return next;
    });
  }, [items]);

  // Nothing derived from live tasks is stale, so this is a no-op until a real feed
  // arrives — the control disables itself off `stale`, so it never lies about clearing.
  const clearStale = React.useCallback(() => {}, []);

  return { items, markAllRead, clearStale };
}

/**
 * Chrome for the whole app: the main nav's collapse trigger, where you are, what needs
 * your attention, and your account. The court identity lives in the nav rail's header
 * instead — it is the page origin, and it should not move when this bar's contents change.
 */
/**
 * The app-wide language switch: English beside a second language, and a menu beside them
 * that changes which second language that is — Hindi, Gujarati or Punjabi (owner,
 * 2026-10-08). Hindi stays the default. Choosing a language from the menu also switches
 * to it, since that is why anyone opens the menu. Only Malayalam has strings today, so all
 * three show English until translations arrive (`pick` falls back).
 */
function LanguageToggle() {
  const { locale, setLocale, secondLanguage, setSecondLanguage } = useLocale();
  const options = [
    { value: "en" as Locale, label: LANGUAGE_NAME.en },
    { value: secondLanguage as Locale, label: LANGUAGE_NAME[secondLanguage] },
  ];
  return (
    <div className="ml-auto flex shrink-0 items-center gap-0.5">
      <SegmentedControl
        size="compact"
        type="single"
        value={locale}
        onValueChange={(value) => value && setLocale(value as Locale)}
        aria-label={pick(ui.language, locale)}
      >
        {options.map((l) => (
          <SegmentedControlItem key={l.value} value={l.value} lang={l.value}>
            {l.label}
          </SegmentedControlItem>
        ))}
      </SegmentedControl>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            aria-label="Choose the second language"
            className="relative after:absolute after:-inset-1"
          >
            <ChevronDownIcon className="size-4" aria-hidden />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-auto min-w-40">
          <DropdownMenuLabel>Second language</DropdownMenuLabel>
          <DropdownMenuRadioGroup
            value={secondLanguage}
            onValueChange={(next) => {
              const language = SECOND_LANGUAGES.find((l) => l === next);
              if (language) setSecondLanguage(language);
            }}
          >
            {SECOND_LANGUAGES.map((l) => (
              <DropdownMenuRadioItem key={l} value={l} lang={l}>
                {LANGUAGE_NAME[l]}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

export function TopBar() {
  const notifications = useTaskNotifications();
  const { profileRole } = useProfile();
  // A litigant's notifications are their own (empty in this demo) — no advocate alerts.
  const items = profileRole === "litigant" ? [] : notifications.items;

  const { crumbs } = useChrome();
  const pathname = usePathname();
  // Open only for the page it was opened on: any navigation puts it away.
  const [trailFor, setTrailFor] = React.useState<string | null>(null);
  const [trailFits, setTrailFits] = React.useState(true);
  const trailOpen = trailFor === pathname && crumbs.length > 0 && !trailFits;

  return (
    // `sticky` is positioned, so the phone search row can hang under it, full width.
    <header className="sticky top-0 z-30 flex shrink-0 flex-col border-b border-hairline bg-card">
     <div className="flex h-14 shrink-0 items-center gap-3 px-4 sm:px-6">
      <NavTrigger />
      <ChromeBreadcrumb
        open={trailOpen}
        onToggle={() => setTrailFor(trailOpen ? null : pathname)}
        onFitsChange={setTrailFits}
        /* Which state's court the app runs as: a demo switch, kept to one icon beside
           the Settings title rather than a section of the page (owner, 2026-10-08). */
        after={
          pathname === "/settings" ? (
            <CourtSwitch className="text-muted-foreground" />
          ) : undefined
        }
      />
      <LanguageToggle />
      {/* The person is named once, at the foot of the rail. A second avatar here said
          the same thing twice and put two account controls on one screen. What stays is
          the one thing this bar owes you that the rail cannot give: what changed. */}
      <NotificationsBell
        notifications={items}
        onRead={notifications.markAllRead}
        onClearAll={notifications.clearStale}
      />
     </div>
      <Collapsible open={trailOpen}>
        <CollapsibleContent id={TRAIL_ROW_ID} className={COLLAPSE_MOTION}>
          <Breadcrumb className="overflow-x-auto border-t border-hairline px-4 py-3 sm:px-6">
            <TrailList className="w-max" />
          </Breadcrumb>
        </CollapsibleContent>
      </Collapsible>
    </header>
  );
}
