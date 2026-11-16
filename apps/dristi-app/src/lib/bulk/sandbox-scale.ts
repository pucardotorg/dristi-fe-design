/**
 * Sandbox data at scale: 300 fictional §138 cases for one lender, to see how bulk filing
 * holds up at the size a recovery team actually files (owner, 2026-11-16). Deterministic,
 * so every run and every reviewer sees the same batch.
 *
 * Three scenarios, used by both ways in: the Excel samples (`scripts/bulk-demo-files.mts`)
 * and the sandbox push from a client's system (`sandboxPush`).
 *
 *  · `clean`  — a well-kept book: nearly every case goes straight through; a handful of
 *               warnings (a late presentation, a notice returned unclaimed).
 *  · `gaps`   — what a real export brings: cheques and notices with missing dates and
 *               police stations, values the lists don't know, a few rows Check leaves out.
 *  · `mixed`  — every edge at once: two accused, two cheques, institutions with a person
 *               responsible, part payments, cases past the limit, and own facts of the case
 *               for a quarter of the rows.
 */

import type { ApiBatchRequest, ApiCase } from "./contract";
import { CLIENTS, OFFICE_ADVOCATES } from "./clients";

export type ScaleScenario = "clean" | "gaps" | "mixed";

export const SCALE_SIZE = 300;

export const SCALE_SCENARIOS: { id: ScaleScenario; label: string; detail: string }[] = [
  { id: "clean", label: "300 cases, a well-kept book", detail: "Nearly all go straight through" },
  { id: "gaps", label: "300 cases with gaps", detail: "Missing dates, unknown values, rows left out" },
  { id: "mixed", label: "300 cases, every edge", detail: "Two accused or cheques, own facts, late cases" },
];

/** One case, in the demo generator's own shape (`Demo` in the script). */
export type ScaleCase = {
  ref: string;
  name: string;
  type: "individual" | "institution";
  entity?: string;
  person?: [string, string, string];
  age?: string;
  mobile: string;
  email: string;
  address: string;
  city: string;
  pin: string;
  police: string;
  cheque: string;
  amount: number;
  ifsc: string;
  account: string;
  reason: string;
  mode: "rpad" | "speed";
  served: number;
  presentedLate?: boolean;
  delivered: boolean;
  replied?: boolean;
  paid?: number;
  second?: { cheque: string; amount: number };
  coAccused?: { name: string; age: string; mobile: string };
  /** Facts of the case the advocate wrote into the row. */
  story?: string;
  /** What the export leaves out (gaps): blank in the sheet, empty in the push. */
  missing?: ("chequeDate" | "presentDate" | "police" | "deliveryDate")[];
  /** A value the lists don't know, as a lender's system writes it (gaps). */
  oddReason?: string;
};

/* A small seeded generator: the same 300 cases every time. */
function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}

