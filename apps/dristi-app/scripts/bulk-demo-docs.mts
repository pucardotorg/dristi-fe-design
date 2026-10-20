/**
 * Builds the demo case documents for the AI-assisted bulk upload: twenty Word files, one
 * complaint each, written the way a lender's legal team writes them, with dates set from
 * today so every case is within limitation when it is uploaded.
 *
 *   demo-files/case-documents/*.docx
 *
 *   npm run demo:docs
 *
 * They vary on purpose, to show the review: most use headed sections and "Label: value"
 * lines; some lay the details out in a table; a few say part of it in prose (read by
 * pattern, marked to check); some use loose wording for a list value, or leave a required
 * detail out. The cases are fictional and differ from the Excel demos and Provakil's.
 */

import { mkdirSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";

import JSZip from "jszip";

const OUT = path.join(import.meta.dirname, "..", "..", "..", "demo-files", "case-documents");

const today = new Date();
const daysAgo = (n: number) => {
  const d = new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()));
  d.setUTCDate(d.getUTCDate() - n);
  return d;
};
const dmy = (d: Date, sep = "-") =>
  `${String(d.getUTCDate()).padStart(2, "0")}${sep}${String(d.getUTCMonth() + 1).padStart(2, "0")}${sep}${d.getUTCFullYear()}`;
const rupees = (n: number) => `Rs. ${n.toLocaleString("en-IN")}/-`;

/* ───────────────────────────── A minimal .docx ───────────────────────────── */

type Block = { h: string } | { p: string } | { table: [string, string][] } | { gap: true };

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const run = (text: string, bold = false, size?: number) =>
  `<w:r><w:rPr>${bold ? "<w:b/>" : ""}${size ? `<w:sz w:val="${size}"/>` : ""}<w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/></w:rPr><w:t xml:space="preserve">${esc(text)}</w:t></w:r>`;
const para = (inner: string, after = 80) => `<w:p><w:pPr><w:spacing w:after="${after}"/></w:pPr>${inner}</w:p>`;

function body(blocks: Block[]): string {
  return blocks
    .map((b) => {
      if ("h" in b) return para(run(b.h, true, 26), 120);
      if ("gap" in b) return para("", 0);
      if ("p" in b) {
        // "Label: value" lines bold their label, as a typed brief would.
        const m = /^([^:]{2,60}):\s(.*)$/.exec(b.p);
        return para(m ? run(`${m[1]}: `, true) + run(m[2]) : run(b.p));
      }
      const border = `<w:tblBorders>${["top", "left", "bottom", "right", "insideH", "insideV"].map((s) => `<w:${s} w:val="single" w:sz="4" w:color="BBBBBB"/>`).join("")}</w:tblBorders>`;
      const rows = b.table
        .map(([k, v]) => `<w:tr><w:tc><w:tcPr><w:tcW w:w="3600" w:type="dxa"/></w:tcPr>${para(run(k, true), 0)}</w:tc><w:tc><w:tcPr><w:tcW w:w="5400" w:type="dxa"/></w:tcPr>${para(run(v), 0)}</w:tc></w:tr>`)
        .join("");
      return `<w:tbl><w:tblPr><w:tblW w:w="9000" w:type="dxa"/>${border}</w:tblPr>${rows}</w:tbl>${para("", 120)}`;
    })
    .join("");
}

async function docx(blocks: Block[]): Promise<Buffer> {
  const zip = new JSZip();
  zip.file(
    "[Content_Types].xml",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>`,
  );
  zip.file(
    "_rels/.rels",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`,
  );
  zip.file(
    "word/document.xml",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${body(blocks)}<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1200" w:right="1200" w:bottom="1200" w:left="1200"/></w:sectPr></w:body></w:document>`,
  );
  return zip.generateAsync({ type: "nodebuffer" });
}

/* ───────────────────────────── The twenty cases ───────────────────────────── */

