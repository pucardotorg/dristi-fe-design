import type { Copy, Locale } from "@/lib/onboarding/content";

/**
 * Post-login join-a-case — content model.
 *
 * Implements the Join a Case handover V1 (dristi-be/PRDs/join-a-case-handover.md):
 * complainants never join (they are linked at e-filing), and in V1 no join needs
 * approval — an accused, a party in person (after uploading an affidavit) and a
 * power-of-attorney holder all get access as soon as they finish the flow.
 *
 * The legacy dialog asked five questions. Role (litigant/advocate) is known from
 * sign-in and complainants have no join flow, so this one asks at most three:
 * who you are joining as, which party you are, and how you will appear.
 */

const t = (en: string, ml: string): Copy => ({ en, ml });

/* ------------------------------------------------------------------ case model */

export type CaseParty = {
  id: string;
  /** The name exactly as it appears in the court record — often not the ID name. */
  name: string;
  /** The party themselves has an account on the case — blocks a duplicate self-join. */
  hasJoined?: boolean;
  /** Another power-of-attorney holder is already managing the case for this party —
   *  the only thing that blocks a further PoA join. The party having joined in person
   *  does not: the party and their PoA holder both legitimately hold access. */
  poaHolderJoined?: boolean;
  /** The number on record for a party who has joined — shown masked, never in full. */
  phoneOnRecord?: string;
};

export type JoinCase = {
  /** "Complainant vs accused", as the court titles it. */
  title: string;
  caseNumber: string;
  cnr: string;
  filingNumber: string;
  caseType: string;
  filingDate: string;
  court: string;
  /** The room inside the court the case is heard in — its own fact, not part of the court's name. */
  courtroom: string;
  /** The district the court sits in, which the court switch names per state. */
  district?: string;
  hearingDate: string;
  chequeAmount: string;
  complainant: string;
  complainantAdvocate: string;
  complainantAdvocatePhone: string;
  accusedAdvocate: string;
  /** The accused parties a litigant can join as. */
  accused: CaseParty[];
  /** The complainant parties — a PoA holder or advocate can join for these. */
  complainants: CaseParty[];
};

/**
 * Stand-in for the case-lookup endpoint. The second accused has already joined, so
 * the duplicate-join guard is reviewable; the first differs from the demo account's
 * registered name ("Rajan K. Nair") so the name-mapping step is reviewable too.
 */
export const DEMO_JOIN_CASE: JoinCase = {
  title: "South Indian Bank Ltd. vs Rajan Krishnan Nair and 1 other",
  caseNumber: "CC 847/2026",
  /* Real formats (owner feedback, 12 Oct): a 16-character CNR and a registration
     number, each re-voiced per state by the court switch — in Gujarat GJAH010008472026
     and eCC/2405/2026. */
  cnr: "KLKM520008472026",
  filingNumber: "CMP/2405/2026",
  caseType: "NIA S138",
  filingDate: "31-07-2026",
  /* The product's own court, which the court switch names per state ("SARAS Court"). */
  court: "24×7 ON Court",
  courtroom: "Court No. 3",
  district: "Kollam",
  hearingDate: "Friday, 18 September 2026, 10:30 AM",
  chequeAmount: "₹1,85,000",
  complainant: "South Indian Bank Ltd.",
  complainantAdvocate: "Adv. Meera Pillai",
  complainantAdvocatePhone: "0000 000 000",
  accusedAdvocate: "Not available",
  accused: [
    { id: "acc-1", name: "Rajan Krishnan Nair" },
    { id: "acc-2", name: "Suresh Babu P", hasJoined: true, phoneOnRecord: "9846012734" },
  ],
  // Linked at e-filing (JOIN-01), so already on the case with a number on record.
  complainants: [
    { id: "comp-1", name: "South Indian Bank Ltd.", hasJoined: true, phoneOnRecord: "9447055188" },
  ],
};

/** The demo account's registered profile name — deliberately not an exact match for
 *  any party name, because that mismatch is the reason the mapping step exists. */
export const DEMO_PROFILE_NAME = "Rajan K. Nair";

/* ------------------------------------------------------------------ home screen */

