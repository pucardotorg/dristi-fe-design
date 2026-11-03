/**
 * Party-related actions — the shared shapes behind the Parties tab's
 * "Add people" entry (spec: Replacement/people-and-case-access.md).
 *
 * One universal entry adds everyone (PM decision, Sept 1): what differs per
 * kind of person is the *nature* of the act, and the flows say so —
 *
 * - **Advocate** — a system action. No approval: the vakalatnama the parties
 *   sign IS the authority, so the advocate is on the case the moment it is on
 *   record (scenario 1).
 * - **Witness** — an application; the magistrate orders the addition
 *   (scenario 9). The existing witness flow already carries this.
 * - **PoA-holder** — an application; order required (scenarios 5–8).
 *
 * This module is deliberately client-safe: the dialogs are client components,
 * and importing from `parties.ts` would drag the whole authored fixture pack
 * into the browser bundle. So the party options come in as serialisable props
 * built by the server, and the one label map the dialogs need is restated
 * here rather than imported past the pack.
 */

/** A litigant as the add/PoA dialogs need it — built server-side. */
export type PartyOption = {
  id: string;
  name: string;
  side: "complainant" | "accused";
  /** Set when the party already has a PoA-holder on record (at most one). */
  poaHolder?: string;
};

/** Restates `PARTY_ROLE_LABEL` from parties.ts — see the module note. */
export const PARTY_SIDE_LABEL: Record<PartyOption["side"], string> = {
  complainant: "Complainant",
  accused: "Accused",
};

/**
 * The DRISTI advocate registry, keyed by mobile number — the add-advocate
 * lookup resolves against this the moment the tenth digit lands, the same
 * gesture as the share dialog's staff lookup.
 *
 * An unknown number is not a wall: the advocate is invited and registers
 * when they join (user's call, Sept 1 — the vakalatnama carries the
 * identity, so the registry need not). The lookup's job is only to save
 * typing and show the Bar ID when the person IS registered. Thomas and
 * Rajesh share their numbers with `REGISTERED_USERS` in lib/access/content.ts
 * so the two demo worlds agree about who is who.
 */
export const ADVOCATE_LOOKUP: Record<string, { name: string; barId: string }> = {
  "9847012345": { name: "Adv. Thomas K. George", barId: "K/1021/2011" },
  "9847098765": { name: "Adv. Rajesh Kurup", barId: "K/2214/2015" },
  "9446301188": { name: "Adv. Meera Suresh", barId: "K/0873/2009" },
};

export const ADVOCATE_DEMO_NUMBERS =
  "Try registered advocates: 98470 12345, 98470 98765 or 94463 01188";

/** "98470 12345" — the same 5-5 grouping the access surfaces use. */
export function formatAdvocatePhone(digits: string): string {
  return digits.length === 10 ? `${digits.slice(0, 5)} ${digits.slice(5)}` : digits;
}

export const POA_REASON_MAX_LENGTH = 500;
