"use client";

import * as React from "react";
import {
  ChevronRightIcon,
  PlusIcon,
  SearchIcon,
  UsersIcon,
} from "lucide-react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { initials } from "@/components/access/access-list";
import { useAccess } from "@/components/access/access-state";
import { PersonAccessDialog } from "@/components/access/person-access-dialog";
import { pick, type Locale } from "@/lib/onboarding/content";
import { fillCopy, peopleCopy, type AccessPerson } from "@/lib/access/content";
import {
  PAGE_GROUND,
  PAGE_GUTTER,
  PAGE_SUBTITLE,
  PAGE_TITLE,
} from "@/components/shell/page-frame";
import { PANEL_CLASS } from "@/components/shell/panel";
import { cn } from "@/lib/utils";

/**
 * The People page — the advocate's office (office management handover, §2–§4).
 *
 * A FLAT list of the people this advocate has given office access to (name,
 * number, designation, case count) — never co-advocates on a vakalatnama
 * (OFC-11). Add person opens the add flow. Opening a person opens a near
 * full-screen dialog over this list, where every case sits in one table,
 * ticked where they have access (PM, Oct 23: one way to give and remove
 * access). Closing it puts you back on the list.
 */

type PeopleSort = "name-asc" | "name-desc" | "cases-desc" | "cases-asc";

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
function personDesignation(
  person: AccessPerson,
  locale: Locale,
): string | null {
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

export function PeoplePage({ locale }: { locale: Locale }) {
  const { office } = useAccess();
  /* The person open in the access dialog. `opening` counts each opening so the
     dialog mounts fresh every time; the id stays through the exit. */
  const [personOpen, setPersonOpen] = React.useState(false);
  const [opened, setOpened] = React.useState<{
    id: string;
    opening: number;
  } | null>(null);
  const [query, setQuery] = React.useState("");
  const [peopleSort, setPeopleSort] = React.useState<PeopleSort>("name-asc");
  /* Add person (OFC-14). Giving a person more cases lives on their own page now. */
  const [addOpen, setAddOpen] = React.useState(false);
  /* Counts each opening so Add person always starts empty. */
  const [addOpening, setAddOpening] = React.useState(0);

  // The office: people this advocate gave access to, or set for future cases (OFC-11).
  const active = office;
  const q = query.trim().toLowerCase();
  const searched = q
    ? active.filter(
        (person) =>
          person.name.toLowerCase().includes(q) ||
          person.phone.replace(/\D/g, "").includes(q),
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

  return (
    <div className="relative flex min-h-0 w-full flex-1 items-stretch">
      {/* ------------------------------------------------------ list column */}
      <main
        className={cn(
          "flex min-h-0 min-w-0 flex-1 flex-col gap-6",
          PAGE_GROUND,
          PAGE_GUTTER,
        )}
      >
        <header className="flex flex-col gap-4 sm:flex-row sm:items-start">
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <h1 className={cn(PAGE_TITLE, "text-balance")}>
              {pick(peopleCopy.title, locale)}
            </h1>
            <p className={PAGE_SUBTITLE}>{pick(peopleCopy.subtitle, locale)}</p>
          </div>
          <Button
            type="button"
            className="self-start"
            onClick={() => {
              setAddOpening((n) => n + 1);
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
                <Label htmlFor="people-search">
                  {pick(peopleCopy.searchLabel, locale)}
                </Label>
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
                <Label htmlFor="people-sort">
                  {pick(peopleCopy.sortLabel, locale)}
                </Label>
                <Select
                  value={peopleSort}
                  onValueChange={(value) => setPeopleSort(value as PeopleSort)}
                >
                  <SelectTrigger id="people-sort" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="name-asc">
                      {pick(peopleCopy.sortNameAsc, locale)}
                    </SelectItem>
                    <SelectItem value="name-desc">
                      {pick(peopleCopy.sortNameDesc, locale)}
                    </SelectItem>
                    <SelectItem value="cases-desc">
                      {pick(peopleCopy.sortCasesDesc, locale)}
                    </SelectItem>
                    <SelectItem value="cases-asc">
                      {pick(peopleCopy.sortCasesAsc, locale)}
                    </SelectItem>
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
                <div className="min-h-0 flex-1">
                  {/* Touch: one column of cards at every width, tablets included (owner,
                    Sept 21). Mouse from `sm`: the table's ruled rows. */}
                  <div className="flex flex-col gap-3 sm:pointer-fine:gap-0 sm:pointer-fine:divide-y sm:pointer-fine:divide-hairline">
                    {matches.map((person) => (
                      <PersonListRow
                        key={person.id}
                        person={person}
                        locale={locale}
                        active={personOpen && opened?.id === person.id}
                        onOpen={() => {
                          setOpened((current) => ({
                            id: person.id,
                            opening: (current?.opening ?? 0) + 1,
                          }));
                          setPersonOpen(true);
                        }}
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
            <p className="text-body-compact font-semibold">
              {pick(peopleCopy.emptyTitle, locale)}
            </p>
            <p className="max-w-sm text-caption text-pretty text-muted-foreground">
              {pick(peopleCopy.emptyBody, locale)}
            </p>
            <Button
              type="button"
              className="mt-1"
              onClick={() => {
                setAddOpening((n) => n + 1);
                setAddOpen(true);
              }}
            >
              <PlusIcon aria-hidden />
              {pick(peopleCopy.addPerson, locale)}
            </Button>
          </div>
        )}
      </main>

      {/* Add person is the person dialog with "People" on top (owner, Oct 23). */}
      <PersonAccessDialog
        key={`add-${addOpening}`}
        personId={null}
        adding
        open={addOpen}
        onOpenChange={setAddOpen}
        locale={locale}
      />

      <PersonAccessDialog
        key={opened ? `${opened.id}-${opened.opening}` : "none"}
        personId={opened?.id ?? null}
        open={personOpen}
        onOpenChange={setPersonOpen}
        locale={locale}
      />
    </div>
  );
}
