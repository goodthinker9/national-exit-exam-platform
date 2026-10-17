import { useMemo, useState } from "react";
import {
  courseGroups,
  exitExamTree,
  exitExamCourses,
  SAMPLE_CONTENT_IDS,
  FIELD_META,
} from "../../data/courseGroups.js";
import { useLanguage } from "../../i18n/LanguageContext.jsx";
import { Icon } from "../shared/Icons.jsx";
import "./DepartmentDirectoryPage.css";

// ── derived tree helpers ───────────────────────────────
const streams     = exitExamTree.filter((n) => n.type === "stream");
const fields      = exitExamTree.filter((n) => n.type === "field");
const subgroups   = exitExamTree.filter((n) => n.type === "subgroup");
const departments = exitExamTree.filter((n) => n.type === "department");

function courseCountFor(deptId) {
  return exitExamCourses.filter((c) => c.departmentIds.includes(deptId)).length;
}

function fieldsForStream(streamId) {
  return fields.filter((f) => f.parentId === streamId);
}

function subgroupsForField(fieldId) {
  return subgroups.filter((sg) => sg.parentId === fieldId);
}

function deptsForParent(parentId) {
  return departments.filter((d) => d.parentId === parentId);
}

// All subjects across remedial
const remedialSubjectCount = Object.values(courseGroups.Remedial)
  .reduce((t, s) => t + s.length, 0);

// ── small components ───────────────────────────────────
function StatusChip({ hasSample }) {
  return hasSample ? (
    <span className="dp-chip dp-chip-sample">Sample content</span>
  ) : (
    <span className="dp-chip dp-chip-soon">Coming soon</span>
  );
}

function DeptCard({ dept, fieldMeta, onStart }) {
  const { t } = useLanguage();
  const hasSample  = SAMPLE_CONTENT_IDS.has(dept.id);
  const courseCount = courseCountFor(dept.id);
  const meta = fieldMeta || { color: "#1675ff", bg: "#e8f0ff", icon: "field-engineering" };

  return (
    <button
      type="button"
      className={`dp-dept-card${hasSample ? "" : " dp-dept-card-soon"}`}
      onClick={() => onStart(dept.name)}
      aria-label={`${t(dept.name)}${hasSample ? "" : " — coming soon"}`}
      style={{ "--field-color": meta.color, "--field-bg": meta.bg }}
    >
      <span className="dp-dept-icon">
        <Icon name={meta.icon} size={20} strokeWidth={1.7} />
      </span>
      <span className="dp-dept-body">
        <strong className="dp-dept-name">{t(dept.name)}</strong>
        <small className="dp-dept-count">
          {courseCount > 0
            ? `${courseCount} subject${courseCount !== 1 ? "s" : ""}`
            : "No subjects yet"}
        </small>
      </span>
      <span className="dp-dept-right">
        <StatusChip hasSample={hasSample} />
        <span className="dp-dept-cta" aria-hidden="true">
          View info <Icon name="arrow-right" size={13} strokeWidth={2.2} />
        </span>
      </span>
    </button>
  );
}

