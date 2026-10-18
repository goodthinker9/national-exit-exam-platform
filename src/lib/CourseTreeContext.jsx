/**
 * src/lib/CourseTreeContext.jsx
 *
 * Fetches the course tree once at app start, caches it in sessionStorage,
 * and makes it available everywhere via useCourseTree().
 *
 * Falls back to static data (src/data/courseGroups.js) when Supabase is
 * not configured or the fetch fails.
 */

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { fetchCourseTree, clearCourseTreeCache } from "./courseTree.js";
import * as staticData from "../data/courseGroups.js";

// ── default (static) value used before the first fetch completes ──────────────
const STATIC_DEFAULT = {
  exitExamTree:    staticData.exitExamTree.map((n) => ({ ...n, dbId: null })),
  exitExamCourses: staticData.exitExamCourses.map((c) => ({ ...c, dbId: null })),
  courseGroups:    staticData.courseGroups,
  remedialCourses: staticData.remedialCourses.map((c) => ({ ...c, dbId: null })),
  loading:         true,
  error:           null,
  reload:          () => {},
};

const CourseTreeContext = createContext(STATIC_DEFAULT);

// ── Provider ──────────────────────────────────────────────────────────────────

export function CourseTreeProvider({ children }) {
  const [tree, setTree] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async (force = false) => {
    if (force) clearCourseTreeCache();
    setLoading(true);
    setError(null);
    try {
      const result = await fetchCourseTree();
      setTree(result);
    } catch (err) {
      console.error("[CourseTree] fetch failed — using static fallback", err);
      setError(err.message ?? "Failed to load course tree");
      // Keep showing static data rather than a blank page
      setTree(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const value = {
    ...(tree ?? STATIC_DEFAULT),
    loading,
    error,
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
 * Returns { exitExamTree, exitExamCourses, courseGroups, remedialCourses, loading, error, reload }.
 * During loading, the static data is returned as a placeholder so components
 * render immediately (with a subtle shimmer if needed).
 */
export function useCourseTree() {
  return useContext(CourseTreeContext);
}

// ── Loading / error UI ────────────────────────────────────────────────────────

export function CourseTreeStatus() {
  const { loading, error, reload } = useCourseTree();
  if (!loading && !error) return null;
  if (loading) return (
    <div
      role="status"
      aria-live="polite"
      style={{
        padding: "8px 16px",
        background: "#e8f0ff",
        color: "#1675ff",
        fontSize: ".85rem",
        textAlign: "center",
      }}
    >
      Loading course list…
    </div>
  );
  return (
    <div
      role="alert"
      style={{
        padding: "10px 16px",
        background: "#fff0f0",
        color: "#dc3545",
        fontSize: ".85rem",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: "12px",
      }}
    >
      <span>Could not load the latest course list. Showing cached data.</span>
      <button
        type="button"
        onClick={reload}
        style={{
          padding: "4px 12px",
          border: "1px solid #dc3545",
          borderRadius: "6px",
          background: "transparent",
          color: "#dc3545",
          fontSize: ".82rem",
          cursor: "pointer",
        }}
      >
        Retry
      </button>
    </div>
  );
}