type Person = { name: string; age?: string; mobile: string; email?: string; address: string; city: string; pin: string; police?: string };
type Cheque = { number: string; amount: number; ifsc: string; account: string; reason: string };
type Case = {
  ref: string;
  style: "sections" | "table" | "prose";
  accused: (Person & { type?: "Institution"; entity?: string; person?: [string, string, string] })[];
  cheques: Cheque[];
  /** Days ago the notice was served; it went out 8 days before. */
  served: number;
  mode: string;
  tracking?: string;
  delivered: boolean;
  nonDelivery?: string;
  replied?: boolean;
  paid?: number;
  nature?: string;
  witness?: { name: string; designation: string; prove: string; mobile: string };
  condonation?: string;
  /** Leave a required detail out, to show "Not found in the document". */
  omit?: ("reference" | "pin" | "ifsc")[];
  note?: string;
};

const FUNDS = "Funds insufficient";
const CASES: Case[] = [
  { ref: "TCL-AHD-PL-2001", style: "sections", accused: [{ name: "Bhavik N. Parekh", age: "37", mobile: "9824031101", email: "bhavik.parekh@mail.example", address: "D-8, Sharnam Residency, Thaltej", city: "Ahmedabad", pin: "380059", police: "Sola Police Station" }], cheques: [{ number: "410233", amount: 118400, ifsc: "SBIN0060421", account: "38291011201", reason: FUNDS }], served: 19, mode: "Registered post (RPAD)", tracking: "RG204511201IN", delivered: true },
  { ref: "TCL-AHD-PL-2002", style: "sections", accused: [{ name: "Hetal S. Desai", age: "33", mobile: "9824031102", email: "hetal.desai@mail.example", address: "12, Aakash Tenements, Ghatlodia", city: "Ahmedabad", pin: "380061", police: "Ghatlodia Police Station" }], cheques: [{ number: "552190", amount: 64250, ifsc: "HDFC0000521", account: "50100445120", reason: FUNDS }], served: 20, mode: "Speed post", tracking: "EG118823402IN", delivered: true },
  { ref: "TCL-AHD-BL-2003", style: "table", accused: [{ name: "Shivam Polymers Pvt Ltd", type: "Institution", entity: "Private limited company", mobile: "9824031103", email: "accounts@shivampoly.example", address: "Plot 77, GIDC Vatva, Phase 1", city: "Ahmedabad", pin: "382445", police: "Vatva GIDC Police Station", person: ["Ramesh K. Shah", "Director", "9824031113"] }], cheques: [{ number: "880145", amount: 742000, ifsc: "UTIB0000080", account: "917020078812310", reason: FUNDS }], served: 18, mode: "Speed post", tracking: "EG118823403IN", delivered: true, witness: { name: "Kunal S. Shah", designation: "Branch Manager, Tata Capital, C G Road", prove: "The loan account statement and the dishonour", mobile: "9879055501" } },
  { ref: "TCL-AHD-PL-2004", style: "prose", accused: [{ name: "Nirav J. Thakor", age: "29", mobile: "9824031104", address: "45, Ambika Nagar, Odhav", city: "Ahmedabad", pin: "382415", police: "Odhav Police Station" }], cheques: [{ number: "300982", amount: 52800, ifsc: "PUNB0458600", account: "4586000100028812", reason: FUNDS }], served: 21, mode: "Registered post (RPAD)", delivered: true, note: "The cheque details are given in prose; AI reads them by pattern and marks them to check." },
  { ref: "TCL-AHD-TL-2005", style: "sections", accused: [{ name: "Manoj R. Patel", age: "46", mobile: "9824031105", email: "manoj.patel@mail.example", address: "B-3, Shantivan Society, Nikol", city: "Ahmedabad", pin: "382350", police: "Nikol Police Station" }, { name: "Rekha M. Patel", age: "43", mobile: "9824031115", address: "B-3, Shantivan Society, Nikol", city: "Ahmedabad", pin: "382350" }], cheques: [{ number: "214470", amount: 196000, ifsc: "BARB0MANINA", account: "21950100012290", reason: "Exceeds arrangement" }], served: 20, mode: "Speed post", tracking: "EG118823405IN", delivered: true, note: "Two accused, joint account holders." },
  { ref: "TCL-AHD-PL-2006", style: "sections", accused: [{ name: "Sonal V. Mehta", age: "31", mobile: "9824031106", email: "sonal.mehta@mail.example", address: "C-201, Parshwa Flats, Paldi", city: "Ahmedabad", pin: "380007", police: "Paldi Police Station" }], cheques: [{ number: "660218", amount: 88900, ifsc: "KKBK0002561", account: "7612011834", reason: "Insufficient funds" }], served: 19, mode: "RPAD", tracking: "RG204511206IN", delivered: true, note: "Loose wording: 'Insufficient funds' and 'RPAD', read as the court's options and marked to check." },
  { ref: "TCL-AHD-BL-2007", style: "table", accused: [{ name: "Patel Agro Traders", type: "Institution", entity: "Partnership firm", mobile: "9824031107", email: "patelagro@mail.example", address: "Shop 9, APMC Market, Jamalpur", city: "Ahmedabad", pin: "380001", police: "Gaekwad Haveli Police Station", person: ["Dinesh G. Patel", "Managing Partner", "9824031117"] }], cheques: [{ number: "118870", amount: 315500, ifsc: "CNRB0002627", account: "2627101015521", reason: FUNDS }, { number: "118871", amount: 150000, ifsc: "CNRB0002627", account: "2627101015521", reason: FUNDS }], served: 18, mode: "Courier", tracking: "DTDC7718823", delivered: true, nature: "Payment for goods supplied", note: "Two cheques on one complaint." },
  { ref: "TCL-AHD-PL-2008", style: "sections", accused: [{ name: "Ankit D. Rathod", age: "27", mobile: "9824031108", email: "ankit.rathod@mail.example", address: "17, Sanskar Row Houses, Chandkheda", city: "Ahmedabad", pin: "382424", police: "Chandkheda Police Station" }], cheques: [{ number: "402215", amount: 47300, ifsc: "ICIC0000317", account: "031701512230", reason: "Payment stopped by drawer" }], served: 22, mode: "Registered post (RPAD)", tracking: "RG204511208IN", delivered: false, nonDelivery: "Refused to accept" },
  { ref: "TCL-AHD-TL-2009", style: "sections", accused: [{ name: "Farhan I. Qureshi", age: "40", mobile: "9824031109", email: "farhan.q@mail.example", address: "6, Noor Park, Sarkhej", city: "Ahmedabad", pin: "382210", police: "Sarkhej Police Station" }], cheques: [{ number: "770031", amount: 132600, ifsc: "SBIN0060421", account: "38291015590", reason: "Account closed" }], served: 21, mode: "Speed post", tracking: "EG118823409IN", delivered: true, replied: true },
  { ref: "TCL-AHD-PL-2010", style: "sections", accused: [{ name: "Kavya P. Joshi", age: "35", mobile: "9824031110", email: "kavya.joshi@mail.example", address: "A-14, Swagat Bungalows, Gota", city: "Ahmedabad", pin: "382481", police: "Sola Police Station" }], cheques: [{ number: "509981", amount: 74800, ifsc: "HDFC0000521", account: "50100445988", reason: FUNDS }], served: 19, mode: "Registered post (RPAD)", tracking: "RG204511210IN", delivered: true, paid: 15000, note: "Part payment after the notice." },
  { ref: "TCL-AHD-BL-2011", style: "table", accused: [{ name: "Gujarat Steel Fabricators", type: "Institution", entity: "Proprietorship", mobile: "9824031111", email: "gsf@mail.example", address: "Shed 4, Naroda Industrial Estate", city: "Ahmedabad", pin: "382330", police: "Naroda Police Station", person: ["Hitesh B. Soni", "Proprietor", "9824031121"] }], cheques: [{ number: "330456", amount: 268000, ifsc: "PUNB0458600", account: "4586000100031144", reason: FUNDS }], served: 20, mode: "Speed post", tracking: "EG118823411IN", delivered: true },
  { ref: "TCL-AHD-PL-2012", style: "sections", accused: [{ name: "Ritu A. Vyas", age: "38", mobile: "9824031112", email: "ritu.vyas@mail.example", address: "302, Shivalik Heights, Prahladnagar", city: "Ahmedabad", pin: "380015", police: "Anandnagar Police Station" }], cheques: [{ number: "612240", amount: 91200, ifsc: "KKBK0002561", account: "7612012217", reason: FUNDS }], served: 18, mode: "Registered post (RPAD)", tracking: "RG204511212IN", delivered: true, omit: ["pin"], note: "The accused's pincode is missing." },
  { ref: "TCL-AHD-TL-2013", style: "prose", accused: [{ name: "Vipul H. Chauhan", age: "44", mobile: "9824031113", address: "19, Jalaram Society, Bapunagar", city: "Ahmedabad", pin: "380024", police: "Bapunagar Police Station" }], cheques: [{ number: "905517", amount: 156000, ifsc: "BARB0MANINA", account: "21950100015531", reason: FUNDS }], served: 20, mode: "Speed post", delivered: true },
  { ref: "TCL-AHD-PL-2014", style: "sections", accused: [{ name: "Neha K. Trivedi", age: "30", mobile: "9824031114", email: "neha.trivedi@mail.example", address: "B-501, Aaryan Gloria, South Bopal", city: "Ahmedabad", pin: "380058", police: "Bopal Police Station" }], cheques: [{ number: "778812", amount: 58400, ifsc: "ICIC0000317", account: "031701519908", reason: FUNDS }], served: 19, mode: "Email", tracking: "neha.trivedi@mail.example", delivered: true },
  { ref: "TCL-AHD-BL-2015", style: "sections", accused: [{ name: "Shree Ambica Textiles", type: "Institution", entity: "Partnership firm", mobile: "9824031115", email: "ambicatex@mail.example", address: "21, New Cloth Market, Raipur", city: "Ahmedabad", pin: "380002", police: "Kalupur Police Station", person: ["Jignesh M. Shah", "Partner", "9824031125"] }], cheques: [{ number: "221109", amount: 412000, ifsc: "UTIB0000080", account: "917020081120044", reason: FUNDS }], served: 21, mode: "Speed post", tracking: "EG118823415IN", delivered: true, nature: "Business / trade transaction", witness: { name: "Dipti R. Vora", designation: "Collections Officer", prove: "Presentation and return of the cheque", mobile: "9879055502" } },
  { ref: "TCL-AHD-PL-2016", style: "sections", accused: [{ name: "Karan S. Bhatt", age: "32", mobile: "9824031116", email: "karan.bhatt@mail.example", address: "8, Vishwas Duplex, Vastral", city: "Ahmedabad", pin: "382418", police: "Ramol Police Station" }], cheques: [{ number: "640075", amount: 69900, ifsc: "SBIN0060421", account: "38291017721", reason: FUNDS }], served: 52, mode: "Registered post (RPAD)", tracking: "RG204511216IN", delivered: true, condonation: "The authorised officer handling the matter was hospitalised from the date the cause of action arose and the file could not be instructed in time.", note: "Filed late: a condonation reason is given." },
  { ref: "TCL-AHD-TL-2017", style: "table", accused: [{ name: "Jagdish V. Prajapati", age: "50", mobile: "9824031117", email: "jagdish.p@mail.example", address: "4, Krishna Kunj, Isanpur", city: "Ahmedabad", pin: "382443", police: "Isanpur Police Station" }], cheques: [{ number: "118045", amount: 205500, ifsc: "CNRB0002627", account: "2627101018840", reason: "Drawer's signature differs / incomplete" }], served: 20, mode: "Speed post", tracking: "EG118823417IN", delivered: true },
  { ref: "TCL-AHD-PL-2018", style: "sections", accused: [{ name: "Pooja N. Shah", age: "28", mobile: "9824031118", email: "pooja.shah@mail.example", address: "11, Sundarvan Society, Satellite", city: "Ahmedabad", pin: "380015", police: "Satellite Police Station" }], cheques: [{ number: "339921", amount: 43750, ifsc: "HDFC0000521", account: "50100446301", reason: FUNDS }], served: 19, mode: "Registered post (RPAD)", tracking: "RG204511218IN", delivered: true, omit: ["reference"], note: "No loan account number in the document: the file name stands in, to check." },
  { ref: "TCL-AHD-BL-2019", style: "sections", accused: [{ name: "Mahadev Logistics LLP", type: "Institution", entity: "LLP", mobile: "9824031119", email: "ops@mahadevlog.example", address: "Godown 3, Changodar Industrial Area", city: "Ahmedabad", pin: "382213", police: "Changodar Police Station", person: ["Sanjay T. Raval", "Designated Partner", "9824031129"] }], cheques: [{ number: "450612", amount: 389000, ifsc: "KKBK0002561", account: "7612013345", reason: FUNDS }], served: 18, mode: "Courier", tracking: "BLUEDART88231", delivered: true },
  { ref: "TCL-AHD-PL-2020", style: "sections", accused: [{ name: "Deepak L. Solanki", age: "41", mobile: "9824031120", email: "deepak.solanki@mail.example", address: "27, Gayatri Park, Maninagar East", city: "Ahmedabad", pin: "380008", police: "Maninagar Police Station" }], cheques: [{ number: "801136", amount: 99000, ifsc: "PUNB0458600", account: "4586000100036675", reason: FUNDS }], served: 21, mode: "Registered post (RPAD)", tracking: "RG204511220IN", delivered: false, nonDelivery: "Left without instructions" },
];

