"use client";

import * as React from "react";

/** Height of the top bar — the rails hang below it and read the same number. */
export const TOP_BAR_HEIGHT = "3.5rem";

/** Cookie the sections rail's collapsed state is remembered in (read by the layout). */
export const SECTIONS_COOKIE = "filing_sections_state";
export const SECTIONS_COOKIE_MAX_AGE = 60 * 60 * 24 * 7;

export type FilingChromeValue = {
  /** Expanded/collapsed state of the sections rail on a desktop viewport. */
  sectionsOpen: boolean;
  setSectionsOpen: (open: boolean) => void;
  /** The sections rail as a sheet, below `lg`. */
  sectionsSheetOpen: boolean;
  setSectionsSheetOpen: (open: boolean) => void;
  /** Title of the draft currently loaded, for the breadcrumb. `null` outside a draft. */
  draftLabel: string | null;
  setDraftLabel: (label: string | null) => void;
  /** The bulk batch on screen, for the breadcrumb: its number, and where it opens. */
  batchCrumb: { number: string; id: string } | null;
  setBatchCrumb: (crumb: { number: string; id: string } | null) => void;
};

export const FilingChromeContext =
  React.createContext<FilingChromeValue | null>(null);

/**
 * The filing area's own chrome state — the sections rail and the draft's breadcrumb
 * title. It used to live inside a filings-only app shell; folding the *main* nav is the
 * shared shell's job now (`useChrome().foldNav`), so what is left here is exactly the
 * state no other area has, provided by the filings layout around the one `AppShell`.
 */
export function FilingChromeProvider({
  children,
  sectionsDefaultOpen = true,
}: {
  children: React.ReactNode;
  /** Read from the cookie on the server so the rail does not flip after hydration. */
  sectionsDefaultOpen?: boolean;
}) {
  const [sectionsOpen, setSectionsOpenState] =
    React.useState(sectionsDefaultOpen);
  const [sectionsSheetOpen, setSectionsSheetOpen] = React.useState(false);
  const setSectionsOpen = React.useCallback((open: boolean) => {
    setSectionsOpenState(open);
    document.cookie = `${SECTIONS_COOKIE}=${open}; path=/; max-age=${SECTIONS_COOKIE_MAX_AGE}`;
  }, []);

  const [draftLabel, setDraftLabel] = React.useState<string | null>(null);
  const [batchCrumb, setBatchCrumb] = React.useState<{ number: string; id: string } | null>(null);

  const value = React.useMemo<FilingChromeValue>(
    () => ({
      sectionsOpen,
      setSectionsOpen,
      sectionsSheetOpen,
      setSectionsSheetOpen,
      draftLabel,
      setDraftLabel,
      batchCrumb,
      setBatchCrumb,
    }),
    [sectionsOpen, setSectionsOpen, sectionsSheetOpen, draftLabel, batchCrumb],
  );

  return (
    <FilingChromeContext.Provider value={value}>
      {children}
    </FilingChromeContext.Provider>
  );
}

/**
 * State the filing chrome shares across rails: which rails are open, and what the
 * breadcrumb should call the draft. It lives above the routes so a rail keeps its width
 * while the person walks from one step to the next.
 */
export function useFilingChrome(): FilingChromeValue {
  const ctx = React.useContext(FilingChromeContext);
  if (!ctx)
    throw new Error("useFilingChrome must be used inside <FilingsAppShell>");
  return ctx;
}

/**
 * Publishes the loaded draft's title to the top bar's breadcrumb. Rendered inside the
 * draft store — the top bar sits above it, so it cannot read the store itself.
 */
export function DraftBreadcrumbLabel({ label }: { label: string }) {
  const { setDraftLabel } = useFilingChrome();

  React.useEffect(() => {
    setDraftLabel(label);
    return () => setDraftLabel(null);
  }, [label, setDraftLabel]);

  return null;
}

/**
 * Publishes the bulk batch on screen to the breadcrumb, so "which batch" is answered in
 * the bar on every screen of it (v8: "Bulk filing › BLK-2026-0003 › Nirali R. Modi").
 */
export function BatchBreadcrumbLabel({ number, id }: { number: string; id: string }) {
  const { setBatchCrumb } = useFilingChrome();

  React.useEffect(() => {
    setBatchCrumb({ number, id });
    return () => setBatchCrumb(null);
  }, [number, id, setBatchCrumb]);

  return null;
}
