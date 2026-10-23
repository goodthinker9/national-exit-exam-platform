import { useCallback, useEffect, useMemo, useState } from "react";
import { Routes, Route, Navigate, useNavigate, useLocation } from "react-router-dom";
import Header from "./components/layout/Header.jsx";
import Footer from "./components/layout/Footer.jsx";
import AuthPage from "./components/pages/AuthPage.jsx";
import Dashboard from "./components/dashboard/Dashboard.jsx";
import HomePage from "./components/pages/HomePage.jsx";
import DepartmentDirectoryPage from "./components/pages/DepartmentDirectoryPage.jsx";
import SelectionPage from "./components/pages/SelectionPage.jsx";
import StudyPlanPage from "./components/pages/StudyPlanPage.jsx";
import QuizPage from "./components/pages/QuizPage.jsx";
import RemedialPage from "./components/pages/RemedialPage.jsx";
import ResultPage from "./components/pages/ResultPage.jsx";
import AnalyticsPage from "./components/pages/AnalyticsPage.jsx";
import AdminDashboard from "./components/pages/AdminDashboard.jsx";
import AdminQuestionsPage from "./components/pages/AdminQuestionsPage.jsx";
import InstructorDashboard from "./components/pages/InstructorDashboard.jsx";
import { questions } from "./data/questions.js";
import { LanguageProvider, useLanguage } from "./i18n/LanguageContext.jsx";
import { isSupabaseConfigured, supabase, getMyStudyPlan, setMyStudyPlan, startAttempt, getAttempt, saveAnswer, submitAttempt, getAttemptReview,
  getMyReports, getReportsForStaff, submitReport, resolveReport,
  getUnreadNotifications, markNotificationRead,
  getStaffQuestions, getCourseAssignments, getInstructors,
  getSettings, adminListUsers,
  getMyHistory, getMyWeakTopics, getMyActivity,
} from "./lib/supabase.js";
import { rowToHistoryItem } from "./lib/progress.js";
import { CourseTreeStatus, useCourseTree } from "./lib/CourseTreeContext.jsx";
import { dbQuestionToUI } from "./lib/staffQuestions.js";
import { dbToUi } from "./lib/retakeMapping.js";
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

  // A student with no program yet picks one first (undefined = could not be loaded: do not block)
  if (role === "student" && user.studyPlan === null && location.pathname !== "/app/plan") {
    return <Navigate to="/app/plan" replace />;
  }

  return children;
}

