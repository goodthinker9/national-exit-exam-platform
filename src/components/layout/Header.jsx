import { useNavigate, useLocation } from "react-router-dom";
import { useLanguage } from "../../i18n/LanguageContext.jsx";
import LanguageSwitcher from "../../i18n/LanguageSwitcher.jsx";
import "./Header.css";

export default function Header({ onNavigate, onRegister, view }) {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const location = useLocation();

  // Compute current view from pathname if view prop not specific enough
  const isHome = location.pathname === "/";

  return (
    <header className={`site-header${isHome ? " home-site-header" : ""}`}>
      <a
        className="brand"
        href="/"
        onClick={(e) => { e.preventDefault(); navigate("/"); }}
      >
        <img className="brand-logo" src="/images/logo.png" alt="" />
        <span className="brand-copy">
          {isHome ? "ExitPrep" : t("Wollo University")}
          {!isHome && <small>{t("Exam Prep")}</small>}
        </span>
      </a>
      <nav className="site-nav" aria-label={t("Main navigation")}>
        {isHome && (
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
          {isHome && (
            <>
              <button className="home-login" onClick={() => navigate("/login")}>
                {t("Login")}
              </button>
              <button className="button button-small home-signup" onClick={onRegister}>
                {t("Sign Up")}
              </button>
            </>
          )}
          {!isHome && !["quiz", "result"].includes(view) && (
            <button
              className="button button-small header-back-btn"
              onClick={() => {
                const path = location.pathname;
                if (path === "/app/remedial") navigate("/app/result");
                else if (["/app", "/app/courses", "/app/analytics"].some((p) => path.startsWith(p))) navigate("/app");
                else navigate("/login");
              }}
            >
              <span className="header-back-arrow" aria-hidden="true">←</span>
              {location.pathname === "/app/remedial"
                ? t("Your result")
                : ["/app", "/app/courses", "/app/analytics"].some((p) => location.pathname.startsWith(p))
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
