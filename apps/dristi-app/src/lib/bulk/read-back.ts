/**
 * How the court will read a value from the filer's file: "1,40,500" as ₹1,40,500,
 * "14/10/2026" as 14 Oct 2026, "INSUFFICIENT FUNDS" as Funds insufficient. Match columns
 * shows it under a chosen column, and the case preview reads a whole row back this way, so
 * a column matched to the wrong field shows itself ("Not a date") instead of looking fine.
 */
import { sheetDate, type ValueMap } from "./excel";
import { LISTS, listValue, type Column } from "./excel-spec";

export type ReadBack =
  /** Read as the court will file it. */
  | { kind: "ok"; text: string }
  /** A list word the court does not know yet: Match values takes it. */
  | { kind: "word"; text: string }
  /** Not what the field takes, with what it should be. */
  | { kind: "bad"; text: string; note: string }
  | { kind: "empty" };

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
