/**
 * The bank's Section 138 matters, as a Provakil Legal Collections workspace holds them:
 * one per loan account number (LAN), with the borrower, the dishonoured cheque and the
 * demand notice sent under the workflow.
 *
 * The borrowers, cases and officers are fictional. Dates are set relative to today so the demo stays in time:
 * most cases are ripe for filing, a few are not yet, and a few carry the faults scrutiny
 * should catch (see SCENARIOS).
 */

export type Constitution =
  | "Individual"
  | "Sole Proprietorship"
  | "Partnership Firm"
  | "Private Limited Company"
  | "Public Limited Company"
  | "LLP";

export type Stage = "Notice Sent" | "Notice Served" | "Ready for Filing" | "Filed";

export type Address = {
  type: "Residence" | "Office" | "Permanent";
  line: string;
  city: string;
  pincode: string;
  policeStation?: string;
};

export type Person = { name: string; designation: string; mobile?: string; email?: string };

export type Instrument = {
  chequeNo: string;
  chequeDate: string;
  amount: number;
  draweeIfsc: string;
  drawerAccount: string;
  depositDate: string;
  collectingIfsc: string;
  returnDate: string;
  /** As the return memo states it: "01 - Funds Insufficient". */
  returnReason: string;
};

export type Notice = {
  dispatchDate: string;
  mode: "RPAD" | "SPEED POST" | "COURIER" | "EMAIL";
  consignmentNo: string;
  status:
    | "Delivered"
    | "In Transit"
    | "Returned - Unclaimed"
    | "Returned - Refused"
    | "Returned - Addressee Left"
    | "Returned - Insufficient Address";
  statusDate?: string;
  replyReceived: boolean;
};

export type DocTag =
  | "Cheque"
  | "Return memo"
  | "Legal notice"
  | "Postal receipt"
  | "Tracking report"
  | "Reply"
  | "Loan agreement"
  | "Authorised officer ID"
  | "Vakalatnama";

export type MatterDoc = { id: string; tag: DocTag; name: string; index?: number; uploadedOn: string };

export type Matter = {
  id: string;
  lan: string;
  product: string;
  branch: string;
  region: "Ahmedabad West" | "Ahmedabad East" | "Gandhinagar";
  legalManager: string;
  /** Empanelled advocate on the matter; `null` until the legal manager assigns one. */
  advocate: { name: string; enrolment: string } | null;
  npaDate: string;
  dpd: number;
  outstanding: number;
  borrower: {
    name: string;
    constitution: Constitution;
    dob?: string;
    mobile?: string;
    email?: string;
    addresses: Address[];
    /** Directors or partners, for entities. */
    persons: Person[];
  };
  instruments: Instrument[];
  notice: Notice;
  /** Receipts on the loan account after the notice went out, in rupees. */
  receivedAfterNotice: number;
  notes: { at: string; by: string; text: string; tag?: "condonation" }[];
  documents: MatterDoc[];
  labels: string[];
  stage: Stage;
  /** Set once filed: the court's number. */
  cnr?: string;
  /** Where it was filed, once it is. */
  filedOn?: string;
  /** A branch officer who will prove the account, where the legal team named one. */
  witness?: Person & { address: { line: string; city: string; pincode: string } };
  /**
   * The scanned cheque and memo disagree with the record (a typo at data entry): the
   * documents show a different amount. For the AI review to catch.
   */
  docMismatch?: boolean;
};

/* ───────────────────────────── Bank profile ───────────────────────────── */

/**
 * The complainant: set once in the e-filing connector, not per matter. The name and
 * registered office are Tata Capital's public ones; the CIN, officers and contacts are
 * placeholders for the demo.
 */
export const BANK = {
  legalName: "Tata Capital Ltd",
  constitution: "Public Ltd" as const,
  cin: "U65990MH1991PLC000000",
  registeredOffice: { line: "11th Floor, Tower A, Peninsula Business Park, Lower Parel", city: "Mumbai", pincode: "400013" },
  phone: "02266069000",
  email: "legal@tatacapital.example",
};

