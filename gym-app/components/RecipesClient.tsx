"use client";
import { useEffect, useState } from "react";
import { getItem, setItem } from "@/lib/store";
import type { Recipe } from "@/lib/store";

const CATEGORIES = ["High Protein", "Pre-Match", "Recovery", "Bulking", "Cutting", "Snack", "Breakfast", "Meal Prep"];
const SEED_RECIPES: Recipe[] = [
  {
    id: "r1", title: "Rugby Recovery Smoothie", category: "Recovery", prepTime: 5, cookTime: 0, servings: 1,
    calories: 420, protein: 40, carbs: 52, fat: 6,
    ingredients: ["2 scoops whey protein", "1 banana", "200ml oat milk", "50g frozen berries", "1 tbsp peanut butter", "Ice cubes"],
    instructions: ["Add all ingredients to a blender.", "Blend until smooth (30–60 sec).", "Consume within 30 mins post-training."],
    tags: ["quick", "post-workout", "high-protein"], createdAt: new Date().toISOString(),
  },
  {
    id: "r2", title: "Game Day Chicken & Rice", category: "Pre-Match", prepTime: 10, cookTime: 25, servings: 2,
    calories: 680, protein: 55, carbs: 78, fat: 8,
    ingredients: ["300g chicken breast", "200g basmati rice (dry)", "1 tbsp olive oil", "2 cloves garlic", "Paprika, cumin, salt", "Steamed broccoli"],
    instructions: ["Season chicken with paprika, cumin, and salt.", "Cook rice according to package.", "Sear chicken in olive oil with garlic 6-7 min each side.", "Rest chicken 5 min, slice.", "Serve on rice with broccoli."],
    tags: ["game-day", "high-carb", "lean"], createdAt: new Date().toISOString(),
  },
  {
    id: "r3", title: "Muscle Building Overnight Oats", category: "Breakfast", prepTime: 5, cookTime: 0, servings: 1,
    calories: 520, protein: 35, carbs: 65, fat: 10,
    ingredients: ["80g rolled oats", "250ml milk", "1 scoop vanilla protein", "1 tbsp chia seeds", "Honey to taste", "Toppings: nuts, berries"],
    instructions: ["Mix oats, milk, protein powder and chia seeds.", "Stir well, cover and refrigerate overnight.", "Top with honey, nuts, and berries in the morning."],
    tags: ["breakfast", "meal-prep", "high-protein"], createdAt: new Date().toISOString(),
  },
  {
    id: "r4", title: "Lean Beef Stir Fry", category: "High Protein", prepTime: 15, cookTime: 10, servings: 2,
    calories: 560, protein: 48, carbs: 40, fat: 14,
    ingredients: ["300g lean beef strips", "1 red pepper", "1 head broccoli", "2 tbsp soy sauce", "1 tbsp sesame oil", "2 cloves garlic", "1 tsp ginger", "150g egg noodles"],
    instructions: ["Cook noodles, set aside.", "Stir fry beef in sesame oil 3-4 min.", "Add garlic and ginger.", "Add veg and soy sauce, cook 3-4 more min.", "Mix in noodles and serve."],
    tags: ["high-protein", "quick", "iron-rich"], createdAt: new Date().toISOString(),
  },
  {
    id: "r5", title: "Pre-Training Energy Balls", category: "Snack", prepTime: 15, cookTime: 0, servings: 8,
    calories: 140, protein: 8, carbs: 18, fat: 5,
    ingredients: ["200g medjool dates", "100g oats", "2 tbsp peanut butter", "1 scoop protein powder", "2 tbsp cocoa powder", "1 tbsp honey"],
    instructions: ["Blend dates until paste.", "Mix all ingredients together.", "Roll into balls (approx 30g each).", "Refrigerate 30 min before serving.", "Store in fridge up to 5 days."],
    tags: ["pre-workout", "snack", "energy"], createdAt: new Date().toISOString(),
  },
];

function makeId() { return Math.random().toString(36).slice(2, 10); }

