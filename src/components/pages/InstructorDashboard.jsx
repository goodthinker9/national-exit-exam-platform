import { useEffect, useMemo, useRef, useState } from "react";
import { getCoordinatorCourses } from "../../utils/coordinatorScope.js";
import { useLanguage } from "../../i18n/LanguageContext.jsx";
import { useCourseTree } from "../../lib/CourseTreeContext.jsx";
import {
  saveQuestion as dbSaveQuestion,
  peerReviewQuestion as dbPeerReview,
  approveQuestion as dbApproveQuestion,
  peerReviewMany as dbPeerReviewMany,
  approveMany as dbApproveMany,
  setCourseDuty,
} from "../../lib/supabase.js";
import { uiFormToSaveArgs } from "../../lib/staffQuestions.js";
import AnnouncementManager from "../announcements/AnnouncementManager.jsx";
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
  ["Announcements",   "announce"],
];
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
  correctAnswer: ["correctanswer", "correct answer", "answer", "correct", "correctoption", "correct option", "correctchoice", "correct choice", "answerkey", "answer key", "key", "rightanswer", "right answer", "ans"],
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
  const missing = [];
  for (const [field, aliases] of Object.entries(acceptedHeaders)) {
    const matchingKey = keys.find((key) => aliases.includes(cleanHeader(key).replace(/\s/g, "")) || aliases.includes(cleanHeader(key)));
    resolved[field] = matchingKey ? String(row[matchingKey] ?? "").trim() : "";
    if (!matchingKey) missing.push(field);
  }
  resolved._missing = missing;
  resolved._headers = keys;
  return resolved;
}

