/**
 * Builds the two demo spreadsheets for bulk filing, with dates set from today. Every case
 * is within limitation when it is uploaded except one, which shows the warnings a batch
 * can raise (owner, 2026-10-22: only these):
 *
 *   TCL-AHD-PL-1002   cheque presented after its three-month validity (CHQ-11)
 *   TCL-AHD-PL-1004   past the one-month limit, and the sheet has no condonation reason (JUR-12)
 *
 * The third, a scan too blurry to read, comes from "Fill with demo files" on Documents.
 *
 *
 *   demo-files/tata-capital-bulk-filing-template.xlsx   follows the template (no matching)
 *   demo-files/tata-capital-recovery-mis.xlsx           the lender's own layout (matching screens)
 *
 * The lender's layout has no cheque date and no presentation date: a recovery MIS records
 * the bounce, not those. Both are required, so every case it brings arrives held and has
 * to be completed one case at a time, from the cheque and the return memo.
 *
 *   npm run demo:files
 *
 * The cases are fictional and different from the Provakil mock's, so uploading them never
 * clashes with a batch pushed from there. Re-run when the dates go stale (after about two
 * weeks the earliest cases fall outside the one-month limit and ask for a condonation reason).
 */

import { copyFileSync, mkdirSync } from "node:fs";
import path from "node:path";

import ExcelJS from "exceljs";

import {
  CASES_SHEET,
  formatHint,
  LISTS,
  TEMPLATE_COUNTS,
  templateColumns,
  type ListName,
} from "../src/lib/bulk/excel-spec";
import { FINAL_RELIEF_TEMPLATE, INTERIM_RELIEF_TEMPLATE } from "../src/lib/filing/options";

const OUT = path.join(import.meta.dirname, "..", "..", "..", "demo-files");

const today = new Date();
const daysAgo = (n: number) => {
  const d = new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()));
  d.setUTCDate(d.getUTCDate() - n);
  return d;
};
const dmy = (d: Date, sep = "-") =>
  `${String(d.getUTCDate()).padStart(2, "0")}${sep}${String(d.getUTCMonth() + 1).padStart(2, "0")}${sep}${d.getUTCFullYear()}`;
const label = (list: ListName, value: string) => LISTS[list].find((o) => o.value === value)!.label;

type Demo = {
  ref: string;
  name: string;
  type: "individual" | "institution";
  entity?: string;
  /** Name, designation, mobile: the person responsible for an institution (s.141). */
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
  /** Days ago the notice was served; it went out 8 days before. */
  served: number;
  /** Presented after the cheque's three-month validity. */
  presentedLate?: boolean;
  delivered: boolean;
  replied?: boolean;
  paid?: number;
  second?: { cheque: string; amount: number };
  /** A second accused who also signed the cheque (a joint account holder). */
  coAccused?: { name: string; age: string; mobile: string };
  witnesses?: { name: string; designation: string; prove: string; mobile: string }[];
  otherCase?: { court: string; number: string };
};

