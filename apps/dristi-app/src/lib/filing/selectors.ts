/** Derived reads over the draft — pure functions so screens and the shell agree. */

import { signingRules } from "./config";
import { addDays, addMonths, addressToString, daysBetween, nameList, toLongDate, todayIso } from "./format";
import { KERALA_FEES, type FeeSchedule } from "@/lib/court/fees";
import {
  CHANNEL_FEE,
  defaultProcessRounds,
  DELIVERY_MIN_ROUNDS,
  PROCESS_OPTIONS,
} from "./options";
import { WALK_ORDER } from "./steps";
import type {
  Accused,
  Advocate,
  ChequeDetails,
  Complainant,
  DemandNotice,
  ISODate,
  DocumentGroup,
  FilingDraft,
  Intake,
  IntakeSlot,
  PhoneConfirmer,
  SignInstrument,
  Signatory,
  StepId,
  UserProfile,
  Witness,
} from "./types";

/* ───────────────────────────── Intake ──────────────────────────────── */

export function intakeSlots(intake: Intake): IntakeSlot[] {
  return [
    ...intake.cheques.flatMap((g) => g.slots),
    ...intake.parties.flatMap((g) => g.slots),
    ...intake.supporting,
  ];
}

export function findIntakeSlot(intake: Intake, key: string): IntakeSlot | undefined {
  return intakeSlots(intake).find((s) => s.key === key);
}

/** Required-document progress for the intake step (supporting docs are optional). */
export function intakeProgress(intake: Intake) {
  const required = [
    ...intake.cheques.flatMap((g) => g.slots),
    ...intake.parties.flatMap((g) => g.slots),
  ].filter((s) => s.required);
  const done = required.filter((s) => s.file).length;
  const total = required.length;
  const remaining = total - done;
  const pct = total ? Math.round((done / total) * 100) : 0;
  return { done, total, remaining, pct };
}

/** Files already uploaded at intake — feeds the sidebar count and the documents drawer. */
export function uploadedIntakeSlots(intake: Intake): IntakeSlot[] {
  return intakeSlots(intake).filter((s) => !!s.file);
}

/** How many fields document reading filled from this slot. */
export function extractedFieldCount(slot: IntakeSlot): number {
  return slot.extract ? Object.keys(slot.extract.fields).length : 0;
}

/* ───────────────────────────── Parties ─────────────────────────────── */

export function complainantLabel(c: Complainant, index: number): string {
  return c.name || c.entName || `Complainant ${index + 1}`;
}

/** A company's CIN: listing, industry code, state, year, ownership, registration number. */
const CIN_PATTERN = /^[LU]\d{5}[A-Z]{2}\d{4}[A-Z]{3}\d{6}$/;
/** An income-tax PAN: five letters, four digits, one letter. */
const PAN_PATTERN = /^[A-Z]{5}\d{4}[A-Z]$/;

/** Upper-cased, spaces dropped — how a CIN or PAN is typed is not part of the number. */
export function normaliseCinPan(value: string): string {
  return value.replace(/\s+/g, "").toUpperCase();
}

/** Well-formed as either a CIN or a PAN. Says nothing about whether it is registered. */
export function isCinOrPan(value: string): boolean {
  const v = normaliseCinPan(value);
  return CIN_PATTERN.test(v) || PAN_PATTERN.test(v);
}

/**
 * Indexes of institutional complainants with no usable CIN or PAN — empty, or not in
 * either format — and no declaration skipping it. Individuals are never asked for one.
 */
export function complainantsMissingCinPan(complainants: Complainant[]): number[] {
  return complainants.flatMap((c, i) => (cinPanAnswered(c) ? [] : [i]));
}

/**
 * The CIN or PAN is mandatory for an institution, but skippable by declaration
 * (`LIT-18a`): answered means a valid one, or the declaration on record.
 */
export function cinPanAnswered(c: Complainant): boolean {
  if (c.type !== "institution") return true;
  return isCinOrPan(c.entCinPan ?? "") || !!c.entCinPanSkippedAt;
}

/** Complainant names as the advocate multi-select shows them. */
export function complainantChoices(complainants: Complainant[]): string[] {
  return complainants.map((c, i) => `Complainant ${i + 1}${c.name ? `: ${c.name}` : ""}`);
}

/**
 * A complainant who has said they appear as a party in person conducts the case
 * themselves, so no advocate goes on record for them and none signs in their place.
 */
export function isPartyInPerson(c: Complainant): boolean {
  return c.pip === "yes";
}

/** Complainant indices that an advocate may be put on record for. */
export function representedIndices(complainants: Complainant[]): number[] {
  return complainants.flatMap((c, i) => (isPartyInPerson(c) ? [] : [i]));
}

export function advocateName(a: Advocate): string {
  return a.name.trim();
}

