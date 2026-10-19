import { COURT_PROFILES } from "@/lib/court/profiles";
import { GUJARAT_FEES } from "@/lib/court/fees";
import {
  blankAccused,
  blankCheque,
  blankComplainant,
  blankContact,
  blankNotice,
  blankRepresentative,
  blankWitness,
  buildDocumentGroups,
  createBlankDraft,
  intakeChequeGroup,
  intakePartyGroup,
} from "@/lib/filing/blank";
import { feeBill, oathTakerName, signatories } from "@/lib/filing/selectors";
import type {
  Accused,
  Address,
  AdrPrayer,
  ChequeDetails,
  Complainant,
  DemandNotice,
  DocExtract,
  FilingDraft,
  IntakeDocType,
  IntakeSlot,
  Jurisdiction,
  PaperFallbackReason,
  SignInstrument,
  Witness,
} from "@/lib/filing/types";
import type { BundleDoc, HistoryEvent } from "@/lib/employee/scrutiny/types";

/**
 * SANDBOX DATA — the filings behind the scrutiny queue, as e-filing drafts.
 *
 * Each queue row opens a draft of exactly the shape the e-filing form writes, so the
 * officer's field list is the form's own (`from-draft.ts`) and a field added to the form
 * shows up here without anyone remembering to copy it. Between them the cases walk every
 * branch the form has: an individual and an institution complainant, a PoA holder, a
 * permanent address that differs, two complainants and two advocates, an institution
 * accused with persons summoned under S-141, several contacts and addresses, two cheques,
 * a notice returned unserved, a part payment, a reply on file, another complaint pending,
 * a cheque deposited by the drawer's bank, a filing out of time, witnesses by name and by
 * designation, digital and paper signing, and one filing that was never machine-read.
 *
 * Every party, number and address here is fictional. Gujarat's deployment (Ahmedabad)
 * signs with every advocate, and — as a prototype setting, not a decision (`Q-6`) — with
 * each complainant's oath, so the signatures are generated under its rules.
 */

export const SCRUTINY_SIGNING = COURT_PROFILES.gujarat.signing;

/* ── building blocks ─────────────────────────────────────────────────────── */

/** `[left, top, width, height]` in percent of the page, as the scans were measured. */
type Pct = readonly [number, number, number, number];
/** A reading: the value found, and where on the page — or only the value. */
type Read = Record<string, string | readonly [string, Pct]>;

/** Readings are stored the way the engine reports them: pixel boxes on a page. */
const PAGE = { width: 1000, height: 1000 };

function extract(read: Read): DocExtract {
  const fields: DocExtract["fields"] = {};
  for (const [key, entry] of Object.entries(read)) {
    if (typeof entry === "string") {
      fields[key] = { value: entry, confidence: 88 };
      continue;
    }
    const [value, [left, top, width, height]] = entry;
    fields[key] = {
      value,
      confidence: 91,
      box: {
        x0: left * 10,
        y0: top * 10,
        x1: (left + width) * 10,
        y1: (top + height) * 10,
      },
    };
  }
  return { engine: "tesseract", confidence: 89, page: PAGE, fields, extractedAt: "" };
}

const FILE_STEM: Record<IntakeDocType, [string, string, string]> = {
  "cheque-front": ["cheque-front", "JPG", "image/jpeg"],
  "return-memo": ["return-memo", "PDF", "application/pdf"],
  "demand-notice": ["demand-notice", "PDF", "application/pdf"],
  "dispatch-proof": ["postal-receipt", "JPG", "image/jpeg"],
  "delivery-proof": ["ad-card", "JPG", "image/jpeg"],
  "notice-reply": ["reply-to-notice", "PDF", "application/pdf"],
  "id-proof": ["aadhaar", "JPG", "image/jpeg"],
  poa: ["power-of-attorney", "PDF", "application/pdf"],
  vakalatnama: ["vakalatnama", "PDF", "application/pdf"],
  other: ["document", "PDF", "application/pdf"],
  supporting: ["invoice", "PDF", "application/pdf"],
};

function upload(slot: IntakeSlot, read?: Read, poor?: boolean) {
  const [stem, ext, type] = FILE_STEM[slot.docType];
  const suffix = /\d+/.exec(slot.key)?.[0] ?? "1";
  slot.file = {
    id: `file-${slot.key}`,
    name: `${stem}${suffix === "1" ? "" : `-${suffix}`}.${ext.toLowerCase()}`,
    size: 240_000,
    type,
    ext,
  };
  if (read) slot.extract = extract(read);
  if (poor) slot.poor = true;
}

function addr(line1: string, city: string, pin: string, district = "Ahmedabad"): Address {
  return { line1, city, pin, district, state: "Gujarat" };
}

/* Where each value sits on the page shapes the bundle draws, so a reading's halo lands
   in the same place on every case. Measured off the hand-authored case's scans. */
