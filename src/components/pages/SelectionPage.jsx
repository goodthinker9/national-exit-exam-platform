import CoursePicker from "../dashboard/CoursePicker.jsx";
import { useLanguage } from "../../i18n/LanguageContext.jsx";
import "./SelectionPage.css";

export default function SelectionPage({
  level,
  savedCourses,
  onToggleSaved,
  onStartQuiz,
  onBack,
}) {
  const { t } = useLanguage();

  return (
    <main className="container selection-page">
      <button className="back-button selection-back" type="button" onClick={onBack}>
        ← {t("Student dashboard")}
      </button>
      <section className="selection-intro">
        <p className="eyebrow">{t(level === "Remedial" ? "YOUR STREAM" : "YOUR DEPARTMENT")}</p>
        <h1>{t("Choose your subject")}</h1>
        <p className="muted">{t("Choose a course to begin practicing. Mock exams are timed for 10 minutes.")}</p>
      </section>
      <CoursePicker
        level={level}
        onChooseCourse={onStartQuiz}
        savedCourses={savedCourses}
        onToggleSaved={onToggleSaved}
      />
    </main>
  );
}
