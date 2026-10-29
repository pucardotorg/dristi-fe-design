import type { Copy } from "@/lib/onboarding/content";

export { fill as fillCopy } from "@/lib/join/content";

/**
 * Filings: content model for the bail application flow (Aug 24 brief).
 *
 * The flow starts on a case file (Appearance stage) from the "Make filings"
 * control: raise an application → type = bail → petitioner + grounds → optional
 * surety details for the bail bond → generated application → signature →
 * court fee → submitted. Legacy reference: the "Bail and Bail Bond Workflow"
 * walkthrough (Make a Submission page in the current DRISTI).
 *
 * Departures from legacy, all deliberate:
 * · Staged dialog instead of one long page: the app's flow surface.
 * · Legacy's locked "Submission Type: Application" field is dropped; the menu
 *   entry already said what this is.
 * · The unpaid court fee never blocks the submission; it becomes a pending
 *   task (the Aug 14 vakalatnama-fee decision, applied consistently).
 * · One consolidated note about surety phone/email use instead of legacy's
 *   per-field warning block.
 *
 * In this court's practice bail is ordinarily granted on sureties and the magistrate
 * usually asks for two, so the "yes" branch starts with two surety forms.
 */

const t = (en: string, ml: string): Copy => ({ en, ml });

/* ------------------------------------------------------------------- demo data */

/** Application fee for a bail application, in rupees (this court's schedule). */
export const BAIL_FEE = "₹50";

/** Demo submission identity shown on the success stage. */
export const BAIL_SUBMISSION_ID = "KL-000847-2026-AP1";
export const BAIL_SUBMISSION_DATE = "24-08-2026";

export type BailPetitioner = {
  id: string;
  name: string;
  /** Father's name from the case record, machine-prefilled and human-unverified. */
  father: string;
};

/** The accused this advocate represents on the demo case (same world as the
 *  join-flow fixtures); bail is applied for on their behalf. */
export const BAIL_PETITIONERS: BailPetitioner[] = [
  { id: "acc-1", name: "Rajan Krishnan Nair", father: "Krishnan Nair" },
  { id: "acc-2", name: "Suresh Babu P.", father: "Babu Pillai" },
];

export type ApplicationTypeOption = {
  id: string;
  label: Copy;
  /** Only the bail application is designed; the rest are separate flows. */
  available: boolean;
};

/** The legacy application-type list, unchanged in order. */
export const APPLICATION_TYPES: ApplicationTypeOption[] = [
  { id: "advancement", label: t("Advancement / reschedule", "വാദം നേരത്തേയാക്കൽ / മാറ്റിവയ്ക്കൽ"), available: false },
  { id: "bail", label: t("Bail", "ജാമ്യം"), available: true },
  { id: "condonation", label: t("Condonation of delay", "കാലതാമസം മാപ്പാക്കൽ"), available: false },
  { id: "others", label: t("Others", "മറ്റുള്ളവ"), available: false },
  { id: "production", label: t("Production of documents", "രേഖകൾ ഹാജരാക്കൽ"), available: false },
  { id: "settlement", label: t("Settlement", "ഒത്തുതീർപ്പ്"), available: false },
  { id: "transfer", label: t("Transfer", "ട്രാൻസ്ഫർ"), available: false },
  { id: "withdrawal", label: t("Withdrawal", "പിൻവലിക്കൽ"), available: false },
];

/* ------------------------------------------------------------ bail bond fixtures */

/** Demo bond identity and the terms the magistrate set on the bail application. */
export const BOND_ID = "KL-000847-2026-BA1";
export const BOND_AMOUNT = "₹50,000";
/** The magistrate asked for one surety more than the application carried. */
export const BOND_REQUIRED_SURETIES = 3;
export const BOND_TASK_DUE = "28 Aug 2026";
/** The same deadline as an ISO date, for the ranked due-status line. */
export const BOND_TASK_DUE_ON = "2026-08-28";
/** When the demo bond reached the record, for its row under Documents › Bail bonds. */
export const BOND_SUBMITTED_ON = "2026-08-26";
/** The link the litigant and sureties receive by SMS/email. The demo route serves it. */
export const BOND_SIGN_LINK = "https://dristi-kerala.pucar.org/bond?code=na5An";
export const BOND_SIGN_PATH = "/bond";

export type BondSurety = {
  name: string;
  father: string;
  phone: string;
  email: string;
  /** One-line display address — the full split lives on the application record. */
  address: string;
};

/** Sureties carried over from the approved bail application. */
export const BOND_SURETIES: BondSurety[] = [
  {
    name: "Sunil Kumar V.",
    father: "Velayudhan",
    phone: "9148498792",
    email: "sunil.kumar@example.in",
    address: "Kadappakada · 691 008, Kerala",
  },
  {
    name: "Latha Devi R.",
    father: "Raghavan",
    phone: "9847654321",
    email: "",
    address: "Asramam · 691 002, Kerala",
  },
];

/** Stands in for the surety added while raising the bond (the magistrate asked
 *  for a third) — the status and edit surfaces show it as approved. */
export const BOND_THIRD_SURETY: BondSurety = {
  name: "Peethambaran K.",
  father: "Kesavan",
  phone: "9645011223",
  email: "",
  address: "Chinnakada · 691 001, Kerala",
};

