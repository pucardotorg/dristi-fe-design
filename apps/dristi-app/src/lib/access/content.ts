import type { Copy } from "@/lib/onboarding/content";
import { CASES } from "@/lib/cases/fixtures";
import {
  ACTIVE_STAGES,
  partiesLabel,
  type ActiveStage,
  type CounselSide,
} from "@/lib/cases/types";
import {
  viewerAccess as recordViewerAccess,
  viewerRepresentation,
} from "@/lib/cases/viewer";

export { fill as fillCopy } from "@/lib/join/content";

/**
 * Case access management — content model and demo fixtures.
 *
 * The access model (17 Aug meeting, corrected 20 Aug): access is case-level and
 * all-or-nothing, and a person's ROLE LIVES ON THE (person × case) GRANT — the
 * vakalat nama is unique to each case, so the same person can be an on-nama
 * advocate in one case and nothing in another. There is therefore no role
 * toggle anywhere: advocates get access through each case's vakalat nama
 * (declared at join / vakalat upload), and the share flow only ever adds
 * office staff (clerks and junior advocates).
 *
 * "People" is a flat list of everyone on my side across cases; designations
 * appear per case ("Joined as Clerk"), never on the person.
 */

const t = (en: string, ml: string): Copy => ({ en, ml });

/* ------------------------------------------------------------------- demo data */

export type AccessRole = "vakalat" | "clerk" | "junior";

export type AccessCase = {
  id: string;
  /** "Complainant vs accused", as the court titles it. */
  title: string;
  caseNumber: string;
  court: string;
  /** Display date of the next hearing — wireframe-level fidelity only. */
  nextHearing: string;
  /**
   * How the signed-in advocate reaches THIS case: on its vakalatnama (may
   * add and remove people) or through office access a colleague shared
   * (sees who has access, touches nobody — the share dialog has said so
   * since Aug). Defaults to "vakalatnama"; the case screens derive the
   * same fact from the record's counsel lists (`lib/cases/viewer`).
   */
  viewerAccess?: "vakalatnama" | "office";
  /** An e-filing draft the advocate is on (OFC-04): shared like a case, but it
      has no case number or case page yet. */
  draft?: boolean;
  /** Where the case sits (PM, Oct 23: the person's case table filters on it).
      Absent on drafts, which have no stage yet. */
  stage?: ActiveStage | "disposed";
  /** The side the advocate represents in this case (owner, Oct 24: the
      person's case table shows and filters on it). A draft is a complaint
      being filed, so it is the complainant's. */
  side?: CounselSide;
};

/** How a case is named in a sentence: its number, or a draft's title. */
export function caseLabel(entry: Pick<AccessCase, "caseNumber" | "title">): string {
  return entry.caseNumber || entry.title;
}

/**
 * A case the advocate just joined, made known to the access world so office
 * access can be given to it at the end of the join flow (OFC-40). Prototype
 * only: the backend's case list replaces this.
 */
export function registerAccessCase(entry: AccessCase): void {
  const index = ACCESS_CASES.findIndex((c) => c.id === entry.id);
  // Known already: take the newer facts (a case the advocate just joined is now
  // theirs on the vakalatnama, whatever the demo docket said).
  if (index >= 0) ACCESS_CASES[index] = { ...ACCESS_CASES[index], ...entry };
  else ACCESS_CASES.unshift(entry);
}

/** May the signed-in advocate remove people from this case? Office access
    never may — removal belongs to the advocates on the vakalatnama. */
export function viewerHoldsVakalat(caseId: string): boolean {
  const entry = ACCESS_CASES.find((c) => c.id === caseId);
  return (entry?.viewerAccess ?? "vakalatnama") !== "office";
}

export type AccessGrant = {
  caseId: string;
  /** The person's role IN THIS CASE — vakalat nama is per-case. */
  role: AccessRole;
  /** Vakalat advocates may be declared on the nama but yet to join the system
      (join-a-case). Office access is immediate, so it is always "joined" (OFC-07). */
  status: "joined" | "invited";
  /** Display date access started. */
  since: string;
  /** Who granted administrative access for this specific case. */
  addedBy?: "self" | string;
};

export type AccessPerson = {
  id: string;
  name: string;
  phone: string;
  /** Bar Council enrolment number — advocates only. */
  barId?: string;
  /**
   * Who brought them in. "self" is the signed-in advocate; another name is a
   * fellow vakalat advocate; `null` means they came through a vakalat nama.
   */
  addedBy: "self" | string | null;
  grants: AccessGrant[];
  /** Gets office access to every case the signed-in advocate is later added
      to on a vakalatnama (OFC-25). */
  allCases?: boolean;
};

/** The signed-in advocate — rendered as "(you)" atop per-case access lists. */
export const SELF = {
  id: "self",
  name: "Adv. Anjali Nair",
  phone: "98460 00000",
} as const;

