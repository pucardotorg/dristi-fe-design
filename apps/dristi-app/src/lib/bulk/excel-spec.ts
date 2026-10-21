/**
 * The bulk filing Excel template — the bare minimum a filer fills to bring many S-138
 * complaints in at once (docs/design/features/bulk-filing.md, "Excel template").
 *
 * One required sheet, `Cases`, one row per case. What is the same for every case (the
 * complainant, the representative, the advocate) is chosen once on the upload screen, so
 * the sheet carries only the accused, the cheque and the notice.
 *
 * This file has no imports on purpose: the Provakil mock reads it to export in the same
 * format. The lists restate DRISTI's options by label; `excel-spec.test.ts` fails if they
 * drift from `lib/filing/options.ts`.
 */

export type ListName =
  | "yesNo"
  | "complainantEntity"
  | "gender"
  | "accusedType"
  | "accusedEntity"
  | "returnReason"
  | "natureOfDebt"
  | "modeOfService"
  | "nonDelivery"
  | "payment";

/** value → label, in the order the dropdown offers them. */
export const LISTS: Record<ListName, { value: string; label: string }[]> = {
  yesNo: [
    { value: "yes", label: "Yes" },
    { value: "no", label: "No" },
  ],
  complainantEntity: [
    { value: "proprietorship", label: "Proprietorship" },
    { value: "partnership", label: "Partnership firm" },
    { value: "private-limited", label: "Private limited company" },
    { value: "public-limited", label: "Public limited company" },
    { value: "society-trust", label: "Society / trust" },
    { value: "llp", label: "LLP" },
  ],
  gender: [
    { value: "male", label: "Male" },
    { value: "female", label: "Female" },
    { value: "other", label: "Other" },
  ],
  accusedType: [
    { value: "individual", label: "Individual" },
    { value: "institution", label: "Institution" },
  ],
  accusedEntity: [
    { value: "proprietorship", label: "Proprietorship" },
    { value: "partnership", label: "Partnership firm" },
    { value: "private-limited", label: "Private limited company" },
    { value: "public-limited", label: "Public limited company" },
    { value: "society-trust", label: "Society / trust" },
    { value: "llp", label: "LLP" },
    { value: "other", label: "Other entity" },
  ],
  returnReason: [
    { value: "funds-insufficient", label: "Funds insufficient" },
    { value: "exceeds-arrangement", label: "Exceeds arrangement" },
    { value: "account-closed", label: "Account closed" },
    { value: "payment-stopped", label: "Payment stopped by drawer" },
    { value: "signature-differs", label: "Drawer's signature differs / incomplete" },
    { value: "amount-mismatch", label: "Amount in words and figures differ" },
    { value: "refer-to-drawer", label: "Refer to drawer" },
    { value: "stale-cheque", label: "Cheque post-dated / stale" },
  ],
  natureOfDebt: [
    { value: "loan", label: "Loan / advance repayment" },
    { value: "goods", label: "Payment for goods supplied" },
    { value: "services", label: "Payment for services rendered" },
    { value: "business", label: "Business / trade transaction" },
    { value: "borrowed", label: "Repayment of borrowed money" },
    { value: "other", label: "Other liability" },
  ],
  modeOfService: [
    { value: "rpad", label: "Registered post (RPAD)" },
    { value: "speed", label: "Speed post" },
    { value: "courier", label: "Courier" },
    { value: "email", label: "Email" },
    { value: "hand", label: "Hand delivery" },
    { value: "fax", label: "Fax" },
  ],
  nonDelivery: [
    { value: "not-available", label: "Addressee not available" },
    { value: "refused", label: "Refused to accept" },
    { value: "incomplete", label: "Address incomplete / incorrect" },
    { value: "left", label: "Left without instructions" },
    { value: "unclaimed", label: "Unclaimed" },
    { value: "lost", label: "Item lost in transit" },
    { value: "other", label: "Other" },
  ],
  payment: [
    { value: "none", label: "No payment made" },
    { value: "part", label: "Part payment made" },
  ],
};

export type ColumnKind = "text" | "date" | "number" | "phone" | "list";

