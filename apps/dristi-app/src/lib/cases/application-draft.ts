/**
 * The Raise application draft — one shape covering every application type,
 * plus the validation each type actually needs.
 *
 * The fields are the Application Lifecycle PRD's "Fields by application type"
 * (v33). Four of them are on every application whatever its type — Raised by,
 * Litigant, Supporting documents and Other details — and the rest belong to
 * one type each. Where the PRD marks a field optional, it is optional here;
 * everything else is required.
 *
 * One draft holds every type's fields rather than one per type, so switching
 * type to compare forms never destroys what was already typed. Only the
 * selected type is validated, reviewed and filed.
 */
import type { Address } from "@/lib/filing/types";
import {
  isApplicationTypeId,
  submissionTypeLabel,
  type ApplicationTypeId,
  type Submission,
} from "./applications";

export type YesNo = "yes" | "no";

export function blankAddress(): Address {
  return { line1: "", city: "", pin: "", district: "", state: "" };
}

/** A document the filer names (PRD "Supporting documents"). */
export type NamedDocumentDraft = {
  id: string;
  name: string;
  files: File[];
};

/** A document the filer gives a type (PRD Production of Documents). */
export type TypedDocumentDraft = {
  id: string;
  type: string;
  files: File[];
};

/** One surety on a surety bail (PRD Bail; the bail bond form, Form No. 37). */
export type SuretyDraft = {
  id: string;
  fullName: string;
  /** Father's or mother's name. */
  parentName: string;
  phone: string;
  email: string;
  address: Address;
  identityProof: File[];
  solvencyProof: File[];
};

/** One address of an accused, with the police station that serves it. */
export type AddressWithPoliceDraft = {
  id: string;
  addr: Address;
  police: string;
};

/**
 * Edit Litigant Details: the e-filing litigant fields, one flat record across
 * the four tables (complainant or accused, individual or institution). Which
 * keys are shown and checked is decided by the litigant's side and type.
 */
export type LitigantDetailsDraft = {
  /* Complainant individual (LIT-3…9), accused individual (ACC-2, 3, 6, 7, 15). */
  phone: string;
  fullName: string;
  age: string;
  gender: string;
  differentlyAbled: YesNo | "";
  email: string;
  designation: string;
  permanentAddress: Address;
  currentSameAsPermanent: YesNo;
  currentAddress: Address;

  /* Complainant institution (LIT-17…26), accused institution (ACC-4…7). */
  institutionType: string;
  institutionName: string;
  cinPan: string;
  institutionAddress: Address;
  repPhone: string;
  repName: string;
  repAge: string;
  repGender: string;
  repDifferentlyAbled: YesNo | "";
  repEmail: string;
  repDesignation: string;
  repAddress: Address;

  /* Accused, either type (ACC-8…13): as many addresses as needed. */
  addresses: AddressWithPoliceDraft[];
};

/** One witness (PRD Addition of Witness; e-filing WIT-1…7). */
export type WitnessDraft = {
  id: string;
  fullName: string;
  age: string;
  proves: string;
  designation: string;
  mobile: string;
  email: string;
  addresses: { id: string; addr: Address }[];
};

export type ApplicationDraft = {
  type: ApplicationTypeId | "";
  /**
   * The side it is raised for, set from who is filing (never typed). Names
   * the litigant on the form and in the generated document.
   */
  filedForSide: "" | "complainant" | "accused";

  /* Every application. */
  /** Saved as Application Raised By. A person id from the case file. */
  raisedById: string;
  /** Saved as Application Raised On Behalf Of. A person id from the case file. */
  litigantId: string;
  supportingDocuments: NamedDocumentDraft[];
  otherDetails: string;

  /* Bail. */
  bailType: "" | "cash" | "surety";
  bailAmount: string;
  /** How many sets of surety details follow. Kept as typed. */
  suretyCount: string;
  sureties: SuretyDraft[];
  bailReason: string;

  /* Edit Litigant Details. */
  editLitigantId: string;
  editReason: string;
  litigantType: "" | "individual" | "institution";
  litigant: LitigantDetailsDraft;

  /* Case Settlement. */
  settlementReason: string;

  /* Case Transfer. */
  requestedCourt: string;
  transferReason: string;

  /* Case Withdrawal. */
  withdrawalReason: string;

  /* Delay Condonation. */
  delayReason: string;

  /* Generic. */
  title: string;
  details: string;

  /* Advance (prepone) / Postpone. */
  rescheduleReason: string;
  proposedHearingDate: Date | undefined;

  /* PoA Change. */
  poaLitigantIds: string[];
  /** One authorization document per litigant above, keyed by litigant id. */
  poaAuthorizations: Record<string, File[]>;
  poaReason: string;

  /* Production of Documents. */
  productionReason: string;
  productionDocuments: TypedDocumentDraft[];

  /* Addition of Witness. */
  witnesses: WitnessDraft[];

  /* Warrant by Hand. */
  warrantAccusedId: string;
  deliveryAddress: Address;

  /* Absent Application. */
  absenceReason: string;

  /* Reopen Evidence. */
  reopenReason: string;

  /**
   * Objection (ALC-12, ALC-24). What it objects to is fixed by the File
   * objection task, never chosen here.
   */
  objectionToId: string;
  objectionReason: string;
};

