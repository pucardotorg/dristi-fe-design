/**
 * Every other application waiting on the bench — the third review queue, as data.
 *
 * The sibling of `rescheduling-request.ts` and `delay-condonation.ts`: those two
 * modules are one kind of application each, and this one is the rest. It shares the
 * court-side vocabulary — counsel, sides, the cause title, the page sizes, the stage
 * labels — rather than restating it. Only the citizen side is off limits (see
 * `content.ts`).
 *
 * **"Others" is not "everything except the two rows above it in the rail."** The
 * reference's Others table lists rows of type `RE_SCHEDULE` and `DELAY_CONDONATION`
 * alongside the rest, so this is the court's view of *all* applications, and the type
 * list keeps reschedule for that reason. The two narrower queues are that same body of
 * work pre-filtered for the bench, not slices carved out of it.
 *
 * **There is no backend.** `OTHER_APPLICATIONS_QUEUE` is demo data shaped to exercise
 * what the screen has to survive: every application type at least once, every stage the
 * filter offers, the two longest type labels in the vocabulary, a corporate accused long
 * enough to wrap the cause title, sides with several counsel, and applications with no
 * vakalat on record at all. No row is read from a case, a court or a queue.
 *
 * **Nothing here decides anything.** Allowing or rejecting an application is a real
 * judicial act and this build performs none, so the table carries no row actions at all
 * (see `OtherApplicationsTable`) — not even disabled ones. The list is honest about what
 * is waiting; the act is simply not offered yet.
 *
 * Numbers follow the stage: `CMP/…` before cognizance is taken, `ST/…` after. These rows
 * do not overlap today's cause list, the scheduling queue, the register queue, the
 * rescheduling queue or the delay-condonation queue.
 */

import { CURRENT_STAFF } from "./content";
import { DELAY_CONDONATION_STAGES, type DelayCondonationStage } from "./delay-condonation";
import {
  applicationFiler,
  causeTitle,
  counselFor,
  formatListingDate,
  parseIsoDay,
  partySideLabel,
  type CounselSide,
  type CourtCounsel,
} from "./hearings";
import { caseSearchKey } from "@/lib/court/localize";
import { localizeForDownload, voicedForDownload } from "@/lib/court/browser";

/**
 * Where a case has reached, across the whole §138 journey — the widest stage list on the
 * court side, because an application can arrive at any point in a case's life.
 *
 * Built on what the narrower queues already own rather than restated: `CASE_STAGES`
 * (`schedule.ts`) owns cognizance→judgement, the six the court lists hearings from, and
 * `DELAY_CONDONATION_STAGES` prepends registration. Four are genuinely new here — the two
 * before a complaint is numbered, and the two after judgement is delivered. A parallel
 * copy of the six that already exist is how two court-side screens end up naming the same
 * stage differently.
 *
 * **Journey order, not the reference's alphabetical.** The reference sorted these
 * A–Z, which puts Judgement above Plea and Scrutiny below Registration. Every other
 * court-side list in this app is ordered the way the process runs
 * (`docs/product/domain/journey.md`), and a court reads stages in process order — so the
 * filter opens in that order and the deviation is deliberate.
 */
export type OtherApplicationStage =
  | "filing"
  | "scrutiny"
  | DelayCondonationStage
  | "post-judgement"
  | "long-pending-register";

export const OTHER_APPLICATION_STAGES: {
  id: OtherApplicationStage;
  label: string;
}[] = [
  { id: "filing", label: "Filing" },
  { id: "scrutiny", label: "Scrutiny" },
  /* Registration, then cognizance→judgement — the delay-condonation list verbatim. */
  ...DELAY_CONDONATION_STAGES,
  { id: "post-judgement", label: "Post-judgement" },
  /**
   * Filed long ago. Not dormant, and not inactive: a matter on the long pending register
   * is one the court has been carrying for years, and it may well have been heard last
   * week. The register exists to surface age, nothing else.
   */
  { id: "long-pending-register", label: "Long pending register" },
];

export function otherApplicationStageLabel(stage: OtherApplicationStage): string {
  return (
    OTHER_APPLICATION_STAGES.find((entry) => entry.id === stage)?.label ?? stage
  );
}

/**
 * What the application asks for.
 *
 * The reference renders raw backend enums in this column — `EXTENSION_SUBMISSION_DEADLINE`,
 * `RE_SCHEDULE`, `DELAY_CONDONATION`, `TRANSFER`. That is a leak, not a pattern: a
 * magistrate should not have to read screaming snake case to find out what is in front of
 * them. The ids below keep the reference's vocabulary and the labels re-case it the way
 * `navigation.ts` already re-cases the reference's Title Case — DS sentence case, one
 * capital at the front.
 *
 * **"Others" is both this screen and one of the types on it.** The rail row is named
 * Others because it is the court's whole application list; the type is named Others
 * because some applications fit no head at all. That collision is the reference's own and
 * it stays — renaming either one would put a word in the court's mouth.
 *
 * A related but **different** list exists on the citizen side:
 * `lib/cases/applications.ts` `APPLICATION_TYPES`, with short labels ("Transfer",
 * "Settlement") for a filing form where the surrounding page already says the word
 * "application". The two are not merged and neither imports the other — `/citizen` is a
 * filer choosing what to submit, this is a court reading a queue of what arrived, and the
 * court's own reference names them at this length.
 */
