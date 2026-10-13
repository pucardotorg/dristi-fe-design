/**
 * Accused onboarding — content model.
 *
 * Three channels, three jobs (see "Onboarding — content allocation"):
 *   left column — the gist. What you must know to decide whether to act. ~70 words a step.
 *   video       — context and reassurance. Why this happened, what normally happens.
 *   help panel  — reference. The answer to a question you actually have. Opt-in.
 *
 * Placement rule: needed to act → left. Needed to feel less afraid → video. Needed only
 * if you wonder → help. One exception: anything carrying a deadline or a cost stays in
 * the left column even when the video covers it, because a person on a metered
 * connection must not be able to miss it.
 *
 * Universal content, case data injected into slots. Every slot has a fallback so the
 * flow survives a missing or expired token, a case not yet in CIS, and the login
 * screen's "Seek help" entry, which carries no case context at all.
 *
 * Copy: sentence case (DS Law). Reconciled against Summons_v14.
 */

import { LANGUAGE_NAME, SECOND_LANGUAGE } from "@/lib/locale-config";

export type Locale = "en" | "ml" | "hi" | "gu" | "pa";

/** English, and the deployment's second language (`lib/locale-config.ts`). */
export const LOCALES: { value: Locale; label: string }[] = [
  { value: "en", label: LANGUAGE_NAME.en },
  { value: SECOND_LANGUAGE, label: LANGUAGE_NAME[SECOND_LANGUAGE] },
];

export type CaseSummary = {
  accusedName?: string;
  caseNumber?: string;
  cnr?: string;
  court?: string;
  courtAddress?: string;
  hearingDate?: string;
  complainant?: string;
  chequeAmount?: string;
  chequeNumber?: string;
};

export type StepId = "papers" | "choices" | "date" | "help" | "join";

export const STEP_ORDER: StepId[] = [
  "papers",
  "choices",
  "date",
  "help",
  "join",
];

/** English and Malayalam always; Hindi where a translation exists, else English is shown. */
export type Copy = { en: string; ml: string; hi?: string; gu?: string; pa?: string };
const t = (en: string, ml: string, hi?: string): Copy => (hi ? { en, ml, hi } : { en, ml });

export const stepTitles: Record<StepId, Copy> = {
  papers: t("Your papers", "നിങ്ങളുടെ രേഖകൾ"),
  choices: t("Your choices", "നിങ്ങളുടെ വഴികൾ"),
  date: t("Your date", "നിങ്ങളുടെ തീയതി"),
  help: t("Get help", "സഹായം"),
  join: t("Join", "ചേരുക"),
};

export const ui = {
  readLater: t("Read this later", "പിന്നീട് വായിക്കാം"),
  close: t("Close", "അടയ്ക്കുക"),
  proceed: t("Proceed", "തുടരുക"),
  back: t("Back", "പുറകോട്ട്"),
  language: t("Language", "ഭാഷ"),
  helpTitle: t("Common questions", "പതിവ് ചോദ്യങ്ങൾ"),
  videoUnavailable: t(
    "Video will play here.",
    "വീഡിയോ ഇവിടെ വരും.",
  ),
  notMe: t("This is not about me", "ഇത് എന്നെക്കുറിച്ചല്ല"),
  notMeBody: t(
    "Do not join this case. Call the court on 0000 000000 and tell them the summons reached the wrong person.",
    "ഈ കേസിൽ ചേരരുത്. 0000 000000 എന്ന നമ്പറിൽ കോടതിയെ വിളിച്ച് സമൻസ് തെറ്റായ ആൾക്ക് എത്തിയെന്ന് അറിയിക്കുക.",
  ),
  missingCase: t("We could not load your case", "കേസ് കാണാൻ കഴിഞ്ഞില്ല"),
  missingCaseBody: t(
    "Your case number and hearing date are on your summons.",
    "കേസ് നമ്പറും ഹിയറിംഗ് തീയതിയും സമൻസിൽ ഉണ്ട്.",
  ),
} satisfies Record<string, Copy>;

