/**
 * Table columns for the Cases list. Case number and case name are separate.
 * Every row has a name. Next hearing is the date; purpose is optional.
 *
 * Counsel is one column, not one per side: two advocate columns cost a third
 * of the table's width to carry one name each, and the side is a two-letter
 * fact. Advocates stacks both sides in a single cell, each name marked (C) or
 * (A) — see `case-advocates.tsx`.
 *
 * Case number is locked — it opens the case peek. Bookmark is an action, not
 * in this list. Everything else can be shown, hidden, or reordered.
 */
export const TABLE_COLUMNS = [
  { id: "caseNumber", label: "Case number", locked: true, defaultVisible: true },
  { id: "caseName", label: "Case name", locked: false, defaultVisible: true },
  /* S138/NIA. Off by default; added from Edit columns by whoever wants it
     (stakeholder call, 2026-11-04). Sits beside the case's own identity. */
  {
    id: "caseType",
    label: "Case type",
    locked: false,
    defaultVisible: false,
  },
  { id: "stage", label: "Stage", locked: false, defaultVisible: true },
  {
    id: "advocates",
    label: "Advocates",
    locked: false,
    defaultVisible: true,
  },
  /* Which side the signed-in advocate appears for (PM, Sept 2): with a long
     list, "where am I for the accused?" was unanswerable at a scan. Off by
     default; enabled from the Columns menu. */
  {
    id: "representation",
    label: "Representation",
    locked: false,
    defaultVisible: false,
  },
  /* How the case reaches the viewer — on the vakalatnama (they can act) or
     through office access (owner, Sept 2: with 74 cases, which was which
     was unanswerable). */
  {
    id: "access",
    label: "Access",
    locked: false,
    defaultVisible: false,
  },
  {
    id: "nextHearing",
    label: "Next hearing",
    locked: false,
    defaultVisible: true,
  },
  {
    id: "hearingPurpose",
    label: "Hearing purpose",
    locked: false,
    defaultVisible: false,
  },
  {
    id: "previousHearing",
    label: "Previous hearing",
    locked: false,
    defaultVisible: false,
  },
  {
    id: "latestUpdate",
    label: "Latest update",
    locked: false,
    defaultVisible: false,
  },
] as const;

export type TableColumnId = (typeof TABLE_COLUMNS)[number]["id"];

export type ToggleableTableColumnId = Exclude<TableColumnId, "caseNumber">;

export const DEFAULT_COLUMN_ORDER: readonly TableColumnId[] = TABLE_COLUMNS.map(
  (column) => column.id
);

export const DEFAULT_TOGGLEABLE_VISIBLE: readonly ToggleableTableColumnId[] = [
  "caseName",
  "stage",
  "advocates",
  "nextHearing",
];

/** Every column that can be shown — what "Show all" turns on. */
export const ALL_TOGGLEABLE: readonly ToggleableTableColumnId[] = TABLE_COLUMNS.filter(
  (column) => !column.locked
).map((column) => column.id as ToggleableTableColumnId);

/** Advocates sat before Stage. Same columns, old sequence — treat as default. */
const LEGACY_DEFAULT_COLUMN_ORDER: readonly TableColumnId[] = [
  "caseNumber",
  "caseName",
  "advocates",
  "stage",
  "nextHearing",
  "hearingPurpose",
  "previousHearing",
  "latestUpdate",
];

/**
 * Counsel used to be two columns. A stored preference still names them, so
 * both ids resolve to the merged column — the first one in the stored order
 * takes its slot, the second dedupes away. Dropping them instead would hide
 * Advocates from everyone who had ever touched the columns menu.
 */
const MERGED_COLUMN_IDS: Record<string, TableColumnId> = {
  complainantAdvocate: "advocates",
  accusedAdvocate: "advocates",
};

function resolveStoredId(value: string): string {
  return MERGED_COLUMN_IDS[value] ?? value;
}

const COLUMN_IDS: ReadonlySet<string> = new Set(
  TABLE_COLUMNS.map((column) => column.id)
);

const TOGGLEABLE_IDS: ReadonlySet<string> = new Set(
  TABLE_COLUMNS.filter((column) => !column.locked).map((column) => column.id)
);

export function isTableColumnId(value: string): value is TableColumnId {
  return COLUMN_IDS.has(value);
}

export function isToggleableTableColumn(
  value: string
): value is ToggleableTableColumnId {
  return TOGGLEABLE_IDS.has(value);
}

export function canonicalToggleable(
  ids: readonly string[]
): readonly ToggleableTableColumnId[] {
  const stored = ids.map(resolveStoredId);
  return TABLE_COLUMNS.map((column) => column.id).filter(
    (id): id is ToggleableTableColumnId =>
      isToggleableTableColumn(id) && stored.includes(id)
  );
}

