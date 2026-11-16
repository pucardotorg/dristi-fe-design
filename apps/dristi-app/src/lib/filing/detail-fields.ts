/**
 * Fields the filer can place in "Any additional details" — the same `[Field Name]`
 * model as the magistrate's order templates (`lib/employee/order-config-templates.ts`),
 * pointed at the e-filing draft instead of the case.
 *
 * A format is turned into plain text once (`generateDetails`): each `[Field Name]` the
 * form holds is replaced by its value, and from then on the text is the filer's to edit
 * like any other. A field the form does not hold yet, and a bracket that names no field —
 * `[Describe how the debt arose]` — stay in brackets for the filer to write over.
 *
 * The format below is a starting draft the filer edits, like the prayer templates in
 * `options.ts`: none of its wording is fixed, and nothing depends on it staying.
 */

import { addressToString, nameList, rupees, toLongDate } from "./format";
import {
  ACCUSED_ENTITY_TYPES,
  COURT,
  ENTITY_TYPES,
  MODE_OF_SERVICE,
  NATURE_OF_DEBT,
  NON_DELIVERY_REASONS,
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
 * While `valueCount` runs a field, how many values each row-wise part of it found; the
 * most is the field's count (two accused: Accused Name has 2).
 */
let counting: number[] | null = null;
const counted = (values: string[]) => {
  counting?.push(values.length);
  return nameList(values);
};

/**
 * One value per row, said as a sentence: "123456 and 123457". Blanks drop out, and a
 * value two cheques share is said once — "dated 20 August 2026", not twice over.
 */
const each = <T,>(rows: T[], read: (row: T) => string) =>
  counted([...new Set(rows.map(read).map((v) => v.trim()).filter(Boolean))]);

/** As `each`, but every row counts: two cheques of ₹50,000 are two amounts. */
const every = <T,>(rows: T[], read: (row: T) => string) =>
  counted(rows.map(read).map((v) => v.trim()).filter(Boolean));

/**
 * How many values a field has in this filing: 0 when it holds none, 2 for two accused's
 * names or two cheques' numbers, 1 otherwise. Bulk filing fills only a field with exactly
 * one (BLK-10h).
 */
export function valueCount(field: DetailField, draft: FilingDraft): number {
  counting = [];
  try {
    const value = field.resolve(draft).trim();
    const most = counting.length ? Math.max(...counting) : value ? 1 : 0;
    return value ? Math.max(1, most) : 0;
  } finally {
    counting = null;
  }
}

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
        // No amount typed yet is no total, not ₹0.
        resolve: (d) => {
          const total = totalChequeAmount(d.cheques);
          return total ? rupees(total) : "";
        },
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

const yesNo = (v: string) => (v === "yes" ? "Yes" : v === "no" ? "No" : "");

/**
 * The rest of the e-filing fields a bulk template can use (BLK-10c: "Any field of the
 * e-filing flow can be used in a template"), by the section they are entered in. They
 * resolve wherever a text names them, but only bulk's Facts of the case lists them
 * (`TEMPLATE_FIELD_GROUPS`), so single filing's Insert field is unchanged.
 */
export const MORE_FIELD_GROUPS: DetailFieldGroup[] = [
  {
    label: "Complainant",
    fields: [
      { name: "Complainant Type of Institution", step: "complainant", resolve: (d) => each(d.complainants.filter((c) => c.type === "institution"), (c) => label(ENTITY_TYPES, c.entType)) },
      { name: "Complainant CIN or PAN", step: "complainant", resolve: (d) => each(d.complainants.filter((c) => c.type === "institution"), (c) => c.entCinPan) },
      { name: "Complainant Mobile", step: "complainant", resolve: (d) => each(d.complainants, (c) => (c.type === "institution" ? c.entPhone : c.mobile)) },
      { name: "Complainant Email", step: "complainant", resolve: (d) => each(d.complainants, (c) => (c.type === "institution" ? c.entEmail : c.email)) },
      { name: "Representative Name", step: "complainant", resolve: (d) => each(d.complainants.filter((c) => c.type === "institution"), (c) => c.rep.name) },
      { name: "Representative Designation", step: "complainant", resolve: (d) => each(d.complainants.filter((c) => c.type === "institution"), (c) => c.rep.designation) },
    ],
  },
  {
    label: "Accused",
    fields: [
      { name: "Accused Type of Institution", step: "accused", resolve: (d) => each(d.accused.filter((a) => a.type === "institution"), (a) => label(ACCUSED_ENTITY_TYPES, a.entType)) },
      { name: "Accused Mobile", step: "accused", resolve: (d) => each(d.accused, (a) => a.contacts[0]?.mobile ?? "") },
      { name: "Accused Email", step: "accused", resolve: (d) => each(d.accused, (a) => a.contacts[0]?.email ?? "") },
      { name: "Person Responsible Name", step: "accused", resolve: (d) => each(d.accused.flatMap((a) => a.reps), (r) => r.name) },
      { name: "Person Responsible Designation", step: "accused", resolve: (d) => each(d.accused.flatMap((a) => a.reps), (r) => r.designation) },
      { name: "Accused Resides Within Jurisdiction", step: "accused", resolve: (d) => each(d.accused, (a) => yesNo(a.jurisdiction)) },
    ],
  },
  {
    label: "Cheque",
    fields: [
      { name: "Drawer Bank IFSC", step: "cheque", resolve: (d) => each(d.cheques, (c) => c.ifsc) },
      { name: "Drawer Bank Branch", step: "cheque", resolve: (d) => each(d.cheques, (c) => c.bankBranch) },
      { name: "Number of Cheques", step: "cheque", resolve: (d) => (d.cheques.length ? String(d.cheques.length) : "") },
    ],
  },
  {
    label: "Demand notice",
    fields: [
      { name: "Notice Tracking Number", step: "demand-notice", resolve: (d) => each(d.notices, (n) => n.tracking) },
      { name: "Notice Delivered", step: "demand-notice", resolve: (d) => each(d.notices, (n) => yesNo(n.delivered)) },
      { name: "Notice Returned On", step: "demand-notice", resolve: (d) => each(d.notices.filter((n) => n.delivered === "no"), (n) => toLongDate(n.returnDate)) },
      { name: "Reason for Non-delivery", step: "demand-notice", resolve: (d) => each(d.notices.filter((n) => n.delivered === "no"), (n) => label(NON_DELIVERY_REASONS, n.nonDeliveryReason)) },
      { name: "Accused Replied", step: "demand-notice", resolve: (d) => each(d.notices, (n) => yesNo(n.replied)) },
    ],
  },
  {
    label: "Jurisdiction & limitation",
    fields: [
      { name: "Deposited in Complainant's Account", step: "jurisdiction", resolve: (d) => yesNo(d.jurisdiction.deposited) },
      { name: "Complainant Bank IFSC", step: "jurisdiction", resolve: (d) => (d.jurisdiction.deposited === "yes" ? d.jurisdiction.ifsc.trim() : "") },
      { name: "Drawer Bank Police Station", step: "jurisdiction", resolve: (d) => d.jurisdiction.drawerPolice.trim() },
      { name: "Other Case Pending", step: "jurisdiction", resolve: (d) => yesNo(d.jurisdiction.otherPending) },
      { name: "Reason for Delay", step: "jurisdiction", resolve: (d) => d.jurisdiction.condonationReason.trim() },
    ],
  },
  {
    label: "Witnesses",
    fields: [
      { name: "Witness Name", step: "witnesses", resolve: (d) => each(d.witnesses, (w) => w.fullName) },
      { name: "Witness Designation", step: "witnesses", resolve: (d) => each(d.witnesses, (w) => w.designation) },
      { name: "Number of Witnesses", step: "witnesses", resolve: (d) => (d.witnesses.length ? String(d.witnesses.length) : "") },
    ],
  },
];

/**
 * Every field a bulk template can use, one group per e-filing section (BLK-10c): the
 * standard fields first in each, then the rest.
 */
export const TEMPLATE_FIELD_GROUPS: DetailFieldGroup[] = [...DETAIL_FIELD_GROUPS, ...MORE_FIELD_GROUPS].reduce<DetailFieldGroup[]>(
  (out, g) => {
    const at = out.find((x) => x.label === g.label);
    if (at) at.fields = [...at.fields, ...g.fields];
    else out.push({ label: g.label, fields: [...g.fields] });
    return out;
  },
  [],
);

const BY_NAME = new Map(
  [...DETAIL_FIELDS, ...MORE_FIELD_GROUPS.flatMap((g) => g.fields)].map((f) => [f.name.toLowerCase(), f]),
);

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

/* ───────────────────────── Generating the text ───────────────────────── */

type Voice = (text: string) => string;
const asIs: Voice = (t) => t;

/**
 * The format as plain text for this filing: each `[Field]` the form holds becomes its
 * value; a field the form does not hold yet, and a blank for the filer, stay in brackets.
 * Once generated it is simply text — nothing in it is tied to the form any more.
 * Only text between tags is touched.
 */
export function generateDetails(
  html: string,
  draft: FilingDraft,
  voice: Voice = asIs,
  /**
   * Bulk filing's rule (BLK-10h): a field with more than one value in this filing (two
   * accused, two cheques) stays in brackets too, never joined. Single filing joins them.
   */
  { single = false }: { single?: boolean } = {},
): string {
  return String(html ?? "").replace(/(^|>)([^<]*)/g, (_, open: string, text: string) =>
    open +
    text.replace(/\[([^\]\n]+)\]/g, (whole, name: string) => {
      const field = detailField(name);
      if (!field || (single && valueCount(field, draft) !== 1)) return whole;
      const value = voice(field.resolve(draft));
      return value ? escapeHtml(value) : whole;
    }),
  );
}

/**
 * The fields a text still names in brackets, with how many values each has in this filing:
 * the ones bulk filing left unfilled (BLK-10h). A bracket that names no field is a part for
 * the filer to write, not listed here.
 */
export function unfilledFields(html: string, draft: FilingDraft): { name: string; values: number }[] {
  return bracketsIn(html).flatMap((name) => {
    const field = detailField(name);
    return field ? [{ name: field.name, values: valueCount(field, draft) }] : [];
  });
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
