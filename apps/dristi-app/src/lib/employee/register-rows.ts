/**
 * What is in each register, read from the generated court (`court-docket.ts`).
 *
 * Columns are data, not markup: each says what a cell holds (an identifier, a date, a
 * status, an amount), and the screen decides how to draw it. That is what lets the
 * table, the search and the CSV download agree — all three read the same cells.
 *
 * Every register view reports its `total` (the entries the view holds before anyone
 * searches) and the `rows` left after search and period. The dashboard's tiles open these
 * views and their numbers are these totals; `court-docket.test.ts` holds them equal.
 *
 * Fees (register 9) are Kerala's schedule from `lib/court/fees.ts`, except the per-
 * application fee, which no product source states: it is a demo rate and says so.
 */

import { caseSearchKey } from "@/lib/court/localize";
import { KERALA_FEES } from "@/lib/court/fees";

import {
  courtMeasures,
  courtStatements,
  DAY_MS,
  daysInStage,
  isPending,
  monthKey,
  monthLabel,
  monthStart,
  stageByKey,
  yearOf,
  type CmpApplication,
  type CopyApplication,
  type CourtDocket,
  type Deposition,
  type DocketCase,
  type StatementPeriod,
  type StatementRow,
} from "./court-docket";
import { registerById, type RegisterId, type RegisterMeta } from "./registers";

/* ------------------------------------------------------------------- cells */

export type StatusTone = "success" | "warning" | "info" | "neutral" | "destructive";

export type CellValue =
  | { kind: "text"; text: string; strong?: boolean }
  | { kind: "id"; text: string; label: string }
  | { kind: "case"; number: string; title: string }
  | { kind: "date"; ms: number }
  | { kind: "number"; value: number; strong?: boolean }
  | { kind: "money"; value: number; strong?: boolean }
  | { kind: "status"; text: string; tone: StatusTone }
  | { kind: "empty" };

export type RegisterColumn = {
  header: string;
  numeric?: boolean;
  /** Long free text — the cell may wrap rather than widen the table. */
  wrap?: boolean;
  cell: (row: unknown) => CellValue;
};

function column<T>(
  header: string,
  cell: (row: T) => CellValue,
  options: { numeric?: boolean; wrap?: boolean } = {},
): RegisterColumn {
  return { header, ...options, cell: (row) => cell(row as T) };
}

const EMPTY: CellValue = { kind: "empty" };
const text = (value: string, strong = false): CellValue => ({ kind: "text", text: value, strong });
const id = (value: string | null, label = "case number"): CellValue =>
  value ? { kind: "id", text: value, label } : EMPTY;
const date = (ms: number | null): CellValue => (ms === null ? EMPTY : { kind: "date", ms });
const num = (value: number, strong = false): CellValue => ({ kind: "number", value, strong });
const money = (value: number, strong = false): CellValue => ({ kind: "money", value, strong });

