/**
 * Read-only views over the draft for Preview and the court document.
 *
 * Every value here comes from `draft`. Where the person has not typed something, these
 * reads say so (`NOT_PROVIDED`) rather than printing a plausible stand-in — the court
 * sheet must never assert a fact the filing does not contain.
 */

import {
  addressToString,
  formatINR,
  joinDot,
  plural,
  rupees,
  toDisplayDate,
  toLongDate,
} from "@/lib/filing/format";
import {
  ACCUSED_TYPES,
  MODE_OF_SERVICE,
  NATURE_OF_DEBT,
  NON_DELIVERY_REASONS,
  PAYMENT_STATUS,
  RETURN_REASONS,
  type Option,
} from "@/lib/filing/options";
import {
  advocateName,
  documentsProgress,
  limitationView,
  totalChequeAmount,
} from "@/lib/filing/selectors";
import type {
  Accused,
  CaseDocument,
  Complainant,
  DemandNotice,
  FilingDraft,
} from "@/lib/filing/types";

export const NOT_PROVIDED = "Not provided";

export function orNot(value: string | undefined | null): string {
  const trimmed = (value ?? "").trim();
  return trimmed || NOT_PROVIDED;
}

export function optionLabel(options: Option[], value: string): string {
  return options.find((o) => o.value === value)?.label ?? "";
}

/** `dd/mm/yyyy` or "Not provided". */
export function displayDate(iso: string): string {
  return orNot(toDisplayDate(iso));
}

function commaJoin(...parts: Array<string | undefined | null>): string {
  return parts.filter((p) => p && p.trim()).join(", ");
}

/** Rich-text values are stored as HTML; the court sheet prints them as plain paragraphs. */
export function htmlToParagraphs(html: string): string[] {
  return String(html ?? "")
    .split(/<\/p>|<br\s*\/?>/i)
    .map((chunk) =>
      chunk
        .replace(/<[^>]*>/g, "")
        .replace(/&nbsp;/g, " ")
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&#39;|&apos;/g, "'")
        .replace(/&quot;/g, '"')
        .trim()
    )
    .filter(Boolean);
}

/* ───────────────────────────── Parties ─────────────────────────────── */

export function complainantSummary(c: Complainant | undefined) {
  const institution = c?.type === "institution";
  // Present address is where the person lives now; permanent repeats it unless they said
  // the two differ. An institution has the one registered address.
  const present = institution ? c?.entAddr : c?.res;
  const permanent = institution ? c?.entAddr : c?.permSame === "no" ? c?.perm : c?.res;
  return {
    name: orNot(institution ? c?.entName : c?.name),
    type: institution ? "Institution" : "Individual",
    /** Institutions only; empty for an individual, who is never asked. */
    cinPan: institution ? orNot(c?.entCinPan) : "",
    mobile: orNot(institution ? c?.entPhone : c?.mobile),
    email: orNot(institution ? c?.entEmail : c?.email),
    presentAddress: orNot(addressToString(present)),
    permanentAddress: orNot(addressToString(permanent)),
    poa: c?.poa === "yes" ? "Appointed" : "Not appointed",
    age: (c?.age ?? "").trim(),
  };
}

export type AdvocateSummary = {
  key: string;
  label: string;
  name: string;
  bar: string;
  /** Name and bar number as one line — the bar number is dropped when unknown. */
  nameWithBar: string;
  appearingFor: string;
  forAll: boolean;
};

export function advocateSummaries(draft: FilingDraft): AdvocateSummary[] {
  const complainants = draft.complainants;
  return draft.advocates.map((a, i) => {
    const forAll =
      complainants.length > 0 &&
      complainants.every((_, ci) => a.forComplainants.includes(ci));
    const named = a.forComplainants
      .filter((ci) => ci < complainants.length)
      .map((ci) => `Complainant ${ci + 1}`)
      .join(", ");
    const name = advocateName(a);
    const bar = a.barNumber.trim();
    return {
      key: a.id,
      label: `Advocate ${i + 1}`,
      name: orNot(name),
      bar: orNot(bar),
      nameWithBar: orNot(joinDot(name, bar)),
      appearingFor: forAll ? "All complainants" : orNot(named),
      forAll,
    };
  });
}

