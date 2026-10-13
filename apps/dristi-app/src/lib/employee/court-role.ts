/**
 * Which seat the court side is being worked from — the rail's settings control, as data.
 *
 * It is a view onto the sign-in session (`session.ts`) rather than a store of its own.
 * That is a change: the seat used to be an independent switch that reset on every
 * reload, which was the honest bargain while nobody signed in. Now `/employee/login`
 * establishes the seat and the settings control changes it, and two stores would have
 * meant the rail's foot and a cause-list row disagreeing about the same visit. One
 * store, two doors into it.
 *
 * **It is still not a permission.** The sign-in establishes who the area reports itself
 * as; it authenticates nobody and guards nothing, so this grants nothing. Every queue
 * and screen is reachable in every seat by URL; the rail offers fewer rows to some seats
 * (`SEAT_ROWS` in `navigation.ts`), which is a view rule, not a permission.
 *
 * Read it through `components/employee/use-court-role.ts`, never directly from a
 * render — the hook is what subscribes.
 */

import type { CourtRole } from "./content";
import {
  readCourtSession,
  serverCourtSession,
  setCourtSession,
  subscribeToCourtSession,
} from "./session";

export function subscribeToCourtRole(listener: () => void): () => void {
  return subscribeToCourtSession(listener);
}

/** The seat being worked in. A plain string, so identity comparison is free. */
export function readCourtRole(): CourtRole {
  return readCourtSession().role;
}

/** The seat the server rendered — what hydration must agree with. */
export function serverCourtRole(): CourtRole {
  return serverCourtSession().role;
}

/** Take a seat. Naming the one already taken is not a change and notifies nobody. */
export function setCourtRole(next: CourtRole): void {
  setCourtSession({ role: next });
}

/**
 * Whether this seat gets the bench's own three controls — Start hearing, End hearing,
 * and Pass over from the row overflow.
 *
 * **A view rule, not a permission.** Nothing here is enforced: it decides what the cause
 * list *offers*, on the plain ground that a control nobody in that seat would use is
 * clutter at best and a wrong claim at worst. A build that really authenticates decides
 * who may do what somewhere this file cannot see, and this must not be mistaken for that
 * decision.
 *
 * It does **not** mean the other seat is a spectator. The typist moves the same sitting;
 * it just moves it along one scripted line of work instead of from three controls — one
 * button to start, and the trip into the order is what finishes the matter
 * (`hearings-table.tsx`, `hearings-screen.tsx`). Both seats write the same marks to
 * `hearing-session.ts`, and neither writes a court record.
 */
export function seatHasBenchControls(role: CourtRole): boolean {
  return role !== "typist";
}
