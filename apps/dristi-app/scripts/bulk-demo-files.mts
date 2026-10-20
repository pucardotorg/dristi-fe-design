/**
 * Builds the two demo spreadsheets for bulk filing, with dates set from today so every
 * case is within limitation when it is uploaded:
 *
 *   demo-files/tata-capital-bulk-filing-template.xlsx   follows the template (no matching)
 *   demo-files/tata-capital-recovery-mis.xlsx           the lender's own layout (matching screens)
 *
 *   npm run demo:files
 *
 * The cases are fictional and different from the Provakil mock's, so uploading them never
 * clashes with a batch pushed from there. Re-run when the dates go stale (after about two
 * weeks the earliest cases fall outside the one-month limit and ask for a condonation reason).
 */

import { mkdirSync } from "node:fs";
import path from "node:path";

import ExcelJS from "exceljs";

import { CASES_SHEET, COLUMNS, formatHint, LISTS, type ListName } from "../src/lib/bulk/excel-spec";

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
  person?: [string, string];
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
  delivered: boolean;
  replied?: boolean;
  paid?: number;
  second?: { cheque: string; amount: number };
};

/** Twelve cases: mostly clean, a few with something for scrutiny to show. */
const CASES: Demo[] = [
  { ref: "TCL-AHD-PL-1001", name: "Harsh V. Bhavsar", type: "individual", age: "34", mobile: "9879012301", email: "harsh.bhavsar@mail.example", address: "B-12, Sundaram Flats, Vastrapur", city: "Ahmedabad", pin: "380015", police: "Vastrapur Police Station", cheque: "204511", amount: 148500, ifsc: "SBIN0060421", account: "38291004512", reason: "funds-insufficient", mode: "rpad", served: 19, delivered: true },
  { ref: "TCL-AHD-PL-1002", name: "Snehal K. Mistry", type: "individual", age: "41", mobile: "9879012302", email: "snehal.mistry@mail.example", address: "14, Gokul Row Houses, Naranpura", city: "Ahmedabad", pin: "380013", police: "Naranpura Police Station", cheque: "331207", amount: 92750, ifsc: "HDFC0000521", account: "50100221834", reason: "funds-insufficient", mode: "rpad", served: 20, delivered: true },
  { ref: "TCL-AHD-BL-1003", name: "Pravin D. Solanki", type: "individual", age: "52", mobile: "9879012303", email: "pravin.solanki@mail.example", address: "7, Shreeji Society, Maninagar", city: "Ahmedabad", pin: "380008", police: "Maninagar Police Station", cheque: "118034", amount: 365000, ifsc: "BARB0MANINA", account: "21950100004471", reason: "exceeds-arrangement", mode: "speed", served: 21, delivered: true },
  { ref: "TCL-AHD-PL-1004", name: "Mitali R. Shah", type: "individual", age: "29", mobile: "9879012304", email: "mitali.shah@mail.example", address: "C-403, Orchid Greens, Bopal", city: "Ahmedabad", pin: "380058", police: "Bopal Police Station", cheque: "560921", amount: 76400, ifsc: "KKBK0002561", account: "7612004893", reason: "payment-stopped", mode: "rpad", served: 18, delivered: true },
  { ref: "TCL-AHD-TL-1005", name: "Rakesh J. Prajapati", type: "individual", age: "38", mobile: "9879012305", email: "rakesh.prajapati@mail.example", address: "33, Shiv Shakti Nagar, Naroda", city: "Ahmedabad", pin: "382330", police: "Naroda Police Station", cheque: "009812", amount: 58900, ifsc: "PUNB0458600", account: "4586000100023911", reason: "funds-insufficient", mode: "rpad", served: 22, delivered: false },
  { ref: "TCL-AHD-BL-1006", name: "Sarthak Packaging Pvt Ltd", type: "institution", entity: "private-limited", person: ["Nikhil S. Desai", "Managing Director"], mobile: "9879012306", email: "accounts@sarthakpack.example", address: "Plot 41, GIDC Phase 2, Naroda", city: "Ahmedabad", pin: "382330", police: "Naroda Police Station", cheque: "442190", amount: 512000, ifsc: "UTIB0000080", account: "917020045512230", reason: "funds-insufficient", mode: "speed", served: 17, delivered: true },
  { ref: "TCL-AHD-PL-1007", name: "Jayesh M. Rana", type: "individual", age: "45", mobile: "9879012307", email: "jayesh.rana@mail.example", address: "9, Sahjanand Park, Paldi", city: "Ahmedabad", pin: "380006", police: "Paldi Police Station", cheque: "671455", amount: 133250, ifsc: "CNRB0002627", account: "2627101009981", reason: "funds-insufficient", mode: "rpad", served: 19, delivered: true, paid: 25000 },
  { ref: "TCL-AHD-PL-1008", name: "Kinjal A. Trivedi", type: "individual", age: "31", mobile: "9879012308", email: "kinjal.trivedi@mail.example", address: "A-22, Satyam Tenements, Satellite", city: "Ahmedabad", pin: "38001", police: "Satellite Police Station", cheque: "780312", amount: 64800, ifsc: "ICIC0000317", account: "031701509872", reason: "funds-insufficient", mode: "rpad", served: 20, delivered: true },
  { ref: "TCL-AHD-BL-1009", name: "Devang P. Joshi", type: "individual", age: "48", mobile: "9879012309", email: "devang.joshi@mail.example", address: "5, Rajpath Bungalows, Bodakdev", city: "Ahmedabad", pin: "380054", police: "Vastrapur Police Station", cheque: "253660", amount: 214000, ifsc: "HDFC0000521", account: "50100332918", reason: "funds-insufficient", mode: "speed", served: 21, delivered: true, second: { cheque: "253661", amount: 120000 } },
  { ref: "TCL-AHD-PL-1010", name: "Rupal H. Chauhan", type: "individual", age: "36", mobile: "9879012310", email: "rupal.chauhan@mail.example", address: "18, Nilkanth Society, Navrangpura", city: "Ahmedabad", pin: "380009", police: "Navrangpura Police Station", cheque: "904417", amount: 87300, ifsc: "SBIN0060421", account: "38291007788", reason: "funds-insufficient", mode: "rpad", served: 18, delivered: true, replied: true },
  { ref: "TCL-AHD-TL-1011", name: "Imran S. Shaikh", type: "individual", age: "39", mobile: "9879012311", email: "imran.shaikh@mail.example", address: "27, Al-Burhan Park, Juhapura", city: "Ahmedabad", pin: "380055", police: "Vejalpur Police Station", cheque: "118904", amount: 69900, ifsc: "BARB0MANINA", account: "21950100009934", reason: "account-closed", mode: "rpad", served: 22, delivered: true },
  { ref: "TCL-AHD-BL-1012", name: "Anand Fabricators", type: "institution", entity: "partnership", person: ["Mahesh B. Anand", "Partner"], mobile: "9879012312", email: "anand.fab@mail.example", address: "Shed 12, Odhav Industrial Estate, Odhav", city: "Ahmedabad", pin: "382415", police: "Odhav Police Station", cheque: "331876", amount: 289500, ifsc: "KKBK0002561", account: "7612009021", reason: "funds-insufficient", mode: "speed", served: 20, delivered: true },
];

