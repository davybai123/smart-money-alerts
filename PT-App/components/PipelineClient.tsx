"use client";
import { useState, useEffect } from "react";
import { getItem, setItem } from "@/lib/store";
import type { ContentPiece } from "@/lib/store";

function makeId() {
  return Math.random().toString(36).slice(2, 10);
}

const STATUSES: { id: ContentPiece["status"]; label: string; color: string; emoji: string }[] = [
  { id: "idea", label: "Ideas", color: "#6b7280", emoji: "💡" },
  { id: "scripted", label: "Scripted", color: "#3b82f6", emoji: "📝" },
  { id: "recorded", label: "Recorded", color: "#f59e0b", emoji: "🎬" },
  { id: "edited", label: "Edited", color: "#8b5cf6", emoji: "✂️" },
  { id: "scheduled", label: "Scheduled", color: "#22c55e", emoji: "📅" },
  { id: "posted", label: "Posted", color: "#10b981", emoji: "🚀" },
];

const PLATFORM_COLORS: Record<string, string> = {
  youtube: "#ff0000",
  instagram: "#e1306c",
  tiktok: "#69c9d0",
  twitter: "#1d9bf0",
  facebook: "#1877f2",
};

const CONTENT_TYPE_LABELS: Record<string, string> = {
  "youtube-script": "YT Script",
  "short-script": "Short / TikTok",
  "instagram-caption": "IG Caption",
  "twitter-thread": "Thread",
  "facebook-post": "FB Post",
};

function emptyPiece(): Omit<ContentPiece, "id" | "createdAt"> {
  return {
    title: "", platforms: [], contentType: "youtube-script", topic: "",
    teams: "", match: "", stage: "Group Stage", generatedContent: "",
    hashtags: [], thumbnailIdea: "", hookLine: "", status: "idea",
    scheduledDate: "", postedDate: "", views: 0, notes: "",
  };
}

