/**
 * src/lib/CourseTreeContext.jsx
 *
 * Fetches the course tree once at app start, caches it in sessionStorage,
 * and makes it available everywhere via useCourseTree().
 *
 * When the fetch fails:
 *   - isFallback: true is set in the context
 *   - Static data is used for display only
 *   - Components that need dbId to start an exam must check isFallback
 *     and disable their Start button (show "Course list unavailable. Retry")
 */

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { fetchCourseTree, clearCourseTreeCache } from "./courseTree.js";
import * as staticData from "../data/courseGroups.js";

// ── static placeholder (dbId: null on every item) ────────────────────────────
const STATIC_FALLBACK = {
  exitExamTree:    staticData.exitExamTree.map((n) => ({ ...n, dbId: null })),
  exitExamCourses: staticData.exitExamCourses.map((c) => ({ ...c, dbId: null })),
  courseGroups:    staticData.courseGroups,
  remedialCourses: staticData.remedialCourses.map((c) => ({ ...c, dbId: null })),
};

const CourseTreeContext = createContext({
  ...STATIC_FALLBACK,
  loading:    true,
  error:      null,
  isFallback: false,
  reload:     () => {},
});

// ── Provider ──────────────────────────────────────────────────────────────────

export function CourseTreeProvider({ children }) {
  const [tree,       setTree]       = useState(null);
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState(null);
  const [isFallback, setIsFallback] = useState(false);

  const load = useCallback(async (force = false) => {
    if (force) clearCourseTreeCache();
    setLoading(true);
    setError(null);
    try {
      const result = await fetchCourseTree();
      setTree(result);
      setIsFallback(false);
    } catch (err) {
      console.error("[CourseTree] fetch failed — using static fallback", err);
      setError(err.message ?? "Failed to load course tree");
      setIsFallback(true);   // ← key flag: all dbIds will be null
      setTree(null);          // show static data for display, dbId: null disables start
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const value = {
    ...(tree ?? STATIC_FALLBACK),
    loading,
    error,
    isFallback,
    reload: () => load(true),
  };

  return (
    <CourseTreeContext.Provider value={value}>
      {children}
    </CourseTreeContext.Provider>
  );
}

// ── Consumer hook ─────────────────────────────────────────────────────────────

/**
 * Returns:
 *   exitExamTree, exitExamCourses, courseGroups, remedialCourses
 *   loading    — true while the first fetch is in flight
 *   error      — error message string if fetch failed, otherwise null
 *   isFallback — true when showing static data because fetch failed;
 *                all dbIds are null; use this to disable "Start exam" buttons
 *   reload     — call to force a fresh fetch (clears cache first)
 */
export function useCourseTree() {
  return useContext(CourseTreeContext);
}

// ── Status banner (render this once above <Routes> in App.jsx) ────────────────

export function CourseTreeStatus() {
  const { loading, error, reload } = useCourseTree();

  if (!loading && !error) return null;

  const bannerStyle = {
    position:   "relative",
    zIndex:     50,
    display:    "flex",
    alignItems: "center",
    justifyContent: "center",
    gap:        "12px",
    padding:    "9px 20px",
    fontSize:   ".88rem",
    fontWeight: 500,
  };

  if (loading) {
    return (
      <div
        role="status"
        aria-live="polite"
        style={{ ...bannerStyle, background: "#e8f0ff", color: "#1675ff" }}
      >
        <span aria-hidden="true">⟳</span> Loading course list…
      </div>
    );
  }

  // error state
  return (
    <div
      role="alert"
      aria-live="assertive"
      style={{ ...bannerStyle, background: "#fff0f0", color: "#dc3545" }}
    >
      <span>Could not load the latest course list.</span>
      <button
        type="button"
        onClick={reload}
        style={{
          padding:      "4px 14px",
          border:       "1px solid #dc3545",
          borderRadius: "6px",
          background:   "transparent",
          color:        "#dc3545",
          fontSize:     ".82rem",
          fontWeight:   700,
          cursor:       "pointer",
          minHeight:    "30px",
        }}
      >
        Retry
      </button>
    </div>
  );
}