/** Demo docket — same world as the join-flow fixtures (NIA 138). */
export const ACCESS_CASES: AccessCase[] = [
  {
    id: "c-847",
    title: "South Indian Bank Ltd. vs Rajan Krishnan Nair and 1 other",
    caseNumber: "CC 847/2026",
    court: "JFCM I · Court No. 3",
    nextHearing: "28 Aug 2026",
    /* The demo's two office-access cases (owner, Sept 3): the viewer reads
       these but removes nobody, here or on the case's Parties tab. */
    viewerAccess: "office",
  },
  {
    id: "c-612",
    title: "Fathima Beevi vs Anil Kumar K.",
    caseNumber: "CC 612 / 2026",
    court: "24×7 ON Court",
    nextHearing: "25 Aug 2026",
  },
  {
    id: "c-533",
    title: "Anitha Joseph vs Latheef M.",
    caseNumber: "CC 533 / 2026",
    court: "24×7 ON Court",
    nextHearing: "2 Sep 2026",
    viewerAccess: "office",
  },
  {
    id: "c-410",
    title: "Kerala Traders Co-operative vs Suresh Babu P.",
    caseNumber: "CC 410 / 2026",
    court: "JFCM I · Court No. 3",
    nextHearing: "9 Sep 2026",
  },
  {
    id: "c-289",
    title: "Malabar Finance Ltd. vs Joseph Mathew",
    caseNumber: "CC 289 / 2026",
    court: "JFCM II",
    nextHearing: "16 Sep 2026",
  },
  {
    id: "c-721",
    title: "Federal Bank Ltd. vs Binu Varghese",
    caseNumber: "CC 721 / 2026",
    court: "JFCM I · Court No. 3",
    nextHearing: "18 Sep 2026",
  },
  {
    id: "c-698",
    title: "Sreelakshmi Chits Pvt. Ltd. vs Manoj Kumar",
    caseNumber: "CC 698 / 2026",
    court: "24×7 ON Court",
    nextHearing: "21 Sep 2026",
  },
  {
    id: "c-655",
    title: "Jaya Textiles vs Noufal A.",
    caseNumber: "CC 655 / 2026",
    court: "JFCM II",
    nextHearing: "23 Sep 2026",
  },
  {
    id: "c-590",
    title: "Coastal Credit Society vs Mini Thomas",
    caseNumber: "CC 590 / 2026",
    court: "JFCM I · Court No. 3",
    nextHearing: "25 Sep 2026",
  },
  {
    id: "c-564",
    title: "Lakeside Hardware Mart vs Shaji P.",
    caseNumber: "CC 564 / 2026",
    court: "24×7 ON Court",
    nextHearing: "28 Sep 2026",
  },
  {
    id: "c-501",
    title: "Unity Auto Finance vs Radhakrishnan Nair",
    caseNumber: "CC 501 / 2026",
    court: "JFCM II",
    nextHearing: "30 Sep 2026",
  },
  {
    id: "c-478",
    title: "Aiswarya Agencies vs Deepa Mohan",
    caseNumber: "CC 478 / 2026",
    court: "JFCM I · Court No. 3",
    nextHearing: "2 Oct 2026",
  },
  {
    id: "c-452",
    title: "Kerala Gramin Bank vs Sajan Philip",
    caseNumber: "CC 452 / 2026",
    court: "24×7 ON Court",
    nextHearing: "5 Oct 2026",
  },
  {
    id: "c-399",
    title: "Grand Motors vs Abdul Salam",
    caseNumber: "CC 399 / 2026",
    court: "JFCM II",
    nextHearing: "7 Oct 2026",
  },
  {
    id: "c-376",
    title: "Navodaya Enterprises vs Reni George",
    caseNumber: "CC 376 / 2026",
    court: "JFCM I · Court No. 3",
    nextHearing: "9 Oct 2026",
  },
  {
    id: "c-341",
    title: "Muthoot Traders vs Pradeep S.",
    caseNumber: "CC 341 / 2026",
    court: "24×7 ON Court",
    nextHearing: "12 Oct 2026",
  },
  {
    id: "c-318",
    title: "Bharath Distributors vs Latha Kumari",
    caseNumber: "CC 318 / 2026",
    court: "JFCM II",
    nextHearing: "14 Oct 2026",
  },
  {
    id: "c-266",
    title: "Sankars Hospital vs Arun Das",
    caseNumber: "CC 266 / 2026",
    court: "JFCM I · Court No. 3",
    nextHearing: "16 Oct 2026",
  },
  {
    id: "c-241",
    title: "Oceanic Exports vs Salim K.",
    caseNumber: "CC 241 / 2026",
    court: "24×7 ON Court",
    nextHearing: "19 Oct 2026",
  },
  {
    id: "c-218",
    title: "Devi Medicals vs Suresh Chandran",
    caseNumber: "CC 218 / 2026",
    court: "JFCM II",
    nextHearing: "21 Oct 2026",
  },
  {
    id: "c-194",
    title: "Punalur Service Bank vs Asha Roy",
    caseNumber: "CC 194 / 2026",
    court: "JFCM I · Court No. 3",
    nextHearing: "23 Oct 2026",
  },
  {
    id: "c-173",
    title: "Kairali Foods vs Navas M.",
    caseNumber: "CC 173 / 2026",
    court: "24×7 ON Court",
    nextHearing: "26 Oct 2026",
  },
  {
    id: "c-151",
    title: "Sree Narayana Stores vs Beena R.",
    caseNumber: "CC 151 / 2026",
    court: "JFCM II",
    nextHearing: "28 Oct 2026",
  },
  {
    id: "c-129",
    title: "Capitol Electronics vs Sunil Babu",
    caseNumber: "CC 129 / 2026",
    court: "JFCM I · Court No. 3",
    nextHearing: "30 Oct 2026",
  },
  {
    id: "c-108",
    title: "Travancore Ceramics vs Ramesh Pillai",
    caseNumber: "CC 108 / 2026",
    court: "24×7 ON Court",
    nextHearing: "2 Nov 2026",
  },
  {
    id: "c-087",
    title: "Greenline Logistics vs Sumi Rajan",
    caseNumber: "CC 087 / 2026",
    court: "JFCM II",
    nextHearing: "4 Nov 2026",
  },
  {
    id: "c-066",
    title: "Janatha Supermarket vs Faizal H.",
    caseNumber: "CC 066 / 2026",
    court: "JFCM I · Court No. 3",
    nextHearing: "6 Nov 2026",
  },
  {
    id: "c-045",
    title: "Maya Jewellery vs Vinod Krishnan",
    caseNumber: "CC 045 / 2026",
    court: "24×7 ON Court",
    nextHearing: "9 Nov 2026",
  },
  {
    id: "c-024",
    title: "Royal Furniture vs Sindhu Menon",
    caseNumber: "CC 024 / 2026",
    court: "JFCM II",
    nextHearing: "11 Nov 2026",
  },
  {
    id: "c-011",
    title: "Asramam Builders vs Nikhil Raj",
    caseNumber: "CC 011 / 2026",
    court: "JFCM I · Court No. 3",
    nextHearing: "13 Nov 2026",
  },
];

const joinedGrants = (
  caseIds: string[],
  role: AccessRole,
  since: string,
  inviters: Array<"self" | string> = ["self"],
): AccessGrant[] =>
  caseIds.map((caseId, index) => ({
    caseId,
    role,
    status: "joined",
    since,
    ...(role === "vakalat" ? {} : { addedBy: inviters[index % inviters.length] }),
  }));

