/**
 * How the court will read a value from the filer's file: "1,40,500" as ₹1,40,500,
 * "14/10/2026" as 14 Oct 2026, "INSUFFICIENT FUNDS" as Funds insufficient. Match columns
 * shows it under a chosen column, and the case preview reads a whole row back this way, so
 * a column matched to the wrong field shows itself ("Not a date") instead of looking fine.
 */
import { answerFor, sheetDate, type ValueMap } from "./excel";
import { LISTS, listValue, matchTemplateHeader, normHeader, parseHeader, type Column } from "./excel-spec";

export type ReadBack =
  /** Read as the court will file it. */
  | { kind: "ok"; text: string }
  /** A list word the court does not know yet: Match values takes it. */
  | { kind: "word"; text: string }
  /** Not what the field takes, with what it should be. */
  | { kind: "bad"; text: string; note: string }
  | { kind: "empty" };

/**
 * Whether a field's values can be checked at all: dates, amounts, numbers, mobiles,
 * pincodes, IFSCs, emails, cheque numbers and list answers. A name or an address can hold
 * anything, so a column matched to one is never shown as confirmed.
 */
export function isCheckable(column: Column): boolean {
  return column.kind !== "text" || /(Pin|Ifsc|Email)$/.test(column.key) || column.key === "chequeNumber";
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const rupees = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 2 });

export function readBack(column: Column, raw: string, values: ValueMap = {}): ReadBack {
  const v = raw.trim();
  if (!v) return { kind: "empty" };
  const bad = (note: string): ReadBack => ({ kind: "bad", text: v, note });
  if (/Pin$/.test(column.key)) return /^\d{6}$/.test(v.replace(/\s/g, "")) ? { kind: "ok", text: v } : bad("Not a pincode");
  if (/Ifsc$/.test(column.key))
    return /^[A-Z]{4}0[A-Z0-9]{6}$/i.test(v) ? { kind: "ok", text: v.toUpperCase() } : bad("Not an IFSC");
  if (column.key === "chequeNumber")
    return /^\d{6}$/.test(v.replace(/\s/g, "")) ? { kind: "ok", text: v } : bad("Not a 6-digit cheque number");
  if (/Email$/.test(column.key)) return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) ? { kind: "ok", text: v } : bad("Not an email");
  switch (column.kind) {
    case "date": {
      const iso = sheetDate(v);
      const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
      if (!m || Number(m[2]) < 1 || Number(m[2]) > 12) return bad("Not a date");
      return { kind: "ok", text: `${Number(m[3])} ${MONTHS[Number(m[2]) - 1]} ${m[1]}` };
    }
    case "number": {
      const n = v.replace(/[₹,\s]|rs\.?/gi, "");
      if (!/^\d+(\.\d+)?$/.test(n)) return bad(/amount/i.test(column.key) ? "Not an amount" : "Not a number");
      return { kind: "ok", text: /amount/i.test(column.key) ? `₹${rupees.format(Number(n))}` : n };
    }
    case "phone": {
      const d = v.replace(/^\+?91[\s-]?/, "").replace(/\D/g, "").replace(/^0/, "");
      return d.length === 10 ? { kind: "ok", text: `${d.slice(0, 5)} ${d.slice(5)}` } : bad("Not a mobile number");
    }
    case "list": {
      if (!column.list) return { kind: "ok", text: v };
      const value = listValue(column.list, v) ?? answerFor(values, column, v);
      if (value === null) return { kind: "word", text: v };
      return { kind: "ok", text: LISTS[column.list].find((o) => o.value === value)?.label ?? v };
    }
    default:
      return { kind: "ok", text: v };
  }
}

/**
 * Whether the file's column is one the court knows for this field by its name: the
 * template's own header, the field's name, or a known alias ("Bounce Reason" for Return
 * reason), numbering aside.
 */
export function namedFor(column: Column, header: string): boolean {
  const t = matchTemplateHeader(header);
  if (t) return t.column.key === column.key;
  const base = normHeader(parseHeader(header).base);
  return [column.header, ...column.aliases].some((h) => normHeader(h) === base);
}

