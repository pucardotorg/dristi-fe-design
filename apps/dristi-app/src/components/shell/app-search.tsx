"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { FileCheckIcon, FileTextIcon } from "lucide-react";

import { toDisplayDate } from "@/lib/filing/format";
import { draftTitle } from "@/lib/filing/selectors";
import { getStep, stepHref } from "@/lib/filing/steps";
import { useMounted } from "@/lib/filing/store";
import type { FilingDraft } from "@/lib/filing/types";
import { useDrafts } from "@/lib/filing/use-drafts";
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Spinner } from "@/components/ui/spinner";
import { Identifier } from "@/components/chrome/identifier";
import { useCourtText } from "@/components/court/court-provider";

/**
 * The app's search, opened from the rail.
 *
 * It used to be a pill in the filings area's own top bar, which is the only place in the
 * product that had one — so search existed on four screens and nowhere else, and the rail
 * carried a Search row that said it was not built. The row is the search now: one
 * entry point, on the chrome every area shares, reachable from anywhere with ⌘K.
 *
 * What it searches has not changed: the drafts and filed cases this browser holds. It
 * looks in what is actually stored, so it can only find what was filed from here —
 * nothing is looked up in a registry.
 */

/** Everything a filing can be found by: the parties named in it and its case-file number. */
function haystack(draft: FilingDraft): string {
  const parties = [
    ...draft.complainants.flatMap((c) => [c.name, c.entName, c.rep.name, c.poaHolder.name]),
    ...draft.accused.map((a) => a.name),
  ];
  return [...parties, draft.sign.caseFileNumber ?? ""]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

/** A filed case opens at Preview; a draft opens where the person left it. */
function hrefFor(draft: FilingDraft): string {
  return draft.status === "filed"
    ? stepHref(draft.id, "preview")
    : stepHref(draft.id, draft.lastStep);
}

function Results({ onNavigate }: { onNavigate: () => void }) {
  const courtText = useCourtText();
  const router = useRouter();
  const { ready, drafts, filed } = useDrafts();
  const [query, setQuery] = React.useState("");

  const needle = query.trim().toLowerCase();
  const match = React.useCallback(
    (d: FilingDraft) => !needle || haystack(d).includes(needle),
    [needle]
  );
  const matchedDrafts = drafts.filter(match);
  const matchedFiled = filed.filter(match);
  const nothingStored = ready && drafts.length === 0 && filed.length === 0;

  function open(draft: FilingDraft) {
    onNavigate();
    router.push(hrefFor(draft));
  }

  return (
    /* Filtering is ours, not cmdk's: a filing is found by the parties in it and its
       case-file number — neither of which is the label on the row. */
    <Command shouldFilter={false} label="Search your filings">
      <CommandInput
        value={query}
        onValueChange={setQuery}
        placeholder="Search by party name or case number"
      />
      <CommandList>
        {!ready ? (
          <div
            role="status"
            aria-live="polite"
            className="flex items-center justify-center gap-2 py-6 text-body-compact text-muted-foreground"
          >
            <Spinner className="size-4" />
            Reading your filings…
          </div>
        ) : (
          <CommandEmpty className="text-body-compact text-muted-foreground">
            {nothingStored
              ? "You haven't started a filing in this browser yet."
              : "No matches"}
          </CommandEmpty>
        )}

        {matchedDrafts.length > 0 ? (
          <CommandGroup heading="Drafts">
            {matchedDrafts.map((d) => (
              <CommandItem key={d.id} value={d.id} onSelect={() => open(d)}>
                <FileTextIcon aria-hidden className="text-muted-foreground" />
                <span className="flex min-w-0 flex-col">
                  <span className="truncate text-body-compact font-medium text-foreground">
                    {draftTitle(d)}
                  </span>
                  <span className="truncate text-caption text-muted-foreground">
                    {courtText(getStep(d.lastStep).title)} · saved{" "}
                    <span className="tabular-nums">
                      {toDisplayDate(d.updatedAt.slice(0, 10))}
                    </span>
                  </span>
                </span>
              </CommandItem>
            ))}
          </CommandGroup>
        ) : null}

        {matchedFiled.length > 0 ? (
          <CommandGroup heading="Filed cases">
            {matchedFiled.map((d) => (
              <CommandItem key={d.id} value={d.id} onSelect={() => open(d)}>
                <FileCheckIcon aria-hidden className="text-muted-foreground" />
                <span className="flex min-w-0 flex-col">
                  <span className="truncate text-body-compact font-medium text-foreground">
                    {draftTitle(d)}
                  </span>
                  <span className="truncate text-caption text-muted-foreground">
                    {/* A command result is an option — no control nested inside it. */}
                    {d.sign.caseFileNumber ? (
                      <Identifier
                        value={d.sign.caseFileNumber}
                        label="case number"
                        copyable={false}
                      />
                    ) : (
                      "No case number"
                    )}
                    {d.filedAt ? (
                      <>
                        {" · filed "}
                        <span className="tabular-nums">
                          {toDisplayDate(d.filedAt.slice(0, 10))}
                        </span>
                      </>
                    ) : null}
                  </span>
                </span>
              </CommandItem>
            ))}
          </CommandGroup>
        ) : null}
      </CommandList>
    </Command>
  );
}

/** ⌘ on a Mac, Ctrl everywhere else — read after mount so the markup matches the server. */
function useShortcutLabel() {
  const mounted = useMounted();
  if (!mounted) return "⌘K";
  return navigator.userAgent.includes("Mac") ? "⌘K" : "Ctrl K";
}

type AppSearchValue = { open: () => void; shortcut: string };

const AppSearchContext = React.createContext<AppSearchValue | null>(null);

/** Opens the app's search. Available anywhere inside the shell. */
export function useAppSearch(): AppSearchValue {
  const ctx = React.useContext(AppSearchContext);
  if (!ctx) throw new Error("useAppSearch must be used inside <AppSearchProvider>");
  return ctx;
}

/** Holds the dialog and the ⌘K binding for the whole shell. */
export function AppSearchProvider({ children }: { children: React.ReactNode }) {
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

  const value = React.useMemo<AppSearchValue>(
    () => ({ open: () => setOpen(true), shortcut }),
    [shortcut]
  );

  return (
    <AppSearchContext.Provider value={value}>
      {children}
      <CommandDialog
        open={open}
        onOpenChange={setOpen}
        title="Search your filings"
        description="Find a draft or a filed case by party name or case number."
      >
        <Results onNavigate={() => setOpen(false)} />
      </CommandDialog>
    </AppSearchContext.Provider>
  );
}
