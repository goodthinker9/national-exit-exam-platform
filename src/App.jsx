import { useEffect, useState } from "react";
import { Routes, Route, Navigate, useNavigate, useLocation } from "react-router-dom";
import Header from "./components/layout/Header.jsx";
import Footer from "./components/layout/Footer.jsx";
import AuthPage from "./components/pages/AuthPage.jsx";
import Dashboard from "./components/dashboard/Dashboard.jsx";
import HomePage from "./components/pages/HomePage.jsx";
import DepartmentDirectoryPage from "./components/pages/DepartmentDirectoryPage.jsx";
import SelectionPage from "./components/pages/SelectionPage.jsx";
import QuizPage from "./components/pages/QuizPage.jsx";
import RemedialPage from "./components/pages/RemedialPage.jsx";
import ResultPage from "./components/pages/ResultPage.jsx";
import AnalyticsPage from "./components/pages/AnalyticsPage.jsx";
import AdminDashboard from "./components/pages/AdminDashboard.jsx";
import AdminQuestionsPage from "./components/pages/AdminQuestionsPage.jsx";
import InstructorDashboard from "./components/pages/InstructorDashboard.jsx";
import { questions } from "./data/questions.js";
import { LanguageProvider, useLanguage } from "./i18n/LanguageContext.jsx";
import { isSupabaseConfigured, supabase } from "./lib/supabase.js";
import { CourseTreeStatus } from "./lib/CourseTreeContext.jsx";
import "./App.css";

export default function App() {
  return (
    <LanguageProvider>
      <AppContent />
    </LanguageProvider>
  );
}

// ── Protected Route ─────────────────────────────────────────────────────────
function ProtectedRoute({ user, requiredRole, children }) {
  const location = useLocation();

  if (!user) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  }

  // Role checks
  const role = user.role?.toLowerCase();

  if (requiredRole) {
    if (Array.isArray(requiredRole)) {
      if (!requiredRole.includes(role)) {
        // redirect to their own dashboard
        return <Navigate to={roleDashboard(role)} replace />;
      }
    } else if (role !== requiredRole) {
      return <Navigate to={roleDashboard(role)} replace />;
    }
  }

  return children;
}

function roleDashboard(role) {
  if (role === "admin") return "/staff/admin";
  if (role === "instructor") return "/staff/instructor";
  if (role === "coordinator") return "/staff/coordinator";
  return "/app";
}

async function loadProfile(authUser) {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name, email, role, status")
    .eq("id", authUser.id)
    .single();

  if (error) {
    throw new Error(`Unable to load your profile: ${error.message}`);
  }

  return {
    id: data.id,
    name: data.full_name || data.email,
    email: data.email,
    role: data.role,
    status: data.status === "active" ? "Active" : "Inactive",
    scope: data.role === "admin" ? "All platform" : "Unassigned",
    assignedCourseIds: [],
    lastActiveAt: new Date().toISOString(),
  };
}

// ── Not Found page ───────────────────────────────────────────────────────────
function NotFoundPage() {
  const navigate = useNavigate();
  return (
    <main style={{ textAlign: "center", padding: "80px 24px" }}>
      <h1 style={{ fontSize: "2rem" }}>Page not found</h1>
      <p style={{ color: "var(--muted)", marginBottom: "24px" }}>
        The page you are looking for does not exist.
      </p>
      <button className="button" type="button" onClick={() => navigate("/")}>
        Go home
      </button>
    </main>
  );
}

// ── Scroll to top on navigation ──────────────────────────────────────────────
function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => { window.scrollTo(0, 0); }, [pathname]);
  return null;
}

