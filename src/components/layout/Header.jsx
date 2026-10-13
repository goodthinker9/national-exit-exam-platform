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
      <nav className="site-nav" aria-label={t("Main navigation")}>
        {view === "home" && (
          <div className="nav-links">
            <a href="#home" className="active" onClick={(e) => { e.preventDefault(); document.getElementById("home")?.scrollIntoView({ behavior: "smooth" }); }}>{t("Home")}</a>
            <a href="#services" onClick={(e) => { e.preventDefault(); document.getElementById("services")?.scrollIntoView({ behavior: "smooth" }); }}>{t("Services")}</a>
            <a href="#campus" onClick={(e) => { e.preventDefault(); document.getElementById("campus")?.scrollIntoView({ behavior: "smooth" }); }}>{t("Campus")}</a>
            <a href="#subjects" onClick={(e) => { e.preventDefault(); document.getElementById("subjects")?.scrollIntoView({ behavior: "smooth" }); }}>{t("Courses")}</a>
            <a href="#about" onClick={(e) => { e.preventDefault(); document.getElementById("about")?.scrollIntoView({ behavior: "smooth" }); }}>{t("About")}</a>
            <a href="#plans" onClick={(e) => { e.preventDefault(); document.getElementById("plans")?.scrollIntoView({ behavior: "smooth" }); }}>{t("Plans")}</a>
          </div>
        )}

        <div className="nav-cta">
          {view === "home" && (
            <>
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
              className="button button-small header-back-btn"
              onClick={() => {
                if (view === "remedial") onNavigate("result");
                else onNavigate(["dashboard", "selection", "analytics"].includes(view) ? "dashboard" : "auth");
              }}
            >
              <span className="header-back-arrow" aria-hidden="true">←</span>
              {view === "remedial"
                ? t("Your result")
                : ["dashboard", "selection", "analytics"].includes(view)
                  ? t("Student dashboard")
                  : t("Sign in")}
            </button>
          )}
          <LanguageSwitcher />
        </div>
      </nav>
    </header>
  );
}
