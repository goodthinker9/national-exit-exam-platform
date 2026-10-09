import { useMemo, useState } from "react";
import { exitExamCourses, exitExamTree, remedialCourses } from "../../data/courseGroups.js";
import { useLanguage } from "../../i18n/LanguageContext.jsx";
import LanguageSwitcher from "../../i18n/LanguageSwitcher.jsx";
import "./AdminDashboard.css";

const TARGET_QUESTIONS_PER_COURSE = 60;
const adminSections = [
  ["Overview", "⌂"],
  ["Users and roles", "♙"],
  ["Content health", "▤"],
  ["System and audit", "⚙"],
  ["Announcements", "✉"],
];
const userRoles = [
  { value: "student", label: "Student" },
  { value: "instructor", label: "Instructor" },
  { value: "coordinator", label: "Coordinator" },
  { value: "admin", label: "Administrator" },
];
const emptyAccount = { name: "", role: "student", scope: "", assignedCourseIds: [] };

function formatDate(value) {
  if (!value) return "—";
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function getCourseCount(question, course) {
  return question.courseId === course.id
    || question.course === course.name
    || question.subject === course.name;
}

export default function AdminDashboard({
  questions,
  users,
  onUsersChange,
  currentUser,
  settings,
  onSettingsChange,
  announcements,
  onAnnouncementsChange,
  onLogout,
}) {
  const { t } = useLanguage();
  const [activeSection, setActiveSection] = useState("Overview");
  const [accountFormOpen, setAccountFormOpen] = useState(false);
  const [accountForm, setAccountForm] = useState(emptyAccount);
  const [accountError, setAccountError] = useState("");
  const [announcement, setAnnouncement] = useState("");
  const [lastBackupAt, setLastBackupAt] = useState(null);
  const [auditLog, setAuditLog] = useState([]);
  const [notice, setNotice] = useState("");

  const courses = useMemo(() => {
    const definedCourseNames = new Set(exitExamCourses.map((course) => course.name));
    const bankSubjects = [...new Set(questions.map((question) => question.subject).filter(Boolean))]
      .filter((subject) => !definedCourseNames.has(subject))
      .map((subject) => ({
        id: `subject-${subject.toLocaleLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
        name: subject,
        departmentIds: exitExamTree
          .filter((node) => node.type === "department" && node.name === subject)
          .map((node) => node.id),
      }));
    return [...exitExamCourses, ...bankSubjects];
  }, [questions]);
  const assignableCourses = [...courses, ...remedialCourses];
  const courseHealth = useMemo(
    () => courses.map((course) => ({
      ...course,
      publishedCount: questions.filter((question) => getCourseCount(question, course)).length,
    })),
    [courses, questions],
  );
  const departmentHealth = useMemo(
    () => exitExamTree.filter((node) => node.type === "department").map((department) => {
      const departmentCourses = courses.filter((course) => course.departmentIds.includes(department.id));
      const count = questions.filter((question) =>
        question.subject === department.name
        || departmentCourses.some((course) => getCourseCount(question, course)),
      ).length;
      return { ...department, publishedCount: count };
    }),
    [courses, questions],
  );
  const activeThisWeek = users.filter((account) => {
    if (account.status !== "Active" || !account.lastActiveAt) return false;
    return Date.now() - new Date(account.lastActiveAt).getTime() <= 7 * 24 * 60 * 60 * 1000;
  }).length;

  function recordAudit(action) {
    setAuditLog((entries) => [{
      id: `${Date.now()}-${Math.random()}`,
      at: new Date().toISOString(),
      actor: currentUser?.name || "Administrator",
      action,
    }, ...entries]);
  }

  function showNotice(message) {
    setNotice(message);
    window.setTimeout(() => setNotice(""), 3000);
  }

  function createAccount(event) {
    event.preventDefault();
    const name = accountForm.name.trim();
    const scope = accountForm.scope.trim();
    if (!name || !scope) {
      setAccountError(t("Enter a name and scope before creating the account."));
      return;
    }
    if (users.some((account) => account.name.toLocaleLowerCase() === name.toLocaleLowerCase())) {
      setAccountError(t("An account with this name already exists."));
      return;
    }
    const created = {
      id: `account-${Date.now()}`,
      name,
      role: accountForm.role,
      scope,
      assignedCourseIds: accountForm.assignedCourseIds,
      status: "Active",
      lastActiveAt: null,
      passwordResetRequested: false,
    };
    onUsersChange((current) => [created, ...current]);
    setAccountForm(emptyAccount);
    setAccountFormOpen(false);
    setAccountError("");
    recordAudit(`Created ${created.role === "admin" ? "Administrator" : created.role} account for ${created.name} (${created.scope})`);
    showNotice(t("Account record created. Connect an authentication provider to provision credentials."));
  }

  function toggleAccountStatus(account) {
    if (account.id === currentUser?.id && account.status === "Active") {
      showNotice(t("You cannot deactivate your own active administrator account."));
      return;
    }
    const nextStatus = account.status === "Active" ? "Inactive" : "Active";
    onUsersChange((current) => current.map((item) =>
      item.id === account.id ? { ...item, status: nextStatus } : item,
    ));
    recordAudit(`${nextStatus === "Active" ? "Reactivated" : "Deactivated"} account ${account.name}`);
  }

  function updateAccount(account, updates) {
    onUsersChange((current) => current.map((item) =>
      item.id === account.id ? { ...item, ...updates } : item,
    ));
    const changedField = updates.role ? "role" : "scope";
    recordAudit(`Updated ${changedField} for ${account.name}`);
  }

  function requestPasswordReset(account) {
    onUsersChange((current) => current.map((item) =>
      item.id === account.id ? { ...item, passwordResetRequested: true } : item,
    ));
    recordAudit(`Requested password reset for ${account.name}`);
    showNotice(t("Reset requested. The authentication provider must complete the password reset."));
  }

  function publishAnnouncement(event) {
    event.preventDefault();
    const message = announcement.trim();
    if (!message) return;
    const nextAnnouncement = {
      id: `announcement-${Date.now()}`,
      message,
      at: new Date().toISOString(),
      author: currentUser?.name || "Administrator",
      audience: "all",
    };
    onAnnouncementsChange((items) => [nextAnnouncement, ...items]);
    setAnnouncement("");
    recordAudit("Published an announcement to all students");
  }

  function updateSetting(key, value) {
    onSettingsChange((previous) => ({ ...previous, [key]: value }));
    recordAudit(`Updated ${key === "mockMinutes" ? "mock exam time limit" : "retake rules"}`);
  }

  function downloadBackup() {
    const backup = {
      generatedAt: new Date().toISOString(),
      questions,
      users: users.map(({ id, name, role, scope, assignedCourseIds, status, lastActiveAt }) => ({
        id,
        name,
        role,
        scope,
        assignedCourseIds,
        status,
        lastActiveAt,
      })),
      settings,
      announcements,
    };
    const file = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(file);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `exitprep-backup-${new Date().toISOString().slice(0, 10)}.json`;
    anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
    setLastBackupAt(new Date().toISOString());
    recordAudit("Downloaded a platform data backup");
    showNotice(t("Backup downloaded to this device."));
  }

  function renderOverview() {
    return (
      <>
        <section className="admin-stat-grid" aria-label={t("Platform health overview")}>
          <StatCard icon="♙" tone="student-icon" value={users.filter((item) => item.role.toLocaleLowerCase() === "student").length} label={t("Registered students")} />
          <StatCard icon="◷" tone="exam-icon" value={activeThisWeek} label={t("Active this week")} />
          <StatCard icon="▤" tone="question-icon" value={questions.length} label={t("Published questions")} />
          <StatCard icon="!" tone="result-icon" value={courseHealth.filter((course) => course.publishedCount < TARGET_QUESTIONS_PER_COURSE / 2).length} label={t("Courses below 50%")} />
        </section>
        <section className="admin-panel admin-overview-health">
          <PanelHeading title={t("Questions per department")} />
          <div className="admin-table-scroll">
            <table>
              <thead><tr><th>{t("Department")}</th><th>{t("Published questions")}</th></tr></thead>
              <tbody>
                {departmentHealth.map((department) => (
                  <tr key={department.id}>
                    <td>{t(department.name)}</td>
                    <td>{department.publishedCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="admin-inline-note">{t("Counts are derived from the sample question bank and its course or subject links.")}</p>
        </section>
      </>
    );
  }

  function renderUsers() {
    return (
      <section className="admin-panel">
        <div className="admin-panel-heading">
          <h2>{t("Users and roles")}</h2>
          <button className="admin-primary-button" type="button" onClick={() => {
            setAccountFormOpen((open) => !open);
            setAccountError("");
          }}>
            {accountFormOpen ? t("Cancel") : `＋ ${t("Create account")}`}
          </button>
        </div>
        {accountFormOpen && (
          <form className="admin-account-form" onSubmit={createAccount}>
            <label>{t("Name")}<input value={accountForm.name} onChange={(event) => setAccountForm((form) => ({ ...form, name: event.target.value }))} required /></label>
            <label>{t("Role")}
              <select value={accountForm.role} onChange={(event) => setAccountForm((form) => ({ ...form, role: event.target.value }))}>
                {userRoles.map((role) => <option key={role.value} value={role.value}>{t(role.label)}</option>)}
              </select>
            </label>
            <label>{t("Scope (stream, field, department, or all platform)")}<input value={accountForm.scope} onChange={(event) => setAccountForm((form) => ({ ...form, scope: event.target.value }))} required /></label>
            <label>{t("Assigned courses")}
              <select
                multiple
                size="4"
                value={accountForm.assignedCourseIds}
                onChange={(event) => setAccountForm((form) => ({
                  ...form,
                  assignedCourseIds: [...event.target.selectedOptions].map((option) => option.value),
                }))}
              >
                {assignableCourses.map((course) => <option key={course.id} value={course.id}>{t(course.name)}{course.examType === "Remedial" ? ` · ${t(course.stream)}` : ""}</option>)}
              </select>
            </label>
            <button className="admin-primary-button" type="submit">{t("Create account")}</button>
            {accountError && <p className="admin-form-error" role="alert">{accountError}</p>}
            <p className="admin-inline-note">{t("Demo only: this creates account metadata. Authentication credentials require a connected identity provider.")}</p>
          </form>
        )}
        <div className="admin-table-scroll">
          <table>
            <thead><tr><th>{t("Name")}</th><th>{t("Role")}</th><th>{t("Scope")}</th><th>{t("Assigned courses")}</th><th>{t("Status")}</th><th>{t("Actions")}</th></tr></thead>
            <tbody>
              {users.map((account) => (
                <tr key={account.id}>
                  <td>{account.name}</td>
                  <td>
                    <select
                      aria-label={t("Role for {name}", { name: account.name })}
                      value={account.role.toLocaleLowerCase() === "administrator" ? "admin" : account.role.toLocaleLowerCase()}
                      disabled={account.id === currentUser?.id && ["admin", "administrator"].includes(account.role.toLocaleLowerCase())}
                      onChange={(event) => updateAccount(account, { role: event.target.value })}
                    >
                      {userRoles.map((role) => <option key={role.value} value={role.value}>{t(role.label)}</option>)}
                    </select>
                  </td>
                  <td>
                    <input
                      aria-label={t("Scope for {name}", { name: account.name })}
                      defaultValue={account.scope || "Unassigned"}
                      onBlur={(event) => {
                        const scope = event.target.value.trim() || "Unassigned";
                        event.target.value = scope;
                        if (scope !== account.scope) updateAccount(account, { scope });
                      }}
                    />
                  </td>
                  <td>
                    <select
                      multiple
                      size="2"
                      aria-label={t("Assigned courses for {name}", { name: account.name })}
                      value={account.assignedCourseIds || []}
                      onChange={(event) => updateAccount(account, {
                        assignedCourseIds: [...event.target.selectedOptions].map((option) => option.value),
                      })}
                    >
                      {assignableCourses.map((course) => <option key={course.id} value={course.id}>{t(course.name)}{course.examType === "Remedial" ? ` · ${t(course.stream)}` : ""}</option>)}
                    </select>
                  </td>
                  <td><span className={`admin-status ${account.status === "Active" ? "active" : "inactive"}`}>{t(account.status)}</span></td>
                  <td className="admin-row-actions">
                    <button type="button" onClick={() => toggleAccountStatus(account)} disabled={account.id === currentUser?.id && account.status === "Active"}>
                      {t(account.status === "Active" ? "Deactivate" : "Activate")}
                    </button>
                    <button type="button" onClick={() => requestPasswordReset(account)}>
                      {t(account.passwordResetRequested ? "Reset requested" : "Reset password")}
                    </button>
                  </td>
                </tr>
              ))}
              {users.length === 0 && <tr><td colSpan="6">{t("No accounts have been recorded in this session.")}</td></tr>}
            </tbody>
          </table>
        </div>
        <p className="admin-inline-note">{t("Only account details needed for support are shown. Passwords are never displayed.")}</p>
      </section>
    );
  }

  function renderContentHealth() {
    return (
      <section className="admin-panel">
        <PanelHeading title={t("Published questions per course")} />
        <p className="admin-section-description">{t("Target: {count} published questions per course.", { count: TARGET_QUESTIONS_PER_COURSE })}</p>
        <div className="admin-table-scroll">
          <table>
            <thead><tr><th>{t("Course")}</th><th>{t("Departments")}</th><th>{t("Published questions")}</th><th>{t("Target")}</th><th>{t("Health")}</th></tr></thead>
            <tbody>
              {courseHealth.map((course) => {
                const percentage = Math.min(100, Math.round(course.publishedCount / TARGET_QUESTIONS_PER_COURSE * 100));
                const isLow = course.publishedCount < TARGET_QUESTIONS_PER_COURSE / 2;
                return (
                  <tr className={isLow ? "admin-course-low" : ""} key={course.id}>
                    <td>{t(course.name)}</td>
                    <td>{course.departmentIds.map((id) => exitExamTree.find((node) => node.id === id)?.name).filter(Boolean).map(t).join(", ") || "—"}</td>
                    <td>{course.publishedCount}</td><td>{TARGET_QUESTIONS_PER_COURSE}</td>
                    <td><span className={`admin-health-pill${isLow ? " low" : ""}`}>{percentage}% · {t(isLow ? "Below target" : "On track")}</span></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="admin-inline-note">{t("Courses under 50% of the target are highlighted in red. Current bank items are counted as published in this demo.")}</p>
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
              <span><input type="number" min="1" max="300" value={settings.mockMinutes} onChange={(event) => updateSetting("mockMinutes", Math.max(1, Number(event.target.value) || 1))} /> {t("minutes")}</span>
            </label>
            <label className="admin-setting-control">
              <span>{t("Retake rules")}</span>
              <select value={settings.retakeRule} onChange={(event) => updateSetting("retakeRule", event.target.value)}>
                {["No retakes", "One retake", "Two retakes", "Unlimited retakes"].map((rule) => <option key={rule}>{t(rule)}</option>)}
              </select>
            </label>
          </div>
          <div className="admin-backup-card">
            <PanelHeading title={t("Backup status")} />
            <p><strong>{lastBackupAt ? t("Backup downloaded") : t("No backup downloaded this session")}</strong></p>
            <p className="admin-inline-note">{lastBackupAt ? formatDate(lastBackupAt) : t("Backups are generated as a local JSON download in this demo.")}</p>
            <button className="admin-primary-button" type="button" onClick={downloadBackup}>{t("Back up now")}</button>
          </div>
        </section>
        <section className="admin-panel">
          <PanelHeading title={t("Audit log")} />
          <div className="admin-table-scroll">
            <table>
              <thead><tr><th>{t("When")}</th><th>{t("Who")}</th><th>{t("Action")}</th></tr></thead>
              <tbody>
                {auditLog.map((entry) => <tr key={entry.id}><td>{formatDate(entry.at)}</td><td>{entry.actor}</td><td>{t(entry.action)}</td></tr>)}
                {auditLog.length === 0 && <tr><td colSpan="3">{t("No administrative actions recorded in this session.")}</td></tr>}
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
        <form className="admin-announcement-form" onSubmit={publishAnnouncement}>
          <label htmlFor="admin-announcement">{t("Announcement message")}</label>
          <textarea id="admin-announcement" value={announcement} onChange={(event) => setAnnouncement(event.target.value)} rows="4" maxLength="500" placeholder={t("Write an announcement for all students...")} />
          <div className="admin-announcement-footer">
            <small>{announcement.length}/500</small>
            <button className="admin-primary-button" type="submit" disabled={!announcement.trim()}>{t("Send to all students")}</button>
          </div>
        </form>
        <div className="admin-announcement-list">
          {announcements.map((item) => (
            <article className="admin-announcement" key={item.id}>
              <p>{item.message}</p><small>{item.author} · {formatDate(item.at)} · {t("All students")}</small>
            </article>
          ))}
          {announcements.length === 0 && <p className="admin-inline-note">{t("No announcements have been sent in this session.")}</p>}
        </div>
      </section>
    );
  }

  const sectionRenderers = {
    Overview: renderOverview,
    "Users and roles": renderUsers,
    "Content health": renderContentHealth,
    "System and audit": renderSystemAudit,
    Announcements: renderAnnouncements,
  };

  return (
    <main className="admin-dashboard">
      <aside className="admin-sidebar">
        <a className="admin-brand" href="#admin-dashboard" aria-label={t("ExitPrep admin dashboard")}>
          <span aria-hidden="true">✦</span> ExitPrep
        </a>
        <nav className="admin-nav" aria-label={t("Administrator navigation")}>
          {adminSections.map(([label, icon]) => (
            <button
              className={activeSection === label ? "active" : ""}
              type="button"
              key={label}
              aria-current={activeSection === label ? "page" : undefined}
              onClick={() => setActiveSection(label)}
            >
              <span aria-hidden="true">{icon}</span>{t(label)}
            </button>
          ))}
        </nav>
        <div className="admin-sidebar-footer"><span aria-hidden="true">●</span> {t("Platform operations")}</div>
      </aside>

      <section className="admin-workspace" id="admin-dashboard">
        <header className="admin-topbar">
          <div className="admin-mobile-brand"><span aria-hidden="true">✦</span> ExitPrep</div>
          <div className="admin-topbar-actions">
            <LanguageSwitcher />
            <div className="admin-profile">
              <span className="admin-profile-avatar" aria-hidden="true">{currentUser?.name?.slice(0, 1) || "A"}</span>
              <button type="button" onClick={onLogout} aria-label={t("Sign out")}>
                {currentUser?.name || t("Administrator")} <span aria-hidden="true">⌄</span>
              </button>
            </div>
          </div>
        </header>
        <div className="admin-dashboard-content">
          <div className="admin-page-heading">
            <div><p className="admin-eyebrow">{t("PLATFORM OPERATIONS")}</p><h1>{t(activeSection)}</h1></div>
            <span className="admin-date-chip">{t("Is everything healthy?")}</span>
          </div>
          {sectionRenderers[activeSection]()}
          <p className="admin-demo-note">{t("Demo dashboard: account, settings, audit, and announcement changes are held in this browser session; production actions need secured server services.")}</p>
        </div>
      </section>
      {notice && <div className="admin-toast" role="status">{notice}</div>}
    </main>
  );
}

function StatCard({ icon, tone, value, label }) {
  return (
    <article className="admin-stat-card">
      <span className={`admin-stat-icon ${tone}`} aria-hidden="true">{icon}</span>
      <div><strong>{value}</strong><span>{label}</span></div>
    </article>
  );
}

function PanelHeading({ title }) {
  return <div className="admin-panel-heading"><h2>{title}</h2></div>;
}
