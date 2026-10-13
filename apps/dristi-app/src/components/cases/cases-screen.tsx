"use client";

import { PAGE_TITLE } from "@/components/shell/page-frame";
import { Separator } from "@/components/ui/separator";
import { useMediaQuery } from "@/hooks/use-media-query";
import { cn } from "@/lib/utils";
import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  BookmarkIcon,
  FileSearchIcon,
  FolderOpenIcon,
  SearchIcon,
  Share2Icon,
  UserPlusIcon,
} from "lucide-react";

import { Banner } from "@/components/ui/banner";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { Label } from "@/components/ui/label";
import { Toggle } from "@/components/ui/toggle";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  buildCasesHref,
  clearedFilters,
  isNarrowed,
  selectCases,
  summariseCases,
  type CaseStatus,
  type CasesQuery,
} from "@/lib/cases/query";
import { partiesLabel, type CaseRecord } from "@/lib/cases/types";
import { ShareDialog } from "@/components/access/share-dialog";
import { type AccessCase } from "@/lib/access/content";
import { AdvocateJoinCaseDialog } from "@/components/advocate/join-case-dialog";
import { advJoinPage } from "@/lib/advocate/content";
import { pick } from "@/lib/onboarding/content";
import { useLocale } from "@/components/shell/locale";
import { useProfile } from "@/components/shell/profile";

import { CasesFiltersButton, CasesAppliedFilters } from "./cases-filters";
import { CasePeekPushRegion, PEEK_PUSH_CLASS } from "./case-peek";
import {
  CARDS_ONLY,
  TABLE_FRAME,
  TABLE_ONLY,
  TABLE_QUERY,
} from "./cases-layout";
import { CollapsibleLabel } from "./collapsible-label";
import { CasesListResults } from "./cases-list-results";
import { CasesResultsSkeleton } from "./cases-list-skeleton";
import { CasesTableColumnsMenu } from "./cases-table-columns-menu";
import { useCasesNavigation } from "./use-cases-navigation";
import { CasePeekProvider, useCasePeek } from "./use-case-peek";
import { CasesSelectionProvider } from "./use-cases-selection";

/**
 * The Cases landing.
 *
 * Three rows: the page title with its one strong action (Join a case — the whole
 * journey is a dialog, so it needs a button, not a page); the Bookmarked lens beside
 * it as an on/off switch; and the panel, whose header carries what narrows the list —
 * Share access for the selection, Columns, Filters, search — over the count of what
 * matched out of the whole book. The old tab strip is gone: status is one group in
 * the Filters sheet, since Ongoing, Long pending register and Disposed were only
 * ever filters wearing tabs. The Folders / List presentation toggle is gone too — its
 * folders were case stages, which the Filters sheet already carries as one group, so
 * the view was a second door to the same room. The list is the one view now.
 * Bookmarked stays outside the sheet because it is not a filter on the case; it is a
 * mark the person put there, and they want it in one flip.
 */
