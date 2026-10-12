/**
 * Bar-council register — a stand-in.
 *
 * There is no public API to look an advocate up in today, so this is a fixed list the
 * bar-number field searches against. It exists to settle the *interaction*: you know your
 * registration number, you type it, and the name comes back from the register rather than
 * being re-keyed and mistyped onto the Vakalatnama.
 *
 * ENGINEERING SEAM — replace `searchAdvocates` with the real registry call. It is async
 * and returns a promise on purpose: the screen already handles the pending state, so
 * swapping the body for `fetch` needs no change above it. Everything else about the field
 * (free typing, an unlisted number being accepted) must survive that swap, because the
 * register will never be complete.
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
};

const REGISTER: RegisteredAdvocate[] = [
  { barNumber: "K/0421/2004", name: "Anitha Raveendran" },
  { barNumber: "K/0876/2007", name: "Deepak Menon" },
  { barNumber: "K/1109/2009", name: "Fathima Beevi Rasheed" },
  { barNumber: "K/1204/2011", name: "Ramesh Nair" },
  { barNumber: "K/1533/2012", name: "Sreelakshmi Pillai" },
  { barNumber: "K/1877/2014", name: "Joseph Mathew" },
  { barNumber: "K/2140/2015", name: "Nazeer Muhammed" },
  { barNumber: "K/2306/2016", name: "Lakshmi Gopinath" },
  { barNumber: "K/2588/2017", name: "Vishnu Prasad" },
  { barNumber: "K/2914/2019", name: "Aparna Krishnan" },
  { barNumber: "K/3077/2020", name: "Thomas Kurian" },
  { barNumber: "K/3312/2021", name: "Meera Sudhakaran" },
];

/** Matches on number or name, so a half-remembered registration still finds its row. */
export async function searchAdvocates(query: string): Promise<RegisteredAdvocate[]> {
  const q = query.trim().toLowerCase();
  if (!q) return REGISTER.slice(0, 8);
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