/**
 * What Match columns can say about a column matched to a field:
 * - "confirmed": its name is one the court knows for the field and its values fit. Two
 *   signals agree, so the screen can show a tick.
 * - "plain": the filer chose a column of another name and its values have the right form;
 *   the screen shows examples and leaves the judgement to the filer, since a date column or
 *   a number column fits any date or number field.
 * - "bad": its values are not what the field takes, or are a running serial (1, 2, 3…)
 *   under a number field.
 */
export type Verdict =
  | { kind: "confirmed" | "plain"; examples: string[] }
  | { kind: "bad"; note: string };

/** Prose the court files whole: a relief, the affidavit, what a witness will prove. */
const PROSE = new Set(["interimRelief", "finalRelief", "affidavit", "otherDetails", "witnessProve", "condonation"]);
/** People's names. */
const NAMES = new Set(["accusedName", "personName", "witnessName"]);
/** Addresses and places. */
const PLACES = new Set([
  "accusedAddress", "accusedCity", "accusedPolice", "personAddress", "personCity", "personPolice",
  "witnessAddress", "witnessCity", "payeePolice", "drawerPolice", "otherCourt",
]);

/** A value that is a number or an identifier (digits in a short token), not words. */
const idLike = (v: string) => /^[\d\s.,/()+-]+$/.test(v) || (/\d/.test(v) && !/\s/.test(v) && v.length <= 24);

/**
 * What a field's values usually look like, beyond their type: a column that breaks it is
 * flagged even though any text passes as text. A list answer repeats across rows (a column
 * with a different value in nearly every row is a reference or a serial, not Individual or
 * Institution); a name is words and mostly differs row to row; an address or a place is
 * words; a relief or an affidavit is a passage, not a label. Null when nothing is unusual.
 */
export function unusualFor(column: Column, values: string[]): string | null {
  const filled = values.map((v) => v.trim()).filter(Boolean);
  if (filled.length < 3) return null;
  const share = (test: (v: string) => boolean) => filled.filter(test).length / filled.length;
  const distinct = new Set(filled.map((v) => v.toLowerCase())).size;
  if (column.kind === "list" && column.list) {
    const options = LISTS[column.list].length;
    const tooVaried = filled.length >= 6 && distinct > Math.max(8, options * 2) && distinct / filled.length > 0.5;
    const ids = column.list !== "yesNo" && share((v) => idLike(v) && listValue(column.list!, v) === null) > 0.5;
    return tooVaried || ids ? "Not like the court's options" : null;
  }
  if (PROSE.has(column.key)) {
    const lengths = filled.map((v) => v.length).sort((x, y) => x - y);
    return lengths[Math.floor(lengths.length / 2)] < 40 ? "Too short for this field" : null;
  }
  if (NAMES.has(column.key)) {
    if (share(idLike) > 0.3) return "Doesn't look like names";
    if (filled.length >= 8 && distinct / filled.length < 0.3) return "Doesn't look like names";
    return null;
  }
  if (PLACES.has(column.key)) {
    if (share(idLike) > 0.3) return column.key.endsWith("Address") ? "Doesn't look like an address" : "Doesn't look like places";
    return null;
  }
  return null;
}

export function judgeColumn(column: Column, header: string, values: string[], picks: ValueMap = {}): Verdict {
  const filled = values.map((v) => v.trim()).filter(Boolean).slice(0, 25);
  const read = filled.map((v) => readBack(column, v, picks));
  const bad = read.filter((r): r is Extract<ReadBack, { kind: "bad" }> => r.kind === "bad");
  if (bad.length && bad.length * 2 >= read.length) return { kind: "bad", note: bad[0].note };
  const odd = unusualFor(column, values);
  if (odd) return { kind: "bad", note: odd };
  if (column.kind === "number") {
    const n = filled.slice(0, 6).map((v) => Number(v.replace(/[₹,\s]|rs\.?/gi, "")));
    if (n.length >= 3 && n.every((x, k) => k === 0 || x === n[k - 1] + 1)) return { kind: "bad", note: "Looks like a serial number" };
  }
  // The cells as the filer typed them: the screen shows the filer's own data, not a reading.
  const examples = [...new Set(filled)].slice(0, 2);
  return { kind: namedFor(column, header) ? "confirmed" : "plain", examples };
}
