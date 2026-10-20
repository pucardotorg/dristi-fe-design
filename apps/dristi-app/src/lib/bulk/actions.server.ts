/**
 * Everything a filer does to a batch, applied on the server where the batch lives.
 *
 * Each action writes the same draft fields the single filing writes for the same act
 * (`components/filing/sections/sign-section.tsx` for signing and payment), so a case filed
 * from a batch carries the same record as one filed alone (PRD §1).
 */

import {
  blankAccused,
  blankAddressBlock,
  blankCheque,
  blankNotice,
  blankRepresentative,
  blankWitness,
  buildDocumentGroups,
  intakeChequeGroup,
} from "@/lib/filing/blank";
import { newCaseFileNumber, newId, newPaymentRef } from "@/lib/filing/data";
import { DELIVERY_CHANNEL } from "@/lib/filing/options";
import {
  causeOfActionDate,
  draftTitle,
  feeBill,
  limitationView,
  signatories,
  totalChequeAmount,
} from "@/lib/filing/selectors";
import { GUJARAT_FEES } from "@/lib/court/fees";
import type { FilingDraft, StoredFileRef } from "@/lib/filing/types";

import type { AiMode } from "./ai-review";
import { caseFacts, caseFields, type CaseFact, type FieldGroup } from "./case-fields";
import { resolveBar, resolveIfsc, resolvePin } from "./reference";
import { caseFlags, caseStage, openFlags, type Flag } from "./scrutiny";
import {
  AADHAAR_DOCS_PER_OTP,
  SIGN_INSTRUMENT,
  type Batch,
  type BatchCase,
  type BulkSignMethod,
  type CaseStage,
} from "./types";

/** The deployment the bulk demo files in. */
export const FEES = GUJARAT_FEES;

/* ───────────────────────────── Views ───────────────────────────── */

export type CaseView = {
  id: string;
  reference: string;
  title: string;
  accused: string;
  /** The first cheque's number, to tell cases apart at a glance. */
  cheque: string;
  amount: number;
  causeDate: string;
  /** Last day within the one-month limit, from the cause of action. */
  fileBy: string;
  elapsed: number | null;
  docs: { have: number; need: number };
  stage: CaseStage;
  flags: Flag[];
  /** Soft flags the filer skipped. */
  skipped: Flag[];
  fee: number;
  signedWith: BulkSignMethod | null;
  receiptNumber: string | null;
  paymentRef: string | null;
  caseFileNumber: string | null;
  filedAt: string | null;
  documents: { group: string; name: string; required: boolean; file: StoredFileRef | null; slotKey: string | null }[];
  /** Every detail that can be changed on Case details, grouped as the single filing groups them. */
  fields: FieldGroup[];
  /** What the case's papers should show, for matching them on Documents. */
  facts: CaseFact[];
};

export type BatchSummary = {
  id: string;
  number: string;
  source: Batch["source"];
  client: string;
  createdAt: string;
  clubbedInto: string | null;
  clubbedIntoNumber: string | null;
  clubbedFrom: string[];
  total: number;
  counts: Record<CaseStage, number>;
  flagged: number;
  /** `null` while an API push is still unopened. */
  openedAt: string | null;
  /** Who the batch was sent to: the first advocate on its cases. */
  filingAdvocate: { name: string; barNumber: string } | null;
};

export type BatchView = BatchSummary & {
  /** Whether the AI review ran on these flags. */
  ai: AiMode;
  cases: CaseView[];
  payments: Batch["payments"];
  signings: Batch["signings"];
  /** Everyone on record for the complainant; the first is the filing advocate. */
  advocates: { name: string; barNumber: string }[];
  representative: { name: string; designation: string; mobile: string } | null;
};

function addMonth(iso: string): string {
  if (!iso) return "";
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() + 1);
  return d.toISOString().slice(0, 10);
}

export function caseView(bc: BatchCase, batch: Batch, all: Batch[], ai: AiMode = "off"): CaseView {
  const ctx = { batch, others: all.filter((b) => b.id !== batch.id), ai };
  const flags = openFlags(bc, ctx);
  const every = caseFlags(bc, ctx);
  const d = bc.draft;
  const docs = d.documents.flatMap((g) => g.docs.map((doc) => ({ g, doc })));
  const required = docs.filter(({ doc }) => doc.required);
  const lim = limitationView(d);
  const cause = causeOfActionDate(d);
  return {
    id: bc.id,
    reference: bc.reference,
    title: draftTitle(d),
    accused: d.accused.map((a) => a.name).filter(Boolean).join(", "),
    cheque: d.cheques[0]?.chequeNumber ?? "",
    amount: totalChequeAmount(d.cheques),
    causeDate: cause,
    fileBy: addMonth(cause),
    elapsed: lim.elapsed,
    docs: { have: required.filter(({ doc }) => doc.file).length, need: required.length },
    stage: caseStage(bc, flags),
    flags,
    skipped: every.filter((f) => f.level === "soft" && bc.skipped.includes(f.id)),
    fee: d.sign.paidAmount ?? feeBill(d, FEES).total,
    signedWith: bc.signedWith,
    receiptNumber: bc.receiptNumber,
    paymentRef: d.sign.paymentRef,
    caseFileNumber: d.sign.caseFileNumber,
    filedAt: d.filedAt,
    documents: docs.map(({ g, doc }) => ({
      group: g.title,
      name: doc.name,
      required: doc.required,
      file: doc.file,
      slotKey: doc.intakeKey ?? null,
    })),
    fields: caseFields(d, bc.unknownService),
    facts: caseFacts(d),
  };
}

