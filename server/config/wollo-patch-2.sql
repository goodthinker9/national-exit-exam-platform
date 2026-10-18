-- =====================================================================
-- PATCH 2  (run once, after patch 1)  -- makes the exam work end to end
--  1. start_attempt: resume only the SAME mode, refuse empty courses, clamp the count
--  2. get_attempt: one call returns the questions, saved answers and server clock
--  3. check_practice_answer: instant feedback for PRACTICE only (mock never reveals answers)
-- =====================================================================
BEGIN;

-- 1a. one open attempt per student + course + MODE (was: per course, so a practice
--     attempt in progress was handed back when the student asked for a mock exam)
DROP INDEX IF EXISTS ux_one_open_attempt;
CREATE UNIQUE INDEX ux_one_open_attempt ON exam_attempts(student_id, course_id, mode) WHERE state = 'in_progress';

-- 1b. start_attempt, fixed
CREATE OR REPLACE FUNCTION start_attempt(p_course uuid, p_mode attempt_mode, p_count int DEFAULT 20)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid uuid := auth.uid(); v_id uuid; v_no int; v_limit int; v_mins int; v_n int;
BEGIN
  IF app_role() IS DISTINCT FROM 'student' THEN RAISE EXCEPTION 'students only'; END IF;
  p_count := LEAST(GREATEST(COALESCE(p_count, 20), 1), 100);
  SELECT id INTO v_id FROM exam_attempts
   WHERE student_id = v_uid AND course_id = p_course AND mode = p_mode AND state = 'in_progress';
  IF v_id IS NOT NULL THEN RETURN v_id; END IF;               -- resume, don't duplicate
  SELECT count(*) INTO v_n FROM questions WHERE course_id = p_course AND status = 'published';
  IF v_n = 0 THEN RAISE EXCEPTION 'no questions available for this course yet'; END IF;
  IF p_mode = 'mock' THEN
    v_limit := setting_int('retake_limit');
    SELECT count(*) + 1 INTO v_no FROM exam_attempts WHERE student_id = v_uid AND course_id = p_course AND mode = 'mock';
    IF v_limit IS NOT NULL AND v_no > v_limit THEN RAISE EXCEPTION 'retake limit reached'; END IF;
    v_mins := COALESCE(setting_int('mock_minutes'), 10);
  END IF;
  INSERT INTO exam_attempts(student_id, course_id, mode, ends_at, attempt_no)
  VALUES (v_uid, p_course, p_mode, CASE WHEN p_mode = 'mock' THEN now() + make_interval(mins => v_mins) END, COALESCE(v_no, 1))
  RETURNING id INTO v_id;
  INSERT INTO attempt_questions(attempt_id, question_id, position)
  SELECT v_id, id, row_number() OVER () - 1
  FROM (SELECT id FROM questions WHERE course_id = p_course AND status = 'published' ORDER BY random() LIMIT p_count) q;
  UPDATE exam_attempts SET total = (SELECT count(*) FROM attempt_questions WHERE attempt_id = v_id) WHERE id = v_id;
  RETURN v_id;
END $$;

-- 2. everything the quiz screen needs in ONE call. Never includes answers or explanations.
CREATE OR REPLACE FUNCTION get_attempt(p_attempt uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE e exam_attempts; v jsonb;
BEGIN
  SELECT * INTO e FROM exam_attempts WHERE id = p_attempt AND student_id = auth.uid();
  IF NOT FOUND THEN RAISE EXCEPTION 'attempt not found'; END IF;
  SELECT jsonb_build_object(
    'id', e.id, 'course_id', e.course_id, 'mode', e.mode, 'state', e.state,
    'ends_at', e.ends_at, 'server_now', now(), 'tab_switches', e.tab_switches, 'total', e.total,
    'questions', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
               'id', q.id, 'text', q.body, 'difficulty', q.difficulty, 'topic', t.name,
               'options', (SELECT jsonb_agg(jsonb_build_object('id', o.id, 'text', o.text) ORDER BY o.position)
                           FROM question_options o WHERE o.question_id = q.id))
             ORDER BY aq.position)
      FROM attempt_questions aq JOIN questions q ON q.id = aq.question_id
      LEFT JOIN topics t ON t.id = q.topic_id WHERE aq.attempt_id = e.id), '[]'::jsonb),
    'answers', COALESCE((SELECT jsonb_object_agg(question_id::text, option_id)
                         FROM attempt_answers WHERE attempt_id = e.id AND option_id IS NOT NULL), '{}'::jsonb)
  ) INTO v;
  RETURN v;
END $$;

-- 3. PRACTICE ONLY: save the answer and reveal right/wrong + explanation immediately.
--    Refuses on mock attempts, so a mock exam can never leak answers.
CREATE OR REPLACE FUNCTION check_practice_answer(p_attempt uuid, p_question uuid, p_option uuid)
RETURNS TABLE(correct_option uuid, is_correct boolean, explanation text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE a exam_attempts; v_key uuid;
BEGIN
  SELECT * INTO a FROM exam_attempts WHERE id = p_attempt AND student_id = auth.uid();
  IF NOT FOUND OR a.state <> 'in_progress' THEN RAISE EXCEPTION 'attempt not open'; END IF;
  IF a.mode <> 'practice' THEN RAISE EXCEPTION 'answers are hidden during a mock exam'; END IF;
  IF NOT EXISTS (SELECT 1 FROM attempt_questions WHERE attempt_id = p_attempt AND question_id = p_question) THEN
    RAISE EXCEPTION 'question is not part of this attempt'; END IF;
  IF NOT EXISTS (SELECT 1 FROM question_options WHERE id = p_option AND question_id = p_question) THEN
    RAISE EXCEPTION 'option does not belong to question'; END IF;
  SELECT option_id INTO v_key FROM question_answer_keys WHERE question_id = p_question;
  INSERT INTO attempt_answers(attempt_id, question_id, option_id, is_correct)
  VALUES (p_attempt, p_question, p_option, p_option = v_key)
  ON CONFLICT (attempt_id, question_id) DO NOTHING;            -- practice: first answer counts, no changing
  RETURN QUERY SELECT v_key, (SELECT aa.is_correct FROM attempt_answers aa WHERE aa.attempt_id = p_attempt AND aa.question_id = p_question),
                      (SELECT ex.text FROM question_explanations ex WHERE ex.question_id = p_question);
END $$;

REVOKE EXECUTE ON FUNCTION get_attempt, check_practice_answer FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION get_attempt, check_practice_answer TO authenticated;
COMMIT;
