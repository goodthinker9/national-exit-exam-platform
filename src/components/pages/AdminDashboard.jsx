import { useLanguage } from "../../i18n/LanguageContext.jsx";
import LanguageSwitcher from "../../i18n/LanguageSwitcher.jsx";
import "./AdminDashboard.css";

const remedialStudents = [
  { name: "Abebe", subject: "Networking", score: 42 },
  { name: "Sara", subject: "Database", score: 45 },
  { name: "Mekdes", subject: "Operating System", score: 48 },
  { name: "Tesfaye", subject: "Networking", score: 51 },
  { name: "Lidya", subject: "Database", score: 56 },
];

const sidebarItems = [
  ["Dashboard", "⌂", true],
  ["Questions", "▤"],
  ["Subjects", "▧"],
  ["Exams", "▣"],
  ["Students", "♙"],
  ["Results", "▥"],
  ["Remedial", "✦"],
  ["Settings", "⚙"],
];

export default function AdminDashboard({ questions, onLogout, onComingSoon, onManageQuestions }) {
  const { t } = useLanguage();

  return (
    <main className="admin-dashboard">
      <aside className="admin-sidebar">
        <a className="admin-brand" href="#admin-dashboard" aria-label={t("ExitPrep admin dashboard")}>
          <span aria-hidden="true">✦</span> ExitPrep
        </a>
        <nav className="admin-nav" aria-label={t("Administrator navigation")}>
          {sidebarItems.map(([label, icon, active]) => (
            <a
              className={active ? "active" : ""}
              href={active ? "#admin-dashboard" : "#admin-dashboard"}
              key={label}
              aria-current={active ? "page" : undefined}
              onClick={active ? undefined : (event) => {
                event.preventDefault();
                if (label === "Questions") onManageQuestions();
                else onComingSoon();
              }}
              title={t(label)}
            >
              <span aria-hidden="true">{icon}</span>{t(label)}
            </a>
          ))}
        </nav>
        <div className="admin-sidebar-footer">
          <span aria-hidden="true">●</span> {t("Administration")}
        </div>
      </aside>

      <section className="admin-workspace" id="admin-dashboard">
        <header className="admin-topbar">
          <div className="admin-mobile-brand"><span aria-hidden="true">✦</span> ExitPrep</div>
          <div className="admin-topbar-actions">
            <LanguageSwitcher />
            <div className="admin-profile">
              <span className="admin-profile-avatar" aria-hidden="true">A</span>
              <button type="button" onClick={onLogout} aria-label={t("Sign out")}>
                {t("Admin")} <span aria-hidden="true">⌄</span>
              </button>
            </div>
          </div>
        </header>

        <div className="admin-dashboard-content">
          <div className="admin-page-heading">
            <div>
              <p className="admin-eyebrow">{t("ADMINISTRATION")}</p>
              <h1>{t("Dashboard")}</h1>
            </div>
            <span className="admin-date-chip">{t("Academic overview")}</span>
          </div>

          <section className="admin-stat-grid" aria-label={t("Dashboard statistics")}>
            <article className="admin-stat-card">
              <span className="admin-stat-icon student-icon" aria-hidden="true">♙</span>
              <div><strong>1,245</strong><span>{t("Students")}</span></div>
            </article>
            <article className="admin-stat-card">
              <span className="admin-stat-icon question-icon" aria-hidden="true">▤</span>
              <div><strong>2,450</strong><span>{t("Questions")}</span></div>
            </article>
            <article className="admin-stat-card">
              <span className="admin-stat-icon exam-icon" aria-hidden="true">▣</span>
              <div><strong>35</strong><span>{t("Exams")}</span></div>
            </article>
            <article className="admin-stat-card">
              <span className="admin-stat-icon result-icon" aria-hidden="true">⌖</span>
              <div><strong>8,920</strong><span>{t("Results")}</span></div>
            </article>
          </section>

          <section className="admin-dashboard-panels">
            <article className="admin-panel admin-questions-overview">
              <div className="admin-panel-heading">
                <h2>{t("Questions Overview")}</h2>
                <span aria-hidden="true">•••</span>
              </div>
              <div className="admin-table-scroll">
                <table>
                  <thead><tr>
                    <th>{t("Subject")}</th>
                    <th>{t("Topic")}</th>
                    <th>{t("Difficulty")}</th>
                  </tr></thead>
                  <tbody>
                    {questions.slice(0, 5).map((row) => (
                      <tr key={`${row.subject}-${row.topic}`}>
                        <td>{t(row.subject)}</td>
                        <td>{t(row.topic)}</td>
                        <td><span className={`admin-difficulty ${row.difficulty.toLowerCase()}`}>{t(row.difficulty)}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <button className="admin-add-question" type="button" onClick={onManageQuestions}>
                <span aria-hidden="true">＋</span> {t("Add Question")}
              </button>
            </article>

            <article className="admin-panel admin-remedial-panel">
              <div className="admin-panel-heading">
                <h2>{t("Students Needing Remedial")}</h2>
                <span className="admin-remedial-count">5</span>
              </div>
              <div className="admin-table-scroll">
                <table>
                  <thead><tr>
                    <th>{t("Student")}</th>
                    <th>{t("Weak Subject")}</th>
                    <th>{t("Score")}</th>
                  </tr></thead>
                  <tbody>
                    {remedialStudents.map((student) => (
                      <tr key={student.name}>
                        <td>{t(student.name)}</td>
                        <td>{t(student.subject)}</td>
                        <td><span className={`admin-score ${student.score < 50 ? "low" : "watch"}`}>{student.score}%</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </article>
          </section>

          <p className="admin-demo-note">{t("Dashboard figures and student information are sample data for this demo.")}</p>
        </div>
      </section>
    </main>
  );
}
