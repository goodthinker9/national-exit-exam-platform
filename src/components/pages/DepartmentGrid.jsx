import { useLanguage } from "../../i18n/LanguageContext.jsx";

const departmentDetails = {
  "software-engineering": { icon: "</>", description: "Programming, data structures, networks, and more.", tone: "blue", image: "/banner1.png" },
  "computer-science": { icon: "▦", description: "Algorithms, systems, databases, software development.", tone: "green", image: "/images/banner2.png" },
  "electrical-engineering": { icon: "⚙", description: "Circuits, electronics, and power systems.", tone: "orange", image: "/images/banner3.png" },
  pharmacy: { icon: "⚗", description: "Pharmaceutical sciences and related subjects.", tone: "purple", image: "/banner1.png" },
  accounting: { icon: "▤", description: "Accounting subjects and related practice.", tone: "pink", image: "/images/banner2.png" },
};

export default function DepartmentGrid({ departments, onStart }) {
  const { t } = useLanguage();

  return (
    <div className="landing-department-grid">
      {departments.map((department) => {
        const detail = departmentDetails[department.id] || {
          icon: "▤",
          description: "Explore subjects and practice for your field.",
          tone: "blue",
          image: "/banner1.png",
        };

        return (
          <button
            className="landing-department-card"
            type="button"
            key={department.id}
            onClick={onStart}
            aria-label={`${t("Explore")} ${t(department.name)}`}
          >
            <span className="landing-department-image">
              <img src={detail.image} alt="" loading="lazy" />
            </span>
            <span className="landing-department-content">
              <span className={`landing-department-icon tone-${detail.tone}`} aria-hidden="true">{detail.icon}</span>
              <strong>{t(department.name)}</strong>
              <small>{t(detail.description)}</small>
              <span className="landing-department-action">
                {t("Explore subjects")} <b aria-hidden="true">→</b>
              </span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
