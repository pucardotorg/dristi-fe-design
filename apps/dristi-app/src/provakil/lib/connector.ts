/**
 * The SARAS 2.0 connector: Provakil matters → the court's Bulk Filing API v1 request
 * (SARAS 2.0 is Gujarat's deployment of DRISTI).
 *
 * Rules only. Each DRISTI field is copied, normalised by a stated rule, or translated by
 * a fixed table. A value no table knows is sent as it is, so DRISTI's scrutiny holds it
 * and names it. Nothing is guessed, and nothing DRISTI derives (cause of action, filing
 * date, delay, fees) is sent.
 *
 * `MAPPING` is the same rules written out for people; the connector settings page shows
 * it. The authoritative record is docs/design/features/bulk-filing.md.
 */

import { BANK, OFFICERS, type Address, type Constitution, type Matter, type DocTag } from "./matters";

/* The request shape — the court's `lib/bulk/contract.ts`, restated for this app. */
type ApiAddress = { line1: string; city: string; pin: string; policeStation?: string };
type ApiRep = { name: string; designation?: string; age?: string; mobile?: string; email?: string; address?: ApiAddress };
export type ApiBatchRequest = {
  source: { system: string; reference?: string; sentBy?: string };
  complainant: {
    type: "institution";
    institutionType: string;
    name: string;
    cinPan: string;
    phone: string;
    email: string;
    address: ApiAddress;
    representative: ApiRep;
  };
  advocates: { barNumber: string }[];
  adr: "yes" | "no";
  cases: {
    reference: string;
    accused: {
      type: "individual" | "institution";
      name: string;
      institutionType?: string;
      age?: string;
      mobile?: string;
      email?: string;
      addresses: ApiAddress[];
      personsResponsible?: ApiRep[];
    }[];
    cheques: {
      number: string;
      date: string;
      amount: string;
      ifsc: string;
      accountNumber: string;
      presentedOn: string;
      returnedOn: string;
      returnReason: string;
    }[];
    notices: {
      natureOfDebt: string;
      dispatchedOn: string;
      mode: string;
      trackingNumber: string;
      delivered: boolean | null;
      deliveredOn?: string;
      returnedOn?: string;
      nonDeliveryReason?: string;
      replied: boolean;
      payment: { status: "none" | "part"; amount?: string };
    }[];
    jurisdiction: { depositedInOwnAccount: boolean; complainantBranchIfsc: string };
    condonationReason?: string;
    witnesses?: { name: string; designation: string; prove: string; mobile: string; address: ApiAddress }[];
    documents: { code: string; index?: number; name: string; url: string; contentType: string }[];
  }[];
};

/* ───────────────────────────── Translation tables ───────────────────────────── */

const INDIVIDUAL: Constitution[] = ["Individual", "Sole Proprietorship"];

const ENTITY_TYPE: Record<string, string> = {
  "Partnership Firm": "partnership",
  "Private Limited Company": "private-limited",
  "Public Limited Company": "public-limited",
  LLP: "llp",
};

/** NPCI return codes, as the return memo prints them. */
const RETURN_CODE: Record<string, string> = {
  "01": "funds-insufficient",
  "02": "exceeds-arrangement",
  "04": "payment-stopped",
  "12": "account-closed",
  "22": "signature-differs",
  "30": "amount-mismatch",
  "88": "refer-to-drawer",
};

const MODE: Record<string, string> = {
  RPAD: "rpad",
  "SPEED POST": "speed",
  COURIER: "courier",
  EMAIL: "email",
};

const NON_DELIVERY: Record<string, string> = {
  "Returned - Unclaimed": "unclaimed",
  "Returned - Refused": "refused",
  "Returned - Addressee Left": "left",
  "Returned - Insufficient Address": "incomplete",
};

const DOC_CODE: Record<DocTag, string> = {
  Cheque: "DCM-1",
  "Return memo": "DCM-2",
  "Legal notice": "DCM-3",
  "Postal receipt": "DCM-4",
  "Tracking report": "DCM-5",
  Reply: "DCM-6",
  "Loan agreement": "DCM-7",
  "Authorised officer ID": "DCM-9",
  Vakalatnama: "DCM-12",
};

/** Documents about the notice rather than a cheque. */
const NOTICE_TAGS: DocTag[] = ["Legal notice", "Postal receipt", "Tracking report", "Reply"];

/* ───────────────────────────── Rules ───────────────────────────── */

