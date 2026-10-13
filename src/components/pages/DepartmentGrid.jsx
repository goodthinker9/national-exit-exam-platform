import { useLanguage } from "../../i18n/LanguageContext.jsx";

const departmentDetails = {
  "software-engineering":  { icon: "</>", tone: "blue",   color: "#1675ff", bg: "#0d1f3c", subjects: 8  },
  "computer-science":      { icon: "▦",   tone: "green",  color: "#15b97a", bg: "#0d2e22", subjects: 7  },
  "electrical-engineering":{ icon: "⚙",   tone: "orange", color: "#e8961a", bg: "#2e1e07", subjects: 6  },
  pharmacy:                { icon: "⚗",   tone: "purple", color: "#9b59d9", bg: "#1f0f38", subjects: 9  },
  accounting:              { icon: "▤",   tone: "pink",   color: "#e53f73", bg: "#2e0f1a", subjects: 5  },
};

export default function DepartmentGrid({ departments, onStart }) {
  const { t } = useLanguage();

  return (
    <div className="dept-grid">
      {departments.map((department, index) => {
        const detail = departmentDetails[department.id] || {
          icon: "▤", tone: "blue", color: "#1675ff", bg: "#0d1f3c", subjects: 5,
        };

        return (
          <button
            className="dept-card"
            type="button"
            key={department.id}
            onClick={onStart}
            aria-label={`${t("Explore")} ${t(department.name)}`}
            style={{ "--dept-color": detail.color, "--dept-bg": detail.bg, animationDelay: `${index * 80}ms` }}
          >
            {/* left accent line */}
            <span className="dept-card-bar" aria-hidden="true" />

            {/* icon badge */}
            <span className="dept-card-icon" aria-hidden="true">{detail.icon}</span>

            {/* name + meta */}
            <span className="dept-card-body">
              <strong className="dept-card-name">{t(department.name)}</strong>
              <small className="dept-card-meta">{detail.subjects} {t("subjects")}</small>
            </span>

            {/* right tag + arrow */}
            <span className="dept-card-right">
              <span className="dept-card-tag">{t("Exit Exam")}</span>
              <span className="dept-card-arrow" aria-hidden="true">→</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