/**
 * The sections of a case. Some repeat (PRD §3.3): a case can have several complainants,
 * accused, cheques, notices, witnesses and other pending cases, and each accused several
 * addresses and persons responsible. In a sheet, a repeat is the same column with `_2`,
 * `_3`… after its name; a nested repeat (an accused's second address) takes two numbers,
 * `_1_2`. See `docs/design/features/bulk-filing.md`.
 */
export type GroupId =
  | "case"
  | "complainant"
  | "accused"
  | "address"
  | "person"
  | "cheque"
  | "notice"
  | "jurisdiction"
  | "witness"
  | "otherCase";

export type Group = {
  id: GroupId;
  label: string;
  /** Repeats with `_n`. */
  repeats: boolean;
  /** A repeat inside each instance of this group (`_parent_child`). */
  parent?: GroupId;
  /** The number the unsuffixed column stands for. Complainant 1 is chosen on screen, so the sheet's complainant columns describe complainant 2 onwards. */
  first: number;
  /** Present in every case; otherwise only when some column of it has a value. */
  always: boolean;
};

export const GROUPS: Group[] = [
  { id: "case", label: "Case", repeats: false, first: 1, always: true },
  { id: "complainant", label: "Complainant", repeats: true, first: 2, always: false },
  { id: "accused", label: "Accused", repeats: true, first: 1, always: true },
  { id: "address", label: "Accused address", repeats: true, parent: "accused", first: 1, always: true },
  { id: "person", label: "Person responsible", repeats: true, parent: "accused", first: 1, always: false },
  { id: "cheque", label: "Cheque", repeats: true, first: 1, always: true },
  { id: "notice", label: "Demand notice", repeats: true, first: 1, always: true },
  { id: "jurisdiction", label: "Jurisdiction and limitation", repeats: false, first: 1, always: true },
  { id: "witness", label: "Witness", repeats: true, first: 1, always: false },
  { id: "otherCase", label: "Other pending case", repeats: true, first: 1, always: false },
];

export const groupOf = (id: GroupId) => GROUPS.find((g) => g.id === id)!;

export type Column = {
  key: string;
  group: GroupId;
  header: string;
  /** Handover field ID. */
  field: string;
  kind: ColumnKind;
  list?: ListName;
  /** "Yes", or the condition under which it is required, or "No". */
  required: string;
  /** Other headers a filer's own sheet commonly uses for it. Matched exactly, case-blind. */
  aliases: string[];
  example: string;
};