export function canonicalOrder(ids: readonly string[]): TableColumnId[] {
  const seen = new Set<TableColumnId>();
  const ordered: TableColumnId[] = [];
  for (const value of ids) {
    const id = resolveStoredId(value);
    if (isTableColumnId(id) && !seen.has(id)) {
      ordered.push(id);
      seen.add(id);
    }
  }
  /* A column added since the choice was stored takes its default slot, after
     the nearest column that precedes it there — so a stored default order is
     still the default, and the new column sits where it belongs. */
  DEFAULT_COLUMN_ORDER.forEach((id, index) => {
    if (seen.has(id)) return;
    const before = DEFAULT_COLUMN_ORDER.slice(0, index)
      .reverse()
      .find((earlier) => seen.has(earlier));
    ordered.splice(before === undefined ? 0 : ordered.indexOf(before) + 1, 0, id);
    seen.add(id);
  });
  return ordered;
}

/** Stored order from before Stage sat third. Custom orders are left alone. */
export function migrateStoredColumnOrder(
  ids: readonly TableColumnId[]
): TableColumnId[] {
  if (ids.length !== LEGACY_DEFAULT_COLUMN_ORDER.length) return [...ids];
  if (LEGACY_DEFAULT_COLUMN_ORDER.every((id, index) => ids[index] === id)) {
    return [...DEFAULT_COLUMN_ORDER];
  }
  return [...ids];
}

export function isDefaultToggleableVisible(
  ids: readonly ToggleableTableColumnId[]
): boolean {
  if (ids.length !== DEFAULT_TOGGLEABLE_VISIBLE.length) return false;
  return DEFAULT_TOGGLEABLE_VISIBLE.every((id, index) => ids[index] === id);
}

export function isDefaultColumnOrder(ids: readonly TableColumnId[]): boolean {
  if (ids.length !== DEFAULT_COLUMN_ORDER.length) return false;
  return DEFAULT_COLUMN_ORDER.every((id, index) => ids[index] === id);
}

function columnById(id: TableColumnId) {
  return TABLE_COLUMNS.find((column) => column.id === id)!;
}

/**
 * A folder *is* the stage (or outcome), so that column repeats the page
 * title. Landing list still shows it — and can filter on it.
 */
export function listTableColumns(
  isVisible: (id: TableColumnId) => boolean,
  options: {
    hideStage?: boolean;
    defaultsOnly?: boolean;
    order?: readonly TableColumnId[];
  } = {}
) {
  const sequence = options.order
    ? canonicalOrder(options.order).map(columnById)
    : TABLE_COLUMNS;
  return sequence.filter((column) => {
    if (options.hideStage && column.id === "stage") return false;
    if (options.defaultsOnly) return column.defaultVisible;
    return isVisible(column.id);
  });
}

function showInDisplay(
  id: TableColumnId,
  isVisible: (id: TableColumnId) => boolean,
  hideStage?: boolean
) {
  if (hideStage && id === "stage") return false;
  return isVisible(id);
}

export type DropSide = "before" | "after";

/**
 * Reorder among columns currently on screen. Hidden columns keep their
 * place in the stored order so showing them again does not jump them.
 *
 * `side` says which edge of `to` the column lands on — the edge the drop
 * indicator was drawn on. Left unsaid, it is the edge the column would pass
 * first: after `to` when moving right, before it when moving left.
 */
export function moveVisibleColumn(
  order: readonly TableColumnId[],
  from: TableColumnId,
  to: TableColumnId,
  isVisible: (id: TableColumnId) => boolean,
  hideStage?: boolean,
  side?: DropSide
): TableColumnId[] {
  const full = canonicalOrder(order);
  const visible = full.filter((id) => showInDisplay(id, isVisible, hideStage));
  const fromIndex = visible.indexOf(from);
  const toIndex = visible.indexOf(to);
  if (fromIndex < 0 || toIndex < 0 || fromIndex === toIndex) return full;
  const place: DropSide = side ?? (fromIndex < toIndex ? "after" : "before");
  const nextVisible = visible.filter((id) => id !== from);
  const insertAt = nextVisible.indexOf(to) + (place === "after" ? 1 : 0);
  nextVisible.splice(insertAt, 0, from);
  let index = 0;
  return full.map((id) =>
    showInDisplay(id, isVisible, hideStage) ? nextVisible[index++] : id
  );
}

export function shiftVisibleColumn(
  order: readonly TableColumnId[],
  id: TableColumnId,
  delta: -1 | 1,
  isVisible: (id: TableColumnId) => boolean,
  hideStage?: boolean
): TableColumnId[] {
  const visible = canonicalOrder(order).filter((columnId) =>
    showInDisplay(columnId, isVisible, hideStage)
  );
  const fromIndex = visible.indexOf(id);
  const to = visible[fromIndex + delta];
  if (fromIndex < 0 || !to) return canonicalOrder(order);
  return moveVisibleColumn(order, id, to, isVisible, hideStage);
}
