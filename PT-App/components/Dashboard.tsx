"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { getItem } from "@/lib/store";
import type { Session, NutritionDay, JournalEntry, SupplementLog } from "@/lib/store";

const today = new Date().toISOString().split("T")[0];

export default function Dashboard() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [nutrition, setNutrition] = useState<NutritionDay | null>(null);
  const [journals, setJournals] = useState<JournalEntry[]>([]);
  const [suppLogs, setSuppLogs] = useState<SupplementLog[]>([]);

  useEffect(() => {
    setSessions(getItem<Session[]>("gym_sessions", []));
    const days = getItem<NutritionDay[]>("nutrition_days", []);
    setNutrition(days.find((d) => d.date === today) || null);
    setJournals(getItem<JournalEntry[]>("journal_entries", []));
    setSuppLogs(getItem<SupplementLog[]>("supplement_logs", []).filter((l) => l.date === today));
  }, []);

  const recentSessions = sessions.slice(-3).reverse();
  const totalCalories = nutrition?.entries.reduce((s, e) => s + e.calories * e.quantity, 0) ?? 0;
  const totalProtein = nutrition?.entries.reduce((s, e) => s + e.protein * e.quantity, 0) ?? 0;
  const suppTaken = suppLogs.filter((l) => l.taken).length;

  const cards = [
    {
      href: "/sessions",
      icon: "🏋️",
      label: "Gym Sessions",
      value: sessions.length,
      sub: "total sessions logged",
      color: "#22c55e",
    },
    {
      href: "/nutrition",
      icon: "🥗",
      label: "Calories Today",
      value: Math.round(totalCalories),
      sub: `${Math.round(totalProtein)}g protein`,
      color: "#f59e0b",
    },
    {
      href: "/supplements",
      icon: "💊",
      label: "Supplements",
      value: suppTaken,
      sub: "taken today",
      color: "#60a5fa",
    },
    {
      href: "/journal",
      icon: "📓",
      label: "Journal",
      value: journals.length,
      sub: "entries written",
      color: "#c084fc",
    },
  ];

  return (
    <div style={{ padding: "2rem", maxWidth: "1100px" }}>
      {/* Header */}
      <div style={{ marginBottom: "2rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "0.5rem" }}>
          <span style={{ fontSize: "2.5rem" }}>💪</span>
          <div>
            <h1 style={{ fontSize: "2rem", fontWeight: 900, letterSpacing: "-0.03em", lineHeight: 1 }}>
              MONSER&apos;S GYM
            </h1>
            <p style={{ color: "#666", fontSize: "0.85rem", marginTop: "0.2rem" }}>
              Elite Rugby PT Platform — {new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
            </p>
          </div>
        </div>
      </div>

      {/* Stat cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: "1rem", marginBottom: "2rem" }}>
        {cards.map((c) => (
          <Link key={c.href} href={c.href} style={{ textDecoration: "none" }}>
            <div
              className="stat-card"
              style={{ cursor: "pointer", transition: "border-color 0.15s" }}
              onMouseEnter={(e) => (e.currentTarget.style.borderColor = c.color)}
              onMouseLeave={(e) => (e.currentTarget.style.borderColor = "#1e1e1e")}
            >
              <span style={{ fontSize: "1.5rem" }}>{c.icon}</span>
              <div style={{ fontSize: "2rem", fontWeight: 900, color: c.color, lineHeight: 1.1 }}>{c.value}</div>
              <div style={{ fontWeight: 600, fontSize: "0.85rem" }}>{c.label}</div>
              <div style={{ fontSize: "0.75rem", color: "#666" }}>{c.sub}</div>
            </div>
          </Link>
        ))}
      </div>

      {/* Quick links */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: "1.5rem", marginBottom: "2rem" }}>
        {/* Recent Sessions */}
        <div className="card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
            <h2 style={{ fontWeight: 700, fontSize: "0.95rem" }}>🏋️ Recent Sessions</h2>
            <Link href="/sessions" style={{ color: "#22c55e", fontSize: "0.75rem", textDecoration: "none" }}>View all →</Link>
          </div>
          {recentSessions.length === 0 ? (
            <p style={{ color: "#555", fontSize: "0.8rem" }}>No sessions yet. Start training!</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
              {recentSessions.map((s) => (
                <div key={s.id} style={{ padding: "0.6rem 0.75rem", background: "#1a1a1a", borderRadius: "8px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <div style={{ fontSize: "0.85rem", fontWeight: 600 }}>{s.title}</div>
                    <div style={{ fontSize: "0.7rem", color: "#666" }}>{s.date} · {s.duration}min</div>
                  </div>
                  <span className="badge badge-green">{s.type}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Today's Nutrition */}
        <div className="card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
            <h2 style={{ fontWeight: 700, fontSize: "0.95rem" }}>🥗 Today&apos;s Nutrition</h2>
            <Link href="/nutrition" style={{ color: "#22c55e", fontSize: "0.75rem", textDecoration: "none" }}>Track →</Link>
          </div>
          {totalCalories === 0 ? (
            <p style={{ color: "#555", fontSize: "0.8rem" }}>No food logged today.</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
              {[
                { label: "Calories", value: Math.round(totalCalories), target: 2800, color: "#f59e0b", unit: "kcal" },
                { label: "Protein", value: Math.round(totalProtein), target: 180, color: "#22c55e", unit: "g" },
              ].map((m) => (
                <div key={m.label}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.25rem", fontSize: "0.75rem" }}>
                    <span style={{ color: "#aaa" }}>{m.label}</span>
                    <span style={{ color: m.color, fontWeight: 700 }}>{m.value}{m.unit}</span>
                  </div>
                  <div className="progress-bar">
                    <div className="progress-fill" style={{ width: `${Math.min(100, (m.value / m.target) * 100)}%`, background: m.color }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Bottom row */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: "1.5rem" }}>
        {/* Quick nav tiles */}
        {[
          { href: "/recipes", icon: "🍳", label: "Recipes", desc: "Browse your diet-matched recipe library" },
          { href: "/skittles", icon: "🏉", label: "Skittles 1:1", desc: "Connect with athletes · PT messaging hub" },
        ].map((t) => (
          <Link key={t.href} href={t.href} style={{ textDecoration: "none" }}>
            <div
              className="card"
              style={{ cursor: "pointer", transition: "border-color 0.15s", display: "flex", alignItems: "center", gap: "1rem" }}
              onMouseEnter={(e) => (e.currentTarget.style.borderColor = "#22c55e")}
              onMouseLeave={(e) => (e.currentTarget.style.borderColor = "#1e1e1e")}
            >
              <span style={{ fontSize: "2rem" }}>{t.icon}</span>
              <div>
                <div style={{ fontWeight: 700, fontSize: "0.9rem" }}>{t.label}</div>
                <div style={{ fontSize: "0.75rem", color: "#666", marginTop: "0.1rem" }}>{t.desc}</div>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