/** My side across cases. Seed state — invites and removals mutate a copy. */
export const ACCESS_PEOPLE: AccessPerson[] = [
  {
    id: "p-thomas",
    name: "Adv. Thomas K. George",
    phone: "98470 12345",
    barId: "K/831/2011",
    addedBy: "self",
    grants: [
      ...joinedGrants(
        [
          "c-847", "c-612", "c-410", "c-721", "c-698", "c-655", "c-590", "c-564",
          "c-501", "c-478", "c-452", "c-399", "c-376", "c-341", "c-318",
        ],
        "vakalat",
        "3 Jul 2026",
      ),
      ...joinedGrants(
        [
          "c-533", "c-289", "c-266", "c-241", "c-218", "c-194", "c-173", "c-151",
          "c-129", "c-108", "c-087", "c-066", "c-045", "c-024", "c-011",
        ],
        "junior",
        "6 Aug 2026",
        ["self", "Adv. Priya Nair", "Adv. Meera Pillai", "Adv. Nisha Varghese"],
      ),
    ],
  },
  {
    // On the nama of one case but hasn't signed in — shows the yet-to-join state.
    id: "p-rajesh",
    name: "Adv. Rajesh Kurup",
    phone: "98470 98765",
    barId: "K/1204/2015",
    addedBy: null,
    grants: [{ caseId: "c-847", role: "vakalat", status: "invited", since: "3 Jul 2026" }],
  },
  {
    id: "p-anil",
    name: "Anil Raghavan",
    phone: "94470 88221",
    addedBy: "self",
    allCases: true,
    grants: joinedGrants(
      [
        "c-847", "c-612", "c-533", "c-410", "c-289", "c-721", "c-698", "c-655",
        "c-590", "c-564", "c-501", "c-478", "c-452", "c-399", "c-376", "c-341",
        "c-318", "c-266", "c-241", "c-218",
      ],
      "clerk",
      "4 Jul 2026",
      ["self", "Adv. Thomas K. George", "Adv. Priya Nair", "Adv. Meera Pillai"],
    ),
  },
  {
    // Mixed on purpose: on the nama of one case, administrative help on two
    // others — the panel's two groups exist for exactly this person.
    id: "p-priya",
    name: "Adv. Priya Nair",
    phone: "94950 33417",
    barId: "K/2988/2021",
    addedBy: "Adv. Thomas K. George",
    grants: [
      ...joinedGrants(
        ["c-533", "c-721", "c-655", "c-501", "c-452", "c-376", "c-318", "c-241"],
        "vakalat",
        "2 Aug 2026",
      ),
      ...joinedGrants(
        ["c-612", "c-410", "c-289", "c-698", "c-590", "c-564", "c-478", "c-399"],
        "junior",
        "18 Jun 2026",
        ["self", "Adv. Thomas K. George", "Adv. Meera Pillai", "Adv. Nisha Varghese"],
      ),
    ],
  },
  {
    id: "p-sameer",
    name: "Sameer K.",
    phone: "90720 55190",
    addedBy: "self",
    grants: [
      {
        caseId: "c-289",
        role: "clerk",
        status: "joined",
        since: "11 Apr 2026",
        addedBy: "Adv. Nisha Varghese",
      },
    ],
  },
  {
    id: "p-meera",
    name: "Adv. Meera Pillai",
    phone: "98462 45190",
    barId: "K/1742/2017",
    addedBy: null,
    grants: joinedGrants(
      [
        "c-847", "c-612", "c-533", "c-410", "c-721", "c-698", "c-655", "c-590",
        "c-564", "c-501", "c-478", "c-452", "c-399", "c-376", "c-341", "c-318",
        "c-266", "c-241",
      ],
      "vakalat",
      "9 May 2026",
    ),
  },
  {
    id: "p-arun",
    name: "Arun Das",
    phone: "94473 66218",
    addedBy: "self",
    grants: joinedGrants(
      [
        "c-847", "c-612", "c-533", "c-410", "c-289", "c-721", "c-698", "c-655",
        "c-590", "c-564", "c-501", "c-478", "c-452", "c-399",
      ],
      "clerk",
      "15 Jul 2026",
      ["self", "Adv. Thomas K. George", "Adv. Priya Nair", "Adv. Meera Pillai"],
    ),
  },
  {
    id: "p-nisha",
    name: "Adv. Nisha Varghese",
    phone: "98951 22764",
    barId: "K/2251/2019",
    addedBy: "self",
    grants: [
      ...joinedGrants(["c-847", "c-533", "c-721", "c-590", "c-501"], "vakalat", "7 Jun 2026"),
      ...joinedGrants(
        ["c-612", "c-410", "c-289", "c-698", "c-655"],
        "junior",
        "19 Jul 2026",
        ["self", "Adv. Thomas K. George", "Adv. Priya Nair", "Adv. Meera Pillai"],
      ),
    ],
  },
  {
    id: "p-ramesh",
    name: "Ramesh Chandran",
    phone: "98765 01234",
    addedBy: "self",
    grants: joinedGrants(
      ["c-847", "c-612", "c-533", "c-410", "c-289", "c-721", "c-698"],
      "clerk",
      "24 Jul 2026",
      ["self", "Adv. Thomas K. George", "Adv. Priya Nair"],
    ),
  },
  {
    id: "p-rahul",
    name: "Adv. Rahul Menon",
    phone: "94951 66778",
    barId: "K/3105/2022",
    addedBy: "self",
    grants: joinedGrants(
      ["c-847", "c-612", "c-533", "c-410", "c-289"],
      "junior",
      "28 Jul 2026",
      ["self", "Adv. Thomas K. George", "Adv. Meera Pillai"],
    ),
  },
  {
    id: "p-sreeja",
    name: "Adv. Sreeja Mohan",
    phone: "99614 72058",
    barId: "K/3311/2023",
    addedBy: "self",
    grants: [
      { caseId: "c-612", role: "junior", status: "joined", since: "19 Oct 2026", addedBy: "self" },
      { caseId: "c-410", role: "junior", status: "joined", since: "19 Oct 2026", addedBy: "self" },
    ],
  },
  {
    id: "p-leena",
    name: "Adv. Leena S. Nair",
    phone: "97461 40832",
    barId: "K/948/2014",
    addedBy: "Adv. Priya Nair",
    grants: [
      ...joinedGrants(["c-721", "c-698"], "vakalat", "2 Aug 2026"),
      ...joinedGrants(["c-655"], "junior", "5 Aug 2026", ["Adv. Thomas K. George"]),
    ],
  },
];

export type RegisteredUser = {
  name: string;
  /** Spaced, "94950 33417". */
  phone: string;
  /** Advocates only. */
  barId?: string;
  /** The account type — the only two types that can be in an office (OFC-02). */
  type: "advocate" | "clerk";
};

/**
 * Stand-in for DRISTI's registry of advocate and clerk accounts. Office
 * management adds registered users only (owner, 2026-10-21), searched by name,
 * mobile number or Bar ID (OFC-20). Unregistered numbers cannot be added.
 */
export const REGISTERED_USERS: RegisteredUser[] = [
  { name: "Anil Raghavan", phone: "94470 88221", type: "clerk" },
  { name: "Adv. Priya Nair", phone: "94950 33417", barId: "K/2988/2021", type: "advocate" },
  { name: "Adv. Rahul Menon", phone: "94951 66778", barId: "K/3105/2022", type: "advocate" },
  { name: "Sameer K.", phone: "90720 55190", type: "clerk" },
  { name: "Adv. Thomas K. George", phone: "98470 12345", barId: "K/831/2011", type: "advocate" },
  { name: "Adv. Rajesh Kurup", phone: "98470 98765", barId: "K/1204/2015", type: "advocate" },
  { name: "Ramesh Chandran", phone: "98765 01234", type: "clerk" },
  { name: "Arun Das", phone: "94473 66218", type: "clerk" },
  { name: "Adv. Nisha Varghese", phone: "98951 22764", barId: "K/2251/2019", type: "advocate" },
  { name: "Adv. Leena S. Nair", phone: "97461 40832", barId: "K/948/2014", type: "advocate" },
  { name: "Adv. Meera Pillai", phone: "98462 45190", barId: "K/1742/2017", type: "advocate" },
  { name: "Adv. Sreeja Mohan", phone: "99614 72058", barId: "K/3311/2023", type: "advocate" },
  { name: "Akhil Krishnan", phone: "80890 74136", type: "clerk" },
  { name: "Divya Prakash", phone: "70123 45678", type: "clerk" },
  { name: "Adv. Joseph Antony", phone: "94461 20934", barId: "K/1567/2016", type: "advocate" },
  { name: "Adv. Fathima Rasheed", phone: "98953 70412", barId: "K/2730/2020", type: "advocate" },
  { name: "Vishnu Mohan", phone: "81290 66135", type: "clerk" },
  /* The demo's clerk profile (sidebar, Viewing as): add him to see what the
     person added receives (OFC-08). */
  { name: "Vinod Kumar", phone: "94472 31508", type: "clerk" },
];

export function registeredUserByPhone(phone: string): RegisteredUser | undefined {
  const digits = phone.replace(/\D/g, "");
  return REGISTERED_USERS.find((user) => user.phone.replace(/\D/g, "") === digits);
}

export function registeredUserByName(name: string): RegisteredUser | undefined {
  return REGISTERED_USERS.find((user) => user.name === name);
}

/* ------------------------------------------------------------------------ copy */

/* The people field shared by Share access and the join-case team step (owner,
   2026-10-12). Malayalam drafted — needs review. */
