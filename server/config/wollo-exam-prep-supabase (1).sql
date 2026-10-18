-- =====================================================================
-- Wollo University Remedial & Exit Exam Preparation Platform
-- SUPABASE schema v2: Supabase Auth + Row Level Security + server-side exam RPCs
-- =====================================================================
CREATE EXTENSION IF NOT EXISTS citext;     -- case-insensitive email

-- ---------- ENUMS ----------------------------------------------------
CREATE TYPE user_role        AS ENUM ('student','instructor','coordinator','admin');
CREATE TYPE account_status   AS ENUM ('active','inactive');
CREATE TYPE exam_kind        AS ENUM ('remedial','exit');
CREATE TYPE node_kind        AS ENUM ('stream','field','subgroup','department');
CREATE TYPE question_status  AS ENUM ('draft','in_review','published','sent_back','archived');
CREATE TYPE difficulty_level AS ENUM ('easy','medium','hard');
CREATE TYPE attempt_mode     AS ENUM ('practice','mock');
CREATE TYPE attempt_state    AS ENUM ('in_progress','submitted','expired','abandoned');
CREATE TYPE report_status    AS ENUM ('open','resolved','dismissed');
CREATE TYPE page_status      AS ENUM ('draft','published');
CREATE TYPE plan_tier        AS ENUM ('free','premium');

-- ====================== 1. PEOPLE ===================================
-- Passwords/login are handled by Supabase Auth (auth.users). We never store passwords.
CREATE TABLE profiles (
  id             uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name      text        NOT NULL DEFAULT '',
  email          citext      NOT NULL UNIQUE,
  role           user_role   NOT NULL DEFAULT 'student',   -- only an admin can change this
  status         account_status NOT NULL DEFAULT 'active',
  language       text        NOT NULL DEFAULT 'en' CHECK (language IN ('en','am','om','ti')),
  created_at     timestamptz NOT NULL DEFAULT now(),
  last_login_at  timestamptz
);

-- Student-only data (1:1 with users where role = student)
CREATE TABLE student_profiles (
  user_id        uuid PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  exam           exam_kind NOT NULL,
  stream_id      uuid,                                  -- FK added below (course tree)
  department_id  uuid,                                  -- required when exam = 'exit'
  plan           plan_tier NOT NULL DEFAULT 'free',
  plan_expires   date,
  CHECK (exam = 'remedial' OR department_id IS NOT NULL)
);

-- Coordinator scope: which tree node(s) they manage (field, subgroup, stream ...)
CREATE TABLE coordinator_scopes (
  user_id  uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  node_id  uuid NOT NULL,                               -- FK below
  PRIMARY KEY (user_id, node_id)
);

-- Instructor -> course assignments (set by coordinator)
CREATE TABLE course_assignments (
  user_id     uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  course_id   uuid NOT NULL,                            -- FK below
  assigned_by uuid REFERENCES profiles(id),
  assigned_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, course_id)
);

-- ====================== 2. COURSE TREE ==============================
-- One self-referencing table holds Stream -> Field -> Subgroup -> Department.
-- Add a new field/department = INSERT a row, no code change.
CREATE TABLE tree_nodes (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  exam       exam_kind NOT NULL,
  kind       node_kind NOT NULL,
  parent_id  uuid REFERENCES tree_nodes(id) ON DELETE RESTRICT,
  name       text NOT NULL,
  slug       text NOT NULL,
  sort_order int  NOT NULL DEFAULT 0,
  is_active  boolean NOT NULL DEFAULT true,
  UNIQUE (parent_id, slug),
  CHECK ((kind = 'stream' AND parent_id IS NULL) OR (kind <> 'stream' AND parent_id IS NOT NULL))
);
CREATE INDEX ix_tree_parent ON tree_nodes(parent_id);

CREATE TABLE courses (
  id        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code      text UNIQUE,                  -- e.g. 'CS-DB'
  name      text NOT NULL,
  is_active boolean NOT NULL DEFAULT true
);

-- A course can belong to many departments (e.g. Databases in CS, IT, SE).
-- For remedial, link the course to the 'stream' node instead.
CREATE TABLE node_courses (
  node_id   uuid NOT NULL REFERENCES tree_nodes(id) ON DELETE CASCADE,
  course_id uuid NOT NULL REFERENCES courses(id)    ON DELETE CASCADE,
  PRIMARY KEY (node_id, course_id)
);
CREATE INDEX ix_node_courses_course ON node_courses(course_id);

