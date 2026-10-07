import { useLanguage } from "../../i18n/LanguageContext.jsx";
import "./HomePage.css";

export default function HomePage({ onStart }) {
  const { t } = useLanguage();
  return (
    <main>
      <section className="hero">
        <div className="container hero-layout">
          <div>
            <p className="eyebrow">{t("YOUR NEXT STEP STARTS HERE")}</p>
            <h1>{t("Prepare with confidence. Succeed together.")}</h1>
            <p className="lead">
              {t("Free practice questions and mock exams for Wollo University students—made to help you feel ready for exam day.")}
            </p>
            <button className="button" onClick={onStart}>
              {t("Start practicing")}
            </button>
            <span className="hero-note">{t("Free for all Wollo University students")}</span>
          </div>
          <div className="hero-card" aria-label={t("Study progress preview")}>
            <div className="hero-card-top">
              <span className="mini-crest">W</span>
              <span className="eyebrow">{t("A LITTLE PRACTICE ADDS UP")}</span>
            </div>
            <div className="progress-circle">
              <div>
                <strong>68%</strong>
                <span>{t("average score")}</span>
              </div>
            </div>
            <div className="study-stats">
              <div><strong>{t("5 days")}</strong><span>{t("study streak")}</span></div>
              <div><strong>{t("12")}</strong><span>{t("courses")}</span></div>
              <div><strong>{t("Free")}</strong><span>{t("to get started")}</span></div>
            </div>
          </div>
        </div>
      </section>

      <section className="section container" id="programs">
        <p className="eyebrow">{t("CHOOSE YOUR PATH")}</p>
        <h2>{t("Practice for the exam ahead")}</h2>
        <p className="section-intro">
          {t("Pick a program to find courses and practice questions for your studies.")}
        </p>
        <div className="program-grid">
          <article className="program-card">
            <span className="card-icon">01</span>
            <h3>{t("Remedial")}</h3>
            <p>
              {t("Build strong foundations in Natural Science or Social Science subjects.")}
            </p>
            <button className="text-button" onClick={onStart}>
              {t("Explore remedial courses")} <span aria-hidden="true">→</span>
            </button>
          </article>
          <article className="program-card">
            <span className="card-icon">02</span>
            <h3>{t("Exit exam")}</h3>
            <p>
              {t("Review key topics in your department and prepare for graduation.")}
            </p>
            <button className="text-button" onClick={onStart}>
              {t("Explore exit exam courses")} <span aria-hidden="true">→</span>
            </button>
          </article>
        </div>
      </section>

      <section className="section about-section" id="about">
        <div className="container about-layout">
          <div>
            <p className="eyebrow">{t("ABOUT THIS PLATFORM")}</p>
            <h2>{t("Made for Wollo University students")}</h2>
            <p>
              {t("Wollo University is a public university in the Amhara region of Ethiopia, with campuses in Dessie and Kombolcha.")}
            </p>
            <p>
              {t("This simple practice platform helps students learn at their own pace with questions, explanations, and timed mock exams.")}
            </p>
          </div>
          <div className="about-mark" aria-hidden="true">
            <span>WU</span>
            <strong>{t("Learn today.")}<br />{t("Lead tomorrow.")}</strong>
          </div>
        </div>
      </section>
    </main>
  );
}
