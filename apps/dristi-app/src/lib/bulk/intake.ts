/**
 * Intake: one `ApiBatchRequest` (an API push, or a parsed Excel file) becomes one batch of
 * ordinary filing drafts.
 *
 * Each case is built on `createBlankDraft`, the same factory a single filing starts from,
 * and filled field by field from the request. Nothing is inferred: a value is copied,
 * normalised by a stated rule (digits only, upper case, trimmed), or looked up from a
 * reference register (IFSC, pincode, bar number). A list value that is not in DRISTI's
 * list is still copied as sent, so scrutiny can hold it and say what it was.
 *
 * Derived values (cause of action, filing date, delay) are left empty for the selectors to
 * compute, exactly as in a single filing (PRD §3.5).
 */

import {
  blankComplainant,
  buildDocumentGroups,
  createBlankDraft,
  intakeChequeGroup,
  intakePartyGroup,
  uid,
} from "@/lib/filing/blank";
import { newId } from "@/lib/filing/data";
import { PROGRESS_STEPS } from "@/lib/filing/selectors";
import type {
  Accused,
  Complainant,
  Address,
  AddressBlock,
  ChequeDetails,
  DemandNotice,
  FilingDraft,
  Representative,
  StoredFileRef,
} from "@/lib/filing/types";

import type {
  ApiAddress,
  ApiBatchRequest,
  ApiCase,
  ApiComplainant,
  ApiDocument,
  ApiRepresentative,
} from "./contract";
import { slotKeyFor } from "./contract";
import { COURT_DISTRICT, resolveBar, resolveIfsc, resolvePin } from "./reference";
import type { Batch, BatchCase, BatchSource } from "./types";

/** Digits only, without a leading +91 or 0: what the form's phone field holds. */
export function normalisePhone(raw: string | undefined): string {
  let d = (raw ?? "").replace(/\D/g, "");
  if (d.length === 12 && d.startsWith("91")) d = d.slice(2);
  if (d.length === 11 && d.startsWith("0")) d = d.slice(1);
  return d;
}

const upper = (s: string | undefined) => (s ?? "").trim().toUpperCase();
const trim = (s: string | undefined) => (s ?? "").trim();
const rupees = (s: string | undefined) => (s ?? "").replace(/[^\d.]/g, "").replace(/\.\d*$/, "");

async function address(a: ApiAddress | undefined): Promise<Address> {
  const pin = (a?.pin ?? "").replace(/\D/g, "");
  const place = await resolvePin(pin);
  return {
    line1: trim(a?.line1),
    city: trim(a?.city),
    pin,
    district: place?.district ?? "",
    state: place?.state ?? "",
  };
}

async function representative(r: ApiRepresentative | undefined): Promise<Representative> {
  return {
    mobile: normalisePhone(r?.mobile),
    name: trim(r?.name),
    age: (r?.age ?? "").replace(/\D/g, ""),
    designation: trim(r?.designation),
    email: trim(r?.email).toLowerCase(),
    addr: await address(r?.address),
    gender: "",
    differentlyAbled: "",
  };
}

async function complainantFrom(src: ApiComplainant): Promise<Complainant> {
  const comp = blankComplainant();
  comp.pip = "no";
  comp.type = src.type;
  if (src.type === "institution") {
    comp.entType = trim(src.institutionType);
    comp.entName = trim(src.name);
    comp.entCinPan = upper(src.cinPan);
    comp.entPhone = normalisePhone(src.phone);
    comp.entEmail = trim(src.email).toLowerCase();
    comp.entAddr = await address(src.address);
    comp.rep = await representative(src.representative);
    // The verified number is the representative's: they sign for the institution.
    comp.mobile = comp.rep.mobile;
  } else {
    comp.name = trim(src.name);
    comp.age = (src.age ?? "").replace(/\D/g, "");
    comp.gender = (["male", "female", "other"].includes(src.gender ?? "") ? src.gender : "") as Complainant["gender"];
    comp.mobile = normalisePhone(src.phone);
    comp.email = trim(src.email).toLowerCase();
    comp.res = await address(src.address);
  }
  // Bulk filing treats the filing advocate's standing link to the client as the mobile
  // verification (PRD §4.1, open).
  comp.verified = true;
  return comp;
}

/** Fetches one document the sender listed and stores it, with any text read from it; `null` when it cannot. */
export type FetchDocument = (doc: ApiDocument) => Promise<(StoredFileRef & { text?: string | null }) | null>;

