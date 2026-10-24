import { useEffect, useRef, useState } from "react";
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

  const visibleAnnouncements = announcements; // server already filtered for this student
  const announcementsRef = useRef(null);
  // Daily goal: the real number of questions answered today (from the database), capped at the goal
  const goalTotal = Math.max(1, activity?.dailyGoal ?? 10);
  const goalDone = Math.min(activity?.todayAnswered ?? 0, goalTotal);
  const roleLabels = { admin: "Administrator", coordinator: "Coordinator", instructor: "Instructor" };

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
          <div className="dash-nav-right">
            {/* Notification bell */}
            <div className="dash-bell-wrap">
              <button
                type="button"
                className="dash-bell-btn"
                aria-label={t(notifications.length > 0 ? "Notifications ({n} unread)" : "Notifications", { n: notifications.length })}
                aria-expanded={bellOpen}
                aria-haspopup="dialog"
                onClick={() => setBellOpen((o) => !o)}
              >
                <Icon name="bell" size={20} strokeWidth={1.7} />
                {notifications.length > 0 && (
                  <span className="dash-bell-badge" aria-hidden="true">
                    {notifications.length > 9 ? "9+" : notifications.length}
                  </span>
                )}
              </button>

              {bellOpen && (
                <>
                  {/* Backdrop to close on outside click */}
                  <div
                    className="dash-bell-backdrop"
                    aria-hidden="true"
                    onClick={() => setBellOpen(false)}
                  />
                  <div
                    className="dash-bell-dropdown"
                    role="dialog"
                    aria-label={t("Notifications")}
                  >
                    <div className="dash-bell-header">
                      <strong>{t("Notifications")}</strong>
                      <button
                        type="button"
                        className="dash-bell-close"
                        aria-label={t("Close notifications")}
                        onClick={() => setBellOpen(false)}
                      >✕</button>
                    </div>
                    {notifications.length === 0 ? (
                      <p className="dash-bell-empty">{t("No new notifications.")}</p>
                    ) : (
                      <ul className="dash-bell-list">
                        {notifications.map((n) => (
                          <li key={n.id}>
                            <button
                              type="button"
                              className="dash-bell-item"
                              onClick={() => {
                                onMarkNotificationRead?.(n.id);
                                setBellOpen(false);
                                if (n.type === "announcement") {
                                  setTab("courses");
                                  setTimeout(() => {
                                    announcementsRef.current?.scrollIntoView({
                                      behavior: "smooth",
                                      block: "start",
                                    });
                                  }, 60);
                                } else {
                                  setTab("myreports");
                                }
                              }}
                            >
                              <span className="dash-bell-item-dot" aria-hidden="true" />
                              <span className="dash-bell-item-body">
                                <strong>{n.title}</strong>
                                <small>{new Intl.DateTimeFormat(undefined, { dateStyle: "short", timeStyle: "short" }).format(new Date(n.created_at))}</small>
                              </span>
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </>
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
            <strong>{goalDone} / {goalTotal}</strong>
            <div
              className="goal-progress-track"
              role="progressbar"
              aria-label={t("daily question goal")}
              aria-valuemin={0}
              aria-valuemax={goalTotal}
              aria-valuenow={goalDone}
            >
              <span style={{ width: `${Math.round((100 * goalDone) / goalTotal)}%` }} />
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
          <section className="student-announcements" ref={announcementsRef} aria-label={t("Announcements")}>
            <h2>{t("Announcements")}</h2>
            {visibleAnnouncements.map((item) => (
              <article key={item.id} style={{ marginBottom: "14px", padding: "14px 16px",
                border: "1px solid #dde3ec", borderRadius: "10px", background: "#fff" }}>
                <strong style={{ display: "block", marginBottom: "6px", color: "#1a2e44" }}>{item.title}</strong>
                <p style={{ margin: "0 0 8px", color: "#3d5166", fontSize: ".9rem", lineHeight: 1.6 }}>{item.body}</p>
                <small style={{ color: "#7a8fa0", fontSize: ".76rem", display: "flex", flexWrap: "wrap", gap: "8px", alignItems: "center" }}>
                  <span>{item.author_name} · {t(roleLabels[item.author_role] ?? "Staff")}</span>
                  <span style={{ padding: "1px 7px", borderRadius: "99px", background: "#e8f0ff", color: "#1675ff", fontSize: ".68rem", fontWeight: 600 }}>
                    {item.target_label}
                  </span>
                  {item.important && (
                    <span style={{ padding: "1px 7px", borderRadius: "99px", background: "#fff0f0", color: "#dc3545", fontSize: ".68rem", fontWeight: 700 }}>
                      ⚡ {t("Important")}
                    </span>
                  )}
                  <span>{new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(new Date(item.created_at))}</span>
                </small>
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