export const summaryFields: {
  key: keyof CaseSummary;
  label: Copy;
  fallback: Copy;
}[] = [
  {
    key: "caseNumber",
    label: t("Case number", "കേസ് നമ്പർ"),
    fallback: t("On your summons", "സമൻസിൽ"),
  },
  {
    key: "complainant",
    label: t("Filed by", "പരാതി നൽകിയത്"),
    fallback: t("On your summons", "സമൻസിൽ"),
  },
  {
    key: "chequeAmount",
    label: t("Amount claimed", "ആവശ്യപ്പെടുന്ന തുക"),
    fallback: t("On your summons", "സമൻസിൽ"),
  },
  {
    key: "chequeNumber",
    label: t("Cheque number", "ചെക്ക് നമ്പർ"),
    fallback: t("On your summons", "സമൻസിൽ"),
  },
];

/* -------------------------------------------------------- 1 · papers (55 w) */

export const papers = {
  heading: t(
    "You have received a summons in a cheque bounce case",
    "ചെക്ക് മടങ്ങിയ കേസിൽ നിങ്ങൾക്ക് സമൻസ് ലഭിച്ചു",
  ),
  body: t(
    "The complainant says your cheque was returned unpaid and payment was not made after notice. The court will hear the case.",
    "നിങ്ങളുടെ ചെക്ക് പണമില്ലാതെ മടങ്ങിയെന്നും നോട്ടീസിന് ശേഷവും പണം നൽകിയില്ലെന്നും പരാതിക്കാരൻ പറയുന്നു. കോടതി കേസ് കേൾക്കും.",
  ),
  reassurance: t(
    "This summons does not mean you are guilty. Your side has not been heard yet.",
    "ഈ സമൻസ് നിങ്ങൾ കുറ്റക്കാരനാണെന്ന് അർത്ഥമാക്കുന്നില്ല. നിങ്ങളുടെ ഭാഗം ഇനിയും കേട്ടിട്ടില്ല.",
  ),
  originalSummons: t("View the original summons", "യഥാർത്ഥ സമൻസ് കാണുക"),
};

/* ------------------------------------------------------- 2 · choices (88 w) */

export const choices = {
  heading: t("You have three ways forward", "നിങ്ങൾക്ക് മൂന്ന് വഴികളുണ്ട്"),
  intro: t(
    "Two of these end the case without a trial.",
    "ഇതിൽ രണ്ടെണ്ണം വിചാരണയില്ലാതെ കേസ് അവസാനിപ്പിക്കും.",
  ),
  cards: [
    {
      id: "pay",
      title: t("Pay the cheque amount", "ചെക്ക് തുക അടയ്ക്കുക"),
      summary: t(
        "The fastest way to end it, and the cheapest if you do it early.",
        "ഏറ്റവും വേഗമുള്ള വഴി. നേരത്തെ ചെയ്താൽ ഏറ്റവും ചെലവ് കുറഞ്ഞതും.",
      ),
      detail: t(
        "Pay the court directly, or pay the complainant and upload the receipt. With their agreement the case closes as an acquittal, not a conviction.",
        "കോടതിയിൽ നേരിട്ട് അടയ്ക്കാം, അല്ലെങ്കിൽ പരാതിക്കാരന് നൽകി രസീത് അപ്‌ലോഡ് ചെയ്യാം. അവരുടെ സമ്മതത്തോടെ കേസ് കുറ്റവിമുക്തിയായി അവസാനിക്കും, ശിക്ഷയല്ല.",
      ),
      /* A cost warning, so it stays in the left column rather than the help panel. */
      note: t(
        "The court will never ask you to pay through a link sent in a message, or into a personal account.",
        "സന്ദേശത്തിലെ ലിങ്ക് വഴിയോ വ്യക്തിഗത അക്കൗണ്ടിലേക്കോ പണം അടയ്ക്കാൻ കോടതി ഒരിക്കലും ആവശ്യപ്പെടില്ല.",
      ),
      noteTone: "info" as const,
    },
    {
      id: "settle",
      title: t("Settle", "ഒത്തുതീർപ്പാക്കുക"),
      summary: t(
        "Pay less, or over time. Or ask for Lok Adalat or mediation, both free.",
        "കുറഞ്ഞ തുക, അല്ലെങ്കിൽ ഗഡുക്കളായി. അല്ലെങ്കിൽ ലോക് അദാലത്തോ മധ്യസ്ഥതയോ ചോദിക്കാം. രണ്ടും സൗജന്യം.",
      ),
      detail: t(
        "The complainant's lawyer is named on your summons. If you need time to talk to them, you can ask the court for it.",
        "പരാതിക്കാരന്റെ അഭിഭാഷകന്റെ പേര് സമൻസിൽ ഉണ്ട്. അവരോട് സംസാരിക്കാൻ സമയം വേണമെങ്കിൽ കോടതിയോട് ചോദിക്കാം.",
      ),
    },
    {
      id: "contest",
      title: t("Contest the case", "കേസ് എതിർക്കുക"),
      summary: t(
        "With a lawyer, or on your own. This one has a cost before any verdict.",
        "അഭിഭാഷകൻ മുഖേനയോ സ്വയമോ. വിധിക്ക് മുൻപേ ഇതിന് ഒരു ചെലവുണ്ട്.",
      ),
      detail: t(
        "At the hearing you can reply to the complaint and question the complainant.",
        "ഹിയറിംഗിൽ പരാതിക്ക് മറുപടി നൽകാം, പരാതിക്കാരനോട് ചോദ്യം ചോദിക്കാം.",
      ),
      note: t(
        "If you plead not guilty, the court may order you to deposit up to 20% of the cheque amount while the case runs. You get it back with interest if you are acquitted.",
        "കുറ്റം സമ്മതിക്കുന്നില്ലെങ്കിൽ, കേസ് നടക്കുമ്പോൾ ചെക്ക് തുകയുടെ 20% വരെ കെട്ടിവയ്ക്കാൻ കോടതി ഉത്തരവിട്ടേക്കാം. കുറ്റവിമുക്തനായാൽ പലിശ സഹിതം തിരികെ ലഭിക്കും.",
      ),
      noteTone: "warning" as const,
    },
  ],
};

