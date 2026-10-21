/**
 * Excel in and out for bulk filing, in the browser: the downloadable template, reading an
 * uploaded workbook, matching its columns to the template, and turning rows into the same
 * `ApiBatchRequest` an API push sends — so both ways in meet one intake.
 *
 * Matching is by rule only: a header matches a template column when it is the column's
 * header or one of its listed aliases, with case, spacing and punctuation ignored. Anything
 * else is the filer's call on the mapping screen.
 */

import type { Workbook, Worksheet } from "exceljs";

import type { ApiBatchRequest, ApiCase, ApiComplainant } from "./contract";
import {
  CASES_SHEET,
  COLUMNS,
  formatHint,
  GROUPS,
  groupOf,
  instanceKey,
  parseHeader,
  suffixFor,
  templateHeader,
  type GroupId,
  type Instance,
  type Group,
  isGuideRow,
  LISTS,
  LISTS_SHEET,
  listValue,
  normHeader,
  type Column,
  type ListName,
} from "./excel-spec";

export const TEMPLATE_FILE = "bulk-filing-template.xlsx";


async function excel() {
  const mod = await import("exceljs");
  return (mod.default ?? mod) as typeof import("exceljs");
}

/* ───────────────────────────── Template ───────────────────────────── */

function columnLetter(n: number): string {
  let s = "";
  for (let x = n; x > 0; x = Math.floor((x - 1) / 26)) s = String.fromCharCode(65 + ((x - 1) % 26)) + s;
  return s;
}

/** Light grey for the guide rows, so they read as instructions rather than data. */
const GUIDE_FILL = { type: "pattern" as const, pattern: "solid" as const, fgColor: { argb: "FFF2F2F2" } };

/**
 * One sheet of the template. Row 1 is the header; row 2 says what each column takes; on
 * the Cases sheet row 3 is a filled example. Upload skips rows 2 and 3 (`isGuideRow`).
 */
function addSheet(
  wb: Workbook,
  name: string,
  cols: Column[],
  listRanges: Record<string, string>,
  opts: { withRef: boolean; example: boolean }
) {
  const ws = wb.addWorksheet(name, { views: [{ state: "frozen", ySplit: 2 }] });
  const all = opts.withRef ? [COLUMNS[0], ...cols] : cols;
  ws.columns = all.map((c) => ({ header: templateHeader(c), key: c.key, width: Math.max(18, c.header.length + 4) }));
  const head = ws.getRow(1);
  head.font = { bold: true };
  head.alignment = { wrapText: true, vertical: "top" };

  const hints = ws.addRow(Object.fromEntries(all.map((c) => [c.key, formatHint(c)])));
  hints.font = { italic: true, color: { argb: "FF555555" } };
  hints.alignment = { wrapText: true, vertical: "top" };
  hints.eachCell({ includeEmpty: true }, (cell) => (cell.fill = GUIDE_FILL));

  if (opts.example) {
    const ex = ws.addRow(Object.fromEntries(all.map((c) => [c.key, c.example])));
    ex.font = { italic: true, color: { argb: "FF555555" } };
    ex.eachCell({ includeEmpty: true }, (cell) => (cell.fill = GUIDE_FILL));
  }
  const firstData = opts.example ? 4 : 3;

  all.forEach((c, i) => {
    const cell = head.getCell(i + 1);
    cell.note = `${c.field === "—" ? "" : `${c.field}. `}${formatHint(c)}.`;
    const letter = columnLetter(i + 1);
    if (c.kind === "list" && c.list) {
      for (let r = firstData; r <= firstData + 999; r += 1) {
        ws.getCell(`${letter}${r}`).dataValidation = {
          type: "list",
          allowBlank: true,
          formulae: [listRanges[c.list]],
        };
      }
    }
    if (c.kind === "date" || c.kind === "text" || c.kind === "phone") ws.getColumn(i + 1).numFmt = "@";
  });
  return ws;
}

