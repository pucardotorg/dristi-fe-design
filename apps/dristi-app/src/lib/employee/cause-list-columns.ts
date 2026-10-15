/**
 * The cause list's columns — which show, and in what order (owner, 2026-10-15: "give
 * that same option here", as the advocate Cases list has it).
 *
 * Every column the board knows is listed once; each seat opens on its own default and
 * can show, hide and reorder from there. The defaults are the owner's:
 *
 * - **Reader** (bench clerk), when the reader enters the next hearing: no Status, no
 *   Orders, and Action before Next hearing — the order is the steno's.
 * - **Magistrate and the other bench seats:** the board as it was — no Next hearing.
 * - **Steno** (typist): the board as it was, ending at Orders. It has no Action column to
 *   offer, because the seat has no session controls (`court-role.ts`).
 *
 * Next hearing is offered only to the reader, and only when the court has the reader
 * enter it (`next-hearing-entry.ts`, Pending orders flow). When the steno enters it, in
 * the order, no seat can add the column: two places to set it would be two answers to
 * one question.
 *
 * S. no. and Case name are locked on: the serial is how a court calls a matter, and the
 * case name is what opens it. Both still move.
 *
 * A view preference, kept in this browser per seat and flow — nothing here is a court
 * record or a permission.
 */

import type { CourtRole } from "./content";
import { seatHasBenchControls, seatPostsNextHearing } from "./court-role";

export type CauseListColumnId =
  | "item"
  | "caseName"
  | "caseNumber"
  | "advocates"
  | "purpose"
  | "stage"
  | "status"
  | "orders"
  | "action"
  | "nextHearing";

export type CauseListColumn = {
  id: CauseListColumnId;
  label: string;
  locked: boolean;
};

/** The superset, in the board's own order. */
export const CAUSE_LIST_COLUMNS: readonly CauseListColumn[] = [
  { id: "item", label: "S. no.", locked: true },
  { id: "caseName", label: "Case name", locked: true },
  { id: "caseNumber", label: "Case number", locked: false },
  { id: "advocates", label: "Advocates", locked: false },
  { id: "purpose", label: "Purpose", locked: false },
  /* The case's stage — on the listing, never shown on the board before. Off by default
     everywhere; offered because it is a fact every row carries. */
  { id: "stage", label: "Stage", locked: false },
  { id: "status", label: "Status", locked: false },
  { id: "orders", label: "Orders", locked: false },
  { id: "action", label: "Action", locked: false },
  { id: "nextHearing", label: "Next hearing", locked: false },
];

export type CauseListColumns = {
  /** Every available column, shown or not, in the order the reader has set. */
  order: readonly CauseListColumnId[];
  visible: readonly CauseListColumnId[];
};

const BY_ID = new Map(CAUSE_LIST_COLUMNS.map((column) => [column.id, column]));

export function causeListColumn(id: CauseListColumnId): CauseListColumn {
  return BY_ID.get(id)!;
}

export function isCauseListColumnId(value: string): value is CauseListColumnId {
  return BY_ID.has(value as CauseListColumnId);
}

/**
 * What this seat can be offered at all, in the board's own order. `readerPosts`: the
 * reader enters the next hearing on the cause list (`useReaderPostsNextHearing`).
 */
export function availableColumns(
  seat: CourtRole,
  readerPosts: boolean,
): CauseListColumnId[] {
  return CAUSE_LIST_COLUMNS.map((column) => column.id).filter((id) => {
    if (id === "action") return seatHasBenchControls(seat);
    if (id === "nextHearing") return readerPosts && seatPostsNextHearing(seat);
    return true;
  });
}

/** Where a seat opens before anybody has changed anything. */
export function defaultColumns(
  seat: CourtRole,
  readerPosts: boolean,
): CauseListColumns {
  const available = availableColumns(seat, readerPosts);
  if (available.includes("nextHearing")) {
    const shown: CauseListColumnId[] = [
      "item",
      "caseName",
      "caseNumber",
      "advocates",
      "purpose",
      "action",
      "nextHearing",
    ];
    return {
      order: [...shown, ...available.filter((id) => !shown.includes(id))],
      visible: shown,
    };
  }
  return {
    order: available,
    visible: available.filter((id) => id !== "stage" && id !== "nextHearing"),
  };
}

/**
 * A stored choice, read back safely: unknown or no-longer-offered columns dropped, a
 * column added since appended (hidden) so it can be found in the menu, locked columns
 * always on.
 */
export function normaliseColumns(
  stored: { order?: unknown; visible?: unknown } | null,
  seat: CourtRole,
  readerPosts: boolean,
): CauseListColumns {
  const fallback = defaultColumns(seat, readerPosts);
  if (!stored || !Array.isArray(stored.order) || !Array.isArray(stored.visible)) {
    return fallback;
  }
  const available = availableColumns(seat, readerPosts);
  const order: CauseListColumnId[] = [];
  for (const value of stored.order) {
    if (
      typeof value === "string" &&
      isCauseListColumnId(value) &&
      available.includes(value) &&
      !order.includes(value)
    ) {
      order.push(value);
    }
  }
  for (const id of available) if (!order.includes(id)) order.push(id);
  const visible = order.filter(
    (id) =>
      causeListColumn(id).locked ||
      (stored.visible as unknown[]).includes(id),
  );
  return { order, visible };
}

/** The columns on screen, in order. */
export function shownColumns(columns: CauseListColumns): CauseListColumn[] {
  return columns.order
    .filter((id) => columns.visible.includes(id))
    .map(causeListColumn);
}

/** Show or hide one column. A locked column stays on. */
export function toggleColumn(
  columns: CauseListColumns,
  id: CauseListColumnId,
): CauseListColumns {
  if (causeListColumn(id).locked) return columns;
  const visible = columns.visible.includes(id)
    ? columns.visible.filter((entry) => entry !== id)
    : columns.order.filter((entry) => entry === id || columns.visible.includes(entry));
  return { ...columns, visible };
}

export type DropSide = "before" | "after";

/**
 * Move a shown column to an edge of another shown one. Hidden columns keep their place,
 * so showing one again does not make it jump — the Cases list's own rule.
 */
export function moveColumn(
  columns: CauseListColumns,
  from: CauseListColumnId,
  to: CauseListColumnId,
  side?: DropSide,
): CauseListColumns {
  const shown = columns.order.filter((id) => columns.visible.includes(id));
  const fromIndex = shown.indexOf(from);
  const toIndex = shown.indexOf(to);
  if (fromIndex < 0 || toIndex < 0 || fromIndex === toIndex) return columns;
  const place: DropSide = side ?? (fromIndex < toIndex ? "after" : "before");
  const next = shown.filter((id) => id !== from);
  next.splice(next.indexOf(to) + (place === "after" ? 1 : 0), 0, from);
  let index = 0;
  return {
    ...columns,
    order: columns.order.map((id) =>
      columns.visible.includes(id) ? next[index++] : id,
    ),
  };
}

/** One step left or right among the shown columns — the keyboard's move. */
export function shiftColumn(
  columns: CauseListColumns,
  id: CauseListColumnId,
  delta: -1 | 1,
): CauseListColumns {
  const shown = columns.order.filter((entry) => columns.visible.includes(entry));
  const to = shown[shown.indexOf(id) + delta];
  return to ? moveColumn(columns, id, to) : columns;
}

export function sameColumns(a: CauseListColumns, b: CauseListColumns): boolean {
  return (
    a.order.join() === b.order.join() && a.visible.join() === b.visible.join()
  );
}