/* ---------------------------------------------------------- 3 · date (52 w) */

export const dateStep = {
  heading: t("When and where you must appear", "എപ്പോൾ, എവിടെ ഹാജരാകണം"),
  dateLabel: t("Your hearing date", "ഹിയറിംഗ് തീയതി"),
  noDate: t("On your summons", "സമൻസിൽ ഉണ്ട്"),
  attendBody: t(
    "Come in person, send your lawyer, or join by video.",
    "നേരിട്ട് വരാം, അഭിഭാഷകനെ അയക്കാം, അല്ലെങ്കിൽ വീഡിയോ വഴി ചേരാം.",
  ),
  cantCome: t(
    "Cannot make it? Ask the court for a new date before then. Do not simply stay away.",
    "വരാൻ കഴിയില്ലേ? അതിന് മുൻപ് കോടതിയോട് പുതിയ തീയതി ചോദിക്കുക. വെറുതെ വിട്ടുനിൽക്കരുത്.",
  ),
};

/* ---------------------------------------------------------- 4 · help (48 w) */

export const help = {
  heading: t(
    "You may be able to get a lawyer for free",
    "സൗജന്യമായി അഭിഭാഷകനെ ലഭിച്ചേക്കാം",
  ),
  body: t(
    "Women and children qualify whatever they earn, and so does anyone earning under ₹3,00,000 a year.",
    "സ്ത്രീകൾക്കും കുട്ടികൾക്കും വരുമാനം എത്രയായാലും ലഭിക്കും. വർഷം ₹3,00,000-ൽ താഴെ വരുമാനമുള്ള ആർക്കും ലഭിക്കും.",
  ),
  proofNote: t(
    "Your own signed statement of income is enough. You do not need a certificate.",
    "നിങ്ങളുടെ സ്വന്തം വരുമാന സത്യവാങ്മൂലം മതി. സർട്ടിഫിക്കറ്റ് വേണ്ട.",
  ),
  primary: {
    name: t(
      "District Legal Services Authority",
      "ജില്ലാ ലീഗൽ സർവീസസ് അതോറിറ്റി",
    ),
    detail: t(
      "Ask about free legal advice or representation. If you qualify, the DLSA can help you apply and may assign a lawyer.",
      "സൗജന്യ നിയമോപദേശമോ കോടതിയിലെ പ്രതിനിധാനമോ ചോദിക്കാം. നിങ്ങൾക്ക് അർഹതയുണ്ടെങ്കിൽ അപേക്ഷിക്കാൻ DLSA സഹായിക്കുകയും ഒരു അഭിഭാഷകനെ നിയോഗിക്കുകയും ചെയ്തേക്കാം.",
    ),
    href: "tel:0000000000",
    linkLabel: t("0000 000 000", "0000 000 000"),
  },
};

