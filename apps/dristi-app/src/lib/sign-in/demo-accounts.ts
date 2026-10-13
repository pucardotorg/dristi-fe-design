/**
 * Prototype stand-in for the credentials endpoint. Delete this file when the real one
 * lands — nothing else imports it.
 *
 * Its only job is to make the role-mismatch path reviewable: a number registered under
 * one role, entered on the other role's tab, is the single dead end this screen can
 * create, and it cannot be judged from a description.
 *
 * Any number not listed here represents the unregistered-account state. Use the two
 * fixtures below to review successful and role-mismatch paths.
 */

import type { Role } from "@/lib/sign-in/content";

/**
 * Two distinct demo logins (F5):
 *   7007663437 — a base litigant (Rajan K. Nair). Can elevate to an advocate profile
 *                from Settings, staying on this number.
 *   9000000001 — a blank litigant with nothing on the account, for trying signing links.
 *   8009460966 — an advocate (Adv. Anjali Nair) who also holds a litigant profile, so
 *                the rail-foot switch flips advocate ⇄ litigant on the one account.
 * NOTE (session-limited): with no auth session yet, `/home` renders one litigant identity
 * (the summoned litigant). So an advocate who switches to their litigant profile lands on
 * that home rather than a per-account litigant self — that split needs a real session.
 */
export const DEMO_ACCOUNTS: Record<string, Role> = {
  "7007663437": "litigant",
  "8009460966": "advocate",
  // A blank litigant — no cases, no profile details — so a signing link can be tried
  // by signing in rather than registering every time (owner, 2026-10-09).
  "9000000001": "litigant",
};

/** The role this number is registered under, or `undefined` if it is not in the list. */
export function registeredRole(mobile: string): Role | undefined {
  return DEMO_ACCOUNTS[mobile];
}