export type OtherApplicationType =
  | "adding-witnesses"
  | "case-transfer"
  | "case-withdrawal"
  | "checkout-request"
  | "document"
  | "extension-of-submission-deadline"
  | "production-of-documents"
  | "profile-correction"
  | "settlement"
  | "change-power-of-attorney"
  | "reschedule-adjournment"
  | "bail"
  | "others"
  | "submit-bail-documents";

/** In the reference's own order — alphabetical by label, which is how a court finds one of fourteen. */
export const OTHER_APPLICATION_TYPES: {
  id: OtherApplicationType;
  label: string;
}[] = [
  { id: "adding-witnesses", label: "Application for adding witnesses" },
  { id: "case-transfer", label: "Application for case transfer" },
  { id: "case-withdrawal", label: "Application for case withdrawal" },
  { id: "checkout-request", label: "Application for checkout request" },
  /* Not truncated. The reference's own label ends here — it is the head for a document
     asked of the court, and shortening it would invent a distinction. */
  { id: "document", label: "Application for document" },
  {
    id: "extension-of-submission-deadline",
    label: "Application for extension of submission deadline",
  },
  {
    id: "production-of-documents",
    label: "Application for production of documents",
  },
  { id: "profile-correction", label: "Application for profile correction" },
  { id: "settlement", label: "Application for settlement" },
  {
    id: "change-power-of-attorney",
    label: "Application to change power of attorney details",
  },
  {
    id: "reschedule-adjournment",
    label: "Application to reschedule/adjournment",
  },
  { id: "bail", label: "Bail" },
  { id: "others", label: "Others" },
  { id: "submit-bail-documents", label: "Submit bail documents" },
];

export function otherApplicationTypeLabel(type: OtherApplicationType): string {
  return OTHER_APPLICATION_TYPES.find((entry) => entry.id === type)?.label ?? type;
}

export type OtherApplication = {
  id: string;
  caseNumber: string;
  parties: { complainant: string; accused: string };
  /**
   * Counsel on record. An application filed before the complaint is numbered may have
   * none — it has been submitted, not yet taken on file, and a vakalat is not a given.
   * The cell then shows nothing rather than a dash: an empty advocates column on the
   * reference was an absence, not a missing value.
   */
  counsel: CourtCounsel[];
  stage: OtherApplicationStage;
  type: OtherApplicationType;
  /** ISO day the application reached the court. */
  appliedOn: string;
  /** The side that filed it — either may apply, whatever the case is about. */
  filedFor: CounselSide;
  /** Why the application is made, in the filer's words. */
  reason: string;
};

/**
 * The applications this court has in front of it.
 *
 * Ordered the way the court received them, so the opening page mixes stages and types —
 * unlike the delay-condonation queue, whose reference opened on a run of Registration
 * rows. The first page is deliberately the hard one: it carries both of the very long
 * type labels, the longest corporate accused, and an application with no counsel at all.
 *
 * Names follow the fixtures the rest of the court side uses: local parties and the same
 * bar, but not the same matters as `CAUSE_LIST`, `SCHEDULING_QUEUE`, `REGISTER_QUEUE`,
 * `RESCHEDULING_QUEUE` or `DELAY_CONDONATION_QUEUE`.
 */
