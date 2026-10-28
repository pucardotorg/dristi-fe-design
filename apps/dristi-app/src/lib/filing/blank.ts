/**
 * Blank factories for the e-filing draft.
 *
 * A new filing starts empty: one complainant, one advocate, one accused, one cheque with
 * its notice, one witness row, and the intake slots those imply. Nothing is pre-typed —
 * values arrive from what the person uploads (document reading) or types.
 */

import { newId } from "./data";
import {
  AFFIDAVIT_PIP_TEMPLATE,
  DELIVERY_CHANNEL,
  FINAL_RELIEF_TEMPLATE,
  INTERIM_RELIEF_TEMPLATE,
} from "./options";
import { WALK_ORDER } from "./steps";
import type {
  Accused,
  Address,
  AdrPrayer,
  AddressBlock,
  Advocate,
  CaseDocument,
  ChequeDetails,
  Complainant,
  Contact,
  DemandNotice,
  DocumentGroup,
  FilingDraft,
  IntakeGroup,
  IntakeSlot,
  Jurisdiction,
  SignInstrument,
  UserProfile,
  Representative,
  Witness,
} from "./types";

/** Row ids for repeatable things (parties, cheques, documents…). */
export function uid(prefix = "id"): string {
  return newId(prefix);
}

/* ───────────────────────────── Blank factories ─────────────────────── */

export const blankAddress = (): Address => ({
  line1: "",
  city: "",
  pin: "",
  district: "",
  state: "",
});

export const blankContact = (): Contact => ({ mobile: "", email: "" });

/** A person summoned for an entity — the accused entity's own, or a complainant's. */
export const blankRepresentative = (): Representative => ({
  mobile: "",
  name: "",
  age: "",
  designation: "",
  email: "",
  addr: blankAddress(),
  gender: "",
  differentlyAbled: "",
});

export const blankAddressBlock = (): AddressBlock => ({
  addr: blankAddress(),
  police: "",
});

export function blankComplainant(): Complainant {
  return {
    id: uid("cp"),
    pip: "no",
    type: "individual",
    mobile: "",
    verified: false,
    fetched: false,
    name: "",
    age: "",
    gender: "",
    differentlyAbled: "",
    email: "",
    res: blankAddress(),
    permSame: "yes",
    perm: blankAddress(),
    poa: "no",
    poaHolder: {
      mobile: "",
      name: "",
      age: "",
      res: blankAddress(),
      permSame: "yes",
      perm: blankAddress(),
    },
    entType: "",
    entName: "",
    entCinPan: "",
    entCinPanSkippedAt: null,
    entPhone: "",
    entEmail: "",
    entAddr: blankAddress(),
    rep: blankRepresentative(),
    affidavit: AFFIDAVIT_PIP_TEMPLATE,
    prefilled: {},
    edited: {},
    toReview: false,
  };
}

export const blankAdvocate = (profile?: UserProfile | null): Advocate => ({
  id: uid("adv"),
  forComplainants: [0],
  barNumber: profile?.barNumber ?? "",
  name: profile?.name ?? "",
});

export const blankAccused = (): Accused => ({
  id: uid("acc"),
  type: "individual",
  name: "",
  entType: "",
  contacts: [blankContact()],
  reps: [blankRepresentative()],
  addresses: [blankAddressBlock()],
  jurisdiction: "yes",
});

export const blankCheque = (): ChequeDetails => ({
  id: uid("chq"),
  dateOnCheque: "",
  amount: "",
  chequeNumber: "",
  sameAsPrev: "no",
  ifsc: "",
  bankName: "",
  bankBranch: "",
  presentDate: "",
  returnDate: "",
  returnReason: "",
  prefilled: {},
  edited: {},
  ifscFetched: false,
});

export const blankNotice = (): DemandNotice => ({
  id: uid("dn"),
  natureDebt: "",
  dispatchDate: "",
  modeService: "",
  tracking: "",
  delivered: "yes",
  deliveryDate: "",
  replied: "no",
  returnDate: "",
  nonDeliveryReason: "",
  paymentStatus: "",
  partAmount: "",
  prefilled: {},
  edited: {},
});

export const blankJurisdiction = (): Jurisdiction => ({
  deposited: "yes",
  ifsc: "",
  payeeBankName: "",
  payeeBankBranch: "",
  payeeFetched: false,
  payeePolice: "",
  drawerPolice: "",
  otherPending: "no",
  otherCases: [{ court: "", caseNumber: "" }],
  causeDate: "",
  filingDate: "",
  condonationReason: "",
});

