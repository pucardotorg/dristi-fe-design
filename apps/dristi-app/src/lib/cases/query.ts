/**
 * Cases keeps view state in the URL so a scoped list can be shared, bookmarked
 * and reloaded. Sort is a silent default, not a URL param.
 *
 * There are no tabs. What used to be four exclusive views — Ongoing, Long pending
 * register, Disposed, Bookmarked — is a status filter (any number of the first three,
 * none meaning all) plus a separate Bookmarked lens, because a bookmark is a personal
 * mark on a case of any status, not a status of its own. Case type, stage and advocate
 * are further filters in the same sheet. Every one of them combines.
 *
 * Two routes: `/cases` is the landing (list by default; folders are a local
 * preference); `/cases/folders/[bucket]` is the cases in that folder. Search
 * with no folder stays on `/cases`.
 */
import { CASE_TYPE } from "@/lib/filing/options";

import { CASES } from "./fixtures";
import {
  ACTIVE_STAGES,
  DISPOSED_OUTCOMES,
  allCounselNames,
  bucketLabel,
  counselFor,
  outcomeLabel,
  partiesLabel,
  stageLabel,
  type BucketKey,
  type CaseRecord,
} from "./types";
import { caseSearchKey } from "@/lib/court/localize";

/** The offered row counts. Any other whole number is a custom size; `"all"` is every row on one page. */
export const PAGE_SIZES = [10, 15, 20, 25, 30] as const;
export type CasesPageSize = number | "all";
/** Default rows on a list page. Other sizes are a URL `size` param. */
export const PAGE_SIZE: CasesPageSize = 10;
/** A custom size larger than this is a typo, not a preference. */
export const MAX_PAGE_SIZE = 500;

export function isCasesPageSize(value: unknown): value is CasesPageSize {
  if (value === "all") return true;
  return (
    typeof value === "number" &&
    Number.isInteger(value) &&
    value >= 1 &&
    value <= MAX_PAGE_SIZE
  );
}

function parsePageSize(raw: string): CasesPageSize {
  if (raw === "all") return "all";
  const size = Number.parseInt(raw, 10);
  return isCasesPageSize(size) ? size : PAGE_SIZE;
}

export type FiledPeriod = "30d" | "6m" | "1y" | "older";

export const FILED_PERIODS: { value: FiledPeriod; label: string }[] = [
  { value: "30d", label: "In the last 30 days" },
  { value: "6m", label: "In the last 6 months" },
  { value: "1y", label: "In the last year" },
  { value: "older", label: "More than a year ago" },
];

/**
 * The status of a case. Ongoing and the long pending register partition live
 * cases — a long-pending case is not also ongoing.
 */
export type CaseStatus = "ongoing" | "long-pending" | "disposed";

export const CASE_STATUSES: { value: CaseStatus; label: string }[] = [
  { value: "ongoing", label: "Ongoing" },
  { value: "long-pending", label: "Long pending register" },
  { value: "disposed", label: "Disposed" },
];

export function statusOf(record: CaseRecord): CaseStatus {
  if (record.disposal) return "disposed";
  return record.longPending ? "long-pending" : "ongoing";
}

/**
 * One case type today. The filter exists so the second type, when it comes, is a
 * data change rather than a screen change — and so the sheet says what the list
 * holds, which "everything is §138" otherwise leaves unsaid.
 */
export const CASE_TYPES: { value: string; label: string }[] = [
  { value: CASE_TYPE.code, label: CASE_TYPE.title },
];

/** Every case on the list is the one type, until the record carries its own. */
export function caseTypeOf(): string {
  return CASE_TYPE.code;
}

/** Review-only switch for states that need a backend to occur naturally. */
export type CasesDemoState = "empty" | "error";

