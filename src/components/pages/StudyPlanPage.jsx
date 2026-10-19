import { useState } from "react";
import { useLanguage } from "../../i18n/LanguageContext.jsx";
import StudyPlanFields, { EMPTY_PLAN, planIsComplete } from "../shared/StudyPlanFields.jsx";
import "./StudyPlanPage.css";

/**
 * Shown to a student who has no program yet (for example an account created before
 * this feature) and when they press "Change" on the dashboard.
 */
export default function StudyPlanPage({ user, onSave, onBack }) {
  const { t } = useLanguage();
  const current = user?.studyPlan;
  const [plan, setPlan] = useState(() => current
    ? { exam: current.exam, streamDbId: current.streamId ?? "", departmentDbId: current.departmentId ?? "" }
    : EMPTY_PLAN);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    if (!planIsComplete(plan)) {
      setError(t("Choose remedial or exit exam, then your stream or department."));
      return;
    }
    setSaving(true);
    setError("");
    try {
      await onSave({
        exam: plan.exam,
        streamId: plan.exam === "remedial" ? plan.streamDbId : null,
        departmentId: plan.exam === "exit" ? plan.departmentDbId : null,
      });
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : t("Could not save your program. Please try again."));
      setSaving(false);
    }
  }

  return (
    <main className="container study-plan-page">
      <section className="study-plan-card">
        <p className="eyebrow">{t(current ? "YOUR PROGRAM" : "ONE LAST STEP")}</p>
        <h1>{t(current ? "Change your program" : "Where are you studying?")}</h1>
        <p className="muted">{t("We use this to show you the right subjects and practice questions.")}</p>
        <form onSubmit={handleSubmit}>
          <StudyPlanFields value={plan} onChange={setPlan} disabled={saving} />
          <p className="form-error" role="alert">{error}</p>
          <div className="study-plan-actions">
            <button className="button" type="submit" disabled={saving}>{saving ? t("Please wait...") : t("Save and continue")}</button>
            {current && <button className="button button-secondary" type="button" onClick={onBack} disabled={saving}>{t("Cancel")}</button>}
          </div>
        </form>
      </section>
    </main>
  );
}
