/**
 * Bulk scrutiny: the filer-side checks a batch runs before anything is signed or paid.
 *
 * Every check is a stated rule over the draft, named by the handover's field ID. Nothing
 * reads, scores or summarises with a model (owner, 2026-10-20). Two outcomes:
 *
 * - **hold** — a requirement is not met. The case stays in draft, out of signing and
 *   payment, until it is fixed. The rest of the batch carries on (PRD constraint 4).
 * - **soft** — the value is there but something about it deserves a look (PRD Appendix C,
 *   "warnings, not errors"). The filer may skip it and the case goes ahead.
 *
 * The rules lean on the single filing's own selectors wherever one exists, and finish with
 * `sectionComplete` for every section: a case can only clear scrutiny here if the single
 * filing would also call it complete (PRD constraint 2, one set of validation rules).
 */

import {
  ACCUSED_ENTITY_TYPES,
  ENTITY_TYPES,
  MODE_OF_SERVICE,
  NATURE_OF_DEBT,
  NON_DELIVERY_REASONS,
  PAYMENT_STATUS,
  RETURN_REASONS,
  S138_SAFE_REASONS,
} from "@/lib/filing/options";
import {
  chequePresentedLate,
  chequePresentIssue,
  chequeReturnIssue,
  isCinOrPan,
  limitationView,
  noticeDispatchIssue,
  noticeDispatchLate,
  noticeServiceIssue,
  sameMobile,
  sectionComplete,
  totalChequeAmount,
} from "@/lib/filing/selectors";
import { toLongDate } from "@/lib/filing/format";
import type { Address, FilingDraft, StepId } from "@/lib/filing/types";

import { OFFICE_ADVOCATES } from "./clients";
import { codeForSlot, DOC_CODE_LABEL } from "./contract";
import { COURT_DISTRICT, IFSC_PATTERN } from "./reference";
import type { Batch, BatchCase, CaseStage } from "./types";

export type FlagLevel = "hold" | "soft";

/** How a flag can be fixed in place on the scrutiny screen. */
export type FlagFix =
  | { kind: "text"; path: string; label: string; value: string; multiline?: boolean; inputMode?: "numeric" | "tel" | "email" }
  | { kind: "date"; path: string; label: string; value: string }
  | { kind: "select"; path: string; label: string; value: string; options: { value: string; label: string }[] }
  | { kind: "declare-no-contact"; accusedId: string }
  /** A missing document: an upload slot for it, right on the flag. */
  | { kind: "upload"; slotKey: string; label: string }
  | { kind: "documents" };

