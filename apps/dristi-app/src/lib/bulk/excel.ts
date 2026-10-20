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
  LISTS,
  LISTS_SHEET,
  listValue,
  normHeader,
  type Column,
  type ListName,
} from "./excel-spec";

export const EXTRA_CHEQUES_SHEET = "Extra cheques";
export const EXTRA_ACCUSED_SHEET = "Extra accused";
export const TEMPLATE_FILE = "bulk-filing-template.xlsx";

const CHEQUE_KEYS = ["chequeNumber", "chequeDate", "chequeAmount", "chequeIfsc", "chequeAccount", "presentDate", "returnDate", "returnReason"];
const ACCUSED_KEYS = ["accusedType", "accusedName", "accusedEntity", "accusedAge", "accusedMobile", "accusedEmail", "accusedAddress", "accusedCity", "accusedPin", "accusedPolice", "personName", "personDesignation"];

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

function addSheet(wb: Workbook, name: string, cols: Column[], listRanges: Record<string, string>, withRef: boolean) {
  const ws = wb.addWorksheet(name, { views: [{ state: "frozen", ySplit: 1 }] });
  const all = withRef ? [COLUMNS[0], ...cols] : cols;
  ws.columns = all.map((c) => ({ header: c.header, key: c.key, width: Math.max(14, c.header.length + 4) }));
  const head = ws.getRow(1);
  head.font = { bold: true };
  head.alignment = { wrapText: true, vertical: "top" };
  all.forEach((c, i) => {
    const cell = head.getCell(i + 1);
    cell.note = `${c.field === "—" ? "" : `${c.field}. `}Required: ${c.required}.`;
    const letter = columnLetter(i + 1);
    if (c.kind === "list" && c.list) {
      for (let r = 2; r <= 1001; r += 1) {
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

/** The template: Cases, the two optional repeat sheets, an example, the lists, the rules. */
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

  addSheet(wb, CASES_SHEET, COLUMNS, listRanges, false);
  addSheet(wb, EXTRA_CHEQUES_SHEET, COLUMNS.filter((c) => CHEQUE_KEYS.includes(c.key)), listRanges, true);
  addSheet(wb, EXTRA_ACCUSED_SHEET, COLUMNS.filter((c) => ACCUSED_KEYS.includes(c.key)), listRanges, true);

  const ex = wb.addWorksheet("Example");
  ex.columns = COLUMNS.map((c) => ({ header: c.header, key: c.key, width: Math.max(14, c.header.length + 4) }));
  ex.getRow(1).font = { bold: true };
  ex.addRow(Object.fromEntries(COLUMNS.map((c) => [c.key, c.example])));

  const rules = wb.addWorksheet("Instructions");
  rules.columns = [
    { header: "Column", key: "header", width: 36 },
    { header: "Field", key: "field", width: 10 },
    { header: "Required", key: "required", width: 34 },
    { header: "Format", key: "format", width: 44 },
  ];
  rules.getRow(1).font = { bold: true };
  for (const c of COLUMNS) {
    rules.addRow({
      header: c.header,
      field: c.field,
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
  rules.addRow({ header: "One row per case on the Cases sheet. A second cheque or accused goes on its own sheet with the same Case reference." });
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

export type Sheet = { name: string; headers: string[]; rows: string[][] };

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
  ws.eachRow({ includeEmpty: false }, (row, n) => {
    if (n === 1) return;
    const out = headers.map((_, i) => cellText(row.getCell(i + 1).value));
    if (out.some(Boolean)) rows.push(out);
  });
  return { name: ws.name, headers, rows };
}

export type Workbookish = { cases: Sheet; extraCheques: Sheet | null; extraAccused: Sheet | null };

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
    const [h, ...r] = lines.map(split);
    return { cases: { name: file.name, headers: h ?? [], rows: r }, extraCheques: null, extraAccused: null };
  }
  await wb.xlsx.load(data);
  const sheets = wb.worksheets.map(readSheet);
  const byName = (n: string) => sheets.find((s) => normHeader(s.name) === normHeader(n)) ?? null;
  const cases =
    (byName(CASES_SHEET)?.rows.length ? byName(CASES_SHEET) : null) ??
    sheets.find((s) => s.rows.length && ![LISTS_SHEET, "Example", "Instructions"].includes(s.name)) ??
    sheets[0];
  return {
    cases: cases ?? { name: "", headers: [], rows: [] },
    extraCheques: byName(EXTRA_CHEQUES_SHEET),
    extraAccused: byName(EXTRA_ACCUSED_SHEET),
  };
}

/* ───────────────────────────── Matching ───────────────────────────── */

/**
 * Column key → where its value comes from: the index of an uploaded column, a value the
 * filer chose for every row (`{ every }`, list fields only), or null for nowhere.
 */
export type ColumnSource = number | { every: string } | null;
export type ColumnMap = Record<string, ColumnSource>;

export const isMapped = (s: ColumnSource | undefined) => s !== null && s !== undefined;

export function autoMap(headers: string[]): ColumnMap {
  const index = new Map(headers.map((h, i) => [normHeader(h), i]));
  const map: ColumnMap = {};
  for (const c of COLUMNS) {
    const hit = [c.header, ...c.aliases].map(normHeader).find((h) => index.has(h));
    map[c.key] = hit !== undefined ? index.get(hit)! : null;
  }
  return map;
}

/** True when the file is the template: every template header is there, as written. */
export function followsTemplate(headers: string[]): boolean {
  const have = new Set(headers.map(normHeader));
  return COLUMNS.every((c) => have.has(normHeader(c.header)));
}

/**
 * Template columns a mapping must cover before rows can be read. Payment after notice is
 * left out: without it, the amount paid decides (see `buildRequest`).
 */
export const MUST_MAP = COLUMNS.filter((c) => c.required.startsWith("Yes") && c.key !== "payment").map((c) => c.key);

/** list → raw value as written → list value chosen by the filer. */
export type ValueMap = Partial<Record<ListName, Record<string, string>>>;

/** Values in list columns that the list does not know, by list. */
export function unknownValues(sheet: Sheet, map: ColumnMap): Partial<Record<ListName, string[]>> {
  const out: Partial<Record<ListName, Set<string>>> = {};
  for (const c of COLUMNS) {
    if (c.kind !== "list" || !c.list) continue;
    const i = map[c.key];
    if (typeof i !== "number") continue;
    for (const row of sheet.rows) {
      const v = row[i]?.trim();
      if (v && listValue(c.list, v) === null) (out[c.list] ??= new Set()).add(v);
    }
  }
  return Object.fromEntries(Object.entries(out).map(([k, s]) => [k, [...s!]]));
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

function reader(row: string[], map: ColumnMap, values: ValueMap) {
  const raw = (key: string) => {
    const i = map[key];
    if (i && typeof i === "object") return i.every;
    return typeof i === "number" ? (row[i] ?? "").trim() : "";
  };
  const list = (key: string) => {
    const c = COLUMNS.find((x) => x.key === key)!;
    const v = raw(key);
    if (!v || !c.list) return "";
    return listValue(c.list, v) ?? values[c.list]?.[v] ?? v;
  };
  return { raw, list };
}

function accusedFrom(r: ReturnType<typeof reader>): ApiCase["accused"][number] {
  const type = r.list("accusedType") === "institution" ? "institution" : "individual";
  return {
    type,
    name: r.raw("accusedName"),
    ...(type === "institution" ? { institutionType: r.list("accusedEntity") } : { age: r.raw("accusedAge") }),
    mobile: r.raw("accusedMobile"),
    email: r.raw("accusedEmail"),
    addresses: [{ line1: r.raw("accusedAddress"), city: r.raw("accusedCity"), pin: r.raw("accusedPin"), policeStation: r.raw("accusedPolice") }],
    ...(type === "institution" && r.raw("personName")
      ? { personsResponsible: [{ name: r.raw("personName"), designation: r.raw("personDesignation") }] }
      : {}),
  };
}

function chequeFrom(r: ReturnType<typeof reader>): ApiCase["cheques"][number] {
  return {
    number: r.raw("chequeNumber"),
    date: sheetDate(r.raw("chequeDate")),
    amount: r.raw("chequeAmount"),
    ifsc: r.raw("chequeIfsc"),
    accountNumber: r.raw("chequeAccount"),
    presentedOn: sheetDate(r.raw("presentDate")),
    returnedOn: sheetDate(r.raw("returnDate")),
    returnReason: r.list("returnReason"),
  };
}

export function buildRequest(
  book: Workbookish,
  map: ColumnMap,
  values: ValueMap,
  batch: { complainant: ApiComplainant; barNumber: string; adr: "yes" | "no"; fileName: string }
): ApiBatchRequest {
  const cases: ApiCase[] = book.cases.rows.map((row, n) => {
    const r = reader(row, map, values);
    const delivered = r.list("delivered");
    const deposited = r.list("deposited") !== "no";
    return {
      reference: r.raw("reference") || `Row ${n + 2}`,
      accused: [accusedFrom(r)],
      cheques: [chequeFrom(r)],
      notices: [
        {
          natureOfDebt: r.list("natureDebt"),
          dispatchedOn: sheetDate(r.raw("dispatchDate")),
          mode: r.list("mode"),
          trackingNumber: r.raw("tracking"),
          delivered: delivered === "yes" ? true : delivered === "no" ? false : null,
          deliveredOn: sheetDate(r.raw("deliveryDate")),
          returnedOn: sheetDate(r.raw("noticeReturnDate")),
          nonDeliveryReason: r.list("nonDelivery"),
          replied: r.list("replied") === "yes",
          // Without a payment column, an amount paid over zero means part payment.
          payment:
            r.list("payment") === "part" || (!isMapped(map.payment) && Number(r.raw("paidAmount").replace(/[^\d.]/g, "")) > 0)
              ? { status: "part", amount: r.raw("paidAmount") }
              : { status: "none" },
        },
      ],
      jurisdiction: {
        depositedInOwnAccount: deposited,
        complainantBranchIfsc: r.raw("payeeIfsc"),
        drawerBranchPoliceStation: r.raw("drawerPolice"),
      },
      condonationReason: r.raw("condonation"),
    };
  });

  // The repeat sheets are the template's own, so they are read by header, not mapped.
  const extra = (sheet: Sheet | null, add: (c: ApiCase, r: ReturnType<typeof reader>) => void) => {
    if (!sheet) return;
    const m = autoMap(sheet.headers);
    for (const row of sheet.rows) {
      const r = reader(row, m, values);
      const c = cases.find((x) => x.reference === r.raw("reference"));
      if (c) add(c, r);
    }
  };
  extra(book.extraCheques, (c, r) => c.cheques.push(chequeFrom(r)));
  extra(book.extraAccused, (c, r) => c.accused.push(accusedFrom(r)));

  return {
    source: { system: "Excel upload", reference: batch.fileName },
    complainant: batch.complainant,
    advocates: [{ barNumber: batch.barNumber }],
    adr: batch.adr,
    cases,
  };
}
