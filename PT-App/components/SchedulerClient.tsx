"use client";
import { useState, useEffect } from "react";
import { getItem, setItem } from "@/lib/store";
import type { ScheduledPost, ContentPiece } from "@/lib/store";

function makeId() {
  return Math.random().toString(36).slice(2, 10);
}

const PLATFORMS = [
  { id: "youtube", label: "YouTube", color: "#ff0000" },
  { id: "instagram", label: "Instagram", color: "#e1306c" },
  { id: "tiktok", label: "TikTok", color: "#69c9d0" },
  { id: "twitter", label: "Twitter / X", color: "#1d9bf0" },
  { id: "facebook", label: "Facebook", color: "#1877f2" },
];

const PLATFORM_COLORS: Record<string, string> = {
  youtube: "#ff0000",
  instagram: "#e1306c",
  tiktok: "#69c9d0",
  twitter: "#1d9bf0",
  facebook: "#1877f2",
};

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];

function emptyPost(today: string): Omit<ScheduledPost, "id"> {
  return { contentId: "", title: "", platform: "youtube", scheduledDate: today, caption: "", hashtags: [], status: "draft", views: 0 };
}

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfMonth(year: number, month: number) {
  return new Date(year, month, 1).getDay();
}

export default function SchedulerClient() {
  const today = new Date().toISOString().split("T")[0];
  const now = new Date();

  const [posts, setPosts] = useState<ScheduledPost[]>([]);
  const [pieces, setPieces] = useState<ContentPiece[]>([]);
  const [calYear, setCalYear] = useState(now.getFullYear());
  const [calMonth, setCalMonth] = useState(now.getMonth());
  const [platformFilter, setPlatformFilter] = useState("all");
  const [showAdd, setShowAdd] = useState(false);
  const [selected, setSelected] = useState<ScheduledPost | null>(null);
  const [form, setForm] = useState(emptyPost(today));

  useEffect(() => {
    setPosts(getItem<ScheduledPost[]>("scheduled_posts", []));
    setPieces(getItem<ContentPiece[]>("content_pieces", []));
  }, []);

  function save(updated: ScheduledPost[]) {
    setPosts(updated);
    setItem("scheduled_posts", updated);
  }

  function addPost() {
    if (!form.title || !form.scheduledDate) return;
    const post: ScheduledPost = { ...form, id: makeId() };
    save([...posts, post]);
    setForm(emptyPost(today));
    setShowAdd(false);
  }

  function updatePostStatus(id: string, status: ScheduledPost["status"]) {
    save(posts.map((p) => (p.id === id ? { ...p, status } : p)));
    if (selected?.id === id) setSelected((s) => s ? { ...s, status } : s);
  }

  function updatePostViews(id: string, views: number) {
    save(posts.map((p) => (p.id === id ? { ...p, views } : p)));
    if (selected?.id === id) setSelected((s) => s ? { ...s, views } : s);
  }

  function deletePost(id: string) {
    save(posts.filter((p) => p.id !== id));
    setSelected(null);
  }

  const filteredPosts = platformFilter === "all" ? posts : posts.filter((p) => p.platform === platformFilter);

  // Calendar data
  const daysInMonth = getDaysInMonth(calYear, calMonth);
  const firstDay = getFirstDayOfMonth(calYear, calMonth);
  const calendarCells: (number | null)[] = [
    ...Array(firstDay).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  function postsOnDay(day: number) {
    const dateStr = `${calYear}-${String(calMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    return filteredPosts.filter((p) => p.scheduledDate === dateStr);
  }

  function prevMonth() {
    if (calMonth === 0) { setCalYear(calYear - 1); setCalMonth(11); }
    else setCalMonth(calMonth - 1);
  }
  function nextMonth() {
    if (calMonth === 11) { setCalYear(calYear + 1); setCalMonth(0); }
    else setCalMonth(calMonth + 1);
  }

  const upcoming = [...filteredPosts]
    .filter((p) => p.scheduledDate >= today && p.status !== "posted")
    .sort((a, b) => a.scheduledDate.localeCompare(b.scheduledDate))
    .slice(0, 10);

  const totalPostedViews = posts.filter((p) => p.status === "posted").reduce((s, p) => s + (p.views || 0), 0);
  const totalRevenue = totalPostedViews * 0.002;

  return (
    <div style={{ padding: "2rem", maxWidth: "1200px" }}>
      {/* Header */}
      <div style={{ marginBottom: "1.5rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "0.4rem" }}>
          <span style={{ fontSize: "2rem" }}>📅</span>
          <div>
            <h1 style={{ fontSize: "1.8rem", fontWeight: 900, letterSpacing: "-0.03em", lineHeight: 1 }}>
              <span style={{ color: "#22c55e" }}>Faceless AI</span> · Scheduler
            </h1>
            <p style={{ color: "#666", fontSize: "0.82rem", marginTop: "0.2rem" }}>
              Plan your publish queue across all platforms
            </p>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: "1rem", marginBottom: "1.75rem" }}>
        {[
          { label: "Total Scheduled", value: posts.filter((p) => p.status === "scheduled").length, color: "#22c55e", icon: "📅" },
          { label: "Drafts", value: posts.filter((p) => p.status === "draft").length, color: "#6b7280", icon: "📝" },
          { label: "Posted", value: posts.filter((p) => p.status === "posted").length, color: "#10b981", icon: "🚀" },
          { label: "Total Views", value: totalPostedViews.toLocaleString(), color: "#f59e0b", icon: "👀" },
          { label: "Revenue", value: `$${totalRevenue.toFixed(0)}`, color: "#22c55e", icon: "💵" },
        ].map((s) => (
          <div key={s.label} className="stat-card">
            <span style={{ fontSize: "1.2rem" }}>{s.icon}</span>
            <div style={{ fontSize: "1.5rem", fontWeight: 900, color: s.color, lineHeight: 1.1 }}>{s.value}</div>
            <div style={{ fontSize: "0.72rem", color: "#666" }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Platform filter + Add button */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.25rem", flexWrap: "wrap", gap: "0.75rem" }}>
        <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap" }}>
          <button
            onClick={() => setPlatformFilter("all")}
            style={{ padding: "0.3rem 0.75rem", borderRadius: "999px", fontSize: "0.78rem", fontWeight: 600, cursor: "pointer", border: platformFilter === "all" ? "1px solid rgba(34,197,94,0.4)" : "1px solid #2a2a2a", background: platformFilter === "all" ? "rgba(34,197,94,0.08)" : "transparent", color: platformFilter === "all" ? "#22c55e" : "#666" }}
          >
            All Platforms
          </button>
          {PLATFORMS.map((p) => (
            <button
              key={p.id}
              onClick={() => setPlatformFilter(p.id)}
              style={{ padding: "0.3rem 0.75rem", borderRadius: "999px", fontSize: "0.78rem", fontWeight: 600, cursor: "pointer", border: platformFilter === p.id ? `1px solid ${p.color}` : "1px solid #2a2a2a", background: platformFilter === p.id ? `${p.color}22` : "transparent", color: platformFilter === p.id ? p.color : "#666" }}
            >
              {p.label}
            </button>
          ))}
        </div>
        <button className="btn-primary" onClick={() => setShowAdd(true)} style={{ fontSize: "0.85rem" }}>
          + Schedule Post
        </button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: "1.5rem", alignItems: "start" }}>
        {/* Calendar */}
        <div className="card">
          {/* Month nav */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.25rem" }}>
            <button onClick={prevMonth} style={{ background: "#1a1a1a", border: "1px solid #2a2a2a", color: "#f0f0f0", padding: "0.35rem 0.7rem", borderRadius: "8px", cursor: "pointer", fontSize: "1rem" }}>‹</button>
            <span style={{ fontWeight: 800, fontSize: "1rem" }}>{MONTHS[calMonth]} {calYear}</span>
            <button onClick={nextMonth} style={{ background: "#1a1a1a", border: "1px solid #2a2a2a", color: "#f0f0f0", padding: "0.35rem 0.7rem", borderRadius: "8px", cursor: "pointer", fontSize: "1rem" }}>›</button>
          </div>

          {/* Day headers */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: "2px", marginBottom: "4px" }}>
            {DAYS.map((d) => (
              <div key={d} style={{ textAlign: "center", fontSize: "0.68rem", fontWeight: 700, color: "#555", padding: "0.3rem 0" }}>{d}</div>
            ))}
          </div>

          {/* Calendar grid */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: "2px" }}>
            {calendarCells.map((day, i) => {
              if (!day) return <div key={i} />;
              const dayPosts = postsOnDay(day);
              const dateStr = `${calYear}-${String(calMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
              const isToday = dateStr === today;
              return (
                <div
                  key={i}
                  style={{
                    minHeight: "64px", padding: "0.35rem", borderRadius: "6px",
                    background: isToday ? "rgba(34,197,94,0.08)" : "#0d0d0d",
                    border: isToday ? "1px solid rgba(34,197,94,0.3)" : "1px solid #1a1a1a",
                    cursor: dayPosts.length > 0 ? "pointer" : "default",
                  }}
                >
                  <div style={{ fontSize: "0.72rem", fontWeight: isToday ? 800 : 500, color: isToday ? "#22c55e" : "#666", marginBottom: "0.25rem" }}>{day}</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                    {dayPosts.slice(0, 3).map((post) => (
                      <div
                        key={post.id}
                        onClick={() => setSelected(post)}
                        style={{
                          fontSize: "0.6rem", fontWeight: 600, padding: "1px 4px", borderRadius: "3px",
                          background: `${PLATFORM_COLORS[post.platform] ?? "#555"}22`,
                          color: PLATFORM_COLORS[post.platform] ?? "#aaa",
                          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                          cursor: "pointer",
                        }}
                        title={post.title}
                      >
                        {post.title}
                      </div>
                    ))}
                    {dayPosts.length > 3 && (
                      <div style={{ fontSize: "0.6rem", color: "#555" }}>+{dayPosts.length - 3} more</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Upcoming list */}
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          <div className="card">
            <div style={{ fontWeight: 800, fontSize: "0.9rem", marginBottom: "0.875rem" }}>📋 Upcoming Posts</div>
            {upcoming.length === 0 ? (
              <div style={{ color: "#444", fontSize: "0.8rem", textAlign: "center", padding: "1rem 0" }}>
                No upcoming posts scheduled.
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                {upcoming.map((post) => (
                  <div
                    key={post.id}
                    onClick={() => setSelected(post)}
                    style={{
                      padding: "0.625rem 0.75rem", background: "#1a1a1a", borderRadius: "8px",
                      border: "1px solid #222", cursor: "pointer", transition: "border-color 0.12s",
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.borderColor = PLATFORM_COLORS[post.platform] ?? "#444")}
                    onMouseLeave={(e) => (e.currentTarget.style.borderColor = "#222")}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.2rem" }}>
                      <span style={{ fontSize: "0.72rem", fontWeight: 700, color: PLATFORM_COLORS[post.platform] ?? "#aaa" }}>{post.platform}</span>
                      <span style={{ fontSize: "0.68rem", color: "#555" }}>{post.scheduledDate}</span>
                    </div>
                    <div style={{ fontSize: "0.8rem", fontWeight: 600, color: "#ddd", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{post.title}</div>
                    <div style={{ marginTop: "0.2rem" }}>
                      <span style={{
                        fontSize: "0.62rem", fontWeight: 600, padding: "0.1rem 0.4rem", borderRadius: "999px",
                        background: post.status === "scheduled" ? "rgba(34,197,94,0.15)" : "rgba(107,114,128,0.15)",
                        color: post.status === "scheduled" ? "#22c55e" : "#6b7280",
                      }}>
                        {post.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Pipeline pieces to schedule */}
          {pieces.filter((p) => p.status === "edited" || p.status === "scripted").length > 0 && (
            <div className="card">
              <div style={{ fontWeight: 800, fontSize: "0.9rem", marginBottom: "0.875rem" }}>⚡ Ready to Schedule</div>
              <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
                {pieces.filter((p) => p.status === "edited" || p.status === "scripted").slice(0, 5).map((piece) => (
                  <div
                    key={piece.id}
                    onClick={() => {
                      setForm({ ...emptyPost(today), title: piece.title, caption: piece.generatedContent?.slice(0, 200) ?? "", contentId: piece.id, platform: piece.platforms[0] ?? "youtube" });
                      setShowAdd(true);
                    }}
                    style={{ padding: "0.5rem 0.75rem", background: "#1a1a1a", borderRadius: "8px", border: "1px solid #222", cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center" }}
                  >
                    <span style={{ fontSize: "0.78rem", fontWeight: 600, color: "#ddd" }}>{piece.title}</span>
                    <span style={{ fontSize: "0.68rem", color: "#22c55e", fontWeight: 700 }}>Schedule →</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Post detail modal */}
      {selected && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem" }} onClick={() => setSelected(null)}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: "#111", border: "1px solid #222", borderRadius: "16px", padding: "1.75rem", width: "100%", maxWidth: "520px", maxHeight: "90vh", overflowY: "auto" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "1.25rem" }}>
              <div>
                <span style={{ fontSize: "0.7rem", fontWeight: 700, color: PLATFORM_COLORS[selected.platform] ?? "#aaa", textTransform: "uppercase" }}>{selected.platform}</span>
                <h2 style={{ fontSize: "1.05rem", fontWeight: 800, marginTop: "0.2rem" }}>{selected.title}</h2>
                <div style={{ fontSize: "0.78rem", color: "#666", marginTop: "0.15rem" }}>📅 {selected.scheduledDate}</div>
              </div>
              <button onClick={() => setSelected(null)} style={{ background: "none", border: "none", color: "#555", cursor: "pointer", fontSize: "1.25rem" }}>✕</button>
            </div>

            {/* Status */}
            <div style={{ marginBottom: "1rem" }}>
              <div style={{ fontSize: "0.72rem", fontWeight: 700, color: "#666", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "0.4rem" }}>Status</div>
              <div style={{ display: "flex", gap: "0.4rem" }}>
                {(["draft", "scheduled", "posted"] as ScheduledPost["status"][]).map((s) => (
                  <button
                    key={s}
                    onClick={() => updatePostStatus(selected.id, s)}
                    style={{
                      padding: "0.3rem 0.75rem", borderRadius: "999px", fontSize: "0.75rem", fontWeight: 600, cursor: "pointer",
                      border: selected.status === s ? "1px solid #22c55e" : "1px solid #2a2a2a",
                      background: selected.status === s ? "rgba(34,197,94,0.12)" : "transparent",
                      color: selected.status === s ? "#22c55e" : "#666",
                    }}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>

            {selected.caption && (
              <div style={{ marginBottom: "1rem" }}>
                <div style={{ fontSize: "0.72rem", fontWeight: 700, color: "#666", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "0.4rem" }}>Caption</div>
                <div style={{ background: "#0d0d0d", border: "1px solid #1e1e1e", borderRadius: "8px", padding: "0.75rem", fontSize: "0.82rem", color: "#ccc", lineHeight: 1.6, maxHeight: "140px", overflowY: "auto" }}>{selected.caption}</div>
              </div>
            )}

            {selected.hashtags?.length > 0 && (
              <div style={{ marginBottom: "1rem" }}>
                <div style={{ fontSize: "0.72rem", fontWeight: 700, color: "#666", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "0.4rem" }}>Hashtags</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "0.35rem" }}>
                  {selected.hashtags.map((h) => <span key={h} className="badge badge-blue">#{h}</span>)}
                </div>
              </div>
            )}

            {selected.status === "posted" && (
              <div style={{ marginBottom: "1rem" }}>
                <div style={{ fontSize: "0.72rem", fontWeight: 700, color: "#666", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "0.4rem" }}>Views</div>
                <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                  <input type="number" className="input" style={{ width: "140px" }} value={selected.views || ""} placeholder="0" onChange={(e) => updatePostViews(selected.id, parseInt(e.target.value) || 0)} />
                  <span style={{ fontSize: "0.82rem", color: "#22c55e", fontWeight: 700 }}>≈ ${((selected.views || 0) * 0.002).toFixed(2)}</span>
                </div>
              </div>
            )}

            <button onClick={() => deletePost(selected.id)} style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)", color: "#f87171", padding: "0.4rem 1rem", borderRadius: "8px", cursor: "pointer", fontSize: "0.82rem", fontWeight: 600 }}>
              Delete
            </button>
          </div>
        </div>
      )}

      {/* Add post modal */}
      {showAdd && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem" }} onClick={() => setShowAdd(false)}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: "#111", border: "1px solid #222", borderRadius: "16px", padding: "1.75rem", width: "100%", maxWidth: "480px", maxHeight: "90vh", overflowY: "auto" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.25rem" }}>
              <h2 style={{ fontWeight: 800, fontSize: "1rem" }}>Schedule a Post</h2>
              <button onClick={() => setShowAdd(false)} style={{ background: "none", border: "none", color: "#555", cursor: "pointer", fontSize: "1.25rem" }}>✕</button>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.875rem" }}>
              <div>
                <label style={{ fontSize: "0.75rem", color: "#888", display: "block", marginBottom: "0.3rem" }}>Title *</label>
                <input className="input" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Post title" />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
                <div>
                  <label style={{ fontSize: "0.75rem", color: "#888", display: "block", marginBottom: "0.3rem" }}>Platform</label>
                  <select className="select" style={{ width: "100%" }} value={form.platform} onChange={(e) => setForm({ ...form, platform: e.target.value })}>
                    {PLATFORMS.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: "0.75rem", color: "#888", display: "block", marginBottom: "0.3rem" }}>Date *</label>
                  <input type="date" className="input" value={form.scheduledDate} onChange={(e) => setForm({ ...form, scheduledDate: e.target.value })} />
                </div>
              </div>
              <div>
                <label style={{ fontSize: "0.75rem", color: "#888", display: "block", marginBottom: "0.3rem" }}>Caption</label>
                <textarea className="textarea" rows={3} value={form.caption} onChange={(e) => setForm({ ...form, caption: e.target.value })} placeholder="Post caption / description..." />
              </div>
              <div>
                <label style={{ fontSize: "0.75rem", color: "#888", display: "block", marginBottom: "0.3rem" }}>Status</label>
                <select className="select" style={{ width: "100%" }} value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as ScheduledPost["status"] })}>
                  <option value="draft">Draft</option>
                  <option value="scheduled">Scheduled</option>
                </select>
              </div>
              {pieces.length > 0 && (
                <div>
                  <label style={{ fontSize: "0.75rem", color: "#888", display: "block", marginBottom: "0.3rem" }}>Link to Pipeline Piece (optional)</label>
                  <select className="select" style={{ width: "100%" }} value={form.contentId} onChange={(e) => { const p = pieces.find((x) => x.id === e.target.value); setForm({ ...form, contentId: e.target.value, title: form.title || p?.title || "", caption: form.caption || p?.generatedContent?.slice(0, 300) || "" }); }}>
                    <option value="">— None —</option>
                    {pieces.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
                  </select>
                </div>
              )}
            </div>
            <div style={{ display: "flex", gap: "0.75rem", marginTop: "1.25rem" }}>
              <button className="btn-primary" onClick={addPost} style={{ flex: 1 }}>Add to Schedule</button>
              <button className="btn-ghost" onClick={() => setShowAdd(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
