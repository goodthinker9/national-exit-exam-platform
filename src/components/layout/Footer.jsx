import { useLanguage } from "../../i18n/LanguageContext.jsx";
import "./Footer.css";

export default function Footer() {
  const { t } = useLanguage();
  return (
    <footer>
      <div className="container footer-inner">
        <span>{t("Wollo University Remedial & Exit Exam Prep")}</span>
        <span>{t("Learning together, one question at a time.")}</span>
      </div>
    </footer>
  );
}