/** Whole years between a date of birth and today; "" without one. */
export function ageOn(dob: string | undefined, today = new Date()): string {
  if (!dob) return "";
  const b = new Date(`${dob}T00:00:00Z`);
  if (Number.isNaN(b.getTime())) return "";
  let age = today.getUTCFullYear() - b.getUTCFullYear();
  const m = today.getUTCMonth() - b.getUTCMonth();
  if (m < 0 || (m === 0 && today.getUTCDate() < b.getUTCDate())) age -= 1;
  return String(age);
}

/** Digits only, leading +91 or 0 dropped. Whatever is left is sent; DRISTI checks it. */
export function phone(raw: string | undefined): string {
  let d = (raw ?? "").replace(/\D/g, "");
  if (d.length === 12 && d.startsWith("91")) d = d.slice(2);
  if (d.length === 11 && d.startsWith("0")) d = d.slice(1);
  return d;
}

const addr = (a: { line: string; city: string; pincode: string; policeStation?: string }): ApiAddress => ({
  line1: a.line,
  city: a.city,
  pin: a.pincode,
  ...(a.policeStation ? { policeStation: a.policeStation } : {}),
});

/** "Bhavesh N. Thakkar (Prop. Shree Ambica Traders)" → the proprietor, who is the accused. */
function proprietor(name: string): string {
  return name.replace(/\s*\(Prop\..*\)\s*$/, "").trim();
}

function returnReason(memo: string): string {
  const code = memo.slice(0, 2);
  return RETURN_CODE[code] ?? memo;
}

/** Map one matter. `docBase` is where DRISTI fetches this workspace's documents from. */
export function mapMatter(m: Matter, docBase: string): ApiBatchRequest["cases"][number] {
  const b = m.borrower;
  const individual = INDIVIDUAL.includes(b.constitution);
  const delivered =
    m.notice.status === "Delivered" ? true : m.notice.status === "In Transit" ? null : false;
  const condonation = m.notes.find((n) => n.tag === "condonation");
  const multi = m.instruments.length > 1;

  return {
    reference: m.lan,
    accused: [
      {
        type: individual ? "individual" : "institution",
        name: individual ? proprietor(b.name) : b.name,
        ...(individual ? { age: ageOn(b.dob) } : { institutionType: ENTITY_TYPE[b.constitution] ?? b.constitution }),
        mobile: phone(b.mobile),
        email: (b.email ?? "").toLowerCase(),
        addresses: ["Residence", "Office", "Permanent"].flatMap((t) =>
          b.addresses.filter((a: Address) => a.type === t).map(addr)
        ),
        ...(individual
          ? {}
          : {
              personsResponsible: b.persons.map((p) => ({
                name: p.name,
                designation: p.designation,
                mobile: phone(p.mobile),
                email: p.email ?? "",
              })),
            }),
      },
    ],
    cheques: m.instruments.map((q) => ({
      number: q.chequeNo.padStart(6, "0"),
      date: q.chequeDate,
      amount: String(Math.round(q.amount)),
      ifsc: q.draweeIfsc.toUpperCase(),
      accountNumber: q.drawerAccount,
      presentedOn: q.depositDate,
      returnedOn: q.returnDate,
      returnReason: returnReason(q.returnReason),
    })),
    notices: [
      {
        natureOfDebt: "loan",
        dispatchedOn: m.notice.dispatchDate,
        mode: MODE[m.notice.mode] ?? m.notice.mode,
        trackingNumber: m.notice.consignmentNo,
        delivered,
        ...(delivered === true ? { deliveredOn: m.notice.statusDate } : {}),
        ...(delivered === false
          ? { returnedOn: m.notice.statusDate, nonDeliveryReason: NON_DELIVERY[m.notice.status] ?? m.notice.status }
          : {}),
        replied: m.notice.replyReceived,
        payment:
          m.receivedAfterNotice > 0
            ? { status: "part", amount: String(m.receivedAfterNotice) }
            : { status: "none" },
      },
    ],
    jurisdiction: {
      depositedInOwnAccount: true,
      complainantBranchIfsc: m.instruments[0].collectingIfsc.toUpperCase(),
    },
    ...(condonation ? { condonationReason: condonation.text } : {}),
    ...(m.witness
      ? {
          witnesses: [
            {
              name: m.witness.name,
              designation: m.witness.designation,
              prove: "The loan account statement and the dishonour of the cheque",
              mobile: phone(m.witness.mobile),
              address: addr(m.witness.address),
            },
          ],
        }
      : {}),
    // The court keeps the notice papers per cheque; one notice covering several cheques
    // is sent against each of them.
    documents: m.documents.flatMap((doc) => {
      const perCheque = NOTICE_TAGS.includes(doc.tag) && multi ? m.instruments.map((_, i) => i + 1) : [doc.index];
      return perCheque.map((index) => ({
        code: DOC_CODE[doc.tag],
        ...(multi && index ? { index } : {}),
        name: doc.name,
        url: `${docBase}/api/documents/${encodeURIComponent(doc.id)}`,
        contentType: "application/pdf",
      }));
    }),
  };
}

