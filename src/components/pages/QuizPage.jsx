import { useEffect, useRef, useState } from "react";
import { useLanguage } from "../../i18n/LanguageContext.jsx";
import OfflineBanner from "../shared/OfflineBanner.jsx";
import {
  saveAnswer,
  checkPracticeAnswer,
  logTabSwitch,
} from "../../lib/supabase.js";
import "./QuizPage.css";

// ── sessionStorage: persist only the attempt id for refresh-resume ────────────
const ATTEMPT_KEY = "wep_attempt_id";

function saveAttemptRef(attemptId, courseName, isMock) {
  try { sessionStorage.setItem(ATTEMPT_KEY, JSON.stringify({ attemptId, courseName, isMock })); }
  catch { /* ignore */ }
}
function clearAttemptRef() {
  try { sessionStorage.removeItem(ATTEMPT_KEY); } catch { /* ignore */ }
}

export default function QuizPage({ quiz, onFinish, onBack, onReport }) {
  const { t } = useLanguage();

  // ── state ─────────────────────────────────────────────────────────────────
  const [questionIndex, setQuestionIndex] = useState(quiz.resumeIndex ?? 0);
  const [answers,       setAnswers]       = useState(quiz.resumeAnswers ?? Array(quiz.questions.length).fill(null));
  const [flagged,       setFlagged]       = useState(quiz.resumeFlags   ?? Array(quiz.questions.length).fill(false));

  // Per-question feedback from check_practice_answer (practice only)
  // feedbackMap[qi] = { correctIndex, isCorrect, explanation }
  const [feedbackMap, setFeedbackMap] = useState(() => {
    // Pre-populate from any already-answered questions so feedback shows on resume
    const map = {};
    (quiz.resumeAnswers ?? []).forEach((ans, qi) => {
      if (ans !== null && quiz.questions[qi]?.answer !== null && !quiz.isMock) {
        // answer index is known from a previous resume — store a placeholder
        // (real feedback will be fetched if the user re-visits)
        map[qi] = { correctIndex: quiz.questions[qi].answer, isCorrect: ans === quiz.questions[qi].answer, explanation: quiz.questions[qi].explanation ?? "" };
      }
    });
    return map;
  });

  // Mock timer — computed from server ends_at + offset
  const serverOffsetRef = useRef(quiz.serverTimeOffset ?? 0);
  const [secondsLeft, setSecondsLeft] = useState(() => {
    if (!quiz.isMock || !quiz.endsAt) return (quiz.resumeSecondsLeft ?? (quiz.mockDurationMinutes || 10) * 60);
    const endsAtMs = new Date(quiz.endsAt).getTime();
    return Math.max(0, Math.round((endsAtMs - Date.now() - serverOffsetRef.current) / 1000));
  });

  const tabSwitchCount = useRef(quiz.resumeTabSwitches ?? 0);
  const [reportMessage,    setReportMessage]    = useState("");
  const [isReportOpen,     setIsReportOpen]     = useState(false);
  const [reportedIds,      setReportedIds]      = useState(() => new Set());
  const [reportBusy,       setReportBusy]       = useState(false);
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  const [toastMsg,         setToastMsg]         = useState("");
  const isSubmittingRef = useRef(false);

  const currentQuestion  = quiz.questions[questionIndex];
  const reportSent       = reportedIds.has(currentQuestion?.id);
  const selectedAnswer   = answers[questionIndex];
  const currentFeedback  = feedbackMap[questionIndex] ?? null;

  // ── Practice resume: re-fetch the result of questions already answered ─────────
  // check_practice_answer is idempotent (first answer is kept), so calling it again just returns the
  // stored result + explanation.
  useEffect(() => {
    if (quiz.isMock || !quiz.attemptId) return;
    (quiz.resumeAnswers ?? []).forEach((ans, qi) => {
      const q = quiz.questions[qi];
      const optionId = ans === null ? null : q?.optionIds?.[ans];
      if (!optionId) return;
      checkPracticeAnswer({ attemptId: quiz.attemptId, questionId: q.id, optionId })
        .then((fb) => {
          const correctIndex = q.optionIds.indexOf(fb.correct_option);
          setFeedbackMap((prev) => ({ ...prev, [qi]: { correctIndex: correctIndex >= 0 ? correctIndex : 0, isCorrect: fb.is_correct, explanation: fb.explanation ?? "" } }));
        })
        .catch((err) => console.warn("[resume feedback]", err));
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Persist attempt ref on mount ──────────────────────────────────────────
  useEffect(() => {
    if (quiz.attemptId) {
      saveAttemptRef(quiz.attemptId, quiz.course, quiz.isMock);
    }
  }, [quiz.attemptId, quiz.course, quiz.isMock]);

  // ── Mock timer ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!quiz.isMock) return undefined;
    if (secondsLeft <= 0) {
      if (!isSubmittingRef.current) { isSubmittingRef.current = true; handleFinish(); }
      return undefined;
    }
    const timer = window.setTimeout(() => {
      // Recompute from server deadline each tick to stay in sync after resume
      if (quiz.endsAt) {
        const endsAtMs = new Date(quiz.endsAt).getTime();
        setSecondsLeft(Math.max(0, Math.round((endsAtMs - Date.now() - serverOffsetRef.current) / 1000)));
      } else {
        setSecondsLeft((s) => Math.max(0, s - 1));
      }
    }, 1000);
    return () => window.clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quiz.isMock, secondsLeft]);

  // ── Tab-switch (mock only) ─────────────────────────────────────────────────
  useEffect(() => {
    if (!quiz.isMock) return undefined;
    function handleVisibilityChange() {
      if (document.hidden) {
        tabSwitchCount.current += 1;
        const count = tabSwitchCount.current;
        setToastMsg(t("Leaving the exam page is recorded ({count})", { count }));
        window.setTimeout(() => setToastMsg(""), 3500);
        if (quiz.attemptId) {
          logTabSwitch(quiz.attemptId).catch(() => { /* fire-and-forget */ });
        }
      }
    }
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [quiz.isMock, quiz.attemptId, t]);

  // ── Answer selection ───────────────────────────────────────────────────────
  async function chooseAnswer(optionIndex) {
    // Practice: locked after first answer; Mock: can change until submit
    if (!quiz.isMock && selectedAnswer !== null) return;

    const updatedAnswers = [...answers];
    updatedAnswers[questionIndex] = optionIndex;
    setAnswers(updatedAnswers);

    const q         = currentQuestion;
    const optionId  = q.optionIds?.[optionIndex];
    const attemptId = quiz.attemptId;

    if (!attemptId || !optionId) return; // no server call in offline/fallback mode

    if (quiz.isMock) {
      // Mock: autosave — fire and forget with one silent retry
      saveAnswer({ attemptId, questionId: q.id, optionId }).catch(() => {
        window.setTimeout(
          () => saveAnswer({ attemptId, questionId: q.id, optionId }).catch(() => {}),
          2000,
        );
      });
    } else {
      // Practice: ask server for feedback
      try {
        const feedback = await checkPracticeAnswer({ attemptId, questionId: q.id, optionId });
        const correctIndex = q.optionIds?.indexOf(feedback.correct_option) ?? -1;
        setFeedbackMap((prev) => ({
          ...prev,
          [questionIndex]: {
            correctIndex:  correctIndex >= 0 ? correctIndex : 0,
            isCorrect:     feedback.is_correct,
            explanation:   feedback.explanation ?? "",
          },
        }));
      } catch (err) {
        // Network error — show local fallback styling only if answer key is embedded
        console.warn("[checkPracticeAnswer]", err);
      }
    }
  }

  function toggleFlag() {
    const updatedFlags = [...flagged];
    updatedFlags[questionIndex] = !updatedFlags[questionIndex];
    setFlagged(updatedFlags);
  }

  async function handleReportSubmit(event) {
    event.preventDefault();
    const message = reportMessage.trim();
    if (!message || reportBusy) return;
    setReportBusy(true);
    let ok = false;
    try { ok = await onReport?.(currentQuestion, message); } catch { ok = false; }
    setReportBusy(false);
    if (ok !== false) {            // only show "Thank you" when the report really reached the server
      setReportMessage("");
      setIsReportOpen(false);
      setReportedIds((prev) => new Set(prev).add(currentQuestion.id));
    }
  }

  function handleLeaveConfirm() {
    // Keep the attempt ref in sessionStorage so the dashboard can show Resume
    setShowLeaveConfirm(false);
    onBack();
  }

  function handleFinish() {
    clearAttemptRef();
    onFinish(answers, quiz, tabSwitchCount.current);
  }

  // ── Derived display values ─────────────────────────────────────────────────
  const timeLabel = `${String(Math.floor(secondsLeft / 60)).padStart(2, "0")}:${String(secondsLeft % 60).padStart(2, "0")}`;

  // For practice: derive correct/incorrect classes from server feedback
  function optionClass(index) {
    if (selectedAnswer === index && (quiz.isMock || currentFeedback === null)) return " selected";
    if (!quiz.isMock && currentFeedback !== null) {
      if (index === currentFeedback.correctIndex) return " correct";
      if (index === selectedAnswer)               return " incorrect";
    }
    return "";
  }

  return (
    <>
      <OfflineBanner />

      {/* Quiz top bar */}
      <div className="quiz-topbar">
        <div className="container quiz-topbar-inner">
          <span>
            {t(quiz.course)} · {t(quiz.isMock ? "Mock exam" : quiz.isRemedial ? "Remedial practice" : "Practice mode")}
          </span>
          <button type="button" onClick={() => setShowLeaveConfirm(true)}>
            {t("Leave exam")}
          </button>
        </div>
      </div>

      {/* In-page leave confirmation */}
      {showLeaveConfirm && (
        <div className="quiz-leave-overlay" role="dialog" aria-modal="true" aria-labelledby="leave-dialog-title">
          <div className="quiz-leave-panel">
            <h2 id="leave-dialog-title">{t("Leave this exam?")}</h2>
            <p>{t("Your progress will be saved. You can resume from the dashboard.")}</p>
            <div className="quiz-leave-actions">
              <button className="button"         type="button" onClick={handleLeaveConfirm}>{t("Confirm leave")}</button>
              <button className="button outline"  type="button" onClick={() => setShowLeaveConfirm(false)}>{t("Cancel")}</button>
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
            <span className="question-count">
              {t("Question {current} of {total}", { current: questionIndex + 1, total: quiz.questions.length })}
            </span>
            <span className={`quiz-mode${quiz.isMock && secondsLeft < 60 ? " time-warning" : ""}`}
              role={quiz.isMock ? "timer" : undefined}>
              {quiz.isMock
                ? t("Time remaining · {time}", { time: timeLabel })
                : t(quiz.isRemedial ? "Remedial practice" : "Practice mode · no timer")}
            </span>
          </div>

          <h2>{t(currentQuestion.question)}</h2>

          <div className="answer-list">
            {currentQuestion.options.map((option, index) => (
              <button
                type="button"
                className={`answer-option${optionClass(index)}`}
                key={`${currentQuestion.id}-${index}`}
                disabled={!quiz.isMock && selectedAnswer !== null}
                aria-pressed={selectedAnswer === index}
                onClick={() => chooseAnswer(index)}
              >
                <b>{String.fromCharCode(65 + index)}</b>{t(option)}
              </button>
            ))}
          </div>

          {/* Practice feedback — only after server responds */}
          {selectedAnswer !== null && !quiz.isMock && currentFeedback && (
            <div className="explanation" role="status">
              <strong>
                {t(currentFeedback.isCorrect ? "Correct." : "Not quite.")}
              </strong>{" "}
              {currentFeedback.explanation && t(currentFeedback.explanation)}
            </div>
          )}

          <div className="quiz-controls">
            <button className="button outline" type="button" disabled={questionIndex === 0}
              onClick={() => setQuestionIndex(questionIndex - 1)}>
              {t("Previous")}
            </button>
            <button className="button outline" type="button"
              aria-pressed={flagged[questionIndex]} onClick={toggleFlag}>
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

          {quiz.isMock && (
            <button className="text-button submit-link" type="button" onClick={handleFinish}>
              {t("Finish mock exam")}
            </button>
          )}

          <section className="question-report">
            {reportSent ? (
              <p role="status">{t("Thank you. Your report was sent to the instructor for this course.")}</p>
            ) : (
              <>
                <button className="text-button" type="button" onClick={() => setIsReportOpen((o) => !o)}>
                  {t("Report a mistake")}
                </button>
                {isReportOpen && (
                  <form onSubmit={handleReportSubmit}>
                    <label htmlFor="question-report-message">{t("Describe the possible mistake")}</label>
                    <textarea id="question-report-message" rows="3" maxLength="500"
                      value={reportMessage} onChange={(e) => setReportMessage(e.target.value)} required />
                    <button className="button button-small" type="submit" disabled={!reportMessage.trim() || reportBusy}>
                      {t("Send report")}
                    </button>
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
          <p className="muted">
            {t("{count} answered", { count: answers.filter((a) => a !== null).length })}
          </p>
        </aside>
      </main>

      {/* Tab-switch toast */}
      {toastMsg && (
        <div className="toast" role="alert" aria-live="assertive">{toastMsg}</div>
      )}
    </>
  );
}
