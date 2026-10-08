import { useState } from "react";
import Header from "./components/layout/Header.jsx";
import Footer from "./components/layout/Footer.jsx";
import AuthPage from "./components/pages/AuthPage.jsx";
import Dashboard from "./components/dashboard/Dashboard.jsx";
import HomePage from "./components/pages/HomePage.jsx";
import SelectionPage from "./components/pages/SelectionPage.jsx";
import QuizPage from "./components/pages/QuizPage.jsx";
import RemedialPage from "./components/pages/RemedialPage.jsx";
import ResultPage from "./components/pages/ResultPage.jsx";
import AnalyticsPage from "./components/pages/AnalyticsPage.jsx";
import AdminDashboard from "./components/pages/AdminDashboard.jsx";
import AdminQuestionsPage from "./components/pages/AdminQuestionsPage.jsx";
import { questions } from "./data/questions.js";
import { getPracticeAnalytics } from "./utils/practiceAnalytics.js";
import { LanguageProvider, useLanguage } from "./i18n/LanguageContext.jsx";
import "./App.css";

export default function App() {
  return (
    <LanguageProvider>
      <AppContent />
    </LanguageProvider>
  );
}

function AppContent() {
  const [view, setView] = useState("home");
  const [user, setUser] = useState(null);
  const [level, setLevel] = useState("Remedial");
  const [quiz, setQuiz] = useState(null);
  const [result, setResult] = useState(null);
  const [savedCourses, setSavedCourses] = useState([]);
  const [history, setHistory] = useState([]);
  const [questionBank, setQuestionBank] = useState(questions);
  const [notice, setNotice] = useState("");
  const [openRegistration, setOpenRegistration] = useState(false);
  const { t } = useLanguage();

  function navigate(nextView) {
    if (nextView !== "auth") setOpenRegistration(false);
    setView(nextView);
    window.scrollTo(0, 0);
  }

  function register() {
    setOpenRegistration(true);
    navigate("auth");
  }

  function login(account) {
    setUser({ name: account.name, role: account.role });
    setLevel(account.level);
    navigate(account.role === "admin" ? "admin" : "dashboard");
  }

  function startQuiz(course, isMock) {
    if (!questionBank.length) {
      setNotice(t("No questions are available in the question bank."));
      window.setTimeout(() => setNotice(""), 2500);
      return;
    }
    const mixedQuestions = [...questionBank].sort(() => Math.random() - 0.5);
    setQuiz({ course, isMock, questions: mixedQuestions });
    setResult(null);
    navigate("quiz");
  }

  function saveAdminQuestion(question) {
    setQuestionBank((current) => {
      if (question.id) {
        return current.map((item) => item.id === question.id ? question : item);
      }
      const nextId = String(
        Math.max(0, ...current.map((item) => Number(item.id) || 0)) + 1,
      ).padStart(3, "0");
      return [{ ...question, id: nextId }, ...current];
    });
  }

  function deleteAdminQuestion(questionId) {
    setQuestionBank((current) => current.filter((question) => question.id !== questionId));
  }

  function startRemedialPractice() {
    const missedQuestions = result.questions.filter(
      (question, index) => result.answers[index] !== question.answer,
    );
    setQuiz({
      course: result.course,
      isMock: false,
      isRemedial: true,
      questions: missedQuestions,
    });
    navigate("quiz");
  }

  function finishQuiz(answers, currentQuiz) {
    const correct = answers.filter(
      (answer, index) => answer === currentQuiz.questions[index].answer,
    ).length;
    setResult({
      course: currentQuiz.course,
      questions: currentQuiz.questions,
      answers,
      correct,
      total: currentQuiz.questions.length,
    });
    setHistory((previous) => [
      {
        course: currentQuiz.course,
        mode: currentQuiz.isMock
          ? "Mock exam"
          : currentQuiz.isRemedial
            ? "Remedial practice"
            : "Practice",
        score: `${correct}/${currentQuiz.questions.length}`,
        correct,
        total: currentQuiz.questions.length,
        answered: answers.filter((answer) => answer !== null).length,
        date: "Just now",
      },
      ...previous,
    ]);
    navigate("result");
  }

  function toggleSavedCourse(course) {
    const isSaved = savedCourses.includes(course);
    setSavedCourses((previous) =>
      isSaved ? previous.filter((saved) => saved !== course) : [...previous, course],
    );
    setNotice(isSaved ? t("Offline course removed.") : t("{course} saved for offline use.", { course: t(course) }));
    window.setTimeout(() => setNotice(""), 2500);
  }

  return (
    <div className="app-shell">
      {!["admin", "admin-questions"].includes(view) && (
        <Header onNavigate={navigate} onRegister={register} view={view} />
      )}
      {view === "home" && <HomePage onStart={() => navigate("auth")} />}
      {view === "auth" && (
        <AuthPage
          onLogin={login}
          onBack={() => navigate("home")}
          initialRegister={openRegistration}
        />
      )}
      {view === "dashboard" && (
        <Dashboard
          user={user}
          level={level}
          onLogout={() => {
            setUser(null);
            navigate("home");
          }}
          onBrowseCourses={() => navigate("selection")}
          onViewAnalytics={() => navigate("analytics")}
          history={history}
        />
      )}
      {view === "admin" && (
        <AdminDashboard
          questions={questionBank}
          onManageQuestions={() => navigate("admin-questions")}
          onComingSoon={() => {
            setNotice(t("This admin section is not available in the demo yet."));
            window.setTimeout(() => setNotice(""), 2500);
          }}
          onLogout={() => {
            setUser(null);
            navigate("home");
          }}
        />
      )}
      {view === "admin-questions" && (
        <AdminQuestionsPage
          questions={questionBank}
          onSave={saveAdminQuestion}
          onDelete={deleteAdminQuestion}
          onBack={() => navigate("admin")}
          onLogout={() => {
            setUser(null);
            navigate("home");
          }}
        />
      )}
      {view === "analytics" && (
        <AnalyticsPage history={history} onBack={() => navigate("dashboard")} />
      )}
      {view === "selection" && (
        <SelectionPage
          level={level}
          savedCourses={savedCourses}
          onToggleSaved={toggleSavedCourse}
          onStartQuiz={startQuiz}
          onBack={() => navigate("dashboard")}
        />
      )}
      {view === "quiz" && quiz && (
        <QuizPage
          quiz={quiz}
          onFinish={finishQuiz}
          onBack={() => navigate(quiz.isRemedial ? "remedial" : "dashboard")}
        />
      )}
      {view === "remedial" && result && (
        <RemedialPage
          result={result}
          onStartPractice={startRemedialPractice}
          onBack={() => navigate("result")}
          onDashboard={() => navigate("dashboard")}
        />
      )}
      {view === "result" && result && (
        <ResultPage
          result={result}
          onDashboard={() => navigate("dashboard")}
          onRemedial={() => navigate("remedial")}
        />
      )}
      {!["quiz", "admin", "admin-questions"].includes(view) && <Footer />}
      {notice && <div className="toast" role="status">{notice}</div>}
    </div>
  );
}