export const blankWitness = (): Witness => ({
  id: uid("wit"),
  fullName: "",
  designation: "",
  age: "",
  prove: "",
  contacts: [blankContact()],
  addresses: [blankAddressBlock()],
});

/* ───────────────────────────── Intake groups ───────────────────────── */

/** The two documents every cheque needs (`DCM-1`, `DCM-2`). */
export function intakeChequeGroup(n: number): IntakeGroup {
  return {
    n,
    slots: [
      {
        key: `c${n}f`,
        docType: "cheque-front",
        label: "Cheque (front side)",
        desc: "The bounced cheque, front side. A photo or scan.",
        required: true,
        file: null,
      },
      {
        key: `c${n}m`,
        docType: "return-memo",
        label: "Cheque return memo",
        desc: "The memo the bank issued when this cheque bounced.",
        required: true,
        file: null,
      },
    ],
  };
}

/** The documents every demand notice needs, plus the optional reply (`DCM-3`…`DCM-6`). */
export function intakeNoticeGroup(n: number): IntakeGroup {
  return {
    n,
    slots: [
      {
        key: `n${n}dn`,
        docType: "demand-notice",
        label: "Demand notice",
        desc: "The statutory demand notice sent to the accused.",
        required: true,
        file: null,
      },
      {
        key: `n${n}dp`,
        docType: "dispatch-proof",
        label: "Proof of dispatch of demand notice (postal receipt)",
        desc: "Speed post / RPAD receipt showing dispatch.",
        required: true,
        file: null,
      },
      {
        key: `n${n}ad`,
        docType: "delivery-proof",
        label: "Proof of delivery of demand notice (AD card)",
        desc: "Acknowledgement-due card or tracking proof of delivery.",
        required: true,
        file: null,
      },
      {
        key: `n${n}rp`,
        docType: "notice-reply",
        label: "Reply to the demand notice",
        desc: "The accused's reply to the notice, if any.",
        required: false,
        file: null,
      },
    ],
  };
}

export function intakePartyGroup(n: number): IntakeGroup {
  return {
    n,
    slots: [
      {
        key: `p${n}id`,
        docType: "id-proof",
        label: "Identity proof (complainant)",
        desc: "PAN, Aadhaar, Passport, Driving licence, Voter ID, Ration card or Bank passbook.",
        required: true,
        file: null,
      },
      {
        key: `p${n}poa`,
        docType: "poa",
        label: "Power of attorney",
        desc: "If the complaint is filed through a PoA holder.",
        required: false,
        file: null,
      },
      {
        key: `p${n}vak`,
        docType: "vakalatnama",
        label: "Vakalatnama",
        desc: "Signed authorisation appointing the complainant's advocate(s).",
        required: true,
        file: null,
      },
    ],
  };
}

export function intakeOtherPartyDoc(partyN: number, index: number): IntakeSlot {
  return {
    key: `p${partyN}x${index}`,
    docType: "other",
    label: "Other document",
    desc: "Any additional document for this party.",
    required: false,
    file: null,
  };
}

export function intakeSupporting(): IntakeSlot[] {
  return [
    {
      key: "sl",
      docType: "supporting",
      label: "Loan agreement / invoice / ledger",
      desc: "Anything that records the debt, if available.",
      required: false,
      file: null,
    },
  ];
}

/* ───────────────────────────── List of documents ───────────────────── */

type DocSpec = {
  name: string;
  required: boolean;
  intakeKey?: string;
};

function docRow(spec: DocSpec, existing: CaseDocument | undefined, slot?: IntakeSlot): CaseDocument {
  const mirrored = spec.intakeKey ? slot ?? null : null;
  return {
    id: existing?.id ?? uid("doc"),
    name: spec.name,
    required: spec.required,
    // Rows that mirror an intake slot always show that slot's file; others keep their own.
    file: mirrored ? mirrored.file : existing?.file ?? null,
    quality: mirrored
      ? mirrored.file
        ? mirrored.poor
          ? "bad"
          : "good"
        : null
      : existing?.quality ?? null,
    digital: existing?.digital ?? false,
    intakeKey: spec.intakeKey,
    custom: false,
  };
}

