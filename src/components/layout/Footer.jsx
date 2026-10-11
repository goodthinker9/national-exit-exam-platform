import { useLanguage } from "../../i18n/LanguageContext.jsx";
import "./Footer.css";

export default function Footer({ onNavigate, onRegister }) {
  const { t } = useLanguage();
  return (
    <footer className="site-footer">
      <div className="footer-main container">
        <div className="footer-brand">
          <a className="footer-brand-link" href="#home" onClick={() => onNavigate?.("home")}>
            <img src="/images/logo.png" alt="" />
            <span>{t("Wollo University")}<small>{t("Remedial & Exit Exam Preparation")}</small></span>
          </a>
          <p>{t("Helping students prepare with focused practice, mock exams, and progress tools.")}</p>
        </div>
        <nav className="footer-links" aria-label={t("Explore")}>
          <h2>{t("Explore")}</h2>
          <a href="#features">{t("Features")}</a>
          <a href="#how-it-works">{t("How it works")}</a>
          <a href="#subjects">{t("Courses")}</a>
          <a href="#plans">{t("Plans")}</a>
          <a href="#faq">{t("Frequently asked questions")}</a>
        </nav>
        <div className="footer-action">
          <h2>{t("Ready to get started?")}</h2>
          <p>{t("Choose a subject and take the next step in your preparation.")}</p>
          <button type="button" onClick={onRegister}>{t("Create an account")} <span aria-hidden="true">→</span></button>
        </div>
      </div>
      <div className="footer-bottom">
        <div className="container footer-bottom-inner">
          <span>© {new Date().getFullYear()} {t("Wollo University Remedial & Exit Exam Prep")}</span>
          <span>{t("Learning together, one question at a time.")}</span>
        </div>
      </div>
    </footer>
  );
}