const AT = {
  chequeNumber: [25, 77, 52, 16],
  dateOnCheque: [69, 1, 30, 17],
  amount: [66, 25, 33, 19],
  ifsc: [36, 7, 32, 10],
  bankName: [1, 2, 34, 17],
  presentDate: [71, 9, 27, 7],
  returnDate: [71, 17, 27, 7],
  returnReason: [3, 83, 48, 11],
  noticeDate: [26, 87, 42, 6],
  dispatchDate: [10, 22, 40, 8],
  modeService: [10, 10, 50, 8],
  tracking: [10, 34, 60, 8],
  deliveryDate: [55, 60, 35, 8],
  name: [30, 28, 50, 8],
  age: [30, 40, 20, 8],
  address: [2, 23, 53, 42],
} as const satisfies Record<string, Pct>;

/** The readings a clean pass over one cheque's uploads would have made. */
function cleanReads(c: ChequeDetails, n: DemandNotice): Record<string, Read> {
  return {
    f: {
      chequeNumber: [c.chequeNumber, AT.chequeNumber],
      dateOnCheque: [c.dateOnCheque, AT.dateOnCheque],
      amount: [c.amount, AT.amount],
      ifsc: [c.ifsc, AT.ifsc],
      bankName: [c.bankName, AT.bankName],
      bankBranch: c.bankBranch,
    },
    m: {
      presentDate: [c.presentDate, AT.presentDate],
      returnDate: [c.returnDate, AT.returnDate],
      returnReason: [c.returnReason, AT.returnReason],
    },
    dn: { dispatchDate: [n.dispatchDate, AT.noticeDate] },
    dp: {
      dispatchDate: [n.dispatchDate, AT.dispatchDate],
      modeService: [n.modeService, AT.modeService],
      tracking: [n.tracking, AT.tracking],
    },
    ad: n.delivered === "yes" ? { deliveryDate: [n.deliveryDate, AT.deliveryDate] } : {},
  };
}

/* ── one filing ──────────────────────────────────────────────────────────── */

interface Spec {
  no: string;
  /** When the complaint was filed — IST date. */
  filed: string;
  complainants: Partial<Complainant>[];
  advocates: { name: string; barNumber: string; forComplainants: number[] }[];
  accused: Partial<Accused>[];
  cheques: Partial<ChequeDetails>[];
  notices: Partial<DemandNotice>[];
  jurisdiction: Partial<Jurisdiction>;
  adr?: Partial<AdrPrayer>;
  witnesses?: Partial<Witness>[];
  affidavit?: string;
  /** No document reading ran on this filing. */
  notRead?: boolean;
  /** Readings that differ from a clean pass, by intake slot key. `null` drops a reading. */
  reads?: Record<string, Record<string, string | readonly [string, Pct] | null>>;
  /** Optional uploads that were made (the reply, the supporting document). */
  optional?: string[];
  poor?: string[];
  sign: {
    instrument: SignInstrument;
    paperReason?: PaperFallbackReason;
    at: string;
  };
  /**
   * A correction round already went through: the complaint was signed again at
   * `signedAt` and resubmitted at `resubmittedAt`. Its oaths were not flagged, so they
   * carried over from `sign.at` (`OTH-5`).
   */
  resubmission?: { signedAt: string; resubmittedAt: string };
}

