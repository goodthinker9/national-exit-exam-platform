import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useLanguage } from "../../i18n/LanguageContext.jsx";
import { useCourseTree } from "../../lib/CourseTreeContext.jsx";
import {
  adminListUsers, adminOverview, adminSetUser,
  adminSetSetting, adminAudit,
  adminInviteStaff, adminListInvites, adminCancelInvite,
  requestPasswordReset, adminLogPasswordReset,
} from "../../lib/supabase.js";
import { uiToDb, dbToUi } from "../../lib/retakeMapping.js";
import AnnouncementManager from "../announcements/AnnouncementManager.jsx";
import LanguageSwitcher from "../../i18n/LanguageSwitcher.jsx";
import { Icon } from "../shared/Icons.jsx";
import "./AdminDashboard.css";

const TARGET_QUESTIONS_PER_COURSE = 60;
const adminSections = [
  ["Overview",        "overview"],
  ["Users and roles", "users"],
  ["Content health",  "health"],
  ["System and audit","settings"],
  ["Announcements",   "announce"],
  ["Manage Questions","questions"],
];
const userRoles = [
  { value: "student",     label: "Student" },
  { value: "instructor",  label: "Instructor" },
  { value: "coordinator", label: "Coordinator" },
  { value: "admin",       label: "Administrator" },
];

// Humanise audit action codes
const ACTION_LABELS = {
  "user.update":          "Changed account",
  "settings.update":      "Changed setting",
  "announcement.create":  "Sent announcement",
  "announcement.delete":  "Deleted announcement",
};
function humaniseAction(action) {
  return ACTION_LABELS[action] ?? action;
}

function formatDate(value) {
  if (!value) return "—";
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" })
    .format(new Date(value));
}

