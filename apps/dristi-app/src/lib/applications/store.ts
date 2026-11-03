"use client";

/**
 * Applications store — the repository seam for the application lifecycle.
 *
 * Backed by this browser's localStorage, so an application raised on the advocate side
 * is the same record the court side reviews, onboards and decides, in the same tab or
 * another one (`storage` events keep open tabs in step). Swap this file for the
 * applications service and nothing above it changes: every rule lives in
 * `lifecycle.ts`, and this file only keeps, numbers and broadcasts.
 *
 * Attached files stay in memory for the visit only — a reload keeps every field the
 * filer typed but not the files, which the resumed form says plainly.
 */

import * as React from "react";

import { sampleApplications } from "./seed";
import {
  dayOf,
  LifecycleError,
  type FilerRole,
  type FilerSeat,
  type LifecycleApplication,
  type Side,
} from "./lifecycle";

const KEY = "dristi.applications.v1";
const SEAT_KEY = "dristi.applications.seat.v1";

type Counters = { temporary: number; number: number; order: number };

type Db = {
  apps: Record<string, LifecycleApplication>;
  counters: Counters;
  /**
   * Which version of the sample applications (`seed.ts`) this browser holds. `true` is
   * the first, from before samples were versioned.
   */
  seeded?: boolean | number;
};

const FRESH: Db = {
  apps: {},
  counters: { temporary: 100, number: 400, order: 900 },
};

let db: Db | null = null;
let version = 0;
let listCache: LifecycleApplication[] = [];
let listCacheVersion = -1;
const listeners = new Set<() => void>();
const EMPTY: LifecycleApplication[] = [];

/** The filer's own form, with its File objects, for this visit. */
const liveForms = new Map<string, unknown>();

/**
 * Bump to put every browser's sample applications back as `seed.ts` writes them —
 * pending review, pending decision — whatever was done to them since. 2: owner,
 * 2026-10-13, after samples had been onboarded while trying the flow. 3: owner, 2026-10-15,
 * eight more samples so every workstation option can be tried. 4: 2026-10-21, onboarded
 * samples carry the order that onboarded them.
 */
const SAMPLE_VERSION = 4;

/** Whether an application is one of the samples rather than one filed in this browser. */
function isSample(id: string): boolean {
  return id.startsWith("app-sample-");
}

/**
 * Adds the sample applications, and puts them back when `SAMPLE_VERSION` moves on.
 * Anything filed in this browser is kept as it is.
 *
 * The samples are numbered from the fresh counters, so they carry the same temporary
 * identifiers and application numbers every time they are put back. The browser's own
 * counters only ever move forward, so nothing filed here can be given a sample's number.
 */
function withSamples(base: Db): Db {
  if (base.seeded === SAMPLE_VERSION) return base;
  const sampleCounters = { ...FRESH.counters };
  const samples = sampleApplications(dayOf(new Date()), sampleCounters);
  const filed = Object.fromEntries(
    Object.entries(base.apps).filter(([id]) => !isSample(id)),
  );
  const counters: Counters = {
    temporary: Math.max(base.counters.temporary, sampleCounters.temporary),
    number: Math.max(base.counters.number, sampleCounters.number),
    order: Math.max(base.counters.order, sampleCounters.order),
  };
  const next: Db = { apps: { ...samples, ...filed }, counters, seeded: SAMPLE_VERSION };
  try {
    window.localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // Applies for this visit.
  }
  return next;
}

function read(): Db {
  if (typeof window === "undefined") return FRESH;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return withSamples(structuredClone(FRESH));
    const parsed = JSON.parse(raw) as Db;
    return withSamples({
      apps: parsed.apps ?? {},
      counters: parsed.counters ?? FRESH.counters,
      seeded: parsed.seeded,
    });
  } catch {
    return withSamples(structuredClone(FRESH));
  }
}

function ensure(): Db {
  if (!db) db = read();
  return db;
}

function bump() {
  version += 1;
  listeners.forEach((listener) => listener());
}

function commit() {
  if (typeof window !== "undefined" && db) {
    try {
      window.localStorage.setItem(KEY, JSON.stringify(db));
    } catch {
      // A full or blocked store still works for this visit.
    }
  }
  bump();
}

let crossTabWired = false;
function wireCrossTab() {
  if (crossTabWired || typeof window === "undefined") return;
  crossTabWired = true;
  window.addEventListener("storage", (event) => {
    if (event.key === KEY) {
      db = read();
      bump();
    }
    if (event.key === SEAT_KEY) {
      seatCache = null;
      bump();
    }
  });
}

