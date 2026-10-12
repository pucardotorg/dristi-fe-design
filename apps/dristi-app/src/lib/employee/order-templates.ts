/**
 * The court's order-item catalogue.
 *
 * Transcribed from `dristi-be/PRDs/order-template-catalogue.md`, **status 2026-10-06
 * (17)** — the owner's current list (2026-10-12: "use the actual list of the order items
 * and the variables associated with it"). That document owns the configuration; this
 * file is its copy for a build with no backend, and where the two disagree the document
 * wins. It replaces the 2026-09-07 transcription this file carried before, which predated
 * the per-item variable tables: it still had the response deadline in mandatory
 * submissions, a witness batta that named no witness, "Complainant" written into the
 * proclamation and attachment templates, stage-gated availability, and no *Dismiss
 * application*.
 *
 * **Every template token is a field.** The catalogue's variable tables give each token
 * an input type, whether it is locked, whether it must be entered and what is
 * pre-selected — so each order item here carries `fields` (what the drafter answers) and
 * `slots` (which field fills each bracketed token in `botd`, in order of appearance,
 * because `[Party Type]` appears twice in several templates meaning two different
 * people). The order composer collects the fields first and writes the sentence from
 * them (`order-composer.ts`).
 *
 * **Master data the catalogue names but has not supplied** — document type, mode of ADR,
 * notice type, process type — is still a dropdown, never typed (owner, 2026-10-12: "keep
 * it a dropdown with some dummy data, but don't make it a typed thing"). The options are
 * stand-ins (`DUMMY_MASTERS`), each field names the master it is waiting for (`master`),
 * and the real lists replace these when they arrive.
 */

export type OrderTemplateId =
  | "mandatory-submissions"
  | "referral-to-adr"
  | "scheduling-of-hearing"
  | "rescheduling-of-hearing"
  | "accept-application"
  | "reject-application"
  | "case-transfer"
  | "case-settlement"
  | "issue-of-summons"
  | "issue-of-warrants"
  | "withdrawal-of-case"
  | "issue-of-notice"
  | "acceptance-of-bail"
  | "cognizance"
  | "judgement"
  | "dismiss-case"
  | "bail"
  | "cost"
  | "witness-batta"
  | "issue-of-proclamation"
  | "issue-of-attachment"
  | "move-to-lp-register"
  | "move-out-of-lp-register"
  | "abate-case"
  | "issue-of-miscellaneous-process"
  | "dismiss-application";

/**
 * Where an order item can be chosen from.
 *
 * The catalogue's own two values (2026-10-06 (13): availability is now only Dropdown or
 * Contextual; the stage and ST/LP conditions were removed). `hearing-not-ongoing` is the
 * one situational rule left, and it belongs to the screen rather than the catalogue:
 * *Scheduling of hearing date* is not offered inside a hearing, where the next date is set
 * in the Next hearing region instead (`ORD-09`, `NXT-03` of `order-generation.md`).
 */
export type OrderDropdownRule = "always" | "context" | "hearing-not-ongoing";

export type OrderGroupId =
  | "filings"
  | "disposal"
  | "case-management"
  | "process"
  | "misc";

/** The catalogue's locked/optional variable lists, by token name. */
export type OrderVariable = {
  /** The token as it appears in the template, without brackets. */
  name: string;
  /** Which of a repeated token this one is — the source distinguishes them in prose. */
  role?: string;
};

/**
 * How a field is answered — the catalogue's *Input type* column.
 *
 * - `side` — a dropdown of parties (Complainant, Accused, and Court where the catalogue
 *   lists it).
 * - `date` — a date picker.
 * - `amount` — a number, in rupees.
 * - `text` — free text.
 * - `master` — a dropdown from master data (`options`; stand-ins until the master exists).
 * - `purpose` — the MDMS hearing purposes.
 * - `choice` — a short fixed list the catalogue spells out (`options`).
 * - `witness` — the witnesses on the case.
 * - `recipients` — who a process goes to, the channels for each and, on a police
 *   channel, the police station (`ITM-11`; owned by `process-handover.md`).
 * - `fixed` — read-only: from the application the item was reached from, or worked out
 *   from another field. Never typed.
 */
