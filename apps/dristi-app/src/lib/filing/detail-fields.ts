/**
 * Fields the filer can place in "Any additional details" — the same `[Field Name]`
 * model as the magistrate's order templates (`lib/employee/order-config-templates.ts`),
 * pointed at the e-filing draft instead of the case.
 *
 * A `[Field Name]` in the text is filled from the filing wherever the complaint is read
 * (Preview, Sign), so the narrative never disagrees with the form: change the cheque
 * date in the Cheque section and the sentence that names it changes with it. A field
 * the filer has not entered yet prints "Not provided", as everywhere else on the sheet.
 *
 * A bracket that names no field — `[Describe how the debt arose]` — is a blank for the
 * filer to write over. It prints as typed until they do.
 *
 * The format below is a starting draft the filer edits, like the prayer templates in
 * `options.ts`: none of its wording is fixed, and nothing depends on it staying.
 */

import { addressToString, nameList, rupees, toLongDate } from "./format";
import {
  COURT,
  MODE_OF_SERVICE,
  NATURE_OF_DEBT,
  RETURN_REASONS,
  type Option,
} from "./options";
import {
  advocateName,
  causeOfActionDate,
  complaintFilingDate,
  totalChequeAmount,
} from "./selectors";
import type { FilingDraft, StepId } from "./types";

export const NOT_PROVIDED = "Not provided";

export type DetailField = {
  name: string;
  /** The section the value is entered in — where "not entered yet" sends the filer. */
  step: StepId;
  /** The value as it reads in a sentence; "" when the filing does not hold it yet. */
  resolve: (draft: FilingDraft) => string;
};

export type DetailFieldGroup = { label: string; fields: DetailField[] };

const label = (options: Option[], value: string) =>
  options.find((o) => o.value === value)?.label ?? "";

/**
 * One value per row, said as a sentence: "123456 and 123457". Blanks drop out, and a
 * value two cheques share is said once — "dated 20 August 2026", not twice over.
 */
const each = <T,>(rows: T[], read: (row: T) => string) =>
  nameList([...new Set(rows.map(read).map((v) => v.trim()).filter(Boolean))]);

/** As `each`, but every row counts: two cheques of ₹50,000 are two amounts. */
const every = <T,>(rows: T[], read: (row: T) => string) =>
  nameList(rows.map(read).map((v) => v.trim()).filter(Boolean));

const comma = (...parts: string[]) => parts.map((p) => p.trim()).filter(Boolean).join(", ");

export const DETAIL_FIELD_GROUPS: DetailFieldGroup[] = [
  {
    label: "Complainant",
    fields: [
      {
        name: "Complainant Name",
        step: "complainant",
        resolve: (d) =>
          each(d.complainants, (c) => (c.type === "institution" ? c.entName : c.name)),
      },
      {
        name: "Complainant Address",
        step: "complainant",
        resolve: (d) =>
          each(d.complainants, (c) =>
            addressToString(c.type === "institution" ? c.entAddr : c.res),
          ),
      },
      {
        name: "Complainant Age",
        step: "complainant",
        resolve: (d) =>
          each(
            d.complainants.filter((c) => c.type !== "institution"),
            (c) => c.age,
          ),
      },
    ],
  },
  {
    label: "Advocate",
    fields: [
      {
        name: "Advocate Name",
        step: "advocate",
        resolve: (d) => each(d.advocates, advocateName),
      },
      {
        name: "Advocate Enrolment Number",
        step: "advocate",
        resolve: (d) => each(d.advocates, (a) => a.barNumber),
      },
    ],
  },
  {
    label: "Accused",
    fields: [
      { name: "Accused Name", step: "accused", resolve: (d) => each(d.accused, (a) => a.name) },
      {
        name: "Accused Address",
        step: "accused",
        resolve: (d) => each(d.accused, (a) => addressToString(a.addresses[0]?.addr)),
      },
      {
        name: "Accused Police Station",
        step: "accused",
        resolve: (d) => each(d.accused, (a) => a.addresses[0]?.police ?? ""),
      },
    ],
  },
  {
    label: "Cheque",
    fields: [
      { name: "Cheque Number", step: "cheque", resolve: (d) => each(d.cheques, (c) => c.chequeNumber) },
      {
        name: "Cheque Date",
        step: "cheque",
        resolve: (d) => each(d.cheques, (c) => toLongDate(c.dateOnCheque)),
      },
      { name: "Cheque Amount", step: "cheque", resolve: (d) => every(d.cheques, (c) => rupees(c.amount)) },
      {
        name: "Total Cheque Amount",
        step: "cheque",
        resolve: (d) => rupees(totalChequeAmount(d.cheques)),
      },
      {
        name: "Drawer Bank",
        step: "cheque",
        resolve: (d) => each(d.cheques, (c) => comma(c.bankName, c.bankBranch)),
      },
      {
        name: "Presentation Date",
        step: "cheque",
        resolve: (d) => each(d.cheques, (c) => toLongDate(c.presentDate)),
      },
      {
        name: "Return Date",
        step: "cheque",
        resolve: (d) => each(d.cheques, (c) => toLongDate(c.returnDate)),
      },
      {
        name: "Reason for Return",
        step: "cheque",
        resolve: (d) => each(d.cheques, (c) => label(RETURN_REASONS, c.returnReason)),
      },
    ],
  },
  {
    label: "Demand notice",
    fields: [
      {
        name: "Nature of Debt",
        step: "demand-notice",
        resolve: (d) => each(d.notices, (n) => label(NATURE_OF_DEBT, n.natureDebt)),
      },
      {
        name: "Notice Dispatch Date",
        step: "demand-notice",
        resolve: (d) => each(d.notices, (n) => toLongDate(n.dispatchDate)),
      },
      {
        name: "Mode of Service",
        step: "demand-notice",
        resolve: (d) => each(d.notices, (n) => label(MODE_OF_SERVICE, n.modeService)),
      },
      {
        name: "Notice Delivery Date",
        step: "demand-notice",
        resolve: (d) =>
          each(
            d.notices.filter((n) => n.delivered === "yes"),
            (n) => toLongDate(n.deliveryDate),
          ),
      },
      {
        name: "Amount Paid After Notice",
        step: "demand-notice",
        resolve: (d) =>
          each(
            d.notices.filter((n) => n.paymentStatus === "part"),
            (n) => rupees(n.partAmount),
          ),
      },
    ],
  },
  {
    label: "Jurisdiction & limitation",
    fields: [
      {
        name: "Complainant Bank",
        step: "jurisdiction",
        resolve: (d) =>
          d.jurisdiction.deposited === "yes"
            ? comma(d.jurisdiction.payeeBankName, d.jurisdiction.payeeBankBranch)
            : "",
      },
      {
        name: "Police Station",
        step: "jurisdiction",
        resolve: (d) =>
          (d.jurisdiction.deposited === "yes"
            ? d.jurisdiction.payeePolice
            : d.jurisdiction.drawerPolice
          ).trim(),
      },
      {
        name: "Cause of Action Date",
        step: "jurisdiction",
        resolve: (d) => toLongDate(causeOfActionDate(d)),
      },
      {
        name: "Filing Date",
        step: "jurisdiction",
        resolve: (d) => toLongDate(complaintFilingDate(d)),
      },
      { name: "Court Name", step: "jurisdiction", resolve: () => COURT.name },
    ],
  },
];

