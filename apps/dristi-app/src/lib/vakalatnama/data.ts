/**
 * Defaults, court configuration and the sample bar register for the vakalatnama flow.
 *
 * Court config (CFG-*) is the "build for the state over the national core" seam: one
 * object per court decides the witness policy, whether standing is offered, the standard
 * terms, and the fee schedule. Only the Kerala pilot default is shipped here.
 */

import type { Address, CreatorRole, Terms, Vakalatnama } from "./types";

export const EMPTY_ADDRESS: Address = {
  line1: "",
  city: "",
  pin: "",
  district: "",
  state: "",
};

/**
 * The standard granted powers (TRM-01). Seeded from the conventional §138 vakalatnama;
 * plain, sentence case. Editable in the flow (TRM-02). `[VERIFY]` exact clause set per
 * state before anything authoritative depends on it.
 */
export const STANDARD_TERMS: string[] = [
  "To appear, act and plead for me/us in the above case and in all proceedings arising in it.",
  "To prosecute or defend the case, and any application connected with it or any decree or order passed in it.",
  "To appear in all miscellaneous proceedings until all decrees and orders are fully satisfied or adjusted.",
  "To obtain the return of documents, and to draw and receive any moneys payable to me/us in the case.",
  "To appear and conduct any appeal, and to make applications for leave to appeal to a higher court.",
  "To make applications for review of judgment.",
];

/** One court's configuration (CFG-*). */
export type CourtConfig = {
  court: string;
  /** CFG-02 — standing enabled by default; can be turned off. */
  standingEnabled: boolean;
  /** CFG-05 — indicative until verified (PAY-02). */
  fees: { courtFee: number; welfareFund: number };
  standardTerms: string[];
};

/** Kerala pilot default. Amounts and clause set are `[VERIFY]`. */
export const KERALA_CONFIG: CourtConfig = {
  court: "24×7 ON Court",
  standingEnabled: true,
  fees: { courtFee: 10, welfareFund: 25 },
  standardTerms: STANDARD_TERMS,
};

/**
 * Registered notaries the witness search resolves against (ATT-04 seam). Real courts
 * publish an approved list; here a few rows let the search behave.
 */
export type Notary = { name: string; registration: string; place: string };
export const NOTARY_REGISTRY: Notary[] = [
  { name: "Suresh Kumar", registration: "KL/NOT/2014/0231", place: "Sample District" },
  { name: "Latha Nair", registration: "KL/NOT/2009/0117", place: "Ernakulam" },
  { name: "George Mathew", registration: "KL/NOT/2018/0442", place: "Kochi" },
  { name: "Fathima Beevi", registration: "KL/NOT/2011/0088", place: "Thiruvananthapuram" },
];

/**
 * Filed cases the litigant is already a party to (#3 — the filed-case search). Real
 * lookups hit the court's index for this litigant; here a few rows stand in.
 */
export type FiledCase = { caseNumber: string; title: string; court: string };
export const LITIGANT_CASES: FiledCase[] = [
  { caseNumber: "KL-000482-2025", title: "Cheque bounce v. M. Raghavan", court: "24×7 ON Court" },
  { caseNumber: "KL-001139-2024", title: "Cheque bounce v. Sunrise Traders", court: "JMFC Court, Ernakulam" },
  { caseNumber: "KL-000917-2026", title: "Cheque bounce v. K. Devan", court: "24×7 ON Court" },
];

/** Courts offered in the scope step. Only the 24×7 ON Court is configured; others are stubs. */
export const COURTS: string[] = [
  "24×7 ON Court",
  "JMFC Court, Ernakulam",
  "JMFC Court, Kochi",
];

export function configFor(court: string): CourtConfig {
  // One court is configured in this build; everything else inherits the pilot default.
  return { ...KERALA_CONFIG, court: court || KERALA_CONFIG.court };
}

/**
 * A tiny stand-in for the bar-registry lookup seam (ADV-01). Real lookups hit the state
 * bar; here a handful of rows let the search behave. Enrolment format is Kerala-style.
 */
export type BarAdvocate = { name: string; enrolmentNo: string; place: string };
export const BAR_REGISTER: BarAdvocate[] = [
  { name: "Pradeesh Chacko", enrolmentNo: "K-305/1996", place: "Ernakulam" },
  { name: "Pratap Nair", enrolmentNo: "K-118/2001", place: "Kochi" },
  { name: "Anjali Menon", enrolmentNo: "K-742/2011", place: "Sample District" },
  { name: "Rahul Varma", enrolmentNo: "K-256/2008", place: "Thiruvananthapuram" },
  { name: "Sneha Pillai", enrolmentNo: "K-889/2015", place: "Kottayam" },
];

function terms(): Terms {
  return { source: "standard", clauses: [...STANDARD_TERMS] };
}

function newId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `vak-${Math.abs(Math.floor(performance.now() * 1000))}`;
}

/** A blank vakalatnama. Nothing is seeded — a new one is empty (owner's bar). */
export function blankVak(creatorRole: CreatorRole): Vakalatnama {
  const now = new Date().toISOString();
  const config = KERALA_CONFIG;
  return {
    id: newId(),
    status: "draft",
    createdAt: now,
    updatedAt: now,
    step: 0,
    creatorRole,
    executant: {
      kind: "individual",
      name: "",
      relationType: "",
      relationName: "",
      age: "",
      address: { ...EMPTY_ADDRESS },
      mobile: "",
      idDoc: "",
      orgName: "",
      signatoryName: "",
      signatoryDesignation: "",
    },
    advocates: [],
    scope: {
      type: "specific",
      caseState: "not_filed",
      caseNumber: "",
      draftRef: "",
      court: "",
    },
    terms: terms(),
    attestation: {
      hasWitness: false,
      kind: "notary",
      name: "",
      registration: "",
      mobile: "",
      address: { ...EMPTY_ADDRESS },
      idDoc: "",
      relation: "",
    },
    fees: { courtFee: config.fees.courtFee, welfareFund: config.fees.welfareFund, paid: false },
    signing: [],
  };
}

export function makeAdvocateId(): string {
  return newId();
}
