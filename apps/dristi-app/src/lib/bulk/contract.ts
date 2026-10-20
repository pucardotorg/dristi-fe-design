/**
 * Bulk Filing API, v1 — what a litigation system sends to put many S-138 complaints into
 * DRISTI in one call (`POST /api/bulk/v1/batches`). The Excel upload is parsed into the
 * same shape, so both ways in meet one intake and one set of checks.
 *
 * The shape follows the case tree in the Bulk Filing PRD §3.3: what is the same for every
 * case (the complainant, their representative, the advocate) is sent once; each case
 * carries only its accused, cheques and notices. Field IDs in the comments are the e-filing
 * handover's.
 *
 * Deliberately absent, because DRISTI derives them and never accepts them from a filer
 * (PRD §3.5): cause of action, filing date, delay, synopsis and fees. A payload that sends
 * them has them ignored.
 *
 * List values are DRISTI's own option values (`lib/filing/options.ts`). A value that is not
 * in the list is kept as sent and held at scrutiny, never guessed.
 */

export type ApiAddress = {
  line1: string;
  city: string;
  /** 6 digits. District and state are looked up from it. */
  pin: string;
  /** `ACC-13` — optional, per address. */
  policeStation?: string;
};

export type ApiRepresentative = {
  name: string;
  designation?: string;
  age?: string;
  mobile?: string;
  email?: string;
  address?: ApiAddress;
};

/** Sent once per batch. */
export type ApiComplainant = {
  /** `LIT-2`. Bulk filers are institutions; individuals are accepted too. */
  type: "institution" | "individual";
  /** `LIT-17`, an `ENTITY_TYPES` value. */
  institutionType?: string;
  /** `LIT-18`. */
  name: string;
  /** `LIT-18a` — CIN or PAN. */
  cinPan?: string;
  phone?: string;
  email?: string;
  /** `LIT-21`. */
  address: ApiAddress;
  /** `LIT-22…26` — the authorised representative who signs for the institution. */
  representative?: ApiRepresentative;
};

export type ApiAdvocate = {
  /** `ADV-3`. The name (`ADV-4`) comes from the Bar Council lookup, never from the sender. */
  barNumber: string;
};

export type ApiAccused = {
  /** `ACC-1`. */
  type: "individual" | "institution";
  /** `ACC-2` or `ACC-5`. */
  name: string;
  /** `ACC-4`, an `ACCUSED_ENTITY_TYPES` value. */
  institutionType?: string;
  /** `ACC-3`. */
  age?: string;
  /** `ACC-6`. */
  mobile?: string;
  /** `ACC-7`. */
  email?: string;
  /** `ACC-8…12`, at least one. */
  addresses: ApiAddress[];
  /** `ACC-14…17` — persons responsible under S-141, institutions only. */
  personsResponsible?: ApiRepresentative[];
};

export type ApiCheque = {
  /** `CHQ-3`, 6 digits. */
  number: string;
  /** `CHQ-1`, yyyy-mm-dd. */
  date: string;
  /** `CHQ-2`, rupees. */
  amount: string;
  /** `CHQ-5`. Bank name and branch (`CHQ-6`, `CHQ-7`) are looked up. */
  ifsc: string;
  /** `CHQ-7a`. */
  accountNumber?: string;
  /** `CHQ-8`. */
  presentedOn: string;
  /** `CHQ-9`. */
  returnedOn: string;
  /** `CHQ-10`, a `RETURN_REASONS` value. */
  returnReason: string;
};

export type ApiNotice = {
  /** `LDN-1`, a `NATURE_OF_DEBT` value. */
  natureOfDebt: string;
  /** `LDN-2`. */
  dispatchedOn: string;
  /** `LDN-3`, a `MODE_OF_SERVICE` value. */
  mode: string;
  /** `LDN-4`. */
  trackingNumber?: string;
  /** `LDN-5`. `null` when the sender does not know yet — held at scrutiny. */
  delivered: boolean | null;
  /** `LDN-6`. */
  deliveredOn?: string;
  /** `LDN-7`. */
  returnedOn?: string;
  /** `LDN-8`, a `NON_DELIVERY_REASONS` value. */
  nonDeliveryReason?: string;
  /** `LDN-9`. */
  replied: boolean;
  /** `LDN-10`, `LDN-11`. */
  payment: { status: "none" | "part"; amount?: string };
};

