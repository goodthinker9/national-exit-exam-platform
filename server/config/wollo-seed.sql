-- =====================================================================
-- SEED DATA for the Wollo University Exam Prep platform
-- Generated from src/data/courseGroups.js (the real course tree).
-- Safe to run once on an empty database. Run AFTER wollo-exam-prep-supabase.sql
-- =====================================================================
BEGIN;

-- 1. REMEDIAL: streams
INSERT INTO tree_nodes(exam,kind,parent_id,name,slug,sort_order) VALUES ('remedial','stream',NULL,'Natural Science','natural-science',0);
INSERT INTO tree_nodes(exam,kind,parent_id,name,slug,sort_order) VALUES ('remedial','stream',NULL,'Social Science','social-science',1);

-- 2. REMEDIAL: courses (English is ONE course shared by both streams)
INSERT INTO courses(code,name) VALUES ('rem-mathematics','Mathematics');
INSERT INTO courses(code,name) VALUES ('rem-physics','Physics');
INSERT INTO courses(code,name) VALUES ('rem-chemistry','Chemistry');
INSERT INTO courses(code,name) VALUES ('rem-biology','Biology');
INSERT INTO courses(code,name) VALUES ('rem-english','English');
INSERT INTO courses(code,name) VALUES ('rem-mathematics-social','Mathematics (Social)');
INSERT INTO courses(code,name) VALUES ('rem-geography','Geography');
INSERT INTO courses(code,name) VALUES ('rem-history','History');
INSERT INTO courses(code,name) VALUES ('rem-economics','Economics');

INSERT INTO node_courses(node_id,course_id) SELECT n.id,c.id FROM tree_nodes n,courses c WHERE n.exam='remedial' AND n.kind='stream' AND n.slug='natural-science' AND c.code='rem-mathematics';
INSERT INTO node_courses(node_id,course_id) SELECT n.id,c.id FROM tree_nodes n,courses c WHERE n.exam='remedial' AND n.kind='stream' AND n.slug='natural-science' AND c.code='rem-physics';
INSERT INTO node_courses(node_id,course_id) SELECT n.id,c.id FROM tree_nodes n,courses c WHERE n.exam='remedial' AND n.kind='stream' AND n.slug='natural-science' AND c.code='rem-chemistry';
INSERT INTO node_courses(node_id,course_id) SELECT n.id,c.id FROM tree_nodes n,courses c WHERE n.exam='remedial' AND n.kind='stream' AND n.slug='natural-science' AND c.code='rem-biology';
INSERT INTO node_courses(node_id,course_id) SELECT n.id,c.id FROM tree_nodes n,courses c WHERE n.exam='remedial' AND n.kind='stream' AND n.slug='natural-science' AND c.code='rem-english';
INSERT INTO node_courses(node_id,course_id) SELECT n.id,c.id FROM tree_nodes n,courses c WHERE n.exam='remedial' AND n.kind='stream' AND n.slug='social-science' AND c.code='rem-english';
INSERT INTO node_courses(node_id,course_id) SELECT n.id,c.id FROM tree_nodes n,courses c WHERE n.exam='remedial' AND n.kind='stream' AND n.slug='social-science' AND c.code='rem-mathematics-social';
INSERT INTO node_courses(node_id,course_id) SELECT n.id,c.id FROM tree_nodes n,courses c WHERE n.exam='remedial' AND n.kind='stream' AND n.slug='social-science' AND c.code='rem-geography';
INSERT INTO node_courses(node_id,course_id) SELECT n.id,c.id FROM tree_nodes n,courses c WHERE n.exam='remedial' AND n.kind='stream' AND n.slug='social-science' AND c.code='rem-history';
INSERT INTO node_courses(node_id,course_id) SELECT n.id,c.id FROM tree_nodes n,courses c WHERE n.exam='remedial' AND n.kind='stream' AND n.slug='social-science' AND c.code='rem-economics';

