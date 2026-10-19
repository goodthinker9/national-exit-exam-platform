/**
 * src/lib/staffQuestions.js
 *
 * Converts a get_staff_questions() row ↔ the shape InstructorDashboard uses.
 */

// ── DB → UI ───────────────────────────────────────────────────────────────────

const STATUS_DB_TO_UI = {
  draft:      "Draft",
  in_review:  "Reviewed",   // peer-reviewed, waiting coordinator
  sent_back:  "Sent back",
  published:  "Published",
};

const DIFF_DB_TO_UI = {
  easy:   "Easy",
  medium: "Medium",
  hard:   "Hard",
};

/**
 * Convert one get_staff_questions row to the shape InstructorDashboard expects.
 *
 * @param {object} row   Raw item from get_staff_questions RPC.
 * @param {Array}  allCourses  From useCourseTree() — used to resolve course_id uuid → UI id.
 */
export function dbQuestionToUI(row, allCourses) {
  const course = allCourses.find((c) => c.dbId === row.course_id);

  // Options arrive as [{id,position,text}]; sort by position, extract texts.
  const sortedOpts = [...(row.options ?? [])].sort((a, b) => a.position - b.position);
  const options    = sortedOpts.map((o) => o.text);

  return {
    // identity
    id:              row.id,       // ui id (same, uuid kept)
    dbId:            row.id,
    courseDbId:      row.course_id,
    courseId:        course?.id  ?? row.course_id,
    course:          course?.name ?? row.course_id,
    examType:        "Exit exam",

    // content
    topic:           row.topic         ?? "",
    difficulty:      DIFF_DB_TO_UI[row.difficulty] ?? "Medium",
    question:        row.body          ?? "",
    options,
    answer:          row.correct_position ?? 0,
    explanation:     row.explanation   ?? "",

    // workflow
    status:          STATUS_DB_TO_UI[row.status] ?? row.status,
    reviewerComment: row.review_note   ?? "",

    // authorship
    authorId:        row.author_id,
    authorName:      row.author_name   ?? "Unknown",
    peerReviewerId:  row.peer_reviewer_id ?? null,

    // timestamps
    createdAt:       row.created_at,
    publishedAt:     row.published_at  ?? null,
  };
}

// ── UI → DB ───────────────────────────────────────────────────────────────────

const DIFF_UI_TO_DB = {
  Easy:   "easy",
  Medium: "medium",
  Hard:   "hard",
};

/**
 * Convert the InstructorDashboard form shape to save_question() arguments.
 */
export function uiFormToSaveArgs(form, courseDbId) {
  return {
    id:           form.dbId ?? null,
    courseId:     courseDbId,
    topic:        form.topic.trim(),
    difficulty:   DIFF_UI_TO_DB[form.difficulty] ?? "medium",
    body:         form.question.trim(),
    options:      form.options.map((o) => o.trim()),
    correctIndex: form.answer,
    explanation:  form.explanation.trim(),
  };
}
