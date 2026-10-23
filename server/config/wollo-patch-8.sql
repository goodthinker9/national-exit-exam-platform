-- =====================================================================
-- PATCH 8: a mock exam whose time has run out is closed, never resumed.
-- Problem: start_attempt gave back an unfinished mock attempt even when its deadline had
-- passed, so the student opened a mock exam showing 00:00 that submitted itself at once.
-- Fix: an overdue mock attempt is scored with the answers saved so far and marked 'expired'.
-- The student then gets a NEW attempt (still limited by the retake setting).
-- Run once, after patches 1-7. Safe to run again.
-- =====================================================================
BEGIN;

-- Internal helper (not callable from the browser): score and close one overdue attempt.
CREATE OR REPLACE FUNCTION close_expired_attempt(p_attempt uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_correct int;
BEGIN
  UPDATE attempt_answers aa SET is_correct = (k.option_id = aa.option_id)
    FROM question_answer_keys k
   WHERE aa.attempt_id = p_attempt AND k.question_id = aa.question_id;
  SELECT count(*) INTO v_correct FROM attempt_answers WHERE attempt_id = p_attempt AND is_correct;
  UPDATE exam_attempts e
     SET state = 'expired', submitted_at = COALESCE(e.ends_at, now()), correct = v_correct,
         score_pct = round(100.0 * v_correct / NULLIF(e.total, 0), 2)
   WHERE e.id = p_attempt AND e.state = 'in_progress';
END $$;
REVOKE ALL ON FUNCTION close_expired_attempt(uuid) FROM PUBLIC, anon, authenticated;

-- start_attempt: same as patch 2, except an overdue open MOCK attempt is closed first.
CREATE OR REPLACE FUNCTION start_attempt(p_course uuid, p_mode attempt_mode, p_count int DEFAULT 20)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid uuid := auth.uid(); v_id uuid; v_ends timestamptz; v_no int; v_limit int; v_mins int; v_n int;
BEGIN
  IF app_role() IS DISTINCT FROM 'student' THEN RAISE EXCEPTION 'students only'; END IF;
  p_count := LEAST(GREATEST(COALESCE(p_count, 20), 1), 100);
  SELECT id, ends_at INTO v_id, v_ends FROM exam_attempts
   WHERE student_id = v_uid AND course_id = p_course AND mode = p_mode AND state = 'in_progress'
   ORDER BY started_at DESC LIMIT 1;
  IF v_id IS NOT NULL THEN
    IF p_mode = 'mock' AND v_ends IS NOT NULL AND v_ends <= now() THEN
      PERFORM close_expired_attempt(v_id);          -- time ran out earlier: score it, then start fresh
      v_id := NULL;
    ELSE
      RETURN v_id;                                  -- still running (or practice): resume
    END IF;
  END IF;
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

-- The student's own overdue mock attempts, closed on demand. The app calls this before starting an
-- exam, so an overdue attempt is closed (and scored) even when the retake limit stops a new one.
CREATE OR REPLACE FUNCTION close_my_overdue_attempts() RETURNS int
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r record; n int := 0;
BEGIN
  IF auth.uid() IS NULL THEN RETURN 0; END IF;
  FOR r IN SELECT id FROM exam_attempts
            WHERE student_id = auth.uid() AND mode = 'mock' AND state = 'in_progress' AND ends_at <= now() LOOP
    PERFORM close_expired_attempt(r.id);
    n := n + 1;
  END LOOP;
  RETURN n;
END $$;
REVOKE EXECUTE ON FUNCTION close_my_overdue_attempts() FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION close_my_overdue_attempts() TO authenticated;

-- One-time cleanup: close every mock attempt that is already overdue.
DO $$ DECLARE r record;
BEGIN
  FOR r IN SELECT id FROM exam_attempts WHERE mode = 'mock' AND state = 'in_progress' AND ends_at <= now() LOOP
    PERFORM close_expired_attempt(r.id);
  END LOOP;
END $$;

REVOKE EXECUTE ON FUNCTION start_attempt(uuid, attempt_mode, int) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION start_attempt(uuid, attempt_mode, int) TO authenticated;

COMMIT;