const NUMBER = new Intl.NumberFormat("en-IN");
const DATE = new Intl.DateTimeFormat("en-IN", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

export function formatCount(value: number): string {
  return NUMBER.format(value);
}

/** "10 Oct 2026" — the column form every court table uses. */
export function formatDocketDate(ms: number): string {
  return DATE.format(ms);
}

export function formatRupees(value: number): string {
  return `₹${NUMBER.format(value)}`;
}

/** A cell as plain text — what search matches and what the CSV carries. */
export function cellText(value: CellValue): string {
  switch (value.kind) {
    case "text":
    case "id":
    case "status":
      return value.text;
    case "case":
      return `${value.number} ${value.title}`;
    case "date":
      return formatDocketDate(value.ms);
    case "number":
      return NUMBER.format(value.value);
    case "money":
      return formatRupees(value.value);
    case "empty":
      return "";
  }
}

/* ------------------------------------------------------------ shared cells */

export function caseStatus(c: DocketCase): CellValue {
  if (c.disposal) return { kind: "status", text: "Disposed", tone: "neutral" };
  if (c.longPendingAt !== null) return { kind: "status", text: "Long pending", tone: "info" };
  return { kind: "status", text: "Pending", tone: "success" };
}

export function stageLabel(c: DocketCase): string {
  if (c.disposal) return "Disposed";
  if (c.longPendingAt !== null) return "Long pending";
  return c.stage ? stageByKey(c.stage).label : "";
}

/** A pending case's next date, or the fact that it has none. */
export function nextHearingCell(c: DocketCase): CellValue {
  if (c.nextHearing !== null) return date(c.nextHearing);
  if (c.stage === "registration" || !isPending(c)) return EMPTY;
  return { kind: "status", text: "Not dated", tone: "warning" };
}

function caseHaystack(c: DocketCase): string {
  return [c.title, c.filingNumber, c.cmpNumber, c.stNumber, c.lpNumber].filter(Boolean).join(" ");
}

/* ------------------------------------------------------------- the views */

export type RegisterPeriod = "all" | "month" | "quarter" | "fy";

export const REGISTER_PERIODS: { id: RegisterPeriod; label: string }[] = [
  { id: "all", label: "All dates" },
  { id: "month", label: "This month" },
  { id: "quarter", label: "Last 3 months" },
  { id: "fy", label: "This financial year" },
];

/** The first day a period covers, or `null` for all dates. */
export function periodStart(period: RegisterPeriod, today: number): number | null {
  const d = new Date(today);
  const year = d.getUTCFullYear();
  const month = d.getUTCMonth();
  switch (period) {
    case "all":
      return null;
    case "month":
      return Date.UTC(year, month, 1);
    case "quarter":
      return Date.UTC(year, month - 3, d.getUTCDate());
    case "fy":
      return Date.UTC(month >= 3 ? year : year - 1, 3, 1);
  }
}

type Definition = {
  columns: RegisterColumn[];
  rows: unknown[];
  /** The date the period filter reads; absent means the register has no period. */
  date?: (row: unknown) => number | null;
  /** Extra text search matches beyond the cells — case titles and every number. */
  haystack?: (row: unknown) => string;
  unit: [string, string];
};

export type RegisterOptions = {
  view?: string;
  query?: string;
  period?: RegisterPeriod;
  /** Calendar only: the long-pending cases the dashboard's LPR tile opens. */
  longPendingOnly?: boolean;
  /** Pending only: the year whose cases are listed. */
  year?: number;
};

export type RegisterResult = {
  register: RegisterMeta;
  /** The view in force — the first view when none (or an unknown one) was asked for. */
  view: string | null;
  columns: RegisterColumn[];
  /** After search and period. */
  rows: unknown[];
  /** Entries in the view before search and period — the register's count. */
  total: number;
  unit: [string, string];
  search: boolean;
  period: boolean;
  /** Pending only: cases by the year they were numbered, newest first. */
  years?: { year: number; count: number }[];
  year?: number;
  /** Depositions month-wise: the depositions behind the monthly rows, after filters. */
  entries?: number;
};

const desc = <T,>(list: T[], key: (row: T) => number | null) =>
  list.slice().sort((a, b) => (key(b) ?? 0) - (key(a) ?? 0));

function calendarDefinition(docket: CourtDocket, longPendingOnly: boolean): Definition {
  const rows = desc(docket.cases, (c) => c.filed).filter((c) => !longPendingOnly || c.longPendingAt !== null);
  return {
    unit: ["case", "cases"],
    rows,
    date: (row) => (row as DocketCase).filed,
    haystack: (row) => caseHaystack(row as DocketCase),
    columns: [
      column<DocketCase>("Filing no.", (c) => id(c.filingNumber, "filing number")),
      column<DocketCase>("Case title", (c) => text(c.title), { wrap: true }),
      column<DocketCase>("Filed", (c) => date(c.filed)),
      column<DocketCase>("Registered", (c) => date(c.registeredAt)),
      column<DocketCase>("Stage", (c) => text(stageLabel(c))),
      column<DocketCase>("Status", caseStatus),
      column<DocketCase>("Case type", () => text("Complaint, NI Act §138")),
      column<DocketCase>("CMP no.", (c) => id(c.cmpNumber)),
      column<DocketCase>("ST no.", (c) => id(c.stNumber)),
      column<DocketCase>("LPR no.", (c) => id(c.lpNumber)),
      column<DocketCase>("Disposal", (c) => (c.disposal ? text(c.disposal.method) : EMPTY)),
      column<DocketCase>("Disposed on", (c) => date(c.disposal?.date ?? null)),
      column<DocketCase>("Next hearing", (c) => (isPending(c) ? nextHearingCell(c) : EMPTY)),
      column<DocketCase>("Hearing type", (c) => (c.nextHearing !== null && c.nextPurpose ? text(c.nextPurpose) : EMPTY)),
    ],
  };
}

function hearingBookDefinition(docket: CourtDocket): Definition {
  const rows = courtMeasures(docket)
    .pending.filter((c) => c.stage !== "registration")
    .sort((a, b) => (a.nextHearing ?? Infinity) - (b.nextHearing ?? Infinity));
  return {
    unit: ["case", "cases"],
    rows,
    date: (row) => (row as DocketCase).previousPosting,
    haystack: (row) => caseHaystack(row as DocketCase),
    columns: [
      column<DocketCase>("Filing no.", (c) => id(c.filingNumber, "filing number")),
      column<DocketCase>("CMP no.", (c) => id(c.cmpNumber)),
      column<DocketCase>("ST no.", (c) => id(c.stNumber)),
      column<DocketCase>("Proceedings so far", (c) => num(c.hearings), { numeric: true }),
      column<DocketCase>("Previous posting", (c) => date(c.previousPosting)),
      column<DocketCase>("Next posting", nextHearingCell),
    ],
  };
}

type ApplicationRow = CmpApplication & { case: DocketCase };

function applicationsDefinition(docket: CourtDocket): Definition {
  const rows = desc(
    docket.cases.flatMap((c) => c.applications.map((a): ApplicationRow => ({ ...a, case: c }))),
    (a) => a.submitted,
  );
  const status = (a: ApplicationRow): CellValue =>
    a.status === "Allowed"
      ? { kind: "status", text: "Allowed", tone: "success" }
      : a.status === "Rejected"
        ? { kind: "status", text: "Rejected", tone: "destructive" }
        : { kind: "status", text: "Pending", tone: "warning" };
  return {
    unit: ["application", "applications"],
    rows,
    date: (row) => (row as ApplicationRow).submitted,
    haystack: (row) => caseHaystack((row as ApplicationRow).case),
    columns: [
      column<ApplicationRow>("Filing no.", (a) => id(a.case.filingNumber, "filing number")),
      column<ApplicationRow>("Case CMP no.", (a) => id(a.case.cmpNumber)),
      column<ApplicationRow>("Application no.", (a) => id(a.number, "application number")),
      column<ApplicationRow>("Type", (a) => text(a.type), { wrap: true }),
      column<ApplicationRow>("Status", status),
      column<ApplicationRow>("Filed by", (a) => text(a.filedBy)),
      column<ApplicationRow>("Petitioner", (a) => text(a.petitioner)),
      column<ApplicationRow>("Petitioner type", (a) => text(a.side)),
      column<ApplicationRow>("Submitted", (a) => date(a.submitted)),
      column<ApplicationRow>("Approved or rejected", (a) => date(a.decided)),
    ],
  };
}

function disposedDefinition(docket: CourtDocket, view: string): Definition {
  const measures = courtMeasures(docket);
  const rows = desc(view === "cmp" ? measures.cmpDisposed : measures.stDisposed, (c) => c.disposal!.date);
  return {
    unit: ["case", "cases"],
    rows,
    date: (row) => (row as DocketCase).disposal!.date,
    haystack: (row) => caseHaystack(row as DocketCase),
    columns: [
      column<DocketCase>("ST no.", (c) => id(c.stNumber)),
      column<DocketCase>("CMP no.", (c) => id(c.cmpNumber)),
      column<DocketCase>("Case name", (c) => text(c.title), { wrap: true }),
      column<DocketCase>("Filed", (c) => date(c.filed)),
      column<DocketCase>("Registered", (c) => date(c.registeredAt)),
      column<DocketCase>("Disposed on", (c) => date(c.disposal!.date)),
      column<DocketCase>("Method of disposal", (c) => text(c.disposal!.method)),
      column<DocketCase>("LPR no.", (c) => id(c.lpNumber)),
    ],
  };
}

/** The year a pending case was numbered in: its ST year, or its CMP year. */
function numberedYear(c: DocketCase, view: string): number {
  return yearOf(view === "cmp" ? c.registeredAt! : c.cognizanceAt!);
}

function pendingDefinition(docket: CourtDocket, view: string, year: number | undefined) {
  const measures = courtMeasures(docket);
  const all = view === "cmp" ? measures.cmpPending : measures.stPending;
  const counts = new Map<number, number>();
  for (const c of all) {
    const y = numberedYear(c, view);
    counts.set(y, (counts.get(y) ?? 0) + 1);
  }
  const years = [...counts.entries()]
    .map(([y, count]) => ({ year: y, count }))
    .sort((a, b) => b.year - a.year);
  const chosen = year !== undefined && counts.has(year) ? year : years[0]?.year;
  const rows = all
    .filter((c) => numberedYear(c, view) === chosen)
    .sort((a, b) => daysInStage(b, docket.today) - daysInStage(a, docket.today));
  const definition: Definition = {
    unit: ["case", "cases"],
    rows,
    haystack: (row) => caseHaystack(row as DocketCase),
    columns: [
      column<DocketCase>("Case", (c) => ({ kind: "case", number: c.caseNumber, title: c.title }), { wrap: true }),
      column<DocketCase>("Stage", (c) => text(stageLabel(c))),
      column<DocketCase>("Days in stage", (c) => num(daysInStage(c, docket.today)), { numeric: true }),
      column<DocketCase>("Next hearing", nextHearingCell),
    ],
  };
  return { definition, total: all.length, years, year: chosen };
}

type BailRow = DocketCase;

function bailsDefinition(docket: CourtDocket): Definition {
  return {
    unit: ["bail", "bails"],
    rows: desc(docket.cases.filter((c) => c.bailAt !== null), (c) => c.bailAt),
    date: (row) => (row as BailRow).bailAt,
    haystack: (row) => caseHaystack(row as BailRow),
    columns: [
      column<BailRow>("ST no.", (c) => id(c.stNumber)),
      column<BailRow>("Bail granted on", (c) => date(c.bailAt)),
    ],
  };
}

type DepositionRow = Deposition & { case: DocketCase };

function depositionsDefinition(docket: CourtDocket): Definition {
  return {
    unit: ["deposition", "depositions"],
    rows: desc(
      docket.cases.flatMap((c) => c.depositions.map((d): DepositionRow => ({ ...d, case: c }))),
      (d) => d.date,
    ),
    date: (row) => (row as DepositionRow).date,
    haystack: (row) => caseHaystack((row as DepositionRow).case),
    columns: [
      column<DepositionRow>("Date", (d) => date(d.date)),
      column<DepositionRow>("Filing no.", (d) => id(d.case.filingNumber, "filing number")),
      column<DepositionRow>("Witness", (d) => text(d.witness)),
      column<DepositionRow>("Designation", (d) => text(d.designation)),
      column<DepositionRow>("Party", (d) => text(d.party)),
      column<DepositionRow>("Marked as evidence", (d) => text(d.markedAsEvidence ? "Yes" : "No")),
    ],
  };
}

type DepositionMonth = { month: number; all: number; marked: number };

function depositionMonths(rows: unknown[]): DepositionMonth[] {
  const byMonth = new Map<number, DepositionMonth>();
  for (const row of rows as DepositionRow[]) {
    const key = monthKey(row.date);
    const entry = byMonth.get(key) ?? { month: key, all: 0, marked: 0 };
    entry.all++;
    if (row.markedAsEvidence) entry.marked++;
    byMonth.set(key, entry);
  }
  return [...byMonth.values()].sort((a, b) => b.month - a.month);
}

const DEPOSITION_MONTH_COLUMNS: RegisterColumn[] = [
  column<DepositionMonth>("Month", (m) => text(monthLabel(m.month))),
  column<DepositionMonth>("Depositions", (m) => num(m.all), { numeric: true }),
  column<DepositionMonth>("Marked as evidence", (m) => num(m.marked), { numeric: true }),
];

/* Kerala's schedule, read from its source rather than restated. */
const feeLine = (key: string) => KERALA_FEES.court.find((line) => line.key === key)?.amount ?? 0;
const COMPLAINT_FEE = feeLine("complaint");
const LEGAL_BENEFIT_FUND = feeLine("legal-benefit");
const ADVOCATE_WELFARE_FUND = feeLine("advocate-welfare");
const CLERK_WELFARE_FUND = feeLine("clerk-welfare");
const DELAY_NOTICE_COURT_FEE = feeLine("delay-notice");
const CONDONATION_FEE = KERALA_FEES.condonation.amount;
const VAKALATNAMA = KERALA_FEES.join;
/** No product source states a fee per application made in a case. A demo rate. */
export const DEMO_APPLICATION_FEE = 10;

type FeeMonth = {
  month: number;
  vakalaths: number;
  courtFee: number;
  applicationFee: number;
  advocateWelfare: number;
  legalBenefit: number;
  clerkWelfare: number;
  complaintFee: number;
  condonationFee: number;
};

const FEE_TOTAL_KEYS = [
  "courtFee",
  "applicationFee",
  "advocateWelfare",
  "legalBenefit",
  "clerkWelfare",
  "complaintFee",
  "condonationFee",
] as const;

function feeRows(docket: CourtDocket): FeeMonth[] {
  const out: FeeMonth[] = [];
  const first = monthKey(docket.start);
  const last = monthKey(docket.today);
  for (let month = first; month <= last; month++) {
    const registered = docket.cases.filter((c) => c.registeredAt !== null && monthKey(c.registeredAt) === month);
    /* One vakalath for the complainant at registration, one for the accused at appearance. */
    const appeared = docket.cases.filter((c) =>
      c.log.some((entry) => entry.stage === "appearance" && monthKey(entry.end) === month),
    ).length;
    const applications = docket.cases.reduce(
      (sum, c) => sum + c.applications.filter((a) => monthKey(a.submitted) === month).length,
      0,
    );
    /* Which filings came late is demo: a fixed slice of the month's registrations. */
    const late = registered.filter((c) => /[37]$/.test(c.filingNumber.split("-")[1] ?? "")).length;
    const vakalaths = registered.length + appeared;
    out.push({
      month,
      vakalaths,
      courtFee: vakalaths * VAKALATNAMA.courtFee + registered.length * DELAY_NOTICE_COURT_FEE,
      applicationFee: applications * DEMO_APPLICATION_FEE,
      advocateWelfare: registered.length * ADVOCATE_WELFARE_FUND + vakalaths * VAKALATNAMA.welfareFund,
      legalBenefit: registered.length * LEGAL_BENEFIT_FUND,
      clerkWelfare: registered.length * CLERK_WELFARE_FUND,
      complaintFee: registered.length * COMPLAINT_FEE,
      condonationFee: late * CONDONATION_FEE,
    });
  }
  return out.reverse();
}

function feesDefinition(docket: CourtDocket): Definition {
  const total = (m: FeeMonth) => FEE_TOTAL_KEYS.reduce((sum, key) => sum + m[key], 0);
  return {
    unit: ["month", "months"],
    rows: feeRows(docket),
    date: (row) => monthStart((row as FeeMonth).month),
    columns: [
      column<FeeMonth>("Month", (m) => text(monthLabel(m.month))),
      column<FeeMonth>("Vakalaths filed", (m) => num(m.vakalaths), { numeric: true }),
      column<FeeMonth>("Court fee", (m) => money(m.courtFee), { numeric: true }),
      column<FeeMonth>("Application fee (demo rate)", (m) => money(m.applicationFee), { numeric: true }),
      column<FeeMonth>("Advocate Welfare Fund", (m) => money(m.advocateWelfare), { numeric: true }),
      column<FeeMonth>("Legal Benefit Fund", (m) => money(m.legalBenefit), { numeric: true }),
      column<FeeMonth>("Advocate Clerk Welfare Fund", (m) => money(m.clerkWelfare), { numeric: true }),
      column<FeeMonth>("Complaint fee", (m) => money(m.complaintFee), { numeric: true }),
      column<FeeMonth>("Delay condonation fee", (m) => money(m.condonationFee), { numeric: true }),
      column<FeeMonth>("Total", (m) => money(total(m), true), { numeric: true }),
    ],
  };
}

const STATEMENT_UNITS: Record<StatementPeriod, [string, string]> = {
  monthly: ["month", "months"],
  quarterly: ["quarter", "quarters"],
  annual: ["financial year", "financial years"],
};

function statementsDefinition(docket: CourtDocket, view: StatementPeriod): Definition {
  return {
    unit: STATEMENT_UNITS[view],
    rows: courtStatements(docket)[view].slice().reverse(),
    columns: [
      column<StatementRow>("Period", (s) => text(s.label)),
      column<StatementRow>("Opening pendency", (s) => num(s.opening), { numeric: true }),
      column<StatementRow>("Filed", (s) => num(s.filed), { numeric: true }),
      column<StatementRow>("Uncontested disposals", (s) => num(s.uncontested), { numeric: true }),
      column<StatementRow>("Contested disposals", (s) => num(s.contested), { numeric: true }),
      column<StatementRow>("Moved to long pending", (s) => num(s.longPending), { numeric: true }),
      column<StatementRow>("Total disposed / LP", (s) => num(s.totalDisposed), { numeric: true }),
      column<StatementRow>("Closing pendency", (s) => num(s.closing, true), { numeric: true }),
    ],
  };
}

function copiesDefinition(docket: CourtDocket): Definition {
  return {
    unit: ["application", "applications"],
    rows: docket.copies.slice().reverse(),
    date: (row) => (row as CopyApplication).applied,
    haystack: (row) => caseHaystack((row as CopyApplication).case),
    columns: [
      column<CopyApplication>("Copy application no.", (x) => id(x.number, "copy application number")),
      column<CopyApplication>("Case no.", (x) => id(x.case.caseNumber)),
      column<CopyApplication>("Applied on", (x) => date(x.applied)),
      column<CopyApplication>("Applicant", (x) => text(x.applicant)),
      column<CopyApplication>("Details", (x) => text(x.details), { wrap: true }),
      column<CopyApplication>("Sheets", (x) => num(x.sheets), { numeric: true }),
      column<CopyApplication>("Fee", (x) => money(x.fee), { numeric: true }),
      column<CopyApplication>("Issued on", (x) =>
        x.issued === null ? { kind: "status", text: "Not issued", tone: "warning" } : date(x.issued),
      ),
    ],
  };
}

function sourceToConfirmColumns(register: RegisterMeta): RegisterColumn[] {
  return (register.sourceToConfirm ?? []).map((header) => column<unknown>(header, () => EMPTY));
}

function applyFilters(
  definition: Definition,
  docket: CourtDocket,
  query: string,
  period: RegisterPeriod,
): unknown[] {
  let rows = definition.rows;
  const from = definition.date ? periodStart(period, docket.today) : null;
  if (from !== null && definition.date) {
    const read = definition.date;
    rows = rows.filter((row) => {
      const at = read(row);
      return at !== null && at >= from && at < docket.today + DAY_MS;
    });
  }
  const key = caseSearchKey(query);
  if (key !== "") {
    rows = rows.filter((row) => {
      const cells = definition.columns.map((c) => cellText(c.cell(row))).join(" ");
      const extra = definition.haystack ? definition.haystack(row) : "";
      return `${cells} ${extra}`.toLowerCase().includes(key);
    });
  }
  return rows;
}

/**
 * One register, as a reader has narrowed it. `undefined` for an id that is not a
 * register — the page shows not-found for those.
 */
export function registerView(
  docket: CourtDocket,
  registerId: string,
  options: RegisterOptions = {},
): RegisterResult | undefined {
  const register = registerById(registerId);
  if (!register) return undefined;
  const views = register.views ?? [];
  const view = views.find((v) => v.id === options.view)?.id ?? views[0]?.id ?? null;
  const query = options.query ?? "";
  const period = options.period ?? "all";
  const base = { register, view };

  if (register.sourceToConfirm) {
    return {
      ...base,
      columns: sourceToConfirmColumns(register),
      rows: [],
      total: 0,
      unit: ["entry", "entries"],
      search: false,
      period: false,
    };
  }

  const id = register.id as RegisterId;
  if (id === "pending") {
    const pending = pendingDefinition(docket, view ?? "st", options.year);
    return {
      ...base,
      columns: pending.definition.columns,
      rows: applyFilters(pending.definition, docket, query, "all"),
      total: pending.total,
      unit: pending.definition.unit,
      search: true,
      period: false,
      years: pending.years,
      year: pending.year,
    };
  }

  const definition = definitionFor(docket, id, view, options.longPendingOnly ?? false);
  const rows = applyFilters(definition, docket, query, period);
  const searchable = id !== "statements" && id !== "fees";

  if (id === "depositions" && view === "month") {
    return {
      ...base,
      columns: DEPOSITION_MONTH_COLUMNS,
      rows: depositionMonths(rows),
      total: definition.rows.length,
      unit: definition.unit,
      search: true,
      period: true,
      entries: rows.length,
    };
  }

  return {
    ...base,
    columns: definition.columns,
    rows,
    total: definition.rows.length,
    unit: definition.unit,
    search: searchable,
    period: definition.date !== undefined,
  };
}

function definitionFor(
  docket: CourtDocket,
  id: RegisterId,
  view: string | null,
  longPendingOnly: boolean,
): Definition {
  switch (id) {
    case "calendar":
      return calendarDefinition(docket, longPendingOnly);
    case "hearing-book":
      return hearingBookDefinition(docket);
    case "statements":
      return statementsDefinition(docket, (view ?? "monthly") as StatementPeriod);
    case "cmp-apps":
      return applicationsDefinition(docket);
    case "disposed":
      return disposedDefinition(docket, view ?? "st");
    case "bails":
      return bailsDefinition(docket);
    case "depositions":
      return depositionsDefinition(docket);
    case "fees":
      return feesDefinition(docket);
    case "ctc":
      return copiesDefinition(docket);
    default:
      return { columns: [], rows: [], unit: ["entry", "entries"] };
  }
}

/**
 * What the index card says a register holds: its entries, or its months for the two
 * registers kept by month. `null` for the registers whose source is to be confirmed.
 */
export function registerIndexCount(
  docket: CourtDocket,
  register: RegisterMeta,
): { count: number; unit: [string, string] } | null {
  if (register.sourceToConfirm) return null;
  const measures = courtMeasures(docket);
  if (register.id === "pending") {
    return { count: measures.stPending.length + measures.cmpPending.length, unit: ["entry", "entries"] };
  }
  if (register.id === "disposed") {
    return { count: measures.stDisposed.length + measures.cmpDisposed.length, unit: ["entry", "entries"] };
  }
  const result = registerView(docket, register.id);
  if (!result) return null;
  const monthly = register.id === "statements" || register.id === "fees";
  return { count: result.total, unit: monthly ? ["month", "months"] : ["entry", "entries"] };
}

/* -------------------------------------------------------------------- CSV */

function csvField(value: string): string {
  return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

/** The rows in view, every page of them, as CSV with the register's own columns. */
export function registerCsv(result: RegisterResult): string {
  const header = ["Sl. no.", ...result.columns.map((c) => c.header)];
  const lines = [header.map(csvField).join(",")];
  result.rows.forEach((row, index) => {
    lines.push(
      [String(index + 1), ...result.columns.map((c) => cellText(c.cell(row)))]
        .map(csvField)
        .join(","),
    );
  });
  return `${lines.join("\r\n")}\r\n`;
}