/* ---------------------------------------------------------- 5 · join (34 w) */

export const join = {
  heading: t(
    "Join your case by logging in or registering",
    "ലോഗിൻ ചെയ്തോ രജിസ്റ്റർ ചെയ്തോ കേസിൽ ചേരുക",
  ),
  body: t(
    "Sign in to read the full complaint, pay, ask for a new date, apply for bail, and add your lawyer.",
    "പൂർണ്ണ പരാതി വായിക്കാനും, പണം അടയ്ക്കാനും, പുതിയ തീയതി ചോദിക്കാനും, ജാമ്യത്തിന് അപേക്ഷിക്കാനും, അഭിഭാഷകനെ ചേർക്കാനും സൈൻ ഇൻ ചെയ്യുക.",
  ),
  safety: t(
    "Your access code is on your summons. Share it only with your lawyer.",
    "നിങ്ങളുടെ ആക്‌സസ് കോഡ് സമൻസിൽ ഉണ്ട്. അഭിഭാഷകനുമായി മാത്രം പങ്കിടുക.",
  ),
  cta: t("Continue to sign in", "സൈൻ ഇൻ ചെയ്യാൻ തുടരുക"),
};

/* ------------------------------------------------- right column: help panel */

export type HelpEntry = {
  q: Copy;
  a: Copy;
  links?: { label: Copy; href: string }[];
};