/** The litigant the bond is for (petitioner on the approved application). */
export const BOND_LITIGANT = {
  name: "Rajan Krishnan Nair",
  father: "Krishnan Nair",
  phone: "9846012345",
};

/* -------------------------------------------------------------- case file menu */

export const filingsMenu = {
  makeFilings: t("Make filings", "ഫയലിംഗുകൾ ചെയ്യുക"),
  raiseApplication: t("Raise an application", "അപേക്ഷ സമർപ്പിക്കുക"),
  submitDocuments: t("Submit documents", "രേഖകൾ സമർപ്പിക്കുക"),
  generateBailBond: t("Generate bail bond", "ജാമ്യ ബോണ്ട് തയ്യാറാക്കുക"),
  stubNotice: t(
    "This filing is designed separately and will be added later.",
    "ഈ ഫയലിംഗ് പ്രത്യേകം രൂപകൽപ്പന ചെയ്യുന്നു; പിന്നീട് ചേർക്കും.",
  ),
} as const;

/* ------------------------------------------------------------------ the dialog */

export const bailDialog = {
  /* Under the heading (owner, 2026-10-14): the summons already sets the terms out.
     Malayalam drafted — needs review. */
  fromSummons: t(
    "The bail conditions are printed on the summons, under “Contest the case”. You can copy them from there.",
    "ജാമ്യ വ്യവസ്ഥകൾ സമൻസിൽ “കേസ് എതിർക്കുക” എന്നതിന് കീഴിൽ അച്ചടിച്ചിട്ടുണ്ട്. അവിടെ നിന്ന് പകർത്താം.",
  ),
  /* closing midway: the same question every filing dialog asks */
  discardTitle: t("Discard this application?", "ഈ അപേക്ഷ ഉപേക്ഷിക്കണോ?"),
  discardBody: t(
    "Anything you entered will be lost.",
    "നിങ്ങൾ നൽകിയതെല്ലാം നഷ്ടപ്പെടും.",
  ),
  discardKeep: t("Keep editing", "തിരുത്തൽ തുടരുക"),
  discardConfirm: t("Discard", "ഉപേക്ഷിക്കുക"),
  title: t("Bail application", "ജാമ്യാപേക്ഷ"),

  /* application details */
  detailsBody: t(
    "Set out the grounds. The application is generated for you from these details.",
    "കാരണങ്ങൾ വ്യക്തമാക്കുക. ഈ വിവരങ്ങളിൽ നിന്ന് അപേക്ഷ നിങ്ങൾക്കായി തയ്യാറാക്കും.",
  ),
  typeLabel: t("Application type", "അപേക്ഷയുടെ തരം"),
  typePlaceholder: t("Select a type", "തരം തിരഞ്ഞെടുക്കുക"),
  typeError: t("Choose the application type.", "അപേക്ഷയുടെ തരം തിരഞ്ഞെടുക്കുക."),
  typeOnlyBailNote: t(
    "Only the bail application is built in this prototype. The other types are separate flows and will open here later.",
    "ഈ പ്രോട്ടോടൈപ്പിൽ ജാമ്യാപേക്ഷ മാത്രമാണ് തയ്യാറായിട്ടുള്ളത്. മറ്റ് തരങ്ങൾ പ്രത്യേക പ്രവാഹങ്ങളാണ്; പിന്നീട് ഇവിടെ തുറക്കും.",
  ),
  petitionerLabel: t("Petitioner", "ഹർജിക്കാരൻ"),
  petitionerPlaceholder: t("Choose the litigant", "കക്ഷിയെ തിരഞ്ഞെടുക്കുക"),
  petitionerError: t("Choose the petitioner.", "ഹർജിക്കാരനെ തിരഞ്ഞെടുക്കുക."),
  fatherLabel: t("Petitioner's father's name", "ഹർജിക്കാരന്റെ പിതാവിന്റെ പേര്"),
  fatherError: t("Enter the father's name.", "പിതാവിന്റെ പേര് നൽകുക."),
  groundsLabel: t("Grounds and reasons for bail", "ജാമ്യത്തിനുള്ള കാരണങ്ങളും ന്യായങ്ങളും"),
  groundsHint: t(
    "This text goes into the generated application as you write it.",
    "നിങ്ങൾ എഴുതുന്നതുപോലെ ഈ വാചകം തയ്യാറാക്കുന്ന അപേക്ഷയിൽ ചേരും.",
  ),
  groundsError: t("Set out the grounds for bail.", "ജാമ്യത്തിനുള്ള കാരണങ്ങൾ നൽകുക."),
  commentsLabel: t("Comments", "അഭിപ്രായങ്ങൾ"),
  optional: t("Optional", "നിർബന്ധമല്ല"),
  /* prayer and supporting documents (Application Lifecycle PRD, Bail) */
  prayerLabel: t("Prayer", "പ്രാർത്ഥന"),
  prayerDefault: t(
    "That the petitioner be released on bail on such terms as this court considers fit.",
    "ഈ കോടതിക്ക് ഉചിതമെന്ന് തോന്നുന്ന വ്യവസ്ഥകളിൽ ഹർജിക്കാരനെ ജാമ്യത്തിൽ വിട്ടയക്കണമെന്ന്.",
  ),
  prayerHint: t(
    "What you ask the court to order. Change it if you need to.",
    "കോടതി ഉത്തരവിടണമെന്ന് നിങ്ങൾ ആവശ്യപ്പെടുന്നത്. ആവശ്യമെങ്കിൽ മാറ്റുക.",
  ),
  prayerError: t("Enter the prayer.", "പ്രാർത്ഥന നൽകുക."),
  documentsHeading: t("Supporting documents", "അനുബന്ധ രേഖകൾ"),
  documentsAdd: t("Add a document", "രേഖ ചേർക്കുക"),
  documentsAddAnother: t("Add another document", "മറ്റൊരു രേഖ ചേർക്കുക"),
  documentTitleN: t("Document {n}", "രേഖ {n}"),
  removeDocument: t("Remove document {n}", "രേഖ {n} നീക്കം ചെയ്യുക"),
  documentType: t("Document type", "രേഖയുടെ തരം"),
  documentTitle: t("Document title", "രേഖയുടെ പേര്"),
  documentFile: t("File", "ഫയൽ"),
  documentTypeError: t("Enter the document type.", "രേഖയുടെ തരം നൽകുക."),
  documentTitleError: t("Enter the document title.", "രേഖയുടെ പേര് നൽകുക."),
  documentFileError: t("Upload the document.", "രേഖ അപ്‌ലോഡ് ചെയ്യുക."),
  changeFile: t("Change file", "ഫയൽ മാറ്റുക"),
  removeFile: t("Remove", "നീക്കം ചെയ്യുക"),

  /* sureties */
  suretiesTitle: t("Surety details", "ജാമ്യക്കാരുടെ വിവരങ്ങൾ"),
  suretiesBody: t(
    "Bail here is ordinarily granted on sureties, people who vouch for the petitioner. The magistrate usually asks for two.",
    "ഇവിടെ സാധാരണയായി ജാമ്യക്കാരുടെ ഉറപ്പിന്മേലാണ് ജാമ്യം അനുവദിക്കുന്നത്, ഹർജിക്കാരന് വേണ്ടി ഉറപ്പുനൽകുന്നവർ. മജിസ്‌ട്രേറ്റ് സാധാരണ രണ്ട് പേരെ ആവശ്യപ്പെടും.",
  ),
  suretyQuestion: t(
    "Do you want to add surety details to the bail application?",
    "ജാമ്യാപേക്ഷയിൽ ജാമ്യക്കാരുടെ വിവരങ്ങൾ ചേർക്കണോ?",
  ),
  yes: t("Yes", "അതെ"),
  no: t("No", "ഇല്ല"),
  suretyChoiceError: t("Choose yes or no.", "അതെ അല്ലെങ്കിൽ ഇല്ല തിരഞ്ഞെടുക്കുക."),
  contactNote: t(
    "Each surety gets a link by SMS, and email, if given, to sign the bail bond. Make sure the number is really theirs; misrepresentation can lead to action against you.",
    "ജാമ്യ ബോണ്ടിൽ ഒപ്പിടാനുള്ള ലിങ്ക് ഓരോ ജാമ്യക്കാരനും SMS വഴി, ഇമെയിൽ നൽകിയാൽ അതുവഴിയും, ലഭിക്കും. നമ്പർ അവരുടേത് തന്നെയെന്ന് ഉറപ്പാക്കുക; തെറ്റായ വിവരം നൽകിയാൽ നിങ്ങൾക്കെതിരെ നടപടിയുണ്ടാകാം.",
  ),
  suretyTitle: t("Surety {n}", "ജാമ്യക്കാരൻ {n}"),
  removeSurety: t("Remove surety {n}", "ജാമ്യക്കാരൻ {n}-നെ നീക്കം ചെയ്യുക"),
  addSurety: t("Add another surety", "മറ്റൊരു ജാമ്യക്കാരനെ ചേർക്കുക"),
  fullNameLabel: t("Full name", "മുഴുവൻ പേര്"),
  suretyFatherLabel: t("Father's name", "പിതാവിന്റെ പേര്"),
  phoneLabel: t("Mobile number", "മൊബൈൽ നമ്പർ"),
  emailLabel: t("Email address", "ഇമെയിൽ വിലാസം"),
  addressHeading: t("Address", "വിലാസം"),
  address1Label: t("Address line 1", "വിലാസം വരി 1"),
  cityLabel: t("City or town", "നഗരം / പട്ടണം"),
  pincodeLabel: t("PIN code", "പിൻ കോഡ്"),
  districtLabel: t("District", "ജില്ല"),
  stateLabel: t("State", "സംസ്ഥാനം"),
  idProofLabel: t("Identity proof", "തിരിച്ചറിയൽ രേഖ"),
  solvencyLabel: t("Proof of solvency", "സാമ്പത്തിക ശേഷിയുടെ തെളിവ്"),
  solvencyHint: t(
    "For example, a land tax receipt or property document.",
    "ഉദാഹരണത്തിന്, ഭൂനികുതി രസീത് അല്ലെങ്കിൽ വസ്തുവിന്റെ രേഖ.",
  ),
  otherDocsLabel: t("Other documents", "മറ്റ് രേഖകൾ"),
  docHelp: t(
    "Upload a JPG, JPEG, PNG or PDF up to 10 MB.",
    "10 MB വരെ വലുപ്പമുള്ള JPG, JPEG, PNG അല്ലെങ്കിൽ PDF അപ്‌ലോഡ് ചെയ്യുക.",
  ),
  requiredError: t("This field is required.", "ഈ വിവരം നിർബന്ധമാണ്."),
  phoneError: t("Enter a valid 10-digit mobile number.", "സാധുവായ 10 അക്ക മൊബൈൽ നമ്പർ നൽകുക."),
  pincodeError: t("Enter the 6-digit PIN code.", "6 അക്ക പിൻ കോഡ് നൽകുക."),
  idProofError: t("Upload the identity proof.", "തിരിച്ചറിയൽ രേഖ അപ്‌ലോഡ് ചെയ്യുക."),
  solvencyError: t("Upload the proof of solvency.", "സാമ്പത്തിക ശേഷിയുടെ തെളിവ് അപ്‌ലോഡ് ചെയ്യുക."),
  generateApplication: t("Generate application", "അപേക്ഷ തയ്യാറാക്കുക"),
  generating: t("Preparing your application…", "നിങ്ങളുടെ അപേക്ഷ തയ്യാറാക്കുന്നു…"),

  /* review */
  reviewTitle: t("Review the application", "അപേക്ഷ പരിശോധിക്കുക"),
  reviewBody: t(
    "Check the generated application before you sign it.",
    "ഒപ്പിടുന്നതിന് മുൻപ് തയ്യാറാക്കിയ അപേക്ഷ പരിശോധിക്കുക.",
  ),
  summaryType: t("Application type", "അപേക്ഷയുടെ തരം"),
  summaryDate: t("Submission date", "സമർപ്പണ തീയതി"),
  summaryPetitioner: t("Petitioner", "ഹർജിക്കാരൻ"),
  summarySureties: t("Sureties", "ജാമ്യക്കാർ"),
  suretiesNone: t("None added", "ചേർത്തിട്ടില്ല"),
  suretiesCount: t("{count} added", "{count} പേരെ ചേർത്തു"),
  draftCourtLine: t(
    "Before the Special Court of Judicial Magistrate of the First Class for the trial of cases under section 138 of the NI Act, 1881 (“24×7 ON Court”)",
    "NI ആക്ട് 1881 വകുപ്പ് 138 പ്രകാരമുള്ള കേസുകളുടെ വിചാരണയ്ക്കായുള്ള ഒന്നാം ക്ലാസ് ജുഡീഷ്യൽ മജിസ്‌ട്രേറ്റിന്റെ പ്രത്യേക കോടതി മുൻപാകെ (“24×7 ON കോടതി”)",
  ),
  draftCaseLine: t("Case No: {caseNumber}", "കേസ് നമ്പർ: {caseNumber}"),
  draftMatterLine: t("In the matter of: {title}", "വിഷയം: {title}"),
  draftPageLabel: t("Page 1 of 2 · draft", "പേജ് 1 / 2 · കരട്"),

  /* signature */
  signTitle: t("Add your signature", "നിങ്ങളുടെ ഒപ്പ് ചേർക്കുക"),
  signBody: t(
    "Sign the application to submit it to the court.",
    "കോടതിയിൽ സമർപ്പിക്കാൻ അപേക്ഷയിൽ ഒപ്പിടുക.",
  ),
  tabEsign: t("e-Sign with Aadhaar", "ആധാർ ഇ-സൈൻ"),
  tabUploadSigned: t("Upload a signed copy", "ഒപ്പിട്ട പകർപ്പ് അപ്‌ലോഡ് ചെയ്യുക"),
  esignNote: t(
    "You will be taken to the Aadhaar e-sign service and verified with an OTP sent to your Aadhaar-linked mobile number.",
    "ആധാർ ഇ-സൈൻ സേവനത്തിലേക്ക് നിങ്ങളെ കൊണ്ടുപോകും; ആധാറുമായി ബന്ധിപ്പിച്ച മൊബൈൽ നമ്പറിലേക്ക് അയയ്ക്കുന്ന OTP ഉപയോഗിച്ച് പരിശോധിക്കും.",
  ),
  esignAction: t("e-Sign with Aadhaar", "ആധാർ ഉപയോഗിച്ച് ഇ-സൈൻ ചെയ്യുക"),
  downloadDraft: t("Download the application", "അപേക്ഷ ഡൗൺലോഡ് ചെയ്യുക"),
  downloadDraftPrototype: t(
    "The application PDF will download here.",
    "അപേക്ഷയുടെ PDF ഇവിടെ ഡൗൺലോഡ് ആകും.",
  ),
  uploadSignedHint: t(
    "Download the application, sign it, and upload the signed copy.",
    "അപേക്ഷ ഡൗൺലോഡ് ചെയ്ത് ഒപ്പിട്ട ശേഷം ഒപ്പിട്ട പകർപ്പ് അപ്‌ലോഡ് ചെയ്യുക.",
  ),
  signedDocLabel: t("Signed application", "ഒപ്പിട്ട അപേക്ഷ"),
  signedNote: t("Signed by {name}", "{name} ഒപ്പിട്ടു"),
  signError: t(
    "Sign the application before continuing.",
    "തുടരുന്നതിന് മുൻപ് അപേക്ഷയിൽ ഒപ്പിടുക.",
  ),

  /* court fee */
  payTitle: t("Court fee", "കോടതി ഫീസ്"),
  payBody: t(
    "Pay the application fee to complete the submission.",
    "സമർപ്പണം പൂർത്തിയാക്കാൻ അപേക്ഷാ ഫീസ് അടയ്ക്കുക.",
  ),
  feeLine: t("Application fee", "അപേക്ഷാ ഫീസ്"),
  totalLine: t("Total", "ആകെ"),
  // Legacy copy, kept verbatim per the Aug 24 review.
  offlineNote: t(
    "Please visit the Nyay Mitra to make this payment offline.",
    "ഈ ഫീസ് നേരിട്ട് അടയ്ക്കാൻ ദയവായി ന്യായ മിത്രയെ സമീപിക്കുക.",
  ),
  payNow: t("Pay {fee} now", "{fee} ഇപ്പോൾ അടയ്ക്കുക"),
  payLater: t("Pay later", "പിന്നീട് അടയ്ക്കാം"),
  /* Malayalam drafted — needs review. */
  paidBody: t(
    "The application fee is paid. Continue to file the application.",
    "അപേക്ഷാ ഫീസ് അടച്ചു. അപേക്ഷ ഫയൽ ചെയ്യാൻ തുടരുക.",
  ),

  /* submitted */
  doneTitle: t("Bail application submitted", "ജാമ്യാപേക്ഷ സമർപ്പിച്ചു"),
  doneBody: t(
    "The court has received your application. You will be told by SMS when a decision is made.",
    "നിങ്ങളുടെ അപേക്ഷ കോടതിക്ക് ലഭിച്ചു. തീരുമാനമാകുമ്പോൾ SMS വഴി അറിയിക്കും.",
  ),
  submittedOn: t("Submitted on", "സമർപ്പിച്ച തീയതി"),
  submissionIdLabel: t("Submission ID", "സമർപ്പണ ഐഡി"),
  copyId: t("Copy submission ID", "സമർപ്പണ ഐഡി പകർത്തുക"),
  copiedId: t("Copied", "പകർത്തി"),
  paymentLabel: t("Court fee", "കോടതി ഫീസ്"),
  paymentPaid: t("{fee} paid", "{fee} അടച്ചു"),
  paymentDeferred: t("Under Take action", "നിങ്ങളുടെ ബാക്കിയുള്ള ജോലികളിൽ"),
  feeTaskNote: t(
    "The {fee} court fee has been added to Take action. The application is already with the court.",
    "{fee} കോടതി ഫീസ് നിങ്ങളുടെ ബാക്കിയുള്ള ജോലികളിൽ ചേർത്തു. അപേക്ഷ ഇതിനകം കോടതിയിലാണ്.",
  ),
  suretySentNote: t(
    "Each surety has been sent a link to sign the bail bond.",
    "ജാമ്യ ബോണ്ടിൽ ഒപ്പിടാനുള്ള ലിങ്ക് ഓരോ ജാമ്യക്കാരനും അയച്ചിട്ടുണ്ട്.",
  ),
  downloadApplication: t("Download application", "അപേക്ഷ ഡൗൺലോഡ് ചെയ്യുക"),
  downloadApplicationPrototype: t(
    "The submitted application PDF will download here.",
    "സമർപ്പിച്ച അപേക്ഷയുടെ PDF ഇവിടെ ഡൗൺലോഡ് ആകും.",
  ),
  doneClose: t("Done", "പൂർത്തിയായി"),

  /* document preview copy (shared preview dialog needs its own words) */
  docPreviewTitle: t("Document preview", "രേഖയുടെ പ്രിവ്യൂ"),
  docPreviewBody: t(
    "Check the uploaded document before continuing.",
    "തുടരുന്നതിന് മുൻപ് അപ്‌ലോഡ് ചെയ്ത രേഖ പരിശോധിക്കുക.",
  ),
  docPreviewAlt: t(
    "Preview of the uploaded document",
    "അപ്‌ലോഡ് ചെയ്ത രേഖയുടെ പ്രിവ്യൂ",
  ),

  /* notifications */
  notifTitle: t(
    "Bail application submitted for {caseNumber}",
    "{caseNumber} കേസിൽ ജാമ്യാപേക്ഷ സമർപ്പിച്ചു",
  ),
  notifBody: t(
    "Submission ID {id}. You will be told by SMS when there is a decision.",
    "സമർപ്പണ ഐഡി {id}. തീരുമാനമാകുമ്പോൾ SMS വഴി അറിയിക്കും.",
  ),
} as const;

