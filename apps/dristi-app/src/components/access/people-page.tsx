"use client";

import * as React from "react";
import {
  CheckCircle2Icon,
  ChevronRightIcon,
  PlusIcon,
  SearchIcon,
  UsersIcon,
  XIcon,
} from "lucide-react";

import { ChromeAlertDialogContent } from "@/components/chrome/app-chrome";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SegmentedControl, SegmentedControlItem } from "@/components/ui/segmented-control";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { initials } from "@/components/access/access-list";
import { useAccess } from "@/components/access/access-state";
import { AddPersonDialog } from "@/components/access/add-person-dialog";
import { pick, type Locale } from "@/lib/onboarding/content";
import {
  ACCESS_CASES,
  fillCopy,
  listCopy,
  peopleCopy,
  shareCopy,
  type AccessGrant,
  type AccessPerson,
} from "@/lib/access/content";
import {
  PAGE_GROUND,
  PAGE_GUTTER,
  PAGE_SUBTITLE,
  PAGE_TITLE,
} from "@/components/shell/page-frame";
import { PANEL_CLASS } from "@/components/shell/panel";
import { Drawer, DrawerContent, DrawerTitle } from "@/components/ui/drawer";
import { useMediaQuery } from "@/hooks/use-media-query";
import { cn } from "@/lib/utils";
import { Identifier } from "@/components/chrome/identifier";

/**
 * The People page — the advocate's office (office management handover, §2–§4).
 *
 * A FLAT list of the people this advocate has given office access to (name,
 * number, designation, case count) — never co-advocates on a vakalatnama
 * (OFC-11). Add person opens the add flow. Opening a person slides in an
 * INLINE side panel that pushes the list left — no overlay, nothing behind it
 * disabled, so clicking another person just repoints the panel. On phones it
 * becomes a drawer.
 *
 * The panel holds the all-future-cases switch, the cases they can access
 * (checkbox select, per-case remove), Give access to more cases, and Remove
 * from office.
 */

type PeopleSort = "name-asc" | "name-desc" | "cases-desc" | "cases-asc";

function caseById(caseId: string) {
  return ACCESS_CASES.find((c) => c.id === caseId);
}

/**
 * The list carries the designation as its own column, so the name drops the
 * "Adv." salutation — saying it twice made the rows read as a bar roll
 * rather than a team list. The raw name keeps the prefix (it is how counsel
 * are addressed everywhere else); only this page's display strips it.
 */
function displayName(person: AccessPerson): string {
  return person.name.replace(/^Adv\.\s*/, "");
}

/**
 * A person is an advocate by enrolment (barId) or by holding an advocate
 * grant; clerks are clerks on every case they touch. Someone with neither —
 * a pending invite known only by number — gets no designation rather than a
 * guessed one.
 */
function personDesignation(person: AccessPerson, locale: Locale): string | null {
  if (
    person.barId ||
    person.grants.some((g) => g.role === "vakalat" || g.role === "junior")
  ) {
    return pick(peopleCopy.designationAdvocate, locale);
  }
  if (person.grants.some((g) => g.role === "clerk")) {
    return pick(peopleCopy.designationClerk, locale);
  }
  return null;
}

/**
 * One template shared by the header band and every row, so the columns can
 * never drift: identity, designation (hidden on phones — it folds into the
 * caption line there), case count, and a trailing chevron that says the
 * rows open. Proportional tracks rather than fixed right-edge widths, so on
 * a wide list the designation and count sit around the middle instead of
 * hugging the chevron with dead space after the name (Aug 31 round).
 */
/** One exit, the Cases peek's length. */
const PANEL_EXIT_MS = 300;
const DETAIL_PANEL_ID = "people-detail-panel";

const PEOPLE_GRID =
  "grid-cols-[minmax(0,1fr)_6rem_1.5rem] sm:grid-cols-[minmax(0,3fr)_2fr_2fr_1.5rem]";

