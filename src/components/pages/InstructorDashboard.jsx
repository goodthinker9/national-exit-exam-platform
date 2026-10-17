import { useMemo, useState } from "react";
import { exitExamCourses, remedialCourses } from "../../data/courseGroups.js";
import { getCoordinatorCourses } from "../../utils/coordinatorScope.js";
import { useLanguage } from "../../i18n/LanguageContext.jsx";
import LanguageSwitcher from "../../i18n/LanguageSwitcher.jsx";
import { Icon } from "../shared/Icons.jsx";
import "./InstructorDashboard.css";

const sections = [
  ["Today",                    "today"],
  ["Add question",             "add"],
  ["Import file",              "import"],
  ["My questions",             "questions"],
  ["Review queue",             "review"],
  ["Student reports",          "reports"],
  ["Hardest questions",        "hardest"],
  ["Announce to my students",  "announce"],
];
const coordinatorSections = [
  ["Track overview",  "overview"],
  ["Assignments",     "assignments"],
  ["Approvals",       "approvals"],
  ["Add question",    "add"],
  ["Import file",     "import"],
];
const allCourses = [...exitExamCourses, ...remedialCourses];
const difficulties = ["Easy", "Medium", "Hard"];
const initialQuestion = {
  courseId: "",
  topic: "",
  difficulty: "Medium",
  question: "",
  options: ["", "", "", ""],
  answer: 0,
  explanation: "",
};
const acceptedHeaders = {
  course: ["course", "course name"],
  topic: ["topic"],
  difficulty: ["difficulty"],
  question: ["question", "question text"],
  optionA: ["optiona", "option a", "a"],
  optionB: ["optionb", "option b", "b"],
  optionC: ["optionc", "option c", "c"],
  optionD: ["optiond", "option d", "d"],
  correctAnswer: ["correctanswer", "correct answer", "answer", "correct"],
  explanation: ["explanation", "rationale"],
};

function cleanHeader(value) {
  return String(value ?? "").toLocaleLowerCase().replace(/[_-]/g, " ").trim();
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let inQuotes = false;
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (character === '"' && inQuotes && text[index + 1] === '"') {
      cell += '"';
      index += 1;
    } else if (character === '"') {
      inQuotes = !inQuotes;
    } else if (character === "," && !inQuotes) {
      row.push(cell);
      cell = "";
    } else if ((character === "\n" || character === "\r") && !inQuotes) {
      if (character === "\r" && text[index + 1] === "\n") index += 1;
      row.push(cell);
      if (row.some((value) => String(value).trim())) rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += character;
    }
  }
  if (inQuotes) throw new Error("The CSV contains an unclosed quoted field.");
  row.push(cell);
  if (row.some((value) => String(value).trim())) rows.push(row);
  if (rows.length < 2) return [];
  const headers = rows[0].map((header) => String(header).trim());
  return rows.slice(1).map((values) => Object.fromEntries(
    headers.map((header, index) => [header, values[index] ?? ""]),
  ));
}

function rowsToObjects(rows) {
  if (rows.length < 2) return [];
  const headers = rows[0].map((header) => String(header ?? "").trim());
  return rows.slice(1)
    .filter((row) => row.some((value) => String(value ?? "").trim()))
    .map((values) => Object.fromEntries(
      headers.map((header, index) => [header, values[index] ?? ""]),
    ));
}

function resolveRow(row) {
  const keys = Object.keys(row);
  const resolved = {};
  for (const [field, aliases] of Object.entries(acceptedHeaders)) {
    const matchingKey = keys.find((key) => aliases.includes(cleanHeader(key).replace(/\s/g, "")) || aliases.includes(cleanHeader(key)));
    resolved[field] = matchingKey ? String(row[matchingKey] ?? "").trim() : "";
  }
  return resolved;
}

function validateImportedRow(row, assignedCourses) {
  const errors = [];
  const course = assignedCourses.find(
    (item) => item.name.toLocaleLowerCase() === row.course.toLocaleLowerCase(),
  );
  if (!row.course) errors.push("course is missing");
  else if (!course) errors.push("course is outside your assigned scope");
  if (!row.topic) errors.push("topic is missing");
  if (!difficulties.some((difficulty) => difficulty.toLocaleLowerCase() === row.difficulty.toLocaleLowerCase())) {
    errors.push("difficulty must be Easy, Medium, or Hard");
  }
  if (!row.question) errors.push("question text is missing");
  if ([row.optionA, row.optionB, row.optionC, row.optionD].some((option) => !option)) {
    errors.push("one or more of the four options are missing");
  }
  const correct = row.correctAnswer.toLocaleUpperCase();
  const answerIndex = ["A", "B", "C", "D"].indexOf(correct) >= 0
    ? ["A", "B", "C", "D"].indexOf(correct)
    : [row.optionA, row.optionB, row.optionC, row.optionD]
      .findIndex((option) => option.toLocaleLowerCase() === row.correctAnswer.toLocaleLowerCase());
  if (answerIndex < 0) errors.push("correct answer is missing or must be A, B, C, or D");
  if (!row.explanation) errors.push("explanation is missing");
  if (errors.length) return { errors };
  return {
    course,
    question: {
      courseId: course.id,
      course: course.name,
      subject: course.name,
      examType: course.examType || "Exit exam",
      topic: row.topic,
      difficulty: difficulties.find((difficulty) => difficulty.toLocaleLowerCase() === row.difficulty.toLocaleLowerCase()),
      question: row.question,
      options: [row.optionA, row.optionB, row.optionC, row.optionD],
      answer: answerIndex,
      explanation: row.explanation,
    },
  };
}

