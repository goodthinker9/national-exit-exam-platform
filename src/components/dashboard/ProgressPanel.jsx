import { useLanguage } from "../../i18n/LanguageContext.jsx";
import { getPracticeAnalytics } from "../../utils/practiceAnalytics.js";
import WeakTopics from "./WeakTopics.jsx";
import "./ProgressPanel.css";

export default function ProgressPanel({
  history,
  onViewAnalytics,
  activity,
  weakTopics,
  historyLoading,
  historyError,
  onReloadProgress,
  onPracticeCourse,
}) {
  const { t } = useLanguage();
  const analytics = getPracticeAnalytics(history);

  // Activity values with defaults
  const streakDays    = activity?.streakDays    ?? 0;
  const todayAnswered = activity?.todayAnswered  ?? 0;
  const dailyGoal     = activity?.dailyGoal      ?? 10;

  const goalProgress = Math.min(todayAnswered, dailyGoal);
  const goalReached  = todayAnswered >= dailyGoal;

  return (
    <section className="progress-panel">
      {/* Loading / error banner — keeps old data visible underneath */}
      {historyLoading && !history.length && (
        <p className="muted" aria-live="polite">{t("Loading your progress...")}</p>
      )}
      {historyError && (
        <p className="progress-error" role="alert" aria-live="assertive">
          {historyError}
          {onReloadProgress && (
            <button
              type="button"
              className="text-button"
              style={{ marginLeft: "8px" }}
              onClick={onReloadProgress}
            >
              {t("Retry")}
            </button>
          )}
        </p>
      )}

      {/* ── Streak + Daily goal cards (before existing summary cards) ─────── */}
      <div className="progress-summary">
        {/* Study streak */}
        <article className="summary-card">
          <strong>{streakDays === 1 ? t("1 day") : t("{n} days", { n: streakDays })}</strong>
          <span>{t("Study streak")}</span>
          {todayAnswered === 0 && (
            <small className="streak-nudge">{t("Study today to keep it going")}</small>
          )}
        </article>

        {/* Daily goal */}
        <article className="summary-card">
          <strong>
            {goalReached
              ? <span className="goal-reached">✓ {t("Goal reached")}</span>
              : `${goalProgress} / ${dailyGoal}`}
          </strong>
          <span>{t("Today's goal")}</span>
          <div
            className="goal-progress-bar"
            role="progressbar"
            aria-valuenow={goalProgress}
            aria-valuemin={0}
            aria-valuemax={dailyGoal}
            aria-label={t("Daily goal progress")}
          >
            <span style={{ width: `${Math.min((goalProgress / dailyGoal) * 100, 100)}%` }} />
          </div>
          <small>{t("{n} / {total} questions", { n: goalProgress, total: dailyGoal })}</small>
        </article>

        {/* Existing three summary cards */}
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

      {/* ── Weak topics ──────────────────────────────────────────────────────── */}
      <div className="progress-section-heading" style={{ marginTop: "32px" }}>
        <h2>{t("Weak topics")}</h2>
      </div>
      <WeakTopics
        weakTopics={weakTopics ?? []}
        onPracticeCourse={onPracticeCourse}
        t={t}
      />
    </section>
  );
}
