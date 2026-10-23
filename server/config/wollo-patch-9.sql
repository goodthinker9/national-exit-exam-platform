-- =====================================================================
-- PATCH 9: student progress from real exam attempts
--   my_history      - finished exams (score, course, date), newest first
--   my_weak_topics  - topics where the student's own answers are weakest
--   my_activity     - study streak (days in a row) and today's progress toward the daily goal
-- Every function returns ONLY the signed-in student's own data. Days are counted in Ethiopian time.
-- Run once, after patches 1-8. Safe to run again.
-- =====================================================================
BEGIN;

-- 1. History of finished exams. Overdue mock attempts are closed (and scored) first.
CREATE OR REPLACE FUNCTION my_history(p_limit int DEFAULT 50)
RETURNS TABLE (attempt_id uuid, course_id uuid, course_name text, mode attempt_mode, state attempt_state,
               started_at timestamptz, finished_at timestamptz, correct int, total int, answered int,
               score_pct numeric, tab_switches int)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not signed in'; END IF;
  PERFORM close_my_overdue_attempts();
  RETURN QUERY
  SELECT e.id, e.course_id, c.name, e.mode, e.state, e.started_at, COALESCE(e.submitted_at, e.started_at),
         COALESCE(e.correct, 0), e.total,
         (SELECT count(*)::int FROM attempt_answers aa WHERE aa.attempt_id = e.id AND aa.option_id IS NOT NULL),
         e.score_pct, e.tab_switches
    FROM exam_attempts e JOIN courses c ON c.id = e.course_id
   WHERE e.student_id = auth.uid() AND e.state IN ('submitted', 'expired')
   ORDER BY COALESCE(e.submitted_at, e.started_at) DESC
   LIMIT LEAST(GREATEST(COALESCE(p_limit, 50), 1), 200);
END $$;

-- 2. Weak topics: topics with at least 3 answered questions and under 70% correct, lowest first.
CREATE OR REPLACE FUNCTION my_weak_topics(p_limit int DEFAULT 8)
RETURNS TABLE (topic text, course_id uuid, course_name text, answered int, correct int, pct numeric)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT t.name, c.id, c.name,
         count(*)::int,
         count(*) FILTER (WHERE aa.is_correct)::int,
         round(100.0 * count(*) FILTER (WHERE aa.is_correct) / count(*), 0)
    FROM attempt_answers aa
    JOIN exam_attempts e ON e.id = aa.attempt_id AND e.student_id = auth.uid()
    JOIN questions q ON q.id = aa.question_id
    JOIN topics t ON t.id = q.topic_id
    JOIN courses c ON c.id = q.course_id
   WHERE aa.option_id IS NOT NULL AND aa.is_correct IS NOT NULL
   GROUP BY t.id, t.name, c.id, c.name
  HAVING count(*) >= 3 AND 100.0 * count(*) FILTER (WHERE aa.is_correct) / count(*) < 70
   ORDER BY 6 ASC, 4 DESC
   LIMIT LEAST(GREATEST(COALESCE(p_limit, 8), 1), 30);
$$;

-- 3. Streak and daily goal (goal = 10 answered questions per day, Ethiopian time).
--    The streak does not break until a whole day passes with no answers: if you have not studied yet
--    today, yesterday's streak still shows.
CREATE OR REPLACE FUNCTION my_activity()
RETURNS TABLE (streak_days int, today_answered int, daily_goal int, total_answered int)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE tz text := 'Africa/Addis_Ababa'; d date := (now() AT TIME ZONE 'Africa/Addis_Ababa')::date;
        n int := 0; v_today int; v_total int;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not signed in'; END IF;
  SELECT count(*)::int INTO v_today FROM attempt_answers aa JOIN exam_attempts e ON e.id = aa.attempt_id
   WHERE e.student_id = auth.uid() AND aa.option_id IS NOT NULL AND (aa.answered_at AT TIME ZONE tz)::date = d;
  SELECT count(*)::int INTO v_total FROM attempt_answers aa JOIN exam_attempts e ON e.id = aa.attempt_id
   WHERE e.student_id = auth.uid() AND aa.option_id IS NOT NULL;
  IF v_today = 0 THEN d := d - 1; END IF;
  WHILE EXISTS (SELECT 1 FROM attempt_answers aa JOIN exam_attempts e ON e.id = aa.attempt_id
                 WHERE e.student_id = auth.uid() AND aa.option_id IS NOT NULL AND (aa.answered_at AT TIME ZONE tz)::date = d) LOOP
    n := n + 1; d := d - 1;
  END LOOP;
  RETURN QUERY SELECT n, v_today, 10, v_total;
END $$;

REVOKE EXECUTE ON FUNCTION my_history(int), my_weak_topics(int), my_activity() FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION my_history(int), my_weak_topics(int), my_activity() TO authenticated;

COMMIT;