export type OrderFieldKind =
  | "side"
  | "date"
  | "amount"
  | "text"
  | "master"
  | "purpose"
  | "choice"
  | "witness"
  | "recipients"
  | "fixed";

export type OrderFieldOption = { value: string; label: string };

export type OrderField = {
  key: string;
  /** The catalogue's *Meaning*, as the drafter reads it beside the control. */
  label: string;
  kind: OrderFieldKind;
  locked: boolean;
  /** The catalogue's *Mandatory to enter*. */
  required: boolean;
  options?: readonly OrderFieldOption[];
  /** The master-data list the catalogue says this comes from, not yet supplied. */
  master?: string;
  /**
   * Worked out from another field rather than asked for — the party type of the person a
   * process is addressed to, or the witness batta's receiving party. Not shown as a
   * control; it still fills its token.
   */
  derived?: boolean;
};

export type OrderTemplate = {
  id: OrderTemplateId;
  /** The catalogue's own number, so a reader can find the row in the source. */
  number: number;
  label: string;
  /** Contextual order items have no category (the catalogue's own rule). */
  group: OrderGroupId | null;
  dropdown: OrderDropdownRule;
  /** The template. Empty where the catalogue gives none (Judgement). */
  botd: string;
  locked: OrderVariable[];
  optional: OrderVariable[];
  fields: OrderField[];
  /** Which field fills each bracketed token in `botd`, in order of appearance. */
  slots: string[];
  /**
   * `VAR-13`: the clause a conditional field governs, dropped from the sentence when the
   * field is unanswered. `clause` is the literal text of the template it removes.
   */
  conditional?: { field: string; clause: string };
  /** What the order item sets in motion once the order is signed. */
  workflow?: string;
  /**
   * One of the catalogue's case-closing order items (combination restriction 1). Only one
   * may stand in an order.
   */
  closing?: boolean;
};

/**
 * Stand-in master data — **dummy lists**, to be replaced by the real masters. The value is
 * the wording the template takes ("Issue DCA notice…", "…refer to mediation…"); the label
 * is what the dropdown shows.
 */
const option = (value: string, label = value.charAt(0).toUpperCase() + value.slice(1)) => ({
  value,
  label,
});

export const DUMMY_MASTERS = {
  documentTypes: [
    option("affidavit"),
    option("vakalat"),
    option("written statement"),
    option("statement of account"),
    option("proof of service"),
    option("identity proof"),
  ],
  modesOfAdr: [
    option("mediation"),
    option("conciliation"),
    option("arbitration"),
    option("Lok Adalat"),
  ],
  noticeTypes: [
    option("DCA", "DCA (delay condonation)"),
    option("show cause"),
    option("bail cancellation"),
  ],
  processTypes: [
    option("production warrant"),
    option("commission"),
    option("summons to produce documents"),
  ],
} satisfies Record<string, readonly OrderFieldOption[]>;

const SIDES: readonly OrderFieldOption[] = [
  { value: "complainant", label: "Complainant" },
  { value: "accused", label: "Accused" },
];

const SIDES_AND_COURT: readonly OrderFieldOption[] = [
  ...SIDES,
  { value: "court", label: "Court" },
];

/**
 * The four variables summons, warrants, proclamation and attachment share — one table in
 * the catalogue "for convenience only". Notice and miscellaneous process each add one of
 * their own ahead of these.
 */
const PROCESS_FIELDS: OrderField[] = [
  {
    key: "recipients",
    label: "Addressed to",
    kind: "recipients",
    locked: true,
    required: true,
  },
  {
    key: "recipientType",
    label: "That person's party type",
    kind: "fixed",
    locked: true,
    required: false,
    derived: true,
  },
  {
    key: "steps",
    label: "Party directed to take steps",
    kind: "side",
    locked: true,
    required: true,
    options: SIDES,
  },
];

