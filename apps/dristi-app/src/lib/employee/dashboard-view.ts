/**
 * Which of the dashboard's two views a reader last chose: the court's, shared by every
 * seat, or their own ("For you"). The dashboard opens on the court for a first visit (for
 * every user the overview comes first: 11 Nov call with Satya), then on whichever view
 * was used last (owner, 2026-11-15). Kept in this browser (`browser-record.ts`).
 */
import { restoreRecord, saveRecord, watchRecord } from "./browser-record";

export type DashboardView = "court" | "mine";

const KEY = "dristi:dashboard-view";
const listeners = new Set<() => void>();
let current: DashboardView | null = null;

function read(): DashboardView {
  if (current === null) {
    const stored = restoreRecord<{ view?: string }>(KEY, {});
    current = stored.view === "mine" ? "mine" : "court";
  }
  return current;
}

export function dashboardView(): DashboardView {
  return typeof window === "undefined" ? "court" : read();
}

/** The server, and the hydration render that must match it, open on the court. */
export function serverDashboardView(): DashboardView {
  return "court";
}

export function setDashboardView(view: DashboardView): void {
  current = view;
  saveRecord(KEY, { view });
  for (const listener of listeners) listener();
}

export function subscribeToDashboardView(listener: () => void): () => void {
  listeners.add(listener);
  watchRecord(KEY, () => {
    current = null;
    for (const each of listeners) each();
  });
  return () => {
    listeners.delete(listener);
  };
}
