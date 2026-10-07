import { useState } from "react";
import CoursePicker from "./CoursePicker.jsx";
import ProgressPanel from "./ProgressPanel.jsx";
import { useLanguage } from "../../i18n/LanguageContext.jsx";
import "./Dashboard.css";

export default function Dashboard({
  user,
  level,
  onLogout,
  onStartQuiz,
  savedCourses,
  onToggleSaved,
  history,
}) {
  const { t } = useLanguage();
  const [tab, setTab] = useState("courses");

  return (
    <>
      <div className="welcome-bar">
        <div className="container welcome-inner">
          <span>{t("Welcome, {name} · {level}", { name: user.name, level: t(level) })}</span>
          <button onClick={onLogout}>{t("Log out")}</button>
        </div>
      </div>
      <main className="container dashboard">
        <div className="dashboard-heading">
          <div>
            <p className="eyebrow">{t("YOUR STUDY SPACE")}</p>
            <h1>{tab === "courses" ? t("Keep learning") : t("Your progress")}</h1>
            <p className="muted">
              {tab === "courses"
                ? t("Choose a course to begin practicing. Mock exams are timed for 10 minutes.")
                : t("A little practice every day helps build confidence.")}
            </p>
          </div>
          <div className="goal-card"><strong>{t("7 / 10")}</strong><span>{t("daily question goal")}</span></div>
        </div>
        <div className="dashboard-tabs" role="tablist" aria-label={t("Dashboard sections")}>
          <button className={tab === "courses" ? "active" : ""} onClick={() => setTab("courses")}>{t("Courses")}</button>
          <button className={tab === "progress" ? "active" : ""} onClick={() => setTab("progress")}>{t("Progress")}</button>
        </div>
        {tab === "courses" ? (
          <CoursePicker
            level={level}
            onChooseCourse={onStartQuiz}
            savedCourses={savedCourses}
            onToggleSaved={onToggleSaved}
          />
        ) : (
          <ProgressPanel history={history} />
        )}
      </main>
    </>
  );
}