const PROCESS_SLOTS = ["recipientType", "recipients", "steps"];

const PROCESS_VARIABLES = {
  locked: [
    { name: "Party Name", role: "person the process is addressed to" },
    { name: "Party Type", role: "that person's party type" },
    { name: "Party Type", role: "party taking steps" },
  ],
  optional: [],
};

const APPLICATION_FIELDS: OrderField[] = [
  {
    key: "applicationNumber",
    label: "Application being decided",
    kind: "fixed",
    locked: true,
    required: true,
  },
  {
    key: "applicationType",
    label: "Its type",
    kind: "fixed",
    locked: true,
    required: true,
  },
];

const NO_VARIABLES = { locked: [], optional: [], fields: [], slots: [] };

export const ORDER_TEMPLATES: OrderTemplate[] = [
  {
    id: "mandatory-submissions",
    number: 1,
    label: "Mandatory submissions and responses",
    group: "filings",
    dropdown: "always",
    botd: "It is directed that the [Party Type] files a [Document Type] for [Document Details] before the court by [Deadline for Submission].",
    locked: [
      { name: "Party Type", role: "party directed to file" },
      { name: "Document Type" },
      { name: "Document Details" },
      { name: "Deadline for Submission" },
    ],
    optional: [],
    fields: [
      {
        key: "party",
        label: "Party directed to file",
        kind: "side",
        locked: true,
        required: true,
        options: SIDES,
      },
      {
        key: "documentType",
        label: "Type of document to be filed",
        kind: "master",
        locked: true,
        required: true,
        master: "Document types",
        options: DUMMY_MASTERS.documentTypes,
      },
      {
        key: "documentDetails",
        label: "Details of the document",
        kind: "text",
        locked: true,
        required: true,
      },
      {
        key: "deadline",
        label: "Date by which it must be filed",
        kind: "date",
        locked: true,
        required: true,
      },
    ],
    slots: ["party", "documentType", "documentDetails", "deadline"],
    workflow: "Creates submission task",
  },
  {
    id: "referral-to-adr",
    number: 2,
    label: "Referral of case to ADR",
    group: "disposal",
    dropdown: "always",
    botd: "Both the Parties have voluntarily agreed to seek resolution through [Mode of ADR]. The parties are hereby referred to [Mode of ADR] to resolve their dispute by [Date of End of ADR].",
    locked: [],
    optional: [
      { name: "Mode of ADR", role: "mediation, arbitration, etc." },
      { name: "Date of End of ADR", role: "deadline" },
    ],
    fields: [
      {
        key: "mode",
        label: "Mode of ADR",
        kind: "master",
        locked: false,
        required: true,
        master: "Modes of ADR",
        options: DUMMY_MASTERS.modesOfAdr,
      },
      {
        key: "endDate",
        label: "Date the ADR must conclude by",
        kind: "date",
        locked: false,
        required: true,
      },
    ],
    slots: ["mode", "mode", "endDate"],
    closing: true,
  },
  {
    id: "scheduling-of-hearing",
    number: 3,
    label: "Scheduling of hearing date",
    group: "case-management",
    dropdown: "hearing-not-ongoing",
    botd: "Next hearing is scheduled on [Hearing Date] for [Hearing Purpose].",
    locked: [{ name: "Hearing Date" }, { name: "Hearing Purpose" }],
    optional: [],
    fields: [
      {
        key: "date",
        label: "Date of the next hearing",
        kind: "date",
        locked: true,
        required: true,
      },
      {
        key: "purpose",
        label: "Purpose of the next hearing",
        kind: "purpose",
        locked: true,
        required: true,
      },
    ],
    slots: ["date", "purpose"],
    workflow: "Schedules next hearing",
  },
  {
    id: "rescheduling-of-hearing",
    number: 4,
    label: "Rescheduling of hearing date",
    group: null,
    dropdown: "context",
    botd: "Next hearing scheduled on [Original Hearing Date] for [Hearing Purpose] has been rescheduled to [New Hearing Date].",
    locked: [
      { name: "Original Hearing Date" },
      { name: "Hearing Purpose" },
      { name: "New Hearing Date" },
    ],
    optional: [],
    fields: [
      {
        key: "originalDate",
        label: "Date of the hearing being moved",
        kind: "fixed",
        locked: true,
        required: false,
      },
      {
        key: "purpose",
        label: "Purpose of the rescheduled hearing",
        kind: "purpose",
        locked: true,
        required: true,
      },
      {
        key: "newDate",
        label: "Date it moves to",
        kind: "date",
        locked: true,
        required: true,
      },
    ],
    slots: ["originalDate", "purpose", "newDate"],
    workflow: "Reschedules hearing",
  },
  {
    id: "accept-application",
    number: 5,
    label: "Accept application",
    group: null,
    dropdown: "context",
    botd: "Application [Application Number] for [Application Type] is accepted.",
    locked: [{ name: "Application Number" }, { name: "Application Type" }],
    optional: [],
    fields: APPLICATION_FIELDS,
    slots: ["applicationNumber", "applicationType"],
    workflow: "The application type's own workflow, not this order item's",
  },
  {
    id: "reject-application",
    number: 6,
    label: "Reject application",
    group: null,
    dropdown: "context",
    botd: "Application [Application Number] for [Application Type] is rejected.",
    locked: [{ name: "Application Number" }, { name: "Application Type" }],
    optional: [],
    fields: APPLICATION_FIELDS,
    slots: ["applicationNumber", "applicationType"],
  },
  {
    id: "case-transfer",
    number: 7,
    label: "Case transfer",
    group: "case-management",
    dropdown: "always",
    botd: "The case is transferred to another court for further proceedings.",
    ...NO_VARIABLES,
    closing: true,
  },
  {
    id: "case-settlement",
    number: 8,
    label: "Case settlement",
    group: "disposal",
    dropdown: "always",
    botd: "The settlement records have been accepted by the court. Case closed.",
    ...NO_VARIABLES,
    closing: true,
  },
  {
    id: "issue-of-summons",
    number: 9,
    label: "Issue of summons",
    group: "process",
    dropdown: "always",
    botd: "Issue summons to the [Party Type] [Party Name]. The [Party Type] is directed to make the appropriate payments and take steps to issue summons.",
    ...PROCESS_VARIABLES,
    fields: PROCESS_FIELDS,
    slots: PROCESS_SLOTS,
    workflow: "Triggers the summons workflow",
  },
  {
    id: "issue-of-warrants",
    number: 10,
    label: "Issue of warrants",
    group: "process",
    dropdown: "always",
    botd: "Issue warrant to the [Party Type] [Party Name]. The [Party Type] is directed to take steps to issue warrant.",
    ...PROCESS_VARIABLES,
    fields: PROCESS_FIELDS,
    slots: PROCESS_SLOTS,
    workflow: "Triggers the warrant workflow",
  },
  {
    id: "withdrawal-of-case",
    number: 11,
    label: "Withdrawal of case",
    group: "disposal",
    dropdown: "always",
    botd: "As per application [Application Number] complainant has sought to withdraw the complaint. Permission under Section 280 of the BNSS is granted and the Accused is acquitted.",
    locked: [],
    optional: [{ name: "Application Number", role: "where there is one" }],
    fields: [
      {
        key: "applicationNumber",
        label: "The withdrawal application",
        kind: "fixed",
        locked: false,
        required: false,
      },
    ],
    slots: ["applicationNumber"],
    /* "When it is chosen from the dropdown there is no application, and the clause 'As
       per application [Application Number]' is left out of the text." */
    conditional: {
      field: "applicationNumber",
      clause: "As per application [Application Number] ",
    },
    closing: true,
  },
  {
    id: "issue-of-notice",
    number: 12,
    label: "Issue of notice",
    group: "process",
    dropdown: "always",
    botd: "Issue [Notice Type] notice to the [Party Type] [Party Name]. The [Party Type] is directed to make the appropriate payments and take steps.",
    locked: [
      { name: "Notice Type", role: "type of notice" },
      ...PROCESS_VARIABLES.locked,
    ],
    optional: [],
    fields: [
      {
        key: "noticeType",
        label: "Type of notice",
        kind: "master",
        locked: true,
        required: true,
        master: "Notice types",
        options: DUMMY_MASTERS.noticeTypes,
      },
      ...PROCESS_FIELDS,
    ],
    slots: ["noticeType", ...PROCESS_SLOTS],
    workflow: "Triggers the notice workflow",
  },
  {
    id: "acceptance-of-bail",
    number: 13,
    label: "Acceptance of bail",
    group: null,
    dropdown: "context",
    botd: "Application [Application Number] is accepted.",
    locked: [{ name: "Application Number" }],
    optional: [],
    fields: [
      {
        key: "applicationNumber",
        label: "The bail application",
        kind: "fixed",
        locked: true,
        required: true,
      },
    ],
    slots: ["applicationNumber"],
    workflow:
      "Optionally triggers bail bond submission workflow (magistrate specifies terms of bail)",
  },
  {
    id: "cognizance",
    number: 14,
    label: "Cognizance",
    group: "case-management",
    dropdown: "always",
    botd: "Considering the materials produced before the Court, I am prima facie satisfied that the offence punishable under S. 138 of NI Act is made out. Accordingly cognizance of the offence is taken and the case is taken on file.",
    ...NO_VARIABLES,
  },
  {
    id: "judgement",
    number: 15,
    label: "Judgement",
    group: "disposal",
    dropdown: "always",
    botd: "",
    ...NO_VARIABLES,
    closing: true,
  },
  {
    id: "dismiss-case",
    number: 16,
    label: "Dismiss case",
    group: "case-management",
    dropdown: "always",
    botd: "The case is dismissed.",
    ...NO_VARIABLES,
    closing: true,
  },
  {
    id: "bail",
    number: 17,
    label: "Bail",
    group: "filings",
    dropdown: "always",
    botd: "Accused is released on bail. Particulars of offences u/s.138 of NI Act were read over and explained to the Accused to which he pleaded [Plea] and claimed to be tried.",
    locked: [],
    optional: [{ name: "Plea", role: "guilty / not guilty" }],
    fields: [
      {
        key: "plea",
        label: "Plea",
        kind: "choice",
        locked: false,
        required: false,
        options: [
          { value: "guilty", label: "Guilty" },
          { value: "not guilty", label: "Not guilty" },
        ],
      },
    ],
    slots: ["plea"],
    workflow: "Triggers the bail workflow",
  },
  {
    id: "cost",
    number: 18,
    label: "Cost",
    group: "misc",
    dropdown: "always",
    botd: "The [Party Type] is directed to pay [Amount] to the [Party Type] as costs by [Date].",
    locked: [
      { name: "Party Type", role: "paying party" },
      { name: "Amount", role: "in rupees" },
      { name: "Party Type", role: "receiving party" },
      { name: "Date", role: "deadline" },
    ],
    optional: [],
    fields: [
      {
        key: "payer",
        label: "Paying party",
        kind: "side",
        locked: true,
        required: true,
        options: SIDES,
      },
      {
        key: "amount",
        label: "Amount",
        kind: "amount",
        locked: true,
        required: true,
      },
      {
        key: "payee",
        label: "Receiving party",
        kind: "side",
        locked: true,
        required: true,
        options: SIDES_AND_COURT,
      },
      {
        key: "date",
        label: "Date by which it must be paid",
        kind: "date",
        locked: true,
        required: true,
      },
    ],
    slots: ["payer", "amount", "payee", "date"],
    workflow: "Creates payment task",
  },
  {
    id: "witness-batta",
    number: 19,
    label: "Witness batta",
    group: "misc",
    dropdown: "always",
    botd: "The [Party Type] is directed to pay [Amount] to the [Party Type] [Party Name] as witness batta by [Date].",
    locked: [
      { name: "Party Type", role: "paying party" },
      { name: "Amount", role: "in rupees" },
      { name: "Party Type", role: "receiving party, always a witness" },
      { name: "Party Name", role: "the witness receiving it" },
      { name: "Date", role: "deadline" },
    ],
    optional: [],
    fields: [
      {
        key: "payer",
        label: "Paying party",
        kind: "side",
        locked: true,
        required: true,
        options: SIDES,
      },
      {
        key: "amount",
        label: "Amount",
        kind: "amount",
        locked: true,
        required: true,
      },
      {
        key: "payeeType",
        label: "Receiving party",
        kind: "fixed",
        locked: true,
        required: false,
        derived: true,
      },
      {
        key: "witness",
        label: "The witness receiving it",
        kind: "witness",
        locked: true,
        required: true,
      },
      {
        key: "date",
        label: "Date by which it must be paid",
        kind: "date",
        locked: true,
        required: true,
      },
    ],
    slots: ["payer", "amount", "payeeType", "witness", "date"],
    workflow:
      "Creates a task for the paying party, closed by confirming they have paid — the payment is not made through the system",
  },
  {
    id: "issue-of-proclamation",
    number: 20,
    label: "Issue of proclamation",
    group: "process",
    dropdown: "always",
    botd: "Issue proclamation to the [Party Type] [Party Name]. The [Party Type] is directed to make the appropriate payments and take steps.",
    ...PROCESS_VARIABLES,
    fields: PROCESS_FIELDS,
    slots: PROCESS_SLOTS,
    workflow: "Triggers the proclamation workflow",
  },
  {
    id: "issue-of-attachment",
    number: 21,
    label: "Issue of attachment",
    group: "process",
    dropdown: "always",
    botd: "Issue attachment against the [Party Type] [Party Name]. The [Party Type] is directed to make the appropriate payments and take steps.",
    ...PROCESS_VARIABLES,
    fields: PROCESS_FIELDS,
    slots: PROCESS_SLOTS,
    workflow: "Triggers the attachment workflow",
  },
  {
    id: "move-to-lp-register",
    number: 22,
    label: "Moving case to long pending register",
    group: "case-management",
    dropdown: "always",
    botd: "As per sanction given by Honourable CJM the case is moved to the Long Pending Register and is marked as LP.",
    ...NO_VARIABLES,
  },
  {
    id: "move-out-of-lp-register",
    number: 23,
    label: "Moving case out of long pending register",
    group: "case-management",
    dropdown: "always",
    botd: "The case is moved out of the Long Pending Register and is to be considered and renumbered as a ST case.",
    ...NO_VARIABLES,
  },
  {
    id: "abate-case",
    number: 24,
    label: "Abate case",
    group: "disposal",
    dropdown: "always",
    botd: "The case is abated following the death of the Accused party.",
    ...NO_VARIABLES,
    closing: true,
  },
  {
    id: "issue-of-miscellaneous-process",
    number: 25,
    label: "Issue of miscellaneous process",
    group: "process",
    dropdown: "always",
    botd: "Issue [Process Type] to the [Party Type] [Party Name]. The [Party Type] is directed to make the appropriate payments and take steps.",
    locked: [{ name: "Process Type" }, ...PROCESS_VARIABLES.locked],
    optional: [],
    fields: [
      {
        key: "processType",
        label: "Type of process",
        kind: "master",
        locked: true,
        required: true,
        master: "Process types",
        options: DUMMY_MASTERS.processTypes,
      },
      ...PROCESS_FIELDS,
    ],
    slots: ["processType", ...PROCESS_SLOTS],
    workflow: "Triggers the miscellaneous process workflow",
  },
  {
    id: "dismiss-application",
    number: 26,
    label: "Dismiss application",
    group: null,
    dropdown: "context",
    botd: "Application for [Application Type] filed by the [Party Type] [Party Name] on [Filing Date] is dismissed.",
    locked: [
      { name: "Application Type" },
      { name: "Party Type", role: "party type of the person who filed it" },
      { name: "Party Name", role: "person who filed it" },
      { name: "Filing Date" },
    ],
    optional: [],
    fields: [
      {
        key: "applicationType",
        label: "Type of the application",
        kind: "fixed",
        locked: true,
        required: true,
      },
      {
        key: "filerType",
        label: "Filed by",
        kind: "fixed",
        locked: true,
        required: true,
      },
      {
        key: "filerName",
        label: "Person who filed it",
        kind: "fixed",
        locked: true,
        required: true,
      },
      {
        key: "filingDate",
        label: "Date it was filed",
        kind: "fixed",
        locked: true,
        required: true,
      },
    ],
    slots: ["applicationType", "filerType", "filerName", "filingDate"],
  },
];