export const inviteFieldCopy = {
  placeholder: t(
    "Search by name, mobile number or Bar ID",
    "പേര്, മൊബൈൽ നമ്പർ അല്ലെങ്കിൽ ബാർ ഐഡി ഉപയോഗിച്ച് തിരയുക",
  ),
  suggested: t("Your office", "നിങ്ങളുടെ ഓഫീസ്"),
  inOffice: t("In your office", "നിങ്ങളുടെ ഓഫീസിൽ"),
  alreadyInOffice: t("Already in your office", "ഇതിനകം നിങ്ങളുടെ ഓഫീസിൽ"),
  newNumber: t(
    "They'll get an access link by SMS and in DRISTI.",
    "അവർക്ക് SMS വഴിയും DRISTI-യിലും ആക്‌സസ് ലിങ്ക് ലഭിക്കും.",
  ),
  keepTyping: t(
    "No registered advocate or clerk matches. Only people registered on DRISTI can be added.",
    "രജിസ്റ്റർ ചെയ്ത അഭിഭാഷകരോ ക്ലർക്കുമാരോ പൊരുത്തപ്പെടുന്നില്ല. DRISTI-യിൽ രജിസ്റ്റർ ചെയ്തവരെ മാത്രമേ ചേർക്കാനാകൂ.",
  ),
  fullNumber: t(
    "Type the full 10-digit mobile number.",
    "മുഴുവൻ 10 അക്ക മൊബൈൽ നമ്പർ ടൈപ്പ് ചെയ്യുക.",
  ),
  typeAdvocate: t("Advocate", "അഭിഭാഷകൻ"),
  typeClerk: t("Clerk", "ക്ലർക്ക്"),
};

/* The end-of-join office step (OFC-40 to OFC-43). Malayalam drafted — needs review. */
export const joinOfficeCopy = {
  alreadyAdded: t(
    "Already have access, as they are on All cases:",
    "'എല്ലാ കേസുകളും' ആയതിനാൽ ഇതിനകം ആക്‌സസ് ഉണ്ട്:",
  ),
};

export const accessShell = {
  navPeople: t("People", "ആളുകൾ"),
};

export const shareCopy = {
  title: t("Share access", "ആക്‌സസ് പങ്കിടുക"),
  scopeManyTitle: t("{count} cases selected", "{count} കേസുകൾ തിരഞ്ഞെടുത്തു"),
  bodySingle: t(
    "People you add get office access: they can work on the case but are not on the vakalatnama. They are added to your office on the People page.",
    "നിങ്ങൾ ചേർക്കുന്നവർക്ക് ഓഫീസ് ആക്‌സസ് ലഭിക്കും: അവർക്ക് കേസിൽ പ്രവർത്തിക്കാം, പക്ഷേ വക്കാലത്ത്നാമയിൽ ഉണ്ടാകില്ല. പീപ്പിൾ പേജിൽ അവർ നിങ്ങളുടെ ഓഫീസിൽ ചേർക്കപ്പെടും.",
  ),
  phonePlaceholder: t("Mobile number", "മൊബൈൽ നമ്പർ"),
  phoneAdd: t("Add number", "നമ്പർ ചേർക്കുക"),
  phoneError: t("Enter a valid 10-digit mobile number.", "സാധുവായ 10 അക്ക മൊബൈൽ നമ്പർ നൽകുക."),
  removeChip: t("Remove", "നീക്കം ചെയ്യുക"),
  suggestionsLabel: t("People you often add", "നിങ്ങൾ പതിവായി ചേർക്കുന്നവർ"),
  send: t("Share", "പങ്കിടുക"),
  sentNote: t("Access given to", "ഇവർക്ക് ആക്‌സസ് നൽകി"),
  /* Says an invite went, not how — SMS or in-app is not settled (owner, 2026-10-13). */
  inviteToast: t("Access given to {names}", "{names} എന്നവർക്ക് ആക്‌സസ് നൽകി"),
  sentBulkNote: t(
    "Added to {added} of {total} cases · already had access to {skipped}",
    "{total}-ൽ {added} കേസുകളിൽ ചേർത്തു · {skipped} കേസിൽ നേരത്തേ ആക്‌സസ് ഉണ്ടായിരുന്നു",
  ),
  sentBulkAllNote: t("Added to all {total} cases", "എല്ലാ {total} കേസുകളിലും ചേർത്തു"),
  alreadyHadAllNote: t(
    "Already had access to all selected cases",
    "തിരഞ്ഞെടുത്ത എല്ലാ കേസുകളിലും നേരത്തേ ആക്‌സസ് ഉണ്ടായിരുന്നു",
  ),
  whoHasAccess: t("Who has access", "ആർക്കൊക്കെ ആക്‌സസ് ഉണ്ട്"),
  accessSearchPlaceholder: t("Search people", "ആളുകളെ തിരയുക"),
  you: t("(you)", "(നിങ്ങൾ)"),
  statusInvited: t("Yet to join", "ചേരാനുണ്ട്"),
  readOnlyNote: t(
    "You hold office access on this case, so you can see who has access. Adding and removing people belongs to the advocates on the vakalatnama.",
    "ഈ കേസിൽ നിങ്ങൾക്ക് ഓഫീസ് ആക്‌സസ് ആയതിനാൽ ആർക്കൊക്കെ ആക്‌സസ് ഉണ്ടെന്ന് കാണാം. ആളുകളെ ചേർക്കുന്നതും നീക്കുന്നതും വക്കാലത്ത്നാമയിലെ അഭിഭാഷകർക്കാണ്.",
  ),
  selfOfficeAccess: t("Office access", "ഓഫീസ് ആക്‌സസ്"),
};

export const roleCopy: Record<AccessRole, Copy> = {
  vakalat: t("Through Vakalatnama", "വക്കാലത്ത്നാമ വഴി"),
  clerk: t("Clerk", "ക്ലർക്ക്"),
  junior: t("Junior advocate", "ജൂനിയർ അഭിഭാഷക"),
};

export const listCopy = {
  remove: t("Remove", "നീക്കം ചെയ്യുക"),
  vakalatLocked: t(
    "Removing an advocate on the vakalatnama needs a court application.",
    "വക്കാലത്ത്നാമയിലുള്ള അഭിഭാഷകനെ നീക്കം ചെയ്യാൻ കോടതി അപേക്ഷ ആവശ്യമാണ്.",
  ),
  addedByYou: t("Added by you", "നിങ്ങൾ ചേർത്തത്"),
  addedBy: t("Added by {name}", "{name} ചേർത്തത്"),
  otherAdvocateLocked: t(
    "Added by {name}. Only they can remove this access.",
    "{name} ചേർത്തത്. അവർക്ക് മാത്രമേ ഈ ആക്‌സസ് നീക്കം ചെയ്യാനാകൂ.",
  ),
};

