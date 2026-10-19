import CoursePicker from "../dashboard/CoursePicker.jsx";
import { useLanguage } from "../../i18n/LanguageContext.jsx";
import OfflineBanner from "../shared/OfflineBanner.jsx";
import "./SelectionPage.css";

export default function SelectionPage({
  level,
  studyPlan,
  savedCourses,
  onToggleSaved,
  onStartQuiz,
  onBack,
}) {
  const { t } = useLanguage();

  return (
    <>
      <OfflineBanner />
      <main className="container selection-page">
      <button className="button button-small selection-back" type="button" onClick={onBack}>
        ← {t("Student dashboard")}
      </button>
      <section className="selection-intro">
        <p className="eyebrow">{t(level === "Remedial" ? "YOUR STREAM" : "YOUR DEPARTMENT")}</p>
        <h1>{t("Choose your subject")}</h1>
        <p className="muted">{t("Choose a course to begin practicing. Mock exams are timed for 10 minutes.")}</p>
      </section>
      <CoursePicker
        level={level}
        defaultDepartmentId={studyPlan?.exam === "exit" ? studyPlan.departmentId : null}
        defaultRemedialStream={studyPlan?.exam === "remedial" ? studyPlan.streamName : null}
        onChooseCourse={onStartQuiz}
        savedCourses={savedCourses}
        onToggleSaved={onToggleSaved}
      />
    </main>
    </>
  );
}