export const DETAIL_FIELDS: DetailField[] = DETAIL_FIELD_GROUPS.flatMap((g) => g.fields);

const BY_NAME = new Map(DETAIL_FIELDS.map((f) => [f.name.toLowerCase(), f]));

/** The field a bracket names, ignoring case; undefined for a blank to write over. */
export function detailField(name: string): DetailField | undefined {
  return BY_NAME.get(name.trim().toLowerCase());
}

/** Every `[…]` in the text, once each, in the order they first appear. */
export function bracketsIn(html: string): string[] {
  const text = String(html ?? "").replace(/<[^>]*>/g, " ");
  const out: string[] = [];
  for (const m of text.matchAll(/\[([^\]\n]+)\]/g)) {
    if (!out.includes(m[1])) out.push(m[1]);
  }
  return out;
}

const escapeHtml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/**
 * The text as the court reads it: each `[Field]` replaced by the filing's value, or by
 * "Not provided"; blanks left as typed. Only text between tags is touched.
 */
export function fillDetails(html: string, draft: FilingDraft): string {
  return String(html ?? "").replace(/(^|>)([^<]*)/g, (_, open: string, text: string) =>
    open +
    text.replace(/\[([^\]\n]+)\]/g, (whole, name: string) => {
      const field = detailField(name);
      if (!field) return whole;
      return escapeHtml(field.resolve(draft) || NOT_PROVIDED);
    }),
  );
}

/**
 * The §138 facts, in the order the court reads them, with the filing's own fields in
 * place. The two `[Describe …]` blanks are the parts only the filer knows.
 */
export const DETAILS_FORMAT = [
  "<p><b>Facts of the case</b></p>",
  "<ol>",
  "<li>The Complainant, [Complainant Name], residing at [Complainant Address], files this complaint through [Advocate Name], Advocate (enrolment no. [Advocate Enrolment Number]).</li>",
  "<li>The Accused, [Accused Name], resides at [Accused Address], within the limits of [Accused Police Station] police station. [Describe how the Complainant and the Accused know each other]</li>",
  "<li>The Accused owed the Complainant a legally enforceable debt, being [Nature of Debt]. [Describe how the debt or liability arose, with dates and amounts]</li>",
  "<li>In discharge of that debt, the Accused issued cheque no. [Cheque Number] dated [Cheque Date] for [Cheque Amount], drawn on [Drawer Bank]. The total amount of the cheque(s) is [Total Cheque Amount].</li>",
  "<li>The Complainant presented the cheque on [Presentation Date]. It was returned unpaid on [Return Date], for the reason: [Reason for Return].</li>",
  "<li>The Complainant sent a demand notice to the Accused on [Notice Dispatch Date] by [Mode of Service]. The notice was delivered on [Notice Delivery Date].</li>",
  "<li>The Accused did not pay the amount of the cheque within 15 days of receiving the notice. The cause of action arose on [Cause of Action Date].</li>",
  "<li>The cheque was presented for collection through [Complainant Bank], within the limits of [Police Station] police station, and this Hon'ble Court has jurisdiction to try the complaint.</li>",
  "<li>This complaint is filed before [Court Name] on [Filing Date].</li>",
  "</ol>",
].join("");
