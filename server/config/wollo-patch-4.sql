-- =====================================================================
-- WOLLO PATCH 4 - tell the reviewer when a question is waiting for them
-- Run AFTER patch 3.  Safe to run twice.
-- A new question, or a sent-back question that the author fixed and saved again,
-- now sends a bell notification to the course's assigned reviewer.
-- =====================================================================
CREATE OR REPLACE FUNCTION notify_on_question() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' OR (NEW.status = 'draft' AND OLD.status IS DISTINCT FROM 'draft') THEN
    IF NEW.status = 'draft' THEN
      INSERT INTO notifications(user_id, type, title, link)
        SELECT ca.user_id, 'review_needed', 'A question is waiting for your review: ' || left(NEW.body, 60), '/staff/instructor'
        FROM course_assignments ca
        WHERE ca.course_id = NEW.course_id AND ca.duty = 'reviewer' AND ca.user_id <> NEW.author_id;
    END IF;
    RETURN NEW;
  END IF;
  IF NEW.status = OLD.status THEN RETURN NEW; END IF;
  IF NEW.status = 'sent_back' THEN
    INSERT INTO notifications(user_id, type, title, link)
      VALUES (NEW.author_id, 'question_sent_back', 'A question was sent back: ' || left(NEW.body, 60), '/staff/instructor');
  ELSIF NEW.status = 'published' THEN
    INSERT INTO notifications(user_id, type, title, link)
      VALUES (NEW.author_id, 'question_published', 'Your question was published: ' || left(NEW.body, 60), '/staff/instructor');
  ELSIF NEW.status = 'in_review' THEN
    INSERT INTO notifications(user_id, type, title, link)
      SELECT p.id, 'approval_needed', 'A question is waiting for approval: ' || left(NEW.body, 60), '/staff/instructor'
      FROM profiles p WHERE p.role = 'coordinator' AND p.status = 'active';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_notify_question ON questions;
CREATE TRIGGER trg_notify_question AFTER INSERT OR UPDATE OF status ON questions
  FOR EACH ROW EXECUTE FUNCTION notify_on_question();
