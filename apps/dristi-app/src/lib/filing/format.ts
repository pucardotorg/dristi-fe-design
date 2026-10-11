/** Formatting helpers for the e-filing flow. Dates in the draft are ISO `yyyy-mm-dd`. */

import { format, isValid, parse, parseISO } from "date-fns";

import type { Address, ISODate } from "./types";

/** ISO → `dd/mm/yyyy` (court forms) or "" when unset. */
export function toDisplayDate(iso: ISODate): string {
  if (!iso) return "";
  const d = parseISO(iso);
  return isValid(d) ? format(d, "dd/MM/yyyy") : iso;
}

/** ISO → `15 March 2026` for the court document. */
export function toLongDate(iso: ISODate): string {
  if (!iso) return "";
  const d = parseISO(iso);
  return isValid(d) ? format(d, "d MMMM yyyy") : iso;
}

/** `dd/mm/yyyy` → ISO. Accepts what the demo used as literal strings. */
export function fromDisplayDate(display: string): ISODate {
  if (!display) return "";
  const d = parse(display, "dd/MM/yyyy", new Date());
  return isValid(d) ? format(d, "yyyy-MM-dd") : "";
}

export function isoToDate(iso: ISODate): Date | undefined {
  if (!iso) return undefined;
  const d = parseISO(iso);
  return isValid(d) ? d : undefined;
}

export function dateToIso(d: Date | undefined): ISODate {
  return d && isValid(d) ? format(d, "yyyy-MM-dd") : "";
}

/** Digits → Indian grouping (`5025000` → `50,25,000`). Keeps an already-formatted string. */
export function formatINR(value: string | number): string {
  const digits = String(value ?? "").replace(/[^0-9]/g, "");
  if (!digits) return "";
  const last3 = digits.slice(-3);
  const rest = digits.slice(0, -3);
  const grouped = rest ? rest.replace(/\B(?=(\d{2})+(?!\d))/g, ",") + "," + last3 : last3;
  return grouped;
}

export function amountToNumber(value: string): number {
  const n = Number(String(value ?? "").replace(/[^0-9.]/g, ""));
  return Number.isFinite(n) ? n : 0;
}

export function rupees(value: string | number): string {
  const f = formatINR(value);
  return f ? `₹${f}` : "";
}

/**
 * Money that may carry paise — court fees do (₹12.50), typed cheque amounts do not.
 *
 * `rupees()` above throws away everything that is not a digit, which turns 12.5 into
 * "₹125". Anything derived from the fee schedule has to come through here instead.
 */
export function money(value: number): string {
  if (!Number.isFinite(value)) return "";
  const rounded = Math.round(value * 100) / 100;
  const whole = Math.trunc(Math.abs(rounded));
  const paise = Math.round((Math.abs(rounded) - whole) * 100);
  const grouped = formatINR(whole) || "0";
  return `₹${grouped}${paise ? `.${String(paise).padStart(2, "0")}` : ""}`;
}

export function addressToString(a: Address | undefined): string {
  if (!a) return "";
  return [a.line1, a.city, a.district, a.state, a.pin].filter(Boolean).join(", ");
}

export function joinDot(...parts: Array<string | null | undefined | false>): string {
  return parts.filter(Boolean).join(" · ");
}

/** "Accused 1 and Rajesh Kumar" — names read as a sentence, not as a list. */
export function nameList(labels: string[]): string {
  if (labels.length < 2) return labels[0] ?? "";
  return `${labels.slice(0, -1).join(", ")} and ${labels[labels.length - 1]}`;
}

export function plural(n: number, one: string, many = `${one}s`): string {
  return `${n} ${n === 1 ? one : many}`;
}

/** Whole days between two ISO dates (b − a); null when either is unset. */
export function daysBetween(a: ISODate, b: ISODate): number | null {
  const da = isoToDate(a);
  const db = isoToDate(b);
  if (!da || !db) return null;
  return Math.round((db.getTime() - da.getTime()) / 86_400_000);
}

/** `iso` moved on by `days`, as an ISO date. Empty in, empty out. */
export function addDays(iso: ISODate, days: number): ISODate {
  const d = isoToDate(iso);
  if (!d) return "";
  const out = new Date(d.getTime());
  out.setDate(out.getDate() + days);
  return dateToIso(out);
}

/**
 * `iso` moved on by whole calendar months, clamped to the month's last day (31 Nov is
 * 30 Nov). Empty in, empty out.
 */
export function addMonths(iso: ISODate, months: number): ISODate {
  const d = isoToDate(iso);
  if (!d) return "";
  const day = d.getDate();
  const out = new Date(d.getFullYear(), d.getMonth() + months, 1);
  const last = new Date(out.getFullYear(), out.getMonth() + 1, 0).getDate();
  out.setDate(Math.min(day, last));
  return dateToIso(out);
}

/** Today, as an ISO date. */
export function todayIso(): ISODate {
  return dateToIso(new Date());
}
