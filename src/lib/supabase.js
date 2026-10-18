/**
 * src/lib/supabase.js
 *
 * Single Supabase client for the entire front-end.
 * All calls respect Row Level Security (anon / user JWT).
 *
 * Tables (from wollo-exam-prep-supabase.sql):
 *   profiles, student_profiles, coordinator_scopes, course_assignments
 *   tree_nodes, courses, node_courses
 *   topics, questions, question_options, question_answer_keys, question_status_history
 *   exam_attempts, attempt_questions, attempt_answers, tab_switch_events
 *   question_reports, notifications, announcements
 *   department_pages, department_blueprint
 *   settings, offline_downloads, payments, audit_log
 *
 * RPCs (server-side functions, run with SECURITY DEFINER):
 *   start_attempt(p_course, p_mode, p_count?)  → attempt uuid
 *   save_answer(p_attempt, p_question, p_option) → void
 *   log_tab_switch(p_attempt)                   → void
 *   submit_attempt(p_attempt)                   → { correct, total, score_pct }
 *   attempt_review(p_attempt)                   → rows
 */

import { createClient } from "@supabase/supabase-js";

const supabaseUrl     = import.meta.env.VITE_SUPABASE_URL?.trim();
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim();
// NOTE: SUPABASE_SECRET_KEY is intentionally NOT accessed here.
// It has no VITE_ prefix so Vite will never bundle it into the browser build.
// Use it only in a server-side environment (Node.js / Edge Function).

if (Boolean(supabaseUrl) !== Boolean(supabaseAnonKey)) {
  throw new Error(
    "Supabase misconfiguration: set BOTH VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your .env file.",
  );
}

/** True when the env vars are present and the Supabase client is active. */
export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

/** The Supabase client. null when env vars are missing (demo / offline mode). */
export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        // Keep the session in localStorage so it survives page refreshes.
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : null;

// ── Auth helpers ──────────────────────────────────────────────────────────────

/**
 * Sign up a new user with email + password.
 * Supabase automatically fires the `on_auth_user_created` trigger which
 * inserts a row into `profiles` (role defaults to 'student').
 *
 * @param {{ email: string, password: string, fullName: string }} params
 */
export async function signUp({ email, password, fullName }) {
  if (!supabase) throw new Error("Supabase is not configured.");
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { full_name: fullName } },
  });
  if (error) throw error;
  return data;
}

/**
 * Sign in with email + password.
 * @param {{ email: string, password: string }} params
 */
export async function signIn({ email, password }) {
  if (!supabase) throw new Error("Supabase is not configured.");
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}