/** The dates each case needs, counted back from service. */
function timeline(c: Demo) {
  const served = daysAgo(c.served);
  const dispatched = daysAgo(c.served + 8);
  const returned = daysAgo(c.served + 14);
  const presented = daysAgo(c.served + 17);
  const dated = daysAgo(c.served + 30);
  return { served, dispatched, returned, presented, dated };
}

function header(ws: ExcelJS.Worksheet) {
  ws.getRow(1).font = { bold: true };
  ws.getRow(1).alignment = { wrapText: true, vertical: "top" };
  ws.views = [{ state: "frozen", ySplit: 1 }];
}

/* ───────────────────────── 1. Follows the template ───────────────────────── */

async function templateFile() {
  const wb = new ExcelJS.Workbook();
  wb.creator = "SARAS 2.0 bulk filing (demo)";
  const ws = wb.addWorksheet(CASES_SHEET);
  ws.columns = COLUMNS.map((c) => ({ header: c.header, key: c.key, width: Math.max(18, c.header.length + 4) }));
  header(ws);
  ws.views = [{ state: "frozen", ySplit: 2 }];
  // The template's own guide rows, left in as a filer would: upload discards them.
  const grey = { type: "pattern" as const, pattern: "solid" as const, fgColor: { argb: "FFF2F2F2" } };
  const hints = ws.addRow(Object.fromEntries(COLUMNS.map((c) => [c.key, formatHint(c)])));
  const ex = ws.addRow(Object.fromEntries(COLUMNS.map((c) => [c.key, c.example])));
  for (const r of [hints, ex]) {
    r.font = { italic: true, color: { argb: "FF555555" } };
    r.alignment = { wrapText: true, vertical: "top" };
    r.eachCell({ includeEmpty: true }, (cell) => (cell.fill = grey));
  }

  for (const c of CASES) {
    const t = timeline(c);
    ws.addRow({
      reference: c.ref,
      accusedType: label("accusedType", c.type),
      accusedName: c.name,
      accusedEntity: c.entity ? label("accusedEntity", c.entity) : "",
      accusedAge: c.age ?? "",
      accusedMobile: c.mobile,
      accusedEmail: c.email,
      accusedAddress: c.address,
      accusedCity: c.city,
      accusedPin: c.pin,
      accusedPolice: c.police,
      personName: c.person?.[0] ?? "",
      personDesignation: c.person?.[1] ?? "",
      chequeNumber: c.cheque,
      chequeDate: dmy(t.dated),
      chequeAmount: c.amount,
      chequeIfsc: c.ifsc,
      chequeAccount: c.account,
      presentDate: dmy(t.presented),
      returnDate: dmy(t.returned),
      returnReason: label("returnReason", c.reason),
      deposited: "Yes",
      payeeIfsc: "HDFC0000060",
      drawerPolice: "",
      natureDebt: label("natureOfDebt", "loan"),
      dispatchDate: dmy(t.dispatched),
      mode: label("modeOfService", c.mode),
      tracking: `RG${c.cheque}11IN`,
      delivered: c.delivered ? "Yes" : "No",
      deliveryDate: c.delivered ? dmy(t.served) : "",
      noticeReturnDate: c.delivered ? "" : dmy(t.served),
      nonDelivery: c.delivered ? "" : label("nonDelivery", "unclaimed"),
      replied: c.replied ? "Yes" : "No",
      payment: label("payment", c.paid ? "part" : "none"),
      paidAmount: c.paid ?? "",
      condonation: "",
    });
  }

  const extraCols = COLUMNS.filter((c) =>
    ["reference", "chequeNumber", "chequeDate", "chequeAmount", "chequeIfsc", "chequeAccount", "presentDate", "returnDate", "returnReason"].includes(c.key)
  );
  const extra = wb.addWorksheet("Extra cheques");
  extra.columns = extraCols.map((c) => ({ header: c.header, key: c.key, width: Math.max(18, c.header.length + 4) }));
  header(extra);
  for (const c of CASES.filter((x) => x.second)) {
    const t = timeline(c);
    extra.addRow({
      reference: c.ref,
      chequeNumber: c.second!.cheque,
      chequeDate: dmy(t.dated),
      chequeAmount: c.second!.amount,
      chequeIfsc: c.ifsc,
      chequeAccount: c.account,
      presentDate: dmy(t.presented),
      returnDate: dmy(t.returned),
      returnReason: label("returnReason", c.reason),
    });
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
    "Communication Address", "City", "PIN", "Chq No", "Chq Dt", "Chq Amount (Rs)", "Drawee Bank IFSC", "Drawer A/c No",
    "Presented On", "Bounce Date", "Bounce Reason", "Collecting IFSC", "Notice Sent On", "Sent Via", "AWB No",
    "Notice Status", "Served On", "Returned On", "Remarks", "Reply Recd", "Recovered After Notice",
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
      "Chq Dt": dmy(t.dated, "/"),
      "Chq Amount (Rs)": c.amount.toLocaleString("en-IN"),
      "Drawee Bank IFSC": c.ifsc,
      "Drawer A/c No": c.account,
      "Presented On": dmy(t.presented, "/"),
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
    });
  });
  const file = path.join(OUT, "tata-capital-recovery-mis.xlsx");
  await wb.xlsx.writeFile(file);
  return file;
}

mkdirSync(OUT, { recursive: true });
const files = [await templateFile(), await misFile()];
for (const f of files) console.log(`Wrote ${path.relative(process.cwd(), f)}`);