/**
 * The "List of documents" step, derived from the case: one row per document each cheque
 * and party needs, mirroring what intake already holds. Existing rows keep their id,
 * digital flag and any file uploaded on that step; custom rows the person added are kept.
 */
export function buildDocumentGroups(draft: FilingDraft): DocumentGroup[] {
  const slotByKey = new Map<string, IntakeSlot>();
  for (const g of draft.intake.cheques) g.slots.forEach((s) => slotByKey.set(s.key, s));
  for (const g of draft.intake.notices) g.slots.forEach((s) => slotByKey.set(s.key, s));
  for (const g of draft.intake.parties) g.slots.forEach((s) => slotByKey.set(s.key, s));
  draft.intake.supporting.forEach((s) => slotByKey.set(s.key, s));

  const prevGroups = new Map(draft.documents.map((g) => [g.id, g]));
  const findExisting = (groupId: string, spec: DocSpec) => {
    const g = prevGroups.get(groupId);
    if (!g) return undefined;
    return (
      (spec.intakeKey && g.docs.find((d) => d.intakeKey === spec.intakeKey)) ||
      g.docs.find((d) => !d.custom && d.name === spec.name)
    );
  };
  const customOf = (groupId: string) => prevGroups.get(groupId)?.docs.filter((d) => d.custom) ?? [];

  const groups: DocumentGroup[] = [];

  // Case details — per cheque, then per demand notice (`DCM-1`…`DCM-6`).
  const manyCheques = draft.intake.cheques.length > 1;
  const manyNotices = draft.intake.notices.length > 1;
  const caseSpecs: DocSpec[] = [
    ...draft.intake.cheques.flatMap((g) => {
      const sfx = manyCheques ? ` ${g.n}` : "";
      return [
        { name: `Cheque${sfx}`, required: true, intakeKey: `c${g.n}f` },
        { name: `Cheque return memo${sfx}`, required: true, intakeKey: `c${g.n}m` },
      ];
    }),
    ...draft.intake.notices.flatMap((g) => {
      const sfx = manyNotices ? ` ${g.n}` : "";
      return [
        { name: `Demand notice${sfx}`, required: true, intakeKey: `n${g.n}dn` },
        { name: `Proof of dispatch of demand notice (postal receipt)${sfx}`, required: true, intakeKey: `n${g.n}dp` },
        { name: `Proof of delivery of demand notice (AD card)${sfx}`, required: true, intakeKey: `n${g.n}ad` },
        { name: `Reply to the demand notice${sfx}`, required: false, intakeKey: `n${g.n}rp` },
      ];
    }),
  ];
  // Intake keys can carry a "-2" suffix after a remove/add; resolve by prefix.
  const resolveSlot = (key?: string) => {
    if (!key) return undefined;
    if (slotByKey.has(key)) return slotByKey.get(key);
    for (const [k, s] of slotByKey) if (k.startsWith(`${key}-`)) return s;
    return undefined;
  };
  groups.push({
    id: "case",
    title: "Case details",
    docs: [
      ...caseSpecs.map((s) => docRow(s, findExisting("case", s), resolveSlot(s.intakeKey))),
      ...customOf("case"),
    ],
  });

  // One group per complainant.
  draft.complainants.forEach((c, i) => {
    const n = i + 1;
    const id = `complainant-${n}`;
    const specs: DocSpec[] = [
      { name: "Identity proof: complainant", required: true, intakeKey: `p${n}id` },
      { name: "Power of attorney", required: c.poa === "yes", intakeKey: `p${n}poa` },
      { name: "Vakalatnama", required: c.pip !== "yes", intakeKey: `p${n}vak` },
    ];
    groups.push({
      id,
      title: `Complainant ${n}: documents`,
      docs: [
        ...specs.map((s) => docRow(s, findExisting(id, s), resolveSlot(s.intakeKey))),
        ...customOf(id),
      ],
    });
  });

  /*
   * The accused used to get a group of their own, listing an identity proof, a power of
   * attorney and a Vakalatnama. None of those are the complainant's to file — you do not
   * hold the ID of the person you are suing, and their advocate is not on record yet. The
   * group asked for documents nobody could produce, so it is gone (owner, 2026-08-19).
   */

  return groups;
}

/* ───────────────────────────── Blank draft ─────────────────────────── */

