import "./StudyPlanFields.css";
import { useMemo } from "react";
import { useLanguage } from "../../i18n/LanguageContext.jsx";
import { useCourseTree } from "../../lib/CourseTreeContext.jsx";

/**
 * "What are you preparing for?" fields, shared by the register form and the
 * study-plan page.  value = { exam: "" | "remedial" | "exit", streamDbId, departmentDbId }
 * (database ids, so they can be saved directly).
 */
export const EMPTY_PLAN = { exam: "", streamDbId: "", departmentDbId: "" };

export function planIsComplete(plan) {
  return (plan.exam === "exit" && Boolean(plan.departmentDbId))
    || (plan.exam === "remedial" && Boolean(plan.streamDbId));
}

export default function StudyPlanFields({ value, onChange, disabled = false }) {
  const { t } = useLanguage();
  const { exitExamTree, remedialStreams, loading, isFallback } = useCourseTree();

  // Departments grouped by "Stream › Field" so a long list stays readable
  const departmentGroups = useMemo(() => {
    const byId = new Map(exitExamTree.map((n) => [n.id, n]));
    const groups = new Map();
    exitExamTree
      .filter((n) => n.type === "department" && n.dbId)
      .forEach((dept) => {
        const path = [];
        let node = byId.get(dept.parentId);
        while (node) { path.unshift(node.name); node = byId.get(node.parentId); }
        const label = path.join(" › ");
        if (!groups.has(label)) groups.set(label, []);
        groups.get(label).push(dept);
      });
    groups.forEach((list) => list.sort((a, b) => a.name.localeCompare(b.name)));
    return [...groups.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [exitExamTree]);

  const streams = remedialStreams.filter((s) => s.dbId);
  const unavailable = !loading && (isFallback || (!streams.length && !departmentGroups.length));

  function set(patch) { onChange({ ...value, ...patch }); }

  if (unavailable) {
    return (
      <p className="muted study-plan-note" role="status">
        {t("The course list could not be loaded. You can choose your program after you log in.")}
      </p>
    );
  }

  return (
    <fieldset className="study-plan" disabled={disabled || loading}>
      <legend>{t("I am preparing for")}</legend>
      <div className="study-plan-options">
        <label className={`study-plan-option${value.exam === "remedial" ? " active" : ""}`}>
          <input
            type="radio" name="exam" value="remedial"
            checked={value.exam === "remedial"}
            onChange={() => set({ exam: "remedial", departmentDbId: "" })}
          />
          <span><strong>{t("Remedial program")}</strong><small>{t("Targeted practice for your stream")}</small></span>
        </label>
        <label className={`study-plan-option${value.exam === "exit" ? " active" : ""}`}>
          <input
            type="radio" name="exam" value="exit"
            checked={value.exam === "exit"}
            onChange={() => set({ exam: "exit", streamDbId: "" })}
          />
          <span><strong>{t("Exit exam")}</strong><small>{t("Practice for your department")}</small></span>
        </label>
      </div>

      {value.exam === "remedial" && (
        <label>
          {t("Your stream")}
          <select value={value.streamDbId} onChange={(e) => set({ streamDbId: e.target.value })} required>
            <option value="">{t("Choose your stream")}</option>
            {streams.map((s) => <option key={s.dbId} value={s.dbId}>{t(s.name)}</option>)}
          </select>
        </label>
      )}

      {value.exam === "exit" && (
        <label>
          {t("Your department")}
          <select value={value.departmentDbId} onChange={(e) => set({ departmentDbId: e.target.value })} required>
            <option value="">{t("Choose your department")}</option>
            {departmentGroups.map(([label, list]) => (
              <optgroup key={label} label={label}>
                {list.map((d) => <option key={d.dbId} value={d.dbId}>{d.name}</option>)}
              </optgroup>
            ))}
          </select>
        </label>
      )}
    </fieldset>
  );
}