/** The catalogue's categories, in its own order (regrouped 2026-09-25). */
export const ORDER_GROUPS: { id: OrderGroupId; label: string }[] = [
  { id: "filings", label: "Filings" },
  { id: "disposal", label: "Disposal" },
  { id: "case-management", label: "Case management" },
  { id: "process", label: "Process" },
  { id: "misc", label: "Miscellaneous" },
];

export function orderTemplate(id: OrderTemplateId): OrderTemplate {
  const found = ORDER_TEMPLATES.find((entry) => entry.id === id);
  if (!found) throw new Error(`Unknown order template: ${id}`);
  return found;
}

export function isOrderTemplateId(value: string): value is OrderTemplateId {
  return ORDER_TEMPLATES.some((entry) => entry.id === value);
}

/** The situation an order is drafted in — the only thing availability is read against. */
export type OrderCatalogueContext = {
  /** The order belongs to a hearing (`ORD-05`), rather than to the case (`ORD-06`). */
  hearingOngoing: boolean;
};

/**
 * Why an order item cannot be chosen here, or `null` when it can (`ITM-03`).
 *
 * A reason, not a boolean, because the list shows what it cannot offer rather than going
 * silent where a drafter expected the item to be.
 */
export function unavailableReason(
  template: OrderTemplate,
  context: OrderCatalogueContext,
): string | null {
  switch (template.dropdown) {
    case "always":
      return null;
    case "context":
      return "Comes from an application";
    case "hearing-not-ongoing":
      return context.hearingOngoing
        ? "Set the next date under Next hearing"
        : null;
  }
}

