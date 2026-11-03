/**
 * The bulk filing Excel template (Bulk filing PRD §4, `dristi-be/PRDs/bulk-filing.md`):
 * one sheet, `Cases`, one row per case. The complainants, advocates and their documents
 * are set once on the upload's setup screens, so the sheet carries everything else.
 *
 * A section that repeats in a case is a group of columns, and every repeated thing carries
 * its number in the header next to what it counts, the first included: `Accused 1 name`,
 * `Accused 1 address 1 pincode`, `Cheque 1 amount` (`BLK-26`). The template includes a
 * fixed number of each (`TEMPLATE_COUNTS`, `BLK-24`); a file may carry more, numbered the
 * same way (`BLK-27`).
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
 * The sections of a case. Some repeat: a case can have several accused, cheques, notices,
 * witnesses and other pending cases, and each accused several addresses and persons
 * responsible (a nested repeat, numbered twice: `Accused 1 address 2 line`).
 */
export type GroupId =
  | "case"
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
  /** Repeats; its columns carry the instance's number. */
  repeats: boolean;
  /** A repeat inside each instance of this group, numbered after it. */
  parent?: GroupId;
  /** The number of the first instance. */
  first: number;
  /** Present in every case; otherwise only when some column of it has a value (`BLK-28`). */
  always: boolean;
};