/**
 * One request per advocate: the batch lands in that advocate's SARAS 2.0 account, so a
 * selection across advocates is sent as one batch each. The complainant and its authorised
 * officer are the same for every case; the officer is the one for the region most of the
 * matters belong to.
 */
export function buildRequest(
  matters: Matter[],
  opts: { docBase: string; pushId: string; sentBy: string; adr: "yes" | "no" }
): ApiBatchRequest {
  const counts = new Map<Matter["region"], number>();
  for (const m of matters) counts.set(m.region, (counts.get(m.region) ?? 0) + 1);
  const region = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "Ahmedabad West";
  const officer = OFFICERS[region];
  const bars = [...new Set(matters.map((m) => m.advocate?.enrolment).filter((b): b is string => !!b))];

  return {
    source: { system: "Provakil", reference: opts.pushId, sentBy: opts.sentBy },
    complainant: {
      type: "institution",
      institutionType: BANK.constitution === "Public Ltd" ? "public-limited" : "society-trust",
      name: BANK.legalName,
      cinPan: BANK.cin.toUpperCase(),
      phone: phone(BANK.phone),
      email: BANK.email,
      address: addr(BANK.registeredOffice),
      representative: {
        name: officer.name,
        designation: officer.designation,
        age: ageOn(officer.dob),
        mobile: phone(officer.mobile),
        email: officer.email,
        address: addr(officer.office),
      },
    },
    advocates: bars.map((barNumber) => ({ barNumber })),
    adr: opts.adr,
    cases: matters.map((m) => mapMatter(m, opts.docBase)),
  };
}

/* ───────────────────────────── For people ───────────────────────────── */

export type MappingRow = { dristi: string; id: string; provakil: string; rule: string };

