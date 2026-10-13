/**
 * What this sitting has done so far — which listing the bench has called, which it
 * has ended, and which it has passed over.
 *
 * It lives in a module rather than in a screen's state because the marks have to
 * outlive the cause list. Start hearing itself no longer leaves it — the matter opens
 * in an overlay over the day — but the cause title and the order composer both do, and
 * marks kept on the list would be gone by the time the bench came back: the matter
 * would read as scheduled again, could be called a second time, and would re-lock the
 * composer that `canDraftOrder` opens once a hearing is under way. A client module
 * instance outlives client-side navigation inside `/employee`, so the marks survive the
 * trip. They do not survive a reload, and are not meant to: see below.
 *
 * **Still not a court record.** This is the same bargain `lib/employee/hearings.ts`
 * already describes — Start, End and Pass over are screen actions. Nothing here is
 * filed, notified, or written back to anything, and a refresh forgets all of it.
 * Moving it out of a component changed how long a mark lives on one device; it
 * changed nothing about what a mark claims.
 *
 * Read it through `components/employee/use-hearing-session.ts`, never directly from
 * a render — the hook is what subscribes.
 */

import { SAMPLE_SESSION } from "./sample-sitting";

/** The three marks, in the shape `withHearingSession` applies them. */
export type HearingSession = {
  /** The one listing being heard. The bench hears one cause at a time. */
  ongoingId: string | null;
  endedIds: ReadonlySet<string>;
  passedOverIds: ReadonlySet<string>;
};

/* One frozen empty set, shared: `useSyncExternalStore` compares snapshots by
   identity, so the untouched session has to be the same object every time it is
   read or the list would re-render on every tick of anything. */
const NO_IDS: ReadonlySet<string> = new Set();

/** An untouched day. Exported so a screen or test can open on it. */
export const EMPTY_SESSION: HearingSession = {
  ongoingId: null,
  endedIds: NO_IDS,
  passedOverIds: NO_IDS,
};

/* Opens on the demo sitting (`sample-sitting.ts`), currently an untouched day; fill
   that file to open with hearings already under way. */
let session: HearingSession = SAMPLE_SESSION;
const listeners = new Set<() => void>();

function commit(next: HearingSession): void {
  session = next;
  for (const listener of listeners) listener();
}

function withId(ids: ReadonlySet<string>, id: string): ReadonlySet<string> {
  const next = new Set(ids);
  next.add(id);
  return next;
}

export function subscribeToHearingSession(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** The current marks. A new object only when one of them has changed. */
export function readHearingSession(): HearingSession {
  return session;
}

/**
 * Start hearing. Naming a second listing returns the first to scheduled, which is
 * what `withHearingSession` already does with a single `ongoingId` — the mark is
 * the one matter on the call, not a set.
 */
export function markHearingOngoing(id: string): void {
  if (session.ongoingId === id) return;
  commit({ ...session, ongoingId: id });
}

/** End hearing. The call is finished, so it is no longer the ongoing one. */
export function markHearingEnded(id: string): void {
  commit({
    ongoingId: session.ongoingId === id ? null : session.ongoingId,
    endedIds: withId(session.endedIds, id),
    passedOverIds: session.passedOverIds,
  });
}

/** Pass over. Deferred rather than finished — off the call either way. */
export function markHearingPassedOver(id: string): void {
  commit({
    ongoingId: session.ongoingId === id ? null : session.ongoingId,
    endedIds: session.endedIds,
    passedOverIds: withId(session.passedOverIds, id),
  });
}