/** An advocate row counts as filled in once it carries a name or a bar number. */
export function advocateNamed(a: Advocate): boolean {
  return !!(a.name.trim() || a.barNumber.trim());
}

/** The advocates put on record for one complainant, by that complainant's index. */
export function advocatesForComplainant(
  advocates: Advocate[],
  index: number
): Advocate[] {
  return advocates.filter((a) => advocateNamed(a) && a.forComplainants.includes(index));
}

export function accusedLabel(a: Accused, index: number): string {
  return a.name.trim() || `Accused ${index + 1}`;
}

export function accusedComplete(a: Accused): boolean {
  return !!a.name.trim() && a.addresses.some((b) => b.addr.line1.trim());
}

export function accusedHasContact(a: Accused): boolean {
  return a.contacts.some((c) => c.mobile.trim() || c.email.trim());
}

export function complainantComplete(c: Complainant): boolean {
  const named = c.type === "institution" ? !!c.entName.trim() : !!c.name.trim();
  const addr = c.type === "institution" ? c.entAddr : c.res;
  return named && !!c.mobile.trim() && !!addr.line1.trim() && cinPanAnswered(c);
}

/* ───────────────────────────── Case details ────────────────────────── */

export function chequeComplete(c: ChequeDetails): boolean {
  return !!(c.dateOnCheque && c.amount && c.chequeNumber);
}

export function chequeFullyComplete(c: ChequeDetails, index: number): boolean {
  const bank = index > 0 && c.sameAsPrev === "yes" ? true : !!(c.ifsc && c.bankName);
  return (
    chequeComplete(c) &&
    bank &&
    !!(c.presentDate && c.returnDate && c.returnReason) &&
    !chequePresentIssue(c) &&
    !chequeReturnIssue(c)
  );
}

/** Months a cheque stays valid for presentation, from the date on it. */
export const CHEQUE_VALIDITY_MONTHS = 3;

/** The last day the cheque could be presented — the day before three months run out. */
export function chequeValidUntil(c: ChequeDetails): ISODate {
  return addDays(addMonths(c.dateOnCheque, CHEQUE_VALIDITY_MONTHS), -1);
}

/**
 * What is wrong with the presentation date, if anything. The first link of the
 * limitation chain: a cheque cannot be presented before the date on it. Presentation
 * after the three-month validity is not an error — see `chequePresentedLate`.
 */
export function chequePresentIssue(c: ChequeDetails): string | undefined {
  if (!c.presentDate || !c.dateOnCheque) return undefined;
  if (c.presentDate < c.dateOnCheque) return "Cannot be before the date on the cheque.";
  return undefined;
}

/**
 * The warning shown under the presentation date when the cheque was presented after its
 * three-month validity ran out (PRD CHQ-11). A warning, never a block: it does not count
 * against completeness, gating or preview.
 */
export function chequePresentedLate(c: ChequeDetails): string | undefined {
  if (!c.presentDate || !c.dateOnCheque || c.presentDate < c.dateOnCheque) return undefined;
  const lastDay = chequeValidUntil(c);
  if (!lastDay || c.presentDate <= lastDay) return undefined;
  return `Presented after the cheque's validity. It was valid for presentation until ${toLongDate(lastDay)}, ${CHEQUE_VALIDITY_MONTHS} months from its date. Check that S-138 still applies before filing.`;
}

/** What is wrong with the return date, if anything: it cannot predate presentation. */
export function chequeReturnIssue(c: ChequeDetails): string | undefined {
  if (!c.returnDate || !c.presentDate || c.returnDate >= c.presentDate) return undefined;
  return "Cannot be before the date of presentation.";
}

export function noticeComplete(n: DemandNotice): boolean {
  return !!(n.natureDebt && n.dispatchDate && n.modeService);
}

export function witnessComplete(w: Witness): boolean {
  return !!(w.fullName.trim() || w.designation.trim());
}

/** Sum of cheque amounts typed so far (digits only), or 0. */
export function totalChequeAmount(cheques: ChequeDetails[]): number {
  return cheques.reduce((sum, c) => sum + (parseInt(c.amount.replace(/[^\d]/g, ""), 10) || 0), 0);
}

/* ───────────────────────────── List of documents ───────────────────── */

export function documentsProgress(groups: DocumentGroup[]) {
  let total = 0;
  let done = 0;
  for (const g of groups) {
    for (const d of g.docs) {
      if (d.required) {
        total += 1;
        if (d.file) done += 1;
      }
    }
  }
  const remaining = total - done;
  return { total, done, remaining, pct: total ? Math.round((done / total) * 100) : 0 };
}

/* ───────────────────────────── Sign ────────────────────────────────── */

function sameMobile(a: string, b: string): boolean {
  const da = a.replace(/\D/g, "").slice(-10);
  const db = b.replace(/\D/g, "").slice(-10);
  return da.length === 10 && da === db;
}

