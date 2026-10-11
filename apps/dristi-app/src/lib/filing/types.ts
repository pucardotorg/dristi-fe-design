/**
 * E-filing draft model — the shape every filing screen reads and writes.
 *
 * Cheque bounce, S-138 NI Act. Values are plain strings so a draft round-trips through
 * IndexedDB unchanged; dates are ISO `yyyy-mm-dd` (or "" when unset) and are formatted at
 * the edge (see format.ts). Terminology follows docs/product/terminology.md; nothing here
 * is a persona.
 *
 * Engineering note: this is the client-side draft contract. The repository in
 * `./data/` persists it locally today; a backend replaces that layer, not this shape.
 */

export type YesNo = "yes" | "no";
export type ISODate = string; // "yyyy-mm-dd" | ""

/** Screens of the flow, in walking order (see steps.ts for titles/routes). */
export type StepId =
  | "upload"
  | "complainant"
  | "advocate"
  | "accused"
  | "cheque"
  | "demand-notice"
  | "jurisdiction"
  | "adr-prayer"
  | "witnesses"
  | "documents"
  | "affidavit"
  | "preview"
  | "sign"
  | "pay-fees";

export type Address = {
  line1: string;
  city: string;
  pin: string;
  district: string;
  state: string;
};

export type Contact = { mobile: string; email: string };

/** An address plus the jurisdiction facts the court needs to serve process. */
export type AddressBlock = {
  addr: Address;
  police: string;
};

/* ─────────────────────────────── Files & extraction ─────────────────────────────── */

/** A file the person uploaded; the bytes live in the file store under `id`. */
export type StoredFileRef = {
  id: string;
  name: string;
  /** Bytes. */
  size: number;
  /** MIME type as reported by the browser ("image/jpeg", "application/pdf"). */
  type: string;
  /** Upper-case extension for chips ("JPG", "PDF"). */
  ext: string;
};

/** Pixel box on the source page (page 1 for PDFs), origin top-left. */
export type ExtractBox = { x0: number; y0: number; x1: number; y1: number };

export type ExtractedField = {
  value: string;
  /** 0–100. */
  confidence: number;
  box?: ExtractBox;
};

/** What document reading produced for one upload — the parsed fields, not the raw text. */
export type DocExtract = {
  engine: "pdf-text" | "tesseract";
  /** Mean word confidence, 0–100 (100 for a PDF text layer). */
  confidence: number;
  page: { width: number; height: number };
  fields: Record<string, ExtractedField>;
  extractedAt: string;
};

/* ───────────────────────── Intake (Case documents upload) ───────────────────────── */

/** What a slot expects — drives which parser reads the upload and where values land. */
export type IntakeDocType =
  | "cheque-front"
  | "return-memo"
  | "demand-notice"
  | "dispatch-proof"
  | "delivery-proof"
  | "notice-reply"
  | "id-proof"
  | "poa"
  | "vakalatnama"
  | "other"
  | "supporting";

export type IntakeSlot = {
  key: string;
  docType: IntakeDocType;
  label: string;
  desc?: string;
  /** Required for filing; optional slots render the "Optional" chip. */
  required: boolean;
  file: StoredFileRef | null;
  /** Reading in progress (upload landed, extraction running). */
  processing?: boolean;
  /** 0–100 while processing. */
  progress?: number;
  /** Extraction confidence too low, or the image too small, to trust the read. */
  poor?: boolean;
  extract?: DocExtract;
  /** Reading failed (unsupported file, engine error) — the upload itself is kept. */
  error?: string;
};

export type IntakeGroup = { n: number; slots: IntakeSlot[] };

export type Intake = {
  cheques: IntakeGroup[];
  parties: IntakeGroup[];
  supporting: IntakeSlot[];
};

/* ───────────────────────────────── Complainant ──────────────────────────────────── */

export type ComplainantType = "individual" | "institution";

export type PoaHolder = {
  mobile: string;
  name: string;
  age: string;
  res: Address;
  permSame: YesNo;
  perm: Address;
};

/** Optional demographic fields — asked for the complainant and the legal representative. */
export type Gender = "male" | "female" | "other" | "";
export type DifferentlyAbled = YesNo | "";

export type Representative = {
  mobile: string;
  name: string;
  age: string;
  /** "Managing Director", "Partner" — the capacity they answer for the entity in. */
  designation: string;
  email: string;
  addr: Address;
  /** Optional. */
  gender: Gender;
  /** Optional. */
  differentlyAbled: DifferentlyAbled;
};

/** Field keys that document reading can machine-fill on a complainant. */
export type ComplainantPrefillKey = "name" | "email" | "res" | "entName" | "age";