function subscribe(listener: () => void): () => void {
  wireCrossTab();
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function listSnapshot(): LifecycleApplication[] {
  if (listCacheVersion !== version) {
    listCache = Object.values(ensure().apps).sort((a, b) =>
      b.updatedOn.localeCompare(a.updatedOn),
    );
    listCacheVersion = version;
  }
  return listCache;
}

/* Reading ---------------------------------------------------------------------------- */

/** Every application in this browser, most recently changed first. */
export function useLifecycleApplications(): LifecycleApplication[] {
  return React.useSyncExternalStore(subscribe, listSnapshot, () => EMPTY);
}

export function useCaseApplications(caseId: string): LifecycleApplication[] {
  const all = useLifecycleApplications();
  return React.useMemo(
    () => all.filter((app) => app.caseId === caseId),
    [all, caseId],
  );
}

export function getApplication(id: string): LifecycleApplication | undefined {
  return ensure().apps[id];
}

/** `true` once the store has been read on the client — for empty-vs-loading. */
export function useApplicationsReady(): boolean {
  return React.useSyncExternalStore(
    subscribe,
    () => db !== null || typeof window !== "undefined",
    () => false,
  );
}

/* The filer's seat (sandbox) --------------------------------------------------------- */

/**
 * Who the citizen side is acting as, for the applications flow. A sandbox control, the
 * same kind as the account menu's "Viewing as": there is no session to say whether the
 * person signed in is the advocate, their clerk, the litigant, or counsel on the other
 * side, and the lifecycle turns on exactly that.
 */
export type SandboxSeat = { role: FilerRole; opposing: boolean };

const DEFAULT_SEAT: SandboxSeat = { role: "advocate", opposing: false };
let seatCache: SandboxSeat | null = null;

function readSeat(): SandboxSeat {
  if (seatCache) return seatCache;
  if (typeof window === "undefined") return DEFAULT_SEAT;
  try {
    const raw = window.localStorage.getItem(SEAT_KEY);
    seatCache = raw ? { ...DEFAULT_SEAT, ...(JSON.parse(raw) as SandboxSeat) } : DEFAULT_SEAT;
  } catch {
    seatCache = DEFAULT_SEAT;
  }
  return seatCache;
}

export function useSandboxSeat(): SandboxSeat {
  return React.useSyncExternalStore(subscribe, readSeat, () => DEFAULT_SEAT);
}

export function setSandboxSeat(next: SandboxSeat): void {
  seatCache = next;
  try {
    window.localStorage.setItem(SEAT_KEY, JSON.stringify(next));
  } catch {
    // Applies for this visit.
  }
  bump();
}

/** The seat on a given case: "opposing" flips the side the viewer represents. */
export function seatOnCase(seat: SandboxSeat, ownSide: Side): FilerSeat {
  return {
    role: seat.role,
    side: seat.opposing ? (ownSide === "complainant" ? "accused" : "complainant") : ownSide,
  };
}

/* Writing ---------------------------------------------------------------------------- */

export function today(): string {
  return dayOf(new Date());
}

export type Result = { ok: true } | { ok: false; error: string };

/**
 * Apply one lifecycle step. The rules throw `LifecycleError` when a step is not open to
 * this seat or this status; that comes back as a sentence the screen can show.
 */
export function applyStep(
  id: string,
  step: (app: LifecycleApplication) => LifecycleApplication,
): Result {
  const d = ensure();
  const app = d.apps[id];
  if (!app) return { ok: false, error: "This application is no longer here." };
  try {
    d.apps[id] = step(app);
  } catch (error) {
    if (error instanceof LifecycleError) return { ok: false, error: error.message };
    throw error;
  }
  commit();
  return { ok: true };
}

export function createDraft(
  input: Omit<
    LifecycleApplication,
    "id" | "status" | "createdOn" | "updatedOn" | "history"
  >,
  liveForm: unknown,
): string {
  const id = `app-${crypto.randomUUID().slice(0, 8)}`;
  const on = today();
  ensure().apps[id] = {
    ...input,
    id,
    status: "draft",
    createdOn: on,
    updatedOn: on,
    history: [{ on, text: "Draft started" }],
  };
  liveForms.set(id, liveForm);
  commit();
  return id;
}

export function saveForm(
  id: string,
  patch: Pick<LifecycleApplication, "form" | "documents" | "type" | "typeLabel">,
  liveForm: unknown,
): void {
  const app = ensure().apps[id];
  if (!app) return;
  ensure().apps[id] = { ...app, ...patch, updatedOn: today() };
  liveForms.set(id, liveForm);
  commit();
}

/** The form with its files, if it was filled in during this visit. */
export function liveFormOf(id: string): unknown {
  return liveForms.get(id);
}

export function discardDraft(id: string): void {
  const d = ensure();
  if (d.apps[id]?.status === "draft" || d.apps[id]?.status === "pending-signature") {
    delete d.apps[id];
    liveForms.delete(id);
    commit();
  }
}

/** Ties an objection to the application it answers (`ALC-24`). */
export function linkObjection(objectionId: string, toId: string): void {
  const d = ensure();
  const target = d.apps[toId];
  if (!target || target.objectionId) return;
  d.apps[toId] = {
    ...target,
    objectionId,
    updatedOn: today(),
    history: [...target.history, { on: today(), text: "Objection filed" }],
  };
  commit();
}

/* Numbering -------------------------------------------------------------------------- */

/** Shown to the filer, never cited in an order (`ALC-02`). */
export function allotTemporaryId(caseNumber: string): string {
  const d = ensure();
  d.counters.temporary += 1;
  return `${caseNumber}-AP${d.counters.temporary}`;
}

/**
 * The court-facing number, allotted on onboarding (`ALC-04`). The CMP shape is the one
 * the court side's listing fixtures already use; the format itself is owned by
 * `case-numbers.md`, which is still open on it.
 */
export function allotApplicationNumber(on: string): string {
  const d = ensure();
  d.counters.number += 1;
  return `CMP/${d.counters.number}/${on.slice(0, 4)}`;
}

export function allotOrderId(): string {
  const d = ensure();
  d.counters.order += 1;
  return `ORD-${d.counters.order}`;
}

/** Sandbox reset: forget every application raised in this browser; samples return. */
export function resetApplications(): void {
  db = withSamples(structuredClone(FRESH));
  liveForms.clear();
  commit();
}