-- 3. EXIT EXAM: Stream -> Field -> Subgroup -> Department
INSERT INTO tree_nodes(exam,kind,parent_id,name,slug,sort_order) VALUES ('exit','stream',NULL,'Natural Science','natural-science',0);
INSERT INTO tree_nodes(exam,kind,parent_id,name,slug,sort_order) VALUES ('exit','stream',NULL,'Social Science','social-science',1);
INSERT INTO tree_nodes(exam,kind,parent_id,name,slug,sort_order) VALUES ('exit','field',(SELECT id FROM tree_nodes WHERE exam='exit' AND slug='natural-science'),'Engineering','engineering',0);
INSERT INTO tree_nodes(exam,kind,parent_id,name,slug,sort_order) VALUES ('exit','field',(SELECT id FROM tree_nodes WHERE exam='exit' AND slug='natural-science'),'Health','health',1);
INSERT INTO tree_nodes(exam,kind,parent_id,name,slug,sort_order) VALUES ('exit','field',(SELECT id FROM tree_nodes WHERE exam='exit' AND slug='natural-science'),'Natural & Computational Sciences','natural-computational-sciences',2);
INSERT INTO tree_nodes(exam,kind,parent_id,name,slug,sort_order) VALUES ('exit','field',(SELECT id FROM tree_nodes WHERE exam='exit' AND slug='social-science'),'Business & Economics','business-economics',0);
INSERT INTO tree_nodes(exam,kind,parent_id,name,slug,sort_order) VALUES ('exit','field',(SELECT id FROM tree_nodes WHERE exam='exit' AND slug='social-science'),'Law & Governance','law-governance',1);
INSERT INTO tree_nodes(exam,kind,parent_id,name,slug,sort_order) VALUES ('exit','field',(SELECT id FROM tree_nodes WHERE exam='exit' AND slug='social-science'),'Humanities','humanities',2);
INSERT INTO tree_nodes(exam,kind,parent_id,name,slug,sort_order) VALUES ('exit','subgroup',(SELECT id FROM tree_nodes WHERE exam='exit' AND slug='engineering'),'Informatics','informatics',0);
INSERT INTO tree_nodes(exam,kind,parent_id,name,slug,sort_order) VALUES ('exit','subgroup',(SELECT id FROM tree_nodes WHERE exam='exit' AND slug='engineering'),'Engineering','engineering-departments',1);
INSERT INTO tree_nodes(exam,kind,parent_id,name,slug,sort_order) VALUES ('exit','department',(SELECT id FROM tree_nodes WHERE exam='exit' AND slug='informatics'),'Computer Science','computer-science',0);
INSERT INTO tree_nodes(exam,kind,parent_id,name,slug,sort_order) VALUES ('exit','department',(SELECT id FROM tree_nodes WHERE exam='exit' AND slug='informatics'),'Information Technology','information-technology',1);
INSERT INTO tree_nodes(exam,kind,parent_id,name,slug,sort_order) VALUES ('exit','department',(SELECT id FROM tree_nodes WHERE exam='exit' AND slug='informatics'),'Information Systems','information-systems',2);
INSERT INTO tree_nodes(exam,kind,parent_id,name,slug,sort_order) VALUES ('exit','department',(SELECT id FROM tree_nodes WHERE exam='exit' AND slug='informatics'),'Software Engineering','software-engineering',3);
INSERT INTO tree_nodes(exam,kind,parent_id,name,slug,sort_order) VALUES ('exit','department',(SELECT id FROM tree_nodes WHERE exam='exit' AND slug='engineering-departments'),'Construction Technology & Management (COTM)','construction-technology-management',0);
INSERT INTO tree_nodes(exam,kind,parent_id,name,slug,sort_order) VALUES ('exit','department',(SELECT id FROM tree_nodes WHERE exam='exit' AND slug='engineering-departments'),'Electrical Engineering','electrical-engineering',1);
INSERT INTO tree_nodes(exam,kind,parent_id,name,slug,sort_order) VALUES ('exit','department',(SELECT id FROM tree_nodes WHERE exam='exit' AND slug='engineering-departments'),'Mechanical Engineering','mechanical-engineering',2);
INSERT INTO tree_nodes(exam,kind,parent_id,name,slug,sort_order) VALUES ('exit','department',(SELECT id FROM tree_nodes WHERE exam='exit' AND slug='engineering-departments'),'Biomedical Engineering','biomedical-engineering',3);
INSERT INTO tree_nodes(exam,kind,parent_id,name,slug,sort_order) VALUES ('exit','department',(SELECT id FROM tree_nodes WHERE exam='exit' AND slug='health'),'Medicine','medicine',0);
INSERT INTO tree_nodes(exam,kind,parent_id,name,slug,sort_order) VALUES ('exit','department',(SELECT id FROM tree_nodes WHERE exam='exit' AND slug='health'),'Pharmacy','pharmacy',1);
INSERT INTO tree_nodes(exam,kind,parent_id,name,slug,sort_order) VALUES ('exit','department',(SELECT id FROM tree_nodes WHERE exam='exit' AND slug='health'),'Nursing','nursing',2);
INSERT INTO tree_nodes(exam,kind,parent_id,name,slug,sort_order) VALUES ('exit','department',(SELECT id FROM tree_nodes WHERE exam='exit' AND slug='health'),'Midwifery','midwifery',3);
INSERT INTO tree_nodes(exam,kind,parent_id,name,slug,sort_order) VALUES ('exit','department',(SELECT id FROM tree_nodes WHERE exam='exit' AND slug='natural-computational-sciences'),'Biology','biology',0);
INSERT INTO tree_nodes(exam,kind,parent_id,name,slug,sort_order) VALUES ('exit','department',(SELECT id FROM tree_nodes WHERE exam='exit' AND slug='natural-computational-sciences'),'Chemistry','chemistry',1);
INSERT INTO tree_nodes(exam,kind,parent_id,name,slug,sort_order) VALUES ('exit','department',(SELECT id FROM tree_nodes WHERE exam='exit' AND slug='natural-computational-sciences'),'Physics','physics',2);
INSERT INTO tree_nodes(exam,kind,parent_id,name,slug,sort_order) VALUES ('exit','department',(SELECT id FROM tree_nodes WHERE exam='exit' AND slug='natural-computational-sciences'),'Mathematics','mathematics',3);
INSERT INTO tree_nodes(exam,kind,parent_id,name,slug,sort_order) VALUES ('exit','department',(SELECT id FROM tree_nodes WHERE exam='exit' AND slug='business-economics'),'Accounting','accounting',0);
INSERT INTO tree_nodes(exam,kind,parent_id,name,slug,sort_order) VALUES ('exit','department',(SELECT id FROM tree_nodes WHERE exam='exit' AND slug='business-economics'),'Management','management',1);
INSERT INTO tree_nodes(exam,kind,parent_id,name,slug,sort_order) VALUES ('exit','department',(SELECT id FROM tree_nodes WHERE exam='exit' AND slug='business-economics'),'Economics','economics',2);
INSERT INTO tree_nodes(exam,kind,parent_id,name,slug,sort_order) VALUES ('exit','department',(SELECT id FROM tree_nodes WHERE exam='exit' AND slug='law-governance'),'Law','law',0);
INSERT INTO tree_nodes(exam,kind,parent_id,name,slug,sort_order) VALUES ('exit','department',(SELECT id FROM tree_nodes WHERE exam='exit' AND slug='law-governance'),'Civics and Ethics','civics-ethics',1);
INSERT INTO tree_nodes(exam,kind,parent_id,name,slug,sort_order) VALUES ('exit','department',(SELECT id FROM tree_nodes WHERE exam='exit' AND slug='humanities'),'English Language and Literature','english-language-literature',0);
INSERT INTO tree_nodes(exam,kind,parent_id,name,slug,sort_order) VALUES ('exit','department',(SELECT id FROM tree_nodes WHERE exam='exit' AND slug='humanities'),'History','history',1);
INSERT INTO tree_nodes(exam,kind,parent_id,name,slug,sort_order) VALUES ('exit','department',(SELECT id FROM tree_nodes WHERE exam='exit' AND slug='humanities'),'Geography','geography',2);

