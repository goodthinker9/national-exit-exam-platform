/**
 * WeakTopics.jsx
 *
 * Shared component used in both ProgressPanel and AnalyticsPage.
 * Displays up to 5 weak topics with a Practice button for each.
 */

export default function WeakTopics({ weakTopics = [], onPracticeCourse, t }) {
  const visible = weakTopics.slice(0, 5);

  if (!visible.length) {
    return (
      <p className="muted" aria-live="polite">
        {t("No weak topics yet. Answer at least 3 questions in a topic and it will show here if you need more practice.")}
      </p>
    );
  }

  return (
    <ul className="weak-topics-list" aria-label={t("Weak topics")}>
      {visible.map((item) => (
        <li className="weak-topic-row" key={`${item.course_id}-${item.topic}`}>
          <span className="weak-topic-info">
            <strong>{item.topic}</strong>
            <small>{item.course_name}</small>
            <small>{item.pct}% · {item.correct} {t("of")} {item.answered} {t("correct")}</small>
          </span>
          <button
            type="button"
            className="button button-sm weak-topic-practice-btn"
            style={{ minHeight: "44px" }}
            aria-label={t("Practice {topic}", { topic: item.topic })}
            onClick={() => onPracticeCourse?.(item.course_id)}
          >
            {t("Practice")}
          </button>
        </li>
      ))}
    </ul>
  );
}
