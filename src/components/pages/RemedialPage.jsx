import { useLanguage } from "../../i18n/LanguageContext.jsx";
import "./RemedialPage.css";

export default function RemedialPage({ result, onStartPractice, onBack, onDashboard }) {
  const { t } = useLanguage();
  const questionsToRetry = result.questions
    .map((question, index) => ({ question, index, answer: result.answers[index] }))
    .filter(({ question, answer }) => answer !== question.answer);

  return (
    <main className="container remedial-page">
      <button className="back-button remedial-back" type="button" onClick={onBack}>
        ← {t("Back to results")}
      </button>
      <section className="remedial-hero">
        <div>
          <p className="eyebrow">{t("Remedial Program")}</p>
          <h1>{t("Focus on what you missed")}</h1>
          <p>{t("Review missed or unanswered questions from your latest session, then practice them again.")}</p>
        </div>
        <div className="remedial-count" aria-label={t("Questions to revisit")}>
          <strong>{questionsToRetry.length}</strong>
          <span>{t("Questions to revisit")}</span>
        </div>
      </section>

      {questionsToRetry.length > 0 ? (
        <>
          <section className="remedial-list" aria-labelledby="remedial-list-title">
            <div className="remedial-list-heading">
              <p className="eyebrow">{t("YOUR NEXT STEP")}</p>
              <h2 id="remedial-list-title">{t("Questions")}</h2>
            </div>
            {questionsToRetry.map(({ question, index, answer }) => (
              <article className={`remedial-question${answer === null ? " is-unanswered" : ""}`} key={`${question.question}-${index}`}>
                <div className="remedial-question-heading">
                  <span>{t("Question {number}", { number: index + 1 })}</span>
                  <strong>{t(answer === null ? "Unanswered" : "Incorrect")}</strong>
                </div>
                <h3>{t(question.question)}</h3>
                <p className="remedial-correct-answer">
                  {t("✗ Correct answer: {answer}", { answer: t(question.options[question.answer]) })}
                </p>
                <p className="remedial-user-answer">
                  {t("Your answer: {answer}", { answer: answer === null ? t("No answer") : t(question.options[answer]) })}
                </p>
                <p className="remedial-explanation">{t(question.explanation)}</p>
              </article>
            ))}
          </section>
          <div className="remedial-actions">
            <button className="button" type="button" onClick={onStartPractice}>
              {t("Practice missed questions")} <span aria-hidden="true">→</span>
            </button>
            <button className="text-button" type="button" onClick={onDashboard}>
              {t("Back to dashboard")}
            </button>
          </div>
        </>
      ) : (
        <section className="remedial-empty">
          <span aria-hidden="true">✓</span>
          <h2>{t("No missed questions. Excellent work!")}</h2>
          <button className="button" type="button" onClick={onDashboard}>{t("Back to dashboard")}</button>
        </section>
      )}
    </main>
  );
}