/** The template: Cases (with its format and example rows), the two optional repeat sheets, the lists, the rules. */
export async function buildTemplate(): Promise<Blob> {
  const ExcelJS = await excel();
  const wb = new ExcelJS.Workbook();
  wb.creator = "SARAS 2.0 bulk filing";

  // The dropdowns point at the Lists sheet, which is written last so Cases opens first.
  const listNames = Object.keys(LISTS) as ListName[];
  const listRanges: Record<string, string> = {};
  listNames.forEach((name, i) => {
    const letter = columnLetter(i + 1);
    listRanges[name] = `'${LISTS_SHEET}'!$${letter}$2:$${letter}$${LISTS[name].length + 1}`;
  });

  addSheet(wb, CASES_SHEET, COLUMNS, listRanges, { withRef: false, example: true });

  const rules = wb.addWorksheet("Instructions");
  rules.columns = [
    { header: "Column", key: "header", width: 36 },
    { header: "Field", key: "field", width: 14 },
    { header: "Section", key: "section", width: 22 },
    { header: "Repeats", key: "repeats", width: 30 },
    { header: "Required", key: "required", width: 34 },
    { header: "Format", key: "format", width: 44 },
  ];
  rules.getRow(1).font = { bold: true };
  for (const c of COLUMNS) {
    const g = groupOf(c.group);
    rules.addRow({
      header: templateHeader(c),
      field: c.field,
      section: g.label,
      repeats: !g.repeats
        ? "No"
        : g.parent
          ? `Yes: _1_2 is accused 1's second; _2 follows accused 2`
          : g.first > 1
            ? "Yes: _2, _3 (complainant 1 is chosen on screen)"
            : "Yes: _2, _3",
      required: c.required,
      format:
        c.kind === "date"
          ? "DD-MM-YYYY"
          : c.kind === "list"
            ? `One of the values on the ${LISTS_SHEET} sheet`
            : c.kind === "number"
              ? "Whole number, no commas"
              : c.kind === "phone"
                ? "10-digit mobile number"
                : "Text",
    });
  }
  rules.addRow({});
  rules.addRow({ header: "One row per case on the Cases sheet, from row 4." });
  rules.addRow({ header: "A second cheque, accused, notice, witness or other pending case: add the same columns with _2 after the name (Cheque number_2), _3 for a third, and so on." });
  rules.addRow({ header: "An accused's second address or person responsible takes two numbers: Accused address_1_2 is accused 1's second address; Accused address_2 is accused 2's first." });
  rules.addRow({ header: "Further complainants: Complainant name_2 and the other complainant columns. Complainant 1 is chosen on screen when you upload." });
  rules.addRow({ header: "Repeats are per case. Add as many _2, _3 columns as the case with the most needs; every other case leaves them blank, and a blank set adds nothing to that case." });
  rules.addRow({ header: "Row 2 says what each column takes and row 3 is an example. Both are skipped on upload, so they can stay." });
  rules.addRow({ header: "Not in the sheet: cause of action, filing date, delay and fees (the system computes them), and documents (added after upload)." });

  const lists = wb.addWorksheet(LISTS_SHEET);
  listNames.forEach((name, i) => {
    const letter = columnLetter(i + 1);
    lists.getCell(`${letter}1`).value = name;
    lists.getCell(`${letter}1`).font = { bold: true };
    LISTS[name].forEach((o, r) => (lists.getCell(`${letter}${r + 2}`).value = o.label));
    lists.getColumn(i + 1).width = 34;
  });

  const buf = await wb.xlsx.writeBuffer();
  return new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
}

/* ───────────────────────────── Reading ───────────────────────────── */

/** A sheet's rows, without the template's guide rows; `discarded` counts those. */
export type Sheet = { name: string; headers: string[]; rows: string[][]; discarded: number };

function cellText(v: unknown): string {
  if (v === null || v === undefined) return "";
  if (v instanceof Date) {
    // Excel dates arrive as UTC midnight.
    return v.toISOString().slice(0, 10);
  }
  if (typeof v === "object") {
    const o = v as { text?: string; result?: unknown; richText?: { text: string }[] };
    if (o.richText) return o.richText.map((r) => r.text).join("");
    if (o.text !== undefined) return String(o.text);
    if (o.result !== undefined) return cellText(o.result);
  }
  return String(v).trim();
}

