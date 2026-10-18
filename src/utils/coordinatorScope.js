/**
 * coordinatorScope.js
 *
 * All functions now accept the live tree as their last argument so they
 * work with data from CourseTreeContext (which may come from Supabase).
 *
 * Backward-compatible: if you don't pass tree/courses they fall back to
 * the static import, keeping any callers that haven't been updated yet.
 */

import {
  exitExamCourses as _staticCourses,
  exitExamTree    as _staticTree,
  remedialCourses as _staticRemedial,
} from "../data/courseGroups.js";

// ── private helper ─────────────────────────────────────────────────────────

function getAncestors(nodeId, tree) {
  const ancestors = [];
  let node = tree.find((item) => item.id === nodeId);
  while (node) {
    ancestors.push(node);
    node = node.parentId
      ? tree.find((item) => item.id === node.parentId)
      : null;
  }
  return ancestors;
}

// ── public API ─────────────────────────────────────────────────────────────

/**
 * Returns the courses visible to a coordinator / instructor with the given scope.
 *
 * @param {string} scope            e.g. "engineering", "remedial: natural science", "all platform"
 * @param {object} [treeData]       from useCourseTree() — optional, falls back to static
 */
export function getCoordinatorCourses(scope, treeData) {
  const tree       = treeData?.exitExamTree    ?? _staticTree;
  const courses    = treeData?.exitExamCourses ?? _staticCourses;
  const remedial   = treeData?.remedialCourses ?? _staticRemedial;

  const normalizedScope = String(scope || "").trim().toLocaleLowerCase();

  if (!normalizedScope || normalizedScope === "unassigned" || normalizedScope === "all platform") {
    return [];
  }

  // "remedial" or "remedial: natural science"
  const remedialMatch = normalizedScope.match(/^remedial(?:\s*:\s*|\s+)?(.*)$/);
  if (remedialMatch) {
    const stream = remedialMatch[1].trim();
    return remedial.filter(
      (course) => !stream || course.stream.toLocaleLowerCase() === stream,
    );
  }

  const scopeNode = tree.find(
    (node) => node.name.toLocaleLowerCase() === normalizedScope,
  );
  if (!scopeNode) return [];

  return courses.filter((course) =>
    course.departmentIds.some((departmentId) =>
      getAncestors(departmentId, tree).some((node) => node.id === scopeNode.id),
    ),
  );
}