/** Twelve cases: mostly clean, a few with something for scrutiny to show. */
const CASES: Demo[] = [
  { ref: "TCL-AHD-PL-1001", witnesses: [{ name: "Kunal S. Shah", designation: "Branch Manager, Tata Capital, C G Road", prove: "The loan account statement and the dishonour", mobile: "9879055501" }], name: "Harsh V. Bhavsar", type: "individual", age: "34", mobile: "9879012301", email: "harsh.bhavsar@mail.example", address: "B-12, Sundaram Flats, Vastrapur", city: "Ahmedabad", pin: "380015", police: "Vastrapur Police Station", cheque: "204511", amount: 148500, ifsc: "SBIN0060421", account: "38291004512", reason: "funds-insufficient", mode: "rpad", served: 19, delivered: true },
  { ref: "TCL-AHD-PL-1002", name: "Snehal K. Mistry", type: "individual", age: "41", mobile: "9879012302", email: "snehal.mistry@mail.example", address: "14, Gokul Row Houses, Naranpura", city: "Ahmedabad", pin: "380013", police: "Naranpura Police Station", cheque: "331207", amount: 92750, ifsc: "HDFC0000521", account: "50100221834", reason: "funds-insufficient", mode: "rpad", served: 20, delivered: true, presentedLate: true },
  { ref: "TCL-AHD-BL-1003", coAccused: { name: "Kusum P. Solanki", age: "49", mobile: "9879012313" }, name: "Pravin D. Solanki", type: "individual", age: "52", mobile: "9879012303", email: "pravin.solanki@mail.example", address: "7, Shreeji Society, Maninagar", city: "Ahmedabad", pin: "380008", police: "Maninagar Police Station", cheque: "118034", amount: 365000, ifsc: "BARB0MANINA", account: "21950100004471", reason: "exceeds-arrangement", mode: "speed", served: 21, delivered: true },
  { ref: "TCL-AHD-PL-1004", name: "Mitali R. Shah", type: "individual", age: "29", mobile: "9879012304", email: "mitali.shah@mail.example", address: "C-403, Orchid Greens, Bopal", city: "Ahmedabad", pin: "380058", police: "Bopal Police Station", cheque: "560921", amount: 76400, ifsc: "KKBK0002561", account: "7612004893", reason: "payment-stopped", mode: "rpad", served: 60, delivered: true },
  { ref: "TCL-AHD-TL-1005", name: "Rakesh J. Prajapati", type: "individual", age: "38", mobile: "9879012305", email: "rakesh.prajapati@mail.example", address: "33, Shiv Shakti Nagar, Naroda", city: "Ahmedabad", pin: "382330", police: "Naroda Police Station", cheque: "009812", amount: 58900, ifsc: "PUNB0458600", account: "4586000100023911", reason: "funds-insufficient", mode: "rpad", served: 22, delivered: false },
  { ref: "TCL-AHD-BL-1006", witnesses: [{ name: "Kunal S. Shah", designation: "Branch Manager, Tata Capital, C G Road", prove: "The loan account statement", mobile: "9879055501" }, { name: "Dipti R. Vora", designation: "Collections Officer", prove: "Presentation and return of the cheque", mobile: "9879055502" }], name: "Sarthak Packaging Pvt Ltd", type: "institution", entity: "private-limited", person: ["Nikhil S. Desai", "Managing Director", "9879044401"], mobile: "9879012306", email: "accounts@sarthakpack.example", address: "Plot 41, GIDC Phase 2, Naroda", city: "Ahmedabad", pin: "382330", police: "Naroda Police Station", cheque: "442190", amount: 512000, ifsc: "UTIB0000080", account: "917020045512230", reason: "funds-insufficient", mode: "speed", served: 17, delivered: true },
  { ref: "TCL-AHD-PL-1007", name: "Jayesh M. Rana", type: "individual", age: "45", mobile: "9879012307", email: "jayesh.rana@mail.example", address: "9, Sahjanand Park, Paldi", city: "Vadodara", pin: "380006", police: "Paldi Police Station", cheque: "671455", amount: 133250, ifsc: "CNRB0002627", account: "2627101009981", reason: "funds-insufficient", mode: "rpad", served: 19, delivered: true, paid: 25000 },
  { ref: "TCL-AHD-PL-1008", name: "Kinjal A. Trivedi", type: "individual", age: "31", mobile: "9879012308", email: "kinjal.trivedi@mail.example", address: "A-22, Satyam Tenements, Satellite", city: "Ahmedabad", pin: "38001", police: "Satellite Police Station", cheque: "780312", amount: 64800, ifsc: "ICIC0000317", account: "031701509872", reason: "funds-insufficient", mode: "rpad", served: 20, delivered: true },
  { ref: "TCL-AHD-BL-1009", otherCase: { court: "SARAS Court, Ahmedabad", number: "eCC/2210/2026" }, name: "Devang P. Joshi", type: "individual", age: "48", mobile: "9879012309", email: "devang.joshi@mail.example", address: "5, Rajpath Bungalows, Bodakdev", city: "Ahmedabad", pin: "380054", police: "Vastrapur Police Station", cheque: "253660", amount: 214000, ifsc: "HDFC0000521", account: "50100332918", reason: "funds-insufficient", mode: "speed", served: 21, delivered: true, second: { cheque: "253661", amount: 120000 } },
  { ref: "TCL-AHD-PL-1010", name: "Shree Ganesh Traders", type: "individual", age: "36", mobile: "9879012310", email: "ganesh.traders@mail.example", address: "18, Nilkanth Society, Navrangpura", city: "Ahmedabad", pin: "380009", police: "Navrangpura Police Station", cheque: "904417", amount: 87300, ifsc: "SBIN0060421", account: "38291007788", reason: "funds-insufficient", mode: "rpad", served: 18, delivered: true, replied: true },
  { ref: "TCL-AHD-TL-1011", name: "Imran S. Shaikh", type: "individual", age: "39", mobile: "9879012311", email: "imran.shaikh@mail.example", address: "27, Al-Burhan Park, Juhapura", city: "Ahmedabad", pin: "380055", police: "Vejalpur Police Station", cheque: "118904", amount: 69900, ifsc: "BARB0MANINA", account: "21950100009934", reason: "account-closed", mode: "rpad", served: 22, delivered: true },
  { ref: "TCL-AHD-BL-1012", name: "Anand Fabricators", type: "institution", entity: "partnership", person: ["Mahesh B. Anand", "Partner", "9879044402"], mobile: "9879012312", email: "anand.fab@mail.example", address: "Shed 12, Odhav Industrial Estate, Odhav", city: "Ahmedabad", pin: "382415", police: "Odhav Police Station", cheque: "331876", amount: 289500, ifsc: "KKBK0002561", account: "7612009021", reason: "funds-insufficient", mode: "speed", served: 20, delivered: true },
];

