import { useMemo, useState } from "react";
import { courseGroups, exitExamTree } from "../../data/courseGroups.js";
import { useLanguage } from "../../i18n/LanguageContext.jsx";
import DepartmentGrid from "./DepartmentGrid.jsx";
import "./HomePage.css";
import "./DepartmentDirectoryPage.css";

export default function DepartmentDirectoryPage({ onStart, onBack }) {
  const { t } = useLanguage();
  const [query, setQuery] = useState("");
  const [activeExamType, setActiveExamType] = useState("Exit exam");
  const departments = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase();
    return exitExamTree.filter((node) =>
      node.type === "department"
      && node.name.toLocaleLowerCase().includes(normalizedQuery),
    );
  }, [query]);
  const remedialStreams = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase();
    return Object.entries(courseGroups.Remedial)
      .map(([stream, subjects]) => {
        const streamMatches = stream.toLocaleLowerCase().includes(normalizedQuery);
        return {
          stream,
          subjects: !normalizedQuery || streamMatches
            ? subjects
            : subjects.filter((subject) => subject.toLocaleLowerCase().includes(normalizedQuery)),
        };
      })
      .filter(({ stream, subjects }) =>
        subjects.length > 0
        || stream.toLocaleLowerCase().includes(normalizedQuery),
      );
  }, [query]);
  const remedialSubjectCount = Object.values(courseGroups.Remedial)
    .reduce((total, subjects) => total + subjects.length, 0);

  return (
    <main className="department-directory">
      <div className="department-directory-inner">
        <button type="button" className="department-directory-back" onClick={onBack}>
          <span aria-hidden="true">←</span> {t("Back to home")}
        </button>
        <div className="department-directory-heading">
          <div>
            <p className="landing-section-eyebrow">{t("EXPLORE COURSES")}</p>
            <h1>{t("Find Your Study Program")}</h1>
            <p>{t("Choose the program that matches your exam: Remedial or Exit exam.")}</p>
          </div>
          <label className="landing-department-search">
            <span aria-hidden="true">⌕</span>
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t(activeExamType === "Remedial"
                ? "Search streams or subjects..."
                : "Search for a department, e.g. Engineering...")}
              aria-label={t(activeExamType === "Remedial" ? "Search remedial streams or subjects" : "Search for a department")}
            />
          </label>
        </div>
        <div className="department-directory-tabs" role="group" aria-label={t("Choose an exam program")}>
          {[
            ["Remedial", t("{count} subjects", { count: remedialSubjectCount })],
            ["Exit exam", t("{count} departments", { count: exitExamTree.filter((node) => node.type === "department").length })],
          ].map(([examType, count]) => (
            <button
              type="button"
              className={`department-directory-tab${activeExamType === examType ? " active" : ""}`}
              key={examType}
              aria-pressed={activeExamType === examType}
              onClick={() => setActiveExamType(examType)}
            >
              <span>{t(examType)}</span>
              <small>{count}</small>
            </button>
          ))}
        </div>
        <p className="department-directory-count" role="status">
          {activeExamType === "Remedial"
            ? t("{count} streams", { count: remedialStreams.length })
            : t("{count} departments", { count: departments.length })}
        </p>
        {activeExamType === "Exit exam" && departments.length > 0 ? (
          <DepartmentGrid departments={departments} onStart={onStart} />
        ) : activeExamType === "Remedial" && remedialStreams.length > 0 ? (
          <div className="remedial-stream-grid">
            {remedialStreams.map(({ stream, subjects }) => (
              <article className="remedial-stream-card" key={stream}>
                <span className="remedial-stream-icon" aria-hidden="true">{stream === "Natural Science" ? "⚛" : "▥"}</span>
                <h2>{t(stream)}</h2>
                <p>{t("Remedial subjects to help you build strong foundations.")}</p>
                <ul>
                  {subjects.map((subject) => <li key={subject}>{t(subject)}</li>)}
                </ul>
              </article>
            ))}
          </div>
        ) : (
          <p className="landing-no-departments" role="status">
            {t(activeExamType === "Remedial"
              ? "No remedial streams or subjects match your search."
              : "No departments match your search.")}
          </p>
        )}
        <p className="landing-department-disclaimer">
          {t("Sample department names for this demo; replace with verified listings.")}
        </p>
      </div>
    </main>
  );
}
