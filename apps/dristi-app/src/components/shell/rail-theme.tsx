"use client";

import * as React from "react";

import {
  useLocalStorageValue,
  writeLocalStorageValue,
} from "@/hooks/use-local-storage-value";

/**
 * EXPERIMENT — selectable grounds for the navigation rail.
 *
 * Six plates, every one an existing DS value (warm light ramp, dark ramp, brand ramp,
 * brand-canvas). Each theme names its complete ink set explicitly — plate, foreground,
 * muted, hover, seam — because the earlier approach of borrowing the `dark` scope broke
 * in both directions: it dressed the rail as another mode, and it silently inverted any
 * brand token the rail looked up (brand-12 becomes mint inside `.dark`). Literal values,
 * annotated with the token they come from, are the only way six plates can coexist and
 * survive the app's own dark mode unchanged.
 *
 * Readability is the gate for membership: every foreground/plate pair here clears
 * WCAG AA for its role (text 4.5:1, muted text 4.5:1, non-text marks 3:1). The measured
 * ratios are recorded per theme. A plate that cannot pay for its inks does not ship.
 *
 * The selector lives in the profile popover for now — a rough placement so the team can
 * flip through plates and give feedback; a real home in Settings comes later.
 */

export type RailTheme = {
  id: string;
  label: string;
  /** Swatch shown in the picker. */
  swatch: string;
  /** Dark-ink or light-ink brand glyph. */
  darkPlate: boolean;
  vars: Record<string, string>;
};

/** Inks that are the same on every plate: the selected row is always the white card. */
const CARD = {
  "--rail-card": "#ffffff", //                          brand-canvas-foreground
  "--rail-card-ink": "#1c1a18", //                      neutral-12 (light) — 17.4:1 on white
  "--rail-card-icon": "var(--court-brand-on-white, #007e7e)", //                     brand-solid — 4.9:1 on white (mark ≥3:1)
  "--rail-card-muted": "#6a6661", //                    neutral-11 (light) — 5.7:1 on white
  "--rail-badge": "#c1232a", //                         destructive (light) — white numeral 5.9:1
  "--rail-badge-ink": "#ffffff",
};

const LIGHT_SEAM = "color-mix(in srgb, #1c1a18 10%, transparent)"; //  border-hairline (light)
const DARK_SEAM = "color-mix(in srgb, #ffffff 14%, transparent)";

const LIFT = "0 1px 2px rgb(28 26 24 / 0.06), 0 2px 8px rgb(28 26 24 / 0.08)"; // shadow-raised

