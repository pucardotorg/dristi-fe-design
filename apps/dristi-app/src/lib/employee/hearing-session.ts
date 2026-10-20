/**
 * What this sitting has done so far — which listings the bench has called, which it
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
import { isoDay, type HearingMarks } from "./hearings";
import type { CausePosting } from "./order-draft";
import { SAMPLE_SESSION } from "./sample-sitting";

/** The marks and the postings, in the shape `withHearingSession` applies them. */
export type HearingSession = HearingMarks & {
  /**
   * The day these marks were made on — `null` until the first mark. A board kept past
   * its day is moved to `previous` and the new day opens on the opening sitting, so a
   * listing left unheard reads Abandoned on its own day and not on today's (`HRG-05`).
   */
  day: string | null;
  /** The last day worked here before this one, closed (`boardForDay`). */
  previous: (HearingMarks & { day: string }) | null;
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
  day: null,
  previous: null,
  ongoingIds: NO_IDS,
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
   and hydration read the opening session. v2: several ongoing hearings, and the day. */
const STORAGE_KEY = "dristi.hearing-session.v2";

type StoredMarks = {
  ongoingIds?: string[];
  endedIds?: string[];
  passedOverIds?: string[];
};

type StoredSession = StoredMarks & {
  day?: string | null;
  previous?: (StoredMarks & { day: string }) | null;
  postings?: Record<string, CausePosting>;
};

/* Nothing saved yet: the opening sitting. */
const NOTHING_SAVED: StoredSession = Object.freeze({});

function marksFrom(stored: StoredMarks): HearingMarks {
  return {
    ongoingIds: new Set(stored.ongoingIds ?? []),
    endedIds: new Set(stored.endedIds ?? []),
    passedOverIds: new Set(stored.passedOverIds ?? []),
  };
}

function marksToStore(marks: HearingMarks): StoredMarks {
  return {
    ongoingIds: [...marks.ongoingIds],
    endedIds: [...marks.endedIds],
    passedOverIds: [...marks.passedOverIds],
  };
}

function fromStored(stored: StoredSession): HearingSession {
  if (stored === NOTHING_SAVED) return SAMPLE_SESSION;
  return {
    ...marksFrom(stored),
    day: stored.day ?? null,
    previous: stored.previous
      ? { ...marksFrom(stored.previous), day: stored.previous.day }
      : null,
    postings: stored.postings ?? NO_POSTINGS,
  };
}

function today(): string {
  return isoDay(new Date());
}

/**
 * Midnight has passed since these marks were made: the day closes. Its marks become
 * `previous`, read as a closed board, and the new day opens on the opening sitting.
 * Postings are kept — they name the next hearing, which is still ahead.
 */
function rolledOver(from: HearingSession): HearingSession {
  if (from.day === null || from.day === today()) return from;
  return {
    ...SAMPLE_SESSION,
    day: null,
    previous: {
      day: from.day,
      ongoingIds: from.ongoingIds,
      endedIds: from.endedIds,
      passedOverIds: from.passedOverIds,
    },
    postings: from.postings,
  };
}

function load(): void {
  session = rolledOver(fromStored(restoreRecord(STORAGE_KEY, NOTHING_SAVED)));
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
    ...marksToStore(next),
    day: next.day,
    previous: next.previous
      ? { ...marksToStore(next.previous), day: next.previous.day }
      : null,
    postings: { ...next.postings },
  } satisfies StoredSession);
  for (const listener of listeners) listener();
}

/**
 * Write marks for today. A listing is in at most one set: `to` names the set it joins,
 * and it leaves the other two.
 */
function mark(ids: readonly string[], to: keyof HearingMarks): void {
  restore();
  if (ids.length === 0) return;
  const current = rolledOver(session);
  const sets = {
    ongoingIds: new Set(current.ongoingIds),
    endedIds: new Set(current.endedIds),
    passedOverIds: new Set(current.passedOverIds),
  };
  for (const id of ids) {
    for (const key of Object.keys(sets) as (keyof HearingMarks)[]) {
      if (key === to) sets[key].add(id);
      else sets[key].delete(id);
    }
  }
  commit({ ...current, ...sets, day: today() });
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
 * Start hearing — on a Scheduled listing, or a Passed over one called again the same
 * day (`HRG-04`). Other ongoing hearings stay ongoing: several may be under way at once
 * (`HRG-06`).
 */
export function markHearingOngoing(id: string): void {
  if (session.ongoingIds.has(id)) return;
  mark([id], "ongoingIds");
}

/** End hearing. Heard is final (`HRG-03`). */
export function markHearingEnded(id: string): void {
  mark([id], "endedIds");
}

/**
 * Set a matter's next hearing — the Next hearing column of the cause list, and
 * the same two fields in its case overview (`next-hearing-fields.tsx`).
 */
export function setHearingPosting(id: string, posting: CausePosting): void {
  restore();
  commit({ ...session, postings: { ...session.postings, [id]: posting } });
}

/** Pass over — set aside unheard, to be called again later today (`HRG-04`). */
export function markHearingPassedOver(id: string): void {
  mark([id], "passedOverIds");
}

/**
 * The cause list's bulk acts (`HRG-07`) — the same marks as the row's, made on many
 * listings in one write, so the board and every other tab change once. Which listings
 * may take them is the caller's test (`canEndHearingInBulk`, `canPassOver`).
 */
/**
 * Bulk End. A listing still Scheduled is started and ended by the same press
 * (`CLS-10`): it passes through Ongoing on its way to Heard, in the same write, so
 * no screen ever shows the step between. This build keeps no times (`HRG-08`); a
 * build that does records the start and the end at the same moment.
 */
export function markHearingsEnded(ids: readonly string[]): void {
  mark(ids, "endedIds");
}

export function markHearingsPassedOver(ids: readonly string[]): void {
  mark(ids, "passedOverIds");
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
export function resetHearingSession(to: HearingSession = SAMPLE_SESSION): void {
  restored = true;
  commit(to);
}