export const COLUMNS: Column[] = [
  { key: "reference", group: "case", header: "Case reference", field: "—", kind: "text", required: "Yes, unique in the file", aliases: ["LAN", "Loan account number", "Loan account no", "Reference", "Ref no", "Account number"], example: "EXAMPLE-0001" },
  { key: "accusedType", group: "accused", header: "Accused type", field: "ACC-1", kind: "list", list: "accusedType", required: "Yes", aliases: ["Borrower type", "Party type"], example: "Individual" },
  { key: "accusedName", group: "accused", header: "Accused name", field: "ACC-2", kind: "text", required: "Yes", aliases: ["Borrower name", "Borrower", "Drawer name", "Customer name", "Name of accused"], example: "Bhavesh N. Thakkar" },
  { key: "accusedEntity", group: "accused", header: "Accused institution type", field: "ACC-4", kind: "list", list: "accusedEntity", required: "When Institution", aliases: ["Constitution", "Entity type"], example: "" },
  { key: "accusedAge", group: "accused", header: "Accused age", field: "ACC-3", kind: "number", required: "No", aliases: ["Age", "Borrower age"], example: "41" },
  { key: "accusedMobile", group: "accused", header: "Accused mobile", field: "ACC-6", kind: "phone", required: "Mobile or email", aliases: ["Mobile", "Mobile number", "Borrower mobile", "Phone", "Contact number"], example: "9824000000" },
  { key: "accusedEmail", group: "accused", header: "Accused email", field: "ACC-7", kind: "text", required: "Mobile or email", aliases: ["Email", "Borrower email", "Email id"], example: "bhavesh@mail.example" },
  { key: "accusedAddress", group: "address", header: "Accused address", field: "ACC-8", kind: "text", required: "Yes", aliases: ["Address", "Borrower address", "Residence address", "Address line 1"], example: "B-14, Shivalik Bungalows, Satellite" },
  { key: "accusedCity", group: "address", header: "Accused city", field: "ACC-8", kind: "text", required: "Yes", aliases: ["City", "Town"], example: "Ahmedabad" },
  { key: "accusedPin", group: "address", header: "Accused pincode", field: "ACC-8", kind: "text", required: "Yes", aliases: ["Pincode", "Pin code", "PIN", "Postal code"], example: "380015" },
  { key: "accusedPolice", group: "address", header: "Accused police station", field: "ACC-13", kind: "text", required: "No", aliases: ["Police station"], example: "Satellite Police Station" },
  { key: "personName", group: "person", header: "Person responsible name", field: "ACC-14", kind: "text", required: "When Institution", aliases: ["Director name", "Partner name", "Authorised signatory"], example: "" },
  { key: "personDesignation", group: "person", header: "Person responsible designation", field: "ACC-15", kind: "text", required: "No", aliases: ["Director designation", "Designation"], example: "" },
  { key: "personMobile", group: "person", header: "Person responsible mobile", field: "ACC-16", kind: "phone", required: "When Institution", aliases: ["Director mobile", "Partner mobile"], example: "" },
  { key: "personEmail", group: "person", header: "Person responsible email", field: "ACC-17", kind: "text", required: "No", aliases: ["Director email", "Partner email"], example: "" },
  { key: "personAddress", group: "person", header: "Person responsible address", field: "ACC-18", kind: "text", required: "No", aliases: ["Director address"], example: "" },
  { key: "personCity", group: "person", header: "Person responsible city", field: "ACC-18", kind: "text", required: "No", aliases: [], example: "" },
  { key: "personPin", group: "person", header: "Person responsible pincode", field: "ACC-18", kind: "text", required: "No", aliases: [], example: "" },
  { key: "chequeNumber", group: "cheque", header: "Cheque number", field: "CHQ-3", kind: "text", required: "Yes, 6 digits", aliases: ["Cheque no", "Cheque no.", "Instrument number", "Chq no"], example: "100000" },
  { key: "chequeDate", group: "cheque", header: "Cheque date", field: "CHQ-1", kind: "date", required: "Yes", aliases: ["Date of cheque", "Instrument date"], example: "15-07-2026" },
  { key: "chequeAmount", group: "cheque", header: "Cheque amount", field: "CHQ-2", kind: "number", required: "Yes", aliases: ["Amount", "Cheque amt", "Instrument amount"], example: "125000" },
  { key: "chequeIfsc", group: "cheque", header: "Drawer bank IFSC", field: "CHQ-5", kind: "text", required: "Yes", aliases: ["IFSC", "Drawee IFSC", "Drawee bank IFSC", "Bank IFSC"], example: "SBIN0060421" },
  { key: "chequeAccount", group: "cheque", header: "Drawer account number", field: "CHQ-7a", kind: "text", required: "Yes", aliases: ["Drawer account", "Drawer a/c no", "Account no"], example: "50100000000" },
  { key: "presentDate", group: "cheque", header: "Presentation date", field: "CHQ-8", kind: "date", required: "Yes", aliases: ["Deposit date", "Date of presentation", "Date of deposit"], example: "04-08-2026" },
  { key: "returnDate", group: "cheque", header: "Return date", field: "CHQ-9", kind: "date", required: "Yes", aliases: ["Cheque return date", "Date of return", "Bounce date", "Dishonour date"], example: "07-08-2026" },
  { key: "returnReason", group: "cheque", header: "Return reason", field: "CHQ-10", kind: "list", list: "returnReason", required: "Yes", aliases: ["Reason for return", "Return memo reason", "Bounce reason", "Dishonour reason"], example: "Funds insufficient" },
  { key: "deposited", group: "jurisdiction", header: "Deposited in complainant's own account", field: "JUR-1", kind: "list", list: "yesNo", required: "Yes", aliases: ["Deposited in own account"], example: "Yes" },
  { key: "payeeIfsc", group: "jurisdiction", header: "Complainant branch IFSC", field: "JUR-2", kind: "text", required: "When deposited in own account", aliases: ["Collecting branch IFSC", "Collecting IFSC", "Presenting bank IFSC"], example: "HDFC0000060" },
  { key: "payeePolice", group: "jurisdiction", header: "Complainant branch police station", field: "JUR-5", kind: "text", required: "No", aliases: [], example: "" },
  { key: "drawerPolice", group: "jurisdiction", header: "Drawer branch police station", field: "JUR-6a", kind: "text", required: "When not deposited in own account", aliases: [], example: "" },
  { key: "natureDebt", group: "notice", header: "Nature of debt", field: "LDN-1", kind: "list", list: "natureOfDebt", required: "Yes", aliases: ["Nature of liability", "Debt type"], example: "Loan / advance repayment" },
  { key: "dispatchDate", group: "notice", header: "Notice dispatch date", field: "LDN-2", kind: "date", required: "Yes", aliases: ["Notice date", "Date of notice", "Legal notice date", "Notice sent on"], example: "12-08-2026" },
  { key: "mode", group: "notice", header: "Notice mode of service", field: "LDN-3", kind: "list", list: "modeOfService", required: "Yes", aliases: ["Mode of dispatch", "Dispatch mode", "Notice mode"], example: "Registered post (RPAD)" },
  { key: "tracking", group: "notice", header: "Notice tracking number", field: "LDN-4", kind: "text", required: "No", aliases: ["Consignment number", "Consignment no", "AWB", "Tracking no"], example: "RG400000000IN" },
  { key: "delivered", group: "notice", header: "Notice delivered", field: "LDN-5", kind: "list", list: "yesNo", required: "Yes", aliases: ["Delivered", "Notice served"], example: "Yes" },
  { key: "deliveryDate", group: "notice", header: "Notice delivery date", field: "LDN-6", kind: "date", required: "When delivered", aliases: ["Delivery date", "Date of service", "Served on"], example: "18-08-2026" },
  { key: "noticeReturnDate", group: "notice", header: "Notice return date", field: "LDN-7", kind: "date", required: "When not delivered", aliases: [], example: "" },
  { key: "nonDelivery", group: "notice", header: "Reason for non-delivery", field: "LDN-8", kind: "list", list: "nonDelivery", required: "When not delivered", aliases: ["Return remark", "Undelivered reason"], example: "" },
  { key: "replied", group: "notice", header: "Accused replied", field: "LDN-9", kind: "list", list: "yesNo", required: "Yes", aliases: ["Reply received"], example: "No" },
  { key: "payment", group: "notice", header: "Payment after notice", field: "LDN-10", kind: "list", list: "payment", required: "Yes", aliases: [], example: "No payment made" },
  { key: "paidAmount", group: "notice", header: "Amount paid", field: "LDN-11", kind: "number", required: "When part payment", aliases: ["Amount received after notice", "Part payment amount"], example: "" },
  { key: "condonation", group: "jurisdiction", header: "Reason for condonation of delay", field: "JUR-12", kind: "text", required: "When the system computes a delay", aliases: ["Condonation reason", "Delay reason"], example: "" },
  { key: "otherDetails", group: "case", header: "Additional details", field: "PRY-1", kind: "text", required: "No", aliases: ["Remarks for court", "Other details"], example: "" },
  { key: "witnessName", group: "witness", header: "Witness name", field: "WIT-1", kind: "text", required: "Name or designation, for each witness", aliases: [], example: "" },
  { key: "witnessDesignation", group: "witness", header: "Witness designation", field: "WIT-4", kind: "text", required: "Name or designation, for each witness", aliases: [], example: "" },
  { key: "witnessAge", group: "witness", header: "Witness age", field: "WIT-2", kind: "number", required: "No", aliases: [], example: "" },
  { key: "witnessProve", group: "witness", header: "What the witness will prove", field: "WIT-3", kind: "text", required: "No", aliases: [], example: "" },
  { key: "witnessMobile", group: "witness", header: "Witness mobile", field: "WIT-5", kind: "phone", required: "No", aliases: [], example: "" },
  { key: "witnessEmail", group: "witness", header: "Witness email", field: "WIT-6", kind: "text", required: "No", aliases: [], example: "" },
  { key: "witnessAddress", group: "witness", header: "Witness address", field: "WIT-7", kind: "text", required: "For each witness", aliases: [], example: "" },
  { key: "witnessCity", group: "witness", header: "Witness city", field: "WIT-7", kind: "text", required: "For each witness", aliases: [], example: "" },
  { key: "witnessPin", group: "witness", header: "Witness pincode", field: "WIT-7", kind: "text", required: "For each witness", aliases: [], example: "" },
  { key: "otherCourt", group: "otherCase", header: "Other pending case court", field: "JUR-7", kind: "text", required: "No", aliases: [], example: "" },
  { key: "otherNumber", group: "otherCase", header: "Other pending case number", field: "JUR-8", kind: "text", required: "No", aliases: [], example: "" },
  { key: "compType", group: "complainant", header: "Complainant type", field: "LIT-2", kind: "list", list: "accusedType", required: "For each further complainant", aliases: [], example: "" },
  { key: "compName", group: "complainant", header: "Complainant name", field: "LIT-4 / LIT-18", kind: "text", required: "For each further complainant", aliases: [], example: "" },
  { key: "compEntity", group: "complainant", header: "Complainant institution type", field: "LIT-17", kind: "list", list: "complainantEntity", required: "When Institution", aliases: [], example: "" },
  { key: "compCinPan", group: "complainant", header: "Complainant CIN or PAN", field: "LIT-18a", kind: "text", required: "When Institution", aliases: [], example: "" },
  { key: "compAge", group: "complainant", header: "Complainant age", field: "LIT-5", kind: "number", required: "When Individual", aliases: [], example: "" },
  { key: "compGender", group: "complainant", header: "Complainant gender", field: "LIT-5a", kind: "list", list: "gender", required: "No", aliases: [], example: "" },
  { key: "compMobile", group: "complainant", header: "Complainant mobile", field: "LIT-3", kind: "phone", required: "When Individual", aliases: [], example: "" },
  { key: "compEmail", group: "complainant", header: "Complainant email", field: "LIT-6", kind: "text", required: "No", aliases: [], example: "" },
  { key: "compAddress", group: "complainant", header: "Complainant address", field: "LIT-7 / LIT-21", kind: "text", required: "For each further complainant", aliases: [], example: "" },
  { key: "compCity", group: "complainant", header: "Complainant city", field: "LIT-7 / LIT-21", kind: "text", required: "For each further complainant", aliases: [], example: "" },
  { key: "compPin", group: "complainant", header: "Complainant pincode", field: "LIT-7 / LIT-21", kind: "text", required: "For each further complainant", aliases: [], example: "" },
  { key: "compRepName", group: "complainant", header: "Complainant representative name", field: "LIT-23", kind: "text", required: "When Institution", aliases: [], example: "" },
  { key: "compRepDesignation", group: "complainant", header: "Complainant representative designation", field: "LIT-25a", kind: "text", required: "When Institution", aliases: [], example: "" },
  { key: "compRepAge", group: "complainant", header: "Complainant representative age", field: "LIT-24", kind: "number", required: "When Institution", aliases: [], example: "" },
  { key: "compRepMobile", group: "complainant", header: "Complainant representative mobile", field: "LIT-22", kind: "phone", required: "When Institution", aliases: [], example: "" },
];

