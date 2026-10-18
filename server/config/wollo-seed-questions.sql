-- =====================================================================
-- SAMPLE QUESTIONS from src/data/questions.js (so the exam has something to run)
-- Run once, AFTER the seed and both patches.
-- Needs one account with role 'admin' (author) and one with role 'coordinator' (reviewer):
-- the database refuses a question whose author and reviewer are the same person.
-- Skipped: the Computer Science question (no matching course exists in the tree).
-- =====================================================================
BEGIN;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE role='admin')       THEN RAISE EXCEPTION 'Create an admin account first'; END IF;
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE role='coordinator') THEN RAISE EXCEPTION 'Create a second account and set its role to coordinator first (update profiles set role=''coordinator'' where email=''...'')'; END IF;
END $$;

WITH c AS (SELECT id FROM courses WHERE code='rem-mathematics'),
 t AS (INSERT INTO topics(course_id,name) SELECT id,'Algebra' FROM c ON CONFLICT (course_id,name) DO UPDATE SET name=EXCLUDED.name RETURNING id),
 qn AS (INSERT INTO questions(course_id,topic_id,difficulty,body,status,author_id,reviewer_id,published_at)
   SELECT c.id,t.id,'medium','If 3x + 7 = 22, what is x?','published',
     (SELECT id FROM profiles WHERE role='admin' ORDER BY created_at LIMIT 1),
     (SELECT id FROM profiles WHERE role='coordinator' ORDER BY created_at LIMIT 1), now() FROM c,t RETURNING id),
 opts AS (INSERT INTO question_options(question_id,position,text) SELECT qn.id,v.pos,v.txt FROM qn,(VALUES (0,'4'),(1,'5'),(2,'7'),(3,'15')) AS v(pos,txt) RETURNING id,question_id,position),
 k AS (INSERT INTO question_answer_keys(question_id,option_id) SELECT question_id,id FROM opts WHERE position=1 RETURNING question_id)
INSERT INTO question_explanations(question_id,text) SELECT id,'3x = 15, so x = 5.' FROM qn;

WITH c AS (SELECT id FROM courses WHERE code='rem-mathematics'),
 t AS (INSERT INTO topics(course_id,name) SELECT id,'Percentages' FROM c ON CONFLICT (course_id,name) DO UPDATE SET name=EXCLUDED.name RETURNING id),
 qn AS (INSERT INTO questions(course_id,topic_id,difficulty,body,status,author_id,reviewer_id,published_at)
   SELECT c.id,t.id,'easy','What is 15% of 200?','published',
     (SELECT id FROM profiles WHERE role='admin' ORDER BY created_at LIMIT 1),
     (SELECT id FROM profiles WHERE role='coordinator' ORDER BY created_at LIMIT 1), now() FROM c,t RETURNING id),
 opts AS (INSERT INTO question_options(question_id,position,text) SELECT qn.id,v.pos,v.txt FROM qn,(VALUES (0,'15'),(1,'20'),(2,'30'),(3,'45')) AS v(pos,txt) RETURNING id,question_id,position),
 k AS (INSERT INTO question_answer_keys(question_id,option_id) SELECT question_id,id FROM opts WHERE position=2 RETURNING question_id)
INSERT INTO question_explanations(question_id,text) SELECT id,'0.15 × 200 = 30.' FROM qn;

WITH c AS (SELECT id FROM courses WHERE code='rem-mathematics'),
 t AS (INSERT INTO topics(course_id,name) SELECT id,'Geometry' FROM c ON CONFLICT (course_id,name) DO UPDATE SET name=EXCLUDED.name RETURNING id),
 qn AS (INSERT INTO questions(course_id,topic_id,difficulty,body,status,author_id,reviewer_id,published_at)
   SELECT c.id,t.id,'easy','What is the area of a rectangle 8 cm long and 5 cm wide?','published',
     (SELECT id FROM profiles WHERE role='admin' ORDER BY created_at LIMIT 1),
     (SELECT id FROM profiles WHERE role='coordinator' ORDER BY created_at LIMIT 1), now() FROM c,t RETURNING id),
 opts AS (INSERT INTO question_options(question_id,position,text) SELECT qn.id,v.pos,v.txt FROM qn,(VALUES (0,'13 cm²'),(1,'26 cm²'),(2,'40 cm²'),(3,'80 cm²')) AS v(pos,txt) RETURNING id,question_id,position),
 k AS (INSERT INTO question_answer_keys(question_id,option_id) SELECT question_id,id FROM opts WHERE position=2 RETURNING question_id)
INSERT INTO question_explanations(question_id,text) SELECT id,'Area = length × width = 8 × 5 = 40.' FROM qn;

WITH c AS (SELECT id FROM courses WHERE code='rem-english'),
 t AS (INSERT INTO topics(course_id,name) SELECT id,'Grammar' FROM c ON CONFLICT (course_id,name) DO UPDATE SET name=EXCLUDED.name RETURNING id),
 qn AS (INSERT INTO questions(course_id,topic_id,difficulty,body,status,author_id,reviewer_id,published_at)
   SELECT c.id,t.id,'easy','Choose the correct sentence.','published',
     (SELECT id FROM profiles WHERE role='admin' ORDER BY created_at LIMIT 1),
     (SELECT id FROM profiles WHERE role='coordinator' ORDER BY created_at LIMIT 1), now() FROM c,t RETURNING id),
 opts AS (INSERT INTO question_options(question_id,position,text) SELECT qn.id,v.pos,v.txt FROM qn,(VALUES (0,'She don''t like tea.'),(1,'She doesn''t like tea.'),(2,'She not like tea.'),(3,'She no likes tea.')) AS v(pos,txt) RETURNING id,question_id,position),
 k AS (INSERT INTO question_answer_keys(question_id,option_id) SELECT question_id,id FROM opts WHERE position=1 RETURNING question_id)
INSERT INTO question_explanations(question_id,text) SELECT id,'With "she", use "doesn’t" plus the base verb.' FROM qn;

-- skipped 005: no course for subject "Computer Science"

WITH c AS (SELECT id FROM courses WHERE code='rem-mathematics'),
 t AS (INSERT INTO topics(course_id,name) SELECT id,'Fractions' FROM c ON CONFLICT (course_id,name) DO UPDATE SET name=EXCLUDED.name RETURNING id),
 qn AS (INSERT INTO questions(course_id,topic_id,difficulty,body,status,author_id,reviewer_id,published_at)
   SELECT c.id,t.id,'medium','Which one is the largest fraction?','published',
     (SELECT id FROM profiles WHERE role='admin' ORDER BY created_at LIMIT 1),
     (SELECT id FROM profiles WHERE role='coordinator' ORDER BY created_at LIMIT 1), now() FROM c,t RETURNING id),
 opts AS (INSERT INTO question_options(question_id,position,text) SELECT qn.id,v.pos,v.txt FROM qn,(VALUES (0,'1/2'),(1,'2/3'),(2,'3/5'),(3,'3/4')) AS v(pos,txt) RETURNING id,question_id,position),
 k AS (INSERT INTO question_answer_keys(question_id,option_id) SELECT question_id,id FROM opts WHERE position=3 RETURNING question_id)
INSERT INTO question_explanations(question_id,text) SELECT id,'As decimals: 0.5, 0.67, 0.6, 0.75. So 3/4 is largest.' FROM qn;

COMMIT;
-- Check: SELECT c.name, count(*) FROM questions q JOIN courses c ON c.id=q.course_id GROUP BY 1;