export const OTHER_APPLICATIONS_QUEUE: OtherApplication[] = [
  {
    id: "oa-2101",
    caseNumber: "CMP/2101/2025",
    parties: { complainant: "Sarala", accused: "Kannanalloor Coir Works" },
    counsel: [{ name: "Adv. Suresh Menon", side: "complainant" }],
    stage: "filing",
    type: "extension-of-submission-deadline",
    appliedOn: "2025-11-04",
    filedFor: "complainant",
    reason:
      "The complainant asks for a further fortnight to file the bank certificate the registry called for.",
  },
  {
    id: "oa-2104",
    caseNumber: "CMP/2104/2025",
    parties: {
      complainant: "Prabhakaran",
      accused: "Ezhukone Agro Ventures and Warehousing Company Pvt Ltd",
    },
    counsel: [
      { name: "Adv. Anitha George", side: "complainant" },
      { name: "Adv. Nisha Thomas", side: "complainant" },
    ],
    stage: "filing",
    type: "change-power-of-attorney",
    appliedOn: "2025-11-07",
    filedFor: "complainant",
    reason:
      "The power of attorney holder who signed the complaint has left the company's service.",
  },
  {
    id: "oa-2109",
    caseNumber: "CMP/2109/2025",
    parties: { complainant: "Sosamma", accused: "Ayathil Steel Mart" },
    counsel: [],
    stage: "filing",
    type: "document",
    appliedOn: "2025-11-11",
    filedFor: "complainant",
    reason:
      "The complainant, appearing without counsel, seeks a copy of the returned papers to make good the objections.",
  },
  {
    id: "oa-2113",
    caseNumber: "CMP/2113/2025",
    parties: {
      complainant: "Chandrasekharan",
      accused: "Veliyam Rubber Traders",
    },
    counsel: [{ name: "Adv. Latha Krishnan", side: "complainant" }],
    stage: "filing",
    type: "profile-correction",
    appliedOn: "2025-11-14",
    filedFor: "complainant",
    reason:
      "The complainant's name is spelt differently in the complaint and in the bank records, and the two must agree.",
  },
  {
    id: "oa-2117",
    caseNumber: "CMP/2117/2025",
    parties: { complainant: "Kunjumon", accused: "Perumpuzha Rice Mill" },
    counsel: [{ name: "Adv. Rekha Pillai", side: "complainant" }],
    stage: "scrutiny",
    type: "extension-of-submission-deadline",
    appliedOn: "2025-11-18",
    filedFor: "complainant",
    reason:
      "The objections raised on scrutiny need documents from the drawee bank, which has asked for two weeks.",
  },
  {
    id: "oa-2122",
    caseNumber: "CMP/2122/2025",
    parties: { complainant: "Sivadasan", accused: "Elampalloor Hardware" },
    counsel: [],
    stage: "scrutiny",
    type: "document",
    appliedOn: "2025-11-21",
    filedFor: "complainant",
    reason:
      "The complainant, appearing without counsel, asks for the scrutiny objections in writing before answering them.",
  },
  {
    id: "oa-2126",
    caseNumber: "CMP/2126/2025",
    parties: { complainant: "Padmini", accused: "Thrikkadavoor Cold Storage" },
    counsel: [{ name: "Adv. Feroz Hameed", side: "complainant" }],
    stage: "scrutiny",
    type: "profile-correction",
    appliedOn: "2025-11-25",
    filedFor: "complainant",
    reason:
      "The address recorded at filing is of the complainant's former place of business.",
  },
  {
    id: "oa-2131",
    caseNumber: "CMP/2131/2025",
    parties: { complainant: "Sarasamma", accused: "Kalluvathukkal Feeds" },
    counsel: [{ name: "Adv. Saurabh Verma", side: "complainant" }],
    stage: "scrutiny",
    type: "others",
    appliedOn: "2025-11-28",
    filedFor: "complainant",
    reason:
      "The complainant asks that the two complaints against the same drawer be scrutinised together.",
  },
  {
    id: "oa-2136",
    caseNumber: "CMP/2136/2025",
    parties: { complainant: "Thulasi", accused: "Sooranad Oil Mill" },
    counsel: [{ name: "Adv. Suresh Menon", side: "complainant" }],
    stage: "registration",
    type: "case-transfer",
    appliedOn: "2025-12-02",
    filedFor: "complainant",
    reason:
      "The complainant asks that this case be heard along with the connected matter pending in another court in the district.",
  },
  {
    id: "oa-2141",
    caseNumber: "CMP/2141/2025",
    parties: { complainant: "Mercy", accused: "Poruvazhy Tile Works" },
    counsel: [{ name: "Adv. Anitha George", side: "complainant" }],
    stage: "registration",
    type: "change-power-of-attorney",
    appliedOn: "2025-12-05",
    filedFor: "complainant",
    reason:
      "The firm has replaced the partner authorised to conduct this case.",
  },
  {
    id: "oa-2147",
    caseNumber: "CMP/2147/2025",
    parties: {
      complainant: "Annamma",
      accused: "Clappana Marine Stores and General Trading Company",
    },
    counsel: [
      { name: "Adv. Nisha Thomas", side: "complainant" },
      { name: "Adv. Latha Krishnan", side: "complainant" },
    ],
    stage: "registration",
    type: "document",
    appliedOn: "2025-12-09",
    filedFor: "complainant",
    reason:
      "The complainant seeks a copy of the registration entry to produce before the bank.",
  },
  {
    id: "oa-2153",
    caseNumber: "CMP/2153/2025",
    parties: { complainant: "Philomina", accused: "Vellimon Cement Depot" },
    counsel: [],
    stage: "registration",
    type: "case-withdrawal",
    appliedOn: "2025-12-12",
    filedFor: "complainant",
    reason:
      "The drawer has paid the cheque amount in full and the complainant, appearing without counsel, asks to withdraw the complaint.",
  },
  {
    id: "oa-951",
    caseNumber: "CMP/951/2026",
    parties: { complainant: "Sulochana", accused: "Panmana Cashew Company" },
    counsel: [{ name: "Adv. Rekha Pillai", side: "complainant" }],
    stage: "cognizance",
    type: "adding-witnesses",
    appliedOn: "2026-02-03",
    filedFor: "complainant",
    reason:
      "Two officials of the drawee bank were identified only after the complaint was taken on file.",
  },
  {
    id: "oa-955",
    caseNumber: "CMP/955/2026",
    parties: { complainant: "Kochurani", accused: "Mukhathala Auto Works" },
    counsel: [{ name: "Adv. Feroz Hameed", side: "complainant" }],
    stage: "cognizance",
    type: "reschedule-adjournment",
    appliedOn: "2026-02-06",
    filedFor: "complainant",
    reason:
      "Counsel for the complainant is before another bench on the date fixed for cognizance.",
  },
  {
    id: "oa-958",
    caseNumber: "CMP/958/2026",
    parties: { complainant: "Sabu", accused: "Pallithottam Ice Plant" },
    counsel: [{ name: "Adv. Saurabh Verma", side: "complainant" }],
    stage: "cognizance",
    type: "checkout-request",
    appliedOn: "2026-02-10",
    filedFor: "complainant",
    reason:
      "Counsel asks to check the file out to prepare the complainant for the sworn statement.",
  },
  {
    id: "oa-962",
    caseNumber: "CMP/962/2026",
    parties: { complainant: "Divya", accused: "Vadakkumthala Poultry Farm" },
    counsel: [
      { name: "Adv. Suresh Menon", side: "complainant" },
      { name: "Adv. Rekha Pillai", side: "complainant" },
    ],
    stage: "cognizance",
    type: "others",
    appliedOn: "2026-02-13",
    filedFor: "complainant",
    reason:
      "The complainant is outside the country and asks that the sworn statement be recorded by video conference.",
  },
  {
    id: "oa-511",
    caseNumber: "ST/511/2026",
    parties: {
      complainant: "Sethumadhavan",
      accused: "Neendakara Marine Exports",
    },
    counsel: [
      { name: "Adv. Latha Krishnan", side: "complainant" },
      { name: "Adv. Anitha George", side: "accused" },
    ],
    stage: "appearance",
    type: "reschedule-adjournment",
    appliedOn: "2026-04-06",
    filedFor: "accused",
    reason:
      "Counsel for the accused was engaged before the sessions court on the date fixed for appearance.",
  },
  {
    id: "oa-514",
    caseNumber: "ST/514/2026",
    parties: { complainant: "Smitha", accused: "Thodiyoor Poultry Farm" },
    counsel: [
      { name: "Adv. Nisha Thomas", side: "complainant" },
      { name: "Adv. Feroz Hameed", side: "accused" },
    ],
    stage: "appearance",
    type: "bail",
    appliedOn: "2026-04-09",
    filedFor: "accused",
    reason:
      "The accused appears on the warrant issued by this court and asks to be enlarged on bail.",
  },
  {
    id: "oa-517",
    caseNumber: "ST/517/2026",
    parties: { complainant: "Balakrishnan", accused: "Chithara Granites" },
    counsel: [{ name: "Adv. Suresh Menon", side: "complainant" }],
    stage: "appearance",
    type: "submit-bail-documents",
    appliedOn: "2026-04-13",
    filedFor: "accused",
    reason:
      "The accused, appearing without counsel, files the surety's title deed as directed when bail was granted.",
  },
  {
    id: "oa-520",
    caseNumber: "ST/520/2026",
    parties: { complainant: "Sindhu", accused: "Alayamon Estate Supplies" },
    counsel: [
      { name: "Adv. Saurabh Verma", side: "complainant" },
      { name: "Adv. Rekha Pillai", side: "accused" },
    ],
    stage: "appearance",
    type: "profile-correction",
    appliedOn: "2026-04-16",
    filedFor: "accused",
    reason:
      "The address of the accused in the summons is of a branch office that has since closed.",
  },
  {
    id: "oa-523",
    caseNumber: "ST/523/2026",
    parties: { complainant: "Muraleedharan", accused: "Edamulakkal Saw Mill" },
    counsel: [
      { name: "Adv. Anitha George", side: "complainant" },
      { name: "Adv. Latha Krishnan", side: "accused" },
    ],
    stage: "plea",
    type: "bail",
    appliedOn: "2026-04-27",
    filedFor: "accused",
    reason:
      "The accused has surrendered before this court and applies for bail before the plea is taken.",
  },
  {
    id: "oa-527",
    caseNumber: "ST/527/2026",
    parties: { complainant: "Reeja", accused: "Yeroor Plywoods" },
    counsel: [{ name: "Adv. Feroz Hameed", side: "complainant" }],
    stage: "plea",
    type: "adding-witnesses",
    appliedOn: "2026-04-30",
    filedFor: "complainant",
    reason:
      "The complainant seeks to add the bank manager who issued the dishonour memo to the list of witnesses.",
  },
  {
    id: "oa-530",
    caseNumber: "ST/530/2026",
    parties: { complainant: "Basheer", accused: "Kunnathur Steel Traders" },
    counsel: [
      { name: "Adv. Nisha Thomas", side: "complainant" },
      { name: "Adv. Suresh Menon", side: "accused" },
    ],
    stage: "plea",
    type: "submit-bail-documents",
    appliedOn: "2026-05-04",
    filedFor: "accused",
    reason:
      "The salary certificate of the second surety was issued only this week and is filed now.",
  },
  {
    id: "oa-534",
    caseNumber: "ST/534/2026",
    parties: { complainant: "Janaki", accused: "Ummannoor Rubber Works" },
    counsel: [],
    stage: "plea",
    type: "case-transfer",
    appliedOn: "2026-05-07",
    filedFor: "accused",
    reason:
      "The accused, appearing without counsel, asks that this case be heard with the connected matter at the other court.",
  },
  {
    id: "oa-538",
    caseNumber: "ST/538/2026",
    parties: { complainant: "Ayyappan", accused: "Pattazhy Agro Traders" },
    counsel: [
      { name: "Adv. Rekha Pillai", side: "complainant" },
      { name: "Adv. Saurabh Verma", side: "accused" },
    ],
    stage: "evidence",
    type: "production-of-documents",
    appliedOn: "2026-05-18",
    filedFor: "accused",
    reason:
      "The accused asks for production of the complainant's ledger for the period in which the cheque was issued.",
  },
  {
    id: "oa-541",
    caseNumber: "ST/541/2026",
    parties: { complainant: "Chellamma", accused: "Piravanthoor Hill Produce" },
    counsel: [
      { name: "Adv. Latha Krishnan", side: "complainant" },
      { name: "Adv. Nisha Thomas", side: "complainant" },
      { name: "Adv. Feroz Hameed", side: "accused" },
    ],
    stage: "evidence",
    type: "adding-witnesses",
    appliedOn: "2026-05-21",
    filedFor: "accused",
    reason:
      "The accused seeks to examine the person said to have taken delivery of the goods against the cheque.",
  },
  {
    id: "oa-545",
    caseNumber: "ST/545/2026",
    parties: { complainant: "Nazar", accused: "Kottukal Fisheries" },
    counsel: [{ name: "Adv. Anitha George", side: "complainant" }],
    stage: "evidence",
    type: "extension-of-submission-deadline",
    appliedOn: "2026-05-25",
    filedFor: "complainant",
    reason:
      "The complainant asks for further time to file the affidavit of the bank witness.",
  },
  {
    id: "oa-548",
    caseNumber: "ST/548/2026",
    parties: {
      complainant: "Devaki",
      accused: "Mynagappally Coir Mats and Matting Company Pvt Ltd",
    },
    counsel: [
      { name: "Adv. Suresh Menon", side: "complainant" },
      { name: "Adv. Rekha Pillai", side: "accused" },
    ],
    stage: "evidence",
    type: "production-of-documents",
    appliedOn: "2026-05-28",
    filedFor: "complainant",
    reason:
      "The complainant asks the court to call for the statement of the drawer's current account.",
  },
  {
    id: "oa-552",
    caseNumber: "ST/552/2026",
    parties: { complainant: "Salim", accused: "Karicode Engineering Works" },
    counsel: [{ name: "Adv. Saurabh Verma", side: "complainant" }],
    stage: "evidence",
    type: "reschedule-adjournment",
    appliedOn: "2026-06-01",
    filedFor: "complainant",
    reason:
      "The complainant's witness is outside the district on the date fixed for evidence.",
  },
  {
    id: "oa-556",
    caseNumber: "ST/556/2026",
    parties: { complainant: "Ponnamma", accused: "Kalayapuram Textiles" },
    counsel: [
      { name: "Adv. Feroz Hameed", side: "complainant" },
      { name: "Adv. Anitha George", side: "accused" },
    ],
    stage: "arguments",
    type: "settlement",
    appliedOn: "2026-06-15",
    filedFor: "complainant",
    reason:
      "The parties have settled the matter and ask that the terms be recorded before arguments are heard.",
  },
  {
    id: "oa-559",
    caseNumber: "ST/559/2026",
    parties: { complainant: "Jasmine", accused: "Puthur Metal Works" },
    counsel: [{ name: "Adv. Latha Krishnan", side: "complainant" }],
    stage: "arguments",
    type: "case-withdrawal",
    appliedOn: "2026-06-18",
    filedFor: "complainant",
    reason:
      "The cheque amount and costs have been paid and the complainant asks to withdraw the complaint.",
  },
  {
    id: "oa-563",
    caseNumber: "ST/563/2026",
    parties: { complainant: "Gangadharan", accused: "Thattamala Timber Yard" },
    counsel: [
      { name: "Adv. Nisha Thomas", side: "complainant" },
      { name: "Adv. Suresh Menon", side: "accused" },
    ],
    stage: "arguments",
    type: "document",
    appliedOn: "2026-06-22",
    filedFor: "accused",
    reason:
      "The accused seeks a copy of the written arguments already filed by the complainant.",
  },
  {
    id: "oa-566",
    caseNumber: "ST/566/2026",
    parties: { complainant: "Karthiyayani", accused: "Uliyakovil Provisions" },
    counsel: [{ name: "Adv. Rekha Pillai", side: "complainant" }],
    stage: "arguments",
    type: "checkout-request",
    appliedOn: "2026-06-25",
    filedFor: "complainant",
    reason: "Counsel asks to check the file out to prepare written arguments.",
  },
  {
    id: "oa-570",
    caseNumber: "ST/570/2026",
    parties: { complainant: "Kamalam", accused: "Ithikkara Motors" },
    counsel: [
      { name: "Adv. Saurabh Verma", side: "complainant" },
      { name: "Adv. Latha Krishnan", side: "accused" },
    ],
    stage: "judgement",
    type: "settlement",
    appliedOn: "2026-07-06",
    filedFor: "complainant",
    reason:
      "The parties have settled after arguments were heard and ask that the settlement be recorded before judgement.",
  },
  {
    id: "oa-573",
    caseNumber: "ST/573/2026",
    parties: { complainant: "Sudhakaran", accused: "Nedumpana Dairy Farm" },
    counsel: [{ name: "Adv. Feroz Hameed", side: "complainant" }],
    stage: "judgement",
    type: "case-withdrawal",
    appliedOn: "2026-07-09",
    filedFor: "complainant",
    reason:
      "The complainant has been paid in full and asks to withdraw the complaint before judgement is delivered.",
  },
  {
    id: "oa-577",
    caseNumber: "ST/577/2026",
    parties: {
      complainant: "Alice",
      accused: "Kulasekharapuram Handloom House",
    },
    counsel: [
      { name: "Adv. Anitha George", side: "complainant" },
      { name: "Adv. Nisha Thomas", side: "accused" },
    ],
    stage: "judgement",
    type: "others",
    appliedOn: "2026-07-13",
    filedFor: "accused",
    reason:
      "The accused asks that evidence be re-opened to mark a receipt said to evidence payment of the cheque amount.",
  },
  {
    id: "oa-580",
    caseNumber: "ST/580/2026",
    parties: { complainant: "Jaleel", accused: "Nilamel Timber Traders" },
    counsel: [{ name: "Adv. Suresh Menon", side: "complainant" }],
    stage: "post-judgement",
    type: "checkout-request",
    appliedOn: "2026-07-20",
    filedFor: "complainant",
    reason:
      "The complainant asks to check the file out to prepare a petition for recovery of the compensation ordered.",
  },
  {
    id: "oa-584",
    caseNumber: "ST/584/2026",
    parties: { complainant: "Shylaja", accused: "Pooyappally Provisions" },
    counsel: [
      { name: "Adv. Rekha Pillai", side: "complainant" },
      { name: "Adv. Saurabh Verma", side: "accused" },
    ],
    stage: "post-judgement",
    type: "document",
    appliedOn: "2026-07-23",
    filedFor: "accused",
    reason:
      "The accused seeks a copy of the complainant's deposition for the appeal.",
  },
  /* The long pending register: filed long ago, and still moving. The older year on these
     numbers is the whole of what the register means — none of them is dormant. */
  {
    id: "oa-118",
    caseNumber: "ST/118/2023",
    parties: { complainant: "Subaida", accused: "Ayathil Cashew Traders" },
    counsel: [
      { name: "Adv. Latha Krishnan", side: "complainant" },
      { name: "Adv. Feroz Hameed", side: "accused" },
    ],
    stage: "long-pending-register",
    type: "reschedule-adjournment",
    appliedOn: "2026-08-03",
    filedFor: "accused",
    reason:
      "The accused has been transferred out of the district and asks that the hearing be put off by a month.",
  },
  {
    id: "oa-126",
    caseNumber: "ST/126/2023",
    parties: {
      complainant: "Rajammal",
      accused: "Perumpuzha Marine Products and Cold Chain Pvt Ltd",
    },
    counsel: [{ name: "Adv. Anitha George", side: "complainant" }],
    stage: "long-pending-register",
    type: "settlement",
    appliedOn: "2026-08-06",
    filedFor: "complainant",
    reason:
      "The parties have agreed to settle this matter of 2023 and ask that the terms be recorded.",
  },
  {
    id: "oa-134",
    caseNumber: "ST/134/2023",
    parties: { complainant: "Yohannan", accused: "Vellimon Rice Traders" },
    counsel: [
      { name: "Adv. Nisha Thomas", side: "complainant" },
      { name: "Adv. Suresh Menon", side: "complainant" },
      { name: "Adv. Rekha Pillai", side: "accused" },
    ],
    stage: "long-pending-register",
    type: "others",
    appliedOn: "2026-08-10",
    filedFor: "accused",
    reason:
      "The accused asks that the case be taken up out of turn, the cheque amount having been deposited in court.",
  },
];

