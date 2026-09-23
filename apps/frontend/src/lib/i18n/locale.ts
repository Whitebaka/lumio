import type { Locale } from "./dict";

export const SUPPORTED_LOCALES: Locale[] = ["en", "de", "it", "fi", "zh"];
export const LOCALE_LABELS: Record<Locale, string> = {
  en: "English",
  de: "Deutsch",
  it: "Italiano",
  fi: "Suomi",
  zh: "简体中文",
};

/** An explicit choice wins; otherwise honour the browser's language order. */
export function resolveLocale(
  preferred: string | null,
  languages: readonly string[],
): Locale {
  if (SUPPORTED_LOCALES.includes(preferred as Locale)) return preferred as Locale;
  for (const language of languages) {
    const base = language.toLowerCase().split(/[-_]/)[0] as Locale;
    if (SUPPORTED_LOCALES.includes(base)) return base;
  }
  return "en";
}