export const peopleCopy = {
  title: t("People", "ആളുകൾ"),
  subtitle: t(
    "Your office: the advocates and clerks you've given access to your cases. Open a person to manage their access.",
    "നിങ്ങളുടെ ഓഫീസ്: നിങ്ങളുടെ കേസുകളിലേക്ക് ആക്‌സസ് നൽകിയ അഭിഭാഷകരും ക്ലർക്കുമാരും. ഒരാളുടെ ആക്‌സസ് നിയന്ത്രിക്കാൻ അവരെ തുറക്കുക.",
  ),
  /* Several can be added at once (owner, Oct 26). */
  addPerson: t("Add people", "ആളുകളെ ചേർക്കുക"),
  futureBadge: t("All cases", "എല്ലാ കേസുകളും"),
  searchPlaceholder: t("Search people…", "ആളുകളെ തിരയുക…"),
  searchLabel: t("Search", "തിരയുക"),
  sortLabel: t("Sort by", "ക്രമീകരിക്കുക"),
  sortNameAsc: t("Name: A to Z", "പേര്: A മുതൽ Z വരെ"),
  sortNameDesc: t("Name: Z to A", "പേര്: Z മുതൽ A വരെ"),
  sortCasesDesc: t("Cases: most to least", "കേസുകൾ: കൂടുതൽ മുതൽ കുറവ് വരെ"),
  sortCasesAsc: t("Cases: least to most", "കേസുകൾ: കുറവ് മുതൽ കൂടുതൽ വരെ"),
  caseCount: t("{count} cases", "{count} കേസുകൾ"),
  caseCountOne: t("1 case", "1 കേസ്"),
  columnPerson: t("Person", "വ്യക്തി"),
  columnDesignation: t("Designation", "പദവി"),
  columnCases: t("Cases", "കേസുകൾ"),
  designationAdvocate: t("Advocate", "അഭിഭാഷകൻ"),
  designationClerk: t("Clerk", "ക്ലർക്ക്"),
  emptyTitle: t("No one in your office yet", "നിങ്ങളുടെ ഓഫീസിൽ ഇതുവരെ ആരുമില്ല"),
  emptyBody: t(
    "Add the advocates and clerks who work on your cases with you.",
    "നിങ്ങളോടൊപ്പം കേസുകളിൽ പ്രവർത്തിക്കുന്ന അഭിഭാഷകരെയും ക്ലർക്കുമാരെയും ചേർക്കുക.",
  ),
  noMatches: t("No one matches your search.", "തിരച്ചിലിന് അനുയോജ്യമായ ആരുമില്ല."),
  detailCases: t("Cases they can access", "അവർക്ക് ആക്‌സസ് ഉള്ള കേസുകൾ"),
  caseSearchLabel: t("Search cases", "കേസുകൾ തിരയുക"),
  caseSearchPlaceholder: t("Case name or number", "കേസിന്റെ പേരോ നമ്പറോ"),
  noCaseMatches: t("No matching cases.", "പൊരുത്തപ്പെടുന്ന കേസുകളില്ല."),
  vakalatCasesHeading: t("Access through Vakalatnama", "വക്കാലത്ത്നാമ വഴിയുള്ള ആക്‌സസ്"),
  /* "Office access", never "administrative access" (user, Sept 2): admin
     reads as all-access elsewhere, which is the opposite of what this is. */
  staffCasesHeading: t("Office access", "ഓഫീസ് ആക്‌സസ്"),
  staffTooltipLabel: t(
    "What office access means",
    "ഓഫീസ് ആക്‌സസ് എന്നതിന്റെ അർത്ഥം",
  ),
  staffTooltip: t(
    "People who are not on the Vakalatnama, such as clerks and junior advocates, but have been given access to work on the case.",
    "വക്കാലത്ത്നാമയിൽ ഇല്ലെങ്കിലും കേസിൽ പ്രവർത്തിക്കാൻ ആക്‌സസ് നൽകിയ ക്ലർക്കുമാരും ജൂനിയർ അഭിഭാഷകരും പോലുള്ള ആളുകൾ.",
  ),
  accessGivenOn: t("Access given on {date}", "{date}-ന് ആക്‌സസ് നൽകി"),
  draft: t("Draft", "കരട്"),
  barIdLabel: t("Bar ID", "ബാർ ഐഡി"),
  closePanel: t("Close panel", "പാനൽ അടയ്ക്കുക"),
  vakalatTooltipLabel: t(
    "Why vakalatnama access cannot be removed",
    "വക്കാലത്ത്നാമ ആക്‌സസ് നീക്കം ചെയ്യാൻ കഴിയാത്തത് എന്തുകൊണ്ട്",
  ),
  openCase: t("Open case", "കേസ് തുറക്കുക"),
  removeFromCase: t("Remove", "നീക്കം ചെയ്യുക"),
  removeFromAll: t("Remove from office", "ഓഫീസിൽ നിന്ന് നീക്കം ചെയ്യുക"),
  moreCases: t("Give access to more cases", "കൂടുതൽ കേസുകളിലേക്ക് ആക്‌സസ് നൽകുക"),
  scopeLabel: t("Access", "ആക്‌സസ്"),
  scopeAll: t("All cases", "എല്ലാ കേസുകളും"),
  scopeSpecific: t("Specific cases", "തിരഞ്ഞെടുത്ത കേസുകൾ"),
  scopeAllHint: t(
    "Every case you are on the vakalatnama for, and your drafts, now and in future. To remove single cases, switch to Specific cases.",
    "നിങ്ങൾ വക്കാലത്ത്നാമയിലുള്ള എല്ലാ കേസുകളും നിങ്ങളുടെ കരടുകളും, ഇപ്പോഴും ഭാവിയിലും. ഓരോ കേസായി നീക്കം ചെയ്യാൻ 'തിരഞ്ഞെടുത്ത കേസുകൾ' ആക്കുക.",
  ),
  scopeSpecificHint: t(
    "Only the cases listed below. New cases are not shared automatically.",
    "താഴെ നൽകിയ കേസുകൾ മാത്രം. പുതിയ കേസുകൾ സ്വയമേവ പങ്കിടില്ല.",
  ),
  allCasesShareNote: t("All cases", "എല്ലാ കേസുകളും"),
  removeFromThese: t("Remove from these cases", "ഈ കേസുകളിൽ നിന്ന് നീക്കം ചെയ്യുക"),
  removeOneTitle: t("Remove {name} from {case}?", "{name}-നെ {case}-ൽ നിന്ന് നീക്കം ചെയ്യണോ?"),
  removeTheseTitle: t("Remove {name} from these cases?", "{name}-നെ ഈ കേസുകളിൽ നിന്ന് നീക്കം ചെയ്യണോ?"),
  selectCaseAria: t("Select {caseNumber}", "{caseNumber} തിരഞ്ഞെടുക്കുക"),
  removeAllTitle: t("Remove {name} from your office?", "{name}-നെ നിങ്ങളുടെ ഓഫീസിൽ നിന്ന് നീക്കം ചെയ്യണോ?"),
  removeAllBody: t(
    "They will lose access to {count} cases immediately and leave your office. You can add them again at any time.",
    "അവർക്ക് {count} കേസുകളിലെ ആക്‌സസ് ഉടൻ നഷ്ടപ്പെടും, അവർ നിങ്ങളുടെ ഓഫീസിൽ നിന്ന് പുറത്താകും. എപ്പോൾ വേണമെങ്കിലും വീണ്ടും ചേർക്കാം.",
  ),
  removeTheseBody: t(
    "They will lose access to {count} cases immediately. You can share access again at any time.",
    "അവർക്ക് {count} കേസുകളിലെ ആക്‌സസ് ഉടൻ നഷ്ടപ്പെടും. എപ്പോൾ വേണമെങ്കിലും വീണ്ടും ആക്‌സസ് പങ്കിടാം.",
  ),
  removeLastBody: t(
    "This is their last case, so they will also leave your office.",
    "ഇത് അവരുടെ അവസാന കേസാണ്, അതിനാൽ അവർ നിങ്ങളുടെ ഓഫീസിൽ നിന്നും പുറത്താകും.",
  ),
  removeBodyOne: t(
    "They will lose access to this case immediately. You can share access again at any time.",
    "അവർക്ക് ഈ കേസിലെ ആക്‌സസ് ഉടൻ നഷ്ടപ്പെടും. എപ്പോൾ വേണമെങ്കിലും വീണ്ടും ആക്‌സസ് പങ്കിടാം.",
  ),
  removeAllConfirm: t("Remove from office", "ഓഫീസിൽ നിന്ന് നീക്കം ചെയ്യുക"),
  removeAllCancel: t("Cancel", "റദ്ദാക്കുക"),
  removedNote: t("{name} no longer has access to {case}.", "{name}-ന് ഇനി {case}-ൽ ആക്‌സസ് ഇല്ല."),
  removedAllNote: t("{name} is no longer in your office.", "{name} ഇനി നിങ്ങളുടെ ഓഫീസിൽ ഇല്ല."),
  /* One removal flow, entered from here too: a vakalat row's Remove opens
     the same court-application dialog the Parties tab uses. */
  removalPending: t("Removal requested", "നീക്കം ചെയ്യാൻ അഭ്യർത്ഥിച്ചു"),
  /* On office-access cases the Remove stays visible but disabled, with this
     as its tooltip — an absent button reads as a bug, a locked one as a
     rule (owner, Sept 3). */
  officeLockedTooltip: t(
    "You hold office access on this case. Removing people belongs to the advocates on the vakalatnama.",
    "ഈ കേസിൽ നിങ്ങൾക്ക് ഓഫീസ് ആക്‌സസ് ആണ്. ആളുകളെ നീക്കം ചെയ്യുന്നത് വക്കാലത്ത്നാമയിലെ അഭിഭാഷകർക്കാണ്.",
  ),
};