export type ApiJurisdiction = {
  /** `JUR-1`. */
  depositedInOwnAccount: boolean;
  /** `JUR-2`, when deposited in own account. */
  complainantBranchIfsc?: string;
  /** `JUR-6a`, when not. */
  drawerBranchPoliceStation?: string;
  /** `JUR-6b`, `JUR-7`, `JUR-8`. */
  otherPendingCases?: { court: string; caseNumber: string }[];
};

/**
 * A document the sender holds, fetched by DRISTI at intake. `code` is the PRD's document
 * ID; `index` (1-based) says which cheque or notice it belongs to where there are several.
 */
export type ApiDocument = {
  code: DocCode;
  index?: number;
  name: string;
  url: string;
  contentType?: string;
};

export type ApiCase = {
  /** The sender's own reference (a loan account number). Unique within the batch. */
  reference: string;
  accused: ApiAccused[];
  cheques: ApiCheque[];
  notices: ApiNotice[];
  jurisdiction: ApiJurisdiction;
  /** `JUR-12` — only used when DRISTI computes a delay. */
  condonationReason?: string;
  documents?: ApiDocument[];
};

export type ApiBatchRequest = {
  source: {
    /** "Provakil", or "Excel upload". */
    system: string;
    /** The sender's id for this push, echoed back. */
    reference?: string;
    /** Who pressed send, as the sender knows them. */
    sentBy?: string;
  };
  complainant: ApiComplainant;
  advocates: ApiAdvocate[];
  /** `PRY-5`. */
  adr?: "yes" | "no";
  cases: ApiCase[];
};

export type ApiBatchResponse = {
  batchId: string;
  batchNumber: string;
  receivedAt: string;
  /** Where the filer reviews the batch in DRISTI. */
  url: string;
  cases: { reference: string; caseId: string; status: "draft" }[];
};

/** Rejected before any batch exists: the request is not a batch at all. */
export type ApiError = { error: string; details?: string[] };

/** The PRD's document IDs (Appendix B). */
export const DOC_CODES = [
  "DCM-1",
  "DCM-2",
  "DCM-3",
  "DCM-4",
  "DCM-5",
  "DCM-6",
  "DCM-7",
  "DCM-9",
  "DCM-11",
  "DCM-12",
] as const;

export type DocCode = (typeof DOC_CODES)[number];

/** What each code is, as the documents screen names it. */
export const DOC_CODE_LABEL: Record<DocCode, string> = {
  "DCM-1": "Cheque",
  "DCM-2": "Return memo",
  "DCM-3": "Demand notice",
  "DCM-4": "Proof of dispatch",
  "DCM-5": "Proof of delivery",
  "DCM-6": "Reply to notice",
  "DCM-7": "Proof of debt",
  "DCM-9": "ID card: complainant",
  "DCM-11": "Power of attorney",
  "DCM-12": "Vakalatnama",
};

/**
 * The intake slot each code fills on a draft (`lib/filing/blank.ts`). Per-cheque codes take
 * the cheque's number; the complainant's take complainant 1, the only one a batch has.
 */
export function slotKeyFor(code: DocCode, index = 1): string {
  switch (code) {
    case "DCM-1":
      return `c${index}f`;
    case "DCM-2":
      return `c${index}m`;
    case "DCM-3":
      return `c${index}dn`;
    case "DCM-4":
      return `c${index}dp`;
    case "DCM-5":
      return `c${index}ad`;
    case "DCM-6":
      return `c${index}rp`;
    case "DCM-7":
      return "sl";
    case "DCM-9":
      return "p1id";
    case "DCM-11":
      return "p1poa";
    case "DCM-12":
      return "p1vak";
  }
}

/** The reverse of `slotKeyFor`, for naming a slot by its code on screen. */
export function codeForSlot(key: string): { code: DocCode; index: number } | null {
  const cheque = /^c(\d+)(f|m|dn|dp|ad|rp)/.exec(key);
  if (cheque) {
    const index = Number(cheque[1]);
    const map: Record<string, DocCode> = {
      f: "DCM-1",
      m: "DCM-2",
      dn: "DCM-3",
      dp: "DCM-4",
      ad: "DCM-5",
      rp: "DCM-6",
    };
    return { code: map[cheque[2]], index };
  }
  if (key === "sl") return { code: "DCM-7", index: 1 };
  if (key.startsWith("p1id")) return { code: "DCM-9", index: 1 };
  if (key.startsWith("p1poa")) return { code: "DCM-11", index: 1 };
  if (key.startsWith("p1vak")) return { code: "DCM-12", index: 1 };
  return null;
}