/**
 * Every error on the form, keyed by where it shows. Top-level fields use the
 * draft's own key; a field inside a repeated row uses `<row id>.<field>`; an
 * Edit Litigant Details field uses `litigant.<field>`.
 */
export type ApplicationErrors = {
  fields: Record<string, string | undefined>;
};

export const EMPTY_APPLICATION_ERRORS: ApplicationErrors = { fields: {} };

export function emptyLitigantDetails(): LitigantDetailsDraft {
  return {
    phone: "",
    fullName: "",
    age: "",
    gender: "",
    differentlyAbled: "",
    email: "",
    designation: "",
    permanentAddress: blankAddress(),
    currentSameAsPermanent: "yes",
    currentAddress: blankAddress(),
    institutionType: "",
    institutionName: "",
    cinPan: "",
    institutionAddress: blankAddress(),
    repPhone: "",
    repName: "",
    repAge: "",
    repGender: "",
    repDifferentlyAbled: "",
    repEmail: "",
    repDesignation: "",
    repAddress: blankAddress(),
    addresses: [],
  };
}

export const EMPTY_APPLICATION_DRAFT: ApplicationDraft = {
  type: "",
  filedForSide: "",
  raisedById: "",
  litigantId: "",
  supportingDocuments: [],
  otherDetails: "",
  bailType: "",
  bailAmount: "",
  suretyCount: "",
  sureties: [],
  bailReason: "",
  editLitigantId: "",
  editReason: "",
  litigantType: "",
  litigant: emptyLitigantDetails(),
  settlementReason: "",
  requestedCourt: "",
  transferReason: "",
  withdrawalReason: "",
  delayReason: "",
  title: "",
  details: "",
  rescheduleReason: "",
  proposedHearingDate: undefined,
  poaLitigantIds: [],
  poaAuthorizations: {},
  poaReason: "",
  productionReason: "",
  productionDocuments: [],
  witnesses: [],
  warrantAccusedId: "",
  deliveryAddress: blankAddress(),
  absenceReason: "",
  reopenReason: "",
  objectionToId: "",
  objectionReason: "",
};

function rowId(prefix: string): string {
  return `${prefix}-${crypto.randomUUID()}`;
}

export function emptySurety(): SuretyDraft {
  return {
    id: rowId("surety"),
    fullName: "",
    parentName: "",
    phone: "",
    email: "",
    address: blankAddress(),
    identityProof: [],
    solvencyProof: [],
  };
}

export function emptyNamedDocument(): NamedDocumentDraft {
  return { id: rowId("doc"), name: "", files: [] };
}

export function emptyTypedDocument(): TypedDocumentDraft {
  return { id: rowId("doc"), type: "", files: [] };
}

export function emptyAddressWithPolice(): AddressWithPoliceDraft {
  return { id: rowId("addr"), addr: blankAddress(), police: "" };
}

export function emptyWitness(): WitnessDraft {
  return {
    id: rowId("witness"),
    fullName: "",
    age: "",
    proves: "",
    designation: "",
    mobile: "",
    email: "",
    addresses: [{ id: rowId("addr"), addr: blankAddress() }],
  };
}

/** The sureties list resized to the number typed, keeping what was entered. */
export function resizeSureties(
  sureties: SuretyDraft[],
  count: string
): SuretyDraft[] {
  const wanted = /^\d+$/.test(count) ? Math.min(Number(count), 10) : 0;
  if (wanted <= sureties.length) return sureties.slice(0, wanted);
  return [
    ...sureties,
    ...Array.from({ length: wanted - sureties.length }, emptySurety),
  ];
}