/** Every order item a drafter may browse — everything the catalogue does not mark contextual. */
export function browsableTemplates(): OrderTemplate[] {
  return ORDER_TEMPLATES.filter((entry) => entry.dropdown !== "context");
}

/**
 * Whether the catalogue gives this order item any words at all. Judgement has none: "a
 * dedicated screen handles it", and an order item with no template writes nothing into
 * the order (`ITM-05`).
 */
export function hasTemplateText(entry: OrderTemplate): boolean {
  return entry.botd.trim().length > 0;
}

/**
 * Available at any hearing, whatever it was listed for — the catalogue lists these once
 * rather than against every purpose.
 */
export const GENERIC_TEMPLATE_IDS: OrderTemplateId[] = [
  "scheduling-of-hearing",
  "cost",
  "mandatory-submissions",
  "withdrawal-of-case",
  "case-transfer",
  "move-to-lp-register",
  "move-out-of-lp-register",
  "abate-case",
];

/**
 * The catalogue's *Hearing purpose → actions* table, for the purposes this app knows.
 * *Likely at this hearing* is only this association, with no ranking behind it (`ITM-02`),
 * and it suggests without restricting. Contextual items (Acceptance of bail) and section
 * workflows (⚙) are left out: neither is chosen from the catalogue.
 */
