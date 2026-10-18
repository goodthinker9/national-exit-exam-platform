-- =====================================================================
-- PATCH 1  (run once, AFTER wollo-exam-prep-supabase.sql and the seed)
--  1. Hide explanations from students until the exam is submitted
--  2. Automatically record question status history + updated_at
--  3. Safe admin function to change a user's role / active status
-- =====================================================================
BEGIN;

-- 1. Explanations often give the answer away, and students can read every
--    column of a published question. Move them to a staff-only table.
CREATE TABLE question_explanations (
  question_id uuid PRIMARY KEY REFERENCES questions(id) ON DELETE CASCADE, 
  text        text NOT NULL
);
INSERT INTO question_explanations(question_id, text)
  SELECT id, explanation FROM questions WHERE explanation IS NOT NULL AND explanation <> '';
ALTER TABLE questions DROP COLUMN explanation;

ALTER TABLE question_explanations ENABLE ROW LEVEL SECURITY;
CREATE POLICY ex_staff ON question_explanations FOR SELECT USING (app_role() IN ('instructor','coordinator'));
CREATE POLICY ex_wr    ON question_explanations FOR ALL USING (EXISTS (
  SELECT 1 FROM questions q WHERE q.id = question_id AND q.author_id = auth.uid() AND q.status IN ('draft','sent_back')));

-- review (after submit only) now reads the explanation from the new table
CREATE OR REPLACE FUNCTION attempt_review(p_attempt uuid)
RETURNS TABLE(question_id uuid, correct_option uuid, chosen_option uuid, explanation text)
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT aq.question_id, k.option_id, aa.option_id, ex.text
  FROM exam_attempts e
  JOIN attempt_questions aq ON aq.attempt_id = e.id
  JOIN question_answer_keys k ON k.question_id = aq.question_id
  LEFT JOIN question_explanations ex ON ex.question_id = aq.question_id
  LEFT JOIN attempt_answers aa ON aa.attempt_id = e.id AND aa.question_id = aq.question_id
  WHERE e.id = p_attempt AND e.student_id = auth.uid() AND e.state IN ('submitted','expired') $$;

-- 2. Nothing was writing question_status_history; now every change is logged.
CREATE OR REPLACE FUNCTION log_question_status() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO question_status_history(question_id, from_status, to_status, actor_id)
    VALUES (NEW.id, NULL, NEW.status, COALESCE(auth.uid(), NEW.author_id));
  ELSIF NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO question_status_history(question_id, from_status, to_status, actor_id, note)
    VALUES (NEW.id, OLD.status, NEW.status, COALESCE(auth.uid(), NEW.author_id), NEW.review_note);
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_question_history AFTER INSERT OR UPDATE OF status ON questions
  FOR EACH ROW EXECUTE FUNCTION log_question_status();

CREATE OR REPLACE FUNCTION touch_updated_at() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at := now(); RETURN NEW; END $$;
CREATE TRIGGER trg_questions_touch BEFORE UPDATE ON questions FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

-- 3. Admin screen: change role / activate / deactivate (column grants block this from the client).
CREATE OR REPLACE FUNCTION admin_set_user(p_user uuid, p_role user_role, p_status account_status)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF app_role() IS DISTINCT FROM 'admin' THEN RAISE EXCEPTION 'admins only'; END IF;
  IF p_user = auth.uid() AND (p_role <> 'admin' OR p_status <> 'active') THEN
    RAISE EXCEPTION 'you cannot demote or deactivate yourself'; END IF;
  UPDATE profiles SET role = p_role, status = p_status WHERE id = p_user;
  INSERT INTO audit_log(actor_id, action, target, detail)
  VALUES (auth.uid(), 'user.update', 'user:' || p_user, jsonb_build_object('role', p_role, 'status', p_status));
END $$;
REVOKE EXECUTE ON FUNCTION admin_set_user FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION admin_set_user TO authenticated;

COMMIT;