export const CASES_SHEET = "Cases";
export const LISTS_SHEET = "Lists";

/** The value for a label in a list, read leniently (case, spacing and punctuation ignored). */
export function listValue(list: ListName, label: string): string | null {
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
  const n = norm(label);
  if (!n) return null;
  const hit = LISTS[list].find((o) => norm(o.label) === n || norm(o.value) === n);
  return hit?.value ?? null;
}

/** Header comparison: case, spacing and punctuation ignored. */
export function normHeader(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, "");
}

/** "2026-08-07" → "07-08-2026", the template's date format. */
export function toSheetDate(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : iso;
}

/* ───────────────────────────── Guide rows ───────────────────────────── */

/** An example row's Case reference starts with this; upload skips such rows. */
export const EXAMPLE_PREFIX = "EXAMPLE";

/** What a column takes, in a few words: "Date, DD-MM-YYYY. Required". */
export function formatHint(c: Column): string {
  const type =
    c.kind === "date"
      ? "Date, DD-MM-YYYY"
      : c.kind === "number"
        ? "Number, no commas"
        : c.kind === "phone"
          ? "10-digit mobile number"
          : c.kind === "list" && c.list
            ? LISTS[c.list].length <= 3
              ? `Choose: ${LISTS[c.list].map((o) => o.label).join(" / ")}`
              : "Choose from the dropdown"
            : "Text";
  const need =
    c.required === "No"
      ? "Optional"
      : c.required === "Yes"
        ? "Required"
        : c.required.startsWith("Yes, ")
          ? `Required, ${c.required.slice(5)}`
          : c.required.startsWith("When ")
            ? `Required when ${c.required.slice(5)}`
            : c.required.startsWith("For each ")
              ? `Required ${c.required.charAt(0).toLowerCase()}${c.required.slice(1)}`
              : `Required: ${c.required.charAt(0).toLowerCase()}${c.required.slice(1)}`;
  return `${type}. ${need}`;
}