ALTER TABLE student_profiles
  ADD FOREIGN KEY (stream_id)     REFERENCES tree_nodes(id),
  ADD FOREIGN KEY (department_id) REFERENCES tree_nodes(id);
ALTER TABLE coordinator_scopes ADD FOREIGN KEY (node_id)   REFERENCES tree_nodes(id) ON DELETE CASCADE;
ALTER TABLE course_assignments ADD FOREIGN KEY (course_id) REFERENCES courses(id)    ON DELETE CASCADE;

-- ====================== 3. QUESTIONS ================================
CREATE TABLE topics (
  id        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id uuid NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  name      text NOT NULL,
  UNIQUE (course_id, name)
);

CREATE TABLE questions (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id    uuid NOT NULL REFERENCES courses(id),
  topic_id     uuid REFERENCES topics(id),
  difficulty   difficulty_level NOT NULL DEFAULT 'medium',
  body         text NOT NULL,
  explanation  text,
  status       question_status NOT NULL DEFAULT 'draft',
  author_id    uuid NOT NULL REFERENCES profiles(id),
  reviewer_id  uuid REFERENCES profiles(id),
  review_note  text,                                    -- reason when sent back
  created_at   timestamptz NOT NULL DEFAULT now(),
  published_at timestamptz,
  updated_at   timestamptz NOT NULL DEFAULT now(),
  -- two-person rule enforced by the database itself
  CHECK (reviewer_id IS NULL OR reviewer_id <> author_id),
  CHECK (status NOT IN ('published') OR (reviewer_id IS NOT NULL AND published_at IS NOT NULL))
);
CREATE INDEX ix_questions_pick ON questions(course_id, status, difficulty);

CREATE TABLE question_options (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id uuid NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  position    smallint NOT NULL,                        -- 0..3  (A..D)
  text        text NOT NULL,
  UNIQUE (question_id, position)
);
-- Correct answers live in their own table that students can NEVER read (no RLS policy for them).
CREATE TABLE question_answer_keys (
  question_id uuid PRIMARY KEY REFERENCES questions(id) ON DELETE CASCADE,
  option_id   uuid NOT NULL REFERENCES question_options(id) ON DELETE CASCADE
);

-- Who changed status, when, why (audit trail of the lifecycle)
CREATE TABLE question_status_history (
  id          bigserial PRIMARY KEY,
  question_id uuid NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  from_status question_status,
  to_status   question_status NOT NULL,
  actor_id    uuid NOT NULL REFERENCES profiles(id),
  note        text,
  at          timestamptz NOT NULL DEFAULT now()
);

-- ====================== 4. PRACTICE & MOCK EXAMS ====================
CREATE TABLE exam_attempts (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id    uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  course_id     uuid NOT NULL REFERENCES courses(id),
  mode          attempt_mode  NOT NULL,
  state         attempt_state NOT NULL DEFAULT 'in_progress',
  started_at    timestamptz NOT NULL DEFAULT now(),
  ends_at       timestamptz,                            -- server-owned deadline (mock)
  submitted_at  timestamptz,
  total         int  NOT NULL DEFAULT 0,
  correct       int,
  score_pct     numeric(5,2),
  tab_switches  int  NOT NULL DEFAULT 0,
  attempt_no    int  NOT NULL DEFAULT 1                 -- for retake rule
);
CREATE INDEX ix_attempts_student ON exam_attempts(student_id, started_at DESC);
-- only ONE unfinished attempt per student+course (resume, not duplicate)
CREATE UNIQUE INDEX ux_one_open_attempt ON exam_attempts(student_id, course_id) WHERE state = 'in_progress';

-- Questions chosen by the SERVER for this attempt (fixed order)
CREATE TABLE attempt_questions (
  attempt_id  uuid NOT NULL REFERENCES exam_attempts(id) ON DELETE CASCADE,
  question_id uuid NOT NULL REFERENCES questions(id),
  position    int  NOT NULL,
  PRIMARY KEY (attempt_id, question_id),
  UNIQUE (attempt_id, position)
);

-- Autosave = upsert on every click, so resume/refresh never loses answers
CREATE TABLE attempt_answers (
  attempt_id  uuid NOT NULL,
  question_id uuid NOT NULL,
  option_id   uuid REFERENCES question_options(id),
  is_correct  boolean,                                  -- filled at submit
  answered_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (attempt_id, question_id),
  FOREIGN KEY (attempt_id, question_id) REFERENCES attempt_questions(attempt_id, question_id) ON DELETE CASCADE
);

