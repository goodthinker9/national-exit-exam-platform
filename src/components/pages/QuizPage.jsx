import { useEffect, useRef, useState } from "react";
import { useLanguage } from "../../i18n/LanguageContext.jsx";
import OfflineBanner from "../shared/OfflineBanner.jsx";
import "./QuizPage.css";

const DRAFT_KEY = "wep_exam_draft";

function saveDraft(draft) {
  try { sessionStorage.setItem(DRAFT_KEY, JSON.stringify(draft)); } catch { /* ignore */ }
}
function clearDraft() {
  try { sessionStorage.removeItem(DRAFT_KEY); } catch { /* ignore */ }
}

export default function QuizPage({ quiz, onFinish, onBack, onReport }) {
  const { t } = useLanguage();
  const [questionIndex, setQuestionIndex] = useState(quiz.resumeIndex ?? 0);
  const [answers, setAnswers] = useState(quiz.resumeAnswers ?? Array(quiz.questions.length).fill(null));
  const [flagged, setFlagged] = useState(quiz.resumeFlags ?? Array(quiz.questions.length).fill(false));
  const [secondsLeft, setSecondsLeft] = useState(quiz.resumeSecondsLeft ?? (quiz.mockDurationMinutes || 10) * 60);
  const [reportMessage, setReportMessage] = useState("");
  const [isReportOpen, setIsReportOpen] = useState(false);
  const [reportSent, setReportSent] = useState(false);
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  const [toastMsg, setToastMsg] = useState("");
  const tabSwitchCount = useRef(quiz.resumeTabSwitches ?? 0);

  const currentQuestion = quiz.questions[questionIndex];
  const selectedAnswer = answers[questionIndex];

  // Autosave draft on every relevant state change
  useEffect(() => {
    saveDraft({
      course: quiz.course,
      scope: quiz.scope,
      isMock: quiz.isMock,
      isRemedial: quiz.isRemedial,
      mockDurationMinutes: quiz.mockDurationMinutes,
      questionIds: quiz.questions.map((q) => q.id),
      answers,
      flags: flagged,
      currentIndex: questionIndex,
      secondsLeft,
      tabSwitches: tabSwitchCount.current,
      savedAt: Date.now(),
    });
  }, [answers, flagged, questionIndex, secondsLeft]);

  // Clear draft on unmount
  useEffect(() => {
    return () => clearDraft();
  }, []);

  // Timer for mock exams
  useEffect(() => {
    if (!quiz.isMock) return undefined;
    if (secondsLeft === 0) {
      clearDraft();
      onFinish(answers, quiz, tabSwitchCount.current);
      return undefined;
    }
    const timer = window.setTimeout(() => setSecondsLeft(secondsLeft - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [quiz, answers, secondsLeft, onFinish]);

  // Tab-switch warning for mock exams only
  useEffect(() => {
    if (!quiz.isMock) return undefined;
    function handleVisibilityChange() {
      if (document.hidden) {
        tabSwitchCount.current += 1;
        const count = tabSwitchCount.current;
        setToastMsg(t("Leaving the exam page is recorded ({count})", { count }));
        window.setTimeout(() => setToastMsg(""), 3500);
      }
    }
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [quiz.isMock, t]);

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

  function submitReport(event) {
    event.preventDefault();
    const message = reportMessage.trim();
    if (!message) return;
    onReport?.(currentQuestion, message);
    setReportMessage("");
    setIsReportOpen(false);
    setReportSent(true);
  }

  function handleLeaveConfirm() {
    clearDraft();
    setShowLeaveConfirm(false);
    onBack();
  }

  function handleFinish() {
    clearDraft();
    onFinish(answers, quiz, tabSwitchCount.current);
  }

  const timeLabel = `${String(Math.floor(secondsLeft / 60)).padStart(2, "0")}:${String(
    secondsLeft % 60,
  ).padStart(2, "0")}`;

  return (
    <>
      {/* Offline banner - positioned below quiz topbar */}
      <OfflineBanner />
      {/* Quiz top bar – uses quiz-topbar class, NOT welcome-bar */}
      <div className="quiz-topbar">
        <div className="container quiz-topbar-inner">
          <span>
            {t(quiz.course)} · {t(quiz.isMock ? "Mock exam" : quiz.isRemedial ? "Remedial practice" : "Practice mode")}
          </span>
          <button type="button" onClick={() => setShowLeaveConfirm(true)}>{t("Leave exam")}</button>
        </div>
      </div>

      {/* In-page leave confirmation panel */}
      {showLeaveConfirm && (
        <div className="quiz-leave-overlay" role="dialog" aria-modal="true" aria-labelledby="leave-dialog-title">
          <div className="quiz-leave-panel">
            <h2 id="leave-dialog-title">{t("Leave this exam?")}</h2>
            <p>{t("Your progress will be saved for this session. You can resume later.")}</p>
            <div className="quiz-leave-actions">
              <button
                className="button"
                type="button"
                onClick={handleLeaveConfirm}
              >
                {t("Confirm leave")}
              </button>
              <button
                className="button outline"
                type="button"
                onClick={() => setShowLeaveConfirm(false)}
              >
                {t("Cancel")}
              </button>
            </div>
          </div>
        </div>
      )}

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
              <button className="button" type="button" onClick={handleFinish}>
                {t("Submit exam")}
              </button>
            )}
          </div>
          {quiz.isMock && <button className="text-button submit-link" type="button" onClick={handleFinish}>{t("Finish mock exam")}</button>}
          <section className="question-report">
            {reportSent ? (
              <p role="status">{t("Thank you. Your report was sent to the instructor for this course.")}</p>
            ) : (
              <>
                <button className="text-button" type="button" onClick={() => setIsReportOpen((open) => !open)}>
                  {t("Report a mistake")}
                </button>
                {isReportOpen && (
                  <form onSubmit={submitReport}>
                    <label htmlFor="question-report-message">{t("Describe the possible mistake")}</label>
                    <textarea id="question-report-message" rows="3" maxLength="500" value={reportMessage} onChange={(event) => setReportMessage(event.target.value)} required />
                    <button className="button button-small" type="submit" disabled={!reportMessage.trim()}>{t("Send report")}</button>
                  </form>
                )}
              </>
            )}
          </section>
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

      {/* Tab-switch toast */}
      {toastMsg && (
        <div className="toast" role="alert" aria-live="assertive">{toastMsg}</div>
      )}
    </>
  );
}