/**
 * The template's own guide rows, which upload discards. A row is one when any of these
 * holds, so the example is caught even if someone edits part of it:
 *
 * - a value starts with EXAMPLE (the example's Case reference);
 * - three or more values are format hints (the format row);
 * - most of its distinctive values are the example's own (an example with the reference
 *   changed). Distinctive means not a Yes/No or list value any real case would share.
 */
export function isGuideRow(cells: string[]): boolean {
  const filled = cells.map((c) => c.trim()).filter(Boolean);
  if (!filled.length) return false;
  if (filled.some((c) => c.toUpperCase().startsWith(EXAMPLE_PREFIX))) return true;
  const hints = new Set(COLUMNS.map(formatHint));
  if (filled.filter((c) => hints.has(c)).length >= 3) return true;
  const distinctive = COLUMNS.filter((c) => c.kind !== "list" && c.example && c.key !== "reference").map((c) => c.example);
  const hits = distinctive.filter((v) => filled.includes(v)).length;
  return hits >= Math.ceil(distinctive.length * 0.6);
}

/* ───────────────────────────── Repeats ───────────────────────────── */

/** Where a column sits in a repeated section: `[2]`, or `[1, 2]` for a nested repeat. */
export type Instance = number[];

export const instanceKey = (i: Instance) => i.join(".");