/** The advocate the court document names on the synopsis. */
export function leadAdvocateName(draft: FilingDraft): string {
  const first = draft.advocates[0];
  return orNot(first ? advocateName(first) : "");
}

export function accusedHeading(a: Accused, index: number): string {
  return a.name.trim() || `Accused ${index + 1}`;
}

export type AccusedSummary = {
  key: string;
  label: string;
  heading: string;
  name: string;
  type: string;
  isEntity: boolean;
  address: string;
  addressWithPolice: string;
};

export function accusedSummaries(draft: FilingDraft): AccusedSummary[] {
  return draft.accused.map((a, i) => {
    const block = a.addresses[0];
    const address = addressToString(block?.addr);
    return {
      key: a.id,
      label: `Accused ${i + 1}`,
      heading: accusedHeading(a, i),
      name: orNot(a.name),
      type: optionLabel(ACCUSED_TYPES, a.type) || "Individual",
      isEntity: a.type !== "individual",
      address: orNot(address),
      addressWithPolice: orNot(joinDot(address, block?.police)),
    };
  });
}

/* ───────────────────────────── Case details ────────────────────────── */

export type ChequeSummary = {
  key: string;
  label: string;
  amount: string;
  number: string;
  dateOnCheque: string;
  numberAndDate: string;
  drawerBank: string;
  bankName: string;
  bankBranch: string;
  presentDate: string;
  returnDate: string;
  returnReason: string;
  returned: string;
};

export function chequeSummaries(draft: FilingDraft): ChequeSummary[] {
  return draft.cheques.map((c, i) => {
    const reason = optionLabel(RETURN_REASONS, c.returnReason);
    const returned = [toDisplayDate(c.returnDate), reason].filter(Boolean).join(" · ");
    return {
      key: c.id,
      label: `Cheque ${i + 1}`,
      amount: orNot(rupees(c.amount)),
      number: orNot(c.chequeNumber),
      dateOnCheque: displayDate(c.dateOnCheque),
      numberAndDate: orNot(joinDot(c.chequeNumber, toDisplayDate(c.dateOnCheque))),
      drawerBank: orNot(commaJoin(c.bankName, c.bankBranch)),
      bankName: orNot(c.bankName),
      bankBranch: orNot(c.bankBranch),
      presentDate: displayDate(c.presentDate),
      returnDate: displayDate(c.returnDate),
      returnReason: orNot(reason),
      returned: returned || NOT_PROVIDED,
    };
  });
}

export function chequeTotal(draft: FilingDraft): number {
  return totalChequeAmount(draft.cheques);
}

/** The label the return memo carries for the first cheque — "" when none is chosen yet. */
export function firstReturnReason(draft: FilingDraft): string {
  return optionLabel(RETURN_REASONS, draft.cheques[0]?.returnReason ?? "");
}

/**
 * What the complaint asks for, in one line each. Both follow the prayer templates in
 * options.ts: the interim figure is the statute's ceiling (S-143A), the final relief is
 * the cheque amount itself — so it is only stated in rupees once cheques have been typed.
 */
export const INTERIM_RELIEF_SUMMARY =
  "Interim compensation of up to 20% of the cheque amount (S-143A)";

export function finalReliefSummary(draft: FilingDraft): string {
  const total = chequeTotal(draft);
  const compensation = total
    ? `compensation of ₹${formatINR(total)} together with interest`
    : "compensation equal to the cheque amount together with interest";
  return `Conviction under S-138, ${compensation}, and process/summons`;
}

/** "₹52,05,000 (2 cheques)" — the filing summary's headline figure. */
export function totalChequeText(draft: FilingDraft): string {
  const total = chequeTotal(draft);
  const count = plural(draft.cheques.length, "cheque");
  return total ? `${rupees(total)} (${count})` : `${NOT_PROVIDED} (${count})`;
}

export function amountClaimedText(draft: FilingDraft): string {
  const total = chequeTotal(draft);
  return total ? `${rupees(total)} + interest @ 6% p.a.` : NOT_PROVIDED;
}

