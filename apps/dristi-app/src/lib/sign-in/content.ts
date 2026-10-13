/**
 * Sign-in — content model.
 *
 * Kept out of the component for the same reason the onboarding content is: the copy is
 * the design here, and it has to be reviewable by someone who does not read TSX.
 *
 * Two audiences share one screen and they arrive in opposite states:
 *   litigant — signs in perhaps twice a year, often frightened, often on a borrowed
 *              phone, sometimes with someone reading the screen aloud to them.
 *   advocate / clerk — signs in daily, wants the fewest possible keystrokes, and
 *              already knows the vocabulary.
 * So the litigant path explains and the advocate path instructs. Neither is condescended
 * to, and no sentence exists that only one of them can parse.
 *
 * Copy rules inherited from the onboarding spec: sentence case (DS Law), around eight
 * words a sentence, one idea a sentence, no legal term on the surface, and never open
 * with the accusation. Malayalam is the drafting language for anything a litigant reads;
 * English follows it. Register matches `lib/onboarding/content.ts`.
 */

import type { Copy } from "@/lib/onboarding/content";

const t = (en: string, ml: string): Copy => ({ en, ml });

/** Who is signing in. Sent with every attempt — the same person can hold both roles
 *  across their life, so it is never inferred from the number alone. */
export type Role = "litigant" | "advocate";
export const ROLE_ORDER: Role[] = ["litigant", "advocate"];

/** How they prove it. Both roles get both, per the Aug 2026 decision. */
export type Method = "password" | "otp";
export const METHOD_ORDER: Method[] = ["password", "otp"];

/* ------------------------------------------------------------------ brand panel */

/**
 * The panel is not decoration — it is where the person who does not yet have an account
 * finds out that the thing they are afraid of has an explanation. Everything in it is
 * readable without signing in.
 *
 * TODO(pucar): confirm the exact wordmark and the attribution line with the Kerala
 * judiciary before this ships. `attribution` deliberately claims nothing specific.
 */
export const brand = {
  wordmark: t("ON Courts", "ON Courts"),
  headline: t(
    "File and follow your case, from anywhere, anytime.",
    "എവിടെ നിന്നും, എപ്പോൾ വേണമെങ്കിലും കേസ് ഫയൽ ചെയ്യാം, പിന്തുടരാം.",
  ),
} satisfies Record<string, Copy>;

/* -------------------------------------------------------------------- help entry */

/**
 * Replaces the old "Seek help" link, which named a feeling instead of a subject and so
 * told nobody what was behind it. This names the trigger event, the payoff, and the
 * price in minutes — the three things that decide whether a frightened person clicks.
 *
 * The section number stays out of the headline on purpose. "§138" is how the court
 * files this case; "a cheque that bounced" is how the person lived it.
 *
 * **Two variants, branched on the summons token — not on role.** Role is unknown until
 * someone taps a tab, and the tab is on the far side of the screen; swapping the panel
 * from there would be a jump with no cause. The token is a fact we hold on arrival.
 *
 *   `summoned`  — they scanned the QR on a paper summons. We know they were served, so
 *                 the copy can name it directly and the modal auto-opens.
 *   `general`   — everyone else: an advocate at their desk, a clerk, someone who found
 *                 the site through search. Neutral, still one tap from the same content.
 *
 * The modal itself is NOT gated either way. Of its 129 strings, seven are case-specific
 * and every one has an "On your summons" fallback; the rest is universal law that is
 * just as true with no token as with one.
 */
export const help = {
  summoned: {
    title: t(
      "Got a summons about a cheque that bounced?",
      "ചെക്ക് മടങ്ങിയതിന് സമൻസ് കിട്ടിയോ?",
    ),
    body: t(
      "Find out what your summons means, what to do next, and where to seek legal help.",
      "സമൻസ് എന്താണെന്നും അടുത്തതായി എന്ത് ചെയ്യണമെന്നും നിയമസഹായം എവിടെ തേടാമെന്നും അറിയാം.",
    ),
    /* Names the object being explained. "Seek help" is too broad, while "See what
       happens next" hides that the destination explains the summons itself. */
    action: t("Understand your summons", "സമൻസ് മനസ്സിലാക്കുക"),
  },
  /* Reads as an offer, not a diagnosis — so an advocate scanning the page skips it
     without being told what they already know, and a worried litigant still finds it. */
  general: {
    title: t(
      "New to cheque bounce cases?",
      "ചെക്ക് കേസുകൾ പുതിയതാണോ?",
    ),
    body: t(
      "How a cheque bounce case runs, what each side can do, and where to get free legal help.",
      "ചെക്ക് കേസ് എങ്ങനെ നടക്കുന്നു, ഇരു കക്ഷികൾക്കും എന്ത് ചെയ്യാം, സൗജന്യ നിയമസഹായം എവിടെ കിട്ടും.",
    ),
    action: t("See how a case works", "കേസ് എങ്ങനെയെന്ന് അറിയുക"),
  },
  /** Sits under the button, so it stays to the one fact that removes the hesitation. */
  meta: t("No sign-in needed.", "പ്രവേശിക്കേണ്ട."),
};

