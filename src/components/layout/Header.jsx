import { useLanguage } from "../../i18n/LanguageContext.jsx";
import LanguageSwitcher from "../../i18n/LanguageSwitcher.jsx";
import "./Header.css";

export default function Header({ onNavigate, view }) {
  const { t } = useLanguage();
  return (
    <header className="site-header">
      <a className="brand" href="#home" onClick={() => onNavigate("home")}>
        <span className="crest">W</span>
        <span>
          {t("Wollo University")}
          <small>{t("Exam Prep")}</small>
        </span>
      </a>
      <nav aria-label={t("Main navigation")}>
        {view === "home" && (
          <>
            <a href="#programs">{t("Programs")}</a>
            <a href="#about">{t("About")}</a>
          </>
        )}
        {!["quiz", "result"].includes(view) && (
          <button className="button button-small" onClick={() => onNavigate("auth")}>
            {view === "dashboard" ? t("Student dashboard") : t("Sign in")}
          </button>
        )}
        <LanguageSwitcher />
      </nav>
    </header>
  );
}
