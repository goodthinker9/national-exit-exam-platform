import { useLanguage } from "../../i18n/LanguageContext.jsx";
import "./ProgressPanel.css";

export default function ProgressPanel({ history }) {
  const { t } = useLanguage();
  return (
    <section className="progress-panel">
      <div className="progress-summary">
        <article className="summary-card"><strong>{t("5 days")}</strong><span>{t("Study streak")}</span></article>
        <article className="summary-card"><strong>68%</strong><span>{t("Average score")}</span></article>
        <article className="summary-card"><strong>{history.length}</strong><span>{t("Exams completed")}</span></article>
      </div>
      <h2>{t("Recent practice")}</h2>
      {history.length ? (
        <div className="history-list">
          {history.map((item, index) => (
            <div className="history-row" key={`${item.course}-${index}`}>
              <span><strong>{t(item.course)}</strong><small>{t(item.mode)} · {t(item.date)}</small></span>
              <strong>{item.score}</strong>
            </div>
          ))}
        </div>
      ) : <p className="muted">{t("Complete a practice session to see it here.")}</p>}
    </section>
  );
}