/**
 * Everyone who signs the complaint and takes the oath: each complainant (or the person
 * acting for one), and every advocate on record for them. A complainant appearing as a
 * party in person brings no advocate.
 *
 * "You" is whoever matches the profile — by bar number for advocates, by mobile for
 * complainants — else the first advocate, else the first complainant.
 */
export function signatories(
  draft: FilingDraft,
  profile: UserProfile | null,
  /** Whether signatories take the oath — the deployment's rule unless a test says otherwise. */
  oath: boolean = signingRules().oath,
  /** Whether every advocate signs as themselves, or one per complainant (`config.ts`). */
  everyAdvocate: boolean = signingRules().everyAdvocate
): { complainants: Signatory[]; advocates: Signatory[] } {
  const signedOf = (id: string): Signatory["status"] =>
    draft.sign.signed[id] ? "signed" : "pending";
  const signedWith = (id: string) => draft.sign.signed[id]?.with;

  const complainants: Signatory[] = draft.complainants.map((c, i) => {
    const n = i + 1;
    let name: string;
    let role: string;
    if (c.type === "institution") {
      const rep = c.rep.name.trim();
      name = c.entName.trim() || `Complainant ${n}`;
      role = rep ? `Complainant ${n} · via ${rep}` : `Complainant ${n} · Institution`;
    } else if (c.poa === "yes" && c.poaHolder.name.trim()) {
      name = c.poaHolder.name.trim();
      role = `Complainant ${n} · PoA holder for ${c.name.trim() || `Complainant ${n}`}`;
    } else {
      name = c.name.trim() || `Complainant ${n}`;
      role = `Complainant ${n} · Individual`;
    }
    const you = !!profile?.mobile && sameMobile(profile.mobile, c.mobile);
    return {
      id: `sig-c-${c.id}`,
      name,
      role,
      status: signedOf(`sig-c-${c.id}`),
      signedWith: signedWith(`sig-c-${c.id}`),
      you,
      // Complainants take the oath as advocates do (owner, 2026-10-09).
      oathTaken: oath ? !!draft.sign.oaths?.[`sig-c-${c.id}`] : undefined,
    };
  });

  const myBar = profile?.barNumber.trim().toUpperCase() ?? "";

  /*
   * Where every advocate signs (Gujarat, owner 2026-10-09), each advocate on record is a
   * signatory of their own, with their own link and oath. Elsewhere it is one slot per
   * complainant that any one of their advocates may fill: the row names the slot, and
   * the system does not know which of them will sign.
   */
  const advocates: Signatory[] = everyAdvocate
    ? everyAdvocateRows(draft, myBar, oath, signedOf, signedWith)
    : draft.complainants.flatMap((c, i) => {
        if (isPartyInPerson(c)) return [];
        const acting = advocatesForComplainant(draft.advocates, i);
        if (!acting.length) return [];
        const id = `sig-a-${c.id}`;
        const role =
          acting.length === 1
            ? "Advocate on record"
            : `Any one of ${acting.length} advocates on record`;
        const you = !!myBar && acting.some((a) => a.barNumber.trim().toUpperCase() === myBar);
        return [
          {
            id,
            name: `Advocate for Complainant ${i + 1}`,
            role,
            status: signedOf(id),
            signedWith: signedWith(id),
            you,
            oathTaken: oath ? !!draft.sign.oaths?.[id] : undefined,
          },
        ];
      });

  const anyYou = [...complainants, ...advocates].some((s) => s.you);
  if (!anyYou) {
    if (advocates[0]) advocates[0].you = true;
    else if (complainants[0]) complainants[0].you = true;
  }
  return { complainants, advocates };
}

/** One signatory per advocate on record — the Gujarat rule (`signatories`). */
function everyAdvocateRows(
  draft: FilingDraft,
  myBar: string,
  oath: boolean,
  signedOf: (id: string) => Signatory["status"],
  signedWith: (id: string) => SignInstrument | undefined
): Signatory[] {
  const represented = draft.complainants
    .map((c, i) => ({ c, i }))
    .filter(({ c }) => !isPartyInPerson(c));
  return draft.advocates.flatMap((a, n) => {
    if (!advocateNamed(a)) return [];
    const forWhom = represented.filter(({ i }) => a.forComplainants.includes(i));
    if (!forWhom.length) return [];
    const id = `sig-a-${a.id}`;
    const names = forWhom.map(({ c, i }) => complainantLabel(c, i));
    return [
      {
        id,
        name: a.name.trim() || `Advocate ${n + 1}`,
        role: `Advocate for ${nameList(names)}`,
        status: signedOf(id),
        signedWith: signedWith(id),
        you: !!myBar && a.barNumber.trim().toUpperCase() === myBar,
        oathTaken: oath ? !!draft.sign.oaths?.[id] : undefined,
      },
    ];
  });
}

/**
 * The person who reads the oath for a signatory slot, by name — it is in the words they
 * read. A complainant reads it themselves, or through their PoA holder or the
 * representative who answers for an institution; each advocate reads it in their own.
 */