export const home = {
  welcome: t("Welcome, {name}", "സ്വാഗതം, {name}"),
  fileTitle: t("File a new case", "പുതിയ കേസ് ഫയൽ ചെയ്യുക"),
  fileBody: t(
    "Start a new cheque bounce case and follow it from filing to decision.",
    "പുതിയ ചെക്ക് മടക്ക കേസ് തുടങ്ങി ഫയലിംഗ് മുതൽ തീരുമാനം വരെ പിന്തുടരുക.",
  ),
  fileAction: t("File a case", "കേസ് ഫയൽ ചെയ്യുക"),
  joinTitle: t("Join an ongoing case", "നിലവിലുള്ള കേസിൽ ചേരുക"),
  joinBody: t(
    "Received a summons, or part of a case already in court? Find it and join.",
    "സമൻസ് ലഭിച്ചോ, അല്ലെങ്കിൽ കോടതിയിലുള്ള കേസിന്റെ ഭാഗമാണോ? കേസ് കണ്ടെത്തി ചേരുക.",
  ),
  joinAction: t("Join a case", "കേസിൽ ചേരുക"),
  casesHeading: t("Your cases", "നിങ്ങളുടെ കേസുകൾ"),
  caseNumberLabel: t("Case number", "കേസ് നമ്പർ"),
  hearingLabel: t("Next hearing", "അടുത്ത ഹിയറിംഗ്"),
  statusJoined: t("Joined", "ചേർന്നു"),
  statusSummons: t("Action required", "നടപടി ആവശ്യമാണ്"),
  linkTitle: t("Is this you?", "ഇത് നിങ്ങളാണോ?"),
  linkBody: t(
    "Someone joining case {caseNumber} gave this mobile number for {name}. Are you {name} in this case?",
    "{caseNumber} കേസിൽ ചേർന്ന ഒരാൾ {name}-ന്റെ നമ്പറായി ഈ മൊബൈൽ നമ്പർ നൽകി. ഈ കേസിലെ {name} നിങ്ങളാണോ?",
  ),
  linkYes: t("Yes, this is me", "അതെ, ഇത് ഞാനാണ്"),
  linkNo: t("No, this isn't me", "ഇല്ല, ഇത് ഞാനല്ല"),
  linkDeclinedTitle: t("This case was not added", "ഈ കേസ് ചേർത്തിട്ടില്ല"),
  linkDeclinedBody: t(
    "Thank you. The case has not been linked to your account.",
    "നന്ദി. ഈ കേസ് നിങ്ങളുടെ അക്കൗണ്ടുമായി ബന്ധിപ്പിച്ചിട്ടില്ല.",
  ),
  reviewSummons: t("Review and join", "പരിശോധിച്ച് ചേരുക"),
  viewCase: t("View case", "കേസ് കാണുക"),
  prototypeTitle: t(
    "Prototype: destination not connected",
    "പ്രോട്ടോടൈപ്പ്: ലക്ഷ്യസ്ഥാനം ബന്ധിപ്പിച്ചിട്ടില്ല",
  ),
  prototypeFile: t(
    "This action will open the e-filing flow.",
    "ഈ പ്രവർത്തനം ഇ-ഫയലിംഗ് ഫ്ലോ തുറക്കും.",
  ),
  prototypeCase: t(
    "This action will open the case file.",
    "ഈ പ്രവർത്തനം കേസ് ഫയൽ തുറക്കും.",
  ),
  prototypeId: t(
    "This action will open the ID upload from your profile.",
    "ഈ പ്രവർത്തനം പ്രൊഫൈലിലെ ID അപ്‌ലോഡ് തുറക്കും.",
  ),
  prototypeProfile: t(
    "Profile editing will open here. Complete your address to clear this reminder.",
    "പ്രൊഫൈൽ തിരുത്തൽ ഇവിടെ തുറക്കും. ഈ ഓർമ്മപ്പെടുത്തൽ നീക്കാൻ വിലാസം പൂർത്തിയാക്കുക.",
  ),
} as const;

/* ------------------------------------------------------------ summons auto-modal */

export const summonsModal = {
  /* The first screen after sign-in from a summons (the access code) states the case
     plainly (field feedback row 92); the statement runs across the title and its
     first lines. Malayalam drafted — needs review. */
  firstHeading: t(
    "A cheque bounce case under Section 138 of the NI Act has been instituted against you",
    "നെഗോഷ്യബിൾ ഇൻസ്ട്രുമെന്റ്സ് ആക്ടിലെ 138-ാം വകുപ്പ് പ്രകാരം നിങ്ങൾക്കെതിരെ ഒരു ചെക്ക് മടക്ക കേസ് ഫയൽ ചെയ്തിട്ടുണ്ട്",
  ),
  firstBody: t(
    "{complainant} filed it, and it is pending before {court}, {district}. Enter the six-digit access code printed on your summons.",
    "{complainant} നൽകിയ പരാതിയിൽ {court}, {district} മുമ്പാകെ കേസ് നിലവിലുണ്ട്. സമൻസിൽ അച്ചടിച്ചിട്ടുള്ള ആറക്ക ആക്‌സസ് കോഡ് നൽകുക.",
  ),
  heading: t(
    "Review this cheque bounce case",
    "ഈ ചെക്ക് മടക്ക കേസ് പരിശോധിക്കുക",
  ),
  body: t(
    "Your name appears in this case. Check the details, then join to read the complaint and respond online.",
    "ഈ കേസിൽ നിങ്ങളുടെ പേര് ഉണ്ട്. വിവരങ്ങൾ പരിശോധിച്ച്, പരാതി വായിക്കാനും ഓൺലൈനായി മറുപടി നൽകാനും കേസിൽ ചേരുക.",
  ),
  cta: t("Join this case", "ഈ കേസിൽ ചേരുക"),
  dismiss: t("Not now", "ഇപ്പോൾ വേണ്ട"),
} as const;

/* -------------------------------------------------------------------- join dialog */

