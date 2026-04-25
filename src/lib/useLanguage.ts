export type LangCode = "en" | "hi" | "es";
export type Language = { code: LangCode; name: string; label: string; flag: string };

export const LANGUAGES: Language[] = [
  { code: "en", name: "English", label: "English", flag: "🇺🇸" },
  { code: "hi", name: "Hindi", label: "हिंदी", flag: "🇮🇳" },
  { code: "es", name: "Spanish", label: "Español", flag: "🇪🇸" },
];

export function useLanguage(): { lang: LangCode; setLang: (l: LangCode) => void } {
  return {
    lang: "en",
    setLang: () => {},
  };
}
