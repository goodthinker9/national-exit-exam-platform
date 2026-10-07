import { useEffect, useState } from "react";
import { courseGroups } from "../../data/courseGroups.js";
import { useLanguage } from "../../i18n/LanguageContext.jsx";
import "./CoursePicker.css";

export default function CoursePicker({ level, onChooseCourse, savedCourses, onToggleSaved }) {
  const { t } = useLanguage();
  const groups = courseGroups[level];
  const [selectedGroup, setSelectedGroup] = useState(Object.keys(groups)[0]);

  useEffect(() => {
    setSelectedGroup(Object.keys(groups)[0]);
  }, [level, groups]);

  return (
    <section>
      <div className="course-picker-heading">
        <div>
          <p className="eyebrow">{t(level === "Remedial" ? "YOUR STREAM" : "YOUR DEPARTMENT")}</p>
          <h2>{t("Courses")}</h2>
        </div>
        <div className="chips" role="group" aria-label={t("Choose a group")}>
          {Object.keys(groups).map((group) => (
            <button
              type="button"
              className={`chip ${group === selectedGroup ? "selected" : ""}`}
              key={group}
              aria-pressed={group === selectedGroup}
              onClick={() => setSelectedGroup(group)}
            >
              {t(group)}
            </button>
          ))}
        </div>
      </div>
      <div className="course-grid">
        {groups[selectedGroup].map((course) => (
          <article className="course-card" key={course}>
            <div className="course-card-heading">
              <span className="course-icon" aria-hidden="true">{course.slice(0, 1)}</span>
              <h3>{t(course)}</h3>
            </div>
            <p className="muted">{t("Practice questions and mock exam")}</p>
            <div className="course-actions">
              <button type="button" className="button button-small" onClick={() => onChooseCourse(course, false)}>
                {t("Practice")}
              </button>
              <button type="button" className="button button-small outline" onClick={() => onChooseCourse(course, true)}>
                {t("Mock exam")}
              </button>
            </div>
            <button
              type="button"
              className={`save-link${savedCourses.includes(course) ? " is-saved" : ""}`}
              aria-pressed={savedCourses.includes(course)}
              onClick={() => onToggleSaved(course)}
            >
              {t(savedCourses.includes(course) ? "✓ Saved offline" : "↓ Save offline")}
            </button>
          </article>
        ))}
      </div>
    </section>
  );
}
