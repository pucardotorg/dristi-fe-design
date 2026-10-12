import type { Copy } from "@/lib/onboarding/content";

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
};

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
  /** Vakalat advocates may be declared on the nama but yet to join the system. */
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
  /** Known only by number — invited but never signed in to DRISTI. */
  pending?: boolean;
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
  {
    id: "p-pending",
    name: "+91 70076 63437",
    phone: "70076 63437",
    addedBy: "self",
    pending: true,
    grants: [
      {
        caseId: "c-590",
        role: "clerk",
        status: "invited",
        since: "8 Aug 2026",
        addedBy: "self",
      },
      {
        caseId: "c-564",
        role: "clerk",
        status: "invited",
        since: "8 Aug 2026",
        addedBy: "Adv. Priya Nair",
      },
    ],
  },
];

/**
 * Frequent collaborators — the meeting's replacement for teams/folders: suggest
 * the people this office keeps adding, one tap to stack them into an invite.
 */
export const FREQUENT_COLLABORATORS: Array<{ name: string; phone: string; role: AccessRole }> = [
  { name: "Adv. Priya Nair", phone: "94950 33417", role: "junior" },
  { name: "Sameer K.", phone: "90720 55190", role: "clerk" },
  { name: "Adv. Leena S. Nair", phone: "97461 40832", role: "junior" },
  { name: "Adv. Sreeja Mohan", phone: "99614 72058", role: "junior" },
  { name: "Akhil Krishnan", phone: "80890 74136", role: "clerk" },
];

/**
 * Stand-in for the DRISTI account lookup: the tenth digit resolves the number
 * to the registered name (and, for past team members, their designation).
 */
export const PHONE_DIRECTORY: Record<
  string,
  { name: string; designation?: AccessRole; advocate?: boolean }
> = {
  "9447088221": { name: "Anil Raghavan", designation: "clerk" },
  "9495033417": { name: "Adv. Priya Nair", designation: "junior" },
  "9495166778": { name: "Adv. Rahul Menon", designation: "junior" },
  "9072055190": { name: "Sameer K.", designation: "clerk" },
  /* `advocate` marks independent advocates — people who would act on the
     case through a vakalatnama rather than as somebody's office staff. The
     share dialog uses it to notice a wrong-door moment: sharing to an
     advocate is almost always "add them to the case" intended, and it points
     to the Parties tab instead of silently granting office access. Juniors
     stay unmarked — sharing to them is exactly what the dialog is for. */
  "9847012345": { name: "Adv. Thomas K. George", advocate: true },
  "9847098765": { name: "Adv. Rajesh Kurup", advocate: true },
  "9876501234": { name: "Ramesh Chandran" },
  "9746140832": { name: "Adv. Leena S. Nair", designation: "junior" },
  "9961472058": { name: "Adv. Sreeja Mohan", designation: "junior" },
  "8089074136": { name: "Akhil Krishnan", designation: "clerk" },
};

/* ------------------------------------------------------------------------ copy */

/* The people field shared by Share access and the join-case team step (owner,
   2026-10-12). Malayalam drafted — needs review. */
export const inviteFieldCopy = {
  placeholder: t(
    "Name, mobile number or Bar ID",
    "പേര്, മൊബൈൽ നമ്പർ അല്ലെങ്കിൽ ബാർ ഐഡി",
  ),
  suggested: t("People you often add", "നിങ്ങൾ പതിവായി ചേർക്കുന്നവർ"),
  newNumber: t(
    "They'll get an access link by SMS and in DRISTI.",
    "അവർക്ക് SMS വഴിയും DRISTI-യിലും ആക്‌സസ് ലിങ്ക് ലഭിക്കും.",
  ),
  keepTyping: t(
    "No one you've added matches. Enter the full 10-digit number or Bar ID.",
    "നിങ്ങൾ ചേർത്തവരിൽ ആരും പൊരുത്തപ്പെടുന്നില്ല. 10 അക്ക നമ്പർ അല്ലെങ്കിൽ ബാർ ഐഡി മുഴുവൻ നൽകുക.",
  ),
};

export const accessShell = {
  navPeople: t("People", "ആളുകൾ"),
};

export const shareCopy = {
  title: t("Share access", "ആക്‌സസ് പങ്കിടുക"),
  scopeManyTitle: t("{count} cases selected", "{count} കേസുകൾ തിരഞ്ഞെടുത്തു"),
  bodySingle: t(
    "Office access only: people you add can work on the case but are not on the case record.",
    "ഓഫീസ് ആക്‌സസ് മാത്രം: നിങ്ങൾ ചേർക്കുന്നവർക്ക് കേസിൽ പ്രവർത്തിക്കാം, പക്ഷേ അവർ കേസ് രേഖയിൽ ഉണ്ടാകില്ല.",
  ),
  phonePlaceholder: t("Mobile number", "മൊബൈൽ നമ്പർ"),
  phoneAdd: t("Add number", "നമ്പർ ചേർക്കുക"),
  phoneError: t("Enter a valid 10-digit mobile number.", "സാധുവായ 10 അക്ക മൊബൈൽ നമ്പർ നൽകുക."),
  demoProfiles: t(
    "Sandbox: try “Priya”, “Sameer”, any 10-digit number or a Bar ID like K/1234/2020.",
    "സാൻഡ്‌ബോക്സ്: “Priya”, “Sameer”, ഏതെങ്കിലും 10 അക്ക നമ്പർ അല്ലെങ്കിൽ K/1234/2020 പോലുള്ള ബാർ ഐഡി പരീക്ഷിക്കുക.",
  ),
  removeChip: t("Remove", "നീക്കം ചെയ്യുക"),
  suggestionsLabel: t("People you often add", "നിങ്ങൾ പതിവായി ചേർക്കുന്നവർ"),
  send: t("Share", "പങ്കിടുക"),
  sentNote: t("Invitation sent to", "ഇവർക്ക് ക്ഷണം അയച്ചു"),
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
  advocateNotice: t(
    "{name} is an advocate. Sharing gives office access only. To have them act on this case, add them from the Parties tab with a vakalatnama.",
    "{name} ഒരു അഭിഭാഷകനാണ്. പങ്കിടുന്നത് ഓഫീസ് ആക്‌സസ് മാത്രമേ നൽകൂ. ഈ കേസിൽ പ്രവർത്തിക്കാൻ, വക്കാലത്ത്നാമയോടെ പാർട്ടീസ് ടാബിൽ നിന്ന് അവരെ ചേർക്കുക.",
  ),
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
  invitedPending: t("Invited · yet to sign in", "ക്ഷണിച്ചു · ഇതുവരെ സൈൻ ഇൻ ചെയ്തിട്ടില്ല"),
};