/* -------------------------------------------------------------------------- form */

export const form = {
  title: t("Sign in to your account", "നിങ്ങളുടെ അക്കൗണ്ടിൽ പ്രവേശിക്കുക"),
  subtitle: t(
    "Use the mobile number you gave the court.",
    "കോടതിക്ക് നൽകിയ മൊബൈൽ നമ്പർ ഉപയോഗിക്കുക.",
  ),

  /** Legend for the role tabs. Screen readers hear this before the two choices. */
  roleLegend: t("I am signing in as", "ഞാൻ പ്രവേശിക്കുന്നത്"),

  mobileLabel: t("Mobile number", "മൊബൈൽ നമ്പർ"),
  mobilePlaceholder: t("10-digit mobile number", "10 അക്ക മൊബൈൽ നമ്പർ"),
  mobileError: t(
    "Enter the 10 digits of your mobile number.",
    "മൊബൈൽ നമ്പറിന്റെ 10 അക്കങ്ങൾ നൽകുക.",
  ),
  /** The number step's one action — it checks the number before asking for anything
   *  else, so nobody types a password for an account that does not exist. */
  continue: t("Continue", "തുടരുക"),
  /* Said as a fact under the field, the way Google says it. No offer to register here:
     the standing "Create an account" link is one line down, and a person who mistyped a
     digit wants to fix the digit, not be sent to a form. */
  notFound: t(
    "Couldn't find an account for this number.",
    "ഈ നമ്പറിൽ ഒരു അക്കൗണ്ടും കണ്ടെത്താനായില്ല.",
  ),

  /* The second step keeps the same headline as the first. A "Welcome back" to someone
     with a case on them reads as odd, not warm (owner, Sept 9). */
  changeNumber: t("Change number", "നമ്പർ മാറ്റുക"),

  methodLegend: t("Sign in with", "പ്രവേശിക്കാൻ"),

  passwordLabel: t("Password", "പാസ്‌വേഡ്"),
  passwordPlaceholder: t("Enter your password", "പാസ്‌വേഡ് നൽകുക"),
  passwordError: t("Enter your password.", "പാസ്‌വേഡ് നൽകുക."),
  passwordShow: t("Show password", "പാസ്‌വേഡ് കാണിക്കുക"),
  passwordHide: t("Hide password", "പാസ്‌വേഡ് മറയ്ക്കുക"),
  forgot: t("Forgot password?", "പാസ്‌വേഡ് മറന്നോ?"),

  otpHint: t(
    "We will send a one-time code to this number.",
    "ഈ നമ്പറിലേക്ക് ഒറ്റത്തവണ കോഡ് അയക്കും.",
  ),

  submitPassword: t("Sign in", "പ്രവേശിക്കുക"),
  submitOtp: t("Send one-time code", "ഒറ്റത്തവണ കോഡ് അയയ്ക്കുക"),

  registerPrompt: t("New here?", "പുതിയ ആളാണോ?"),
  registerAction: t("Create an account", "അക്കൗണ്ട് ഉണ്ടാക്കുക"),

  /* Kept in the file but no longer rendered — the footer collapsed to one line and the
     consent hook moved onto the Terms link. If legal wants an explicit "by continuing"
     statement back, this is the string. */
  terms: t(
    "By continuing you agree to the terms of use. Your information stays with the court.",
    "തുടരുന്നതിലൂടെ ഉപയോഗ നിബന്ധനകൾ അംഗീകരിക്കുന്നു. നിങ്ങളുടെ വിവരങ്ങൾ കോടതിയിൽ തന്നെ ഇരിക്കും.",
  ),
} satisfies Record<string, Copy>;

/** Tab labels stay short — five characters of Malayalam more and they wrap at 320px. */
export const roles: Record<
  Role,
  { tab: Copy; helper: Copy; describes: Copy }
> = {
  litigant: {
    tab: t("Litigant", "കക്ഷി"),
    /* Names the two ways a person ends up here without using "accused", which is the
       word that makes someone close the tab. */
    helper: t(
      "The case is about you. You filed it, or someone filed it against you.",
      "കേസ് നിങ്ങളെക്കുറിച്ചാണ്. നിങ്ങൾ ഫയൽ ചെയ്തതോ, ആരെങ്കിലും നിങ്ങൾക്കെതിരെ ഫയൽ ചെയ്തതോ.",
    ),
    describes: t("Sign in as a litigant", "കക്ഷിയായി പ്രവേശിക്കുക"),
  },
  advocate: {
    tab: t("Advocate or clerk", "അഭിഭാഷകൻ / ക്ലർക്ക്"),
    /* Answers the clerk's real question — "is there a place for me here, or do I use my
       advocate's login?" — which is the whole reason the third option existed. */
    helper: t(
      "Advocates and their clerks both sign in here.",
      "അഭിഭാഷകരും അവരുടെ ക്ലർക്കുമാരും ഇവിടെ പ്രവേശിക്കാം.",
    ),
    describes: t(
      "Sign in as an advocate or clerk",
      "അഭിഭാഷകനായോ ക്ലർക്കായോ പ്രവേശിക്കുക",
    ),
  },
};

