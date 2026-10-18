/**
 * src/lib/courseTree.js
 *
 * fetchCourseTree()  — queries Supabase (tree_nodes, courses, node_courses)
 * and returns objects in EXACTLY the shapes the UI already expects, using
 * slugs as ids so FIELD_META, coordinatorScope.js, etc. all keep working.
 *
 * Static fallback: if Supabase is not configured or the query fails, we
 * return the data from src/data/courseGroups.js unchanged.
 */

import { supabase, isSupabaseConfigured } from "./supabase.js";
import * as staticData from "../data/courseGroups.js";

const CACHE_KEY = "wep_course_tree_v1";
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// ── helpers ───────────────────────────────────────────────────────────────────

function readCache() {
  try {
    const raw = sessionStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const { data, ts } = JSON.parse(raw);
    if (Date.now() - ts > CACHE_TTL) { sessionStorage.removeItem(CACHE_KEY); return null; }
    return data;
  } catch { return null; }
}

function writeCache(data) {
  try { sessionStorage.setItem(CACHE_KEY, JSON.stringify({ data, ts: Date.now() })); }
  catch { /* storage full — ignore */ }
}

export function clearCourseTreeCache() {
  try { sessionStorage.removeItem(CACHE_KEY); } catch { /* ignore */ }
}

// ── main fetch ────────────────────────────────────────────────────────────────

/**
 * Returns:
 *  {
 *    exitExamTree,     // [{id:slug, dbId:uuid, type:kind, name, parentId:parent-slug|null}]
 *    exitExamCourses,  // [{id:code, dbId:uuid, name, departmentIds:[dept-slugs], examType}]
 *    courseGroups,     // { Remedial: { "<stream name>": [course names] } }
 *    remedialCourses,  // [{id, dbId, name, stream, examType}]
 *  }
 */
export async function fetchCourseTree() {
  // 1. Cache hit
  const cached = readCache();
  if (cached) return cached;

  // 2. No Supabase — use static data
  if (!isSupabaseConfigured || !supabase) {
    return buildStaticResult();
  }

  // 3. Fetch from Supabase
  const [nodesRes, coursesRes, junctionRes] = await Promise.all([
    supabase
      .from("tree_nodes")
      .select("id, exam, kind, parent_id, name, slug, sort_order")
      .eq("is_active", true)
      .order("sort_order"),
    supabase
      .from("courses")
      .select("id, code, name")
      .eq("is_active", true),
    supabase
      .from("node_courses")
      .select("node_id, course_id"),
  ]);

  if (nodesRes.error) throw new Error(`tree_nodes: ${nodesRes.error.message}`);
  if (coursesRes.error) throw new Error(`courses: ${coursesRes.error.message}`);
  if (junctionRes.error) throw new Error(`node_courses: ${junctionRes.error.message}`);

  const result = buildResult(nodesRes.data, coursesRes.data, junctionRes.data);
  writeCache(result);
  return result;
}

// ── transform raw DB rows into the UI-expected shapes ─────────────────────────

function buildResult(nodes, courses, junctions) {
  // Index for fast look-up  uuid → node
  const byId   = new Map(nodes.map((n) => [n.id,   n]));
  const bySlug = new Map(nodes.map((n) => [n.slug, n]));

  // Parent slug look-up: given a node, return the slug of its parent
  function parentSlug(node) {
    if (!node.parent_id) return null;
    const parent = byId.get(node.parent_id);
    return parent ? parent.slug : null;
  }

  // ── exitExamTree ─────────────────────────────────────────────────────────
  const exitExamTree = nodes
    .filter((n) => n.exam === "exit")
    .map((n) => ({
      id:       n.slug,           // UI uses slug as id
      dbId:     n.id,             // uuid — for future DB calls
      type:     n.kind,           // 'stream'|'field'|'subgroup'|'department'
      name:     n.name,
      parentId: parentSlug(n),    // parent's slug, or null
    }));

  // ── exitExamCourses ──────────────────────────────────────────────────────
  // Build: courseId (uuid) → Set of department slugs
  const deptById = new Map(
    nodes
      .filter((n) => n.exam === "exit" && n.kind === "department")
      .map((n) => [n.id, n.slug]),
  );

  const courseDeptSlugs = new Map(); // courseId → [deptSlug, ...]
  for (const { node_id, course_id } of junctions) {
    const deptSlug = deptById.get(node_id);
    if (!deptSlug) continue; // skip non-dept junction rows (e.g. remedial stream links)
    if (!courseDeptSlugs.has(course_id)) courseDeptSlugs.set(course_id, []);
    courseDeptSlugs.get(course_id).push(deptSlug);
  }

  const exitExamCourses = courses
    .filter((c) => courseDeptSlugs.has(c.id))
    .map((c) => ({
      id:            c.code,                         // UI uses code as id
      dbId:          c.id,
      name:          c.name,
      departmentIds: courseDeptSlugs.get(c.id) ?? [], // array of dept slugs
      examType:      "Exit exam",
    }));

  // ── courseGroups (Remedial) ──────────────────────────────────────────────
  // streamId (uuid) → Set of course_ids for that stream
  const remedialStreamNodes = nodes.filter(
    (n) => n.exam === "remedial" && n.kind === "stream",
  );

  const streamCourseIds = new Map(remedialStreamNodes.map((n) => [n.id, []]));
  for (const { node_id, course_id } of junctions) {
    if (streamCourseIds.has(node_id)) {
      streamCourseIds.get(node_id).push(course_id);
    }
  }

  const courseNameById = new Map(courses.map((c) => [c.id, c.name]));

  const courseGroups = { Remedial: {} };
  for (const streamNode of remedialStreamNodes) {
    const names = (streamCourseIds.get(streamNode.id) ?? [])
      .map((cid) => courseNameById.get(cid))
      .filter(Boolean);
    courseGroups.Remedial[streamNode.name] = names;
  }

  // ── remedialCourses ──────────────────────────────────────────────────────
  const remedialCourses = [];
  for (const streamNode of remedialStreamNodes) {
    const cIds = streamCourseIds.get(streamNode.id) ?? [];
    for (const cid of cIds) {
      const course = courses.find((c) => c.id === cid);
      if (!course) continue;
      // Build id as  remedial-<streamSlug>-<slugOf(name)>
      // Must exactly match the formula in courseGroups.js:
      //   name.toLocaleLowerCase().replace(/[^a-z0-9]+/g, "-")
      // (no trailing-hyphen strip — "Mathematics (Social)" → "mathematics-social-")
      const nameSlug = course.name
        .toLocaleLowerCase()
        .replace(/[^a-z0-9]+/g, "-");
      remedialCourses.push({
        id:       `remedial-${streamNode.slug}-${nameSlug}`,
        dbId:     course.id,
        name:     course.name,
        stream:   streamNode.name,
        examType: "Remedial",
      });
    }
  }

  return { exitExamTree, exitExamCourses, courseGroups, remedialCourses };
}

// ── static fallback (Supabase not configured) ─────────────────────────────────

function buildStaticResult() {
  return {
    exitExamTree:   staticData.exitExamTree.map((n) => ({ ...n, dbId: null })),
    exitExamCourses: staticData.exitExamCourses.map((c) => ({ ...c, dbId: null })),
    courseGroups:   staticData.courseGroups,
    remedialCourses: staticData.remedialCourses.map((c) => ({ ...c, dbId: null })),
  };
}
