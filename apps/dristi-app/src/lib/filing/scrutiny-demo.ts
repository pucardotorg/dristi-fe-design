"use client";

/**
 * SANDBOX DATA — the filed S-138 complaints that scrutiny sent back.
 *
 * The correction screen is the e-filing form re-entered in a correction posture, so it
 * needs a real draft to re-enter. This seeds one, once, into the same IndexedDB the
 * filing flow uses: two cheques, the complainant, the demand notice, and the five
 * documents intake asks for — with the *defective* values scrutiny actually saw
 * (`lib/tasks/scrutiny-return.ts` records those as `valueAtReturn`; if the two drift a
 * defect reads as resolved before anyone has touched it).
 *
 * The uploads are drawn locally as SVGs rather than shipped as binary fixtures: they only
 * have to be a readable page, and a repo does not need four scans of an imaginary cheque
 * in it. Nothing here has been sent to a real court.
 */

import {
  blankCheque,
  buildDocumentGroups,
  createBlankDraft,
  intakeChequeGroup,
} from "./blank";
import { getRepository } from "./data";
import type { FilingDraft, IntakeSlot, StoredFileRef } from "./types";

export { SCRUTINY_DRAFT_ID } from "@/lib/tasks/scrutiny-return";
import {
  SCRUTINY_DRAFT_ID,
  SCRUTINY_DRAFT_ID_LAKSHMI,
  SCRUTINY_DRAFT_ID_RAFI,
  SCRUTINY_FILES,
  EXTRA_RETURNS,
  type ExtraReturn,
} from "@/lib/tasks/scrutiny-return";

/** Page geometry of the drawn uploads. */
const W = 900;
const H = 400;

