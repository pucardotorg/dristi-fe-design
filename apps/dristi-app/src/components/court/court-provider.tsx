"use client";

import * as React from "react";

import {
  COURT_COOKIE,
  courtProfile,
  DEFAULT_COURT,
  type CourtId,
  type CourtProfile,
} from "@/lib/court/profiles";
import {
  localizeCaseNumber,
  localizeCourtText,
  localizeDeep,
} from "@/lib/court/localize";

import { setSigningRules } from "@/lib/filing/config";

import { CourtTextLayer } from "./court-text-layer";

/**
 * The state's court the whole app runs as — one choice for both halves.
 *
 * Context rather than a per-area store: the advocate's Settings and the court's settings
 * menu are two doors into the same choice, and a case number must read the same on
 * either side of the product. The choice is kept in a cookie, not `localStorage`, so the
 * root layout can hand the server the right court and the first paint is already in that
 * state's terms — a Gujarat demo never flashes Kerala numbers while it hydrates.
 */
type CourtValue = {
  court: CourtId;
  profile: CourtProfile;
  setCourt: (court: CourtId) => void;
};

const CourtContext = React.createContext<CourtValue | null>(null);

const ONE_YEAR = 60 * 60 * 24 * 365;

export function CourtProvider({
  children,
  initialCourt = DEFAULT_COURT,
}: {
  children: React.ReactNode;
  initialCourt?: CourtId;
}) {
  const [court, setCourtState] = React.useState<CourtId>(initialCourt);
  // The state's signing rules, read by the filing selectors. Set in render, before any
  // child reads them; a change of court reloads the page, so this never goes stale.
  setSigningRules(courtProfile(court).signing);

  const value = React.useMemo<CourtValue>(
    () => ({
      court,
      profile: courtProfile(court),
      setCourt: (next) => {
        if (next === court) return;
        setCourtState(next);
        document.cookie = `${COURT_COOKIE}=${next}; path=/; max-age=${ONE_YEAR}; samesite=lax`;
        // A full reload, not a refresh: the text layer only ever re-voices towards the
        // selected state (`CourtTextLayer`), so the page is drawn again from the start
        // in the new court's terms — server render, first paint and all.
        window.location.reload();
      },
    }),
    [court]
  );

  return (
    <CourtContext.Provider value={value}>
      {children}
      <CourtTextLayer />
    </CourtContext.Provider>
  );
}

/**
 * The selected court. Outside the provider — a test render, a portal mounted before the
 * root — it answers Kerala, the designed baseline, rather than throwing: a leaf as common
 * as `Identifier` must not depend on where it landed.
 */
export function useCourt(): CourtValue {
  const value = React.useContext(CourtContext);
  if (value) return value;
  return {
    court: DEFAULT_COURT,
    profile: courtProfile(DEFAULT_COURT),
    setCourt: () => {},
  };
}

/** Re-voices Kerala text for the selected court (`localizeCourtText`). */
export function useCourtText(): (text: string) => string {
  const { court } = useCourt();
  return (text) => localizeCourtText(text, court);
}

/** Re-numbers a Kerala case number, CNR or filing number for the selected court. */
export function useCaseNumber(): (value: string) => string {
  const { court } = useCourt();
  return (value) => localizeCaseNumber(value, court);
}

/**
 * A whole record — a court document, a case row — re-voiced for the selected court, so
 * its heading, numbers and body agree (`localizeDeep`). Kerala returns it untouched.
 */
export function useCourtLocalized<T>(value: T): T {
  const { court } = useCourt();
  return localizeDeep(value, court);
}
