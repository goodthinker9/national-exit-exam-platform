-- =====================================================================
-- PATCH 10: announcements from the database
--   create_announcement   - staff write one; the database checks who may reach which students
--   delete_announcement   - authors delete their own; admins delete any
--   my_announcements      - what the signed-in STUDENT should see on the dashboard
--   manage_announcements  - what staff see in their Announcements screen (with how many students it reached)
--   announcement_targets  - the programs and courses the signed-in staff member may choose
--
-- Who can reach whom
--   admin        everyone, or any program (stream / field / subgroup / department), or any course
--   coordinator  only programs and courses inside their own scope (never "everyone")
--   instructor   only students whose program contains one of their assigned courses
-- Optional bell alert ("important") goes to the audience only. Non-admins: max 10 announcements and
-- 3 alerts per 24 hours, so nobody can flood the students.
-- Table access is closed: all reads and writes go through the functions above.
-- Run once, after patches 1-9. Safe to run again.
-- =====================================================================
BEGIN;

-- 1. New columns and limits
ALTER TABLE announcements
  ADD COLUMN IF NOT EXISTS course_id   uuid REFERENCES courses(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS important   boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS author_name text,
  ADD COLUMN IF NOT EXISTS author_role user_role;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ann_one_target') THEN
    ALTER TABLE announcements ADD CONSTRAINT ann_one_target CHECK (node_id IS NULL OR course_id IS NULL);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ann_lengths') THEN
    ALTER TABLE announcements ADD CONSTRAINT ann_lengths
      CHECK (char_length(btrim(title)) BETWEEN 1 AND 120 AND char_length(btrim(body)) BETWEEN 1 AND 500);
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS ix_ann_active ON announcements(starts_at DESC);

-- 2. Close direct table access (the functions below are the only way in)
DROP POLICY IF EXISTS r_ann ON announcements;
DROP POLICY IF EXISTS w_ann ON announcements;
REVOKE ALL ON announcements FROM authenticated, anon;

-- 3. Internal helpers (not callable from the browser)
-- Is this tree node inside the signed-in coordinator's scope? (the node itself or anything below a scope node)
CREATE OR REPLACE FUNCTION ann_node_in_scope(p_node uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH RECURSIVE up AS (
    SELECT id, parent_id FROM tree_nodes WHERE id = p_node
    UNION
    SELECT n.id, n.parent_id FROM tree_nodes n JOIN up ON n.id = up.parent_id)
  SELECT EXISTS (SELECT 1 FROM up JOIN coordinator_scopes cs ON cs.node_id = up.id AND cs.user_id = auth.uid()) $$;

CREATE OR REPLACE FUNCTION ann_course_in_scope(p_course uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM node_courses nc WHERE nc.course_id = p_course AND ann_node_in_scope(nc.node_id)) $$;

-- Does this announcement target (everyone / a program / a course) reach this student?
CREATE OR REPLACE FUNCTION ann_matches(p_node uuid, p_course uuid, p_student uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE
    WHEN p_node IS NULL AND p_course IS NULL THEN true
    WHEN p_node IS NOT NULL THEN EXISTS (
      WITH RECURSIVE up AS (
        SELECT n.id, n.parent_id FROM tree_nodes n
         WHERE n.id IN (SELECT sp.department_id FROM student_profiles sp WHERE sp.user_id = p_student)
            OR n.id IN (SELECT sp.stream_id     FROM student_profiles sp WHERE sp.user_id = p_student)
        UNION
        SELECT n.id, n.parent_id FROM tree_nodes n JOIN up ON n.id = up.parent_id)
      SELECT 1 FROM up WHERE up.id = p_node)
    ELSE EXISTS (
      SELECT 1 FROM student_profiles sp
        JOIN node_courses nc ON nc.node_id = sp.stream_id OR nc.node_id = sp.department_id
       WHERE sp.user_id = p_student AND nc.course_id = p_course)
  END $$;

-- 4. Programs and courses the signed-in staff member may choose as an audience
CREATE OR REPLACE FUNCTION announcement_targets()
RETURNS TABLE (kind text, id uuid, name text, path text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_role user_role := app_role();
BEGIN
  IF v_role IS NULL OR v_role NOT IN ('admin', 'coordinator', 'instructor') THEN
    RAISE EXCEPTION 'staff only';
  END IF;

  IF v_role IN ('admin', 'coordinator') THEN
    RETURN QUERY
    WITH RECURSIVE p AS (
      SELECT n.id, n.exam, n.name, n.name::text AS path, n.is_active
        FROM tree_nodes n WHERE n.parent_id IS NULL
      UNION ALL
      SELECT n.id, n.exam, n.name, p.path || ' › ' || n.name, n.is_active
        FROM tree_nodes n JOIN p ON n.parent_id = p.id)
    SELECT 'node'::text, p.id, p.name,
           (CASE p.exam WHEN 'remedial' THEN 'Remedial' ELSE 'Exit exam' END) || ' › ' || p.path
      FROM p
     WHERE p.is_active AND (v_role = 'admin' OR ann_node_in_scope(p.id))
     ORDER BY 4;
  END IF;

  IF v_role IN ('admin', 'coordinator') THEN
    RETURN QUERY
    SELECT 'course'::text, c.id, c.name,
           COALESCE((SELECT string_agg(DISTINCT n.name, ', ') FROM node_courses nc JOIN tree_nodes n ON n.id = nc.node_id
                      WHERE nc.course_id = c.id), '')
      FROM courses c
     WHERE c.is_active AND (v_role = 'admin' OR ann_course_in_scope(c.id))
     ORDER BY c.name;
  ELSE
    RETURN QUERY
    SELECT 'course'::text, c.id, c.name,
           COALESCE((SELECT string_agg(DISTINCT n.name, ', ') FROM node_courses nc JOIN tree_nodes n ON n.id = nc.node_id
                      WHERE nc.course_id = c.id), '')
      FROM courses c
      JOIN course_assignments ca ON ca.course_id = c.id AND ca.user_id = auth.uid()
     WHERE c.is_active
     ORDER BY c.name;
  END IF;
END $$;

-- 5. Create an announcement
CREATE OR REPLACE FUNCTION create_announcement(
  p_title text, p_body text,
  p_node uuid DEFAULT NULL, p_course uuid DEFAULT NULL,
  p_important boolean DEFAULT false, p_ends_at timestamptz DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_role  user_role := app_role();
  v_title text := btrim(COALESCE(p_title, ''));
  v_body  text := btrim(COALESCE(p_body, ''));
  v_name  text;
  v_id    uuid;
  v_reach int;
BEGIN
  IF v_role IS NULL OR v_role NOT IN ('admin', 'coordinator', 'instructor') THEN
    RAISE EXCEPTION 'staff only';
  END IF;
  IF v_title = ''                THEN RAISE EXCEPTION 'Add a title.'; END IF;
  IF char_length(v_title) > 120  THEN RAISE EXCEPTION 'The title is too long (120 characters at most).'; END IF;
  IF v_body = ''                 THEN RAISE EXCEPTION 'Write the message.'; END IF;
  IF char_length(v_body) > 500   THEN RAISE EXCEPTION 'The message is too long (500 characters at most).'; END IF;
  IF p_node IS NOT NULL AND p_course IS NOT NULL THEN
    RAISE EXCEPTION 'Choose one audience: a program or a course, not both.';
  END IF;
  IF p_node   IS NOT NULL AND NOT EXISTS (SELECT 1 FROM tree_nodes WHERE id = p_node)  THEN RAISE EXCEPTION 'Unknown program.'; END IF;
  IF p_course IS NOT NULL AND NOT EXISTS (SELECT 1 FROM courses    WHERE id = p_course) THEN RAISE EXCEPTION 'Unknown course.'; END IF;
  IF p_ends_at IS NOT NULL AND p_ends_at <= now() THEN RAISE EXCEPTION 'The end date must be in the future.'; END IF;

  IF v_role = 'instructor' THEN
    IF p_course IS NULL OR p_node IS NOT NULL THEN RAISE EXCEPTION 'Instructors must choose one of their own courses.'; END IF;
    IF NOT is_assigned(p_course)                THEN RAISE EXCEPTION 'You are not assigned to this course.'; END IF;
  ELSIF v_role = 'coordinator' THEN
    IF p_node IS NULL AND p_course IS NULL THEN RAISE EXCEPTION 'Coordinators must choose a program or course in their scope.'; END IF;
    IF p_node   IS NOT NULL AND NOT ann_node_in_scope(p_node)     THEN RAISE EXCEPTION 'This program is outside your scope.'; END IF;
    IF p_course IS NOT NULL AND NOT ann_course_in_scope(p_course) THEN RAISE EXCEPTION 'This course is outside your scope.'; END IF;
  END IF;

  IF v_role <> 'admin' THEN
    IF (SELECT count(*) FROM announcements WHERE author_id = auth.uid() AND starts_at > now() - interval '24 hours') >= 10 THEN
      RAISE EXCEPTION 'Daily limit reached (10 announcements). Try again tomorrow.';
    END IF;
    IF COALESCE(p_important, false) AND
       (SELECT count(*) FROM announcements WHERE author_id = auth.uid() AND important AND starts_at > now() - interval '24 hours') >= 3 THEN
      RAISE EXCEPTION 'Daily limit reached (3 alerts). Send it without the alert, or try again tomorrow.';
    END IF;
  END IF;

  SELECT COALESCE(NULLIF(btrim(full_name), ''), email::text) INTO v_name FROM profiles WHERE id = auth.uid();

  INSERT INTO announcements(author_id, title, body, node_id, course_id, important, author_name, author_role, ends_at)
  VALUES (auth.uid(), v_title, v_body, p_node, p_course, COALESCE(p_important, false), v_name, v_role, p_ends_at)
  RETURNING id INTO v_id;

  SELECT count(*)::int INTO v_reach FROM profiles p
   WHERE p.role = 'student' AND p.status = 'active' AND ann_matches(p_node, p_course, p.id);

  IF COALESCE(p_important, false) THEN
    INSERT INTO notifications(user_id, type, title, link)
    SELECT p.id, 'announcement', left('Announcement: ' || v_title, 120), '/app'
      FROM profiles p
     WHERE p.role = 'student' AND p.status = 'active' AND ann_matches(p_node, p_course, p.id);
  END IF;

  INSERT INTO audit_log(actor_id, action, target, detail)
  VALUES (auth.uid(), 'announcement.create', 'announcement:' || v_id,
          jsonb_build_object('title', v_title, 'node', p_node, 'course', p_course, 'important', COALESCE(p_important, false), 'reach', v_reach));

  RETURN jsonb_build_object('id', v_id, 'reach', v_reach);
END $$;

-- 6. Delete an announcement (authors: their own; admins: any)
CREATE OR REPLACE FUNCTION delete_announcement(p_id uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_role user_role := app_role(); a announcements%ROWTYPE;
BEGIN
  IF v_role IS NULL OR v_role NOT IN ('admin', 'coordinator', 'instructor') THEN RAISE EXCEPTION 'staff only'; END IF;
  SELECT * INTO a FROM announcements WHERE id = p_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Announcement not found.'; END IF;
  IF v_role <> 'admin' AND a.author_id <> auth.uid() THEN RAISE EXCEPTION 'You can delete only your own announcements.'; END IF;
  DELETE FROM announcements WHERE id = p_id;
  INSERT INTO audit_log(actor_id, action, target, detail)
  VALUES (auth.uid(), 'announcement.delete', 'announcement:' || p_id, jsonb_build_object('title', a.title));
END $$;

-- 7. What a student sees (empty for everyone who is not a student)
CREATE OR REPLACE FUNCTION my_announcements()
RETURNS TABLE (id uuid, title text, body text, author_name text, author_role user_role,
               target_label text, important boolean, created_at timestamptz, ends_at timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not signed in'; END IF;
  IF app_role() IS DISTINCT FROM 'student' THEN RETURN; END IF;
  RETURN QUERY
  SELECT a.id, a.title, a.body, COALESCE(a.author_name, 'Wollo University'), a.author_role,
         CASE WHEN a.course_id IS NOT NULL THEN (SELECT c.name FROM courses c WHERE c.id = a.course_id)
              WHEN a.node_id   IS NOT NULL THEN (SELECT n.name FROM tree_nodes n WHERE n.id = a.node_id)
              ELSE 'All students' END,
         a.important, a.starts_at, a.ends_at
    FROM announcements a
   WHERE a.starts_at <= now() AND (a.ends_at IS NULL OR a.ends_at > now())
     AND ann_matches(a.node_id, a.course_id, auth.uid())
   ORDER BY a.important DESC, a.starts_at DESC
   LIMIT 20;
END $$;

-- 8. What staff see in their own Announcements screen (admins: all; others: their own)
CREATE OR REPLACE FUNCTION manage_announcements(p_limit int DEFAULT 50)
RETURNS TABLE (id uuid, title text, body text, author_name text, author_role user_role,
               target_label text, important boolean, created_at timestamptz, ends_at timestamptz,
               active boolean, reach int, mine boolean)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_role user_role := app_role();
BEGIN
  IF v_role IS NULL OR v_role NOT IN ('admin', 'coordinator', 'instructor') THEN RAISE EXCEPTION 'staff only'; END IF;
  RETURN QUERY
  SELECT a.id, a.title, a.body, COALESCE(a.author_name, 'Wollo University'), a.author_role,
         CASE WHEN a.course_id IS NOT NULL THEN (SELECT c.name FROM courses c WHERE c.id = a.course_id)
              WHEN a.node_id   IS NOT NULL THEN (SELECT n.name FROM tree_nodes n WHERE n.id = a.node_id)
              ELSE 'All students' END,
         a.important, a.starts_at, a.ends_at,
         (a.starts_at <= now() AND (a.ends_at IS NULL OR a.ends_at > now())),
         (SELECT count(*)::int FROM profiles p
           WHERE p.role = 'student' AND p.status = 'active' AND ann_matches(a.node_id, a.course_id, p.id)),
         (a.author_id = auth.uid())
    FROM announcements a
   WHERE v_role = 'admin' OR a.author_id = auth.uid()
   ORDER BY a.starts_at DESC
   LIMIT LEAST(GREATEST(COALESCE(p_limit, 50), 1), 200);
END $$;

-- 9. Who may call what
REVOKE EXECUTE ON FUNCTION ann_node_in_scope(uuid), ann_course_in_scope(uuid), ann_matches(uuid, uuid, uuid)
  FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION announcement_targets(), create_announcement(text, text, uuid, uuid, boolean, timestamptz),
  delete_announcement(uuid), my_announcements(), manage_announcements(int) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION announcement_targets(), create_announcement(text, text, uuid, uuid, boolean, timestamptz),
  delete_announcement(uuid), my_announcements(), manage_announcements(int) TO authenticated;

COMMIT;