/** A plain "document" page: a titled sheet with a few printed lines. Deterministic. */
function docSvg(title: string, lines: [string, string][]): Blob {
  const rows = lines
    .map(
      ([label, value], i) => `
    <text x="60" y="${120 + i * 56}" font-family="Helvetica, Arial" font-size="20" fill="#6b7280">${label}</text>
    <text x="360" y="${120 + i * 56}" font-family="Helvetica, Arial" font-size="24" fill="#111827">${value}</text>`
    )
    .join("");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
    <rect width="${W}" height="${H}" fill="#fdfdf9"/>
    <rect x="16" y="16" width="${W - 32}" height="${H - 32}" fill="none" stroke="#d4d4d8" stroke-width="2"/>
    <text x="60" y="70" font-family="Helvetica, Arial" font-size="26" font-weight="bold" fill="#111827">${title}</text>
    ${rows}
  </svg>`;
  return new Blob([svg], { type: "image/svg+xml" });
}

const PAGES: Record<string, () => Blob> = {
  [SCRUTINY_FILES.cheque1.id]: () =>
    docSvg("Kerala Gramin Bank, Chalakudy", [
      ["Pay", "Sainaba K."],
      ["Rupees", "Two lakh forty thousand only"],
      ["Date", "14 / 05 / 2026"],
      ["Cheque no.", "447162"],
    ]),
  [SCRUTINY_FILES.cheque2.id]: () =>
    docSvg("Kerala Gramin Bank, Kodungallur town branch", [
      ["Pay", "Sainaba K."],
      ["Rupees", "One lakh eighty-five thousand only"],
      ["Date", "02 / 06 / 2026"],
      ["Cheque no.", "447163"],
    ]),
  [SCRUTINY_FILES.memo2.id]: () =>
    docSvg("Cheque return memo: cheque 447163", [
      ["Amount", "1,85,000.00"],
      ["Presented on", "09 / 06 / 2026"],
      ["Returned on", "11 / 06 / 2026"],
      ["Reason", "Funds insufficient"],
    ]),
  [SCRUTINY_FILES.adCard.id]: () =>
    docSvg("Acknowledgement due: RP 4471 8820 3IN", [
      ["Addressee", "Riyas M."],
      ["Delivered on", "(cut off at the fold)"],
      ["Signature", "(cut off at the fold)"],
    ]),
  [SCRUTINY_FILES.ifscEvidence.id]: () =>
    docSvg("Branch certificate: Kerala Gramin Bank", [
      ["Branch", "Kodungallur town"],
      ["IFSC", "KLGB0040213"],
      ["MICR", "680487002"],
    ]),
};

async function ensureFile(ref: StoredFileRef): Promise<void> {
  const repo = getRepository();
  if (await repo.getFile(ref.id)) return;
  const make = PAGES[ref.id];
  if (!make) return;
  await repo.putFile({ ...ref, blob: make(), createdAt: new Date().toISOString() });
}

/** Put a file into an intake slot and give it a page geometry the highlight can use. */
function fill(slot: IntakeSlot, ref: StoredFileRef): void {
  slot.file = { id: ref.id, name: ref.name, size: ref.size, type: ref.type, ext: ref.ext };
  slot.extract = {
    engine: "tesseract",
    confidence: 88,
    page: { width: W, height: H },
    fields: {},
    extractedAt: new Date().toISOString(),
  };
}

/** The filing as scrutiny received it — defects and all. */
function buildDraft(): FilingDraft {
  const d = createBlankDraft(SCRUTINY_DRAFT_ID);
  d.lastStep = "cheque";

  const c = d.complainants[0];
  c.mobile = "9847012233";
  c.verified = true;
  c.name = "Sainaba K.";
  c.age = ""; // Defect 5 — not stated.
  c.email = "sainaba.k@gmial.com"; // Defect 6 — evident typo.
  c.res = {
    line1: "Puthenveedu, Market Road",
    city: "Kodungallur",
    pin: "680664",
    district: "Thrissur",
    state: "Kerala",
  };
  c.perm = { ...c.res };

  d.advocates[0].name = "Anjali Nair";
  d.advocates[0].barNumber = "K/1188/2011";

  const a = d.accused[0];
  a.name = "Riyas M.";
  a.contacts = [{ mobile: "9846778811", email: "" }];
  a.addresses = [
    {
      addr: {
        line1: "Ashiyana, Beach Road",
        city: "Kodungallur",
        pin: "680664",
        district: "Thrissur",
        state: "Kerala",
      },
      police: "Kodungallur",
    },
  ];

  const one = d.cheques[0];
  one.dateOnCheque = "2026-05-14";
  one.amount = "240000";
  one.chequeNumber = "4471"; // Defect 2 — four digits, not six.
  one.ifsc = "KLGB0040231"; // Defect 1 — two digits transposed.
  one.bankName = "Kerala Gramin Bank";
  one.bankBranch = "Chalakudy";
  one.presentDate = "2026-05-28";
  one.returnDate = "2026-05-30";
  one.returnReason = "funds-insufficient";

  const two = blankCheque();
  two.dateOnCheque = "2026-06-02";
  two.amount = "85000"; // Defect 4 — the memo reads 1,85,000.
  two.chequeNumber = "447163";
  two.sameAsPrev = "no";
  two.ifsc = "KLGB0040213";
  two.bankName = "Kerala Gramin Bank";
  two.bankBranch = "Main"; // Defect 3 — not the branch on the leaf.
  two.presentDate = "2026-06-09";
  two.returnDate = "2026-06-11";
  two.returnReason = "funds-insufficient";
  d.cheques.push(two);

  const n = d.notices[0];
  n.natureDebt = "loan";
  n.dispatchDate = "2026-06-18";
  n.modeService = "registered-post-ad";
  n.tracking = ""; // Defect 7 — not stated.
  n.delivered = "yes";
  n.deliveryDate = "2026-06-21";
  n.replied = "no";
  n.paymentStatus = "none";

  d.jurisdiction.deposited = "yes";
  d.jurisdiction.ifsc = "SBIN0070123";
  d.jurisdiction.payeeBankName = "State Bank of India";
  d.jurisdiction.payeeBankBranch = "Kodungallur";
  d.jurisdiction.payeeFetched = true;
  d.jurisdiction.payeePolice = "Kodungallur";
  d.jurisdiction.drawerPolice = "Kodungallur";
  d.jurisdiction.causeDate = "2026-07-06";
  d.jurisdiction.filingDate = "2026-07-24";

  const w = d.witnesses[0];
  w.fullName = "Ashraf P. M.";
  w.designation = "Neighbour";
  w.age = "52";
  w.prove = "Present when the cheque was handed over.";

  // Intake — a group per cheque, and the uploads the defects point at.
  d.intake.cheques.push(intakeChequeGroup(2));
  const c1 = d.intake.cheques[0];
  fill(c1.slots[0], SCRUTINY_FILES.cheque1);
  fill(c1.slots[4], SCRUTINY_FILES.adCard); // Defect 8 — the AD card, scanned at an angle.
  const c2 = d.intake.cheques[1];
  fill(c2.slots[0], SCRUTINY_FILES.cheque2);
  fill(c2.slots[1], SCRUTINY_FILES.memo2);

  d.documents = buildDocumentGroups(d);
  d.scrutinyReturn = { resubmittedAt: null };
  return d;
}

/**
 * Lakshmi Devi v. Thomas Kurian, as scrutiny received it: one cheque, the complainant's
 * age and the notice's tracking number missing, and the cheque number short a digit.
 */
function buildLakshmiDraft(): FilingDraft {
  const d = createBlankDraft(SCRUTINY_DRAFT_ID_LAKSHMI);
  d.lastStep = "cheque";

  const c = d.complainants[0];
  c.mobile = "9447120456";
  c.verified = true;
  c.name = "Lakshmi Devi";
  c.age = ""; // Defect 2 — not stated.
  c.res = { line1: "Sreenilayam, Temple Road", city: "Kollam", pin: "691001", district: "Kollam", state: "Kerala" };
  c.perm = { ...c.res };

  d.advocates[0].name = "Anjali Nair";
  d.advocates[0].barNumber = "K/1188/2011";

  const a = d.accused[0];
  a.name = "Thomas Kurian";
  a.contacts = [{ mobile: "9895034412", email: "" }];
  a.addresses = [
    {
      addr: { line1: "Kurian Villa, Beach Road", city: "Kollam", pin: "691001", district: "Kollam", state: "Kerala" },
      police: "Kollam East",
    },
  ];

  const one = d.cheques[0];
  one.dateOnCheque = "2026-05-20";
  one.amount = "150000";
  one.chequeNumber = "30918"; // Defect 1 — five digits, not six.
  one.ifsc = "SBIN0070451";
  one.bankName = "State Bank of India";
  one.bankBranch = "Kollam";
  one.presentDate = "2026-06-01";
  one.returnDate = "2026-06-03";
  one.returnReason = "funds-insufficient";

  const n = d.notices[0];
  n.natureDebt = "loan";
  n.dispatchDate = "2026-06-15";
  n.modeService = "registered-post-ad";
  n.tracking = ""; // Defect 3 — not stated.
  n.delivered = "yes";
  n.deliveryDate = "2026-06-18";
  n.replied = "no";
  n.paymentStatus = "none";

  d.jurisdiction.deposited = "yes";
  d.jurisdiction.ifsc = "SBIN0070451";
  d.jurisdiction.payeeBankName = "State Bank of India";
  d.jurisdiction.payeeBankBranch = "Kollam";
  d.jurisdiction.payeeFetched = true;
  d.jurisdiction.payeePolice = "Kollam East";
  d.jurisdiction.drawerPolice = "Kollam East";
  d.jurisdiction.causeDate = "2026-07-03";
  d.jurisdiction.filingDate = "2026-07-22";

  d.documents = buildDocumentGroups(d);
  d.scrutinyReturn = { resubmittedAt: null };
  return d;
}

/**
 * Mohammed Rafi v. Suresh Babu, as scrutiny received it: the branch stated as "Main",
 * and the AD card scanned with the delivery date cut off.
 */
function buildRafiDraft(): FilingDraft {
  const d = createBlankDraft(SCRUTINY_DRAFT_ID_RAFI);
  d.lastStep = "cheque";

  const c = d.complainants[0];
  c.mobile = "9846551203";
  c.verified = true;
  c.name = "Mohammed Rafi";
  c.age = "39";
  c.res = { line1: "Rafi Manzil, Mosque Lane", city: "Karunagappally", pin: "690518", district: "Kollam", state: "Kerala" };
  c.perm = { ...c.res };

  d.advocates[0].name = "Anjali Nair";
  d.advocates[0].barNumber = "K/1188/2011";

  const a = d.accused[0];
  a.name = "Suresh Babu";
  a.contacts = [{ mobile: "9744218830", email: "" }];
  a.addresses = [
    {
      addr: { line1: "Thekkethil House", city: "Karunagappally", pin: "690518", district: "Kollam", state: "Kerala" },
      police: "Karunagappally",
    },
  ];

  const one = d.cheques[0];
  one.dateOnCheque = "2026-05-10";
  one.amount = "320000";
  one.chequeNumber = "556021";
  one.ifsc = "FDRL0001234";
  one.bankName = "Federal Bank";
  one.bankBranch = "Main"; // Defect 1 — not the branch on the leaf.
  one.presentDate = "2026-05-22";
  one.returnDate = "2026-05-24";
  one.returnReason = "funds-insufficient";

  const n = d.notices[0];
  n.natureDebt = "loan";
  n.dispatchDate = "2026-06-05";
  n.modeService = "registered-post-ad";
  n.tracking = "RK556021447IN";
  n.delivered = "yes";
  n.deliveryDate = "2026-06-09";
  n.replied = "no";
  n.paymentStatus = "none";

  d.jurisdiction.deposited = "yes";
  d.jurisdiction.ifsc = "FDRL0001234";
  d.jurisdiction.payeeBankName = "Federal Bank";
  d.jurisdiction.payeeBankBranch = "Karunagappally";
  d.jurisdiction.payeeFetched = true;
  d.jurisdiction.payeePolice = "Karunagappally";
  d.jurisdiction.drawerPolice = "Karunagappally";
  d.jurisdiction.causeDate = "2026-06-24";
  d.jurisdiction.filingDate = "2026-07-15";

  // Defect 2 — the AD card, cut off at the fold.
  fill(d.intake.cheques[0].slots[4], SCRUTINY_FILES.adCard);

  d.documents = buildDocumentGroups(d);
  d.scrutinyReturn = { resubmittedAt: null };
  return d;
}

/** Every seeded return, by draft id. */
const BASE_BUILDERS = {
  sainaba: buildDraft,
  lakshmi: buildLakshmiDraft,
  rafi: buildRafiDraft,
} as const;

/** One of the seeded filings under another return's id and parties (`EXTRA_RETURNS`). */
function buildExtra(extra: ExtraReturn): () => FilingDraft {
  return () => {
    const d = BASE_BUILDERS[extra.base]();
    d.id = extra.draftId;
    d.complainants[0].name = extra.complainant;
    d.accused[0].name = extra.accused;
    return d;
  };
}

const BUILDERS: Record<string, () => FilingDraft> = {
  [SCRUTINY_DRAFT_ID]: buildDraft,
  [SCRUTINY_DRAFT_ID_LAKSHMI]: buildLakshmiDraft,
  [SCRUTINY_DRAFT_ID_RAFI]: buildRafiDraft,
  ...Object.fromEntries(EXTRA_RETURNS.map((extra) => [extra.draftId, buildExtra(extra)])),
};

const seeding = new Map<string, Promise<FilingDraft | null>>();

/**
 * Make sure a returned filing is in this browser, and hand it back. Idempotent: an
 * existing draft is never overwritten, so corrections made in a previous sitting survive.
 */
export function ensureScrutinyDraft(draftId: string): Promise<FilingDraft | null> {
  const build = BUILDERS[draftId];
  if (!build) return getRepository().getDraft(draftId);
  let pending = seeding.get(draftId);
  if (!pending) {
    pending = (async () => {
      const repo = getRepository();
      const existing = await repo.getDraft(draftId);
      await Promise.all(Object.values(SCRUTINY_FILES).map(ensureFile));
      if (existing) {
        // Seeded before returns were marked: mark it now, so it stays off Drafts.
        if (existing.scrutinyReturn) return existing;
        const marked = { ...existing, scrutinyReturn: { resubmittedAt: null } };
        await repo.putDraft(marked);
        return marked;
      }
      const draft = build();
      await repo.putDraft(draft);
      return draft;
    })().catch(() => null);
    seeding.set(draftId, pending);
  }
  return pending;
}

/** Is this one of the sandbox's returned filings (Sainaba, Lakshmi, Rafi)? */
export function isScrutinyDemoDraft(draftId: string): boolean {
  return draftId in BUILDERS;
}

/**
 * Put a sandbox return back the way scrutiny sent it, overwriting any corrections. The
 * fix page calls this on every opening, so a demo can be run again and again without
 * resetting the sandbox (owner, 2026-10-12). Mock data only: never for a real draft.
 */
export async function reseedScrutinyDraft(draftId: string): Promise<FilingDraft | null> {
  const build = BUILDERS[draftId];
  if (!build) return getRepository().getDraft(draftId);
  try {
    await Promise.all(Object.values(SCRUTINY_FILES).map(ensureFile));
    const draft = build();
    await getRepository().putDraft(draft);
    seeding.set(draftId, Promise.resolve(draft));
    try {
      window.localStorage.removeItem(`dristi:scrutiny-originals:${draftId}`);
    } catch {
      /* storage refused: nothing kept to clear */
    }
    return draft;
  } catch {
    return null;
  }
}

/**
 * Mark returned filings seeded before returns were marked, so the dashboard keeps them
 * off Drafts without each having to be opened first. Only drafts already in the browser.
 */
export async function markScrutinyReturns(): Promise<void> {
  const repo = getRepository();
  for (const id of Object.keys(BUILDERS)) {
    const existing = await repo.getDraft(id);
    if (existing && !existing.scrutinyReturn) {
      await repo.putDraft({ ...existing, scrutinyReturn: { resubmittedAt: null } });
    }
  }
}
