/**
 * Switches for the e-filing flow — what a deployment turns on, not what a filer chooses.
 */

/**
 * How a complaint is signed in this deployment (owner, 2026-10-11 — Gujarat only, for now):
 *
 * - `oath` — everyone who signs (complainants and advocates) also records the oath on
 *   video, read in their own name; the court fee waits on it. Off: signing alone, and
 *   nothing in the flow mentions an oath.
 * - `everyAdvocate` — every advocate on record signs, and swears, as themselves, each
 *   with their own link. Off: one advocate signature per complainant, which any one of
 *   that complainant's advocates may give.
 *
 * Set from the selected court's profile (`lib/court/profiles.ts`) by `CourtProvider`,
 * so the pure selectors and every screen read one answer. Defaults to Kerala's.
 */
export type SigningRules = { oath: boolean; everyAdvocate: boolean };

let active: SigningRules = { oath: false, everyAdvocate: false };

export function setSigningRules(rules: SigningRules): void {
  active = rules;
}

export function signingRules(): SigningRules {
  return active;
}