/** The dates each case needs, counted back from service. */
function timeline(c: Demo) {
  const served = daysAgo(c.served);
  const dispatched = daysAgo(c.served + 8);
  const returned = daysAgo(c.served + 14);
  const presented = daysAgo(c.served + 17);
  const dated = daysAgo(c.served + (c.presentedLate ? 110 : 30));
  return { served, dispatched, returned, presented, dated };
}

function header(ws: ExcelJS.Worksheet) {
  ws.getRow(1).font = { bold: true };
  ws.getRow(1).alignment = { wrapText: true, vertical: "top" };
  ws.views = [{ state: "frozen", ySplit: 1 }];
}

/* ───────────────────────── 1. Follows the template ───────────────────────── */

/** HTML paragraphs as the sheet holds them: plain text, one line per paragraph. */
const plain = (html: string) =>
  html.split(/<\/p>/).map((p) => p.replace(/<[^>]+>/g, "").trim()).filter(Boolean).join("\n");

const rupees = (n: number) => n.toLocaleString("en-IN");

/** Why the cheque came back, as the affidavit says it. */
const AFFIDAVIT_REASON: Record<string, string> = {
  "funds-insufficient": "insufficiency of funds",
  "exceeds-arrangement": "the amount exceeding the arrangement",
  "payment-stopped": "payment having been stopped by the drawer",
  "account-closed": "the account having been closed",
};

/** The standard prayers and affidavit (e-filing handover §17), finished for this case. */
function texts(c: Demo) {
  const total = c.amount + (c.second?.amount ?? 0);
  const interim = plain(INTERIM_RELIEF_TEMPLATE).replace(
    "20% of the cheque amount,",
    `20% of the cheque amount i.e. Rs. ${rupees(Math.round(total * 0.2))},`,
  );
  const final = plain(FINAL_RELIEF_TEMPLATE).replace("@ 6% per annum", "@ 9% per annum");
  const affidavit = [
    "I am the authorised representative of the complainant in the above case and am fully acquainted with the facts and circumstances of the case. I am competent and authorised to swear to this affidavit. The accused issued the above cheque in discharge of a legally enforceable debt or liability. It has been dishonoured due to " +
      `${AFFIDAVIT_REASON[c.reason]}. A demand notice has been issued to the accused, but ${c.type === "institution" ? "it has" : "she/he has"} failed to make the payment due under the cheque. All other requirements under Section 138 of the Negotiable Instruments Act, 1881 have been complied with.`,
    "I confirm that the demand notice was served on the last known correct address of the accused(s).",
    "In accordance with Section 225 of the Bharatiya Nagarik Suraksha Sanhita, 2023, I confirm that there is sufficient ground for proceeding against the accused.",
    "In accordance with Section 223 and other relevant provisions of the Bharatiya Nagarik Suraksha Sanhita, 2023, I confirm that the contents of this complaint are true and correct to the best of my knowledge, belief and information.",
    "The physical or electronic records of the documents etc. produced by me with this complaint are in my lawful and proper custody and possession. It is therefore humbly prayed that this Hon'ble Court may be pleased to take cognizance of the offence committed by the accused, and issue process to the accused.",
  ].join("\n");
  return { interim, final, affidavit };
}