function build(spec: Spec): FilingDraft {
  const draft = createBlankDraft(`scrutiny-${spec.no}`);
  const key = spec.no.replace(/\W/g, "");

  draft.complainants = spec.complainants.map((over, i) => ({
    ...blankComplainant(),
    ...over,
    id: `${key}-c${i + 1}`,
  }));
  draft.advocates = spec.advocates.map((a, i) => ({ id: `${key}-adv${i + 1}`, ...a }));
  draft.accused = spec.accused.map((over, i) => ({
    ...blankAccused(),
    ...over,
    id: `${key}-a${i + 1}`,
  }));
  draft.cheques = spec.cheques.map((over, i) => ({
    ...blankCheque(),
    ...over,
    id: `${key}-q${i + 1}`,
  }));
  draft.notices = spec.notices.map((over, i) => ({
    ...blankNotice(),
    ...over,
    id: `${key}-n${i + 1}`,
  }));
  draft.jurisdiction = { ...draft.jurisdiction, ...spec.jurisdiction };
  draft.adr = { ...draft.adr, ...spec.adr };
  draft.witnesses = (spec.witnesses ?? []).map((over, i) => ({
    ...blankWitness(),
    ...over,
    id: `${key}-w${i + 1}`,
  }));
  draft.affidavit = spec.affidavit ?? "";

  // Intake: one group per cheque and per complainant, every required upload made.
  draft.intake.cheques = draft.cheques.map((_, i) => intakeChequeGroup(i + 1));
  draft.intake.parties = draft.complainants.map((_, i) => intakePartyGroup(i + 1));
  const optional = new Set(spec.optional ?? []);
  const poor = new Set(spec.poor ?? []);

  draft.cheques.forEach((c, i) => {
    const clean = cleanReads(c, draft.notices[i] ?? blankNotice());
    for (const slot of draft.intake.cheques[i].slots) {
      if (!slot.required && !optional.has(slot.key)) continue;
      const kind = slot.key.replace(/^c\d+/, "");
      const base = (clean[kind] ?? {}) as Read;
      const changes = spec.reads?.[slot.key] ?? {};
      const read: Read = { ...base };
      for (const [k, v] of Object.entries(changes)) {
        if (v === null) delete read[k];
        else read[k] = v;
      }
      upload(slot, spec.notRead ? undefined : read, poor.has(slot.key));
    }
  });
  draft.complainants.forEach((c, i) => {
    for (const slot of draft.intake.parties[i].slots) {
      const needed =
        slot.docType === "id-proof" ||
        (slot.docType === "vakalatnama" && c.pip !== "yes") ||
        (slot.docType === "poa" && c.poa === "yes") ||
        optional.has(slot.key);
      if (!needed) continue;
      let read: Read | undefined;
      if (slot.docType === "id-proof" && c.type === "individual") {
        read = {
          name: [c.name, AT.name],
          age: [c.age, AT.age],
          address: [c.res.line1, AT.address],
        };
        for (const [k, v] of Object.entries(spec.reads?.[slot.key] ?? {})) {
          if (v === null) delete read[k];
          else read[k] = v;
        }
      }
      upload(slot, spec.notRead ? undefined : read, poor.has(slot.key));
    }
  });
  for (const slot of draft.intake.supporting) {
    if (optional.has(slot.key)) upload(slot);
  }
  draft.documents = buildDocumentGroups(draft).map((g) => ({
    ...g,
    docs: g.docs.map((d, k) => ({ ...d, id: `${key}-${g.id}-doc${k + 1}` })),
  }));

  // Signed, oath taken and paid the day before it was filed.
  const at = spec.sign.at;
  const paper = spec.sign.instrument === "paper";
  draft.sign.mode = paper ? "upload" : "digital";
  draft.sign.requestedAt = at;
  if (paper) {
    draft.sign.paperFallback = { reason: spec.sign.paperReason ?? "other", at };
    draft.sign.signedCopy = {
      id: `file-${key}-signed`,
      name: "signed-complaint.pdf",
      size: 1_800_000,
      type: "application/pdf",
      ext: "PDF",
    };
  }
  const { complainants, advocates } = signatories(
    draft,
    null,
    SCRUTINY_SIGNING.oath,
    SCRUTINY_SIGNING.everyAdvocate,
  );
  const signedAt = spec.resubmission?.signedAt ?? at;
  for (const s of [...complainants, ...advocates]) {
    draft.sign.signed[s.id] = { at: signedAt, with: spec.sign.instrument };
  }
  // One oath per complainant, by whoever signed for them (`OTH-3`); advocates take none.
  for (const s of complainants) {
    draft.sign.oaths[s.id] = {
      at,
      by: oathTakerName(draft, s.id),
      video: {
        file: {
          id: `file-${s.id}-oath`,
          name: "oath.mp4",
          size: 6_400_000,
          type: "video/mp4",
          ext: "MP4",
        },
        durationSeconds: 48,
      },
    };
  }
  if (paper) {
    draft.complainants.forEach((c) => {
      const tail = c.type === "institution" ? c.rep.mobile : c.poa === "yes" ? c.poaHolder.mobile : c.mobile;
      // Keyed as `phoneConfirmers` keys the row: a PoA holder confirms as themselves.
      const id = c.poa === "yes" ? `poa-${c.id}` : `sig-c-${c.id}`;
      draft.sign.confirmed[id] = { mobileTail: tail.slice(-4), at };
    });
  }
  draft.status = "filed";
  draft.filedAt = `${spec.filed}T05:30:00.000Z`;
  draft.createdAt = at;
  draft.updatedAt = draft.filedAt;
  draft.lastStep = "sign";
  draft.sign.paid = true;
  draft.sign.paidAt = draft.filedAt;
  draft.sign.paidAmount = feeBill(draft, GUJARAT_FEES).total;
  draft.sign.paymentRef = `PAY${key.slice(-8)}`;
  draft.sign.caseFileNumber = spec.no;
  if (spec.resubmission) {
    draft.scrutinyReturn = {
      resubmittedAt: spec.resubmission.resubmittedAt,
      signingFrom: spec.resubmission.signedAt,
    };
  }
  return draft;
}

/* ── the filings ─────────────────────────────────────────────────────────── */

const FINANCE_REASON =
  "Settlement discussions were ongoing between the parties; the accused repeatedly assured payment and sought time, and the complainant filed as soon as it was clear no payment would come.";