CREATE TABLE tab_switch_events (
  id         bigserial PRIMARY KEY,
  attempt_id uuid NOT NULL REFERENCES exam_attempts(id) ON DELETE CASCADE,
  at         timestamptz NOT NULL DEFAULT now()
);

-- Per-question stats feed "hardest questions" (refresh nightly or by trigger)
CREATE MATERIALIZED VIEW question_performance AS
SELECT q.id AS question_id, q.course_id,
       count(a.*) AS times_answered,
       avg((a.is_correct)::int)::numeric(4,3) AS pct_correct
FROM questions q LEFT JOIN attempt_answers a ON a.question_id = q.id
GROUP BY q.id, q.course_id;

-- ====================== 5. REPORTS (student -> instructor) ==========
CREATE TABLE question_reports (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id  uuid NOT NULL REFERENCES questions(id),
  course_id    uuid NOT NULL REFERENCES courses(id),    -- denormalised: routes to the right instructor
  reporter_id  uuid NOT NULL REFERENCES profiles(id),
  message      text NOT NULL,
  status       report_status NOT NULL DEFAULT 'open',
  handled_by   uuid REFERENCES profiles(id),
  reason       text,                                    -- shown to the student on dismiss/resolve
  created_at   timestamptz NOT NULL DEFAULT now(),
  closed_at    timestamptz,
  CHECK (status = 'open' OR (handled_by IS NOT NULL AND closed_at IS NOT NULL))
);
CREATE INDEX ix_reports_course_status ON question_reports(course_id, status);
-- stops a student spamming the same question
CREATE UNIQUE INDEX ux_one_open_report ON question_reports(reporter_id, question_id) WHERE status = 'open';

