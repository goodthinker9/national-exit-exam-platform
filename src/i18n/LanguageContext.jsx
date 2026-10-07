import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { languageOptions, translations } from "./translations.js";

const LanguageContext = createContext(null);

export function LanguageProvider({ children }) {
  const [language, setLanguage] = useState("en");

  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  const value = useMemo(() => ({
    language,
    setLanguage,
    languageOptions,
    t(text, values = {}) {
      let translated = translations[language]?.[text] ?? text;
      for (const [key, value] of Object.entries(values)) {
        translated = translated.replaceAll(`{${key}}`, String(value));
      }
      return translated;
    },
  }), [language]);

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error("useLanguage must be used within a LanguageProvider.");
  }
  return context;
}