export function oathTakerName(draft: FilingDraft, signatoryId: string, fallback = ""): string {
  const ref = signatoryId.replace(/^sig-[ca]-/, "");
  if (signatoryId.startsWith("sig-a-")) {
    const own = draft.advocates.find((a) => a.id === ref);
    if (own) return own.name.trim() || fallback;
    // A per-complainant slot: read by its one advocate, else by whoever is signed in.
    const i = draft.complainants.findIndex((c) => c.id === ref);
    const acting = i < 0 ? [] : advocatesForComplainant(draft.advocates, i);
    return acting.length === 1 ? acting[0].name.trim() || fallback : fallback;
  }
  const c = draft.complainants.find((x) => x.id === ref);
  if (!c) return fallback;
  if (c.type === "institution") return c.rep.name.trim() || c.entName.trim() || fallback;
  if (c.poa === "yes" && c.poaHolder.name.trim()) return c.poaHolder.name.trim();
  return c.name.trim() || fallback;
}

/**
 * Something is still owed by this signatory: their signature, or — an advocate — the
 * oath that follows it.
 */
export function isOutstanding(s: Signatory): boolean {
  return s.status === "pending" || s.oathTaken === false;
}

/**
 * Every signature and every advocate's oath is in — the gate to the court fee. One
 * reading, shared by the Sign step, the dashboard queues and batch payment, so none of
 * them can open the fee earlier than the others.
 */
export function signingComplete(
  draft: FilingDraft,
  profile: UserProfile | null,
  oath: boolean = signingRules().oath,
  everyAdvocate: boolean = signingRules().everyAdvocate
): boolean {
  const { complainants, advocates } = signatories(draft, profile, oath, everyAdvocate);
  const everyone = [...complainants, ...advocates];
  return everyone.length > 0 && !everyone.some(isOutstanding);
}

/**
 * Everyone who confirms by phone that they signed an uploaded copy.
 *
 * Deliberately not `signatories()`, which folds the advocate slots in and carries signing
 * status. This one is the phone list: one row per person who must sign and has a number
 * of their own.
 *
 * Only people who have to sign are listed. Where a PoA holder has been appointed, the
 * holder signs for the complainant and verifies for them, and the complainant does not
 * appear at all (owner, 2026-08-19).
 *
 * Each row names the person who receives the code: the complainant, their PoA holder, or
 * the authorised representative who answers for an institution.
 */
export function phoneConfirmers(draft: FilingDraft): PhoneConfirmer[] {
  const rows: PhoneConfirmer[] = [];
  draft.complainants.forEach((c, i) => {
    const n = i + 1;
    const who = c.type === "institution" ? c.entName.trim() : c.name.trim();
    const label = who || `Complainant ${n}`;

    if (c.poa === "yes") {
      // The holder signs in the complainant's place, so the complainant is not asked.
      rows.push({
        id: `poa-${c.id}`,
        name: c.poaHolder.name.trim() || `PoA holder for ${label}`,
        role: `PoA holder for ${label}`,
        mobile: c.poaHolder.mobile.trim(),
      });
    } else if (c.type === "institution") {
      // An entity cannot hold a phone; the person who answers for it does.
      rows.push({
        id: `sig-c-${c.id}`,
        name: c.rep.name.trim() || "Authorised representative",
        role: `Complainant ${n} · for ${label}`,
        mobile: c.rep.mobile.trim() || c.entPhone.trim(),
      });
    } else {
      rows.push({
        id: `sig-c-${c.id}`,
        name: label,
        role: `Complainant ${n} · Individual`,
        mobile: c.mobile.trim(),
      });
    }
  });
  return rows;
}

/* ───────────────────────────── Whole-draft reads ───────────────────── */

/** "Prateek vs Rajesh" style title from what has been typed so far. */
export function draftTitle(draft: FilingDraft): string {
  const c = draft.complainants[0];
  const a = draft.accused[0];
  const cName = c ? (c.type === "institution" ? c.entName : c.name).trim() : "";
  const aName = a?.name.trim() ?? "";
  if (cName && aName) return `${cName} vs ${aName}`;
  if (cName) return `${cName} vs …`;
  if (aName) return `… vs ${aName}`;
  return "Untitled filing";
}

