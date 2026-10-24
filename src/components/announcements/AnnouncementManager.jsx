/**
 * AnnouncementManager.jsx
 * Shared component used by admin, instructor and coordinator.
 * Loads its own data — no props needed.
 */

import { useCallback, useEffect, useState } from "react";
import { useLanguage } from "../../i18n/LanguageContext.jsx";
import {
  getAnnouncementTargets,
  createAnnouncement,
  manageAnnouncements,
  deleteAnnouncement,
} from "../../lib/supabase.js";

const SHOW_FOR_OPTIONS = [
  { label: "7 days",            value: "7"       },
  { label: "30 days",           value: "30"      },
  { label: "Until I delete it", value: "forever" },
];

function endsAtFrom(showFor) {
  if (showFor === "forever") return null;
  const days = parseInt(showFor, 10);
  return new Date(Date.now() + days * 86_400_000).toISOString();
}

function targetValueFor(kind, id) {
  return `${kind}:${id}`;
}

function parseTarget(value) {
  // '' = everyone, 'node:uuid', 'course:uuid'
  if (!value) return { nodeId: null, courseId: null };
  const [kind, id] = value.split(":");
  return kind === "node"
    ? { nodeId: id, courseId: null }
    : { nodeId: null, courseId: id };
}

function formatDate(iso) {
  if (!iso) return "—";
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" })
    .format(new Date(iso));
}

function roleLabelText(role) {
  const map = { admin: "Admin", coordinator: "Coordinator", instructor: "Instructor" };
  return map[role] ?? role;
}