export const methods: Record<Method, Copy> = {
  password: t("Password", "പാസ്‌വേഡ്"),
  otp: t("OTP", "ഒ.ടി.പി"),
};

/* ------------------------------------------------------------------- otp step */

/**
 * The second step of the OTP path. Three things carry it, and all three exist because
 * of how people actually fail here: they cannot remember which number the code went to,
 * they hit "resend" four times in ten seconds, and they mistyped a digit of the number
 * two screens ago and have no way back.
 */
export const otp = {
  title: t("Enter the code we sent you", "ഞങ്ങൾ അയച്ച കോഡ് നൽകുക"),
  /** `{number}` is replaced with the number the code went to — shown, never assumed. */
  subtitle: t(
    "We sent a 6-digit code to +91 {number}.",
    "+91 {number} എന്ന നമ്പറിലേക്ക് 6 അക്ക കോഡ് അയച്ചു.",
  ),
  label: t("6-digit code", "6 അക്ക കോഡ്"),
  error: t("Enter all 6 digits.", "6 അക്കങ്ങളും നൽകുക."),
  show: t("Show the code", "കോഡ് കാണിക്കുക"),
  hide: t("Hide the code", "കോഡ് മറയ്ക്കുക"),
  verify: t("Verify and sign in", "പരിശോധിച്ച് പ്രവേശിക്കുക"),
  resend: t("Send the code again", "കോഡ് വീണ്ടും അയയ്ക്കുക"),
  /** `{seconds}` counts down. Saying when beats greying a button out silently. Short
   *  on purpose: it shares a slot with the resend link that replaces it, so the two
   *  must be about one width or the line hops when the timer ends. */
  resendIn: t("Send again in {seconds}s", "{seconds}സെ. കഴിഞ്ഞ് വീണ്ടും അയയ്ക്കാം"),
  changeNumber: t("Use a different number", "മറ്റൊരു നമ്പർ ഉപയോഗിക്കുക"),
} satisfies Record<string, Copy>;

/* ---------------------------------------------------------------- role mismatch */

/**
 * The one dead end this screen can create. A number can be registered under both roles,
 * or under only the other one, so "wrong password" would be a lie and "no such account"
 * would send someone to register a second time. Name what is true and offer the fix in
 * one tap — never leave the correction as something the person has to work out.
 */
export const mismatch: Record<Role, { title: Copy; body: Copy; action: Copy }> = {
  /* Shown on the litigant tab when the number is only registered as an advocate. */
  litigant: {
    title: t(
      "This number is registered as an advocate",
      "ഈ നമ്പർ അഭിഭാഷകനായാണ് രജിസ്റ്റർ ചെയ്തിട്ടുള്ളത്",
    ),
    body: t(
      "Sign in as an advocate, or use the number you gave the court as a litigant.",
      "അഭിഭാഷകനായി പ്രവേശിക്കുക, അല്ലെങ്കിൽ കക്ഷിയായി കോടതിക്ക് നൽകിയ നമ്പർ ഉപയോഗിക്കുക.",
    ),
    action: t("Sign in as an advocate", "അഭിഭാഷകനായി പ്രവേശിക്കുക"),
  },
  /* Shown on the advocate tab when the number is only registered as a litigant. */
  advocate: {
    title: t(
      "This number is registered as a litigant",
      "ഈ നമ്പർ കക്ഷിയായാണ് രജിസ്റ്റർ ചെയ്തിട്ടുള്ളത്",
    ),
    body: t(
      "Sign in as a litigant, or register separately with your Bar Council number.",
      "കക്ഷിയായി പ്രവേശിക്കുക, അല്ലെങ്കിൽ ബാർ കൗൺസിൽ നമ്പർ ഉപയോഗിച്ച് വേറെ രജിസ്റ്റർ ചെയ്യുക.",
    ),
    action: t("Sign in as a litigant", "കക്ഷിയായി പ്രവേശിക്കുക"),
  },
};

/* ------------------------------------------------------------------------ footer */

export const footerNavLabel = t("About this site", "ഈ സൈറ്റിനെക്കുറിച്ച്");

export const footer: { label: Copy; href: string }[] = [
  { label: t("Terms of use", "ഉപയോഗ നിബന്ധനകൾ"), href: "/terms" },
  { label: t("Privacy", "സ്വകാര്യത"), href: "/privacy" },
  { label: t("Support", "സഹായം"), href: "/support" },
];
