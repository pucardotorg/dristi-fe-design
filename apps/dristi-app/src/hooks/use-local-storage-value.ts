import { useCallback, useSyncExternalStore } from "react"

/**
 * A localStorage key as React state, hydration-safe — the `useSyncExternalStore`
 * shape of the "read persisted state after mount" pattern.
 *
 * The server (and the hydration render) sees `null`, so SSR and the first client
 * paint agree on the caller's default; after hydration React reads the real
 * snapshot and re-renders once if a stored value differs. That is the same
 * visible sequence as the old effect-plus-setState version, without the effect
 * the `react-hooks/set-state-in-effect` rule rejects.
 *
 * Writes go through `writeLocalStorageValue` so same-tab subscribers update
 * (the browser's `storage` event only fires in *other* tabs, which are also
 * covered). In private mode a failed write falls back to an in-memory value —
 * the choice applies for the session and simply does not persist, matching the
 * behaviour these providers always had.
 */

const listeners = new Map<string, Set<() => void>>()

/** Private-mode fallback: applied-but-unpersisted values, per key. */
const unpersisted = new Map<string, string>()

function emit(key: string) {
  listeners.get(key)?.forEach((listener) => listener())
}

export function writeLocalStorageValue(key: string, value: string) {
  try {
    window.localStorage.setItem(key, value)
    unpersisted.delete(key)
  } catch {
    unpersisted.set(key, value)
  }
  emit(key)
}

export function removeLocalStorageValue(key: string) {
  try {
    window.localStorage.removeItem(key)
  } catch {
    /* Private mode: nothing was persisted, and the in-memory value goes below. */
  }
  unpersisted.delete(key)
  emit(key)
}

export function useLocalStorageValue(key: string): string | null {
  const subscribe = useCallback(
    (callback: () => void) => {
      let set = listeners.get(key)
      if (!set) {
        set = new Set()
        listeners.set(key, set)
      }
      set.add(callback)
      const onStorage = (event: StorageEvent) => {
        if (event.key === key) callback()
      }
      window.addEventListener("storage", onStorage)
      return () => {
        set.delete(callback)
        window.removeEventListener("storage", onStorage)
      }
    },
    [key],
  )

  const getSnapshot = useCallback(() => {
    const fallback = unpersisted.get(key)
    if (fallback !== undefined) return fallback
    try {
      return window.localStorage.getItem(key)
    } catch {
      return null
    }
  }, [key])

  return useSyncExternalStore(subscribe, getSnapshot, () => null)
}
