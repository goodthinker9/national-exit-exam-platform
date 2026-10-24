import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useLanguage } from "../../i18n/LanguageContext.jsx";
import { supabase, updatePassword } from "../../lib/supabase.js";

export default function ResetPasswordPage() {
  const { t } = useLanguage();
  const navigate = useNavigate();

  // 0 = waiting for recovery session, 1 = ready, -1 = invalid/expired
  const [state, setState] = useState(0);
  const [newPassword, setNewPassword] = useState("");
  const [confirm,     setConfirm]     = useState("");
  const [error,       setError]       = useState("");
  const [success,     setSuccess]     = useState(false);
  const [busy,        setBusy]        = useState(false);

  useEffect(() => {
    if (!supabase) { setState(-1); return; }

    // Check whether Supabase already has a recovery session (page-refresh case)
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        setState(1);
      }
    });

    // Listen for the PASSWORD_RECOVERY event emitted when the link is first opened
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY" && session) {
        setState(1);
      }
    });

    // If no session arrives within 3 seconds, the link is invalid/expired
    const timeout = window.setTimeout(() => {
      setState((prev) => prev === 0 ? -1 : prev);
    }, 3000);

    return () => {
      subscription.unsubscribe();
      window.clearTimeout(timeout);
    };
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");

    if (newPassword.length < 8) {
      setError(t("Password must be at least 8 characters."));
      return;
    }
    if (newPassword !== confirm) {
      setError(t("Passwords do not match."));
      return;
    }

    setBusy(true);
    try {
      await updatePassword(newPassword);
      setSuccess(true);
      await supabase.auth.signOut();
      window.setTimeout(() => navigate("/login"), 2000);
    } catch (err) {
      setError(err.message ?? t("Could not update password. Please try again."));
    } finally {
      setBusy(false);
    }
  }

  const cardStyle = {
    maxWidth: "420px",
    margin: "80px auto",
    padding: "clamp(24px, 4vw, 40px)",
    border: "1px solid #e2e8f0",
    borderRadius: "16px",
    background: "#fff",
    boxShadow: "0 8px 32px rgba(23,35,58,.07)",
  };

  if (state === 0) {
    return (
      <main className="container" style={{ minHeight: "60vh", display: "grid", placeItems: "center" }}>
        <p role="status" aria-live="polite" style={{ color: "#6b7a8d" }}>
          {t("Verifying your reset link…")}
        </p>
      </main>
    );
  }

  if (state === -1) {
    return (
      <main className="container" style={{ minHeight: "60vh", display: "grid", placeItems: "center" }}>
        <div style={cardStyle}>
          <h1 style={{ marginBottom: "12px", fontSize: "1.4rem", color: "#1a2e44" }}>
            {t("Link expired")}
          </h1>
          <p style={{ color: "#6b7a8d", marginBottom: "20px" }}>
            {t("This reset link is invalid or has expired. Please request a new one.")}
          </p>
          <a href="/login" className="button" style={{ display: "inline-block" }}>
            {t("Back to sign in")}
          </a>
        </div>
      </main>
    );
  }

  if (success) {
    return (
      <main className="container" style={{ minHeight: "60vh", display: "grid", placeItems: "center" }}>
        <div style={cardStyle}>
          <p role="status" aria-live="polite" style={{ color: "#12a06a", fontWeight: 700, fontSize: "1.1rem" }}>
            ✓ {t("Password changed. Redirecting to sign in…")}
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="container" style={{ minHeight: "60vh", display: "grid", placeItems: "center" }}>
      <div style={cardStyle}>
        <h1 style={{ marginBottom: "6px", fontSize: "1.6rem", color: "#1a2e44" }}>
          {t("Set a new password")}
        </h1>
        <p style={{ color: "#6b7a8d", marginBottom: "24px", fontSize: ".92rem" }}>
          {t("Choose a password with at least 8 characters.")}
        </p>

        <form onSubmit={handleSubmit} style={{ display: "grid", gap: "16px" }}>
          <label style={{ display: "grid", gap: "6px", fontWeight: 600, fontSize: ".86rem", color: "#3d5166" }}>
            {t("New password")}
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              autoComplete="new-password"
              minLength={8}
              required
              autoFocus
              style={{ minHeight: "44px", padding: "10px 13px", border: "1px solid #dde3ec",
                borderRadius: "8px", fontSize: ".92rem", background: "#f9fbfe" }}
            />
          </label>

          <label style={{ display: "grid", gap: "6px", fontWeight: 600, fontSize: ".86rem", color: "#3d5166" }}>
            {t("Confirm new password")}
            <input
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              autoComplete="new-password"
              minLength={8}
              required
              style={{ minHeight: "44px", padding: "10px 13px", border: "1px solid #dde3ec",
                borderRadius: "8px", fontSize: ".92rem", background: "#f9fbfe" }}
            />
          </label>

          {error && (
            <p role="alert" style={{ margin: 0, color: "#dc3545", fontSize: ".88rem" }}>{error}</p>
          )}

          <button className="button full-width" type="submit" disabled={busy}>
            {busy ? t("Please wait...") : t("Update password")}
          </button>
        </form>
      </div>
    </main>
  );
}
