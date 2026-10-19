-- =====================================================================
-- WOLLO PATCH 3  -  question writing, review and approval
-- Run AFTER: main schema, patch 1, patch 2, seed.   Safe to run twice.
-- Flow:  author saves  -> draft
--        reviewer (instructor) passes -> in_review   | or sends back -> sent_back
--        coordinator publishes -> published           | or sends back -> sent_back
-- Rules enforced here (not in the browser): author != reviewer != approver,
-- only the assigned author writes, only the assigned reviewer reviews,
-- a note is required when sending back, answer key never leaves staff.
-- =====================================================================

-- 1. Who is author / reviewer of a course
ALTER TABLE course_assignments
  ADD COLUMN IF NOT EXISTS duty text NOT NULL DEFAULT 'author';
DO $$ BEGIN
  ALTER TABLE course_assignments
    ADD CONSTRAINT ck_assignment_duty CHECK (duty IN ('author','reviewer'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2. Peer-review fields on questions
ALTER TABLE questions
  ADD COLUMN IF NOT EXISTS peer_reviewer_id uuid REFERENCES profiles(id),
  ADD COLUMN IF NOT EXISTS peer_reviewed_at timestamptz;
DO $$ BEGIN
  ALTER TABLE questions
    ADD CONSTRAINT ck_peer_not_author CHECK (peer_reviewer_id IS NULL OR peer_reviewer_id <> author_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 3. Small helper
CREATE OR REPLACE FUNCTION has_duty(p_course uuid, p_duty text) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM course_assignments
                 WHERE user_id = auth.uid() AND course_id = p_course AND duty = p_duty) $$;

-- 4. Create or edit a question (question + 4 options + answer key + explanation, all or nothing)
--    p_id NULL = create.  Editing is allowed only for the author while draft / sent_back.
CREATE OR REPLACE FUNCTION save_question(
  p_id uuid, p_course uuid, p_topic text, p_difficulty difficulty_level,
  p_body text, p_options text[], p_correct int, p_explanation text
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_role user_role := app_role();
  v_id uuid; v_topic uuid; v_opt uuid; v_correct uuid; i int;
BEGIN
  IF v_role NOT IN ('instructor','coordinator') THEN RAISE EXCEPTION 'not allowed'; END IF;
  IF v_role = 'instructor' AND NOT has_duty(p_course,'author') THEN
    RAISE EXCEPTION 'you are not the assigned author of this course';
  END IF;
  IF coalesce(btrim(p_body),'') = '' OR coalesce(btrim(p_explanation),'') = '' OR coalesce(btrim(p_topic),'') = '' THEN
    RAISE EXCEPTION 'topic, question and explanation are required';
  END IF;
  IF array_length(p_options,1) IS DISTINCT FROM 4 OR EXISTS (SELECT 1 FROM unnest(p_options) o WHERE btrim(coalesce(o,'')) = '') THEN
    RAISE EXCEPTION 'exactly four non-empty options are required';
  END IF;
  IF p_correct NOT BETWEEN 0 AND 3 THEN RAISE EXCEPTION 'correct option must be 0..3'; END IF;

  INSERT INTO topics(course_id, name) VALUES (p_course, btrim(p_topic))
    ON CONFLICT (course_id, name) DO NOTHING;
  SELECT id INTO v_topic FROM topics WHERE course_id = p_course AND name = btrim(p_topic);

  IF p_id IS NULL THEN
    INSERT INTO questions(course_id, topic_id, difficulty, body, status, author_id)
      VALUES (p_course, v_topic, p_difficulty, btrim(p_body), 'draft', auth.uid())
      RETURNING id INTO v_id;
  ELSE
    UPDATE questions SET course_id = p_course, topic_id = v_topic, difficulty = p_difficulty,
           body = btrim(p_body), status = 'draft', review_note = NULL,
           peer_reviewer_id = NULL, peer_reviewed_at = NULL
     WHERE id = p_id AND author_id = auth.uid() AND status IN ('draft','sent_back')
     RETURNING id INTO v_id;
    IF v_id IS NULL THEN RAISE EXCEPTION 'question not found or no longer editable'; END IF;
    DELETE FROM question_options WHERE question_id = v_id;   -- cascades to the key
    DELETE FROM question_explanations WHERE question_id = v_id;
  END IF;

  FOR i IN 0..3 LOOP
    INSERT INTO question_options(question_id, position, text)
      VALUES (v_id, i, btrim(p_options[i+1])) RETURNING id INTO v_opt;
    IF i = p_correct THEN v_correct := v_opt; END IF;
  END LOOP;
  INSERT INTO question_answer_keys(question_id, option_id) VALUES (v_id, v_correct);
  INSERT INTO question_explanations(question_id, text) VALUES (v_id, btrim(p_explanation));
  RETURN v_id;
END $$;

-- 5. Step 1 review by the course's assigned reviewer (an instructor)
--    p_action: 'pass' (-> in_review)  or  'send_back' (note required)
CREATE OR REPLACE FUNCTION peer_review_question(p_question uuid, p_action text, p_note text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE q questions%ROWTYPE;
BEGIN
  IF app_role() <> 'instructor' THEN RAISE EXCEPTION 'not allowed'; END IF;
  SELECT * INTO q FROM questions WHERE id = p_question FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'question not found'; END IF;
  IF NOT has_duty(q.course_id,'reviewer') THEN RAISE EXCEPTION 'you are not the assigned reviewer of this course'; END IF;
  IF q.author_id = auth.uid() THEN RAISE EXCEPTION 'you cannot review your own question'; END IF;
  IF q.status <> 'draft' THEN RAISE EXCEPTION 'question is not waiting for review'; END IF;
  IF p_action = 'pass' THEN
    UPDATE questions SET status='in_review', peer_reviewer_id=auth.uid(), peer_reviewed_at=now(), review_note=NULL
     WHERE id = p_question;
  ELSIF p_action = 'send_back' THEN
    IF coalesce(btrim(p_note),'') = '' THEN RAISE EXCEPTION 'a comment is required when sending back'; END IF;
    UPDATE questions SET status='sent_back', review_note=btrim(p_note) WHERE id = p_question;
  ELSE RAISE EXCEPTION 'unknown action'; END IF;
END $$;

-- 6. Step 2: coordinator approval.  p_action: 'publish' or 'send_back' (note required)
CREATE OR REPLACE FUNCTION approve_question(p_question uuid, p_action text, p_note text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE q questions%ROWTYPE;
BEGIN
  IF app_role() <> 'coordinator' THEN RAISE EXCEPTION 'only a coordinator can approve'; END IF;
  SELECT * INTO q FROM questions WHERE id = p_question FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'question not found'; END IF;
  IF q.author_id = auth.uid() THEN RAISE EXCEPTION 'you cannot approve your own question'; END IF;
  IF q.peer_reviewer_id = auth.uid() THEN RAISE EXCEPTION 'you cannot approve a question you reviewed'; END IF;
  IF q.status <> 'in_review' THEN RAISE EXCEPTION 'question is not waiting for approval'; END IF;
  IF p_action = 'publish' THEN
    UPDATE questions SET status='published', reviewer_id=auth.uid(), published_at=now(), review_note=NULL
     WHERE id = p_question;
  ELSIF p_action = 'send_back' THEN
    IF coalesce(btrim(p_note),'') = '' THEN RAISE EXCEPTION 'a comment is required when sending back'; END IF;
    UPDATE questions SET status='sent_back', review_note=btrim(p_note), peer_reviewer_id=NULL, peer_reviewed_at=NULL
     WHERE id = p_question;
  ELSE RAISE EXCEPTION 'unknown action'; END IF;
END $$;

-- 7. Everything the staff screens need, in one call (key and explanation included - staff only)
--    instructor: own questions + questions of courses they are assigned to; coordinator/admin: all
CREATE OR REPLACE FUNCTION get_staff_questions() RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT coalesce(jsonb_agg(row ORDER BY created_at DESC), '[]'::jsonb) FROM (
    SELECT q.created_at, jsonb_build_object(
      'id', q.id, 'course_id', q.course_id, 'topic', t.name, 'difficulty', q.difficulty,
      'body', q.body, 'status', q.status, 'review_note', q.review_note,
      'author_id', q.author_id, 'author_name', a.full_name,
      'peer_reviewer_id', q.peer_reviewer_id, 'peer_reviewed_at', q.peer_reviewed_at,
      'published_at', q.published_at, 'created_at', q.created_at,
      'options', (SELECT jsonb_agg(jsonb_build_object('id', o.id, 'position', o.position, 'text', o.text) ORDER BY o.position)
                  FROM question_options o WHERE o.question_id = q.id),
      'correct_position', (SELECT o.position FROM question_answer_keys k JOIN question_options o ON o.id = k.option_id WHERE k.question_id = q.id),
      'explanation', (SELECT e.text FROM question_explanations e WHERE e.question_id = q.id)
    ) AS row
    FROM questions q
    LEFT JOIN topics t ON t.id = q.topic_id
    LEFT JOIN profiles a ON a.id = q.author_id
    WHERE CASE app_role()
            WHEN 'instructor'  THEN q.author_id = auth.uid() OR is_assigned(q.course_id)
            WHEN 'coordinator' THEN true
            WHEN 'admin'       THEN true
            ELSE false END
  ) s $$;

-- 8. Coordinator sets who is author and who is reviewer of a course (replaces the old pair)
CREATE OR REPLACE FUNCTION set_course_duty(p_course uuid, p_author uuid, p_reviewer uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF app_role() NOT IN ('coordinator','admin') THEN RAISE EXCEPTION 'not allowed'; END IF;
  IF p_author = p_reviewer THEN RAISE EXCEPTION 'the author and reviewer must be different people'; END IF;
  IF (SELECT count(*) FROM profiles WHERE id IN (p_author,p_reviewer) AND role='instructor' AND status='active') <> 2 THEN
    RAISE EXCEPTION 'author and reviewer must be active instructors';
  END IF;
  DELETE FROM course_assignments WHERE course_id = p_course AND duty IN ('author','reviewer');
  INSERT INTO course_assignments(user_id, course_id, duty, assigned_by) VALUES
    (p_author,   p_course, 'author',   auth.uid()),
    (p_reviewer, p_course, 'reviewer', auth.uid());
END $$;

-- 9. Notify people when something happens to their question
CREATE OR REPLACE FUNCTION notify_on_question() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status = OLD.status THEN RETURN NEW; END IF;
  IF NEW.status = 'sent_back' THEN
    INSERT INTO notifications(user_id, type, title, link)
      VALUES (NEW.author_id, 'question_sent_back', 'A question was sent back: ' || left(NEW.body, 60), '/app/instructor');
  ELSIF NEW.status = 'published' THEN
    INSERT INTO notifications(user_id, type, title, link)
      VALUES (NEW.author_id, 'question_published', 'Your question was published: ' || left(NEW.body, 60), '/app/instructor');
  ELSIF NEW.status = 'in_review' THEN
    INSERT INTO notifications(user_id, type, title, link)
      SELECT p.id, 'approval_needed', 'A question is waiting for approval: ' || left(NEW.body, 60), '/app/instructor'
      FROM profiles p WHERE p.role = 'coordinator' AND p.status = 'active';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_notify_question ON questions;
CREATE TRIGGER trg_notify_question AFTER UPDATE OF status ON questions
  FOR EACH ROW EXECUTE FUNCTION notify_on_question();

-- 10. Lock the doors: staff use the functions above, not direct table writes
--     Old direct-write policies let an author push a question to 'in_review' by themselves and
--     skip the reviewer, so they are removed. Reading stays as it was.
DROP POLICY IF EXISTS q_ins   ON questions;
DROP POLICY IF EXISTS q_upd_a ON questions;
DROP POLICY IF EXISTS q_upd_c ON questions;
DROP POLICY IF EXISTS o_wr    ON question_options;
DROP POLICY IF EXISTS k_wr    ON question_answer_keys;
DROP POLICY IF EXISTS ex_wr   ON question_explanations;
REVOKE ALL ON FUNCTION save_question(uuid,uuid,text,difficulty_level,text,text[],int,text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION peer_review_question(uuid,text,text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION approve_question(uuid,text,text)     FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION get_staff_questions()                FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION set_course_duty(uuid,uuid,uuid)      FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION has_duty(uuid,text)                  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION save_question(uuid,uuid,text,difficulty_level,text,text[],int,text),
                          peer_review_question(uuid,text,text), approve_question(uuid,text,text),
                          get_staff_questions(), set_course_duty(uuid,uuid,uuid), has_duty(uuid,text)
  TO authenticated;
