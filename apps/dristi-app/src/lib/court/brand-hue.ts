/**
 * EXPERIMENT — the brand colour a state runs in, where the DS teal is not its own.
 *
 * Gujarat only, for now (owner, 2026-10-09): its stakeholders asked for a navy, and the
 * owner wants to flip between a few to choose. The palettes themselves live in
 * `app/court-palette.css`; this names them for the court switch and the root layout.
 * Kerala, Punjab and Haryana never carry a hue and render the DS teal unchanged.
 */

import type { CourtId } from "./profiles";

export type BrandHue = "navy" | "royal" | "ink" | "teal";

export const BRAND_HUES: { id: BrandHue; label: string; swatch: string }[] = [
  { id: "navy", label: "Navy", swatch: "#1f3a68" },
  { id: "royal", label: "Royal blue", swatch: "#23449a" },
  { id: "ink", label: "Ink blue", swatch: "#182c4f" },
  { id: "teal", label: "Teal (DS default)", swatch: "#007e7e" },
];

export const BRAND_HUE_COOKIE = "dristi-brand-hue";

/** The courts that may run in a hue of their own, and the one each starts in. */
const DEFAULT_HUE: Partial<Record<CourtId, BrandHue>> = { gujarat: "navy" };

export function isBrandHue(value: unknown): value is BrandHue {
  return BRAND_HUES.some((h) => h.id === value);
}

export function courtHasHue(court: CourtId): boolean {
  return court in DEFAULT_HUE;
}

/** The hue to paint `court` in, or `null` for the DS teal untouched. */
export function resolveBrandHue(court: CourtId, stored: unknown): BrandHue | null {
  const fallback = DEFAULT_HUE[court];
  if (!fallback) return null;
  return isBrandHue(stored) ? stored : fallback;
}