function filingAdvocate(batch: Batch): BatchSummary["filingAdvocate"] {
  const a = batch.cases[0]?.draft.advocates[0];
  return a ? { name: a.name, barNumber: a.barNumber } : null;
}

export function summarise(batch: Batch, all: Batch[], ai: AiMode = "off"): BatchSummary {
  const counts: Record<CaseStage, number> = { held: 0, ready: 0, signed: 0, filed: 0 };
  let flagged = 0;
  const ctx = { batch, others: all.filter((b) => b.id !== batch.id), ai };
  for (const bc of batch.cases) {
    const flags = openFlags(bc, ctx);
    counts[caseStage(bc, flags)] += 1;
    if (flags.length && bc.draft.status !== "filed" && !bc.signedWith) flagged += 1;
  }
  const into = batch.clubbedInto ? all.find((b) => b.id === batch.clubbedInto) : null;
  return {
    id: batch.id,
    number: batch.number,
    source: batch.source,
    client: batch.client,
    createdAt: batch.createdAt,
    clubbedInto: batch.clubbedInto,
    clubbedIntoNumber: into?.number ?? null,
    clubbedFrom: batch.clubbedFrom,
    total: batch.cases.length,
    counts,
    flagged,
    openedAt: batch.openedAt === undefined ? batch.createdAt : batch.openedAt,
    filingAdvocate: filingAdvocate(batch),
  };
}

export function batchView(batch: Batch, all: Batch[], ai: AiMode = "off"): BatchView {
  const first = batch.cases[0]?.draft;
  const rep = first?.complainants[0]?.rep;
  return {
    ...summarise(batch, all, ai),
    ai,
    cases: batch.cases.map((bc) => caseView(bc, batch, all, ai)),
    payments: batch.payments,
    signings: batch.signings,
    advocates: (first?.advocates ?? []).map((a) => ({ name: a.name, barNumber: a.barNumber })),
    representative: rep?.name ? { name: rep.name, designation: rep.designation, mobile: rep.mobile } : null,
  };
}

/* ───────────────────────────── Fixes ───────────────────────────── */

/** Draft paths a scrutiny fix may write — and nothing else. */
const EDITABLE = [
  /^complainants\.\d+\.(entType|entName|entCinPan|name|mobile|age)$/,
  /^advocates\.\d+\.barNumber$/,
  /^witnesses\.\d+\.(fullName|designation)$/,
  /^witnesses\.\d+\.contacts\.0\.(mobile|email)$/,
  /^witnesses\.\d+\.addresses\.0\.addr\.(line1|city|pin)$/,
  /^accused\.\d+\.reps\.0\.(name|designation)$/,
  /^notices\.\d+\.(delivered|paymentStatus)$/,
  /^complainants\.\d+\.rep\.(mobile|name|age|designation)$/,
  /^complainants\.\d+\.(entAddr|res|rep\.addr)\.(line1|city|pin)$/,
  /^accused\.\d+\.(name|entType)$/,
  /^accused\.\d+\.contacts\.0\.(mobile|email)$/,
  /^accused\.\d+\.addresses\.\d+\.addr\.(line1|city|pin)$/,
  /^cheques\.\d+\.(dateOnCheque|amount|chequeNumber|ifsc|presentDate|returnDate|returnReason)$/,
  /^notices\.\d+\.(natureDebt|dispatchDate|modeService|deliveryDate|returnDate|nonDeliveryReason|partAmount)$/,
  /^jurisdiction\.(ifsc|payeePolice|drawerPolice|condonationReason)$/,
  /^notices\.\d+\.(tracking|replied)$/,
];

export function editable(path: string): boolean {
  return EDITABLE.some((re) => re.test(path));
}

function setPath(target: Record<string, unknown>, path: string, value: string) {
  const keys = path.split(".");
  let node: Record<string, unknown> = target;
  for (const k of keys.slice(0, -1)) {
    const next = node[k];
    if (next === null || typeof next !== "object") throw new Error(`No such field: ${path}`);
    node = next as Record<string, unknown>;
  }
  node[keys.at(-1)!] = value;
}

