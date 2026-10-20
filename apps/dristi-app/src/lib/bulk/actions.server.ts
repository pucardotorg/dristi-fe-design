/**
 * Everything a filer does to a batch, applied on the server where the batch lives.
 *
 * Each action writes the same draft fields the single filing writes for the same act
 * (`components/filing/sections/sign-section.tsx` for signing and payment), so a case filed
 * from a batch carries the same record as one filed alone (PRD §1).
 */

import { buildDocumentGroups } from "@/lib/filing/blank";
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

import { resolveIfsc, resolvePin } from "./reference";
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
};

export type BatchView = BatchSummary & {
  cases: CaseView[];
  payments: Batch["payments"];
  signings: Batch["signings"];
  advocate: { name: string; barNumber: string } | null;
  representative: { name: string; designation: string; mobile: string } | null;
};

function addMonth(iso: string): string {
  if (!iso) return "";
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() + 1);
  return d.toISOString().slice(0, 10);
}

export function caseView(bc: BatchCase, batch: Batch, all: Batch[]): CaseView {
  const ctx = { batch, others: all.filter((b) => b.id !== batch.id) };
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
  };
}

export function summarise(batch: Batch, all: Batch[]): BatchSummary {
  const counts: Record<CaseStage, number> = { held: 0, ready: 0, signed: 0, filed: 0 };
  let flagged = 0;
  const ctx = { batch, others: all.filter((b) => b.id !== batch.id) };
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
  };
}

export function batchView(batch: Batch, all: Batch[]): BatchView {
  const first = batch.cases[0]?.draft;
  const adv = first?.advocates[0];
  const rep = first?.complainants[0]?.rep;
  return {
    ...summarise(batch, all),
    cases: batch.cases.map((bc) => caseView(bc, batch, all)),
    payments: batch.payments,
    signings: batch.signings,
    advocate: adv ? { name: adv.name, barNumber: adv.barNumber } : null,
    representative: rep?.name ? { name: rep.name, designation: rep.designation, mobile: rep.mobile } : null,
  };
}

/* ───────────────────────────── Fixes ───────────────────────────── */

/** Draft paths a scrutiny fix may write — and nothing else. */
const EDITABLE = [
  /^complainants\.0\.(entType|entName|entCinPan)$/,
  /^complainants\.0\.rep\.(mobile|name|age|designation)$/,
  /^complainants\.0\.(entAddr|res|rep\.addr)\.(line1|city|pin)$/,
  /^accused\.\d+\.(name|entType)$/,
  /^accused\.\d+\.contacts\.0\.(mobile|email)$/,
  /^accused\.\d+\.addresses\.\d+\.addr\.(line1|city|pin)$/,
  /^cheques\.\d+\.(dateOnCheque|amount|chequeNumber|ifsc|presentDate|returnDate|returnReason)$/,
  /^notices\.\d+\.(natureDebt|dispatchDate|modeService|deliveryDate|returnDate|nonDeliveryReason|partAmount)$/,
  /^jurisdiction\.(ifsc|drawerPolice|condonationReason)$/,
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
  setPath(d as unknown as Record<string, unknown>, path, value);

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
export function signable(batch: Batch, all: Batch[]): BatchCase[] {
  const ctx = { batch, others: all.filter((b) => b.id !== batch.id) };
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
  };
  const next = all.map((b) => {
    if (!ids.includes(b.id)) return b;
    return { ...b, cases: b.cases.filter((c) => c.draft.status === "filed"), clubbedInto: result.id, updatedAt: at };
  });
  next.push(result);
  return { all: next, result };
}