export const joinDialog = {
  /* Closing partway through asks first (owner, 2026-10-13). Malayalam drafted. */
  leaveTitle: t("Leave without joining?", "ചേരാതെ പുറത്തുകടക്കണോ?"),
  leaveBody: t(
    "What you have entered so far will not be kept.",
    "ഇതുവരെ നൽകിയ വിവരങ്ങൾ സൂക്ഷിക്കില്ല.",
  ),
  leaveStay: t("Keep going", "തുടരുക"),
  leaveGo: t("Leave", "പുറത്തുകടക്കുക"),
  title: t("Join your case", "നിങ്ങളുടെ കേസിൽ ചേരുക"),

  /* lookup — manual entry only */
  lookupBody: t(
    "Enter the case number or filing number from your summons or court papers.",
    "സമൻസിലോ കോടതി രേഖകളിലോ ഉള്ള കേസ് നമ്പർ അല്ലെങ്കിൽ ഫയലിംഗ് നമ്പർ നൽകുക.",
  ),
  lookupLabel: t("Case number or filing number", "കേസ് നമ്പർ അല്ലെങ്കിൽ ഫയലിംഗ് നമ്പർ"),
  lookupPlaceholder: t("For example CC 847/2026", "ഉദാഹരണം: CC 847/2026"),
  lookupError: t(
    "Enter the number as it appears on your papers.",
    "രേഖകളിൽ കാണുന്നതുപോലെ നമ്പർ നൽകുക.",
  ),
  lookupMiss: t(
    "No case matches this number. Check your summons, or the case may not be in the system yet.",
    "ഈ നമ്പറിന് ചേരുന്ന കേസ് കണ്ടെത്തിയില്ല. സമൻസ് പരിശോധിക്കുക; കേസ് ഇനിയും സിസ്റ്റത്തിൽ എത്തിയിട്ടില്ലായിരിക്കാം.",
  ),
  search: t("Find case", "കേസ് കണ്ടെത്തുക"),

  /* access code — manual entry only; everyone joining needs it (JOIN-13) */
  codeBody: t(
    "Enter the six-digit code for this case.",
    "ഈ കേസിന്റെ ആറക്ക കോഡ് നൽകുക.",
  ),
  codeLabel: t("Access code", "ആക്‌സസ് കോഡ്"),
  codeCaseLead: t("You are joining", "നിങ്ങൾ ചേരുന്ന കേസ്"),
  /* Arriving from the summons QR or link (owner, 2026-10-14): the case is known, the
     code is still asked. Malayalam drafted — needs review. */
  codeSummonsBody: t(
    "Enter the six-digit access code printed on your summons.",
    "നിങ്ങളുടെ സമൻസിൽ അച്ചടിച്ചിട്ടുള്ള ആറക്ക ആക്‌സസ് കോഡ് നൽകുക.",
  ),
  codeSummonsNote: t(
    "The code is printed on your summons, next to the QR code.",
    "കോഡ് നിങ്ങളുടെ സമൻസിൽ, QR കോഡിന് അടുത്തായി അച്ചടിച്ചിട്ടുണ്ട്.",
  ),
  /* The advocate holds a client's summons, not their own. */
  codeSummonsBodyAdvocate: t(
    "Enter the six-digit access code printed on the summons.",
    "സമൻസിൽ അച്ചടിച്ചിട്ടുള്ള ആറക്ക ആക്‌സസ് കോഡ് നൽകുക.",
  ),
  codeSummonsNoteAdvocate: t(
    "The code is printed on the summons, next to the QR code.",
    "കോഡ് സമൻസിൽ, QR കോഡിന് അടുത്തായി അച്ചടിച്ചിട്ടുണ്ട്.",
  ),
  notMyCase: t("Not my case?", "എന്റെ കേസ് അല്ലേ?"),
  backToSummonsCase: t("Back to the summons case", "സമൻസിലെ കേസിലേക്ക് മടങ്ങുക"),
  codeNote: t(
    "The code is printed on the summons. Parties who have already joined the case can also share it with you.",
    "കോഡ് സമൻസിൽ അച്ചടിച്ചിട്ടുണ്ട്. കേസിൽ ഇതിനകം ചേർന്ന കക്ഷികൾക്കും ഇത് നിങ്ങളുമായി പങ്കിടാം.",
  ),
  codeError: t("Enter the six-digit access code.", "ആറക്ക ആക്‌സസ് കോഡ് നൽകുക."),
  codeVerify: t("Verify access code", "ആക്‌സസ് കോഡ് പരിശോധിക്കുക"),

  /* details */
  detailsBody: t(
    "Check that this is your case before you continue.",
    "തുടരുന്നതിന് മുൻപ് ഇത് നിങ്ങളുടെ കേസാണെന്ന് ഉറപ്പാക്കുക.",
  ),
  acknowledgeNote: t(
    "By joining this case you confirm that the summons has reached you.",
    "ഈ കേസിൽ ചേരുന്നതിലൂടെ സമൻസ് നിങ്ങൾക്ക് ലഭിച്ചു എന്ന് സ്ഥിരീകരിക്കുന്നു.",
  ),
  downloadCaseFile: t("Download case file", "കേസ് ഫയൽ ഡൗൺലോഡ് ചെയ്യുക"),
  downloadCaseFilePrototype: t(
    "The case file will download here.",
    "കേസ് ഫയൽ ഇവിടെ ഡൗൺലോഡ് ചെയ്യും.",
  ),

  /* identity */
  identityBody: t(
    "Tell us who you are and how you will join the case.",
    "നിങ്ങൾ ആരാണെന്നും കേസിൽ എങ്ങനെ ചേരുമെന്നും ഞങ്ങളോട് പറയുക.",
  ),
  whoLegend: t("Who are you joining as?", "നിങ്ങൾ ആരായാണ് ചേരുന്നത്?"),
  whoSelf: t("I am the accused", "ഞാൻ തന്നെയാണ് പ്രതി"),
  accusedExplainTitle: t("What does accused mean?", "പ്രതി എന്നാൽ എന്ത്?"),
  accusedExplainBody: t(
    "The accused is the person or organisation named in the complaint as the person who must respond to the case. It does not mean the court has found them guilty.",
    "കേസിന് മറുപടി നൽകേണ്ട വ്യക്തിയോ സ്ഥാപനമോ ആയി പരാതിയിൽ പേരുള്ള ആളാണ് പ്രതി. കോടതി കുറ്റക്കാരനായി കണ്ടെത്തി എന്നല്ല ഇതിന്റെ അർത്ഥം.",
  ),
  whoPoa: t(
    "I am a power of attorney (PoA) holder",
    "ഞാൻ ഒരു പവർ ഓഫ് അറ്റോർണി ഉടമയാണ്",
  ),
  poaExplainTitle: t(
    "What is a power of attorney (PoA) holder?",
    "പവർ ഓഫ് അറ്റോർണി എന്നാൽ എന്ത്?",
  ),
  poaExplainBody: t(
    "A written authorisation that lets you act in this case for a complainant or an accused, for example for a parent abroad or a relative who is unwell. The person can revoke it at any time.",
    "പരാതിക്കാരന് വേണ്ടിയോ പ്രതിക്ക് വേണ്ടിയോ ഈ കേസിൽ പ്രവർത്തിക്കാൻ അനുവദിക്കുന്ന രേഖാമൂലമുള്ള അധികാരപത്രം. ഉദാഹരണത്തിന് വിദേശത്തുള്ള മാതാപിതാവിനോ അസുഖമുള്ള ബന്ധുവിനോ വേണ്ടി. ആ വ്യക്തിക്ക് എപ്പോൾ വേണമെങ്കിലും ഇത് റദ്ദാക്കാം.",
  ),
  whichSelfLabel: t("Who among these people are you?", "ഇവരിൽ നിങ്ങൾ ആരാണ്?"),
  poaSideLegend: t(
    "Are you a PoA holder for a complainant or an accused?",
    "പരാതിക്കാരന്റെയോ പ്രതിയുടെയോ പവർ ഓഫ് അറ്റോർണി ഉടമയാണോ നിങ്ങൾ?",
  ),
  poaSideComplainant: t("Complainant", "പരാതിക്കാരൻ"),
  poaSideAccused: t("Accused", "പ്രതി"),
  poaSideError: t("Choose a side.", "ഒരു ഭാഗം തിരഞ്ഞെടുക്കുക."),
  whichPoaLabel: t(
    "Who do you hold power of attorney for?",
    "ആർക്ക് വേണ്ടിയാണ് നിങ്ങൾക്ക് പവർ ഓഫ് അറ്റോർണി ഉള്ളത്?",
  ),
  whichPoaHint: t(
    "Choose everyone you hold power of attorney for in this case.",
    "ഈ കേസിൽ നിങ്ങൾക്ക് പവർ ഓഫ് അറ്റോർണി ഉള്ള എല്ലാവരെയും തിരഞ്ഞെടുക്കുക.",
  ),
  whichPoaPlaceholder: t("Choose name(s)", "പേരുകൾ തിരഞ്ഞെടുക്കുക"),
  whichPoaEmpty: t("No names found.", "പേരുകൾ കണ്ടെത്തിയില്ല."),
  whichPoaError: t("Choose at least one name.", "കുറഞ്ഞത് ഒരു പേര് തിരഞ്ഞെടുക്കുക."),
  whichPlaceholder: t("Choose a name", "ഒരു പേര് തിരഞ്ഞെടുക്കുക"),
  whichError: t("Choose a name from the list.", "പട്ടികയിൽ നിന്ന് ഒരു പേര് തിരഞ്ഞെടുക്കുക."),
  mappingNote: t(
    "You are joining as {name}. Your account will be linked to that name in the case record.",
    "{name} ആയാണ് നിങ്ങൾ ചേരുന്നത്. കേസ് രേഖയിൽ ആ പേരുമായി നിങ്ങളുടെ അക്കൗണ്ട് ബന്ധിപ്പിക്കും.",
  ),
  alreadyJoined: t(
    "{name} has already joined this case. If this is you, sign in with the account used earlier, or call the court on 0000 000000.",
    "{name} ഇതിനകം ഈ കേസിൽ ചേർന്നിട്ടുണ്ട്. ഇത് നിങ്ങളാണെങ്കിൽ, നേരത്തെ ഉപയോഗിച്ച അക്കൗണ്ടിൽ സൈൻ ഇൻ ചെയ്യുക, അല്ലെങ്കിൽ 0000 000000 എന്ന നമ്പറിൽ കോടതിയെ വിളിക്കുക.",
  ),
  poaAlreadyTaken: t(
    "Another power of attorney holder is already managing this case for {name}. Only one power of attorney holder can act at a time — call the court on 0000 000000 if this needs to change.",
    "{name}-ന് വേണ്ടി മറ്റൊരു പവർ ഓഫ് അറ്റോർണി ഉടമ ഇതിനകം ഈ കേസ് കൈകാര്യം ചെയ്യുന്നു. ഒരു സമയം ഒരു പവർ ഓഫ് അറ്റോർണി ഉടമയ്ക്ക് മാത്രമേ പ്രവർത്തിക്കാനാകൂ — ഇത് മാറ്റണമെങ്കിൽ 0000 000000 എന്ന നമ്പറിൽ കോടതിയെ വിളിക്കുക.",
  ),
  appearLegend: t(
    "How will you appear in court?",
    "കോടതിയിൽ എങ്ങനെ ഹാജരാകും?",
  ),
  /* "Find a lawyer", pointing to free legal aid at the District Legal Services
     Authority (owner, 2026-10-14). Malayalam drafted — needs review. */
  /* Field feedback row 163. Malayalam drafted — needs review. */
  appearHire: t("I want to find a lawyer", "എനിക്ക് ഒരു അഭിഭാഷകനെ കണ്ടെത്തണം"),
  appearHireHint: t(
    "You can join now and add an advocate later.",
    "ഇപ്പോൾ ചേരുകയും പിന്നീട് അഭിഭാഷകനെ ചേർക്കുകയും ചെയ്യാം.",
  ),
  findAdvocate: t("About free legal aid", "സൗജന്യ നിയമസഹായത്തെക്കുറിച്ച്"),
  findAdvocateHelp: t(
    "The District Legal Services Authority gives free legal aid and can assign you a lawyer.",
    "ജില്ലാ നിയമ സേവന അതോറിറ്റി സൗജന്യ നിയമസഹായം നൽകുകയും നിങ്ങൾക്ക് ഒരു അഭിഭാഷകനെ നിയോഗിക്കുകയും ചെയ്യും.",
  ),
  openBarCouncil: t("Open the legal aid portal", "നിയമസഹായ പോർട്ടൽ തുറക്കുക"),
  findAdvocateHref: "https://nalsa.gov.in/",
  /* Next step on the joined screen (owner, 2026-10-14). Malayalam drafted. */
  nextShareCode: t(
    "Next, give your advocate your access code ({code}) or your summons. They need it to join the case for you.",
    "അടുത്തതായി, നിങ്ങളുടെ ആക്‌സസ് കോഡ് ({code}) അല്ലെങ്കിൽ സമൻസ് അഭിഭാഷകന് നൽകുക. നിങ്ങൾക്കായി കേസിൽ ചേരാൻ അവർക്ക് അത് ആവശ്യമാണ്.",
  ),
  nextFindLawyer: t(
    "Next, once you have a lawyer, give them your access code ({code}) or your summons. They need it to join the case for you.",
    "അടുത്തതായി, അഭിഭാഷകനെ ലഭിച്ചാൽ നിങ്ങളുടെ ആക്‌സസ് കോഡ് ({code}) അല്ലെങ്കിൽ സമൻസ് അവർക്ക് നൽകുക. നിങ്ങൾക്കായി കേസിൽ ചേരാൻ അവർക്ക് അത് ആവശ്യമാണ്.",
  ),
  appearAdvocate: t("I already have an advocate", "എനിക്ക് ഇതിനകം ഒരു അഭിഭാഷകനുണ്ട്"),
  appearAdvocateHint: t(
    "Your advocate can join the case separately. You get access now.",
    "നിങ്ങളുടെ അഭിഭാഷകന് പ്രത്യേകം കേസിൽ ചേരാം. നിങ്ങൾക്ക് ഇപ്പോൾ ആക്‌സസ് ലഭിക്കും.",
  ),
  appearSelf: t(
    "I will represent myself (Party in Person)",
    "ഞാൻ സ്വയം ഹാജരാകും (പാർട്ടി ഇൻ പേഴ്‌സൺ)",
  ),
  appearSelfHint: t(
    "Called appearing as a party in person. You upload an affidavit and get access straight away.",
    "പാർട്ടി ഇൻ പേഴ്‌സൺ എന്നാണ് ഇതിന് പേര്. ഒരു സത്യവാങ്മൂലം അപ്‌ലോഡ് ചെയ്താൽ ഉടൻ ആക്‌സസ് ലഭിക്കും.",
  ),
  appearSelfUnavailable: t(
    "Representing yourself is not offered here because an advocate is already on record for the accused.",
    "പ്രതിക്കായി ഒരു അഭിഭാഷകൻ ഇതിനകം രേഖയിലുള്ളതിനാൽ സ്വയം ഹാജരാകാനുള്ള ഓപ്ഷൻ ഇവിടെ ലഭ്യമല്ല.",
  ),
  pipDocLabel: t("Affidavit", "സത്യവാങ്മൂലം"),
  pipDocHelp: t(
    "Upload your signed affidavit as a JPG, JPEG, PNG or PDF.",
    "ഒപ്പിട്ട സത്യവാങ്മൂലം JPG, JPEG, PNG അല്ലെങ്കിൽ PDF ആയി അപ്‌ലോഡ് ചെയ്യുക.",
  ),
  pipDocError: t(
    "Upload the affidavit before continuing.",
    "തുടരുന്നതിന് മുമ്പ് സത്യവാങ്മൂലം അപ്‌ലോഡ് ചെയ്യുക.",
  ),
  appearError: t(
    "Choose how you will appear in court.",
    "കോടതിയിൽ എങ്ങനെ ഹാജരാകുമെന്ന് തിരഞ്ഞെടുക്കുക.",
  ),
  poaDocLabel: t("Authorization document", "അധികാര രേഖ"),
  /* Each party's fields carry its name, in place of a heading over them that read past
     (owner, 2026-10-14). Malayalam drafted — needs review. */
  poaDocLabelFor: t("Authorization document for {name}", "{name}-ന്റെ അധികാര രേഖ"),
  /* Name first, so with several parties the field is found by its person
     (owner, 2026-10-14). */
  poaPhoneLabelFor: t("{name}'s mobile number", "{name}-ന്റെ മൊബൈൽ നമ്പർ"),
  poaDocSlot: t("Signed copy", "ഒപ്പിട്ട പകർപ്പ്"),
  poaJoinedChip: t("Joined", "ചേർന്നു"),
  poaPhoneJoinedNote: t(
    "Already on the case. This is the number on their account.",
    "ഇതിനകം കേസിലുണ്ട്. ഇത് അവരുടെ അക്കൗണ്ടിലെ നമ്പറാണ്.",
  ),
  poaPartyHeading: t(
    "For {name}",
    "{name}-ന് വേണ്ടി",
  ),
  poaDocHelp: t(
    "Upload a JPG, JPEG, PNG or PDF.",
    "JPG, JPEG, PNG അല്ലെങ്കിൽ PDF അപ്‌ലോഡ് ചെയ്യുക.",
  ),
  poaDocTooltipLabel: t(
    "About the authorization document",
    "അധികാര രേഖയെക്കുറിച്ച്",
  ),
  poaDocTooltip: t(
    "Upload an affidavit signed by the person who is authorizing you to act on their behalf.",
    "നിങ്ങളെ അവർക്ക് വേണ്ടി പ്രവർത്തിക്കാൻ അധികാരപ്പെടുത്തുന്ന വ്യക്തി ഒപ്പിട്ട സത്യവാങ്മൂലം അപ്‌ലോഡ് ചെയ്യുക.",
  ),
  poaDocSample: t("Download a sample", "ഒരു മാതൃക ഡൗൺലോഡ് ചെയ്യുക"),
  poaDocSamplePrototype: t(
    "A sample authorization document will download here.",
    "ഒരു മാതൃകാ അധികാര രേഖ ഇവിടെ ഡൗൺലോഡ് ചെയ്യും.",
  ),
  poaDocError: t(
    "Upload the authorization document before continuing.",
    "തുടരുന്നതിന് മുമ്പ് അധികാര രേഖ അപ്‌ലോഡ് ചെയ്യുക.",
  ),
  poaPhoneLabel: t("Their mobile number", "അവരുടെ മൊബൈൽ നമ്പർ"),
  poaPhoneHelp: t(
    "We'll text this number. The case is linked to their account once they sign in and confirm it's them.",
    "ഈ നമ്പറിലേക്ക് SMS അയക്കും. അവർ സൈൻ ഇൻ ചെയ്ത് അത് അവരാണെന്ന് സ്ഥിരീകരിച്ചാൽ കേസ് അവരുടെ അക്കൗണ്ടുമായി ബന്ധിപ്പിക്കും.",
  ),
  poaPhoneOnRecord: t(
    "Already on the case — no number needed.",
    "ഇതിനകം കേസിലുണ്ട് — നമ്പർ ആവശ്യമില്ല.",
  ),
  poaAccusedPhoneError: t(
    "Enter a 10-digit mobile number.",
    "10 അക്ക മൊബൈൽ നമ്പർ നൽകുക.",
  ),
  joinSubmit: t("Join this case", "ഈ കേസിൽ ചേരുക"),

  /* outcomes */
  joinedTitle: t("You have joined this case", "നിങ്ങൾ ഈ കേസിൽ ചേർന്നു"),
  joinedBody: t(
    "You can now read the complaint and act in the case as {name}.",
    "ഇനി {name} ആയി പരാതി വായിക്കാനും കേസിൽ നടപടിയെടുക്കാനും കഴിയും.",
  ),
  poaJoinedBody: t(
    "You can now act in this case for {name} as their power of attorney holder.",
    "ഇനി {name}-ന്റെ പവർ ഓഫ് അറ്റോർണി ഉടമയായി ഈ കേസിൽ പ്രവർത്തിക്കാം.",
  ),
  /* The settled band on the joined case (Oct 6). Malayalam drafted — needs review. */
  joinedBand: t("Joined as {name}", "{name} ആയി ചേർന്നു"),
  poaJoinedBand: t(
    "Joined as power of attorney holder for {name}",
    "{name}-ന്റെ പവർ ഓഫ് അറ്റോർണി ഉടമയായി ചേർന്നു",
  ),
  smsSentNote: t(
    "We've texted {numbers}. The case is linked to each person's account once they sign in and confirm it's them.",
    "{numbers} എന്ന നമ്പറുകളിലേക്ക് SMS അയച്ചു. ഓരോരുത്തരും സൈൻ ഇൻ ചെയ്ത് സ്ഥിരീകരിച്ചാൽ കേസ് അവരുടെ അക്കൗണ്ടുമായി ബന്ധിപ്പിക്കും.",
  ),
  viewCase: t("View case", "കേസ് കാണുക"),
  fileBail: t("File bail application", "ജാമ്യാപേക്ഷ നൽകുക"),
  addAdvocate: t("Add advocate", "അഭിഭാഷകനെ ചേർക്കുക"),
  addAdvocatePrototype: t(
    "The add-advocate flow will open here.",
    "അഭിഭാഷകനെ ചേർക്കാനുള്ള ഫ്ലോ ഇവിടെ തുറക്കും.",
  ),
  backHome: t("Back to home", "ഹോമിലേക്ക് മടങ്ങുക"),

  /* shared chrome */
  back: t("Back", "പുറകോട്ട്"),
  close: t("Close", "അടയ്ക്കുക"),
  continue: t("Continue", "തുടരുക"),
} as const;