export function noticeSummary(n: DemandNotice | undefined) {
  const delivered = n?.delivered === "yes";
  const deliveryDate = toDisplayDate(n?.deliveryDate ?? "");
  const payment = optionLabel(PAYMENT_STATUS, n?.paymentStatus ?? "");
  const partAmount = rupees(n?.partAmount ?? "");
  return {
    nature: orNot(optionLabel(NATURE_OF_DEBT, n?.natureDebt ?? "")),
    dispatched: orNot(
      joinDot(
        toDisplayDate(n?.dispatchDate ?? ""),
        optionLabel(MODE_OF_SERVICE, n?.modeService ?? "")
      )
    ),
    dispatchDate: displayDate(n?.dispatchDate ?? ""),
    mode: orNot(optionLabel(MODE_OF_SERVICE, n?.modeService ?? "")),
    delivered: delivered ? (deliveryDate ? `Yes, on ${deliveryDate}` : "Yes") : "No",
    deliveredYesNo: delivered ? "Yes" : "No",
    deliveryDate: orNot(deliveryDate),
    replied: n?.replied === "yes" ? "Yes" : "No",
    payment:
      payment && n?.paymentStatus === "part" && partAmount
        ? `${payment}: ${partAmount}`
        : orNot(payment),
    paidYesNo: n?.paymentStatus === "part" ? "Yes, in part" : "No",
  };
}

/**
 * The two affidavit sentences that depend on what the demand notice actually records.
 *
 * This is sworn evidence under BNSS s.225, so neither sentence may state a fact the notice
 * does not carry. A missing *value* (an amount, a date, a reason) prints `NOT_PROVIDED` as
 * everywhere else on the sheet; a missing *position* — the filer has not said whether the
 * accused paid, or whether the notice arrived — is stated as unrecorded, because "Not
 * provided" there could be misread as "no payment" or "not delivered".
 */
export function noticeAffidavit(n: DemandNotice | undefined) {
  const partAmount = rupees(n?.partAmount ?? "");
  const payment =
    n?.paymentStatus === "none"
      ? "A demand notice has been issued to the accused, but she/ he has failed to make the payment due under the cheque."
      : n?.paymentStatus === "part"
        ? `A demand notice has been issued to the accused. A part payment has been made against the cheque, and the balance due under it remains unpaid. Amount paid: ${orNot(partAmount)}.`
        : "A demand notice has been issued to the accused. Whether any payment has since been made under the cheque is not stated in this complaint.";

  // "Delivered" defaults to yes on a blank notice, so the delivery date is what shows the
  // question was actually answered; a notice returned unserved is its own, different claim.
  const service =
    n?.delivered === "yes" && n.deliveryDate
      ? "I confirm that the demand notice was served on the last known correct address of the accused(s)."
      : n?.delivered === "no"
        ? `I confirm that the demand notice was correctly addressed and dispatched to the last known correct address of the accused(s), and that it was returned unserved. Date of return: ${orNot(toLongDate(n.returnDate))}. Reason recorded: ${orNot(optionLabel(NON_DELIVERY_REASONS, n.nonDeliveryReason))}. Service is relied upon as deemed complete on the notice so returned.`
        : "Whether the demand notice was delivered to the accused(s) is not stated in this complaint.";

  return { payment, service };
}

export function jurisdictionSummary(draft: FilingDraft) {
  const j = draft.jurisdiction;
  const bank = commaJoin(j.payeeBankName, j.payeeBankBranch);
  const lim = limitationView(draft);
  const delay = lim.elapsed;
  const beyond = delay === null ? 0 : delay - 30;
  return {
    depositedByPayee: j.deposited === "yes",
    presentedBy:
      j.deposited === "yes"
        ? bank
          ? `Complainant: ${bank}`
          : "Complainant"
        : "Drawer (accused) bank branch",
    police: orNot(j.deposited === "yes" ? j.payeePolice : j.drawerPolice),
    ifsc: orNot(j.ifsc),
    bankName: orNot(j.payeeBankName),
    bankBranch: orNot(j.payeeBankBranch),
    bank: orNot(bank),
    causeDate: displayDate(lim.causeDate),
    causeDateIso: lim.causeDate,
    filingDate: displayDate(lim.filingDate),
    filingDateIso: lim.filingDate,
    otherPending: j.otherPending === "yes" ? "Yes" : "No",
    otherCases: j.otherCases.filter((c) => c.court.trim() || c.caseNumber.trim()),
    inTime: delay === null || delay <= 30,
    delayText:
      delay === null
        ? NOT_PROVIDED
        : delay <= 30
          ? "None. Within limitation"
          : `${plural(beyond, "day")} beyond the one-month limit`,
    condonationReason: j.condonationReason.trim(),
  };
}