function readSheet(ws: Worksheet): Sheet {
  const headers: string[] = [];
  ws.getRow(1).eachCell({ includeEmpty: true }, (cell, col) => (headers[col - 1] = cellText(cell.value)));
  const rows: string[][] = [];
  let discarded = 0;
  ws.eachRow({ includeEmpty: false }, (row, n) => {
    if (n === 1) return;
    const out = headers.map((_, i) => cellText(row.getCell(i + 1).value));
    if (!out.some(Boolean)) return;
    if (isGuideRow(out)) discarded += 1;
    else rows.push(out);
  });
  return { name: ws.name, headers, rows, discarded };
}

export type Workbookish = { cases: Sheet };

/**
 * The sheets the upload uses. The Cases sheet is the one named so, else the first sheet
 * with rows — a filer's own export usually has one sheet under another name.
 */
export async function readWorkbook(file: File): Promise<Workbookish> {
  const ExcelJS = await excel();
  const wb = new ExcelJS.Workbook();
  const data = await file.arrayBuffer();
  if (/\.csv$/i.test(file.name)) {
    const text = new TextDecoder().decode(data);
    const lines = text.split(/\r?\n/).filter((l) => l.trim());
    const split = (l: string) => l.match(/("([^"]|"")*"|[^,]*)(,|$)/g)!.slice(0, -1).map((c) => c.replace(/,$/, "").replace(/^"|"$/g, "").replace(/""/g, '"').trim());
    const [h, ...all] = lines.map(split);
    const r = all.filter((row) => !isGuideRow(row));
    return { cases: { name: file.name, headers: h ?? [], rows: r, discarded: all.length - r.length } };
  }
  await wb.xlsx.load(data);
  const sheets = wb.worksheets.map(readSheet);
  const byName = (n: string) => sheets.find((s) => normHeader(s.name) === normHeader(n)) ?? null;
  const cases =
    (byName(CASES_SHEET)?.rows.length ? byName(CASES_SHEET) : null) ??
    sheets.find((s) => s.rows.length && ![LISTS_SHEET, "Instructions"].includes(s.name)) ??
    sheets[0];
  return { cases: cases ?? { name: "", headers: [], rows: [], discarded: 0 } };
}

/* ───────────────────────────── Matching ───────────────────────────── */

/**
 * Where one field of one instance comes from: the index of an uploaded column, a value
 * the filer chose for every row (`{ every }`, list fields only), or null for nowhere.
 */
export type ColumnSource = number | { every: string } | null;

/**
 * Field → source. The key is the column key for the field's first instance
 * (`chequeNumber`), or the key and instance for a later one (`chequeNumber@2`,
 * `accusedAddress@1.2`). A later instance with no entry of its own follows the first:
 * the same column with that instance's `_n` suffix.
 */
export type ColumnMap = Record<string, ColumnSource>;

export const isMapped = (s: ColumnSource | undefined) => s !== null && s !== undefined;

export const mapKey = (key: string, instance: Instance, group: Group) =>
  instanceKey(instance) === instanceKey(firstInstance(group)) ? key : `${key}@${instanceKey(instance)}`;

export function firstInstance(group: Group): Instance {
  if (!group.repeats) return [];
  return group.parent ? [1, 1] : [group.first];
}

/** Uploaded headers, indexed by normalised column name and repeat. */
type HeaderIndex = Map<string, Map<string, number>>;

function indexHeaders(headers: string[]): HeaderIndex {
  const out: HeaderIndex = new Map();
  headers.forEach((h, i) => {
    const { base, instance } = parseHeader(h);
    const key = normHeader(base);
    if (!out.has(key)) out.set(key, new Map());
    out.get(key)!.set(instanceKey(instance), i);
  });
  return out;
}

/** The instance a suffix-less or suffixed header stands for, in its group's terms. */
function normaliseInstance(group: Group, raw: Instance): Instance {
  if (!group.repeats) return [];
  if (group.parent) return raw.length === 0 ? [1, 1] : raw.length === 1 ? [raw[0], 1] : raw;
  return raw.length === 0 ? [group.first] : [raw[0]];
}