/** Whether a section has everything it needs — drives the sidebar progress. */
export function sectionComplete(draft: FilingDraft, step: StepId): boolean {
  switch (step) {
    case "upload":
      return intakeProgress(draft.intake).remaining === 0;
    case "complainant":
      return draft.complainants.length > 0 && draft.complainants.every(complainantComplete);
    case "advocate":
      return (
        draft.complainants.every((c) => c.pip === "yes") ||
        draft.advocates.some((a) => a.barNumber.trim() && a.name.trim())
      );
    case "accused":
      return draft.accused.length > 0 && draft.accused.every(accusedComplete);
    case "cheque":
      return draft.cheques.length > 0 && draft.cheques.every(chequeFullyComplete);
    case "demand-notice":
      return (
        draft.notices.length > 0 &&
        draft.notices.every(
          (n, i) =>
            noticeComplete(n) && !noticeDispatchIssue(draft, i) && !noticeServiceIssue(n)
        )
      );
    case "jurisdiction": {
      const lim = limitationView(draft);
      return (
        !!lim.causeDate &&
        !lim.causeIssue &&
        !lim.filingIssue &&
        (lim.withinLimit || !!draft.jurisdiction.condonationReason.trim()) &&
        (draft.jurisdiction.deposited === "no" || !!draft.jurisdiction.payeeBankName.trim())
      );
    }
    case "adr-prayer":
      return !!draft.adr.finalRelief.trim();
    case "witnesses":
      return true; // optional
    case "documents":
      return documentsProgress(draft.documents).remaining === 0;
    case "preview":
      return WALK_ORDER.filter((s) => s !== "preview" && s !== "sign").every((s) =>
        sectionComplete(draft, s)
      );
    case "sign":
      return draft.status === "filed";
    default:
      return false;
  }
}

/**
 * Whether the person has opened this section (`FilingDraft.visited`). A draft saved
 * before that was recorded is read as walked in order up to where it was left.
 */
export function sectionOpened(draft: FilingDraft, step: StepId): boolean {
  if (draft.visited) return draft.visited.includes(step);
  const reached = WALK_ORDER.indexOf(draft.lastStep);
  return WALK_ORDER.indexOf(step) <= reached;
}

/**
 * Where a section stands in the rail: `done` once it is complete and has been opened,
 * `started` once opened but not complete, and `untouched` before anyone opens it — a
 * section that happens to be complete by default (the pre-written prayer, the optional
 * witnesses) is not done until the person has seen it.
 */
export type SectionState = "done" | "started" | "untouched";

export function sectionState(draft: FilingDraft, step: StepId): SectionState {
  if (step === "sign" && draft.status === "filed") return "done";
  if (!sectionOpened(draft, step)) return "untouched";
  return sectionComplete(draft, step) ? "done" : "started";
}

/**
 * The sections progress is counted over: the ones that ask the person for something.
 * Left out are the intake upload (a shortcut the person may skip — the Documents section
 * holds the same requirements), witnesses (optional), the affidavit (composed for them),
 * and the preview (a reading of everything else, so counting it would count twice).
 */
export const PROGRESS_STEPS: StepId[] = [
  "complainant",
  "advocate",
  "accused",
  "cheque",
  "demand-notice",
  "jurisdiction",
  "adr-prayer",
  "documents",
  "sign",
];

/** 0–100: share of the sections that ask for input which are done. */
export function draftProgress(draft: FilingDraft): number {
  if (draft.status === "filed") return 100;
  const done = PROGRESS_STEPS.filter((s) => sectionState(draft, s) === "done").length;
  return Math.round((done / PROGRESS_STEPS.length) * 100);
}

/* ───────────────────────────── Source documents ────────────────────── */

/** The intake upload behind cheque `index` (0-based) of the given kind, if any. */
export function chequeSourceSlot(
  draft: FilingDraft,
  index: number,
  docType: "cheque-front" | "return-memo" | "demand-notice" | "dispatch-proof" | "delivery-proof" | "notice-reply"
): IntakeSlot | undefined {
  return draft.intake.cheques[index]?.slots.find((s) => s.docType === docType);
}

/** The intake upload behind complainant `index` (0-based) of the given kind, if any. */
export function partySourceSlot(
  draft: FilingDraft,
  index: number,
  docType: "id-proof" | "poa" | "vakalatnama"
): IntakeSlot | undefined {
  return draft.intake.parties[index]?.slots.find((s) => s.docType === docType);
}

/**
 * Which field the source panel should land on for a document: the first one, in the
 * screen's own order, that reading actually found a value for.
 *
 * Landing on a fixed field instead means the panel can open on something nothing was read
 * for — an empty "value used in this field" box beside a document with no region marked,
 * which reads as a broken panel rather than as "we didn't find this one".
 */
export function firstReadField<T extends string>(
  slot: IntakeSlot | undefined,
  order: readonly T[],
  fallback: T
): T {
  const fields = slot?.extract?.fields;
  if (!fields) return fallback;
  return order.find((key) => fields[key]?.value) ?? fallback;
}

/* ───────────────────────────── Court fees ──────────────────────────── */

export type BilledLine = {
  key: string;
  label: string;
  /** Per-unit rate, as the schedule states it. */
  rate: number;
  /** How many units — rounds, and addresses again for the per-address lines. */
  units: number;
  /** How that unit count is arrived at, e.g. "3 addresses × 2 rounds". */
  unitNote: string;
  amount: number;
  /** What the charge is for, shown under the line on the bill. Absent when unsourced. */
  note?: string;
};

