import { useState } from "react";
import ProgressPanel from "./ProgressPanel.jsx";
import { useLanguage } from "../../i18n/LanguageContext.jsx";
import { Icon } from "../shared/Icons.jsx";
import "./Dashboard.css";

function getInitials(name = "") {
  return name.trim().split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase();
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
}) {
  const { t } = useLanguage();
  const [tab, setTab] = useState("courses");
  const visibleAnnouncements = announcements.filter((item) =>
    item.audience !== "courses"
    || item.courseIds?.some((courseId) => user.assignedCourseIds?.includes(courseId)),
  );

  return (
    <>
      {/* ── Dashboard Navbar ── */}
      <nav className="dash-nav" aria-label={t("Dashboard navigation")}>
        <div className="dash-nav-inner">
          {/* Left – avatar + greeting */}
          <div className="dash-nav-user">
            <span className="dash-nav-avatar" aria-hidden="true">{getInitials(user.name)}</span>
            <div className="dash-nav-greeting">
              <span className="dash-nav-name">{t("Welcome, {name}", { name: user.name })}</span>
              <span className="dash-nav-level">{t(level)}</span>
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
          </div>

          {/* Right – logout */}
          <button className="dash-nav-logout" type="button" onClick={onLogout}>
            <Icon name="logout" size={16} />{t("Log out")}
          </button>
        </div>
      </nav>

      <main className="container dashboard">
        <div className="dashboard-heading">
          <div>
            <p className="eyebrow">{t("YOUR STUDY SPACE")}</p>
            <h1>{tab === "courses" ? t("Keep learning") : t("Your progress")}</h1>
            <p className="muted">
              {tab === "courses"
                ? t("Choose a course to begin practicing. Mock exams are timed for {minutes} minutes.", { minutes: mockMinutes })
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
        {tab === "courses" ? (
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
        ) : (
          <ProgressPanel history={history} onViewAnalytics={onViewAnalytics} />
        )}
      </main>
    </>
  );
}
