/**
 * Every detail of a bulk case that can be changed on Case details, read from its draft and
 * grouped as the single filing groups them. Each field names its draft path, which the
 * server's `fix` action writes (and only paths it allows: `editable` in actions.server).
 *
 * The batch's own complainant, representative and advocates are set once for the batch and
 * are not listed per case; cause of action, filing date and fees are computed.
 */

import {
  ACCUSED_ENTITY_TYPES,
  ENTITY_TYPES,
  MODE_OF_SERVICE,
  NATURE_OF_DEBT,
  NON_DELIVERY_REASONS,
  PAYMENT_STATUS,
  RETURN_REASONS,
} from "@/lib/filing/options";
import type { FilingDraft } from "@/lib/filing/types";

export type FieldOption = { value: string; label: string };

export type CaseField = {
  path: string;
  label: string;
  kind: "text" | "date" | "select" | "textarea";
  value: string;
  options?: FieldOption[];
  inputMode?: "numeric" | "tel" | "email";
  /** Required to file, as the single filing marks it. */
  required: boolean;
};

export type FieldGroup = {
  /** "Accused 1", "Cheque 2": what the single filing calls this part. */
  heading: string;
  /** The single filing step it belongs to, for its section name. */
  step:
    | "complainant"
    | "accused"
    | "cheque"
    | "demand-notice"
    | "jurisdiction"
    | "witnesses";
  fields: CaseField[];
};

const YES_NO: FieldOption[] = [
  { value: "yes", label: "Yes" },
  { value: "no", label: "No" },
];

const text = (
  path: string,
  label: string,
  value: string,
  inputMode?: CaseField["inputMode"],
): Draft => ({
  path,
  label,
  kind: "text",
  value: value ?? "",
  inputMode,
});
const date = (path: string, label: string, value: string): Draft => ({
  path,
  label,
  kind: "date",
  value: value ?? "",
});
const select = (
  path: string,
  label: string,
  value: string,
  options: FieldOption[],
): Draft => ({
  path,
  label,
  kind: "select",
  value: value ?? "",
  options,
});

/**
 * What the single filing requires, by draft path. Everything else is optional: an email,
 * a tracking number, a second address, a police station, a reason for condonation (asked
 * for only when a delay is computed, and then flagged on the field).
 */
const REQUIRED = [
  /^complainants\.\d+\.(entName|entType|name|mobile|entAddr\.(line1|city|pin)|res\.(line1|city|pin))$/,
  /^accused\.\d+\.(name|entType|reps\.0\.name)$/,
  /^accused\.\d+\.addresses\.0\.addr\.(line1|city|pin)$/,
  /^cheques\.\d+\.(chequeNumber|dateOnCheque|amount|ifsc|presentDate|returnDate|returnReason)$/,
  /^notices\.\d+\.(natureDebt|dispatchDate|modeService|delivered|deliveryDate|returnDate|nonDeliveryReason|replied|paymentStatus|partAmount)$/,
  /^jurisdiction\.(ifsc|drawerPolice)$/,
  /^witnesses\.\d+\.fullName$/,
];

/**
 * `unknownService`: notices whose delivery the sender did not know. The draft holds a
 * default there; the field starts empty instead, so it reads as unanswered until chosen.
 */
export function caseFields(
  d: FilingDraft,
  unknownService: number[] = [],
): FieldGroup[] {
  return groups(d, unknownService).map((g) => ({
    ...g,
    fields: g.fields.map((f) => ({
      ...f,
      required: REQUIRED.some((re) => re.test(f.path)),
    })),
  }));
}

type Draft = Omit<CaseField, "required">;

