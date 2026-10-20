"use client";

import * as React from "react";

import {
  defaultColumns,
  moveColumn,
  normaliseColumns,
  sameColumns,
  shiftColumn,
  toggleColumn,
  type CauseListColumnId,
  type CauseListColumns,
  type DropSide,
} from "@/lib/employee/cause-list-columns";
import type { CourtId } from "@/lib/court/profiles";
import type { CourtRole } from "@/lib/employee/content";

const PREFIX = "dristi.cause-list.columns.v1";
const listeners = new Set<() => void>();

function keyFor(seat: CourtRole, readerPosts: boolean): string {
  return `${PREFIX}.${seat}.${readerPosts ? "reader-posts" : "steno-posts"}`;
}

/* The raw stored string is the snapshot: a string compares by value, so a re-read that
   found nothing new does not re-render the board. */
function readRaw(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  window.addEventListener("storage", listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", listener);
  };
}

function parse(
  raw: string | null,
  seat: CourtRole,
  readerPosts: boolean,
  court: CourtId,
): CauseListColumns {
  if (raw === null) return defaultColumns(seat, readerPosts, court);
  try {
    return normaliseColumns(JSON.parse(raw), seat, readerPosts, court);
  } catch {
    return defaultColumns(seat, readerPosts, court);
  }
}

/**
 * This seat's cause-list columns, kept in this browser (a working preference, like the
 * advocate Cases list's — never in the URL, never shared). The server renders the
 * seat's default, so first paint and hydration agree.
 */
export function useCauseListColumns(
  seat: CourtRole,
  /** The reader enters the next hearing (`useReaderPostsNextHearing`). */
  readerPosts: boolean,
  /** The state, whose table decides which columns this seat is offered. */
  court: CourtId = "kerala",
): {
  columns: CauseListColumns;
  toggle: (id: CauseListColumnId) => void;
  move: (from: CauseListColumnId, to: CauseListColumnId, side?: DropSide) => void;
  shift: (id: CauseListColumnId, delta: -1 | 1) => void;
  showAll: () => void;
  reset: () => void;
  isDefault: boolean;
  isAllVisible: boolean;
} {
  const key = keyFor(seat, readerPosts);
  const raw = React.useSyncExternalStore(
    subscribe,
    () => readRaw(key),
    () => null,
  );
  const columns = React.useMemo(
    () => parse(raw, seat, readerPosts, court),
    [raw, seat, readerPosts, court],
  );

  const write = React.useCallback(
    (update: (current: CauseListColumns) => CauseListColumns) => {
      const next = update(parse(readRaw(key), seat, readerPosts, court));
      try {
        window.localStorage.setItem(key, JSON.stringify(next));
      } catch {
        /* Private mode or blocked storage: the change lasts until the next render. */
      }
      listeners.forEach((listener) => listener());
    },
    [key, seat, readerPosts],
  );

  return {
    columns,
    toggle: (id) => write((current) => toggleColumn(current, id)),
    move: (from, to, side) => write((current) => moveColumn(current, from, to, side)),
    shift: (id, delta) => write((current) => shiftColumn(current, id, delta)),
    showAll: () => write((current) => ({ ...current, visible: current.order })),
    reset: () => {
      try {
        window.localStorage.removeItem(key);
      } catch {
        /* ignore */
      }
      listeners.forEach((listener) => listener());
    },
    isDefault: sameColumns(columns, defaultColumns(seat, readerPosts, court)),
    isAllVisible: columns.visible.length === columns.order.length,
  };
}