/** Authorised officer per region, from the bank's board resolution. */
export const OFFICERS: Record<Matter["region"], {
  name: string;
  designation: string;
  dob: string;
  mobile: string;
  email: string;
  office: { line: string; city: string; pincode: string };
}> = {
  "Ahmedabad West": {
    name: "Rajesh K. Patel",
    designation: "Chief Manager, Legal",
    dob: "1978-03-14",
    mobile: "9825011420",
    email: "rajesh.patel@tatacapital.example",
    office: { line: "Regional Office, C G Road", city: "Ahmedabad", pincode: "380009" },
  },
  "Ahmedabad East": {
    name: "Meena D. Shah",
    designation: "Senior Manager, Recovery",
    dob: "1982-11-02",
    mobile: "9898023317",
    email: "meena.shah@tatacapital.example",
    office: { line: "Regional Office, Maninagar Char Rasta", city: "Ahmedabad", pincode: "380008" },
  },
  Gandhinagar: {
    name: "Vikram J. Solanki",
    designation: "Chief Manager, Legal",
    dob: "1975-07-21",
    mobile: "9426034588",
    email: "vikram.solanki@tatacapital.example",
    office: { line: "Regional Office, Sector 11", city: "Gandhinagar", pincode: "382421" },
  },
};

export const ADVOCATES = [
  // The same advocates as the SARAS 2.0 login's People page, as Gujarat names them.
  { name: "Anjali Parmar", enrolment: "G/1450/2012" },
  { name: "Thomas K. George", enrolment: "G/831/2011" },
  { name: "Rajesh Thakkar", enrolment: "G/1204/2015" },
  { name: "Priya Parmar", enrolment: "G/2988/2021" },
  { name: "Meera Solanki", enrolment: "G/1742/2017" },
  { name: "Nisha Rathod", enrolment: "G/2251/2019" },
  { name: "Rahul Thakkar", enrolment: "G/3105/2022" },
  { name: "Rupal S. Parmar", enrolment: "G/948/2014" },
];

/* ───────────────────────────── Seed ───────────────────────────── */

function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}

export function isoDaysAgo(days: number, from = new Date()): string {
  const d = new Date(Date.UTC(from.getFullYear(), from.getMonth(), from.getDate()));
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
}

const INDIVIDUALS = [
  "Bhavesh N. Thakkar", "Kiran M. Parmar", "Jignesh R. Modi", "Hetal P. Bhatt", "Sanjay V. Rathod",
  "Pooja A. Mehta", "Dhaval K. Chauhan", "Nilesh B. Prajapati", "Ritu S. Agarwal", "Mukesh H. Panchal",
  "Alpesh G. Vaghela", "Komal J. Dave", "Paresh L. Soni", "Chirag T. Gajjar", "Falguni R. Joshi",
  "Ketan D. Raval", "Manish C. Sutariya", "Nisha V. Trivedi", "Yogesh P. Makwana", "Darshana M. Pandya",
];
const PROPRIETORS = ["Shree Ambica Traders", "Om Sai Hardware", "Jay Bhavani Textiles"];
const COMPANIES: { name: string; c: Constitution; persons: Person[] }[] = [
  { name: "Navkar Agro Foods Pvt Ltd", c: "Private Limited Company", persons: [
    { name: "Ashok M. Jain", designation: "Managing Director", mobile: "9824055120" },
    { name: "Sunita A. Jain", designation: "Director", mobile: "9824055121" },
  ] },
  { name: "Riddhi Siddhi Enterprises", c: "Partnership Firm", persons: [
    { name: "Hitesh K. Patel", designation: "Partner", mobile: "9909012231" },
    { name: "Nayan K. Patel", designation: "Partner" },
  ] },
  { name: "Sahyog Infra Projects LLP", c: "LLP", persons: [
    { name: "Rakesh S. Desai", designation: "Designated Partner", mobile: "9879034410" },
  ] },
  { name: "Krishna Polymers Pvt Ltd", c: "Private Limited Company", persons: [
    { name: "Gopal V. Shah", designation: "Managing Director", mobile: "9925063377" },
  ] },
];

const PLACES: Omit<Address, "type">[] = [
  { line: "B-14, Shivalik Bungalows, Satellite", city: "Ahmedabad", pincode: "380015", policeStation: "Satellite Police Station" },
  { line: "22, Swastik Society, Navrangpura", city: "Ahmedabad", pincode: "380009", policeStation: "Navrangpura Police Station" },
  { line: "7, Krishna Park, Maninagar", city: "Ahmedabad", pincode: "380008", policeStation: "Maninagar Police Station" },
  { line: "A-301, Shaligram Flats, Bodakdev", city: "Ahmedabad", pincode: "380054", policeStation: "Vastrapur Police Station" },
  { line: "15, Ganesh Nagar, Naroda", city: "Ahmedabad", pincode: "382330", policeStation: "Naroda Police Station" },
  { line: "C-9, Sun City, Bopal", city: "Ahmedabad", pincode: "380058", policeStation: "Bopal Police Station" },
  { line: "41, Pritam Nagar, Paldi", city: "Ahmedabad", pincode: "380006", policeStation: "Paldi Police Station" },
  { line: "G-2, Narayan Complex, Naranpura", city: "Ahmedabad", pincode: "380013", policeStation: "Naranpura Police Station" },
];

