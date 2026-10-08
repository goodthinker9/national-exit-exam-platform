import { useMemo, useState } from "react";
import { useLanguage } from "../../i18n/LanguageContext.jsx";
import LanguageSwitcher from "../../i18n/LanguageSwitcher.jsx";
import "./AdminQuestionsPage.css";

const PAGE_SIZE = 5;
const difficulties = ["Easy", "Medium", "Hard"];
const emptyQuestion = {
  question: "",
  subject: "",
  topic: "",
  difficulty: "Easy",
  options: ["", "", "", ""],
  answer: 0,
  explanation: "",
};

function getUniqueValues(items, property) {
  return [...new Set(items.map((item) => item[property]).filter(Boolean))].sort();
}

export default function AdminQuestionsPage({ questions, onSave, onDelete, onBack, onLogout }) {
  const { t } = useLanguage();
  const [search, setSearch] = useState("");
  const [subjectFilter, setSubjectFilter] = useState("");
  const [topicFilter, setTopicFilter] = useState("");
  const [difficultyFilter, setDifficultyFilter] = useState("");
  const [page, setPage] = useState(1);
  const [editingQuestion, setEditingQuestion] = useState(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState(null);
  const [form, setForm] = useState(emptyQuestion);
  const [formError, setFormError] = useState("");
  const [notice, setNotice] = useState("");

  const subjects = useMemo(() => getUniqueValues(questions, "subject"), [questions]);
  const topics = useMemo(
    () => getUniqueValues(questions.filter((question) => !subjectFilter || question.subject === subjectFilter), "topic"),
    [questions, subjectFilter],
  );
  const filteredQuestions = useMemo(() => {
    const normalizedSearch = search.trim().toLocaleLowerCase();
    return questions.filter((question) => {
      const matchesSearch = !normalizedSearch || [
        question.id,
        question.question,
        question.subject,
        question.topic,
      ].some((value) => String(value || "").toLocaleLowerCase().includes(normalizedSearch));
      return matchesSearch
        && (!subjectFilter || question.subject === subjectFilter)
        && (!topicFilter || question.topic === topicFilter)
        && (!difficultyFilter || question.difficulty === difficultyFilter);
    });
  }, [questions, search, subjectFilter, topicFilter, difficultyFilter]);
  const pageCount = Math.max(1, Math.ceil(filteredQuestions.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const visibleQuestions = filteredQuestions.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE,
  );
  const pages = Array.from({ length: pageCount }, (_, index) => index + 1);

  function openAddForm() {
    setEditingQuestion(null);
    setForm({ ...emptyQuestion, options: [...emptyQuestion.options] });
    setFormError("");
    setIsFormOpen(true);
  }

  function openEditForm(question) {
    setEditingQuestion(question);
    setForm({
      ...question,
      options: [...question.options],
    });
    setFormError("");
    setIsFormOpen(true);
  }

  function closeForm() {
    setEditingQuestion(null);
    setIsFormOpen(false);
  }

  function updateOption(index, value) {
    setForm((previous) => ({
      ...previous,
      options: previous.options.map((option, optionIndex) => optionIndex === index ? value : option),
    }));
  }

  function handleSubmit(event) {
    event.preventDefault();
    const cleaned = {
      ...form,
      question: form.question.trim(),
      subject: form.subject.trim(),
      topic: form.topic.trim(),
      options: form.options.map((option) => option.trim()),
      explanation: form.explanation.trim(),
    };
    if (!cleaned.question || !cleaned.subject || !cleaned.topic
      || cleaned.options.some((option) => !option) || !cleaned.explanation) {
      setFormError(t("Complete all question fields before saving."));
      return;
    }
    onSave(cleaned);
    setPage(1);
    setNotice(t(editingQuestion ? "Question updated." : "Question added."));
    setFormError("");
    closeForm();
  }

  function confirmDelete() {
    onDelete(pendingDelete.id);
    setNotice(t("Question deleted."));
    setPendingDelete(null);
  }

  function changeSubject(value) {
    setSubjectFilter(value);
    setTopicFilter("");
    setPage(1);
  }

  return (
    <main className="admin-questions-page">
      <header className="question-admin-topbar">
        <button className="question-admin-brand" type="button" onClick={onBack}>
          <span aria-hidden="true">✦</span> ExitPrep
        </button>
        <div className="question-admin-actions">
          <LanguageSwitcher />
          <span className="question-admin-avatar" aria-hidden="true">A</span>
          <button className="question-admin-user" type="button" onClick={onLogout}>
            {t("Admin")} <span aria-hidden="true">⌄</span>
          </button>
        </div>
      </header>

      <div className="question-admin-content">
        <div className="question-admin-heading">
          <div>
            <button className="question-admin-back" type="button" onClick={onBack}>
              ← {t("Admin dashboard")}
            </button>
            <p className="question-admin-eyebrow">{t("ADMINISTRATION")}</p>
            <h1>{t("Manage Questions")}</h1>
          </div>
          <button className="question-add-button" type="button" onClick={openAddForm}>
            <span aria-hidden="true">＋</span> {t("Add Question")}
          </button>
        </div>

        <section className="question-admin-panel" aria-label={t("Manage Questions")}>
          <div className="question-filters">
            <label className="question-search">
              <span aria-hidden="true">⌕</span>
              <input
                type="search"
                value={search}
                onChange={(event) => { setSearch(event.target.value); setPage(1); }}
                placeholder={t("Search questions...")}
                aria-label={t("Search questions...")}
              />
            </label>
            <label>
              <span className="sr-only">{t("Filter by subject")}</span>
              <select value={subjectFilter} onChange={(event) => changeSubject(event.target.value)}>
                <option value="">{t("All Subjects")}</option>
                {subjects.map((subject) => <option key={subject} value={subject}>{t(subject)}</option>)}
              </select>
            </label>
            <label>
              <span className="sr-only">{t("Filter by topic")}</span>
              <select value={topicFilter} onChange={(event) => { setTopicFilter(event.target.value); setPage(1); }}>
                <option value="">{t("All Topics")}</option>
                {topics.map((topic) => <option key={topic} value={topic}>{t(topic)}</option>)}
              </select>
            </label>
            <label>
              <span className="sr-only">{t("Filter by difficulty")}</span>
              <select value={difficultyFilter} onChange={(event) => { setDifficultyFilter(event.target.value); setPage(1); }}>
                <option value="">{t("All Difficulty")}</option>
                {difficulties.map((difficulty) => <option key={difficulty} value={difficulty}>{t(difficulty)}</option>)}
              </select>
            </label>
          </div>

          <div className="question-table-scroll">
            <table className="question-management-table">
              <thead><tr>
                <th>{t("ID")}</th>
                <th>{t("Question")}</th>
                <th>{t("Subject")}</th>
                <th>{t("Topic")}</th>
                <th>{t("Difficulty")}</th>
                <th>{t("Actions")}</th>
              </tr></thead>
              <tbody>
                {visibleQuestions.map((question) => (
                  <tr key={question.id}>
                    <td className="question-id">Q{question.id}</td>
                    <td className="question-text" title={t(question.question)}>{t(question.question)}</td>
                    <td>{t(question.subject)}</td>
                    <td>{t(question.topic)}</td>
                    <td><span className={`admin-difficulty ${question.difficulty.toLowerCase()}`}>{t(question.difficulty)}</span></td>
                    <td>
                      <div className="question-row-actions">
                        <button
                          className="question-edit-action"
                          type="button"
                          aria-label={t("Edit question {id}", { id: question.id })}
                          onClick={() => openEditForm(question)}
                        >✎</button>
                        <button
                          className="question-delete-action"
                          type="button"
                          aria-label={t("Delete question {id}", { id: question.id })}
                          onClick={() => setPendingDelete(question)}
                        >▣</button>
                      </div>
                    </td>
                  </tr>
                ))}
                {!visibleQuestions.length && (
                  <tr><td className="question-empty" colSpan="6">{t("No questions match these filters.")}</td></tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="question-table-footer">
            <span>{t("Showing {start}–{end} of {total} questions", {
              start: filteredQuestions.length ? (currentPage - 1) * PAGE_SIZE + 1 : 0,
              end: Math.min(currentPage * PAGE_SIZE, filteredQuestions.length),
              total: filteredQuestions.length,
            })}</span>
            <nav className="question-pagination" aria-label={t("Question pages")}>
              <button type="button" aria-label={t("Previous page")} disabled={currentPage === 1} onClick={() => setPage(currentPage - 1)}>‹</button>
              {pages.map((pageNumber) => (
                <button
                  type="button"
                  key={pageNumber}
                  className={pageNumber === currentPage ? "active" : ""}
                  aria-current={pageNumber === currentPage ? "page" : undefined}
                  aria-label={t("Page {number}", { number: pageNumber })}
                  onClick={() => setPage(pageNumber)}
                >{pageNumber}</button>
              ))}
              <button type="button" aria-label={t("Next page")} disabled={currentPage === pageCount} onClick={() => setPage(currentPage + 1)}>›</button>
            </nav>
          </div>
        </section>
        <p className="question-admin-demo-note">{t("Changes to this question bank also affect new practice quizzes.")}</p>
        {notice && <p className="question-admin-notice" role="status">{notice}</p>}
      </div>

      {isFormOpen && (
        <div className="question-modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) closeForm(); }}>
          <section className="question-modal" role="dialog" aria-modal="true" aria-labelledby="question-modal-title">
            <div className="question-modal-heading">
              <div>
                <p className="question-admin-eyebrow">{t("QUESTION BANK")}</p>
                <h2 id="question-modal-title">{t(editingQuestion ? "Edit Question" : "Add Question")}</h2>
              </div>
              <button type="button" className="question-modal-close" aria-label={t("Close")} onClick={closeForm}>×</button>
            </div>
            <form onSubmit={handleSubmit}>
              <label className="question-form-wide">
                {t("Question text")}
                <textarea required rows="2" value={form.question} onChange={(event) => setForm({ ...form, question: event.target.value })} />
              </label>
              {formError && <p className="question-form-error" role="alert">{formError}</p>}
              <div className="question-form-meta">
                <label>{t("Subject")}
                  <input required list="question-subject-options" value={form.subject} onChange={(event) => setForm({ ...form, subject: event.target.value })} />
                  <datalist id="question-subject-options">{subjects.map((subject) => <option key={subject} value={subject} />)}</datalist>
                </label>
                <label>{t("Topic")}
                  <input required list="question-topic-options" value={form.topic} onChange={(event) => setForm({ ...form, topic: event.target.value })} />
                  <datalist id="question-topic-options">{topics.map((topic) => <option key={topic} value={topic} />)}</datalist>
                </label>
                <label>{t("Difficulty")}
                  <select value={form.difficulty} onChange={(event) => setForm({ ...form, difficulty: event.target.value })}>
                    {difficulties.map((difficulty) => <option key={difficulty} value={difficulty}>{t(difficulty)}</option>)}
                  </select>
                </label>
              </div>
              <fieldset className="question-options-fieldset">
                <legend>{t("Answer options")} <span>{t("Select the correct answer")}</span></legend>
                <div className="question-option-grid">
                  {form.options.map((option, index) => (
                    <label className="question-option-field" key={index}>
                      <span className="question-option-letter">{String.fromCharCode(65 + index)}</span>
                      <input
                        required
                        value={option}
                        aria-label={t("Option {number}", { number: index + 1 })}
                        onChange={(event) => updateOption(index, event.target.value)}
                      />
                      <input
                        className="question-correct-radio"
                        type="radio"
                        name="correct-answer"
                        checked={form.answer === index}
                        onChange={() => setForm({ ...form, answer: index })}
                        aria-label={t("Mark option {number} as correct", { number: index + 1 })}
                      />
                    </label>
                  ))}
                </div>
              </fieldset>
              <label className="question-form-wide">
                {t("Explanation")}
                <textarea required rows="2" value={form.explanation} onChange={(event) => setForm({ ...form, explanation: event.target.value })} />
              </label>
              <div className="question-modal-actions">
                <button className="question-cancel-button" type="button" onClick={closeForm}>{t("Cancel")}</button>
                <button className="question-save-button" type="submit">{t(editingQuestion ? "Save changes" : "Add Question")}</button>
              </div>
            </form>
          </section>
        </div>
      )}

      {pendingDelete && (
        <div className="question-modal-backdrop">
          <section className="question-confirm-modal" role="alertdialog" aria-modal="true" aria-labelledby="delete-question-title">
            <h2 id="delete-question-title">{t("Delete this question?")}</h2>
            <p>{t("This will remove question {id} from the bank and future practice quizzes.", { id: pendingDelete.id })}</p>
            <div className="question-modal-actions">
              <button className="question-cancel-button" type="button" onClick={() => setPendingDelete(null)}>{t("Cancel")}</button>
              <button className="question-delete-confirm" type="button" onClick={confirmDelete}>{t("Delete question")}</button>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}