async function buildDraft(
  req: ApiBatchRequest,
  c: ApiCase,
  fetchDocument: FetchDocument
): Promise<{ draft: FilingDraft; unknownBar: string[]; fetchFailed: string[]; unknownService: number[]; docText: Record<string, string | null> }> {
  const draft = createBlankDraft(newId("d"), null);
  const now = new Date().toISOString();

  /*
   * Complainants (LIT): the batch's own first, the same on every case, then any further
   * ones this case names. Each gets its own documents (ID card, vakalatnama).
   */
  const sources = [req.complainant, ...(c.complainants ?? [])];
  draft.complainants = await Promise.all(sources.map((src) => complainantFrom(src)));
  draft.intake.parties = draft.complainants.map((_, i) => intakePartyGroup(i + 1));

  /* Advocates — name from the bar register, never from the sender (ADV-4). Each appears
     for every complainant (ADV-2 defaults to all who are not in person). */
  const unknownBar: string[] = [];
  const everyone = draft.complainants.map((_, i) => i);
  draft.advocates = req.advocates.map((a) => {
    const barNumber = upper(a.barNumber);
    const name = resolveBar(barNumber);
    if (!name) unknownBar.push(barNumber);
    return { id: uid("adv"), forComplainants: everyone, barNumber, name: name ?? "" };
  });

  /* Accused (ACC). */
  draft.accused = await Promise.all(
    c.accused.map(async (a): Promise<Accused> => {
      const addresses: AddressBlock[] = await Promise.all(
        a.addresses.map(async (ad) => ({ addr: await address(ad), police: trim(ad.policeStation) }))
      );
      const inside = addresses.some((b) => b.addr.district === COURT_DISTRICT);
      return {
        id: uid("acc"),
        type: a.type,
        name: trim(a.name),
        entType: a.type === "institution" ? trim(a.institutionType) : "",
        contacts: [{ mobile: normalisePhone(a.mobile), email: trim(a.email).toLowerCase() }],
        addresses: addresses.length ? addresses : [{ addr: await address(undefined), police: "" }],
        reps:
          a.type === "institution"
            ? await Promise.all((a.personsResponsible ?? []).map(representative))
            : [],
        jurisdiction: inside ? "yes" : "no",
      };
    })
  );

  /* Cheques (CHQ), with one intake group of document slots each. */
  draft.cheques = await Promise.all(
    c.cheques.map(async (q): Promise<ChequeDetails> => {
      const ifsc = upper(q.ifsc);
      const bank = await resolveIfsc(ifsc);
      return {
        id: uid("chq"),
        dateOnCheque: trim(q.date),
        amount: rupees(q.amount),
        chequeNumber: (q.number ?? "").replace(/\D/g, "").padStart(6, "0").slice(-6),
        sameAsPrev: "no",
        ifsc,
        bankName: bank?.bank ?? "",
        bankBranch: bank?.branch ?? "",
        presentDate: trim(q.presentedOn),
        returnDate: trim(q.returnedOn),
        returnReason: trim(q.returnReason),
        prefilled: {},
        edited: {},
        ifscFetched: !!bank,
      };
    })
  );
  draft.intake.cheques = draft.cheques.map((_, i) => intakeChequeGroup(i + 1));

  /* Demand notices (LDN). */
  const unknownService: number[] = [];
  draft.notices = c.notices.map((n, i): DemandNotice => {
    if (n.delivered === null) unknownService.push(i);
    const delivered = n.delivered === false ? "no" : "yes";
    return {
      id: uid("dn"),
      natureDebt: trim(n.natureOfDebt),
      dispatchDate: trim(n.dispatchedOn),
      modeService: trim(n.mode),
      tracking: trim(n.trackingNumber),
      delivered,
      deliveryDate: delivered === "yes" ? trim(n.deliveredOn) : "",
      replied: n.replied ? "yes" : "no",
      returnDate: delivered === "no" ? trim(n.returnedOn) : "",
      nonDeliveryReason: delivered === "no" ? trim(n.nonDeliveryReason) : "",
      paymentStatus: n.payment.status,
      partAmount: n.payment.status === "part" ? rupees(n.payment.amount) : "",
      prefilled: {},
      edited: {},
    };
  });

  /* Jurisdiction (JUR). Cause of action and filing date stay empty: they are derived. */
  const j = c.jurisdiction;
  const payeeIfsc = upper(j.complainantBranchIfsc);
  const payee = j.depositedInOwnAccount ? await resolveIfsc(payeeIfsc) : null;
  const others = (j.otherPendingCases ?? []).filter((o) => trim(o.court) || trim(o.caseNumber));
  draft.jurisdiction = {
    ...draft.jurisdiction,
    deposited: j.depositedInOwnAccount ? "yes" : "no",
    ifsc: j.depositedInOwnAccount ? payeeIfsc : "",
    payeeBankName: payee?.bank ?? "",
    payeeBankBranch: payee?.branch ?? "",
    payeeFetched: !!payee,
    payeePolice: j.depositedInOwnAccount ? trim(j.complainantBranchPoliceStation) : "",
    drawerPolice: j.depositedInOwnAccount ? "" : trim(j.drawerBranchPoliceStation),
    otherPending: others.length ? "yes" : "no",
    otherCases: others.length
      ? others.map((o) => ({ court: trim(o.court), caseNumber: trim(o.caseNumber) }))
      : [{ court: "", caseNumber: "" }],
    condonationReason: trim(c.condonationReason),
  };

  /* ADR and prayers (PRY). The prayers and affidavit keep the standard templates. */
  if (req.adr) draft.adr.adr = req.adr;
  draft.adr.otherDetails = trim(c.otherDetails);

  /* Witnesses (WIT), 0..n. With none, the draft keeps the single blank row a filing starts with. */
  if (c.witnesses?.length) {
    draft.witnesses = await Promise.all(
      c.witnesses.map(async (w) => ({
        id: uid("wit"),
        fullName: trim(w.name),
        designation: trim(w.designation),
        age: (w.age ?? "").replace(/\D/g, ""),
        prove: trim(w.prove),
        contacts: [{ mobile: normalisePhone(w.mobile), email: trim(w.email).toLowerCase() }],
        addresses: [{ addr: await address(w.address), police: trim(w.address?.policeStation) }],
      }))
    );
  }

  /* Documents (DCM): fetched now, placed in the intake slot each code fills. */
  const fetchFailed: string[] = [];
  const docText: Record<string, string | null> = {};
  const slots = new Map(
    [...draft.intake.cheques, ...draft.intake.parties]
      .flatMap((g) => g.slots)
      .concat(draft.intake.supporting)
      .map((s) => [s.key, s])
  );
  for (const doc of c.documents ?? []) {
    const slot = slots.get(slotKeyFor(doc.code, doc.index ?? 1));
    if (!slot) continue;
    const got = await fetchDocument(doc);
    if (got) {
      const { text, ...ref } = got;
      slot.file = ref;
      docText[ref.id] = text ?? null;
    } else fetchFailed.push(doc.name || doc.code);
  }
  draft.documents = buildDocumentGroups(draft);

  // Every section was filled from the request, so each counts as opened.
  draft.visited = [...PROGRESS_STEPS.filter((s) => s !== "sign"), "witnesses", "affidavit", "preview"];
  draft.lastStep = "preview";
  draft.createdAt = now;
  draft.updatedAt = now;

  return { draft, unknownBar, fetchFailed, unknownService, docText };
}