export function createBlankDraft(id: string, profile?: UserProfile | null): FilingDraft {
  const now = new Date().toISOString();
  const draft: FilingDraft = {
    version: 7,
    id,
    caseType: "s138",
    status: "draft",
    lastStep: "upload",
    visited: [],
    intake: {
      cheques: [intakeChequeGroup(1)],
      notices: [intakeNoticeGroup(1)],
      parties: [intakePartyGroup(1)],
      supporting: intakeSupporting(),
    },
    complainants: [blankComplainant()],
    advocates: [blankAdvocate(profile)],
    accused: [blankAccused()],
    cheques: [blankCheque()],
    notices: [blankNotice()],
    jurisdiction: blankJurisdiction(),
    adr: blankAdr(),
    witnesses: [blankWitness()],
    affidavit: "",
    documents: [],
    sign: {
      mode: "digital",
      requestedAt: null,
      notified: {},
      signed: {},
      signedCopy: null,
      paperFallback: null,
      confirmed: {},
      deliveryChannel: DELIVERY_CHANNEL,
      process: {},
      oaths: {},
      paid: false,
      paidAt: null,
      paidAmount: null,
      paymentRef: null,
      caseFileNumber: null,
    },
    dismissed: {
      advocateInfo: false,
      accusedAddress: false,
    },
    createdAt: now,
    updatedAt: now,
    filedAt: null,
  };
  draft.documents = buildDocumentGroups(draft);
  return draft;
}

/* ───────────────────────────── Migration ───────────────────────────── */

/** Accused kinds that used to be one flat list, mapped onto the pair that replaced it. */
const LEGACY_ACCUSED_ENTITY: Record<string, string> = {
  proprietorship: "proprietorship",
  partnership: "partnership",
  company: "private-limited",
  other: "other",
};

/**
 * The ADR block under the name a sibling branch gave it.
 *
 * `feature/settlement-options` renamed `adr` to `settlement` (willing / otherDetails /
 * interimRelief / finalRelief, plus the offer ladder) and deleted `adr` outright. Both
 * lineages write to the same IndexedDB on the same origin, and both bumped `version`
 * independently — settlement to 4, this one to 5 — so the number cannot tell them apart.
 * A draft written over there is read back here, and the prayer text the filer typed is
 * still in it under the other name.
 */
type SettlementShaped = {
  willing?: AdrPrayer["adr"];
  otherDetails?: string;
  interimRelief?: string;
  finalRelief?: string;
};

/** The ADR block as it stands when nothing on disk has one. */
const blankAdr = (): AdrPrayer => ({
  adr: "yes",
  otherDetails: "",
  interimRelief: INTERIM_RELIEF_TEMPLATE,
  finalRelief: FINAL_RELIEF_TEMPLATE,
});

/**
 * Bring a stored draft up to the current shape.
 *
 * Drafts live in the browser, so a person who was mid-filing when the form changed still
 * has the old one on disk. Fields that were dropped are simply ignored; the accused's
 * kind is the one value that moved, so it is carried across rather than reset to
 * "Individual" — silently changing who someone is suing would be worse than any of this.
 *
 * Every block is defaulted before it is read. A draft can reach this function from a
 * branch this one has never seen — the settlement rename is the case that actually
 * happened — and a missing block used to throw somewhere deep in a selector, which took
 * the whole filings screen down over one unreadable row. Ignorance of a field is
 * survivable; a blank screen is not.
 */