async function templateFile() {
  const wb = new ExcelJS.Workbook();
  wb.creator = "SARAS 2.0 bulk filing (demo)";
  const ws = wb.addWorksheet(CASES_SHEET);
  // The template's columns, plus the extra numbered ones this file needs (PRD BLK-27): a
  // second cheque (TCL-AHD-BL-1009) and a second witness (TCL-AHD-BL-1006).
  const all = templateColumns({ ...TEMPLATE_COUNTS, cheque: 2, witness: 2 });
  const id = (key: string, instance: number[]) => `${key}@${instance.join(".")}`;
  ws.columns = all.map((t) => ({ header: t.header, key: id(t.column.key, t.instance), width: Math.max(18, t.header.length + 4) }));
  header(ws);
  ws.views = [{ state: "frozen", ySplit: 2 }];
  // The template's own guide rows, left in as a filer would: upload discards them.
  const grey = { type: "pattern" as const, pattern: "solid" as const, fgColor: { argb: "FFF2F2F2" } };
  const hints = ws.addRow(Object.fromEntries(all.map((t) => [id(t.column.key, t.instance), formatHint(t.column)])));
  const ex = ws.addRow(
    Object.fromEntries(all.map((t) => [id(t.column.key, t.instance), t.instance.every((n) => n === 1) ? t.column.example : ""])),
  );
  for (const r of [hints, ex]) {
    r.font = { italic: true, color: { argb: "FF555555" } };
    r.alignment = { wrapText: true, vertical: "top" };
    r.eachCell({ includeEmpty: true }, (cell) => (cell.fill = grey));
  }

  for (const c of CASES) {
    const t = timeline(c);
    const x = texts(c);
    const row: Record<string, string | number> = {};
    const set = (key: string, instance: number[], value: string | number) => (row[id(key, instance)] = value);
    const accused = (n: number, a: { type: string; name: string; age?: string; entity?: string; mobile: string; email?: string }) => {
      set("accusedType", [n], label("accusedType", a.type));
      set("accusedName", [n], a.name);
      set("accusedAge", [n], a.age ?? "");
      set("accusedEntity", [n], a.entity ? label("accusedEntity", a.entity) : "");
      set("accusedMobile", [n], a.mobile);
      set("accusedEmail", [n], a.email ?? "");
      set("accusedAddress", [n, 1], c.address);
      set("accusedCity", [n, 1], c.city);
      set("accusedPin", [n, 1], c.pin);
      set("accusedPolice", [n, 1], c.police);
      set("accusedJurisdiction", [n], "Yes");
    };
    set("reference", [], c.ref);
    accused(1, c);
    if (c.person) {
      set("personName", [1, 1], c.person[0]);
      set("personDesignation", [1, 1], c.person[1]);
      set("personMobile", [1, 1], c.person[2]);
      set("personAddress", [1, 1], c.address);
      set("personCity", [1, 1], c.city);
      set("personPin", [1, 1], c.pin);
      set("personPolice", [1, 1], c.police);
    }
    if (c.coAccused) accused(2, { type: "individual", ...c.coAccused });
    const cheque = (n: number, number: string, amount: number) => {
      set("chequeNumber", [n], number);
      set("chequeDate", [n], dmy(t.dated));
      set("chequeAmount", [n], amount);
      set("chequeIfsc", [n], c.ifsc);
      set("chequeAccount", [n], c.account);
      set("presentDate", [n], dmy(t.presented));
      set("returnDate", [n], dmy(t.returned));
      set("returnReason", [n], label("returnReason", c.reason));
      set("payeeIfsc", [n], "HDFC0000060");
      set("payeePolice", [n], "Navrangpura Police Station");
    };
    cheque(1, c.cheque, c.amount);
    if (c.second) cheque(2, c.second.cheque, c.second.amount);
    set("natureDebt", [1], label("natureOfDebt", "loan"));
    set("dispatchDate", [1], dmy(t.dispatched));
    set("mode", [1], label("modeOfService", c.mode));
    set("tracking", [1], `RG${c.cheque}11IN`);
    set("delivered", [1], c.delivered ? "Yes" : "No");
    set("deliveryDate", [1], c.delivered ? dmy(t.served) : "");
    set("noticeReturnDate", [1], c.delivered ? "" : dmy(t.served));
    set("nonDelivery", [1], c.delivered ? "" : label("nonDelivery", "unclaimed"));
    set("replied", [1], c.replied ? "Yes" : "No");
    set("payment", [1], label("payment", c.paid ? "part" : "none"));
    set("paidAmount", [1], c.paid ?? "");
    set("deposited", [], "Yes");
    set("otherPending", [], c.otherCase ? "Yes" : "No");
    if (c.otherCase) {
      set("otherCourt", [1], c.otherCase.court);
      set("otherNumber", [1], c.otherCase.number);
    }
    set("interimRelief", [], x.interim);
    set("finalRelief", [], x.final);
    set("affidavit", [], x.affidavit);
    (c.witnesses ?? []).forEach((w, i) => {
      const n = i + 1;
      set("witnessName", [n], w.name);
      set("witnessDesignation", [n], w.designation);
      set("witnessProve", [n], w.prove);
      set("witnessMobile", [n], w.mobile);
      set("witnessAddress", [n], "Tata Capital, C G Road");
      set("witnessCity", [n], "Ahmedabad");
      set("witnessPin", [n], "380009");
    });
    ws.addRow(row);
  }

  const file = path.join(OUT, "tata-capital-bulk-filing-template.xlsx");
  await wb.xlsx.writeFile(file);
  return file;
}