// ── Exit-exam grouped list ─────────────────────────────
function ExitExamList({ streamId, fieldId, onStart }) {
  const { t } = useLanguage();

  const fieldsToShow = fieldId === "all"
    ? fieldsForStream(streamId)
    : fields.filter((f) => f.id === fieldId);

  return (
    <div className="dp-exit-list" role="list">
      {fieldsToShow.map((field) => {
        const meta = FIELD_META[field.id] || FIELD_META["engineering"];
        const sgs  = subgroupsForField(field.id);
        const directDepts = deptsForParent(field.id);

        return (
          <section key={field.id} className="dp-field-group" role="listitem">
            {fieldId === "all" && (
              <h3 className="dp-field-heading">
                <span className="dp-field-heading-icon" style={{ background: meta.bg, color: meta.color }}>
                  <Icon name={meta.icon} size={17} strokeWidth={1.8} />
                </span>
                {t(field.name)}
              </h3>
            )}

            {/* Sub-groups */}
            {sgs.map((sg) => (
              <div key={sg.id} className="dp-subgroup">
                <h4 className="dp-subgroup-heading">{t(sg.name)}</h4>
                <div className="dp-dept-grid">
                  {deptsForParent(sg.id).map((d) => (
                    <DeptCard key={d.id} dept={d} fieldMeta={meta} onStart={onStart} />
                  ))}
                </div>
              </div>
            ))}

            {/* Direct departments (no sub-group) */}
            {directDepts.length > 0 && (
              <div className="dp-dept-grid">
                {directDepts.map((d) => (
                  <DeptCard key={d.id} dept={d} fieldMeta={meta} onStart={onStart} />
                ))}
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}

// ── Remedial view ──────────────────────────────────────
function RemedialView({ query, onStart }) {
  const { t } = useLanguage();
  const streams = useMemo(() => {
    const q = query.trim().toLowerCase();
    return Object.entries(courseGroups.Remedial)
      .map(([stream, subjects]) => {
        const streamMatch = stream.toLowerCase().includes(q);
        return {
          stream,
          subjects: !q || streamMatch ? subjects : subjects.filter((s) => s.toLowerCase().includes(q)),
        };
      })
      .filter(({ stream, subjects }) => subjects.length > 0 || stream.toLowerCase().includes(q));
  }, [query]);

  if (streams.length === 0) {
    return (
      <p className="dp-empty" role="status">
        No remedial streams or subjects match your search. Try another name.
      </p>
    );
  }

  return (
    <div className="dp-remedial-grid">
      {streams.map(({ stream, subjects }) => {
        const isNatural = stream === "Natural Science";
        return (
          <article key={stream} className="dp-remedial-card">
            <div className="dp-remedial-card-top">
              <span className="dp-remedial-icon" aria-hidden="true">
                <Icon name={isNatural ? "stream-natural" : "stream-social"} size={22} strokeWidth={1.6} />
              </span>
              <div>
                <h2 className="dp-remedial-title">{t(stream)}</h2>
                <p className="dp-remedial-desc">
                  {isNatural
                    ? t("Build strong science foundations: Maths, Physics, Chemistry, Biology, and English.")
                    : t("Strengthen social science skills: Maths, Geography, History, Economics, and English.")}
                </p>
              </div>
            </div>
            <ul className="dp-remedial-subjects" aria-label={`${t(stream)} subjects`}>
              {subjects.map((subject) => (
                <li key={subject}>
                  <button
                    type="button"
                    className="dp-subject-link"
                    onClick={() => onStart(subject)}
                  >
                    {t(subject)}
                    <Icon name="arrow-right" size={12} strokeWidth={2.4} />
                  </button>
                </li>
              ))}
            </ul>
            <button
              type="button"
              className="dp-remedial-start"
              onClick={() => onStart(stream)}
            >
              Start practicing <Icon name="arrow-right" size={15} strokeWidth={2.2} />
            </button>
          </article>
        );
      })}
    </div>
  );
}

// ── Main page ──────────────────────────────────────────
export default function DepartmentDirectoryPage({ onStart, onBack }) {
  const { t } = useLanguage();
  const [query,        setQuery]        = useState("");
  const [examType,     setExamType]     = useState("exit");   // "remedial" | "exit"
  const [activeStream, setActiveStream] = useState(streams[0]?.id || "natural-science");
  const [activeField,  setActiveField]  = useState("all");

  // When stream changes, reset field
  function switchStream(id) {
    setActiveStream(id);
    setActiveField("all");
  }

  // Search: matches departments, streams, fields, remedial subjects
  const searchResults = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    const depts   = departments.filter((d) => d.name.toLowerCase().includes(q));
    const flds    = fields.filter((f) => f.name.toLowerCase().includes(q));
    const strs    = streams.filter((s) => s.name.toLowerCase().includes(q));
    const remSubj = Object.values(courseGroups.Remedial)
      .flat()
      .filter((s, i, a) => a.indexOf(s) === i && s.toLowerCase().includes(q))
      .map((s) => ({ id: `rem-${s}`, name: s, type: "remedial-subject" }));
    return [...depts, ...flds, ...strs, ...remSubj].slice(0, 8);
  }, [query]);

  // Filtered departments for exit exam (when searching)
  const filteredDepts = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return null;
    return departments.filter((d) => d.name.toLowerCase().includes(q));
  }, [query]);

  const streamFields = fieldsForStream(activeStream);
  const fieldOptions = [{ id: "all", name: "All" }, ...streamFields];
  const totalDepts   = departments.length;

  function handleSearchResultClick(result) {
    setQuery("");
    if (result.type === "remedial-subject") {
      setExamType("remedial");
      onStart(result.name);
    } else if (result.type === "department") {
      setExamType("exit");
      const field = fields.find((f) => {
        const sg = subgroups.find((s) => s.id === result.parentId);
        return sg ? sg.parentId === f.id : f.id === result.parentId;
      });
      if (field) {
        const stream = streams.find((s) => s.id === field.parentId);
        if (stream) setActiveStream(stream.id);
        setActiveField(field.id);
      }
      onStart(result.name);
    } else if (result.type === "field") {
      setExamType("exit");
      const stream = streams.find((s) => s.id === result.parentId);
      if (stream) setActiveStream(stream.id);
      setActiveField(result.id);
    } else if (result.type === "stream") {
      setExamType("exit");
      setActiveStream(result.id);
      setActiveField("all");
    }
  }

  return (
    <main className="dp-page">
      <div className="dp-inner">

        {/* ── Back link ── */}
        <button type="button" className="dp-back" onClick={onBack}>
          <Icon name="arrow-right" size={14} strokeWidth={2.2} className="dp-back-arrow" />
          {t("Back to home")}
        </button>

        {/* ── Page heading ── */}
        <header className="dp-header">
          <h1 className="dp-title">{t("Find your study program")}</h1>
          <p className="dp-subtitle">{t("Choose the program that matches your exam.")}</p>
        </header>

        {/* ── Search ── */}
        <div className="dp-search-wrap">
          <label className="dp-search-label" htmlFor="dp-search">
            {t("Search departments and courses")}
          </label>
          <div className="dp-search-field">
            <Icon name="search" size={18} strokeWidth={1.9} className="dp-search-icon" />
            <input
              id="dp-search"
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("Search your department or course, e.g. Pharmacy")}
              aria-label={t("Search your department or course")}
              autoComplete="off"
            />
            {query && (
              <button
                type="button"
                className="dp-search-clear"
                onClick={() => setQuery("")}
                aria-label={t("Clear search")}
              >✕</button>
            )}
          </div>

          {/* Search results dropdown */}
          {query && (
            <div className="dp-search-results" role="listbox" aria-label={t("Search results")}>
              {searchResults.length === 0 ? (
                <p className="dp-search-empty" role="status">
                  No department found. Try another name.
                </p>
              ) : (
                searchResults.map((result) => (
                  <button
                    key={result.id}
                    type="button"
                    className="dp-search-result"
                    role="option"
                    onClick={() => handleSearchResultClick(result)}
                  >
                    <span className="dp-search-result-type">
                      {result.type === "remedial-subject" ? "Remedial"
                        : result.type === "department" ? "Department"
                        : result.type === "field" ? "Field"
                        : "Stream"}
                    </span>
                    <span>{result.name}</span>
                  </button>
                ))
              )}
            </div>
          )}
        </div>

        {/* ── Segmented switch ── */}
        <div className="dp-switch" role="group" aria-label={t("Choose an exam program")}>
          <button
            type="button"
            className={`dp-switch-btn${examType === "remedial" ? " active" : ""}`}
            aria-pressed={examType === "remedial"}
            onClick={() => setExamType("remedial")}
          >
            {t("Remedial")}
            <span className="dp-switch-count">{remedialSubjectCount} subjects</span>
          </button>
          <button
            type="button"
            className={`dp-switch-btn${examType === "exit" ? " active" : ""}`}
            aria-pressed={examType === "exit"}
            onClick={() => setExamType("exit")}
          >
            {t("Exit exam")}
            <span className="dp-switch-count">{totalDepts} departments</span>
          </button>
        </div>

        {/* ── REMEDIAL VIEW ── */}
        {examType === "remedial" && (
          <RemedialView query={query} onStart={onStart} />
        )}

        {/* ── EXIT EXAM VIEW ── */}
        {examType === "exit" && (
          <>
            {/* Stream tabs */}
            <div className="dp-stream-tabs" role="tablist" aria-label={t("Select stream")}>
              {streams.map((stream) => (
                <button
                  key={stream.id}
                  type="button"
                  role="tab"
                  aria-selected={activeStream === stream.id}
                  className={`dp-stream-tab${activeStream === stream.id ? " active" : ""}`}
                  onClick={() => switchStream(stream.id)}
                >
                  <Icon
                    name={stream.id === "natural-science" ? "stream-natural" : "stream-social"}
                    size={16}
                    strokeWidth={1.8}
                  />
                  {t(stream.name)}
                </button>
              ))}
            </div>

            {/* Field chips */}
            <div className="dp-field-chips" role="group" aria-label={t("Filter by field")}>
              {fieldOptions.map((f) => {
                const meta = FIELD_META[f.id];
                return (
                  <button
                    key={f.id}
                    type="button"
                    className={`dp-field-chip${activeField === f.id ? " active" : ""}`}
                    style={meta && activeField === f.id
                      ? { "--chip-color": meta.color, "--chip-bg": meta.bg }
                      : {}}
                    onClick={() => setActiveField(f.id)}
                  >
                    {meta && (
                      <Icon name={meta.icon} size={14} strokeWidth={2} />
                    )}
                    {t(f.name)}
                  </button>
                );
              })}
            </div>

            {/* Result count aria-live */}
            <p className="dp-result-count" role="status" aria-live="polite">
              {filteredDepts
                ? `${filteredDepts.length} department${filteredDepts.length !== 1 ? "s" : ""} match your search`
                : `${deptsForStream(activeStream, activeField)} department${deptsForStream(activeStream, activeField) !== 1 ? "s" : ""}`}
            </p>

            {/* Dept list */}
            {filteredDepts ? (
              filteredDepts.length === 0 ? (
                <p className="dp-empty" role="status">
                  No department found. Try another name.
                </p>
              ) : (
                <div className="dp-dept-grid">
                  {filteredDepts.map((d) => {
                    const parentSg   = subgroups.find((sg) => sg.id === d.parentId);
                    const fieldId    = parentSg ? parentSg.parentId : d.parentId;
                    const fieldNode  = fields.find((f) => f.id === fieldId);
                    const meta       = fieldNode ? FIELD_META[fieldNode.id] : undefined;
                    return <DeptCard key={d.id} dept={d} fieldMeta={meta} onStart={onStart} />;
                  })}
                </div>
              )
            ) : (
              <ExitExamList
                streamId={activeStream}
                fieldId={activeField}
                onStart={onStart}
              />
            )}
          </>
        )}

        <p className="dp-disclaimer">
          Sample department names for this demo — not the official university list.
        </p>
      </div>
    </main>
  );
}

// helper: count visible depts for aria-live
function deptsForStream(streamId, fieldId) {
  if (fieldId === "all") {
    const streamFields = fields.filter((f) => f.parentId === streamId);
    return streamFields.reduce((total, f) => {
      const sgs = subgroups.filter((sg) => sg.parentId === f.id);
      const direct = departments.filter((d) => d.parentId === f.id).length;
      const fromSgs = sgs.reduce((t, sg) => t + departments.filter((d) => d.parentId === sg.id).length, 0);
      return total + direct + fromSgs;
    }, 0);
  }
  const sgs = subgroups.filter((sg) => sg.parentId === fieldId);
  const direct = departments.filter((d) => d.parentId === fieldId).length;
  const fromSgs = sgs.reduce((t, sg) => t + departments.filter((d) => d.parentId === sg.id).length, 0);
  return direct + fromSgs;
}