export function migrateDraft(draft: FilingDraft): FilingDraft {
  migrateAdr(draft);

  // migrateAdr moves the one renamed id this branch knows to carry across
  // ("settlement"); a step dropped or renamed some other way — the next one will not
  // be predictable either — otherwise survives on the draft as an id this branch's
  // router cannot resolve, and `getStep` throws over it deep inside the queue list.
  // Reopening onto the first screen is a smaller loss than that.
  // Oath stopped being a step of its own: it is taken during signing now. A draft left
  // there reopens on the screen that used to come after it.
  if ((draft.lastStep as string) === "oath") draft.lastStep = "affidavit";
  if (!WALK_ORDER.includes(draft.lastStep)) draft.lastStep = "upload";

  draft.intake ??= {
    cheques: [intakeChequeGroup(1)],
    notices: [intakeNoticeGroup(1)],
    parties: [intakePartyGroup(1)],
    supporting: intakeSupporting(),
  };
  migrateNoticeIntake(draft);
  draft.complainants ??= [blankComplainant()];
  draft.advocates ??= [blankAdvocate()];
  draft.accused ??= [blankAccused()];
  draft.cheques ??= [blankCheque()];
  draft.notices ??= [blankNotice()];
  draft.jurisdiction ??= blankJurisdiction();
  draft.witnesses ??= [blankWitness()];
  draft.documents ??= [];
  draft.sign ??= {
    mode: "digital",
    requestedAt: null,
    notified: {},
    signed: {},
    signedCopy: null,
    paperFallback: null,
    confirmed: {},
    deliveryChannel: DELIVERY_CHANNEL,
    process: {},
    oaths: {},
    paid: false,
    paidAt: null,
    paidAmount: null,
    paymentRef: null,
    caseFileNumber: null,
  };
  draft.dismissed ??= { advocateInfo: false, accusedAddress: false };

  for (const a of draft.accused as (Accused & { type: string })[]) {
    if (a.type === "individual" || a.type === "institution") {
      a.entType ??= "";
    } else {
      a.entType = a.entType || LEGACY_ACCUSED_ENTITY[a.type] || "other";
      a.type = "institution";
    }
    a.reps ??= [blankRepresentative()];
    for (const r of a.reps) {
      r.designation ??= "";
      r.gender ??= "";
      r.differentlyAbled ??= "";
    }
  }
  for (const c of draft.complainants) {
    c.fetched ??= false;
    c.rep.designation ??= "";
    c.gender ??= "";
    c.differentlyAbled ??= "";
    c.rep.gender ??= "";
    c.rep.differentlyAbled ??= "";
    // The oath was a form field once; it is recorded during signing now (`OTH-3`).
    delete (c as Complainant & { oathVideo?: unknown }).oathVideo;
    c.entCinPan ??= "";
    c.entCinPanSkippedAt ??= null;
  }
  // "Why was the cheque issued?" was a prototype-only question that the nature of the
  // debt already answers (LDN-1); it was retired, with any prefill marker it carried.
  for (const n of draft.notices) {
    delete (n as DemandNotice & { whyIssued?: unknown }).whyIssued;
    delete (n.prefilled as Record<string, unknown> | undefined)?.whyIssued;
  }
  // The upfront choice used to be one set of rounds for the whole case; it is now made
  // per accused (§19.3). Nothing is carried across: an old draft's single choice cannot
  // say which accused it was for, and the defaults it falls back to are the court's.
  draft.sign.process ??= {};
  draft.sign.oaths ??= {};
  // Advocates took an oath in an earlier build; only a complainant's slot carries one
  // now (`OTH-3`), so an advocate's leftover recording is dropped.
  for (const id of Object.keys(draft.sign.oaths)) {
    if (id.startsWith("sig-a-")) delete draft.sign.oaths[id];
  }
  draft.sign.paidAmount ??= null;
  draft.affidavit ??= "";
  // Phone confirmation on the upload path is newer than these drafts.
  draft.sign.confirmed ??= {};
  // So is the confirmation that e-signing could not be used. An older paper draft has
  // none, and none is invented for it: the window asks before the upload reopens.
  draft.sign.paperFallback ??= null;
  migrateSignMode(draft);
  migrateAdvocateSignatures(draft);
  draft.version = 7;
  return draft;
}

/**
 * Give the demand notices their own intake groups.
 *
 * Each cheque's group used to carry a demand notice and its proofs, which asked a filer
 * with three cheques and one notice for three notices. The documents table counts them
 * apart (`DCM-1`/`DCM-2` per cheque, `DCM-3`…`DCM-6` per notice), so an older draft's
 * notice slots move to notice group n, keeping their files and reads, and their keys go
 * from `c<n>…` to `n<n>…` — on the list of documents too, which points at them by key.
 */
const OLD_NOTICE_KEY = /^c(\d+)(dn|dp|ad|rp)(-\d+)?$/;

function migrateNoticeIntake(draft: FilingDraft) {
  if (draft.intake.notices) return;
  const rekey = (key: string) => key.replace(OLD_NOTICE_KEY, "n$1$2$3");
  draft.intake.notices = draft.intake.cheques.map((g) => {
    const moved = g.slots.filter((s) => OLD_NOTICE_KEY.test(s.key));
    g.slots = g.slots.filter((s) => !OLD_NOTICE_KEY.test(s.key));
    return {
      n: g.n,
      slots: moved.length
        ? moved.map((s) => ({ ...s, key: rekey(s.key) }))
        : intakeNoticeGroup(g.n).slots,
    };
  });
  // A setup draft holds no cheques, and so no notices; a filing always has one.
  if (draft.intake.notices.length === 0 && draft.intake.cheques.length > 0)
    draft.intake.notices = [intakeNoticeGroup(1)];
  for (const group of draft.documents ?? [])
    for (const doc of group.docs) if (doc.intakeKey) doc.intakeKey = rekey(doc.intakeKey);
}