/**
 * A sheet header split into its column and its repeat: "Cheque number_2" → base
 * "Cheque number", `[2]`; "Accused address_1_2" → `[1, 2]`. No suffix → `[]`.
 */
export function parseHeader(header: string): { base: string; instance: Instance } {
  const m = /^(.*?)(?:_(\d+))?(?:_(\d+))?\s*$/.exec(header.trim());
  if (!m || !m[2]) return { base: header.trim(), instance: [] };
  return { base: m[1].trim(), instance: m[3] ? [Number(m[2]), Number(m[3])] : [Number(m[2])] };
}

/** The suffix a column takes for an instance: `[1]` → "", `[2]` → "_2", `[1, 2]` → "_1_2". */
export function suffixFor(group: Group, instance: Instance): string {
  if (!group.repeats) return "";
  if (group.parent) {
    const [p, c] = instance;
    if (p === 1 && c === 1) return "";
    return c === 1 ? `_${p}` : `_${p}_${c}`;
  }
  // A section numbered from 2 (complainants) always carries its number, so no column
  // could be read as complainant 1, who is chosen on screen.
  if (group.first > 1) return `_${instance[0]}`;
  return instance[0] === group.first ? "" : `_${instance[0]}`;
}

/** The template's header for a column's first instance: "Cheque number", "Complainant name_2". */
export const templateHeader = (c: Column) => `${c.header}${suffixFor(groupOf(c.group), groupOf(c.group).parent ? [1, 1] : [groupOf(c.group).first])}`;
