import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useLanguage } from "../../i18n/LanguageContext.jsx";
import { useCourseTree } from "../../lib/CourseTreeContext.jsx";
import {
  adminListUsers, adminOverview, adminSetUser,
  adminSetSetting, adminAudit,
} from "../../lib/supabase.js";
import { uiToDb, dbToUi } from "../../lib/retakeMapping.js";
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
  "user.update":     "Changed account",
  "settings.update": "Changed setting",
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
  announcements,
  onAnnouncementsChange,
  currentUser,
  settings,         // { mockMinutes, retakeRule } — loaded from DB in App.jsx
  onSettingsChange, // (newSettings) -> void — updates App state after a successful save
  onLoadUsers,      // () -> Promise<void>  — triggers adminListUsers() in App
  users,            // current admin user list from App state
  onUsersChange,    // updates App adminUsers state
  onLogout,
}) {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const { exitExamTree, exitExamCourses, remedialCourses } = useCourseTree();

  const [activeSection, setActiveSection] = useState("Overview");

  // ── Users section state ───────────────────────────────────────────────────
  const [usersLoading, setUsersLoading] = useState(false);
  const [usersError,   setUsersError]   = useState(null);
  // Pending role/status edits (per user id) before sending to server
  const [pendingRole,   setPendingRole]   = useState({});  // { [userId]: role }
  const [savingUser,    setSavingUser]    = useState(null); // userId being saved

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

  // ── Announcements state ───────────────────────────────────────────────────
  const [announcement, setAnnouncement] = useState("");

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
    if (activeSection === "Users and roles") loadUsers();
    if (activeSection === "Overview" || activeSection === "Content health") loadOverview();
    if (activeSection === "System and audit") loadAudit();
  }, [activeSection, loadUsers, loadOverview, loadAudit]);

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
    return allCourses.map((course) => ({
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

  function publishAnnouncement(event) {
    event.preventDefault();
    const message = announcement.trim();
    if (!message) return;
    onAnnouncementsChange((items) => [{
      id: `announcement-${Date.now()}`,
      message,
      at: new Date().toISOString(),
      author: currentUser?.name || "Administrator",
      audience: "all",
    }, ...items]);
    setAnnouncement("");
    showNotice(t("Announcement sent."));
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
          <button className="admin-primary-button" type="button" onClick={loadUsers}
            disabled={usersLoading} aria-label={t("Reload users")}>
            {usersLoading ? t("Loading…") : t("Reload")}
          </button>
        </div>

        {/* Replace create-account form with a note */}
        <p className="admin-inline-note" style={{ marginBottom: "16px" }}>
          {t("New staff sign up on the register page first. Then change their role here.")}
        </p>

        {usersError && <RetryBlock msg={usersError} onRetry={loadUsers} t={t} />}

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
                      {/* Apply role change */}
                      {pending !== account.role && (
                        <button type="button" disabled={savingUser === account.id}
                          onClick={() => applyUserChange(account, { role: pending, status: account.status === "Active" ? "active" : "inactive" })}>
                          {savingUser === account.id ? t("Saving…") : t("Save role")}
                        </button>
                      )}
                      {/* Toggle status */}
                      <button type="button"
                        disabled={isSelf || savingUser === account.id}
                        title={isSelf ? t("You cannot deactivate your own account") : undefined}
                        onClick={() => applyUserChange(account, {
                          role: account.role,
                          status: account.status === "Active" ? "inactive" : "active",
                        })}>
                        {t(account.status === "Active" ? "Deactivate" : "Activate")}
                      </button>
                      {/* Password reset — coming soon */}
                      <button type="button" disabled title={t("Coming soon")}>
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
        <p className="admin-inline-note">{t("Passwords are never shown. Use the register page to create new accounts.")}</p>
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
    return (
      <section className="admin-panel">
        <PanelHeading title={t("Announcements to all students")} />
        <p className="admin-inline-note">{t("Announcements are not yet connected to the database. They are held in this browser session.")}</p>
        <form className="admin-announcement-form" onSubmit={publishAnnouncement}>
          <label htmlFor="admin-announcement">{t("Announcement message")}</label>
          <textarea id="admin-announcement" value={announcement}
            onChange={(e) => setAnnouncement(e.target.value)}
            rows="4" maxLength="500" placeholder={t("Write an announcement for all students...")} />
          <div className="admin-announcement-footer">
            <small>{announcement.length}/500</small>
            <button className="admin-primary-button" type="submit" disabled={!announcement.trim()}>
              {t("Send to all students")}
            </button>
          </div>
        </form>
        <div className="admin-announcement-list">
          {announcements.map((item) => (
            <article className="admin-announcement" key={item.id}>
              <p>{item.message}</p>
              <small>{item.author} · {formatDate(item.at)}</small>
            </article>
          ))}
          {announcements.length === 0 && (
            <p className="admin-inline-note">{t("No announcements sent in this session.")}</p>
          )}
        </div>
      </section>
    );
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