/** A video of an advocate reciting the oath, uploaded or recorded in place. */
export type OathVideoUpload = {
  file: StoredFileRef;
  /** Seconds, read from the file's own metadata; null when it could not be read. */
  durationSeconds: number | null;
};

export type Complainant = {
  id: string;
  pip: YesNo;
  type: ComplainantType;
  mobile: string;
  /** Matched against the ON Court register — the sandbox stand-in for a real lookup. */
  verified: boolean;
  /** The verified number had a saved record, and it filled this screen in. */
  fetched: boolean;
  name: string;
  age: string;
  /** Optional. */
  gender: Gender;
  /** Optional. */
  differentlyAbled: DifferentlyAbled;
  email: string;
  res: Address;
  permSame: YesNo;
  perm: Address;
  poa: YesNo;
  poaHolder: PoaHolder;
  entType: string;
  entName: string;
  /**
   * The institution's CIN or PAN, stored upper-case — used to identify cases belonging
   * to the same complainant. Mandatory but skippable (handover `LIT-18a`): leaving the
   * step without one needs the filer's declaration that they understand the consequence.
   */
  entCinPan: string;
  /**
   * When the filer declared they are skipping the CIN or PAN and understand the case will
   * not be linked to the complainant's other cases (`LIT-18a`). `null` = no declaration.
   */
  entCinPanSkippedAt: string | null;
  entPhone: string;
  entEmail: string;
  entAddr: Address;
  rep: Representative;
  /** Party-in-person affidavit body (HTML from the rich text editor). */
  affidavit: string;
  prefilled: Partial<Record<ComplainantPrefillKey, boolean>>;
  edited: Partial<Record<ComplainantPrefillKey, boolean>>;
  toReview: boolean;
};

/* ─────────────────────────────────── Advocate ───────────────────────────────────── */

export type Advocate = {
  id: string;
  /** Indices into `draft.complainants` this advocate appears for. */
  forComplainants: number[];
  barNumber: string;
  name: string;
};

/* ─────────────────────────────────── Accused ────────────────────────────────────── */

/**
 * What the accused is, not what kind of entity they are — those are two questions, and
 * folding them into one list meant an institution had to pick its legal form before the
 * form knew it was dealing with an institution at all.
 */
export type AccusedType = "individual" | "institution";

export type Accused = {
  id: string;
  type: AccusedType;
  name: string;
  /** Legal form of the entity — asked only when `type` is "institution". */
  entType: string;
  contacts: Contact[];
  addresses: AddressBlock[];
  /**
   * Who is summoned for the entity. Under S-141 every person in charge of the company's
   * business at the time of the offence is proceeded against alongside it, so an
   * institution can carry several.
   */
  reps: Representative[];
  jurisdiction: YesNo;
};

/* ───────────────────────────── Cheque & return memo ─────────────────────────────── */

export type ChequeField =
  | "dateOnCheque"
  | "amount"
  | "chequeNumber"
  | "ifsc"
  | "bankName"
  | "bankBranch"
  | "presentDate"
  | "returnDate"
  | "returnReason";

export type ChequeDetails = {
  id: string;
  dateOnCheque: ISODate;
  amount: string;
  chequeNumber: string;
  sameAsPrev: YesNo;
  ifsc: string;
  bankName: string;
  bankBranch: string;
  presentDate: ISODate;
  returnDate: ISODate;
  returnReason: string;
  prefilled: Partial<Record<ChequeField, boolean>>;
  edited: Partial<Record<ChequeField, boolean>>;
  ifscFetched: boolean;
};

/* ───────────────────────────── Demand notice & debt ─────────────────────────────── */

export type NoticeField =
  | "natureDebt"
  | "whyIssued"
  | "dispatchDate"
  | "tracking"
  | "modeService"
  | "deliveryDate";

export type DemandNotice = {
  id: string;
  natureDebt: string;
  whyIssued: string;
  dispatchDate: ISODate;
  modeService: string;
  tracking: string;
  delivered: YesNo;
  deliveryDate: ISODate;
  replied: YesNo;
  returnDate: ISODate;
  nonDeliveryReason: string;
  paymentStatus: "" | "none" | "part";
  partAmount: string;
  prefilled: Partial<Record<NoticeField, boolean>>;
  edited: Partial<Record<NoticeField, boolean>>;
};

/* ─────────────────────────── Jurisdiction & limitation ──────────────────────────── */

export type OtherCase = { court: string; caseNumber: string };

export type Jurisdiction = {
  deposited: YesNo;
  ifsc: string;
  payeeBankName: string;
  payeeBankBranch: string;
  payeeFetched: boolean;
  payeePolice: string;
  drawerPolice: string;
  otherPending: YesNo;
  otherCases: OtherCase[];
  causeDate: ISODate;
  filingDate: ISODate;
  condonationReason: string;
};

