/**
 * database.types.ts
 *
 * TypeScript types auto-derived from wollo-exam-prep-supabase.sql.
 * Keep in sync with the schema. These types can be fed to the Supabase
 * client: `createClient<Database>(url, key)`.
 *
 * To regenerate automatically once the schema is applied to your project:
 *   npx supabase gen types typescript --project-id YOUR_PROJECT_REF > src/lib/database.types.ts
 */

// ── Enums ─────────────────────────────────────────────────────────────────────
export type UserRole       = "student" | "instructor" | "coordinator" | "admin";
export type AccountStatus  = "active" | "inactive";
export type ExamKind       = "remedial" | "exit";
export type NodeKind       = "stream" | "field" | "subgroup" | "department";
export type QuestionStatus = "draft" | "in_review" | "published" | "sent_back" | "archived";
export type Difficulty     = "easy" | "medium" | "hard";
export type AttemptMode    = "practice" | "mock";
export type AttemptState   = "in_progress" | "submitted" | "expired" | "abandoned";
export type ReportStatus   = "open" | "resolved" | "dismissed";
export type PageStatus     = "draft" | "published";
export type PlanTier       = "free" | "premium";

// ── Row types ─────────────────────────────────────────────────────────────────

export interface Profile {
  id:            string;       // uuid — references auth.users
  full_name:     string;
  email:         string;       // citext
  role:          UserRole;
  status:        AccountStatus;
  language:      "en" | "am" | "om" | "ti";
  created_at:    string;       // timestamptz ISO string
  last_login_at: string | null;
}

export interface StudentProfile {
  user_id:       string;       // uuid → profiles.id
  exam:          ExamKind;
  stream_id:     string | null;     // uuid → tree_nodes.id
  department_id: string | null;     // uuid → tree_nodes.id (required for exit)
  plan:          PlanTier;
  plan_expires:  string | null;     // date ISO string
}

export interface CoordinatorScope {
  user_id: string;   // uuid → profiles.id
  node_id: string;   // uuid → tree_nodes.id
}

export interface CourseAssignment {
  user_id:     string;        // uuid → profiles.id
  course_id:   string;        // uuid → courses.id
  assigned_by: string | null; // uuid → profiles.id
  assigned_at: string;        // timestamptz
}

export interface TreeNode {
  id:         string;          // uuid
  exam:       ExamKind;
  kind:       NodeKind;
  parent_id:  string | null;   // uuid → tree_nodes.id (null for streams)
  name:       string;
  slug:       string;
  sort_order: number;
  is_active:  boolean;
}

export interface Course {
  id:        string;   // uuid
  code:      string | null;
  name:      string;
  is_active: boolean;
}

export interface NodeCourse {
  node_id:   string;  // uuid → tree_nodes.id
  course_id: string;  // uuid → courses.id
}

export interface Topic {
  id:        string;  // uuid
  course_id: string;  // uuid → courses.id
  name:      string;
}

export interface Question {
  id:           string;         // uuid
  course_id:    string;         // uuid → courses.id
  topic_id:     string | null;  // uuid → topics.id
  difficulty:   Difficulty;
  body:         string;
  explanation:  string | null;
  status:       QuestionStatus;
  author_id:    string;         // uuid → profiles.id
  reviewer_id:  string | null;  // uuid → profiles.id
  review_note:  string | null;
  created_at:   string;
  published_at: string | null;
  updated_at:   string;
}

export interface QuestionOption {
  id:          string;   // uuid
  question_id: string;   // uuid → questions.id
  position:    number;   // 0–3 (A–D)
  text:        string;
}

export interface QuestionAnswerKey {
  question_id: string;  // uuid → questions.id (PK)
  option_id:   string;  // uuid → question_options.id
}

export interface QuestionStatusHistory {
  id:          number;              // bigserial
  question_id: string;             // uuid
  from_status: QuestionStatus | null;
  to_status:   QuestionStatus;
  actor_id:    string;             // uuid → profiles.id
  note:        string | null;
  at:          string;             // timestamptz
}

export interface ExamAttempt {
  id:           string;          // uuid
  student_id:   string;          // uuid → profiles.id
  course_id:    string;          // uuid → courses.id
  mode:         AttemptMode;
  state:        AttemptState;
  started_at:   string;          // timestamptz
  ends_at:      string | null;   // server deadline (mock only)
  submitted_at: string | null;
  total:        number;
  correct:      number | null;
  score_pct:    number | null;   // numeric(5,2)
  tab_switches: number;
  attempt_no:   number;
}

