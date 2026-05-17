"use client";
import { useEffect, useState } from "react";
import { getItem, setItem } from "@/lib/store";
import type { JournalEntry } from "@/lib/store";

function makeId() { return Math.random().toString(36).slice(2, 10); }

const MOOD_LABELS = ["", "Terrible", "Bad", "Meh", "Okay", "Good", "Great", "Excellent", "Amazing", "Unreal", "BEAST MODE"];
const ENERGY_LABELS = ["", "Depleted", "Very Low", "Low", "Below Avg", "Average", "Good", "High", "Very High", "Peak", "SUPERHUMAN"];

const emptyEntry = (): Omit<JournalEntry, "id" | "createdAt"> => ({
  date: new Date().toISOString().split("T")[0],
  title: "",
  content: "",
  mood: 7,
  energy: 7,
  tags: [],
});

export default function JournalClient() {
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyEntry());
  const [viewEntry, setViewEntry] = useState<JournalEntry | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => { setEntries(getItem<JournalEntry[]>("journal_entries", [])); }, []);

  function saveEntries(list: JournalEntry[]) { setEntries(list); setItem("journal_entries", list); }

  function submit() {
    if (!form.title.trim() && !form.content.trim()) return;
    if (editId) {
      saveEntries(entries.map((e) => e.id === editId ? { ...form, id: editId, createdAt: e.createdAt } : e));
      setEditId(null);
    } else {
      saveEntries([...entries, { ...form, id: makeId(), createdAt: new Date().toISOString() }]);
    }
    setShowForm(false);
    setForm(emptyEntry());
  }

  function deleteEntry(id: string) {
    saveEntries(entries.filter((e) => e.id !== id));
    if (viewEntry?.id === id) setViewEntry(null);
  }

  const filtered = entries.filter((e) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return e.title.toLowerCase().includes(q) || e.content.toLowerCase().includes(q) || e.tags.some((t) => t.toLowerCase().includes(q));
  });

  const sorted = [...filtered].sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  function moodColor(v: number) {
    if (v >= 8) return "#22c55e";
    if (v >= 6) return "#f59e0b";
    if (v >= 4) return "#60a5fa";
    return "#f87171";
  }

  return (
    <div style={{ padding: "2rem", maxWidth: "900px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
        <div>
          <h1 style={{ fontSize: "1.6rem", fontWeight: 900, letterSpacing: "-0.03em" }}>📓 Journal</h1>
          <p style={{ color: "#666", fontSize: "0.82rem", marginTop: "0.2rem" }}>{entries.length} entries · Track your mental game</p>
        </div>
        <button className="btn-primary" onClick={() => { setShowForm(true); setEditId(null); setForm(emptyEntry()); }}>
          + New Entry
        </button>
      </div>

      <input className="input" style={{ maxWidth: "320px", marginBottom: "1.25rem" }} placeholder="Search entries..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />

      {/* View modal */}
      {viewEntry && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.88)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem" }}>
          <div style={{ background: "#111", border: "1px solid #2a2a2a", borderRadius: "16px", padding: "1.75rem", width: "100%", maxWidth: "580px", maxHeight: "85vh", overflowY: "auto" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "0.75rem" }}>
              <div>
                <h2 style={{ fontWeight: 800, fontSize: "1.2rem" }}>{viewEntry.title || "Untitled"}</h2>
                <div style={{ color: "#666", fontSize: "0.78rem" }}>{viewEntry.date} · {new Date(viewEntry.createdAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}</div>
              </div>
              <button onClick={() => setViewEntry(null)} style={{ background: "none", border: "none", color: "#888", cursor: "pointer", fontSize: "1.3rem" }}>✕</button>
            </div>
            <div style={{ display: "flex", gap: "1rem", marginBottom: "1rem" }}>
              <div style={{ background: "#1a1a1a", borderRadius: "8px", padding: "0.5rem 0.875rem", textAlign: "center" }}>
                <div style={{ fontSize: "1.2rem", fontWeight: 800, color: moodColor(viewEntry.mood) }}>{viewEntry.mood}/10</div>
                <div style={{ fontSize: "0.65rem", color: "#666" }}>Mood · {MOOD_LABELS[viewEntry.mood]}</div>
              </div>
              <div style={{ background: "#1a1a1a", borderRadius: "8px", padding: "0.5rem 0.875rem", textAlign: "center" }}>
                <div style={{ fontSize: "1.2rem", fontWeight: 800, color: moodColor(viewEntry.energy) }}>{viewEntry.energy}/10</div>
                <div style={{ fontSize: "0.65rem", color: "#666" }}>Energy · {ENERGY_LABELS[viewEntry.energy]}</div>
              </div>
            </div>
            {viewEntry.tags.length > 0 && (
              <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap", marginBottom: "1rem" }}>
                {viewEntry.tags.map((t) => <span key={t} className="badge badge-blue">#{t}</span>)}
              </div>
            )}
            <p style={{ fontSize: "0.9rem", lineHeight: 1.7, color: "#ddd", whiteSpace: "pre-wrap" }}>{viewEntry.content}</p>
            <div style={{ display: "flex", gap: "0.75rem", marginTop: "1.5rem" }}>
              <button className="btn-ghost" style={{ flex: 1 }} onClick={() => { setForm({ ...viewEntry }); setEditId(viewEntry.id); setShowForm(true); setViewEntry(null); }}>Edit</button>
              <button className="btn-ghost" style={{ flex: 1, color: "#ef4444" }} onClick={() => deleteEntry(viewEntry.id)}>Delete</button>
            </div>
          </div>
        </div>
      )}

      {/* Write form */}
      {showForm && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.88)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem" }}>
          <div style={{ background: "#111", border: "1px solid #2a2a2a", borderRadius: "16px", padding: "1.5rem", width: "100%", maxWidth: "580px", maxHeight: "90vh", overflowY: "auto" }}>
            <h2 style={{ fontWeight: 800, marginBottom: "1.25rem" }}>{editId ? "Edit Entry" : "New Journal Entry"}</h2>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem", marginBottom: "1rem" }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: "0.6rem" }}>
                <div>
                  <label style={{ fontSize: "0.75rem", color: "#888", display: "block", marginBottom: "0.3rem" }}>Title</label>
                  <input className="input" value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} placeholder="e.g. Big match day reflections" />
                </div>
                <div>
                  <label style={{ fontSize: "0.75rem", color: "#888", display: "block", marginBottom: "0.3rem" }}>Date</label>
                  <input className="input" type="date" value={form.date} onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))} />
                </div>
              </div>

              {/* Mood / Energy sliders */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
                {[
                  { key: "mood" as const, label: "Mood", labels: MOOD_LABELS },
                  { key: "energy" as const, label: "Energy", labels: ENERGY_LABELS },
                ].map(({ key, label, labels }) => (
                  <div key={key}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.3rem" }}>
                      <label style={{ fontSize: "0.75rem", color: "#888" }}>{label}</label>
                      <span style={{ fontSize: "0.75rem", color: moodColor(form[key]), fontWeight: 700 }}>{form[key]}/10 · {labels[form[key]]}</span>
                    </div>
                    <input type="range" min={1} max={10} value={form[key]}
                      onChange={(e) => setForm((f) => ({ ...f, [key]: +e.target.value }))}
                      style={{ width: "100%", accentColor: "#22c55e" }} />
                  </div>
                ))}
              </div>

              <div>
                <label style={{ fontSize: "0.75rem", color: "#888", display: "block", marginBottom: "0.3rem" }}>Entry *</label>
                <textarea className="textarea" rows={8} value={form.content}
                  onChange={(e) => setForm((f) => ({ ...f, content: e.target.value }))}
                  placeholder="How was training? How do you feel? What went well? What can you improve? Goals for tomorrow..." />
              </div>

              <div>
                <label style={{ fontSize: "0.75rem", color: "#888", display: "block", marginBottom: "0.3rem" }}>Tags (comma-separated)</label>
                <input className="input" value={form.tags.join(", ")}
                  onChange={(e) => setForm((f) => ({ ...f, tags: e.target.value.split(",").map((t) => t.trim()).filter(Boolean) }))}
                  placeholder="match-day, strength, recovery, mindset..." />
              </div>
            </div>
            <div style={{ display: "flex", gap: "0.75rem", justifyContent: "flex-end" }}>
              <button className="btn-ghost" onClick={() => { setShowForm(false); setEditId(null); }}>Cancel</button>
              <button className="btn-primary" onClick={submit}>Save Entry</button>
            </div>
          </div>
        </div>
      )}

      {/* Entries list */}
      {sorted.length === 0 ? (
        <div className="card" style={{ textAlign: "center", padding: "3rem" }}>
          <div style={{ fontSize: "3rem", marginBottom: "0.75rem" }}>📓</div>
          <p style={{ color: "#666", marginBottom: "1rem" }}>No journal entries yet. Start writing.</p>
          <button className="btn-primary" onClick={() => setShowForm(true)}>Write First Entry</button>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
          {sorted.map((entry) => (
            <div key={entry.id} className="card" style={{ cursor: "pointer", transition: "border-color 0.15s" }}
              onMouseEnter={(e) => (e.currentTarget.style.borderColor = "#22c55e")}
              onMouseLeave={(e) => (e.currentTarget.style.borderColor = "#1e1e1e")}
              onClick={() => setViewEntry(entry)}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div style={{ flex: 1, marginRight: "1rem" }}>
                  <h3 style={{ fontWeight: 700, fontSize: "0.95rem", marginBottom: "0.25rem" }}>{entry.title || "Untitled"}</h3>
                  <p style={{ fontSize: "0.78rem", color: "#888", overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" as const }}>
                    {entry.content}
                  </p>
                  {entry.tags.length > 0 && (
                    <div style={{ display: "flex", gap: "0.3rem", marginTop: "0.5rem", flexWrap: "wrap" }}>
                      {entry.tags.slice(0, 4).map((t) => <span key={t} className="badge badge-blue">#{t}</span>)}
                    </div>
                  )}
                </div>
                <div style={{ textAlign: "right", flexShrink: 0 }}>
                  <div style={{ fontSize: "0.72rem", color: "#666", marginBottom: "0.4rem" }}>{entry.date}</div>
                  <div style={{ display: "flex", gap: "0.4rem", justifyContent: "flex-end" }}>
                    <span style={{ fontSize: "0.7rem", color: moodColor(entry.mood), fontWeight: 700 }}>😊 {entry.mood}</span>
                    <span style={{ fontSize: "0.7rem", color: moodColor(entry.energy), fontWeight: 700 }}>⚡ {entry.energy}</span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