/** Sign out the current user. */
export async function signOut() {
  if (!supabase) return;
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

/**
 * Get the current session (null if logged out).
 * Use `supabase.auth.onAuthStateChange` for reactive updates.
 */
export async function getSession() {
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  return data.session;
}

// ── Profile helpers ───────────────────────────────────────────────────────────

/**
 * Fetch the `profiles` row for the currently signed-in user.
 * Returns null if not signed in or Supabase is not configured.
 */
export async function getMyProfile() {
  if (!supabase) return null;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name, email, role, status, language")
    .eq("id", user.id)
    .single();
  if (error) throw error;
  return data;
}

/**
 * Update the current user's display name or language preference.
 * (role and status changes require an admin — enforced by RLS + trigger.)
 *
 * @param {{ fullName?: string, language?: string }} fields
 */
export async function updateMyProfile({ fullName, language }) {
  if (!supabase) throw new Error("Supabase is not configured.");
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in.");
  const updates = {};
  if (fullName !== undefined) updates.full_name = fullName;
  if (language !== undefined) updates.language  = language;
  const { error } = await supabase
    .from("profiles")
    .update(updates)
    .eq("id", user.id);
  if (error) throw error;
}

// ── Exam RPCs ─────────────────────────────────────────────────────────────────
// These call SECURITY DEFINER functions in Postgres.
// The database picks the questions, enforces retake limits and the deadline.

/**
 * Start (or resume) an exam attempt.
 * Returns the attempt UUID which must be stored for subsequent calls.
 *
 * @param {{ courseId: string, mode: "practice"|"mock", questionCount?: number }} params
 * @returns {Promise<string>} attempt id
 */
export async function startAttempt({ courseId, mode, questionCount = 20 }) {
  if (!supabase) throw new Error("Supabase is not configured.");
  const { data, error } = await supabase.rpc("start_attempt", {
    p_course: courseId,
    p_mode:   mode,
    p_count:  questionCount,
  });
  if (error) throw error;
  return data; // uuid string
}

/**
 * Autosave a single answer (upsert — safe to call on every click).
 *
 * @param {{ attemptId: string, questionId: string, optionId: string }} params
 */
export async function saveAnswer({ attemptId, questionId, optionId }) {
  if (!supabase) throw new Error("Supabase is not configured.");
  const { error } = await supabase.rpc("save_answer", {
    p_attempt:  attemptId,
    p_question: questionId,
    p_option:   optionId,
  });
  if (error) throw error;
}

/**
 * Record a tab-switch during a mock exam.
 * @param {string} attemptId
 */
export async function logTabSwitch(attemptId) {
  if (!supabase) throw new Error("Supabase is not configured.");
  const { error } = await supabase.rpc("log_tab_switch", { p_attempt: attemptId });
  if (error) throw error;
}

/**
 * Submit the attempt. Returns the score from the server.
 * @param {string} attemptId
 * @returns {Promise<{ correct: number, total: number, score_pct: number }>}
 */
export async function submitAttempt(attemptId) {
  if (!supabase) throw new Error("Supabase is not configured.");
  const { data, error } = await supabase.rpc("submit_attempt", { p_attempt: attemptId });
  if (error) throw error;
  return data[0]; // { correct, total, score_pct }
}

/**
 * Fetch the full review (correct answers + chosen answers + explanations)
 * for a submitted attempt.
 * @param {string} attemptId
 */
export async function getAttemptReview(attemptId) {
  if (!supabase) throw new Error("Supabase is not configured.");
  const { data, error } = await supabase.rpc("attempt_review", { p_attempt: attemptId });
  if (error) throw error;
  return data;
}

// ── Student reports ───────────────────────────────────────────────────────────

/**
 * Submit a question report from a student.
 * @param {{ questionId: string, courseId: string, message: string }} params
 */
export async function submitReport({ questionId, courseId, message }) {
  if (!supabase) throw new Error("Supabase is not configured.");
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in.");
  const { error } = await supabase.from("question_reports").insert({
    question_id:  questionId,
    course_id:    courseId,
    reporter_id:  user.id,
    message,
  });
  if (error) throw error;
}

/**
 * Fetch reports visible to the current user.
 * Students see their own; instructors/coordinators see their scoped reports.
 */
export async function getMyReports() {
  if (!supabase) throw new Error("Supabase is not configured.");
  const { data, error } = await supabase
    .from("question_reports")
    .select("id, question_id, course_id, message, status, reason, created_at, closed_at")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data;
}

// ── Notifications ─────────────────────────────────────────────────────────────

/**
 * Fetch unread notifications for the current user.
 */
export async function getUnreadNotifications() {
  if (!supabase) throw new Error("Supabase is not configured.");
  const { data, error } = await supabase
    .from("notifications")
    .select("id, type, title, link, created_at")
    .is("read_at", null)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data;
}

/**
 * Mark a notification as read.
 * @param {number} notificationId
 */
export async function markNotificationRead(notificationId) {
  if (!supabase) throw new Error("Supabase is not configured.");
  const { error } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("id", notificationId);
  if (error) throw error;
}

// ── Settings ──────────────────────────────────────────────────────────────────

/**
 * Fetch all platform settings (mock_minutes, retake_limit, …).
 * Returns an object keyed by settings.key.
 * @returns {Promise<Record<string, string>>}
 */
export async function getSettings() {
  if (!supabase) return {};
  const { data, error } = await supabase.from("settings").select("key, value");
  if (error) throw error;
  return Object.fromEntries(data.map(({ key, value }) => [key, value]));
}

// ── Offline downloads ─────────────────────────────────────────────────────────

/**
 * Mark a course as downloaded for offline use.
 * @param {string} courseId
 */
export async function markDownloaded(courseId) {
  if (!supabase) throw new Error("Supabase is not configured.");
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in.");
  const { error } = await supabase
    .from("offline_downloads")
    .upsert({ student_id: user.id, course_id: courseId });
  if (error) throw error;
}

/**
 * Remove a course from the offline download list.
 * @param {string} courseId
 */
export async function removeDownload(courseId) {
  if (!supabase) throw new Error("Supabase is not configured.");
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in.");
  const { error } = await supabase
    .from("offline_downloads")
    .delete()
    .match({ student_id: user.id, course_id: courseId });
  if (error) throw error;
}