// ── Main app content ─────────────────────────────────────────────────────────
function AppContent() {
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useLanguage();

  const [user, setUser] = useState(null);
  const [authReady, setAuthReady] = useState(!isSupabaseConfigured);
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

  useEffect(() => {
    if (!supabase) return undefined;

    let active = true;
    let requestId = 0;

    async function applySession(session) {
      const currentRequest = ++requestId;
      if (!session) {
        if (active) {
          setUser(null);
          setAuthReady(true);
        }
        return;
      }

      setAuthReady(false);
      try {
        const profile = await loadProfile(session.user);
        if (!active || currentRequest !== requestId) return;
        if (profile.status !== "Active") {
          await supabase.auth.signOut();
          setUser(null);
          setNotice("This account is inactive. Contact an administrator for support.");
        } else {
          setUser(profile);
        }
      } catch (error) {
        if (!active || currentRequest !== requestId) return;
        setUser(null);
        setNotice(error instanceof Error ? error.message : "Unable to restore your Supabase session.");
      } finally {
        if (active && currentRequest === requestId) setAuthReady(true);
      }
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      window.setTimeout(() => {
        if (active) void applySession(session);
      }, 0);
    });

    supabase.auth.getSession()
      .then(({ data, error }) => {
        if (error) throw error;
        return applySession(data.session);
      })
      .catch((error) => {
        if (!active) return;
        setUser(null);
        setAuthReady(true);
        setNotice(error instanceof Error ? error.message : "Unable to restore your Supabase session.");
      });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  // Current view derived from location for header
  const pathname = location.pathname;
  const view = pathname === "/" ? "home"
    : pathname === "/departments" ? "departments"
    : pathname === "/login" ? "auth"
    : pathname.startsWith("/app") ? "app"
    : pathname.startsWith("/staff") ? "staff"
    : "other";

  function showNotice(msg, ms = 3000) {
    setNotice(msg);
    window.setTimeout(() => setNotice(""), ms);
  }

  function register() {
    setOpenRegistration(true);
    navigate("/login");
  }

  async function login(account) {
    if (!supabase) {
      throw new Error("Supabase is not configured. Add the project URL and anon key to .env.");
    }

    let session;
    if (account.isRegistering) {
      const { data, error } = await supabase.auth.signUp({
        email: account.email,
        password: account.password,
        options: { data: { full_name: account.fullName } },
      });
      if (error) throw error;
      if (!data.session) return { needsConfirmation: true };
      session = data.session;
    } else {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: account.email,
        password: account.password,
      });
      if (error) throw error;
      session = data.session;
    }

    const loggedInAccount = await loadProfile(session.user);
    if (loggedInAccount.status !== "Active") {
      await supabase.auth.signOut();
      throw new Error("This account is inactive. Contact an administrator for support.");
    }

    setUser(loggedInAccount);
    setAdminUsers((current) => {
      const existingAccount = current.find((item) => item.id === loggedInAccount.id);
      if (!existingAccount) return [loggedInAccount, ...current];
      return current.map((item) =>
        item.id === existingAccount.id ? { ...item, ...loggedInAccount } : item,
      );
    });
    setLevel("Exit exam");

    const role = loggedInAccount.role;
    const requestedCourse = pendingHomeCourse;
    setPendingHomeCourse(null);

    // Determine destination
    const dest = roleDashboard(role);

    if (!["admin", "instructor", "coordinator"].includes(role) && requestedCourse) {
      const mixedQuestions = [...questionBank].sort(() => Math.random() - 0.5);
      if (mixedQuestions.length === 0) {
        showNotice(t("No questions are available in the question bank."), 2500);
        navigate("/app");
        return;
      }
      setQuiz({
        id: Date.now(),
        course: requestedCourse.course,
        isMock: requestedCourse.isMock || false,
        scope: requestedCourse.scope || null,
        mockDurationMinutes: adminSettings.mockMinutes,
        questions: mixedQuestions,
      });
      setResult(null);
      navigate("/app/quiz");
      return;
    }
    navigate(dest);
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
        showNotice(t("You have reached the mock exam attempt limit for this course."));
        return;
      }
    }
    if (!questionBank.length) {
      showNotice(t("No questions are available in the question bank."), 2500);
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
    navigate("/app/quiz");
  }

  function handleResumeExam(draft) {
    // Reconstruct quiz from draft
    const ids = new Set(draft.questionIds || []);
    const orderedQuestions = draft.questionIds
      ? draft.questionIds
          .map((id) => questionBank.find((q) => String(q.id) === String(id)))
          .filter(Boolean)
      : questionBank.filter((q) => ids.has(String(q.id)));

    if (!orderedQuestions.length) {
      try { sessionStorage.removeItem("wep_exam_draft"); } catch { /* ignore */ }
      showNotice(t("Could not restore exam: question data is no longer available."), 3000);
      return;
    }
    setQuiz({
      id: Date.now(),
      course: draft.course,
      isMock: draft.isMock,
      isRemedial: draft.isRemedial,
      scope: draft.scope,
      mockDurationMinutes: draft.mockDurationMinutes || adminSettings.mockMinutes,
      questions: orderedQuestions,
      // Pass resume state via quiz object so QuizPage can initialize from it
      resumeAnswers: draft.answers,
      resumeFlags: draft.flags,
      resumeIndex: draft.currentIndex,
      resumeSecondsLeft: draft.secondsLeft,
      resumeTabSwitches: draft.tabSwitches || 0,
    });
    setResult(null);
    navigate("/app/quiz");
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
    navigate("/app/quiz");
  }

  function finishQuiz(answers, currentQuiz, tabSwitches = 0) {
    const correct = answers.filter(
      (answer, index) => answer === currentQuiz.questions[index].answer,
    ).length;
    setResult({
      course: currentQuiz.course,
      questions: currentQuiz.questions,
      answers,
      correct,
      total: currentQuiz.questions.length,
      isMock: currentQuiz.isMock,
      tabSwitches,
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
        tabSwitches,
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
    navigate("/app/result");
  }

  function reportQuestion(report) {
    setStudentReports((reports) => [{
      id: `report-${Date.now()}`,
      ...report,
      status: "Open",
      createdAt: new Date().toISOString(),
    }, ...reports]);
    showNotice(t("Mistake report sent to the course instructor."));
  }

  function handleUpdateReport(id, status, reason) {
    setStudentReports((reports) =>
      reports.map((r) =>
        r.id === id ? { ...r, status, resolvedBy: user?.name, reason: reason || "" } : r,
      ),
    );
    showNotice(t(status === "Resolved" ? "Report marked as resolved." : "Report dismissed."));
  }

  function toggleSavedCourse(course) {
    const isSaved = savedCourses.includes(course);
    setSavedCourses((previous) =>
      isSaved ? previous.filter((saved) => saved !== course) : [...previous, course],
    );
    showNotice(isSaved ? t("Offline course removed.") : t("{course} saved for offline use.", { course: t(course) }), 2500);
  }

  function startFromHome(courseOrName, isMock, scope) {
    const courseName = typeof courseOrName === "string" ? courseOrName : null;
    if (!courseName) {
      navigate("/login");
      return;
    }
    if (!user) {
      setPendingHomeCourse({ course: courseName, isMock: isMock || false, scope: scope || null });
      navigate("/login");
      return;
    }
    startQuiz(courseName, isMock || false, scope || null);
  }

  async function logout() {
    if (supabase) {
      const { error } = await supabase.auth.signOut();
      if (error) {
        showNotice(error.message);
        return;
      }
    }
    setUser(null);
    navigate("/");
  }

  if (!authReady) {
    return (
      <main className="container" aria-live="polite">
        <p>{t("Restoring your Supabase session...")}</p>
      </main>
    );
  }

  // Determine which views show the header / footer
  const isStaffPage = pathname.startsWith("/staff");
  const isQuizPage = pathname === "/app/quiz";
  const showHeader = !isStaffPage && !isQuizPage;
  const showFooter = !isStaffPage && !isQuizPage && pathname !== "/app/result";

  return (
    <div className="app-shell">
      <ScrollToTop />
      {showHeader && (
        <Header onNavigate={(v) => {
          // Legacy navigate name -> path mapping
          const map = { home: "/", auth: "/login", dashboard: "/app", departments: "/departments" };
          navigate(map[v] || "/");
        }} onRegister={register} view={view === "app" ? "dashboard" : view} />
      )}

      {/* Course tree loading / error banner — visible on every page */}
      <CourseTreeStatus />

      <Routes>
        {/* Public routes */}
        <Route
          path="/"
          element={
            <HomePage
              onStart={startFromHome}
              onViewAllDepartments={() => navigate("/departments")}
              savedCourses={savedCourses}
              onToggleSaved={toggleSavedCourse}
            />
          }
        />
        <Route
          path="/departments"
          element={
            <DepartmentDirectoryPage
              onStart={startFromHome}
              onBack={() => navigate("/")}
            />
          }
        />
        <Route
          path="/login"
          element={
            user
              ? <Navigate to={roleDashboard(user.role?.toLowerCase())} replace />
              : <AuthPage
                  onLogin={login}
                  onBack={() => navigate("/")}
                  initialRegister={openRegistration}
                  authConfigured={isSupabaseConfigured}
                />
          }
        />

        {/* Student protected routes */}
        <Route
          path="/app"
          element={
            <ProtectedRoute user={user} requiredRole={["student"]}>
              <Dashboard
                user={user}
                level={level}
                onLogout={logout}
                onBrowseCourses={() => navigate("/app/courses")}
                onViewAnalytics={() => navigate("/app/analytics")}
                history={history}
                announcements={announcements}
                mockMinutes={adminSettings.mockMinutes}
                reports={studentReports}
                onResumeExam={handleResumeExam}
              />
            </ProtectedRoute>
          }
        />
        <Route
          path="/app/courses"
          element={
            <ProtectedRoute user={user} requiredRole={["student"]}>
              <SelectionPage
                level={level}
                savedCourses={savedCourses}
                onToggleSaved={toggleSavedCourse}
                onStartQuiz={startQuiz}
                onBack={() => navigate("/app")}
              />
            </ProtectedRoute>
          }
        />
        <Route
          path="/app/quiz"
          element={
            <ProtectedRoute user={user} requiredRole={["student"]}>
              {quiz ? (
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
                  onBack={() => navigate(quiz.isRemedial ? "/app/remedial" : "/app")}
                />
              ) : <Navigate to="/app" replace />}
            </ProtectedRoute>
          }
        />
        <Route
          path="/app/result"
          element={
            <ProtectedRoute user={user} requiredRole={["student"]}>
              {result ? (
                <ResultPage
                  result={result}
                  onDashboard={() => navigate("/app")}
                  onRemedial={() => navigate("/app/remedial")}
                />
              ) : <Navigate to="/app" replace />}
            </ProtectedRoute>
          }
        />
        <Route
          path="/app/remedial"
          element={
            <ProtectedRoute user={user} requiredRole={["student"]}>
              {result ? (
                <RemedialPage
                  result={result}
                  onStartPractice={startRemedialPractice}
                  onBack={() => navigate("/app/result")}
                  onDashboard={() => navigate("/app")}
                />
              ) : <Navigate to="/app" replace />}
            </ProtectedRoute>
          }
        />
        <Route
          path="/app/analytics"
          element={
            <ProtectedRoute user={user} requiredRole={["student"]}>
              <AnalyticsPage history={history} onBack={() => navigate("/app")} />
            </ProtectedRoute>
          }
        />

        {/* Staff protected routes */}
        <Route
          path="/staff/admin"
          element={
            <ProtectedRoute user={user} requiredRole={["admin"]}>
              <AdminDashboard
                questions={questionBank}
                users={adminUsers}
                onUsersChange={setAdminUsers}
                currentUser={user}
                settings={adminSettings}
                onSettingsChange={setAdminSettings}
                announcements={announcements}
                onAnnouncementsChange={setAnnouncements}
                onLogout={logout}
              />
            </ProtectedRoute>
          }
        />
        <Route
          path="/staff/admin/questions"
          element={
            <ProtectedRoute user={user} requiredRole={["admin"]}>
              <AdminQuestionsPage
                questions={questionBank}
                onSave={saveAdminQuestion}
                onDelete={deleteAdminQuestion}
                onBack={() => navigate("/staff/admin")}
                onLogout={logout}
              />
            </ProtectedRoute>
          }
        />
        <Route
          path="/staff/instructor"
          element={
            <ProtectedRoute user={user} requiredRole={["instructor"]}>
              <InstructorDashboard
                mode="instructor"
                currentUser={user}
                users={adminUsers}
                onLogout={logout}
                drafts={instructorDrafts}
                onDraftsChange={setInstructorDrafts}
                reports={studentReports}
                onReportsChange={setStudentReports}
                onUpdateReport={handleUpdateReport}
                performance={questionPerformance}
                announcements={announcements}
                onAnnouncementsChange={setAnnouncements}
                courseAssignments={courseAssignments}
              />
            </ProtectedRoute>
          }
        />
        <Route
          path="/staff/coordinator"
          element={
            <ProtectedRoute user={user} requiredRole={["coordinator"]}>
              <InstructorDashboard
                mode="coordinator"
                currentUser={user}
                users={adminUsers}
                onLogout={logout}
                drafts={instructorDrafts}
                onDraftsChange={setInstructorDrafts}
                reports={studentReports}
                onReportsChange={setStudentReports}
                onUpdateReport={handleUpdateReport}
                performance={questionPerformance}
                announcements={announcements}
                onAnnouncementsChange={setAnnouncements}
                courseAssignments={courseAssignments}
                onCourseAssignmentsChange={setCourseAssignments}
                publishedQuestions={questionBank}
                onPublishQuestion={publishInstructorQuestion}
              />
            </ProtectedRoute>
          }
        />

        {/* Catch-all */}
        <Route path="*" element={<NotFoundPage />} />
      </Routes>

      {showFooter && (
        <Footer onNavigate={(v) => {
          const map = { home: "/", dashboard: "/app" };
          navigate(map[v] || "/");
        }} onRegister={register} user={user} />
      )}
      {notice && <div className="toast" role="status">{notice}</div>}
    </div>
  );
}