-- 4. EXIT EXAM: courses
INSERT INTO courses(code,name) VALUES ('data-structures','Data Structures');
INSERT INTO courses(code,name) VALUES ('algorithms','Algorithms');
INSERT INTO courses(code,name) VALUES ('databases','Databases');
INSERT INTO courses(code,name) VALUES ('computer-networks','Computer Networks');
INSERT INTO courses(code,name) VALUES ('operating-systems','Operating Systems');
INSERT INTO courses(code,name) VALUES ('web-development','Web Development');
INSERT INTO courses(code,name) VALUES ('cybersecurity','Cybersecurity');
INSERT INTO courses(code,name) VALUES ('software-design','Software Design');
INSERT INTO courses(code,name) VALUES ('software-testing','Software Testing');
INSERT INTO courses(code,name) VALUES ('circuit-analysis','Circuit Analysis');
INSERT INTO courses(code,name) VALUES ('electronics','Electronics');
INSERT INTO courses(code,name) VALUES ('power-systems','Power Systems');
INSERT INTO courses(code,name) VALUES ('pharmacology','Pharmacology');
INSERT INTO courses(code,name) VALUES ('pharmaceutical-chemistry','Pharmaceutical Chemistry');
INSERT INTO courses(code,name) VALUES ('genetics','Genetics');
INSERT INTO courses(code,name) VALUES ('ecology','Ecology');
INSERT INTO courses(code,name) VALUES ('financial-accounting','Financial Accounting');
INSERT INTO courses(code,name) VALUES ('cost-accounting','Cost Accounting');
INSERT INTO courses(code,name) VALUES ('constitutional-law','Constitutional Law');
INSERT INTO courses(code,name) VALUES ('criminal-law','Criminal Law');

