-- =====================================================================
-- PATCH 6: admin screens (users list, overview counts, settings, audit log)
-- Run once, after patches 1-5. Safe to run again.
-- =====================================================================
BEGIN;

-- 1. Users list for the admin screen (adds "last active" from login or exam activity)
CREATE OR REPLACE FUNCTION admin_list_users()
RETURNS TABLE (id uuid, full_name text, email text, role user_role, status account_status,
               created_at timestamptz, last_active timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF app_role() IS DISTINCT FROM 'admin' THEN RAISE EXCEPTION 'admins only'; END IF;
  RETURN QUERY
  SELECT p.id, p.full_name, p.email::text, p.role, p.status, p.created_at,
         GREATEST(p.last_login_at, (SELECT max(a.started_at) FROM exam_attempts a WHERE a.student_id = p.id))
  FROM profiles p
  ORDER BY p.created_at DESC;
END $$;

-- 2. Overview numbers
CREATE OR REPLACE FUNCTION admin_overview() RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF app_role() IS DISTINCT FROM 'admin' THEN RAISE EXCEPTION 'admins only'; END IF;
  RETURN jsonb_build_object(
    'students',            (SELECT count(*) FROM profiles WHERE role = 'student'),
    'active_students_7d',  (SELECT count(DISTINCT student_id) FROM exam_attempts WHERE started_at > now() - interval '7 days'),
    'published_questions', (SELECT count(*) FROM questions WHERE status = 'published'),
    'published_by_course', COALESCE((SELECT jsonb_object_agg(course_id, n)
                             FROM (SELECT course_id, count(*) n FROM questions
                                   WHERE status = 'published' GROUP BY course_id) x), '{}'::jsonb)
  );
END $$;

-- 3. Change a setting (checked values, written to the audit log)
--    mock_minutes: whole number 1-300.   retake_limit: whole number 1-10, or '' = unlimited.
--    retake_limit counts ATTEMPTS: 1 = no retakes, 2 = one retake, 3 = two retakes.
CREATE OR REPLACE FUNCTION admin_set_setting(p_key text, p_value text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v text := btrim(coalesce(p_value, ''));
BEGIN
  IF app_role() IS DISTINCT FROM 'admin' THEN RAISE EXCEPTION 'admins only'; END IF;
  IF p_key = 'mock_minutes' THEN
    IF v !~ '^[0-9]{1,3}$' OR v::int NOT BETWEEN 1 AND 300 THEN
      RAISE EXCEPTION 'mock_minutes must be a whole number from 1 to 300'; END IF;
  ELSIF p_key = 'retake_limit' THEN
    IF v <> '' AND (v !~ '^[0-9]{1,2}$' OR v::int NOT BETWEEN 1 AND 10) THEN
      RAISE EXCEPTION 'retake_limit must be 1 to 10, or empty for unlimited'; END IF;
  ELSE
    RAISE EXCEPTION 'unknown setting: %', p_key;
  END IF;
  INSERT INTO settings(key, value, updated_by, updated_at) VALUES (p_key, v, auth.uid(), now())
  ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_by = EXCLUDED.updated_by, updated_at = now();
  INSERT INTO audit_log(actor_id, action, target, detail)
  VALUES (auth.uid(), 'settings.update', 'setting:' || p_key, jsonb_build_object('value', v));
END $$;

-- 4. Audit log with the actor's name
CREATE OR REPLACE FUNCTION admin_audit(p_limit int DEFAULT 100)
RETURNS TABLE (id bigint, at timestamptz, actor text, action text, target text, detail jsonb)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF app_role() IS DISTINCT FROM 'admin' THEN RAISE EXCEPTION 'admins only'; END IF;
  RETURN QUERY
  SELECT l.id, l.at, COALESCE(NULLIF(p.full_name, ''), p.email::text, 'system'), l.action, l.target, l.detail
  FROM audit_log l LEFT JOIN profiles p ON p.id = l.actor_id
  ORDER BY l.at DESC, l.id DESC
  LIMIT LEAST(GREATEST(p_limit, 1), 500);
END $$;

-- Settings can only be changed through admin_set_setting (it validates and logs)
REVOKE INSERT, UPDATE, DELETE ON settings FROM authenticated;

REVOKE EXECUTE ON FUNCTION admin_list_users, admin_overview, admin_set_setting, admin_audit FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION admin_list_users, admin_overview, admin_set_setting, admin_audit TO authenticated;

COMMIT;