// Reads the answer cell. Accepts A-D (also "b)", "Option B"), 1-4, or the exact text of one option.
function parseAnswerIndex(row) {
  const options = [row.optionA, row.optionB, row.optionC, row.optionD];
  const raw = String(row.correctAnswer ?? "").trim();
  if (!raw) return -1;
  const byText = options.findIndex((option) => option.toLocaleLowerCase() === raw.toLocaleLowerCase());
  const stripped = raw.replace(/^(option|choice|answer|ans)\s*[:\-]?\s*/i, "");
  const match = stripped.match(/^[(\[]?\s*([A-Da-d1-4])\s*[)\].:]?$/);
  if (match) {
    const symbol = match[1].toUpperCase();
    if (/[A-D]/.test(symbol)) return "ABCD".indexOf(symbol);
    if (byText >= 0) return byText;          // "3" that is also the text of an option wins
    return Number(symbol) - 1;               // otherwise 1-4 means the position
  }
  return byText;
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
  const answerIndex = parseAnswerIndex(row);
  if (answerIndex < 0) {
    errors.push(row._missing?.includes("correctAnswer")
      ? `no answer column found. Your file's columns are: ${(row._headers ?? []).join(", ") || "none"}. Add a column named correctAnswer.`
      : `correct answer is missing or must be A, B, C, or D (the file has "${row.correctAnswer || "empty"}")`);
  }
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
  courseAssignments = {},
  onCourseAssignmentsChange,
  publishedQuestions = [],
  onPublishQuestion,
  notifications = [],
  onMarkNotificationRead,
  staffInstructors = [],
}) {
  const { t } = useLanguage();
  const treeData = useCourseTree();
  const { exitExamCourses, remedialCourses } = treeData;
  const allCourses = useMemo(() => [...exitExamCourses, ...remedialCourses], [exitExamCourses, remedialCourses]);
  const isCoordinator = mode === "coordinator";
  const visibleSections = isCoordinator ? coordinatorSections : sections;
  const [section, setSection] = useState(isCoordinator ? "Track overview" : "Today");
  const [form, setForm] = useState(() => ({
    ...initialQuestion,
    courseId: currentUser.assignedCourseIds?.[0] || "",
  }));
  const [editingQuestion, setEditingQuestion] = useState(null); // { dbId, reviewerComment } for "edit and resubmit"
  const [savingQuestion, setSavingQuestion] = useState(false);
  const [formError, setFormError] = useState("");
  const [importReport, setImportReport] = useState([]);
  const [importSummary, setImportSummary] = useState("");
  const [reviewComments, setReviewComments] = useState({});
  const [reviewingId, setReviewingId] = useState(null);   // id currently being reviewed (disable buttons)
  const [openedReport, setOpenedReport] = useState(null);
  const [notice, setNotice] = useState("");
  const [assignmentDrafts, setAssignmentDrafts] = useState(courseAssignments);
  // Courses whose author/reviewer the coordinator is editing right now (not yet saved)
  const editedAssignments = useRef(new Set());
  // Saved assignments arrive after the screen opens (and refresh every minute): show them,
  // but never overwrite a course the coordinator is in the middle of editing.
  useEffect(() => {
    setAssignmentDrafts((current) => {
      const next = { ...courseAssignments };
      editedAssignments.current.forEach((id) => { if (current[id]) next[id] = current[id]; });
      return next;
    });
  }, [courseAssignments]);
  const [savingAssignment, setSavingAssignment] = useState(null); // courseId currently saving
  // Notification bell state
  const [bellOpen, setBellOpen] = useState(false);
  // Resolve/Dismiss reason per report
  const [reportReasons, setReportReasons] = useState({});

  // ── Bulk selection state ──────────────────────────────────────────────────
  const [reviewSelected,    setReviewSelected]    = useState(new Set()); // selected ids in review queue
  const [approvalSelected,  setApprovalSelected]  = useState(new Set()); // selected ids in approvals
  const [bulkRunning,       setBulkRunning]        = useState(false);
  const [bulkNotice,        setBulkNotice]         = useState("");        // aria-live result text
  // Send-back panel state (shared between review/approval)
  const [sendBackPanel,     setSendBackPanel]      = useState(null);      // 'review'|'approval'|null
  const [sendBackComment,   setSendBackComment]    = useState("");
  // Publish-confirm panel (approvals only)
  const [publishConfirm,    setPublishConfirm]     = useState(false);
  // The database stores course uuids; this screen compares UI ids. Map uuid -> UI id(s).
  const rawAssignedIds = currentUser.assignedCourseIds || [];
  const assignedCourseIds = useMemo(
    () => rawAssignedIds.flatMap((id) => {
      const ids = allCourses.filter((c) => c.dbId === id || c.id === id).map((c) => c.id);
      return ids.length ? ids : [id];
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [currentUser.assignedCourseIds, allCourses],
  );
  const scopedCourses = useMemo(() => {
    // A coordinator can manage several parts of the tree; combine them without duplicates.
    const list = currentUser.scopes?.length ? currentUser.scopes : [currentUser.scope];
    const byId = new Map();
    list.forEach((scope) => {
      getCoordinatorCourses(scope, treeData).forEach((course) => byId.set(course.id, course));
    });
    return [...byId.values()];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser.scope, currentUser.scopes, treeData.exitExamTree, treeData.exitExamCourses, treeData.remedialCourses]);
  const accountCourses = useMemo(
    () => allCourses.filter((course) => assignedCourseIds.includes(course.id)),
    [allCourses, assignedCourseIds],
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
    [isCoordinator, scopedCourses, allCourses, assignedCourseIds],
  );
  const myDrafts = drafts.filter((item) => item.authorId === currentUser.id);
  const courseDrafts = drafts.filter((item) => scopedCourseIds.has(item.courseId));
  // reviewQueue: Draft questions where I am the assigned reviewer (no fallback)
  const reviewQueue = courseDrafts.filter(
    (item) => item.authorId !== currentUser.id
      && item.status === "Draft"
      && courseAssignments[item.courseId]?.reviewerId === currentUser.id,
  );
  // approvalQueue: peer-reviewed questions the coordinator hasn't authored or peer-reviewed
  const approvalQueue = courseDrafts.filter(
    (item) => item.status === "Reviewed"
      && item.authorId !== currentUser.id
      && item.peerReviewerId !== currentUser.id,
  );
  // Published count from the live list (replaces publishedQuestions prop)
  const publishedByMe = drafts.filter(
    (item) => item.status === "Published" && scopedCourseIds.has(item.courseId),
  );
  const scopedReports = reports.filter(
    (report) =>
      (assignedCourseIds.includes(report.courseDbId) || assignedCourseIds.includes(report.courseId))
      && report.status === "Open",
  );
  function notify(message) {
    setNotice(message);
    window.setTimeout(() => setNotice(""), 3200);
  }

  function resetQuestionForm() {
    setForm({ ...initialQuestion, courseId: authorCourses[0]?.id || "" });
    setEditingQuestion(null);
  }

  async function submitQuestion(event) {
    event.preventDefault();
    const course = authorCourses.find((c) => c.id === form.courseId);
    if (!course) {
      setFormError(t("Choose a course assigned to your account."));
      return;
    }
    if (!course.dbId) {
      setFormError(t("Course data is offline, try again later."));
      return;
    }
    if (!form.topic.trim() || !form.question.trim() || !form.explanation.trim()
      || form.options.some((option) => !option.trim())) {
      setFormError(t("Complete the topic, question, all four options, and explanation."));
      return;
    }
    setSavingQuestion(true);
    setFormError("");
    try {
      await dbSaveQuestion(uiFormToSaveArgs(
        { ...form, dbId: editingQuestion?.dbId ?? null },
        course.dbId,
      ));
      resetQuestionForm();
      setSection(isCoordinator ? "Track overview" : "My questions");
      notify(t(editingQuestion ? "Question updated and returned to Draft." : "Question saved as a draft."));
      if (typeof onDraftsChange === "function") await onDraftsChange();
    } catch (err) {
      setFormError(err.message ?? t("Could not save question. Try again."));
    } finally {
      setSavingQuestion(false);
    }
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
      let successCount = 0;
      const report = await Promise.all(rows.map(async (rawRow, index) => {
        const parsed = validateImportedRow(resolveRow(rawRow), authorCourses);
        if (parsed.errors) {
          return { row: index + 2, status: "Rejected", errors: parsed.errors };
        }
        const course = parsed.course;
        if (!course.dbId) {
          return { row: index + 2, status: "Rejected", errors: ["Course data is offline, try again later."] };
        }
        try {
          await dbSaveQuestion(uiFormToSaveArgs(parsed.question, course.dbId));
          successCount++;
          return { row: index + 2, status: "Imported as draft", errors: [] };
        } catch (err) {
          return { row: index + 2, status: "Rejected", errors: [err.message ?? "Server error"] };
        }
      }));
      setImportReport(report);
      setImportSummary(t("{valid} rows imported as drafts; {invalid} rows need correction.", {
        valid: successCount,
        invalid: report.length - successCount,
      }));
      if (successCount) {
        setSection("Import file");
        if (typeof onDraftsChange === "function") await onDraftsChange();
      }
    } catch (error) {
      setImportSummary(t("Could not read this file: {message}", { message: error.message }));
    } finally {
      event.target.value = "";
    }
  }

  async function markReviewed(question) {
    setReviewingId(question.id);
    try {
      await dbPeerReview({ questionId: question.dbId, action: "pass" });
      notify(t("Question marked as reviewed."));
      if (typeof onDraftsChange === "function") await onDraftsChange();
    } catch (err) {
      notify(err.message ?? t("Could not mark as reviewed."));
    } finally {
      setReviewingId(null);
    }
  }

  async function sendBack(question) {
    const reviewerComment = (reviewComments[question.id] || "").trim();
    if (!reviewerComment) {
      notify(t("Add a reviewer comment before sending the question back."));
      return;
    }
    setReviewingId(question.id);
    try {
      await dbPeerReview({ questionId: question.dbId, action: "send_back", note: reviewerComment });
      setReviewComments((items) => ({ ...items, [question.id]: "" }));
      notify(t("Question sent back to its author."));
      if (typeof onDraftsChange === "function") await onDraftsChange();
    } catch (err) {
      notify(err.message ?? t("Could not send back."));
    } finally {
      setReviewingId(null);
    }
  }

  async function saveCourseAssignment(course) {
    const assignment = assignmentDrafts[course.id] || {};
    if (!assignment.authorId || !assignment.reviewerId) {
      notify(t("Choose both an author and a reviewer before saving this course assignment."));
      return;
    }
    if (assignment.authorId === assignment.reviewerId) {
      notify(t("The author and reviewer must be different people."));
      return;
    }
    if (!course.dbId) {
      notify(t("Course data is offline, try again later."));
      return;
    }
    setSavingAssignment(course.id);
    try {
      await setCourseDuty({ courseId: course.dbId, authorId: assignment.authorId, reviewerId: assignment.reviewerId });
      editedAssignments.current.delete(course.id);
      if (typeof onCourseAssignmentsChange === "function") await onCourseAssignmentsChange();
      notify(t("Course assignment saved."));
    } catch (err) {
      notify(err.message ?? t("Could not save assignment."));
    } finally {
      setSavingAssignment(null);
    }
  }

  function updateAssignment(courseId, role, value) {
    editedAssignments.current.add(courseId);
    setAssignmentDrafts((items) => ({
      ...items,
      [courseId]: { ...items[courseId], [role]: value },
    }));
  }

  async function approveQuestionAction(question) {
    setReviewingId(question.id);
    try {
      await dbApproveQuestion({ questionId: question.dbId, action: "publish" });
      notify(t("Question approved and published."));
      if (typeof onDraftsChange === "function") await onDraftsChange();
    } catch (err) {
      notify(err.message ?? t("Could not publish question."));
    } finally {
      setReviewingId(null);
    }
  }

  async function sendBackApproval(question) {
    const reviewerComment = (reviewComments[question.id] || "").trim();
    if (!reviewerComment) {
      notify(t("Add a comment before sending the question back."));
      return;
    }
    setReviewingId(question.id);
    try {
      await dbApproveQuestion({ questionId: question.dbId, action: "send_back", note: reviewerComment });
      setReviewComments((items) => ({ ...items, [question.id]: "" }));
      notify(t("Question sent back to its author."));
      if (typeof onDraftsChange === "function") await onDraftsChange();
    } catch (err) {
      notify(err.message ?? t("Could not send back."));
    } finally {
      setReviewingId(null);
    }
  }

  function dismissReport(report) {
    const reason = (reportReasons[report.id] || "").trim();
    if (!reason) {
      notify(t("A reason is required when dismissing a report."));
      return;
    }
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

  function showBulkNotice(msg) {
    setBulkNotice(msg);
    window.setTimeout(() => setBulkNotice(""), 6000);
  }

  function buildResultNotice(result, failedItems) {
    let msg = t("{n} done.", { n: result.done });
    if (result.failed?.length) {
      msg += " " + t("{m} skipped:", { m: result.failed.length });
      msg += " " + result.failed.slice(0, 3).map((f) => {
        const q = failedItems.find((q) => q.dbId === f.id);
        return `"${(q?.question ?? f.id).slice(0, 40)}" — ${f.error}`;
      }).join("; ");
    }
    return msg;
  }

  async function runBulkReview(action) {
    const ids    = [...reviewSelected].map((id) => reviewQueue.find((q) => q.id === id)?.dbId).filter(Boolean);
    const note   = action === "send_back" ? sendBackComment.trim() : "";
    if (!ids.length) return;
    setBulkRunning(true);
    setSendBackPanel(null);
    setSendBackComment("");
    try {
      const result = await dbPeerReviewMany({ ids, action, note });
      setReviewSelected(new Set());
      showBulkNotice(buildResultNotice(result, reviewQueue));
      if (typeof onDraftsChange === "function") await onDraftsChange();
    } catch (err) {
      showBulkNotice(err.message ?? t("Bulk action failed."));
    } finally {
      setBulkRunning(false);
    }
  }

  async function runBulkApproval(action) {
    const ids  = [...approvalSelected].map((id) => approvalQueue.find((q) => q.id === id)?.dbId).filter(Boolean);
    const note = action === "send_back" ? sendBackComment.trim() : "";
    if (!ids.length) return;
    setBulkRunning(true);
    setSendBackPanel(null);
    setSendBackComment("");
    setPublishConfirm(false);
    try {
      const result = await dbApproveMany({ ids, action, note });
      setApprovalSelected(new Set());
      showBulkNotice(buildResultNotice(result, approvalQueue));
      if (typeof onDraftsChange === "function") await onDraftsChange();
    } catch (err) {
      showBulkNotice(err.message ?? t("Bulk action failed."));
    } finally {
      setBulkRunning(false);
    }
  }

  function toggleSelect(set, setSet, id) {
    setSet((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function selectAll(set, setSet, items) {
    if (set.size === items.length) { setSet(new Set()); }
    else { setSet(new Set(items.map((q) => q.id))); }
  }

  function renderSendBackPanel(onConfirm, onCancel) {
    return (
      <div role="dialog" aria-modal="false" aria-label={t("Send back comment")}
        style={{ margin: "12px 0", padding: "16px", border: "1px solid #dde3ec", borderRadius: "10px", background: "#f9fbfe" }}>
        <label style={{ display: "grid", gap: "7px", fontWeight: 600, fontSize: ".85rem", color: "#3d5166" }}>
          {t("Comment for the author (required)")}
          <textarea
            rows="3"
            value={sendBackComment}
            onChange={(e) => setSendBackComment(e.target.value)}
            autoFocus
            style={{ resize: "vertical" }}
            aria-required="true"
          />
        </label>
        <div style={{ display: "flex", gap: "8px", marginTop: "12px" }}>
          <button
            className="instructor-return"
            type="button"
            disabled={!sendBackComment.trim() || bulkRunning}
            onClick={onConfirm}
          >
            {bulkRunning ? t("Sending…") : t("Confirm send back")}
          </button>
          <button className="instructor-secondary" type="button" onClick={onCancel}>
            {t("Cancel")}
          </button>
        </div>
        {!sendBackComment.trim() && (
          <p style={{ color: "#dc3545", fontSize: ".78rem", marginTop: "6px" }}>{t("A comment is required.")}</p>
        )}
      </div>
    );
  }

  function renderBulkBar(selected, items, onSelectAll, buttons) {
    const allSelected = selected.size === items.length && items.length > 0;
    return (
      <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: "10px",
        padding: "10px 14px", marginBottom: "12px", borderRadius: "9px",
        background: selected.size > 0 ? "#e8f0ff" : "#f4f7fb",
        border: "1px solid " + (selected.size > 0 ? "#1675ff" : "#dde3ec") }}>
        <label style={{ display: "flex", alignItems: "center", gap: "8px", fontWeight: 600,
          fontSize: ".85rem", color: "#1a2e44", minHeight: "44px", cursor: "pointer" }}>
          <input
            type="checkbox"
            checked={allSelected}
            onChange={() => onSelectAll()}
            aria-label={allSelected ? t("Deselect all") : t("Select all")}
            style={{ width: "18px", height: "18px", cursor: "pointer" }}
          />
          {selected.size > 0
            ? t("{n} selected", { n: selected.size })
            : t("Select all")}
        </label>
        {selected.size > 0 && buttons.map(({ label, onClick, variant, disabled }) => (
          <button
            key={label}
            type="button"
            className={variant === "danger" ? "instructor-return" : "instructor-secondary"}
            disabled={disabled || bulkRunning}
            onClick={onClick}
            style={{ minHeight: "38px" }}
          >
            {label}
          </button>
        ))}
      </div>
    );
  }

  function renderQuestionForm(questionForm, setQuestionForm, onSubmit, submitLabel) {    return (
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
      publishedCount: publishedByMe.filter((q) => q.courseId === course.id).length,
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
          const eligibleUsers = staffInstructors.length
            ? staffInstructors
            : users.filter((account) =>
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
                  {eligibleUsers.map((account) => <option key={account.id} value={account.id}>{account.full_name ?? account.name}</option>)}
                </select>
              </label>
              <label>{t("Reviewer")}
                <select value={assignment.reviewerId || ""} onChange={(event) => updateAssignment(course.id, "reviewerId", event.target.value)}>
                  <option value="">{t("Choose a reviewer")}</option>
                  {eligibleUsers.map((account) => <option key={account.id} value={account.id}>{account.full_name ?? account.name}</option>)}
                </select>
              </label>
              <button className="instructor-primary" type="button" disabled={savingAssignment === course.id} onClick={() => saveCourseAssignment(course)}>{savingAssignment === course.id ? t("Saving…") : t("Save assignment")}</button>
              {!eligibleUsers.length && <p className="instructor-muted">{t("No instructors found. Ask an administrator to create instructor accounts.")}</p>}
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

        {bulkNotice && (
          <p role="status" aria-live="polite"
            style={{ padding: "10px 14px", marginBottom: "12px", borderRadius: "8px",
              background: "#e4f7ef", color: "#12a06a", fontSize: ".88rem" }}>
            {bulkNotice}
          </p>
        )}

        {approvalQueue.length > 0 && renderBulkBar(
          approvalSelected, approvalQueue,
          () => selectAll(approvalSelected, setApprovalSelected, approvalQueue),
          [
            { label: t("Publish selected"),     onClick: () => setPublishConfirm(true),                                        variant: "default" },
            { label: t("Send back selected"),   onClick: () => { setSendBackPanel("approval"); setSendBackComment(""); },      variant: "danger"  },
          ],
        )}

        {sendBackPanel === "approval" && renderSendBackPanel(
          () => runBulkApproval("send_back"),
          () => setSendBackPanel(null),
        )}

        {publishConfirm && (
          <div role="dialog" aria-modal="false" aria-label={t("Confirm publish")}
            style={{ margin: "12px 0", padding: "16px", border: "1px solid #15a96e", borderRadius: "10px", background: "#e4f7ef" }}>
            <p style={{ margin: "0 0 12px", fontWeight: 600, color: "#1a2e44" }}>
              {t("Publish {n} questions? Students will see them straight away.", { n: approvalSelected.size })}
            </p>
            <div style={{ display: "flex", gap: "8px" }}>
              <button className="instructor-secondary" type="button" disabled={bulkRunning}
                onClick={() => runBulkApproval("publish")}>
                {bulkRunning ? t("Publishing…") : t("Yes, publish")}
              </button>
              <button className="instructor-return" type="button" onClick={() => setPublishConfirm(false)}>{t("Cancel")}</button>
            </div>
          </div>
        )}

        {approvalQueue.length ? approvalQueue.map((question) => (
          <article className="instructor-review-card" key={question.id}
            style={{ borderLeft: approvalSelected.has(question.id) ? "3px solid #1675ff" : undefined }}>
            <label style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px",
              fontSize: ".82rem", fontWeight: 600, color: "#3d5166", cursor: "pointer", minHeight: "44px" }}>
              <input type="checkbox" style={{ width: "17px", height: "17px" }}
                checked={approvalSelected.has(question.id)}
                onChange={() => toggleSelect(approvalSelected, setApprovalSelected, question.id)}
                aria-label={t("Select question: {q}", { q: question.question.slice(0, 40) })}
              />
              {t("Select this question")}
            </label>
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
              <textarea rows="2" value={reviewComments[question.id] || ""}
                onChange={(event) => setReviewComments((current) => ({ ...current, [question.id]: event.target.value }))} />
            </label>
            <div className="instructor-actions">
              <button className="instructor-secondary" type="button" disabled={reviewingId === question.id} onClick={() => approveQuestionAction(question)}>{t("Approve and publish")}</button>
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
        <h2>{t(editingQuestion ? "Edit and resubmit question" : "Add question")}</h2>
        {editingQuestion?.reviewerComment && (
          <div className="instructor-import-summary" style={{ borderColor: "#e8961a", background: "rgba(232,150,26,.08)", color: "#d97706", marginBottom: "14px" }}>
            <strong>{t("Reviewer note:")} </strong>{editingQuestion.reviewerComment}
          </div>
        )}
        {renderQuestionForm(form, setForm, submitQuestion, savingQuestion ? t("Saving…") : t(editingQuestion ? "Save changes" : "Save as draft and send to review"))}
        {editingQuestion && (
          <button className="instructor-secondary" type="button" style={{ marginTop: "10px" }} onClick={() => { resetQuestionForm(); }}>
            {t("Cancel editing")}
          </button>
        )}
      </section>
    );
  }

  function renderImport() {
    return (
      <section className="instructor-panel">
        <h2>{t("Import file")}</h2>
        <p className="instructor-muted">{t("Upload a CSV or Excel workbook (.xlsx or .xls). Columns: course, topic, difficulty (Easy/Medium/Hard), question, optionA, optionB, optionC, optionD, correctAnswer (A-D), explanation.")}</p>
        <p className="instructor-muted">{t("course must match your assigned course name exactly.")}</p>
        <p style={{ marginBottom: "14px" }}>
          <a href="/question-template.csv" download="question-template.csv"
            style={{ color: "#1675ff", fontWeight: 600, fontSize: ".88rem", textDecoration: "underline" }}>
            {t("Download CSV template")}
          </a>
        </p>
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
        {myDrafts.length === 0 ? (
          <p className="instructor-muted">{t("You have not authored any questions yet.")}</p>
        ) : (
          <div className="instructor-table-scroll">
            <table className="instructor-table">
              <thead>
                <tr>
                  <th>{t("Course / topic")}</th>
                  <th>{t("Question")}</th>
                  <th>{t("Difficulty")}</th>
                  <th>{t("Status")}</th>
                  <th>{t("Reviewer note")}</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {myDrafts.map((question) => (
                  <tr key={question.id}>
                    <td>{t(question.course)}<small>{t(question.topic)}</small></td>
                    <td>{question.question}</td>
                    <td>{t(question.difficulty)}</td>
                    <td>
                      <span className={`instructor-status status-${question.status.toLocaleLowerCase().replace(/\s+/g, "-")}`}>
                        {t(question.status)}
                      </span>
                    </td>
                    <td>{question.reviewerComment || "—"}</td>
                    <td>
                      {question.status === "Sent back" && (
                        <button
                          className="instructor-secondary"
                          type="button"
                          style={{ fontSize: ".75rem", padding: "5px 10px", minHeight: "32px" }}
                          onClick={() => {
                            setEditingQuestion({ dbId: question.dbId, reviewerComment: question.reviewerComment });
                            setForm({
                              courseId:    question.courseId,
                              topic:       question.topic,
                              difficulty:  question.difficulty,
                              question:    question.question,
                              options:     question.options,
                              answer:      question.answer,
                              explanation: question.explanation,
                              dbId:        question.dbId,
                            });
                            setSection("Add question");
                          }}
                        >
                          {t("Edit and resubmit")}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    );
  }

  function renderReviewQueue() {
    return (
      <section className="instructor-panel">
        <h2>{t("Review queue")}</h2>

        {bulkNotice && (
          <p role="status" aria-live="polite"
            style={{ padding: "10px 14px", marginBottom: "12px", borderRadius: "8px",
              background: "#e4f7ef", color: "#12a06a", fontSize: ".88rem" }}>
            {bulkNotice}
          </p>
        )}

        {reviewQueue.length > 0 && renderBulkBar(
          reviewSelected, reviewQueue,
          () => selectAll(reviewSelected, setReviewSelected, reviewQueue),
          [
            { label: t("Pass selected"),        onClick: () => runBulkReview("pass"),                                          variant: "default" },
            { label: t("Send back selected"),   onClick: () => { setSendBackPanel("review"); setSendBackComment(""); },        variant: "danger"  },
          ],
        )}

        {sendBackPanel === "review" && renderSendBackPanel(
          () => runBulkReview("send_back"),
          () => setSendBackPanel(null),
        )}

        {reviewQueue.length ? reviewQueue.map((question) => (
          <article className="instructor-review-card" key={question.id}
            style={{ borderLeft: reviewSelected.has(question.id) ? "3px solid #1675ff" : undefined }}>
            <label style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px",
              fontSize: ".82rem", fontWeight: 600, color: "#3d5166", cursor: "pointer", minHeight: "44px" }}>
              <input type="checkbox" style={{ width: "17px", height: "17px" }}
                checked={reviewSelected.has(question.id)}
                onChange={() => toggleSelect(reviewSelected, setReviewSelected, question.id)}
                aria-label={t("Select question: {q}", { q: question.question.slice(0, 40) })}
              />
              {t("Select this question")}
            </label>
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
              <textarea rows="2" value={reviewComments[question.id] || ""}
                onChange={(event) => setReviewComments((current) => ({ ...current, [question.id]: event.target.value }))} />
            </label>
            <div className="instructor-actions">
              <button className="instructor-secondary" type="button" disabled={reviewingId === question.id} onClick={() => markReviewed(question)}>{t("Mark reviewed")}</button>
              <button className="instructor-return" type="button" disabled={reviewingId === question.id} onClick={() => sendBack(question)}>{t("Send back")}</button>
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
    return <AnnouncementManager />;
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
    "Announcements":           renderAnnouncements,
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
            {/* Notification bell — from DB */}
            <div className="instructor-bell-wrap">
              <button
                className="instructor-bell-btn"
                type="button"
                aria-label={t("Notifications")}
                aria-expanded={bellOpen}
                onClick={() => setBellOpen((o) => !o)}
              >
                <Icon name="bell" size={20} />
                {notifications.length > 0 && (
                  <span className="instructor-bell-count">{notifications.length}</span>
                )}
              </button>
              {bellOpen && (
                <div className="instructor-bell-dropdown" role="dialog" aria-label={t("Notifications")}>
                  {notifications.length === 0 ? (
                    <p className="instructor-muted">{t("No new notifications.")}</p>
                  ) : (
                    notifications.map((n) => (
                      <button
                        key={n.id}
                        className="instructor-bell-item"
                        type="button"
                        onClick={() => {
                          onMarkNotificationRead?.(n.id);
                          setBellOpen(false);
                          // Route to the right section based on notification type
                          if (n.type === "report_new" || n.type === "report_resolved" || n.type === "report_dismissed") {
                            setSection("Student reports");
                          } else if (n.type === "question_sent_back") {
                            setSection("My questions");
                          } else if (n.type === "approval_needed") {
                            setSection("Approvals");
                          } else if (n.type === "review_needed") {
                            setSection("Review queue");
                          } else if (n.type === "question_published") {
                            setSection("My questions");
                          } else {
                            setSection("Today");
                          }
                        }}
                      >
                        <strong>{n.title}</strong>
                        <span>{new Intl.DateTimeFormat(undefined, { dateStyle: "short", timeStyle: "short" }).format(new Date(n.created_at))}</span>
                      </button>
                    ))
                  )}
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
