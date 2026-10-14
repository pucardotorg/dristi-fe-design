/**
 * What each state charges, as the filing bill and the vakalatnama read it.
 *
 * Kerala's schedule is the one the product was built with, so it is the existing
 * constants verbatim: switching back to Kerala must not move a rupee. The other two come
 * from the stakeholders' "Payment Logic" (schedule 2 Gujarat, schedule 3 Punjab and
 * Haryana — one schedule, both states). Lines the document marks NIL are left out rather
 * than billed at zero.
 *
 * ENGINEERING SEAM — as with `COURT_FEE_LINES`, a live deployment reads these from the
 * court's fee master. Keep the shape.
 */

import { CONDONATION_FEE, COURT_FEE_LINES, type FeeLine } from "@/lib/filing/options";

export type FeeSchedule = {
  /** Due before the complaint is registered. */
  court: FeeLine[];
  /** Added when the complaint is filed after the limitation period. */
  condonation: FeeLine;
  /**
   * The court fee on each process round. `null` keeps each process's own fee
   * (`PROCESS_OPTIONS`); a number replaces all of them.
   */
  process: { fee: number; name?: string } | null;
  /** What an advocate joining by vakalatnama pays. */
  join: { courtFee: number; welfareFund: number };
  /**
   * How the join-a-case vakalatnama fee is billed when it names several advocates.
   * `per-advocate`: the advocate who joins first pays for everyone named. `flat`: one
   * fee for the vakalatnama, whatever the number named (owner, 2026-10-13, for Gujarat
   * and Punjab & Haryana).
   */
  joinBilling: "per-advocate" | "flat";
};

export const KERALA_FEES: FeeSchedule = {
  court: COURT_FEE_LINES,
  condonation: CONDONATION_FEE,
  process: null,
  // The vakalatnama's own figures (`lib/vakalatnama/data.ts`).
  join: { courtFee: 10, welfareFund: 25 },
  joinBilling: "per-advocate",
};

/** Schedule 2. */
export const GUJARAT_FEES: FeeSchedule = {
  court: [
    {
      key: "court-fee",
      label: "Court fee",
      amount: 3,
      note: "Charged as stamps on the main complaint.",
    },
    { key: "advocate-welfare", label: "Advocate Welfare Fund", amount: 20 },
    {
      key: "vakalatnama",
      label: "Vakalatnama court fee",
      amount: 2,
      per: "advocate",
    },
    { key: "affidavit", label: "Affidavit fee", amount: 2, per: "affidavit" },
    // The schedule's "Application fee, ₹3 per application" is for applications made in
    // the case. The one application a filing can carry — condonation — is billed below.
  ],
  condonation: {
    ...CONDONATION_FEE,
    amount: 3,
  },
  process: { fee: 3 },
  // ₹20 to the Advocate Welfare Fund and a ₹2 court fee stamp: ₹22, once per
  // vakalatnama however many advocates it names (owner, 2026-10-14).
  join: { courtFee: 2, welfareFund: 20 },
  joinBilling: "flat",
};

/** Schedule 3 — Punjab and Haryana alike. */
export const PUNJAB_HARYANA_FEES: FeeSchedule = {
  court: [
    { key: "court-fee", label: "Court fee", amount: 10, needsAdvocate: true },
    { key: "advocate-welfare", label: "Advocate Welfare Fund", amount: 50 },
    {
      key: "vakalatnama",
      label: "Vakalatnama court fee",
      amount: 2,
      per: "advocate",
    },
  ],
  condonation: {
    ...CONDONATION_FEE,
    amount: 10,
  },
  // ASSUMPTION — the schedule says "Process fees (Talwana) ₹50" without a unit. Billed
  // per process, the way Gujarat's ₹3 is, until the state says otherwise.
  process: { fee: 50, name: "Talwana" },
  join: { courtFee: 2, welfareFund: 50 },
  joinBilling: "flat",
};
