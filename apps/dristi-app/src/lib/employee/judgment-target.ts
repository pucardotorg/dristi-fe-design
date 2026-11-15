/**
 * The magistrate's own monthly judgment target (note 1.2, Magistrate a: "ability to set own
 * target would be great"). Magistrates are judged on contested judgments against a target
 * they set (11 Nov call with Satya), so the number is theirs, not the court's.
 *
 * Kept per court in this browser (`browser-record.ts`), as the court's other demo records
 * are; a real build keeps it with the magistrate's account. No target until one is set.
 */
import { restoreRecord, saveRecord, watchRecord } from "./browser-record";

type Stored = { target?: number };

const keyFor = (court: string) => `dristi:judgment-target:${court}`;
const listeners = new Set<() => void>();
const cache = new Map<string, number | null>();

function read(court: string): number | null {
  if (!cache.has(court)) {
    const stored = restoreRecord<Stored>(keyFor(court), {});
    const value = typeof stored.target === "number" && stored.target > 0 ? stored.target : null;
    cache.set(court, value);
  }
  return cache.get(court) ?? null;
}

/** The target for a court, or `null` when none is set. `null` on the server. */
export function judgmentTarget(court: string): number | null {
  return typeof window === "undefined" ? null : read(court);
}

export function setJudgmentTarget(court: string, target: number | null): void {
  cache.set(court, target);
  saveRecord(keyFor(court), target === null ? {} : { target });
  for (const listener of listeners) listener();
}

export function subscribeToJudgmentTarget(court: string, listener: () => void): () => void {
  listeners.add(listener);
  watchRecord(keyFor(court), () => {
    cache.delete(court);
    for (const each of listeners) each();
  });
  return () => {
    listeners.delete(listener);
  };
}

/** A target is a whole number of judgments, 1 to 999. */
export function parseTarget(raw: string): number | null {
  const value = Number(raw.trim());
  return raw.trim() !== "" && Number.isInteger(value) && value >= 1 && value <= 999 ? value : null;
}