const FIRST = ["Harsh", "Snehal", "Pravin", "Mitali", "Rakesh", "Jayesh", "Kinjal", "Devang", "Imran", "Nirali", "Bhavesh", "Hetal", "Ketan", "Pooja", "Chirag", "Komal", "Vishal", "Rupal", "Tushar", "Ankita", "Manish", "Dhara", "Sagar", "Foram", "Yash", "Riddhi", "Alpesh", "Bhumi", "Jignesh", "Nisha", "Sunil", "Krupa", "Mehul", "Hiral", "Paresh", "Avni", "Dhaval", "Jinal", "Nilesh", "Payal"];
const MIDDLE = "ABCDEGHJKMNPRSV";
const LAST = ["Bhavsar", "Mistry", "Solanki", "Shah", "Prajapati", "Rana", "Trivedi", "Joshi", "Shaikh", "Patel", "Desai", "Mehta", "Parmar", "Chauhan", "Thakkar", "Vora", "Pandya", "Raval", "Modi", "Dave", "Bhatt", "Gohil", "Makwana", "Soni", "Panchal"];
const FIRMS = ["Sarthak Packaging Pvt Ltd", "Anand Fabricators", "Shree Ganesh Traders", "Om Sai Logistics", "Navkar Textiles", "Riddhi Siddhi Agro", "Jalaram Electricals", "Krishna Polymers", "Umiya Steel Works", "Ambica Interiors"];
const PLACES: { area: string; pin: string; police: string; ifsc: string }[] = [
  { area: "Vastrapur", pin: "380015", police: "Vastrapur Police Station", ifsc: "SBIN0060421" },
  { area: "Naranpura", pin: "380013", police: "Naranpura Police Station", ifsc: "HDFC0000521" },
  { area: "Maninagar", pin: "380008", police: "Maninagar Police Station", ifsc: "BARB0MANINA" },
  { area: "Bopal", pin: "380058", police: "Bopal Police Station", ifsc: "KKBK0002561" },
  { area: "Naroda", pin: "382330", police: "Naroda Police Station", ifsc: "PUNB0458600" },
  { area: "Satellite", pin: "380015", police: "Satellite Police Station", ifsc: "ICIC0000317" },
  { area: "Bodakdev", pin: "380054", police: "Vastrapur Police Station", ifsc: "UTIB0000080" },
  { area: "Navrangpura", pin: "380009", police: "Navrangpura Police Station", ifsc: "SBIN0060421" },
  { area: "Paldi", pin: "380006", police: "Paldi Police Station", ifsc: "CNRB0002627" },
  { area: "Juhapura", pin: "380055", police: "Vejalpur Police Station", ifsc: "BARB0MANINA" },
  { area: "Odhav", pin: "382415", police: "Odhav Police Station", ifsc: "KKBK0002561" },
];
const SOCIETIES = ["Sundaram Flats", "Gokul Row Houses", "Shreeji Society", "Orchid Greens", "Shiv Shakti Nagar", "Sahjanand Park", "Satyam Tenements", "Rajpath Bungalows", "Nilkanth Society", "Al-Burhan Park", "Shivalik Bungalows", "Parshwanath Nagar"];
const REASONS = ["funds-insufficient", "funds-insufficient", "funds-insufficient", "exceeds-arrangement", "payment-stopped", "account-closed"];
const ODD = ["INSUFF FUNDS", "A/C CLOSED", "Exceeds arrangement.", "PAYMENT STOPPED BY DRAWER", "Funds Insuff"];
const STORY = [
  "The accused availed a personal loan from the complainant's C G Road branch and paid the early instalments regularly before defaulting. On follow-up, the accused admitted the dues in writing and issued the cheque in question towards part discharge.",
  "The accused, a salaried employee, took the loan to meet medical expenses in the family. After the default, the branch agreed a revised schedule with the accused, under which the cheque in question was issued and later returned unpaid.",
  "The accused firm availed a working-capital facility for its business. Its partner signed the loan agreement and the cheque in question on behalf of the firm and was in charge of its business at the time of the offence.",
];

/** The 300 cases of one scenario. */
export function scaleCases(scenario: ScaleScenario, n = SCALE_SIZE): ScaleCase[] {
  const r = rng(scenario === "clean" ? 138 : scenario === "gaps" ? 2026 : 300);
  const pick = <T,>(xs: readonly T[]) => xs[Math.floor(r() * xs.length)];
  const out: ScaleCase[] = [];
  for (let i = 0; i < n; i += 1) {
    const place = pick(PLACES);
    const firm = scenario !== "clean" && r() < 0.12;
    const name = firm ? `${pick(FIRMS)}${r() < 0.5 ? "" : ` (${place.area})`}` : `${pick(FIRST)} ${pick(MIDDLE.split(""))}. ${pick(LAST)}`;
    const product = firm ? "BL" : r() < 0.2 ? "TL" : "PL";
    const amount = Math.round((40_000 + r() * (firm ? 600_000 : 260_000)) / 50) * 50;
    const c: ScaleCase = {
      ref: `TCL-AHD-${product}-${String(3001 + i)}`,
      name,
      type: firm ? "institution" : "individual",
      ...(firm ? { entity: r() < 0.5 ? "partnership" : "private-limited", person: [`${pick(FIRST)} ${pick(MIDDLE.split(""))}. ${pick(LAST)}`, r() < 0.5 ? "Partner" : "Managing Director", `98790${String(44000 + i).padStart(5, "0")}`] as [string, string, string] } : { age: String(24 + Math.floor(r() * 40)) }),
      mobile: `98${String(70000000 + i * 37).padStart(8, "0")}`,
      email: `${name.toLowerCase().replace(/[^a-z]+/g, ".").replace(/^\.|\.$/g, "")}@mail.example`,
      address: `${1 + Math.floor(r() * 60)}, ${pick(SOCIETIES)}, ${place.area}`,
      city: "Ahmedabad",
      pin: place.pin,
      police: place.police,
      cheque: String(100000 + Math.floor(r() * 899999)),
      amount,
      ifsc: place.ifsc,
      account: String(Math.floor(1e10 + r() * 9e10)),
      reason: pick(REASONS),
      mode: r() < 0.7 ? "rpad" : "speed",
      // Served 15–24 days ago: inside the one-month limit, as a team files them.
      served: 15 + Math.floor(r() * 10),
      delivered: r() > (scenario === "clean" ? 0.02 : 0.08),
      replied: r() < 0.05,
    };
    if (scenario === "clean") {
      if (i % 75 === 10) c.presentedLate = true;
    }
    if (scenario === "gaps") {
      const roll = r();
      if (roll < 0.1) c.missing = ["chequeDate"];
      else if (roll < 0.16) c.missing = ["presentDate", "police"];
      else if (roll < 0.2) c.missing = ["deliveryDate"];
      if (r() < 0.15) c.oddReason = pick(ODD);
    }
    if (scenario === "mixed") {
      if (i % 10 === 3) c.coAccused = { name: `${pick(FIRST)} ${pick(MIDDLE.split(""))}. ${pick(LAST)}`, age: String(25 + Math.floor(r() * 35)), mobile: `97${String(70000000 + i * 41).padStart(8, "0")}` };
      if (i % 10 === 6) c.second = { cheque: String(Number(c.cheque) + 1), amount: Math.round(amount * 0.6 / 50) * 50 };
      if (i % 4 === 1) c.story = pick(STORY);
      if (i % 20 === 9) c.served = 40 + Math.floor(r() * 30);
      if (i % 25 === 5) c.paid = Math.round(amount * 0.2 / 50) * 50;
      if (i % 60 === 30) c.presentedLate = true;
    }
    out.push(c);
  }
  return out;
}