function groups(
  d: FilingDraft,
  unknownService: number[],
): { heading: string; step: FieldGroup["step"]; fields: Draft[] }[] {
  const out: { heading: string; step: FieldGroup["step"]; fields: Draft[] }[] =
    [];
  const many = (n: number, label: string, i: number) =>
    n > 1 ? `${label} ${i + 1}` : label;

  // Further complainants (the batch's own is set once for the batch).
  d.complainants.slice(1).forEach((c, k) => {
    const i = k + 1;
    const p = `complainants.${i}`;
    out.push({
      heading: `Complainant ${i + 1}`,
      step: "complainant",
      fields:
        c.type === "institution"
          ? [
              text(`${p}.entName`, "Entity name", c.entName),
              select(`${p}.entType`, "Type of entity", c.entType, ENTITY_TYPES),
              text(`${p}.entCinPan`, "CIN or PAN", c.entCinPan),
              text(`${p}.entAddr.line1`, "Address line", c.entAddr.line1),
              text(`${p}.entAddr.city`, "City / town", c.entAddr.city),
              text(`${p}.entAddr.pin`, "Pincode", c.entAddr.pin, "numeric"),
            ]
          : [
              text(`${p}.name`, "Full name", c.name),
              text(`${p}.mobile`, "Mobile number", c.mobile, "tel"),
              text(`${p}.age`, "Age", c.age, "numeric"),
              text(`${p}.res.line1`, "Address line", c.res.line1),
              text(`${p}.res.city`, "City / town", c.res.city),
              text(`${p}.res.pin`, "Pincode", c.res.pin, "numeric"),
            ],
    });
  });

  d.accused.forEach((a, i) => {
    const p = `accused.${i}`;
    const fields: Draft[] = [
      text(
        `${p}.name`,
        a.type === "institution" ? "Entity name" : "Full name",
        a.name,
      ),
    ];
    if (a.type === "institution")
      fields.push(
        select(
          `${p}.entType`,
          "Type of entity",
          a.entType,
          ACCUSED_ENTITY_TYPES,
        ),
      );
    fields.push(
      text(
        `${p}.contacts.0.mobile`,
        "Mobile number",
        a.contacts[0]?.mobile ?? "",
        "tel",
      ),
    );
    fields.push(
      text(
        `${p}.contacts.0.email`,
        "Email address",
        a.contacts[0]?.email ?? "",
        "email",
      ),
    );
    a.addresses.forEach((b, k) => {
      const where = a.addresses.length > 1 ? ` ${k + 1}` : "";
      fields.push(
        text(
          `${p}.addresses.${k}.addr.line1`,
          `Address line${where}`,
          b.addr.line1,
        ),
      );
      fields.push(
        text(
          `${p}.addresses.${k}.addr.city`,
          `City / town${where}`,
          b.addr.city,
        ),
      );
      fields.push(
        text(
          `${p}.addresses.${k}.addr.pin`,
          `Pincode${where}`,
          b.addr.pin,
          "numeric",
        ),
      );
    });
    if (a.type === "institution") {
      fields.push(
        text(
          `${p}.reps.0.name`,
          "Person responsible (full name)",
          a.reps[0]?.name ?? "",
        ),
      );
      fields.push(
        text(
          `${p}.reps.0.designation`,
          "Designation",
          a.reps[0]?.designation ?? "",
        ),
      );
    }
    out.push({
      heading: many(d.accused.length, "Accused", i),
      step: "accused",
      fields,
    });
  });

  d.cheques.forEach((q, i) => {
    const p = `cheques.${i}`;
    out.push({
      heading: many(d.cheques.length, "Cheque", i),
      step: "cheque",
      fields: [
        text(`${p}.chequeNumber`, "Cheque number", q.chequeNumber, "numeric"),
        date(`${p}.dateOnCheque`, "Date on cheque", q.dateOnCheque),
        text(`${p}.amount`, "Amount", q.amount, "numeric"),
        text(`${p}.ifsc`, "IFSC code", q.ifsc),
        date(
          `${p}.presentDate`,
          "Date of presentation / deposit",
          q.presentDate,
        ),
        date(`${p}.returnDate`, "Date of return", q.returnDate),
        select(
          `${p}.returnReason`,
          "Return reason",
          q.returnReason,
          RETURN_REASONS,
        ),
      ],
    });
  });

  d.notices.forEach((n, i) => {
    const p = `notices.${i}`;
    const fields: Draft[] = [
      select(
        `${p}.natureDebt`,
        "Nature of debt or other liability",
        n.natureDebt,
        NATURE_OF_DEBT,
      ),
      date(
        `${p}.dispatchDate`,
        "Date of dispatch of demand notice",
        n.dispatchDate,
      ),
      select(
        `${p}.modeService`,
        "Mode of service",
        n.modeService,
        MODE_OF_SERVICE,
      ),
      text(`${p}.tracking`, "Tracking number", n.tracking),
      select(
        `${p}.delivered`,
        "Whether delivered?",
        unknownService.includes(i) ? "" : n.delivered,
        YES_NO,
      ),
    ];
    if (n.delivered === "no" && !unknownService.includes(i)) {
      fields.push(
        date(
          `${p}.returnDate`,
          "Date of return as not delivered",
          n.returnDate,
        ),
      );
      fields.push(
        select(
          `${p}.nonDeliveryReason`,
          "Reason for non-delivery",
          n.nonDeliveryReason,
          NON_DELIVERY_REASONS,
        ),
      );
    } else
      fields.push(
        date(`${p}.deliveryDate`, "Date of delivery", n.deliveryDate),
      );
    fields.push(
      select(
        `${p}.replied`,
        "Has the accused replied to the demand notice?",
        n.replied,
        YES_NO,
      ),
    );
    fields.push(
      select(
        `${p}.paymentStatus`,
        "Has the drawer (accused) made full or part payment due under the cheque?",
        n.paymentStatus,
        PAYMENT_STATUS,
      ),
    );
    if (n.paymentStatus === "part")
      fields.push(
        text(
          `${p}.partAmount`,
          "How much payment has already been made?",
          n.partAmount,
          "numeric",
        ),
      );
    out.push({
      heading: many(d.notices.length, "Demand notice", i),
      step: "demand-notice",
      fields,
    });
  });

  const j = d.jurisdiction;
  out.push({
    heading: "Jurisdiction and limitation",
    step: "jurisdiction",
    fields: [
      ...(j.deposited === "yes"
        ? [
            text("jurisdiction.ifsc", "IFSC code", j.ifsc),
            text(
              "jurisdiction.payeePolice",
              "Police station of bank branch",
              j.payeePolice,
            ),
          ]
        : [
            text(
              "jurisdiction.drawerPolice",
              "Police station of drawer (accused) bank branch",
              j.drawerPolice,
            ),
          ]),
      {
        ...text(
          "jurisdiction.condonationReason",
          "Reason for condonation of delay",
          j.condonationReason,
        ),
        kind: "textarea" as const,
      },
    ],
  });

  d.witnesses.forEach((w, i) => {
    const p = `witnesses.${i}`;
    out.push({
      heading: `Witness ${i + 1}`,
      step: "witnesses",
      fields: [
        text(`${p}.fullName`, "Full name", w.fullName),
        text(`${p}.designation`, "Designation", w.designation),
        text(
          `${p}.contacts.0.mobile`,
          "Mobile number",
          w.contacts[0]?.mobile ?? "",
          "tel",
        ),
        text(
          `${p}.addresses.0.addr.line1`,
          "Address line",
          w.addresses[0]?.addr.line1 ?? "",
        ),
        text(
          `${p}.addresses.0.addr.city`,
          "City / town",
          w.addresses[0]?.addr.city ?? "",
        ),
        text(
          `${p}.addresses.0.addr.pin`,
          "Pincode",
          w.addresses[0]?.addr.pin ?? "",
          "numeric",
        ),
      ],
    });
  });

  return out;
}
