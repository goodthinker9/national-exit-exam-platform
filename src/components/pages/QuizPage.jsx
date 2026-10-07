import { useEffect, useState } from "react";
import { useLanguage } from "../../i18n/LanguageContext.jsx";
import "./QuizPage.css";

export default function QuizPage({ quiz, onFinish, onBack }) {
  const { t } = useLanguage();
  const [questionIndex, setQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState(Array(quiz.questions.length).fill(null));
  const [flagged, setFlagged] = useState(Array(quiz.questions.length).fill(false));
  const [secondsLeft, setSecondsLeft] = useState(600);
  const currentQuestion = quiz.questions[questionIndex];
  const selectedAnswer = answers[questionIndex];

  useEffect(() => {
    if (!quiz.isMock) return undefined;
    if (secondsLeft === 0) {
      onFinish(answers, quiz);
      return undefined;
    }
    const timer = window.setTimeout(() => setSecondsLeft(secondsLeft - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [quiz, answers, secondsLeft, onFinish]);

  function chooseAnswer(optionIndex) {
    if (!quiz.isMock && selectedAnswer !== null) return;
    const updatedAnswers = [...answers];
    updatedAnswers[questionIndex] = optionIndex;
    setAnswers(updatedAnswers);
  }

  function toggleFlag() {
    const updatedFlags = [...flagged];
    updatedFlags[questionIndex] = !updatedFlags[questionIndex];
    setFlagged(updatedFlags);
  }

  const timeLabel = `${String(Math.floor(secondsLeft / 60)).padStart(2, "0")}:${String(
    secondsLeft % 60,
  ).padStart(2, "0")}`;

  return (
    <>
      <div className="welcome-bar quiz-welcome">
        <div className="container welcome-inner quiz-welcome-inner">
          <span>
            {t(quiz.course)} · {t(quiz.isMock ? "Mock exam" : quiz.isRemedial ? "Remedial practice" : "Practice mode")}
          </span>
          <button type="button" onClick={onBack}>{t("Leave exam")}</button>
        </div>
      </div>
      <main className="container quiz-layout">
        <section className="question-card">
          <div
            className="quiz-progress-track"
            role="progressbar"
            aria-label={t("Question {current} of {total}", { current: questionIndex + 1, total: quiz.questions.length })}
            aria-valuemin={1}
            aria-valuemax={quiz.questions.length}
            aria-valuenow={questionIndex + 1}
          >
            <span style={{ width: `${((questionIndex + 1) / quiz.questions.length) * 100}%` }} />
          </div>
          <div className="question-meta">
            <span className="question-count">{t("Question {current} of {total}", { current: questionIndex + 1, total: quiz.questions.length })}</span>
            <span className={`quiz-mode${quiz.isMock && secondsLeft < 60 ? " time-warning" : ""}`} role={quiz.isMock ? "timer" : undefined}>
              {quiz.isMock
                ? t("Time remaining · {time}", { time: timeLabel })
                : t(quiz.isRemedial ? "Remedial practice" : "Practice mode · no timer")}
            </span>
          </div>
          <h2>{t(currentQuestion.question)}</h2>
          <div className="answer-list">
            {currentQuestion.options.map((option, index) => {
              let answerClass = selectedAnswer === index ? " selected" : "";
              if (selectedAnswer !== null && !quiz.isMock) {
                if (index === currentQuestion.answer) answerClass = " correct";
                else if (index === selectedAnswer) answerClass = " incorrect";
              }
              return (
                <button
                  type="button"
                  className={`answer-option${answerClass}`}
                  key={option}
                  disabled={!quiz.isMock && selectedAnswer !== null}
                  aria-pressed={selectedAnswer === index}
                  onClick={() => chooseAnswer(index)}
                >
                  <b>{String.fromCharCode(65 + index)}</b>{t(option)}
                </button>
              );
            })}
          </div>
          {selectedAnswer !== null && !quiz.isMock && (
            <div className="explanation" role="status">
              <strong>{t(selectedAnswer === currentQuestion.answer ? "Correct." : "Not quite.")}</strong>{" "}
              {t(currentQuestion.explanation)}
            </div>
          )}
          <div className="quiz-controls">
            <button
              className="button outline"
              type="button"
              disabled={questionIndex === 0}
              onClick={() => setQuestionIndex(questionIndex - 1)}
            >
              {t("Previous")}
            </button>
            <button className="button outline" type="button" aria-pressed={flagged[questionIndex]} onClick={toggleFlag}>
              {t(flagged[questionIndex] ? "Remove flag" : "Flag for review")}
            </button>
            {questionIndex < quiz.questions.length - 1 ? (
              <button className="button" type="button" onClick={() => setQuestionIndex(questionIndex + 1)}>
                {t("Next question")}
              </button>
            ) : (
              <button className="button" type="button" onClick={() => onFinish(answers, quiz)}>
                {t("Submit exam")}
              </button>
            )}
          </div>
          {quiz.isMock && <button className="text-button submit-link" type="button" onClick={() => onFinish(answers, quiz)}>{t("Finish mock exam")}</button>}
        </section>
        <aside className="question-map">
          <h3>{t("Questions")}</h3>
          <p className="muted">{t("Choose a number to move between questions.")}</p>
          <div className="map-grid">
            {quiz.questions.map((_, index) => (
              <button
                className={`${index === questionIndex ? "current " : ""}${answers[index] !== null ? "answered " : ""}${flagged[index] ? "flagged" : ""}`}
                key={index}
                aria-label={t("Question {number}", { number: index + 1 })}
                aria-current={index === questionIndex ? "step" : undefined}
                type="button"
                onClick={() => setQuestionIndex(index)}
              >
                {index + 1}
              </button>
            ))}
          </div>
          <p className="muted">{t("{count} answered", { count: answers.filter((answer) => answer !== null).length })}</p>
        </aside>
      </main>
    </>
  );
}