function levelForPlan(plan) {
  return plan?.exam === "remedial" ? "Remedial" : "Exit exam";
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

  if (error) throw new Error(`Unable to load your profile: ${error.message}`);

  // Load course assignments for instructors / coordinators
  let assignedCourseIds = [];
  if (data.role === "instructor" || data.role === "coordinator") {
    const { data: assignments } = await supabase
      .from("course_assignments")
      .select("course_id")
      .eq("user_id", authUser.id);
    assignedCourseIds = (assignments ?? []).map((a) => a.course_id);
  }

  // Coordinators: which parts of the course tree they manage (coordinator_scopes)
  let scopes = [];
  if (data.role === "coordinator") {
    const { data: scopeRows } = await supabase
      .from("coordinator_scopes")
      .select("node_id, tree_nodes(name, exam)")
      .eq("user_id", authUser.id);
    scopes = (scopeRows ?? [])
      .map((row) => row.tree_nodes)
      .filter(Boolean)
      .map((node) => (node.exam === "remedial" ? `remedial: ${node.name}` : node.name));
  }

  // Students: which program they study (remedial stream or exit department)
  let studyPlan; // undefined = unknown, null = none chosen yet
  if (data.role === "student") {
    try { studyPlan = await getMyStudyPlan(); } catch { studyPlan = undefined; }
  }

  return {
    id: data.id,
    name: data.full_name || data.email,
    email: data.email,
    role: data.role,
    status: data.status === "active" ? "Active" : "Inactive",
    scope: data.role === "admin" ? "All platform" : (scopes.join(", ") || "Unassigned"),
    scopes,
    studyPlan,
    assignedCourseIds,
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
  const { t, language } = useLanguage();
  const { exitExamCourses, remedialCourses } = useCourseTree();

  // -- All useState declarations first (Rules of Hooks) ---------------------
  const [user, setUser] = useState(null);
  const [authReady, setAuthReady] = useState(!isSupabaseConfigured);
  const [adminUsers, setAdminUsers] = useState([]);
  const [adminSettings, setAdminSettings] = useState({ mockMinutes: 10, retakeRule: "One retake" });
  const [myAnnouncements, setMyAnnouncements] = useState([]);
  const [instructorDrafts, setInstructorDrafts] = useState([]);
  const [courseAssignments, setCourseAssignments] = useState({});   // { [uiCourseId]: { authorId, reviewerId } }
  const [staffInstructors, setStaffInstructors] = useState([]);      // [{ id, full_name }]
  const [studentReports, setStudentReports] = useState([]);
  const [notifications, setNotifications]     = useState([]);
  const [questionPerformance, setQuestionPerformance] = useState({});
  const [level, setLevel] = useState("Remedial");
  const [quiz, setQuiz] = useState(null);
  const [result, setResult] = useState(null);
  const [savedCourses, setSavedCourses] = useState([]);
  const [history, setHistory] = useState([]);
  const [activity, setActivity] = useState({ streakDays: 0, todayAnswered: 0, dailyGoal: 10, totalAnswered: 0 });
  const [weakTopics, setWeakTopics] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState(null);
  const [questionBank, setQuestionBank] = useState(questions);
  const [notice, setNotice] = useState("");
  const [openRegistration, setOpenRegistration] = useState(false);
  const [pendingHomeCourse, setPendingHomeCourse] = useState(null);

  // -- Derived from course tree ----------------------------------------------
  const allCoursesFlat = useMemo(
    () => [...exitExamCourses, ...remedialCourses],
    [exitExamCourses, remedialCourses],
  );
  function courseUuidToUiId(uuid) {
    return allCoursesFlat.find((c) => c.dbId === uuid)?.id ?? uuid;
  }
  function courseUuidToName(uuid) {
    return allCoursesFlat.find((c) => c.dbId === uuid)?.name ?? uuid;
  }
  function dbRowToReport(row) {
    const uiId   = courseUuidToUiId(row.course_id);
    const name   = courseUuidToName(row.course_id);
    const status = row.status === "open" ? "Open"
      : row.status === "resolved" ? "Resolved"
      : "Dismissed";
    return {
      id:           row.id,
      courseId:     uiId,
      courseDbId:   row.course_id,   // raw uuid � used by instructor scope filter
      course:       name,
      questionId:   row.question_id,
      questionText: row.questions?.body ?? "",
      message:      row.message,
      status,
      reason:       row.reason ?? "",
      createdAt:    row.created_at,
      reporterName: "A student",
    };
  }

  const loadReports = useCallback(async (role) => {
    if (!supabase) return;
    try {
      const rows = role === "student"
        ? await getMyReports()
        : await getReportsForStaff();
      setStudentReports(rows.map(dbRowToReport));
    } catch { /* ignore */ }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allCoursesFlat]);

  const loadNotifications = useCallback(async () => {
    if (!supabase) return;
    try { setNotifications(await getUnreadNotifications()); }
    catch { /* ignore */ }
  }, []);

  // Load staff questions + assignments + instructors (instructor/coordinator only)
  const loadStaffData = useCallback(async (role, courses) => {
    if (!supabase || !["instructor", "coordinator"].includes(role)) return;
    try {
      const rows = await getStaffQuestions();
      setInstructorDrafts(rows.map((r) => dbQuestionToUI(r, courses)));
    } catch { /* ignore */ }
    try {
      const rows = await getCourseAssignments();
      // Build { [uiCourseId]: { authorId, reviewerId } }
      const map = {};
      for (const row of rows) {
        const course = courses.find((c) => c.dbId === row.course_id);
        const uiId   = course?.id ?? row.course_id;
        if (!map[uiId]) map[uiId] = {};
        if (row.duty === "author")   map[uiId].authorId   = row.user_id;
        if (row.duty === "reviewer") map[uiId].reviewerId = row.user_id;
      }
      setCourseAssignments(map);
    } catch { /* ignore */ }
    if (role === "coordinator") {
      try { setStaffInstructors(await getInstructors()); } catch { /* ignore */ }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Load student progress (history, activity, weak topics) � students only.
  // Uses Promise.allSettled so a partial failure still applies the other data.
  const loadStudentProgress = useCallback(async (currentAllCourses, language) => {
    if (!supabase) return;
    setHistoryLoading(true);
    const [histRes, actRes, weakRes] = await Promise.allSettled([
      getMyHistory(50),
      getMyActivity(),
      getMyWeakTopics(8),
    ]);

    if (histRes.status === "fulfilled") {
      const items = histRes.value.map((row) =>
        rowToHistoryItem(row, { allCourses: currentAllCourses, language }),
      );
      setHistory(items);
      setHistoryError(null);
    } else {
      setHistoryError(histRes.reason?.message ?? "Could not load your history.");
    }

    if (actRes.status === "fulfilled") {
      const a = actRes.value;
      setActivity({
        streakDays:    a.streak_days    ?? 0,
        todayAnswered: a.today_answered ?? 0,
        dailyGoal:     a.daily_goal     ?? 10,
        totalAnswered: a.total_answered ?? 0,
      });
    }

    if (weakRes.status === "fulfilled") {
      setWeakTopics(weakRes.value ?? []);
    }

    setHistoryLoading(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!user) return undefined;
    loadReports(user.role);
    loadNotifications();
    loadStaffData(user.role, allCoursesFlat);
    if (user.role === "student") loadStudentProgress(allCoursesFlat, language);
    const interval = setInterval(() => {
      loadReports(user.role);
      loadNotifications();
      loadStaffData(user.role, allCoursesFlat);
      if (user.role === "student") loadStudentProgress(allCoursesFlat, language);
    }, 60_000);
    function onFocus() {
      loadReports(user.role);
      loadNotifications();
      loadStaffData(user.role, allCoursesFlat);
      if (user.role === "student") loadStudentProgress(allCoursesFlat, language);
    }
    window.addEventListener("focus", onFocus);
    return () => { clearInterval(interval); window.removeEventListener("focus", onFocus); };
  }, [user, loadReports, loadNotifications, loadStaffData, loadStudentProgress, allCoursesFlat, language]);

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

  // Keep the Remedial / Exit level in step with the student's saved program
  useEffect(() => {
    if (user?.studyPlan) setLevel(levelForPlan(user.studyPlan));
  }, [user?.studyPlan]);

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

  async function saveStudyPlan(plan) {
    const saved = await setMyStudyPlan(plan);
    setUser((current) => (current ? { ...current, studyPlan: saved } : current));
    setLevel(levelForPlan(saved));
    navigate("/app");
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
        options: {
          data: {
            full_name: account.fullName,
            ...(account.studyPlan ? {
              exam: account.studyPlan.exam,
              stream_id: account.studyPlan.streamId ?? "",
              department_id: account.studyPlan.departmentId ?? "",
            } : {}),
          },
        },
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
    // Do NOT push the user into adminUsers here � that list is loaded from DB.
    setLevel("Exit exam");

    // Load platform settings for all roles (student dashboard needs mock_minutes)
    try {
      const saved = await getSettings();
      const minutes  = parseInt(saved.mock_minutes  ?? "10", 10);
      const retakeDb = String(saved.retake_limit ?? "");
      setAdminSettings({ mockMinutes: isNaN(minutes) ? 10 : minutes, retakeRule: dbToUi(retakeDb) });
    } catch { /* keep defaults */ }

    const role = loggedInAccount.role;
    const requestedCourse = pendingHomeCourse;
    setPendingHomeCourse(null);

    // Determine destination
    const dest = roleDashboard(role);

    if (!["admin", "instructor", "coordinator"].includes(role) && requestedCourse) {
      // Use server-based startQuiz � requestedCourse.course is the course object with dbId
      await startQuiz(requestedCourse.course, requestedCourse.isMock || false, requestedCourse.scope || null);
      return;
    }
    navigate(dest);
  }

  async function startQuiz(course, isMock, scope) {
    // course must have a dbId (real Supabase uuid) to start a server exam
    if (!course?.dbId) {
      showNotice(
        isMock
          ? t("Course list unavailable. Retry to restore exam access.")
          : t("Course list unavailable. Retry to restore exam access."),
        3000,
      );
      return;
    }

    const mode = isMock ? "mock" : "practice";

    let attemptId;
    try {
      attemptId = await startAttempt({ courseId: course.dbId, mode, questionCount: 20 });
    } catch (err) {
      const msg = err?.message ?? "";
      if (msg.includes("no questions available")) {
        showNotice(t("No questions available for this course yet."), 4000);
      } else if (msg.includes("retake limit reached")) {
        showNotice(t("You have reached the mock exam attempt limit for this course."), 4000);
      } else {
        showNotice(t("Could not start the exam. Please try again."), 3000);
        console.error("[startQuiz]", err);
      }
      return;
    }
    let attemptData;
    try {
      attemptData = await getAttempt(attemptId);
    } catch (err) {
      showNotice(t("Could not load exam questions. Please try again."), 3000);
      console.error("[startQuiz getAttempt]", err);
      return;
    }

    // Map server questions → UI shape
    const questions = (attemptData.questions ?? []).map((sq) => ({
      id:         sq.id,
      question:   sq.text,
      options:    (sq.options ?? []).map((o) => o.text),
      optionIds:  (sq.options ?? []).map((o) => o.id),
      topic:      sq.topic ?? null,
      difficulty: sq.difficulty ?? "medium",
      // answer/explanation deliberately absent — provided by server after answering
      answer:      null,
      explanation: null,
    }));

    // Restore any already-saved answers as index values
    // attemptData.answers = { questionId: optionId }
    const savedAnswers = Array(questions.length).fill(null);
    for (const [qId, optId] of Object.entries(attemptData.answers ?? {})) {
      const qi = questions.findIndex((q) => q.id === qId);
      if (qi === -1) continue;
      const oi = questions[qi].optionIds.indexOf(optId);
      savedAnswers[qi] = oi >= 0 ? oi : null;
    }

    // Compute server-offset timer for mock exams
    let resumeSecondsLeft = null;
    if (isMock && attemptData.ends_at) {
      const serverNow  = new Date(attemptData.server_now).getTime();
      const clientNow  = Date.now();
      const offsetMs   = serverNow - clientNow;   // server is ahead/behind by this much
      const endsAtMs   = new Date(attemptData.ends_at).getTime();
      resumeSecondsLeft = Math.max(0, Math.round((endsAtMs - clientNow - offsetMs) / 1000));
    }

    // Persist only the attempt id in sessionStorage for refresh-resume
    const ATTEMPT_KEY = "wep_attempt_id";
    try { sessionStorage.setItem(ATTEMPT_KEY, JSON.stringify({ attemptId, courseName: course.name, isMock })); }
    catch { /* ignore */ }

    setQuiz({
      id:                   Date.now(),
      attemptId,
      course:               course.name,
      courseDbId:           course.dbId,
      isMock,
      scope,
      mockDurationMinutes:  adminSettings.mockMinutes, // kept for UI display only
      questions,
      resumeAnswers:        savedAnswers,
      resumeFlags:          Array(questions.length).fill(false),
      resumeIndex:          0,
      resumeSecondsLeft,
      resumeTabSwitches:    attemptData.tab_switches ?? 0,
      endsAt:               attemptData.ends_at,
      serverTimeOffset:     new Date(attemptData.server_now).getTime() - Date.now(),
    });
    setResult(null);
    navigate("/app/quiz");
  }

  async function handleResumeExam(draft) {
    // draft = { attemptId, courseName, isMock } stored in sessionStorage
    const { attemptId, courseName, isMock } = draft;
    if (!attemptId) { showNotice(t("Could not restore exam: attempt data missing."), 3000); return; }
    let attemptData;
    try { attemptData = await getAttempt(attemptId); }
    catch (err) {
      showNotice(t("Could not restore exam. The attempt may have expired."), 3000);
      const ATTEMPT_KEY = "wep_attempt_id";
      try { sessionStorage.removeItem(ATTEMPT_KEY); } catch { /* ignore */ }
      return;
    }
    const questions = (attemptData.questions ?? []).map((sq) => ({
      id: sq.id, question: sq.text,
      options: (sq.options ?? []).map((o) => o.text),
      optionIds: (sq.options ?? []).map((o) => o.id),
      topic: sq.topic ?? null, difficulty: sq.difficulty ?? "medium",
      answer: null, explanation: null,
    }));
    const savedAnswers = Array(questions.length).fill(null);
    for (const [qId, optId] of Object.entries(attemptData.answers ?? {})) {
      const qi = questions.findIndex((q) => q.id === qId);
      if (qi === -1) continue;
      const oi = questions[qi].optionIds.indexOf(optId);
      savedAnswers[qi] = oi >= 0 ? oi : null;
    }
    let resumeSecondsLeft = null;
    if (isMock && attemptData.ends_at) {
      const serverNow = new Date(attemptData.server_now).getTime();
      const clientNow = Date.now();
      resumeSecondsLeft = Math.max(0, Math.round((new Date(attemptData.ends_at).getTime() - clientNow - (serverNow - clientNow)) / 1000));
    }
    setQuiz({
      id: Date.now(), attemptId, course: courseName, isMock, scope: null,
      courseDbId: attemptData.course_id,   // needed to file reports after a resume
      mockDurationMinutes: adminSettings.mockMinutes, questions,
      resumeAnswers: savedAnswers, resumeFlags: Array(questions.length).fill(false),
      resumeIndex: 0, resumeSecondsLeft,
      resumeTabSwitches: attemptData.tab_switches ?? 0,
      endsAt: attemptData.ends_at,
      serverTimeOffset: new Date(attemptData.server_now).getTime() - Date.now(),
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
    // Remedial uses the already-loaded quiz questions (missed ones from the practice result)
    const missedQuestions = result.questions.filter(
      (question, index) => result.answers[index] !== question.answer,
    );
    setQuiz({
      id:         Date.now(),
      attemptId:  null,          // no server attempt for remedial
      course:     result.course,
      isMock:     false,
      isRemedial: true,
      questions:  missedQuestions,
      resumeAnswers: Array(missedQuestions.length).fill(null),
      resumeFlags:   Array(missedQuestions.length).fill(false),
      resumeIndex:   0,
    });
    navigate("/app/quiz");
  }

  async function finishQuiz(answers, currentQuiz, tabSwitches = 0) {
    const ATTEMPT_KEY = "wep_attempt_id";
    const attemptId = currentQuiz.attemptId;
    let score, reviewRows;

    if (attemptId) {
      // Mock answers are autosaved fire-and-forget. Before scoring, make sure the server really has
      // every answer shown on screen (idempotent upsert). If any save fails, do NOT submit.
      if (currentQuiz.isMock) {
        try {
          await Promise.all(answers.map((a, qi) => {
            const optionId = a === null ? null : currentQuiz.questions[qi].optionIds?.[a];
            return optionId
              ? saveAnswer({ attemptId, questionId: currentQuiz.questions[qi].id, optionId })
              : null;
          }));
        } catch (err) {
          showNotice(t("Could not save your answers. Check your connection and try again."), 5000);
          console.error("[finishQuiz flush answers]", err);
          return;
        }
      }
      try {
        score = await submitAttempt(attemptId);
      } catch (err) {
        showNotice(t("Could not submit exam. Please try again."), 4000);
        console.error("[finishQuiz submitAttempt]", err);
        return;
      }
      try { sessionStorage.removeItem(ATTEMPT_KEY); } catch { /* ignore */ }
      try {
        reviewRows = await getAttemptReview(attemptId);
      } catch (err) {
        console.warn("[finishQuiz getAttemptReview]", err);
        reviewRows = [];
      }
    }

    // Map review rows back to the question/option index shape ResultPage expects
    const questions = currentQuiz.questions.map((q, qi) => {
      const row = reviewRows?.find((r) => r.question_id === q.id);
      if (!row) return { ...q, answer: answers[qi] };
      const correctIdx = q.optionIds?.indexOf(row.correct_option) ?? -1;
      return {
        ...q,
        answer:      correctIdx >= 0 ? correctIdx : 0,
        explanation: row.explanation ?? "",
      };
    });

    // Re-derive answers array: for questions where server returned correctOption, use saved answers
    // reviewRows has chosen_option; map those back to index
    const serverAnswers = currentQuiz.questions.map((q, qi) => {
      const row = reviewRows?.find((r) => r.question_id === q.id);
      if (!row) return answers[qi];                       // review unavailable: fall back to screen state
      if (row.chosen_option == null) return null;         // the server has no answer: show "Unanswered"
      const idx = q.optionIds?.indexOf(row.chosen_option) ?? -1;
      return idx >= 0 ? idx : null;
    });

    const correct = score?.correct ?? serverAnswers.filter((a, i) => a === questions[i].answer).length;
    const total   = score?.total   ?? currentQuiz.questions.length;

    setResult({
      course:      currentQuiz.course,
      questions,
      answers:     serverAnswers,
      correct,
      total,
      isMock:      currentQuiz.isMock,
      tabSwitches,
    });

    navigate("/app/result");
    // Reload progress in the background � do not block the result page.
    if (user?.role === "student") {
      loadStudentProgress(allCoursesFlat, language).catch(() => {});
    }
  }

  async function reportQuestion(report) {
    // report = { course, courseId(UI slug), questionId(uuid), questionText, questionOptions, reporterName, message }
    // We need the course uuid (courseDbId) from quiz, NOT the slug
    const courseUuid = report.courseDbId ?? allCoursesFlat.find((c) => c.id === report.courseId)?.dbId;
    if (!courseUuid) {
      showNotice(t("Could not submit report: course not found."), 3000);
      return false;
    }
    try {
      await submitReport({
        questionId: report.questionId,
        courseId:   courseUuid,
        message:    report.message,
      });
      showNotice(t("Mistake report sent to the course instructor."));
      await loadReports(user?.role ?? "student");
      return true;
    } catch (err) {
      if (err?.message === "already reported") {
        showNotice(t("You already reported this question."), 3500);
        return true;   // already on file: close the form
      }
      showNotice(t("Could not send report. Please try again."), 3000);
      return false;    // keep the form open so the text is not lost
    }
  }

  async function handleUpdateReport(id, status, reason) {
    const dbStatus = status === "Resolved" ? "resolved" : "dismissed";
    try {
      await resolveReport({ id, status: dbStatus, reason: reason || "" });
      showNotice(t(status === "Resolved" ? "Report marked as resolved." : "Report dismissed."));
      // Reload both sides
      await loadReports(user?.role ?? "instructor");
    } catch (err) {
      showNotice(err?.message ?? t("Could not update report."), 3500);
    }
  }

  async function handleMarkNotificationRead(notifId) {
    try {
      await markNotificationRead(notifId);
      setNotifications((prev) => prev.filter((n) => n.id !== notifId));
    } catch { /* ignore */ }
  }

  async function reloadStaffQuestions() {
    await loadStaffData(user?.role ?? "instructor", allCoursesFlat);
  }

  async function loadAdminUsers() {
    try { setAdminUsers(await adminListUsers()); }
    catch { /* ignore � AdminDashboard shows its own error */ }
  }

  function toggleSavedCourse(course) {
    const isSaved = savedCourses.includes(course);
    setSavedCourses((previous) =>
      isSaved ? previous.filter((saved) => saved !== course) : [...previous, course],
    );
    showNotice(isSaved ? t("Offline course removed.") : t("{course} saved for offline use.", { course: t(course) }), 2500);
  }

  function startFromHome(courseOrName, isMock, scope) {
    // courseOrName may be a string (department/course name) or a course object with dbId
    const courseName = typeof courseOrName === "string" ? courseOrName : courseOrName?.name;
    const courseObj  = typeof courseOrName === "object" ? courseOrName : { name: courseName, dbId: null };
    if (!courseName) { navigate("/login"); return; }
    if (!user) {
      setPendingHomeCourse({ course: courseObj, isMock: isMock || false, scope: scope || null });
      navigate("/login");
      return;
    }
    startQuiz(courseObj, isMock || false, scope || null);
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
    setHistory([]);
    setActivity({ streakDays: 0, todayAnswered: 0, dailyGoal: 10, totalAnswered: 0 });
    setWeakTopics([]);
    setHistoryError(null);
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
                mockMinutes={adminSettings.mockMinutes}
                reports={studentReports}
                onResumeExam={handleResumeExam}
                notifications={notifications}
                onMarkNotificationRead={handleMarkNotificationRead}
                onChangePlan={() => navigate("/app/plan")}
                activity={activity}
                weakTopics={weakTopics}
                historyLoading={historyLoading}
                historyError={historyError}
                onReloadProgress={() => loadStudentProgress(allCoursesFlat, language)}
                onPracticeCourse={(courseId) => {
                  const course = allCoursesFlat.find((c) => c.dbId === courseId);
                  if (course) startQuiz(course, false);
                }}
              />
            </ProtectedRoute>
          }
        />
        <Route
          path="/app/plan"
          element={
            <ProtectedRoute user={user} requiredRole={["student"]}>
              <StudyPlanPage user={user} onSave={saveStudyPlan} onBack={() => navigate("/app")} />
            </ProtectedRoute>
          }
        />
        <Route
          path="/app/courses"
          element={
            <ProtectedRoute user={user} requiredRole={["student"]}>
              <SelectionPage
                level={level}
                studyPlan={user?.studyPlan}
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
                    course:      quiz.course,
                    courseId:    quiz.scope?.courseId   || "",
                    courseDbId:  quiz.courseDbId        || null,  // real uuid for DB insert
                    questionId:  question.id,
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
              <AnalyticsPage
                history={history}
                onBack={() => navigate("/app")}
                weakTopics={weakTopics}
                historyLoading={historyLoading}
                historyError={historyError}
                onReloadProgress={() => loadStudentProgress(allCoursesFlat, language)}
                onPracticeCourse={(courseId) => {
                  const course = allCoursesFlat.find((c) => c.dbId === courseId);
                  if (course) startQuiz(course, false);
                }}
              />
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
                onLoadUsers={loadAdminUsers}
                currentUser={user}
                settings={adminSettings}
                onSettingsChange={setAdminSettings}
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
                onDraftsChange={reloadStaffQuestions}
                reports={studentReports}
                onReportsChange={setStudentReports}
                onUpdateReport={handleUpdateReport}
                performance={questionPerformance}
                courseAssignments={courseAssignments}
                onCourseAssignmentsChange={reloadStaffQuestions}
                staffInstructors={staffInstructors}
                notifications={notifications}
                onMarkNotificationRead={handleMarkNotificationRead}
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
                onDraftsChange={reloadStaffQuestions}
                reports={studentReports}
                onReportsChange={setStudentReports}
                onUpdateReport={handleUpdateReport}
                performance={questionPerformance}
                courseAssignments={courseAssignments}
                onCourseAssignmentsChange={reloadStaffQuestions}
                publishedQuestions={instructorDrafts}
                onPublishQuestion={reloadStaffQuestions}
                staffInstructors={staffInstructors}
                notifications={notifications}
                onMarkNotificationRead={handleMarkNotificationRead}
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
