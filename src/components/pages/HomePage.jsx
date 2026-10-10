import { useEffect, useState } from "react";
import { useLanguage } from "../../i18n/LanguageContext.jsx";
import { exitExamTree } from "../../data/courseGroups.js";
import "./HomePage.css";

const heroSlides = [
  { src: "/banner1.png", alt: "Wollo University campus building" },
  { src: "/images/banner2.png", alt: "A path across the university campus" },
  { src: "/images/banner3.png", alt: "University campus grounds and buildings" },
];

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

const benefits = [
  {
    icon: "▤",
    title: "Subject-focused practice",
    description: "Practice questions for your selected subject.",
  },
  {
    icon: "♧",
    title: "Remedial support",
    description: "Review missed questions with targeted practice.",
  },
  {
    icon: "▥",
    title: "Detailed analytics",
    description: "See your study history and progress.",
  },
  {
    icon: "✓",
    title: "Flexible learning",
    description: "Study at your own pace, wherever you are.",
  },
];

const featuredDepartmentIds = [
  "software-engineering",
  "computer-science",
  "electrical-engineering",
  "pharmacy",
  "accounting",
];

const departmentDetails = {
  "software-engineering": { icon: "</>", description: "Programming, data structures, networks, and more.", tone: "blue" },
  "computer-science": { icon: "▦", description: "Algorithms, systems, databases, software development.", tone: "green" },
  "electrical-engineering": { icon: "⚙", description: "Circuits, electronics, and power systems.", tone: "orange" },
  pharmacy: { icon: "⚗", description: "Pharmaceutical sciences and related subjects.", tone: "purple" },
  accounting: { icon: "▤", description: "Accounting subjects and related practice.", tone: "pink" },
};

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
  const [activeSlide, setActiveSlide] = useState(0);
  const [departmentQuery, setDepartmentQuery] = useState("");
  const [showAllDepartments, setShowAllDepartments] = useState(false);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return undefined;
    const timer = window.setInterval(() => {
      setActiveSlide((current) => (current + 1) % heroSlides.length);
    }, 6000);
    return () => window.clearInterval(timer);
  }, []);

  function showSlide(index) {
    setActiveSlide((index + heroSlides.length) % heroSlides.length);
  }

  const matchingDepartments = exitExamTree.filter((node) =>
    node.type === "department"
      && node.name.toLocaleLowerCase().includes(departmentQuery.trim().toLocaleLowerCase()),
  );
  const visibleDepartments = departmentQuery.trim() || showAllDepartments
    ? matchingDepartments
    : featuredDepartmentIds
      .map((id) => matchingDepartments.find((department) => department.id === id))
      .filter(Boolean);

  return (
    <main className="landing-page" id="home">
      <section className="landing-hero">
        <div className="landing-hero-slides" aria-hidden="true">
          {heroSlides.map((slide, index) => (
            <img
              className={`landing-hero-slide${activeSlide === index ? " active" : ""}`}
              key={slide.src}
              src={slide.src}
              alt=""
            />
          ))}
        </div>
        <div className="landing-hero-inner">
          <div className="landing-copy">
            <p className="landing-eyebrow">{t("NATIONAL EXIT EXAM PREPARATION PLATFORM")}</p>
            <h1>{t("Your Journey to Success Starts Here")}</h1>
            <p className="landing-description">
              {t("Practice, improve, and build confidence with curriculum-aligned questions, mock exams, and personalized remedial learning — designed for Ethiopian university students.")}
            </p>
            <div className="landing-actions">
              <button className="landing-primary" onClick={onStart}>
                {t("Start Practicing")} <span aria-hidden="true">→</span>
              </button>
              <a className="landing-secondary" href="#subjects">
                {t("Learn More")}
              </a>
            </div>
            <div className="landing-hero-promises" role="group" aria-label={t("Platform features")}>
              <span><b aria-hidden="true">◎</b>{t("Real exam simulation")}</span>
              <span><b aria-hidden="true">♧</b>{t("Identify weak areas")}</span>
              <span><b aria-hidden="true">▤</b>{t("Track your progress")}</span>
            </div>
          </div>
          <div className="landing-hero-side">
            <div className="landing-hero-note">
              <span className="landing-note-icon" aria-hidden="true">✦</span>
              <p>{t("A focused path to your next success.")}</p>
            </div>
            <div className="landing-hero-card">
              <span aria-hidden="true">✓</span>
              <div><strong>{t("Your preparation starts here")}</strong><small>{t("Choose a subject and study at your pace.")}</small></div>
            </div>
          </div>
          <div className="landing-slide-controls" role="group" aria-label={t("Banner images")}>
            <button type="button" aria-label={t("Previous banner")} onClick={() => showSlide(activeSlide - 1)}>‹</button>
            {heroSlides.map((slide, index) => (
              <button
                type="button"
                aria-label={t("Show banner {number}", { number: index + 1 })}
                aria-pressed={activeSlide === index}
                className={activeSlide === index ? "active" : ""}
                key={slide.src}
                onClick={() => showSlide(index)}
              />
            ))}
            <button type="button" aria-label={t("Next banner")} onClick={() => showSlide(activeSlide + 1)}>›</button>
          </div>
        </div>
      </section>

      <section className="landing-features" id="features">
        <div className="landing-feature-grid">
          {features.map((feature, index) => (
            <article
              className={`landing-feature-card feature-${feature.className}`}
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

      <section className="landing-departments" id="subjects">
        <div className="landing-departments-heading">
          <div>
            <p className="landing-section-eyebrow">{t("EXPLORE COURSES")}</p>
            <h2>{t("Find Your Department")}</h2>
            <p>{t("Choose your department to access subjects and start your practice journey.")}</p>
          </div>
          <label className="landing-department-search">
            <span aria-hidden="true">⌕</span>
            <input
              type="search"
              value={departmentQuery}
              onChange={(event) => setDepartmentQuery(event.target.value)}
              placeholder={t("Search for a department, e.g. Engineering...")}
              aria-label={t("Search for a department")}
            />
          </label>
          <button
            type="button"
            className="landing-view-departments"
            onClick={() => setShowAllDepartments((showAll) => !showAll)}
            aria-expanded={showAllDepartments || Boolean(departmentQuery.trim())}
          >
            {t(showAllDepartments ? "Show Featured" : "View All Departments")}
            <span aria-hidden="true">→</span>
          </button>
        </div>
        {visibleDepartments.length > 0 ? (
          <div className="landing-department-grid">
            {visibleDepartments.map((department) => {
              const detail = departmentDetails[department.id] || {
                icon: "▤",
                description: "Explore subjects and practice for your field.",
                tone: "blue",
              };
              return (
                <button
                  className="landing-department-card"
                  type="button"
                  key={department.id}
                  onClick={onStart}
                  aria-label={`${t("Explore")} ${t(department.name)}`}
                >
                  <span className={`landing-department-icon tone-${detail.tone}`} aria-hidden="true">{detail.icon}</span>
                  <strong>{t(department.name)}</strong>
                  <small>{t(detail.description)}</small>
                  <span className="landing-department-action">
                    {t("Explore subjects")} <b aria-hidden="true">→</b>
                  </span>
                </button>
              );
            })}
          </div>
        ) : (
          <p className="landing-no-departments" role="status">{t("No departments match your search.")}</p>
        )}
        <p className="landing-department-disclaimer">
          {t("Sample department names for this demo; replace with verified listings.")}
        </p>
      </section>

      <section className="landing-value" id="about">
        <div className="landing-value-content">
          <p className="landing-section-eyebrow">{t("WHY EXITPREP")}</p>
          <h2>{t("More Than Just Practice")}</h2>
          <p>{t("Get the tools, guidance, and support to build your confidence and reach your goals.")}</p>
          <div className="landing-value-list">
            {benefits.map((benefit) => (
              <div className="landing-value-item" key={benefit.title}>
                <span aria-hidden="true">{benefit.icon}</span>
                <span className="landing-value-item-copy">
                  <strong>{t(benefit.title)}</strong>
                  <small>{t(benefit.description)}</small>
                </span>
              </div>
            ))}
          </div>
        </div>
        <div className="landing-value-image">
          <img src="/images/banner3.png" alt={t("Wollo University campus and grounds")} loading="lazy" />
        </div>
      </section>

      <section className="landing-cta">
        <span className="landing-cta-icon" aria-hidden="true">✦</span>
        <div className="landing-cta-copy">
          <p className="landing-section-eyebrow">{t("READY TO GET STARTED?")}</p>
          <h2>{t("Ready to get started?")}</h2>
          <p>{t("Join students preparing for a brighter future.")}</p>
        </div>
        <button type="button" className="landing-primary" onClick={onStart}>{t("Start Practicing")} <span aria-hidden="true">→</span></button>
      </section>

      <section className="landing-section landing-faq" id="faq">
        <div className="landing-faq-intro">
          <p className="landing-section-eyebrow">{t("FAQ")}</p>
          <h2>{t("Frequently Asked Questions")}</h2>
          <p>{t("Find quick answers to common questions about ExitPrep and how it works.")}</p>
        </div>
        <div className="landing-faq-list" aria-label={t("Frequently asked questions")}>
          {faqs.map((faq) => (
            <details className="landing-faq-item" key={faq.question}>
              <summary>{t(faq.question)}<span aria-hidden="true">+</span></summary>
              <p>{t(faq.answer)}</p>
            </details>
          ))}
        </div>
      </section>

    </main>
  );
}