export type FeeBill = {
  /** Filing fees — what it costs to put the complaint before the court. */
  court: BilledLine[];
  /** The nominal court fee on each process the filer is prepaying. */
  process: BilledLine[];
  /** What the delivery channel charges to carry the summons — not a court fee. */
  delivery: BilledLine[];
  courtTotal: number;
  processTotal: number;
  deliveryTotal: number;
  /** Addresses summons is served at, across every accused. */
  addresses: number;
  /** `true` when the filing is past the limitation period and the extra fee applies. */
  delayed: boolean;
  /** Court fees + process fees + delivery. Nothing here is deferrable. */
  total: number;
};

/**
 * Is this filing past the limitation period, so a condonation application applies?
 * Read from the same dates the form shows — derived ones included — so the fee and the
 * warning can never disagree.
 */
export function isDelayed(draft: FilingDraft): boolean {
  const { elapsed } = limitationView(draft);
  return elapsed !== null && elapsed > LIMITATION_DAYS;
}

/** One address of one accused, as the choosing screen and the bill both need it. */
export type PlanAddress = { index: number; label: string; text: string };

/**
 * What one accused is having served, resolved — defaults applied, choices clamped.
 */
export type AccusedPlan = {
  accusedId: string;
  /** "Suresh Menon", or "Accused 2" until they are named. */
  label: string;
  /** Every address on record for this accused; summons can go to any of them. */
  addresses: PlanAddress[];
  /** The addresses summons is actually served at — never empty when any exist. */
  selected: number[];
  /** Rounds prepaid, by `PROCESS_OPTIONS` key. */
  rounds: Record<string, number>;
  /** Rounds of e-post prepaid: 1 … `rounds.summons` (`PAY-15`). */
  delivery: number;
};

/**
 * The upfront plan for every accused — the one place defaults, floors and ceilings are
 * applied, so the screen that offers the choice and the bill that prices it cannot
 * disagree.
 *
 * Three rules live here and nowhere else:
 *  - the mandatory summons round is **per accused** (`PAY-10`), so an accused can never
 *    resolve to zero rounds however the stored record drifted;
 *  - the notice default follows the Delay Condonation section as it stands *now*
 *    (`PAY-11`) — it is not frozen at draft creation;
 *  - e-post cannot exceed the summons rounds it delivers, nor fall below the mandatory
 *    first round (`PAY-15`).
 */
export function processPlan(draft: FilingDraft): AccusedPlan[] {
  const delayed = isDelayed(draft);
  const defaults = defaultProcessRounds(delayed);

  return draft.accused.map((accused, ai) => {
    const stored = draft.sign.process?.[accused.id] ?? {};

    const addresses: PlanAddress[] = accused.addresses.flatMap((block, index) => {
      const text = addressToString(block.addr);
      return text.trim() ? [{ index, label: `Address ${index + 1}`, text }] : [];
    });

    // Nothing chosen yet means every address on record, which is what the court
    // assumes; a stored choice that no longer matches the addresses is filtered, and an
    // empty result falls back rather than pricing a summons that goes nowhere.
    const onRecord = addresses.map((a) => a.index);
    const kept = (stored.addresses ?? onRecord).filter((i) => onRecord.includes(i));
    const selected = kept.length ? kept : onRecord;

    const rounds: Record<string, number> = {};
    for (const option of PROCESS_OPTIONS) {
      const raw = stored.rounds?.[option.key];
      const n = Number.isFinite(raw) ? Math.trunc(raw as number) : defaults[option.key];
      rounds[option.key] = Math.min(option.maxRounds, Math.max(option.minRounds, n ?? 0));
    }

    const deliveryRaw = Number.isFinite(stored.delivery)
      ? Math.trunc(stored.delivery as number)
      : rounds.summons;
    const delivery = Math.min(
      rounds.summons,
      Math.max(DELIVERY_MIN_ROUNDS, deliveryRaw)
    );

    return {
      accusedId: accused.id,
      label: accusedLabel(accused, ai),
      addresses,
      selected,
      rounds,
      delivery,
    };
  });
}

/** How a line's unit count is arrived at — the multiplication, said in words, and said
 * even when a factor is 1. "₹100 × 1 address × 1 round" is longer than "₹100" and it is
 * the only version that tells you what would happen if you added an address (`PAY-13`).
 */
function unitNote(rounds: number, addresses: number | null): string {
  const parts: string[] = [];
  if (addresses !== null) {
    parts.push(addresses === 1 ? "1 address" : `${addresses} addresses`);
  }
  parts.push(rounds === 1 ? "1 round" : `${rounds} rounds`);
  return parts.join(" × ");
}

