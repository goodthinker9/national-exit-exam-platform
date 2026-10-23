/**
 * src/lib/progress.js
 *
 * Helpers for converting raw Supabase RPC rows into the shape the UI uses.
 */

export { getPracticeAnalytics } from "../utils/practiceAnalytics.js";

// ── Ethiopian timezone offset ──────────────────────────────────────────────────
// Ethiopia Standard Time is UTC+3 (no DST).
const ET_OFFSET_MS = 3 * 60 * 60 * 1000;

/** Return an Ethiopian calendar "day number" (floor of UTC ms + 3h offset, in days). */
function etDay(date) {
  return Math.floor((date.getTime() + ET_OFFSET_MS) / (24 * 60 * 60 * 1000));
}

/**
 * Convert a raw my_history RPC row to the shape all progress screens expect.
 *
 * @param {object} row            - Raw row from rpc('my_history')
 * @param {object} options
 * @param {Array}  options.allCourses  - Flat list of course objects (from useCourseTree)
 * @param {string} options.language    - Current app language code (e.g. 'en', 'am')
 * @returns {{ course, mode, score, correct, total, answered, date, tabSwitches }}
 */
export function rowToHistoryItem(row, { allCourses = [], language = "en" } = {}) {
  // ── mode label ──────────────────────────────────────────────────────────────
  let mode;
  if (row.mode === "mock") {
    mode = "Mock exam";
  } else {
    // Find the matching course in the course tree by uuid
    const course = allCourses.find((c) => c.dbId === row.course_id);
    mode = course?.examType === "Remedial" ? "Remedial practice" : "Practice";
  }

  // ── date label ──────────────────────────────────────────────────────────────
  const finishedDate = new Date(row.finished_at);
  const todayEt  = etDay(new Date());
  const finishEt = etDay(finishedDate);
  const diffDays = todayEt - finishEt;

  let date;
  if (diffDays === 0) {
    date = "Today";
  } else if (diffDays === 1) {
    date = "Yesterday";
  } else {
    const locale = language === "am" ? "am-ET" : "en-GB";
    date = finishedDate.toLocaleDateString(locale, { dateStyle: "medium" });
  }

  return {
    course:      row.course_name,
    mode,
    score:       `${row.correct}/${row.total}`,
    correct:     row.correct,
    total:       row.total,
    answered:    row.answered,
    date,
    tabSwitches: row.tab_switches ?? 0,
  };
}
