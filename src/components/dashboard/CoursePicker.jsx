import { useEffect, useMemo, useState } from "react";
import { courseGroups, exitExamCourses, exitExamTree } from "../../data/courseGroups.js";
import { useLanguage } from "../../i18n/LanguageContext.jsx";
import "./CoursePicker.css";

const streams = exitExamTree.filter((node) => node.type === "stream");
const defaultField = exitExamTree.find(
  (node) => node.type === "field" && node.parentId === streams[0].id,
);

export default function CoursePicker({
  level: initialLevel,
  onChooseCourse,
  savedCourses,
  onToggleSaved,
  allowLevelChange = false,
}) {
  const { t } = useLanguage();
  const [activeLevel, setActiveLevel] = useState(initialLevel);
  const [selectedStreamId, setSelectedStreamId] = useState(streams[0].id);
  const [selectedFieldId, setSelectedFieldId] = useState(defaultField?.id ?? null);
  const [selectedDepartmentId, setSelectedDepartmentId] = useState(null);
  const [departmentSearch, setDepartmentSearch] = useState("");

  useEffect(() => {
    setActiveLevel(initialLevel);
  }, [initialLevel]);

  const remedialGroups = courseGroups.Remedial;
  const fields = exitExamTree.filter(
    (node) => node.type === "field" && node.parentId === selectedStreamId,
  );
  const selectedField = exitExamTree.find((node) => node.id === selectedFieldId);
  const fieldChildren = exitExamTree.filter(
    (node) => node.parentId === selectedFieldId,
  );
  const searchResults = useMemo(() => {
    const query = departmentSearch.trim().toLocaleLowerCase();
    return query
      ? exitExamTree.filter(
        (node) => node.type === "department" && node.name.toLocaleLowerCase().includes(query),
      )
      : [];
  }, [departmentSearch]);
  const selectedDepartment = exitExamTree.find(
    (node) => node.id === selectedDepartmentId,
  );
  const departmentCourses = exitExamCourses.filter((course) =>
    course.departmentIds.includes(selectedDepartmentId),
  );
  const groupNames = Object.keys(remedialGroups);
  const [selectedRemedialStream, setSelectedRemedialStream] = useState(groupNames[0]);

  function selectDepartment(department) {
    const parent = exitExamTree.find((node) => node.id === department.parentId);
    const field = parent?.type === "subgroup"
      ? exitExamTree.find((node) => node.id === parent.parentId)
      : parent;
    const stream = exitExamTree.find((node) => node.id === field?.parentId);
    setSelectedStreamId(stream?.id ?? streams[0].id);
    setSelectedFieldId(field?.id ?? null);
    setSelectedDepartmentId(department.id);
    setDepartmentSearch("");
  }

  function renderCourseCards(courses, scope) {
    return (
      <div className="course-grid">
        {courses.map((course) => (
          <article className="course-card" key={course.id ?? course}>
            <div className="course-card-heading">
              <span className="course-icon" aria-hidden="true">{course.name?.slice(0, 1) ?? course.slice(0, 1)}</span>
              <h3>{t(course.name ?? course)}</h3>
            </div>
            {course.departmentIds?.length > 1 && (
              <p className="course-sharing-label">{t("Shared by several departments")}</p>
            )}
            <p className="muted">{t("Practice questions and mock exam")}</p>
            <div className="course-actions">
              <button type="button" className="button button-small" onClick={() => onChooseCourse(course.name ?? course, false, { ...scope, courseId: course.id, courseName: course.name ?? course })}>
                {t("Practice")}
              </button>
              <button type="button" className="button button-small outline" onClick={() => onChooseCourse(course.name ?? course, true, { ...scope, courseId: course.id, courseName: course.name ?? course })}>
                {t("Mock exam")}
              </button>
            </div>
            <button
              type="button"
              className={`save-link${savedCourses.includes(course.name ?? course) ? " is-saved" : ""}`}
              aria-pressed={savedCourses.includes(course.name ?? course)}
              onClick={() => onToggleSaved(course.name ?? course)}
            >
              {t(savedCourses.includes(course.name ?? course) ? "✓ Downloaded for offline use" : "↓ Download for offline use")}
            </button>
          </article>
        ))}
      </div>
    );
  }

  return (
    <section className={`course-picker${allowLevelChange ? " course-picker-home" : ""}`}>
      {allowLevelChange && (
        <div className="course-picker-levels" role="group" aria-label={t("Choose a program")}>
          {["Exit exam", "Remedial"].map((level) => (
            <button
              type="button"
              className={`chip ${level === activeLevel ? "selected" : ""}`}
              key={level}
              aria-pressed={level === activeLevel}
              onClick={() => setActiveLevel(level)}
            >
              {t(level)}
            </button>
          ))}
        </div>
      )}

      {activeLevel === "Remedial" ? (
        <>
          <div className="course-picker-heading">
            <div>
              <p className="eyebrow">{t("YOUR STREAM")}</p>
              <h2>{t("Courses")}</h2>
            </div>
            <div className="chips" role="group" aria-label={t("Choose a stream")}>
              {groupNames.map((group) => (
                <button
                  type="button"
                  className={`chip ${group === selectedRemedialStream ? "selected" : ""}`}
                  key={group}
                  aria-pressed={group === selectedRemedialStream}
                  onClick={() => setSelectedRemedialStream(group)}
                >
                  {t(group)}
                </button>
              ))}
            </div>
          </div>
          {renderCourseCards(remedialGroups[selectedRemedialStream], {
            examType: "Remedial",
            stream: selectedRemedialStream,
          })}
        </>
      ) : (
        <>
          <div className="course-picker-heading">
            <div>
              <p className="eyebrow">{t("EXIT EXAM COURSE FINDER")}</p>
              <h2>{t("Choose your department")}</h2>
            </div>
            <label className="department-search">
              <span className="sr-only">{t("Search your department, e.g. Pharmacy")}</span>
              <input
                type="search"
                value={departmentSearch}
                onChange={(event) => setDepartmentSearch(event.target.value)}
                placeholder={t("Search your department, e.g. Pharmacy")}
                aria-label={t("Search your department, e.g. Pharmacy")}
                aria-controls="department-search-results"
              />
            </label>
          </div>

          {searchResults.length > 0 && (
            <div className="department-search-results" id="department-search-results" role="listbox" aria-label={t("Matching departments")}>
              {searchResults.map((department) => (
                <button
                  type="button"
                  role="option"
                  aria-selected={department.id === selectedDepartmentId}
                  key={department.id}
                  onClick={() => selectDepartment(department)}
                >
                  {t(department.name)}
                </button>
              ))}
            </div>
          )}
          {departmentSearch.trim() && searchResults.length === 0 && (
            <p className="muted department-search-empty">{t("No departments match your search.")}</p>
          )}

          <div className="course-picker-step">
            <p className="course-step-label">{t("Step 1 · Choose a stream")}</p>
            <div className="chips" role="group" aria-label={t("Choose a stream")}>
              {streams.map((stream) => (
                <button
                  type="button"
                  className={`chip ${stream.id === selectedStreamId ? "selected" : ""}`}
                  key={stream.id}
                  aria-pressed={stream.id === selectedStreamId}
                  onClick={() => {
                    const firstField = exitExamTree.find(
                      (node) => node.type === "field" && node.parentId === stream.id,
                    );
                    setSelectedStreamId(stream.id);
                    setSelectedFieldId(firstField?.id ?? null);
                    setSelectedDepartmentId(null);
                  }}
                >
                  {t(stream.name)}
                </button>
              ))}
            </div>
          </div>

          <div className="course-picker-step">
            <p className="course-step-label">{t("Step 2 · Choose a field")}</p>
            <div className="chips" role="group" aria-label={t("Choose a field")}>
              {fields.map((field) => (
                <button
                  type="button"
                  className={`chip ${field.id === selectedFieldId ? "selected" : ""}`}
                  key={field.id}
                  aria-pressed={field.id === selectedFieldId}
                  onClick={() => {
                    setSelectedFieldId(field.id);
                    setSelectedDepartmentId(null);
                  }}
                >
                  {t(field.name)}
                </button>
              ))}
            </div>
          </div>

          <div className="course-picker-step">
            <p className="course-step-label">{t("Step 3 · Choose a department")}</p>
            <div className="department-groups">
              {fieldChildren.filter((node) => node.type === "subgroup").map((subgroup) => (
                <div className="department-group" key={subgroup.id}>
                  <h3>{t(subgroup.name)}</h3>
                  <div className="department-buttons">
                    {exitExamTree.filter((node) => node.type === "department" && node.parentId === subgroup.id)
                      .map((department) => (
                        <DepartmentButton
                          department={department}
                          selected={department.id === selectedDepartmentId}
                          onSelect={selectDepartment}
                          key={department.id}
                          t={t}
                        />
                      ))}
                  </div>
                </div>
              ))}
              {fieldChildren.some((node) => node.type === "department") && (
                <div className="department-buttons">
                  {fieldChildren.filter((node) => node.type === "department").map((department) => (
                    <DepartmentButton
                      department={department}
                      selected={department.id === selectedDepartmentId}
                      onSelect={selectDepartment}
                      key={department.id}
                      t={t}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="course-picker-step selected-department-courses">
            <p className="course-step-label">{t("Step 4 · Courses")}</p>
            {selectedDepartment ? (
              <>
                <h2>{t(selectedDepartment.name)}</h2>
                {departmentCourses.length > 0 ? (
                  renderCourseCards(departmentCourses, {
                    examType: "Exit exam",
                    stream: exitExamTree.find((node) => node.id === selectedField?.parentId)?.name,
                    field: selectedField?.name,
                    department: selectedDepartment.name,
                    departmentId: selectedDepartment.id,
                  })
                ) : (
                  <div className="coming-soon-message" role="status">
                    <strong>{t("Coming soon")}</strong>
                    <p>{t("Courses for this sample department will be added later.")}</p>
                  </div>
                )}
              </>
            ) : (
              <p className="muted department-prompt">{t("Choose a department to see its courses.")}</p>
            )}
          </div>
          <p className="course-data-disclaimer">
            {t("Sample department names and course lists for this demo; replace with verified listings.")}
          </p>
        </>
      )}
    </section>
  );
}

function DepartmentButton({ department, selected, onSelect, t }) {
  const isAvailable = exitExamCourses.some((course) => course.departmentIds.includes(department.id));
  return (
    <button
      type="button"
      className={`department-button${isAvailable ? "" : " department-button-soon"}${selected ? " selected" : ""}`}
      aria-pressed={selected}
      onClick={() => onSelect(department)}
    >
      <span>{t(department.name)}</span>
      {!isAvailable && <span className="department-soon-label">{t("soon")}</span>}
    </button>
  );
}
