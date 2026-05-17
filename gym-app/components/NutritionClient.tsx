"use client";
import { useEffect, useState } from "react";
import { getItem, setItem } from "@/lib/store";
import type { NutritionDay, FoodEntry } from "@/lib/store";

const MEALS = ["breakfast", "lunch", "dinner", "snack", "pre-workout", "post-workout"] as const;
const MEAL_ICONS: Record<string, string> = {
  breakfast: "🌅", lunch: "☀️", dinner: "🌙", snack: "🍎", "pre-workout": "⚡", "post-workout": "💪",
};

function makeId() { return Math.random().toString(36).slice(2, 10); }

const emptyEntry = (): Omit<FoodEntry, "id"> => ({
  name: "", calories: 0, protein: 0, carbs: 0, fat: 0, quantity: 1, unit: "serving", meal: "lunch",
});

const GOALS = { calories: 2800, protein: 180, carbs: 300, fat: 90, water: 3 };

export default function NutritionClient() {
  const [days, setDays] = useState<NutritionDay[]>([]);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split("T")[0]);
  const [showForm, setShowForm] = useState(false);
  const [editEntryId, setEditEntryId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyEntry());

  useEffect(() => { setDays(getItem<NutritionDay[]>("nutrition_days", [])); }, []);

  function saveDays(list: NutritionDay[]) { setDays(list); setItem("nutrition_days", list); }

  function getDay(): NutritionDay {
    return days.find((d) => d.date === selectedDate) ?? { id: makeId(), date: selectedDate, entries: [], waterLitres: 0, notes: "" };
  }

  function updateDay(updated: NutritionDay) {
    const existing = days.find((d) => d.date === selectedDate);
    if (existing) saveDays(days.map((d) => d.date === selectedDate ? updated : d));
    else saveDays([...days, updated]);
  }

  function submitEntry() {
    if (!form.name.trim()) return;
    const day = getDay();
    if (editEntryId) {
      updateDay({ ...day, entries: day.entries.map((e) => e.id === editEntryId ? { ...form, id: editEntryId } : e) });
      setEditEntryId(null);
    } else {
      updateDay({ ...day, entries: [...day.entries, { ...form, id: makeId() }] });
    }
    setShowForm(false);
    setForm(emptyEntry());
  }

  function deleteEntry(id: string) {
    const day = getDay();
    updateDay({ ...day, entries: day.entries.filter((e) => e.id !== id) });
  }

  function setWater(v: number) {
    const day = getDay();
    updateDay({ ...day, waterLitres: Math.max(0, v) });
  }

  const day = getDay();
  const totals = day.entries.reduce((acc, e) => ({
    calories: acc.calories + e.calories * e.quantity,
    protein: acc.protein + e.protein * e.quantity,
    carbs: acc.carbs + e.carbs * e.quantity,
    fat: acc.fat + e.fat * e.quantity,
  }), { calories: 0, protein: 0, carbs: 0, fat: 0 });

  const macros = [
    { label: "Calories", value: Math.round(totals.calories), goal: GOALS.calories, color: "#f59e0b", unit: "kcal" },
    { label: "Protein", value: Math.round(totals.protein), goal: GOALS.protein, color: "#22c55e", unit: "g" },
    { label: "Carbs", value: Math.round(totals.carbs), goal: GOALS.carbs, color: "#60a5fa", unit: "g" },
    { label: "Fat", value: Math.round(totals.fat), goal: GOALS.fat, color: "#f87171", unit: "g" },
  ];

  return (
    <div style={{ padding: "2rem", maxWidth: "1000px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
        <div>
          <h1 style={{ fontSize: "1.6rem", fontWeight: 900, letterSpacing: "-0.03em" }}>🥗 Daily Nutrition</h1>
          <p style={{ color: "#666", fontSize: "0.82rem", marginTop: "0.2rem" }}>Track macros · Hit your rugby performance targets</p>
        </div>
        <div style={{ display: "flex", gap: "0.75rem", alignItems: "center" }}>
          <input type="date" className="input" style={{ width: "auto" }} value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} />
          <button className="btn-primary" onClick={() => { setShowForm(true); setEditEntryId(null); setForm(emptyEntry()); }}>+ Add Food</button>
        </div>
      </div>

      {/* Macro summary */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: "0.75rem", marginBottom: "1.5rem" }}>
        {macros.map((m) => (
          <div key={m.label} className="stat-card">
            <div style={{ fontSize: "1.4rem", fontWeight: 900, color: m.color }}>{m.value}<span style={{ fontSize: "0.8rem", fontWeight: 400, color: "#666" }}>{m.unit}</span></div>
            <div style={{ fontSize: "0.8rem", fontWeight: 600, color: "#aaa" }}>{m.label}</div>
            <div className="progress-bar" style={{ marginTop: "0.3rem" }}>
              <div className="progress-fill" style={{ width: `${Math.min(100, (m.value / m.goal) * 100)}%`, background: m.color }} />
            </div>
            <div style={{ fontSize: "0.65rem", color: "#555" }}>Goal: {m.goal}{m.unit}</div>
          </div>
        ))}
      </div>

      {/* Water tracker */}
      <div className="card" style={{ marginBottom: "1.5rem", display: "flex", alignItems: "center", gap: "1.5rem" }}>
        <span style={{ fontSize: "1.8rem" }}>💧</span>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 600, fontSize: "0.9rem", marginBottom: "0.4rem" }}>Water Intake</div>
          <div className="progress-bar">
            <div className="progress-fill" style={{ width: `${Math.min(100, (day.waterLitres / GOALS.water) * 100)}%`, background: "#60a5fa" }} />
          </div>
          <div style={{ fontSize: "0.72rem", color: "#666", marginTop: "0.2rem" }}>{day.waterLitres.toFixed(1)}L / {GOALS.water}L goal</div>
        </div>
        <div style={{ display: "flex", gap: "0.5rem" }}>
          <button className="btn-ghost" style={{ padding: "0.35rem 0.75rem", fontSize: "0.82rem" }} onClick={() => setWater(+(day.waterLitres - 0.25).toFixed(2))}>−250ml</button>
          <button className="btn-ghost" style={{ padding: "0.35rem 0.75rem", fontSize: "0.82rem" }} onClick={() => setWater(+(day.waterLitres + 0.25).toFixed(2))}>+250ml</button>
          <button className="btn-ghost" style={{ padding: "0.35rem 0.75rem", fontSize: "0.82rem" }} onClick={() => setWater(+(day.waterLitres + 0.5).toFixed(2))}>+500ml</button>
        </div>
      </div>

      {/* Food entries by meal */}
      {MEALS.map((meal) => {
        const entries = day.entries.filter((e) => e.meal === meal);
        if (entries.length === 0) return null;
        const mealCals = entries.reduce((s, e) => s + e.calories * e.quantity, 0);
        const mealProt = entries.reduce((s, e) => s + e.protein * e.quantity, 0);
        return (
          <div key={meal} className="card" style={{ marginBottom: "0.75rem" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem" }}>
              <h3 style={{ fontWeight: 700, fontSize: "0.9rem" }}>{MEAL_ICONS[meal]} {meal.charAt(0).toUpperCase() + meal.slice(1)}</h3>
              <span style={{ fontSize: "0.75rem", color: "#666" }}>{Math.round(mealCals)} kcal · {Math.round(mealProt)}g protein</span>
            </div>
            {entries.map((e) => (
              <div key={e.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0.5rem 0", borderBottom: "1px solid #1a1a1a" }}>
                <div>
                  <span style={{ fontSize: "0.85rem", fontWeight: 500 }}>{e.name}</span>
                  <span style={{ fontSize: "0.72rem", color: "#666", marginLeft: "0.5rem" }}>{e.quantity} {e.unit}</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                  <span style={{ fontSize: "0.78rem", color: "#aaa" }}>{Math.round(e.calories * e.quantity)} kcal · P:{Math.round(e.protein * e.quantity)}g</span>
                  <button onClick={() => { setForm({ ...e }); setEditEntryId(e.id); setShowForm(true); }} style={{ background: "none", border: "none", color: "#666", cursor: "pointer", fontSize: "0.75rem" }}>✏️</button>
                  <button onClick={() => deleteEntry(e.id)} style={{ background: "none", border: "none", color: "#ef4444", cursor: "pointer", fontSize: "0.75rem" }}>✕</button>
                </div>
              </div>
            ))}
          </div>
        );
      })}

      {day.entries.length === 0 && (
        <div className="card" style={{ textAlign: "center", padding: "3rem" }}>
          <div style={{ fontSize: "3rem", marginBottom: "0.75rem" }}>🥗</div>
          <p style={{ color: "#666", marginBottom: "1rem" }}>No food logged for this day.</p>
          <button className="btn-primary" onClick={() => setShowForm(true)}>Log Your First Meal</button>
        </div>
      )}

      {/* Form Modal */}
      {showForm && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem" }}>
          <div style={{ background: "#111", border: "1px solid #2a2a2a", borderRadius: "16px", padding: "1.5rem", width: "100%", maxWidth: "480px" }}>
            <h2 style={{ fontWeight: 800, marginBottom: "1.25rem" }}>{editEntryId ? "Edit Food" : "Add Food"}</h2>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem", marginBottom: "1rem" }}>
              <div>
                <label style={{ fontSize: "0.75rem", color: "#888", display: "block", marginBottom: "0.3rem" }}>Food Name *</label>
                <input className="input" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="e.g. Chicken Breast" />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.6rem" }}>
                <div>
                  <label style={{ fontSize: "0.75rem", color: "#888", display: "block", marginBottom: "0.3rem" }}>Quantity</label>
                  <input className="input" type="number" min={0.1} step={0.5} value={form.quantity} onChange={(e) => setForm((f) => ({ ...f, quantity: +e.target.value }))} />
                </div>
                <div>
                  <label style={{ fontSize: "0.75rem", color: "#888", display: "block", marginBottom: "0.3rem" }}>Unit</label>
                  <input className="input" value={form.unit} onChange={(e) => setForm((f) => ({ ...f, unit: e.target.value }))} placeholder="serving, g, cup..." />
                </div>
                <div>
                  <label style={{ fontSize: "0.75rem", color: "#888", display: "block", marginBottom: "0.3rem" }}>Calories (per unit)</label>
                  <input className="input" type="number" min={0} value={form.calories} onChange={(e) => setForm((f) => ({ ...f, calories: +e.target.value }))} />
                </div>
                <div>
                  <label style={{ fontSize: "0.75rem", color: "#888", display: "block", marginBottom: "0.3rem" }}>Protein g (per unit)</label>
                  <input className="input" type="number" min={0} value={form.protein} onChange={(e) => setForm((f) => ({ ...f, protein: +e.target.value }))} />
                </div>
                <div>
                  <label style={{ fontSize: "0.75rem", color: "#888", display: "block", marginBottom: "0.3rem" }}>Carbs g</label>
                  <input className="input" type="number" min={0} value={form.carbs} onChange={(e) => setForm((f) => ({ ...f, carbs: +e.target.value }))} />
                </div>
                <div>
                  <label style={{ fontSize: "0.75rem", color: "#888", display: "block", marginBottom: "0.3rem" }}>Fat g</label>
                  <input className="input" type="number" min={0} value={form.fat} onChange={(e) => setForm((f) => ({ ...f, fat: +e.target.value }))} />
                </div>
              </div>
              <div>
                <label style={{ fontSize: "0.75rem", color: "#888", display: "block", marginBottom: "0.3rem" }}>Meal</label>
                <select className="select" style={{ width: "100%" }} value={form.meal} onChange={(e) => setForm((f) => ({ ...f, meal: e.target.value as FoodEntry["meal"] }))}>
                  {MEALS.map((m) => <option key={m} value={m}>{MEAL_ICONS[m]} {m.charAt(0).toUpperCase() + m.slice(1)}</option>)}
                </select>
              </div>
            </div>
            <div style={{ display: "flex", gap: "0.75rem", justifyContent: "flex-end" }}>
              <button className="btn-ghost" onClick={() => { setShowForm(false); setEditEntryId(null); }}>Cancel</button>
              <button className="btn-primary" onClick={submitEntry}>Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