/**
 * Which instances of each repeating section the file has, from its headers: a cheque 2
 * exists when any cheque column has `_2`. Sections that are always there have at least
 * their first instance.
 */
/**
 * How many of each repeating section the filer says the sheet has, where the headers do
 * not make it clear (columns named "Chq No 2" rather than "Chq No_2"). For complainants it
 * counts the further ones, after the one chosen on screen.
 */
export type InstanceCounts = Partial<Record<GroupId, number>>;

export function instancesIn(headers: string[], counts: InstanceCounts = {}): Record<GroupId, Instance[]> {
  const out = Object.fromEntries(GROUPS.map((g) => [g.id, [] as Instance[]])) as Record<GroupId, Instance[]>;
  const seen = new Set<string>();
  const add = (g: Group, inst: Instance) => {
    const k = `${g.id}:${instanceKey(inst)}`;
    if (seen.has(k)) return;
    seen.add(k);
    out[g.id].push(inst);
  };
  for (const h of headers) {
    const { base, instance } = parseHeader(h);
    const col = COLUMNS.find((c) => [c.header, ...c.aliases].some((x) => normHeader(x) === normHeader(base)));
    if (!col) continue;
    const g = groupOf(col.group);
    add(g, normaliseInstance(g, instance));
  }
  for (const g of GROUPS) {
    if (g.always || out[g.id].length) add(g, firstInstance(g));
    // The filer's own count wins over what the headers suggest.
    const n = counts[g.id];
    if (g.repeats && !g.parent && n !== undefined) {
      const floor = g.always ? 1 : 0;
      out[g.id] = Array.from({ length: Math.max(floor, n) }, (_, k) => [g.first + k]);
    }
    out[g.id].sort((a, b) => a[0] - b[0] || (a[1] ?? 0) - (b[1] ?? 0));
  }
  // Nested sections follow their parent and mirror across it, as adding an accused does in
  // the filing flow: every accused gets the same addresses and persons responsible as the
  // one with the most (blank ones add nothing), and at least one of each.
  const accused = out.accused.map((i) => i[0]);
  for (const g of GROUPS.filter((x) => x.parent)) {
    const items = new Set([1, ...out[g.id].map(([, c]) => c)]);
    out[g.id] = accused.flatMap((p) => [...items].map((c): Instance => [p, c]));
    out[g.id].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  }
  return out;
}

export function autoMap(headers: string[]): ColumnMap {
  const index = indexHeaders(headers);
  const map: ColumnMap = {};
  for (const c of COLUMNS) {
    const g = groupOf(c.group);
    const first = suffixFor(g, firstInstance(g)).replace(/^_/, "").replace(/_/g, ".");
    const hit = [c.header, ...c.aliases].map(normHeader).find((h) => index.get(h)?.has(first));
    map[c.key] = hit !== undefined ? index.get(hit)!.get(first)! : null;
  }
  return map;
}

/**
 * Where a field of a given instance is read from. An explicit choice wins; otherwise the
 * first instance's column with this instance's suffix, if the file has it.
 */
export function sourceFor(
  c: Column,
  instance: Instance,
  map: ColumnMap,
  headers: string[]
): ColumnSource {
  const g = groupOf(c.group);
  const own = map[mapKey(c.key, instance, g)];
  if (own !== undefined) return own;
  const base = map[c.key];
  if (base === null || base === undefined) return null;
  if (typeof base === "object") return base;
  if (instanceKey(instance) === instanceKey(firstInstance(g))) return base;
  const name = normHeader(parseHeader(headers[base] ?? "").base);
  const want = suffixFor(g, instance).replace(/^_/, "").replace(/_/g, ".");
  const i = indexHeaders(headers).get(name)?.get(want);
  return i === undefined ? null : i;
}

