import { exitExamCourses, exitExamTree, remedialCourses } from "../data/courseGroups.js";

function getAncestors(nodeId) {
  const ancestors = [];
  let node = exitExamTree.find((item) => item.id === nodeId);
  while (node) {
    ancestors.push(node);
    node = node.parentId
      ? exitExamTree.find((item) => item.id === node.parentId)
      : null;
  }
  return ancestors;
}

export function getCoordinatorCourses(scope) {
  const normalizedScope = String(scope || "").trim().toLocaleLowerCase();
  if (!normalizedScope || normalizedScope === "unassigned" || normalizedScope === "all platform") {
    return [];
  }

  const remedialScope = normalizedScope.match(/^remedial(?:\s*:\s*|\s+)?(.*)$/);
  if (remedialScope) {
    const stream = remedialScope[1].trim();
    return remedialCourses.filter(
      (course) => !stream || course.stream.toLocaleLowerCase() === stream,
    );
  }

  const scopeNode = exitExamTree.find(
    (node) => node.name.toLocaleLowerCase() === normalizedScope,
  );
  if (!scopeNode) return [];

  return exitExamCourses.filter((course) =>
    course.departmentIds.some((departmentId) =>
      getAncestors(departmentId).some((node) => node.id === scopeNode.id),
    ),
  );
}