/* One person's access dialog (PM, Oct 23): every case in one table, ticked where they
   have access, so giving and removing access is the same act. "All cases" is one
   choice: every case now and every new one (owner, Oct 24). */
export const personAccessCopy = {
  close: t("Close", "അടയ്ക്കുക"),
  addTitle: t("Add people", "ആളുകളെ ചേർക്കുക"),
  addIntro: t(
    "Give a registered advocate or clerk access to your cases. They can work on the cases you pick, but can't e-sign as they're not on the vakalatnama.",
    "രജിസ്റ്റർ ചെയ്ത ഒരു അഭിഭാഷകനോ ക്ലർക്കിനോ നിങ്ങളുടെ കേസുകളിലേക്ക് ആക്‌സസ് നൽകുക. നിങ്ങൾ തിരഞ്ഞെടുക്കുന്ന കേസുകളിൽ അവർക്ക് പ്രവർത്തിക്കാം, പക്ഷേ വക്കാലത്ത്നാമയിൽ ഇല്ലാത്തതിനാൽ ഇ-സൈൻ ചെയ്യാനാകില്ല.",
  ),
  groupYourCases: t("Your cases", "നിങ്ങളുടെ കേസുകൾ"),
  addAction: t("Add to office", "ഓഫീസിൽ ചേർക്കുക"),
  /* Add person in two steps (owner, Oct 26): who, then what they can access.
     Everyone added together gets the same access. */
  addProgress: t("Add person progress", "ആളെ ചേർക്കുന്നതിന്റെ പുരോഗതി"),
  stepPeople: t("Add people", "ആളുകളെ ചേർക്കുക"),
  stepAccess: t("Set access", "ആക്‌സസ് നിശ്ചയിക്കുക"),
  peopleHeading: t("Choose people", "ആളുകളെ തിരഞ്ഞെടുക്കുക"),
  accessHeading: t("Choose access", "ആക്‌സസ് തിരഞ്ഞെടുക്കുക"),
  accessIntroOne: t(
    "Choose which of your cases they can work on.",
    "അവർക്ക് നിങ്ങളുടെ ഏതൊക്കെ കേസുകളിൽ പ്രവർത്തിക്കാമെന്ന് തിരഞ്ഞെടുക്കുക.",
  ),
  accessIntro: t(
    "Choose which of your cases they can work on. Everyone you're adding gets the same access.",
    "അവർക്ക് നിങ്ങളുടെ ഏതൊക്കെ കേസുകളിൽ പ്രവർത്തിക്കാമെന്ന് തിരഞ്ഞെടുക്കുക. നിങ്ങൾ ചേർക്കുന്ന എല്ലാവർക്കും ഒരേ ആക്‌സസ് ലഭിക്കും.",
  ),
  scopePlaceholder: t("Select", "തിരഞ്ഞെടുക്കുക"),
  chooseAccessTitle: t("Choose access to continue", "തുടരാൻ ആക്‌സസ് തിരഞ്ഞെടുക്കുക"),
  chooseAccessBody: t(
    "Pick All cases or Specific cases above.",
    "മുകളിൽ നിന്ന് എല്ലാ കേസുകളും അല്ലെങ്കിൽ തിരഞ്ഞെടുത്ത കേസുകൾ തിരഞ്ഞെടുക്കുക.",
  ),
  noneSelected: t("No cases selected yet", "ഇതുവരെ കേസുകളൊന്നും തിരഞ്ഞെടുത്തിട്ടില്ല"),
  futureNoteAdd: t(
    "They'll access all {count} of your cases. Any new case you get is shared with them automatically.",
    "നിങ്ങളുടെ {count} കേസുകളും അവർക്ക് ആക്‌സസ് ചെയ്യാം. നിങ്ങൾക്ക് ലഭിക്കുന്ന ഓരോ പുതിയ കേസും അവരുമായി സ്വയമേവ പങ്കിടും.",
  ),
  continueAction: t("Continue", "തുടരുക"),
  back: t("Back", "തിരികെ"),
  needPerson: t("Choose at least one person.", "ഒരാളെയെങ്കിലും തിരഞ്ഞെടുക്കുക."),
  needCases: t("Select at least one case.", "ഒരു കേസെങ്കിലും തിരഞ്ഞെടുക്കുക."),
  /* Counts, never names: one person or twenty, the line reads the same
     (owner, Oct 26). */
  addConfirmTitleOne: t("Add 1 person to your office?", "1 ആളെ നിങ്ങളുടെ ഓഫീസിൽ ചേർക്കണോ?"),
  addConfirmTitle: t("Add {count} people to your office?", "{count} പേരെ നിങ്ങളുടെ ഓഫീസിൽ ചേർക്കണോ?"),
  addedToastOne: t("1 person added to your office.", "1 ആളെ നിങ്ങളുടെ ഓഫീസിൽ ചേർത്തു."),
  addedToast: t("{count} people added to your office.", "{count} പേരെ നിങ്ങളുടെ ഓഫീസിൽ ചേർത്തു."),
  leaveBodyAdd: t(
    "The people you picked have not been added yet.",
    "നിങ്ങൾ തിരഞ്ഞെടുത്തവരെ ഇതുവരെ ചേർത്തിട്ടില്ല.",
  ),
  moreActions: t("More actions", "കൂടുതൽ പ്രവർത്തനങ്ങൾ"),
  groupHeld: t("Has access", "ആക്‌സസ് ഉണ്ട്"),
  groupOther: t("No access yet", "ഇതുവരെ ആക്‌സസ് ഇല്ല"),
  casesSection: t("Access to cases", "കേസുകളിലേക്കുള്ള ആക്‌സസ്"),
  searchPlaceholder: t("Search case name or number", "കേസിന്റെ പേരോ നമ്പറോ തിരയുക"),
  casesIntro: t(
    "Tick a case to give access. Untick it to remove access.",
    "ആക്‌സസ് നൽകാൻ കേസ് ടിക്ക് ചെയ്യുക. ആക്‌സസ് നീക്കാൻ ടിക്ക് മാറ്റുക.",
  ),
  allCases: t("All cases", "എല്ലാ കേസുകളും"),
  allCasesHint: t(
    "All {count} of your cases, and every new case you get later.",
    "നിങ്ങളുടെ {count} കേസുകളും, പിന്നീട് ലഭിക്കുന്ന എല്ലാ പുതിയ കേസുകളും.",
  ),
  specificCases: t("Specific cases", "തിരഞ്ഞെടുത്ത കേസുകൾ"),
  specificCasesHint: t(
    "Only the cases you pick. New cases are not shared.",
    "നിങ്ങൾ തിരഞ്ഞെടുക്കുന്ന കേസുകൾ മാത്രം. പുതിയ കേസുകൾ പങ്കിടില്ല.",
  ),
  needMode: t(
    "Choose All cases or Specific cases.",
    "എല്ലാ കേസുകളും അല്ലെങ്കിൽ തിരഞ്ഞെടുത്ത കേസുകൾ തിരഞ്ഞെടുക്കുക.",
  ),
  sideLabel: t("Representation", "പ്രതിനിധാനം"),
  sideAll: t("All representations", "എല്ലാ പ്രതിനിധാനങ്ങളും"),
  sideComplainant: t("Complainant", "പരാതിക്കാരൻ"),
  sideAccused: t("Accused", "പ്രതി"),
  examplesLabel: t("Demo: try searching", "ഡെമോ: തിരഞ്ഞുനോക്കുക"),
  stageLabel: t("Stage", "ഘട്ടം"),
  stageAll: t("All stages", "എല്ലാ ഘട്ടങ്ങളും"),
  stageDisposed: t("Disposed", "തീർപ്പാക്കി"),
  columnCaseNumber: t("Case number", "കേസ് നമ്പർ"),
  columnCase: t("Case name", "കേസിന്റെ പേര്"),
  columnStage: t("Stage", "ഘട്ടം"),
  notFiled: t("Not filed yet", "ഇതുവരെ ഫയൽ ചെയ്തിട്ടില്ല"),
  openDraft: t("Open draft", "കരട് തുറക്കുക"),
  willAdd: t("Will be added", "ചേർക്കും"),
  willRemove: t("Will be removed", "നീക്കം ചെയ്യും"),
  selectShown: t("Tick the {count} cases shown", "കാണിച്ച {count} കേസുകൾ ടിക്ക് ചെയ്യുക"),
  clearShown: t("Untick the {count} cases shown", "കാണിച്ച {count} കേസുകളുടെ ടിക്ക് മാറ്റുക"),
  selectCase: t("Access to {case}", "{case}-ലേക്കുള്ള ആക്‌സസ്"),
  noCases: t("No cases match these filters.", "ഈ ഫിൽട്ടറുകൾക്ക് അനുയോജ്യമായ കേസുകളില്ല."),
  pendingAddOne: t("+1 case", "+1 കേസ്"),
  pendingAdd: t("+{count} cases", "+{count} കേസുകൾ"),
  pendingRemoveOne: t("−1 case", "−1 കേസ്"),
  pendingRemove: t("−{count} cases", "−{count} കേസുകൾ"),
  save: t("Save changes", "മാറ്റങ്ങൾ സേവ് ചെയ്യുക"),
  confirmTitle: t("Save changes to {name}'s access?", "{name}-ന്റെ ആക്‌സസിലെ മാറ്റങ്ങൾ സേവ് ചെയ്യണോ?"),
  pointAddAll: t("Gets access to all cases ({count})", "എല്ലാ കേസുകളിലേക്കും ആക്‌സസ് ലഭിക്കും ({count})"),
  confirmFutureOn: t(
    "New cases are shared automatically",
    "പുതിയ കേസുകൾ സ്വയമേവ പങ്കിടും",
  ),
  confirmOutsideFilter: t(
    "A filter is on, so not every case was in view. Review before saving.",
    "ഒരു ഫിൽട്ടർ ഓണാണ്, എല്ലാ കേസുകളും കാണിച്ചിരുന്നില്ല. സേവ് ചെയ്യുന്നതിന് മുമ്പ് പരിശോധിക്കുക.",
  ),
  pointAddOne: t("Gets access to 1 case", "1 കേസിലേക്ക് ആക്‌സസ് ലഭിക്കും"),
  pointAdd: t("Gets access to {count} cases", "{count} കേസുകളിലേക്ക് ആക്‌സസ് ലഭിക്കും"),
  pointRemoveOne: t("Loses access to 1 case", "1 കേസിലെ ആക്‌സസ് നഷ്ടപ്പെടും"),
  pointRemove: t("Loses access to {count} cases", "{count} കേസുകളിലെ ആക്‌സസ് നഷ്ടപ്പെടും"),
  confirmFutureOff: t(
    "New cases stop being shared automatically",
    "പുതിയ കേസുകൾ സ്വയമേവ പങ്കിടുന്നത് നിർത്തും",
  ),
  confirmLeave: t(
    "Leaves your office, with no cases left",
    "കേസുകളൊന്നും ബാക്കിയില്ലാത്തതിനാൽ നിങ്ങളുടെ ഓഫീസിൽ നിന്ന് പുറത്താകും",
  ),
  savedToast: t("Access updated for {name}.", "{name}-ന്റെ ആക്‌സസ് പുതുക്കി."),

  /* A person's own access (lead designer, Oct 26): the scope is a dropdown by the
     heading, All cases is a list to look at, Specific cases splits into two tabs,
     and a tick only selects. Every act applies on its own confirmation. */
  scopeLabel: t("Access", "ആക്‌സസ്"),
  futureNote: t(
    "{name} can access all {count} of your cases. Any new case you get is shared with them automatically.",
    "നിങ്ങളുടെ {count} കേസുകളും {name}-ന് ആക്‌സസ് ചെയ്യാം. നിങ്ങൾക്ക് ലഭിക്കുന്ന ഓരോ പുതിയ കേസും അവരുമായി സ്വയമേവ പങ്കിടും.",
  ),
  casesTabs: t("Cases by access", "ആക്‌സസ് അനുസരിച്ച് കേസുകൾ"),
  /* "Yet" softens it: access can still be given (owner, Oct 26). */
  tabOther: t("No access yet", "ഇതുവരെ ആക്‌സസ് ഇല്ല"),
  selectHintHeld: t(
    "Select cases to remove access.",
    "ആക്‌സസ് നീക്കാൻ കേസുകൾ തിരഞ്ഞെടുക്കുക.",
  ),
  selectHintOther: t(
    "Select cases to give access.",
    "ആക്‌സസ് നൽകാൻ കേസുകൾ തിരഞ്ഞെടുക്കുക.",
  ),
  selectedOne: t("1 selected", "1 തിരഞ്ഞെടുത്തു"),
  selectedMany: t("{count} selected", "{count} തിരഞ്ഞെടുത്തു"),
  clearSelection: t("Clear", "മായ്ക്കുക"),
  selectAllShown: t(
    "Select all {count}",
    "എല്ലാ {count} എണ്ണവും തിരഞ്ഞെടുക്കുക",
  ),
  selectRow: t("Select {case}", "{case} തിരഞ്ഞെടുക്കുക"),
  removeAccess: t("Remove access", "ആക്‌സസ് നീക്കുക"),
  giveAccess: t("Give access", "ആക്‌സസ് നൽകുക"),
  allAction: t(
    "Give access to all cases",
    "എല്ലാ കേസുകളിലേക്കും ആക്‌സസ് നൽകുക",
  ),
  emptyOtherTitle: t(
    "{name} has every case you have",
    "നിങ്ങളുടെ എല്ലാ കേസുകളും {name}-ന് ഉണ്ട്",
  ),
  emptyOtherBody: t(
    "New cases are not shared with them. To share those too, choose All cases.",
    "പുതിയ കേസുകൾ അവരുമായി പങ്കിടില്ല. അവയും പങ്കിടാൻ, എല്ലാ കേസുകളും തിരഞ്ഞെടുക്കുക.",
  ),
  noMatchTitle: t("No cases match", "അനുയോജ്യമായ കേസുകളില്ല"),
  noMatchBody: t(
    "Try another name or number, or clear the filters.",
    "മറ്റൊരു പേരോ നമ്പറോ ശ്രമിക്കുക, അല്ലെങ്കിൽ ഫിൽട്ടറുകൾ മായ്ക്കുക.",
  ),
  clearFilters: t("Clear filters", "ഫിൽട്ടറുകൾ മായ്ക്കുക"),
  removeTitle: t("Remove {name}'s access?", "{name}-ന്റെ ആക്‌സസ് നീക്കണോ?"),
  giveTitle: t("Give {name} access?", "{name}-ന് ആക്‌സസ് നൽകണോ?"),
  allTitle: t(
    "Give {name} access to all cases?",
    "{name}-ന് എല്ലാ കേസുകളിലേക്കും ആക്‌സസ് നൽകണോ?",
  ),
  specificTitle: t(
    "Change {name}'s access to specific cases?",
    "{name}-ന്റെ ആക്‌സസ് തിരഞ്ഞെടുത്ത കേസുകളിലേക്ക് മാറ്റണോ?",
  ),
  pointKeep: t(
    "Keeps access to the {count} cases they have now",
    "ഇപ്പോഴുള്ള {count} കേസുകളിലെ ആക്‌സസ് തുടരും",
  ),
  specificAction: t("Change to specific cases", "തിരഞ്ഞെടുത്ത കേസുകളിലേക്ക് മാറ്റുക"),
  leaveTitle: t("Discard your changes?", "നിങ്ങളുടെ മാറ്റങ്ങൾ ഉപേക്ഷിക്കണോ?"),
  leaveBody: t(
    "Your changes to {name}'s access are not saved yet.",
    "{name}-ന്റെ ആക്‌സസിലെ നിങ്ങളുടെ മാറ്റങ്ങൾ ഇതുവരെ സേവ് ചെയ്തിട്ടില്ല.",
  ),
  leaveConfirm: t("Discard changes", "മാറ്റങ്ങൾ ഉപേക്ഷിക്കുക"),
  leaveCancel: t("Keep editing", "എഡിറ്റിംഗ് തുടരുക"),
};