/* ───────────────────────────── Writing one ───────────────────────────── */

function blocks(c: Case): Block[] {
  const served = daysAgo(c.served);
  const dispatched = daysAgo(c.served + 8);
  const returned = daysAgo(c.served + 14);
  const presented = daysAgo(c.served + 17);
  const dated = daysAgo(c.served + 30);
  const omit = new Set(c.omit ?? []);
  const out: Block[] = [
    { h: "COMPLAINT UNDER SECTION 138 OF THE NEGOTIABLE INSTRUMENTS ACT, 1881" },
    { p: "Before the Learned Judicial Magistrate First Class, SARAS Court, Ahmedabad" },
    { p: "Complainant: Tata Capital Ltd, through its authorised officer" },
    { gap: true },
  ];
  if (!omit.has("reference")) out.push({ p: `Loan account number: ${c.ref}` });
  out.push({ gap: true });

  // The accused.
  c.accused.forEach((a, k) => {
    const rows: [string, string][] = [
      ["Type", a.type ?? "Individual"],
      ...(a.entity ? ([["Institution type", a.entity]] as [string, string][]) : []),
      ["Name", a.name],
      ...(a.age ? ([["Age", a.age]] as [string, string][]) : []),
      ["Mobile", `+91 ${a.mobile.slice(0, 5)} ${a.mobile.slice(5)}`],
      ...(a.email ? ([["Email", a.email]] as [string, string][]) : []),
      ["Address", a.address],
      ["City", a.city],
      ...(omit.has("pin") ? [] : ([["Pincode", a.pin]] as [string, string][])),
      ...(a.police ? ([["Police station", a.police]] as [string, string][]) : []),
    ];
    out.push({ h: c.accused.length > 1 ? `Accused ${k + 1}` : "Accused" });
    if (c.style === "table") out.push({ table: rows });
    else rows.forEach(([l, v]) => out.push({ p: `${l}: ${v}` }));
    if (a.person) {
      out.push({ h: "Person responsible" });
      const pr: [string, string][] = [["Name", a.person[0]], ["Designation", a.person[1]], ["Mobile", a.person[2]]];
      if (c.style === "table") out.push({ table: pr });
      else pr.forEach(([l, v]) => out.push({ p: `${l}: ${v}` }));
    }
  });

  // The cheques: in prose for the "prose" briefs, otherwise as fields.
  c.cheques.forEach((q, k) => {
    out.push({ h: c.cheques.length > 1 ? `Cheque ${k + 1}` : "Cheque details" });
    if (c.style === "prose") {
      out.push({
        p: `The accused issued cheque no. ${q.number} dated ${dmy(dated)} for ${rupees(q.amount)}, drawn on account ${q.account} with ${q.ifsc}, towards repayment of the loan. It was presented on ${dmy(presented)} and returned unpaid on ${dmy(returned)}.`,
      });
      out.push({ p: `Return reason: ${q.reason}` });
      return;
    }
    const rows: [string, string][] = [
      ["Cheque number", q.number],
      ["Date", dmy(dated)],
      ["Amount", rupees(q.amount)],
      ...(omit.has("ifsc") ? [] : ([["Drawer bank IFSC", q.ifsc]] as [string, string][])),
      ["Drawer account number", q.account],
      ["Presentation date", dmy(presented)],
      ["Return date", dmy(returned)],
      ["Return reason", q.reason],
    ];
    if (c.style === "table") out.push({ table: rows });
    else rows.forEach(([l, v]) => out.push({ p: `${l}: ${v}` }));
  });

  // The demand notice.
  out.push({ h: "Demand notice" });
  const notice: [string, string][] = [
    ["Nature of debt", c.nature ?? "Loan / advance repayment"],
    ["Dispatch date", dmy(dispatched)],
    ["Mode of service", c.mode],
    ...(c.tracking ? ([["Tracking number", c.tracking]] as [string, string][]) : []),
    ["Delivered", c.delivered ? "Yes" : "No"],
    ...(c.delivered ? ([["Delivery date", dmy(served)]] as [string, string][]) : ([["Return date", dmy(served)], ["Reason for non-delivery", c.nonDelivery ?? "Unclaimed"]] as [string, string][])),
    ["Accused replied", c.replied ? "Yes" : "No"],
    ["Payment after notice", c.paid ? "Part payment made" : "No payment made"],
    ...(c.paid ? ([["Amount paid", String(c.paid)]] as [string, string][]) : []),
  ];
  if (c.style === "table") out.push({ table: notice });
  else notice.forEach(([l, v]) => out.push({ p: `${l}: ${v}` }));

  // Jurisdiction.
  out.push({ h: "Jurisdiction" });
  out.push({ p: "Deposited in complainant's own account: Yes" });
  out.push({ p: "Complainant branch IFSC: HDFC0000060" });
  if (c.condonation) out.push({ p: `Reason for condonation of delay: ${c.condonation}` });

  if (c.witness) {
    out.push({ h: "Witness 1" });
    const w: [string, string][] = [
      ["Name", c.witness.name],
      ["Designation", c.witness.designation],
      ["What the witness will prove", c.witness.prove],
      ["Mobile", c.witness.mobile],
      ["Address", "Tata Capital Ltd, C G Road branch, Navrangpura"],
      ["City", "Ahmedabad"],
      ["Pincode", "380009"],
    ];
    if (c.style === "table") out.push({ table: w });
    else w.forEach(([l, v]) => out.push({ p: `${l}: ${v}` }));
  }

  out.push({ gap: true });
  out.push({ p: "The complainant prays that the accused be summoned and tried for the offence under Section 138 of the Negotiable Instruments Act, 1881." });
  out.push({ p: `Place: Ahmedabad    Date: ${dmy(daysAgo(0), "/")}` });
  return out;
}

mkdirSync(OUT, { recursive: true });
for (const f of readdirSync(OUT)) if (f.endsWith(".docx")) rmSync(path.join(OUT, f));
for (const c of CASES) {
  const name = `${c.ref}-${c.accused[0].name.replace(/[^A-Za-z]+/g, "-").replace(/-+$/, "")}.docx`;
  writeFileSync(path.join(OUT, name), await docx(blocks(c)));
}
writeFileSync(
  path.join(OUT, "README.md"),
  `# Demo case documents

Twenty sample complaints for the AI-assisted bulk upload (**Bulk filing › Upload cases**), one Word file per case. Regenerate with \`npm run demo:docs\`; dates are set
from the day they are made.

What each one shows on review:

${CASES.map((c) => `- \`${c.ref}\`: ${c.note ?? (c.style === "table" ? "details laid out in tables" : c.style === "prose" ? "cheque details in prose, read by pattern and marked to check" : "headed sections, every field labelled")}`).join("\n")}
`,
);
console.log(`Wrote ${CASES.length} case documents to ${path.relative(process.cwd(), OUT)}`);