/** Reference. Absorbs everything the left column no longer carries. */
export const helpPanel: Record<StepId, HelpEntry[]> = {
  papers: [
    {
      q: t("Is this a police case?", "ഇത് പോലീസ് കേസാണോ?"),
      a: t(
        "No. A private person or company filed it. The police only delivered the papers, and this is the only point at which they are involved.",
        "അല്ല. ഒരു സ്വകാര്യ വ്യക്തിയോ സ്ഥാപനമോ ആണ് പരാതി നൽകിയത്. പോലീസ് രേഖകൾ എത്തിച്ചു എന്ന് മാത്രം; അവർ ഇടപെടുന്ന ഒരേയൊരു ഘട്ടം ഇതാണ്.",
      ),
    },
    {
      q: t("What law is this under?", "ഇത് ഏത് നിയമപ്രകാരമാണ്?"),
      a: t(
        "Section 138 of the Negotiable Instruments Act, 1881. Useful to know if you search for information or speak to a lawyer.",
        "നെഗോഷ്യബിൾ ഇൻസ്ട്രുമെന്റ്സ് ആക്ട് 1881-ലെ 138-ാം വകുപ്പ്. വിവരങ്ങൾ തിരയാനോ അഭിഭാഷകനോട് സംസാരിക്കാനോ ഇത് അറിയുന്നത് നല്ലതാണ്.",
      ),
    },
    {
      q: t("What happens at the first hearing?", "ആദ്യ ഹിയറിംഗിൽ എന്ത് നടക്കും?"),
      a: t(
        "The judge asks whether the cheque is from your account, whether the signature is yours, whether you gave it to the complainant, whether you owed them anything, what your defence is if you deny it, and whether you want to settle now.",
        "ചെക്ക് നിങ്ങളുടെ അക്കൗണ്ടിലേതാണോ, ഒപ്പ് നിങ്ങളുടേതാണോ, പരാതിക്കാരന് നിങ്ങൾ അത് നൽകിയോ, അവർക്ക് കടപ്പെട്ടിരുന്നോ, നിഷേധിക്കുന്നെങ്കിൽ വാദം എന്ത്, ഇപ്പോൾ ഒത്തുതീർപ്പ് വേണോ എന്നിവ ജഡ്ജി ചോദിക്കും.",
      ),
    },
    {
      q: t("Does this mean I am guilty?", "ഇതിനർത്ഥം ഞാൻ കുറ്റക്കാരനാണോ?"),
      a: t(
        "No. The magistrate has only decided there is enough to hear the case.",
        "അല്ല. കേസ് കേൾക്കാൻ മതിയായ കാരണമുണ്ടെന്ന് മാത്രമാണ് മജിസ്‌ട്രേറ്റ് തീരുമാനിച്ചത്.",
      ),
    },
  ],
  choices: [
    {
      q: t("Does settling early cost less?", "നേരത്തെ ഒത്തുതീർത്താൽ ചെലവ് കുറയുമോ?"),
      a: t(
        "Yes. Paying the cheque amount before the defence evidence stage carries no extra cost at all. After that it is 5%, then 7.5% on appeal, then 10% at the Supreme Court.",
        "അതെ. പ്രതിഭാഗം തെളിവ് ഘട്ടത്തിന് മുൻപ് ചെക്ക് തുക അടച്ചാൽ ഒട്ടും അധിക ചെലവില്ല. അതിനുശേഷം 5%, അപ്പീലിൽ 7.5%, സുപ്രീം കോടതിയിൽ 10%.",
      ),
    },
    {
      q: t("What is a Lok Adalat?", "ലോക് അദാലത്ത് എന്നാൽ എന്ത്?"),
      a: t(
        "A settlement sitting run by the legal services authority. If both sides agree, the case closes there. The decision is final, cannot be appealed, and your court fee is refunded.",
        "ലീഗൽ സർവീസസ് അതോറിറ്റി നടത്തുന്ന ഒത്തുതീർപ്പ് സഭ. ഇരുകക്ഷികളും സമ്മതിച്ചാൽ കേസ് അവിടെ അവസാനിക്കും. തീരുമാനം അന്തിമമാണ്, അപ്പീൽ ഇല്ല, കോടതി ഫീസ് തിരികെ കിട്ടും.",
      ),
    },
    {
      q: t("What is mediation?", "മധ്യസ്ഥത എന്നാൽ എന്ത്?"),
      a: t(
        "A trained neutral person helps you and the complainant reach an agreement. It is free and court-run, and nothing is imposed. You both have to agree.",
        "പരിശീലനം ലഭിച്ച നിഷ്പക്ഷ വ്യക്തി നിങ്ങളെയും പരാതിക്കാരനെയും ധാരണയിലെത്താൻ സഹായിക്കുന്നു. സൗജന്യം, കോടതി നടത്തുന്നത്. ഒന്നും അടിച്ചേൽപ്പിക്കില്ല. ഇരുവരും സമ്മതിക്കണം.",
      ),
    },
    {
      q: t("What counts as a defence?", "എന്തൊക്കെ വാദമായി കണക്കാക്കും?"),
      a: t(
        "That the cheque was given only as security, that the loan was already repaid, or that the cheque was altered or misused. A blank cheque you signed and handed over still counts against you.",
        "ചെക്ക് സെക്യൂരിറ്റിയായി മാത്രം നൽകിയതാണ്, കടം നേരത്തെ വീട്ടി, അല്ലെങ്കിൽ ചെക്കിൽ മാറ്റം വരുത്തി ദുരുപയോഗം ചെയ്തു എന്നിവ. ഒപ്പിട്ട് നൽകിയ ഒഴിഞ്ഞ ചെക്കും നിങ്ങൾക്ക് എതിരായി കണക്കാക്കും.",
      ),
    },
    {
      q: t("Who has to prove what?", "ആരാണ് എന്ത് തെളിയിക്കേണ്ടത്?"),
      a: t(
        "The law begins by assuming the cheque was given for money you owed. It is for you to show otherwise, and a simple denial is not enough.",
        "കടം വീട്ടാനാണ് ചെക്ക് നൽകിയത് എന്ന് നിയമം ആദ്യം അനുമാനിക്കുന്നു. അല്ലെന്ന് കാണിക്കേണ്ടത് നിങ്ങളാണ്; വെറും നിഷേധം പോരാ.",
      ),
    },
    {
      q: t("What is the worst outcome?", "ഏറ്റവും മോശം ഫലം എന്താണ്?"),
      a: t(
        "If the case runs to the end and goes against you: up to two years, or a fine of up to twice the cheque amount, or both. The court may also grant probation instead. Most cheque cases end in payment, not prison.",
        "കേസ് അവസാനം വരെ പോയി എതിരായാൽ: രണ്ട് വർഷം വരെ തടവ്, അല്ലെങ്കിൽ ചെക്ക് തുകയുടെ ഇരട്ടി വരെ പിഴ, അല്ലെങ്കിൽ രണ്ടും. പകരം പ്രൊബേഷനും അനുവദിക്കാം. മിക്ക കേസുകളും തടവിലല്ല, പണം അടച്ചാണ് അവസാനിക്കുന്നത്.",
      ),
    },
    {
      q: t("What does representing myself mean?", "സ്വയം ഹാജരാകുക എന്നാൽ എന്ത്?"),
      a: t(
        "You speak for yourself in court and file your own applications. It is called appearing as a party in person. Most people in cheque cases use a lawyer.",
        "കോടതിയിൽ നിങ്ങൾ തന്നെ സംസാരിക്കുകയും അപേക്ഷകൾ നൽകുകയും ചെയ്യുന്നു. ഇതിനെ പാർട്ടി ഇൻ പേഴ്‌സൺ എന്ന് പറയും. മിക്കവരും അഭിഭാഷകനെ വയ്ക്കുന്നു.",
      ),
    },
  ],
  date: [
    {
      q: t("Can I attend from home?", "വീട്ടിൽ നിന്ന് ഹാജരാകാമോ?"),
      a: t(
        "Yes, by video. You can also ask the court to excuse you from attending in person and let your lawyer appear instead. This is common in cheque cases.",
        "അതെ, വീഡിയോ വഴി. നേരിട്ട് ഹാജരാകുന്നതിൽ നിന്ന് ഒഴിവാക്കി അഭിഭാഷകൻ ഹാജരായാൽ മതിയെന്നും ചോദിക്കാം. ചെക്ക് കേസുകളിൽ ഇത് സാധാരണമാണ്.",
      ),
    },
    {
      q: t("What if my date has passed?", "തീയതി കഴിഞ്ഞുപോയെങ്കിൽ?"),
      a: t(
        "Do not ignore it. Sign in to see your new date, or call 0000 000000.",
        "അവഗണിക്കരുത്. പുതിയ തീയതി അറിയാൻ സൈൻ ഇൻ ചെയ്യുക, അല്ലെങ്കിൽ 0000 000000 വിളിക്കുക.",
      ),
    },
    {
      q: t(
        "What if I neither come nor apply?",
        "ഹാജരാകാതെയും അപേക്ഷിക്കാതെയും ഇരുന്നാൽ?",
      ),
      a: t(
        "The court can issue a warrant for your arrest, and you lose your right to question the complainant. If you stay away, it can go on to declare you absconding and attach your property.",
        "കോടതിക്ക് അറസ്റ്റ് വാറന്റ് പുറപ്പെടുവിക്കാം, പരാതിക്കാരനോട് ചോദ്യം ചോദിക്കാനുള്ള അവകാശവും നഷ്ടപ്പെടും. തുടർന്നും വിട്ടുനിന്നാൽ ഒളിവിലാണെന്ന് പ്രഖ്യാപിച്ച് സ്വത്ത് കണ്ടുകെട്ടാം.",
      ),
    },
    {
      q: t("What if a warrant is issued?", "വാറന്റ് വന്നാൽ?"),
      a: t(
        "This offence is bailable. If you cannot arrange sureties and the court finds you cannot afford them, it must release you on your own bond.",
        "ഈ കുറ്റം ജാമ്യം ലഭിക്കുന്നതാണ്. ജാമ്യക്കാരെ ഏർപ്പാടാക്കാൻ കഴിയില്ലെന്നും ശേഷിയില്ലെന്നും കോടതി കണ്ടാൽ സ്വന്തം ബോണ്ടിൽ വിട്ടയക്കണം.",
      ),
    },
    {
      q: t("How long will this take?", "ഇത് എത്ര കാലം നീളും?"),
      a: t(
        "Cheque cases are tried in a short form, and the law asks courts to finish them within six months of filing.",
        "ചെക്ക് കേസുകൾ ചുരുക്ക രീതിയിലാണ് വിചാരണ. ഫയൽ ചെയ്ത് ആറ് മാസത്തിനകം തീർക്കാനാണ് നിയമം ആവശ്യപ്പെടുന്നത്.",
      ),
    },
  ],
  help: [
    {
      q: t("Who else qualifies?", "മറ്റാർക്കൊക്കെ ലഭിക്കും?"),
      a: t(
        "Members of a Scheduled Caste or Scheduled Tribe, persons with a disability, industrial workers, people in custody, and victims of trafficking or of a disaster.",
        "പട്ടികജാതി / പട്ടികവർഗക്കാർ, ഭിന്നശേഷിക്കാർ, വ്യവസായ തൊഴിലാളികൾ, കസ്റ്റഡിയിലുള്ളവർ, മനുഷ്യക്കടത്തിനോ ദുരന്തത്തിനോ ഇരയായവർ.",
      ),
    },
    {
      q: t(
        "Free advice with no eligibility test",
        "യോഗ്യതാ പരിശോധനയില്ലാത്ത സൗജന്യ ഉപദേശം",
      ),
      a: t(
        "Tele-Law is free for every citizen. Speak to a panel lawyer by video or phone from a Common Service Centre, or through the Tele-Law app at tele-law.in. Advice only. They will not appear in court for you.",
        "ടെലി-ലോ എല്ലാ പൗരന്മാർക്കും സൗജന്യമാണ്. കോമൺ സർവീസ് സെന്ററിൽ നിന്നോ tele-law.in ആപ്പ് വഴിയോ പാനൽ അഭിഭാഷകനോട് സംസാരിക്കാം. ഉപദേശം മാത്രം. അവർ കോടതിയിൽ ഹാജരാകില്ല.",
      ),
      links: [
        {
          label: t("tele-law.in", "tele-law.in"),
          href: "https://www.tele-law.in/",
        },
      ],
    },
    {
      q: t("A volunteer lawyer through an app", "ആപ്പ് വഴി സന്നദ്ധ അഭിഭാഷകൻ"),
      a: t(
        "Nyaya Bandhu matches you with an advocate volunteering their time. Register at probono-doj.in. Slower to arrange than the Legal Services Authority.",
        "ന്യായ ബന്ധു സന്നദ്ധ സേവനം ചെയ്യുന്ന അഭിഭാഷകനെ കണ്ടെത്തിത്തരും. probono-doj.in-ൽ രജിസ്റ്റർ ചെയ്യുക. ലീഗൽ സർവീസസ് അതോറിറ്റിയേക്കാൾ സമയമെടുക്കും.",
      ),
      links: [
        {
          label: t("probono-doj.in", "probono-doj.in"),
          href: "https://www.probono-doj.in/",
        },
      ],
    },
    {
      q: t("Hiring your own lawyer", "സ്വന്തം അഭിഭാഷകനെ വയ്ക്കാൻ"),
      a: t(
        "The Bar Council of Kerala keeps a public list at barcouncilkerala.org. Your lawyer joins your case through this portal.",
        "കേരള ബാർ കൗൺസിലിന്റെ പൊതു പട്ടിക barcouncilkerala.org-ൽ ഉണ്ട്. നിങ്ങളുടെ അഭിഭാഷകൻ ഈ പോർട്ടൽ വഴി കേസിൽ ചേരും.",
      ),
      links: [
        {
          label: t("barcouncilkerala.org", "barcouncilkerala.org"),
          href: "https://www.barcouncilkerala.org/",
        },
      ],
    },
    {
      q: t("Help using this website", "ഈ വെബ്സൈറ്റ് ഉപയോഗിക്കാൻ സഹായം"),
      a: t(
        "Call 0000 000000, or visit the e-Sewa Kendra at the District Court complex. The national legal aid helpline is 15100, toll free in 10 languages.",
        "0000 000000 വിളിക്കുക, അല്ലെങ്കിൽ ജില്ലാ കോടതി വളപ്പിലെ ഇ-സേവാ കേന്ദ്രം സന്ദർശിക്കുക. ദേശീയ നിയമസഹായ ഹെൽപ്‌ലൈൻ 15100, 10 ഭാഷകളിൽ ടോൾ ഫ്രീ.",
      ),
      links: [
        {
          label: t("0000 000000", "0000 000000"),
          href: "tel:+910000000000",
        },
        {
          label: t("15100", "15100"),
          href: "tel:15100",
        },
      ],
    },
    {
      q: t("If you have a disability", "ഭിന്നശേഷിക്കാരാണെങ്കിൽ"),
      a: t(
        "You can give your evidence in the language and way that works for you, and ask for court documents in a format you can use.",
        "നിങ്ങൾക്ക് സൗകര്യപ്രദമായ ഭാഷയിലും രീതിയിലും തെളിവ് നൽകാം, കോടതി രേഖകൾ ഉപയോഗിക്കാവുന്ന രൂപത്തിൽ ആവശ്യപ്പെടാം.",
      ),
    },
  ],
  join: [
    {
      q: t("Why do I need a mobile number?", "മൊബൈൽ നമ്പർ എന്തിനാണ്?"),
      a: t(
        "The court sends a one-time code to it, and uses it to tell you about hearing dates and orders. Email is optional.",
        "കോടതി അതിലേക്ക് ഒറ്റത്തവണ കോഡ് അയക്കും, ഹിയറിംഗ് തീയതികളും ഉത്തരവുകളും അറിയിക്കാൻ ഉപയോഗിക്കും. ഇമെയിൽ നിർബന്ധമല്ല.",
      ),
    },
    {
      q: t("Can I join later instead?", "പിന്നീട് ചേരാമോ?"),
      a: t(
        "Yes, at any stage. But the sooner you do, the more of your options are still open.",
        "അതെ, ഏത് ഘട്ടത്തിലും. പക്ഷേ എത്ര നേരത്തെയോ അത്രയും കൂടുതൽ വഴികൾ തുറന്നിരിക്കും.",
      ),
    },
    {
      q: t("Is my information private?", "എന്റെ വിവരങ്ങൾ രഹസ്യമാണോ?"),
      a: t(
        "The court is told when you open your summons and these pages. Only the judiciary sees this, and only to confirm the papers reached you.",
        "നിങ്ങൾ സമൻസും ഈ പേജുകളും തുറക്കുമ്പോൾ കോടതി അറിയും. ജുഡീഷ്യറി മാത്രമേ ഇത് കാണൂ; രേഖകൾ ലഭിച്ചു എന്ന് ഉറപ്പാക്കാൻ മാത്രം.",
      ),
    },
    {
      q: t("Is this legal advice?", "ഇത് നിയമോപദേശമാണോ?"),
      a: t(
        "No. This explains the law. A lawyer tells you what to do in your situation.",
        "അല്ല. ഇത് നിയമം വിശദീകരിക്കുന്നു. നിങ്ങളുടെ സാഹചര്യത്തിൽ എന്ത് ചെയ്യണമെന്ന് അഭിഭാഷകനാണ് പറയുക.",
      ),
    },
  ],
};

/* ----------------------------------------------------------------- videos */

/**
 * Context and reassurance — not a re-reading of the left column. Contents are
 * specified in "Onboarding — content allocation".
 *
 * `youtubeId` is empty until production videos exist, so the slot renders its
 * fallback. No decision-critical fact lives only here.
 */
export const videos: Record<StepId, { title: Copy; youtubeId?: string }> = {
  papers: { title: t("What is this case?", "ഇത് എന്ത് കേസാണ്?") },
  choices: { title: t("Can I settle this?", "ഇത് ഒത്തുതീർപ്പാക്കാമോ?") },
  date: { title: t("What if I cannot come?", "വരാൻ കഴിഞ്ഞില്ലെങ്കിൽ?") },
  help: { title: t("Can I get a free lawyer?", "സൗജന്യ അഭിഭാഷകനെ കിട്ടുമോ?") },
  join: { title: t("How do I join my case?", "കേസിൽ എങ്ങനെ ചേരും?") },
};

/** The string in this locale — English where no translation exists yet (Hindi, Gujarati and Punjabi, today). */
export function pick(copy: Copy, locale: Locale): string {
  return copy[locale] ?? copy.en;
}