/** Requests that are not a batch at all are refused before anything is stored. */
export function validateRequest(req: unknown): string[] {
  const r = req as Partial<ApiBatchRequest> | null;
  const errors: string[] = [];
  if (!r || typeof r !== "object") return ["The body is not a JSON object."];
  if (!r.source?.system) errors.push("source.system is required.");
  if (!r.complainant?.name) errors.push("complainant.name is required.");
  if (!Array.isArray(r.advocates)) errors.push("advocates must be a list.");
  if (!Array.isArray(r.cases) || r.cases.length === 0) errors.push("cases must be a non-empty list.");
  const refs = new Set<string>();
  (r.cases ?? []).forEach((c, i) => {
    if (!c?.reference) errors.push(`cases[${i}].reference is required.`);
    else if (refs.has(c.reference)) errors.push(`cases[${i}].reference "${c.reference}" repeats.`);
    else refs.add(c.reference);
    if (!Array.isArray(c?.accused) || !Array.isArray(c?.cheques) || !Array.isArray(c?.notices)) {
      errors.push(`cases[${i}] needs accused, cheques and notices lists.`);
    }
    if (!c?.jurisdiction) errors.push(`cases[${i}].jurisdiction is required.`);
  });
  return errors;
}

/** Build a batch (not yet numbered or stored) from a validated request. */
export async function buildBatch(
  req: ApiBatchRequest,
  source: BatchSource,
  fetchDocument: FetchDocument
): Promise<Omit<Batch, "number">> {
  const now = new Date().toISOString();
  const cases: BatchCase[] = [];
  for (const c of req.cases) {
    const built = await buildDraft(req, c, fetchDocument);
    cases.push({
      id: newId("bc"),
      reference: trim(c.reference),
      draft: built.draft,
      skipped: [],
      noContactDeclared: [],
      unknownBar: built.unknownBar,
      fetchFailed: built.fetchFailed,
      unknownService: built.unknownService,
      docText: built.docText,
      signedWith: null,
      receiptNumber: null,
    });
  }
  return {
    id: newId("batch"),
    source,
    client: trim(req.complainant.name),
    createdAt: now,
    updatedAt: now,
    cases,
    payments: [],
    signings: [],
    clubbedInto: null,
    clubbedFrom: [],
  };
}
