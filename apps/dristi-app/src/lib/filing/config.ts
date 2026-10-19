/**
 * Switches for the e-filing flow — what a deployment turns on, not what a filer chooses.
 */

/**
 * How a complaint is signed in this deployment:
 *
 * - `oath` — `oathRequired` (`OTH-2`, e-filing handover §18.2). Each complainant's oath is
 *   recorded on camera as part of their e-signature, or of their phone confirmation in
 *   upload mode, by whoever signs for them: the complainant, their PoA holder, or an
 *   Institution's authorised representative (`OTH-3`). Advocates and clerks never record
 *   one. The court fee waits on it. Off: signing alone, and nothing in the flow or at
 *   scrutiny mentions an oath. Which states turn it on is open (`Q-6`).
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
