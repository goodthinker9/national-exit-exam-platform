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
      <p className="eyebrow">{t(level === "Remedial" ? "YOUR STREAM" : "YOUR DEPARTMENT")}</p>
      <div className="chips" aria-label={t("Choose a group")}>
        {Object.keys(groups).map((group) => (
          <button
            className={`chip ${group === selectedGroup ? "selected" : ""}`}
            key={group}
            onClick={() => setSelectedGroup(group)}
          >
            {t(group)}
          </button>
        ))}
      </div>
      <div className="course-grid">
        {groups[selectedGroup].map((course) => (
          <article className="course-card" key={course}>
            <h3>{t(course)}</h3>
            <p className="muted">{t("Practice questions and mock exam")}</p>
            <div className="course-actions">
              <button className="button button-small" onClick={() => onChooseCourse(course, false)}>
                {t("Practice")}
              </button>
              <button className="button button-small outline" onClick={() => onChooseCourse(course, true)}>
                {t("Mock exam")}
              </button>
            </div>
            <button className="save-link" onClick={() => onToggleSaved(course)}>
              {t(savedCourses.includes(course) ? "✓ Saved offline" : "↓ Save offline")}
            </button>
          </article>
        ))}
      </div>
    </section>
  );
}
