"use client";

import * as React from "react";

import type { Locale } from "@/lib/onboarding/content";
import {
  SECOND_LANGUAGE,
  SECOND_LANGUAGES,
  type SecondLanguage,
} from "@/lib/locale-config";

/**
 * App-wide language. The old Portal shell carried locale as a prop pair; on the one
 * shared shell it is context, so the top-bar toggle and every screen read the same
 * source. Citizen-facing screens (home, join, bond) render bilingual copy; professional
 * screens simply ignore it.
 */
type LocaleValue = {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  /** The language beside English in the top bar's switch — Hindi unless one is chosen. */
  secondLanguage: SecondLanguage;
  /** Put another language beside English, and switch to it. */
  setSecondLanguage: (language: SecondLanguage) => void;
};

const LocaleContext = React.createContext<LocaleValue | null>(null);

export function LocaleProvider({
  children,
  initialLocale = "en",
}: {
  children: React.ReactNode;
  initialLocale?: Locale;
}) {
  const [locale, setLocale] = React.useState<Locale>(initialLocale);
  const [secondLanguage, setSecond] = React.useState<SecondLanguage>(
    (SECOND_LANGUAGES as readonly string[]).includes(initialLocale)
      ? (initialLocale as SecondLanguage)
      : SECOND_LANGUAGE,
  );

  const setSecondLanguage = React.useCallback((language: SecondLanguage) => {
    setSecond(language);
    setLocale(language);
  }, []);

  React.useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  const value = React.useMemo<LocaleValue>(
    () => ({ locale, setLocale, secondLanguage, setSecondLanguage }),
    [locale, secondLanguage, setSecondLanguage],
  );

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useLocale(): LocaleValue {
  const value = React.useContext(LocaleContext);
  if (!value) throw new Error("useLocale must be used inside <LocaleProvider>");
  return value;
}
