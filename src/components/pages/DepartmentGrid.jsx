import { useMemo } from "react";
import { useLanguage } from "../../i18n/LanguageContext.jsx";
import { FIELD_META } from "../../data/courseGroups.js";        // static — colors/icons only
import { useCourseTree } from "../../lib/CourseTreeContext.jsx";
import { Icon } from "../shared/Icons.jsx";

export default function DepartmentGrid({ departments, onStart }) {
  const { t } = useLanguage();
  const { exitExamTree, exitExamCourses } = useCourseTree();

  // Build helpers from live data
  const fieldById   = useMemo(() => new Map(exitExamTree.filter((n) => n.type === "field")   .map((n) => [n.id, n])), [exitExamTree]);
  const subgroupById = useMemo(() => new Map(exitExamTree.filter((n) => n.type === "subgroup").map((n) => [n.id, n])), [exitExamTree]);

  function getFieldMeta(deptId) {
    const dept = exitExamTree.find((n) => n.id === deptId);
    if (!dept) return FIELD_META["engineering"];
    const parentSg = subgroupById.get(dept.parentId);
    const fieldId  = parentSg ? parentSg.parentId : dept.parentId;
    return FIELD_META[fieldId] ?? FIELD_META["engineering"];
  }

  function courseCountFor(deptId) {
    return exitExamCourses.filter((c) => c.departmentIds.includes(deptId)).length;
  }

  return (
    <div className="dept-grid">
      {departments.map((department, index) => {
        const meta        = getFieldMeta(department.id);
        const courseCount = courseCountFor(department.id);
        const hasSample   = courseCount > 0;

        return (
          <button
            className={`dept-card${hasSample ? "" : " dept-card-soon"}`}
            type="button"
            key={department.id}
            onClick={() => onStart(department.name)}
            aria-label={`${t(department.name)}${hasSample ? "" : " — coming soon"}`}
            style={{
              "--dept-color": meta.color,
              "--dept-bg":    meta.bg,
              animationDelay: `${index * 60}ms`,
            }}
          >
            <span className="dept-card-bar" aria-hidden="true" />
            <span className="dept-card-icon" aria-hidden="true">
              <Icon name={meta.icon} size={18} strokeWidth={1.8} />
            </span>
            <span className="dept-card-body">
              <strong className="dept-card-name">{t(department.name)}</strong>
              <small className="dept-card-meta">
                {courseCount > 0 ? `${courseCount} subject${courseCount !== 1 ? "s" : ""}` : "No subjects yet"}
              </small>
            </span>
            <span className="dept-card-right">
              {hasSample ? (
                <span className="dept-status-chip dept-chip-sample">Sample content</span>
              ) : (
                <span className="dept-status-chip dept-chip-soon">Coming soon</span>
              )}
              <span className="dept-card-arrow" aria-hidden="true">
                <Icon name="arrow-right" size={14} strokeWidth={2.2} />
              </span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
