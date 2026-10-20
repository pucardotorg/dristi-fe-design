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

export type Column = {
  key: string;
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
  { key: "reference", header: "Case reference", field: "—", kind: "text", required: "Yes, unique in the file", aliases: ["LAN", "Loan account number", "Loan account no", "Reference", "Ref no", "Account number"], example: "GJ-PL-0041870" },
  { key: "accusedType", header: "Accused type", field: "ACC-1", kind: "list", list: "accusedType", required: "Yes", aliases: ["Borrower type", "Party type"], example: "Individual" },
  { key: "accusedName", header: "Accused name", field: "ACC-2", kind: "text", required: "Yes", aliases: ["Borrower name", "Borrower", "Drawer name", "Customer name", "Name of accused"], example: "Bhavesh N. Thakkar" },
  { key: "accusedEntity", header: "Accused institution type", field: "ACC-4", kind: "list", list: "accusedEntity", required: "When Institution", aliases: ["Constitution", "Entity type"], example: "" },
  { key: "accusedAge", header: "Accused age", field: "ACC-3", kind: "number", required: "No", aliases: ["Age", "Borrower age"], example: "41" },
  { key: "accusedMobile", header: "Accused mobile", field: "ACC-6", kind: "phone", required: "Mobile or email", aliases: ["Mobile", "Mobile number", "Borrower mobile", "Phone", "Contact number"], example: "9824000000" },
  { key: "accusedEmail", header: "Accused email", field: "ACC-7", kind: "text", required: "Mobile or email", aliases: ["Email", "Borrower email", "Email id"], example: "bhavesh@mail.example" },
  { key: "accusedAddress", header: "Accused address", field: "ACC-8", kind: "text", required: "Yes", aliases: ["Address", "Borrower address", "Residence address", "Address line 1"], example: "B-14, Shivalik Bungalows, Satellite" },
  { key: "accusedCity", header: "Accused city", field: "ACC-8", kind: "text", required: "Yes", aliases: ["City", "Town"], example: "Ahmedabad" },
  { key: "accusedPin", header: "Accused pincode", field: "ACC-8", kind: "text", required: "Yes", aliases: ["Pincode", "Pin code", "PIN", "Postal code"], example: "380015" },
  { key: "accusedPolice", header: "Accused police station", field: "ACC-13", kind: "text", required: "No", aliases: ["Police station"], example: "Satellite Police Station" },
  { key: "personName", header: "Person responsible name", field: "ACC-14", kind: "text", required: "When Institution", aliases: ["Director name", "Partner name", "Authorised signatory"], example: "" },
  { key: "personDesignation", header: "Person responsible designation", field: "ACC-15", kind: "text", required: "No", aliases: ["Director designation", "Designation"], example: "" },
  { key: "chequeNumber", header: "Cheque number", field: "CHQ-3", kind: "text", required: "Yes, 6 digits", aliases: ["Cheque no", "Cheque no.", "Instrument number", "Chq no"], example: "100000" },
  { key: "chequeDate", header: "Cheque date", field: "CHQ-1", kind: "date", required: "Yes", aliases: ["Date of cheque", "Instrument date"], example: "15-07-2026" },
  { key: "chequeAmount", header: "Cheque amount", field: "CHQ-2", kind: "number", required: "Yes", aliases: ["Amount", "Cheque amt", "Instrument amount"], example: "125000" },
  { key: "chequeIfsc", header: "Drawer bank IFSC", field: "CHQ-5", kind: "text", required: "Yes", aliases: ["IFSC", "Drawee IFSC", "Drawee bank IFSC", "Bank IFSC"], example: "SBIN0060421" },
  { key: "chequeAccount", header: "Drawer account number", field: "CHQ-7a", kind: "text", required: "Yes", aliases: ["Drawer account", "Drawer a/c no", "Account no"], example: "50100000000" },
  { key: "presentDate", header: "Presentation date", field: "CHQ-8", kind: "date", required: "Yes", aliases: ["Deposit date", "Date of presentation", "Date of deposit"], example: "04-08-2026" },
  { key: "returnDate", header: "Return date", field: "CHQ-9", kind: "date", required: "Yes", aliases: ["Cheque return date", "Date of return", "Bounce date", "Dishonour date"], example: "07-08-2026" },
  { key: "returnReason", header: "Return reason", field: "CHQ-10", kind: "list", list: "returnReason", required: "Yes", aliases: ["Reason for return", "Return memo reason", "Bounce reason", "Dishonour reason"], example: "Funds insufficient" },
  { key: "deposited", header: "Deposited in complainant's own account", field: "JUR-1", kind: "list", list: "yesNo", required: "Yes", aliases: ["Deposited in own account"], example: "Yes" },
  { key: "payeeIfsc", header: "Complainant branch IFSC", field: "JUR-2", kind: "text", required: "When deposited in own account", aliases: ["Collecting branch IFSC", "Collecting IFSC", "Presenting bank IFSC"], example: "HDFC0000060" },
  { key: "drawerPolice", header: "Drawer branch police station", field: "JUR-6a", kind: "text", required: "When not deposited in own account", aliases: [], example: "" },
  { key: "natureDebt", header: "Nature of debt", field: "LDN-1", kind: "list", list: "natureOfDebt", required: "Yes", aliases: ["Nature of liability", "Debt type"], example: "Loan / advance repayment" },
  { key: "dispatchDate", header: "Notice dispatch date", field: "LDN-2", kind: "date", required: "Yes", aliases: ["Notice date", "Date of notice", "Legal notice date", "Notice sent on"], example: "12-08-2026" },
  { key: "mode", header: "Notice mode of service", field: "LDN-3", kind: "list", list: "modeOfService", required: "Yes", aliases: ["Mode of dispatch", "Dispatch mode", "Notice mode"], example: "Registered post (RPAD)" },
  { key: "tracking", header: "Notice tracking number", field: "LDN-4", kind: "text", required: "No", aliases: ["Consignment number", "Consignment no", "AWB", "Tracking no"], example: "RG400000000IN" },
  { key: "delivered", header: "Notice delivered", field: "LDN-5", kind: "list", list: "yesNo", required: "Yes", aliases: ["Delivered", "Notice served"], example: "Yes" },
  { key: "deliveryDate", header: "Notice delivery date", field: "LDN-6", kind: "date", required: "When delivered", aliases: ["Delivery date", "Date of service", "Served on"], example: "18-08-2026" },
  { key: "noticeReturnDate", header: "Notice return date", field: "LDN-7", kind: "date", required: "When not delivered", aliases: [], example: "" },
  { key: "nonDelivery", header: "Reason for non-delivery", field: "LDN-8", kind: "list", list: "nonDelivery", required: "When not delivered", aliases: ["Return remark", "Undelivered reason"], example: "" },
  { key: "replied", header: "Accused replied", field: "LDN-9", kind: "list", list: "yesNo", required: "Yes", aliases: ["Reply received"], example: "No" },
  { key: "payment", header: "Payment after notice", field: "LDN-10", kind: "list", list: "payment", required: "Yes", aliases: [], example: "No payment made" },
  { key: "paidAmount", header: "Amount paid", field: "LDN-11", kind: "number", required: "When part payment", aliases: ["Amount received after notice", "Part payment amount"], example: "" },
  { key: "condonation", header: "Reason for condonation of delay", field: "JUR-12", kind: "text", required: "When the system computes a delay", aliases: ["Condonation reason", "Delay reason"], example: "" },
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