export const GROUPS: Group[] = [
  { id: "case", label: "Case", repeats: false, first: 1, always: true },
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

/** How many of each repeating section the template includes (PRD `BLK-24`). */
export const TEMPLATE_COUNTS: Partial<Record<GroupId, number>> = {
  accused: 2,
  address: 1,
  person: 1,
  cheque: 1,
  notice: 1,
  witness: 1,
  otherCase: 1,
};

export type Column = {
  key: string;
  group: GroupId;
  /** The field's name, unnumbered: what the matching screen shows. */
  header: string;
  /**
   * The template's header, with `{n}` for the section's number and `{m}` for a nested
   * section's: "Accused {n} address {m} pincode".
   */
  sheet: string;
  /** Handover field ID. */
  field: string;
  kind: ColumnKind;
  list?: ListName;
  /** "Yes", or the condition under which it is required, or "No". */
  required: string;
  /**
   * Other headers a filer's own sheet commonly uses for it, matched with case, spacing and
   * punctuation ignored. The unnumbered `header` is read the same way, so files laid out
   * before the numbered headers still match.
   */
  aliases: string[];
  example: string;
};

export const COLUMNS: Column[] = [
  /* Case */
  { key: "reference", group: "case", header: "Case reference", sheet: "Case reference", field: "BLK-07", kind: "text", required: "Yes, unique in the file", aliases: ["LAN", "Loan account number", "Loan account no", "Reference", "Ref no", "Account number"], example: "EXAMPLE-0001" },

  /* Accused N */
  { key: "accusedType", group: "accused", header: "Accused type", sheet: "Accused {n} type", field: "ACC-1", kind: "list", list: "accusedType", required: "Yes", aliases: ["Borrower type", "Party type"], example: "Individual" },
  { key: "accusedName", group: "accused", header: "Accused name", sheet: "Accused {n} name", field: "ACC-2", kind: "text", required: "Yes", aliases: ["Borrower name", "Borrower", "Drawer name", "Customer name", "Name of accused"], example: "Bhavesh N. Thakkar" },
  { key: "accusedAge", group: "accused", header: "Accused age", sheet: "Accused {n} age", field: "ACC-3", kind: "number", required: "No", aliases: ["Borrower age"], example: "41" },
  { key: "accusedEntity", group: "accused", header: "Accused institution type", sheet: "Accused {n} institution type", field: "ACC-4", kind: "list", list: "accusedEntity", required: "When Institution", aliases: ["Constitution", "Entity type"], example: "" },
  { key: "accusedMobile", group: "accused", header: "Accused mobile", sheet: "Accused {n} mobile", field: "ACC-6", kind: "phone", required: "No", aliases: ["Mobile", "Mobile number", "Borrower mobile", "Phone", "Contact number"], example: "9824000000" },
  { key: "accusedEmail", group: "accused", header: "Accused email", sheet: "Accused {n} email", field: "ACC-7", kind: "text", required: "No", aliases: ["Email", "Borrower email", "Email id"], example: "bhavesh@mail.example" },
  { key: "accusedAddress", group: "address", header: "Accused address", sheet: "Accused {n} address {m} line", field: "ACC-8", kind: "text", required: "Yes", aliases: ["Address", "Borrower address", "Residence address", "Address line 1"], example: "B-14, Shivalik Bungalows, Satellite" },
  { key: "accusedCity", group: "address", header: "Accused city", sheet: "Accused {n} address {m} city", field: "ACC-9", kind: "text", required: "Yes", aliases: ["City", "Town"], example: "Ahmedabad" },
  { key: "accusedPin", group: "address", header: "Accused pincode", sheet: "Accused {n} address {m} pincode", field: "ACC-10", kind: "text", required: "Yes", aliases: ["Pincode", "Pin code", "PIN", "Postal code"], example: "380015" },
  { key: "accusedPolice", group: "address", header: "Accused police station", sheet: "Accused {n} address {m} police station", field: "ACC-13", kind: "text", required: "Yes", aliases: ["Police station"], example: "Satellite Police Station" },
  { key: "accusedJurisdiction", group: "accused", header: "Accused resides within jurisdiction", sheet: "Accused {n} resides within jurisdiction", field: "ACC-24", kind: "list", list: "yesNo", required: "Yes", aliases: ["Within jurisdiction"], example: "Yes" },
  { key: "personName", group: "person", header: "Person responsible name", sheet: "Accused {n} person responsible {m} name", field: "ACC-14", kind: "text", required: "When Institution", aliases: ["Director name", "Partner name", "Authorised signatory"], example: "" },
  { key: "personDesignation", group: "person", header: "Person responsible designation", sheet: "Accused {n} person responsible {m} designation", field: "ACC-15", kind: "text", required: "No", aliases: ["Director designation", "Designation"], example: "" },
  { key: "personMobile", group: "person", header: "Person responsible mobile", sheet: "Accused {n} person responsible {m} mobile", field: "ACC-16", kind: "phone", required: "When Institution", aliases: ["Director mobile", "Partner mobile"], example: "" },
  { key: "personEmail", group: "person", header: "Person responsible email", sheet: "Accused {n} person responsible {m} email", field: "ACC-17", kind: "text", required: "No", aliases: ["Director email", "Partner email"], example: "" },
  { key: "personAddress", group: "person", header: "Person responsible address", sheet: "Accused {n} person responsible {m} address line", field: "ACC-18", kind: "text", required: "When Institution", aliases: ["Director address"], example: "" },
  { key: "personCity", group: "person", header: "Person responsible city", sheet: "Accused {n} person responsible {m} address city", field: "ACC-19", kind: "text", required: "When Institution", aliases: [], example: "" },
  { key: "personPin", group: "person", header: "Person responsible pincode", sheet: "Accused {n} person responsible {m} address pincode", field: "ACC-20", kind: "text", required: "When Institution", aliases: [], example: "" },
  { key: "personPolice", group: "person", header: "Person responsible police station", sheet: "Accused {n} person responsible {m} police station", field: "ACC-23", kind: "text", required: "When Institution", aliases: [], example: "" },

  /* Cheque N, with the jurisdiction bank details that repeat per cheque (JUR-2…6a) */
  { key: "chequeNumber", group: "cheque", header: "Cheque number", sheet: "Cheque {n} number", field: "CHQ-3", kind: "text", required: "Yes, 6 digits", aliases: ["Cheque no", "Cheque no.", "Instrument number", "Chq no"], example: "100000" },
  { key: "chequeDate", group: "cheque", header: "Cheque date", sheet: "Cheque {n} date", field: "CHQ-1", kind: "date", required: "Yes", aliases: ["Date of cheque", "Instrument date"], example: "15-07-2026" },
  { key: "chequeAmount", group: "cheque", header: "Cheque amount", sheet: "Cheque {n} amount", field: "CHQ-2", kind: "number", required: "Yes", aliases: ["Amount", "Cheque amt", "Instrument amount"], example: "125000" },
  { key: "chequeIfsc", group: "cheque", header: "Drawer bank IFSC", sheet: "Cheque {n} drawer bank IFSC", field: "CHQ-5", kind: "text", required: "Yes", aliases: ["IFSC", "Drawee IFSC", "Drawee bank IFSC", "Bank IFSC"], example: "SBIN0060421" },
  { key: "chequeAccount", group: "cheque", header: "Drawer account number", sheet: "Cheque {n} drawer account number", field: "CHQ-7a", kind: "text", required: "Yes", aliases: ["Drawer account", "Drawer a/c no", "Account no"], example: "50100000000" },
  { key: "presentDate", group: "cheque", header: "Presentation date", sheet: "Cheque {n} presentation date", field: "CHQ-8", kind: "date", required: "Yes", aliases: ["Deposit date", "Date of presentation", "Date of deposit"], example: "04-08-2026" },
  { key: "returnDate", group: "cheque", header: "Return date", sheet: "Cheque {n} return date", field: "CHQ-9", kind: "date", required: "Yes", aliases: ["Cheque return date", "Date of return", "Bounce date", "Dishonour date"], example: "07-08-2026" },
  { key: "returnReason", group: "cheque", header: "Return reason", sheet: "Cheque {n} return reason", field: "CHQ-10", kind: "list", list: "returnReason", required: "Yes", aliases: ["Reason for return", "Return memo reason", "Bounce reason", "Dishonour reason"], example: "Funds insufficient" },
  { key: "payeeIfsc", group: "cheque", header: "Complainant branch IFSC", sheet: "Cheque {n} complainant branch IFSC", field: "JUR-2", kind: "text", required: "When deposited in complainant's account", aliases: ["Collecting branch IFSC", "Collecting IFSC", "Presenting bank IFSC"], example: "HDFC0000060" },
  { key: "payeePolice", group: "cheque", header: "Complainant branch police station", sheet: "Cheque {n} complainant branch police station", field: "JUR-5", kind: "text", required: "When deposited in complainant's account", aliases: [], example: "Navrangpura Police Station" },
  { key: "drawerPolice", group: "cheque", header: "Drawer branch police station", sheet: "Cheque {n} drawer branch police station", field: "JUR-6a", kind: "text", required: "When not deposited in complainant's account", aliases: [], example: "" },

  /* Demand notice N */
  { key: "natureDebt", group: "notice", header: "Nature of debt", sheet: "Demand notice {n} nature of debt", field: "LDN-1", kind: "list", list: "natureOfDebt", required: "Yes", aliases: ["Nature of liability", "Debt type"], example: "Loan / advance repayment" },
  { key: "dispatchDate", group: "notice", header: "Notice dispatch date", sheet: "Demand notice {n} dispatch date", field: "LDN-2", kind: "date", required: "Yes", aliases: ["Notice date", "Date of notice", "Legal notice date", "Notice sent on"], example: "12-08-2026" },
  { key: "mode", group: "notice", header: "Notice mode of service", sheet: "Demand notice {n} mode of service", field: "LDN-3", kind: "list", list: "modeOfService", required: "Yes", aliases: ["Mode of dispatch", "Dispatch mode", "Notice mode"], example: "Registered post (RPAD)" },
  { key: "tracking", group: "notice", header: "Notice tracking number", sheet: "Demand notice {n} tracking number", field: "LDN-4", kind: "text", required: "No", aliases: ["Consignment number", "Consignment no", "AWB", "Tracking no"], example: "RG400000000IN" },
  { key: "delivered", group: "notice", header: "Notice delivered", sheet: "Demand notice {n} delivered", field: "LDN-5", kind: "list", list: "yesNo", required: "Yes", aliases: ["Delivered", "Notice served"], example: "Yes" },
  { key: "deliveryDate", group: "notice", header: "Notice delivery date", sheet: "Demand notice {n} delivery date", field: "LDN-6", kind: "date", required: "When delivered", aliases: ["Delivery date", "Date of service", "Served on"], example: "18-08-2026" },
  { key: "noticeReturnDate", group: "notice", header: "Notice return date", sheet: "Demand notice {n} return date", field: "LDN-7", kind: "date", required: "When not delivered", aliases: [], example: "" },
  { key: "nonDelivery", group: "notice", header: "Reason for non-delivery", sheet: "Demand notice {n} reason for non-delivery", field: "LDN-8", kind: "list", list: "nonDelivery", required: "When not delivered", aliases: ["Return remark", "Undelivered reason"], example: "" },
  { key: "replied", group: "notice", header: "Accused replied", sheet: "Demand notice {n} accused replied", field: "LDN-9", kind: "list", list: "yesNo", required: "Yes", aliases: ["Reply received"], example: "No" },
  { key: "payment", group: "notice", header: "Payment after notice", sheet: "Demand notice {n} payment after notice", field: "LDN-10", kind: "list", list: "payment", required: "Yes", aliases: [], example: "No payment made" },
  { key: "paidAmount", group: "notice", header: "Amount paid", sheet: "Demand notice {n} amount paid", field: "LDN-11", kind: "number", required: "When part payment", aliases: ["Amount received after notice", "Part payment amount"], example: "" },

  /* Jurisdiction and limitation */
  { key: "deposited", group: "jurisdiction", header: "Deposited in complainant's account", sheet: "Deposited in complainant's account", field: "JUR-1", kind: "list", list: "yesNo", required: "Yes", aliases: ["Deposited in complainant's own account", "Deposited in own account"], example: "Yes" },
  { key: "otherPending", group: "jurisdiction", header: "Other complaint pending between the same parties", sheet: "Other complaint pending between the same parties", field: "JUR-6b", kind: "list", list: "yesNo", required: "Yes", aliases: ["Other case pending"], example: "No" },
  { key: "otherCourt", group: "otherCase", header: "Other pending case court", sheet: "Other pending case {n} court", field: "JUR-7", kind: "text", required: "No", aliases: [], example: "" },
  { key: "otherNumber", group: "otherCase", header: "Other pending case number", sheet: "Other pending case {n} case number", field: "JUR-8", kind: "text", required: "No", aliases: [], example: "" },
  { key: "condonation", group: "jurisdiction", header: "Reason for condonation of delay", sheet: "Reason for condonation of delay", field: "JUR-12", kind: "text", required: "When the case has a delay", aliases: ["Condonation reason", "Delay reason"], example: "" },

  /* ADR, prayer and other details: full, finished text (PRD §4.3) */
  { key: "otherDetails", group: "case", header: "Additional details", sheet: "Additional details", field: "PRY-1", kind: "text", required: "No", aliases: ["Remarks for court", "Other details"], example: "" },
  { key: "interimRelief", group: "case", header: "Interim relief", sheet: "Interim relief", field: "PRY-2", kind: "text", required: "Yes", aliases: [], example: "" },
  { key: "finalRelief", group: "case", header: "Final relief", sheet: "Final relief", field: "PRY-3", kind: "text", required: "Yes", aliases: [], example: "" },
  { key: "affidavit", group: "case", header: "Affidavit", sheet: "Affidavit", field: "PRY-4", kind: "text", required: "Yes", aliases: [], example: "" },

  /* Witness N */
  { key: "witnessName", group: "witness", header: "Witness name", sheet: "Witness {n} name", field: "WIT-1", kind: "text", required: "Name or designation, for each witness", aliases: [], example: "" },
  { key: "witnessDesignation", group: "witness", header: "Witness designation", sheet: "Witness {n} designation", field: "WIT-4", kind: "text", required: "Name or designation, for each witness", aliases: [], example: "" },
  { key: "witnessAge", group: "witness", header: "Witness age", sheet: "Witness {n} age", field: "WIT-2", kind: "number", required: "No", aliases: [], example: "" },
  { key: "witnessProve", group: "witness", header: "What the witness will prove", sheet: "Witness {n} what they will prove", field: "WIT-3", kind: "text", required: "No", aliases: [], example: "" },
  { key: "witnessMobile", group: "witness", header: "Witness mobile", sheet: "Witness {n} mobile", field: "WIT-5", kind: "phone", required: "No", aliases: [], example: "" },
  { key: "witnessEmail", group: "witness", header: "Witness email", sheet: "Witness {n} email", field: "WIT-6", kind: "text", required: "No", aliases: [], example: "" },
  { key: "witnessAddress", group: "witness", header: "Witness address", sheet: "Witness {n} address 1 line", field: "WIT-7", kind: "text", required: "For each witness", aliases: [], example: "" },
  { key: "witnessCity", group: "witness", header: "Witness city", sheet: "Witness {n} address 1 city", field: "WIT-7", kind: "text", required: "For each witness", aliases: [], example: "" },
  { key: "witnessPin", group: "witness", header: "Witness pincode", sheet: "Witness {n} address 1 pincode", field: "WIT-7", kind: "text", required: "For each witness", aliases: [], example: "" },
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

export function firstInstance(group: Group): Instance {
  if (!group.repeats) return [];
  return group.parent ? [1, 1] : [group.first];
}

/** A column's header in the sheet for one instance: "Accused 2 address 1 pincode". */
export function headerFor(c: Column, instance: Instance): string {
  return c.sheet.replace("{n}", String(instance[0] ?? 1)).replace("{m}", String(instance[1] ?? 1));
}

/** The template's header for a column's first instance: "Cheque 1 number". */
export const templateHeader = (c: Column) => headerFor(c, firstInstance(groupOf(c.group)));

/** Each column's numbered header as a pattern, on headers with case, spacing and punctuation ignored. */
const SHEET_PATTERNS = COLUMNS.map((c) => ({
  c,
  re: new RegExp(`^${c.sheet.split(/\{[nm]\}/).map(normHeader).join("(\\d+)")}$`),
}));

/**
 * The template column a header names, with the instance its numbers give, or `null` when it
 * is not a numbered template header ("Accused 2 address 1 pincode" → accused pincode, `[2, 1]`).
 */
export function matchTemplateHeader(header: string): { column: Column; instance: Instance } | null {
  const h = normHeader(header);
  for (const { c, re } of SHEET_PATTERNS) {
    const m = re.exec(h);
    if (!m) continue;
    const g = groupOf(c.group);
    const instance = !g.repeats ? [] : g.parent ? [Number(m[1]), Number(m[2])] : [Number(m[1])];
    return { column: c, instance };
  }
  return null;
}

/**
 * A header in a filer's own layout, split into its name and a trailing repeat:
 * "Chq No_2" → "Chq No", `[2]`; "Accused address_1_2" → `[1, 2]`. No suffix → `[]`.
 */
export function parseHeader(header: string): { base: string; instance: Instance } {
  const m = /^(.*?)(?:_(\d+))?(?:_(\d+))?\s*$/.exec(header.trim());
  if (!m || !m[2]) return { base: header.trim(), instance: [] };
  return { base: m[1].trim(), instance: m[3] ? [Number(m[2]), Number(m[3])] : [Number(m[2])] };
}

/** The `_n` suffix a filer's own layout gives an instance: `[1]` → "", `[2]` → "_2", `[1, 2]` → "_1_2". */
export function suffixFor(group: Group, instance: Instance): string {
  if (!group.repeats) return "";
  if (group.parent) {
    const [p, c] = instance;
    if (p === 1 && c === 1) return "";
    return c === 1 ? `_${p}` : `_${p}_${c}`;
  }
  return instance[0] === group.first ? "" : `_${instance[0]}`;
}

export type TemplateColumn = { column: Column; instance: Instance; header: string };

const keysOf = (...groups: GroupId[]) => COLUMNS.filter((c) => groups.includes(c.group));
const byKey = (...keys: string[]) => keys.map((k) => COLUMNS.find((c) => c.key === k)!);

/**
 * The template's columns in order (PRD §4.3): the case reference; each accused with its
 * addresses and persons responsible; the cheques; the notices; jurisdiction and the other
 * pending cases; the prayers and additional details; the witnesses.
 */
export function templateColumns(counts: Partial<Record<GroupId, number>> = TEMPLATE_COUNTS): TemplateColumn[] {
  const n = (g: GroupId) => Math.max(1, counts[g] ?? 1);
  const out: TemplateColumn[] = [];
  const add = (cols: Column[], instance: Instance) =>
    cols.forEach((c) => out.push({ column: c, instance, header: headerFor(c, instance) }));
  add(byKey("reference"), []);
  for (let a = 1; a <= n("accused"); a += 1) {
    add(keysOf("accused").filter((c) => c.key !== "accusedJurisdiction"), [a]);
    for (let m = 1; m <= n("address"); m += 1) add(keysOf("address"), [a, m]);
    add(byKey("accusedJurisdiction"), [a]);
    for (let m = 1; m <= n("person"); m += 1) add(keysOf("person"), [a, m]);
  }
  for (let i = 1; i <= n("cheque"); i += 1) add(keysOf("cheque"), [i]);
  for (let i = 1; i <= n("notice"); i += 1) add(keysOf("notice"), [i]);
  add(byKey("deposited", "otherPending"), []);
  for (let i = 1; i <= n("otherCase"); i += 1) add(keysOf("otherCase"), [i]);
  add(byKey("condonation", "otherDetails", "interimRelief", "finalRelief", "affidavit"), []);
  for (let i = 1; i <= n("witness"); i += 1) add(keysOf("witness"), [i]);
  return out;
}