const emptyRecipe = (): Omit<Recipe, "id" | "createdAt"> => ({
  title: "", category: "High Protein", prepTime: 10, cookTime: 20, servings: 2,
  calories: 0, protein: 0, carbs: 0, fat: 0,
  ingredients: [""], instructions: [""], tags: [],
});

export default function RecipesClient() {
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [filter, setFilter] = useState("All");
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [viewRecipe, setViewRecipe] = useState<Recipe | null>(null);
  const [form, setForm] = useState(emptyRecipe());
  const [editId, setEditId] = useState<string | null>(null);

  useEffect(() => {
    const stored = getItem<Recipe[]>("recipes", []);
    if (stored.length === 0) {
      setRecipes(SEED_RECIPES);
      setItem("recipes", SEED_RECIPES);
    } else {
      setRecipes(stored);
    }
  }, []);

  function saveRecipes(list: Recipe[]) { setRecipes(list); setItem("recipes", list); }

  function submit() {
    if (!form.title.trim()) return;
    const recipe: Recipe = { ...form, id: editId ?? makeId(), createdAt: new Date().toISOString() };
    if (editId) saveRecipes(recipes.map((r) => r.id === editId ? recipe : r));
    else saveRecipes([...recipes, recipe]);
    setShowForm(false);
    setEditId(null);
    setForm(emptyRecipe());
  }

  const filtered = recipes.filter((r) => {
    const matchCat = filter === "All" || r.category === filter;
    const matchSearch = !search || r.title.toLowerCase().includes(search.toLowerCase()) || r.tags.some((t) => t.includes(search.toLowerCase()));
    return matchCat && matchSearch;
  });

  const catColors: Record<string, string> = {
    "High Protein": "badge-green", "Pre-Match": "badge-yellow", "Recovery": "badge-blue",
    "Bulking": "badge-red", "Cutting": "badge-purple", "Snack": "badge-yellow",
    "Breakfast": "badge-blue", "Meal Prep": "badge-green",
  };

  return (
    <div style={{ padding: "2rem", maxWidth: "1100px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
        <div>
          <h1 style={{ fontSize: "1.6rem", fontWeight: 900, letterSpacing: "-0.03em" }}>🍳 Recipes</h1>
          <p style={{ color: "#666", fontSize: "0.82rem", marginTop: "0.2rem" }}>Performance nutrition · Rugby-optimised recipes</p>
        </div>
        <button className="btn-primary" onClick={() => { setShowForm(true); setEditId(null); setForm(emptyRecipe()); }}>+ Add Recipe</button>
      </div>

      {/* Filters */}
      <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", marginBottom: "1rem" }}>
        <input className="input" style={{ maxWidth: "220px" }} placeholder="Search recipes..." value={search} onChange={(e) => setSearch(e.target.value)} />
        {["All", ...CATEGORIES].map((c) => (
          <button key={c}
            onClick={() => setFilter(c)}
            style={{
              padding: "0.35rem 0.875rem", borderRadius: "999px", fontSize: "0.78rem", fontWeight: 600,
              border: "1px solid", cursor: "pointer",
              background: filter === c ? "#22c55e" : "transparent",
              color: filter === c ? "#000" : "#888",
              borderColor: filter === c ? "#22c55e" : "#333",
              transition: "all 0.15s",
            }}
          >{c}</button>
        ))}
      </div>

      {/* Recipe grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "1rem" }}>
        {filtered.map((r) => (
          <div key={r.id} className="card" style={{ cursor: "pointer", transition: "border-color 0.15s" }}
            onMouseEnter={(e) => (e.currentTarget.style.borderColor = "#22c55e")}
            onMouseLeave={(e) => (e.currentTarget.style.borderColor = "#1e1e1e")}
            onClick={() => setViewRecipe(r)}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "0.5rem" }}>
              <h3 style={{ fontWeight: 700, fontSize: "0.9rem", lineHeight: 1.3 }}>{r.title}</h3>
              <span className={`badge ${catColors[r.category] || "badge-blue"}`}>{r.category}</span>
            </div>
            <div style={{ display: "flex", gap: "0.75rem", fontSize: "0.72rem", color: "#666", marginBottom: "0.75rem" }}>
              <span>⏱ {r.prepTime + r.cookTime}min</span>
              <span>👤 {r.servings} srv</span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "0.4rem" }}>
              {[{ l: "Cal", v: r.calories, c: "#f59e0b" }, { l: "P", v: r.protein + "g", c: "#22c55e" }, { l: "C", v: r.carbs + "g", c: "#60a5fa" }, { l: "F", v: r.fat + "g", c: "#f87171" }].map((m) => (
                <div key={m.l} style={{ textAlign: "center", background: "#1a1a1a", borderRadius: "6px", padding: "0.3rem" }}>
                  <div style={{ fontSize: "0.8rem", fontWeight: 700, color: m.c }}>{m.v}</div>
                  <div style={{ fontSize: "0.6rem", color: "#555" }}>{m.l}</div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Recipe detail modal */}
      {viewRecipe && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.88)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem" }}>
          <div style={{ background: "#111", border: "1px solid #2a2a2a", borderRadius: "16px", padding: "1.75rem", width: "100%", maxWidth: "600px", maxHeight: "90vh", overflowY: "auto" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "0.5rem" }}>
              <h2 style={{ fontWeight: 800, fontSize: "1.3rem" }}>{viewRecipe.title}</h2>
              <button onClick={() => setViewRecipe(null)} style={{ background: "none", border: "none", color: "#888", cursor: "pointer", fontSize: "1.3rem" }}>✕</button>
            </div>
            <span className={`badge ${catColors[viewRecipe.category] || "badge-blue"}`} style={{ marginBottom: "1rem", display: "inline-block" }}>{viewRecipe.category}</span>
            <div style={{ display: "flex", gap: "1rem", fontSize: "0.8rem", color: "#888", marginBottom: "1rem" }}>
              <span>⏱ Prep: {viewRecipe.prepTime}min</span>
              <span>🔥 Cook: {viewRecipe.cookTime}min</span>
              <span>👤 Serves: {viewRecipe.servings}</span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "0.5rem", marginBottom: "1.25rem" }}>
              {[{ l: "Calories", v: viewRecipe.calories, c: "#f59e0b" }, { l: "Protein", v: viewRecipe.protein + "g", c: "#22c55e" }, { l: "Carbs", v: viewRecipe.carbs + "g", c: "#60a5fa" }, { l: "Fat", v: viewRecipe.fat + "g", c: "#f87171" }].map((m) => (
                <div key={m.l} style={{ textAlign: "center", background: "#1a1a1a", borderRadius: "8px", padding: "0.5rem" }}>
                  <div style={{ fontSize: "1rem", fontWeight: 800, color: m.c }}>{m.v}</div>
                  <div style={{ fontSize: "0.65rem", color: "#555" }}>{m.l}</div>
                </div>
              ))}
            </div>
            <h3 style={{ fontWeight: 700, fontSize: "0.85rem", marginBottom: "0.5rem" }}>🛒 Ingredients</h3>
            <ul style={{ marginBottom: "1.25rem", paddingLeft: "1rem" }}>
              {viewRecipe.ingredients.map((ing, i) => (
                <li key={i} style={{ fontSize: "0.82rem", color: "#ccc", marginBottom: "0.25rem" }}>{ing}</li>
              ))}
            </ul>
            <h3 style={{ fontWeight: 700, fontSize: "0.85rem", marginBottom: "0.5rem" }}>📋 Instructions</h3>
            <ol style={{ paddingLeft: "1rem" }}>
              {viewRecipe.instructions.map((step, i) => (
                <li key={i} style={{ fontSize: "0.82rem", color: "#ccc", marginBottom: "0.4rem", lineHeight: 1.5 }}>{step}</li>
              ))}
            </ol>
            {viewRecipe.tags.length > 0 && (
              <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap", marginTop: "1rem" }}>
                {viewRecipe.tags.map((t) => <span key={t} className="badge badge-green">#{t}</span>)}
              </div>
            )}
            <div style={{ display: "flex", gap: "0.75rem", marginTop: "1.25rem" }}>
              <button className="btn-ghost" style={{ flex: 1 }} onClick={() => { setForm({ ...viewRecipe }); setEditId(viewRecipe.id); setShowForm(true); setViewRecipe(null); }}>Edit</button>
              <button className="btn-ghost" style={{ flex: 1, color: "#ef4444" }} onClick={() => { saveRecipes(recipes.filter((r) => r.id !== viewRecipe.id)); setViewRecipe(null); }}>Delete</button>
            </div>
          </div>
        </div>
      )}

      {/* Add/Edit form */}
      {showForm && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.88)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem" }}>
          <div style={{ background: "#111", border: "1px solid #2a2a2a", borderRadius: "16px", padding: "1.5rem", width: "100%", maxWidth: "560px", maxHeight: "90vh", overflowY: "auto" }}>
            <h2 style={{ fontWeight: 800, marginBottom: "1.25rem" }}>{editId ? "Edit Recipe" : "New Recipe"}</h2>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.7rem", marginBottom: "1rem" }}>
              <div>
                <label style={{ fontSize: "0.75rem", color: "#888", display: "block", marginBottom: "0.3rem" }}>Title *</label>
                <input className="input" value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.6rem" }}>
                <div>
                  <label style={{ fontSize: "0.75rem", color: "#888", display: "block", marginBottom: "0.3rem" }}>Category</label>
                  <select className="select" style={{ width: "100%" }} value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}>
                    {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: "0.75rem", color: "#888", display: "block", marginBottom: "0.3rem" }}>Servings</label>
                  <input className="input" type="number" min={1} value={form.servings} onChange={(e) => setForm((f) => ({ ...f, servings: +e.target.value }))} />
                </div>
                {(["prepTime", "cookTime", "calories", "protein", "carbs", "fat"] as const).map((k) => (
                  <div key={k}>
                    <label style={{ fontSize: "0.75rem", color: "#888", display: "block", marginBottom: "0.3rem" }}>{k}</label>
                    <input className="input" type="number" min={0} value={form[k]} onChange={(e) => setForm((f) => ({ ...f, [k]: +e.target.value }))} />
                  </div>
                ))}
              </div>
              <div>
                <label style={{ fontSize: "0.75rem", color: "#888", display: "block", marginBottom: "0.3rem" }}>Ingredients (one per line)</label>
                <textarea className="textarea" rows={4} value={form.ingredients.join("\n")} onChange={(e) => setForm((f) => ({ ...f, ingredients: e.target.value.split("\n") }))} />
              </div>
              <div>
                <label style={{ fontSize: "0.75rem", color: "#888", display: "block", marginBottom: "0.3rem" }}>Instructions (one per line)</label>
                <textarea className="textarea" rows={4} value={form.instructions.join("\n")} onChange={(e) => setForm((f) => ({ ...f, instructions: e.target.value.split("\n") }))} />
              </div>
              <div>
                <label style={{ fontSize: "0.75rem", color: "#888", display: "block", marginBottom: "0.3rem" }}>Tags (comma-separated)</label>
                <input className="input" value={form.tags.join(", ")} onChange={(e) => setForm((f) => ({ ...f, tags: e.target.value.split(",").map((t) => t.trim()).filter(Boolean) }))} placeholder="high-protein, quick, post-workout" />
              </div>
            </div>
            <div style={{ display: "flex", gap: "0.75rem", justifyContent: "flex-end" }}>
              <button className="btn-ghost" onClick={() => { setShowForm(false); setEditId(null); }}>Cancel</button>
              <button className="btn-primary" onClick={submit}>Save Recipe</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