/**
 * How many applications are waiting — the number the rail carries beside "Others".
 *
 * Derived from the list rather than typed in beside the label, the way
 * `DELAY_CONDONATION_QUEUE_COUNT` is, so the rail and the screen cannot disagree about
 * the size of the queue.
 */
export const OTHER_APPLICATIONS_QUEUE_COUNT = OTHER_APPLICATIONS_QUEUE.length;

export type OtherApplicationFilters = {
  stage: OtherApplicationStage | "all";
  /**
   * Free text over the cause title, the case number and counsel — the same reach the
   * delay-condonation queue uses. The reference labelled the box "Case Name or Number,
   * Advocate".
   */
  query: string;
  type: OtherApplicationType | "all";
};

export const EMPTY_OTHER_APPLICATION_FILTERS: OtherApplicationFilters = {
  stage: "all",
  query: "",
  type: "all",
};

export function filterOtherApplications(
  rows: OtherApplication[],
  filters: OtherApplicationFilters,
): OtherApplication[] {
  const query = caseSearchKey(filters.query);
  return rows.filter((entry) => {
    if (filters.stage !== "all" && entry.stage !== filters.stage) return false;
    if (filters.type !== "all" && entry.type !== filters.type) return false;
    if (!query) return true;
    const haystack = [
      entry.parties.complainant,
      entry.parties.accused,
      entry.caseNumber,
      ...entry.counsel.map((counsel) => counsel.name),
    ]
      .join(" ")
      .toLowerCase();
    return haystack.includes(query);
  });
}

