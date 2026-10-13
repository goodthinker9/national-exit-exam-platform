import { useEffect, useState } from "react";
import { useLanguage } from "../../i18n/LanguageContext.jsx";
import { exitExamTree } from "../../data/courseGroups.js";
import DepartmentGrid from "./DepartmentGrid.jsx";
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

const studentTestimonials = [
  {
    image: "/student1.png",
    name: "Wollo Student",
    quote: "ExitPrep helps me keep my study sessions focused. I can practice by subject and see what I need to review next.",
  },
  {
    image: "/student3.png",
    name: "Wollo Student",
    quote: "Being able to study at my own pace and revisit challenging subjects has helped me feel more prepared for my exams.",
  },
  {
    image: "/student2.png",
    name: "Wollo Student",
    quote: "The practice questions make it easier to build a routine and check my understanding as I prepare for the exit exam.",
  },
];

const freePlanFeatures = [
  { label: "Limited free questions per department", available: true },
  { label: "Check answers and explanations", available: true },
  { label: "Quick quiz mode", available: true },
  { label: "Leaderboard", available: false },
  { label: "Mock exams", available: false },
  { label: "Progress analytics", available: false },
  { label: "Study PDFs", available: false },
];

const premiumPlanFeatures = [
  "All questions per department unlocked",
  "Unlimited mock exams",
  "Leaderboard",
  "Analytics based on exam blueprint",
  "All study PDFs",
  "Bookmarks and notes",
  "Priority support",
];

