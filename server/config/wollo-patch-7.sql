-- =====================================================================
-- PATCH 7: content workflow at scale
--  1. peer_review_many  - reviewer passes / sends back many questions at once
--  2. approve_many      - coordinator publishes / sends back many at once
--  3. notifications are grouped (50 imported questions = 1 bell item, not 50)
--  4. course_question_counts - how many published questions each course has
-- Run once, after patches 1-6. Safe to run again.
-- Every question still goes through the SAME checks as before (one by one inside the loop):
-- assigned reviewer, not your own question, correct status, comment needed to send back.
-- =====================================================================
BEGIN;

-- 1. Reviewer: many at once. A question that fails a check is skipped and reported; the rest go through.
CREATE OR REPLACE FUNCTION peer_review_many(p_ids uuid[], p_action text, p_note text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE qid uuid; n_done int := 0; failed jsonb := '[]'::jsonb;
BEGIN
  IF app_role() <> 'instructor' THEN RAISE EXCEPTION 'not allowed'; END IF;
  IF coalesce(array_length(p_ids, 1), 0) = 0 THEN RAISE EXCEPTION 'no questions selected'; END IF;
  IF array_length(p_ids, 1) > 200 THEN RAISE EXCEPTION 'at most 200 questions at a time'; END IF;
  IF p_action = 'send_back' AND coalesce(btrim(p_note), '') = '' THEN
    RAISE EXCEPTION 'a comment is required when sending back';
  END IF;
  FOREACH qid IN ARRAY p_ids LOOP
    BEGIN
      PERFORM peer_review_question(qid, p_action, p_note);
      n_done := n_done + 1;
    EXCEPTION WHEN OTHERS THEN
      failed := failed || jsonb_build_object('id', qid, 'error', SQLERRM);
    END;
  END LOOP;
  RETURN jsonb_build_object('done', n_done, 'failed', failed);
END $$;

-- 2. Coordinator: many at once. p_action = 'publish' | 'send_back'
CREATE OR REPLACE FUNCTION approve_many(p_ids uuid[], p_action text, p_note text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE qid uuid; n_done int := 0; failed jsonb := '[]'::jsonb;
BEGIN
  IF app_role() <> 'coordinator' THEN RAISE EXCEPTION 'only a coordinator can approve'; END IF;
  IF coalesce(array_length(p_ids, 1), 0) = 0 THEN RAISE EXCEPTION 'no questions selected'; END IF;
  IF array_length(p_ids, 1) > 200 THEN RAISE EXCEPTION 'at most 200 questions at a time'; END IF;
  IF p_action = 'send_back' AND coalesce(btrim(p_note), '') = '' THEN
    RAISE EXCEPTION 'a comment is required when sending back';
  END IF;
  FOREACH qid IN ARRAY p_ids LOOP
    BEGIN
      PERFORM approve_question(qid, p_action, p_note);
      n_done := n_done + 1;
    EXCEPTION WHEN OTHERS THEN
      failed := failed || jsonb_build_object('id', qid, 'error', SQLERRM);
    END;
  END LOOP;
  RETURN jsonb_build_object('done', n_done, 'failed', failed);
END $$;

-- 3. Group notifications: if the person already has an UNREAD notification of the same type,
--    update it ("Several questions ...") instead of adding another one.
CREATE OR REPLACE FUNCTION notify_grouped(p_user uuid, p_type text, p_title_one text, p_title_many text, p_link text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE nid bigint;
BEGIN
  SELECT id INTO nid FROM notifications
   WHERE user_id = p_user AND type = p_type AND read_at IS NULL
   ORDER BY created_at DESC LIMIT 1;
  IF nid IS NULL THEN
    INSERT INTO notifications(user_id, type, title, link) VALUES (p_user, p_type, p_title_one, p_link);
  ELSE
    UPDATE notifications SET title = p_title_many, created_at = now() WHERE id = nid;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION notify_on_question() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r record;
BEGIN
  IF TG_OP = 'INSERT' OR (NEW.status = 'draft' AND OLD.status IS DISTINCT FROM 'draft') THEN
    IF NEW.status = 'draft' THEN
      FOR r IN SELECT ca.user_id FROM course_assignments ca
               WHERE ca.course_id = NEW.course_id AND ca.duty = 'reviewer' AND ca.user_id <> NEW.author_id LOOP
        PERFORM notify_grouped(r.user_id, 'review_needed',
          'A question is waiting for your review: ' || left(NEW.body, 60),
          'Several questions are waiting for your review', '/staff/instructor');
      END LOOP;
    END IF;
    RETURN NEW;
  END IF;
  IF NEW.status = OLD.status THEN RETURN NEW; END IF;
  IF NEW.status = 'sent_back' THEN
    PERFORM notify_grouped(NEW.author_id, 'question_sent_back',
      'A question was sent back: ' || left(NEW.body, 60),
      'Several questions were sent back. Open My questions to read the comments', '/staff/instructor');
  ELSIF NEW.status = 'published' THEN
    PERFORM notify_grouped(NEW.author_id, 'question_published',
      'Your question was published: ' || left(NEW.body, 60),
      'Several of your questions were published', '/staff/instructor');
  ELSIF NEW.status = 'in_review' THEN
    FOR r IN SELECT p.id FROM profiles p WHERE p.role = 'coordinator' AND p.status = 'active' LOOP
      PERFORM notify_grouped(r.id, 'approval_needed',
        'A question is waiting for approval: ' || left(NEW.body, 60),
        'Several questions are waiting for approval', '/staff/instructor');
    END LOOP;
  END IF;
  RETURN NEW;
END $$;

-- 4. Published question count per course. Counts only - no question content. Safe for everyone.
CREATE OR REPLACE FUNCTION course_question_counts()
RETURNS TABLE (course_id uuid, published int)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT q.course_id, count(*)::int FROM questions q WHERE q.status = 'published' GROUP BY q.course_id;
$$;

REVOKE ALL ON FUNCTION notify_grouped(uuid,text,text,text,text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION peer_review_many(uuid[],text,text), approve_many(uuid[],text,text) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION peer_review_many(uuid[],text,text), approve_many(uuid[],text,text) TO authenticated;
REVOKE EXECUTE ON FUNCTION course_question_counts() FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION course_question_counts() TO anon, authenticated;

COMMIT;
