import { useLanguage } from "../../i18n/LanguageContext.jsx";
import "./HomePage.css";

const features = [
  {
    icon: "◷",
    title: "Practice Exams",
    description: "Take real exam-like tests with a timer.",
    className: "practice",
  },
  {
    icon: "▥",
    title: "Performance Analytics",
    description: "Track your progress and see where you need to improve.",
    className: "analytics",
  },
  {
    icon: "✦",
    title: "Remedial Program",
    description: "Get targeted practice for your weak areas.",
    className: "remedial",
  },
  {
    icon: "▤",
    title: "Question Bank",
    description: "Curated questions aligned with your department.",
    className: "question-bank",
  },
];

const studySteps = [
  {
    number: "01",
    title: "Create your free account",
    description: "Sign in or register to open your personal study space.",
    icon: "↗",
  },
  {
    number: "02",
    title: "Choose your subject",
    description: "Find practice material for your program and department.",
    icon: "▦",
  },
  {
    number: "03",
    title: "Practice and improve",
    description: "Answer questions, review explanations, and check your progress.",
    icon: "✓",
  },
];

const studentQuotes = [
  {
    quote: "Having practice questions in one place makes it easier to keep a steady study routine.",
    name: "Sample student",
    detail: "Illustrative feedback",
  },
  {
    quote: "I can focus on the topics I still need to review before exam day.",
    name: "Sample student",
    detail: "Illustrative feedback",
  },
  {
    quote: "A timed mock exam helps me get familiar with the pace of an exam.",
    name: "Sample student",
    detail: "Illustrative feedback",
  },
];

const benefits = [
  {
    icon: "◎",
    title: "Practice with purpose",
    description: "Build a regular study habit with focused questions and mock exams.",
  },
  {
    icon: "⌁",
    title: "Know what to review",
    description: "Use explanations and progress summaries to guide your next study session.",
  },
  {
    icon: "◷",
    title: "Learn at your own pace",
    description: "Practice when it works for you, then take a timed mock exam when you are ready.",
  },
];

const faqs = [
  {
    question: "Is ExitPrep free to use?",
    answer: "This demo is free to try. The sign-in and account screens do not process payments.",
  },
  {
    question: "Are the questions official exam questions?",
    answer: "No. Questions in this demo are sample content and are not an official exam database.",
  },
  {
    question: "How long is a mock exam?",
    answer: "Mock exams in this demo have a 10-minute timer. Practice mode does not have a timer.",
  },
  {
    question: "Can I choose what to study?",
    answer: "Yes. After signing in, choose a program, stream, or department and select a subject.",
  },
];

export default function HomePage({ onStart }) {
  const { t } = useLanguage();

  return (
    <main className="landing-page" id="home">
      <section className="landing-hero">
        <div className="landing-hero-inner">
          <div className="landing-copy">
            <p className="landing-eyebrow">{t("YOUR FUTURE STARTS HERE")}</p>
            <h1>{t("Prepare Smarter for Your Exit Exam")}</h1>
            <p className="landing-description">
              {t("Practice, identify your weaknesses, get personalized remedial support, and improve — all in one platform.")}
            </p>
            <div className="landing-actions">
              <button className="landing-primary" onClick={onStart}>
                {t("Get Started")}
              </button>
              <a className="landing-secondary" href="#features">
                {t("Learn More")}
              </a>
            </div>
          </div>
          <div className="landing-art" role="img" aria-label={t("Student studying")}>
            <div className="art-glow" />
            <div className="art-orbit art-orbit-one" />
            <div className="art-orbit art-orbit-two" />
            <img src="/landing-student.svg" alt="" />
            <span className="art-badge art-badge-score"><b>✓</b> {t("Study smarter")}</span>
            <span className="art-badge art-badge-progress"><b>↗</b> 72%</span>
          </div>
          <div className="landing-decoration landing-decoration-left" />
          <div className="landing-decoration landing-decoration-right" />
        </div>
      </section>

      <section className="landing-features" id="features">
        <div className="landing-feature-grid">
          {features.map((feature, index) => (
            <article
              className={`landing-feature-card feature-${feature.className}`}
              id={feature.className === "remedial" ? "subjects" : undefined}
              key={feature.title}
            >
              <span className={`feature-icon feature-icon-${feature.className}`} aria-hidden="true">
                {feature.icon}
              </span>
              <div>
                <h2>{t(feature.title)}</h2>
                <p>{t(feature.description)}</p>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="landing-section landing-how-it-works">
        <div className="landing-section-heading">
          <p className="landing-section-eyebrow">{t("A SIMPLE WAY TO GET READY")}</p>
          <h2>{t("How it works")}</h2>
          <p>{t("Go from choosing a subject to confident practice in three simple steps.")}</p>
        </div>
        <div className="landing-steps">
          {studySteps.map((step) => (
            <article className="landing-step" key={step.number}>
              <div className="landing-step-top">
                <span className="landing-step-icon" aria-hidden="true">{step.icon}</span>
                <span className="landing-step-number">{step.number}</span>
              </div>
              <h3>{t(step.title)}</h3>
              <p>{t(step.description)}</p>
            </article>
          ))}
        </div>
        <button className="landing-primary landing-how-cta" onClick={onStart}>
          {t("Start your preparation")}
          <span aria-hidden="true">→</span>
        </button>
      </section>

      <section className="landing-section landing-testimonials">
        <div className="landing-section-heading">
          <p className="landing-section-eyebrow">{t("STUDENT VOICES")}</p>
          <h2>{t("Made for the way students study")}</h2>
          <p>{t("Illustrative feedback showing how students can use the platform.")}</p>
          <span className="landing-demo-disclaimer">
            {t("Sample quotes for this demo; these are not collected student reviews.")}
          </span>
        </div>
        <div className="landing-testimonial-grid">
          {studentQuotes.map((item, index) => (
            <figure className="landing-testimonial" key={index}>
              <span className="landing-quote-mark" aria-hidden="true">“</span>
              <blockquote>{t(item.quote)}</blockquote>
              <figcaption>
                <span className="landing-avatar" aria-hidden="true">S</span>
                <span><strong>{t(item.name)}</strong><small>{t(item.detail)}</small></span>
              </figcaption>
            </figure>
          ))}
        </div>
      </section>

      <section className="landing-section landing-benefits">
        <div className="landing-section-heading">
          <p className="landing-section-eyebrow">{t("YOUR STUDY, YOUR WAY")}</p>
          <h2>{t("Why students choose ExitPrep")}</h2>
          <p>{t("A focused set of tools to support your exam preparation.")}</p>
        </div>
        <div className="landing-benefit-grid">
          {benefits.map((benefit) => (
            <article className="landing-benefit" key={benefit.title}>
              <span aria-hidden="true">{benefit.icon}</span>
              <h3>{t(benefit.title)}</h3>
              <p>{t(benefit.description)}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="landing-section landing-faq">
        <div className="landing-section-heading">
          <p className="landing-section-eyebrow">{t("NEED TO KNOW")}</p>
          <h2>{t("Frequently asked questions")}</h2>
          <p>{t("A few quick answers about this exam-prep demo.")}</p>
        </div>
        <div className="landing-faq-list">
          {faqs.map((faq) => (
            <details className="landing-faq-item" key={faq.question}>
              <summary>{t(faq.question)}<span aria-hidden="true">+</span></summary>
              <p>{t(faq.answer)}</p>
            </details>
          ))}
        </div>
      </section>

      <section className="landing-about" id="about">
        <span className="landing-about-mark" aria-hidden="true">E</span>
        <p>{t("Made for students preparing for their next step.")}</p>
      </section>
    </main>
  );
}
