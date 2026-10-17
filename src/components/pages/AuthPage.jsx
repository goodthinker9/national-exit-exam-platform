import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useLanguage } from "../../i18n/LanguageContext.jsx";
import "./AuthPage.css";

export default function AuthPage({ onLogin, onBack, initialRegister = false }) {
  const { t } = useLanguage();
  const [searchParams] = useSearchParams();
  const tabFromUrl = searchParams.get("tab") === "register";
  const [isRegistering, setIsRegistering] = useState(initialRegister || tabFromUrl);
  const [accountType, setAccountType] = useState("student");
  const [error, setError] = useState("");

  function handleSubmit(event) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const studentId = String(form.get("studentId") || "").trim();
    const fullName = String(form.get("fullName") || "").trim();

    if (!studentId || !form.get("password")) {
      setError(t("Enter your student ID and password."));
      return;
    }
    if (isRegistering && !fullName) {
      setError(t("Enter your full name to register."));
      return;
    }

    onLogin({
      name: isRegistering ? fullName : studentId,
      level: form.get("level"),
      role: isRegistering ? "student" : String(form.get("accountType") || "student"),
    });
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
              onClick={() => { setIsRegistering(false); setError(""); }}
              role="tab"
              aria-selected={!isRegistering}
            >
              {t("Log in")}
            </button>
            <button
              type="button"
              className={isRegistering ? "active" : ""}
              onClick={() => { setIsRegistering(true); setError(""); }}
              role="tab"
              aria-selected={isRegistering}
            >
              {t("Register")}
            </button>
          </div>
          <form onSubmit={handleSubmit}>
            {!isRegistering && (
              <label>
                {t("Sign in as")}
                <select
                  name="accountType"
                  value={accountType}
                  onChange={(event) => setAccountType(event.target.value)}
                >
                  <option value="student">{t("Student")}</option>
                  <option value="instructor">{t("Instructor")}</option>
                  <option value="coordinator">{t("Coordinator")}</option>
                  <option value="admin">{t("Administrator (Platform operations)")}</option>
                </select>
              </label>
            )}
            {isRegistering && (
              <label>
                {t("Full name")}
                <input name="fullName" autoComplete="name" placeholder={t("Your full name")} />
              </label>
            )}
            <label>
              {t(isRegistering || accountType === "student" ? "Student ID" : "User ID")}
              <input
                name="studentId"
                autoComplete="username"
                placeholder={t(isRegistering ? "e.g. WU/1234/15" : "Enter your ID")}
              />
            </label>
            <label>
              {t("Password")}
              <input
                name="password"
                type="password"
                autoComplete={isRegistering ? "new-password" : "current-password"}
              />
            </label>
            {(isRegistering || accountType === "student") && (
              <label>
                {t("Program")}
                <select name="level" defaultValue="Remedial">
                  <option value="Remedial">{t("Remedial")}</option>
                  <option value="Exit exam">{t("Exit exam")}</option>
                </select>
              </label>
            )}
            <p className="form-error" role="alert">{error}</p>
            <button className="button full-width" type="submit">
              {isRegistering ? t("Create account") : t("Log in")}
            </button>
            <p className="demo-note">{t("Demo only: any student ID and password will work.")}</p>
          </form>
        </section>
      </div>
    </main>
  );
}