export const LIKELY_BY_PURPOSE: Record<string, OrderTemplateId[]> = {
  "delay-condonation": ["dismiss-case"],
  admission: ["cognizance", "dismiss-case", "issue-of-summons"],
  cognizance: ["cognizance", "dismiss-case", "issue-of-summons"],
  appearance: [
    "issue-of-summons",
    "issue-of-warrants",
    "bail",
    "issue-of-notice",
  ],
  bail: ["bail", "issue-of-warrants"],
  plea: ["bail", "referral-to-adr", "issue-of-notice"],
  "evidence-of-complainant": ["witness-batta", "issue-of-summons"],
  "examination-of-accused-351": ["issue-of-warrants"],
  arguments: ["referral-to-adr", "case-settlement"],
  judgement: ["judgement"],
  "for-reports": ["referral-to-adr"],
};

export function likelyTemplatesFor(purpose: string): OrderTemplate[] {
  return (LIKELY_BY_PURPOSE[purpose] ?? []).map((id) => orderTemplate(id));
}

/** Process order items — the ones that carry a `recipients` field. */
export function isProcessTemplate(id: OrderTemplateId): boolean {
  return orderTemplate(id).fields.some((field) => field.kind === "recipients");
}

/** The bracketed tokens still standing in a line, in the order they appear. */
export function openSlots(text: string): string[] {
  return text.match(/\[[^\]]+\]/g) ?? [];
}

