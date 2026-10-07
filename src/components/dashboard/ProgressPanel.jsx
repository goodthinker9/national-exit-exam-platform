import { useLanguage } from "../../i18n/LanguageContext.jsx";
import { getPracticeAnalytics } from "../../utils/practiceAnalytics.js";
import "./ProgressPanel.css";

export default function ProgressPanel({ history, onViewAnalytics }) {
  const { t } = useLanguage();
  const analytics = getPracticeAnalytics(history);

  return (
    <section className="progress-panel">
      <div className="progress-summary">
        <article className="summary-card"><strong>{analytics.sessions}</strong><span>{t("Exams completed")}</span></article>
        <article className="summary-card"><strong>{analytics.averageScore}%</strong><span>{t("Average score")}</span></article>
        <article className="summary-card"><strong>{analytics.totalAnswered}</strong><span>{t("Questions answered")}</span></article>
      </div>
      <div className="progress-section-heading">
        <h2>{t("Recent practice")}</h2>
        <button className="text-button" type="button" onClick={onViewAnalytics}>{t("View analytics")} →</button>
      </div>
      {analytics.recentScores.length ? (
        <div className="history-list">
          {analytics.recentScores.map((item, index) => (
            <div className="history-row" key={`${item.course}-${item.date}-${index}`}>
              <span><strong>{t(item.course)}</strong><small>{t(item.mode)} · {t(item.date)}</small></span>
              <span className="history-score">
                <strong>{item.score}</strong>
                <small>{item.percentage}%</small>
              </span>
            </div>
          ))}
        </div>
      ) : (
        <p className="muted">{t("Complete a practice session to see it here.")}</p>
      )}
    </section>
  );
}
