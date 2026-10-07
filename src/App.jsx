import { useState } from "react";
import Header from "./components/layout/Header.jsx";
import Footer from "./components/layout/Footer.jsx";
import AuthPage from "./components/pages/AuthPage.jsx";
import Dashboard from "./components/dashboard/Dashboard.jsx";
import HomePage from "./components/pages/HomePage.jsx";
import QuizPage from "./components/pages/QuizPage.jsx";
import ResultPage from "./components/pages/ResultPage.jsx";
import { questions } from "./data/questions.js";
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
  const [notice, setNotice] = useState("");
  const { t } = useLanguage();

  function navigate(nextView) {
    setView(nextView);
    window.scrollTo(0, 0);
  }

  function login(account) {
    setUser({ name: account.name });
    setLevel(account.level);
    navigate("dashboard");
  }

  function startQuiz(course, isMock) {
    const mixedQuestions = [...questions].sort(() => Math.random() - 0.5);
    setQuiz({ course, isMock, questions: mixedQuestions });
    setResult(null);
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
        mode: currentQuiz.isMock ? "Mock exam" : "Practice",
        score: `${correct}/${currentQuiz.questions.length}`,
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
      <Header onNavigate={navigate} view={view} />
      {view === "home" && <HomePage onStart={() => navigate("auth")} />}
      {view === "auth" && (
        <AuthPage onLogin={login} onBack={() => navigate("home")} />
      )}
      {view === "dashboard" && (
        <Dashboard
          user={user}
          level={level}
          onLogout={() => {
            setUser(null);
            navigate("home");
          }}
          onStartQuiz={startQuiz}
          savedCourses={savedCourses}
          onToggleSaved={toggleSavedCourse}
          history={history}
        />
      )}
      {view === "quiz" && quiz && (
        <QuizPage
          quiz={quiz}
          onFinish={finishQuiz}
          onBack={() => navigate("dashboard")}
        />
      )}
      {view === "result" && result && (
        <ResultPage result={result} onDashboard={() => navigate("dashboard")} />
      )}
      {view !== "quiz" && <Footer />}
      {notice && <div className="toast" role="status">{notice}</div>}
    </div>
  );
}