function PersonListRow({
  person,
  locale,
  active,
  onOpen,
}: {
  person: AccessPerson;
  locale: Locale;
  active: boolean;
  onOpen: () => void;
}) {
  const count = person.grants.length;
  const designation = personDesignation(person, locale);
  const caseCount =
    count === 1
      ? pick(peopleCopy.caseCountOne, locale)
      : fillCopy(peopleCopy.caseCount, locale, { count: String(count) });

  return (
    <>
    {/* Phone: a card per person. The table's three columns at 375px left the
        name truncated and the designation riding a caption; a card gives the
        name a full line and puts role and case count on their own, as facts
        (owner, Sept 21). */}
    <button
      type="button"
      onClick={onOpen}
      aria-current={active || undefined}
      className={cn(
        PANEL_CLASS,
        "flex w-full rounded-xl border bg-card p-4 text-left transition-colors active:bg-accent focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none sm:pointer-fine:hidden",
        active && "border-border",
      )}
    >
      <span className="flex min-w-0 flex-1 flex-col gap-3">
        <span className="flex min-w-0 items-start gap-3">
          <Avatar className="size-10 shrink-0">
            <AvatarFallback className="text-caption font-medium">
              {initials(person.name)}
            </AvatarFallback>
          </Avatar>
          <span className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className="text-body-compact font-semibold break-words">
              {displayName(person)}
            </span>
            <span className="text-caption text-muted-foreground">
              <span className="tabular-nums">{person.phone}</span>
              {person.pending ? (
                <>
                  <span aria-hidden> · </span>
                  {pick(listCopy.invitedPending, locale)}
                </>
              ) : null}
              {person.allCases ? (
                <>
                  <span aria-hidden> · </span>
                  {pick(peopleCopy.futureBadge, locale)}
                </>
              ) : null}
            </span>
          </span>
          {/* On the name's own line, at its far end: who they are to you. */}
          {designation ? (
            <Badge variant="secondary" className="shrink-0">
              {designation}
            </Badge>
          ) : null}
        </span>
        {/* Under a hairline, the one number the card is opened for. */}
        <span className="flex items-center justify-between gap-3 border-t border-hairline pt-3">
          <span className="text-body-compact font-medium text-muted-foreground tabular-nums">
            {caseCount}
          </span>
          <ChevronRightIcon
            className="size-4 shrink-0 text-muted-foreground"
            aria-hidden
          />
        </span>
      </span>
    </button>

    <button
      type="button"
      onClick={onOpen}
      aria-current={active || undefined}
      className={cn(
        "hidden w-full items-center gap-3 rounded-lg px-2 py-3 text-left transition-colors hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none sm:pointer-fine:grid",
        PEOPLE_GRID,
        active && "bg-muted",
      )}
    >
      <span className="flex min-w-0 items-center gap-3">
        <Avatar className="size-10 shrink-0">
          <AvatarFallback className="text-caption font-medium">
            {initials(person.name)}
          </AvatarFallback>
        </Avatar>
        <span className="flex min-w-0 flex-col gap-0.5">
          <span className="truncate text-body-compact font-medium">
            {displayName(person)}
          </span>
          <span className="truncate text-caption text-muted-foreground">
            <span className="tabular-nums">{person.phone}</span>
            {person.pending ? (
              <>
                <span aria-hidden> · </span>
                {pick(listCopy.invitedPending, locale)}
              </>
            ) : null}
            {person.allCases ? (
              <>
                <span aria-hidden> · </span>
                {pick(peopleCopy.futureBadge, locale)}
              </>
            ) : null}
            {/* Phones have no designation column — it rides the caption line. */}
            {designation ? (
              <span className="sm:hidden">
                <span aria-hidden> · </span>
                {designation}
              </span>
            ) : null}
          </span>
        </span>
      </span>
      <span className="hidden truncate text-body-compact text-muted-foreground sm:block">
        {designation ?? "—"}
      </span>
      <span className="text-body-compact text-muted-foreground tabular-nums">
        {count === 1
          ? pick(peopleCopy.caseCountOne, locale)
          : fillCopy(peopleCopy.caseCount, locale, { count: String(count) })}
      </span>
      <ChevronRightIcon
        className="size-4 justify-self-end text-muted-foreground"
        aria-hidden
      />
    </button>
    </>
  );
}

