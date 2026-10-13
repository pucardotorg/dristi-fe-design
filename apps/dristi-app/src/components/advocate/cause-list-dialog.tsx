"use client";

import * as React from "react";
import "./cause-list.css";
import "./mobile-hearing.css";
import { ItemChip } from "./home-bits";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  ArrowDownWideNarrow,
  CalendarDays,
  ChevronDown,
  Download,
  ListFilter,
  Search,
  Video,
  X,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Dialog,
  DialogContent,
  DialogClose,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  TABLE_CELL,
  TABLE_HEAD,
  TABLE_HEAD_ROW,
  tableBodyClass,
  tableRowClass,
} from "@/components/chrome/table-plate";
import {
  causeListOn,
  dayKeyOf,
  type CauseListRow,
  type HearingStatus,
} from "@/lib/advocate/home";
import { causeStatusKey, groupCauseList, searchCauseList, type CauseListGroupBy } from "@/lib/advocate/cause-list-groups";
import type { World } from "@/lib/tasks/selectors";
import { advHome, fillCopy } from "@/lib/advocate/content";
import type { Locale } from "@/lib/onboarding/content";
import { pick } from "@/lib/onboarding/content";
import { passedOverLabel } from "@/lib/advocate/passed-over";
import { Identifier } from "@/components/chrome/identifier";
import { useCanHover } from "./use-can-hover";
import { cn } from "@/lib/utils";
import { RefreshIcon, useRefreshPhase } from "@/components/advocate/refresh-button";

/** Court status as a chip: a concluded matter reads "Completed", or "Passed over"
 *  when it was reached but not taken up; the live one "Ongoing"; everything still
 *  to come "Listed" — one DS status tone each. */
/** Pins a cause-list column header to the top of the scroll area, above the group
 *  dividers (which pin one header-height below it). Opaque via TABLE_HEAD's fill. */
/** Below lg the table cannot fit without sideways scrolling. */
const CARDS_QUERY = "(max-width: 1023px)";

const STICKY_HEAD = "sticky top-0 z-20";

function StatusChip({
  status,
  passedOver = false,
  passedOverOn = null,
  locale,
}: {
  status: HearingStatus;
  passedOver?: boolean;
  /** The earlier day it was passed over, when carried to this one. */
  passedOverOn?: string | null;
  locale: Locale;
}) {
  // Each chip carries a defined stroke so it reads as a bounded tag on the row,
  // not a floating fill — the status solid for the ongoing tint (DS 6a), a neutral
  // edge for completed and listed, an amber edge for a passed-over matter.
  if (status === "now") {
    return <Badge variant="success" className="border-success">{pick(advHome.statusOngoing, locale)}</Badge>;
  }
  // Passed over today: called, not heard, still owed its hearing. The chip stays
  // two words; the status column has no room for a date.
  if (passedOver && !passedOverOn) {
    return <Badge variant="outline" className="border-warning text-warning-ink">{pick(advHome.statusPassedOver, locale)}</Badge>;
  }
  if (status === "concluded") {
    return <Badge variant="secondary" className="border-border">{pick(advHome.statusCompleted, locale)}</Badge>;
  }
  // A matter carried over from an earlier day is simply listed today; the day it
  // was passed over rides on the chip's tooltip.
  return <Badge variant="outline" className="border-border" title={passedOverOn ? passedOverLabel(locale) : undefined}>{pick(advHome.statusListed, locale)}</Badge>;
}

/** The status-group heading copy, keyed by the four-way cause-list status. */
const STATUS_GROUP_LABEL = {
  now: advHome.statusOngoing,
  upcoming: advHome.statusListed,
  "passed-over": advHome.statusPassedOver,
  completed: advHome.statusCompleted,
} as const;

/**
 * The court filter — multi-select, since "All courts" (no selection) is one of
 * the choices. Kept short with an internal scroll so it never runs past the
 * modal's edge, and a step smaller than a form control.
 */