export function CasesScreen({
  query,
  cases,
  initialBookmarks,
  now,
}: {
  query: CasesQuery;
  cases: CaseRecord[];
  initialBookmarks: string[];
  now: number;
}) {
  const router = useRouter();
  const { search, effective, go, onSearchChange } = useCasesNavigation(query);
  const [bookmarks, setBookmarks] = React.useState<ReadonlySet<string>>(
    () => new Set(initialBookmarks)
  );
  const { locale } = useLocale();
  const { profileRole, switchProfile } = useProfile();

  // Bulk share: select cases in the list, then Share access adds staff to all at once.
  const [selectedCases, setSelectedCases] = React.useState<Set<string>>(
    () => new Set()
  );
  const [shareOpen, setShareOpen] = React.useState(false);
  const [joinOpen, setJoinOpen] = React.useState(false);
  const toggleSelected = React.useCallback((id: string) => {
    setSelectedCases((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);
  const setManySelected = React.useCallback((ids: readonly string[], on: boolean) => {
    setSelectedCases((prev) => {
      const next = new Set(prev);
      for (const id of ids) {
        if (on) next.add(id);
        else next.delete(id);
      }
      return next;
    });
  }, []);
  const shareCases: AccessCase[] = React.useMemo(
    () =>
      cases
        .filter((record) => selectedCases.has(record.id))
        .map((record) => ({
          id: record.id,
          title: partiesLabel(record),
          caseNumber: record.caseNumber,
          court: record.court,
          nextHearing: record.nextHearing?.on ?? "—",
        })),
    [cases, selectedCases]
  );

  const totals = summariseCases(cases, bookmarks);
  const selection = selectCases({
    query: effective,
    bookmarks,
    now,
    source: cases,
  });
  const narrowed = isNarrowed(effective);
  const matched = selection.total;
  /* The long-pending flag repeats the filter when that is the only status shown. */
  const onlyLongPending =
    effective.status.length === 1 && effective.status[0] === "long-pending";

  function pageLink(page: number) {
    const href = buildCasesHref(effective, { page });
    return {
      href,
      onClick: (event: React.MouseEvent<HTMLAnchorElement>) => {
        if (event.metaKey || event.ctrlKey || event.shiftKey) return;
        event.preventDefault();
        router.push(href);
      },
    };
  }

  function toggleBookmark(id: string) {
    setBookmarks((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  /* Filters do not sort the list as each box is ticked — the real backend cannot
     re-sort on every keystroke, and a list that reshuffles under the sheet is its own
     kind of noise. The sheet holds a draft; Show cases commits it, and this brief hold
     stands in for the round trip the server will make, so the change reads as a
     deliberate step rather than a flicker. */
  const [filtersPending, setFiltersPending] = React.useState(false);
  const pendingTimer = React.useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined
  );
  React.useEffect(() => () => clearTimeout(pendingTimer.current), []);
  const applyFilters = React.useCallback(
    (patch: Partial<CasesQuery>) => {
      setFiltersPending(true);
      go(patch);
      clearTimeout(pendingTimer.current);
      pendingTimer.current = setTimeout(() => setFiltersPending(false), 600);
    },
    [go]
  );

  /* Joining is the advocate journey. A litigant joins from their own home, so the
     same button sends them there rather than opening the advocate dialog. */
  function joinCase() {
    if (profileRole === "litigant") {
      router.push("/home?join=manual");
      return;
    }
    setJoinOpen(true);
  }

  /* The rail's Join a case lands here with `?join=1`: open the same journey the
     header button does, then drop the flag so the rail can open it again. */
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const joinRequested = searchParams.get("join") === "1";
  const [joinSeen, setJoinSeen] = React.useState(false);
  if (joinRequested !== joinSeen) {
    setJoinSeen(joinRequested);
    if (joinRequested && profileRole !== "litigant") setJoinOpen(true);
  }
  React.useEffect(() => {
    if (!joinRequested) return;
    if (profileRole === "litigant") {
      router.push("/home?join=manual");
      return;
    }
    const rest = new URLSearchParams(searchParams.toString());
    rest.delete("join");
    const qs = rest.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [joinRequested]);

  function clearAll() {
    onSearchChange("");
    go(clearedFilters());
  }

  let body: React.ReactNode;
  if (filtersPending) {
    body = <CasesResultsSkeleton />;
  } else if (cases.length === 0) {
    body = (
      <Empty className="border-0 p-0">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <FolderOpenIcon aria-hidden />
          </EmptyMedia>
          <EmptyTitle className="text-title-s font-semibold">No cases yet</EmptyTitle>
          <EmptyDescription className="text-body">
            A case appears here once its filing has cleared scrutiny. Drafts and
            returned filings stay in File a case.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  } else if (matched === 0) {
    body = (
      <Empty className="border-0 p-0">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <FileSearchIcon aria-hidden />
          </EmptyMedia>
          <EmptyTitle className="text-title-s font-semibold">
            No cases match
          </EmptyTitle>
          <EmptyDescription className="text-body">
            {search
              ? "Nothing here matches this search. Try another case name or number, or clear the filters."
              : "Nothing here matches these filters. Change them, or clear them to see every case again."}
          </EmptyDescription>
        </EmptyHeader>
        {narrowed ? (
          <EmptyContent>
            <Button variant="outline" onClick={clearAll}>
              Clear all filters
            </Button>
          </EmptyContent>
        ) : null}
      </Empty>
    );
  } else {
    body = (
      <CasesListResults
        selection={selection}
        pageSize={effective.pageSize}
        onPageSizeChange={(pageSize) => go({ pageSize })}
        bookmarks={bookmarks}
        onToggleBookmark={toggleBookmark}
        pageLink={pageLink}
        framed={false}
        hideLongPendingFlag={onlyLongPending}
      />
    );
  }

  const panel =
    query.demo === "error" ? (
      <Banner
        variant="error"
        action={
          <Button variant="outline" onClick={() => go({ demo: null })}>
            Try again
          </Button>
        }
      >
        Cases could not be loaded. Nothing has been changed — try again in a
        moment.
      </Banner>
    ) : (
      <div
        className={cn(
          "flex flex-col gap-6",
          // The white frame is the table's. Below `md` every case is its own
          // card, and a framed card full of bordered cards was a box of boxes
          // with 24px lost on each side of a 375px screen (owner, Sept 21).
          TABLE_FRAME
        )}
      >
          {/* What narrows the list sits with the list: the selection's action,
              the filters, the search. When the peek pushes the column, this row
              compresses in place rather than wrapping below the title. */}
          <CasesToolbar
            matched={matched}
            total={cases.length}
            selectedCount={selectedCases.size}
            onShare={() => setShareOpen(true)}
            query={effective}
            cases={cases}
            totals={totals}
            onApply={applyFilters}
            search={search}
            onSearchChange={onSearchChange}
          />

          {/* `empty:hidden`: with nothing applied this held a gap of its own. */}
          <div className={cn(PEEK_PUSH_CLASS, "empty:hidden")}>
            <CasesAppliedFilters query={effective} onChange={applyFilters} />
          </div>

          {body}
      </div>
    );

  return (
    <CasesSelectionProvider
      value={{
        selected: selectedCases,
        toggle: toggleSelected,
        setMany: setManySelected,
        enabled: true,
      }}
    >
      <CasePeekProvider now={now} docked>
      {/* The Pending tasks ground, as on the case page, so the white panel and
          its edge stand off the page (owner, Sept 18). */}
      <CasePeekPushRegion
        // On a phone the peek rises from the bottom, as it does from Home.
        mobileDrawer
        pushWhen={TABLE_QUERY}
        className="flex min-w-0 flex-1 flex-col gap-6 bg-muted p-6 md:gap-8 md:p-8 dark:bg-background"
      >
        {/* One plane above the panel: the title, then on the right the Bookmarked
            lens and the page's one bg-primary action (Laws: ration teal). Bookmarked is
            an icon toggle — a view the person turns on and off, not a command — its
            meaning carried by a tooltip so it stays a single quiet mark beside the loud
            teal action. It sits here rather than in the panel because it is about the
            person, not the case, and beside Join a case because that is the other thing
            on this page that is theirs to do. */}
        <header
          className={
            "flex flex-wrap items-center justify-between gap-4 " + PEEK_PUSH_CLASS
          }
        >
          <h1 className={PAGE_TITLE}>Cases</h1>
          <div className="flex min-w-0 flex-wrap items-center gap-3">
            <Tooltip>
              <TooltipTrigger asChild>
                <Toggle
                  variant="outline"
                  pressed={effective.bookmarked}
                  onPressedChange={(bookmarked) => go({ bookmarked })}
                  aria-label="Bookmarked cases"
                  className="size-10 shrink-0"
                >
                  <BookmarkIcon
                    aria-hidden
                    className={effective.bookmarked ? "fill-current" : undefined}
                  />
                </Toggle>
              </TooltipTrigger>
              <TooltipContent>Bookmarked cases</TooltipContent>
            </Tooltip>
            <Button size="lg" onClick={joinCase} className="shrink-0">
              <UserPlusIcon data-icon="inline-start" aria-hidden />
              {pick(advJoinPage.cta, locale)}
            </Button>
          </div>
        </header>

        {/* Cards only: without the table's white frame, "Cases" and its actions
            ran straight into "Your cases". A hairline parts the page's header
            from the list's (owner, Sept 21). */}
        <Separator className={cn("bg-hairline", CARDS_ONLY)} />

        {panel}
      </CasePeekPushRegion>
      </CasePeekProvider>
      <ShareDialog
        open={shareOpen}
        onOpenChange={setShareOpen}
        cases={shareCases}
        locale={locale}
      />
      {/* The join journey — lookup → code → details → role → vakalatnama → pay → done —
          runs here, over the list it will add to. Discovering mid-journey that you
          are a party rather than a representative hands off to the same profile
          switch the rail's foot offers. */}
      <AdvocateJoinCaseDialog
        open={joinOpen}
        onOpenChange={setJoinOpen}
        mode="manual"
        locale={locale}
        onJoined={() => {
          /* The dialog's done-stage reports the outcome (joined, or waiting on an
             approver). A joined case surfaces in this list once the backend lands. */
        }}
        onJoinAsLitigant={(kind) => {
          setJoinOpen(false);
          if (profileRole === "advocate") switchProfile();
          // Carry on with the case already found and verified (JOIN-20).
          router.push(`/home?join=handoff&as=${kind}`);
        }}
      />
    </CasesSelectionProvider>
  );
}

/** `sm` up to `lg`: a tablet held upright, or a small window. */
const UPRIGHT_TABLET_QUERY = "(min-width: 640px) and (max-width: 1023.98px)";

/**
 * The panel's top row: what the list is (title + count) on the left, what narrows it on
 * the right. When the peek is docked open it squeezes this column, so the row reads the
 * peek state and compresses in place rather than wrapping under the title — Share access
 * and Columns fall to icon buttons, Filters to its icon with the count as a corner badge,
 * and the search narrows. A tooltip carries each icon's name so nothing is lost.
 */
function CasesToolbar({
  matched,
  total,
  selectedCount,
  onShare,
  query,
  cases,
  totals,
  onApply,
  search,
  onSearchChange,
}: {
  matched: number;
  total: number;
  selectedCount: number;
  onShare: () => void;
  query: CasesQuery;
  cases: CaseRecord[];
  totals: Record<CaseStatus | "bookmarked", number>;
  onApply: (patch: Partial<CasesQuery>) => void;
  search: string;
  onSearchChange: (value: string) => void;
}) {
  const { record, docked, closing } = useCasePeek();
  // Compress the moment a close begins (not when it ends), so the buttons morph back to
  // labels in step with the panel sliding out and the chrome easing back — no end-pop.
  // Only where the peek docks beside the table. On a phone it is a drawer and on an
  // upright tablet it lies over the cards, and the toolbar re-arranging itself
  // behind either was movement with no cause (owner, Sept 21).
  const pushes = useMediaQuery(TABLE_QUERY);
  const squeezed = pushes && docked && Boolean(record) && !closing;
  // A tablet held upright (iPad Air, 820) has room for one line only if the two
  // actions give up their words (owner, Sept 21). Same icon form the docked
  // peek already uses, so it is one compact state, reached two ways.
  const upright = useMediaQuery(UPRIGHT_TABLET_QUERY);
  const compact = squeezed || upright;

  return (
    <div
      className={
        // Three children: what the list is, its actions, its search. Phone: a
        // column, search before actions. `sm` up: one line, heading left,
        // actions then search right.
        "flex min-w-0 flex-col gap-4 sm:flex-row sm:items-center " +
        (compact ? "sm:flex-nowrap " : "sm:flex-wrap ") +
        PEEK_PUSH_CLASS
      }
    >
      <div className="flex min-w-0 flex-col gap-1 max-sm:order-1 sm:shrink-0">
        <h2 className="text-title-s font-semibold">Your cases</h2>
        {/* Says how many matched out of everything, so a filtered list is never
            mistaken for the whole book. */}
        <p
          className="text-body-compact text-muted-foreground tabular-nums"
          aria-live="polite"
        >
          Showing {matched} of {total} {total === 1 ? "case" : "cases"}
        </p>
      </div>
      <div
        className={
          "flex min-w-0 items-center gap-2 max-sm:order-3 sm:ml-auto sm:justify-end " +
          (compact ? "flex-nowrap" : "flex-wrap")
          // Below `sm`: search on its own line first, then Share access and
          // Filters splitting the next one. Wrapped left, they read as dropped.
          + " max-sm:[&>[data-toolbar-action]]:flex-1"
        }
      >
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="outline"
              disabled={selectedCount === 0}
              onClick={onShare}
              data-toolbar-action
              className={
                "relative shrink-0 gap-0 duration-300 " +
                (compact ? "px-2.5" : "px-4")
              }
              aria-label={`Share access${selectedCount ? `, ${selectedCount} selected` : ""}`}
            >
              <Share2Icon aria-hidden />
              <CollapsibleLabel show={!compact}>Share access</CollapsibleLabel>
              {selectedCount ? (
                <span className="ms-1.5 inline-flex min-w-4 items-center justify-center rounded-full bg-primary px-1 text-caption font-medium tabular-nums text-primary-foreground">
                  {selectedCount}
                </span>
              ) : null}
            </Button>
          </TooltipTrigger>
          {/* The name only needs a tooltip while the label is collapsed. */}
          {compact ? <TooltipContent>Share access</TooltipContent> : null}
        </Tooltip>
        {/* Columns belong to the table. The cards below `md` have one designed
            shape, so the control that would do nothing there is not offered. */}
        <div className={TABLE_ONLY}>
          <CasesTableColumnsMenu compact={compact} />
        </div>
        <CasesFiltersButton
          query={query}
          cases={cases}
          totals={totals}
          onApply={onApply}
          compact={compact}
        />
      </div>
      {/* Compact: the toolbar lives inside the card's p-6, so its right edge sits a
          padding-width in from Join a case (which is in the outer header). Pull the
          search out by that 6 so its right edge lands on the same vertical plane as
          Join (owner, Sept 11), and ease the width so it grows back with everything
          else. Only the search moves; the icons stay packed to its left. */}
      <div
        className={
          "min-w-0 transition-[width,margin] duration-300 ease-out max-sm:order-2 " +
          (squeezed
            ? "-mr-6 w-44"
            : upright
              ? "w-48 min-w-28 shrink"
              : "w-full sm:w-72 lg:w-52 xl:w-72")
        }
      >
        <Label htmlFor="cases-search" className="sr-only">
          Search cases
        </Label>
        <InputGroup>
          <InputGroupAddon>
            <SearchIcon aria-hidden />
          </InputGroupAddon>
          <InputGroupInput
            id="cases-search"
            type="search"
            autoComplete="off"
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
            // Short enough to read whole in the narrower box the toolbar gets on a
            // tablet on its side; the magnifier already says "search".
            placeholder={compact ? "Search" : "Case name or number"}
          />
        </InputGroup>
      </div>
    </div>
  );
}