const DRAWEE_IFSC = ["SBIN0060421", "HDFC0000521", "BARB0MANINA", "ICIC0000317", "PUNB0458600", "UTIB0000080", "KKBK0002561", "CNRB0002627"];
const BRANCHES: { branch: string; region: Matter["region"]; ifsc: string }[] = [
  { branch: "C G Road", region: "Ahmedabad West", ifsc: "HDFC0000060" },
  { branch: "Satellite", region: "Ahmedabad West", ifsc: "HDFC0000291" },
  { branch: "Maninagar", region: "Ahmedabad East", ifsc: "HDFC0000146" },
];
/** Added after the first 38, so the original cases (and pushes made against them) stay put. */
const GANDHINAGAR = { branch: "Sector 11", region: "Gandhinagar" as const, ifsc: "HDFC0000412" };
const FIRST = [
  "Aarti", "Bhavin", "Chetan", "Deepa", "Gaurav", "Hiral", "Jatin", "Kavita", "Lalit", "Mehul", "Nayana", "Parth",
  "Rina", "Sagar", "Tejal", "Umesh", "Vaishali", "Yash", "Zalak", "Ankit", "Bhumi", "Dharmesh", "Ekta", "Hardik",
];
const LAST = [
  "Patel", "Shah", "Desai", "Mehta", "Joshi", "Trivedi", "Pandya", "Parikh", "Dave", "Bhatt", "Vyas", "Rathod",
  "Solanki", "Chauhan", "Parmar", "Makwana", "Prajapati", "Thakkar", "Modi", "Soni", "Panchal", "Gajjar", "Raval",
];

/** Faults spread through the added cases, by divisor, so most stay clean. */
const MORE_SCENARIOS: [number, string][] = [
  [71, "account-closed"],
  [67, "missing-vakalatnama"],
  [61, "bad-ifsc"],
  [59, "outside-district"],
  [53, "delayed-no-reason"],
  [47, "delayed-with-reason"],
  [43, "not-ripe"],
  [41, "in-transit"],
  [37, "bad-mobile"],
  [31, "missing-ad-card"],
  [29, "unclaimed"],
  [23, "payment-stopped"],
  [19, "company"],
  [17, "two-cheques"],
  [13, "part-payment"],
];

/** How many matters the workspace holds. */
export const MATTER_COUNT = 220;

const PRODUCTS = ["Personal Loan", "Business Loan", "Two-Wheeler Loan", "Consumer Durable Loan", "MSME Term Loan"];
const MANAGERS = ["Priya Vyas", "Arjun Mehta", "Sneha Iyer"];

/**
 * What each matter is set up to show, by index. Everything not listed is a clean case:
 * notice delivered, 15 days run, insufficient funds, every document on file.
 */
const SCENARIOS: Record<number, string> = {
  1: "payment-stopped",
  4: "unclaimed",
  6: "in-transit",
  9: "part-payment",
  11: "missing-ad-card",
  13: "bad-mobile",
  15: "delayed-no-reason",
  16: "delayed-with-reason",
  18: "company",
  20: "partnership",
  22: "outside-district",
  24: "bad-ifsc",
  26: "not-ripe",
  28: "missing-vakalatnama",
  30: "two-cheques",
  32: "account-closed",
  33: "llp",
  2: "company-2",
};

export const FILED_COUNT = 4;

