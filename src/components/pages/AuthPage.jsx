import { useState } from "react";
import { useLanguage } from "../../i18n/LanguageContext.jsx";
import "./AuthPage.css";

export default function AuthPage({ onLogin, onBack }) {
  const { t } = useLanguage();
  const [isRegistering, setIsRegistering] = useState(false);
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
    });
  }

  return (
    <main className="auth-page container">
      <button className="back-button" onClick={onBack}>← {t("Back to home")}</button>
      <section className="auth-card">
        <p className="eyebrow">{t("WELCOME TO WOLLO EXAM PREP")}</p>
        <h1>{isRegistering ? t("Create your account") : t("Welcome back")}</h1>
        <p className="muted">{t("Sign in or register to start your practice.")}</p>
        <div className="tabs" role="tablist" aria-label={t("Account options")}>
          <button
            className={!isRegistering ? "active" : ""}
            onClick={() => { setIsRegistering(false); setError(""); }}
            role="tab"
            aria-selected={!isRegistering}
          >
            {t("Log in")}
          </button>
          <button
            className={isRegistering ? "active" : ""}
            onClick={() => { setIsRegistering(true); setError(""); }}
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
              <input name="fullName" autoComplete="name" placeholder={t("Your full name")} />
            </label>
          )}
          <label>
            {t("Student ID")}
            <input name="studentId" autoComplete="username" placeholder={t("e.g. WU/1234/15")} />
          </label>
          <label>
            {t("Password")}
            <input name="password" type="password" autoComplete="current-password" />
          </label>
          <label>
            {t("Program")}
            <select name="level" defaultValue="Remedial">
              <option value="Remedial">{t("Remedial")}</option>
              <option value="Exit exam">{t("Exit exam")}</option>
            </select>
          </label>
          <p className="form-error" role="alert">{error}</p>
          <button className="button full-width" type="submit">
            {isRegistering ? t("Create account") : t("Log in")}
          </button>
          <p className="demo-note">{t("Demo only: any student ID and password will work.")}</p>
        </form>
      </section>
    </main>
  );
}