-- 5. EXIT EXAM: which department(s) each course belongs to
INSERT INTO node_courses(node_id,course_id) SELECT n.id,c.id FROM tree_nodes n,courses c WHERE n.exam='exit' AND n.kind='department' AND n.slug='computer-science' AND c.code='data-structures';
INSERT INTO node_courses(node_id,course_id) SELECT n.id,c.id FROM tree_nodes n,courses c WHERE n.exam='exit' AND n.kind='department' AND n.slug='computer-science' AND c.code='algorithms';
INSERT INTO node_courses(node_id,course_id) SELECT n.id,c.id FROM tree_nodes n,courses c WHERE n.exam='exit' AND n.kind='department' AND n.slug='computer-science' AND c.code='databases';
INSERT INTO node_courses(node_id,course_id) SELECT n.id,c.id FROM tree_nodes n,courses c WHERE n.exam='exit' AND n.kind='department' AND n.slug='information-technology' AND c.code='databases';
INSERT INTO node_courses(node_id,course_id) SELECT n.id,c.id FROM tree_nodes n,courses c WHERE n.exam='exit' AND n.kind='department' AND n.slug='software-engineering' AND c.code='databases';
INSERT INTO node_courses(node_id,course_id) SELECT n.id,c.id FROM tree_nodes n,courses c WHERE n.exam='exit' AND n.kind='department' AND n.slug='computer-science' AND c.code='computer-networks';
INSERT INTO node_courses(node_id,course_id) SELECT n.id,c.id FROM tree_nodes n,courses c WHERE n.exam='exit' AND n.kind='department' AND n.slug='information-technology' AND c.code='computer-networks';
INSERT INTO node_courses(node_id,course_id) SELECT n.id,c.id FROM tree_nodes n,courses c WHERE n.exam='exit' AND n.kind='department' AND n.slug='software-engineering' AND c.code='computer-networks';
INSERT INTO node_courses(node_id,course_id) SELECT n.id,c.id FROM tree_nodes n,courses c WHERE n.exam='exit' AND n.kind='department' AND n.slug='computer-science' AND c.code='operating-systems';
INSERT INTO node_courses(node_id,course_id) SELECT n.id,c.id FROM tree_nodes n,courses c WHERE n.exam='exit' AND n.kind='department' AND n.slug='information-technology' AND c.code='web-development';
INSERT INTO node_courses(node_id,course_id) SELECT n.id,c.id FROM tree_nodes n,courses c WHERE n.exam='exit' AND n.kind='department' AND n.slug='information-technology' AND c.code='cybersecurity';
INSERT INTO node_courses(node_id,course_id) SELECT n.id,c.id FROM tree_nodes n,courses c WHERE n.exam='exit' AND n.kind='department' AND n.slug='software-engineering' AND c.code='software-design';
INSERT INTO node_courses(node_id,course_id) SELECT n.id,c.id FROM tree_nodes n,courses c WHERE n.exam='exit' AND n.kind='department' AND n.slug='software-engineering' AND c.code='software-testing';
INSERT INTO node_courses(node_id,course_id) SELECT n.id,c.id FROM tree_nodes n,courses c WHERE n.exam='exit' AND n.kind='department' AND n.slug='electrical-engineering' AND c.code='circuit-analysis';
INSERT INTO node_courses(node_id,course_id) SELECT n.id,c.id FROM tree_nodes n,courses c WHERE n.exam='exit' AND n.kind='department' AND n.slug='electrical-engineering' AND c.code='electronics';
INSERT INTO node_courses(node_id,course_id) SELECT n.id,c.id FROM tree_nodes n,courses c WHERE n.exam='exit' AND n.kind='department' AND n.slug='electrical-engineering' AND c.code='power-systems';
INSERT INTO node_courses(node_id,course_id) SELECT n.id,c.id FROM tree_nodes n,courses c WHERE n.exam='exit' AND n.kind='department' AND n.slug='pharmacy' AND c.code='pharmacology';
INSERT INTO node_courses(node_id,course_id) SELECT n.id,c.id FROM tree_nodes n,courses c WHERE n.exam='exit' AND n.kind='department' AND n.slug='pharmacy' AND c.code='pharmaceutical-chemistry';
INSERT INTO node_courses(node_id,course_id) SELECT n.id,c.id FROM tree_nodes n,courses c WHERE n.exam='exit' AND n.kind='department' AND n.slug='biology' AND c.code='genetics';
INSERT INTO node_courses(node_id,course_id) SELECT n.id,c.id FROM tree_nodes n,courses c WHERE n.exam='exit' AND n.kind='department' AND n.slug='biology' AND c.code='ecology';
INSERT INTO node_courses(node_id,course_id) SELECT n.id,c.id FROM tree_nodes n,courses c WHERE n.exam='exit' AND n.kind='department' AND n.slug='accounting' AND c.code='financial-accounting';
INSERT INTO node_courses(node_id,course_id) SELECT n.id,c.id FROM tree_nodes n,courses c WHERE n.exam='exit' AND n.kind='department' AND n.slug='accounting' AND c.code='cost-accounting';
INSERT INTO node_courses(node_id,course_id) SELECT n.id,c.id FROM tree_nodes n,courses c WHERE n.exam='exit' AND n.kind='department' AND n.slug='law' AND c.code='constitutional-law';
INSERT INTO node_courses(node_id,course_id) SELECT n.id,c.id FROM tree_nodes n,courses c WHERE n.exam='exit' AND n.kind='department' AND n.slug='law' AND c.code='criminal-law';

COMMIT;

-- Quick check (should return: remedial 2 streams, exit 2 streams / 6 fields / 2 subgroups / 24 departments):
-- SELECT exam, kind, count(*) FROM tree_nodes GROUP BY 1,2 ORDER BY 1,2;