/** Write one value to a draft, then redo the lookups that hang off it. */
export async function applyFix(d: FilingDraft, path: string, raw: string): Promise<void> {
  let value = raw.trim();
  if (/\.(ifsc|entCinPan)$/.test(path)) value = value.toUpperCase();
  if (/\.(mobile)$/.test(path)) value = value.replace(/\D/g, "").replace(/^(91|0)(?=\d{10}$)/, "");
  if (/\.(pin|amount|partAmount|age|chequeNumber)$/.test(path)) value = value.replace(/[^\d]/g, "");
  if (/\.email$/.test(path)) value = value.toLowerCase();
  // A person responsible that does not exist yet is created by naming them.
  const rep = /^accused\.(\d+)\.reps\.0\./.exec(path);
  if (rep && d.accused[Number(rep[1])] && !d.accused[Number(rep[1])].reps.length) {
    d.accused[Number(rep[1])].reps.push(blankRepresentative());
  }
  setPath(d as unknown as Record<string, unknown>, path, value);

  const adv = /^advocates\.(\d+)\.barNumber$/.exec(path);
  if (adv) {
    const a = d.advocates[Number(adv[1])];
    a.barNumber = value.toUpperCase();
    a.name = resolveBar(a.barNumber) ?? "";
  }

  const cheque = /^cheques\.(\d+)\.ifsc$/.exec(path);
  if (cheque) {
    const q = d.cheques[Number(cheque[1])];
    const bank = await resolveIfsc(q.ifsc);
    q.bankName = bank?.bank ?? "";
    q.bankBranch = bank?.branch ?? "";
    q.ifscFetched = !!bank;
  }
  if (path === "jurisdiction.ifsc") {
    const bank = await resolveIfsc(d.jurisdiction.ifsc);
    d.jurisdiction.payeeBankName = bank?.bank ?? "";
    d.jurisdiction.payeeBankBranch = bank?.branch ?? "";
    d.jurisdiction.payeeFetched = !!bank;
  }
  const pin = /^(.*)\.pin$/.exec(path);
  if (pin) {
    const addrPath = pin[1].split(".");
    let node: Record<string, unknown> = d as unknown as Record<string, unknown>;
    for (const k of addrPath) node = node[k] as Record<string, unknown>;
    const place = await resolvePin(String(node.pin));
    node.district = place?.district ?? "";
    node.state = place?.state ?? "";
  }
  d.updatedAt = new Date().toISOString();
}

/* ───────────────────────────── Documents ───────────────────────────── */

export function attachToSlot(bc: BatchCase, slotKey: string, ref: StoredFileRef): boolean {
  const d = bc.draft;
  const slot = [...d.intake.cheques, ...d.intake.parties]
    .flatMap((g) => g.slots)
    .concat(d.intake.supporting)
    .find((s) => s.key === slotKey);
  if (!slot) return false;
  slot.file = ref;
  slot.poor = false;
  d.documents = buildDocumentGroups(d);
  d.updatedAt = new Date().toISOString();
  return true;
}

/* ───────────────────────────── Sign and pay ───────────────────────────── */

/** Cases that may be signed now: nothing holds them and no soft flag is left open. */
export function signable(batch: Batch, all: Batch[], ai: AiMode = "off"): BatchCase[] {
  const ctx = { batch, others: all.filter((b) => b.id !== batch.id), ai };
  return batch.cases.filter(
    (bc) => bc.draft.status !== "filed" && !bc.signedWith && openFlags(bc, ctx).length === 0
  );
}

/** How many OTP rounds a method needs for `n` cases. */
export function roundsFor(method: BulkSignMethod, n: number): number {
  return method === "aadhaar" ? Math.ceil(n / AADHAAR_DOCS_PER_OTP) : 1;
}

/**
 * Record every required signature on each case — complainant (through the authorised
 * representative) and advocate (`SIG-03`) — in one mode for all parties (`SIG-04`).
 * The oath Gujarat asks for at signing is not taken in bulk; whether it can be is open.
 */
export function signCases(cases: BatchCase[], method: BulkSignMethod, at: string): void {
  for (const bc of cases) {
    const d = bc.draft;
    const { complainants, advocates } = signatories(d, null, false, true);
    d.sign.mode = method === "upload" ? "upload" : "digital";
    d.sign.requestedAt = d.sign.requestedAt ?? at;
    for (const s of [...complainants, ...advocates]) {
      d.sign.signed[s.id] = { at, with: SIGN_INSTRUMENT[method] };
    }
    d.lastStep = "pay-fees";
    d.visited = [...new Set([...(d.visited ?? []), "sign" as const])];
    d.updatedAt = at;
    bc.signedWith = method;
  }
}