/** Compact column date — the same register the rest of the court side uses. */
export function formatOtherApplicationDate(day: string): string {
  return formatListingDate(day);
}

const LONG_DAY = new Intl.DateTimeFormat("en-IN", {
  day: "numeric",
  month: "long",
  year: "numeric",
});

/** "5 March 2026" — a date named in the review facts, not in a column. */
export function formatOtherApplicationLongDate(day: string): string {
  return LONG_DAY.format(parseIsoDay(day));
}

/** Who put the application in — counsel on record, or the party without one. */
export function otherApplicationFiler(application: OtherApplication): string {
  return applicationFiler(application, application.filedFor);
}

/**
 * What each head of application actually asks the court for, and the prayer it
 * ends on.
 *
 * Keyed by type rather than written per row, because the ask is the type: two
 * applications for production of documents differ in *why* — which is the row's
 * own `reason` — not in what they want the court to do. Fourteen heads, fourteen
 * entries, so a new type cannot be added without saying what it asks for.
 *
 * The wording stays in the vocabulary the reference and `docs/product/` already
 * use, and claims nothing about the order that would follow: this is the party's
 * paper, not the court's.
 */
const ASKS: Record<OtherApplicationType, { sought: string; prayer: string }> = {
  "adding-witnesses": {
    sought: "leave to add witnesses to the list already on record",
    prayer:
      "It is therefore prayed that this court may permit the applicant to add the witnesses named in this application to the list of witnesses.",
  },
  "case-transfer": {
    sought: "the transfer of this case to another court",
    prayer:
      "It is therefore prayed that this court may pass such orders as are necessary for the transfer of this case as prayed for.",
  },
  "case-withdrawal": {
    sought: "permission to withdraw the complaint",
    prayer:
      "It is therefore prayed that this court may permit the complainant to withdraw this complaint.",
  },
  "checkout-request": {
    sought: "permission to check the case file out for inspection",
    prayer:
      "It is therefore prayed that this court may permit the applicant to check the case file out for inspection.",
  },
  document: {
    sought: "a document from the record of this case",
    prayer:
      "It is therefore prayed that this court may direct that the document sought be furnished to the applicant.",
  },
  "extension-of-submission-deadline": {
    sought: "further time to make a submission this court has called for",
    prayer:
      "It is therefore prayed that this court may extend the time granted to the applicant to make the submission.",
  },
  "production-of-documents": {
    sought: "a direction for the production of documents",
    prayer:
      "It is therefore prayed that this court may direct the production of the documents named in this application.",
  },
  "profile-correction": {
    sought: "correction of the particulars recorded for the applicant",
    prayer:
      "It is therefore prayed that this court may permit the correction of the particulars set out in this application.",
  },
  settlement: {
    sought: "that the settlement arrived at between the parties be recorded",
    prayer:
      "It is therefore prayed that this court may record the settlement arrived at between the parties.",
  },
  "change-power-of-attorney": {
    sought: "a change in the power of attorney holder on record",
    prayer:
      "It is therefore prayed that this court may permit the change of the power of attorney holder as prayed for.",
  },
  "reschedule-adjournment": {
    sought: "an adjournment of the hearing",
    prayer:
      "It is therefore prayed that this court may adjourn the hearing to a date convenient to this court.",
  },
  bail: {
    sought: "bail",
    prayer:
      "It is therefore prayed that this court may enlarge the accused on bail on such terms as this court thinks fit.",
  },
  others: {
    sought: "an order on the matter set out in this application",
    prayer:
      "It is therefore prayed that this court may pass such order on this application as it thinks fit.",
  },
  "submit-bail-documents": {
    sought: "that the documents filed in support of bail be taken on record",
    prayer:
      "It is therefore prayed that this court may take the documents filed with this application on record.",
  },
};