export default function AdminDashboard({
  questions,
  currentUser,
  settings,
  onSettingsChange,
  onLoadUsers,
  users,
  onUsersChange,
  onLogout,
}) {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const { exitExamTree, exitExamCourses, remedialCourses } = useCourseTree();

  const [activeSection, setActiveSection] = useState("Overview");

  // ── Users section state ───────────────────────────────────────────────────
  const [usersLoading, setUsersLoading] = useState(false);
  const [usersError,   setUsersError]   = useState(null);
  const [pendingRole,   setPendingRole]   = useState({});
  const [savingUser,    setSavingUser]    = useState(null);
  const [resetConfirm,  setResetConfirm]  = useState(null); // email of user to reset

  // ── Invite staff state ────────────────────────────────────────────────────
  const [inviteEmail,   setInviteEmail]   = useState("");
  const [inviteRole,    setInviteRole]    = useState("instructor");
  const [inviteName,    setInviteName]    = useState("");
  const [inviteBusy,    setInviteBusy]    = useState(false);
  const [inviteMsg,     setInviteMsg]     = useState(null); // { ok, text }
  const [invites,       setInvites]       = useState([]);
  const [invitesLoading, setInvitesLoading] = useState(false);

  // ── Overview state ────────────────────────────────────────────────────────
  const [overview,        setOverview]        = useState(null);
  const [overviewLoading, setOverviewLoading] = useState(false);
  const [overviewError,   setOverviewError]   = useState(null);

  // ── Settings state ────────────────────────────────────────────────────────
  const [localSettings, setLocalSettings] = useState({
    mockMinutes: settings?.mockMinutes ?? 10,
    retakeRule:  settings?.retakeRule  ?? "Unlimited retakes",
  });
  const [settingsSaving, setSettingsSaving] = useState(false);

  // ── Audit state ───────────────────────────────────────────────────────────
  const [auditRows,    setAuditRows]    = useState([]);
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditError,   setAuditError]   = useState(null);

  // ── Backup state ──────────────────────────────────────────────────────────
  const [lastBackupAt, setLastBackupAt] = useState(null);

  // ── Toast ─────────────────────────────────────────────────────────────────
  const [notice, setNotice] = useState("");
  function showNotice(msg, ms = 3500) {
    setNotice(msg);
    window.setTimeout(() => setNotice(""), ms);
  }

  // ── Course tree helpers ───────────────────────────────────────────────────
  const allCourses = useMemo(
    () => [...exitExamCourses, ...remedialCourses],
    [exitExamCourses, remedialCourses],
  );

  // ── Loaders ───────────────────────────────────────────────────────────────
  const loadUsers = useCallback(async () => {
    setUsersLoading(true);
    setUsersError(null);
    try {
      const rows = await adminListUsers();
      onUsersChange(rows.map((r) => ({
        id:          r.id,
        name:        r.full_name || r.email,
        email:       r.email,
        role:        r.role,
        status:      r.status === "active" ? "Active" : "Inactive",
        lastActiveAt: r.last_active ?? r.created_at,
        createdAt:   r.created_at,
      })));
    } catch (err) {
      setUsersError(err.message);
    } finally {
      setUsersLoading(false);
    }
  }, [onUsersChange]);

  const loadInvites = useCallback(async () => {
    setInvitesLoading(true);
    try { setInvites(await adminListInvites()); }
    catch { /* ignore */ }
    finally { setInvitesLoading(false); }
  }, []);

  async function handleInvite(e) {
    e.preventDefault();
    if (!inviteEmail.trim()) return;
    setInviteBusy(true);
    setInviteMsg(null);
    try {
      const result = await adminInviteStaff({ email: inviteEmail.trim(), role: inviteRole, name: inviteName.trim() });
      if (result?.result === "promoted") {
        setInviteMsg({ ok: true, text: t("{email} already had an account and is now {role}.", { email: result.email, role: t(result.role) }) });
        await loadUsers();
      } else {
        setInviteMsg({ ok: true, text: t("Invite saved. Ask {email} to register on the sign-up page with this exact email and confirm it. Their role is applied on first sign-in. Valid for 14 days.", { email: result?.email ?? inviteEmail.trim() }) });
        await loadInvites();
      }
      setInviteEmail(""); setInviteName("");
    } catch (err) {
      setInviteMsg({ ok: false, text: err.message });
    } finally {
      setInviteBusy(false);
    }
  }

  async function handleCancelInvite(email) {
    try {
      await adminCancelInvite(email);
      await loadInvites();
      showNotice(t("Invite cancelled."));
    } catch (err) {
      showNotice(err.message);
    }
  }

  async function handlePasswordReset(account) {
    try {
      await requestPasswordReset(account.email);
      await adminLogPasswordReset(account.id);
      await loadAudit();
      showNotice(t("Reset email sent to {email}.", { email: account.email }));
    } catch (err) {
      showNotice(err.message);
    } finally {
      setResetConfirm(null);
    }
  }

  const loadOverview = useCallback(async () => {
    setOverviewLoading(true);
    setOverviewError(null);
    try { setOverview(await adminOverview()); }
    catch (err) { setOverviewError(err.message); }
    finally { setOverviewLoading(false); }
  }, []);

  const loadAudit = useCallback(async () => {
    setAuditLoading(true);
    setAuditError(null);
    try { setAuditRows(await adminAudit(100)); }
    catch (err) { setAuditError(err.message); }
    finally { setAuditLoading(false); }
  }, []);

  // Load data when section becomes active
  useEffect(() => {
    if (activeSection === "Users and roles") { loadUsers(); loadInvites(); }
    if (activeSection === "Overview" || activeSection === "Content health") loadOverview();
    if (activeSection === "System and audit") loadAudit();
  }, [activeSection, loadUsers, loadOverview, loadAudit, loadInvites]);

  // Sync local settings when prop changes (e.g. after login)
  useEffect(() => {
    setLocalSettings({
      mockMinutes: settings?.mockMinutes ?? 10,
      retakeRule:  settings?.retakeRule  ?? "Unlimited retakes",
    });
  }, [settings?.mockMinutes, settings?.retakeRule]);

  // ── Content health (live counts from admin_overview) ─────────────────────
  const courseHealth = useMemo(() => {
    const byCourse = overview?.published_by_course ?? {};
    // A course shared by both remedial streams (English) has one dbId: list it once.
    const seen = new Set();
    return allCourses
      .filter((course) => {
        const key = course.dbId ?? course.id;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .map((course) => ({
        ...course,
        publishedCount: course.dbId ? (byCourse[course.dbId] ?? 0) : 0,
      }));
  }, [allCourses, overview]);

  // ── Actions ───────────────────────────────────────────────────────────────
  async function applyUserChange(account, { role, status }) {
    const newRole   = role   ?? account.role;
    const newStatus = status ?? (account.status === "Active" ? "active" : "inactive");
    const dbStatus  = newStatus === "Active" || newStatus === "active" ? "active" : "inactive";

    setSavingUser(account.id);
    try {
      await adminSetUser({ userId: account.id, role: newRole, status: dbStatus });
      await loadUsers();
      await loadAudit();
    } catch (err) {
      showNotice(err.message);
    } finally {
      setSavingUser(null);
    }
  }

  async function saveSettings() {
    setSettingsSaving(true);
    try {
      await adminSetSetting("mock_minutes", String(localSettings.mockMinutes));
      await adminSetSetting("retake_limit", uiToDb(localSettings.retakeRule));
      onSettingsChange({ mockMinutes: localSettings.mockMinutes, retakeRule: localSettings.retakeRule });
      await loadAudit();
      showNotice(t("Settings saved."));
    } catch (err) {
      showNotice(err.message);
    } finally {
      setSettingsSaving(false);
    }
  }

  function downloadBackup() {
    const backup = {
      generatedAt: new Date().toISOString(),
      overview,
      users,
      settings,
      announcements,
      note: "This file contains the data visible on the admin screen at the time of download.",
    };
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href = url;
    a.download = `exitprep-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
    setLastBackupAt(new Date().toISOString());
    showNotice(t("Backup downloaded to this device."));
  }

  // ── Section renderers ─────────────────────────────────────────────────────

  function renderOverview() {
    if (overviewLoading) return <p className="admin-inline-note">{t("Loading…")}</p>;
    if (overviewError)   return <RetryBlock msg={overviewError} onRetry={loadOverview} t={t} />;

    // Per-course published counts from overview.published_by_course
    const publishedByCourse = overview?.published_by_course ?? {};
    const overviewDeptHealth = exitExamTree
      .filter((n) => n.type === "department")
      .map((dept) => {
        // Sum up published counts for courses linked to this dept
        const deptCourses = exitExamCourses.filter((c) => c.departmentIds?.includes(dept.id));
        const count = deptCourses.reduce((sum, c) => {
          const n = publishedByCourse[c.dbId] ?? 0;
          return sum + n;
        }, 0);
        return { ...dept, publishedCount: count };
      });
    const belowHalf = courseHealth.filter(
      (c) => c.publishedCount < TARGET_QUESTIONS_PER_COURSE / 2,
    ).length;

    return (
      <>
        <section className="admin-stat-grid" aria-label={t("Platform health overview")}>
          <StatCard icon="users"     tone="student-icon"  value={overview?.students              ?? "—"} label={t("Registered students")} />
          <StatCard icon="today"     tone="exam-icon"     value={overview?.active_students_7d    ?? "—"} label={t("Active this week")} />
          <StatCard icon="questions" tone="question-icon" value={overview?.published_questions   ?? "—"} label={t("Published questions")} />
          <StatCard icon="reports"   tone="result-icon"   value={belowHalf}                              label={t("Courses below 50%")} />
        </section>
        <section className="admin-panel admin-overview-health">
          <PanelHeading title={t("Questions per department")} />
          <div className="admin-table-scroll">
            <table>
              <thead><tr><th>{t("Department")}</th><th>{t("Published questions")}</th></tr></thead>
              <tbody>
                {overviewDeptHealth.map((dept) => (
                  <tr key={dept.id}>
                    <td>{t(dept.name)}</td>
                    <td>{dept.publishedCount}</td>
                  </tr>
                ))}
                {overviewDeptHealth.length === 0 && (
                  <tr><td colSpan="2">{t("No department data available.")}</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </>
    );
  }

  function renderUsers() {
    return (
      <section className="admin-panel">
        <div className="admin-panel-heading">
          <h2>{t("Users and roles")}</h2>
          <button className="admin-primary-button" type="button" onClick={() => { loadUsers(); loadInvites(); }}
            disabled={usersLoading} aria-label={t("Reload users")}>
            {usersLoading ? t("Loading…") : t("Reload")}
          </button>
        </div>

        {/* ── Invite staff panel ── */}
        <div style={{ padding: "18px 20px", marginBottom: "20px", border: "1px solid #dde3ec",
          borderRadius: "10px", background: "#f9fbfe" }}>
          <h3 style={{ margin: "0 0 6px", fontSize: ".95rem", fontWeight: 700, color: "#1a2e44" }}>
            {t("Invite instructors and coordinators by email. To make someone an admin, change their role in the table below.")}
          </h3>

          {inviteMsg && (
            <p role="status" aria-live="polite" style={{ margin: "0 0 12px", padding: "10px 14px",
              borderRadius: "8px", fontSize: ".87rem",
              background: inviteMsg.ok ? "#e4f7ef" : "#fff0f0",
              color: inviteMsg.ok ? "#12a06a" : "#dc3545" }}>
              {inviteMsg.text}
            </p>
          )}

          <form onSubmit={handleInvite}
            style={{ display: "grid", gridTemplateColumns: "1fr auto auto auto", gap: "10px", alignItems: "end" }}>
            <label style={{ display: "grid", gap: "5px", fontSize: ".8rem", fontWeight: 600, color: "#3d5166" }}>
              {t("Email")}
              <input type="email" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)}
                placeholder={t("staff@example.com")} required
                className="admin-account-form" style={{ minHeight: "40px" }} />
            </label>
            <label style={{ display: "grid", gap: "5px", fontSize: ".8rem", fontWeight: 600, color: "#3d5166" }}>
              {t("Role")}
              <select value={inviteRole} onChange={(e) => setInviteRole(e.target.value)}
                style={{ minHeight: "40px", padding: "8px 10px", border: "1px solid #dde3ec",
                  borderRadius: "8px", background: "#fff", fontSize: ".88rem" }}>
                <option value="instructor">{t("Instructor")}</option>
                <option value="coordinator">{t("Coordinator")}</option>
              </select>
            </label>
            <label style={{ display: "grid", gap: "5px", fontSize: ".8rem", fontWeight: 600, color: "#3d5166" }}>
              {t("Name (optional)")}
              <input type="text" value={inviteName} onChange={(e) => setInviteName(e.target.value)}
                placeholder={t("Full name")}
                style={{ minHeight: "40px", padding: "8px 10px", border: "1px solid #dde3ec",
                  borderRadius: "8px", background: "#fff", fontSize: ".88rem" }} />
            </label>
            <button className="admin-primary-button" type="submit" disabled={inviteBusy}
              style={{ alignSelf: "end" }}>
              {inviteBusy ? t("Saving…") : t("Invite")}
            </button>
          </form>
        </div>

        {/* ── Pending invites ── */}
        <div style={{ marginBottom: "24px" }}>
          <h3 style={{ margin: "0 0 10px", fontSize: ".95rem", fontWeight: 700, color: "#1a2e44" }}>
            {t("Pending invites")}
          </h3>
          {invitesLoading && <p className="admin-inline-note">{t("Loading…")}</p>}
          {invites.length === 0 && !invitesLoading ? (
            <p className="admin-inline-note">{t("No pending invites.")}</p>
          ) : (
            <div className="admin-table-scroll">
              <table>
                <thead><tr>
                  <th>{t("Email")}</th><th>{t("Role")}</th><th>{t("Name")}</th>
                  <th>{t("Expires")}</th><th>{t("Status")}</th><th></th>
                </tr></thead>
                <tbody>
                  {invites.map((inv) => (
                    <tr key={inv.email}>
                      <td>{inv.email}</td>
                      <td>{t(inv.role)}</td>
                      <td>{inv.full_name || "—"}</td>
                      <td><small>{formatDate(inv.expires_at)}</small></td>
                      <td>
                        {inv.expired
                          ? <span style={{ color: "#dc3545", fontWeight: 700, fontSize: ".78rem" }}>{t("Expired")}</span>
                          : <span style={{ color: "#12a06a", fontWeight: 700, fontSize: ".78rem" }}>{t("Pending")}</span>}
                      </td>
                      <td>
                        <button className="admin-row-actions" type="button"
                          onClick={() => handleCancelInvite(inv.email)}
                          style={{ color: "#dc3545", borderColor: "#dc3545" }}>
                          {t("Cancel")}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* ── Password reset confirm panel ── */}
        {resetConfirm && (
          <div role="dialog" aria-modal="false" aria-label={t("Confirm password reset")}
            style={{ margin: "0 0 16px", padding: "14px 18px", borderRadius: "10px",
              background: "#fff8f0", border: "1px solid #f5c07a" }}>
            <p style={{ margin: "0 0 10px", fontWeight: 600, color: "#7a3a00" }}>
              {t("Send a password reset email to {email}?", { email: resetConfirm.email })}
            </p>
            <div style={{ display: "flex", gap: "8px" }}>
              <button className="admin-primary-button" type="button"
                onClick={() => handlePasswordReset(resetConfirm)}>
                {t("Send reset email")}
              </button>
              <button type="button" onClick={() => setResetConfirm(null)}
                style={{ padding: "8px 16px", border: "1px solid #dde3ec", borderRadius: "8px",
                  background: "transparent", cursor: "pointer" }}>
                {t("Cancel")}
              </button>
            </div>
          </div>
        )}

        {usersError && <RetryBlock msg={usersError} onRetry={loadUsers} t={t} />}

        {/* ── Users table ── */}
        <div className="admin-table-scroll">
          <table>
            <thead>
              <tr>
                <th>{t("Name")}</th>
                <th>{t("Email")}</th>
                <th>{t("Role")}</th>
                <th>{t("Status")}</th>
                <th>{t("Last active")}</th>
                <th>{t("Actions")}</th>
              </tr>
            </thead>
            <tbody>
              {users.map((account) => {
                const isSelf = account.id === currentUser?.id;
                const pending = pendingRole[account.id] ?? account.role;
                return (
                  <tr key={account.id}>
                    <td>{account.name}</td>
                    <td><small>{account.email}</small></td>
                    <td>
                      <select
                        aria-label={t("Role for {name}", { name: account.name })}
                        value={pending}
                        disabled={isSelf || savingUser === account.id}
                        onChange={(e) => setPendingRole((p) => ({ ...p, [account.id]: e.target.value }))}
                      >
                        {userRoles.map((r) => <option key={r.value} value={r.value}>{t(r.label)}</option>)}
                      </select>
                    </td>
                    <td>
                      <span className={`admin-status${account.status === "Active" ? "" : " inactive"}`}>
                        {t(account.status)}
                      </span>
                    </td>
                    <td><small>{formatDate(account.lastActiveAt)}</small></td>
                    <td className="admin-row-actions">
                      {pending !== account.role && (
                        <button type="button" disabled={savingUser === account.id}
                          onClick={() => applyUserChange(account, { role: pending, status: account.status === "Active" ? "active" : "inactive" })}>
                          {savingUser === account.id ? t("Saving…") : t("Save role")}
                        </button>
                      )}
                      <button type="button"
                        disabled={isSelf || savingUser === account.id}
                        title={isSelf ? t("You cannot deactivate your own account") : undefined}
                        onClick={() => applyUserChange(account, {
                          role: account.role,
                          status: account.status === "Active" ? "inactive" : "active",
                        })}>
                        {t(account.status === "Active" ? "Deactivate" : "Activate")}
                      </button>
                      <button type="button"
                        disabled={isSelf}
                        title={isSelf ? t("You cannot reset your own password here") : undefined}
                        onClick={() => setResetConfirm(account)}>
                        {t("Reset password")}
                      </button>
                    </td>
                  </tr>
                );
              })}
              {!usersLoading && users.length === 0 && (
                <tr><td colSpan="6">{t("No users found.")}</td></tr>
              )}
            </tbody>
          </table>
        </div>
        <p className="admin-inline-note">{t("Passwords are never shown.")}</p>
      </section>
    );
  }

  function renderContentHealth() {
    return (
      <section className="admin-panel">
        <PanelHeading title={t("Published questions per course")} />
        <p className="admin-section-description">{t("Target: {count} published questions per course.", { count: TARGET_QUESTIONS_PER_COURSE })}</p>
        {overviewLoading && <p className="admin-inline-note">{t("Loading…")}</p>}
        {overviewError && <RetryBlock msg={overviewError} onRetry={loadOverview} t={t} />}
        <div className="admin-table-scroll">
          <table>
            <thead>
              <tr>
                <th>{t("Course")}</th>
                <th>{t("Published questions")}</th>
                <th>{t("Target")}</th>
                <th>{t("Health")}</th>
              </tr>
            </thead>
            <tbody>
              {courseHealth.map((course) => {
                const pct   = Math.min(100, Math.round(course.publishedCount / TARGET_QUESTIONS_PER_COURSE * 100));
                const isLow = course.publishedCount < TARGET_QUESTIONS_PER_COURSE / 2;
                return (
                  <tr className={isLow ? "admin-course-low" : ""} key={course.id}>
                    <td>{t(course.name)}</td>
                    <td>{course.publishedCount}</td>
                    <td>{TARGET_QUESTIONS_PER_COURSE}</td>
                    <td><span className={`admin-health-pill${isLow ? " low" : ""}`}>{pct}% · {t(isLow ? "Below target" : "On track")}</span></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    );
  }

  function renderSystemAudit() {
    return (
      <>
        <section className="admin-panel admin-settings-grid">
          <div>
            <PanelHeading title={t("Exam settings")} />
            <label className="admin-setting-control">
              <span>{t("Mock exam time limit")}</span>
              <span>
                <input
                  type="number" min="1" max="300"
                  value={localSettings.mockMinutes}
                  onChange={(e) => setLocalSettings((s) => ({ ...s, mockMinutes: Math.max(1, parseInt(e.target.value) || 1) }))}
                /> {t("minutes")}
              </span>
            </label>
            <label className="admin-setting-control">
              <span>{t("Retake rules")}</span>
              <select
                value={localSettings.retakeRule}
                onChange={(e) => setLocalSettings((s) => ({ ...s, retakeRule: e.target.value }))}
              >
                {["No retakes", "One retake", "Two retakes", "Unlimited retakes"].map((rule) => (
                  <option key={rule} value={rule}>{t(rule)}</option>
                ))}
              </select>
            </label>
            <button
              className="admin-primary-button"
              type="button"
              disabled={settingsSaving}
              onClick={saveSettings}
              style={{ marginTop: "16px" }}
            >
              {settingsSaving ? t("Saving…") : t("Save settings")}
            </button>
          </div>
          <div className="admin-backup-card">
            <PanelHeading title={t("Backup")} />
            <p><strong>{lastBackupAt ? t("Last backup: {time}", { time: formatDate(lastBackupAt) }) : t("No backup downloaded this session")}</strong></p>
            <p className="admin-inline-note">{t("Downloads a JSON copy of what is visible on this screen.")}</p>
            <button className="admin-primary-button" type="button" onClick={downloadBackup}>{t("Back up now")}</button>
          </div>
        </section>

        <section className="admin-panel">
          <div className="admin-panel-heading">
            <PanelHeading title={t("Audit log")} />
            <button className="admin-primary-button" type="button" onClick={loadAudit}
              disabled={auditLoading}>{auditLoading ? t("Loading…") : t("Reload")}</button>
          </div>
          {auditError && <RetryBlock msg={auditError} onRetry={loadAudit} t={t} />}
          <div className="admin-table-scroll">
            <table>
              <thead><tr><th>{t("When")}</th><th>{t("Actor")}</th><th>{t("Action")}</th><th>{t("Target")}</th></tr></thead>
              <tbody>
                {auditRows.map((entry) => (
                  <tr key={entry.id}>
                    <td><small>{formatDate(entry.at)}</small></td>
                    <td>{entry.actor}</td>
                    <td>{t(humaniseAction(entry.action))}</td>
                    <td><small>{entry.target ?? "—"}</small></td>
                  </tr>
                ))}
                {!auditLoading && auditRows.length === 0 && (
                  <tr><td colSpan="4">{t("No audit events found.")}</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </>
    );
  }

  function renderAnnouncements() {
    return <AnnouncementManager role="admin" />;
  }

  const sectionRenderers = {
    Overview:        renderOverview,
    "Users and roles": renderUsers,
    "Content health": renderContentHealth,
    "System and audit": renderSystemAudit,
    Announcements:   renderAnnouncements,
  };

  return (
    <main className="admin-dashboard">
      <aside className="admin-sidebar">
        <a className="admin-brand" href="#admin-dashboard" aria-label={t("ExitPrep admin dashboard")}>
          <span aria-hidden="true">✦</span> ExitPrep
        </a>
        <div className="admin-sidebar-user">
          <span className="admin-sidebar-avatar" aria-hidden="true">
            {(currentUser?.name || "A").trim().split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase()}
          </span>
          <div className="admin-sidebar-info">
            <span className="admin-sidebar-name">{currentUser?.name || t("Administrator")}</span>
            <span className="admin-sidebar-role">{t("ADMIN")}</span>
          </div>
        </div>
        <nav className="admin-nav" aria-label={t("Administrator navigation")}>
          <span className="admin-nav-label">{t("MENU")}</span>
          {adminSections.map(([label, icon]) => (
            <button
              className={activeSection === label ? "active" : ""}
              type="button"
              key={label}
              aria-current={activeSection === label ? "page" : undefined}
              onClick={() => {
                if (label === "Manage Questions") navigate("/staff/admin/questions");
                else setActiveSection(label);
              }}
            >
              <Icon name={icon} size={18} />
              {t(label)}
            </button>
          ))}
        </nav>
        <div className="admin-sidebar-footer">
          <span aria-hidden="true">●</span> {t("Platform operations")}
        </div>
      </aside>

      <section className="admin-workspace" id="admin-dashboard">
        <header className="admin-topbar">
          <div className="admin-mobile-brand"><span aria-hidden="true">✦</span> ExitPrep</div>
          <div className="admin-topbar-actions">
            <LanguageSwitcher />
            <span className="admin-topbar-role">{t("ADMINISTRATOR")}</span>
            <span className="admin-topbar-name">{currentUser?.name || t("Administrator")}</span>
            <button className="admin-signout-btn" type="button" onClick={onLogout}>
              <Icon name="logout" size={16} />{t("Sign out")}
            </button>
          </div>
        </header>
        <div className="admin-dashboard-content">
          <div className="admin-page-heading">
            <div>
              <p className="admin-eyebrow">{t("PLATFORM OPERATIONS")}</p>
              <h1>{t(activeSection)}</h1>
            </div>
            <span className="admin-date-chip">{t("Is everything healthy?")}</span>
          </div>
          {(sectionRenderers[activeSection] ?? (() => null))()}
        </div>
      </section>

      {notice && <div className="admin-toast" role="status">{notice}</div>}
    </main>
  );
}

// ── Small shared components ────────────────────────────────────────────────────

function StatCard({ icon, tone, value, label }) {
  return (
    <article className="admin-stat-card">
      <span className={`admin-stat-icon ${tone}`}>
        <Icon name={icon} size={22} strokeWidth={1.6} />
      </span>
      <div><strong>{value}</strong><span>{label}</span></div>
    </article>
  );
}

function PanelHeading({ title }) {
  return <div className="admin-panel-heading"><h2>{title}</h2></div>;
}

function RetryBlock({ msg, onRetry, t }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "12px", margin: "0 0 16px",
      padding: "10px 14px", borderRadius: "8px", background: "#fff0f0", color: "#dc3545", fontSize: ".85rem" }}>
      <span>{msg}</span>
      <button type="button" onClick={onRetry}
        style={{ padding: "4px 12px", border: "1px solid #dc3545", borderRadius: "6px",
          background: "transparent", color: "#dc3545", cursor: "pointer", fontSize: ".82rem" }}>
        {t("Retry")}
      </button>
    </div>
  );
}