/* What the person added sees in their own notifications (OFC-08, N1 to N3).
   In-app only in the prototype; the SMS is not shown. */
export const officeNoticeCopy = {
  addedTitle: t("{advocate} added you to their office", "{advocate} നിങ്ങളെ അവരുടെ ഓഫീസിൽ ചേർത്തു"),
  addedSpecificOne: t(
    "You can now work on 1 of their cases.",
    "അവരുടെ 1 കേസിൽ ഇനി നിങ്ങൾക്ക് പ്രവർത്തിക്കാം.",
  ),
  addedSpecific: t(
    "You can now work on {count} of their cases.",
    "അവരുടെ {count} കേസുകളിൽ ഇനി നിങ്ങൾക്ക് പ്രവർത്തിക്കാം.",
  ),
  addedAll: t(
    "You can now work on all their cases, now and in future.",
    "അവരുടെ എല്ലാ കേസുകളിലും, ഇപ്പോഴും ഭാവിയിലും, നിങ്ങൾക്ക് പ്രവർത്തിക്കാം.",
  ),
  sharedTitle: t("{advocate} shared {case} with you", "{advocate} {case} നിങ്ങളുമായി പങ്കിട്ടു"),
  sharedMany: t("{count} cases", "{count} കേസുകൾ"),
  draft: t("Draft", "കരട്"),
  sharedBodyMany: t("They are in Your cases now.", "അവ ഇപ്പോൾ നിങ്ങളുടെ കേസുകളിലുണ്ട്."),
};

