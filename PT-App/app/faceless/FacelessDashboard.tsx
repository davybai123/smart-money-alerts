"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { getItem } from "@/lib/store";
import type { ContentPiece, ScheduledPost } from "@/lib/store";

const PLATFORM_COLORS: Record<string, string> = {
  youtube: "#ff0000",
  instagram: "#e1306c",
  tiktok: "#69c9d0",
  twitter: "#1d9bf0",
  facebook: "#1877f2",
};

const STATUS_COLORS: Record<string, string> = {
  idea: "#6b7280",
  scripted: "#3b82f6",
  recorded: "#f59e0b",
  edited: "#8b5cf6",
  scheduled: "#22c55e",
  posted: "#10b981",
};

export default function FacelessDashboard() {
  const [pieces, setPieces] = useState<ContentPiece[]>([]);
  const [posts, setPosts] = useState<ScheduledPost[]>([]);

  useEffect(() => {
    setPieces(getItem<ContentPiece[]>("content_pieces", []));
    setPosts(getItem<ScheduledPost[]>("scheduled_posts", []));
  }, []);

  const today = new Date().toISOString().split("T")[0];
  const totalViews = pieces.filter((p) => p.status === "posted").reduce((s, p) => s + (p.views || 0), 0);
  const estimatedRevenue = totalViews * 0.002;
  const posted = pieces.filter((p) => p.status === "posted").length;
  const scheduled = posts.filter((p) => p.status === "scheduled").length;
  const upcoming = posts.filter((p) => p.scheduledDate >= today && p.status !== "posted").length;

  const recentPieces = [...pieces].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 5);

  const platformBreakdown = ["youtube", "instagram", "tiktok", "twitter", "facebook"].map((p) => ({
    platform: p,
    count: pieces.filter((c) => c.platforms.includes(p)).length,
  })).filter((p) => p.count > 0);

  return (
    <div style={{ padding: "2rem", maxWidth: "1100px" }}>
      {/* Hero */}
      <div style={{ marginBottom: "2rem" }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: "1rem", marginBottom: "0.75rem" }}>
          <div style={{ fontSize: "3.5rem", lineHeight: 1 }}>🤖</div>
          <div>
            <h1 style={{ fontSize: "2.4rem", fontWeight: 900, letterSpacing: "-0.04em", lineHeight: 1, margin: 0 }}>
              FACELESS<span style={{ color: "#22c55e" }}>.</span>AI
            </h1>
            <p style={{ color: "#555", fontSize: "0.85rem", marginTop: "0.35rem", lineHeight: 1.5 }}>
              World Cup 2026 · AI content at scale · No face needed · 6+ billion viewers
            </p>
          </div>
        </div>

        {/* Goldmine banner */}
        <div style={{ padding: "0.875rem 1.25rem", background: "linear-gradient(90deg, rgba(245,158,11,0.12), rgba(34,197,94,0.08))", border: "1px solid rgba(245,158,11,0.2)", borderRadius: "10px", display: "flex", alignItems: "center", gap: "0.875rem" }}>
          <span style={{ fontSize: "1.5rem" }}>⚽</span>
          <div>
            <div style={{ fontWeight: 800, fontSize: "0.88rem", color: "#f59e0b" }}>This is a goldmine</div>
            <div style={{ fontSize: "0.76rem", color: "#888", marginTop: "0.1rem" }}>
              6+ billion viewers · 40 days straight · Claude creates the content · You collect the revenue
            </div>
          </div>
          <div style={{ marginLeft: "auto", textAlign: "right" }}>
            <div style={{ fontSize: "1.1rem", fontWeight: 900, color: "#22c55e" }}>$1–$3</div>
            <div style={{ fontSize: "0.65rem", color: "#666" }}>per 1,000 views</div>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(170px, 1fr))", gap: "1rem", marginBottom: "2rem" }}>
        {[
          { label: "Pieces Created", value: pieces.length, color: "#60a5fa", icon: "🎯" },
          { label: "Posted", value: posted, color: "#10b981", icon: "🚀" },
          { label: "Scheduled Posts", value: scheduled, color: "#22c55e", icon: "📅" },
          { label: "Upcoming", value: upcoming, color: "#f59e0b", icon: "⏳" },
          { label: "Total Views", value: totalViews > 0 ? totalViews.toLocaleString() : "—", color: "#f59e0b", icon: "👀" },
          { label: "Est. Revenue", value: totalViews > 0 ? `$${estimatedRevenue.toFixed(0)}` : "—", color: "#22c55e", icon: "💰" },
        ].map((s) => (
          <div key={s.label} className="stat-card">
            <span style={{ fontSize: "1.3rem" }}>{s.icon}</span>
            <div style={{ fontSize: "1.75rem", fontWeight: 900, color: s.color, lineHeight: 1.1 }}>{s.value}</div>
            <div style={{ fontSize: "0.72rem", color: "#666" }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Tool cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: "1.25rem", marginBottom: "2rem" }}>
        {[
          {
            href: "/content",
            icon: "⚡",
            label: "Content Generator",
            desc: "Paste a match — Claude writes the script, caption, or thread. 5 content types, 5 platforms.",
            accent: "#22c55e",
            cta: "Generate Content",
          },
          {
            href: "/pipeline",
            icon: "📊",
            label: "Pipeline Tracker",
            desc: "Kanban board from Idea → Posted. Track views and revenue per piece.",
            accent: "#3b82f6",
            cta: "View Pipeline",
          },
          {
            href: "/scheduler",
            icon: "📅",
            label: "Social Scheduler",
            desc: "Calendar view of your publish queue across YouTube, Instagram, TikTok, X and Facebook.",
            accent: "#f59e0b",
            cta: "Open Scheduler",
          },
        ].map((t) => (
          <Link key={t.href} href={t.href} style={{ textDecoration: "none" }}>
            <div
              className="card"
              style={{ cursor: "pointer", transition: "border-color 0.15s, transform 0.12s", height: "100%" }}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = t.accent; e.currentTarget.style.transform = "translateY(-2px)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = "#1e1e1e"; e.currentTarget.style.transform = "translateY(0)"; }}
            >
              <div style={{ fontSize: "2rem", marginBottom: "0.75rem" }}>{t.icon}</div>
              <div style={{ fontWeight: 800, fontSize: "1rem", marginBottom: "0.4rem" }}>{t.label}</div>
              <div style={{ fontSize: "0.78rem", color: "#666", lineHeight: 1.6, marginBottom: "1rem" }}>{t.desc}</div>
              <div style={{ fontSize: "0.78rem", fontWeight: 700, color: t.accent }}>
                {t.cta} →
              </div>
            </div>
          </Link>
        ))}
      </div>

      {/* Bottom row */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.5rem" }}>
        {/* Recent pieces */}
        <div className="card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
            <div style={{ fontWeight: 800, fontSize: "0.9rem" }}>🎬 Recent Pieces</div>
            <Link href="/pipeline" style={{ color: "#22c55e", fontSize: "0.75rem", textDecoration: "none" }}>View all →</Link>
          </div>
          {recentPieces.length === 0 ? (
            <div style={{ color: "#444", fontSize: "0.8rem" }}>No content yet. <Link href="/content" style={{ color: "#22c55e" }}>Generate your first piece →</Link></div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
              {recentPieces.map((p) => (
                <div key={p.id} style={{ padding: "0.5rem 0.75rem", background: "#1a1a1a", borderRadius: "8px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <div style={{ fontSize: "0.82rem", fontWeight: 600, color: "#ddd" }}>{p.title}</div>
                    <div style={{ fontSize: "0.68rem", color: "#555", marginTop: "0.1rem" }}>
                      {p.platforms.slice(0, 3).join(", ")}
                    </div>
                  </div>
                  <span style={{ fontSize: "0.65rem", fontWeight: 700, padding: "0.15rem 0.5rem", borderRadius: "999px", background: `${STATUS_COLORS[p.status] ?? "#444"}22`, color: STATUS_COLORS[p.status] ?? "#aaa" }}>
                    {p.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Platform breakdown + tips */}
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          {platformBreakdown.length > 0 && (
            <div className="card">
              <div style={{ fontWeight: 800, fontSize: "0.9rem", marginBottom: "0.875rem" }}>📡 Platforms</div>
              <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                {platformBreakdown.map((p) => (
                  <div key={p.platform} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: "0.8rem", fontWeight: 600, color: PLATFORM_COLORS[p.platform] ?? "#aaa", textTransform: "capitalize" }}>{p.platform}</span>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                      <div style={{ width: "80px", height: "5px", background: "#1e1e1e", borderRadius: "999px", overflow: "hidden" }}>
                        <div style={{ height: "100%", background: PLATFORM_COLORS[p.platform] ?? "#aaa", borderRadius: "999px", width: `${Math.min(100, (p.count / Math.max(...platformBreakdown.map((x) => x.count))) * 100)}%` }} />
                      </div>
                      <span style={{ fontSize: "0.72rem", color: "#666", width: "16px", textAlign: "right" }}>{p.count}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="card" style={{ borderColor: "rgba(34,197,94,0.15)", background: "rgba(34,197,94,0.03)" }}>
            <div style={{ fontWeight: 800, fontSize: "0.9rem", marginBottom: "0.75rem", color: "#22c55e" }}>💡 Pro Tips</div>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
              {[
                "Add World Cup 2026 + team names as SEO keywords in bio",
                "Post 3x per day during group stage for max algorithm reach",
                "Ship to all 5 platforms from one Claude-generated script",
                "Repurpose YouTube scripts as TikTok & Shorts with CapCut",
              ].map((tip, i) => (
                <div key={i} style={{ display: "flex", gap: "0.5rem", fontSize: "0.76rem", color: "#888", lineHeight: 1.5 }}>
                  <span style={{ color: "#22c55e", fontWeight: 700, flexShrink: 0 }}>→</span>
                  {tip}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
