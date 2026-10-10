import { useEffect, useMemo, useState } from "react";
import { courseGroups, exitExamCourses, exitExamTree } from "../../data/courseGroups.js";
import { useLanguage } from "../../i18n/LanguageContext.jsx";
import "./CoursePicker.css";

const streams = exitExamTree.filter((node) => node.type === "stream");

export default function CoursePicker({
  level: initialLevel,
  onChooseCourse,
  savedCourses,
  onToggleSaved,
  allowLevelChange = false,
}) {
  const { t } = useLanguage();
  const [activeLevel, setActiveLevel] = useState(initialLevel);
  const [selectedStreamId, setSelectedStreamId] = useState(null);
  const [selectedFieldId, setSelectedFieldId] = useState(null);
  const [selectedDepartmentId, setSelectedDepartmentId] = useState(null);
  const [departmentSearch, setDepartmentSearch] = useState("");
  const [exitStep, setExitStep] = useState(1);

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
  const selectedStream = exitExamTree.find((node) => node.id === selectedStreamId);
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
    setSelectedStreamId(stream?.id ?? null);
    setSelectedFieldId(field?.id ?? null);
    setSelectedDepartmentId(department.id);
    setDepartmentSearch("");
    setExitStep(3);
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
          <nav className="exit-stepper" aria-label={t("Exit exam selection steps")}>
            {[
              [1, "Stream"],
              [2, "Field"],
              [3, "Department"],
              [4, "Courses"],
            ].map(([step, label]) => (
              <button
                type="button"
                className={`exit-step${exitStep === step ? " active" : ""}${exitStep > step ? " complete" : ""}`}
                key={step}
                aria-current={exitStep === step ? "step" : undefined}
                disabled={step > exitStep}
                onClick={() => setExitStep(step)}
              >
                <span className="exit-step-marker">{exitStep > step ? "✓" : step}</span>
                <span className="exit-step-label">{t(label)}</span>
              </button>
            ))}
            <span className="exit-step-count">{t("Step {step} of 4", { step: exitStep })}</span>
          </nav>

          <div className="exit-selection-layout">
            <div className="exit-selection-main">
              {exitStep === 1 && (
                <section className="course-picker-step exit-choice-panel">
                  <p className="course-step-label">{t("Step 1 · Choose a stream")}</p>
                  <h2>{t("Select your stream")}</h2>
                  <div className="exit-choice-grid" role="group" aria-label={t("Choose a stream")}>
                    {streams.map((stream) => (
                      <button
                        type="button"
                        className={`exit-choice-card${stream.id === selectedStreamId ? " selected" : ""}`}
                        key={stream.id}
                        aria-pressed={stream.id === selectedStreamId}
                        onClick={() => {
                          setSelectedStreamId(stream.id);
                          setSelectedFieldId(null);
                          setSelectedDepartmentId(null);
                          setExitStep(2);
                        }}
                      >
                        <span className="exit-choice-icon" aria-hidden="true">◉</span>
                        <span><strong>{t(stream.name)}</strong><small>{t("Choose this stream to see its fields.")}</small></span>
                        {stream.id === selectedStreamId && <span className="exit-selected-check" aria-hidden="true">✓</span>}
                      </button>
                    ))}
                  </div>
                </section>
              )}

              {exitStep === 2 && (
                <section className="course-picker-step exit-choice-panel">
                  <p className="course-step-label">{t("Step 2 · Choose a field")}</p>
                  <h2>{t("Select your field")}</h2>
                  <p className="exit-context-line">{t("Stream")}: {t(selectedStream?.name || "")}</p>
                  <div className="exit-choice-grid" role="group" aria-label={t("Choose a field")}>
                    {fields.map((field) => (
                      <button
                        type="button"
                        className={`exit-choice-card${field.id === selectedFieldId ? " selected" : ""}`}
                        key={field.id}
                        aria-pressed={field.id === selectedFieldId}
                        onClick={() => {
                          setSelectedFieldId(field.id);
                          setSelectedDepartmentId(null);
                          setExitStep(3);
                        }}
                      >
                        <span className="exit-choice-icon" aria-hidden="true">⚙</span>
                        <span><strong>{t(field.name)}</strong><small>{t("Choose this field to view its departments.")}</small></span>
                        {field.id === selectedFieldId && <span className="exit-selected-check" aria-hidden="true">✓</span>}
                      </button>
                    ))}
                  </div>
                </section>
              )}

              {exitStep === 3 && (
                <>
                  <div className="course-picker-heading exit-department-heading">
                    <div>
                      <p className="course-step-label">{t("Step 3 · Choose a department")}</p>
                      <h2>{t("Select your department")}</h2>
                    </div>
                    <label className="department-search">
                      <span className="sr-only">{t("Search your department, e.g. Pharmacy")}</span>
                      <span className="department-search-icon" aria-hidden="true">⌕</span>
                      <input
                        type="search"
                        value={departmentSearch}
                        onChange={(event) => setDepartmentSearch(event.target.value)}
                        placeholder={t("Search for a department...")}
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

                  <div className="department-groups exit-department-groups">
                    {fieldChildren.filter((node) => node.type === "subgroup").map((subgroup) => {
                      const departments = exitExamTree.filter(
                        (node) => node.type === "department" && node.parentId === subgroup.id,
                      );
                      const isInformatics = subgroup.id === "informatics";
                      return (
                        <section className="department-group" key={subgroup.id}>
                          <div className="department-group-heading">
                            <span className="department-group-icon" aria-hidden="true">{isInformatics ? "▣" : "⚙"}</span>
                            <div><h3>{isInformatics ? t("Computer Science & IT") : t(subgroup.name)}</h3><p>{isInformatics ? t("Technology · Software · Innovation") : t("Build · Design · Solve")}</p></div>
                          </div>
                          <div className="department-card-grid">
                            {departments.map((department) => (
                              <DepartmentCard
                                department={department}
                                selected={department.id === selectedDepartmentId}
                                onSelect={selectDepartment}
                                key={department.id}
                                t={t}
                              />
                            ))}
                          </div>
                        </section>
                      );
                    })}
                    {fieldChildren.some((node) => node.type === "department") && (
                      <section className="department-group">
                        <div className="department-group-heading">
                          <span className="department-group-icon" aria-hidden="true">▤</span>
                          <div><h3>{t(selectedField?.name || "")}</h3><p>{t("Choose a department in your field.")}</p></div>
                        </div>
                        <div className="department-card-grid">
                          {fieldChildren.filter((node) => node.type === "department").map((department) => (
                            <DepartmentCard
                              department={department}
                              selected={department.id === selectedDepartmentId}
                              onSelect={selectDepartment}
                              key={department.id}
                              t={t}
                            />
                          ))}
                        </div>
                      </section>
                    )}
                  </div>
                </>
              )}

              {exitStep === 4 && (
                <section className="course-picker-step selected-department-courses exit-courses-panel">
                  <p className="course-step-label">{t("Step 4 · Courses")}</p>
                  {selectedDepartment ? (
                    <>
                      <h2>{t(selectedDepartment.name)}</h2>
                      {departmentCourses.length > 0 ? (
                        renderCourseCards(departmentCourses, {
                          examType: "Exit exam",
                          stream: selectedStream?.name,
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
                    <div className="coming-soon-message"><strong>{t("Choose a department first")}</strong><p>{t("Select your stream and field, then choose a department to view its courses.")}</p></div>
                  )}
                </section>
              )}
              <p className="course-data-disclaimer">
                {t("Sample department names and course lists for this demo; replace with verified listings.")}
              </p>
            </div>

            <aside className="exit-selection-summary" aria-label={t("Your selection")}>
              <h2><span aria-hidden="true">☷</span>{t("Your Selection")}</h2>
              <div className="exit-summary-row"><span className="exit-summary-icon">♧</span><span><small>{t("Stream")}</small><strong>{t(selectedStream?.name || "Not selected")}</strong></span><button type="button" aria-label={t("Change stream")} onClick={() => setExitStep(1)}>›</button></div>
              <div className="exit-summary-row"><span className="exit-summary-icon">⚙</span><span><small>{t("Field")}</small><strong>{t(selectedField?.name || "Not selected")}</strong></span><button type="button" aria-label={t("Change field")} disabled={!selectedStreamId} onClick={() => setExitStep(2)}>›</button></div>
              <div className="exit-summary-row"><span className="exit-summary-icon">⌘</span><span><small>{t("Department")}</small><strong>{t(selectedDepartment?.name || "Choose a department")}</strong></span><button type="button" aria-label={t("Choose department")} disabled={!selectedFieldId} onClick={() => setExitStep(3)}>›</button></div>
              <p className="exit-summary-note"><span aria-hidden="true">ⓘ</span>{t("Select a department, then view its courses.")}</p>
              {exitStep === 3 ? (
                <button
                  className="exit-continue-button"
                  type="button"
                  disabled={!selectedDepartmentId}
                  onClick={() => setExitStep(4)}
                >
                  {t("View Courses")} <span aria-hidden="true">›</span>
                </button>
              ) : exitStep === 4 ? (
                <button className="exit-continue-button exit-back-to-departments" type="button" onClick={() => setExitStep(3)}>
                  {t("Change department")} <span aria-hidden="true">›</span>
                </button>
              ) : null}
            </aside>
          </div>
        </>
      )}
    </section>
  );
}

function DepartmentCard({ department, selected, onSelect, t }) {
  const isAvailable = exitExamCourses.some((course) =>
    course.departmentIds.includes(department.id),
  );
  const descriptions = {
    "computer-science": "Algorithms, programming, data structures, and more.",
    "information-technology": "Networks, systems, hardware, and IT infrastructure.",
    "software-engineering": "Software development, web, mobile, and systems.",
    "electrical-engineering": "Power systems, electronics, control, and more.",
    pharmacy: "Medicines, pharmaceutical sciences, and patient care.",
    biology: "Genetics, ecology, organisms, and life sciences.",
    accounting: "Financial reporting, cost accounting, and auditing.",
    law: "Constitutional, criminal law, and legal systems.",
  };
  const icons = {
    "computer-science": "▣",
    "information-technology": "</>",
    "software-engineering": "ϟ",
    "electrical-engineering": "ϟ",
    pharmacy: "✚",
    biology: "⚗",
    accounting: "▤",
    law: "⚖",
  };

  return (
    <button
      type="button"
      className={`department-card${selected ? " selected" : ""}${isAvailable ? "" : " department-card-soon"}`}
      aria-pressed={selected}
      onClick={() => onSelect(department)}
    >
      <span className="department-card-icon" aria-hidden="true">{icons[department.id] || "▤"}</span>
      <span className="department-card-copy">
        <strong>{t(department.name)}</strong>
        <small>{t(descriptions[department.id] || "Practice material for this department is being prepared.")}</small>
      </span>
      {isAvailable
        ? <span className="department-card-check" aria-hidden="true">{selected ? "✓" : ""}</span>
        : <span className="department-soon-label">{t("Soon")}</span>}
    </button>
  );
}