export const casesCopy = {
  title: t("Your cases", "നിങ്ങളുടെ കേസുകൾ"),
  wireframeNote: t(
    "Wireframe — the full cases screen is a separate design. It exists here to show where sharing starts.",
    "വയർഫ്രെയിം — പൂർണ്ണമായ കേസുകളുടെ സ്ക്രീൻ പ്രത്യേക ഡിസൈനാണ്. പങ്കിടൽ എവിടെ തുടങ്ങുന്നു എന്ന് കാണിക്കാനാണ് ഇത്.",
  ),
  selectAria: t("Select {caseNumber}", "{caseNumber} തിരഞ്ഞെടുക്കുക"),
  selectedCount: t("{count} selected", "{count} തിരഞ്ഞെടുത്തു"),
  clearSelection: t("Clear selection", "തിരഞ്ഞെടുപ്പ് മായ്ക്കുക"),
  shareAccess: t("Share access", "ആക്‌സസ് പങ്കിടുക"),
  nextHearing: t("Next hearing {date}", "അടുത്ത വാദം {date}"),
  open: t("Open", "തുറക്കുക"),
  backToCases: t("Your cases", "നിങ്ങളുടെ കേസുകൾ"),
  caseWireframeNote: t(
    "Wireframe — the case file is a separate design. Share access is the real control.",
    "വയർഫ്രെയിം — കേസ് ഫയൽ പ്രത്യേക ഡിസൈനാണ്. 'ആക്‌സസ് പങ്കിടുക' ആണ് യഥാർത്ഥ നിയന്ത്രണം.",
  ),
};

/* The Add person flow (OFC-20 to OFC-28). Malayalam drafted — needs review. */
/* Your cases joins the docket, so "All cases" means every case the advocate
   sees there (OFC-25, OFC-52), not only the access fixtures. Drafts arrive at
   run time from the filing store (`AccessProvider`). */
for (const record of CASES) {
  if (ACCESS_CASES.some((c) => c.id === record.id)) continue;
  ACCESS_CASES.push({
    id: record.id,
    title: partiesLabel(record),
    caseNumber: record.caseNumber,
    court: record.court,
    nextHearing: record.nextHearing?.on ?? "—",
    viewerAccess: recordViewerAccess(record).kind,
    stage: record.disposal ? "disposed" : record.stage,
    side: viewerRepresentation(record)[0],
  });
}

/* The access fixtures predate stages. They take one in turn down the active
   ladder so the stage filter has something to narrow; wireframe data only. */
ACCESS_CASES.forEach((entry, index) => {
  if (entry.stage || entry.draft) return;
  entry.stage = ACTIVE_STAGES[index % ACTIVE_STAGES.length].value;
});

/* The access fixtures predate sides too. Most are the complainant's, every
   third the accused's, so the representation filter has both; wireframe data
   only. */
ACCESS_CASES.forEach((entry, index) => {
  if (entry.side) return;
  entry.side = !entry.draft && index % 3 === 2 ? "accused" : "complainant";
});