/** One case entry — spacious: title, number, joined date, attribution. */
function CaseEntry({
  grant,
  person,
  locale,
  selectable,
  checked,
  onCheck,
  onOpenCase,
  onRemove,
  removeLocked = false,
  removalPending = false,
}: {
  grant: AccessGrant;
  person: AccessPerson;
  locale: Locale;
  selectable: boolean;
  checked: boolean;
  onCheck?: (value: boolean) => void;
  onOpenCase: () => void;
  /** Absent where a remove affordance makes no sense at all; on
      office-access cases pass `removeLocked` instead so the button stays
      visible but disabled — an absent button reads as a bug. */
  onRemove?: () => void;
  /** Office access: Remove renders disabled with the why in a tooltip. */
  removeLocked?: boolean;
  /** A vakalat removal already requested — the row waits, Remove retires. */
  removalPending?: boolean;
}) {
  const grantCase = caseById(grant.caseId);
  if (!grantCase) return null;
  const isVakalat = grant.role === "vakalat";
  // A person yet to accept says so once, in the panel header — not on every case.
  const isPending = !person.pending && grant.status === "invited";
  const grantInviter = grant.addedBy ?? person.addedBy;
  const invitedBy =
    grantInviter === "self"
      ? pick(peopleCopy.invitedByYou, locale)
      : grantInviter
        ? fillCopy(peopleCopy.invitedBy, locale, { name: grantInviter })
        : null;

  return (
    <div className="@container/case-entry flex items-start gap-3 py-4">
      {selectable ? (
        <Checkbox
          checked={checked}
          data-preserve-admin-selection={selectable || undefined}
          aria-label={fillCopy(peopleCopy.selectCaseAria, locale, {
            caseNumber: grantCase.caseNumber,
          })}
          className="mt-0.5"
          onCheckedChange={(value) => onCheck?.(value === true)}
        />
      ) : null}
      <div className="flex min-w-0 flex-1 flex-col gap-2 @xs/case-entry:flex-row @xs/case-entry:items-center">
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-body-compact font-medium text-pretty">{grantCase.title}</p>
            {isPending ? (
              <Badge variant="warning">{pick(shareCopy.statusInvited, locale)}</Badge>
            ) : null}
          </div>
          <Identifier
            value={grantCase.caseNumber}
            label="case number"
            className="self-start text-caption text-muted-foreground"
          />
          <p className="text-caption text-muted-foreground">
            {fillCopy(
              isPending ? peopleCopy.invitedOn : peopleCopy.joinedOn,
              locale,
              { date: grant.since },
            )}
            {!isVakalat && invitedBy && grantInviter !== "self" ? <> · {invitedBy}</> : null}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1 pt-1 @xs/case-entry:self-center @xs/case-entry:pt-0">
          {removalPending ? (
            <span className="px-2 text-caption text-muted-foreground">
              {pick(peopleCopy.removalPending, locale)}
            </span>
          ) : removeLocked ? (
            <Tooltip>
              <TooltipTrigger asChild>
                {/* Disabled buttons swallow pointer events — the span
                    carries the hover (LockedRemove's own trick). */}
                <span tabIndex={0} className="inline-flex">
                  <Button type="button" variant="ghost" size="sm" disabled>
                    {pick(peopleCopy.removeFromCase, locale)}
                  </Button>
                </span>
              </TooltipTrigger>
              <TooltipContent className="max-w-64 text-pretty">
                {pick(peopleCopy.officeLockedTooltip, locale)}
              </TooltipContent>
            </Tooltip>
          ) : onRemove ? (
            <Button type="button" variant="destructive-ghost" size="sm" onClick={onRemove}>
              {pick(peopleCopy.removeFromCase, locale)}
            </Button>
          ) : null}
          <Button type="button" variant="outline" size="sm" onClick={onOpenCase}>
            {pick(peopleCopy.openCase, locale)}
          </Button>
        </div>
      </div>
    </div>
  );
}