const ADR_LABELS: Record<FilingDraft["adr"]["adr"], string> = {
  yes: "Yes",
  no: "No",
  maybe: "Maybe",
};

export function adrLabel(draft: FilingDraft): string {
  return ADR_LABELS[draft.adr.adr] ?? "No";
}

/* ───────────────────────────── Evidence ────────────────────────────── */

export type WitnessSummary = {
  key: string;
  label: string;
  term: string;
  name: string;
  prove: string;
  mobile: string;
  email: string;
  address: string;
};

export function witnessSummaries(draft: FilingDraft): WitnessSummary[] {
  return draft.witnesses.map((w, i) => {
    const byDesignation = !w.fullName.trim() && !!w.designation.trim();
    const contact = w.contacts[0];
    return {
      key: w.id,
      label: `Witness ${i + 1}`,
      term: byDesignation ? "Designation" : "Name",
      name: orNot(w.fullName || w.designation),
      prove: orNot(w.prove),
      mobile: orNot(contact?.mobile),
      email: orNot(contact?.email),
      address: orNot(addressToString(w.addresses[0]?.addr)),
    };
  });
}

export function documentSummary(draft: FilingDraft) {
  const uploaded: CaseDocument[] = draft.documents.flatMap((g) =>
    g.docs.filter((d) => !!d.file)
  );
  const lines = draft.documents
    .map((g) =>
      g.docs
        .filter((d) => !!d.file)
        .map((d) => d.name)
        .join(" · ")
    )
    .filter(Boolean);
  return { uploaded, lines, ...documentsProgress(draft.documents) };
}

/**
 * The affidavit, as HTML, composed from the case.
 *
 * This is the one text on the sheet the filer is expected to edit — it is sworn under
 * BNSS s.225, and only they know whether the standard recitals fit their facts. So it is
 * generated here from what the draft actually records (the return reason is quoted from
 * the memo, the payment and service sentences come from `noticeAffidavit`), and the
 * Affidavit step hands it to a rich-text editor.
 *
 * `draft.affidavit` holds the edited version when there is one; empty means "still the
 * standard text", so the paragraphs keep tracking the case as the filer changes it. That
 * is why the court document renders the *same* expression rather than regenerating its
 * own copy — two paths would drift, and a sworn document that disagrees with the form it
 * came from is the worst outcome available here.
 */
export function affidavitHtml(draft: FilingDraft): string {
  const notice = noticeAffidavit(draft.notices[0]);
  const reason = optionLabel(RETURN_REASONS, draft.cheques[0]?.returnReason ?? "");
  const dishonoured = reason
    ? `It has been dishonoured, the return memo recording the reason as \u201c${reason}\u201d.`
    : "It has been dishonoured.";

  return [
    "I am the complainant / authorised representative of the complainant in the above case and am fully acquainted with the facts and circumstances of the case. I am competent and authorised to swear to this affidavit.",
    `The accused issued the above cheque in discharge of a legally enforceable debt or liability. ${dishonoured} ${notice.payment} All other requirements under Section 138 of the Negotiable Instruments Act, 1881 have been complied with.`,
    notice.service,
    "In accordance with Section 225 of the Bharatiya Nagarik Suraksha Sanhita, 2023, I confirm that there is sufficient ground for proceeding against the accused.",
    "In accordance with Section 223 and other relevant provisions of the Bharatiya Nagarik Suraksha Sanhita, 2023, I confirm that the contents of this complaint are true and correct to the best of my knowledge, belief and information.",
    "The physical or electronic records of the documents etc. produced by me with this complaint are in my lawful and proper custody and possession.",
    "It is therefore humbly prayed that this Hon\u2019ble Court may be pleased to take cognizance of the offence committed by the accused, and issue process to the accused.",
  ]
    .map((para) => `<p>${para}</p>`)
    .join("");
}

/** What the sheet and the editor both show — the edit when there is one, else the standard text. */
export function affidavitBody(draft: FilingDraft): string {
  return draft.affidavit.trim() ? draft.affidavit : affidavitHtml(draft);
}
