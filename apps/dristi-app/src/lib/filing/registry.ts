/**
 * Bar-council register — a stand-in.
 *
 * There is no public API to look an advocate up in today, so this is a fixed list the
 * advocate field searches by name, bar number or mobile number. It exists to settle the
 * *interaction*: you know your registration number, you type it, and the name comes back
 * from the register rather than being re-keyed and mistyped onto the Vakalatnama.
 *
 * ENGINEERING SEAM — replace `searchAdvocates` with the real registry call. It is async
 * and returns a promise on purpose: the screen already handles the pending state, so
 * swapping the body for `fetch` needs no change above it. Everything else about the field
 * (free typing, an unlisted number being accepted) must survive that swap, because the
 * register will never be complete. The real register must hold mobile numbers for the
 * mobile search to work, and must keep the full-number rule on the server.
 */

export type RegisteredAdvocate = {
  barNumber: string;
  name: string;
  /**
   * Which Bar Council enrolled them, where a register says so. The advocate search does
   * not know it (owner, 2026-10-12: "we won't actually know"), so it is absent there and
   * the search shows the name and the bar number only; the bar number's prefix already
   * says the state (`K`, `G`, `P`).
   */
  bar?: string;
  /**
   * The mobile number registered with the court portal. Searched on, never shown: the
   * search answers only to the full number, so it confirms a number the filer already
   * has and cannot be used to collect advocates' numbers digit by digit.
   */
  mobile?: string;
};

const REGISTER: RegisteredAdvocate[] = [
  { barNumber: "K/0421/2004", name: "Anitha Raveendran", mobile: "9000010421" },
  { barNumber: "K/0876/2007", name: "Deepak Menon", mobile: "9000010876" },
  { barNumber: "K/1109/2009", name: "Fathima Beevi Rasheed", mobile: "9000011109" },
  { barNumber: "K/1204/2011", name: "Ramesh Nair", mobile: "9000011204" },
  { barNumber: "K/1533/2012", name: "Sreelakshmi Pillai", mobile: "9000011533" },
  { barNumber: "K/1877/2014", name: "Joseph Mathew", mobile: "9000011877" },
  { barNumber: "K/2140/2015", name: "Nazeer Muhammed", mobile: "9000012140" },
  { barNumber: "K/2306/2016", name: "Lakshmi Gopinath", mobile: "9000012306" },
  { barNumber: "K/2588/2017", name: "Vishnu Prasad", mobile: "9000012588" },
  { barNumber: "K/2914/2019", name: "Aparna Krishnan", mobile: "9000012914" },
  { barNumber: "K/3077/2020", name: "Thomas Kurian", mobile: "9000013077" },
  { barNumber: "K/3312/2021", name: "Meera Sudhakaran", mobile: "9000013312" },
];

/**
 * A typed mobile number, as its last ten digits — or `null` while the query is anything
 * else. "+91 90000 10421" and "090000-10421" are the same number; nine digits are not one.
 */
export function asMobileQuery(query: string): string | null {
  if (!/^[\d\s+()-]+$/.test(query.trim())) return null;
  const digits = query.replace(/\D/g, "");
  return digits.length >= 10 && digits.length <= 12 ? digits.slice(-10) : null;
}

/**
 * Matches on number or name, so a half-remembered registration still finds its row; a
 * full mobile number finds the advocate it belongs to, and only a full one (see `mobile`).
 */
export async function searchAdvocates(query: string): Promise<RegisteredAdvocate[]> {
  const q = query.trim().toLowerCase();
  if (!q) return REGISTER.slice(0, 8);
  const mobile = asMobileQuery(q);
  if (mobile) return REGISTER.filter((a) => a.mobile === mobile);
  return REGISTER.filter(
    (a) =>
      a.barNumber.toLowerCase().includes(q) || a.name.toLowerCase().includes(q)
  ).slice(0, 8);
}

/** Exact-number lookup — used to tell "on the register" from "typed by hand". */
export function findAdvocate(barNumber: string): RegisteredAdvocate | undefined {
  const key = barNumber.trim().toUpperCase();
  if (!key) return undefined;
  return REGISTER.find((a) => a.barNumber.toUpperCase() === key);
}

/* ───────────────────────────── ON Court register ───────────────────── */

/**
 * What a returning litigant already has on file. Same seam as above: the real service
 * answers this from the court's own records once the number is verified by OTP.
 *
 * ENGINEERING SEAM — replace `fetchOnCourtRecord` with that call. Verification and the
 * fetch are one step on purpose; do not split them, because the OTP is what authorises
 * reading someone's saved address back onto a screen.
 */
export type OnCourtRecord = {
  name: string;
  email: string;
  age: string;
  address: {
    line1: string;
    city: string;
    pin: string;
    district: string;
    state: string;
  };
};

const ON_COURT: Record<string, OnCourtRecord> = {
  "9847012345": {
    name: "Prateek Sharma",
    email: "prateek.sharma@example.com",
    age: "47",
    address: {
      line1: "14/337, Cantonment Road, Vadakkevila",
      city: "Sample District",
      pin: "691010",
      district: "Sample District",
      state: "Kerala",
    },
  },
  "9995566778": {
    name: "Lakshmi Gopinath",
    email: "lakshmi.g@example.com",
    age: "39",
    address: {
      line1: "Sreyas, TC 22/1180, Beach Road",
      city: "Sample District",
      pin: "691001",
      district: "Sample District",
      state: "Kerala",
    },
  },
};

/** `null` when the number is not on the register — the common case, and not an error. */
export async function fetchOnCourtRecord(mobile: string): Promise<OnCourtRecord | null> {
  const key = mobile.replace(/\D/g, "").slice(-10);
  return ON_COURT[key] ?? null;
}
