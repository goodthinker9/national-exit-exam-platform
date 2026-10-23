import { useEffect, useState } from "react";
import ProgressPanel from "./ProgressPanel.jsx";
import { useLanguage } from "../../i18n/LanguageContext.jsx";
import { Icon } from "../shared/Icons.jsx";
import OfflineBanner from "../shared/OfflineBanner.jsx";
import "./Dashboard.css";

const ATTEMPT_KEY = "wep_attempt_id";

function getInitials(name = "") {
  return name.trim().split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase();
}

function formatSecondsLeft(seconds) {
  if (seconds == null) return null;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export default function Dashboard({
  user,
  level,
  onLogout,
  onBrowseCourses,
  onViewAnalytics,
  history,
  announcements = [],
  mockMinutes = 10,
  reports = [],
  onResumeExam,
  notifications = [],
  onMarkNotificationRead,
  onChangePlan,
  activity,
  weakTopics,
  historyLoading,
  historyError,
  onReloadProgress,
  onPracticeCourse,
}) {
  const { t } = useLanguage();
  const [tab, setTab] = useState("courses");
  const [examDraft, setExamDraft] = useState(null);
  const [bellOpen, setBellOpen] = useState(false);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(ATTEMPT_KEY);
      if (raw) {
        const draft = JSON.parse(raw);
        // draft = { attemptId, courseName, isMock }
        if (draft && draft.attemptId && draft.courseName) {
          setExamDraft(draft);
        }
      }
    } catch { /* ignore */ }
  }, []);

  function discardDraft() {
    try { sessionStorage.removeItem(ATTEMPT_KEY); } catch { /* ignore */ }
    setExamDraft(null);
  }

  function resumeDraft() {
    if (onResumeExam && examDraft) {
      // Keep the ref in sessionStorage — handleResumeExam will clear it on success/fail
      onResumeExam(examDraft);
    }
  }

  const visibleAnnouncements = announcements.filter((item) =>
    item.audience !== "courses"
    || item.courseIds?.some((courseId) => user.assignedCourseIds?.includes(courseId)),
  );

  // My reports: reports submitted by this user
  // The database only returns this student's own reports (row security), and the reporter
  // name is always "A student", so do not filter by name here.
  const myReports = reports;

  return (
    <>
      <OfflineBanner />
      {/* ── Dashboard Navbar ── */}
      <nav className="dash-nav" aria-label={t("Dashboard navigation")}>
        <div className="dash-nav-inner">
          {/* Left – avatar + greeting */}
          <div className="dash-nav-user">
            <span className="dash-nav-avatar" aria-hidden="true">{getInitials(user.name)}</span>
            <div className="dash-nav-greeting">
              <span className="dash-nav-name">{t("Welcome, {name}", { name: user.name })}</span>
              <span className="dash-nav-level">
                {t(level)}
                {(user.studyPlan?.departmentName || user.studyPlan?.streamName)
                  ? ` · ${user.studyPlan.departmentName || t(user.studyPlan.streamName)}`
                  : ""}
              </span>
              {onChangePlan && (
                <button type="button" className="dash-nav-change" onClick={onChangePlan}>
                  {t(user.studyPlan ? "Change program" : "Choose program")}
                </button>
              )}
            </div>
          </div>

          {/* Center – nav links */}
          <div className="dash-nav-links">
            <button
              type="button"
              className={`dash-nav-link${tab === "courses" ? " active" : ""}`}
              onClick={() => setTab("courses")}
            >
              <Icon name="today" size={18} strokeWidth={1.7} />{t("Dashboard")}
            </button>
            <button
              type="button"
              className="dash-nav-link"
              onClick={onBrowseCourses}
            >
              <Icon name="courses" size={18} strokeWidth={1.7} />{t("Courses")}
            </button>
            <button
              type="button"
              className={`dash-nav-link${tab === "progress" ? " active" : ""}`}
              onClick={() => setTab("progress")}
            >
              <Icon name="analytics" size={18} strokeWidth={1.7} />{t("Analytics")}
            </button>
            <button
              type="button"
              className={`dash-nav-link${tab === "myreports" ? " active" : ""}`}
              onClick={() => setTab("myreports")}
            >
              <Icon name="report" size={18} strokeWidth={1.7} />{t("My reports")}
            </button>
          </div>

          {/* Right – bell + logout */}
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            {/* Notification bell */}
            <div style={{ position: "relative" }}>
              <button
                type="button"
                className="dash-nav-link"
                aria-label={t("Notifications")}
                aria-expanded={bellOpen}
                onClick={() => setBellOpen((o) => !o)}
                style={{ position: "relative" }}
              >
                <Icon name="bell" size={18} strokeWidth={1.7} />
                {notifications.length > 0 && (
                  <span style={{
                    position: "absolute", top: "4px", right: "4px",
                    width: "16px", height: "16px", borderRadius: "50%",
                    background: "#dc3545", color: "#fff",
                    fontSize: ".6rem", fontWeight: 800,
                    display: "grid", placeItems: "center",
                  }}>{notifications.length}</span>
                )}
              </button>
              {bellOpen && (
                <div style={{
                  position: "absolute", right: 0, top: "calc(100% + 8px)", zIndex: 50,
                  minWidth: "300px", maxWidth: "340px",
                  background: "#fff", border: "1px solid #dde3ec",
                  borderRadius: "12px", boxShadow: "0 8px 32px rgba(0,0,0,.12)",
                  overflow: "hidden",
                }} role="dialog" aria-label={t("Notifications")}>
                  {notifications.length === 0 ? (
                    <p style={{ padding: "16px", margin: 0, color: "#6b7a8d", fontSize: ".9rem" }}>
                      {t("No new notifications.")}
                    </p>
                  ) : (
                    notifications.map((n) => (
                      <button
                        key={n.id}
                        type="button"
                        style={{
                          display: "flex", flexDirection: "column", gap: "4px",
                          width: "100%", padding: "12px 16px",
                          borderBottom: "1px solid #f0f3f7",
                          background: "transparent", textAlign: "left",
                          cursor: "pointer",
                        }}
                        onClick={() => {
                          onMarkNotificationRead?.(n.id);
                          setBellOpen(false);
                          setTab("myreports");
                        }}
                      >
                        <strong style={{ fontSize: ".85rem", color: "#1a2e44" }}>{n.title}</strong>
                        <small style={{ color: "#6b7a8d", fontSize: ".75rem" }}>
                          {new Intl.DateTimeFormat(undefined, { dateStyle: "short", timeStyle: "short" }).format(new Date(n.created_at))}
                        </small>
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>
            <button className="dash-nav-logout" type="button" onClick={onLogout}>
              <Icon name="logout" size={16} />{t("Log out")}
            </button>
          </div>
        </div>
      </nav>

      <main className="container dashboard">
        {/* Unfinished exam resume card */}
        {examDraft && (
          <div className="resume-card" role="alert">
            <div className="resume-card-info">
              <span className="resume-card-icon" aria-hidden="true">⏸</span>
              <div>
                <strong>{t("Unfinished exam")}</strong>
                <p className="resume-card-detail">
                  {t(examDraft.courseName)} · {t(examDraft.isMock ? "Mock exam" : "Practice mode")}
                </p>
              </div>
            </div>
            <div className="resume-card-actions">
              <button className="button button-small" type="button" onClick={resumeDraft}>
                {t("Resume")}
              </button>
              <button className="button outline button-small" type="button" onClick={discardDraft}>
                {t("Discard")}
              </button>
            </div>
          </div>
        )}

        <div className="dashboard-heading">
          <div>
            <p className="eyebrow">{t("YOUR STUDY SPACE")}</p>
            <h1>
              {tab === "courses" ? t("Keep learning")
                : tab === "myreports" ? t("My reports")
                : t("Your progress")}
            </h1>
            <p className="muted">
              {tab === "courses"
                ? t("Choose a course to begin practicing. Mock exams are timed for {minutes} minutes.", { minutes: mockMinutes })
                : tab === "myreports"
                  ? t("Questions you reported to instructors appear here.")
                  : t("A little practice every day helps build confidence.")}
            </p>
          </div>
          <div className="goal-card">
            <div className="goal-heading">
              <span className="goal-icon" aria-hidden="true">✦</span>
              <span>{t("daily question goal")}</span>
            </div>
            <strong>{t("7 / 10")}</strong>
            <div
              className="goal-progress-track"
              role="progressbar"
              aria-label={t("daily question goal")}
              aria-valuemin={0}
              aria-valuemax={10}
              aria-valuenow={7}
            >
              <span />
            </div>
          </div>
        </div>
        <div className="dashboard-tabs" role="tablist" aria-label={t("Dashboard sections")}>
          <button
            type="button"
            className={tab === "courses" ? "active" : ""}
            aria-selected={tab === "courses"}
            role="tab"
            onClick={() => setTab("courses")}
          >
            {t("Courses")}
          </button>
          <button
            type="button"
            className={tab === "progress" ? "active" : ""}
            aria-selected={tab === "progress"}
            role="tab"
            onClick={() => setTab("progress")}
          >
            {t("Progress")}
          </button>
          <button
            type="button"
            className={tab === "myreports" ? "active" : ""}
            aria-selected={tab === "myreports"}
            role="tab"
            onClick={() => setTab("myreports")}
          >
            {t("My reports")} {myReports.length > 0 && <span className="report-badge">{myReports.length}</span>}
          </button>
        </div>
        {visibleAnnouncements.length > 0 && (
          <section className="student-announcements" aria-label={t("Announcements")}>
            <h2>{t("Announcements")}</h2>
            {visibleAnnouncements.map((item) => (
              <article key={item.id}>
                <p>{item.message}</p>
                <small>{item.author} · {new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(item.at))}</small>
              </article>
            ))}
          </section>
        )}
        {tab === "courses" && (
          <section className="dashboard-course-hub">
            <div className="dashboard-course-mark" aria-hidden="true">✦</div>
            <div className="dashboard-course-copy">
              <p className="eyebrow">{t("YOUR STUDY SPACE")}</p>
              <h2>{t("Choose your subject")}</h2>
              <p className="muted">{t("Find practice material for your program and department.")}</p>
              <button className="button" type="button" onClick={onBrowseCourses}>
                {t("Choose your subject")} <span aria-hidden="true">→</span>
              </button>
            </div>
            <div className="dashboard-course-preview" aria-hidden="true">
              <span>✦</span>
              <span>◷</span>
              <span>▦</span>
            </div>
          </section>
        )}
        {tab === "progress" && (
          <ProgressPanel
            history={history}
            onViewAnalytics={onViewAnalytics}
            activity={activity}
            weakTopics={weakTopics}
            historyLoading={historyLoading}
            historyError={historyError}
            onReloadProgress={onReloadProgress}
            onPracticeCourse={onPracticeCourse}
          />
        )}
        {tab === "myreports" && (
          <section className="my-reports-list" aria-label={t("My reports")}>
            {myReports.length === 0 ? (
              <p className="muted">{t("You have not submitted any reports yet.")}</p>
            ) : (
              myReports.map((r) => (
                <article key={r.id} className="my-report-item">
                  <div className="my-report-meta">
                    <strong>{t(r.course)}</strong>
                    <span className={`report-status-chip status-${(r.status || "Open").toLowerCase().replace(" ", "-")}`}>
                      {t(r.status === "Open" ? "Sent" : r.status)}
                    </span>
                  </div>
                  <p className="my-report-question">{r.questionText?.slice(0, 100)}{r.questionText?.length > 100 ? "…" : ""}</p>
                  {r.reason && (
                    <p className="my-report-reason">
                      <em>{t("Instructor note:")} {r.reason}</em>
                    </p>
                  )}
                </article>
              ))
            )}
          </section>
        )}
      </main>
    </>
  );
}
