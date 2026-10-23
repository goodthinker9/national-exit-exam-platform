import { useLanguage } from "../../i18n/LanguageContext.jsx";
import { getPracticeAnalytics } from "../../utils/practiceAnalytics.js";
import WeakTopics from "../dashboard/WeakTopics.jsx";
import "./AnalyticsPage.css";

export default function AnalyticsPage({
  history,
  onBack,
  weakTopics,
  historyLoading,
  historyError,
  onReloadProgress,
  onPracticeCourse,
}) {
  const { t } = useLanguage();
  const analytics = getPracticeAnalytics(history);

  return (
    <main className="container analytics-page">
      <button className="back-button analytics-back" type="button" onClick={onBack}>
        ← {t("Student dashboard")}
      </button>
      <section className="analytics-hero">
        <p className="eyebrow">{t("YOUR STUDY INSIGHTS")}</p>
        <h1>{t("Progress analytics")}</h1>
        <p>{t("See your completed sessions, overall accuracy, and performance by course.")}</p>
      </section>

      {/* Loading / error banner */}
      {historyLoading && (
        <p className="muted" aria-live="polite">{t("Loading your progress...")}</p>
      )}
      {historyError && (
        <p role="alert" aria-live="assertive" style={{ color: "var(--error, #c0392b)", marginBottom: "16px" }}>
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

      <section className="analytics-metrics" aria-label={t("Progress analytics")}>
        <article className="analytics-metric">
          <span aria-hidden="true">▤</span>
          <div><strong>{analytics.sessions}</strong><small>{t("Exams completed")}</small></div>
        </article>
        <article className="analytics-metric">
          <span aria-hidden="true">✓</span>
          <div><strong>{analytics.averageScore}%</strong><small>{t("Average score")}</small></div>
        </article>
        <article className="analytics-metric">
          <span aria-hidden="true">?</span>
          {/* Fixed: was analytics.totalQuestions — now uses analytics.totalAnswered */}
          <div><strong>{analytics.totalAnswered}</strong><small>{t("Questions answered")}</small></div>
        </article>
      </section>

      {analytics.sessions ? (
        <div className="analytics-content">
          <section className="analytics-card course-analytics">
            <div className="analytics-card-heading">
              <div>
                <p className="eyebrow">{t("BY COURSE")}</p>
                <h2>{t("Course performance")}</h2>
              </div>
              <span>{t("{count} courses", { count: analytics.coursePerformance.length })}</span>
            </div>
            <div className="course-performance-list">
              {analytics.coursePerformance.map((course) => (
                <article className="course-performance" key={course.course}>
                  <div className="course-performance-heading">
                    <span><strong>{t(course.course)}</strong><small>{t("{count} sessions", { count: course.sessions })}</small></span>
                    <strong>{course.percentage}%</strong>
                  </div>
                  <div
                    className="analytics-bar"
                    role="progressbar"
                    aria-label={t("{course} score", { course: t(course.course) })}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={course.percentage}
                  >
                    <span style={{ width: `${course.percentage}%` }} />
                  </div>
                </article>
              ))}
            </div>
          </section>

          <section className="analytics-card session-analytics">
            <div className="analytics-card-heading">
              <div>
                <p className="eyebrow">{t("LATEST ACTIVITY")}</p>
                <h2>{t("Session scores")}</h2>
              </div>
            </div>
            <div className="session-score-list">
              {analytics.recentScores.map((session, index) => (
                <article className="session-score" key={`${session.course}-${session.date}-${index}`}>
                  <div className="session-score-meta">
                    <strong>{t(session.course)}</strong>
                    <small>{t(session.mode)} · {t(session.date)}</small>
                  </div>
                  <div className="session-score-value">
                    <strong>{session.percentage}%</strong>
                    <small>{session.score}</small>
                  </div>
                </article>
              ))}
            </div>
          </section>
        </div>
      ) : (
        <section className="analytics-empty">
          <span aria-hidden="true">▤</span>
          <h2>{t("Your analytics will appear here")}</h2>
          <p>{t("Complete a practice session to see it here.")}</p>
        </section>
      )}

      {/* ── Weak topics ──────────────────────────────────────────────────────── */}
      <section className="analytics-card" style={{ marginTop: "32px" }}>
        <div className="analytics-card-heading">
          <div>
            <p className="eyebrow">{t("TOPICS TO IMPROVE")}</p>
            <h2>{t("Weak topics")}</h2>
          </div>
        </div>
        <WeakTopics
          weakTopics={weakTopics ?? []}
          onPracticeCourse={onPracticeCourse}
          t={t}
        />
      </section>
    </main>
  );
}