/** True when the file is the template: every template header is there, as written. */
export function followsTemplate(headers: string[]): boolean {
  const have = new Set(headers.map((h) => normHeader(parseHeader(h).base)));
  return COLUMNS.filter((c) => !groupOf(c.group).repeats || groupOf(c.group).always)
    .every((c) => have.has(normHeader(c.header)));
}

/**
 * Template columns a mapping must cover before rows can be read. Payment after notice is
 * left out: without it, the amount paid decides (see `buildRequest`).
 */
export const MUST_MAP = COLUMNS.filter((c) => c.required.startsWith("Yes") && c.key !== "payment").map((c) => c.key);

/** list → raw value as written → list value chosen by the filer. */
export type ValueMap = Partial<Record<ListName, Record<string, string>>>;

/** Values in list columns that the list does not know, by list, across every instance. */
export function unknownValues(
  sheet: Sheet,
  map: ColumnMap,
  counts: InstanceCounts = {}
): Partial<Record<ListName, string[]>> {
  const out: Partial<Record<ListName, Set<string>>> = {};
  const inst = instancesIn(sheet.headers, counts);
  for (const c of COLUMNS) {
    if (c.kind !== "list" || !c.list) continue;
    for (const instance of inst[c.group]) {
      const i = sourceFor(c, instance, map, sheet.headers);
      if (typeof i !== "number") continue;
      for (const row of sheet.rows) {
        const v = row[i]?.trim();
        if (v && listValue(c.list, v) === null) (out[c.list] ??= new Set()).add(v);
      }
    }
  }
  return Object.fromEntries(Object.entries(out).map(([k, set]) => [k, [...set!]]));
}

/* ───────────────────────────── Rows → request ───────────────────────────── */

/** Dates as yyyy-mm-dd. Unreadable dates are passed through, for scrutiny to hold. */
export function sheetDate(raw: string): string {
  const s = raw.trim();
  if (!s) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const dmy = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/.exec(s);
  if (dmy) return `${dmy[3]}-${dmy[2].padStart(2, "0")}-${dmy[1].padStart(2, "0")}`;
  if (/^\d{5}$/.test(s)) {
    // An Excel serial day number that arrived as text.
    const d = new Date(Date.UTC(1899, 11, 30) + Number(s) * 86_400_000);
    return d.toISOString().slice(0, 10);
  }
  return s;
}

const COL = Object.fromEntries(COLUMNS.map((c) => [c.key, c])) as Record<string, Column>;

/** Reads one row, one instance at a time. */
function reader(row: string[], headers: string[], map: ColumnMap, values: ValueMap) {
  const raw = (key: string, instance: Instance) => {
    const src = sourceFor(COL[key], instance, map, headers);
    if (src && typeof src === "object") return src.every;
    return typeof src === "number" ? (row[src] ?? "").trim() : "";
  };
  const list = (key: string, instance: Instance) => {
    const c = COL[key];
    const v = raw(key, instance);
    if (!v || !c.list) return "";
    return listValue(c.list, v) ?? values[c.list]?.[v] ?? v;
  };
  /** Whether this instance has anything in this row (optional sections). */
  const any = (group: GroupId, instance: Instance) =>
    COLUMNS.filter((c) => c.group === group).some((c) => {
      const src = sourceFor(c, instance, map, headers);
      return typeof src === "number" && !!(row[src] ?? "").trim();
    });
  return { raw, list, any };
}

type Reader = ReturnType<typeof reader>;