function CourtMultiFilter({
  courts,
  selected,
  onChange,
  locale,
}: {
  courts: { court: string; label: string }[];
  selected: string[];
  onChange: (next: string[]) => void;
  locale: Locale;
}) {
  const labelOf = (c: string) =>
    courts.find((o) => o.court === c)?.label ?? c;
  const toggle = (c: string) =>
    onChange(selected.includes(c) ? selected.filter((x) => x !== c) : [...selected, c]);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="cause-touch-control min-w-0 flex-1 gap-1.5 text-caption md:min-w-44 md:flex-none">
          <ListFilter aria-hidden="true" className="text-muted-foreground" />
          {selected.length === 0 ? (
            <span className="flex-1 text-left">{pick(advHome.causeListAllCourts, locale)}</span>
          ) : (
            <span className="flex flex-1 items-center gap-1.5 truncate text-left">
              <span className="truncate">{labelOf(selected[0])}</span>
              {selected.length > 1 ? (
                <span className="shrink-0 text-muted-foreground">
                  {fillCopy(advHome.courtFilterMore, locale, {
                    n: String(selected.length - 1),
                  })}
                </span>
              ) : null}
            </span>
          )}
          <ChevronDown aria-hidden="true" className="text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="max-h-72 w-56 overflow-y-auto text-caption">
        <DropdownMenuCheckboxItem
          checked={selected.length === 0}
          onSelect={(e) => e.preventDefault()}
          onCheckedChange={() => onChange([])}
          className="cause-touch-control text-caption"
        >
          {pick(advHome.causeListAllCourts, locale)}
        </DropdownMenuCheckboxItem>
        <DropdownMenuSeparator />
        {courts.map((option) => (
          <DropdownMenuCheckboxItem
            key={option.court}
            checked={selected.includes(option.court)}
            onSelect={(e) => e.preventDefault()}
            onCheckedChange={() => toggle(option.court)}
            className="cause-touch-control text-caption"
          >
            {option.label}
          </DropdownMenuCheckboxItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function CauseListDialog({
  open,
  onOpenChange,
  world,
  now,
  day,
  singleCourt = null,
  highlight,
  onJoin,
  locale,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  world: World;
  now: number;
  /** The day the board is on when the list opens; the modal pages from here. */
  day: string;
  /**
   * The deployment's one court, or null where it runs several. With one court the
   * list is that court's: it says so once, and drops the court filter, the court
   * columns and sorting by court.
   */
  singleCourt?: string | null;
  /** A matter to scroll to and trace when the list opens (the per-hearing jump). */
  highlight?: { caseId: string; nonce: number } | null;
  onJoin: (row: CauseListRow) => void;
  locale: Locale;
}) {
  // Sort-by lives here, above the body, so it survives close/reopen within the
  // page session (this wrapper stays mounted while the dialog toggles). Opening the
  // list from a hearing's "view on the cause list" jump then keeps the order the
  // advocate last chose, so the traced row shows in that order. A full page reload
  // resets it to the Status default; the list's own refresh does not. Date, search
  // and court filter still reset on each open, since the body remounts.
  const [groupBy, setGroupBy] = React.useState<CauseListGroupBy>("status");
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* Near full-screen, but inset from the edges so the board behind stays in
          view through the scrim — a workspace over the page, not a new page. The
          body mounts fresh each open, so its date and search start from the
          board's day without an effect resetting them; sort-by is held above. */}
      <DialogContent showCloseButton={false} className="cause-list-dialog flex h-dvh w-full max-w-full flex-col gap-0 overflow-hidden rounded-none p-0 sm:max-w-full md:h-[calc(100svh-4rem)] md:max-w-[calc(100%-4rem)] md:rounded-xl">
        <DialogClose asChild>
          <Button variant="ghost" size="icon" className="cause-list-close absolute top-2 right-2 z-10" aria-label={locale === "ml" ? "അടയ്ക്കുക" : "Close"}>
            <X aria-hidden="true" />
          </Button>
        </DialogClose>
        <CauseListBody
          world={world}
          now={now}
          day={day}
          singleCourt={singleCourt}
          highlight={highlight}
          // Sorting by court is not offered with one court; a choice made under
          // another deployment falls back to the default.
          groupBy={singleCourt && groupBy === "court" ? "status" : groupBy}
          onGroupByChange={setGroupBy}
          onJoin={onJoin}
          locale={locale}
        />
      </DialogContent>
    </Dialog>
  );
}

function CauseListBody({
  world,
  now,
  day,
  singleCourt,
  highlight,
  groupBy,
  onGroupByChange,
  onJoin,
  locale,
}: {
  world: World;
  now: number;
  day: string;
  singleCourt: string | null;
  highlight?: { caseId: string; nonce: number } | null;
  /** Sort-by is owned by the dialog wrapper so it persists across open/close;
      the default is Status (see there). */
  groupBy: CauseListGroupBy;
  onGroupByChange: (next: CauseListGroupBy) => void;
  onJoin: (row: CauseListRow) => void;
  locale: Locale;
}) {
  const intl = locale === "ml" ? "ml-IN" : "en-IN";
  const isMobile = useIsMobile();
  // The docket reads as cards wherever the table would have to scroll sideways:
  // a phone, and a tablet held upright. The header keeps its desktop arrangement
  // on the tablet, which has the width for it.
  const asCards = React.useSyncExternalStore(
    (callback) => {
      const media = window.matchMedia(CARDS_QUERY);
      media.addEventListener("change", callback);
      return () => media.removeEventListener("change", callback);
    },
    () => window.matchMedia(CARDS_QUERY).matches,
    () => false
  );
  const [date, setDate] = React.useState(day);
  const [query, setQuery] = React.useState("");
  const [selectedCourts, setSelectedCourts] = React.useState<string[]>([]);
  const groupRefs = React.useRef(new Map<string, HTMLButtonElement>());
  const jumpTarget = React.useRef<string | null>(null);
  const copy = (en: string, ml: string) => locale === "ml" ? ml : en;
  const [pickerOpen, setPickerOpen] = React.useState(false);
  const [refreshedAt, setRefreshedAt] = React.useState(() => Date.now());
  const { phase, trigger } = useRefreshPhase(() => setRefreshedAt(Date.now()));

  // Trace the highlighted matter's row when the list opens from a hearing's icon.
  // Imperative — measure the row inside the scroll area and drive an overlay stroke
  // over it — so it works over the table as well as the cards and needs no state
  // that would re-render the docket. The stroke mirrors the pending-task trace.
  const scrollRef = React.useRef<HTMLDivElement | null>(null);
  const traceRef = React.useRef<HTMLDivElement | null>(null);
  React.useEffect(() => {
    if (!highlight) return;
    const container = scrollRef.current;
    const overlay = traceRef.current;
    if (!container || !overlay) return;
    const row = container.querySelector<HTMLElement>(
      `[data-cause-row="${CSS.escape(highlight.caseId)}"]`
    );
    if (!row) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let observer: IntersectionObserver | null = null;
    let safetyTimer = 0;
    let hideTimer = 0;
    let armed = false;

    // Place the overlay over the row and run the draw, measured at arm time so it
    // sits right whatever the scroll position.
    const arm = () => {
      if (armed) return;
      armed = true;
      observer?.disconnect();
      window.clearTimeout(safetyTimer);
      const cr = container.getBoundingClientRect();
      const rr = row.getBoundingClientRect();
      overlay.style.top = `${rr.top - cr.top + container.scrollTop}px`;
      overlay.style.left = `${rr.left - cr.left + container.scrollLeft}px`;
      overlay.style.width = `${rr.width}px`;
      overlay.style.height = `${rr.height}px`;
      overlay.hidden = false;
      overlay.classList.remove("cause-trace-run");
      void overlay.offsetWidth;
      overlay.classList.add("cause-trace-run");
      hideTimer = window.setTimeout(() => {
        if (traceRef.current) traceRef.current.hidden = true;
      }, 2600);
    };

    row.scrollIntoView({ block: "center", behavior: reduced ? "auto" : "smooth" });
    if (reduced) {
      arm();
      return () => window.clearTimeout(hideTimer);
    }

    // Arm when the smooth scroll actually brings the row into view. An
    // IntersectionObserver fires as the row reaches the viewport, so on a long
    // docket the stroke is not spent before it arrives — and unlike a fixed delay,
    // scroll events, or animation frames, it needs no guess at the scroll's
    // duration and does not depend on the tab being in the foreground.
    observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting && e.intersectionRatio >= 0.85)) {
          arm();
        }
      },
      { root: container, threshold: [0.85] }
    );
    observer.observe(row);
    // A last resort so the stroke can never fail to appear.
    safetyTimer = window.setTimeout(arm, 4000);

    return () => {
      observer?.disconnect();
      window.clearTimeout(safetyTimer);
      window.clearTimeout(hideTimer);
    };
  }, [highlight, isMobile, asCards]);

  // Every court on the day's docket, for the filter — the whole published list,
  // not only the viewer's courts, so a court with only other advocates' matters is
  // still offered. Derived from the unfiltered cause list; no selection means all.
  const courtOptions = React.useMemo(() => {
    const seen = new Map<string, string>();
    for (const r of causeListOn(world, date, now)) {
      if (!seen.has(r.court)) seen.set(r.court, r.courtLabel);
    }
    return [...seen].map(([court, label]) => ({ court, label }));
  }, [world, date, now]);
  // The scope line names the courts, but with many picked it names the first
  // two and counts the rest, so it stays one short line and never wraps the
  // header buttons below it.
  const courtsLabel = React.useMemo(() => {
    if (selectedCourts.length === 0) return null;
    const labels = selectedCourts.map(
      (c) => courtOptions.find((o) => o.court === c)?.label ?? c
    );
    if (labels.length <= 2) return labels.join(", ");
    return fillCopy(advHome.causeListScopeOthers, locale, {
      courts: labels.slice(0, 2).join(", "),
      n: String(labels.length - 2),
    });
  }, [selectedCourts, courtOptions, locale]);

  const rows = React.useMemo(
    () =>
      causeListOn(
        world,
        date,
        now,
        selectedCourts.length ? selectedCourts : undefined
      ),
    [world, date, now, selectedCourts]
  );
  const filtered = React.useMemo(() => searchCauseList(rows, query), [rows, query]);
  const mineCount = React.useMemo(() => filtered.filter((r) => r.mine).length, [filtered]);
  const groups = React.useMemo(() => groupCauseList(filtered, groupBy, intl).map(({ key, rows: items }) => ({
    key,
    // Item groups read "Item 3"; court groups are the court alone (grouping is by
    // court, not by court number); status groups read as the status word; hearing-type
    // groups are the stage itself.
    label: groupBy === "item" ? `${pick(advHome.colItem, locale)} ${key}` :
      groupBy === "court" ? items[0].courtLabel :
      groupBy === "status" ? pick(STATUS_GROUP_LABEL[causeStatusKey(items[0])], locale) : key,
    rows: items,
  })), [filtered, groupBy, intl, locale]);
  const groupLabels = {
    item: pick(advHome.colItem, locale),
    court: pick(advHome.colCourt, locale),
    hearingType: pick(advHome.colHearingType, locale),
    status: pick(advHome.colStatus, locale),
  };
  const reset = () => {
    setQuery("");
    setSelectedCourts([]);
    onGroupByChange("status");
  };
  const jump = (key: string) => {
    jumpTarget.current = key;
  };
  const focusJumpTarget = (event: Event) => {
    if (jumpTarget.current === null) return;
    event.preventDefault();
    const key = jumpTarget.current;
    jumpTarget.current = null;
    const target = groupRefs.current.get(key);
    target?.focus({ preventScroll: true });
    const container = scrollRef.current;
    const firstId = groups.find((group) => group.key === key)?.rows[0]?.id;
    const firstRow = firstId ? container?.querySelector<HTMLElement>(`[data-cause-row="${firstId}"]`) : null;
    if (!container || !target || !firstRow) return;
    // The pill is sticky, so its own position says nothing once it is pinned. Aim
    // at the group's first matter instead, landing it just under the pinned band
    // (the pill's sticky box, plus on desktop the column header above it).
    const band = target.closest<HTMLElement>(".sticky");
    const bandBottom = band ? (parseFloat(getComputedStyle(band).top) || 0) + band.offsetHeight : 0;
    const to = container.scrollTop + firstRow.getBoundingClientRect().top - container.getBoundingClientRect().top - bandBottom;
    glideTo(container, Math.max(0, to));
  };

  const dateLabel = new Intl.DateTimeFormat(intl, {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(`${date}T12:00:00`));
  const dateShort = new Intl.DateTimeFormat(intl, {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(`${date}T12:00:00`));
  // Phone drops the year so the date button stays short beside the search field.
  const dateShortNoYear = new Intl.DateTimeFormat(intl, {
    day: "numeric",
    month: "short",
  }).format(new Date(`${date}T12:00:00`));
  const refreshedLabel = new Intl.DateTimeFormat(intl, {
    dateStyle: "short",
    timeStyle: "medium",
  }).format(new Date(refreshedAt));

  // The floating group divider — a labelled pill on a hairline rule. It only
  // jumps (to another group); there is no per-group collapse. Shared by the
  // desktop table (inside a spanning cell) and the phone card list.
  const renderDivider = (group: { key: string; label: string; rows: CauseListRow[] }) => (
    <div className="flex items-center gap-3">
      <span className="h-px flex-1 bg-hairline" />
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            ref={(node) => { if (node) groupRefs.current.set(group.key, node); else groupRefs.current.delete(group.key); }}
            variant="ghost" size="sm"
            className="cause-touch-control max-w-full rounded-full border border-hairline bg-card shadow-raised"
            aria-label={copy(`Jump to another ${groupLabels[groupBy].toLowerCase()} group`, "മറ്റൊരു ഗ്രൂപ്പിലേക്ക് പോകുക")}
          >
            <span className="truncate" title={group.label}>{group.label}</span>
            <span className="tabular-nums text-muted-foreground">({group.rows.length})</span>
            <ChevronDown aria-hidden="true" className="shrink-0" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent collisionPadding={16} className="max-h-72 w-56 text-caption" onCloseAutoFocus={focusJumpTarget}>
          <DropdownMenuLabel className="text-caption text-muted-foreground">{copy("Jump to…", "ഇതിലേക്ക് പോകുക…")}</DropdownMenuLabel>
          {groups.map((target) => (
            <DropdownMenuItem key={target.key} className="cause-touch-control text-caption" onSelect={() => jump(target.key)}>
              <span className="min-w-0 flex-1 truncate">{target.label}</span>
              <span className="tabular-nums text-muted-foreground">{target.rows.length}</span>
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
      <span className="h-px flex-1 bg-hairline" />
    </div>
  );

  // The header controls, defined once and arranged differently by width: on a
  // phone the date and download join the search on one line and the filter and
  // sort share the next, so the header is not three stacked bands; on desktop the
  // date and download keep the title row and the filter/search/sort stay one line.
  const dateDownload = (
    <div className="flex shrink-0 items-center gap-2">
      <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className="cause-touch-control">
            <CalendarDays aria-hidden="true" />
            <span className="md:hidden">{dateShortNoYear}</span>
            <span className="hidden md:inline">{dateShort}</span>
          </Button>
        </PopoverTrigger>
        <PopoverContent align="end" collisionPadding={16} className="w-auto p-0">
          <Calendar
            mode="single"
            selected={new Date(`${date}T12:00:00`)}
            onSelect={(next) => {
              if (!next) return;
              setPickerOpen(false);
              setDate(dayKeyOf(next));
            }}
          />
        </PopoverContent>
      </Popover>
      <Button variant="outline" size="sm" className="cause-touch-control" aria-label={pick(advHome.causeListDownload, locale)} onClick={() => setRefreshedAt(Date.now())}>
        <Download aria-hidden="true" />
        <span className="hidden md:inline">{pick(advHome.causeListDownload, locale)}</span>
      </Button>
    </div>
  );
  const courtFilter = (
    <CourtMultiFilter
      courts={courtOptions}
      selected={selectedCourts}
      onChange={setSelectedCourts}
      locale={locale}
    />
  );
  const searchField = (
    <div className={cn("relative min-w-0 flex-1 md:min-w-56", !asCards && "md:max-w-96")}>
      <label htmlFor="cause-list-search" className="sr-only">{copy("Search", "തിരയുക")}</label>
      <Search
        aria-hidden="true"
        className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
      />
      <Input
        id="cause-list-search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder={pick(advHome.causeListSearch, locale)}
        className="pl-8"
        aria-label={pick(advHome.causeListSearch, locale)}
      />
    </div>
  );
  const sortControl = (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="cause-touch-control min-w-0 max-w-full">
          <ArrowDownWideNarrow aria-hidden="true" />
          <span className="truncate">{copy("Sort by", "ക്രമീകരണം")}: {groupLabels[groupBy]}</span>
          <ChevronDown aria-hidden="true" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" collisionPadding={16} className="w-56">
        <DropdownMenuRadioGroup value={groupBy} onValueChange={(value) => onGroupByChange(value as CauseListGroupBy)}>
          {(singleCourt
            ? (["item", "hearingType", "status"] as const)
            : (["item", "court", "hearingType", "status"] as const)
          ).map((value) => (
            <DropdownMenuRadioItem key={value} value={value} className="cause-touch-control">
              {groupLabels[value]}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );

  // A refresh button to the left of the stamp, running the three-beat gesture; the
  // stamp updates when it lands. Tablet and desktop only.
  const refreshStamp = (
    <button
      type="button"
      onClick={trigger}
      className="cause-touch-control ml-auto hidden shrink-0 items-center gap-1.5 rounded-md px-1.5 md:flex py-0.5 text-caption text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none"
    >
      <RefreshIcon phase={phase} className="size-3.5" />
      {/* Underlined so the stamp reads as the button it is. */}
      <span className="underline underline-offset-2">
        {fillCopy(advHome.causeListRefreshed, locale, { time: refreshedLabel })}
      </span>
    </button>
  );

  return (
    <>
      {/* Every control in the header takes the lighter tan stroke the
          home toolbar uses (cause-list.css); the default input stroke read as a
          wireframe there. */}
      <div className="cause-list-header flex shrink-0 flex-col gap-3 border-b border-hairline px-4 pt-6 pb-4 md:gap-4 md:px-6 md:pt-6 md:pb-4">
        {/* Right padding clears the dialog's own close button in the corner. */}
        <div className="flex flex-wrap items-start justify-between gap-2 pr-12 md:gap-4">
          <div className="flex min-w-0 flex-col gap-1">
            <DialogTitle className="text-title-s font-semibold">
              {pick(advHome.causeListTitle, locale)}
            </DialogTitle>
            <DialogDescription className="sr-only text-body-compact text-muted-foreground md:not-sr-only">
              {singleCourt || courtsLabel
                ? fillCopy(advHome.causeListScopeCourt, locale, { court: singleCourt ?? courtsLabel ?? "" })
                : pick(advHome.causeListScope, locale)}{" "}
              · {dateLabel}
            </DialogDescription>
          </div>
          {/* On desktop the date and download live in the title row; on a phone or
              an upright tablet they move down beside the search (the rows below). */}
          {!asCards ? dateDownload : null}
        </div>

        {asCards ? (
          // Phone and upright tablet: date and download share the search's line
          // (search yields width), and the filter and sort take the next: two tidy
          // rows, not three bands. The tablet has room to keep the scope line above
          // and the refresh stamp at the end of the second row.
          <div className="flex flex-col gap-2 md:gap-3">
            <div className="flex items-center gap-2">
              {searchField}
              {dateDownload}
            </div>
            <div className="flex items-center gap-2">
              {singleCourt ? null : courtFilter}
              {sortControl}
              {refreshStamp}
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-2 md:gap-3">
            <div className="flex flex-1 flex-wrap items-center gap-2">
              {singleCourt ? null : courtFilter}
              {searchField}
              {sortControl}
            </div>
            {refreshStamp}
          </div>
        )}
      </div>

      <div ref={scrollRef} className="relative min-h-0 flex-1 overflow-auto overscroll-contain px-4 pb-4 md:px-6 [&>[data-slot=table-container]]:overflow-visible">
        {filtered.length === 0 ? (
          <div role="status" className="flex flex-col items-center gap-4 py-12 text-center">
            <Search aria-hidden="true" className="size-8 text-muted-foreground" />
            <div className="flex flex-col gap-2">
              <h3 className="text-title-s font-semibold">
                {query.trim() ? copy("No matching hearings", "പൊരുത്തപ്പെടുന്ന ഹിയറിംഗുകളില്ല") : pick(advHome.causeListEmpty, locale)}
              </h3>
              <p className="text-body-compact text-muted-foreground">
                {copy("Try a case name, number, advocate or court, or clear your filters.", "കേസിന്റെ പേര്, നമ്പർ, അഭിഭാഷകൻ അല്ലെങ്കിൽ കോടതി തിരയുക, അല്ലെങ്കിൽ ഫിൽട്ടറുകൾ നീക്കുക.")}
              </p>
            </div>
            {(query || selectedCourts.length > 0) && (
              <Button variant="outline" onClick={reset}>{copy("Clear search and filters", "തിരയലും ഫിൽട്ടറുകളും നീക്കുക")}</Button>
            )}
          </div>
        ) : asCards ? (
          // A phone reads the docket as a stack of cards, not a wide table it has
          // to scroll sideways; the group dividers and the per-matter join stay.
          <div className="flex flex-col gap-6">
            {groups.map((group) => (
              <React.Fragment key={group.key}>
                {/* The group pill sticks to the top of the scroll area while its
                    matters pass under it, and the next group's pill takes its
                    place — a running divider. The opaque band bleeds to the scroll
                    padding so nothing shows beside it, with a little room above the
                    pill so it clears the header. */}
                <div className="sticky top-0 z-10 -mx-4 bg-background px-4 pt-3 pb-1 md:-mx-6 md:px-6">
                  {renderDivider(group)}
                </div>
                <div className="flex flex-col gap-4 md:gap-3">
                  {group.rows.map((row) => (
                    <CauseCard key={row.id} row={row} showCourt={!singleCourt} locale={locale} onJoin={onJoin} />
                  ))}
                </div>
              </React.Fragment>
            ))}
          </div>
        ) : (
          <Table className="w-full min-w-5xl table-fixed border-separate border-spacing-0 text-body-compact">
            {/* The column headers pin to the top (z-20); each group divider pins just
                below them (z-10) and the next divider replaces it as the reader scrolls
                — the docket passes under both. Both bands are opaque so nothing shows
                through them. */}
            <TableHeader>
              <TableRow className={TABLE_HEAD_ROW}>
                <TableHead className={cn(TABLE_HEAD, STICKY_HEAD, "w-16")}>{pick(advHome.colItem, locale)}</TableHead>
                <TableHead className={cn(TABLE_HEAD, STICKY_HEAD, "w-1/5")}>{pick(advHome.colCase, locale)}</TableHead>
                {singleCourt ? null : (
                  <>
                    <TableHead className={cn(TABLE_HEAD, STICKY_HEAD, "w-32")}>{pick(advHome.colCourt, locale)}</TableHead>
                    <TableHead className={cn(TABLE_HEAD, STICKY_HEAD, "w-24 whitespace-nowrap")}>{copy("Court no.", "കോടതി നമ്പർ")}</TableHead>
                  </>
                )}
                <TableHead className={cn(TABLE_HEAD, STICKY_HEAD, "w-1/6")}>{pick(advHome.colAdvocates, locale)}</TableHead>
                <TableHead className={cn(TABLE_HEAD, STICKY_HEAD, "w-52")}>{pick(advHome.colCaseNumber, locale)}</TableHead>
                <TableHead className={cn(TABLE_HEAD, STICKY_HEAD)}>{pick(advHome.colHearingType, locale)}</TableHead>
                <TableHead className={cn(TABLE_HEAD, STICKY_HEAD, "w-36")}>{pick(advHome.colStatus, locale)}<span className="sr-only"> / {copy("Actions", "പ്രവർത്തനങ്ങൾ")}</span></TableHead>
              </TableRow>
            </TableHeader>
            {groups.map((group) => (
              <TableBody key={group.key} className={tableBodyClass({ hover: true })}>
                <TableRow className={tableRowClass({ hover: false })}>
                  <td colSpan={singleCourt ? 6 : 8} className="sticky top-10 z-10 bg-background px-0 pt-4 pb-2">
                    {renderDivider(group)}
                  </td>
                </TableRow>
                {group.rows.map((row) => (
                  <CauseRow key={row.id} row={row} showCourt={!singleCourt} locale={locale} onJoin={onJoin} />
                ))}
              </TableBody>
            ))}
          </Table>
        )}
        {/* The trace overlay — placed and re-armed imperatively over the
            highlighted row (see the effect above). Hidden until a jump fires. */}
        <div
          ref={traceRef}
          hidden
          aria-hidden="true"
          className="pointer-events-none absolute z-30"
        >
          <svg className="size-full overflow-visible">
            <rect className="cause-trace-rect" pathLength={100} />
          </svg>
        </div>
      </div>

      <div aria-live="polite" className="cause-list-footer flex shrink-0 items-center gap-2 border-t border-hairline px-4 py-2 text-caption md:px-6 md:py-3 text-muted-foreground">
        <span aria-hidden="true" className="size-2 rounded-full bg-input" />
        <span className="flex-1">{fillCopy(advHome.causeListMineCount, locale, { n: String(mineCount) })}</span>
        <Button variant="ghost" size="icon" className="md:hidden" onClick={trigger} aria-label={`${copy("Refresh", "പുതുക്കുക")}. ${fillCopy(advHome.causeListRefreshed, locale, { time: refreshedLabel })}`}>
          <RefreshIcon phase={phase} className="size-4" />
        </Button>
      </div>
    </>
  );
}

/** Own matters use the resting warm-neutral fill; the label preserves meaning
 * without relying on colour. Only this row's right-hand content makes room. */
function CauseRow({ row, showCourt, locale, onJoin }: { row: CauseListRow; showCourt: boolean; locale: Locale; onJoin: (row: CauseListRow) => void }) {
  const cell = cn(TABLE_CELL, "align-middle");
  const canHover = useCanHover();
  const joinLabel = locale === "ml" ? "ഹിയറിംഗിൽ ചേരുക" : "Join hearing";
  return (
    // A matter the advocate is on wears a soft warm-neutral fill so it reads out of
    // the whole docket without the pull of a brand colour: a light warm fill at
    // rest, deepening one step on hover. Unlike the plate's own states this is flat
    // (no rounded band) and persistent, marking "yours" across the run rather than
    // the one row under the pointer, so it is a reviewed exception to the plate: it
    // goes on the cells via `[&>td]:` (overriding the shared `bg-card`), never the <tr>.
    // table-plate-allow
    <TableRow data-cause-row={row.id} className={cn(tableRowClass({ hover: true }), "cause-row", row.mine && "[&>td]:bg-surface-sunken hover:[&>td]:bg-accent")}>
      <td className={cn(cell, "tabular-nums text-muted-foreground")}>{row.item}</td>
      <td className={cn(cell, "font-medium text-foreground")}>
        <span className="flex min-w-0 flex-col gap-1">
          <span className="truncate" title={row.parties}>{row.parties}</span>
          {row.mine ? (
            <span className="inline-flex w-fit items-center gap-1.5 text-caption font-normal text-muted-foreground">
              <span aria-hidden="true" className="size-1.5 shrink-0 rounded-full bg-input" />
              {pick(advHome.causeListMine, locale)}
            </span>
          ) : null}
        </span>
      </td>
      {showCourt ? (
        <>
          <td className={cell}><span className="block truncate" title={row.courtLabel}>{row.courtLabel}</span></td>
          <td className={cn(cell, "tabular-nums")}>{row.courtNumber ?? "N/A"}</td>
        </>
      ) : null}
      <td className={cn(cell, "text-muted-foreground")}><span className="block truncate" title={row.advocates}>{row.advocates}</span></td>
      {/* Never truncated: the column is sized to hold a full CNR. */}
      <td className={cn(cell, "whitespace-nowrap text-muted-foreground")}><Identifier value={row.caseNumber} label="case number" copyable={canHover} /></td>
      <td className={cell}><span className="block truncate" title={row.hearingType}>{row.hearingType}</span></td>
      {/* The status tag is left-aligned like the other columns' content. Only an
          ongoing hearing can be joined: on hover its chip fades and a green Join
          slides in from the right — absolute, so it reserves no column width at rest
          (the "Court no." header stays on one line). */}
      <td className={cn(cell, "relative")}>
        {/* With a mouse the Join is an overlay that replaces the tag on hover. On a
            touch screen there is no hover, so it sits in the same line as the tag as
            an icon button (cause-list.css), never stacked under it. */}
        <div className="flex items-center gap-2">
          <span className={cn("inline-flex", row.status === "now" && "cause-status")}>
            <StatusChip status={row.status} passedOver={row.passedOver} passedOverOn={row.passedOverOn} locale={locale} />
          </span>
          {row.status === "now" ? (
            <span className="cause-join absolute inset-y-0 right-4 flex items-center">
              <Button
                size="sm"
                className="cause-touch-control"
                onClick={() => onJoin(row)}
                aria-label={`${joinLabel}: ${row.parties}, ${row.courtLabel}, ${row.courtNumber ?? "N/A"}`}
              >
                <Video aria-hidden="true" /><span className="cause-join-label">{joinLabel}</span>
              </Button>
            </span>
          ) : null}
        </div>
      </td>
    </TableRow>
  );
}

/**
 * A quick glide to a scroll position: a fixed 420ms however far it travels, so a
 * jump across the whole docket is as brisk as one to the next group (native smooth
 * scrolling takes longer the further it goes). Strong ease-out, so it leaves at
 * once and settles. Any touch or wheel hands control straight back; reduced motion
 * jumps.
 */
function glideTo(container: HTMLElement, to: number) {
  // A hidden tab gets no animation frames, so it lands at once rather than never.
  if (document.hidden || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    container.scrollTop = to;
    return;
  }
  const from = container.scrollTop;
  const start = performance.now();
  let cancelled = false;
  const cancel = () => { cancelled = true; };
  container.addEventListener("wheel", cancel, { once: true, passive: true });
  container.addEventListener("touchstart", cancel, { once: true, passive: true });
  const step = (now: number) => {
    if (cancelled) return;
    const t = Math.min(1, (now - start) / 420);
    container.scrollTop = from + (to - from) * (1 - Math.pow(1 - t, 4));
    if (t < 1) requestAnimationFrame(step);
    else {
      container.removeEventListener("wheel", cancel);
      container.removeEventListener("touchstart", cancel);
    }
  };
  requestAnimationFrame(step);
}

/** Mobile cause-list cards share the home identity block and disclose live actions. */
function CauseCard({ row, showCourt, locale, onJoin }: { row: CauseListRow; showCourt: boolean; locale: Locale; onJoin: (row: CauseListRow) => void }) {
  const [open, setOpen] = React.useState(false);
  const [pointerMotion, setPointerMotion] = React.useState(true);
  const ongoing = row.status === "now";
  const joinLabel = locale === "ml" ? "ഹിയറിംഗിൽ ചേരുക" : "Join hearing";
  return (
    <Collapsible open={open} onOpenChange={setOpen} data-pointer-motion={pointerMotion}>
      <article data-cause-row={row.id} className={cn(
        // Phone: a stacked card. Upright tablet: two rows. The first holds the item
        // box, the name and number, the court, and the status at the far right; the
        // second starts under the item box and carries hearing type and advocates
        // on one line each, so nothing wraps and the name has room to run. The court
        // and status columns are fixed widths so they line up from card to card.
        "relative flex flex-col gap-3 rounded-xl p-4 shadow-raised md:grid md:grid-cols-[auto_minmax(0,1fr)_13rem_6rem] md:items-start md:gap-x-4 md:gap-y-3",
        // Teal belongs to a live matter only; everything else is beige. Hers takes
        // the heavier stroke of whichever colour applies, the rest a hairline. A
        // live matter of hers breathes in time with the dot.
        row.mine ? "border-[1.5px] bg-surface-sunken" : "border bg-card",
        ongoing ? (row.mine ? "border-brand-accent" : "border-brand-accent/40") : (row.mine ? "border-border" : "border-hairline"),
        row.mine && ongoing && "cause-mine-live"
      )}>
        <div className="flex min-w-0 items-start gap-3 md:contents">
          <ItemChip item={row.item} size="lg" surface={row.mine ? "sunken" : "card"} />
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <h3 className={cn("text-body-compact font-semibold wrap-anywhere", ongoing ? "text-primary" : "text-foreground")}>{row.parties}</h3>
            <p className="text-body-compact wrap-anywhere text-muted-foreground"><Identifier value={row.caseNumber} label="case number" copyable={false} /></p>
          </div>
          {/* A live matter says so with the pulsing dot alone, no tag to spend a row on. */}
          {ongoing ? <span className="flex size-4 shrink-0 items-center justify-center md:col-start-4 md:row-start-1 md:justify-self-end md:w-9 md:self-start">
            <span aria-hidden="true" className="now-dot size-2 rounded-full bg-primary" />
            <span className="sr-only">{pick(advHome.statusOngoing, locale)}</span>
          </span> : <span className="shrink-0 md:col-start-4 md:row-start-1 md:justify-self-end md:self-start"><StatusChip status={row.status} passedOver={row.passedOver} passedOverOn={row.passedOverOn} locale={locale} /></span>}
        </div>
        <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-2 text-body-compact md:contents">
          {showCourt ? (
            <div className="contents md:col-start-3 md:row-start-1 md:flex md:min-w-0 md:flex-col md:gap-0.5">
              <dt className="text-muted-foreground md:text-caption">{pick(advHome.colCourt, locale)}</dt>
              <dd className="wrap-anywhere">{row.courtLabel} ·{"\u00a0"}{row.courtNumber ?? "N/A"}</dd>
            </div>
          ) : null}
          <div className="contents md:col-span-2 md:col-start-1 md:row-start-2 md:flex md:min-w-0 md:items-baseline md:gap-2">
            <dt className="text-muted-foreground md:shrink-0 md:text-caption">{pick(advHome.colHearingType, locale)}</dt>
            <dd className="wrap-anywhere md:truncate" title={row.hearingType}>{row.hearingType}</dd>
          </div>
          <div className={cn("contents md:col-span-2 md:col-start-3 md:row-start-2 md:flex md:min-w-0 md:items-baseline md:gap-2", ongoing && !row.mine && "md:pr-12")}>
            <dt className="text-muted-foreground md:shrink-0 md:text-caption">{pick(advHome.colAdvocates, locale)}</dt>
            <dd className={cn("wrap-anywhere md:truncate", ongoing && !row.mine && "pr-6 md:pr-0")} title={row.advocates}>{row.advocates}</dd>
          </div>
        </dl>
        {row.mine || ongoing ? <div className={cn("flex items-center gap-2 md:col-span-full", !row.mine && "contents md:flex")}>
          {row.mine ? <span className="inline-flex w-fit items-center gap-1.5 text-caption text-muted-foreground">
            <span aria-hidden="true" className="size-1.5 shrink-0 rounded-full bg-input" />{pick(advHome.causeListMine, locale)}
          </span> : null}
          {ongoing ? <CollapsibleTrigger
            onPointerDown={() => setPointerMotion(true)} onKeyDown={() => setPointerMotion(false)}
            aria-label={`${joinLabel}: ${row.parties}`}
            className={cn("group ml-auto size-9 shrink-0 rounded-full text-muted-foreground after:absolute after:inset-0 after:rounded-xl focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-ring", row.mine ? "-my-2" : "-mt-12 -mb-2")}
          ><ChevronDown aria-hidden="true" className="mx-auto size-4 transition-transform duration-200 group-data-[state=open]:rotate-180 motion-reduce:transition-none" /></CollapsibleTrigger> : null}
        </div> : null}
      </article>
      {ongoing ? <CollapsibleContent className="hearing-reveal mx-3 overflow-hidden">
        <div className="hearing-actions rounded-b-xl border border-t-0 border-hairline bg-card p-3 shadow-raised">
          <Button className="w-full" onClick={() => onJoin(row)} aria-label={`${joinLabel}: ${row.parties}, ${row.courtLabel}, ${row.courtNumber ?? "N/A"}`}>
            <Video aria-hidden="true" />{joinLabel}
          </Button>
        </div>
      </CollapsibleContent> : null}
    </Collapsible>
  );
}
