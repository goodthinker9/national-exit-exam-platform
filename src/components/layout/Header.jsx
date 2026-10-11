import { useLanguage } from "../../i18n/LanguageContext.jsx";
import LanguageSwitcher from "../../i18n/LanguageSwitcher.jsx";
import "./Header.css";

export default function Header({ onNavigate, onRegister, view }) {
  const { t } = useLanguage();
  return (
    <header className={`site-header${view === "home" ? " home-site-header" : ""}`}>
      <a className="brand" href="#home" onClick={() => onNavigate("home")}>
        <img className="brand-logo" src="/images/logo.png" alt="" />
        <span className="brand-copy">
          {view === "home" ? "ExitPrep" : t("Wollo University")}
          {view !== "home" && <small>{t("Exam Prep")}</small>}
        </span>
      </a>
      <nav aria-label={t("Main navigation")}>
        {view === "home" && (
          <>
            <a href="#home">{t("Home")}</a>
            <a href="#features">{t("Features")}</a>
            <a href="#campus">{t("Campus")}</a>
            <a href="#subjects">{t("Courses")}</a>
            <a href="#plans">{t("Plans")}</a>
            <a href="#about">{t("About")}</a>
            <button className="home-login" onClick={() => onNavigate("auth")}>
              {t("Login")}
            </button>
            <button className="button button-small home-signup" onClick={onRegister}>
              {t("Sign Up")}
            </button>
          </>
        )}
        {view !== "home" && !["quiz", "result"].includes(view) && (
          <button
            className="button button-small"
            onClick={() => {
              if (view === "remedial") onNavigate("result");
              else onNavigate(["dashboard", "selection", "analytics"].includes(view) ? "dashboard" : "auth");
            }}
          >
            {view === "remedial"
              ? t("Your result")
              : ["dashboard", "selection", "analytics"].includes(view)
                ? t("Student dashboard")
                : t("Sign in")}
          </button>
        )}
        <LanguageSwitcher />
      </nav>
    </header>
  );
}