function accusedFrom(r: Reader, a: number, inst: Record<GroupId, Instance[]>): ApiCase["accused"][number] {
  const at: Instance = [a];
  const type = r.list("accusedType", at) === "institution" ? "institution" : "individual";
  const addresses = inst.address
    .filter(([p, c]) => p === a && (c === 1 || r.any("address", [p, c])))
    .map((i) => ({ line1: r.raw("accusedAddress", i), city: r.raw("accusedCity", i), pin: r.raw("accusedPin", i), policeStation: r.raw("accusedPolice", i) }));
  const within = r.list("accusedJurisdiction", at);
  const persons = inst.person
    .filter(([p, c]) => p === a && r.any("person", [p, c]))
    .map((i) => ({
      name: r.raw("personName", i),
      designation: r.raw("personDesignation", i),
      mobile: r.raw("personMobile", i),
      email: r.raw("personEmail", i),
      ...(r.raw("personAddress", i) ? { address: { line1: r.raw("personAddress", i), city: r.raw("personCity", i), pin: r.raw("personPin", i) } } : {}),
    }));
  return {
    type,
    name: r.raw("accusedName", at),
    ...(type === "institution" ? { institutionType: r.list("accusedEntity", at) } : {}),
    mobile: r.raw("accusedMobile", at),
    email: r.raw("accusedEmail", at),
    addresses: addresses.length ? addresses : [{ line1: "", city: "", pin: "" }],
    ...(type === "institution" ? { personsResponsible: persons } : {}),
    ...(within === "yes" || within === "no" ? { withinJurisdiction: within === "yes" } : {}),
  };
}

export function buildRequest(
  book: Workbookish,
  map: ColumnMap,
  values: ValueMap,
  batch: { complainant: ApiComplainant; barNumbers: string[]; adr: NonNullable<ApiBatchRequest["adr"]>; fileName: string },
  counts: InstanceCounts = {}
): ApiBatchRequest {
  const headers = book.cases.headers;
  const inst = instancesIn(headers, counts);
  const cases: ApiCase[] = book.cases.rows.map((row, n) => {
    const r = reader(row, headers, map, values);
    const one: Instance = [];
    // A section every case has (accused, cheque, notice) is always read for its first
    // instance; anything else only when that instance has values in this row.
    const used = (g: GroupId) =>
      inst[g].filter((i) => (groupOf(g).always && i[0] === groupOf(g).first) || r.any(g, i));
    const deposited = r.list("deposited", one) !== "no";
    return {
      reference: r.raw("reference", one) || `Row ${n + 2}`,
      complainants: used("complainant").map((i) => {
        const type = r.list("compType", i) === "institution" ? "institution" : "individual";
        const address = { line1: r.raw("compAddress", i), city: r.raw("compCity", i), pin: r.raw("compPin", i) };
        return {
          type,
          name: r.raw("compName", i),
          phone: r.raw("compMobile", i),
          email: r.raw("compEmail", i),
          address,
          ...(type === "institution"
            ? {
                institutionType: r.list("compEntity", i),
                cinPan: r.raw("compCinPan", i),
                representative: {
                  name: r.raw("compRepName", i),
                  designation: r.raw("compRepDesignation", i),
                  age: r.raw("compRepAge", i),
                  mobile: r.raw("compRepMobile", i),
                  email: r.raw("compRepEmail", i),
                  address,
                },
              }
            : { age: r.raw("compAge", i), gender: r.list("compGender", i) }),
        };
      }),
      accused: used("accused").map(([a]) => accusedFrom(r, a, inst)),
      cheques: used("cheque").map((i) => ({
        number: r.raw("chequeNumber", i),
        date: sheetDate(r.raw("chequeDate", i)),
        amount: r.raw("chequeAmount", i),
        ifsc: r.raw("chequeIfsc", i),
        bankName: r.raw("chequeBank", i),
        bankBranch: r.raw("chequeBranch", i),
        accountNumber: r.raw("chequeAccount", i),
        presentedOn: sheetDate(r.raw("presentDate", i)),
        returnedOn: sheetDate(r.raw("returnDate", i)),
        returnReason: r.list("returnReason", i),
      })),
      notices: used("notice").map((i) => {
        const delivered = r.list("delivered", i);
        const paid = r.raw("paidAmount", i);
        return {
          natureOfDebt: r.list("natureDebt", i),
          dispatchedOn: sheetDate(r.raw("dispatchDate", i)),
          mode: r.list("mode", i),
          trackingNumber: r.raw("tracking", i),
          delivered: delivered === "yes" ? true : delivered === "no" ? false : null,
          deliveredOn: sheetDate(r.raw("deliveryDate", i)),
          returnedOn: sheetDate(r.raw("noticeReturnDate", i)),
          nonDeliveryReason: r.list("nonDelivery", i),
          replied: r.list("replied", i) === "yes",
          // Without a payment column, an amount paid over zero means part payment.
          payment:
            r.list("payment", i) === "part" || (!isMapped(map.payment) && Number(paid.replace(/[^\d.]/g, "")) > 0)
              ? { status: "part" as const, amount: paid }
              : { status: "none" as const },
        };
      }),
      jurisdiction: {
        depositedInOwnAccount: deposited,
        complainantBranchIfsc: r.raw("payeeIfsc", one),
        complainantBankName: r.raw("payeeBank", one),
        complainantBankBranch: r.raw("payeeBranch", one),
        complainantBranchPoliceStation: r.raw("payeePolice", one),
        drawerBranchPoliceStation: r.raw("drawerPolice", one),
        otherPendingCases: used("otherCase").map((i) => ({ court: r.raw("otherCourt", i), caseNumber: r.raw("otherNumber", i) })),
      },
      witnesses: used("witness").map((i) => ({
        name: r.raw("witnessName", i),
        designation: r.raw("witnessDesignation", i),
        age: r.raw("witnessAge", i),
        prove: r.raw("witnessProve", i),
        mobile: r.raw("witnessMobile", i),
        email: r.raw("witnessEmail", i),
        address: { line1: r.raw("witnessAddress", i), city: r.raw("witnessCity", i), pin: r.raw("witnessPin", i), policeStation: r.raw("witnessPolice", i) },
      })),
      condonationReason: r.raw("condonation", one),
      otherDetails: r.raw("otherDetails", one),
    };
  });

  return {
    source: { system: "Excel upload", reference: batch.fileName },
    complainant: batch.complainant,
    advocates: batch.barNumbers.map((barNumber) => ({ barNumber })),
    adr: batch.adr,
    cases,
  };
}