/**
 * Why a hearing should move. The PRD asks for a single-select reason and
 * gives no list: WORKING GUESS, flagged for the PM. The same list serves
 * both directions, as the PRD's fields do.
 */
export const RESCHEDULE_REASONS = [
  "A party or witness cannot attend",
  "Counsel is engaged in another court",
  "Illness",
  "The parties are negotiating a settlement",
  "Other",
] as const;

/**
 * Generic's title rule, shared so seeding cannot disagree with validation.
 * The PRD's "alphanumeric text" means plain typed text (it says the same of
 * every reason box), not letters and digits only: titles cite "PW-1" and
 * "S.138" (PM, Oct 8). Letters, numbers, punctuation and spaces.
 */
const TITLE_PATTERN = /^[\p{L}\p{M}\p{N}\p{P}\p{Zs}]+$/u;

/**
 * The draft field that *is* each type's ask, in the filer's own words. A
 * saved draft keeps only this text (`Submission.request`), so it is what
 * `applicationDraftFrom` restores and `draftRequestText` saves. Types whose
 * own fields are all structured keep the ask in Other details.
 */
const ASK_FIELD: Record<
  ApplicationTypeId,
  | "bailReason"
  | "editReason"
  | "settlementReason"
  | "transferReason"
  | "withdrawalReason"
  | "delayReason"
  | "details"
  | "poaReason"
  | "productionReason"
  | "absenceReason"
  | "reopenReason"
  | "objectionReason"
  | "otherDetails"
> = {
  bail: "bailReason",
  "edit-litigant-details": "editReason",
  settlement: "settlementReason",
  transfer: "transferReason",
  withdrawal: "withdrawalReason",
  "condonation-of-delay": "delayReason",
  "application-others": "details",
  "advancement-reschedule": "otherDetails",
  postpone: "otherDetails",
  "poa-change": "poaReason",
  "production-of-documents": "productionReason",
  "addition-of-witness": "otherDetails",
  "warrant-by-hand": "otherDetails",
  "absent-application": "absenceReason",
  "reopen-evidence": "reopenReason",
  objection: "objectionReason",
  "certified-copy": "otherDetails",
  "warrant-recall": "otherDetails",
};

/**
 * A saved draft, reopened as the form that wrote it.
 *
 * The register keeps a draft as a Submission — its type, who raised it and
 * for whom, and the ask in the filer's own words — not as a field-by-field
 * snapshot. So resuming restores what survives that shape. Everything else
 * the type needs is still blank, which is precisely what makes the draft
 * unfinished.
 */
export function applicationDraftFrom(submission: Submission): ApplicationDraft {
  // A document submission has no application form to resume into, and the
  // caller routes it elsewhere; returning the empty draft keeps this total.
  if (
    submission.kind !== "application" ||
    !isApplicationTypeId(submission.type)
  ) {
    return EMPTY_APPLICATION_DRAFT;
  }

  const type = submission.type;
  const draft: ApplicationDraft = {
    ...EMPTY_APPLICATION_DRAFT,
    type,
    raisedById: submission.submittedById ?? "",
    litigantId: submission.onBehalfOfId ?? "",
    objectionToId: submission.objectionToId ?? "",
  };
  const ask = submission.request?.trim() ?? "";
  if (ask) draft[ASK_FIELD[type]] = ask;

  if (type === "application-others") {
    // Generic is the one type that also names itself. A row that was never
    // titled carries the type label, which is not a title; a title that
    // could only fail validation is left blank rather than seeded pre-broken.
    const title = submission.title.trim();
    if (
      title &&
      title !== submissionTypeLabel(type) &&
      TITLE_PATTERN.test(title)
    ) {
      draft.title = title;
    }
  }

  return draft;
}

/** The inverse of `applicationDraftFrom`'s ask mapping, for saving a draft. */
export function draftRequestText(draft: ApplicationDraft): string {
  if (!draft.type) return "";
  return draft[ASK_FIELD[draft.type]].trim();
}

/**
 * Whether anything has been typed or attached. Values set for the filer —
 * the side, Raised by and Litigant preselected, the objection target —
 * are not work, so opening a form and closing it untouched asks nothing.
 */
export function isApplicationDirty(draft: ApplicationDraft): boolean {
  const {
    type,
    filedForSide,
    raisedById,
    litigantId,
    objectionToId,
    litigantType,
    editLitigantId,
    litigant,
    deliveryAddress,
    warrantAccusedId,
    ...rest
  } = draft;
  void filedForSide;
  void raisedById;
  void litigantId;
  void objectionToId;
  // Prefilled from the case file when a litigant or accused is picked.
  void litigantType;
  void editLitigantId;
  void litigant;
  void deliveryAddress;
  void warrantAccusedId;
  return Boolean(type) || hasContent(rest);
}