/* ───────────────────────────── The push ───────────────────────────── */

const iso = (daysAgo: number) => {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() - daysAgo);
  return d.toISOString().slice(0, 10);
};

function apiCase(c: ScaleCase): ApiCase {
  const miss = new Set(c.missing ?? []);
  const t = { served: c.served, dispatched: c.served + 8, returned: c.served + 14, presented: c.served + 17, dated: c.served + (c.presentedLate ? 110 : 30) };
  const cheque = (number: string, amount: number) => ({
    number,
    date: miss.has("chequeDate") ? "" : iso(t.dated),
    amount: String(amount),
    ifsc: c.ifsc,
    accountNumber: c.account,
    presentedOn: miss.has("presentDate") ? "" : iso(t.presented),
    returnedOn: iso(t.returned),
    returnReason: c.oddReason ?? c.reason,
  });
  const accused = (name: string, type: ScaleCase["type"], age?: string, mobile?: string) => ({
    type,
    name,
    ...(age ? { age } : {}),
    ...(type === "institution" ? { institutionType: c.entity } : {}),
    mobile: mobile ?? c.mobile,
    email: c.email,
    addresses: [{ line1: c.address, city: c.city, pin: c.pin, policeStation: miss.has("police") ? "" : c.police }],
    ...(type === "institution" && c.person ? { personsResponsible: [{ name: c.person[0], designation: c.person[1], mobile: c.person[2] }] } : {}),
    withinJurisdiction: true,
  });
  return {
    reference: c.ref,
    accused: [accused(c.name, c.type, c.age), ...(c.coAccused ? [accused(c.coAccused.name, "individual", c.coAccused.age, c.coAccused.mobile)] : [])],
    cheques: [cheque(c.cheque, c.amount), ...(c.second ? [cheque(c.second.cheque, c.second.amount)] : [])],
    notices: [
      {
        natureOfDebt: "loan",
        dispatchedOn: iso(t.dispatched),
        mode: c.mode,
        trackingNumber: `RG${c.cheque}11IN`,
        delivered: c.delivered,
        deliveredOn: c.delivered && !miss.has("deliveryDate") ? iso(t.served) : "",
        returnedOn: c.delivered ? "" : iso(t.served),
        nonDeliveryReason: c.delivered ? "" : "unclaimed",
        replied: !!c.replied,
        payment: c.paid ? { status: "part" as const, amount: String(c.paid) } : { status: "none" as const },
      },
    ],
    jurisdiction: {
      depositedInOwnAccount: true,
      complainantBranchIfsc: "HDFC0000060",
      complainantBranchPoliceStation: "Navrangpura Police Station",
      otherPending: false,
      otherPendingCases: [],
    },
    ...(c.story ? { otherDetails: c.story } : {}),
  } as ApiCase;
}

/** A client's push of one scenario's 300 cases, as Provakil would send it (§3). */
export function sandboxPush(scenario: ScaleScenario): ApiBatchRequest {
  const client = CLIENTS[0];
  const you = OFFICE_ADVOCATES.find((a) => a.you) ?? OFFICE_ADVOCATES[0];
  return {
    source: { system: "Provakil", reference: `PV-SANDBOX-${scenario.toUpperCase()}-${SCALE_SIZE}`, sentBy: "Sandbox" },
    complainant: client.complainant,
    advocates: [{ barNumber: you.barNumber }],
    adr: "no",
    cases: scaleCases(scenario).map(apiCase),
  } as ApiBatchRequest;
}