/**
 * What a head of application asks the court for, and the prayer it ends on — by type.
 *
 * Exposed keyed by type, not by row, so the order composer's own application strip
 * (`listing-applications.ts`) reads these fourteen asks rather than restating them. An
 * application for bail is asking for the same thing whether the bench meets it in this
 * queue or in the middle of a sitting, and a second copy of the table is how the two
 * screens end up wording it two ways.
 */
export function applicationAsk(type: OtherApplicationType): string {
  return ASKS[type].sought;
}

export function applicationPrayer(type: OtherApplicationType): string {
  return ASKS[type].prayer;
}

/** What this application asks the court for — the sentence, not the head. */
export function otherApplicationAsk(application: OtherApplication): string {
  return applicationAsk(application.type);
}

export type OtherApplicationDocument = {
  court: string;
  caseNumber: string;
  matter: string;
  title: string;
  filedFor: string;
  facts: { term: string; value: string }[];
  paragraphs: string[];
  prayer: string;
  dated: string;
};

/**
 * The application as a court-form document, composed from this row.
 *
 * The same shape as `ReschedulingDocument`, `CopyApplicationDocument` and
 * `DelayCondonationDocument` — court heading, recited particulars, numbered
 * operative paragraphs, a prayer. Fourteen heads of application, one kind of
 * paper: what changes between them is the ask and the prayer (`ASKS`), not the
 * form the bench reads.
 */