function build(today: Date): Matter[] {
  const r = rng(138);
  const matters: Matter[] = [];

  for (let i = 0; i < MATTER_COUNT; i += 1) {
    const added = i >= 38;
    const s = added ? (MORE_SCENARIOS.find(([n]) => i % n === 0)?.[1] ?? "clean") : (SCENARIOS[i] ?? "clean");
    // The original four filed matters, and one in every forty of the added ones.
    const filed = added ? i % 40 === 39 : i >= 38 - FILED_COUNT;
    const br = added && i % 5 === 4 ? GANDHINAGAR : BRANCHES[i % BRANCHES.length];
    const product = PRODUCTS[i % PRODUCTS.length];
    const lan = `GJ-${product.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase()}-${String(41870 + i * 37).padStart(7, "0")}`;
    const place = PLACES[i % PLACES.length];
    const amount = Math.round((25 + r() * 475) * 1000);

    // Timeline, counted back from today. Service lands 18–40 days ago for a ripe case,
    // so the cause of action (service + 15) has arisen and is within the month.
    let served = 18 + Math.floor(r() * 22);
    if (s === "not-ripe") served = 6;
    if (s === "delayed-no-reason" || s === "delayed-with-reason") served = 62;
    if (filed) served = 90 + i;
    const dispatched = served + 6 + Math.floor(r() * 4);
    const returned = dispatched + 4 + Math.floor(r() * 10);
    const deposited = returned + 3;
    const chequeDated = deposited + 5 + Math.floor(r() * 20);

    let borrowerName = added
      ? `${FIRST[(i * 7) % FIRST.length]} ${"ABCDHJKMNPRSV"[i % 13]}. ${LAST[(i * 11) % LAST.length]}`
      : INDIVIDUALS[i % INDIVIDUALS.length];
    let constitution: Constitution = "Individual";
    let persons: Person[] = [];
    if (i % 7 === 3) {
      constitution = "Sole Proprietorship";
      borrowerName = `${INDIVIDUALS[(i + 5) % INDIVIDUALS.length]} (Prop. ${PROPRIETORS[i % PROPRIETORS.length]})`;
    }
    const entity =
      s === "company" ? COMPANIES[added ? i % COMPANIES.length : 0] : s === "partnership" ? COMPANIES[1] : s === "llp" ? COMPANIES[2] : s === "company-2" ? COMPANIES[3] : null;
    if (entity) {
      borrowerName = entity.name;
      constitution = entity.c;
      persons = entity.persons;
    }
    const individual = constitution === "Individual" || constitution === "Sole Proprietorship";

    const addresses: Address[] =
      s === "outside-district"
        ? [{ type: "Residence", line: "12, Sayajigunj Society, Alkapuri", city: "Vadodara", pincode: "390007", policeStation: "Sayajigunj Police Station" }]
        : individual
          ? [{ type: "Residence", ...place }, ...(i % 5 === 0 ? [{ type: "Office" as const, ...PLACES[(i + 3) % PLACES.length] }] : [])]
          : [{ type: "Office", ...place }];

    const mobile = s === "bad-mobile" ? "98250 1234" : `9${String(824000000 + i * 7919).slice(0, 9)}`;

    const instrument = (k: number): Instrument => ({
      chequeNo: String(100000 + ((i * 7919 + k * 131) % 899999)),
      chequeDate: isoDaysAgo(chequeDated + k * 30, today),
      amount: k === 0 ? amount : Math.round(amount * 0.6),
      draweeIfsc: s === "bad-ifsc" ? "HDFC00521" : DRAWEE_IFSC[(i + k) % DRAWEE_IFSC.length],
      drawerAccount: String(50100000000 + i * 104729 + k),
      depositDate: isoDaysAgo(deposited + k, today),
      collectingIfsc: br.ifsc,
      returnDate: isoDaysAgo(returned, today),
      returnReason:
        s === "payment-stopped"
          ? "04 - Payment Stopped by Drawer"
          : s === "account-closed"
            ? "12 - Account Closed"
            : i % 6 === 2
              ? "02 - Exceeds Arrangement"
              : "01 - Funds Insufficient",
    });
    const instruments = [instrument(0), ...(s === "two-cheques" ? [instrument(1)] : [])];

    const noticeStatus: Notice["status"] =
      s === "in-transit" ? "In Transit" : s === "unclaimed" ? "Returned - Unclaimed" : "Delivered";
    const notice: Notice = {
      dispatchDate: isoDaysAgo(dispatched, today),
      mode: i % 4 === 1 ? "SPEED POST" : "RPAD",
      consignmentNo: `RG${String(400000000 + i * 1931)}IN`,
      status: noticeStatus,
      statusDate: s === "in-transit" ? undefined : isoDaysAgo(served, today),
      replyReceived: i % 11 === 5,
    };

    const docs: MatterDoc[] = [];
    const add = (tag: DocTag, name: string, index?: number) =>
      docs.push({ id: `${lan}-${tag.replace(/\W+/g, "").toLowerCase()}${index ? `-${index}` : ""}`, tag, name, index, uploadedOn: isoDaysAgo(Math.max(1, served - 2), today) });
    instruments.forEach((q, k) => {
      const n = instruments.length > 1 ? k + 1 : undefined;
      add("Cheque", `Cheque ${q.chequeNo}.pdf`, n);
      add("Return memo", `Return memo ${q.chequeNo}.pdf`, n);
    });
    add("Legal notice", `Demand notice ${lan}.pdf`);
    add("Postal receipt", `Postal receipt ${notice.consignmentNo}.pdf`);
    if (s !== "missing-ad-card" && s !== "in-transit") add("Tracking report", `India Post tracking ${notice.consignmentNo}.pdf`);
    if (notice.replyReceived) add("Reply", `Reply to notice ${lan}.pdf`);
    add("Loan agreement", `Loan agreement ${lan}.pdf`);
    add("Authorised officer ID", `Authorised officer ID.pdf`);
    if (s !== "missing-vakalatnama") add("Vakalatnama", `Vakalatnama ${lan}.pdf`);

    const notes: Matter["notes"] = [];
    if (s === "delayed-with-reason")
      notes.push({
        at: isoDaysAgo(4, today),
        by: "Priya Vyas",
        tag: "condonation",
        text: "The borrower's file was transferred from the Maninagar branch on account restructuring and reached the legal desk after the limitation period had begun. The delay is bona fide and not deliberate.",
      });

    const stage: Stage = filed
      ? "Filed"
      : s === "in-transit"
        ? "Notice Sent"
        : s === "not-ripe"
          ? "Notice Served"
          : "Ready for Filing";

    matters.push({
      id: `m${i + 1}`,
      lan,
      product,
      branch: br.branch,
      region: br.region,
      legalManager: MANAGERS[i % MANAGERS.length],
      // A third of the open matters wait for the legal manager to assign an advocate.
      advocate: filed || i % 3 !== 0 ? ADVOCATES[i % ADVOCATES.length] : null,
      npaDate: isoDaysAgo(chequeDated + 60, today),
      dpd: chequeDated + 150 + Math.floor(r() * 60),
      outstanding: Math.round(amount * (1.4 + r())),
      borrower: {
        name: borrowerName,
        constitution,
        dob: individual ? `${1965 + (i % 25)}-0${1 + (i % 9)}-1${i % 9}` : undefined,
        mobile: entity ? undefined : mobile,
        email: individual ? `${borrowerName.split(" ")[0].toLowerCase()}${i}@mail.example` : `accounts@${borrowerName.split(" ")[0].toLowerCase()}.example`,
        addresses,
        persons,
      },
      instruments,
      notice,
      receivedAfterNotice: s === "part-payment" ? Math.round(amount * 0.3) : 0,
      notes,
      documents: docs,
      labels: [
        ...(r() > 0.7 ? ["High value"] : []),
        ...(i % 9 === 0 ? ["Repeat defaulter"] : []),
      ],
      stage,
      cnr: filed ? `GJAH01${String(4100 + i).padStart(6, "0")}2026` : undefined,
      filedOn: filed ? "SARAS 2.0" : undefined,
      witness:
        i % 10 === 1
          ? {
              name: "Kunal S. Shah",
              designation: `Branch Manager, Tata Capital, ${br.branch}`,
              mobile: "9879055501",
              address: { line: `Tata Capital, ${br.branch}`, city: br.region === "Gandhinagar" ? "Gandhinagar" : "Ahmedabad", pincode: br.region === "Gandhinagar" ? "382421" : "380009" },
            }
          : undefined,
      docMismatch: i % 17 === 7,
    });
  }
  return matters;
}

/** The workspace's matters as of today. */
export function allMatters(today = new Date()): Matter[] {
  return build(today);
}

export function causeOfAction(m: Matter): string | null {
  if (m.notice.status === "In Transit" || !m.notice.statusDate) return null;
  const d = new Date(`${m.notice.statusDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 15);
  return d.toISOString().slice(0, 10);
}

/** Last day to file: one month from the cause of action. */
export function limitationEnds(m: Matter): string | null {
  const c = causeOfAction(m);
  if (!c) return null;
  const d = new Date(`${c}T00:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() + 1);
  return d.toISOString().slice(0, 10);
}

export const formatINR = (n: number) =>
  `₹${n.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;

export function formatDate(iso?: string | null): string {
  if (!iso) return "—";
  const d = new Date(`${iso}T00:00:00Z`);
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" });
}
