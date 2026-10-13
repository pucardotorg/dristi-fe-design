/**
 * Which language sits beside English in the language switcher. A deployment setting,
 * not a filer's choice: one second language per deployment (owner, 2026-10-08).
 *
 * Hindi is the default. Hindi text does not exist yet — every string carries English
 * and Malayalam — so with Hindi chosen, any string without a Hindi version shows in
 * English until translations are supplied (`pick` falls back).
 */
export type SecondLanguage = "hi" | "gu" | "pa" | "ml";

export const SECOND_LANGUAGE: SecondLanguage = "hi";

/**
 * The second languages the top bar's switch can put beside English, Hindi first
 * (owner, 2026-10-08: "keep the default as Hindi... they can choose to see Gujarati or
 * Punjabi"). No Gujarati or Punjabi strings exist yet either, so like Hindi they show
 * English until translations are supplied.
 */
export const SECOND_LANGUAGES: readonly SecondLanguage[] = ["hi", "gu", "pa"];

/** Each language named in its own script, so it is findable by someone who reads only that. */
export const LANGUAGE_NAME: Record<"en" | SecondLanguage, string> = {
  en: "English",
  hi: "हिन्दी",
  gu: "ગુજરાતી",
  pa: "ਪੰਜਾਬੀ",
  ml: "മലയാളം",
};