/* ───────────────────────────── ADR, other details, prayer ───────────────────────── */

export type AdrPrayer = {
  adr: "yes" | "no" | "maybe";
  otherDetails: string;
  interimRelief: string;
  finalRelief: string;
};

/* ─────────────────────────────────── Witnesses ──────────────────────────────────── */

export type Witness = {
  id: string;
  fullName: string;
  designation: string;
  age: string;
  prove: string;
  contacts: Contact[];
  addresses: AddressBlock[];
};

/* ────────────────────────────── List of documents ───────────────────────────────── */

export type CaseDocument = {
  id: string;
  name: string;
  required: boolean;
  file: StoredFileRef | null;
  /** Readability check on the upload (image resolution / PDF text layer). */
  quality: "good" | "bad" | null;
  digital: boolean;
  /** Mirrors an intake slot (by key) — replacing it there updates here. */
  intakeKey?: string;
  custom?: boolean;
};

export type DocumentGroup = { id: string; title: string; docs: CaseDocument[] };

/* ───────────────────────────────────── Sign ─────────────────────────────────────── */

/** Who has to sign — derived from the parties on the draft (see selectors). */
export type Signatory = {
  id: string;
  name: string;
  role: string;
  status: "pending" | "signed";
  /** What made the signature, once there is one — Aadhaar OTP, a DSC, or paper. */
  signedWith?: SignInstrument;
  you?: boolean;
  /**
   * Whether the oath is in. Complainants and advocates both sign *and* take the oath;
   * absent while the oath is switched off, when nothing waits on it.
   */
  oathTaken?: boolean;
};

/**
 * One person who verifies, by OTP on their own number, that they signed a copy being
 * uploaded — the point being that the litigant themselves has reach into their own case
 * file, not only whoever is at the keyboard.
 *
 * Only people who have to sign appear: a complainant acting through a PoA holder signs
 * through the holder, so the holder is listed and the complainant is not (owner,
 * 2026-08-19). Advocates cannot appear — the Advocate section collects no phone.
 */
export type PhoneConfirmer = {
  id: string;
  /** The person who receives the code. */
  name: string;
  /** The capacity they answer in — "Complainant 1 · Individual", "PoA holder for …". */
  role: string;
  mobile: string;
};

/**
 * One party's confirmation that they signed the copy being uploaded, authenticated by an
 * OTP to their own number. The OTP proves control of the handset; the declaration the
 * person answers is what makes it an attestation, so the two are shown together.
 *
 * Only the upload path collects these. Links were considered and dropped: the friction is
 * the point on a path we do not want to encourage (owner, 2026-08-19).
 */
export type PhoneConfirmation = {
  /**
   * The last four digits that were confirmed. Editing the party's number after the fact
   * voids the record rather than silently carrying it to a different handset.
   */
  mobileTail: string;
  /** When it was confirmed — IST in the live service. */
  at: string;
};

/**
 * One accused's upfront choice. Every field is optional because the stored record is
 * an override of the defaults, not a snapshot of them.
 */
export type AccusedProcessChoice = {
  /** Rounds prepaid, by `PROCESS_OPTIONS` key. */
  rounds?: Record<string, number>;
  /** Rounds of e-post prepaid — 1 … summons rounds (`PAY-15`). */
  delivery?: number;
  /** Address indices of *this* accused that summons is served at; at least one. */
  addresses?: number[];
};

/**
 * What one signature was made with. Aadhaar OTP and a DSC are both *digital* — the
 * difference is the instrument in the signer's own hands, which is theirs to pick and
 * need not match anyone else's. `paper` is a signature on the uploaded copy.
 */
export type SignInstrument = "aadhaar" | "dsc" | "paper";

/** What stopped e-signing, as the person turning to paper says it (`PAPER_FALLBACK_REASONS`). */
export type PaperFallbackReason =
  | "otp-not-received"
  | "dsc-not-working"
  | "party-cannot-esign"
  | "server-not-responding"
  | "other";

/**
 * The confirmation taken before anyone is allowed onto the paper path: that they could
 * not e-sign, and what stopped them. Paper is the discouraged route (owner, 2026-10-06),
 * so it is reached by saying so, not by picking it from a menu of equals.
 */
export type PaperFallback = {
  reason: PaperFallbackReason;
  /** ISO timestamp of the confirmation. */
  at: string;
};

/** One signature, as the record will have to state it later. */
export type SignatureRecord = {
  /** ISO timestamp — IST in the live service. */
  at: string;
  with: SignInstrument;
};