export type CasesQuery = {
  /** Status filter. Empty is every status. Repeated `status` params. */
  status: CaseStatus[];
  /** The Bookmarked lens — a personal mark, so a switch rather than a status. */
  bookmarked: boolean;
  /** Case type filter. Empty is every type. Repeated `type` params. */
  type: string[];
  /** The opened folder. `null` is the Cases landing. */
  bucket: BucketKey | null;
  search: string;
  filed: FiledPeriod | null;
  /**
   * Stage (or outcome) filter. Empty is every stage. Folders already *are*
   * that selection, so this is landing-only — a folder URL drops it.
   * Repeated `stage` params.
   */
  stage: BucketKey[];
  /** Advocates on record, by name. Empty is anyone. Repeated `adv` params. */
  advocates: string[];
  pageSize: CasesPageSize;
  page: number;
  demo: CasesDemoState | null;
};

const STAGE_KEYS = ACTIVE_STAGES.map((stage) => stage.value);
const OUTCOME_KEYS = DISPOSED_OUTCOMES.map((outcome) => outcome.value);
const ALL_STATUSES = CASE_STATUSES.map((status) => status.value);

/** The statuses a query actually covers — none selected means all of them. */
export function statusesIn(query: Pick<CasesQuery, "status">): CaseStatus[] {
  return query.status.length ? query.status : ALL_STATUSES;
}

/**
 * Which folders the current statuses fold into. Disposed alone folds by outcome,
 * because a disposed case has an outcome, not a stage. Disposed mixed with live
 * statuses (or no status filter at all) folds by stage plus one `disposed`
 * folder, so a disposed case still has somewhere to land.
 */
export function bucketKeysFor(query: Pick<CasesQuery, "status">): BucketKey[] {
  const statuses = statusesIn(query);
  const disposedOnly = statuses.length === 1 && statuses[0] === "disposed";
  if (disposedOnly) return [...OUTCOME_KEYS];
  if (statuses.includes("disposed")) return [...STAGE_KEYS, "disposed"];
  return [...STAGE_KEYS];
}

/** The folders that are real stages or outcomes — the `disposed` catch-all is not a filter option. */
export function stageOptionsFor(query: Pick<CasesQuery, "status">): {
  value: BucketKey;
  label: string;
}[] {
  return bucketKeysFor(query)
    .filter((key) => key !== "disposed")
    .map((key) => ({ value: key, label: bucketLabel(key) }));
}

/** Label for the "leave this folder" action, and for the stage filter group. */
export function allBucketsLabel(query: Pick<CasesQuery, "status">): string {
  const statuses = statusesIn(query);
  return statuses.length === 1 && statuses[0] === "disposed"
    ? "All outcomes"
    : "All stages";
}

export function stageGroupLabel(query: Pick<CasesQuery, "status">): string {
  const statuses = statusesIn(query);
  return statuses.length === 1 && statuses[0] === "disposed" ? "Outcome" : "Stage";
}

/**
 * Drop keys the current statuses do not fold into. Selecting every option
 * is the same as no filter, so that collapses to `[]`.
 */
export function normalizeStageFilter(
  query: Pick<CasesQuery, "status">,
  stages: readonly string[]
): BucketKey[] {
  const allowed: BucketKey[] = bucketKeysFor(query).filter(
    (key) => key !== "disposed"
  );
  const unique: BucketKey[] = [];
  for (const stage of stages) {
    if (
      allowed.includes(stage as BucketKey) &&
      !unique.includes(stage as BucketKey)
    ) {
      unique.push(stage as BucketKey);
    }
  }
  if (unique.length === allowed.length) return [];
  return unique;
}

function normalizeStatuses(values: readonly string[]): CaseStatus[] {
  const unique: CaseStatus[] = [];
  for (const value of values) {
    if (
      ALL_STATUSES.includes(value as CaseStatus) &&
      !unique.includes(value as CaseStatus)
    ) {
      unique.push(value as CaseStatus);
    }
  }
  if (unique.length === ALL_STATUSES.length) return [];
  return unique;
}