/* ───────────────────────────── Does a column fit its field ───────────────────────────── */

export type ColumnFit = { ok: true } | { ok: false; note: string };

const FIT_SHARE = 0.8;

/**
 * Whether a matched column's values look like what the field takes: dates for a date,
 * ten digits for a mobile, six for a pincode, an IFSC for an IFSC, known words for a list.
 * Rules only. A column passes when most of its filled values fit; a list column with words
 * the court does not know passes too, since the next step matches those, but says so.
 */
export function columnFit(column: Column, values: string[]): ColumnFit {
  const filled = values.map((v) => v.trim()).filter(Boolean);
  if (!filled.length) return { ok: false, note: "This column is empty" };
  const test = (good: (v: string) => boolean, what: string): ColumnFit => {
    const bad = filled.filter((v) => !good(v)).length;
    return filled.length - bad >= filled.length * FIT_SHARE
      ? { ok: true }
      : { ok: false, note: `${bad} of ${filled.length} values are not ${what}` };
  };
  const digits = (v: string) => v.replace(/^\+?91[\s-]?/, "").replace(/\D/g, "");
  if (/Pin$/.test(column.key)) return test((v) => /^\d{6}$/.test(v.replace(/\s/g, "")), "6-digit pincodes");
  if (/Ifsc$/.test(column.key)) return test((v) => /^[A-Z]{4}0[A-Z0-9]{6}$/i.test(v.trim()), "IFSC codes");
  if (/Email$/.test(column.key)) return test((v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), "email addresses");
  switch (column.kind) {
    case "date":
      return test((v) => /^\d{4}-\d{2}-\d{2}$/.test(sheetDate(v)), "dates");
    case "number":
      return test((v) => /^\d+(\.\d+)?$/.test(v.replace(/[₹,\s]|rs\.?/gi, "")), "numbers");
    case "phone":
      return test((v) => digits(v).replace(/^0/, "").length === 10, "10-digit mobiles");
    case "list": {
      if (!column.list) return { ok: true };
      const unknown = new Set(filled.filter((v) => listValue(column.list!, v) === null));
      return unknown.size ? { ok: false, note: `${unknown.size} word${unknown.size === 1 ? "" : "s"} to match on the next step` } : { ok: true };
    }
    default:
      return { ok: true };
  }
}
