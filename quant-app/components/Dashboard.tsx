"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import {
  AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from "recharts";
import { getItem, KEYS, type TradeAnalysis, type BankrollEntry } from "@/lib/store";

export default function Dashboard() {
  const [trades, setTrades] = useState<TradeAnalysis[]>([]);
  const [bankrollEntries, setBankrollEntries] = useState<BankrollEntry[]>([]);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setTrades(getItem<TradeAnalysis[]>(KEYS.TRADES, []));
    setBankrollEntries(getItem<BankrollEntry[]>(KEYS.BANKROLL, []));
    setMounted(true);
  }, []);

  const closed = trades.filter((t) => t.outcome !== "pending");
  const wins = closed.filter((t) => t.outcome === "win");
  const totalPnl = closed.reduce((s, t) => s + (t.actualProfitDollars ?? 0), 0);
  const winRate = closed.length > 0 ? (wins.length / closed.length) * 100 : 0;
  const avgEV = trades.length > 0
    ? (trades.reduce((s, t) => s + t.ev, 0) / trades.length) * 100
    : 0;

  const initialBankroll = bankrollEntries.length > 0
    ? bankrollEntries.sort((a, b) => a.date.localeCompare(b.date))[0].amount
    : 10000;
  const currentBankroll = initialBankroll + totalPnl;
  const roi = initialBankroll > 0 ? (totalPnl / initialBankroll) * 100 : 0;

  // Build bankroll timeline for chart
  const bankrollChart: { date: string; bankroll: number }[] = [];
  {
    let running = initialBankroll;
    bankrollChart.push({ date: "Start", bankroll: running });
    closed
      .sort((a, b) => (a.closedAt ?? "").localeCompare(b.closedAt ?? ""))
      .forEach((t) => {
        running += t.actualProfitDollars ?? 0;
        bankrollChart.push({
          date: t.closedAt ? t.closedAt.slice(0, 10) : "?",
          bankroll: Math.round(running),
        });
      });
  }

  // P&L by market
  const byMarket: Record<string, number> = {};
  closed.forEach((t) => {
    byMarket[t.market] = (byMarket[t.market] ?? 0) + (t.actualProfitDollars ?? 0);
  });
  const marketChart = Object.entries(byMarket).map(([market, pnl]) => ({ market, pnl: Math.round(pnl) }));

  // Verdict distribution
  const verdictCount: Record<string, number> = {};
  trades.forEach((t) => {
    verdictCount[t.verdict] = (verdictCount[t.verdict] ?? 0) + 1;
  });

  const recent = [...trades].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 5);

  const statCards = [
    { label: "Bankroll",  value: `$${Math.round(currentBankroll).toLocaleString()}`, color: "#22c55e", sub: `${roi >= 0 ? "+" : ""}${roi.toFixed(1)}% ROI` },
    { label: "Total P&L", value: `${totalPnl >= 0 ? "+" : ""}$${Math.round(Math.abs(totalPnl)).toLocaleString()}`, color: totalPnl >= 0 ? "#22c55e" : "#ef4444", sub: `${closed.length} closed trades` },
    { label: "Win Rate",  value: `${winRate.toFixed(1)}%`, color: "#60a5fa", sub: `${wins.length}W / ${closed.length - wins.length}L` },
    { label: "Avg EV",    value: `${avgEV >= 0 ? "+" : ""}${avgEV.toFixed(1)}%`, color: "#f59e0b", sub: `${trades.length} trades analysed` },
  ];

  if (!mounted) return null;

  return (
    <div style={{ padding: "2rem", maxWidth: "1200px" }}>
      {/* Header */}
      <div style={{ marginBottom: "2rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "0.4rem" }}>
          <span style={{ fontSize: "2rem" }}>💹</span>
          <div>
            <h1 style={{ fontSize: "1.8rem", fontWeight: 900, letterSpacing: "-0.03em", lineHeight: 1 }}>
              SMART MONEY
            </h1>
            <p style={{ color: "#666", fontSize: "0.8rem", marginTop: "0.2rem" }}>
              Quant Trading Framework · {new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
            </p>
          </div>
        </div>
      </div>

      {/* Stat cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: "1rem", marginBottom: "2rem" }}>
        {statCards.map((c) => (
          <div key={c.label} className="stat-card">
            <div style={{ fontSize: "0.75rem", color: "#666", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em" }}>{c.label}</div>
            <div style={{ fontSize: "1.75rem", fontWeight: 900, color: c.color, lineHeight: 1.1 }}>{c.value}</div>
            <div style={{ fontSize: "0.75rem", color: "#555" }}>{c.sub}</div>
          </div>
        ))}
      </div>

      {/* Charts row */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(420px, 1fr))", gap: "1.5rem", marginBottom: "2rem" }}>
        {/* Bankroll chart */}
        <div className="card">
          <h2 style={{ fontWeight: 700, fontSize: "0.9rem", marginBottom: "1rem" }}>📈 Bankroll Over Time</h2>
          {bankrollChart.length < 2 ? (
            <p style={{ color: "#555", fontSize: "0.8rem" }}>No closed trades yet.</p>
          ) : (
            <ResponsiveContainer width="100%" height={180}>
              <AreaChart data={bankrollChart}>
                <defs>
                  <linearGradient id="bkGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#22c55e" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#22c55e" stopOpacity={0}    />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e1e1e" />
                <XAxis dataKey="date" tick={{ fill: "#555", fontSize: 10 }} />
                <YAxis tick={{ fill: "#555", fontSize: 10 }} tickFormatter={(v) => `$${(v/1000).toFixed(0)}k`} />
                <Tooltip
                  contentStyle={{ background: "#111", border: "1px solid #2a2a2a", borderRadius: 8, fontSize: 12 }}
                  formatter={(v) => [`$${Number(v).toLocaleString()}`, "Bankroll"]}
                />
                <Area type="monotone" dataKey="bankroll" stroke="#22c55e" strokeWidth={2} fill="url(#bkGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* P&L by market */}
        <div className="card">
          <h2 style={{ fontWeight: 700, fontSize: "0.9rem", marginBottom: "1rem" }}>🏷️ P&amp;L by Market</h2>
          {marketChart.length === 0 ? (
            <p style={{ color: "#555", fontSize: "0.8rem" }}>No closed trades yet.</p>
          ) : (
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={marketChart}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e1e1e" />
                <XAxis dataKey="market" tick={{ fill: "#555", fontSize: 10 }} />
                <YAxis tick={{ fill: "#555", fontSize: 10 }} tickFormatter={(v) => `$${v}`} />
                <Tooltip
                  contentStyle={{ background: "#111", border: "1px solid #2a2a2a", borderRadius: 8, fontSize: 12 }}
                  formatter={(v) => [`$${Number(v)}`, "P&L"]}
                />
                <Bar dataKey="pnl" fill="#22c55e" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Recent trades + quick actions */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))", gap: "1.5rem", marginBottom: "2rem" }}>
        {/* Recent trades */}
        <div className="card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
            <h2 style={{ fontWeight: 700, fontSize: "0.9rem" }}>📋 Recent Analyses</h2>
            <Link href="/trades" style={{ color: "#22c55e", fontSize: "0.75rem", textDecoration: "none" }}>View all →</Link>
          </div>
          {recent.length === 0 ? (
            <p style={{ color: "#555", fontSize: "0.8rem" }}>
              No trades yet.{" "}
              <Link href="/analyzer" style={{ color: "#22c55e" }}>Analyse an opportunity →</Link>
            </p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
              {recent.map((t) => (
                <div
                  key={t.id}
                  style={{ padding: "0.6rem 0.75rem", background: "#1a1a1a", borderRadius: "8px", display: "flex", justifyContent: "space-between", alignItems: "center" }}
                >
                  <div>
                    <div style={{ fontSize: "0.85rem", fontWeight: 600 }}>{t.asset}</div>
                    <div style={{ fontSize: "0.7rem", color: "#666" }}>{t.market} · EV {(t.ev * 100).toFixed(1)}%</div>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "0.2rem" }}>
                    <span className={`badge badge-${verdictBadge(t.verdict)}`}>{t.verdict}</span>
                    <span className={`badge badge-${outcomeBadge(t.outcome)}`}>{t.outcome}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Quick actions */}
        <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
          {[
            { href: "/analyzer",   icon: "🔬", label: "Analyse Opportunity",  desc: "Run full A–F EV framework" },
            { href: "/congress",   icon: "🏛️", label: "Congress Feed",        desc: "Smart money congressional trades" },
            { href: "/calculator", icon: "🧮", label: "Kelly Calculator",     desc: "Position size any bet or trade" },
          ].map((a) => (
            <Link key={a.href} href={a.href} style={{ textDecoration: "none" }}>
              <div
                className="card"
                style={{ cursor: "pointer", display: "flex", alignItems: "center", gap: "1rem", transition: "border-color 0.15s" }}
                onMouseEnter={(e) => (e.currentTarget.style.borderColor = "#22c55e")}
                onMouseLeave={(e) => (e.currentTarget.style.borderColor = "#1e1e1e")}
              >
                <span style={{ fontSize: "1.75rem" }}>{a.icon}</span>
                <div>
                  <div style={{ fontWeight: 700, fontSize: "0.875rem" }}>{a.label}</div>
                  <div style={{ fontSize: "0.75rem", color: "#666" }}>{a.desc}</div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* Verdict breakdown */}
      {trades.length > 0 && (
        <div className="card">
          <h2 style={{ fontWeight: 700, fontSize: "0.9rem", marginBottom: "1rem" }}>⚖️ Verdict Breakdown</h2>
          <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap" }}>
            {(["bet", "pass", "watchlist", "hedge"] as const).map((v) => (
              <div key={v} style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <span className={`badge badge-${verdictBadge(v)}`}>{v}</span>
                <span style={{ fontSize: "0.85rem", fontWeight: 700 }}>{verdictCount[v] ?? 0}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function verdictBadge(v: string) {
  if (v === "bet") return "green";
  if (v === "pass") return "red";
  if (v === "watchlist") return "amber";
  return "blue";
}

function outcomeBadge(o: string) {
  if (o === "win") return "green";
  if (o === "loss") return "red";
  if (o === "push") return "amber";
  return "gray";
}