/* ------------------------------------------------------------------ app shell */

export const shell = {
  navHome: t("Home", "ഹോം"),
  navCases: t("Your cases", "നിങ്ങളുടെ കേസുകൾ"),
  navHearings: t("Hearings", "ഹിയറിംഗുകൾ"),
  navHelp: t("Get help", "സഹായം"),
  navGroup: t("Portal", "പോർട്ടൽ"),
  breadcrumbHome: t("Home", "ഹോം"),
  breadcrumbAllCases: t("All cases", "എല്ലാ കേസുകളും"),
  collapse: t("Collapse", "ചുരുക്കുക"),
  expand: t("Expand", "വികസിപ്പിക്കുക"),
  role: t("Litigant", "കക്ഷി"),
  profileIncomplete: t("Complete your profile", "പ്രൊഫൈൽ പൂർത്തിയാക്കുക"),
  profileIncompleteLabel: t(
    "Profile incomplete",
    "പ്രൊഫൈൽ പൂർത്തിയായിട്ടില്ല",
  ),
  notifications: t("Notifications", "അറിയിപ്പുകൾ"),
  noNotifications: t(
    "Nothing yet. Updates about your case and account will appear here.",
    "ഇതുവരെ ഒന്നുമില്ല. കേസും അക്കൗണ്ടും സംബന്ധിച്ച അറിയിപ്പുകൾ ഇവിടെ വരും.",
  ),
  justNow: t("Just now", "ഇപ്പോൾ"),
  clearAllNotifications: t("Clear all", "എല്ലാം മായ്ക്കുക"),
  prototypeNav: t(
    "This section will open here.",
    "ഈ ഭാഗം ഇവിടെ തുറക്കും.",
  ),
} as const;

