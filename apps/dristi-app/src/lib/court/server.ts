/**
 * The selected court, read on the server — for what a server component renders itself:
 * tab titles and the odd string handed to a client component ready-made.
 *
 * Server-only (`next/headers`); client code reads the same choice through
 * `components/court/court-provider.tsx`.
 */

import { cookies } from "next/headers";

import { BRAND_HUE_COOKIE, resolveBrandHue, type BrandHue } from "./brand-hue";
import { localizeCourtText } from "./localize";
import { COURT_COOKIE, DEFAULT_COURT, isCourtId, type CourtId } from "./profiles";

export async function serverCourt(): Promise<CourtId> {
  const stored = (await cookies()).get(COURT_COOKIE)?.value;
  return isCourtId(stored) ? stored : DEFAULT_COURT;
}

/** `localizeCourtText` for the court the request was made in. */
export async function serverCourtText(): Promise<(text: string) => string> {
  const court = await serverCourt();
  return (text) => localizeCourtText(text, court);
}

/** The brand colour `court` is painted in, or `null` for the DS teal (`brand-hue.ts`). */
export async function serverBrandHue(court: CourtId): Promise<BrandHue | null> {
  return resolveBrandHue(court, (await cookies()).get(BRAND_HUE_COOKIE)?.value);
}