export default function PipelineClient() {
  const [pieces, setPieces] = useState<ContentPiece[]>([]);
  const [selected, setSelected] = useState<ContentPiece | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState(emptyPiece());
  const [filter, setFilter] = useState<ContentPiece["status"] | "all">("all");

  useEffect(() => {
    setPieces(getItem<ContentPiece[]>("content_pieces", []));
  }, []);

  function save(updated: ContentPiece[]) {
    setPieces(updated);
    setItem("content_pieces", updated);
  }

  function addPiece() {
    if (!form.title) return;
    const piece: ContentPiece = { ...form, id: makeId(), createdAt: new Date().toISOString() };
    save([...pieces, piece]);
    setForm(emptyPiece());
    setShowAdd(false);
  }

  function updateStatus(id: string, status: ContentPiece["status"]) {
    save(pieces.map((p) => (p.id === id ? { ...p, status, postedDate: status === "posted" ? new Date().toISOString().split("T")[0] : p.postedDate } : p)));
    if (selected?.id === id) setSelected((s) => s ? { ...s, status } : s);
  }

  function updateViews(id: string, views: number) {
    save(pieces.map((p) => (p.id === id ? { ...p, views } : p)));
    if (selected?.id === id) setSelected((s) => s ? { ...s, views } : s);
  }

  function deletePiece(id: string) {
    save(pieces.filter((p) => p.id !== id));
    if (selected?.id === id) setSelected(null);
  }

  const totalViews = pieces.filter((p) => p.status === "posted").reduce((s, p) => s + (p.views || 0), 0);
  const estimatedRevenue = totalViews * 0.002;
  const posted = pieces.filter((p) => p.status === "posted").length;
  const scheduled = pieces.filter((p) => p.status === "scheduled").length;

  const filteredPieces = filter === "all" ? pieces : pieces.filter((p) => p.status === filter);

  return (
    <div style={{ padding: "2rem", maxWidth: "1400px" }}>
      {/* Header */}
      <div style={{ marginBottom: "1.5rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "0.4rem" }}>
          <span style={{ fontSize: "2rem" }}>📊</span>
          <div>
            <h1 style={{ fontSize: "1.8rem", fontWeight: 900, letterSpacing: "-0.03em", lineHeight: 1 }}>
              Content <span style={{ color: "#22c55e" }}>Pipeline</span>
            </h1>
            <p style={{ color: "#666", fontSize: "0.82rem", marginTop: "0.2rem" }}>
              Track every piece from idea to revenue
            </p>
          </div>
        </div>
      </div>

      {/* Revenue stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: "1rem", marginBottom: "1.75rem" }}>
        {[
          { label: "Total Pieces", value: pieces.length, color: "#6b7280", icon: "🎯" },
          { label: "Posted", value: posted, color: "#10b981", icon: "🚀" },
          { label: "Scheduled", value: scheduled, color: "#22c55e", icon: "📅" },
          { label: "Total Views", value: totalViews.toLocaleString(), color: "#f59e0b", icon: "👀" },
          { label: "Est. Revenue", value: `$${estimatedRevenue.toFixed(0)}`, color: "#22c55e", icon: "💰" },
        ].map((s) => (
          <div key={s.label} className="stat-card">
            <span style={{ fontSize: "1.3rem" }}>{s.icon}</span>
            <div style={{ fontSize: "1.6rem", fontWeight: 900, color: s.color, lineHeight: 1.1 }}>{s.value}</div>
            <div style={{ fontSize: "0.75rem", color: "#666" }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Toolbar */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.25rem", gap: "1rem", flexWrap: "wrap" }}>
        <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap" }}>
          {[{ id: "all" as const, label: "All" }, ...STATUSES].map((s) => (
            <button
              key={s.id}
              onClick={() => setFilter(s.id as ContentPiece["status"] | "all")}
              style={{
                padding: "0.3rem 0.75rem", borderRadius: "999px", fontSize: "0.78rem", fontWeight: 600,
                border: filter === s.id ? "1px solid rgba(34,197,94,0.4)" : "1px solid #2a2a2a",
                background: filter === s.id ? "rgba(34,197,94,0.08)" : "transparent",
                color: filter === s.id ? "#22c55e" : "#666",
                cursor: "pointer",
              }}
            >
              {"emoji" in s ? `${s.emoji} ` : ""}{s.label}
              {s.id !== "all" && (
                <span style={{ marginLeft: "0.3rem", color: "#555" }}>
                  ({pieces.filter((p) => p.status === s.id).length})
                </span>
              )}
            </button>
          ))}
        </div>
        <button className="btn-primary" onClick={() => setShowAdd(true)} style={{ fontSize: "0.85rem" }}>
          + Add Piece
        </button>
      </div>

      {/* Kanban */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: "1rem" }}>
        {STATUSES.map((col) => {
          const colPieces = (filter === "all" ? pieces : filteredPieces).filter((p) => p.status === col.id);
          return (
            <div key={col.id}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.625rem" }}>
                <span>{col.emoji}</span>
                <span style={{ fontWeight: 700, fontSize: "0.82rem", color: col.color }}>{col.label}</span>
                <span style={{ marginLeft: "auto", background: "#1a1a1a", border: "1px solid #2a2a2a", borderRadius: "999px", fontSize: "0.7rem", padding: "0.1rem 0.45rem", color: "#555" }}>
                  {colPieces.length}
                </span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "0.625rem", minHeight: "60px" }}>
                {colPieces.map((piece) => (
                  <div
                    key={piece.id}
                    className="card"
                    onClick={() => setSelected(piece)}
                    style={{ cursor: "pointer", padding: "0.875rem", transition: "border-color 0.12s", borderColor: "#1e1e1e" }}
                    onMouseEnter={(e) => (e.currentTarget.style.borderColor = col.color)}
                    onMouseLeave={(e) => (e.currentTarget.style.borderColor = "#1e1e1e")}
                  >
                    <div style={{ fontSize: "0.82rem", fontWeight: 700, lineHeight: 1.3, marginBottom: "0.5rem", color: "#f0f0f0" }}>
                      {piece.title}
                    </div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "0.3rem", marginBottom: "0.5rem" }}>
                      {piece.platforms.map((p) => (
                        <span key={p} style={{ fontSize: "0.65rem", padding: "0.1rem 0.4rem", borderRadius: "999px", background: `${PLATFORM_COLORS[p] ?? "#444"}22`, color: PLATFORM_COLORS[p] ?? "#aaa", fontWeight: 600 }}>
                          {p}
                        </span>
                      ))}
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ fontSize: "0.68rem", color: "#555" }}>{CONTENT_TYPE_LABELS[piece.contentType] ?? piece.contentType}</span>
                      {piece.views > 0 && (
                        <span style={{ fontSize: "0.68rem", color: "#f59e0b", fontWeight: 700 }}>
                          👀 {piece.views.toLocaleString()}
                        </span>
                      )}
                    </div>
                    {piece.scheduledDate && piece.status === "scheduled" && (
                      <div style={{ marginTop: "0.4rem", fontSize: "0.68rem", color: "#22c55e" }}>📅 {piece.scheduledDate}</div>
                    )}
                  </div>
                ))}
                {colPieces.length === 0 && (
                  <div style={{ border: "1px dashed #1e1e1e", borderRadius: "10px", padding: "1rem", textAlign: "center", color: "#333", fontSize: "0.75rem" }}>
                    Empty
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Detail modal */}
      {selected && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem" }} onClick={() => setSelected(null)}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: "#111", border: "1px solid #222", borderRadius: "16px", padding: "1.75rem", width: "100%", maxWidth: "600px", maxHeight: "90vh", overflowY: "auto" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "1.25rem" }}>
              <div>
                <h2 style={{ fontSize: "1.1rem", fontWeight: 800, lineHeight: 1.3, marginBottom: "0.3rem" }}>{selected.title}</h2>
                <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap" }}>
                  {selected.platforms.map((p) => (
                    <span key={p} style={{ fontSize: "0.68rem", padding: "0.15rem 0.5rem", borderRadius: "999px", background: `${PLATFORM_COLORS[p] ?? "#444"}22`, color: PLATFORM_COLORS[p] ?? "#aaa", fontWeight: 600 }}>
                      {p}
                    </span>
                  ))}
                </div>
              </div>
              <button onClick={() => setSelected(null)} style={{ background: "none", border: "none", color: "#555", cursor: "pointer", fontSize: "1.25rem" }}>✕</button>
            </div>

            {/* Status selector */}
            <div style={{ marginBottom: "1.25rem" }}>
              <div style={{ fontSize: "0.72rem", fontWeight: 700, color: "#666", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "0.5rem" }}>Status</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem" }}>
                {STATUSES.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => updateStatus(selected.id, s.id)}
                    style={{
                      padding: "0.3rem 0.75rem", borderRadius: "999px", fontSize: "0.75rem", fontWeight: 600, cursor: "pointer",
                      border: selected.status === s.id ? `1px solid ${s.color}` : "1px solid #2a2a2a",
                      background: selected.status === s.id ? `${s.color}22` : "transparent",
                      color: selected.status === s.id ? s.color : "#666",
                    }}
                  >
                    {s.emoji} {s.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Views tracker */}
            <div style={{ marginBottom: "1.25rem" }}>
              <div style={{ fontSize: "0.72rem", fontWeight: 700, color: "#666", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "0.4rem" }}>Views</div>
              <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                <input
                  type="number"
                  className="input"
                  style={{ width: "160px" }}
                  value={selected.views || ""}
                  placeholder="0"
                  onChange={(e) => updateViews(selected.id, parseInt(e.target.value) || 0)}
                />
                <span style={{ fontSize: "0.82rem", color: "#22c55e", fontWeight: 700 }}>
                  ≈ ${((selected.views || 0) * 0.002).toFixed(2)} revenue
                </span>
              </div>
            </div>

            {/* Content preview */}
            {selected.generatedContent && (
              <div style={{ marginBottom: "1.25rem" }}>
                <div style={{ fontSize: "0.72rem", fontWeight: 700, color: "#666", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "0.4rem" }}>Content</div>
                <div style={{ background: "#0d0d0d", border: "1px solid #1e1e1e", borderRadius: "8px", padding: "0.875rem", maxHeight: "180px", overflowY: "auto" }}>
                  <pre style={{ fontFamily: "inherit", fontSize: "0.78rem", lineHeight: 1.7, whiteSpace: "pre-wrap", color: "#ccc", margin: 0 }}>
                    {selected.generatedContent}
                  </pre>
                </div>
              </div>
            )}

            {selected.hashtags?.length > 0 && (
              <div style={{ marginBottom: "1.25rem" }}>
                <div style={{ fontSize: "0.72rem", fontWeight: 700, color: "#666", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "0.4rem" }}>Hashtags</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "0.35rem" }}>
                  {selected.hashtags.map((h) => <span key={h} className="badge badge-blue">#{h}</span>)}
                </div>
              </div>
            )}

            <button
              onClick={() => deletePiece(selected.id)}
              style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)", color: "#f87171", padding: "0.4rem 1rem", borderRadius: "8px", cursor: "pointer", fontSize: "0.82rem", fontWeight: 600 }}
            >
              Delete
            </button>
          </div>
        </div>
      )}

      {/* Add piece modal */}
      {showAdd && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem" }} onClick={() => setShowAdd(false)}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: "#111", border: "1px solid #222", borderRadius: "16px", padding: "1.75rem", width: "100%", maxWidth: "480px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.25rem" }}>
              <h2 style={{ fontWeight: 800, fontSize: "1rem" }}>Add Content Idea</h2>
              <button onClick={() => setShowAdd(false)} style={{ background: "none", border: "none", color: "#555", cursor: "pointer", fontSize: "1.25rem" }}>✕</button>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.875rem" }}>
              <div>
                <label style={{ fontSize: "0.75rem", color: "#888", display: "block", marginBottom: "0.3rem" }}>Title *</label>
                <input className="input" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="e.g. Brazil vs Argentina — Who Wins?" />
              </div>
              <div>
                <label style={{ fontSize: "0.75rem", color: "#888", display: "block", marginBottom: "0.3rem" }}>Match</label>
                <input className="input" value={form.match} onChange={(e) => setForm({ ...form, match: e.target.value })} placeholder="Match name" />
              </div>
              <div>
                <label style={{ fontSize: "0.75rem", color: "#888", display: "block", marginBottom: "0.3rem" }}>Content Type</label>
                <select className="select" style={{ width: "100%" }} value={form.contentType} onChange={(e) => setForm({ ...form, contentType: e.target.value })}>
                  <option value="youtube-script">YouTube Script</option>
                  <option value="short-script">Short / TikTok</option>
                  <option value="instagram-caption">Instagram Caption</option>
                  <option value="twitter-thread">Twitter Thread</option>
                  <option value="facebook-post">Facebook Post</option>
                </select>
              </div>
              <div>
                <label style={{ fontSize: "0.75rem", color: "#888", display: "block", marginBottom: "0.3rem" }}>Platforms</label>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem" }}>
                  {["youtube","instagram","tiktok","twitter","facebook"].map((p) => (
                    <button
                      key={p}
                      onClick={() => setForm({ ...form, platforms: form.platforms.includes(p) ? form.platforms.filter((x) => x !== p) : [...form.platforms, p] })}
                      style={{
                        padding: "0.25rem 0.625rem", borderRadius: "999px", fontSize: "0.75rem", fontWeight: 600, cursor: "pointer",
                        border: form.platforms.includes(p) ? `1px solid ${PLATFORM_COLORS[p]}` : "1px solid #2a2a2a",
                        background: form.platforms.includes(p) ? `${PLATFORM_COLORS[p]}22` : "transparent",
                        color: form.platforms.includes(p) ? PLATFORM_COLORS[p] : "#666",
                      }}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label style={{ fontSize: "0.75rem", color: "#888", display: "block", marginBottom: "0.3rem" }}>Notes</label>
                <textarea className="textarea" rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Any ideas or context..." />
              </div>
            </div>
            <div style={{ display: "flex", gap: "0.75rem", marginTop: "1.25rem" }}>
              <button className="btn-primary" onClick={addPiece} style={{ flex: 1 }}>Add to Pipeline</button>
              <button className="btn-ghost" onClick={() => setShowAdd(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
