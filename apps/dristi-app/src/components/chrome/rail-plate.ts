/**
 * The ground a navigation rail is painted on.
 *
 * A plate names its complete ink set outright — plate, foreground, muted, hover, seam,
 * selected card, badge — rather than borrowing the app's `dark` scope. That was settled
 * when the rail first got a dark ground: borrowing `dark` dressed the rail as another
 * mode and silently inverted every brand token it looked up. Literal values, each
 * annotated with the DS token it was taken from, are the only way a dark rail can sit
 * inside a light app and survive the app's own dark mode unchanged.
 *
 * The values are literals for that reason, not for convenience: a Tailwind utility
 * resolves one variable per mode, and a plate needs to pin both at once. `check:tokens`
 * reads colour *utilities* (`bg-[#...]`), so a plate's values are outside its remit —
 * which is why the advocate's `shell/rail-theme.tsx` has carried the same literals since
 * it shipped, with no ignore markers and a green gate.
 *
 * Readability is the gate for membership: every foreground/plate pair clears WCAG AA for
 * its role (text 4.5:1, muted text 4.5:1, non-text marks 3:1), and the measured ratio is
 * recorded beside each value. A plate that cannot pay for its inks does not ship.
 */
export type RailPlate = {
  id: string;
  label: string;
  /** Swatch for any picker that offers this plate. The frame itself never renders one. */
  swatch: string;
  /** True when the plate is dark enough to need the light-ink brand artwork. */
  darkPlate: boolean;
  /** Custom properties set on the rail surface. Consumed via `text-(--rail-muted)` etc. */
  vars: Record<string, string>;
};

/**
 * Inks that do not vary by plate: the selected row is always the light card, and the
 * person at the foot of the rail is always marked in the brand.
 *
 * Selection inverts rather than tinting, because an inversion is the one mark a rail can
 * make that no hover can imitate — which is what keeps "where am I" and "what is under
 * the pointer" from looking like the same thing.
 *
 * The identity disc is pinned here for the reason every other value in this module is:
 * `bg-primary` resolves to the app's teal, which is a *different* teal after dark, and a
 * rail that stays charcoal at night should not carry one mark in it that does not. The
 * disc belongs to the brand rather than to the plate, so it takes one value for all of
 * them.
 */
const CARD = {
  "--rail-card": "#ffffff", //                          brand-canvas-foreground
  "--rail-card-ink": "#1c1a18", //                      neutral-12 (light) — 17.4:1 on white
  "--rail-card-icon": "var(--court-brand-on-white, #007e7e)", //                     brand-solid — 4.9:1 on white (mark ≥3:1)
  "--rail-card-muted": "#6a6661", //                    neutral-11 (light) — 5.7:1 on white
  "--rail-badge": "#c1232a", //                         destructive (light) — white numeral 5.9:1
  "--rail-badge-ink": "#ffffff",
  /* The initials are what carries the meaning, and they are the pair that is measured:
     4.9:1 on the disc, in both modes, on every plate. The disc's own edge lands at 2.67:1
     against charcoal (4.9:1 against a white plate), and that is inside the rule rather
     than an exception carved out of it: `ACCESSIBILITY.md` §6 asks 3:1 of non-text
     "where required by WCAG", and WCAG 1.4.11 requires it only of the parts of a graphic
     needed to understand the content. The disc is not one of those parts — the initials
     on it are, and the name is spelled out beside it. (`AGENTS.md` rule 9 makes the same
     move for the neutral ramp, but its exemption is scoped to structural neutrals and
     does not stretch to a saturated brand mark.) */
  "--rail-avatar": "var(--court-brand-on-white, #007e7e)", //                        brand-solid — its initials 4.9:1
  "--rail-avatar-ink": "#ffffff",
};

const DARK_SEAM = "color-mix(in srgb, #ffffff 14%, transparent)";

/**
 * Charcoal — the plate the court side runs on, fixed.
 *
 * The bench does not choose a plate: a magistrate's rail is institutional chrome, and a
 * per-browser preference on it is a setting nobody asked for and everybody would have to
 * support. `/employee` therefore renders this constant directly and never reads a store.
 *
 * Its plate values are the `charcoal` entry the advocate's picker offers, unchanged, so
 * the two rails become the same object once that picker moves into this module. `CARD`
 * above has since grown the identity disc the court rail's footer needs; that is an
 * addition the advocate's copy has yet to make, not a divergence in the ground itself.
 */
export const CHARCOAL_PLATE: RailPlate = {
  id: "charcoal",
  label: "Charcoal",
  swatch: "#2e3135",
  darkPlate: true,
  vars: {
    ...CARD,
    "--sidebar": "#2e3135", //                          neutral-5 (dark ramp)
    "--sidebar-foreground": "#edeef0", //               neutral-12 (dark) — 11.3:1
    "--rail-muted": "#b0b4ba", //                       neutral-11 (dark) — 6.3:1
    "--sidebar-accent": "#43484e", //                   neutral-7 (dark)
    "--sidebar-accent-foreground": "#edeef0",
    "--rail-seam": DARK_SEAM,
    "--sidebar-border": DARK_SEAM,
    "--sidebar-ring": "#edeef0",
    // A light card on a dark plate already separates; a lift would only smudge it.
    "--rail-active-shadow": "none",
  },
};
