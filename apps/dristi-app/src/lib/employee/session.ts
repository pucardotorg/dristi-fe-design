/**
 * Who the court side is running as — the one thing `/employee/login` decides.
 *
 * **Session-lite, not authentication.** Nothing here checks a credential or guards a
 * route: a person who types a court URL still reaches it, exactly as they did before the
 * sign-in existed. What the sign-in establishes is the *identity the chrome reports* —
 * the name at the foot of the rail, the seat it names, and the bench and district that
 * every order and form the sign queues produce is headed with. That is a real thing for
 * a screen to know and it had nowhere to live.
 *
 * It replaces the fixed `CURRENT_STAFF` as the thing screens read, and it subsumes the
 * old seat store: `court-role.ts` is now a view onto this one, so the rail's settings
 * control and the sign-in cannot disagree about the same visit.
 *
 * **It survives a reload**, which the seat store deliberately did not. That bargain was
 * right while the seat was a switch inside one visit; it is wrong for a sign-in, because
 * refreshing a court screen and finding yourself signed in as somebody else is not a
 * demo of anything. It lives in `localStorage`, so it is per-browser and per-device and
 * carries no authority whatsoever.
 *
 * Read it through `components/employee/use-court-session.ts`, never directly from a
 * render — the hook is what subscribes, and what keeps the server's first paint and the
 * browser's hydration agreeing on the default before the stored session replaces it.
 */

import { CURRENT_STAFF, type CourtRole } from "./content";

/** Namespaced like the citizen side's demo keys, and as disposable. */
export const COURT_SESSION_KEY = "dristi-demo-court-session";

export type CourtSession = {
  /** The account signed in with. Empty when nobody has been through the sign-in. */
  username: string;
  name: string;
  role: CourtRole;
  district: string;
  /** The bench, spelled the way the rail's foot and a court document print it. */
  court: string;
};

/**
 * Where the area stands with nobody signed in: the fixture it has always run as.
 *
 * This is also the snapshot the server renders and the browser hydrates against, so it
 * must never be read from storage — see the hook.
 */
export const DEFAULT_COURT_SESSION: CourtSession = {
  username: "",
  name: CURRENT_STAFF.name,
  role: CURRENT_STAFF.role,
  district: "Sample District",
  court: CURRENT_STAFF.court,
};

let session: CourtSession = DEFAULT_COURT_SESSION;
let restored = false;
const listeners = new Set<() => void>();

/**
 * Bring the stored session in, once, on the client.
 *
 * Lazy rather than at module load because this module is imported by the server render
 * too, and because `readCourtSession` is the only thing that can be sure it is being
 * asked on the browser's side of the line.
 */
function restore(): void {
  if (restored || typeof window === "undefined") return;
  restored = true;
  try {
    const raw = window.localStorage.getItem(COURT_SESSION_KEY);
    if (!raw) return;
    const stored = JSON.parse(raw) as Partial<CourtSession>;
    /* Spread over the default rather than trusting the blob: a session written by an
       older build is missing whatever was added since, and a half-empty rail is a worse
       failure than an ignored field. */
    session = { ...DEFAULT_COURT_SESSION, ...stored };
  } catch {
    /* Private mode, a cleared quota, or a blob from an older build. The default stands;
       nothing here is worth failing a court screen over. */
  }
}

export function subscribeToCourtSession(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/**
 * The live session. Returns the same object until something actually changes, so it is
 * safe as a `useSyncExternalStore` snapshot.
 */
export function readCourtSession(): CourtSession {
  restore();
  return session;
}

/** What the server rendered, and what hydration must agree with. Always the default. */
export function serverCourtSession(): CourtSession {
  return DEFAULT_COURT_SESSION;
}

/**
 * Sign in, or change one field of the session. Naming what is already true is not a
 * change and notifies nobody.
 */
export function setCourtSession(next: Partial<CourtSession>): void {
  const current = readCourtSession();
  const merged = { ...current, ...next };
  if ((Object.keys(merged) as (keyof CourtSession)[]).every(
    (key) => merged[key] === current[key],
  )) {
    return;
  }
  session = merged;
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(COURT_SESSION_KEY, JSON.stringify(session));
    } catch {
      /* Applies for this visit and simply does not persist — the same fallback the
         citizen side's storage helper makes. */
    }
  }
  for (const listener of listeners) listener();
}

/** Back to nobody signed in. Used by tests; a sign-out control does not exist yet. */
export function clearCourtSession(): void {
  session = DEFAULT_COURT_SESSION;
  if (typeof window !== "undefined") {
    try {
      window.localStorage.removeItem(COURT_SESSION_KEY);
    } catch {
      /* Nothing to do — the in-memory session is already back to the default. */
    }
  }
  for (const listener of listeners) listener();
}