/* ─────────────────────────── combination restrictions ───────────────────────── */

/**
 * The catalogue's *Combination restrictions* (draft), as the message the screen shows when
 * an order item cannot be added (`ITM-07`). `null` means it can.
 *
 * `existing` is what the order already carries; `applicationId` is the application the
 * new item answers, for rule 4.
 */
export function combinationConflict(
  adding: OrderTemplateId,
  existing: readonly { type: OrderTemplateId; applicationId?: string }[],
  applicationId?: string,
): string | null {
  const template = orderTemplate(adding);
  const label = (id: OrderTemplateId) => orderTemplate(id).label;

  /* Rule 2: cognizance and dismiss case cannot stand together, and neither repeats. */
  if (adding === "cognizance" || adding === "dismiss-case") {
    const clash = existing.find(
      (item) => item.type === "cognizance" || item.type === "dismiss-case",
    );
    if (clash) {
      return clash.type === adding
        ? `You cannot add two ${label(adding)} items`
        : `You cannot add both ${label(adding)} and ${label(clash.type)}`;
    }
  }

  /* Rule 1: one case-closing order item per order. */
  if (template.closing) {
    const clash = existing.find((item) => orderTemplate(item.type).closing);
    if (clash) {
      return clash.type === adding
        ? `You cannot add two ${label(adding)} items`
        : `You cannot add both ${label(adding)} and ${label(clash.type)}`;
    }
  }

  /* Rule 3: one hearing-date order item per order. */
  const HEARING_DATE: OrderTemplateId[] = [
    "scheduling-of-hearing",
    "rescheduling-of-hearing",
  ];
  if (HEARING_DATE.includes(adding)) {
    const clash = existing.find((item) => HEARING_DATE.includes(item.type));
    if (clash) return `You cannot add two ${label(clash.type)} items`;
  }

  /* Rule 4: one decision per application or request. */
  if (applicationId) {
    const clash = existing.find((item) => item.applicationId === applicationId);
    if (clash) return "You cannot add two responses to the same application";
  }

  return null;
}

/* ─────────────────── general variables, for the composed paper ──────────────── */

/**
 * The general variables — single-valued facts the drafter never types (`VAR-02`). None of
 * the twenty-six templates uses one today; they stay here because the catalogue makes them
 * available to every template, and the paper's own furniture (court, cause, case number,
 * date) is drawn from the same facts.
 */
export type OrderTemplateFacts = {
  court: string;
  caseName: string;
  caseNumber: string;
  currentDate: string;
  judgeName: string;
  judgeDesignation: string;
  complainant: string;
  accused: string;
  currentHearingDate: string;
};