export type SignState = {
  /**
   * How this complaint is signed, at the level of the filing: every party signs in the
   * system ("digital"), or the complaint is printed, signed by hand and brought back as
   * one file ("upload"). It is *not* a personal choice — it decides what the court's
   * system asks of every other party — so it is presumed "digital" and changed
   * deliberately, never left unset (owner, 2026-09-23).
   */
  mode: "digital" | "upload";
  /**
   * When the signature requests went out: the moment this stopped being a private draft
   * and became work in other people's queues. `null` means nobody has been asked yet,
   * and nothing has left the building.
   */
  requestedAt: string | null;
  /**
   * Signatory id → when their link was last sent. Kept per party because a reminder is
   * about one of them, and because "asked at 14:02" is a fact the row has to state.
   */
  notified: Record<string, string>;
  /** Signatory id → their signature. Signatories themselves are derived, not stored. */
  signed: Record<string, SignatureRecord>;
  /** The signed copy, when signing by upload. */
  signedCopy: StoredFileRef | null;
  /**
   * Why this filing is on paper, confirmed by the filer before the upload opened. Kept
   * while the mode is "upload" and cleared when it goes back to digital; `null` on a
   * paper draft means the confirmation has not been taken yet, so the window asks first.
   */
  paperFallback: PaperFallback | null;
  /**
   * Signatory id → phone confirmation, for the upload path only. Every complainant row
   * has to be confirmed before an uploaded copy can be submitted.
   */
  confirmed: Record<string, PhoneConfirmation>;
  deliveryChannel: string;
  /**
   * The upfront process choice, per accused (`sign.process[accusedId]`) — handover
   * §19.3. Only what the filer has explicitly changed is stored; anything absent
   * follows the defaults, which is what lets the notice round track the Delay
   * Condonation section instead of freezing at draft creation (`PAY-11`). Resolve it
   * with `processPlan()` rather than reading it raw.
   */
  process: Record<string, AccusedProcessChoice>;
  /**
   * Advocate signatory id → their oath. Taken during signing, after the e-signature,
   * by whichever advocate signs for that slot. It affirms the contents of this exact
   * complaint, so it goes wherever the signatures go when the complaint is edited.
   */
  oaths: Record<string, AdvocateOath>;
  paid: boolean;
  paidAt: string | null;
  /** Rupees actually taken — the court fees plus every prepaid process round. */
  paidAmount: number | null;
  paymentRef: string | null;
  caseFileNumber: string | null;
};

/**
 * One advocate's oath. `video` is null only for the sandbox shortcut that marks the
 * other parties as done — there is no recording behind it, and the rail says so.
 */
export type AdvocateOath = {
  at: string;
  video: OathVideoUpload | null;
};

/* ─────────────────────────────────── Draft ──────────────────────────────────────── */

/** Standing notices the user has closed; each is remembered on the draft. */
export type DismissedNotices = {
  advocateInfo: boolean;
  accusedAddress: boolean;
};

export type FilingDraft = {
  version: 7;
  id: string;
  /** `pss25` has no filing flow yet — such a draft opens the placeholder page. */
  caseType: "s138" | "pss25";
  status: "draft" | "filed";
  /** Where the person last was — "Continue draft" resumes here. */
  lastStep: StepId;
  /**
   * Every section the person has opened. A section counts towards progress, and earns
   * its tick in the rail, only once it has been opened: some sections are complete before
   * anyone touches them (the prayer is pre-written, witnesses are optional), and a blank
   * draft must not read as part-done.
   *
   * Absent on drafts written before this was recorded — the samples and older saves —
   * which are read as every section up to `lastStep` opened.
   */
  visited?: StepId[];
  intake: Intake;
  complainants: Complainant[];
  advocates: Advocate[];
  accused: Accused[];
  cheques: ChequeDetails[];
  notices: DemandNotice[];
  jurisdiction: Jurisdiction;
  adr: AdrPrayer;
  witnesses: Witness[];
  /**
   * The affidavit as the filer edited it (HTML). Empty means it is still the standard
   * text, which is composed from the case — see `affidavitBody`.
   */
  affidavit: string;
  documents: DocumentGroup[];
  sign: SignState;
  dismissed: DismissedNotices;
  createdAt: string;
  updatedAt: string;
  filedAt: string | null;
  /**
   * Set on a filing scrutiny returned. Once the corrections are made, the complaint goes
   * back through the same Sign step as at e-filing (handover `SIG-07`) and is sent back
   * to scrutiny from there instead of paying again. `resubmittedAt` is when it went.
   */
  scrutinyReturn?: { resubmittedAt: string | null };
};

/* ─────────────────────────────────── Profile ────────────────────────────────────── */

/**
 * The signed-in person, as far as this flow needs to know. A stand-in for the product's
 * real session: the greeting, avatar, "you" among the signatories and the advocate
 * prefill read from it.
 */
export type UserProfile = {
  name: string;
  mobile: string;
  email: string;
  barNumber: string;
};