export interface AttemptQuestion {
  attempt_id:  string;  // uuid
  question_id: string;  // uuid
  position:    number;
}

export interface AttemptAnswer {
  attempt_id:  string;          // uuid
  question_id: string;          // uuid
  option_id:   string | null;   // uuid → question_options.id
  is_correct:  boolean | null;  // filled at submit
  answered_at: string;
}

export interface TabSwitchEvent {
  id:         number;  // bigserial
  attempt_id: string;  // uuid
  at:         string;  // timestamptz
}

export interface QuestionReport {
  id:          string;        // uuid
  question_id: string;        // uuid
  course_id:   string;        // uuid
  reporter_id: string;        // uuid → profiles.id
  message:     string;
  status:      ReportStatus;
  handled_by:  string | null; // uuid → profiles.id
  reason:      string | null;
  created_at:  string;
  closed_at:   string | null;
}

export interface Notification {
  id:         number;         // bigserial
  user_id:    string;         // uuid → profiles.id
  type:       string;         // 'report_new' | 'report_resolved' | 'question_sent_back' | …
  title:      string;
  link:       string | null;
  read_at:    string | null;
  created_at: string;
}

export interface Announcement {
  id:        string;         // uuid
  author_id: string;         // uuid → profiles.id
  title:     string;
  body:      string;
  audience:  UserRole | null;
  node_id:   string | null;  // uuid → tree_nodes.id
  starts_at: string;
  ends_at:   string | null;
}

export interface DepartmentPage {
  node_id:       string;         // uuid (PK) → tree_nodes.id
  description:   string | null;
  exam_overview: string | null;
  exam_date:     string | null;  // date ISO string
  tips:          string | null;
  contact:       string | null;
  status:        PageStatus;
  updated_by:    string | null;  // uuid → profiles.id
  updated_at:    string;
}

export interface DepartmentBlueprint {
  node_id: string;  // uuid → department_pages.node_id
  topic:   string;
  weight:  number;  // 1–100, total must equal 100 when page is published
}

export interface Setting {
  key:        string;         // 'mock_minutes' | 'retake_limit'
  value:      string;
  updated_by: string | null;  // uuid → profiles.id
  updated_at: string;
}

export interface OfflineDownload {
  id:            string;  // uuid
  student_id:    string;  // uuid → profiles.id
  course_id:     string;  // uuid → courses.id
  downloaded_at: string;  // timestamptz
}

export interface Payment {
  id:           string;  // uuid
  student_id:   string;  // uuid → profiles.id
  provider:     string;  // 'telebirr' | 'cbe_birr'
  provider_ref: string | null;
  amount_etb:   number;
  status:       "pending" | "paid" | "failed" | "refunded";
  created_at:   string;
}

export interface AuditLog {
  id:       number;         // bigserial
  actor_id: string | null;  // uuid → profiles.id
  action:   string;         // 'user.deactivate' | 'question.publish' | …
  target:   string | null;  // 'user:<id>' | 'question:<id>'
  detail:   Record<string, unknown> | null;  // jsonb
  at:       string;
}

// ── RPC return types ──────────────────────────────────────────────────────────

/** Returned by submit_attempt() */
export interface SubmitAttemptResult {
  correct:   number;
  total:     number;
  score_pct: number;
}

/** Returned by attempt_review() */
export interface AttemptReviewRow {
  question_id:    string;
  correct_option: string;   // option uuid
  chosen_option:  string | null;
  explanation:    string | null;
}

// ── Supabase Database type (for typed createClient) ───────────────────────────

