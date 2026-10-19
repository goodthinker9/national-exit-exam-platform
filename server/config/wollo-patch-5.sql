-- =====================================================================
-- WOLLO PATCH 5 - the student's study plan (remedial or exit + stream/department)
-- Run AFTER patch 4.  Safe to run twice.
-- 1. Sign-up saves the choice (sent with the sign-up request, so it also works
--    when the student must confirm their email first).
-- 2. get_my_study_plan()  - what the app reads after login.
-- 3. set_my_study_plan()  - used by students who have no plan yet, or want to change it.
-- A wrong or missing choice never blocks sign-up; the app simply asks again after login.
-- =====================================================================

CREATE OR REPLACE FUNCTION handle_new_user() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_exam text; v_stream uuid; v_dept uuid;
BEGIN
  INSERT INTO profiles(id, email, full_name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'full_name',''));

  BEGIN
    v_exam := NEW.raw_user_meta_data->>'exam';
    IF v_exam = 'exit' THEN
      v_dept := NULLIF(NEW.raw_user_meta_data->>'department_id','')::uuid;
      IF EXISTS (SELECT 1 FROM tree_nodes WHERE id = v_dept AND exam = 'exit' AND kind = 'department' AND is_active) THEN
        INSERT INTO student_profiles(user_id, exam, department_id) VALUES (NEW.id, 'exit', v_dept);
      END IF;
    ELSIF v_exam = 'remedial' THEN
      v_stream := NULLIF(NEW.raw_user_meta_data->>'stream_id','')::uuid;
      IF EXISTS (SELECT 1 FROM tree_nodes WHERE id = v_stream AND exam = 'remedial' AND kind = 'stream' AND is_active) THEN
        INSERT INTO student_profiles(user_id, exam, stream_id) VALUES (NEW.id, 'remedial', v_stream);
      END IF;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    NULL;   -- never block sign-up because of the study plan
  END;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION get_my_study_plan() RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT jsonb_build_object(
    'exam', sp.exam,
    'stream_id', sp.stream_id,       'stream_name', s.name,
    'department_id', sp.department_id, 'department_name', d.name)
  FROM student_profiles sp
  LEFT JOIN tree_nodes s ON s.id = sp.stream_id
  LEFT JOIN tree_nodes d ON d.id = sp.department_id
  WHERE sp.user_id = auth.uid() $$;

CREATE OR REPLACE FUNCTION set_my_study_plan(p_exam text, p_stream uuid, p_department uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF app_role() IS DISTINCT FROM 'student' THEN RAISE EXCEPTION 'students only'; END IF;
  IF p_exam = 'exit' THEN
    IF NOT EXISTS (SELECT 1 FROM tree_nodes WHERE id = p_department AND exam = 'exit' AND kind = 'department' AND is_active) THEN
      RAISE EXCEPTION 'choose a valid department';
    END IF;
    INSERT INTO student_profiles(user_id, exam, stream_id, department_id) VALUES (auth.uid(), 'exit', NULL, p_department)
      ON CONFLICT (user_id) DO UPDATE SET exam = 'exit', stream_id = NULL, department_id = EXCLUDED.department_id;
  ELSIF p_exam = 'remedial' THEN
    IF NOT EXISTS (SELECT 1 FROM tree_nodes WHERE id = p_stream AND exam = 'remedial' AND kind = 'stream' AND is_active) THEN
      RAISE EXCEPTION 'choose a valid stream';
    END IF;
    INSERT INTO student_profiles(user_id, exam, stream_id, department_id) VALUES (auth.uid(), 'remedial', p_stream, NULL)
      ON CONFLICT (user_id) DO UPDATE SET exam = 'remedial', stream_id = EXCLUDED.stream_id, department_id = NULL;
  ELSE
    RAISE EXCEPTION 'choose remedial or exit exam';
  END IF;
  RETURN get_my_study_plan();
END $$;

REVOKE ALL ON FUNCTION get_my_study_plan()                 FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION set_my_study_plan(text,uuid,uuid)   FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION get_my_study_plan(), set_my_study_plan(text,uuid,uuid) TO authenticated;