export const peopleCopy = {
  title: t("People", "ആളുകൾ"),
  subtitle: t(
    "Everyone who works on your cases with you. Open a person to see the cases they can access, go to a case, or remove access.",
    "നിങ്ങളുടെ കേസുകളിൽ നിങ്ങളോടൊപ്പം പ്രവർത്തിക്കുന്ന എല്ലാവരും. ഒരാളെ തുറന്നാൽ അവർക്ക് ആക്‌സസ് ഉള്ള കേസുകൾ കാണാം, കേസിലേക്ക് പോകാം, ആക്‌സസ് നീക്കം ചെയ്യാം.",
  ),
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
  emptyTitle: t("No one has shared access yet", "ഇതുവരെ ആർക്കും ആക്‌സസ് പങ്കിട്ടിട്ടില്ല"),
  emptyBody: t(
    "Share a case from Your cases to bring your clerks and juniors in.",
    "നിങ്ങളുടെ ക്ലർക്കുമാരെയും ജൂനിയർമാരെയും ചേർക്കാൻ 'നിങ്ങളുടെ കേസുകൾ' എന്നതിൽ നിന്ന് ഒരു കേസ് പങ്കിടുക.",
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
  joinedOn: t("Joined on {date}", "{date}-ന് ചേർന്നു"),
  invitedOn: t("Invited on {date}", "{date}-ന് ക്ഷണിച്ചു"),
  invitedByYou: t("Invited by you", "നിങ്ങൾ ക്ഷണിച്ചു"),
  invitedBy: t("Invited by {name}", "{name} ക്ഷണിച്ചു"),
  barIdLabel: t("Bar ID", "ബാർ ഐഡി"),
  closePanel: t("Close panel", "പാനൽ അടയ്ക്കുക"),
  vakalatTooltipLabel: t(
    "Why vakalatnama access cannot be removed",
    "വക്കാലത്ത്നാമ ആക്‌സസ് നീക്കം ചെയ്യാൻ കഴിയാത്തത് എന്തുകൊണ്ട്",
  ),
  openCase: t("Open case", "കേസ് തുറക്കുക"),
  removeFromCase: t("Remove", "നീക്കം ചെയ്യുക"),
  removeFromAll: t("Remove from all cases", "എല്ലാ കേസുകളിൽ നിന്നും നീക്കം ചെയ്യുക"),
  removeFromThese: t("Remove from these cases", "ഈ കേസുകളിൽ നിന്ന് നീക്കം ചെയ്യുക"),
  removeTheseTitle: t("Remove {name} from these cases?", "{name}-നെ ഈ കേസുകളിൽ നിന്ന് നീക്കം ചെയ്യണോ?"),
  selectCaseAria: t("Select {caseNumber}", "{caseNumber} തിരഞ്ഞെടുക്കുക"),
  removeAllTitle: t("Remove {name} from all cases?", "{name}-നെ എല്ലാ കേസുകളിൽ നിന്നും നീക്കം ചെയ്യണോ?"),
  removeAllBody: t(
    "They will lose access to {count} cases immediately. You can share access again at any time.",
    "അവർക്ക് {count} കേസുകളിലെ ആക്‌സസ് ഉടൻ നഷ്ടപ്പെടും. എപ്പോൾ വേണമെങ്കിലും വീണ്ടും ആക്‌സസ് പങ്കിടാം.",
  ),
  removeBodyOne: t(
    "They will lose access to this case immediately. You can share access again at any time.",
    "അവർക്ക് ഈ കേസിലെ ആക്‌സസ് ഉടൻ നഷ്ടപ്പെടും. എപ്പോൾ വേണമെങ്കിലും വീണ്ടും ആക്‌സസ് പങ്കിടാം.",
  ),
  removeAllConfirm: t("Remove from all", "എല്ലാത്തിൽ നിന്നും നീക്കം ചെയ്യുക"),
  removeAllCancel: t("Cancel", "റദ്ദാക്കുക"),
  removedNote: t("{name} no longer has access to {case}.", "{name}-ന് ഇനി {case}-ൽ ആക്‌സസ് ഇല്ല."),
  removedAllNote: t("{name} no longer has access to any of your cases.", "{name}-ന് ഇനി നിങ്ങളുടെ കേസുകളിലൊന്നും ആക്‌സസ് ഇല്ല."),
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