export const MAPPING: { group: string; rows: MappingRow[] }[] = [
  {
    group: "Complainant (set once, from the company profile)",
    rows: [
      { id: "LIT-2", dristi: "Complainant type", provakil: "—", rule: "Always Institution" },
      { id: "LIT-17", dristi: "Type of institution", provakil: "Company profile › Constitution", rule: "Public Ltd → Public limited company" },
      { id: "LIT-18", dristi: "Institution name", provakil: "Company profile › Legal name", rule: "As is" },
      { id: "LIT-18a", dristi: "CIN or PAN", provakil: "Company profile › CIN", rule: "Upper case" },
      { id: "LIT-21", dristi: "Institution address", provakil: "Company profile › Registered office", rule: "Line, city, pincode" },
      { id: "LIT-22…26", dristi: "Authorised representative", provakil: "Authorised officer for the region", rule: "Region with most selected cases; age from date of birth" },
    ],
  },
  {
    group: "Advocate",
    rows: [
      { id: "ADV-3", dristi: "Bar registration number", provakil: "Matter › Empanelled advocate › Enrolment no.", rule: "As is. SARAS 2.0 looks up the name" },
      { id: "ADV-2", dristi: "Advocate for", provakil: "—", rule: "The bank" },
    ],
  },
  {
    group: "Accused",
    rows: [
      { id: "ACC-1", dristi: "Accused type", provakil: "Borrower › Constitution", rule: "Individual, Sole proprietorship → Individual. Firm, company, LLP → Institution" },
      { id: "ACC-2 / 5", dristi: "Name", provakil: "Borrower › Name", rule: "Proprietorship: the proprietor's name" },
      { id: "ACC-3", dristi: "Age", provakil: "Borrower › Date of birth (KYC)", rule: "Whole years today" },
      { id: "ACC-4", dristi: "Type of institution", provakil: "Borrower › Constitution", rule: "Partnership firm, Private limited, Public limited, LLP" },
      { id: "ACC-6", dristi: "Mobile", provakil: "Borrower › Mobile", rule: "Digits only, +91 and leading 0 dropped" },
      { id: "ACC-7", dristi: "Email", provakil: "Borrower › Email", rule: "Lower case" },
      { id: "ACC-8…13", dristi: "Addresses", provakil: "Borrower › Addresses", rule: "Residence, office, permanent, in that order" },
      { id: "ACC-14…17", dristi: "Persons responsible (S-141)", provakil: "Borrower › Directors / partners", rule: "One per person" },
    ],
  },
  {
    group: "Cheque",
    rows: [
      { id: "CHQ-1", dristi: "Date on cheque", provakil: "Instrument › Cheque date", rule: "As is" },
      { id: "CHQ-2", dristi: "Amount", provakil: "Instrument › Amount", rule: "Whole rupees" },
      { id: "CHQ-3", dristi: "Cheque number", provakil: "Instrument › Cheque no.", rule: "Zero-padded to 6 digits" },
      { id: "CHQ-5", dristi: "IFSC", provakil: "Instrument › Drawee IFSC", rule: "Upper case. SARAS 2.0 looks up bank and branch" },
      { id: "CHQ-7a", dristi: "Account number", provakil: "Instrument › Drawer account", rule: "As is" },
      { id: "CHQ-8", dristi: "Presentation date", provakil: "Instrument › Deposit date", rule: "As is" },
      { id: "CHQ-9", dristi: "Return date", provakil: "Return memo › Date", rule: "As is" },
      { id: "CHQ-10", dristi: "Return reason", provakil: "Return memo › Reason code", rule: "01 Funds insufficient, 02 Exceeds arrangement, 04 Payment stopped, 12 Account closed, 22 Signature differs, 30 Amount mismatch, 88 Refer to drawer" },
    ],
  },
  {
    group: "Demand notice",
    rows: [
      { id: "LDN-1", dristi: "Nature of debt", provakil: "Matter › Product", rule: "Any loan → Loan / advance repayment" },
      { id: "LDN-2", dristi: "Dispatch date", provakil: "Notice › Dispatch date", rule: "As is" },
      { id: "LDN-3", dristi: "Mode of service", provakil: "Notice › Mode", rule: "RPAD, Speed post, Courier, Email" },
      { id: "LDN-4", dristi: "Tracking number", provakil: "Notice › Consignment no.", rule: "As is" },
      { id: "LDN-5", dristi: "Delivered", provakil: "Notice › Status", rule: "Delivered → Yes. Returned → No. In transit → unknown, held" },
      { id: "LDN-6 / 7", dristi: "Delivery or return date", provakil: "Notice › Status date", rule: "As is" },
      { id: "LDN-8", dristi: "Reason for non-delivery", provakil: "Notice › Status", rule: "Unclaimed, Refused, Left, Insufficient address" },
      { id: "LDN-9", dristi: "Accused replied", provakil: "Notice › Reply received", rule: "Yes / No" },
      { id: "LDN-10 / 11", dristi: "Payment after notice", provakil: "Loan account › Receipts after dispatch", rule: "Over ₹0 → Part payment with that amount" },
    ],
  },
  {
    group: "Jurisdiction",
    rows: [
      { id: "JUR-1", dristi: "Deposited in own account", provakil: "—", rule: "Always Yes" },
      { id: "JUR-2", dristi: "Complainant branch IFSC", provakil: "Instrument › Collecting branch IFSC", rule: "Upper case" },
      { id: "JUR-12", dristi: "Reason for condonation", provakil: "Matter › Note tagged condonation", rule: "Sent only when present" },
      { id: "JUR-9…11", dristi: "Cause of action, filing date, delay", provakil: "—", rule: "Not sent. SARAS 2.0 computes them" },
    ],
  },
  {
    group: "Documents",
    rows: [
      { id: "DCM-1", dristi: "Cheque", provakil: "Document tag › Cheque", rule: "Per cheque" },
      { id: "DCM-2", dristi: "Return memo", provakil: "Document tag › Return memo", rule: "Per cheque" },
      { id: "DCM-3", dristi: "Demand notice", provakil: "Document tag › Legal notice", rule: "" },
      { id: "DCM-4", dristi: "Proof of dispatch", provakil: "Document tag › Postal receipt", rule: "" },
      { id: "DCM-5", dristi: "Proof of delivery", provakil: "Document tag › Tracking report", rule: "" },
      { id: "DCM-6", dristi: "Reply to notice", provakil: "Document tag › Reply", rule: "" },
      { id: "DCM-7", dristi: "Proof of debt", provakil: "Document tag › Loan agreement", rule: "" },
      { id: "DCM-9", dristi: "ID card", provakil: "Document tag › Authorised officer ID", rule: "" },
      { id: "DCM-12", dristi: "Vakalatnama", provakil: "Document tag › Vakalatnama", rule: "" },
    ],
  },
];

/** What the court requires on file for each case, by Provakil tag. */
export const REQUIRED_TAGS: DocTag[] = [
  "Cheque",
  "Return memo",
  "Legal notice",
  "Postal receipt",
  "Tracking report",
  "Authorised officer ID",
  "Vakalatnama",
];