export const RAIL_THEMES: RailTheme[] = [
  {
    id: "soft-grey",
    label: "Soft grey",
    swatch: "#f9f8f6",
    darkPlate: false,
    vars: {
      ...CARD,
      "--sidebar": "#f9f8f6", //                        neutral-2 (warm)
      "--sidebar-foreground": "#1c1a18", //             neutral-12 — 16.9:1
      "--rail-muted": "#6a6661", //                     neutral-11 — 5.5:1
      "--sidebar-accent": "#f3f0ec", //                 neutral-3
      "--sidebar-accent-foreground": "#1c1a18",
      "--rail-seam": LIGHT_SEAM,
      "--sidebar-border": LIGHT_SEAM,
      "--sidebar-ring": "var(--court-brand-on-white, #007e7e)",
      // a white card on a near-white plate needs the shadow to exist at all
      "--rail-active-shadow": LIFT,
    },
  },
  {
    id: "warm-beige",
    label: "Warm beige",
    swatch: "#ebe8e3",
    darkPlate: false,
    vars: {
      ...CARD,
      "--sidebar": "#ebe8e3", //                        neutral-4 (warm)
      "--sidebar-foreground": "#1c1a18", //             15.1:1
      "--rail-muted": "#6a6661", //                     4.9:1
      "--sidebar-accent": "#e2dcd5", //                 neutral-6 (warm)
      "--sidebar-accent-foreground": "#1c1a18",
      "--rail-seam": LIGHT_SEAM,
      "--sidebar-border": LIGHT_SEAM,
      "--sidebar-ring": "var(--court-brand-on-white, #007e7e)",
      "--rail-active-shadow": LIFT,
    },
  },
  {
    id: "charcoal",
    label: "Charcoal",
    swatch: "#2e3135",
    darkPlate: true,
    vars: {
      ...CARD,
      "--sidebar": "#2e3135", //                        neutral-5 (dark ramp)
      "--sidebar-foreground": "#edeef0", //             neutral-12 (dark) — 13.4:1
      "--rail-muted": "#b0b4ba", //                     neutral-11 (dark) — 6.3:1
      "--sidebar-accent": "#43484e", //                 neutral-7 (dark)
      "--sidebar-accent-foreground": "#edeef0",
      "--rail-seam": DARK_SEAM,
      "--sidebar-border": DARK_SEAM,
      "--sidebar-ring": "#edeef0",
      "--rail-active-shadow": "none",
    },
  },
  {
    id: "charcoal-lifted",
    label: "Charcoal, lifted",
    swatch: "#363a3f",
    darkPlate: true,
    vars: {
      ...CARD,
      "--sidebar": "#363a3f", //                        neutral-6 (dark ramp), L* 23
      "--sidebar-foreground": "#edeef0", //             11.9:1
      "--rail-muted": "#b0b4ba", //                     5.6:1
      "--sidebar-accent": "#43484e", //                 neutral-7 (dark)
      "--sidebar-accent-foreground": "#edeef0",
      "--rail-seam": DARK_SEAM,
      "--sidebar-border": DARK_SEAM,
      "--sidebar-ring": "#edeef0",
      "--rail-active-shadow": "none",
    },
  },
  {
    id: "deep-teal",
    label: "Deep teal",
    swatch: "#0f544c",
    darkPlate: true,
    vars: {
      ...CARD,
      "--sidebar": "#0f544c", //                        brand-canvas
      "--sidebar-foreground": "#ffffff", //             brand-canvas-foreground — 8.4:1
      "--rail-muted": "#a7d9d0", //                     brand-canvas-muted-foreground — 5.5:1
      "--sidebar-accent": "#0d3d38", //                 brand-12 (one step deeper)
      "--sidebar-accent-foreground": "#ffffff",
      "--rail-seam": DARK_SEAM,
      "--sidebar-border": DARK_SEAM,
      "--sidebar-ring": "#ffffff",
      "--rail-active-shadow": "none",
    },
  },
  {
    id: "deep-teal-bright",
    label: "Deep teal II — brighter ink",
    swatch: "#0f544c",
    darkPlate: true,
    // The owner's read on Deep teal: right plate, ink a touch subdued. Same plate,
    // secondary ink stepped up the brand ramp — brand-4 instead of the canvas muted —
    // so the idle menu sits closer to the primary white without becoming it, and the
    // rows keep one visible step between idle and hover.
    vars: {
      ...CARD,
      "--sidebar": "#0f544c", //                        brand-canvas
      "--sidebar-foreground": "#ffffff", //             brand-canvas-foreground — 8.4:1
      "--rail-muted": "#ccf3ea", //                     brand-4 — 7.2:1, one step brighter
      "--sidebar-accent": "#0d3d38", //                 brand-12
      "--sidebar-accent-foreground": "#ffffff",
      "--rail-seam": DARK_SEAM,
      "--sidebar-border": DARK_SEAM,
      "--sidebar-ring": "#ffffff",
      "--rail-active-shadow": "none",
    },
  },
  {
    id: "deep-teal-quiet",
    label: "Deep teal III — quieter",
    swatch: "#114741",
    darkPlate: true,
    // Owner-requested nudge on the canvas plate: a step darker and a touch desaturated
    // (#0f544c → #114741, saturation ~70% → ~61%). NOT a DS token yet — the one
    // deliberate exception in this file, held as a candidate: if it wins the experiment
    // it goes to the DS as a value, it does not stay a local hex.
    vars: {
      ...CARD,
      "--sidebar": "#114741",
      "--sidebar-foreground": "#ffffff", //             10.5:1
      "--rail-muted": "#a7d9d0", //                     brand-canvas-muted-foreground — 6.8:1
      "--sidebar-accent": "#0d3d38", //                 brand-12
      "--sidebar-accent-foreground": "#ffffff",
      "--rail-seam": DARK_SEAM,
      "--sidebar-border": DARK_SEAM,
      "--sidebar-ring": "#ffffff",
      "--rail-active-shadow": "none",
    },
  },
  {
    id: "night-teal",
    label: "Night teal",
    swatch: "#0d3d38",
    darkPlate: true,
    vars: {
      ...CARD,
      "--sidebar": "#0d3d38", //                        brand-12 — charcoal you sense as green
      "--sidebar-foreground": "#ffffff", //             10.4:1
      "--rail-muted": "#a7d9d0", //                     6.9:1
      "--sidebar-accent": "#0f544c", //                 brand-canvas (one step up)
      "--sidebar-accent-foreground": "#ffffff",
      "--rail-seam": DARK_SEAM,
      "--sidebar-border": DARK_SEAM,
      "--sidebar-ring": "#ffffff",
      "--rail-active-shadow": "none",
    },
  },
];

const DEFAULT_ID = "charcoal";
const STORAGE_KEY = "dristi.rail-theme";

type RailThemeValue = {
  theme: RailTheme;
  setThemeId: (id: string) => void;
};

const RailThemeContext = React.createContext<RailThemeValue | null>(null);

export function RailThemeProvider({ children }: { children: React.ReactNode }) {
  // Server render and hydration agree on the default (the store's server snapshot
  // is null); the stored choice takes over right after, with no effect and no
  // second setState pass. In private mode the hook keeps the choice in memory —
  // it applies, it just does not persist.
  const stored = useLocalStorageValue(STORAGE_KEY);
  const id =
    stored && RAIL_THEMES.some((t) => t.id === stored) ? stored : DEFAULT_ID;

  const setThemeId = React.useCallback((next: string) => {
    if (!RAIL_THEMES.some((t) => t.id === next)) return;
    writeLocalStorageValue(STORAGE_KEY, next);
  }, []);

  const theme = RAIL_THEMES.find((t) => t.id === id) ?? RAIL_THEMES[2];
  const value = React.useMemo(
    () => ({ theme, setThemeId }),
    [theme, setThemeId],
  );

  return (
    <RailThemeContext.Provider value={value}>
      {children}
    </RailThemeContext.Provider>
  );
}

export function useRailTheme(): RailThemeValue {
  const value = React.useContext(RailThemeContext);
  if (!value)
    throw new Error("useRailTheme must be used inside RailThemeProvider");
  return value;
}
