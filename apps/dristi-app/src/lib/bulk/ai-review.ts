/**
 * The AI switch for bulk filing: whether document reading may use a model for this court
 * (`aiMode` in `lib/court/profiles.ts`, or `?ai=on|off|unavailable` on the page), the same
 * switch the scrutiny workbench uses. It raises no scrutiny flags: bulk scrutiny runs only
 * the filing rules (`scrutiny.ts`).
 */

import type { AiMode } from "@/lib/court/profiles";

export type { AiMode };

/** Reads `?ai=` the way the scrutiny workbench does; anything else is the court default. */
export function aiModeFrom(raw: string | null | undefined, fallback: AiMode = "on"): AiMode {
  return raw === "on" || raw === "off" || raw === "unavailable" ? raw : fallback;
}
