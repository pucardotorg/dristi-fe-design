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

import { restoreRecord, saveRecord, watchRecord } from "./browser-record";
import type { CausePosting } from "./order-draft";
import { SAMPLE_SESSION } from "./sample-sitting";

/** The three marks and the postings, in the shape `withHearingSession` applies them. */
export type HearingSession = {
  /** The one listing being heard. The bench hears one cause at a time. */
  ongoingId: string | null;
  endedIds: ReadonlySet<string>;
  passedOverIds: ReadonlySet<string>;
  /**
   * Where each matter is posted to next, keyed by listing id — set in the cause list's
   * Next hearing column (owner, 2026-10-15), and read by that listing's order
   * on screen E, which shows it and no longer asks for it.
   */
  postings: Readonly<Record<string, CausePosting>>;
};

/* One frozen empty set, shared: `useSyncExternalStore` compares snapshots by
   identity, so the untouched session has to be the same object every time it is
   read or the list would re-render on every tick of anything. */
const NO_IDS: ReadonlySet<string> = new Set();
const NO_POSTINGS: Readonly<Record<string, CausePosting>> = Object.freeze({});

/** An untouched day. Exported so a screen or test can open on it. */
export const EMPTY_SESSION: HearingSession = {
  ongoingId: null,
  endedIds: NO_IDS,
  passedOverIds: NO_IDS,
  postings: NO_POSTINGS,
};

/* Opens on the demo sitting (`sample-sitting.ts`), currently an untouched day; fill
   that file to open with hearings already under way. */
let session: HearingSession = SAMPLE_SESSION;
let restored = false;
const listeners = new Set<() => void>();

/* Saved in this browser and kept in step across tabs (`browser-record.ts`; owner,
   2026-10-14: a hearing the reader starts in one tab is under way in the steno's). The
   sets are kept as lists. Restored when the first component subscribes, so the server
   and hydration read the opening session. */
const STORAGE_KEY = "dristi.hearing-session.v1";

type StoredSession = {
  ongoingId?: string | null;
  endedIds?: string[];
  passedOverIds?: string[];
  postings?: Record<string, CausePosting>;
};

/* Nothing saved yet: the opening sitting. */
const NOTHING_SAVED: StoredSession = Object.freeze({});

function fromStored(stored: StoredSession): HearingSession {
  if (stored === NOTHING_SAVED) return SAMPLE_SESSION;
  return {
    ongoingId: stored.ongoingId ?? null,
    endedIds: new Set(stored.endedIds ?? []),
    passedOverIds: new Set(stored.passedOverIds ?? []),
    postings: stored.postings ?? NO_POSTINGS,
  };
}

function load(): void {
  session = fromStored(restoreRecord(STORAGE_KEY, NOTHING_SAVED));
}

function restore(): void {
  if (restored || typeof window === "undefined") return;
  restored = true;
  load();
}

/** What the server rendered, and what hydration must agree with. */
export function serverHearingSession(): HearingSession {
  return SAMPLE_SESSION;
}

function commit(next: HearingSession): void {
  restore();
  session = next;
  saveRecord(STORAGE_KEY, {
    ongoingId: next.ongoingId,
    endedIds: [...next.endedIds],
    passedOverIds: [...next.passedOverIds],
    postings: { ...next.postings },
  } satisfies StoredSession);
  for (const listener of listeners) listener();
}

function withId(ids: ReadonlySet<string>, id: string): ReadonlySet<string> {
  const next = new Set(ids);
  next.add(id);
  return next;
}

export function subscribeToHearingSession(listener: () => void): () => void {
  listeners.add(listener);
  if (!restored) {
    restore();
    for (const each of listeners) each();
  }
  /* Another tab's save replaces this tab's copy. */
  watchRecord(STORAGE_KEY, () => {
    load();
    for (const each of listeners) each();
  });
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
  restore();
  if (session.ongoingId === id) return;
  commit({ ...session, ongoingId: id });
}

/** End hearing. The call is finished, so it is no longer the ongoing one. */
export function markHearingEnded(id: string): void {
  restore();
  commit({
    ...session,
    ongoingId: session.ongoingId === id ? null : session.ongoingId,
    endedIds: withId(session.endedIds, id),
  });
}

/**
 * Set a matter's next hearing — the Next hearing column of the cause list, and
 * the same two fields in its case overview (`next-hearing-fields.tsx`).
 */
export function setHearingPosting(id: string, posting: CausePosting): void {
  restore();
  commit({ ...session, postings: { ...session.postings, [id]: posting } });
}

/** Pass over. Deferred rather than finished — off the call either way. */
export function markHearingPassedOver(id: string): void {
  restore();
  commit({
    ...session,
    ongoingId: session.ongoingId === id ? null : session.ongoingId,
    passedOverIds: withId(session.passedOverIds, id),
  });
}

/**
 * The cause list's bulk acts (owner, 2026-10-15) — the same marks as the row's, made on
 * many listings in one write, so the board and every other tab change once.
 */
export function markHearingsEnded(ids: readonly string[]): void {
  restore();
  if (ids.length === 0) return;
  const endedIds = new Set(session.endedIds);
  for (const id of ids) endedIds.add(id);
  commit({
    ...session,
    ongoingId:
      session.ongoingId && ids.includes(session.ongoingId) ? null : session.ongoingId,
    endedIds,
  });
}

export function markHearingsPassedOver(ids: readonly string[]): void {
  restore();
  if (ids.length === 0) return;
  const passedOverIds = new Set(session.passedOverIds);
  for (const id of ids) passedOverIds.add(id);
  commit({
    ...session,
    ongoingId:
      session.ongoingId && ids.includes(session.ongoingId) ? null : session.ongoingId,
    passedOverIds,
  });
}

/**
 * Set part of the next hearing on many listings at once: whatever `change` names is
 * written over each listing's own posting; whatever it leaves out is kept.
 */
export function setHearingsNext(
  ids: readonly string[],
  change: Partial<CausePosting>,
  base: CausePosting,
): void {
  restore();
  if (ids.length === 0) return;
  const postings = { ...session.postings };
  for (const id of ids) {
    postings[id] = { ...(postings[id] ?? base), ...change };
  }
  commit({ ...session, postings });
}

/** Back to the opening sitting — Reset sandbox data (`sandbox-reset.ts`). */
export function resetHearingSession(): void {
  restored = true;
  commit(SAMPLE_SESSION);
}
