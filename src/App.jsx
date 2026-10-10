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
import InstructorDashboard from "./components/pages/InstructorDashboard.jsx";
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
  const [adminUsers, setAdminUsers] = useState([]);
  const [adminSettings, setAdminSettings] = useState({ mockMinutes: 10, retakeRule: "One retake" });
  const [announcements, setAnnouncements] = useState([]);
  const [instructorDrafts, setInstructorDrafts] = useState([]);
  const [courseAssignments, setCourseAssignments] = useState({});
  const [studentReports, setStudentReports] = useState([]);
  const [questionPerformance, setQuestionPerformance] = useState({});
  const [level, setLevel] = useState("Remedial");
  const [quiz, setQuiz] = useState(null);
  const [result, setResult] = useState(null);
  const [savedCourses, setSavedCourses] = useState([]);
  const [history, setHistory] = useState([]);
  const [questionBank, setQuestionBank] = useState(questions);
  const [notice, setNotice] = useState("");
  const [openRegistration, setOpenRegistration] = useState(false);
  const [pendingHomeCourse, setPendingHomeCourse] = useState(null);
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
    const registeredAccount = adminUsers.find(
      (item) => item.name.toLocaleLowerCase() === account.name.toLocaleLowerCase(),
    );
    if (registeredAccount && registeredAccount.status !== "Active") {
      setNotice(t("This account is inactive. Contact an administrator for support."));
      window.setTimeout(() => setNotice(""), 3000);
      return;
    }
    const requestedRole = String(account.role || "student").toLocaleLowerCase() === "administrator"
      ? "admin"
      : String(account.role || "student").toLocaleLowerCase();
    const registeredRole = registeredAccount
      ? String(registeredAccount.role).toLocaleLowerCase() === "administrator"
        ? "admin"
        : String(registeredAccount.role).toLocaleLowerCase()
      : null;
    if (registeredAccount && registeredRole !== requestedRole) {
      setNotice(t("The selected sign-in role does not match this account."));
      window.setTimeout(() => setNotice(""), 3000);
      return;
    }
    const userId = registeredAccount?.id
      || account.id
      || `account-${account.name.toLocaleLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
    const loggedInAccount = {
      id: userId,
      name: account.name,
      role: registeredRole || requestedRole,
      scope: registeredAccount?.scope || account.scope || (requestedRole === "admin" ? "All platform" : "Unassigned"),
      assignedCourseIds: registeredAccount?.assignedCourseIds || account.assignedCourseIds || [],
      status: "Active",
      lastActiveAt: new Date().toISOString(),
    };
    setUser(loggedInAccount);
    setAdminUsers((current) => {
      const existingAccount = current.find(
        (item) => item.id === loggedInAccount.id
          || item.name.toLocaleLowerCase() === loggedInAccount.name.toLocaleLowerCase(),
      );
      if (!existingAccount) return [loggedInAccount, ...current];
      return current.map((item) =>
        item.id === existingAccount.id ? { ...item, ...loggedInAccount } : item,
      );
    });
    setLevel(account.level || "Exit exam");
    const requestedCourse = pendingHomeCourse;
    setPendingHomeCourse(null);
    if (!["admin", "instructor", "coordinator"].includes(requestedRole) && requestedCourse) {
      startQuiz(requestedCourse.course, requestedCourse.isMock, requestedCourse.scope);
      return;
    }
    navigate(requestedRole === "admin" || requestedRole === "Administrator"
      ? "admin"
      : requestedRole === "instructor" ? "instructor"
        : requestedRole === "coordinator" ? "coordinator" : "dashboard");
  }

  function startQuiz(course, isMock, scope) {
    if (isMock) {
      const mockAttempts = history.filter(
        (attempt) => attempt.course === course && attempt.mode === "Mock exam",
      ).length;
      const maxAttempts = {
        "No retakes": 1,
        "One retake": 2,
        "Two retakes": 3,
        "Unlimited retakes": Number.POSITIVE_INFINITY,
      }[adminSettings.retakeRule];
      if (mockAttempts >= maxAttempts) {
        setNotice(t("You have reached the mock exam attempt limit for this course."));
        window.setTimeout(() => setNotice(""), 3000);
        return;
      }
    }
    if (!questionBank.length) {
      setNotice(t("No questions are available in the question bank."));
      window.setTimeout(() => setNotice(""), 2500);
      return;
    }
    const mixedQuestions = [...questionBank].sort(() => Math.random() - 0.5);
    setQuiz({
      id: Date.now(),
      course,
      isMock,
      scope,
      mockDurationMinutes: adminSettings.mockMinutes,
      questions: mixedQuestions,
    });
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

  function publishInstructorQuestion(question) {
    setQuestionBank((current) => {
      const nextId = String(
        Math.max(0, ...current.map((item) => Number(item.id) || 0)) + 1,
      ).padStart(3, "0");
      return [{ ...question, id: nextId, status: "Published", publishedAt: new Date().toISOString() }, ...current];
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
    setQuestionPerformance((previous) => {
      const next = { ...previous };
      currentQuiz.questions.forEach((question, index) => {
        if (answers[index] === null) return;
        const questionId = String(question.id || question.question);
        const existing = next[questionId] || {
          questionId,
          questionText: question.question,
          course: currentQuiz.scope?.courseName || currentQuiz.course,
          attempted: 0,
          correct: 0,
        };
        next[questionId] = {
          ...existing,
          attempted: existing.attempted + 1,
          correct: existing.correct + (answers[index] === question.answer ? 1 : 0),
        };
      });
      return next;
    });
    navigate("result");
  }

  function reportQuestion(report) {
    setStudentReports((reports) => [{
      id: `report-${Date.now()}`,
      ...report,
      status: "Open",
      createdAt: new Date().toISOString(),
    }, ...reports]);
    setNotice(t("Mistake report sent to the course instructor."));
    window.setTimeout(() => setNotice(""), 3000);
  }

  function toggleSavedCourse(course) {
    const isSaved = savedCourses.includes(course);
    setSavedCourses((previous) =>
      isSaved ? previous.filter((saved) => saved !== course) : [...previous, course],
    );
    setNotice(isSaved ? t("Offline course removed.") : t("{course} saved for offline use.", { course: t(course) }));
    window.setTimeout(() => setNotice(""), 2500);
  }

  function startFromHome(course, isMock, scope) {
    if (!course) {
      navigate("auth");
      return;
    }
    setPendingHomeCourse({ course, isMock, scope });
    navigate("auth");
  }

  return (
    <div className="app-shell">
      {!["admin", "admin-questions", "instructor", "coordinator"].includes(view) && (
        <Header onNavigate={navigate} onRegister={register} view={view} />
      )}
      {view === "home" && (
        <HomePage
          onStart={startFromHome}
          savedCourses={savedCourses}
          onToggleSaved={toggleSavedCourse}
        />
      )}
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
          announcements={announcements}
          mockMinutes={adminSettings.mockMinutes}
        />
      )}
      {view === "admin" && (
        <AdminDashboard
          questions={questionBank}
          users={adminUsers}
          onUsersChange={setAdminUsers}
          currentUser={user}
          settings={adminSettings}
          onSettingsChange={setAdminSettings}
          announcements={announcements}
          onAnnouncementsChange={setAnnouncements}
          onLogout={() => {
            setUser(null);
            navigate("home");
          }}
        />
      )}
      {view === "instructor" && (
        <InstructorDashboard
          mode="instructor"
          currentUser={user}
          users={adminUsers}
          onLogout={() => {
            setUser(null);
            navigate("home");
          }}
          drafts={instructorDrafts}
          onDraftsChange={setInstructorDrafts}
          reports={studentReports}
          onReportsChange={setStudentReports}
          performance={questionPerformance}
          announcements={announcements}
          onAnnouncementsChange={setAnnouncements}
          courseAssignments={courseAssignments}
        />
      )}
      {view === "coordinator" && (
        <InstructorDashboard
          mode="coordinator"
          currentUser={user}
          users={adminUsers}
          onLogout={() => {
            setUser(null);
            navigate("home");
          }}
          drafts={instructorDrafts}
          onDraftsChange={setInstructorDrafts}
          reports={studentReports}
          onReportsChange={setStudentReports}
          performance={questionPerformance}
          announcements={announcements}
          onAnnouncementsChange={setAnnouncements}
          courseAssignments={courseAssignments}
          onCourseAssignmentsChange={setCourseAssignments}
          publishedQuestions={questionBank}
          onPublishQuestion={publishInstructorQuestion}
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
          key={quiz.id}
          quiz={quiz}
          onFinish={finishQuiz}
          onReport={(question, message) => reportQuestion({
            course: quiz.scope?.courseName || quiz.course,
            courseId: quiz.scope?.courseId || "",
            questionId: question.id,
            questionText: question.question,
            questionOptions: question.options,
            reporterName: user?.name || "Student",
            message,
          })}
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
      {!["quiz", "admin", "admin-questions", "instructor"].includes(view) && (
        <Footer onNavigate={navigate} onRegister={register} />
      )}
      {notice && <div className="toast" role="status">{notice}</div>}
    </div>
  );
}
