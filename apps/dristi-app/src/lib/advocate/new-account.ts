/**
 * A new advocate account — just registered, nothing listed yet (owner, 2026-10-14).
 *
 * Its home is the empty shell (`AdvocateShellHome`), the advocate's version of the
 * litigant's: a welcome, Your cases (empty until they join or file), and the two ways
 * in — Join a case and File a case. Sandbox: kept in this browser's storage, set at
 * sign-in by the demo number for a new advocate (`demo-accounts.ts`). A live deployment
 * reads it from the account.
 */

export const NEW_ADVOCATE_SHELL_KEY = "dristi:new-advocate-shell";

/** The demo name the new advocate account carries. */
export const NEW_ADVOCATE_NAME = "Arjun Menon";

export function setNewAdvocateShell(on: boolean): void {
  try {
    if (on) window.localStorage.setItem(NEW_ADVOCATE_SHELL_KEY, "1");
    else window.localStorage.removeItem(NEW_ADVOCATE_SHELL_KEY);
  } catch {
    /* blocked storage: the full home shows */
  }
}