export function buildOtherApplicationDocument(
  application: OtherApplication,
): OtherApplicationDocument {
  const side = partySideLabel(application.filedFor);
  const ask = ASKS[application.type];
  const facts: { term: string; value: string }[] = [
    { term: "Complainant", value: application.parties.complainant },
    { term: "Accused", value: application.parties.accused },
  ];
  const complainantCounsel = counselFor(application, "complainant").map(
    (counsel) => counsel.name,
  );
  if (complainantCounsel.length) {
    facts.push({
      term: "Complainant counsel",
      value: complainantCounsel.join(", "),
    });
  }
  const accusedCounsel = counselFor(application, "accused").map(
    (counsel) => counsel.name,
  );
  if (accusedCounsel.length) {
    facts.push({ term: "Accused counsel", value: accusedCounsel.join(", ") });
  }
  facts.push(
    { term: "Stage", value: otherApplicationStageLabel(application.stage) },
    {
      term: "Application type",
      value: otherApplicationTypeLabel(application.type),
    },
    {
      term: "Offence",
      value: "S. 138 of the Negotiable Instruments Act, 1881",
    },
  );

  return {
    court: `Before the ${CURRENT_STAFF.court}`,
    caseNumber: application.caseNumber,
    matter: causeTitle(application),
    title: otherApplicationTypeLabel(application.type),
    filedFor: `the ${side}`,
    facts,
    paragraphs: [
      `This matter is before this court at the stage of ${otherApplicationStageLabel(
        application.stage,
      ).toLowerCase()}.`,
      `By this application the ${side} seeks ${ask.sought}.`,
      `The application is made for the following reason: ${application.reason}`,
    ],
    prayer: ask.prayer,
    dated: formatOtherApplicationLongDate(application.appliedOn),
  };
}

export function otherApplicationDocumentText(
  document: OtherApplicationDocument,
): string {
  return [
    document.court,
    `Case no. ${document.caseNumber}`,
    document.matter,
    "",
    document.title,
    "",
    ...document.facts.map((fact) => `${fact.term}: ${fact.value}`),
    "",
    ...document.paragraphs.map(
      (paragraph, index) => `${index + 1}. ${paragraph}`,
    ),
    "",
    `Prayer: ${document.prayer}`,
    "",
    `Filed for ${document.filedFor}`,
    `Dated ${document.dated}`,
  ].join("\n");
}

export function otherApplicationDocumentFilename(
  application: OtherApplication,
): string {
  return `${application.caseNumber.replace(/\//g, "-")}-${application.type}.txt`;
}

export function downloadOtherApplicationDocument(
  application: OtherApplication,
): void {
  const document = buildOtherApplicationDocument(application);
  const url = URL.createObjectURL(
    new Blob([localizeForDownload(otherApplicationDocumentText(document))], { type: "text/plain" }),
  );
  const anchor = window.document.createElement("a");
  anchor.href = url;
  anchor.download = otherApplicationDocumentFilename(voicedForDownload(application));
  anchor.click();
  URL.revokeObjectURL(url);
}
