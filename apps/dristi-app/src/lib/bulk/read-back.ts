/**
 * How the court will read a value from the filer's file: "1,40,500" as ₹1,40,500,
 * "14/10/2026" as 14 Oct 2026, "INSUFFICIENT FUNDS" as Funds insufficient. Match columns
 * shows it under a chosen column, and the case preview reads a whole row back this way, so
 * a column matched to the wrong field shows itself ("Not a date") instead of looking fine.
 */
import { sheetDate, type ValueMap } from "./excel";
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
      const value = listValue(column.list, v) ?? values[column.list]?.[v] ?? null;
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

export function judgeColumn(column: Column, header: string, values: string[], picks: ValueMap = {}): Verdict {
  const filled = values.map((v) => v.trim()).filter(Boolean).slice(0, 25);
  const read = filled.map((v) => readBack(column, v, picks));
  const bad = read.filter((r): r is Extract<ReadBack, { kind: "bad" }> => r.kind === "bad");
  if (bad.length && bad.length * 2 >= read.length) return { kind: "bad", note: bad[0].note };
  if (column.kind === "number") {
    const n = filled.slice(0, 6).map((v) => Number(v.replace(/[₹,\s]|rs\.?/gi, "")));
    if (n.length >= 3 && n.every((x, k) => k === 0 || x === n[k - 1] + 1)) return { kind: "bad", note: "Looks like a serial number" };
  }
  const examples = [...new Set(read.flatMap((r) => ("text" in r ? [r.text] : [])))].slice(0, 2);
  return { kind: namedFor(column, header) ? "confirmed" : "plain", examples };
}