export const profileCompletion = {
  notificationTitle: t(
    "Complete your profile",
    "പ്രൊഫൈൽ പൂർത്തിയാക്കുക",
  ),
  notificationBody: t(
    "Add your address and official ID from your profile.",
    "പ്രൊഫൈലിൽ നിന്ന് വിലാസവും ഔദ്യോഗിക IDയും ചേർക്കുക.",
  ),
  action: t("Complete profile", "പ്രൊഫൈൽ പൂർത്തിയാക്കുക"),
} as const;

/* ------------------------------------------------------------- ID submission */

export const idUpload = {
  title: t("Add your ID", "നിങ്ങളുടെ ID ചേർക്കുക"),
  expandPreview: t("Open a larger ID preview", "IDയുടെ വലിയ പ്രിവ്യൂ തുറക്കുക"),
  previewTitle: t("Official ID preview", "ഔദ്യോഗിക ID പ്രിവ്യൂ"),
  previewDescription: t(
    "Check the uploaded ID before submitting it.",
    "സമർപ്പിക്കുന്നതിന് മുമ്പ് അപ്‌ലോഡ് ചെയ്ത ID പരിശോധിക്കുക.",
  ),
  previewAlt: t(
    "Preview of the uploaded official ID",
    "അപ്‌ലോഡ് ചെയ്ത ഔദ്യോഗിക IDയുടെ പ്രിവ്യൂ",
  ),
  body: t(
    "Upload one clear copy of an official ID to add it to your profile.",
    "നിങ്ങളുടെ പ്രൊഫൈലിൽ ചേർക്കാൻ ഒരു ഔദ്യോഗിക IDയുടെ വ്യക്തമായ പകർപ്പ് അപ്‌ലോഡ് ചെയ്യുക.",
  ),
  typeLabel: t("Type of ID", "ID തരം"),
  typePlaceholder: t("Choose an ID", "ഒരു ID തിരഞ്ഞെടുക്കുക"),
  idTypes: {
    aadhaar: t("Aadhaar", "ആധാർ"),
    licence: t("Driving licence", "ഡ്രൈവിംഗ് ലൈസൻസ്"),
    pan: t("PAN card", "പാൻ കാർഡ്"),
    passport: t("Passport", "പാസ്‌പോർട്ട്"),
    voter: t("Voter ID", "വോട്ടർ ID"),
    other: t("Other", "മറ്റുള്ളവ"),
  },
  uploadLabel: t("Official ID", "ഔദ്യോഗിക ID"),
  fileHelp: t(
    "JPG, JPEG, PNG or PDF · up to 10 MB",
    "JPG, JPEG, PNG അല്ലെങ്കിൽ PDF · പരമാവധി 10 MB",
  ),
  chooseTypeFirst: t(
    "Choose the type of ID before uploading a file.",
    "ഫയൽ അപ്‌ലോഡ് ചെയ്യുന്നതിന് മുമ്പ് ID തരം തിരഞ്ഞെടുക്കുക.",
  ),
  choose: t("Choose file", "ഫയൽ തിരഞ്ഞെടുക്കുക"),
  change: t("Change file", "ഫയൽ മാറ്റുക"),
  processing: t("Checking the scan…", "സ്കാൻ പരിശോധിക്കുന്നു…"),
  goodScan: t("Good scan", "വ്യക്തമായ സ്കാൻ"),
  poorScan: t("Needs a clearer scan", "കൂടുതൽ വ്യക്തമായ സ്കാൻ വേണം"),
  poorScanHelp: t(
    "This image may be too small or unclear to read reliably. Upload a sharper photo or scan.",
    "ഈ ചിത്രം വിശ്വസനീയമായി വായിക്കാൻ ചെറുതോ അവ്യക്തമോ ആയിരിക്കാം. കൂടുതൽ വ്യക്തമായ ഫോട്ടോ അല്ലെങ്കിൽ സ്കാൻ അപ്‌ലോഡ് ചെയ്യുക.",
  ),
  badFile: t(
    "Choose a JPG, JPEG, PNG or PDF file smaller than 10 MB.",
    "10 MB-ൽ കുറഞ്ഞ JPG, JPEG, PNG അല്ലെങ്കിൽ PDF ഫയൽ തിരഞ്ഞെടുക്കുക.",
  ),
  missing: t(
    "Choose the type of ID and upload a clear file.",
    "ID തരം തിരഞ്ഞെടുത്ത് വ്യക്തമായ ഫയൽ അപ്‌ലോഡ് ചെയ്യുക.",
  ),
  submit: t("Submit ID", "ID സമർപ്പിക്കുക"),
  submittedTitle: t("ID submitted", "ID സമർപ്പിച്ചു"),
  submittedBody: t(
    "Your official ID has been added to your profile.",
    "നിങ്ങളുടെ ഔദ്യോഗിക ID പ്രൊഫൈലിൽ ചേർത്തു.",
  ),
  done: t("Done", "ശരി"),
  notifSubmittedTitle: t("ID submitted", "ID സമർപ്പിച്ചു"),
  notifSubmittedBody: t(
    "Your official ID has been added to your profile.",
    "നിങ്ങളുടെ ഔദ്യോഗിക ID പ്രൊഫൈലിൽ ചേർത്തു.",
  ),
} as const;

