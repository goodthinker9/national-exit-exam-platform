import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useLanguage } from "../../i18n/LanguageContext.jsx";
import { useCourseTree } from "../../lib/CourseTreeContext.jsx";
import StudyPlanFields, { EMPTY_PLAN, planIsComplete } from "../shared/StudyPlanFields.jsx";
import "./AuthPage.css";

export default function AuthPage({ onLogin, onBack, initialRegister = false, authConfigured }) {
  const { t } = useLanguage();
  const [searchParams] = useSearchParams();
  const tabFromUrl = searchParams.get("tab") === "register";
  const [isRegistering, setIsRegistering] = useState(initialRegister || tabFromUrl);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [plan, setPlan] = useState(EMPTY_PLAN);
  const { loading: treeLoading, isFallback, remedialStreams } = useCourseTree();
  // Ask for the program only when the real course list is available
  const planAvailable = !treeLoading && !isFallback && remedialStreams.some((s) => s.dbId);

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setMessage("");

    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") || "").trim();
    const fullName = String(form.get("fullName") || "").trim();
    const password = String(form.get("password") || "");

    if (!email || !password) {
      setError(t("Enter your email and password."));
      return;
    }
    if (isRegistering && !fullName) {
      setError(t("Enter your full name to register."));
      return;
    }

    if (isRegistering && planAvailable && !planIsComplete(plan)) {
      setError(t("Choose remedial or exit exam, then your stream or department."));
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await onLogin({
        email,
        password,
        fullName,
        isRegistering,
        studyPlan: isRegistering && planIsComplete(plan)
          ? {
              exam: plan.exam,
              streamId: plan.exam === "remedial" ? plan.streamDbId : null,
              departmentId: plan.exam === "exit" ? plan.departmentDbId : null,
            }
          : null,
      });
      if (result?.needsConfirmation) {
        setMessage(t("Check your email to confirm your account, then log in."));
      }
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : t("Unable to sign in. Please try again."));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="auth-page container">
      <aside className="auth-aside">
        <a className="auth-aside-brand" href="#home" onClick={onBack} aria-label={t("Back to home")}>
          <img className="auth-aside-logo" src="/images/logo.png" alt="" />
          <span>{t("Wollo University")}<small>{t("Exam Prep")}</small></span>
        </a>
        <div className="auth-aside-copy">
          <p className="auth-eyebrow">{t("YOUR FUTURE STARTS HERE")}</p>
          <h2>{t("Prepare Smarter for Your Exit Exam")}</h2>
          <p>{t("Practice, identify your weaknesses, get personalized remedial support, and improve — all in one platform.")}</p>
        </div>
        <div className="auth-benefits">
          <div>
            <span aria-hidden="true">✓</span>
            <p><strong>{t("Practice Exams")}</strong><small>{t("Take real exam-like tests with a timer.")}</small></p>
          </div>
          <div>
            <span aria-hidden="true">✓</span>
            <p><strong>{t("Performance Analytics")}</strong><small>{t("Track your progress and see where you need to improve.")}</small></p>
          </div>
          <div>
            <span aria-hidden="true">✓</span>
            <p><strong>{t("Remedial Program")}</strong><small>{t("Get targeted practice for your weak areas.")}</small></p>
          </div>
        </div>
        <div className="auth-progress-card" aria-label={t("Study progress preview")}>
          <div className="auth-progress-heading">
            <span>{t("Study progress preview")}</span>
            <strong>72%</strong>
          </div>
          <div className="auth-progress-track"><span /></div>
          <small>{t("Study smarter")}</small>
        </div>
      </aside>

      <div className="auth-form-wrap">
        <button className="auth-home-link" type="button" onClick={onBack}>
          <svg aria-hidden="true" viewBox="0 0 24 24" fill="none">
            <path d="m3.5 10 8.5-7 8.5 7v10a1 1 0 0 1-1 1h-5.25v-6.5h-4.5V21H4.5a1 1 0 0 1-1-1V10Z" />
          </svg>
          <span>{t("Back to home")}</span>
          <b aria-hidden="true">→</b>
        </button>
        <section className="auth-card">
          <div className="auth-card-heading">
            <p className="eyebrow">{t("WELCOME TO WOLLO EXAM PREP")}</p>
            <h1>{isRegistering ? t("Create your account") : t("Welcome back")}</h1>
            <p className="muted">{t("Sign in or register to start your practice.")}</p>
          </div>
          <div className="tabs" role="tablist" aria-label={t("Account options")}>
            <button
              type="button"
              className={!isRegistering ? "active" : ""}
              onClick={() => { setIsRegistering(false); setError(""); setMessage(""); }}
              role="tab"
              aria-selected={!isRegistering}
            >
              {t("Log in")}
            </button>
            <button
              type="button"
              className={isRegistering ? "active" : ""}
              onClick={() => { setIsRegistering(true); setError(""); setMessage(""); }}
              role="tab"
              aria-selected={isRegistering}
            >
              {t("Register")}
            </button>
          </div>
          <form onSubmit={handleSubmit}>
            {isRegistering && (
              <label>
                {t("Full name")}
                <input name="fullName" autoComplete="name" placeholder={t("Your full name")} required />
              </label>
            )}
            <label>
              {t("Email")}
              <input
                name="email"
                type="email"
                autoComplete="email"
                placeholder={t("Enter your email")}
                required
              />
            </label>
            <label>
              {t("Password")}
              <input
                name="password"
                type="password"
                autoComplete={isRegistering ? "new-password" : "current-password"}
                required
              />
            </label>
            {isRegistering && <StudyPlanFields value={plan} onChange={setPlan} disabled={isSubmitting} />}
            <p className="form-error" role="alert">{error}</p>
            {message && <p className="form-success" role="status">{message}</p>}
            {!authConfigured && (
              <p className="form-error" role="status">
                {t("Supabase is not configured. Copy .env.example to .env, add your project URL and anon key, then restart the app.")}
              </p>
            )}
            <button className="button full-width" type="submit" disabled={!authConfigured || isSubmitting}>
              {isSubmitting
                ? t("Please wait...")
                : isRegistering
                  ? t("Create account")
                  : t("Log in")}
            </button>
          </form>
        </section>
      </div>
    </main>
  );
}