/**
 * What this filing owes, derived — never stored.
 *
 * Three groups, because the money has three sources and the filer is answerable for
 * them differently: the filing fees that decide whether the complaint is registered at
 * all, the nominal court fee on each process round prepaid, and e-post — which is the
 * post office's charge, not the court's, and the large one.
 *
 * Process and delivery are priced per accused (§19.3): each accused's own rounds, over
 * each accused's own selected addresses. Lines name the accused only when there is more
 * than one, so the ordinary single-accused bill does not repeat a name on every row.
 */
export function feeBill(
  draft: FilingDraft,
  schedule: FeeSchedule = KERALA_FEES
): FeeBill {
  const delayed = isDelayed(draft);
  const advocates = draft.advocates.filter(advocateNamed).length;
  // One affidavit goes with every complaint (`draft.affidavit`).
  const affidavits = 1;

  const court: BilledLine[] = [];
  for (const l of schedule.court) {
    if (l.needsAdvocate && advocates === 0) continue;
    const units =
      l.per === "advocate" ? advocates : l.per === "affidavit" ? affidavits : 1;
    if (units < 1) continue;
    court.push({
      key: l.key,
      label: l.label,
      rate: l.amount,
      units,
      // Kerala's lines are charged once for the filing, so there is no multiplication to
      // explain; other schedules price some lines per advocate or per affidavit.
      unitNote:
        l.per === "advocate"
          ? units === 1
            ? "1 advocate"
            : `${units} advocates`
          : l.per === "affidavit"
            ? units === 1
              ? "1 affidavit"
              : `${units} affidavits`
            : "",
      amount: l.amount * units,
      note: l.note,
    });
  }
  if (delayed) {
    const fee = schedule.condonation;
    court.push({
      key: fee.key,
      label: fee.label,
      rate: fee.amount,
      units: 1,
      unitNote: "",
      amount: fee.amount,
      note: fee.note,
    });
  }

  const plans = processPlan(draft);
  const named = plans.length > 1;
  const process: BilledLine[] = [];
  const delivery: BilledLine[] = [];

  for (const plan of plans) {
    const addresses = Math.max(1, plan.selected.length);
    const who = named ? `${plan.label} · ` : "";

    for (const option of PROCESS_OPTIONS) {
      const n = plan.rounds[option.key] ?? 0;
      if (n < 1) continue;
      const units = option.perAddress ? n * addresses : n;
      const fee = schedule.process?.fee ?? option.fee;
      const name = schedule.process?.name;
      process.push({
        key: `${plan.accusedId}:${option.key}`,
        label: `${who}${option.label}${name ? ` (${name})` : ""}`,
        rate: fee,
        units,
        unitNote: unitNote(n, option.perAddress ? addresses : null),
        amount: fee * units,
        note: option.billNote,
      });
    }

    if (plan.delivery > 0) {
      const units = plan.delivery * addresses;
      delivery.push({
        key: `${plan.accusedId}:channel`,
        label: `${who}${CHANNEL_FEE.label}`,
        rate: CHANNEL_FEE.amount,
        units,
        unitNote: unitNote(plan.delivery, addresses),
        amount: CHANNEL_FEE.amount * units,
        // No note: CHANNEL_FEE's says the rate is a placeholder, which is ours to know,
        // not the filer's. The per-address, per-round count is on the line itself.
      });
    }
  }

  const sum = (rows: BilledLine[]) => rows.reduce((t, r) => t + r.amount, 0);
  const courtTotal = sum(court);
  const processTotal = sum(process);
  const deliveryTotal = sum(delivery);
  return {
    court,
    process,
    delivery,
    courtTotal,
    processTotal,
    deliveryTotal,
    addresses: plans.reduce((n, p) => n + Math.max(1, p.selected.length), 0),
    delayed,
    total: courtTotal + processTotal + deliveryTotal,
  };
}

/* ───────────────────────────── Limitation ──────────────────────────── */

/** Days the drawer has to pay after the demand notice reaches them. */
export const PAYMENT_WINDOW_DAYS = 15;
/** Days from the cause of action within which the complaint must be filed. */
export const LIMITATION_DAYS = 30;
/** Days from the cheque's return within which the demand notice must be sent. */
export const NOTICE_WINDOW_DAYS = 30;

/**
 * What is wrong with notice `index`'s dispatch date, if anything (`LDN-2`): the notice
 * could have been sent for any of the cheques, so at least one must have come back on or
 * before it.
 */
export function noticeDispatchIssue(draft: FilingDraft, index: number): string | undefined {
  const dispatch = draft.notices[index]?.dispatchDate;
  const returns = draft.cheques.map((c) => c.returnDate).filter(Boolean).sort();
  if (!dispatch || returns.length === 0 || returns[0] <= dispatch) return undefined;
  return returns.length === 1
    ? `Cannot be before the cheque was returned on ${toLongDate(returns[0])}.`
    : `Cannot be before every cheque was returned. The first came back on ${toLongDate(returns[0])}.`;
}