/* ------------------------------------------------------------------- bail bond */

export const bondCopy = {
  /* pending task on the case file */
  pendingTitle: t("Take action", "ബാക്കിയുള്ള ജോലികൾ"),
  taskRaiseBond: t("Raise bail bond", "ജാമ്യ ബോണ്ട് സമർപ്പിക്കുക"),
  taskDue: t("Due {date}", "{date}-നകം"),
  taskNote: t(
    "The magistrate has approved the bail application and asked for a bail bond.",
    "മജിസ്‌ട്രേറ്റ് ജാമ്യാപേക്ഷ അംഗീകരിച്ച് ജാമ്യ ബോണ്ട് ആവശ്യപ്പെട്ടിരിക്കുന്നു.",
  ),

  /* bail bonds list on the case file */
  bondsTitle: t("Bail bonds", "ജാമ്യ ബോണ്ടുകൾ"),
  bondTypeSurety: t("Surety bond", "ജാമ്യക്കാരുള്ള ബോണ്ട്"),
  bondTypePersonal: t("Personal bond", "വ്യക്തിഗത ബോണ്ട്"),
  statusPendingSign: t("Pending signatures", "ഒപ്പുകൾ ബാക്കി"),
  statusPendingReview: t("Pending court review", "കോടതി പരിശോധന ബാക്കി"),

  /* details stage */
  title: t("Bail bond details", "ജാമ്യ ബോണ്ട് വിവരങ്ങൾ"),
  taskBody: t(
    "The magistrate has set the bail terms. Complete the surety details to generate the bond.",
    "മജിസ്‌ട്രേറ്റ് ജാമ്യ വ്യവസ്ഥകൾ നിശ്ചയിച്ചു. ബോണ്ട് തയ്യാറാക്കാൻ ജാമ്യക്കാരുടെ വിവരങ്ങൾ പൂർത്തിയാക്കുക.",
  ),
  directBody: t(
    "Generate a bail bond directly. If the magistrate has already set terms on a bail application, raise the bond from that task under Take action instead.",
    "ജാമ്യ ബോണ്ട് നേരിട്ട് തയ്യാറാക്കുക. മജിസ്‌ട്രേറ്റ് ജാമ്യാപേക്ഷയിൽ വ്യവസ്ഥകൾ നിശ്ചയിച്ചിട്ടുണ്ടെങ്കിൽ ആ ബാക്കിയുള്ള ജോലിയിൽ നിന്ന് ബോണ്ട് സമർപ്പിക്കുക.",
  ),
  editBody: t(
    "Only contact details can be edited. The bail terms and sureties are as approved by the magistrate.",
    "ബന്ധപ്പെടാനുള്ള വിവരങ്ങൾ മാത്രമേ മാറ്റാനാകൂ. ജാമ്യ വ്യവസ്ഥകളും ജാമ്യക്കാരും മജിസ്‌ട്രേറ്റ് അംഗീകരിച്ചതുപോലെ തുടരും.",
  ),
  termsHeading: t("Set by the magistrate", "മജിസ്‌ട്രേറ്റ് നിശ്ചയിച്ചത്"),
  termsNote: t(
    "To change the bail amount, type or number of sureties, raise a new bail application.",
    "ജാമ്യ തുക, തരം, ജാമ്യക്കാരുടെ എണ്ണം എന്നിവ മാറ്റാൻ പുതിയ ജാമ്യാപേക്ഷ സമർപ്പിക്കുക.",
  ),
  amountLabel: t("Bail amount", "ജാമ്യ തുക"),
  amountError: t("Enter the bail amount.", "ജാമ്യ തുക നൽകുക."),
  typeLabel: t("Bail type", "ജാമ്യ തരം"),
  typeSurety: t("Bail surety", "ജാമ്യക്കാരുള്ള ജാമ്യം"),
  typePersonal: t("Personal bond", "വ്യക്തിഗത ബോണ്ട്"),
  typePersonalNote: t(
    "A personal bond is the litigant's own undertaking; no sureties are needed.",
    "വ്യക്തിഗത ബോണ്ട് കക്ഷിയുടെ സ്വന്തം ഉറപ്പാണ്; ജാമ്യക്കാർ ആവശ്യമില്ല.",
  ),
  suretiesRequiredLabel: t("Sureties required", "ആവശ്യമായ ജാമ്യക്കാർ"),
  suretiesRequiredError: t(
    "Enter how many sureties the bond carries.",
    "ബോണ്ടിൽ എത്ര ജാമ്യക്കാർ വേണമെന്ന് നൽകുക.",
  ),
  fromApplication: t("From the bail application", "ജാമ്യാപേക്ഷയിൽ നിന്ന്"),
  lockedSuretyNote: t(
    "Approved by the magistrate. Only the mobile number and email can be changed.",
    "മജിസ്‌ട്രേറ്റ് അംഗീകരിച്ചത്. മൊബൈൽ നമ്പറും ഇമെയിലും മാത്രമേ മാറ്റാനാകൂ.",
  ),
  addMoreNote: t(
    "The magistrate asked for {n} sureties. Add {k} more below.",
    "മജിസ്‌ട്രേറ്റ് {n} ജാമ്യക്കാരെ ആവശ്യപ്പെട്ടു. താഴെ {k} പേരെ കൂടി ചേർക്കുക.",
  ),
  showDetails: t("Show details", "വിവരങ്ങൾ കാണിക്കുക"),
  hideDetails: t("Hide details", "വിവരങ്ങൾ മറയ്ക്കുക"),
  addressLabel: t("Address", "വിലാസം"),
  reviewBond: t("Review bail bond", "ജാമ്യ ബോണ്ട് പരിശോധിക്കുക"),
  generatingBond: t("Preparing the bail bond…", "ജാമ്യ ബോണ്ട് തയ്യാറാക്കുന്നു…"),

  /* review stage */
  reviewTitle: t("Review the bail bond", "ജാമ്യ ബോണ്ട് പരിശോധിക്കുക"),
  reviewBody: t(
    "Check the generated bond before you sign it.",
    "ഒപ്പിടുന്നതിന് മുൻപ് തയ്യാറാക്കിയ ബോണ്ട് പരിശോധിക്കുക.",
  ),
  expandBond: t("View full screen", "മുഴുവൻ സ്ക്രീനിൽ കാണുക"),
  downloadBond: t("Download the bail bond", "ജാമ്യ ബോണ്ട് ഡൗൺലോഡ് ചെയ്യുക"),
  downloadBondPrototype: t(
    "The bail bond PDF will download here.",
    "ജാമ്യ ബോണ്ടിന്റെ PDF ഇവിടെ ഡൗൺലോഡ് ആകും.",
  ),
  formLine: t("Form No. 37", "ഫോം നമ്പർ 37"),
  bondDocTitle: t("Bail bond", "ജാമ്യ ബോണ്ട്"),
  sectionLine: t(
    "(Section 426 or 499, Criminal Procedure Code)",
    "(ക്രിമിനൽ നടപടി നിയമം, വകുപ്പ് 426 അല്ലെങ്കിൽ 499)",
  ),
  bondBody1: t(
    "I, {name}, son of {father}, having been brought before this court and required to give surety for my attendance, bind myself to attend on every hearing date until the case is disposed of.",
    "ഈ കോടതി മുൻപാകെ ഹാജരാക്കപ്പെട്ട്, ഹാജരിന് ഉറപ്പ് നൽകാൻ ആവശ്യപ്പെട്ട ഞാൻ, {father}-ന്റെ മകൻ {name}, കേസ് തീർപ്പാകുംവരെ എല്ലാ വാദദിവസവും ഹാജരാകാമെന്ന് ഉറപ്പുനൽകുന്നു.",
  ),
  bondBody2: t(
    "In default, I bind myself to forfeit to the Government the sum of {amount}.",
    "വീഴ്ച വരുത്തിയാൽ {amount} തുക സർക്കാരിലേക്ക് കണ്ടുകെട്ടാമെന്ന് ഞാൻ സമ്മതിക്കുന്നു.",
  ),
  bondSuretyClause: t(
    "We, {sureties}, declare ourselves sureties for the above-named {name} in the sum of {amount} each.",
    "മുകളിൽ പറഞ്ഞ {name}-ന് വേണ്ടി ഓരോരുത്തർക്കും {amount} വീതം ഉറപ്പുനൽകുന്ന ജാമ്യക്കാരായി ഞങ്ങൾ, {sureties}, സ്വയം പ്രഖ്യാപിക്കുന്നു.",
  ),
  proceedToSign: t("Proceed to sign", "ഒപ്പിടാൻ തുടരുക"),

  /* sign stage */
  signBody: t(
    "Sign the bail bond to submit it to the court.",
    "കോടതിയിൽ സമർപ്പിക്കാൻ ജാമ്യ ബോണ്ടിൽ ഒപ്പിടുക.",
  ),
  uploadBondHint: t(
    "Download the bail bond, collect the signatures of the litigant and every surety, and upload the signed copy.",
    "ജാമ്യ ബോണ്ട് ഡൗൺലോഡ് ചെയ്ത്, കക്ഷിയുടെയും എല്ലാ ജാമ്യക്കാരുടെയും ഒപ്പുകൾ ശേഖരിച്ച്, ഒപ്പിട്ട പകർപ്പ് അപ്‌ലോഡ് ചെയ്യുക.",
  ),
  signedBondLabel: t("Signed bail bond", "ഒപ്പിട്ട ജാമ്യ ബോണ്ട്"),
  submitBond: t("Submit bail bond", "ജാമ്യ ബോണ്ട് സമർപ്പിക്കുക"),

  /* done stage */
  doneTitle: t("Bail bond submitted", "ജാമ്യ ബോണ്ട് സമർപ്പിച്ചു"),
  doneBodyEsign: t(
    "The litigant and each surety have been sent a link by SMS, and email, if given, to add their signatures.",
    "ഒപ്പുകൾ ചേർക്കാനുള്ള ലിങ്ക് കക്ഷിക്കും ഓരോ ജാമ്യക്കാരനും SMS വഴി, ഇമെയിൽ നൽകിയാൽ അതുവഴിയും, അയച്ചിട്ടുണ്ട്.",
  ),
  doneBodyUpload: t(
    "The signed bond is with the court for review.",
    "ഒപ്പിട്ട ബോണ്ട് കോടതിയുടെ പരിശോധനയ്ക്കായി സമർപ്പിച്ചു.",
  ),
  doneTitleEdited: t("Bail bond updated", "ജാമ്യ ബോണ്ട് പുതുക്കി"),
  doneBodyEdited: t(
    "Earlier signatures stand invalidated. The litigant and each surety have been asked to sign again.",
    "മുൻ ഒപ്പുകൾ അസാധുവായി. കക്ഷിയോടും ഓരോ ജാമ്യക്കാരനോടും വീണ്ടും ഒപ്പിടാൻ ആവശ്യപ്പെട്ടിട്ടുണ്ട്.",
  ),
  bondIdLabel: t("Bond ID", "ബോണ്ട് ഐഡി"),
  signLinkLabel: t("Signing link", "ഒപ്പിടാനുള്ള ലിങ്ക്"),
  copyLink: t("Copy signing link", "ഒപ്പിടാനുള്ള ലിങ്ക് പകർത്തുക"),
  copiedLink: t("Copied", "പകർത്തി"),
  openLinkDemo: t("Open the signing link", "ഒപ്പിടാനുള്ള ലിങ്ക് തുറക്കുക"),
  openLinkDemoHint: t(
    "Opens what the litigant and sureties receive.",
    "കക്ഷിക്കും ജാമ്യക്കാർക്കും ലഭിക്കുന്നത് തുറക്കും.",
  ),

  /* status dialog (advocate) */
  esignStatusHeading: t("e-Sign status", "ഇ-സൈൻ നില"),
  roleLitigant: t("Litigant", "കക്ഷി"),
  roleSurety: t("Surety {n}", "ജാമ്യക്കാരൻ {n}"),
  roleAdvocate: t("Advocate", "അഭിഭാഷക"),
  signedStatus: t("Signed", "ഒപ്പിട്ടു"),
  pendingStatus: t("Pending", "ബാക്കി"),
  editDetails: t("Edit details", "വിവരങ്ങൾ മാറ്റുക"),
  invalidateTitle: t("Edit the bail bond?", "ജാമ്യ ബോണ്ട് മാറ്റണോ?"),
  invalidateBody: t(
    "Editing invalidates every signature already made: yours, the litigant's and each surety's. Everyone will have to sign again.",
    "മാറ്റം വരുത്തിയാൽ ഇതിനകം ചെയ്ത എല്ലാ ഒപ്പുകളും (നിങ്ങളുടേതും കക്ഷിയുടേതും ഓരോ ജാമ്യക്കാരന്റേതും) അസാധുവാകും. എല്ലാവരും വീണ്ടും ഒപ്പിടേണ്ടിവരും.",
  ),
  invalidateConfirm: t("Edit and invalidate", "മാറ്റി ഒപ്പുകൾ അസാധുവാക്കുക"),
  cancel: t("Cancel", "റദ്ദാക്കുക"),

  /* party signing page (/bond) */
  partyTitle: t("Sign the bail bond", "ജാമ്യ ബോണ്ടിൽ ഒപ്പിടുക"),
  partyIntro: t(
    "A bail bond in {caseNumber} · {title} needs your signature as the litigant or as a surety.",
    "{caseNumber} · {title} കേസിലെ ജാമ്യ ബോണ്ടിൽ കക്ഷിയായോ ജാമ്യക്കാരനായോ നിങ്ങളുടെ ഒപ്പ് ആവശ്യമാണ്.",
  ),
  partyPhoneHelp: t(
    "Enter the mobile number given to the court for you.",
    "കോടതിക്ക് നൽകിയിട്ടുള്ള നിങ്ങളുടെ മൊബൈൽ നമ്പർ നൽകുക.",
  ),
  partyPhoneDemo: t(
    "Try: 98460 12345 (litigant) · 91484 98792 or 98476 54321 (sureties)",
    "പരീക്ഷിക്കുക: 98460 12345 (കക്ഷി) · 91484 98792 അല്ലെങ്കിൽ 98476 54321 (ജാമ്യക്കാർ)",
  ),
  partyPhoneUnknown: t(
    "This number is not on the bail bond. Check with the advocate who filed it.",
    "ഈ നമ്പർ ജാമ്യ ബോണ്ടിലില്ല. ഇത് സമർപ്പിച്ച അഭിഭാഷകനോട് പരിശോധിക്കുക.",
  ),
  partyYou: t("(you)", "(നിങ്ങൾ)"),
  proceedEsign: t("Proceed to e-sign", "ഇ-സൈൻ ചെയ്യാൻ തുടരുക"),
  partySignedTitle: t("You have signed the bail bond", "നിങ്ങൾ ജാമ്യ ബോണ്ടിൽ ഒപ്പിട്ടു"),
  partySignedBody: t(
    "The court will be told when everyone has signed. Nothing more is needed from you.",
    "എല്ലാവരും ഒപ്പിട്ടുകഴിയുമ്പോൾ കോടതിയെ അറിയിക്കും. നിങ്ങളിൽ നിന്ന് ഇനിയൊന്നും ആവശ്യമില്ല.",
  ),

  /* notification */
  notifBondTitle: t(
    "Bail bond submitted for {caseNumber}",
    "{caseNumber} കേസിൽ ജാമ്യ ബോണ്ട് സമർപ്പിച്ചു",
  ),
  notifBondBody: t(
    "Bond ID {id}. The litigant and sureties have been asked to sign.",
    "ബോണ്ട് ഐഡി {id}. കക്ഷിയോടും ജാമ്യക്കാരോടും ഒപ്പിടാൻ ആവശ്യപ്പെട്ടിട്ടുണ്ട്.",
  ),
} as const;
