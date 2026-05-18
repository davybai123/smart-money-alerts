"use client";
import { useEffect, useState } from "react";
import { getItem, setItem } from "@/lib/store";
import type { Session, Exercise } from "@/lib/store";

const SESSION_TYPES = ["Strength", "Cardio", "Rugby", "HIIT", "Recovery", "Mobility", "Sport-Specific"];

function makeId() {
  return Math.random().toString(36).slice(2, 10);
}

const emptyExercise = (): Exercise => ({ id: makeId(), name: "", sets: 3, reps: 10, weight: 0, unit: "kg", notes: "" });
const emptySession = (): Omit<Session, "id"> => ({
  date: new Date().toISOString().split("T")[0],
  title: "",
  type: "Strength",
  duration: 60,
  exercises: [emptyExercise()],
  notes: "",
  rpe: 7,
});

export default function SessionsClient() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptySession());
  const [editId, setEditId] = useState<string | null>(null);
  const [viewId, setViewId] = useState<string | null>(null);

  useEffect(() => {
    setSessions(getItem<Session[]>("gym_sessions", []));
  }, []);

  function save(list: Session[]) {
    setSessions(list);
    setItem("gym_sessions", list);
  }

  function submit() {
    if (!form.title.trim()) return;
    if (editId) {
      save(sessions.map((s) => (s.id === editId ? { ...form, id: editId } : s)));
      setEditId(null);
    } else {
      save([...sessions, { ...form, id: makeId() }]);
    }
    setShowForm(false);
    setForm(emptySession());
  }

  function deleteSession(id: string) {
    save(sessions.filter((s) => s.id !== id));
    if (viewId === id) setViewId(null);
  }

  function editSession(s: Session) {
    setForm({ ...s });
    setEditId(s.id);
    setShowForm(true);
    setViewId(null);
  }

  function addExercise() {
    setForm((f) => ({ ...f, exercises: [...f.exercises, emptyExercise()] }));
  }

  function updateExercise(idx: number, field: keyof Exercise, val: string | number) {
    setForm((f) => {
      const exs = [...f.exercises];
      exs[idx] = { ...exs[idx], [field]: val };
      return { ...f, exercises: exs };
    });
  }

  function removeExercise(idx: number) {
    setForm((f) => ({ ...f, exercises: f.exercises.filter((_, i) => i !== idx) }));
  }

  const viewed = viewId ? sessions.find((s) => s.id === viewId) : null;

  return (
    <div style={{ padding: "2rem", maxWidth: "1100px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
        <div>
          <h1 style={{ fontSize: "1.6rem", fontWeight: 900, letterSpacing: "-0.03em" }}>🏋️ Gym Sessions</h1>
          <p style={{ color: "#666", fontSize: "0.82rem", marginTop: "0.2rem" }}>{sessions.length} sessions logged</p>
        </div>
        <button className="btn-primary" onClick={() => { setShowForm(true); setEditId(null); setForm(emptySession()); }}>
          + New Session
        </button>
      </div>

      {/* Form Modal */}
      {showForm && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem" }}>
          <div style={{ background: "#111", border: "1px solid #2a2a2a", borderRadius: "16px", padding: "1.5rem", width: "100%", maxWidth: "680px", maxHeight: "90vh", overflowY: "auto" }}>
            <h2 style={{ fontWeight: 800, marginBottom: "1.25rem", fontSize: "1.1rem" }}>{editId ? "Edit Session" : "Log New Session"}</h2>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem", marginBottom: "0.75rem" }}>
              <div>
                <label style={{ fontSize: "0.75rem", color: "#888", display: "block", marginBottom: "0.3rem" }}>Title *</label>
                <input className="input" value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} placeholder="e.g. Monday Push Day" />
              </div>
              <div>
                <label style={{ fontSize: "0.75rem", color: "#888", display: "block", marginBottom: "0.3rem" }}>Date</label>
                <input className="input" type="date" value={form.date} onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))} />
              </div>
              <div>
                <label style={{ fontSize: "0.75rem", color: "#888", display: "block", marginBottom: "0.3rem" }}>Type</label>
                <select className="select" style={{ width: "100%" }} value={form.type} onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}>
                  {SESSION_TYPES.map((t) => <option key={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize: "0.75rem", color: "#888", display: "block", marginBottom: "0.3rem" }}>Duration (min)</label>
                <input className="input" type="number" min={1} value={form.duration} onChange={(e) => setForm((f) => ({ ...f, duration: +e.target.value }))} />
              </div>
              <div>
                <label style={{ fontSize: "0.75rem", color: "#888", display: "block", marginBottom: "0.3rem" }}>RPE (1–10)</label>
                <input className="input" type="number" min={1} max={10} value={form.rpe} onChange={(e) => setForm((f) => ({ ...f, rpe: +e.target.value }))} />
              </div>
            </div>

            {/* Exercises */}
            <div style={{ marginBottom: "0.75rem" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
                <label style={{ fontSize: "0.8rem", fontWeight: 600 }}>Exercises</label>
                <button className="btn-ghost" style={{ padding: "0.25rem 0.75rem", fontSize: "0.75rem" }} onClick={addExercise}>+ Add</button>
              </div>
              {form.exercises.map((ex, idx) => (
                <div key={ex.id} style={{ background: "#1a1a1a", borderRadius: "8px", padding: "0.75rem", marginBottom: "0.5rem" }}>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr auto auto auto auto", gap: "0.5rem", alignItems: "center", marginBottom: "0.4rem" }}>
                    <input className="input" placeholder="Exercise name" value={ex.name} onChange={(e) => updateExercise(idx, "name", e.target.value)} />
                    <div style={{ textAlign: "center" }}>
                      <div style={{ fontSize: "0.6rem", color: "#666", marginBottom: "0.2rem" }}>Sets</div>
                      <input className="input" type="number" min={1} value={ex.sets} onChange={(e) => updateExercise(idx, "sets", +e.target.value)} style={{ width: "60px", textAlign: "center" }} />
                    </div>
                    <div style={{ textAlign: "center" }}>
                      <div style={{ fontSize: "0.6rem", color: "#666", marginBottom: "0.2rem" }}>Reps</div>
                      <input className="input" type="number" min={1} value={ex.reps} onChange={(e) => updateExercise(idx, "reps", +e.target.value)} style={{ width: "60px", textAlign: "center" }} />
                    </div>
                    <div style={{ textAlign: "center" }}>
                      <div style={{ fontSize: "0.6rem", color: "#666", marginBottom: "0.2rem" }}>kg</div>
                      <input className="input" type="number" min={0} step={2.5} value={ex.weight} onChange={(e) => updateExercise(idx, "weight", +e.target.value)} style={{ width: "70px", textAlign: "center" }} />
                    </div>
                    <button onClick={() => removeExercise(idx)} style={{ background: "none", border: "none", color: "#ef4444", cursor: "pointer", fontSize: "1rem" }}>✕</button>
                  </div>
                  <input className="input" placeholder="Notes (optional)" value={ex.notes} onChange={(e) => updateExercise(idx, "notes", e.target.value)} style={{ fontSize: "0.75rem" }} />
                </div>
              ))}
            </div>

            <div style={{ marginBottom: "1rem" }}>
              <label style={{ fontSize: "0.75rem", color: "#888", display: "block", marginBottom: "0.3rem" }}>Session Notes</label>
              <textarea className="textarea" rows={3} value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} placeholder="How did it go? Any PRs, issues, observations..." />
            </div>

            <div style={{ display: "flex", gap: "0.75rem", justifyContent: "flex-end" }}>
              <button className="btn-ghost" onClick={() => { setShowForm(false); setEditId(null); }}>Cancel</button>
              <button className="btn-primary" onClick={submit}>Save Session</button>
            </div>
          </div>
        </div>
      )}

      {/* Session Detail Modal */}
      {viewed && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem" }}>
          <div style={{ background: "#111", border: "1px solid #2a2a2a", borderRadius: "16px", padding: "1.5rem", width: "100%", maxWidth: "580px", maxHeight: "85vh", overflowY: "auto" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "1rem" }}>
              <div>
                <h2 style={{ fontWeight: 800, fontSize: "1.2rem" }}>{viewed.title}</h2>
                <div style={{ color: "#666", fontSize: "0.8rem" }}>{viewed.date} · {viewed.duration} min · RPE {viewed.rpe}/10</div>
              </div>
              <button onClick={() => setViewId(null)} style={{ background: "none", border: "none", color: "#888", cursor: "pointer", fontSize: "1.3rem" }}>✕</button>
            </div>
            <span className="badge badge-green" style={{ marginBottom: "1rem", display: "inline-block" }}>{viewed.type}</span>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", marginBottom: "1rem" }}>
              {viewed.exercises.map((ex) => (
                <div key={ex.id} style={{ background: "#1a1a1a", borderRadius: "8px", padding: "0.75rem", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: "0.9rem" }}>{ex.name || "Unnamed exercise"}</div>
                    {ex.notes && <div style={{ fontSize: "0.72rem", color: "#666" }}>{ex.notes}</div>}
                  </div>
                  <div style={{ textAlign: "right", fontSize: "0.82rem", color: "#22c55e", fontWeight: 700 }}>
                    {ex.sets} × {ex.reps} @ {ex.weight}{ex.unit}
                  </div>
                </div>
              ))}
            </div>
            {viewed.notes && <p style={{ fontSize: "0.82rem", color: "#aaa", background: "#1a1a1a", padding: "0.75rem", borderRadius: "8px", marginBottom: "1rem" }}>{viewed.notes}</p>}
            <div style={{ display: "flex", gap: "0.75rem" }}>
              <button className="btn-ghost" style={{ flex: 1 }} onClick={() => editSession(viewed)}>Edit</button>
              <button className="btn-ghost" style={{ flex: 1, color: "#ef4444", borderColor: "#2a0000" }} onClick={() => deleteSession(viewed.id)}>Delete</button>
            </div>
          </div>
        </div>
      )}

      {/* Sessions grid */}
      {sessions.length === 0 ? (
        <div className="card" style={{ textAlign: "center", padding: "3rem" }}>
          <div style={{ fontSize: "3rem", marginBottom: "0.75rem" }}>🏋️</div>
          <p style={{ color: "#666", marginBottom: "1rem" }}>No sessions logged yet.</p>
          <button className="btn-primary" onClick={() => setShowForm(true)}>Log Your First Session</button>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "1rem" }}>
          {[...sessions].reverse().map((s) => (
            <div key={s.id} className="card" style={{ cursor: "pointer", transition: "border-color 0.15s" }}
              onMouseEnter={(e) => (e.currentTarget.style.borderColor = "#22c55e")}
              onMouseLeave={(e) => (e.currentTarget.style.borderColor = "#1e1e1e")}
              onClick={() => setViewId(s.id)}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "0.5rem" }}>
                <h3 style={{ fontWeight: 700, fontSize: "0.95rem" }}>{s.title}</h3>
                <span className="badge badge-green">{s.type}</span>
              </div>
              <div style={{ fontSize: "0.75rem", color: "#666", marginBottom: "0.75rem" }}>
                {s.date} · {s.duration}min · RPE {s.rpe}/10
              </div>
              <div style={{ fontSize: "0.8rem", color: "#aaa" }}>
                {s.exercises.length} exercise{s.exercises.length !== 1 ? "s" : ""} · {s.exercises.reduce((a, e) => a + e.sets, 0)} total sets
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
