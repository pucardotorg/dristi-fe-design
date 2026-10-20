"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

import {
  COURT_NAV_GROUPS,
  courtNavGroupsForCourt,
  seatHasNavRow,
  COURT_NAV_LINKS,
  COURT_NAV_TRAILING,
  type CourtNavItem,
} from "@/lib/employee/navigation";
import { useCourt } from "@/components/court/court-provider";
import { useCourtRole } from "@/components/employee/use-court-role";
import type { CourtRole } from "@/lib/employee/content";
import type { CourtId } from "@/lib/court/profiles";
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";

/**
 * The court side's search — a spotlight over the page, not a filter inside the rail.
 *
 * The owner's call (2026-09-23): *"it works like a global filter — we have something
 * similar in the advocate flow … it opened a modal in the center of the screen like
 * spotlight search."* That advocate one is `shell/app-search.tsx`, and this is
 * deliberately the same shape — `CommandDialog`, a printed shortcut, ⌘K from anywhere —
 * rather than a second idea about what search looks like in this product.
 *
 * It is **not** the same search. The advocate's reads `useDrafts()`: the filings made in
 * that browser, found by party name and case-file number. Nothing in that store belongs
 * to a court, so pointing the rail at it would find nothing. What this one searches is
 * every destination in the court side — the twenty rows the rail renders — which is what
 * the complaint was actually about: eighteen queues under four families that had to be
 * hunted for by remembering which drawer they lived in. Typing "delay" needs no taxonomy.
 *
 * **Cases are not in it yet, and the gap is deliberate.** Every court queue screen
 * already carries its own "Case name or number" field and `/employee/cases` is the whole
 * register, so a second case search here would be a third place to look — and the owner
 * described the advocate original as *"yet to be fully designed"*, which makes it a
 * pattern to match rather than a spec to copy. When cases do arrive they are a second
 * `CommandGroup` beside these, not a change of shape.
 *
 * The rows come from `navigation.ts`, never a second list: a queue added there is
 * searchable by that edit alone, and the search cannot drift from the rail.
 */

/** Everything the rail can reach, with the family that names it. */
type CourtSearchRow = {
  item: CourtNavItem;
  /** The family a queue sits in, or null for a row that stands on its own. */
  family: string | null;
};

function courtSearchRows(
  court: CourtId,
  seat: CourtRole,
): CourtSearchRow[] {
  return [
    ...COURT_NAV_LINKS.map((item) => ({ item, family: null })),
    ...courtNavGroupsForCourt(COURT_NAV_GROUPS, court).flatMap((group) =>
      group.items.map((item) => ({ item, family: group.label })),
    ),
    ...COURT_NAV_TRAILING.map((item) => ({ item, family: null })),
  ].filter((row) => seatHasNavRow(seat, row.item.id, court));
}

/**
 * What a row can be found by: its own label and its family's.
 *
 * The family is in the haystack because it is the one thing the taxonomy is genuinely
 * good for once you have stopped walking it — "sign" should return the seven signing
 * queues even though none of them is called Sign.
 */
function haystack(row: CourtSearchRow): string {
  return `${row.item.label} ${row.family ?? ""}`.toLowerCase();
}

function Results({ onNavigate }: { onNavigate: () => void }) {
  const router = useRouter();
  const [query, setQuery] = React.useState("");

  const needle = query.trim().toLowerCase();
  const { court } = useCourt();
  const seat = useCourtRole();
  const rows = courtSearchRows(court, seat).filter(
    (row) => row.item.href !== undefined && haystack(row).includes(needle),
  );

  function open(row: CourtSearchRow) {
    onNavigate();
    if (row.item.href) router.push(row.item.href);
  }

  return (
    /* Filtering is ours, not cmdk's: a queue is found by its family's name as well as its
       own, which is not the text on the row. */
    <Command shouldFilter={false} label="Search this court">
      <CommandInput
        value={query}
        onValueChange={setQuery}
        placeholder="Search queues and screens"
      />
      <CommandList>
        <CommandEmpty className="text-body-compact text-muted-foreground">
          Nothing here is called that.
        </CommandEmpty>
        {rows.length > 0 ? (
          <CommandGroup heading="Go to">
            {rows.map((row) => {
              const Icon = row.item.icon;
              return (
                <CommandItem
                  key={row.item.id}
                  value={row.item.id}
                  onSelect={() => open(row)}
                >
                  {Icon ? (
                    <Icon aria-hidden className="text-muted-foreground" />
                  ) : null}
                  <span className="min-w-0 flex-1 truncate text-body-compact font-medium text-foreground">
                    {row.item.label}
                  </span>
                  {/* The family, so a result says which part of the court it belongs to
                      without the reader having to know the rail by heart. */}
                  {row.family ? (
                    <span className="shrink-0 text-caption text-muted-foreground">
                      {row.family}
                    </span>
                  ) : null}
                  {/* How much is waiting, in the same tabular numeral the rail prints.
                      A zero says nothing worth a mark, so an empty queue shows none. */}
                  {row.item.count !== undefined && row.item.count > 0 ? (
                    <span className="w-8 shrink-0 text-right text-body-compact tabular-nums text-muted-foreground">
                      {row.item.count}
                    </span>
                  ) : null}
                </CommandItem>
              );
            })}
          </CommandGroup>
        ) : null}
      </CommandList>
    </Command>
  );
}

/**
 * ⌘ on a Mac, Ctrl everywhere else.
 *
 * The platform is only knowable in the browser, and the server has to render *something*
 * — so this is the same server-snapshot problem `nav-layout.ts` has, solved the same way.
 * `useSyncExternalStore` lets the server and the first client paint agree on "⌘K" and then
 * hand over, without a state write inside an effect: that pattern re-renders every mount
 * of every court screen for a string that cannot change afterwards, and the lint rule that
 * caught it (`react-hooks/set-state-in-effect`) is right to.
 *
 * `subscribe` returns a no-op teardown because the platform does not change under a live
 * page. React still requires the argument.
 */
const KEEP = () => () => {};

function readShortcut(): string {
  return navigator.userAgent.includes("Mac") ? "\u2318K" : "Ctrl K";
}

function serverShortcut(): string {
  return "\u2318K";
}

function useShortcutLabel() {
  return React.useSyncExternalStore(KEEP, readShortcut, serverShortcut);
}

type CourtSearchValue = { open: () => void; shortcut: string };

const CourtSearchContext = React.createContext<CourtSearchValue | null>(null);

/**
 * Opens the court side's search. Available anywhere inside the court area.
 *
 * It returns a no-op rather than throwing when no provider is mounted. The rail renders
 * on court routes that are composed in more than one place, and a search row that crashes
 * a screen is worse than one that does nothing on it.
 */
export function useCourtSearch(): CourtSearchValue {
  const ctx = React.useContext(CourtSearchContext);
  return ctx ?? { open: () => {}, shortcut: "⌘K" };
}

/** Holds the dialog and the ⌘K binding for the whole court area. */
export function CourtSearchProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [open, setOpen] = React.useState(false);
  const shortcut = useShortcutLabel();

  React.useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "k" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        setOpen((prev) => !prev);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const value = React.useMemo<CourtSearchValue>(
    () => ({ open: () => setOpen(true), shortcut }),
    [shortcut],
  );

  return (
    <CourtSearchContext.Provider value={value}>
      {children}
      <CommandDialog
        open={open}
        onOpenChange={setOpen}
        title="Search this court"
        description="Find a queue or a screen by name, or by the part of the court it belongs to."
      >
        <Results onNavigate={() => setOpen(false)} />
      </CommandDialog>
    </CourtSearchContext.Provider>
  );
}
