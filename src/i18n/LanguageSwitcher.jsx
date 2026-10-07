import { useState } from "react";
import { useLanguage } from "./LanguageContext.jsx";
import "./LanguageSwitcher.css";

export default function LanguageSwitcher() {
  const [isOpen, setIsOpen] = useState(false);
  const { language, languageOptions, setLanguage, t } = useLanguage();
  const currentLanguage = languageOptions.find((option) => option.code === language);

  return (
    <div className="language-switcher">
      <button
        aria-expanded={isOpen}
        aria-controls="language-options"
        aria-haspopup="true"
        aria-label={`${t("Change language")}: ${currentLanguage.label}`}
        className="language-trigger"
        onClick={() => setIsOpen((open) => !open)}
        type="button"
      >
        <span aria-hidden="true">文</span>
        {currentLanguage.nativeLabel}
        <span aria-hidden="true" className="language-chevron">⌄</span>
      </button>
      {isOpen && (
        <div className="language-menu" id="language-options" role="group" aria-label={t("Language")}>
          {languageOptions.map((option) => (
            <button
              aria-pressed={language === option.code}
              className={language === option.code ? "active" : ""}
              key={option.code}
              onClick={() => {
                setLanguage(option.code);
                setIsOpen(false);
              }}
              type="button"
            >
              <span>{option.nativeLabel}</span>
              <small>{option.label}</small>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