export function PeoplePage({
  locale,
  onOpenCase,
}: {
  locale: Locale;
  /** Jump to a case's file (the wireframe) — wired by the parent screen. */
  onOpenCase: (caseId: string) => void;
}) {
  const { office, removeGrant, removeAll, setAllCases } = useAccess();
  const [query, setQuery] = React.useState("");
  const [caseQuery, setCaseQuery] = React.useState("");
  const [peopleSort, setPeopleSort] = React.useState<PeopleSort>("name-asc");
  const [openPersonId, setOpenPersonId] = React.useState<string | null>(null);
  const [checkedCases, setCheckedCases] = React.useState<string[]>([]);
  const [confirmRemove, setConfirmRemove] = React.useState(false);
  /* A row's own Remove borrows the selection to reuse the confirm; cancelling
     must give the selection back empty, not leave that row ticked. */
  const [singleRemove, setSingleRemove] = React.useState(false);
  const [removedNote, setRemovedNote] = React.useState<string | null>(null);
  /* Add person (OFC-14), or Give access to more cases for the open person (OFC-33). */
  const [addOpen, setAddOpen] = React.useState(false);
  const [addFor, setAddFor] = React.useState<AccessPerson | null>(null);

  // The office: people this advocate gave access to, or set for future cases (OFC-11).
  const active = office;
  const q = query.trim().toLowerCase();
  const searched = q
    ? active.filter(
        (person) =>
          person.name.toLowerCase().includes(q) || person.phone.replace(/\D/g, "").includes(q),
      )
    : active;
  const matches = [...searched].sort((a, b) => {
    const aName = a.name.replace(/^Adv\.\s*/, "");
    const bName = b.name.replace(/^Adv\.\s*/, "");
    if (peopleSort === "name-desc") return bName.localeCompare(aName);
    if (peopleSort === "cases-desc") return b.grants.length - a.grants.length;
    if (peopleSort === "cases-asc") return a.grants.length - b.grants.length;
    return aName.localeCompare(bName);
  });

  // Someone removed from every case (and not on future cases) leaves the office,
  // so the panel closes on them rather than showing nobody (OFC-37).
  const openPerson = office.find((person) => person.id === openPersonId) ?? null;
  const staffGrants = openPerson ? openPerson.grants : [];
  const caseQ = caseQuery.trim().toLowerCase();
  const matchesCaseQuery = (grant: AccessGrant) => {
    if (!caseQ) return true;
    const grantCase = caseById(grant.caseId);
    return Boolean(
      grantCase &&
        (grantCase.title.toLowerCase().includes(caseQ) ||
          grantCase.caseNumber.toLowerCase().includes(caseQ)),
    );
  };
  const visibleStaffGrants = staffGrants.filter(matchesCaseQuery);
  const removingAll = checkedCases.length === 0;
  const removeCount = checkedCases.length || staffGrants.length;

  /*
    The panel leaves the way the Cases peek does: `closingPanel` flips at once and
    the person is dropped one exit later, so the slide-out has something to play on.
    Closing is an event, not an effect, so nothing here sets state while rendering.
  */
  const [closingPanel, setClosingPanel] = React.useState(false);
  const [exitWidth, setExitWidth] = React.useState<number | null>(null);
  // The exit's clock. Reopening flips `closingPanel` back, which cancels it.
  React.useEffect(() => {
    if (!closingPanel) return;
    const timer = window.setTimeout(() => {
      setClosingPanel(false);
      setOpenPersonId(null);
      setCheckedCases([]);
      setCaseQuery("");
      setRemovedNote(null);
    }, PANEL_EXIT_MS);
    return () => window.clearTimeout(timer);
  }, [closingPanel]);

  function openPanel(personId: string) {
    // Picking someone while the panel is on its way out cancels the exit.
    setClosingPanel(false);
    setOpenPersonId(personId);
    setCheckedCases([]);
    setCaseQuery("");
    setRemovedNote(null);
  }

  function closePanel() {
    // The width the person dragged it to, so the exit starts from where it sat.
    const width = document.getElementById(DETAIL_PANEL_ID)?.getBoundingClientRect().width;
    setExitWidth(width ?? null);
    setClosingPanel(true);
  }

  function confirmBulkRemove() {
    if (!openPerson) return;
    if (removingAll) {
      // Remove from office: every case, whichever access they had (OFC-35).
      removeAll(openPerson.id);
      setRemovedNote(fillCopy(peopleCopy.removedAllNote, locale, { name: openPerson.name }));
    } else {
      checkedCases.forEach((caseId) => removeGrant(openPerson.id, caseId));
      const numbers = checkedCases
        .map((caseId) => caseById(caseId)?.caseNumber)
        .filter(Boolean)
        .join(", ");
      setRemovedNote(
        fillCopy(peopleCopy.removedNote, locale, { name: openPerson.name, case: numbers }),
      );
    }
    setCheckedCases([]);
  }

  function renderAdministrativeSection() {
    if (!openPerson) return null;

    return (
      <section className="flex h-full min-h-0 flex-col overflow-hidden">
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-1">
          {visibleStaffGrants.length ? (
            <div className="flex flex-col divide-y divide-hairline">
              {visibleStaffGrants.map((grant) => {
                // All cases has no per-case removal: narrowing is switching to
                // Specific cases first (OFC-31, OFC-34).
                const canRemove = !openPerson.allCases;
                return (
                  <CaseEntry
                    key={grant.caseId}
                    grant={grant}
                    person={openPerson}
                    locale={locale}
                    selectable={canRemove && staffGrants.length > 1}
                    checked={checkedCases.includes(grant.caseId)}
                    onCheck={(value) =>
                      setCheckedCases((current) =>
                        value
                          ? [...current, grant.caseId]
                          : current.filter((id) => id !== grant.caseId),
                      )
                    }
                    onOpenCase={() => {
                      closePanel();
                      onOpenCase(grant.caseId);
                    }}
                    onRemove={
                      canRemove
                        ? () => {
                            // Confirmed like every removal (OFC-36).
                            setCheckedCases([grant.caseId]);
                            setSingleRemove(true);
                            setConfirmRemove(true);
                          }
                        : undefined
                    }
                  />
                );
              })}
            </div>
          ) : (
            <p className="py-4 text-caption text-muted-foreground">
              {pick(peopleCopy.noCaseMatches, locale)}
            </p>
          )}
        </div>
        {staffGrants.length > 0 ? (
          <div className="shrink-0 px-1 pt-2 pb-1">
            <Button
              type="button"
              variant="destructive"
              className="w-full"
              data-preserve-admin-selection
              onClick={() => setConfirmRemove(true)}
            >
              {checkedCases.length && !openPerson.allCases
                ? pick(peopleCopy.removeFromThese, locale)
                : pick(peopleCopy.removeFromAll, locale)}
            </Button>
          </div>
        ) : null}
      </section>
    );
  }

  /*
    One panel, two ways in. From `md` it docks beside the list and slides from the
    right. On a phone it rises from the bottom in the DS drawer, the way Home opens
    a case or a task there: a side panel on a 375px screen is just a second page,
    and the drawer keeps the list visibly underneath (owner, Sept 21).
  */
  // Docked only for a mouse on a wide screen. Every touch screen, an iPad Pro in
  // landscape included, gets the cards and the drawer (owner, Sept 21).
  const isDesktop = useMediaQuery("(min-width: 768px) and (pointer: fine)");

  /** The list and the panel share the row only while the panel is fully open. */
  const split = isDesktop && Boolean(openPerson) && !closingPanel;

  const detailPanel = openPerson ? (
          <aside
            id={DETAIL_PANEL_ID}
            data-state={closingPanel ? "closed" : "open"}
            className={cn(
              "@container/panel flex h-full min-h-0 w-full shrink-0 flex-col bg-surface",
              // Desktop: the Cases peek's own move, value for value: a full slide
              // from the right edge, no dissolve, and back out the way it came.
              // On a phone the drawer around it does the moving.
              isDesktop &&
                cn(
                  "border-l border-hairline fill-mode-forwards duration-300 ease-out motion-reduce:animate-none",
                  closingPanel
                    ? "animate-out slide-out-to-right-full"
                    : "animate-in slide-in-from-right-full",
                ),
            )}
            aria-label={openPerson.name}
            onPointerDown={(event) => {
              if (!checkedCases.length) return;
              const target = event.target as HTMLElement;
              if (!target.closest("[data-preserve-admin-selection]")) setCheckedCases([]);
            }}
          >
            <div className="relative flex items-start gap-3 border-b border-hairline p-4">
              <Avatar className="size-11 shrink-0">
                <AvatarFallback className="bg-brand-muted text-body-compact font-medium text-brand-muted-foreground">
                  {initials(openPerson.name)}
                </AvatarFallback>
              </Avatar>
              <div className="flex min-w-0 flex-1 flex-col gap-1 pr-10">
                <h2 className="truncate text-body font-semibold">
                  {displayName(openPerson)}
                </h2>
                <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                  <p className="text-caption text-muted-foreground tabular-nums">
                    {openPerson.phone}
                    {openPerson.pending ? ` · ${pick(listCopy.invitedPending, locale)}` : null}
                  </p>
                  {openPerson.barId ? (
                    <p className="flex items-baseline gap-1.5 text-caption tabular-nums">
                      <span className="text-muted-foreground">
                        {pick(peopleCopy.barIdLabel, locale)}
                      </span>
                      <Identifier
                        value={openPerson.barId}
                        label="bar id"
                        className="font-medium"
                      />
                    </p>
                  ) : null}
                </div>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label={pick(peopleCopy.closePanel, locale)}
                className="absolute top-3 right-3"
                onClick={closePanel}
              >
                <XIcon aria-hidden />
              </Button>
            </div>

            <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden p-4">
              {removedNote ? (
                <p className="flex items-start gap-1.5 rounded-lg border border-success bg-success-muted px-3 py-2 text-body-compact font-medium text-success-muted-foreground">
                  <CheckCircle2Icon className="mt-0.5 size-4 shrink-0" aria-hidden />
                  <span>{removedNote}</span>
                </p>
              ) : null}

              {/* One kind of access per person (OFC-24, OFC-31). */}
              <div className="flex shrink-0 flex-col gap-2 rounded-lg border border-hairline p-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <span id="people-scope-label" className="text-body-compact font-medium">
                    {pick(peopleCopy.scopeLabel, locale)}
                  </span>
                  <SegmentedControl
                    type="single"
                    aria-labelledby="people-scope-label"
                    value={openPerson.allCases ? "all" : "specific"}
                    onValueChange={(value) => {
                      if (!value) return;
                      setCheckedCases([]);
                      setAllCases(openPerson.id, value === "all");
                    }}
                  >
                    <SegmentedControlItem value="all" className="px-3">
                      {pick(peopleCopy.scopeAll, locale)}
                    </SegmentedControlItem>
                    <SegmentedControlItem value="specific" className="px-3">
                      {pick(peopleCopy.scopeSpecific, locale)}
                    </SegmentedControlItem>
                  </SegmentedControl>
                </div>
                <p className="text-caption text-pretty text-muted-foreground">
                  {pick(openPerson.allCases ? peopleCopy.scopeAllHint : peopleCopy.scopeSpecificHint, locale)}
                </p>
              </div>

              <div className="flex shrink-0 flex-col gap-3 border-b border-hairline pb-4 @lg/panel:flex-row @lg/panel:items-center">
                <h3
                  id="case-access-heading"
                  className="min-w-0 flex-1 text-body-compact font-semibold"
                >
                  {pick(peopleCopy.detailCases, locale)}
                </h3>
                <div className="relative w-full @lg/panel:w-56">
                  <SearchIcon
                    className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
                    aria-hidden
                  />
                  <Input
                    id="case-access-search"
                    type="search"
                    aria-labelledby="case-access-heading"
                    className="h-9 pl-9"
                    placeholder={pick(peopleCopy.caseSearchPlaceholder, locale)}
                    value={caseQuery}
                    onChange={(event) => setCaseQuery(event.target.value)}
                  />
                </div>
                {openPerson.allCases ? null : (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setAddFor(openPerson);
                      setAddOpen(true);
                    }}
                  >
                    <PlusIcon aria-hidden />
                    {pick(peopleCopy.moreCases, locale)}
                  </Button>
                )}
              </div>

              <div className="flex min-h-0 flex-1 flex-col">
                {renderAdministrativeSection()}
              </div>
            </div>
          </aside>
  ) : null;

  return (
    // The portal shell is page-scroll (its column is `min-h-svh`, growing with content).
    // The People panel scrolls its lists internally instead, so it needs a real height to
    // bound against — the viewport minus the sticky `h-14` top bar. (The old draggable
    // layout got this height from react-resizable-panels' JS measurement; tabs don't, so
    // the bound is stated here.) On phones the panel is `fixed inset-0`, so this only
    // shapes the desktop split.
    <div className="relative flex min-h-0 w-full flex-1 items-stretch md:pointer-fine:h-[calc(100svh---spacing(14))] md:pointer-fine:overflow-hidden">
      <ResizablePanelGroup
        key={split ? "detail-open" : "detail-closed"}
        orientation="horizontal"
      >
      <ResizablePanel
        defaultSize={split ? "48%" : "100%"}
        minSize={split ? "35%" : "100%"}
      >
      {/* ------------------------------------------------------ list column */}
      <main className={cn("flex min-h-0 min-w-0 flex-1 flex-col gap-6 md:pointer-fine:h-full md:pointer-fine:overflow-hidden", PAGE_GROUND, PAGE_GUTTER)}>
        <header className="flex flex-col gap-4 sm:flex-row sm:items-start">
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <h1 className={cn(PAGE_TITLE, "text-balance")}>
              {pick(peopleCopy.title, locale)}
            </h1>
            <p className={PAGE_SUBTITLE}>
              {pick(peopleCopy.subtitle, locale)}
            </p>
          </div>
          <Button
            type="button"
            className="self-start"
            onClick={() => {
              setAddFor(null);
              setAddOpen(true);
            }}
          >
            <PlusIcon aria-hidden />
            {pick(peopleCopy.addPerson, locale)}
          </Button>
        </header>

        {active.length ? (
          <>
            <div className="flex flex-wrap items-end gap-4">
              <div className="flex w-full flex-col gap-2 sm:min-w-0 sm:flex-1">
                <Label htmlFor="people-search">{pick(peopleCopy.searchLabel, locale)}</Label>
                <div className="relative">
                  <SearchIcon
                    className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
                    aria-hidden
                  />
                  <Input
                    id="people-search"
                    type="search"
                    className="pl-9"
                    placeholder={pick(peopleCopy.searchPlaceholder, locale)}
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                  />
                </div>
              </div>
              <div className="flex w-full flex-col gap-2 sm:w-48">
                <Label htmlFor="people-sort">{pick(peopleCopy.sortLabel, locale)}</Label>
                <Select value={peopleSort} onValueChange={(value) => setPeopleSort(value as PeopleSort)}>
                  <SelectTrigger id="people-sort" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="name-asc">{pick(peopleCopy.sortNameAsc, locale)}</SelectItem>
                    <SelectItem value="name-desc">{pick(peopleCopy.sortNameDesc, locale)}</SelectItem>
                    <SelectItem value="cases-desc">{pick(peopleCopy.sortCasesDesc, locale)}</SelectItem>
                    <SelectItem value="cases-asc">{pick(peopleCopy.sortCasesAsc, locale)}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {matches.length === 0 ? (
              <p className="py-8 text-center text-body-compact text-muted-foreground">
                {pick(peopleCopy.noMatches, locale)}
              </p>
            ) : (
              /* The list sits in a panel so the page can take the muted ground the
                 other pages have and the rows still read on white. */
              <div
                className={cn(
                  "flex min-h-0 flex-1 flex-col",
                  // The white box is the table's. On a phone each person is their
                  // own card, so the box steps away and the cards sit on the page.
                  "sm:pointer-fine:rounded-xl sm:pointer-fine:border sm:pointer-fine:border-hairline sm:pointer-fine:bg-card sm:pointer-fine:p-4 sm:pointer-fine:shadow-raised",
                )}
              >
                {/* Column band — same grid template and gutter as the rows,
                    so the labels sit exactly over their columns. */}
                <div
                  aria-hidden
                  className={cn(
                    "hidden items-center gap-3 border-b border-hairline px-2 pb-2 sm:pointer-fine:grid",
                    PEOPLE_GRID,
                  )}
                >
                  <span className="text-body-compact font-semibold text-muted-foreground">
                    {pick(peopleCopy.columnPerson, locale)}
                  </span>
                  <span className="hidden text-body-compact font-semibold text-muted-foreground sm:block">
                    {pick(peopleCopy.columnDesignation, locale)}
                  </span>
                  <span className="text-body-compact font-semibold text-muted-foreground">
                    {pick(peopleCopy.columnCases, locale)}
                  </span>
                  <span />
                </div>
              <div className="min-h-0 flex-1 md:pointer-fine:overflow-y-auto">
                {/* Touch: one column of cards at every width, tablets included (owner,
                    Sept 21). Mouse from `sm`: the table's ruled rows. */}
                <div className="flex flex-col gap-3 sm:pointer-fine:gap-0 sm:pointer-fine:divide-y sm:pointer-fine:divide-hairline">
                  {matches.map((person) => (
                    <PersonListRow
                      key={person.id}
                      person={person}
                      locale={locale}
                      active={person.id === openPersonId}
                      onOpen={() => openPanel(person.id)}
                    />
                  ))}
                </div>
              </div>
              </div>
            )}
          </>
        ) : (
          <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-border px-6 py-14 text-center">
            <span className="flex size-11 items-center justify-center rounded-full bg-muted text-muted-foreground">
              <UsersIcon className="size-5" aria-hidden />
            </span>
            <p className="text-body-compact font-semibold">{pick(peopleCopy.emptyTitle, locale)}</p>
            <p className="max-w-sm text-caption text-pretty text-muted-foreground">
              {pick(peopleCopy.emptyBody, locale)}
            </p>
          </div>
        )}
      </main>
      </ResizablePanel>

      {/* -------------------------------------------------- inline side panel */}
      {split ? (
        <>
          <ResizableHandle withHandle className="hidden md:flex" />
          <ResizablePanel defaultSize="52%" minSize="30%" maxSize="65%">
            {detailPanel}
          </ResizablePanel>
        </>
      ) : null}
      </ResizablePanelGroup>

      {/* On its way out the panel leaves the split: the list has already taken
          the full width underneath, and the panel slides off over it at the
          width it had. Sliding it inside its own slot left that slot standing
          empty until the exit ended, a blank column for a beat (owner, Sept 21).
          On a phone the panel is `fixed`, so the wrapper steps out of layout. */}
      {isDesktop && openPerson && closingPanel ? (
        <div
          className="max-md:contents md:absolute md:inset-y-0 md:right-0 md:z-10"
          style={exitWidth ? { width: exitWidth } : undefined}
        >
          {detailPanel}
        </div>
      ) : null}

      {!isDesktop ? (
        <Drawer
          open={Boolean(openPerson) && !closingPanel}
          onOpenChange={(next) => {
            if (!next) closePanel();
          }}
        >
          <DrawerContent
            aria-describedby={undefined}
            // Edge to edge on every screen. Clear of the bottom edge: the panel's last
            // control is a full-width button that sat on the screen's edge.
            className="h-[85dvh] overflow-hidden data-[vaul-drawer-direction=bottom]:max-h-[85dvh]"
            // The ladder's 4 on top of the safe area. As an inline style because the
            // safe-area inset has to be one, and an inline padding beats a class.
            style={{
              paddingBottom:
                "calc(var(--spacing) * 4 + env(safe-area-inset-bottom))",
            }}
          >
            <DrawerTitle className="sr-only">
              {openPerson ? displayName(openPerson) : ""}
            </DrawerTitle>
            {detailPanel}
          </DrawerContent>
        </Drawer>
      ) : null}

      {/* --------------------------------------------- bulk-remove confirm */}
      <AlertDialog
        open={confirmRemove}
        onOpenChange={(next) => {
          setConfirmRemove(next);
          if (!next && singleRemove) {
            setCheckedCases([]);
            setSingleRemove(false);
          }
        }}
      >
        <ChromeAlertDialogContent>
          {openPerson ? (
            <>
              <AlertDialogHeader>
                <AlertDialogTitle>
                  {removingAll
                    ? fillCopy(peopleCopy.removeAllTitle, locale, { name: openPerson.name })
                    : checkedCases.length === 1
                      ? fillCopy(peopleCopy.removeOneTitle, locale, {
                          name: openPerson.name,
                          case: caseById(checkedCases[0])?.caseNumber ?? "",
                        })
                      : fillCopy(peopleCopy.removeTheseTitle, locale, { name: openPerson.name })}
                </AlertDialogTitle>
                <AlertDialogDescription>
                  {removingAll
                    ? fillCopy(peopleCopy.removeAllBody, locale, { count: String(removeCount) })
                    : removeCount === staffGrants.length
                      ? `${removeCount === 1 ? pick(peopleCopy.removeBodyOne, locale) : fillCopy(peopleCopy.removeTheseBody, locale, { count: String(removeCount) })} ${pick(peopleCopy.removeLastBody, locale)}`
                      : removeCount === 1
                      ? pick(peopleCopy.removeBodyOne, locale)
                      : fillCopy(peopleCopy.removeTheseBody, locale, { count: String(removeCount) })}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>{pick(peopleCopy.removeAllCancel, locale)}</AlertDialogCancel>
                <AlertDialogAction variant="destructive" onClick={confirmBulkRemove}>
                  {removingAll
                    ? pick(peopleCopy.removeAllConfirm, locale)
                    : checkedCases.length === 1
                      ? pick(peopleCopy.removeFromCase, locale)
                      : pick(peopleCopy.removeFromThese, locale)}
                </AlertDialogAction>
              </AlertDialogFooter>
            </>
          ) : null}
        </ChromeAlertDialogContent>
      </AlertDialog>

      <AddPersonDialog
        open={addOpen}
        onOpenChange={(next) => {
          setAddOpen(next);
          if (!next) setAddFor(null);
        }}
        locale={locale}
        person={addFor}
      />
    </div>
  );
}
