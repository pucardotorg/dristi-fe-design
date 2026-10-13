import { useCallback, useSyncExternalStore } from "react";

/**
 * The demo's memory for one visit: what the viewer files, signs and pays
 * holds while they move between tabs and pages, and a refresh brings every
 * scenario back (owner, Sept 24: "the page remains populated with all
 * scenarios", as Home's hearings roll on to the next date). So a File
 * objection task, once filed, is back to demonstrate again after a reload.
 *
 * Kept in memory, not localStorage: a soft navigation keeps the module, a
 * reload drops it. The server and the hydration render see nothing, so both
 * agree with the untouched fixtures.
 */

const values = new Map<string, string>();
const listeners = new Map<string, Set<() => void>>();

export function readSessionValue(key: string): string | null {
  return values.get(key) ?? null;
}

export function writeSessionValue(key: string, value: string): void {
  values.set(key, value);
  listeners.get(key)?.forEach((listener) => listener());
}

export function useSessionValue(key: string): string | null {
  const subscribe = useCallback(
    (callback: () => void) => {
      let set = listeners.get(key);
      if (!set) {
        set = new Set();
        listeners.set(key, set);
      }
      set.add(callback);
      return () => {
        set.delete(callback);
      };
    },
    [key]
  );
  const getSnapshot = useCallback(() => readSessionValue(key), [key]);
  return useSyncExternalStore(subscribe, getSnapshot, () => null);
}
