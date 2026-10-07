import { useLanguage } from "../../i18n/LanguageContext.jsx";
import "./ResultPage.css";

export default function ResultPage({ result, onDashboard }) {
  const { t } = useLanguage();
  return (
    <main className="container result-page">
      <p className="eyebrow">{t("SESSION COMPLETE")}</p>
      <h1>{t("Your result")}</h1>
      <p className="score">{result.correct} <span>/ {result.total}</span></p>
      <p className="lead">{t("{percent}% correct in {course}.", { percent: Math.round((result.correct / result.total) * 100), course: t(result.course) })}</p>
      <div className="review-list">
        {result.questions.map((question, index) => {
          const chosen = result.answers[index];
          return (
            <article className="review-item" key={`${question.question}-${index}`}>
              <strong>{index + 1}. {t(question.question)}</strong>
              <p>{chosen === question.answer ? t("✓ Correct") : t("✗ Correct answer: {answer}", { answer: t(question.options[question.answer]) })}</p>
              {chosen !== question.answer && (
                <p className="muted">{t("Your answer: {answer}", { answer: chosen === null ? t("No answer") : t(question.options[chosen]) })}</p>
              )}
              <p className="muted">{t(question.explanation)}</p>
            </article>
          );
        })}
      </div>
      <button className="button" onClick={onDashboard}>{t("Back to dashboard")}</button>
    </main>
  );
}
