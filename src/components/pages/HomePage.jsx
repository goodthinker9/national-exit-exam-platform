import { useEffect, useRef, useState } from "react";
import { useLanguage } from "../../i18n/LanguageContext.jsx";
import { exitExamTree } from "../../data/courseGroups.js";
import DepartmentGrid from "./DepartmentGrid.jsx";
import "./HomePage.css";

function useScrollReveal(threshold = 0.15) {
  const ref = useRef(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setVisible(true);
      return;
    }
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setVisible(true); observer.disconnect(); } },
      { threshold }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [threshold]);
  return [ref, visible];
}

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
  "information-technology",
  "electrical-engineering",
  "pharmacy",
  "biology",
  "accounting",
  "law",
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

function ServicesSection({ t, onStart }) {
  const [row1Ref, row1Visible] = useScrollReveal(0.12);
  const [decoRef, decoVisible] = useScrollReveal(0.2);
  const [row2Ref, row2Visible] = useScrollReveal(0.12);

  return (
    <section className="services-section" id="services" aria-labelledby="services-title">
      {/* Heading */}
      <div className="services-heading">
        <span className="services-accent-bar" aria-hidden="true" />
        <h2 id="services-title">{t("Our Services")}</h2>
      </div>

      {/* Row 1 – text left, mockup right */}
      <div ref={row1Ref} className={`services-row services-row-ltr${row1Visible ? " is-visible" : ""}`}>
        <div className="services-text">
          <h3>{t("Your Complete Exit Exam Resource Library")}</h3>
          <p>
            {t("Get instant access to 2015–2018 past Exit Exams, thousands of university & MOE model exams, and high-yield study notes from universities across Ethiopia. EthioExit brings everything together in one easy-to-use platform, making it simple to find the resources you need and focus on what matters most.")}
          </p>
          <button className="services-cta-btn" onClick={onStart}>
            {t("Get Started Now")} <span aria-hidden="true">→</span>
          </button>
        </div>
        <div className="services-mockup">
          <div className="services-mockup-screen">
            <img src="/images/banner2.png" alt={t("Platform dashboard preview")} loading="lazy" />
          </div>
          <div className="services-mockup-base" aria-hidden="true" />
        </div>
      </div>

      {/* Decorative icon */}
      {/* <div ref={decoRef} className={`services-deco${decoVisible ? " is-visible" : ""}`} aria-hidden="true">
        <span className="services-deco-icon">🔍</span>
      </div> */}

      {/* Row 2 – mockup left, text right */}
      <div ref={row2Ref} className={`services-row services-row-rtl${row2Visible ? " is-visible" : ""}`}>
        <div className="services-mockup">
          <div className="services-mockup-screen">
            <img src="/images/banner3.png" alt={t("Question bank preview")} loading="lazy" />
          </div>
          <div className="services-mockup-base" aria-hidden="true" />
        </div>
        <div className="services-text">
          <h3>{t("Comprehensive NGAT & GAT Exam Question Bank")}</h3>
          <p>
            {t("Get access to 2020–2025 NGAT & GAT past exam questions, university model exams, high-yield study notes, and study materials shared by previous exam takers. Build your confidence and prepare for your exam with everything you need in one easy-to-use platform.")}
          </p>
          <button className="services-cta-btn" onClick={onStart}>
            {t("Explore Questions")} <span aria-hidden="true">→</span>
          </button>
        </div>
      </div>
    </section>
  );
}

function AboutSection({ t }) {
  const [rowOneRef, rowOneVisible] = useScrollReveal(0.12);
  const [rowTwoRef, rowTwoVisible] = useScrollReveal(0.12);

  return (
    <section className="about-section" id="about" aria-labelledby="about-title">
      {/* Row 1 – About Us text left, photo right */}
      <div
        ref={rowOneRef}
        className={`about-row about-row-top${rowOneVisible ? " is-visible" : ""}`}
      >
        <div className="about-text">
          <span className="about-accent-bar" aria-hidden="true" />
          <h2 id="about-title">{t("About Us")}</h2>
          <p>
            {t(
              "EthioExit has been supporting Ethiopian students for over 2 years, providing graduate students with easy-to-use tools to succeed in their exit exams. Our innovative platform offers high-end features, including past year Exit exams, university mock exams, and MOE model exams, all organized for each department. With a strong track record of helping users pass their exams, EthioExit combines accessibility, reliability, and personalized study resources to make exam preparation efficient, effective, and stress-free."
            )}
          </p>
        </div>
        <div className="about-photo about-photo-right">
          <img src="/student.png" alt={t("Student studying at laptop")} loading="lazy" />
        </div>
      </div>

      {/* Decorative star */}
      <span className="about-star-deco" aria-hidden="true">✦</span>

      {/* Row 2 – Illustration left, Our Mission right */}
      <div
        ref={rowTwoRef}
        className={`about-row about-row-bottom${rowTwoVisible ? " is-visible" : ""}`}
      >
        <div className="about-illustration">
          <img src="/student2.png" alt={t("Graduating students celebrating")} loading="lazy" />
        </div>
        <div className="about-mission">
          <span className="about-accent-bar" aria-hidden="true" />
          <h3>{t("Our Mission")}</h3>
          <p>
            {t(
              "We envision providing the best customizable platform for university and college students to excel in their exit exams. By continuously expanding our collection of exit exam resources across all departments, EthioExit empowers students with the tools, practice questions, and study materials they need to prepare effectively and succeed with confidence."
            )}
          </p>
        </div>
      </div>
    </section>
  );
}

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

      <ServicesSection t={t} onStart={onStart} />

      <section className="landing-campus" id="campus" aria-labelledby="campus-title">
        <div className="landing-campus-intro">
          <p className="landing-section-eyebrow">{t("OUR CAMPUS")}</p>
          <h2 id="campus-title">{t("Wollo University")}</h2>
          <p>{t("The home of thousands of students preparing for a better future. Our platform is built for every faculty and department on campus.")}</p>
        </div>
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
          <div className="landing-dept-actions">
            <button
              type="button"
              className="landing-dept-shortcut"
              onClick={() => { onViewAllDepartments(); }}
            >
              {t("Remedial")}
            </button>
            <button
              type="button"
              className="landing-dept-shortcut landing-dept-shortcut-primary"
              onClick={onViewAllDepartments}
            >
              {t("Exit exam")}
            </button>
            <button
              type="button"
              className="landing-view-departments"
              onClick={onViewAllDepartments}
            >
              {t("View All Departments")}
              <span aria-hidden="true">→</span>
            </button>
          </div>
        </div>
        <DepartmentGrid departments={featuredDepartments} onStart={onStart} />
        <p className="landing-department-disclaimer">
          {t("Sample department names for this demo; replace with verified listings.")}
        </p>
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

      <AboutSection t={t} />

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
          {faqs.map((faq, index) => (
            <details className="landing-faq-item" key={faq.question}>
              <summary data-index={String(index + 1).padStart(2, "0")}>
                <span className="faq-question">{t(faq.question)}</span>
                <span className="faq-icon" aria-hidden="true">+</span>
              </summary>
              <p>{t(faq.answer)}</p>
            </details>
          ))}
        </div>
      </section>

    </main>
  );
}