/**
 * Bring a draft's signing block up to the two-level model.
 *
 * Signing used to be one flat choice — `esign` | `dsc` | `upload` — recorded only once
 * somebody had signed, which left the system with no idea how a complaint was going to
 * be signed until it already had been. It is now a decision about the filing (`digital`
 * or `upload`, presumed digital) plus, per signature, the instrument that made it. An
 * older draft's `esign` and `dsc` were both digital signing; a bare `true` against a
 * signatory says a signature exists without saying what made it, so it keeps the mode's
 * own instrument and no timestamp it cannot vouch for.
 */
function migrateSignMode(draft: FilingDraft) {
  const sign = draft.sign as unknown as {
    mode: string | null;
    requestedAt?: string | null;
    notified?: Record<string, string>;
    signed: Record<string, unknown>;
  };

  const legacy = sign.mode;
  const upload = legacy === "upload";
  sign.mode = upload ? "upload" : "digital";
  sign.notified ??= {};

  const was: SignInstrument = upload ? "paper" : legacy === "dsc" ? "dsc" : "aadhaar";
  for (const [id, value] of Object.entries(sign.signed ?? {})) {
    if (value === true) sign.signed[id] = { at: "", with: was };
    else if (!value) delete sign.signed[id];
  }

  /*
   * A draft that already carries signatures was, by definition, sent for signature —
   * there is no other way those could exist. Nothing is known about when, and inventing
   * a time would put a fact in the record that never happened, so it takes the draft's
   * own last-saved time.
   */
  if (sign.requestedAt === undefined) {
    sign.requestedAt = Object.keys(sign.signed ?? {}).length ? draft.updatedAt : null;
  }
}

/**
 * Give the draft its `adr` block back, whatever shape it arrived in.
 *
 * A draft last written by the settlement lineage carries the same four answers under
 * `settlement`, so they are moved across rather than replaced with the templates — the
 * prayer especially, which the filer may have rewritten line by line. `settlement` is
 * left on the object untouched: this branch does not read it, and deleting it would
 * throw away the offer ladder if the draft goes back to that branch.
 */
function migrateAdr(draft: FilingDraft) {
  if (draft.adr) {
    const a = draft.adr;
    a.adr ??= "yes";
    a.otherDetails ??= "";
    a.interimRelief ??= INTERIM_RELIEF_TEMPLATE;
    a.finalRelief ??= FINAL_RELIEF_TEMPLATE;
    return;
  }

  const settlement = (draft as unknown as { settlement?: SettlementShaped }).settlement;
  draft.adr = settlement
    ? {
        adr: settlement.willing ?? "yes",
        otherDetails: settlement.otherDetails ?? "",
        interimRelief: settlement.interimRelief ?? INTERIM_RELIEF_TEMPLATE,
        finalRelief: settlement.finalRelief ?? FINAL_RELIEF_TEMPLATE,
      }
    : blankAdr();

  /* The step it was last on may be an id this branch's router does not have. */
  if ((draft.lastStep as string) === "settlement") draft.lastStep = "adr-prayer";
}

/**
 * Outside Gujarat an advocate signs in one slot per complainant (`sig-a-<complainant
 * id>`); in Gujarat every advocate signs as themselves (`sig-a-<advocate id>`, owner
 * 2026-10-09). What a slot recorded is copied to each advocate who was on record for
 * that complainant, and the slot keeps it too, so a draft reads right under either rule.
 */
function migrateAdvocateSignatures(draft: FilingDraft) {
  const maps = [draft.sign.signed, draft.sign.oaths, draft.sign.notified] as Record<
    string,
    unknown
  >[];
  draft.complainants.forEach((c, i) => {
    const old = `sig-a-${c.id}`;
    const acting = draft.advocates.filter((a) => a.forComplainants.includes(i));
    for (const map of maps) {
      if (!map || !(old in map)) continue;
      // Kept as well: outside Gujarat advocates still sign in the per-complainant slot.
      for (const a of acting) map[`sig-a-${a.id}`] ??= map[old];
    }
  });
}
