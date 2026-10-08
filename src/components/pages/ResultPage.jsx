import { useLanguage } from "../../i18n/LanguageContext.jsx";
import "./ResultPage.css";

export default function ResultPage({ result, onDashboard, onRemedial }) {
  const { t } = useLanguage();
  const percentage = Math.round((result.correct / result.total) * 100);
  const unanswered = result.answers.filter((answer) => answer === null).length;
  const incorrect = result.total - result.correct - unanswered;
  const missedCount = result.questions.filter(
    (question, index) => result.answers[index] !== question.answer,
  ).length;
  const resultLabel = t("{percent}% correct in {course}.", {
    percent: percentage,
    course: t(result.course),
  });

  return (
    <main className="container result-page">
      <section className="result-hero">
        <div className="result-hero-copy">
          <p className="eyebrow">{t("SESSION COMPLETE")}</p>
          <h1>{t("Your result")}</h1>
          <p className="result-course">{resultLabel}</p>
          <p className="result-score-fraction">
            <strong>{result.correct}</strong><span> / {result.total} {t("Correct answers")}</span>
          </p>
        </div>
        <div
          className="result-score-ring"
          style={{ "--score-progress": `${percentage}%` }}
          role="img"
          aria-label={resultLabel}
        >
          <div>
            <strong>{percentage}%</strong>
            <span>{t("✓ Correct")}</span>
          </div>
        </div>
      </section>

      <section className="result-summary" aria-label={t("Your result")}>
        <article className="result-stat is-correct">
          <span className="result-stat-icon" aria-hidden="true">✓</span>
          <div><strong>{result.correct}</strong><span>{t("Correct answers")}</span></div>
        </article>
        <article className="result-stat is-incorrect">
          <span className="result-stat-icon" aria-hidden="true">×</span>
          <div><strong>{incorrect}</strong><span>{t("Incorrect answers")}</span></div>
        </article>
        <article className="result-stat is-unanswered">
          <span className="result-stat-icon" aria-hidden="true">—</span>
          <div><strong>{unanswered}</strong><span>{t("Unanswered")}</span></div>
        </article>
      </section>

      <section className="result-review" aria-labelledby="result-review-title">
        <div className="result-review-heading">
          <p className="eyebrow">{t("ANSWER REVIEW")}</p>
          <h2 id="result-review-title">{t("Review your answers")}</h2>
        </div>
        <div className="review-list">
          {result.questions.map((question, index) => {
            const chosen = result.answers[index];
            const isCorrect = chosen === question.answer;
            const isUnanswered = chosen === null;
            return (
              <article
                className={`review-item${isCorrect ? " is-correct" : isUnanswered ? " is-unanswered" : " is-incorrect"}`}
                key={`${question.question}-${index}`}
              >
                <div className="review-item-heading">
                  <span className="review-question-number">{t("Question {number}", { number: index + 1 })}</span>
                  <span className="review-status">
                    {t(isCorrect ? "✓ Correct" : isUnanswered ? "Unanswered" : "Incorrect")}
                  </span>
                </div>
                <h3>{t(question.question)}</h3>
                {!isCorrect && (
                  <>
                    <p className="review-answer correct-answer">
                      {t("✗ Correct answer: {answer}", { answer: t(question.options[question.answer]) })}
                    </p>
                    <p className="review-answer user-answer">
                      {t("Your answer: {answer}", { answer: isUnanswered ? t("No answer") : t(question.options[chosen]) })}
                    </p>
                  </>
                )}
                <p className="review-explanation">{t(question.explanation)}</p>
              </article>
            );
          })}
        </div>
      </section>
      <div className="result-actions">
        <button className="button outline" type="button" onClick={onDashboard}>{t("Back to dashboard")}</button>
        {missedCount > 0 && (
          <button className="button" type="button" onClick={onRemedial}>
            {t("Practice missed questions")} <span aria-hidden="true">→</span>
          </button>
        )}
      </div>
    </main>
  );
}