export type Flag = {
  /** Stable across runs, so a skip survives a re-check: `<rule>:<where>`. */
  id: string;
  /** The rule, shared by every case it fires on — the bulk view groups by it. */
  rule: string;
  level: FlagLevel;
  /** Handover field ID, or the document code. */
  field: string;
  section: StepId;
  /** Who or what it is about: "Accused 1", "Cheque 2", "Complainant". */
  where: string;
  message: string;
  /** Batch-level: the same value for every case, so fixing it fixes it everywhere. */
  batchWide?: boolean;
  fix?: FlagFix;
};

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const MOBILE = /^[6-9]\d{9}$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const NAME = /^[A-Za-z][A-Za-z .'-]*$/;

const listed = (options: { value: string }[], v: string) => options.some((o) => o.value === v);
const labelOf = (options: { value: string; label: string }[], v: string) =>
  options.find((o) => o.value === v)?.label ?? v;

type Push = (f: Omit<Flag, "id"> & { at: string }) => void;

function addressFlags(
  push: Push,
  a: Address,
  base: { rule: string; field: string; section: StepId; where: string; batchWide?: boolean },
  path: string
) {
  if (!a.line1.trim())
    push({ ...base, rule: `${base.rule}-line`, level: "hold", at: `${path}.line1`, message: "Address line is missing.", fix: { kind: "text", path: `${path}.line1`, label: "Address", value: "" } });
  if (!a.city.trim())
    push({ ...base, rule: `${base.rule}-city`, level: "hold", at: `${path}.city`, message: "City is missing.", fix: { kind: "text", path: `${path}.city`, label: "City", value: "" } });
  if (!/^\d{6}$/.test(a.pin))
    push({ ...base, rule: `${base.rule}-pin`, level: "hold", at: `${path}.pin`, message: a.pin ? `Pincode "${a.pin}" is not 6 digits.` : "Pincode is missing.", fix: { kind: "text", path: `${path}.pin`, label: "Pincode", value: a.pin, inputMode: "numeric" } });
  else if (!a.district)
    push({ ...base, rule: `${base.rule}-pin-unknown`, level: "hold", at: `${path}.pin`, message: `Pincode ${a.pin} was not found.`, fix: { kind: "text", path: `${path}.pin`, label: "Pincode", value: a.pin, inputMode: "numeric" } });
}

function dateFlag(push: Push, value: string, base: { rule: string; field: string; section: StepId; where: string }, path: string, label: string) {
  if (!value) {
    push({ ...base, level: "hold", at: path, message: `${label} is missing.`, fix: { kind: "date", path, label, value: "" } });
    return false;
  }
  if (!ISO.test(value) || Number.isNaN(Date.parse(value))) {
    push({ ...base, level: "hold", at: path, message: `${label} "${value}" is not a date.`, fix: { kind: "date", path, label, value: "" } });
    return false;
  }
  return true;
}

export type ScrutinyContext = {
  batch: Batch;
  /** Every other batch, open or closed, for duplicate checks. */
  others: Batch[];
};

/** All flags on one case, skipped soft flags included (see `openFlags`). */
export function caseFlags(bc: BatchCase, ctx: ScrutinyContext): Flag[] {
  const d: FilingDraft = bc.draft;
  const out: Flag[] = [];
  const push: Push = ({ at, ...f }) => out.push({ ...f, id: `${f.rule}:${at}` });

  /* ── Complainant (LIT) — sent once, the same on every case ── */
  const c = d.complainants[0];
  const lit = { section: "complainant" as StepId, where: "Complainant", batchWide: true };
  if (c.type === "institution") {
    if (!listed(ENTITY_TYPES, c.entType))
      push({ ...lit, rule: "lit-17", field: "LIT-17", level: "hold", at: "c.entType", message: c.entType ? `Type of institution "${c.entType}" is not in the list.` : "Type of institution is missing.", fix: { kind: "select", path: "complainants.0.entType", label: "Type of institution", value: "", options: ENTITY_TYPES } });
    if (!c.entName.trim())
      push({ ...lit, rule: "lit-18", field: "LIT-18", level: "hold", at: "c.entName", message: "Institution name is missing.", fix: { kind: "text", path: "complainants.0.entName", label: "Institution name", value: "" } });
    if (!isCinOrPan(c.entCinPan))
      push({ ...lit, rule: "lit-18a", field: "LIT-18a", level: "hold", at: "c.entCinPan", message: c.entCinPan ? `"${c.entCinPan}" is not a CIN or PAN.` : "CIN or PAN is missing.", fix: { kind: "text", path: "complainants.0.entCinPan", label: "CIN or PAN", value: c.entCinPan } });
    addressFlags(push, c.entAddr, { rule: "lit-21", field: "LIT-21", ...lit }, "complainants.0.entAddr");
    const r = c.rep;
    if (!MOBILE.test(r.mobile))
      push({ ...lit, rule: "lit-22", field: "LIT-22", level: "hold", at: "c.rep.mobile", message: r.mobile ? `Representative's mobile "${r.mobile}" is not a 10-digit mobile number.` : "Representative's mobile is missing.", fix: { kind: "text", path: "complainants.0.rep.mobile", label: "Representative's mobile", value: r.mobile, inputMode: "tel" } });
    if (!r.name.trim())
      push({ ...lit, rule: "lit-23", field: "LIT-23", level: "hold", at: "c.rep.name", message: "Representative's name is missing.", fix: { kind: "text", path: "complainants.0.rep.name", label: "Representative's name", value: "" } });
    if (!/^\d+$/.test(r.age) || Number(r.age) < 18)
      push({ ...lit, rule: "lit-24", field: "LIT-24", level: "hold", at: "c.rep.age", message: r.age ? `Representative's age "${r.age}" is not valid.` : "Representative's age is missing.", fix: { kind: "text", path: "complainants.0.rep.age", label: "Representative's age", value: r.age, inputMode: "numeric" } });
    if (!r.designation.trim())
      push({ ...lit, rule: "lit-25a", field: "LIT-25a", level: "hold", at: "c.rep.designation", message: "Representative's designation is missing.", fix: { kind: "text", path: "complainants.0.rep.designation", label: "Designation", value: "" } });
    addressFlags(push, r.addr, { rule: "lit-26", field: "LIT-26", ...lit }, "complainants.0.rep.addr");
  } else {
    if (!c.name.trim())
      push({ ...lit, rule: "lit-4", field: "LIT-4", level: "hold", at: "c.name", message: "Complainant's name is missing.", fix: { kind: "text", path: "complainants.0.name", label: "Complainant's name", value: "" } });
    if (!MOBILE.test(c.mobile))
      push({ ...lit, rule: "lit-3", field: "LIT-3", level: "hold", at: "c.mobile", message: "Complainant's mobile is missing or not valid.", fix: { kind: "text", path: "complainants.0.mobile", label: "Complainant's mobile", value: c.mobile, inputMode: "tel" } });
    addressFlags(push, c.res, { rule: "lit-7", field: "LIT-7", ...lit }, "complainants.0.res");
  }

  /* ── Advocate (ADV) ── */
  d.advocates.forEach((a, i) => {
    if (!a.name.trim())
      push({ rule: "adv-3", field: "ADV-3", section: "advocate", where: `Advocate ${i + 1}`, batchWide: true, level: "hold", at: `adv.${i}`, message: a.barNumber ? `Bar registration ${a.barNumber} was not found with the Bar Council.` : "Bar registration number is missing.", fix: { kind: "select", path: `advocates.${i}.barNumber`, label: "Advocate", value: "", options: OFFICE_ADVOCATES.map((b) => ({ value: b.barNumber, label: `${b.name}, ${b.barNumber}` })) } });
  });
  if (d.advocates.length === 0)
    push({ rule: "adv-1", field: "ADV-1", section: "advocate", where: "Advocate", batchWide: true, level: "hold", at: "adv", message: "No advocate is on record for the complainant." });

  /* ── Accused (ACC) ── */
  const complainantMobiles = [c.mobile, c.rep.mobile].filter(Boolean);
  d.accused.forEach((a, i) => {
    const where = `Accused ${i + 1}`;
    const acc = { section: "accused" as StepId, where };
    const p = `accused.${i}`;
    if (!a.name.trim())
      push({ ...acc, rule: "acc-2", field: a.type === "institution" ? "ACC-5" : "ACC-2", level: "hold", at: `${p}.name`, message: "Name is missing.", fix: { kind: "text", path: `${p}.name`, label: "Name", value: "" } });
    else if (a.type === "individual" && !NAME.test(a.name.trim()))
      push({ ...acc, rule: "acc-2-alpha", field: "ACC-2", level: "hold", at: `${p}.name`, message: `Name "${a.name}" has characters other than letters.`, fix: { kind: "text", path: `${p}.name`, label: "Name", value: a.name } });
    if (a.type === "institution" && !listed(ACCUSED_ENTITY_TYPES, a.entType))
      push({ ...acc, rule: "acc-4", field: "ACC-4", level: "hold", at: `${p}.entType`, message: a.entType ? `Type of institution "${a.entType}" is not in the list.` : "Type of institution is missing.", fix: { kind: "select", path: `${p}.entType`, label: "Type of institution", value: "", options: ACCUSED_ENTITY_TYPES } });

    const contact = a.contacts[0] ?? { mobile: "", email: "" };
    const declared = bc.noContactDeclared.includes(a.id);
    if (!contact.mobile && !contact.email && !declared)
      push({ ...acc, rule: "acc-6", field: "ACC-6", level: "hold", at: `${p}.contact`, message: "Neither mobile nor email is on record. Add one, or declare that neither is known.", fix: { kind: "declare-no-contact", accusedId: a.id } });
    if (contact.mobile && !MOBILE.test(contact.mobile))
      push({ ...acc, rule: "acc-6-format", field: "ACC-6", level: "hold", at: `${p}.mobile`, message: `Mobile "${contact.mobile}" is not a 10-digit mobile number.`, fix: { kind: "text", path: `${p}.contacts.0.mobile`, label: "Mobile", value: contact.mobile, inputMode: "tel" } });
    if (contact.mobile && complainantMobiles.some((m) => sameMobile(m, contact.mobile)))
      push({ ...acc, rule: "lit-3-unique", field: "LIT-3", level: "hold", at: `${p}.mobile-dup`, message: "Mobile is the same as the complainant's. Each party needs their own number.", fix: { kind: "text", path: `${p}.contacts.0.mobile`, label: "Mobile", value: contact.mobile, inputMode: "tel" } });
    if (contact.email && !EMAIL.test(contact.email))
      push({ ...acc, rule: "acc-7", field: "ACC-7", level: "hold", at: `${p}.email`, message: `Email "${contact.email}" is not valid.`, fix: { kind: "text", path: `${p}.contacts.0.email`, label: "Email", value: contact.email, inputMode: "email" } });

    a.addresses.forEach((b, k) =>
      addressFlags(push, b.addr, { rule: "acc-8", field: "ACC-8", ...acc, where: a.addresses.length > 1 ? `${where}, address ${k + 1}` : where }, `${p}.addresses.${k}.addr`)
    );
    if (a.addresses.every((b) => b.addr.district && b.addr.district !== COURT_DISTRICT))
      push({ ...acc, rule: "acc-24", field: "ACC-24", level: "soft", at: `${p}.district`, message: `No address is in ${COURT_DISTRICT} district. The magistrate decides jurisdiction.` });

    if (a.type === "institution") {
      if (!a.reps.some((r) => r.name.trim()))
        push({ ...acc, rule: "acc-14", field: "ACC-14", level: "hold", at: `${p}.reps`, message: "No person responsible (S-141) is named for the institution.", fix: { kind: "text", path: `${p}.reps.0.name`, label: "Person responsible, full name", value: "" } });
    }
  });
  if (d.accused.length === 0)
    push({ rule: "acc-1", field: "ACC-1", section: "accused", where: "Accused", level: "hold", at: "accused", message: "The case has no accused." });

  /* ── Cheques (CHQ) ── */
  d.cheques.forEach((q, i) => {
    const where = d.cheques.length > 1 ? `Cheque ${i + 1}` : "Cheque";
    const chq = { section: "cheque" as StepId, where };
    const p = `cheques.${i}`;
    const dated = dateFlag(push, q.dateOnCheque, { ...chq, rule: "chq-1", field: "CHQ-1" }, `${p}.dateOnCheque`, "Date on cheque");
    if (!(Number(q.amount) > 0))
      push({ ...chq, rule: "chq-2", field: "CHQ-2", level: "hold", at: `${p}.amount`, message: "Amount is missing.", fix: { kind: "text", path: `${p}.amount`, label: "Amount (₹)", value: q.amount, inputMode: "numeric" } });
    if (!/^\d{6}$/.test(q.chequeNumber) || q.chequeNumber === "000000")
      push({ ...chq, rule: "chq-3", field: "CHQ-3", level: "hold", at: `${p}.chequeNumber`, message: "Cheque number must be 6 digits.", fix: { kind: "text", path: `${p}.chequeNumber`, label: "Cheque number", value: q.chequeNumber, inputMode: "numeric" } });
    if (!IFSC_PATTERN.test(q.ifsc))
      push({ ...chq, rule: "chq-5", field: "CHQ-5", level: "hold", at: `${p}.ifsc`, message: q.ifsc ? `IFSC "${q.ifsc}" is not a valid IFSC.` : "IFSC is missing.", fix: { kind: "text", path: `${p}.ifsc`, label: "Drawer bank IFSC", value: q.ifsc } });
    else if (!q.bankName)
      push({ ...chq, rule: "chq-5-unknown", field: "CHQ-5", level: "hold", at: `${p}.ifsc`, message: `IFSC ${q.ifsc} was not found.`, fix: { kind: "text", path: `${p}.ifsc`, label: "Drawer bank IFSC", value: q.ifsc } });
    const presented = dateFlag(push, q.presentDate, { ...chq, rule: "chq-8", field: "CHQ-8" }, `${p}.presentDate`, "Presentation date");
    const returned = dateFlag(push, q.returnDate, { ...chq, rule: "chq-9", field: "CHQ-9" }, `${p}.returnDate`, "Return date");
    if (dated && presented) {
      const issue = chequePresentIssue(q);
      if (issue) push({ ...chq, rule: "chq-8-order", field: "CHQ-8", level: "hold", at: `${p}.presentDate-order`, message: `Presentation date: ${issue}`, fix: { kind: "date", path: `${p}.presentDate`, label: "Presentation date", value: q.presentDate } });
      const late = chequePresentedLate(q);
      if (late) push({ ...chq, rule: "chq-11", field: "CHQ-11", level: "soft", at: `${p}.late`, message: late });
    }
    if (presented && returned) {
      const issue = chequeReturnIssue(q);
      if (issue) push({ ...chq, rule: "chq-9-order", field: "CHQ-9", level: "hold", at: `${p}.returnDate-order`, message: `Return date: ${issue}`, fix: { kind: "date", path: `${p}.returnDate`, label: "Return date", value: q.returnDate } });
    }
    if (!q.returnReason)
      push({ ...chq, rule: "chq-10", field: "CHQ-10", level: "hold", at: `${p}.returnReason`, message: "Return reason is missing.", fix: { kind: "select", path: `${p}.returnReason`, label: "Return reason", value: "", options: RETURN_REASONS } });
    else if (!listed(RETURN_REASONS, q.returnReason))
      push({ ...chq, rule: "chq-10-list", field: "CHQ-10", level: "hold", at: `${p}.returnReason`, message: `Return reason "${q.returnReason}" is not in the list.`, fix: { kind: "select", path: `${p}.returnReason`, label: "Return reason", value: "", options: RETURN_REASONS } });
    else if (!S138_SAFE_REASONS.has(q.returnReason))
      push({ ...chq, rule: "chq-10-warn", field: "CHQ-10", level: "soft", at: `${p}.returnReason-warn`, message: `Returned for "${labelOf(RETURN_REASONS, q.returnReason)}", not insufficient funds. Check that S-138 applies.` });

    // The same cheque in another case — here or in another batch — is filed once.
    if (q.chequeNumber && q.ifsc) {
      const key = `${q.ifsc}|${q.chequeNumber}`;
      const clash = [ctx.batch, ...ctx.others]
        .filter((b) => !b.clubbedInto)
        .flatMap((b) => b.cases.map((x) => ({ b, x })))
        .find(({ b, x }) => x.id !== bc.id && x.draft.cheques.some((o) => `${o.ifsc}|${o.chequeNumber}` === key) && (b.id !== ctx.batch.id || ctx.batch.cases.indexOf(x) < ctx.batch.cases.indexOf(bc)));
      if (clash)
        push({ ...chq, rule: "chq-dup", field: "CHQ-3", level: "hold", at: `${p}.dup`, message: `Cheque ${q.chequeNumber} is already in case ${clash.x.reference}${clash.b.id === ctx.batch.id ? "" : ` (${clash.b.number})`}.` });
    }
  });
  if (d.cheques.length === 0)
    push({ rule: "chq-0", field: "CHQ-1", section: "cheque", where: "Cheque", level: "hold", at: "cheques", message: "The case has no cheque." });

  /* ── Demand notices (LDN) ── */
  d.notices.forEach((n, i) => {
    const where = d.notices.length > 1 ? `Notice ${i + 1}` : "Demand notice";
    const ldn = { section: "demand-notice" as StepId, where };
    const p = `notices.${i}`;
    if (!listed(NATURE_OF_DEBT, n.natureDebt))
      push({ ...ldn, rule: "ldn-1", field: "LDN-1", level: "hold", at: `${p}.natureDebt`, message: n.natureDebt ? `Nature of debt "${n.natureDebt}" is not in the list.` : "Nature of debt is missing.", fix: { kind: "select", path: `${p}.natureDebt`, label: "Nature of debt", value: "", options: NATURE_OF_DEBT } });
    const sent = dateFlag(push, n.dispatchDate, { ...ldn, rule: "ldn-2", field: "LDN-2" }, `${p}.dispatchDate`, "Dispatch date");
    if (sent) {
      const issue = noticeDispatchIssue(d, i);
      if (issue) push({ ...ldn, rule: "ldn-2-order", field: "LDN-2", level: "hold", at: `${p}.dispatch-order`, message: `Dispatch date: ${issue}`, fix: { kind: "date", path: `${p}.dispatchDate`, label: "Dispatch date", value: n.dispatchDate } });
      else if (noticeDispatchLate(d, i))
        push({ ...ldn, rule: "ldn-2-late", field: "LDN-2", level: "soft", at: `${p}.dispatch-late`, message: "Sent more than 30 days after the cheque was returned. S-138(b) gives 30 days." });
    }
    if (!listed(MODE_OF_SERVICE, n.modeService))
      push({ ...ldn, rule: "ldn-3", field: "LDN-3", level: "hold", at: `${p}.modeService`, message: n.modeService ? `Mode of service "${n.modeService}" is not in the list.` : "Mode of service is missing.", fix: { kind: "select", path: `${p}.modeService`, label: "Mode of service", value: "", options: MODE_OF_SERVICE } });

    if (bc.unknownService.includes(i)) {
      push({ ...ldn, rule: "ldn-5", field: "LDN-5", level: "hold", at: `${p}.delivered`, message: "Delivery status is not known yet. The cause of action runs from service, so the case cannot be filed until it is.", fix: { kind: "select", path: `${p}.delivered`, label: "Was the notice delivered?", value: "", options: [{ value: "yes", label: "Yes, delivered" }, { value: "no", label: "No, returned undelivered" }] } });
    } else if (n.delivered === "yes") {
      if (dateFlag(push, n.deliveryDate, { ...ldn, rule: "ldn-6", field: "LDN-6" }, `${p}.deliveryDate`, "Delivery date")) {
        const issue = noticeServiceIssue(n);
        if (issue) push({ ...ldn, rule: "ldn-6-order", field: "LDN-6", level: "hold", at: `${p}.delivery-order`, message: `Delivery date: ${issue}`, fix: { kind: "date", path: `${p}.deliveryDate`, label: "Delivery date", value: n.deliveryDate } });
      }
    } else {
      if (dateFlag(push, n.returnDate, { ...ldn, rule: "ldn-7", field: "LDN-7" }, `${p}.returnDate`, "Notice return date")) {
        const issue = noticeServiceIssue(n);
        if (issue) push({ ...ldn, rule: "ldn-7-order", field: "LDN-7", level: "hold", at: `${p}.return-order`, message: `Return date: ${issue}`, fix: { kind: "date", path: `${p}.returnDate`, label: "Notice return date", value: n.returnDate } });
      }
      if (!listed(NON_DELIVERY_REASONS, n.nonDeliveryReason))
        push({ ...ldn, rule: "ldn-8", field: "LDN-8", level: "hold", at: `${p}.nonDeliveryReason`, message: n.nonDeliveryReason ? `Reason for non-delivery "${n.nonDeliveryReason}" is not in the list.` : "Reason for non-delivery is missing.", fix: { kind: "select", path: `${p}.nonDeliveryReason`, label: "Reason for non-delivery", value: "", options: NON_DELIVERY_REASONS } });
    }
    if (n.paymentStatus === "part") {
      const paid = Number(n.partAmount);
      if (!(paid > 0))
        push({ ...ldn, rule: "ldn-11", field: "LDN-11", level: "hold", at: `${p}.partAmount`, message: "Part payment is recorded without an amount.", fix: { kind: "text", path: `${p}.partAmount`, label: "Amount paid (₹)", value: n.partAmount, inputMode: "numeric" } });
      else if (paid >= totalChequeAmount(d.cheques))
        push({ ...ldn, rule: "ldn-11-full", field: "LDN-11", level: "soft", at: `${p}.partAmount-full`, message: `₹${paid.toLocaleString("en-IN")} paid after notice covers the cheque amount. Check the debt is still due.` });
    } else if (n.paymentStatus !== "none") {
      push({ ...ldn, rule: "ldn-10", field: "LDN-10", level: "hold", at: `${p}.paymentStatus`, message: "Payment after notice is not stated.", fix: { kind: "select", path: `${p}.paymentStatus`, label: "Payment after notice", value: "", options: PAYMENT_STATUS } });
    }
  });
  if (d.notices.length === 0)
    push({ rule: "ldn-0", field: "LDN-2", section: "demand-notice", where: "Demand notice", level: "hold", at: "notices", message: "The case has no demand notice." });

  /* ── Jurisdiction and limitation (JUR) ── */
  const jur = { section: "jurisdiction" as StepId, where: "Jurisdiction" };
  if (d.jurisdiction.deposited === "yes" && !d.jurisdiction.payeeBankName)
    push({ ...jur, rule: "jur-2", field: "JUR-2", level: "hold", at: "jur.ifsc", message: d.jurisdiction.ifsc ? `Complainant branch IFSC ${d.jurisdiction.ifsc} was not found.` : "Complainant branch IFSC is missing.", fix: { kind: "text", path: "jurisdiction.ifsc", label: "Complainant branch IFSC", value: d.jurisdiction.ifsc } });
  if (d.jurisdiction.deposited === "no" && !d.jurisdiction.drawerPolice.trim())
    push({ ...jur, rule: "jur-6a", field: "JUR-6a", level: "hold", at: "jur.drawerPolice", message: "Police station of the drawer's bank branch is missing.", fix: { kind: "text", path: "jurisdiction.drawerPolice", label: "Police station", value: "" } });

  const lim = limitationView(d);
  if (lim.filingIssue && lim.causeDate)
    push({ ...jur, rule: "jur-9-early", field: "JUR-9", level: "hold", at: "jur.cause", message: `The cause of action arises on ${toLongDate(lim.causeDate)}, 15 days after the notice was served. The complaint can be filed from that day.` });
  else if (lim.elapsed !== null && !lim.withinLimit && !d.jurisdiction.condonationReason.trim())
    push({ ...jur, rule: "jur-12", field: "JUR-12", level: "hold", at: "jur.condonation", message: `Filed ${lim.overBy} day${lim.overBy === 1 ? "" : "s"} after the one-month limit. A reason for condonation of delay is needed.`, fix: { kind: "text", path: "jurisdiction.condonationReason", label: "Reason for condonation of delay", value: "", multiline: true } });

  /* ── Documents (DCM) ── */
  for (const g of d.documents) {
    for (const doc of g.docs) {
      if (!doc.required || doc.file) continue;
      const code = doc.intakeKey ? codeForSlot(doc.intakeKey) : null;
      push({
        rule: `dcm-${code?.code ?? doc.name}`,
        field: code?.code ?? "DCM",
        section: "documents",
        where: "Documents",
        level: "hold",
        at: `doc.${doc.intakeKey ?? doc.id}`,
        message: `${code ? DOC_CODE_LABEL[code.code] : doc.name}${code && d.cheques.length > 1 && code.index ? ` ${code.index}` : ""} is missing.${bc.fetchFailed.length ? " It was sent but could not be fetched." : ""}`,
        fix: doc.intakeKey ? { kind: "upload", slotKey: doc.intakeKey, label: doc.name } : { kind: "documents" },
      });
    }
  }

  /*
   * ── Parity with the single filing: a case clears only if every section would ──
   * Only where no rule above has held the case: a hold elsewhere usually explains it (a
   * notice in transit leaves the limitation section without a cause of action).
   */
  const held = out.some((f) => f.level === "hold");
  for (const step of ["complainant", "advocate", "accused", "cheque", "demand-notice", "jurisdiction", "adr-prayer", "documents"] as StepId[]) {
    if (!held && !sectionComplete(d, step))
      push({ rule: `section-${step}`, field: step, section: step, where: "Case", level: "hold", at: `section.${step}`, message: "This section is not complete by the filing rules." });
  }

  /* ── The same reference in another batch: probably sent twice ── */
  const twin = ctx.others.find((b) => !b.clubbedInto && b.cases.some((x) => x.reference === bc.reference));
  if (twin)
    push({ rule: "ref-dup", field: "Reference", section: "preview", where: "Case", level: "soft", at: "ref", message: `Reference ${bc.reference} is also in ${twin.number}.` });

  return out;
}

/** The flags still standing: every hold, and the soft flags not skipped. */
export function openFlags(bc: BatchCase, ctx: ScrutinyContext): Flag[] {
  return caseFlags(bc, ctx).filter((f) => f.level === "hold" || !bc.skipped.includes(f.id));
}

/** Where the case stands. Payment completes filing, as in the single flow. */
export function caseStage(bc: BatchCase, flags: Flag[]): CaseStage {
  if (bc.draft.status === "filed") return "filed";
  if (bc.signedWith) return "signed";
  return flags.some((f) => f.level === "hold") ? "held" : "ready";
}

/**
 * A case is clear to sign once nothing holds it and no soft flag is left unanswered —
 * skipping a soft flag answers it.
 */
export function clearToSign(flags: Flag[]): boolean {
  return flags.length === 0;
}