function hasContent(value: unknown): boolean {
  if (typeof value === "string") return value.trim().length > 0;
  if (value instanceof Date) return true;
  if (typeof File !== "undefined" && value instanceof File) return true;
  if (Array.isArray(value)) return value.length > 0;
  if (value && typeof value === "object") {
    return Object.values(value).some(hasContent);
  }
  return false;
}

export function hasApplicationErrors(errors: ApplicationErrors): boolean {
  return Object.values(errors.fields).some(Boolean);
}

/* ------------------------------------------------------------- validation -- */

const PHONE = /^\d{10}$/;
const EMAIL = /^\S+@\S+\.\S+$/;
const PIN = /^\d{6}$/;
/** Letters, spaces and the marks names carry: full stops, apostrophes, hyphens. */
const ALPHABETIC = /^[\p{L}\p{M}\s.'-]+$/u;

type Errors = ApplicationErrors["fields"];

function required(errors: Errors, key: string, value: string, message: string) {
  if (!value.trim()) errors[key] = message;
}

function phone(
  errors: Errors,
  key: string,
  value: string,
  optional = false
) {
  const trimmed = value.trim();
  if (!trimmed) {
    if (!optional) errors[key] = "Enter the phone number.";
  } else if (!PHONE.test(trimmed)) {
    errors[key] = "Enter a 10-digit phone number.";
  }
}

function email(errors: Errors, key: string, value: string, optional = true) {
  const trimmed = value.trim();
  if (!trimmed) {
    if (!optional) errors[key] = "Enter the email ID.";
  } else if (!EMAIL.test(trimmed)) {
    errors[key] = "Enter a valid email ID.";
  }
}

function wholeNumber(
  errors: Errors,
  key: string,
  value: string,
  { optional = false, min = 1 }: { optional?: boolean; min?: number } = {}
) {
  const trimmed = value.trim();
  if (!trimmed) {
    if (!optional) errors[key] = "Enter a number.";
  } else if (!/^\d+$/.test(trimmed) || Number(trimmed) < min) {
    errors[key] = `Enter a whole number, ${min} or more.`;
  }
}

/**
 * The e-filing address composite: a line, a city, a 6-digit pincode, the
 * district and the state, every part required. The composite shows one
 * message under the whole address, so it is one error.
 */
function address(errors: Errors, key: string, value: Address) {
  const missing = [
    !value.line1.trim() && "address line",
    !PIN.test(value.pin.trim()) && "6-digit pincode",
    !value.city.trim() && "city or town",
    !value.district.trim() && "district",
    !value.state.trim() && "state",
  ].filter(Boolean);
  if (missing.length) errors[key] = `Enter the ${missing.join(", ")}.`;
}

function files(errors: Errors, key: string, value: File[], message: string) {
  if (value.length === 0) errors[key] = message;
}

/**
 * The Supporting documents on every application. Adding a row is the only
 * way one exists, so each row is checked whole; an empty one is removed,
 * not tolerated.
 */
function validateSupportingDocuments(draft: ApplicationDraft, errors: Errors) {
  for (const row of draft.supportingDocuments) {
    required(errors, `${row.id}.name`, row.name, "Enter the document name.");
    files(errors, `${row.id}.files`, row.files, "Choose a file or remove this document.");
  }
}

function validateLitigant(draft: ApplicationDraft, side: "complainant" | "accused", errors: Errors) {
  const l = draft.litigant;
  const key = (field: string) => `litigant.${field}`;
  const institution = draft.litigantType === "institution";

  if (side === "complainant" && !institution) {
    phone(errors, key("phone"), l.phone);
    if (!l.fullName.trim()) errors[key("fullName")] = "Enter the full name.";
    else if (!ALPHABETIC.test(l.fullName.trim())) {
      errors[key("fullName")] = "Use letters only.";
    }
    wholeNumber(errors, key("age"), l.age);
    email(errors, key("email"), l.email);
    address(errors, key("permanentAddress"), l.permanentAddress);
    if (l.currentSameAsPermanent === "no") {
      address(errors, key("currentAddress"), l.currentAddress);
    }
    return;
  }

  if (side === "complainant") {
    required(errors, key("institutionType"), l.institutionType, "Choose the type of institution.");
    required(errors, key("institutionName"), l.institutionName, "Enter the institution name.");
    phone(errors, key("phone"), l.phone, true);
    email(errors, key("email"), l.email);
    address(errors, key("institutionAddress"), l.institutionAddress);
    phone(errors, key("repPhone"), l.repPhone);
    required(errors, key("repName"), l.repName, "Enter the representative's full name.");
    wholeNumber(errors, key("repAge"), l.repAge);
    email(errors, key("repEmail"), l.repEmail);
    required(errors, key("repDesignation"), l.repDesignation, "Enter the designation.");
    address(errors, key("repAddress"), l.repAddress);
    return;
  }

  if (!institution) {
    if (!l.fullName.trim()) errors[key("fullName")] = "Enter the full name.";
    wholeNumber(errors, key("age"), l.age, { optional: true });
  } else {
    required(errors, key("institutionType"), l.institutionType, "Choose the type of institution.");
    required(errors, key("institutionName"), l.institutionName, "Enter the institution name.");
  }
  phone(errors, key("phone"), l.phone);
  email(errors, key("email"), l.email, false);
  if (l.addresses.length === 0) {
    errors[key("addresses")] = "Add at least one address.";
  }
  for (const row of l.addresses) {
    address(errors, row.id, row.addr);
    required(errors, `${row.id}.police`, row.police, "Choose the police station.");
  }
}

export function validateApplication(
  draft: ApplicationDraft,
  /**
   * What the form knows that the draft does not: the side of the litigant
   * picked in Edit Litigant Details.
   */
  context: { editSide?: "complainant" | "accused" } = {}
): ApplicationErrors {
  const errors: Errors = {};

  if (!draft.type) {
    errors.type = "Select an application type.";
    return { fields: errors };
  }

  // Every application.
  required(errors, "raisedById", draft.raisedById, "Choose who is raising this application.");
  required(errors, "litigantId", draft.litigantId, "Choose the litigant.");
  validateSupportingDocuments(draft, errors);

  switch (draft.type) {
    case "bail": {
      if (!draft.bailType) errors.bailType = "Choose the type of bail.";
      const amount = draft.bailAmount.replace(/,/g, "").trim();
      if (!amount) errors.bailAmount = "Enter the bail amount.";
      else if (!/^\d+(\.\d{1,2})?$/.test(amount) || Number(amount) <= 0) {
        errors.bailAmount = "Enter an amount in rupees.";
      }
      if (draft.bailType === "surety") {
        wholeNumber(errors, "suretyCount", draft.suretyCount);
        for (const surety of draft.sureties) {
          required(errors, `${surety.id}.fullName`, surety.fullName, "Enter the surety's name.");
          required(errors, `${surety.id}.parentName`, surety.parentName, "Enter the father's or mother's name.");
          phone(errors, `${surety.id}.phone`, surety.phone);
          email(errors, `${surety.id}.email`, surety.email);
          address(errors, `${surety.id}.address`, surety.address);
          files(errors, `${surety.id}.identityProof`, surety.identityProof, "Attach the surety's ID proof.");
          files(errors, `${surety.id}.solvencyProof`, surety.solvencyProof, "Attach the proof of solvency.");
        }
      }
      required(errors, "bailReason", draft.bailReason, "Enter the reason for bail.");
      break;
    }

    case "edit-litigant-details": {
      required(errors, "editLitigantId", draft.editLitigantId, "Choose the litigant whose details change.");
      required(errors, "editReason", draft.editReason, "Enter the reason for editing.");
      if (draft.editLitigantId) {
        if (!draft.litigantType) errors.litigantType = "Choose the litigant type.";
        else validateLitigant(draft, context.editSide ?? "complainant", errors);
      }
      break;
    }

    case "settlement":
      required(errors, "settlementReason", draft.settlementReason, "Enter the reason for settlement.");
      break;

    case "transfer":
      required(errors, "requestedCourt", draft.requestedCourt, "Enter the court you are asking for.");
      required(errors, "transferReason", draft.transferReason, "Enter the reason for transfer.");
      break;

    case "withdrawal":
      required(errors, "withdrawalReason", draft.withdrawalReason, "Enter the reason for withdrawal.");
      break;

    case "condonation-of-delay":
      required(errors, "delayReason", draft.delayReason, "Enter the reasons for delay.");
      break;

    case "application-others": {
      const title = draft.title.trim();
      if (!title) errors.title = "Enter an application title.";
      else if (!TITLE_PATTERN.test(title)) {
        errors.title = "Use letters, numbers and punctuation only.";
      }
      required(errors, "details", draft.details, "Enter the details.");
      break;
    }

    case "advancement-reschedule":
    case "postpone":
      required(errors, "rescheduleReason", draft.rescheduleReason, "Choose the reason for rescheduling.");
      if (!draft.proposedHearingDate) {
        errors.proposedHearingDate = "Choose the proposed hearing date.";
      }
      break;

    case "poa-change":
      if (draft.poaLitigantIds.length === 0) {
        errors.poaLitigantIds = "Choose at least one litigant.";
      }
      for (const id of draft.poaLitigantIds) {
        files(
          errors,
          `poa.${id}`,
          draft.poaAuthorizations[id] ?? [],
          "Attach the authorization document."
        );
      }
      required(errors, "poaReason", draft.poaReason, "Enter the reason for change.");
      break;

    case "production-of-documents":
      required(errors, "productionReason", draft.productionReason, "Enter the reason for application.");
      if (draft.productionDocuments.length === 0) {
        errors.productionDocuments = "Add at least one document.";
      }
      for (const row of draft.productionDocuments) {
        required(errors, `${row.id}.type`, row.type, "Enter the document type.");
        files(errors, `${row.id}.files`, row.files, "Choose a file or remove this document.");
      }
      break;

    case "addition-of-witness":
      if (draft.witnesses.length === 0) {
        errors.witnesses = "Add at least one witness.";
      }
      for (const witness of draft.witnesses) {
        if (!witness.fullName.trim() && !witness.designation.trim()) {
          errors[`${witness.id}.fullName`] = "Enter a full name or a designation.";
        }
        wholeNumber(errors, `${witness.id}.age`, witness.age, { optional: true });
        phone(errors, `${witness.id}.mobile`, witness.mobile, true);
        email(errors, `${witness.id}.email`, witness.email);
        if (witness.addresses.length === 0) {
          errors[`${witness.id}.addresses`] = "Add at least one address.";
        }
        for (const row of witness.addresses) address(errors, row.id, row.addr);
      }
      break;

    case "warrant-by-hand":
      required(errors, "warrantAccusedId", draft.warrantAccusedId, "Choose the accused.");
      address(errors, "deliveryAddress", draft.deliveryAddress);
      break;

    case "absent-application":
      required(errors, "absenceReason", draft.absenceReason, "Enter the reason for absence.");
      break;

    case "reopen-evidence":
      required(errors, "reopenReason", draft.reopenReason, "Enter the reason for reopening.");
      break;

    case "objection":
      required(errors, "objectionReason", draft.objectionReason, "Enter the reason for objection.");
      break;
  }

  return { fields: errors };
}

/**
 * The files an application carries besides itself, each named the way the
 * Documents tab titles it (Document Submission PRD, DSB-23): a fixed
 * attachment by its field's name, a supporting document by the name the
 * filer gave it. A name that comes up twice is numbered in order, as the
 * complaint's upload slots are.
 */
export function applicationAttachments(
  draft: ApplicationDraft,
  personName: (id: string) => string
): { label: string; files: File[] }[] {
  const found: { label: string; files: File[] }[] = [];
  const add = (label: string, files: File[]) => {
    if (files.length > 0 && label.trim()) found.push({ label: label.trim(), files });
  };
  /* Only the chosen type's own fields: a draft keeps what was entered under
     a type the filer then moved away from. */
  if (draft.type === "bail" && draft.bailType === "surety") {
    for (const surety of draft.sureties) {
      add("Surety ID proof", surety.identityProof);
      add("Proof of solvency", surety.solvencyProof);
    }
  }
  if (draft.type === "production-of-documents") {
    for (const row of draft.productionDocuments) add(row.type, row.files);
  }
  if (draft.type === "poa-change") for (const id of draft.poaLitigantIds) {
    add(`Authorization document of ${personName(id)}`, draft.poaAuthorizations[id] ?? []);
  }
  for (const row of draft.supportingDocuments) add(row.name, row.files);

  const totals = new Map<string, number>();
  for (const item of found) totals.set(item.label, (totals.get(item.label) ?? 0) + 1);
  const seen = new Map<string, number>();
  return found.map((item) => {
    if ((totals.get(item.label) ?? 0) < 2) return item;
    const count = (seen.get(item.label) ?? 0) + 1;
    seen.set(item.label, count);
    return { ...item, label: `${item.label} ${count}` };
  });
}