/**
 * Whether notice `index` went out more than 30 days after the return of every cheque that
 * came back before it (`LDN-2`). A warning, never a block: it does not hold the section
 * back from completing.
 */
export function noticeDispatchLate(draft: FilingDraft, index: number): boolean {
  const dispatch = draft.notices[index]?.dispatchDate;
  if (!dispatch) return false;
  const before = draft.cheques.map((c) => c.returnDate).filter((r) => r && r <= dispatch);
  if (before.length === 0) return false;
  const latest = before.sort().at(-1)!;
  const gap = daysBetween(latest, dispatch);
  return gap !== null && gap > NOTICE_WINDOW_DAYS;
}

/** What is wrong with a notice's delivery or return date, if anything. */
export function noticeServiceIssue(n: DemandNotice): string | undefined {
  const served = noticeServiceDate(n);
  if (!served || !n.dispatchDate || served >= n.dispatchDate) return undefined;
  return `Cannot be before the notice was dispatched on ${toLongDate(n.dispatchDate)}.`;
}

/**
 * The date the notice started the clock — when it reached the accused, or when it came
 * back unserved. Service is deemed complete on a notice returned unclaimed, so a return
 * date counts exactly as a delivery date does.
 */
export function noticeServiceDate(n: DemandNotice): ISODate {
  return n.delivered === "no" ? n.returnDate : n.deliveryDate;
}

/**
 * When the cause of action arose on one notice: fifteen days after it was served.
 *
 * The drawer has that window to pay; the offence is complete when it closes without
 * payment. Empty until the notice records a service date, because a limitation date
 * guessed from nothing is worse than no date at all.
 */
export function noticeCauseDate(n: DemandNotice): ISODate {
  return addDays(noticeServiceDate(n), PAYMENT_WINDOW_DAYS);
}

/**
 * The cause of action for the whole filing — the **earliest** across the notices.
 *
 * With more than one notice there is more than one cause of action, and the complaint has
 * to be in time for the first of them; running the clock from a later one would show the
 * filing as comfortably in time while the earliest cheque was already barred.
 */
export function derivedCauseDate(draft: FilingDraft): ISODate {
  const dates = draft.notices.map(noticeCauseDate).filter(Boolean).sort();
  return dates[0] ?? "";
}

/** What the form shows and the sheet prints: the filer's own date, else the derived one. */
export function causeOfActionDate(draft: FilingDraft): ISODate {
  return draft.jurisdiction.causeDate || derivedCauseDate(draft);
}

/**
 * The filing date. Until the complaint is actually filed this is today — a draft left for
 * a month really is a month later, and freezing the date would hide a growing delay.
 */
export function complaintFilingDate(draft: FilingDraft): ISODate {
  if (draft.jurisdiction.filingDate) return draft.jurisdiction.filingDate;
  return draft.filedAt ? draft.filedAt.slice(0, 10) : todayIso();
}

export type LimitationView = {
  causeDate: ISODate;
  filingDate: ISODate;
  /** Whole days between the two, or null while either is unknown. */
  elapsed: number | null;
  withinLimit: boolean;
  /** Days past the one-month limit; 0 when in time. */
  overBy: number;
  /** True when the dates came from the notices rather than being typed. */
  causeDerived: boolean;
  /** The date the notices give — what a typed date is checked against. */
  derivedCause: ISODate;
  /** A typed cause date earlier than the payment window allows. */
  causeIssue?: string;
  /** A filing date before the cause of action — a complaint cannot be filed yet. */
  filingIssue?: string;
};

export function limitationView(draft: FilingDraft): LimitationView {
  const causeDate = causeOfActionDate(draft);
  const filingDate = complaintFilingDate(draft);
  const derivedCause = derivedCauseDate(draft);
  // The cause of action cannot arise before the drawer's 15 days to pay have run out.
  const causeIssue =
    draft.jurisdiction.causeDate && derivedCause && draft.jurisdiction.causeDate < derivedCause
      ? `Cannot be before ${toLongDate(derivedCause)}, ${PAYMENT_WINDOW_DAYS} days after the demand notice was served.`
      : undefined;
  const filingIssue =
    causeDate && filingDate && filingDate < causeDate
      ? `The complaint can only be filed once the cause of action arises, on ${toLongDate(causeDate)}.`
      : undefined;
  // With either date wrong there is no delay to count; the error says what is wrong.
  const elapsed = filingIssue || causeIssue ? null : daysBetween(causeDate, filingDate);
  return {
    causeDate,
    filingDate,
    elapsed,
    withinLimit: elapsed !== null && elapsed <= LIMITATION_DAYS,
    overBy: elapsed === null ? 0 : Math.max(0, elapsed - LIMITATION_DAYS),
    causeDerived: !draft.jurisdiction.causeDate && !!causeDate,
    derivedCause,
    causeIssue,
    filingIssue,
  };
}