/**
 * One gateway transaction for the selected cases (PRD §4.2): the reference is recorded on
 * every case and each gets its own receipt, as an individually filed case would. Payment
 * completes filing, exactly as in the single flow.
 */
export function payCases(batch: Batch, cases: BatchCase[], at: string): { ref: string; amount: number } {
  const ref = newPaymentRef();
  let amount = 0;
  const serialBase = batch.payments.reduce((n, p) => n + p.caseIds.length, 0);
  cases.forEach((bc, i) => {
    const d = bc.draft;
    const bill = feeBill(d, FEES);
    amount += bill.total;
    d.sign.paid = true;
    d.sign.paidAt = at;
    d.sign.paidAmount = bill.total;
    d.sign.paymentRef = ref;
    d.sign.caseFileNumber = newCaseFileNumber().replace(/-(\d{6})-/, (_, s) => `-${String((Number(s) + i) % 1_000_000).padStart(6, "0")}-`);
    d.sign.deliveryChannel = DELIVERY_CHANNEL;
    d.status = "filed";
    d.filedAt = at;
    d.updatedAt = at;
    bc.receiptNumber = `${batch.number.replace("BLK", "RCPT")}-${String(serialBase + i + 1).padStart(3, "0")}`;
  });
  batch.payments.push({ ref, at, amount, caseIds: cases.map((c) => c.id) });
  return { ref, amount };
}

/* ───────────────────────────── Club ───────────────────────────── */

/**
 * Club open batches into a new one. Only batches for the same complainant may be clubbed
 * (whether a batch can mix complainants is PRD §8 Q10, open). Filed cases stay where they
 * are, with their receipts; the open cases move.
 */
export function clubBatches(all: Batch[], ids: string[], at: string): { all: Batch[]; result: Batch } | { error: string } {
  const picked = all.filter((b) => ids.includes(b.id));
  if (picked.length < 2) return { error: "Choose at least two batches." };
  if (picked.some((b) => b.clubbedInto)) return { error: "A batch that was already clubbed is closed." };
  if (new Set(picked.map((b) => b.client)).size > 1) return { error: "Only batches for the same complainant can be clubbed." };
  const moving = picked.flatMap((b) => b.cases.filter((c) => c.draft.status !== "filed"));
  if (moving.length === 0) return { error: "Every case in these batches is already filed." };

  const result: Batch = {
    id: newId("batch"),
    number: "",
    source: { kind: "clubbed", system: "Clubbed", reference: picked.map((b) => b.number).join(", ") },
    client: picked[0].client,
    createdAt: at,
    updatedAt: at,
    cases: moving,
    payments: [],
    signings: [],
    clubbedInto: null,
    clubbedFrom: picked.map((b) => b.number),
    openedAt: at,
  };
  const next = all.map((b) => {
    if (!ids.includes(b.id)) return b;
    return { ...b, cases: b.cases.filter((c) => c.draft.status === "filed"), clubbedInto: result.id, updatedAt: at };
  });
  next.push(result);
  return { all: next, result };
}

/* ───────────────────────────── Parts of a case ───────────────────────────── */

export type Part = "accused" | "address" | "cheque" | "notice" | "witness";

/**
 * Add or remove a part of a case, as the single filing's Add and remove do. A cheque
 * comes with its document slots, as at intake. Only the last of a kind is removed, so
 * the numbering and each cheque's documents stay in step; a case keeps at least one
 * accused (with one address), cheque and notice.
 */
export function changePart(d: FilingDraft, op: "add" | "remove", part: Part, accused = 0): string | null {
  const keep: Record<Part, number> = { accused: 1, address: 1, cheque: 1, notice: 1, witness: 0 };
  const list =
    part === "accused"
      ? d.accused
      : part === "address"
        ? d.accused[accused]?.addresses
        : part === "cheque"
          ? d.cheques
          : part === "notice"
            ? d.notices
            : d.witnesses;
  if (!list) return "No such accused.";
  if (op === "remove") {
    if (list.length <= keep[part]) return `A case needs at least ${keep[part]} ${part}.`;
    list.pop();
    if (part === "cheque") d.intake.cheques.pop();
    d.documents = buildDocumentGroups(d);
    return null;
  }
  if (part === "accused") d.accused.push(blankAccused());
  else if (part === "address") d.accused[accused].addresses.push(blankAddressBlock());
  else if (part === "cheque") {
    d.cheques.push(blankCheque());
    d.intake.cheques.push(intakeChequeGroup(d.cheques.length));
  } else if (part === "notice") d.notices.push(blankNotice());
  else d.witnesses.push(blankWitness());
  // The documents follow the parts: a new cheque brings its cheque, memo and notice papers.
  d.documents = buildDocumentGroups(d);
  return null;
}