export default function AnnouncementManager({ role = "instructor" }) {
  const { t } = useLanguage();
  const isAdmin = role === "admin";

  // ── data ──────────────────────────────────────────────────────────────────
  const [targets,  setTargets]  = useState([]);
  const [list,     setList]     = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [loadErr,  setLoadErr]  = useState(null);

  // ── form ──────────────────────────────────────────────────────────────────
  const [title,     setTitle]     = useState("");
  const [body,      setBody]      = useState("");
  const [target,    setTarget]    = useState("");       // '' = everyone
  const [showFor,   setShowFor]   = useState("30");
  const [important, setImportant] = useState(false);
  const [sending,   setSending]   = useState(false);
  const [sendMsg,   setSendMsg]   = useState(null);    // { ok: bool, text: string }

  // ── delete confirm ────────────────────────────────────────────────────────
  const [confirmId, setConfirmId] = useState(null);    // id waiting for confirm

  // ── loaders ───────────────────────────────────────────────────────────────
  // silent = true reloads the list without replacing the form with a loading line
  const loadAll = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setLoadErr(null);
    try {
      const [tg, ls] = await Promise.all([
        getAnnouncementTargets(),
        manageAnnouncements(50),
      ]);
      setTargets(tg);
      setList(ls);
    } catch (err) {
      setLoadErr(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  // ── grouped target options ────────────────────────────────────────────────
  // Only admins may send to everyone. Everyone else starts on their first allowed audience.
  const defaultTarget = isAdmin || targets.length === 0 ? "" : targetValueFor(targets[0].kind, targets[0].id);
  const effectiveTarget = target || defaultTarget;
  const nodeTargets   = targets.filter((tg) => tg.kind === "node");
  const courseTargets = targets.filter((tg) => tg.kind === "course");

  // ── submit ────────────────────────────────────────────────────────────────
  async function handleSend(e) {
    e.preventDefault();
    if (!title.trim() || !body.trim() || (!isAdmin && !effectiveTarget)) return;
    setSending(true);
    setSendMsg(null);
    try {
      const { nodeId, courseId } = parseTarget(effectiveTarget);
      const result = await createAnnouncement({
        title:     title.trim(),
        body:      body.trim(),
        nodeId,
        courseId,
        important,
        endsAt:    endsAtFrom(showFor),
      });
      const reach = result?.reach ?? 0;
      setSendMsg({
        ok:   true,
        text: reach === 0
          ? t("Saved, but no students match this audience yet.")
          : t("Sent to {n} students.", { n: reach }),
      });
      setTitle(""); setBody(""); setTarget(""); setShowFor("30"); setImportant(false);
      await loadAll(true);
    } catch (err) {
      setSendMsg({ ok: false, text: err.message });
    } finally {
      setSending(false);
    }
  }

  // ── delete ────────────────────────────────────────────────────────────────
  async function handleDelete(id) {
    try {
      await deleteAnnouncement(id);
      setConfirmId(null);
      await loadAll(true);
    } catch (err) {
      setSendMsg({ ok: false, text: err.message });
      setConfirmId(null);
    }
  }

  // ── render ────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <p role="status" aria-live="polite" className="instructor-muted">
        {t("Loading announcements...")}
      </p>
    );
  }

  if (loadErr) {
    return (
      <div role="alert" aria-live="assertive">
        <p className="instructor-error">{loadErr}</p>
        <button className="instructor-secondary" type="button" onClick={() => loadAll()}
          style={{ marginTop: "8px" }}>{t("Retry")}</button>
      </div>
    );
  }

  const noTargets = targets.length === 0;

  return (
    <section className="instructor-panel">
      <h2>{t("Announcements")}</h2>

      {/* ── Result message ── */}
      {sendMsg && (
        <p role="status" aria-live="polite"
          className={sendMsg.ok ? "instructor-import-summary" : "instructor-error"}
          style={{ marginBottom: "16px" }}>
          {sendMsg.text}
        </p>
      )}

      {/* ── Form ── */}
      <form className="instructor-announcement-form" onSubmit={handleSend}
        style={{ display: "grid", gap: "14px", maxWidth: "680px", marginBottom: "32px" }}>

        <label style={{ display: "grid", gap: "6px", fontWeight: 600, fontSize: ".82rem", color: "#3d5166" }}>
          {t("Title")}
          <input
            type="text"
            maxLength={120}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={t("Announcement title")}
            required
            style={{ minHeight: "40px", padding: "8px 12px", border: "1px solid #dde3ec",
              borderRadius: "8px", background: "#f9fbfe", fontSize: ".9rem" }}
          />
          <small style={{ color: "#7a8fa0" }}>{title.length} / 120</small>
        </label>

        <label style={{ display: "grid", gap: "6px", fontWeight: 600, fontSize: ".82rem", color: "#3d5166" }}>
          {t("Message")}
          <textarea
            maxLength={500}
            rows={4}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder={t("Write your message here...")}
            required
            style={{ resize: "vertical", padding: "8px 12px", border: "1px solid #dde3ec",
              borderRadius: "8px", background: "#f9fbfe", fontSize: ".9rem" }}
          />
          <small style={{ color: "#7a8fa0" }}>{body.length} / 500</small>
        </label>

        <label style={{ display: "grid", gap: "6px", fontWeight: 600, fontSize: ".82rem", color: "#3d5166" }}>
          {t("Send to")}
          <select
            value={effectiveTarget}
            onChange={(e) => setTarget(e.target.value)}
            disabled={noTargets}
            style={{ minHeight: "40px", padding: "8px 12px", border: "1px solid #dde3ec",
              borderRadius: "8px", background: "#f9fbfe", fontSize: ".9rem" }}
          >
            {isAdmin && <option value="">{t("Everyone (all students)")}</option>}
            {nodeTargets.length > 0 && (
              <optgroup label={t("Programs")}>
                {nodeTargets.map((tg) => (
                  <option key={tg.id} value={targetValueFor("node", tg.id)}>
                    {tg.path || tg.name}
                  </option>
                ))}
              </optgroup>
            )}
            {courseTargets.length > 0 && (
              <optgroup label={t("Courses")}>
                {courseTargets.map((tg) => (
                  <option key={tg.id} value={targetValueFor("course", tg.id)}>
                    {tg.name}
                  </option>
                ))}
              </optgroup>
            )}
          </select>
          {noTargets && (
            <small style={{ color: "#dc3545" }}>
              {t("You have no courses or programs to send to yet.")}
            </small>
          )}
        </label>

        <label style={{ display: "grid", gap: "6px", fontWeight: 600, fontSize: ".82rem", color: "#3d5166" }}>
          {t("Show for")}
          <select
            value={showFor}
            onChange={(e) => setShowFor(e.target.value)}
            style={{ minHeight: "40px", padding: "8px 12px", border: "1px solid #dde3ec",
              borderRadius: "8px", background: "#f9fbfe", fontSize: ".9rem" }}
          >
            {SHOW_FOR_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{t(o.label)}</option>
            ))}
          </select>
        </label>

        <label style={{ display: "flex", alignItems: "center", gap: "10px", cursor: "pointer",
          fontWeight: 600, fontSize: ".85rem", color: "#3d5166", minHeight: "44px" }}>
          <input
            type="checkbox"
            checked={important}
            onChange={(e) => setImportant(e.target.checked)}
            style={{ width: "18px", height: "18px" }}
          />
          {t("Also send a bell alert to these students")}
        </label>
        <small style={{ color: "#7a8fa0", marginTop: "-10px" }}>
          {t("Use this only for important news.")}
        </small>

        <button
          type="submit"
          className="instructor-primary"
          disabled={sending || !title.trim() || !body.trim() || (!isAdmin && !effectiveTarget)}
          style={{ minHeight: "42px", justifySelf: "start" }}
        >
          {sending ? t("Sending…") : t("Send announcement")}
        </button>
      </form>

      {/* ── List ── */}
      <h3 style={{ margin: "0 0 12px", fontSize: "1rem", fontWeight: 700, color: "#1a2e44" }}>
        {t("Sent announcements")}
      </h3>

      {list.length === 0 ? (
        <p className="instructor-muted">{t("No announcements yet.")}</p>
      ) : (
        list.map((item) => (
          <article key={item.id} className="instructor-report-card"
            style={{ marginBottom: "12px", padding: "16px 18px" }}>
            {/* Confirm delete panel */}
            {confirmId === item.id && (
              <div role="dialog" aria-modal="false" aria-label={t("Confirm delete")}
                style={{ padding: "12px 0 14px", borderBottom: "1px solid #dde3ec", marginBottom: "12px" }}>
                <p style={{ fontWeight: 600, margin: "0 0 10px", color: "#dc3545" }}>
                  {t("Are you sure you want to delete this announcement?")}
                </p>
                <div style={{ display: "flex", gap: "8px" }}>
                  <button className="instructor-return" type="button"
                    onClick={() => handleDelete(item.id)}>
                    {t("Delete")}
                  </button>
                  <button className="instructor-secondary" type="button"
                    onClick={() => setConfirmId(null)}>
                    {t("Cancel")}
                  </button>
                </div>
              </div>
            )}

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "10px" }}>
              <div>
                <strong style={{ fontSize: ".95rem", color: "#1a2e44" }}>{item.title}</strong>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginTop: "6px" }}>
                  {item.important && (
                    <span style={{ padding: "2px 8px", borderRadius: "99px",
                      background: "#fff0f0", color: "#dc3545", fontSize: ".7rem", fontWeight: 700,
                      border: "1px solid #ffc0c0" }}>
                      ⚡ {t("Important")}
                    </span>
                  )}
                  <span style={{ padding: "2px 8px", borderRadius: "99px",
                    background: item.active ? "#e4f7ef" : "#f0f3f7",
                    color: item.active ? "#12a06a" : "#6b7a8d",
                    fontSize: ".7rem", fontWeight: 700 }}>
                    {t(item.active ? "Active" : "Ended")}
                  </span>
                  <span style={{ padding: "2px 8px", borderRadius: "99px",
                    background: "#e8f0ff", color: "#1675ff", fontSize: ".7rem", fontWeight: 600 }}>
                    {item.target_label}
                  </span>
                </div>
              </div>
              {(item.mine || isAdmin) && (
                <button className="instructor-return" type="button"
                  style={{ minHeight: "34px", padding: "5px 12px", fontSize: ".78rem", flexShrink: 0 }}
                  onClick={() => setConfirmId(item.id)}>
                  {t("Delete")}
                </button>
              )}
            </div>

            <p style={{ margin: "10px 0 6px", color: "#3d5166", fontSize: ".88rem", lineHeight: 1.6 }}>
              {item.body}
            </p>
            <small style={{ color: "#7a8fa0", fontSize: ".76rem" }}>
              {item.author_name} · {t(roleLabelText(item.author_role))} · {formatDate(item.created_at)}
              {item.reach != null && ` · ${t("Reached {n} students", { n: item.reach })}`}
            </small>
          </article>
        ))
      )}
    </section>
  );
}