const featuredDepartmentIds = [
  "software-engineering",
  "computer-science",
  "electrical-engineering",
  "pharmacy",
  "accounting",
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

export default function HomePage({ onStart, onViewAllDepartments }) {
  const { t } = useLanguage();
  const [activeSlide, setActiveSlide] = useState(0);
  const [activeTestimonial, setActiveTestimonial] = useState(0);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return undefined;
    const timer = window.setInterval(() => {
      setActiveSlide((current) => (current + 1) % heroSlides.length);
    }, 6000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return undefined;
    const timer = window.setInterval(() => {
      setActiveTestimonial((current) => (current + 1) % studentTestimonials.length);
    }, 6500);
    return () => window.clearInterval(timer);
  }, []);

  function showSlide(index) {
    setActiveSlide((index + heroSlides.length) % heroSlides.length);
  }

  function showTestimonial(index) {
    setActiveTestimonial((index + studentTestimonials.length) % studentTestimonials.length);
  }

  const featuredDepartments = featuredDepartmentIds
    .map((id) => exitExamTree.find((department) => department.type === "department" && department.id === id))
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

      <section className="landing-campus" id="campus">
        <article className="landing-campus-card">
          <img
            src="/banner1.png"
            alt={t("Wollo University campus")}
            loading="lazy"
          />
          <div className="landing-campus-card-copy">
            <p className="landing-campus-card-label">{t("WOLLO UNIVERSITY")}</p>
            <h3>{t("A place to learn, grow, and connect")}</h3>
            <p>{t("The setting behind your studies—from open campus grounds to spaces for university life.")}</p>
          </div>
        </article>
      </section>

      <section className="landing-departments" id="subjects">
        <div className="landing-departments-heading">
          <div>
            <p className="landing-section-eyebrow">{t("EXPLORE COURSES")}</p>
            <h2>{t("Find Your Department")}</h2>
            <p>{t("Choose your department to access subjects and start your practice journey.")}</p>
          </div>
          <button
            type="button"
            className="landing-view-departments"
            onClick={onViewAllDepartments}
          >
            {t("View All Departments")}
            <span aria-hidden="true">→</span>
          </button>
        </div>
        <DepartmentGrid departments={featuredDepartments} onStart={onStart} />
        <p className="landing-department-disclaimer">
          {t("Sample department names for this demo; replace with verified listings.")}
        </p>
      </section>

      <section className="landing-value" id="about" aria-labelledby="landing-value-title">
        <div className="landing-value-heading">
          <p className="landing-section-eyebrow">{t("WHY EXITPREP")}</p>
          <h2 id="landing-value-title">{t("More Than Just Practice")}</h2>
          <p>{t("Get the tools, guidance, and support to build your confidence and reach your goals.")}</p>
        </div>
        <div className="landing-value-showcase">
          <div className="landing-value-image">
            <img src="/images/banner3.png" alt={t("Wollo University campus and grounds")} loading="lazy" />
          </div>
          <div className="landing-value-content">
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
        </div>
      </section>

      <section className="landing-testimonials" aria-labelledby="landing-testimonials-title">
        <div className="landing-testimonials-heading">
          <p className="landing-section-eyebrow">{t("STUDENT VOICES")}</p>
          <h2 id="landing-testimonials-title">{t("What Our Students Are Saying")}</h2>
          <p>{t("See how focused practice can support a more confident study routine.")}</p>
          <span>{t("Sample student stories · For demonstration only")}</span>
        </div>
        <div className="landing-testimonial-track">
          {[-1, 0, 1].map((offset) => {
            const index = (activeTestimonial + offset + studentTestimonials.length) % studentTestimonials.length;
            const testimonial = studentTestimonials[index];
            return (
              <article
                className={`landing-testimonial-card${offset === 0 ? " active" : ""}`}
                key={testimonial.image}
                aria-hidden={offset !== 0}
              >
                <img src={testimonial.image} alt="" loading="lazy" />
                <div className="landing-testimonial-copy">
                  <p className="landing-testimonial-name">{t(testimonial.name)} <span>{t("Sample")}</span></p>
                  <blockquote>{t(testimonial.quote)}</blockquote>
                </div>
              </article>
            );
          })}
        </div>
        <div className="landing-testimonial-controls" role="group" aria-label={t("Student testimonials")}>
          <button type="button" aria-label={t("Previous testimonial")} onClick={() => showTestimonial(activeTestimonial - 1)}>‹</button>
          {studentTestimonials.map((testimonial, index) => (
            <button
              type="button"
              key={testimonial.image}
              aria-label={t("Show testimonial {number}", { number: index + 1 })}
              aria-pressed={activeTestimonial === index}
              onClick={() => showTestimonial(index)}
            />
          ))}
          <button type="button" aria-label={t("Next testimonial")} onClick={() => showTestimonial(activeTestimonial + 1)}>›</button>
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

      <section className="landing-plans" id="plans" aria-labelledby="landing-plans-title">
        <div className="landing-plans-heading">
          <p className="landing-section-eyebrow">{t("PRICING")}</p>
          <h2 id="landing-plans-title">{t("Free vs Premium")}</h2>
          <p>{t("Start for free — upgrade when you're ready for full access.")}</p>
          <span className="landing-plan-notice">{t("Demo only · Payments are not connected")}</span>
        </div>
        <div className="landing-plan-grid">
          <article className="landing-plan-card landing-plan-free">
            <p className="landing-plan-label">{t("FREE")}</p>
            <p className="landing-plan-price"><strong>0</strong><span>{t("ETB")}</span></p>
            <p className="landing-plan-period">{t("Always free")}</p>
            <ul>
              {freePlanFeatures.map((feature) => (
                <li className={feature.available ? "" : "landing-plan-unavailable"} key={feature.label}>
                  <span aria-hidden="true">{feature.available ? "✓" : "×"}</span>
                  {t(feature.label)}
                </li>
              ))}
            </ul>
            <button type="button" className="landing-plan-button landing-plan-button-free" onClick={onStart}>
              {t("Start Free")}
            </button>
          </article>
          <article className="landing-plan-card landing-plan-premium">
            <p className="landing-plan-label"><span aria-hidden="true">★</span> {t("PREMIUM")}</p>
            <p className="landing-plan-price"><strong>300</strong><span>{t("ETB")}</span></p>
            <p className="landing-plan-period">{t("4 months · demo price")}</p>
            <ul>
              {premiumPlanFeatures.map((feature) => (
                <li key={feature}><span aria-hidden="true">✓</span>{t(feature)}</li>
              ))}
            </ul>
            <button type="button" className="landing-plan-button landing-plan-button-premium" disabled>
              {t("Coming soon")}
            </button>
          </article>
        </div>
      </section>

      <section className="landing-section landing-faq" id="faq" aria-labelledby="landing-faq-title">
        <div className="landing-faq-intro">
          <p className="landing-section-eyebrow">{t("FAQ")}</p>
          <h2 id="landing-faq-title">{t("Frequently Asked Questions")}</h2>
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