-- ====================== 6. NOTIFICATIONS & ANNOUNCEMENTS ============
CREATE TABLE notifications (
  id        bigserial PRIMARY KEY,
  user_id   uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,   -- recipient
  type      text NOT NULL,        -- 'report_new','report_resolved','question_sent_back','approval_needed' ...
  title     text NOT NULL,
  link      text,                 -- in-app route to open
  read_at   timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ix_notif_unread ON notifications(user_id, created_at DESC) WHERE read_at IS NULL;

CREATE TABLE announcements (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id  uuid NOT NULL REFERENCES profiles(id),
  title      text NOT NULL,
  body       text NOT NULL,
  audience   user_role,           -- NULL = everyone
  node_id    uuid REFERENCES tree_nodes(id),  -- optional: only one stream/field/department
  starts_at  timestamptz NOT NULL DEFAULT now(),
  ends_at    timestamptz
);

-- ====================== 7. DEPARTMENT PAGES =========================
CREATE TABLE department_pages (
  node_id      uuid PRIMARY KEY REFERENCES tree_nodes(id) ON DELETE CASCADE,
  description  text,
  exam_overview text,
  exam_date    date,
  tips         text,
  contact      text,
  status       page_status NOT NULL DEFAULT 'draft',
  updated_by   uuid REFERENCES profiles(id),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

-- Blueprint rows: topic + weight. Must total 100 before publishing.
CREATE TABLE department_blueprint (
  node_id  uuid NOT NULL REFERENCES department_pages(node_id) ON DELETE CASCADE,
  topic    text NOT NULL,
  weight   int  NOT NULL CHECK (weight BETWEEN 1 AND 100),
  PRIMARY KEY (node_id, topic)
);

CREATE OR REPLACE FUNCTION enforce_blueprint_100() RETURNS trigger AS $$
BEGIN
  IF NEW.status = 'published' AND
     COALESCE((SELECT sum(weight) FROM department_blueprint WHERE node_id = NEW.node_id),0) <> 100 THEN
    RAISE EXCEPTION 'Blueprint weights must total 100 before publishing';
  END IF;
  RETURN NEW;
END $$ LANGUAGE plpgsql;
CREATE TRIGGER trg_blueprint_100 BEFORE INSERT OR UPDATE ON department_pages
  FOR EACH ROW EXECUTE FUNCTION enforce_blueprint_100();

-- ====================== 8. PLATFORM =================================
CREATE TABLE settings (
  key        text PRIMARY KEY,         -- 'mock_minutes' = '10', 'retake_limit' = '2' (null = unlimited)
  value      text NOT NULL,
  updated_by uuid REFERENCES profiles(id),
  updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO settings(key,value) VALUES ('mock_minutes','10'), ('retake_limit','2');

CREATE TABLE offline_downloads (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  course_id  uuid NOT NULL REFERENCES courses(id),
  downloaded_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (student_id, course_id)
);

CREATE TABLE payments (                  -- only if you go Premium (Telebirr / CBE Birr)
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES profiles(id),
  provider   text NOT NULL,
  provider_ref text UNIQUE,
  amount_etb numeric(10,2) NOT NULL,
  status     text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','paid','failed','refunded')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE audit_log (
  id        bigserial PRIMARY KEY,
  actor_id  uuid REFERENCES profiles(id),
  action    text NOT NULL,             -- 'user.deactivate', 'question.publish', 'settings.update'
  target    text,                      -- 'user:<id>' / 'question:<id>'
  detail    jsonb,
  at        timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ix_audit_at ON audit_log(at DESC);

-- =====================================================================
-- 9. SUPABASE: signup trigger, helpers, RPCs, Row Level Security
-- =====================================================================

-- Every new Supabase Auth user gets a profile. Role is ALWAYS 'student' here;
-- staff roles are granted later by an admin (never trust user-supplied metadata).
CREATE OR REPLACE FUNCTION handle_new_user() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO profiles(id, email, full_name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'full_name',''));
  RETURN NEW;
END $$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Helpers used inside policies (SECURITY DEFINER avoids policy recursion)
CREATE OR REPLACE FUNCTION app_role() RETURNS user_role
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT role FROM profiles WHERE id = auth.uid() AND status = 'active' $$;

CREATE OR REPLACE FUNCTION is_assigned(p_course uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM course_assignments WHERE user_id = auth.uid() AND course_id = p_course) $$;

CREATE OR REPLACE FUNCTION setting_int(p_key text) RETURNS int
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT NULLIF(value,'')::int FROM settings WHERE key = p_key $$;

-- ---------- Exam RPCs: the ONLY way students create / answer / submit ------
-- start_attempt: server picks the questions, sets the deadline, applies the retake rule.
CREATE OR REPLACE FUNCTION start_attempt(p_course uuid, p_mode attempt_mode, p_count int DEFAULT 20)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid uuid := auth.uid(); v_id uuid; v_no int; v_limit int; v_mins int;
BEGIN
  IF app_role() IS DISTINCT FROM 'student' THEN RAISE EXCEPTION 'students only'; END IF;
  -- resume instead of duplicate
  SELECT id INTO v_id FROM exam_attempts WHERE student_id=v_uid AND course_id=p_course AND state='in_progress';
  IF v_id IS NOT NULL THEN RETURN v_id; END IF;
  IF p_mode = 'mock' THEN
    v_limit := setting_int('retake_limit');
    SELECT count(*)+1 INTO v_no FROM exam_attempts WHERE student_id=v_uid AND course_id=p_course AND mode='mock';
    IF v_limit IS NOT NULL AND v_no > v_limit THEN RAISE EXCEPTION 'retake limit reached'; END IF;
    v_mins := COALESCE(setting_int('mock_minutes'),10);
  END IF;
  INSERT INTO exam_attempts(student_id, course_id, mode, ends_at, attempt_no)
  VALUES (v_uid, p_course, p_mode, CASE WHEN p_mode='mock' THEN now()+make_interval(mins=>v_mins) END, COALESCE(v_no,1))
  RETURNING id INTO v_id;
  INSERT INTO attempt_questions(attempt_id, question_id, position)
  SELECT v_id, id, row_number() OVER ()-1
  FROM (SELECT id FROM questions WHERE course_id=p_course AND status='published' ORDER BY random() LIMIT p_count) q;
  UPDATE exam_attempts SET total=(SELECT count(*) FROM attempt_questions WHERE attempt_id=v_id) WHERE id=v_id;
  RETURN v_id;
END $$;

-- save_answer: autosave on every click (upsert); rejected after the deadline.
CREATE OR REPLACE FUNCTION save_answer(p_attempt uuid, p_question uuid, p_option uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE a exam_attempts;
BEGIN
  SELECT * INTO a FROM exam_attempts WHERE id=p_attempt AND student_id=auth.uid();
  IF NOT FOUND OR a.state <> 'in_progress' THEN RAISE EXCEPTION 'attempt not open'; END IF;
  IF a.ends_at IS NOT NULL AND now() > a.ends_at + interval '5 seconds' THEN RAISE EXCEPTION 'time is up'; END IF;
  IF NOT EXISTS (SELECT 1 FROM question_options WHERE id=p_option AND question_id=p_question) THEN
    RAISE EXCEPTION 'option does not belong to question'; END IF;
  INSERT INTO attempt_answers(attempt_id, question_id, option_id) VALUES (p_attempt, p_question, p_option)
  ON CONFLICT (attempt_id, question_id) DO UPDATE SET option_id=EXCLUDED.option_id, answered_at=now();
END $$;

CREATE OR REPLACE FUNCTION log_tab_switch(p_attempt uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM exam_attempts WHERE id=p_attempt AND student_id=auth.uid() AND state='in_progress') THEN
    INSERT INTO tab_switch_events(attempt_id) VALUES (p_attempt);
    UPDATE exam_attempts SET tab_switches = tab_switches+1 WHERE id=p_attempt;
  END IF;
END $$;

-- submit_attempt: scores on the server using the hidden answer keys.
CREATE OR REPLACE FUNCTION submit_attempt(p_attempt uuid)
RETURNS TABLE(correct int, total int, score_pct numeric) LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE a exam_attempts; v_correct int;
BEGIN
  SELECT * INTO a FROM exam_attempts WHERE id=p_attempt AND student_id=auth.uid() FOR UPDATE;
  IF NOT FOUND OR a.state <> 'in_progress' THEN RAISE EXCEPTION 'attempt not open'; END IF;
  UPDATE attempt_answers aa SET is_correct = (k.option_id = aa.option_id)
  FROM question_answer_keys k WHERE aa.attempt_id=p_attempt AND k.question_id=aa.question_id;
  SELECT count(*) INTO v_correct FROM attempt_answers WHERE attempt_id=p_attempt AND is_correct;
  UPDATE exam_attempts e SET state='submitted', submitted_at=now(), correct=v_correct,
         score_pct = round(100.0*v_correct/NULLIF(e.total,0),2) WHERE e.id=p_attempt;
  RETURN QUERY SELECT e.correct, e.total, e.score_pct FROM exam_attempts e WHERE e.id=p_attempt;
END $$;

-- review: correct answers + explanations, ONLY after the attempt is submitted
CREATE OR REPLACE FUNCTION attempt_review(p_attempt uuid)
RETURNS TABLE(question_id uuid, correct_option uuid, chosen_option uuid, explanation text)
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT aq.question_id, k.option_id, aa.option_id, q.explanation
  FROM exam_attempts e
  JOIN attempt_questions aq ON aq.attempt_id=e.id
  JOIN questions q ON q.id=aq.question_id
  JOIN question_answer_keys k ON k.question_id=aq.question_id
  LEFT JOIN attempt_answers aa ON aa.attempt_id=e.id AND aa.question_id=aq.question_id
  WHERE e.id=p_attempt AND e.student_id=auth.uid() AND e.state IN ('submitted','expired') $$;

-- Report -> notify the course's instructors automatically
CREATE OR REPLACE FUNCTION notify_on_report() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP='INSERT' THEN
    INSERT INTO notifications(user_id,type,title,link)
    SELECT user_id,'report_new','New question report','/instructor/reports/'||NEW.id
    FROM course_assignments WHERE course_id=NEW.course_id;
  ELSIF NEW.status <> OLD.status THEN
    INSERT INTO notifications(user_id,type,title,link)
    VALUES (NEW.reporter_id,'report_'||NEW.status,'Your report was '||NEW.status,'/reports/'||NEW.id);
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_notify_report AFTER INSERT OR UPDATE OF status ON question_reports
  FOR EACH ROW EXECUTE FUNCTION notify_on_report();

-- ---------- Row Level Security: deny by default ----------------------------
DO $$ DECLARE t text; BEGIN
  FOR t IN SELECT tablename FROM pg_tables WHERE schemaname='public' LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
  END LOOP; END $$;

-- profiles: see yourself; staff see students; users edit only name/language
CREATE POLICY p_self  ON profiles FOR SELECT USING (id = auth.uid());
CREATE POLICY p_staff ON profiles FOR SELECT USING (app_role() IN ('coordinator','admin'));
CREATE POLICY p_upd   ON profiles FOR UPDATE USING (id = auth.uid()) WITH CHECK (id = auth.uid());
CREATE POLICY p_admin ON profiles FOR UPDATE USING (app_role()='admin');
REVOKE UPDATE ON profiles FROM authenticated;
GRANT  UPDATE (full_name, language) ON profiles TO authenticated;   -- role/status changes: admin RPC / service role

CREATE POLICY sp_self  ON student_profiles FOR ALL USING (user_id=auth.uid()) WITH CHECK (user_id=auth.uid());
CREATE POLICY sp_staff ON student_profiles FOR SELECT USING (app_role() IN ('coordinator','admin'));
REVOKE INSERT, UPDATE ON student_profiles FROM authenticated;
GRANT  INSERT (user_id, exam, stream_id, department_id), UPDATE (exam, stream_id, department_id) ON student_profiles TO authenticated;  -- plan stays server-controlled

-- reference data: any signed-in user can read
CREATE POLICY r_tree   ON tree_nodes   FOR SELECT TO authenticated USING (true);
CREATE POLICY r_course ON courses      FOR SELECT TO authenticated USING (true);
CREATE POLICY r_nc     ON node_courses FOR SELECT TO authenticated USING (true);
CREATE POLICY r_topics ON topics       FOR SELECT TO authenticated USING (true);
CREATE POLICY r_ann    ON announcements FOR SELECT TO authenticated USING (starts_at<=now() AND (ends_at IS NULL OR ends_at>now()));
CREATE POLICY r_set    ON settings     FOR SELECT TO authenticated USING (true);
CREATE POLICY w_tree   ON tree_nodes   FOR ALL USING (app_role() IN ('admin','coordinator'));
CREATE POLICY w_course ON courses      FOR ALL USING (app_role() IN ('admin','coordinator'));
CREATE POLICY w_nc     ON node_courses FOR ALL USING (app_role() IN ('admin','coordinator'));
CREATE POLICY w_ann    ON announcements FOR ALL USING (app_role() IN ('admin','coordinator'));
CREATE POLICY w_set    ON settings     FOR ALL USING (app_role()='admin');

-- coordinator scope / assignments
CREATE POLICY cs_read ON coordinator_scopes FOR SELECT USING (user_id=auth.uid() OR app_role()='admin');
CREATE POLICY cs_adm  ON coordinator_scopes FOR ALL USING (app_role()='admin');
CREATE POLICY ca_read ON course_assignments FOR SELECT USING (user_id=auth.uid() OR app_role() IN ('coordinator','admin'));
CREATE POLICY ca_wr   ON course_assignments FOR ALL USING (app_role() IN ('coordinator','admin'));

-- department pages: students see published only
CREATE POLICY dp_pub  ON department_pages FOR SELECT TO authenticated USING (status='published' OR app_role() IN ('coordinator','admin'));
CREATE POLICY dp_wr   ON department_pages FOR ALL USING (app_role()='coordinator');
CREATE POLICY bp_pub  ON department_blueprint FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM department_pages d WHERE d.node_id=department_blueprint.node_id));
CREATE POLICY bp_wr   ON department_blueprint FOR ALL USING (app_role()='coordinator');

-- questions: students -> published only; instructors -> their courses; coordinators -> all
CREATE POLICY q_student ON questions FOR SELECT USING (app_role()='student' AND status='published');
CREATE POLICY q_instr   ON questions FOR SELECT USING (app_role()='instructor' AND (author_id=auth.uid() OR is_assigned(course_id)));
CREATE POLICY q_coord   ON questions FOR SELECT USING (app_role() IN ('coordinator','admin'));
CREATE POLICY q_ins     ON questions FOR INSERT WITH CHECK (app_role()='instructor' AND author_id=auth.uid() AND is_assigned(course_id) AND status='draft');
CREATE POLICY q_upd_a   ON questions FOR UPDATE USING (app_role()='instructor' AND author_id=auth.uid() AND status IN ('draft','sent_back'))
                                       WITH CHECK (author_id=auth.uid() AND status IN ('draft','in_review'));
CREATE POLICY q_upd_c   ON questions FOR UPDATE USING (app_role()='coordinator') WITH CHECK (reviewer_id=auth.uid());
-- options inherit question visibility; keys are staff-only (students: no policy = no access)
CREATE POLICY o_read ON question_options FOR SELECT USING (EXISTS (SELECT 1 FROM questions q WHERE q.id=question_id));
CREATE POLICY o_wr   ON question_options FOR ALL USING (EXISTS (SELECT 1 FROM questions q WHERE q.id=question_id AND q.author_id=auth.uid() AND q.status IN ('draft','sent_back')));
CREATE POLICY k_staff ON question_answer_keys FOR SELECT USING (app_role() IN ('instructor','coordinator'));
CREATE POLICY k_wr    ON question_answer_keys FOR ALL USING (EXISTS (SELECT 1 FROM questions q WHERE q.id=question_id AND q.author_id=auth.uid() AND q.status IN ('draft','sent_back')));
CREATE POLICY qh_read ON question_status_history FOR SELECT USING (app_role() IN ('instructor','coordinator','admin'));

-- attempts: students read their own; all writes go through the RPCs above
CREATE POLICY a_own  ON exam_attempts   FOR SELECT USING (student_id=auth.uid());
CREATE POLICY aq_own ON attempt_questions FOR SELECT USING (EXISTS (SELECT 1 FROM exam_attempts e WHERE e.id=attempt_id AND e.student_id=auth.uid()));
CREATE POLICY aa_own ON attempt_answers FOR SELECT USING (EXISTS (SELECT 1 FROM exam_attempts e WHERE e.id=attempt_id AND e.student_id=auth.uid()));
CREATE POLICY a_staff ON exam_attempts  FOR SELECT USING (app_role() IN ('coordinator','admin'));

-- reports: student creates + reads own; instructor of that course / coordinator handle
CREATE POLICY rp_ins  ON question_reports FOR INSERT WITH CHECK (reporter_id=auth.uid() AND app_role()='student');
CREATE POLICY rp_own  ON question_reports FOR SELECT USING (reporter_id=auth.uid());
CREATE POLICY rp_staff ON question_reports FOR SELECT USING (app_role()='coordinator' OR (app_role()='instructor' AND is_assigned(course_id)));
CREATE POLICY rp_upd  ON question_reports FOR UPDATE USING (app_role()='coordinator' OR (app_role()='instructor' AND is_assigned(course_id)))
                                          WITH CHECK (handled_by=auth.uid());

-- notifications / downloads / payments: own rows
CREATE POLICY n_own  ON notifications     FOR SELECT USING (user_id=auth.uid());
CREATE POLICY n_read ON notifications     FOR UPDATE USING (user_id=auth.uid()) WITH CHECK (user_id=auth.uid());
CREATE POLICY od_own ON offline_downloads FOR ALL USING (student_id=auth.uid()) WITH CHECK (student_id=auth.uid());
CREATE POLICY pay_own ON payments         FOR SELECT USING (student_id=auth.uid());
CREATE POLICY au_adm ON audit_log         FOR SELECT USING (app_role()='admin');
-- tab_switch_events: no policy (written only by log_tab_switch RPC)

-- Lock the RPCs to signed-in users only
REVOKE EXECUTE ON FUNCTION start_attempt, save_answer, log_tab_switch, submit_attempt, attempt_review FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION start_attempt, save_answer, log_tab_switch, submit_attempt, attempt_review TO authenticated;
REVOKE ALL ON question_performance FROM anon, authenticated;

-- ---------- Safety net: privileged columns can't be self-edited ------------
-- Supabase gives signed-in users broad table grants by default, so we also guard in a trigger.
-- Only an admin (or the service role / dashboard, where auth.uid() is NULL) may change these.
CREATE OR REPLACE FUNCTION guard_profile() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NOT NULL AND app_role() IS DISTINCT FROM 'admin'
     AND (NEW.role <> OLD.role OR NEW.status <> OLD.status OR NEW.email <> OLD.email OR NEW.id <> OLD.id) THEN
    RAISE EXCEPTION 'role, status and email can only be changed by an admin';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_guard_profile BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION guard_profile();

CREATE OR REPLACE FUNCTION guard_student_profile() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NOT NULL THEN
    IF TG_OP = 'INSERT' THEN NEW.plan := 'free'; NEW.plan_expires := NULL;
    ELSIF NEW.plan <> OLD.plan OR NEW.plan_expires IS DISTINCT FROM OLD.plan_expires THEN
      RAISE EXCEPTION 'plan is controlled by the server';
    END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_guard_student BEFORE INSERT OR UPDATE ON student_profiles FOR EACH ROW EXECUTE FUNCTION guard_student_profile();