export interface Database {
  public: {
    Tables: {
      profiles:                  { Row: Profile;                Insert: Omit<Profile, "created_at" | "last_login_at">;       Update: Partial<Pick<Profile, "full_name" | "language">> };
      student_profiles:          { Row: StudentProfile;         Insert: Omit<StudentProfile, "plan" | "plan_expires">;        Update: Partial<Pick<StudentProfile, "exam" | "stream_id" | "department_id">> };
      coordinator_scopes:        { Row: CoordinatorScope;       Insert: CoordinatorScope;        Update: never };
      course_assignments:        { Row: CourseAssignment;       Insert: Omit<CourseAssignment, "assigned_at">; Update: never };
      tree_nodes:                { Row: TreeNode;               Insert: Omit<TreeNode, "id">;    Update: Partial<Omit<TreeNode, "id">> };
      courses:                   { Row: Course;                 Insert: Omit<Course, "id">;      Update: Partial<Omit<Course, "id">> };
      node_courses:              { Row: NodeCourse;             Insert: NodeCourse;              Update: never };
      topics:                    { Row: Topic;                  Insert: Omit<Topic, "id">;       Update: Partial<Pick<Topic, "name">> };
      questions:                 { Row: Question;               Insert: Omit<Question, "id" | "created_at" | "updated_at" | "published_at">; Update: Partial<Omit<Question, "id" | "created_at">> };
      question_options:          { Row: QuestionOption;         Insert: Omit<QuestionOption, "id">; Update: Partial<Pick<QuestionOption, "text">> };
      question_answer_keys:      { Row: QuestionAnswerKey;      Insert: QuestionAnswerKey;       Update: Partial<QuestionAnswerKey> };
      question_status_history:   { Row: QuestionStatusHistory;  Insert: Omit<QuestionStatusHistory, "id" | "at">; Update: never };
      exam_attempts:             { Row: ExamAttempt;            Insert: Omit<ExamAttempt, "id" | "started_at">; Update: Partial<Omit<ExamAttempt, "id" | "student_id" | "course_id">> };
      attempt_questions:         { Row: AttemptQuestion;        Insert: AttemptQuestion;         Update: never };
      attempt_answers:           { Row: AttemptAnswer;          Insert: Omit<AttemptAnswer, "answered_at">; Update: Partial<AttemptAnswer> };
      tab_switch_events:         { Row: TabSwitchEvent;         Insert: Omit<TabSwitchEvent, "id" | "at">; Update: never };
      question_reports:          { Row: QuestionReport;         Insert: Omit<QuestionReport, "id" | "created_at">; Update: Partial<Omit<QuestionReport, "id" | "reporter_id" | "created_at">> };
      notifications:             { Row: Notification;           Insert: Omit<Notification, "id" | "created_at">; Update: Partial<Pick<Notification, "read_at">> };
      announcements:             { Row: Announcement;           Insert: Omit<Announcement, "id">; Update: Partial<Omit<Announcement, "id">> };
      department_pages:          { Row: DepartmentPage;         Insert: Omit<DepartmentPage, "updated_at">; Update: Partial<Omit<DepartmentPage, "node_id">> };
      department_blueprint:      { Row: DepartmentBlueprint;    Insert: DepartmentBlueprint;     Update: Partial<DepartmentBlueprint> };
      settings:                  { Row: Setting;                Insert: Setting;                 Update: Partial<Pick<Setting, "value" | "updated_by" | "updated_at">> };
      offline_downloads:         { Row: OfflineDownload;        Insert: Omit<OfflineDownload, "id" | "downloaded_at">; Update: never };
      payments:                  { Row: Payment;                Insert: Omit<Payment, "id" | "created_at">; Update: Partial<Pick<Payment, "status">> };
      audit_log:                 { Row: AuditLog;               Insert: Omit<AuditLog, "id" | "at">; Update: never };
    };
    Views: {
      question_performance: {
        Row: {
          question_id:    string;
          course_id:      string;
          times_answered: number;
          pct_correct:    number;
        };
      };
    };
    Functions: {
      start_attempt:   { Args: { p_course: string; p_mode: AttemptMode; p_count?: number }; Returns: string };
      save_answer:     { Args: { p_attempt: string; p_question: string; p_option: string }; Returns: void };
      log_tab_switch:  { Args: { p_attempt: string };                                        Returns: void };
      submit_attempt:  { Args: { p_attempt: string };                                        Returns: SubmitAttemptResult[] };
      attempt_review:  { Args: { p_attempt: string };                                        Returns: AttemptReviewRow[] };
      app_role:        { Args: Record<string, never>;                                         Returns: UserRole };
    };
    Enums: {
      user_role:       UserRole;
      account_status:  AccountStatus;
      exam_kind:       ExamKind;
      node_kind:       NodeKind;
      question_status: QuestionStatus;
      difficulty_level: Difficulty;
      attempt_mode:    AttemptMode;
      attempt_state:   AttemptState;
      report_status:   ReportStatus;
      page_status:     PageStatus;
      plan_tier:       PlanTier;
    };
  };
}