const SPECS: Spec[] = [
  /* The hand-authored case: real scans, three machine warnings, a paper signature, and
     a filing years out of time. Its values match its scans and generated pages. */
  {
    no: "F/AHM/2026/00341",
    filed: "2026-07-04",
    complainants: [
      {
        name: "Prateek Agrawal",
        age: "41",
        gender: "male",
        differentlyAbled: "no",
        mobile: "9879044120",
        email: "prateek.agrawal@gmail.com",
        res: addr(
          "B-403, Shyam Avirah, Opp. Vasani International School, Nr. Suyog-99, Nava Naroda",
          "Ahmedabad",
          "382345",
        ),
      },
    ],
    advocates: [{ name: "Bijini Rejen", barNumber: "G/60/1992", forComplainants: [0] }],
    accused: [
      {
        name: "Deepak Choudhary",
        contacts: [{ mobile: "9867566316", email: "" }],
        addresses: [
          { addr: addr("12, Shanti Kunj Society, Naroda", "Ahmedabad", "382330"), police: "Naroda" },
        ],
      },
    ],
    cheques: [
      {
        chequeNumber: "230270",
        dateOnCheque: "2019-04-05",
        amount: "52,05,000",
        ifsc: "SBIN0007558",
        bankName: "State Bank of India",
        bankBranch: "Nava Naroda",
        presentDate: "2016-04-04",
        returnDate: "2016-04-04",
        returnReason: "funds-insufficient",
      },
    ],
    notices: [
      {
        natureDebt: "loan",
        dispatchDate: "2016-04-12",
        modeService: "rpad",
        tracking: "RG482910374IN",
        delivered: "yes",
        deliveryDate: "2016-04-13",
        replied: "no",
        paymentStatus: "none",
      },
    ],
    jurisdiction: {
      deposited: "yes",
      ifsc: "HDFC0001204",
      payeeBankName: "HDFC Bank",
      payeeBankBranch: "Naroda",
      payeePolice: "Naroda",
      causeDate: "2016-04-28",
      filingDate: "2026-07-04",
      condonationReason: FINANCE_REASON,
    },
    adr: { adr: "no" },
    witnesses: [
      {
        fullName: "Rakesh Patel",
        age: "38",
        prove: "Present when the accused handed over the cheque in March 2016.",
        contacts: [{ mobile: "9824011876", email: "" }],
        addresses: [
          { addr: addr("7, Ambika Nagar, Naroda", "Ahmedabad", "382330"), police: "Naroda" },
        ],
      },
    ],
    reads: {
      // The cheque reads ₹50,25,000; the filer kept ₹52,05,000.
      c1f: { amount: ["50,25,000", AT.amount], bankBranch: "Nava Naroda" },
      // The return date is not legible on the memo scan.
      c1m: { returnDate: null },
      // Only the address side of the Aadhaar was uploaded.
      p1id: { name: null, age: null },
    },
    poor: ["affidavit"],
    sign: { instrument: "paper", paperReason: "otp-not-received", at: "2026-07-03T08:52:00.000Z" },
  },

  /* A PoA holder, a permanent address apart from the residential one, two cheques and
     a part payment. Every reading agrees with what was filed. */
  {
    no: "F/AHM/2026/00338",
    filed: "2026-06-01",
    complainants: [
      {
        name: "Meena Shah",
        age: "67",
        gender: "female",
        differentlyAbled: "yes",
        mobile: "9825013377",
        email: "meena.shah61@gmail.com",
        res: addr("21, Sardar Complex, Maninagar", "Ahmedabad", "380008"),
        permSame: "no",
        perm: addr("Shah Niwas, Station Road", "Mehsana", "384001", "Mehsana"),
        poa: "yes",
        poaHolder: {
          mobile: "9898140022",
          name: "Rohan Shah",
          age: "39",
          res: addr("21, Sardar Complex, Maninagar", "Ahmedabad", "380008"),
          permSame: "yes",
          perm: addr("", "", ""),
        },
      },
    ],
    advocates: [{ name: "R. Mehta", barNumber: "G/1184/2004", forComplainants: [0] }],
    accused: [
      {
        name: "Kiran Patel",
        contacts: [{ mobile: "9909321456", email: "kiranpatel.traders@gmail.com" }],
        addresses: [
          { addr: addr("B-12, Swagat Residency, Bopal", "Ahmedabad", "380058"), police: "Bopal" },
        ],
      },
    ],
    cheques: [
      {
        chequeNumber: "418820",
        dateOnCheque: "2026-03-02",
        amount: "6,50,000",
        ifsc: "BARB0MANINA",
        bankName: "Bank of Baroda",
        bankBranch: "Maninagar",
        presentDate: "2026-04-10",
        returnDate: "2026-04-11",
        returnReason: "funds-insufficient",
      },
      {
        chequeNumber: "418821",
        dateOnCheque: "2026-03-15",
        amount: "3,25,000",
        sameAsPrev: "yes",
        ifsc: "BARB0MANINA",
        bankName: "Bank of Baroda",
        bankBranch: "Maninagar",
        presentDate: "2026-04-10",
        returnDate: "2026-04-11",
        returnReason: "exceeds-arrangement",
      },
    ],
    notices: [
      {
        natureDebt: "loan",
        dispatchDate: "2026-04-20",
        modeService: "speed",
        tracking: "EG204517786IN",
        delivered: "yes",
        deliveryDate: "2026-04-24",
        replied: "no",
        paymentStatus: "part",
        partAmount: "1,00,000",
      },
      {
        natureDebt: "loan",
        dispatchDate: "2026-04-20",
        modeService: "speed",
        tracking: "EG204517795IN",
        delivered: "yes",
        deliveryDate: "2026-04-24",
        replied: "no",
        paymentStatus: "none",
      },
    ],
    jurisdiction: {
      deposited: "yes",
      ifsc: "SBIN0002642",
      payeeBankName: "State Bank of India",
      payeeBankBranch: "Maninagar",
      payeePolice: "Maninagar",
      filingDate: "2026-06-01",
    },
    adr: { adr: "maybe", otherDetails: "<p>The accused is the complainant's former tenant.</p>" },
    witnesses: [],
    sign: { instrument: "aadhaar", at: "2026-05-31T06:10:00.000Z" },
    // Sent back once and corrected; the oath was not flagged, so it carried over.
    resubmission: {
      signedAt: "2026-06-08T09:20:00.000Z",
      resubmittedAt: "2026-06-08T10:05:00.000Z",
    },
  },

  /* The filer dismissed a reading of the cheque number. The notice came back unserved,
     and one witness is named by designation. */
  {
    no: "F/AHM/2026/00319",
    filed: "2026-05-15",
    complainants: [
      {
        name: "Nirmala Ben",
        age: "54",
        gender: "female",
        mobile: "9427016655",
        email: "",
        res: addr("44, Krishna Bungalows, Nikol", "Ahmedabad", "382350"),
      },
    ],
    advocates: [{ name: "S. Dave", barNumber: "G/2210/2011", forComplainants: [0] }],
    accused: [
      {
        name: "Girish Thakkar",
        contacts: [{ mobile: "9712208841", email: "" }],
        addresses: [
          { addr: addr("3, Laxmi Park, Vastral", "Ahmedabad", "382418"), police: "Ramol" },
        ],
      },
    ],
    cheques: [
      {
        chequeNumber: "771045",
        dateOnCheque: "2026-02-10",
        amount: "2,40,000",
        ifsc: "ICIC0000221",
        bankName: "ICICI Bank",
        bankBranch: "Nikol",
        presentDate: "2026-03-20",
        returnDate: "2026-03-21",
        returnReason: "payment-stopped",
      },
    ],
    notices: [
      {
        natureDebt: "goods",
        dispatchDate: "2026-03-30",
        modeService: "rpad",
        tracking: "RG118274635IN",
        delivered: "no",
        returnDate: "2026-04-06",
        nonDeliveryReason: "refused",
        replied: "no",
        paymentStatus: "none",
      },
    ],
    jurisdiction: {
      deposited: "yes",
      ifsc: "UTIB0000418",
      payeeBankName: "Axis Bank",
      payeeBankBranch: "Nikol",
      payeePolice: "Nikol",
      filingDate: "2026-05-15",
    },
    adr: { adr: "no" },
    witnesses: [
      {
        fullName: "Suresh Mehta",
        age: "46",
        prove: "Delivered the goods to the accused's shop and holds the delivery challans.",
        contacts: [{ mobile: "9879930021", email: "" }],
        addresses: [
          { addr: addr("12, Nilkanth Society, Nikol", "Ahmedabad", "382350"), police: "Nikol" },
        ],
      },
      {
        designation: "Branch Manager, ICICI Bank, Nikol",
        prove: "That the cheque was returned unpaid on the drawer's instruction.",
        contacts: [blankContact()],
        addresses: [
          { addr: addr("ICICI Bank, Nikol Road", "Ahmedabad", "382350"), police: "Nikol" },
        ],
      },
    ],
    // The MICR band reads 771046.
    reads: { c1f: { chequeNumber: ["771046", AT.chequeNumber] } },
    sign: { instrument: "dsc", at: "2026-05-14T09:40:00.000Z" },
  },

  /* An institution accused: a partnership, its two partners summoned with it, two
     contacts and two addresses. The accused replied, and the debt is backed by invoices. */
  {
    no: "F/AHM/2026/00344",
    filed: "2026-06-25",
    complainants: [
      {
        name: "Alkesh Rana",
        age: "36",
        gender: "male",
        mobile: "9638207714",
        email: "alkesh.rana@outlook.com",
        res: addr("C-9, Shivalik Heights, Satellite", "Ahmedabad", "380015"),
      },
    ],
    advocates: [{ name: "K. Nair", barNumber: "G/3051/2015", forComplainants: [0] }],
    accused: [
      {
        type: "institution",
        entType: "partnership",
        name: "Vishal Enterprises",
        reps: [
          {
            ...blankRepresentative(),
            name: "Vishal Bhatia",
            designation: "Managing partner",
            mobile: "9824455120",
            email: "vishal@vishalenterprises.in",
          },
          {
            ...blankRepresentative(),
            name: "Komal Bhatia",
            designation: "Partner",
            mobile: "9824455121",
            email: "",
          },
        ],
        contacts: [
          { mobile: "7926580044", email: "accounts@vishalenterprises.in" },
          { mobile: "9824455120", email: "" },
        ],
        addresses: [
          {
            addr: addr("Shop 14, Shreeji Arcade, Narol", "Ahmedabad", "382405"),
            police: "Narol",
          },
          {
            addr: addr("Plot 221, GIDC Estate, Vatva", "Ahmedabad", "382445"),
            police: "Vatva GIDC",
          },
        ],
      },
    ],
    cheques: [
      {
        chequeNumber: "009184",
        dateOnCheque: "2026-04-01",
        amount: "11,80,000",
        ifsc: "HDFC0000046",
        bankName: "HDFC Bank",
        bankBranch: "Narol",
        presentDate: "2026-05-02",
        returnDate: "2026-05-04",
        returnReason: "funds-insufficient",
      },
    ],
    notices: [
      {
        natureDebt: "goods",
        dispatchDate: "2026-05-12",
        modeService: "speed",
        tracking: "EG390016452IN",
        delivered: "yes",
        deliveryDate: "2026-05-15",
        replied: "yes",
        paymentStatus: "none",
      },
    ],
    jurisdiction: {
      deposited: "yes",
      ifsc: "KKBK0002560",
      payeeBankName: "Kotak Mahindra Bank",
      payeeBankBranch: "Satellite",
      payeePolice: "Satellite",
      filingDate: "2026-06-25",
    },
    adr: { adr: "yes" },
    witnesses: [
      {
        fullName: "Pooja Nair",
        age: "31",
        prove: "Raised the invoices and kept the ledger for the supplies.",
        contacts: [{ mobile: "9727115540", email: "pooja.n@ranatrading.in" }],
        addresses: [
          {
            addr: addr("B-2, Aakash Flats, Jodhpur", "Ahmedabad", "380015"),
            police: "Satellite",
          },
        ],
      },
    ],
    optional: ["c1rp", "sl"],
    sign: { instrument: "aadhaar", at: "2026-06-24T11:05:00.000Z" },
  },

  /* Never machine-read: every upload is on file and nothing was extracted from it. The
     cheque was presented through the drawer's own bank, and another complaint is
     pending between the same parties. */
  {
    no: "F/AHM/2026/00335",
    filed: "2026-06-08",
    notRead: true,
    complainants: [
      {
        name: "Hetal Modi",
        age: "29",
        gender: "female",
        differentlyAbled: "no",
        mobile: "9974401285",
        email: "hetal.modi@gmail.com",
        res: addr("17, Gulmohar Park, Ghatlodia", "Ahmedabad", "380061"),
      },
    ],
    advocates: [{ name: "T. Bhatt", barNumber: "G/4410/2019", forComplainants: [0] }],
    accused: [
      {
        name: "Jayesh Solanki",
        contacts: [{ mobile: "9825660713", email: "" }],
        addresses: [
          { addr: addr("8, Shiv Kutir, Chandkheda", "Ahmedabad", "382424"), police: "Chandkheda" },
        ],
      },
    ],
    cheques: [
      {
        chequeNumber: "552301",
        dateOnCheque: "2026-03-05",
        amount: "4,00,000",
        ifsc: "PUNB0142200",
        bankName: "Punjab National Bank",
        bankBranch: "Chandkheda",
        presentDate: "2026-04-15",
        returnDate: "2026-04-16",
        returnReason: "account-closed",
      },
    ],
    notices: [
      {
        natureDebt: "borrowed",
        dispatchDate: "2026-04-25",
        modeService: "courier",
        tracking: "DTDC-Z71540226",
        delivered: "yes",
        deliveryDate: "2026-04-28",
        replied: "no",
        paymentStatus: "none",
      },
    ],
    jurisdiction: {
      deposited: "no",
      drawerPolice: "Chandkheda",
      otherPending: "yes",
      otherCases: [{ court: "Chief Judicial Magistrate, Ahmedabad (Rural)", caseNumber: "CC/1182/2025" }],
      filingDate: "2026-06-08",
    },
    adr: { adr: "no" },
    witnesses: [],
    sign: { instrument: "aadhaar", at: "2026-06-07T07:20:00.000Z" },
  },

  /* Out of time by twelve days, with a condonation prayer; a proprietorship accused; and
     a return memo scanned too faintly to trust. */
  {
    no: "F/AHM/2026/00311",
    filed: "2026-05-12",
    complainants: [
      {
        name: "Dinesh Raval",
        age: "58",
        gender: "male",
        mobile: "9426122870",
        email: "",
        res: addr("5, Ramdev Nagar, Vejalpur", "Ahmedabad", "380051"),
      },
    ],
    advocates: [{ name: "Bijini Rejen", barNumber: "G/60/1992", forComplainants: [0] }],
    accused: [
      {
        type: "institution",
        entType: "proprietorship",
        name: "Falgun Traders",
        reps: [
          {
            ...blankRepresentative(),
            name: "Falgun Mehta",
            designation: "Proprietor",
            mobile: "9879012280",
            email: "falguntraders@gmail.com",
          },
        ],
        contacts: [{ mobile: "9879012280", email: "falguntraders@gmail.com" }],
        addresses: [
          { addr: addr("22, Kalupur Cloth Market", "Ahmedabad", "380002"), police: "Kalupur" },
        ],
      },
    ],
    cheques: [
      {
        chequeNumber: "106642",
        dateOnCheque: "2026-01-20",
        amount: "8,75,000",
        ifsc: "SBIN0000425",
        bankName: "State Bank of India",
        bankBranch: "Kalupur",
        presentDate: "2026-03-02",
        returnDate: "2026-03-03",
        returnReason: "funds-insufficient",
      },
    ],
    notices: [
      {
        natureDebt: "business",
        dispatchDate: "2026-03-12",
        modeService: "rpad",
        tracking: "RG220187450IN",
        delivered: "yes",
        deliveryDate: "2026-03-16",
        replied: "no",
        paymentStatus: "none",
      },
    ],
    jurisdiction: {
      deposited: "yes",
      ifsc: "BKID0002001",
      payeeBankName: "Bank of India",
      payeeBankBranch: "Vejalpur",
      payeePolice: "Vejalpur",
      filingDate: "2026-05-12",
      condonationReason:
        "The complainant was hospitalised from 2 April to 28 April 2026 and could not instruct counsel; discharge papers are on file.",
    },
    adr: { adr: "no" },
    witnesses: [],
    poor: ["c1m"],
    sign: { instrument: "aadhaar", at: "2026-05-11T10:30:00.000Z" },
  },

  /* An institution complainant — a finance company acting through its manager — whose
     id proof is a company document, so nothing about the person is read from it. */
  {
    no: "F/AHM/2026/00298",
    filed: "2026-05-28",
    complainants: [
      {
        type: "institution",
        entType: "private-limited",
        entName: "Shree Ganesh Finance Pvt. Ltd.",
        entCinPan: "U65921GJ2009PTC058214",
        entPhone: "7940308800",
        entEmail: "legal@shreeganeshfinance.in",
        entAddr: addr("4th Floor, Sakar II, Ellisbridge", "Ahmedabad", "380006"),
        rep: {
          ...blankRepresentative(),
          mobile: "9898771200",
          name: "Bhavna Desai",
          age: "44",
          email: "bhavna.desai@shreeganeshfinance.in",
          gender: "female",
          differentlyAbled: "no",
        },
      },
    ],
    advocates: [{ name: "P. Joshi", barNumber: "G/1907/2008", forComplainants: [0] }],
    accused: [
      {
        name: "Umesh Parmar",
        contacts: [{ mobile: "9537720146", email: "" }],
        addresses: [
          { addr: addr("31, Bhagyoday Society, Odhav", "Ahmedabad", "382415"), police: "Odhav" },
        ],
      },
    ],
    cheques: [
      {
        chequeNumber: "340077",
        dateOnCheque: "2026-02-25",
        amount: "1,62,450",
        ifsc: "CNRB0002688",
        bankName: "Canara Bank",
        bankBranch: "Odhav",
        presentDate: "2026-04-06",
        returnDate: "2026-04-07",
        returnReason: "funds-insufficient",
      },
    ],
    notices: [
      {
        natureDebt: "loan",
        dispatchDate: "2026-04-15",
        modeService: "rpad",
        tracking: "RG330945128IN",
        delivered: "yes",
        deliveryDate: "2026-04-18",
        replied: "no",
        paymentStatus: "none",
      },
    ],
    jurisdiction: {
      deposited: "yes",
      ifsc: "HDFC0000001",
      payeeBankName: "HDFC Bank",
      payeeBankBranch: "Ellisbridge",
      payeePolice: "Ellisbridge",
      filingDate: "2026-05-28",
    },
    adr: { adr: "yes" },
    witnesses: [],
    sign: { instrument: "aadhaar", at: "2026-05-27T05:45:00.000Z" },
  },

  /* Two complainants on a joint account, with an advocate each and one for both. */
  {
    no: "F/AHM/2026/00276",
    filed: "2026-04-02",
    complainants: [
      {
        name: "Ashok Vyas",
        age: "62",
        gender: "male",
        mobile: "9824038812",
        email: "ashokvyas.amd@gmail.com",
        res: addr("12, Pushpak Bungalows, Vastrapur", "Ahmedabad", "380054"),
      },
      {
        name: "Sunita Vyas",
        age: "59",
        gender: "female",
        mobile: "9824038813",
        email: "",
        res: addr("12, Pushpak Bungalows, Vastrapur", "Ahmedabad", "380054"),
      },
    ],
    advocates: [
      { name: "S. Dave", barNumber: "G/2210/2011", forComplainants: [0, 1] },
      { name: "N. Trivedi", barNumber: "G/5120/2021", forComplainants: [1] },
    ],
    accused: [
      {
        name: "Nilesh Chauhan",
        contacts: [{ mobile: "9909877231", email: "nilesh.c@gmail.com" }],
        addresses: [
          { addr: addr("7, Parshwa Flats, Paldi", "Ahmedabad", "380007"), police: "Paldi" },
        ],
      },
    ],
    cheques: [
      {
        chequeNumber: "602118",
        dateOnCheque: "2026-01-05",
        amount: "15,00,000",
        ifsc: "SBIN0003080",
        bankName: "State Bank of India",
        bankBranch: "Paldi",
        presentDate: "2026-02-10",
        returnDate: "2026-02-11",
        returnReason: "funds-insufficient",
      },
    ],
    notices: [
      {
        natureDebt: "loan",
        dispatchDate: "2026-02-20",
        modeService: "rpad",
        tracking: "RG640021339IN",
        delivered: "yes",
        deliveryDate: "2026-02-23",
        replied: "no",
        paymentStatus: "none",
      },
    ],
    jurisdiction: {
      deposited: "yes",
      ifsc: "SBIN0001046",
      payeeBankName: "State Bank of India",
      payeeBankBranch: "Vastrapur",
      payeePolice: "Vastrapur",
      filingDate: "2026-04-02",
    },
    adr: { adr: "no" },
    witnesses: [],
    sign: { instrument: "aadhaar", at: "2026-04-01T06:00:00.000Z" },
  },

  {
    no: "F/AHM/2026/00265",
    filed: "2026-03-05",
    complainants: [
      {
        name: "Ila Pandya",
        age: "47",
        gender: "female",
        mobile: "9879205561",
        email: "ila.pandya@yahoo.co.in",
        res: addr("2, Saket Row Houses, Bodakdev", "Ahmedabad", "380054"),
      },
    ],
    advocates: [{ name: "K. Nair", barNumber: "G/3051/2015", forComplainants: [0] }],
    accused: [
      {
        name: "Mahendra Shah",
        contacts: [{ mobile: "9426511804", email: "" }],
        addresses: [
          { addr: addr("19, Ratnadeep Society, Naranpura", "Ahmedabad", "380013"), police: "Naranpura" },
        ],
      },
    ],
    cheques: [
      {
        chequeNumber: "880412",
        dateOnCheque: "2025-12-01",
        amount: "75,000",
        ifsc: "UBIN0531308",
        bankName: "Union Bank of India",
        bankBranch: "Naranpura",
        presentDate: "2026-01-12",
        returnDate: "2026-01-13",
        returnReason: "funds-insufficient",
      },
    ],
    notices: [
      {
        natureDebt: "services",
        dispatchDate: "2026-01-22",
        modeService: "speed",
        tracking: "EG118843002IN",
        delivered: "yes",
        deliveryDate: "2026-01-27",
        replied: "no",
        paymentStatus: "none",
      },
    ],
    jurisdiction: {
      deposited: "yes",
      ifsc: "HDFC0000141",
      payeeBankName: "HDFC Bank",
      payeeBankBranch: "Bodakdev",
      payeePolice: "Vastrapur",
      filingDate: "2026-03-05",
    },
    adr: { adr: "yes" },
    witnesses: [],
    sign: { instrument: "aadhaar", at: "2026-03-04T08:15:00.000Z" },
  },
];