function normalizeTypes(values: readonly string[]): string[] {
  const known = CASE_TYPES.map((type) => type.value);
  const unique = [...new Set(values.filter((value) => known.includes(value)))];
  if (unique.length === known.length) return [];
  return unique;
}

function normalizeAdvocates(values: readonly string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

type RawParams = Record<string, string | string[] | undefined>;

function first(value: string | string[] | undefined): string {
  return (Array.isArray(value) ? value[0] : value)?.trim() ?? "";
}

/**
 * Repeated params, not a comma-joined string: a stage key never carries a
 * comma of its own, but splitting a free-text value on one would shred it.
 */
function multi(value: string | string[] | undefined): string[] {
  const values = Array.isArray(value) ? value : [value];
  return values.map((entry) => entry?.trim() ?? "").filter(Boolean);
}

export function parseCasesQuery(
  params: RawParams,
  path?: { bucket?: string }
): CasesQuery {
  const status = normalizeStatuses(multi(params.status));
  const scope = { status };

  /** A bucket is only valid for the statuses that fold into it — an outcome key
   *  under Ongoing is a stale or hand-edited URL, so fall back to the grid.
   *  Path wins over a leftover `?bucket=` from older links. */
  const candidate = (path?.bucket ?? first(params.bucket)) as BucketKey;
  const bucket = bucketKeysFor(scope).includes(candidate) ? candidate : null;

  const page = Number.parseInt(first(params.page), 10);
  const filed = first(params.filed) as FiledPeriod;
  const demo = first(params.demo) as CasesDemoState;

  return {
    status,
    bookmarked: first(params.bookmarked) === "1",
    type: normalizeTypes(multi(params.type)),
    bucket,
    search: first(params.q),
    filed: FILED_PERIODS.some((period) => period.value === filed) ? filed : null,
    /** A folder *is* the stage selection — don't stack a second one. */
    stage: bucket ? [] : normalizeStageFilter(scope, multi(params.stage)),
    advocates: normalizeAdvocates(multi(params.adv)),
    pageSize: parsePageSize(first(params.size)),
    page: Number.isFinite(page) && page > 1 ? page : 1,
    demo: demo === "empty" || demo === "error" ? demo : null,
  };
}

/**
 * Serialise a query back to a URL, dropping defaults so the landing stays a
 * plain `/cases`. Any patch other than `page` sends the reader back to page 1.
 */
export function buildCasesHref(
  query: CasesQuery,
  patch: Partial<CasesQuery> = {}
): string {
  const next: CasesQuery = { ...query, ...patch };
  if (!("page" in patch)) next.page = 1;
  next.status = normalizeStatuses(next.status);

  /** A folder that the new statuses do not fold into is left behind — a stage
   *  folder means nothing once only Disposed is selected. */
  if (next.bucket && !bucketKeysFor(next).includes(next.bucket)) {
    next.bucket = null;
  }
  if (next.bucket) next.stage = [];
  next.stage = normalizeStageFilter(next, next.stage);
  next.type = normalizeTypes(next.type);
  next.advocates = normalizeAdvocates(next.advocates);
  if (!isCasesPageSize(next.pageSize)) next.pageSize = PAGE_SIZE;

  const params = new URLSearchParams();
  for (const status of next.status) params.append("status", status);
  if (next.bookmarked) params.set("bookmarked", "1");
  for (const type of next.type) params.append("type", type);
  if (next.search) params.set("q", next.search);
  if (next.filed) params.set("filed", next.filed);
  for (const stage of next.stage) params.append("stage", stage);
  for (const advocate of next.advocates) params.append("adv", advocate);
  if (next.pageSize !== PAGE_SIZE) params.set("size", String(next.pageSize));
  if (next.page > 1) params.set("page", String(next.page));
  if (next.demo) params.set("demo", next.demo);

  const search = params.toString();
  const qs = search ? `?${search}` : "";

  if (next.bucket) return `/cases/folders/${next.bucket}${qs}`;
  return `/cases${qs}`;
}

/** How many filters the sheet holds are on — what the Filters button counts. */
export function countAppliedFilters(
  query: Pick<CasesQuery, "status" | "type" | "stage" | "advocates">
): number {
  return (
    query.status.length +
    /* With one case type the box is shown ticked and locked; it is a statement about
       the list, not a filter the person applied, so it never counts. */
    (CASE_TYPES.length > 1 ? query.type.length : 0) +
    query.stage.length +
    query.advocates.length
  );
}

/** Whether anything narrows the list beyond a folder — status, type, stage, advocate, bookmark or search. */
export function isNarrowed(query: CasesQuery): boolean {
  return (
    countAppliedFilters(query) > 0 ||
    query.bookmarked ||
    Boolean(query.search) ||
    Boolean(query.filed)
  );
}

/** The whole sheet cleared, and the bookmark lens and search with it. */
export function clearedFilters(): Pick<
  CasesQuery,
  "status" | "bookmarked" | "type" | "stage" | "advocates" | "search" | "filed"
> {
  return {
    status: [],
    bookmarked: false,
    type: [],
    stage: [],
    advocates: [],
    search: "",
    filed: null,
  };
}

/** Every advocate on record across the book, once each, in name order. */
export function advocateOptions(source: CaseRecord[] = CASES): string[] {
  const names = new Set<string>();
  for (const record of source) {
    for (const name of counselFor(record, "complainant")) names.add(name);
    for (const name of counselFor(record, "accused")) names.add(name);
  }
  return [...names].sort((a, b) => a.localeCompare(b, "en-IN"));
}

function matchesSearch(record: CaseRecord, search: string): boolean {
  if (!search) return true;
  const needle = caseSearchKey(search);
  const haystack = [
    record.caseNumber,
    partiesLabel(record),
    allCounselNames(record),
    record.court,
    record.disposal ? outcomeLabel(record.disposal.outcome) : stageLabel(record.stage),
    record.substage ?? "",
    record.nextHearing?.purpose ?? "",
    record.latestUpdate,
  ]
    .join(" ")
    .toLowerCase();
  return haystack.includes(needle);
}

function matchesFiled(record: CaseRecord, filed: FiledPeriod | null, now: number) {
  if (!filed) return true;
  const day = 24 * 60 * 60 * 1000;
  const age = now - new Date(record.filedOn).getTime();
  if (filed === "30d") return age <= 30 * day;
  if (filed === "6m") return age <= 183 * day;
  if (filed === "1y") return age <= 365 * day;
  return age > 365 * day;
}

function matchesStatus(record: CaseRecord, status: CaseStatus[]): boolean {
  if (status.length === 0) return true;
  return status.includes(statusOf(record));
}

function matchesType(record: CaseRecord, type: string[]): boolean {
  if (type.length === 0) return true;
  return type.includes(caseTypeOf());
}

function matchesAdvocates(record: CaseRecord, advocates: string[]): boolean {
  if (advocates.length === 0) return true;
  const onRecord = [
    ...counselFor(record, "complainant"),
    ...counselFor(record, "accused"),
  ];
  return advocates.some((name) => onRecord.includes(name));
}

/**
 * The lens every list and folder count looks through: status, bookmark, type,
 * advocate and the filed period. Search, folder and stage narrow further and
 * are applied by `selectCases` — a folder grid counts the scoped set, not the
 * searched one.
 */
export function applySheetFilters(
  source: CaseRecord[],
  query: Pick<CasesQuery, "status" | "bookmarked" | "type" | "advocates" | "filed">,
  now: number,
  bookmarks: ReadonlySet<string> = new Set(initialBookmarks(source))
): CaseRecord[] {
  return source.filter((record) => {
    if (!matchesStatus(record, query.status)) return false;
    if (query.bookmarked && !bookmarks.has(record.id)) return false;
    if (!matchesType(record, query.type)) return false;
    if (!matchesAdvocates(record, query.advocates)) return false;
    if (!matchesFiled(record, query.filed, now)) return false;
    return true;
  });
}

/** True when a record belongs in the opened folder. */
function inBucket(record: CaseRecord, bucket: BucketKey): boolean {
  if (bucket === "disposed") return Boolean(record.disposal);
  if (record.disposal) return record.disposal.outcome === bucket;
  return record.stage === bucket;
}

/**
 * Silent default order — recently disposed first for a closed case, recently
 * updated first for a live one. A mixed list puts live cases before disposed
 * ones, so the test is per record rather than per view.
 */
function compare(a: CaseRecord, b: CaseRecord): number {
  if (a.disposal && b.disposal) {
    return b.disposal.on.localeCompare(a.disposal.on);
  }
  if (a.disposal) return 1;
  if (b.disposal) return -1;
  return b.updatedOn.localeCompare(a.updatedOn);
}

export type CasesSelection = {
  /** Rows for the current page. */
  rows: CaseRecord[];
  /** Every matched case, in list order, across all pages — what "select all" selects. */
  ids: string[];
  total: number;
  page: number;
  pageCount: number;
  from: number;
  to: number;
};

export function selectCases(options: {
  query: CasesQuery;
  bookmarks: ReadonlySet<string>;
  now: number;
  source?: CaseRecord[];
}): CasesSelection {
  const { query, bookmarks, now } = options;
  const source = options.source ?? CASES;

  const matched = applySheetFilters(source, query, now, bookmarks).filter(
    (record) => {
      if (query.bucket && !inBucket(record, query.bucket)) return false;
      if (!matchesSearch(record, query.search)) return false;
      if (
        query.stage.length > 0 &&
        !query.stage.some((key) => inBucket(record, key))
      ) {
        return false;
      }
      return true;
    }
  );

  const sorted = [...matched].sort(compare);
  /* "All" is one page holding everything, so the pagination has nothing to show. */
  const pageSize =
    query.pageSize === "all" ? Math.max(1, sorted.length) : query.pageSize;
  const pageCount = Math.max(1, Math.ceil(sorted.length / pageSize));
  const page = Math.min(query.page, pageCount);
  const start = (page - 1) * pageSize;
  const rows = sorted.slice(start, start + pageSize);

  return {
    rows,
    ids: sorted.map((record) => record.id),
    total: sorted.length,
    page,
    pageCount,
    from: sorted.length === 0 ? 0 : start + 1,
    to: start + rows.length,
  };
}

export type CasesBucket = {
  key: BucketKey;
  label: string;
  count: number;
};

/**
 * The folder grid. Every bucket the statuses fold into is returned, including
 * empty ones — a stable spatial map is worth more than a tidy grid, and it
 * stops folders moving under the reader as counts change or a state deployment
 * runs a different mix of stages. `scoped` is the sheet-filtered set.
 */
export function summariseBuckets(
  query: Pick<CasesQuery, "status">,
  scoped: CaseRecord[]
): CasesBucket[] {
  return bucketKeysFor(query).map((key) => ({
    key,
    label: bucketLabel(key),
    count: scoped.filter((record) => inBucket(record, key)).length,
  }));
}

/** Counts per status and for the bookmark lens — the whole book, so the sheet can say what each option holds. */
export function summariseCases(
  source: CaseRecord[] = CASES,
  bookmarks: ReadonlySet<string> = new Set(initialBookmarks(source))
): Record<CaseStatus | "bookmarked", number> {
  return {
    ongoing: source.filter((record) => statusOf(record) === "ongoing").length,
    "long-pending": source.filter((record) => statusOf(record) === "long-pending")
      .length,
    disposed: source.filter((record) => statusOf(record) === "disposed").length,
    bookmarked: source.filter((record) => bookmarks.has(record.id)).length,
  };
}

export function initialBookmarks(source: CaseRecord[] = CASES): string[] {
  return source.filter((record) => record.bookmarked).map((record) => record.id);
}