/* ───────────────────────── 2. The lender's own layout ───────────────────────── */

/** How a recovery team's MIS export might write the same facts. */
const MIS_REASON: Record<string, string> = {
  "funds-insufficient": "INSUFFICIENT FUNDS",
  "exceeds-arrangement": "EXCEEDS ARRANGEMENT",
  "payment-stopped": "PAYMENT STOPPED",
  "account-closed": "A/C CLOSED",
};

async function misFile() {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Tata Capital recovery MIS (demo)";
  const ws = wb.addWorksheet("NI 138 MIS");
  const cols = [
    "Sr No", "Loan A/c No", "Product", "Customer Name", "Cust Type", "Director/Partner", "Mobile No", "Email Id",
    "Communication Address", "City", "PIN", "Chq No", "Chq Amount (Rs)", "Drawee Bank IFSC", "Drawer A/c No",
    "Bounce Date", "Bounce Reason", "Collecting IFSC", "Notice Sent On", "Sent Via", "AWB No",
    "Notice Status", "Served On", "Returned On", "Remarks", "Reply Recd", "Recovered After Notice",
    // A second cheque, in the lender's own column names with _2.
    "Chq No_2", "Chq Amount (Rs)_2", "Drawee Bank IFSC_2", "Drawer A/c No_2", "Bounce Date_2", "Bounce Reason_2",
  ];
  ws.columns = cols.map((h) => ({ header: h, key: h, width: Math.max(14, h.length + 4) }));
  header(ws);
  CASES.forEach((c, i) => {
    const t = timeline(c);
    ws.addRow({
      "Sr No": i + 1,
      "Loan A/c No": c.ref,
      Product: c.ref.includes("-PL-") ? "Personal Loan" : c.ref.includes("-BL-") ? "Business Loan" : "Two Wheeler Loan",
      "Customer Name": c.name,
      "Cust Type": c.type === "individual" ? "INDIVIDUAL" : c.entity === "partnership" ? "FIRM" : "COMPANY",
      "Director/Partner": c.person?.[0] ?? "",
      "Mobile No": `+91 ${c.mobile.slice(0, 5)} ${c.mobile.slice(5)}`,
      "Email Id": c.email,
      "Communication Address": c.address,
      City: c.city.toUpperCase(),
      PIN: c.pin,
      "Chq No": c.cheque,
      "Chq Amount (Rs)": c.amount.toLocaleString("en-IN"),
      "Drawee Bank IFSC": c.ifsc,
      "Drawer A/c No": c.account,
      "Bounce Date": dmy(t.returned, "/"),
      "Bounce Reason": MIS_REASON[c.reason],
      "Collecting IFSC": "HDFC0000060",
      "Notice Sent On": dmy(t.dispatched, "/"),
      "Sent Via": c.mode === "rpad" ? "Regd. Post A/D" : "Speed Post",
      "AWB No": `RG${c.cheque}11IN`,
      "Notice Status": c.delivered ? "SERVED" : "RETURNED",
      "Served On": c.delivered ? dmy(t.served, "/") : "",
      "Returned On": c.delivered ? "" : dmy(t.served, "/"),
      Remarks: c.delivered ? "" : "Unclaimed",
      "Reply Recd": c.replied ? "Y" : "N",
      "Recovered After Notice": c.paid ?? 0,
      ...(c.second
        ? {
            "Chq No_2": c.second.cheque,
            "Chq Amount (Rs)_2": c.second.amount.toLocaleString("en-IN"),
            "Drawee Bank IFSC_2": c.ifsc,
            "Drawer A/c No_2": c.account,
            "Bounce Date_2": dmy(t.returned, "/"),
            "Bounce Reason_2": MIS_REASON[c.reason],
          }
        : {}),
    });
  });
  const file = path.join(OUT, "tata-capital-recovery-mis.xlsx");
  await wb.xlsx.writeFile(file);
  return file;
}

mkdirSync(OUT, { recursive: true });
const files = [await templateFile(), await misFile()];
for (const f of files) console.log(`Wrote ${path.relative(process.cwd(), f)}`);

// The upload's sample buttons serve the same two files as static assets, so they work
// where the server cannot read the repo (a hosted deployment).
const SAMPLES = path.join(import.meta.dirname, "..", "public", "samples");
mkdirSync(SAMPLES, { recursive: true });
for (const f of files) {
  copyFileSync(f, path.join(SAMPLES, path.basename(f)));
  console.log(`Copied ${path.basename(f)} to public/samples`);
}