/* ── what the scrutiny case reads ────────────────────────────────────────── */

export interface MockFiling {
  draft: FilingDraft;
  /** Pages with something real to show (the authored case only). */
  pages?: Record<string, Pick<BundleDoc, "kind" | "src">>;
  poorScans?: string[];
  /** A hand-written history, when the derived one would not tell this case's story. */
  history?: { events: HistoryEvent[]; summary: string; round: number };
}

/** The authored case's real scans and legible generated pages. */
const HERO_PAGES: Record<string, Pick<BundleDoc, "kind" | "src">> = {
  synopsis: { kind: "generated" },
  complaint: { kind: "generated" },
  affidavit: { kind: "scan" },
  c1f: { kind: "image", src: "/employee/bundle/cheque.jpg" },
  c1m: { kind: "image", src: "/employee/bundle/memo.jpg" },
  c1dn: { kind: "image", src: "/employee/bundle/notice.jpg" },
  p1id: { kind: "image", src: "/employee/bundle/aadhaar.jpg" },
};

let cache: Map<string, MockFiling> | null = null;

/** The filing behind a queue row, as e-filing wrote it — `undefined` for a PSA matter. */
export function mockFiling(no: string): MockFiling | undefined {
  if (!cache) {
    cache = new Map(
      SPECS.map((spec) => [
        spec.no,
        {
          draft: build(spec),
          poorScans: spec.poor,
          ...(spec.no === "F/AHM/2026/00341" ? { pages: HERO_PAGES } : {}),
        },
      ]),
    );
  }
  return cache.get(no);
}