/* ------------------------------------------------------------------ case details */

export const caseDetails = {
  caseTypeBadge: t("Cheque bounce · NIA S138", "ചെക്ക് മടക്കം · NIA S138"),
  court: t("Court", "കോടതി"),
  /* Malayalam drafted (Oct 6) — needs review. */
  courtroom: t("Courtroom", "കോടതി മുറി"),
  hearing: t("Next hearing", "അടുത്ത ഹിയറിംഗ്"),
  caseNumber: t("Case number", "കേസ് നമ്പർ"),
  cnr: t("CNR number", "CNR നമ്പർ"),
  /* The number the case was registered under, not the e-filing number (owner, 12 Oct). */
  filingNumber: t("Registration number", "രജിസ്ട്രേഷൻ നമ്പർ"),
  filingDate: t("Filing date", "ഫയലിംഗ് തീയതി"),
  chequeAmount: t("Amount claimed", "ആവശ്യപ്പെടുന്ന തുക"),
  complainant: t("Complainant", "പരാതിക്കാരൻ"),
  complainantAdvocate: t("Complainant's advocate", "പരാതിക്കാരന്റെ അഭിഭാഷകൻ"),
  complainantAdvocateContact: t("Contact the complainant's advocate", "പരാതിക്കാരന്റെ അഭിഭാഷകനെ ബന്ധപ്പെടുക"),
  complainantAdvocateContactBody: t("You can contact the complainant's advocate if you want to discuss payment or settlement.", "പണമടയ്ക്കലോ ഒത്തുതീർപ്പോ ചർച്ച ചെയ്യാൻ പരാതിക്കാരന്റെ അഭിഭാഷകനെ ബന്ധപ്പെടാം."),
  callAdvocate: t("Call advocate", "അഭിഭാഷകനെ വിളിക്കുക"),
  accusedAdvocate: t("Accused's advocate", "പ്രതിയുടെ അഭിഭാഷകൻ"),
  accusedParties: t("Accused", "പ്രതികൾ"),
  otherAccused: t("Other accused", "മറ്റ് പ്രതി"),
} as const;

export function fill(copy: Copy, locale: Locale, values: Record<string, string>) {
  return Object.entries(values).reduce(
    (text, [key, value]) => text.replaceAll(`{${key}}`, value),
    // English where no translation exists yet (Hindi, today).
    copy[locale] ?? copy.en,
  );
}