export default function InstructorDashboard({
  mode = "instructor",
  currentUser,
  users,
  onLogout,
  drafts,
  onDraftsChange,
  reports,
  onReportsChange,
  onUpdateReport,
  performance,
  announcements,
  onAnnouncementsChange,
  courseAssignments = {},
  onCourseAssignmentsChange,
  publishedQuestions = [],
  onPublishQuestion,
}) {
  const { t } = useLanguage();
  const isCoordinator = mode === "coordinator";
  const visibleSections = isCoordinator ? coordinatorSections : sections;
  const [section, setSection] = useState(isCoordinator ? "Track overview" : "Today");
  const [form, setForm] = useState(() => ({
    ...initialQuestion,
    courseId: currentUser.assignedCourseIds?.[0] || "",
  }));
  const [formError, setFormError] = useState("");
  const [importReport, setImportReport] = useState([]);
  const [importSummary, setImportSummary] = useState("");
  const [reviewComments, setReviewComments] = useState({});
  const [openedReport, setOpenedReport] = useState(null);
  const [announcement, setAnnouncement] = useState("");
  const [notice, setNotice] = useState("");
  const [assignmentDrafts, setAssignmentDrafts] = useState(courseAssignments);
  // Notification bell state
  const [bellOpen, setBellOpen] = useState(false);
  const [readIds, setReadIds] = useState(new Set());
  // Resolve/Dismiss reason per report
  const [reportReasons, setReportReasons] = useState({});
  const assignedCourseIds = currentUser.assignedCourseIds || [];
  const scopedCourses = useMemo(
    () => getCoordinatorCourses(currentUser.scope),
    [currentUser.scope],
  );
  const accountCourses = useMemo(
    () => allCourses.filter((course) => assignedCourseIds.includes(course.id)),
    [assignedCourseIds],
  );
  const authorCourses = useMemo(() => {
    const candidates = isCoordinator
      ? scopedCourses
      : accountCourses;
    return isCoordinator ? candidates : candidates.filter((course) => {
      const authorId = courseAssignments[course.id]?.authorId;
      return !authorId || authorId === currentUser.id;
    });
  }, [isCoordinator, scopedCourses, accountCourses, courseAssignments, currentUser.id]);
  const assignedCourses = useMemo(() => {
    if (isCoordinator) return scopedCourses;
    return accountCourses.filter((course) => {
      const assignment = courseAssignments[course.id];
      return !assignment || !assignment.reviewerId || assignment.reviewerId === currentUser.id
        || assignment.authorId === currentUser.id;
    });
  }, [isCoordinator, scopedCourses, accountCourses, courseAssignments, currentUser.id]);
  const scopedCourseIds = useMemo(
    () => new Set((isCoordinator ? scopedCourses : allCourses.filter((course) => assignedCourseIds.includes(course.id))).map((course) => course.id)),
    [isCoordinator, scopedCourses, assignedCourseIds],
  );
  const myDrafts = drafts.filter((item) => item.authorId === currentUser.id);
  const courseDrafts = drafts.filter((item) => scopedCourseIds.has(item.courseId));
  const reviewQueue = courseDrafts.filter(
    (item) => item.authorId !== currentUser.id
      && ["Draft", "Sent back"].includes(item.status)
      && (!courseAssignments[item.courseId]?.reviewerId
        || courseAssignments[item.courseId].reviewerId === currentUser.id),
  );
  const approvalQueue = courseDrafts.filter((item) => item.status === "Reviewed");
  const scopedReports = reports.filter(
    (report) => assignedCourseIds.includes(report.courseId) && report.status === "Open",
  );
  const currentAnnouncements = announcements.filter(
    (item) => item.audience === "courses"
      && item.courseIds.some((courseId) => assignedCourseIds.includes(courseId)),
  );

  function notify(message) {
    setNotice(message);
    window.setTimeout(() => setNotice(""), 3200);
  }

  function resetQuestionForm() {
    setForm({ ...initialQuestion, courseId: authorCourses[0]?.id || "" });
  }

  function saveDraft(question) {
    const draft = {
      ...question,
      id: `draft-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      authorId: currentUser.id,
      authorName: currentUser.name,
      status: "Draft",
      reviewerComment: "",
      createdAt: new Date().toISOString(),
    };
    onDraftsChange((items) => [draft, ...items]);
    return draft;
  }

  function submitQuestion(event) {
    event.preventDefault();
    if (!authorCourses.some((course) => course.id === form.courseId)) {
      setFormError(t("Choose a course assigned to your account."));
      return;
    }
    if (!form.topic.trim() || !form.question.trim() || !form.explanation.trim()
      || form.options.some((option) => !option.trim())) {
      setFormError(t("Complete the topic, question, all four options, and explanation."));
      return;
    }
    saveDraft({
      ...form,
      course: authorCourses.find((course) => course.id === form.courseId).name,
      subject: authorCourses.find((course) => course.id === form.courseId).name,
      examType: authorCourses.find((course) => course.id === form.courseId).examType || "Exit exam",
      topic: form.topic.trim(),
      question: form.question.trim(),
      options: form.options.map((option) => option.trim()),
      explanation: form.explanation.trim(),
    });
    setFormError("");
    resetQuestionForm();
    setSection(isCoordinator ? "Track overview" : "My questions");
    notify(t("Question saved as a draft and added to the review workflow."));
  }

  async function importFile(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    setImportReport([]);
    setImportSummary("");
    try {
      let rows;
      if (file.name.toLocaleLowerCase().endsWith(".csv")) {
        rows = parseCsv(await file.text());
      } else {
        const { default: readXlsxFile } = await import("read-excel-file/browser");
        const [firstSheet] = await readXlsxFile(file);
        if (!firstSheet) throw new Error("The selected workbook does not contain a worksheet.");
        rows = rowsToObjects(firstSheet.data);
      }
      if (!rows.length) throw new Error("The selected file has no data rows.");
      const importedDrafts = [];
      const report = rows.map((rawRow, index) => {
        const parsed = validateImportedRow(resolveRow(rawRow), authorCourses);
        if (parsed.errors) {
          return { row: index + 2, status: "Rejected", errors: parsed.errors };
        }
        importedDrafts.push(saveDraft(parsed.question));
        return { row: index + 2, status: "Imported as draft", errors: [] };
      });
      setImportReport(report);
      setImportSummary(t("{valid} rows imported as drafts; {invalid} rows need correction.", {
        valid: importedDrafts.length,
        invalid: report.length - importedDrafts.length,
      }));
      if (importedDrafts.length) setSection("Import file");
    } catch (error) {
      setImportSummary(t("Could not read this file: {message}", { message: error.message }));
    } finally {
      event.target.value = "";
    }
  }

  function markReviewed(question) {
    onDraftsChange((items) => items.map((item) =>
      item.id === question.id ? { ...item, status: "Reviewed", reviewerComment: "" } : item,
    ));
  }

  function sendBack(question) {
    const reviewerComment = (reviewComments[question.id] || "").trim();
    if (!reviewerComment) {
      notify(t("Add a reviewer comment before sending the question back."));
      return;
    }
    onDraftsChange((items) => items.map((item) =>
      item.id === question.id ? { ...item, status: "Sent back", reviewerComment } : item,
    ));
    setReviewComments((items) => ({ ...items, [question.id]: "" }));
  }

  function saveCourseAssignment(course) {
    const assignment = assignmentDrafts[course.id] || {};
    if (!assignment.authorId || !assignment.reviewerId) {
      notify(t("Choose both an author and a reviewer before saving this course assignment."));
      return;
    }
    if (assignment.authorId === assignment.reviewerId) {
      notify(t("The author and reviewer must be different people."));
      return;
    }
    onCourseAssignmentsChange((items) => ({ ...items, [course.id]: assignment }));
    notify(t("Course assignment saved."));
  }

  function updateAssignment(courseId, role, value) {
    setAssignmentDrafts((items) => ({
      ...items,
      [courseId]: { ...items[courseId], [role]: value },
    }));
  }

  function approveQuestion(question) {
    onPublishQuestion(question);
    onDraftsChange((items) => items.map((item) =>
      item.id === question.id
        ? { ...item, status: "Published", publishedAt: new Date().toISOString(), reviewerComment: "" }
        : item,
    ));
    notify(t("Question approved and published."));
  }

  function sendBackApproval(question) {
    const reviewerComment = (reviewComments[question.id] || "").trim();
    if (!reviewerComment) {
      notify(t("Add a comment before sending the question back."));
      return;
    }
    onDraftsChange((items) => items.map((item) =>
      item.id === question.id ? { ...item, status: "Sent back", reviewerComment } : item,
    ));
    setReviewComments((items) => ({ ...items, [question.id]: "" }));
    notify(t("Question sent back to its author."));
  }

  function dismissReport(report) {
    const reason = (reportReasons[report.id] || "").trim();
    if (onUpdateReport) {
      onUpdateReport(report.id, "Dismissed", reason);
    } else {
      onReportsChange((items) => items.map((item) =>
        item.id === report.id ? { ...item, status: "Dismissed", dismissedBy: currentUser.name, reason } : item,
      ));
    }
    notify(t("Report dismissed."));
  }

  function resolveReport(report) {
    const reason = (reportReasons[report.id] || "").trim();
    if (onUpdateReport) {
      onUpdateReport(report.id, "Resolved", reason);
    } else {
      onReportsChange((items) => items.map((item) =>
        item.id === report.id ? { ...item, status: "Resolved", resolvedBy: currentUser.name, reason } : item,
      ));
    }
    notify(t("Report marked as resolved."));
  }

  function publishCourseAnnouncement(event) {
    event.preventDefault();
    const message = announcement.trim();
    if (!message || !assignedCourses.length) return;
    onAnnouncementsChange((items) => [{
      id: `instructor-announcement-${Date.now()}`,
      message,
      at: new Date().toISOString(),
      author: currentUser.name,
      audience: "courses",
      courseIds: assignedCourseIds,
      instructorId: currentUser.id,
    }, ...items]);
    setAnnouncement("");
    notify(t("Announcement sent to students in your assigned courses."));
  }

  function renderQuestionForm(questionForm, setQuestionForm, onSubmit, submitLabel) {
    return (
      <form className="instructor-form" onSubmit={onSubmit}>
        <label>{t("Course")}
          <select value={questionForm.courseId} onChange={(event) => setQuestionForm((current) => ({ ...current, courseId: event.target.value }))} required>
            <option value="">{t("Choose an assigned course")}</option>
            {authorCourses.map((course) => <option key={course.id} value={course.id}>{t(course.name)}</option>)}
          </select>
        </label>
        <label>{t("Topic")}<input value={questionForm.topic} onChange={(event) => setQuestionForm((current) => ({ ...current, topic: event.target.value }))} required /></label>
        <label>{t("Difficulty")}
          <select value={questionForm.difficulty} onChange={(event) => setQuestionForm((current) => ({ ...current, difficulty: event.target.value }))}>
            {difficulties.map((difficulty) => <option key={difficulty}>{difficulty}</option>)}
          </select>
        </label>
        <label className="instructor-form-wide">{t("Question text")}<textarea rows="3" value={questionForm.question} onChange={(event) => setQuestionForm((current) => ({ ...current, question: event.target.value }))} required /></label>
        <fieldset className="instructor-options instructor-form-wide">
          <legend>{t("Four answer options · mark the correct one")}</legend>
          {questionForm.options.map((option, index) => (
            <label className="instructor-option" key={index}>
              <input
                type="radio"
                name="correct-option"
                aria-label={t("Mark option {letter} correct", { letter: String.fromCharCode(65 + index) })}
                checked={questionForm.answer === index}
                onChange={() => setQuestionForm((current) => ({ ...current, answer: index }))}
              />
              <span>{String.fromCharCode(65 + index)}</span>
              <input
                aria-label={t("Option {letter}", { letter: String.fromCharCode(65 + index) })}
                value={option}
                onChange={(event) => setQuestionForm((current) => ({
                  ...current,
                  options: current.options.map((item, itemIndex) => itemIndex === index ? event.target.value : item),
                }))}
                required
              />
            </label>
          ))}
        </fieldset>
        <label className="instructor-form-wide">{t("Explanation")}<textarea rows="3" value={questionForm.explanation} onChange={(event) => setQuestionForm((current) => ({ ...current, explanation: event.target.value }))} required /></label>
        {formError && <p className="instructor-error" role="alert">{formError}</p>}
        <button className="instructor-primary" type="submit">{submitLabel}</button>
      </form>
    );
  }

  function renderToday() {
    const tasks = [
      [myDrafts.filter((item) => item.status === "Draft").length, t("Drafts awaiting review")],
      [reviewQueue.length, t("Questions in your review queue")],
      [scopedReports.length, t("Open student reports")],
    ];
    return (
      <>
        <section className="instructor-stat-grid">
          {tasks.map(([count, label]) => (
            <article key={label}>
              <strong>{count}</strong>
              <span>{label}</span>
            </article>
          ))}
        </section>

        {assignedCourses.length === 0 ? (
          <section className="instructor-panel">
            <div className="instructor-onboarding">
              <span className="instructor-onboarding-icon" aria-hidden="true">📋</span>
              <div>
                <h3>{t("No courses assigned yet")}</h3>
                <p className="instructor-muted">{t("An administrator needs to assign courses to your account before you can author or review questions. Once assigned, your courses will appear here and you can start adding questions.")}</p>
              </div>
            </div>
          </section>
        ) : (
          <section className="instructor-panel">
            <h2>{t("Your assigned courses")}</h2>
            <div className="instructor-course-list">
              {assignedCourses.map((course) => (
                <span key={course.id}>{t(course.name)}</span>
              ))}
            </div>
            <div className="instructor-quick-links">
              {["Add question", "Import file", "Review queue", "Student reports"].map((item) => (
                <button type="button" key={item} onClick={() => setSection(item)}>
                  {t(item)} <span aria-hidden="true">→</span>
                </button>
              ))}
            </div>
          </section>
        )}
      </>
    );
  }

  function renderCoordinatorOverview() {
    const publishedPerCourse = assignedCourses.map((course) => ({
      ...course,
      publishedCount: publishedQuestions.filter((question) =>
        question.courseId
          ? question.courseId === course.id
          : question.course === course.name || question.subject === course.name,
      ).length,
    }));
    const publishedCount = publishedPerCourse.reduce((total, course) => total + course.publishedCount, 0);
    const authorsAssigned = assignedCourses.filter((course) =>
      courseAssignments[course.id]?.authorId,
    ).length;

    return (
      <>
        <section className="instructor-stat-grid coordinator-stat-grid">
          <article><strong>{approvalQueue.length}</strong><span>{t("Awaiting publication")}</span></article>
          <article><strong>{authorsAssigned}</strong><span>{t("Courses with authors assigned")}</span></article>
          <article><strong>{publishedCount}</strong><span>{t("Published questions in scope")}</span></article>
        </section>
        <section className="instructor-panel">
          <h2>{t("Track overview")}: {t(currentUser.scope)}</h2>
          <p className="instructor-muted">{t("Question quota target: 60 published questions per course.")}</p>
          {!assignedCourses.length ? (
            <p className="instructor-error" role="alert">{t("No courses match this coordinator scope. Ask an administrator to set a valid Remedial track, Exit exam field, or department group.")}</p>
          ) : (
            <div className="coordinator-quota-list">
              {publishedPerCourse.map((course) => {
                const percentage = Math.min(100, Math.round(course.publishedCount / 60 * 100));
                return (
                  <article className={`coordinator-quota${percentage < 50 ? " below-target" : ""}`} key={course.id}>
                    <div><strong>{t(course.name)}</strong><span>{course.publishedCount} / 60 {t("published")}</span></div>
                    <div className="coordinator-quota-track" role="progressbar" aria-label={t("{course} question quota", { course: t(course.name) })} aria-valuemin={0} aria-valuemax={60} aria-valuenow={Math.min(60, course.publishedCount)}>
                      <span style={{ width: `${percentage}%` }} />
                    </div>
                  </article>
                );
              })}
            </div>
          )}
          <div className="instructor-quick-links">
            {["Assignments", "Approvals", "Add question", "Import file"].map((item) => (
              <button type="button" key={item} onClick={() => setSection(item)}>{t(item)} <span aria-hidden="true">→</span></button>
            ))}
          </div>
        </section>
      </>
    );
  }

  function renderCoordinatorAssignments() {
    return (
      <section className="instructor-panel">
        <h2>{t("Author and reviewer assignments")}</h2>
        <p className="instructor-muted">{t("Assign different active instructors to author and review each course in your scope.")}</p>
        {!assignedCourses.length && <p className="instructor-error" role="alert">{t("No courses are available for this coordinator scope.")}</p>}
        {assignedCourses.map((course) => {
          const assignment = assignmentDrafts[course.id] || {};
          const eligibleUsers = users.filter((account) =>
            account.status === "Active"
            && account.role.toLocaleLowerCase() === "instructor"
            && account.assignedCourseIds?.includes(course.id),
          );
          return (
            <article className="coordinator-assignment-row" key={course.id}>
              <h3>{t(course.name)}</h3>
              <label>{t("Author")}
                <select value={assignment.authorId || ""} onChange={(event) => updateAssignment(course.id, "authorId", event.target.value)}>
                  <option value="">{t("Choose an author")}</option>
                  {eligibleUsers.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}
                </select>
              </label>
              <label>{t("Reviewer")}
                <select value={assignment.reviewerId || ""} onChange={(event) => updateAssignment(course.id, "reviewerId", event.target.value)}>
                  <option value="">{t("Choose a reviewer")}</option>
                  {eligibleUsers.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}
                </select>
              </label>
              <button className="instructor-primary" type="button" onClick={() => saveCourseAssignment(course)}>{t("Save assignment")}</button>
              {!eligibleUsers.length && <p className="instructor-muted">{t("No active instructors are assigned to this course yet. Ask an administrator to assign course access first.")}</p>}
            </article>
          );
        })}
      </section>
    );
  }

  function renderCoordinatorApprovals() {
    return (
      <section className="instructor-panel">
        <h2>{t("Approvals")}</h2>
        {approvalQueue.length ? approvalQueue.map((question) => (
          <article className="instructor-review-card" key={question.id}>
            <div className="instructor-review-meta">
              <strong>{t(question.course)} · {t(question.topic)}</strong>
              <span>{t("By {name}", { name: question.authorName })} · {t("Reviewed")}</span>
            </div>
            <p>{question.question}</p>
            <ol type="A">{question.options.map((option, index) => (
              <li className={question.answer === index ? "correct-option" : ""} key={`${index}-${option}`}>{option}{question.answer === index ? ` · ${t("Correct answer")}` : ""}</li>
            ))}</ol>
            <p className="instructor-muted">{t("Explanation")}: {question.explanation}</p>
            <label>{t("Reviewer comment")}
              <textarea
                rows="2"
                value={reviewComments[question.id] || ""}
                onChange={(event) => setReviewComments((current) => ({ ...current, [question.id]: event.target.value }))}
              />
            </label>
            <div className="instructor-actions">
              <button className="instructor-secondary" type="button" onClick={() => approveQuestion(question)}>{t("Approve and publish")}</button>
              <button className="instructor-return" type="button" onClick={() => sendBackApproval(question)}>{t("Send back")}</button>
            </div>
          </article>
        )) : <p className="instructor-muted">{t("No reviewed questions are waiting for final publication in your scope.")}</p>}
      </section>
    );
  }

  function renderAddQuestion() {
    return (
      <section className="instructor-panel">
        <h2>{t("Add question")}</h2>
        {renderQuestionForm(form, setForm, submitQuestion, t("Save as draft and send to review"))}
      </section>
    );
  }

  function renderImport() {
    return (
      <section className="instructor-panel">
        <h2>{t("Import file")}</h2>
        <p className="instructor-muted">{t("Upload a CSV or Excel workbook (.xlsx or .xls). Use the first row for headers: course, topic, difficulty, question, optionA, optionB, optionC, optionD, correctAnswer (A-D), explanation.")}</p>
        <label className="instructor-file-picker">{t("Choose CSV or Excel file")}
          <input type="file" accept=".csv,.xlsx,.xls" onChange={importFile} disabled={!authorCourses.length} />
        </label>
        {!authorCourses.length && <p className="instructor-error">{t("No assigned courses: import is disabled.")}</p>}
        {importSummary && <p className="instructor-import-summary" role="status">{importSummary}</p>}
        {importReport.length > 0 && (
          <div className="instructor-table-scroll">
            <table className="instructor-table">
              <thead><tr><th>{t("Row")}</th><th>{t("Result")}</th><th>{t("Validation details")}</th></tr></thead>
              <tbody>{importReport.map((item) => (
                <tr className={item.errors.length ? "row-invalid" : ""} key={item.row}>
                  <td>{t("Row {row}", { row: item.row })}</td>
                  <td>{t(item.status)}</td>
                  <td>{item.errors.length ? item.errors.map((error) => t(error)).join("; ") : t("Valid row saved as Draft.")}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        )}
      </section>
    );
  }

  function renderMyQuestions() {
    return (
      <section className="instructor-panel">
        <h2>{t("My questions")}</h2>
        <QuestionTable
          questions={myDrafts}
          t={t}
          empty={t("You have not authored any questions yet.")}
        />
      </section>
    );
  }

  function renderReviewQueue() {
    return (
      <section className="instructor-panel">
        <h2>{t("Review queue")}</h2>
        {reviewQueue.length ? reviewQueue.map((question) => (
          <article className="instructor-review-card" key={question.id}>
            <div className="instructor-review-meta">
              <strong>{t(question.course)} · {t(question.topic)}</strong>
              <span>{t("By {name}", { name: question.authorName })} · {t(question.status)}</span>
            </div>
            <p>{question.question}</p>
            <ol type="A">{question.options.map((option, index) => (
              <li className={question.answer === index ? "correct-option" : ""} key={`${index}-${option}`}>{option}{question.answer === index ? ` · ${t("Correct answer")}` : ""}</li>
            ))}</ol>
            <p className="instructor-muted">{t("Explanation")}: {question.explanation}</p>
            <label>{t("Reviewer comment")}
              <textarea
                rows="2"
                value={reviewComments[question.id] || ""}
                onChange={(event) => setReviewComments((current) => ({ ...current, [question.id]: event.target.value }))}
              />
            </label>
            <div className="instructor-actions">
              <button className="instructor-secondary" type="button" onClick={() => markReviewed(question)}>{t("Mark reviewed")}</button>
              <button className="instructor-return" type="button" onClick={() => sendBack(question)}>{t("Send back")}</button>
            </div>
          </article>
        )) : <p className="instructor-muted">{t("No other authors’ questions are waiting for your review.")}</p>}
        <p className="instructor-muted">{t("You cannot review your own questions or publish questions.")}</p>
      </section>
    );
  }

  function renderReports() {
    return (
      <section className="instructor-panel">
        <h2>{t("Student reports")}</h2>
        {scopedReports.length ? scopedReports.map((report) => (
          <article className="instructor-report-card" key={report.id}>
            <div className="instructor-review-meta">
              <strong>{t(report.course)} · {t("Reported by {name}", { name: report.reporterName })}</strong>
              <span>{new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(report.createdAt))}</span>
            </div>
            <p>{report.message}</p>
            <label className="instructor-reason-label">{t("Optional note to student")}
              <input
                type="text"
                maxLength="200"
                placeholder={t("Short reason or feedback (optional)")}
                value={reportReasons[report.id] || ""}
                onChange={(e) => setReportReasons((prev) => ({ ...prev, [report.id]: e.target.value }))}
              />
            </label>
            <div className="instructor-actions">
              <button className="instructor-secondary" type="button" onClick={() => resolveReport(report)}>{t("Resolve")}</button>
              <button className="instructor-return" type="button" onClick={() => dismissReport(report)}>{t("Dismiss")}</button>
              <button className="instructor-outline" type="button" onClick={() => setOpenedReport(openedReport === report.id ? null : report.id)}>
                {t(openedReport === report.id ? "Close question" : "Open question")}
              </button>
            </div>
            {openedReport === report.id && (
              <div className="instructor-question-detail">
                <strong>{report.questionText}</strong>
                {report.questionOptions?.map((option, index) => <p key={`${index}-${option}`}>{String.fromCharCode(65 + index)}. {option}</p>)}
              </div>
            )}
          </article>
        )) : <p className="instructor-muted">{t("No open mistake reports for your assigned courses.")}</p>}
      </section>
    );
  }

  function renderHardestQuestions() {
    const courseNames = new Set(assignedCourses.map((course) => course.name));
    const hardest = Object.values(performance)
      .filter((item) => courseNames.has(item.course) && item.attempted > 0)
      .map((item) => ({ ...item, percentCorrect: Math.round(item.correct / item.attempted * 100) }))
      .sort((a, b) => a.percentCorrect - b.percentCorrect);
    return (
      <section className="instructor-panel">
        <h2>{t("Hardest questions")}</h2>
        <p className="instructor-muted">{t("A very low score may indicate a weak question or an incorrect answer key; review the item before making changes.")}</p>
        {hardest.length ? (
          <div className="instructor-table-scroll">
            <table className="instructor-table">
              <thead><tr><th>{t("Course")}</th><th>{t("Question")}</th><th>{t("Answered correctly")}</th><th>{t("Attempts")}</th></tr></thead>
              <tbody>{hardest.map((item) => (
                <tr key={item.questionId} className={item.percentCorrect < 40 ? "row-invalid" : ""}>
                  <td>{t(item.course)}</td><td>{item.questionText}</td><td>{item.percentCorrect}%</td><td>{item.attempted}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        ) : <p className="instructor-muted">{t("No answer-performance data is available for assigned courses yet.")}</p>}
      </section>
    );
  }

  function renderAnnouncements() {
    return (
      <section className="instructor-panel">
        <h2>{t("Announce to my students")}</h2>
        <p className="instructor-muted">{t("Only students assigned to your courses can receive this message.")}</p>
        <form className="instructor-announcement-form" onSubmit={publishCourseAnnouncement}>
          <label>{t("Announcement message")}<textarea rows="4" maxLength="500" value={announcement} onChange={(event) => setAnnouncement(event.target.value)} disabled={!assignedCourses.length} /></label>
          <button className="instructor-primary" type="submit" disabled={!announcement.trim() || !assignedCourses.length}>{t("Send to my students")}</button>
        </form>
        {currentAnnouncements.length > 0 && (
          <div className="instructor-announcement-list">
            {currentAnnouncements.map((item) => <article key={item.id}><p>{item.message}</p><small>{item.author} · {item.courseIds.map((id) => assignedCourses.find((course) => course.id === id)?.name).filter(Boolean).map(t).join(", ")}</small></article>)}
          </div>
        )}
      </section>
    );
  }

  const renderers = {
    Today: renderToday,
    "Track overview": renderCoordinatorOverview,
    Assignments: renderCoordinatorAssignments,
    Approvals: renderCoordinatorApprovals,
    "Add question": renderAddQuestion,
    "Import file": renderImport,
    "My questions": renderMyQuestions,
    "Review queue": renderReviewQueue,
    "Student reports": renderReports,
    "Hardest questions": renderHardestQuestions,
    "Announce to my students": renderAnnouncements,
  };

  return (
    <main className="instructor-dashboard">
      <aside className="instructor-sidebar">
        <div className="instructor-brand"><span aria-hidden="true">✦</span> {t("ExitPrep")}</div>

        {/* Sidebar user card */}
        <div className="instructor-sidebar-user">
          <span className="instructor-sidebar-avatar" aria-hidden="true">
            {currentUser.name.trim().split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase()}
          </span>
          <div className="instructor-sidebar-info">
            <span className="instructor-sidebar-name">{currentUser.name}</span>
            <span className="instructor-sidebar-role">
              {t(isCoordinator ? "COORDINATOR" : "INSTRUCTOR")}
            </span>
          </div>
        </div>

        <nav aria-label={t(isCoordinator ? "Coordinator navigation" : "Instructor navigation")}>
          <span className="instructor-sidebar-section-label">{t("MENU")}</span>
          {visibleSections.map(([name, icon]) => (
            <button
              type="button"
              className={section === name ? "active" : ""}
              key={name}
              onClick={() => setSection(name)}
            >
              <Icon name={icon} size={18} strokeWidth={1.7} />{t(name)}
            </button>
          ))}
        </nav>

        <div className="instructor-sidebar-footer">
          <span>{assignedCourses.length} {t(isCoordinator ? "courses in scope" : "assigned courses")}</span>
        </div>
      </aside>

      <section className="instructor-workspace">
        <header className="instructor-topbar">
          <div className="instructor-mobile-brand"><span aria-hidden="true">✦</span> ExitPrep</div>
          <div className="instructor-topbar-actions">
            {/* Notification bell */}
            <div className="instructor-bell-wrap">
              <button
                className="instructor-bell-btn"
                type="button"
                aria-label={t("Notifications")}
                aria-expanded={bellOpen}
                onClick={() => setBellOpen((o) => !o)}
              >
                <Icon name="bell" size={20} />
                {(() => {
                  const unreadReports = scopedReports.filter((r) => !readIds.has(r.id)).length;
                  const unreadQueue = reviewQueue.filter((q) => !readIds.has(q.id)).length;
                  const total = unreadReports + unreadQueue;
                  return total > 0 ? <span className="instructor-bell-count">{total}</span> : null;
                })()}
              </button>
              {bellOpen && (
                <div className="instructor-bell-dropdown" role="dialog" aria-label={t("Notifications")}>
                  <p className="instructor-bell-note">{t("Demo: notifications are held in this app session. The real system delivers them through the server.")}</p>
                  {scopedReports.length === 0 && reviewQueue.length === 0 && (
                    <p className="instructor-muted">{t("No new notifications.")}</p>
                  )}
                  {scopedReports.map((r) => (
                    <button
                      key={r.id}
                      className={`instructor-bell-item${readIds.has(r.id) ? " read" : ""}`}
                      type="button"
                      onClick={() => {
                        setReadIds((s) => new Set([...s, r.id]));
                        setBellOpen(false);
                        setSection("Student reports");
                      }}
                    >
                      <strong>{t("Student report")}</strong>
                      <span>{t(r.course)} · {r.reporterName}</span>
                    </button>
                  ))}
                  {reviewQueue.map((q) => (
                    <button
                      key={q.id}
                      className={`instructor-bell-item${readIds.has(q.id) ? " read" : ""}`}
                      type="button"
                      onClick={() => {
                        setReadIds((s) => new Set([...s, q.id]));
                        setBellOpen(false);
                        setSection("Review queue");
                      }}
                    >
                      <strong>{t("Question for review")}</strong>
                      <span>{t(q.course)} · {q.authorName}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <LanguageSwitcher />
            <span className="instructor-topbar-role">
              {t(isCoordinator ? "COORDINATOR" : "INSTRUCTOR")}
            </span>
            <span className="instructor-topbar-name">{currentUser.name}</span>
            <button className="instructor-signout-btn" type="button" onClick={onLogout}>
              <Icon name="logout" size={16} />{t("Sign out")}
            </button>
          </div>
        </header>
        <div className="instructor-content">
          <div className="instructor-heading">
            <div><p className="instructor-eyebrow">{t(isCoordinator ? "EXAM COORDINATOR DASHBOARD" : "INSTRUCTOR WORKSPACE")}</p><h1>{t(section)}</h1></div>
            <span>{t(isCoordinator ? "Is my area ready and moving?" : "What do I need to do today?")}</span>
          </div>
          {renderers[section]()}
          <p className="instructor-demo-note">{t("Demo: notifications are held in this app session. The real system delivers them through the server.")}</p>
        </div>
      </section>
      {notice && <div className="instructor-toast" role="status">{notice}</div>}
    </main>
  );
}

function QuestionTable({ questions, t, empty }) {
  if (!questions.length) return <p className="instructor-muted">{empty}</p>;
  return (
    <div className="instructor-table-scroll">
      <table className="instructor-table">
        <thead><tr><th>{t("Course / topic")}</th><th>{t("Question")}</th><th>{t("Difficulty")}</th><th>{t("Status")}</th><th>{t("Reviewer comments")}</th></tr></thead>
        <tbody>{questions.map((question) => (
          <tr key={question.id}>
            <td>{t(question.course)}<small>{t(question.topic)}</small></td>
            <td>{question.question}</td><td>{t(question.difficulty)}</td>
            <td><span className={`instructor-status status-${question.status.toLocaleLowerCase().replace(/\s+/g, "-")}`}>{t(question.status)}</span></td>
            <td>{question.reviewerComment || "—"}</td>
          </tr>
        ))}</tbody>
      </table>
    </div>
  );
}
