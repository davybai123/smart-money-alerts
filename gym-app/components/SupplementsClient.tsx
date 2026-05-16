"use client";
import { useEffect, useState } from "react";
import { getItem, setItem } from "@/lib/store";
import type { Supplement, SupplementLog } from "@/lib/store";

const CATEGORIES = ["Protein", "Creatine", "Pre-Workout", "Recovery", "Vitamins", "Electrolytes", "Performance", "Other"];
const TIMINGS = ["Morning", "Pre-Workout", "Intra-Workout", "Post-Workout", "Evening", "With Meals", "Before Bed"];

function makeId() { return Math.random().toString(36).slice(2, 10); }
const today = () => new Date().toISOString().split("T")[0];

export default function SupplementsClient() {
  const [supplements, setSupplements] = useState<Supplement[]>([]);
  const [logs, setLogs] = useState<SupplementLog[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", dosage: "", timing: "Morning", category: "Protein", notes: "" });
  const [selectedDate, setSelectedDate] = useState(today());

  useEffect(() => {
    setSupplements(getItem<Supplement[]>("supplements", []));
    setLogs(getItem<SupplementLog[]>("supplement_logs", []));
  }, []);

  function saveSupps(list: Supplement[]) { setSupplements(list); setItem("supplements", list); }
  function saveLogs(list: SupplementLog[]) { setLogs(list); setItem("supplement_logs", list); }

  function submit() {
    if (!form.name.trim()) return;
    if (editId) {
      saveSupps(supplements.map((s) => s.id === editId ? { ...form, id: editId } : s));
      setEditId(null);
    } else {
      saveSupps([...supplements, { ...form, id: makeId() }]);
    }
    setShowForm(false);
    setForm({ name: "", dosage: "", timing: "Morning", category: "Protein", notes: "" });
  }

  function deleteSupp(id: string) {
    saveSupps(supplements.filter((s) => s.id !== id));
    saveLogs(logs.filter((l) => l.supplementId !== id));
  }

  function toggleLog(supp: Supplement) {
    const existing = logs.find((l) => l.supplementId === supp.id && l.date === selectedDate);
    if (existing) {
      saveLogs(logs.map((l) => l.id === existing.id ? { ...l, taken: !l.taken } : l));
    } else {
      const newLog: SupplementLog = {
        id: makeId(), date: selectedDate, supplementId: supp.id,
        supplementName: supp.name, taken: true,
        time: new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }),
      };
      saveLogs([...logs, newLog]);
    }
  }

  const dayLogs = logs.filter((l) => l.date === selectedDate);
  const takenIds = new Set(dayLogs.filter((l) => l.taken).map((l) => l.supplementId));
  const takenCount = takenIds.size;

  const catColors: Record<string, string> = {
    Protein: "badge-green", Creatine: "badge-blue", "Pre-Workout": "badge-red",
    Recovery: "badge-yellow", Vitamins: "badge-purple", Electrolytes: "badge-blue",
    Performance: "badge-green", Other: "",
  };

  return (
    <div style={{ padding: "2rem", maxWidth: "1000px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
        <div>
          <h1 style={{ fontSize: "1.6rem", fontWeight: 900, letterSpacing: "-0.03em" }}>💊 Supplements</h1>
          <p style={{ color: "#666", fontSize: "0.82rem", marginTop: "0.2rem" }}>{supplements.length} supplements · {takenCount} taken today</p>
        </div>
        <button className="btn-primary" onClick={() => { setShowForm(true); setEditId(null); setForm({ name: "", dosage: "", timing: "Morning", category: "Protein", notes: "" }); }}>
          + Add Supplement
        </button>
      </div>

      {/* Date + tracker */}
      <div className="card" style={{ marginBottom: "1.5rem" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
          <h2 style={{ fontWeight: 700, fontSize: "0.95rem" }}>📅 Daily Tracker</h2>
          <input type="date" className="input" style={{ width: "auto" }} value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} />
        </div>
        {supplements.length === 0 ? (
          <p style={{ color: "#555", fontSize: "0.82rem" }}>Add supplements to start tracking.</p>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: "0.6rem" }}>
            {supplements.map((s) => {
              const taken = takenIds.has(s.id);
              return (
                <div key={s.id}
                  onClick={() => toggleLog(s)}
                  style={{
                    padding: "0.75rem 1rem", borderRadius: "10px", cursor: "pointer",
                    background: taken ? "rgba(34,197,94,0.1)" : "#1a1a1a",
                    border: taken ? "1px solid rgba(34,197,94,0.4)" : "1px solid #2a2a2a",
                    transition: "all 0.15s", display: "flex", alignItems: "center", gap: "0.75rem",
                  }}
                >
                  <span style={{ fontSize: "1.3rem" }}>{taken ? "✅" : "⬜"}</span>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: "0.85rem", color: taken ? "#22c55e" : "#f0f0f0" }}>{s.name}</div>
                    <div style={{ fontSize: "0.7rem", color: "#666" }}>{s.dosage} · {s.timing}</div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
        {supplements.length > 0 && (
          <div style={{ marginTop: "1rem" }}>
            <div className="progress-bar">
              <div className="progress-fill" style={{ width: `${(takenCount / supplements.length) * 100}%` }} />
            </div>
            <div style={{ fontSize: "0.72rem", color: "#666", marginTop: "0.3rem" }}>{takenCount}/{supplements.length} taken</div>
          </div>
        )}
      </div>

      {/* Form Modal */}
      {showForm && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem" }}>
          <div style={{ background: "#111", border: "1px solid #2a2a2a", borderRadius: "16px", padding: "1.5rem", width: "100%", maxWidth: "480px" }}>
            <h2 style={{ fontWeight: 800, marginBottom: "1.25rem" }}>{editId ? "Edit Supplement" : "Add Supplement"}</h2>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem", marginBottom: "1rem" }}>
              <div>
                <label style={{ fontSize: "0.75rem", color: "#888", display: "block", marginBottom: "0.3rem" }}>Name *</label>
                <input className="input" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="e.g. Whey Protein" />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.6rem" }}>
                <div>
                  <label style={{ fontSize: "0.75rem", color: "#888", display: "block", marginBottom: "0.3rem" }}>Dosage</label>
                  <input className="input" value={form.dosage} onChange={(e) => setForm((f) => ({ ...f, dosage: e.target.value }))} placeholder="e.g. 30g" />
                </div>
                <div>
                  <label style={{ fontSize: "0.75rem", color: "#888", display: "block", marginBottom: "0.3rem" }}>Category</label>
                  <select className="select" style={{ width: "100%" }} value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}>
                    {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: "0.75rem", color: "#888", display: "block", marginBottom: "0.3rem" }}>Timing</label>
                  <select className="select" style={{ width: "100%" }} value={form.timing} onChange={(e) => setForm((f) => ({ ...f, timing: e.target.value }))}>
                    {TIMINGS.map((t) => <option key={t}>{t}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label style={{ fontSize: "0.75rem", color: "#888", display: "block", marginBottom: "0.3rem" }}>Notes</label>
                <input className="input" value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} placeholder="Brand, instructions, etc." />
              </div>
            </div>
            <div style={{ display: "flex", gap: "0.75rem", justifyContent: "flex-end" }}>
              <button className="btn-ghost" onClick={() => { setShowForm(false); setEditId(null); }}>Cancel</button>
              <button className="btn-primary" onClick={submit}>Save</button>
            </div>
          </div>
        </div>
      )}

      {/* Supplement list */}
      <div>
        <h2 style={{ fontWeight: 700, fontSize: "0.95rem", marginBottom: "0.75rem" }}>Your Stack</h2>
        {supplements.length === 0 ? (
          <div className="card" style={{ textAlign: "center", padding: "2.5rem" }}>
            <div style={{ fontSize: "3rem", marginBottom: "0.75rem" }}>💊</div>
            <p style={{ color: "#666" }}>No supplements added yet.</p>
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: "0.75rem" }}>
            {supplements.map((s) => (
              <div key={s.id} className="card">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "0.5rem" }}>
                  <h3 style={{ fontWeight: 700, fontSize: "0.9rem" }}>{s.name}</h3>
                  <span className={`badge ${catColors[s.category] || "badge-blue"}`}>{s.category}</span>
                </div>
                <div style={{ fontSize: "0.78rem", color: "#aaa", marginBottom: "0.4rem" }}>{s.dosage} · {s.timing}</div>
                {s.notes && <div style={{ fontSize: "0.72rem", color: "#666", marginBottom: "0.75rem" }}>{s.notes}</div>}
                <div style={{ display: "flex", gap: "0.5rem" }}>
                  <button className="btn-ghost" style={{ flex: 1, fontSize: "0.75rem", padding: "0.3rem 0.5rem" }}
                    onClick={() => { setForm({ name: s.name, dosage: s.dosage, timing: s.timing, category: s.category, notes: s.notes }); setEditId(s.id); setShowForm(true); }}>
                    Edit
                  </button>
                  <button className="btn-ghost" style={{ flex: 1, fontSize: "0.75rem", padding: "0.3rem 0.5rem", color: "#ef4444" }}
                    onClick={() => deleteSupp(s.id)}>
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
