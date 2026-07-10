"use client";
import { useEffect, useState } from "react";
import { getItem, setItem, KEYS, type TradeAnalysis, type Outcome } from "@/lib/store";
import { evColor } from "@/lib/quant";

export default function TradeLogClient() {
  const [trades, setTrades] = useState<TradeAnalysis[]>([]);
  const [filter, setFilter] = useState<"all" | "pending" | "closed">("all");
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    setTrades(getItem<TradeAnalysis[]>(KEYS.TRADES, []));
  }, []);

  function updateOutcome(id: string, outcome: Outcome, size: number, profit: number, notes: string) {
    const updated = trades.map((t) =>
      t.id === id
        ? { ...t, outcome, actualSizeDollars: size, actualProfitDollars: profit, closedAt: new Date().toISOString(), outcomeNotes: notes }
        : t
    );
    setTrades(updated);
    setItem(KEYS.TRADES, updated);
  }

  function deleteTrade(id: string) {
    const updated = trades.filter((t) => t.id !== id);
    setTrades(updated);
    setItem(KEYS.TRADES, updated);
  }

  const filtered = trades.filter((t) => {
    if (filter === "pending") return t.outcome === "pending";
    if (filter === "closed") return t.outcome !== "pending";
    return true;
  }).sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  const totalPnl = trades.filter((t) => t.outcome !== "pending").reduce((s, t) => s + (t.actualProfitDollars ?? 0), 0);

  return (
    <div style={{ padding: "2rem", maxWidth: "1000px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "1.5rem", flexWrap: "wrap", gap: "1rem" }}>
        <div>
          <h1 style={{ fontSize: "1.6rem", fontWeight: 900, letterSpacing: "-0.02em" }}>📋 Trade Log</h1>
          <p style={{ color: "#666", fontSize: "0.8rem", marginTop: "0.2rem" }}>
            {trades.length} analyses · All-time P&L:{" "}
            <span style={{ color: totalPnl >= 0 ? "#22c55e" : "#ef4444", fontWeight: 700 }}>
              {totalPnl >= 0 ? "+" : ""}${Math.round(totalPnl).toLocaleString()}
            </span>
          </p>
        </div>
        <div style={{ display: "flex", gap: "0.5rem" }}>
          {(["all", "pending", "closed"] as const).map((f) => (
            <button
              key={f}
              className={filter === f ? "btn-primary" : "btn-ghost"}
              onClick={() => setFilter(f)}
              style={{ padding: "0.4rem 0.9rem", fontSize: "0.8rem" }}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 && (
        <div className="card" style={{ textAlign: "center", padding: "3rem" }}>
          <p style={{ color: "#555" }}>No trades yet. <a href="/analyzer" style={{ color: "#22c55e" }}>Analyse an opportunity →</a></p>
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
        {filtered.map((t) => (
          <TradeCard
            key={t.id}
            trade={t}
            expanded={expanded === t.id}
            onToggle={() => setExpanded(expanded === t.id ? null : t.id)}
            onUpdateOutcome={updateOutcome}
            onDelete={() => deleteTrade(t.id)}
          />
        ))}
      </div>
    </div>
  );
}

function TradeCard({
  trade: t,
  expanded,
  onToggle,
  onUpdateOutcome,
  onDelete,
}: {
  trade: TradeAnalysis;
  expanded: boolean;
  onToggle: () => void;
  onUpdateOutcome: (id: string, o: Outcome, size: number, profit: number, notes: string) => void;
  onDelete: () => void;
}) {
  const [outForm, setOutForm] = useState({
    outcome: t.outcome,
    size: String(t.actualSizeDollars ?? t.recommendedSizeDollars ?? 0),
    profit: String(t.actualProfitDollars ?? ""),
    notes: t.outcomeNotes ?? "",
  });

  function saveOutcome() {
    onUpdateOutcome(
      t.id,
      outForm.outcome as Outcome,
      Number(outForm.size),
      Number(outForm.profit),
      outForm.notes,
    );
  }

  return (
    <div className="card" style={{ borderColor: expanded ? "#2a2a2a" : "#1e1e1e" }}>
      {/* Header row */}
      <div
        style={{ display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer" }}
        onClick={onToggle}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", flexWrap: "wrap" }}>
          <div>
            <span style={{ fontWeight: 700, fontSize: "0.95rem" }}>{t.asset}</span>
            <span style={{ color: "#555", fontSize: "0.8rem", marginLeft: "0.5rem" }}>{t.market}</span>
          </div>
          <span style={{ color: evColor(t.ev), fontWeight: 700, fontSize: "0.85rem" }}>
            EV {t.ev >= 0 ? "+" : ""}{(t.ev * 100).toFixed(1)}%
          </span>
          <span className={`badge badge-${verdictBadge(t.verdict)}`}>{t.verdict}</span>
          <span className={`badge badge-${outcomeBadge(t.outcome)}`}>{t.outcome}</span>
          {t.outcome !== "pending" && t.actualProfitDollars !== undefined && (
            <span style={{ color: t.actualProfitDollars >= 0 ? "#22c55e" : "#ef4444", fontWeight: 700, fontSize: "0.85rem" }}>
              {t.actualProfitDollars >= 0 ? "+" : ""}${Math.round(t.actualProfitDollars).toLocaleString()}
            </span>
          )}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <span style={{ fontSize: "0.72rem", color: "#555" }}>{t.createdAt.slice(0, 10)}</span>
          <span style={{ fontSize: "0.8rem", color: "#555" }}>{expanded ? "▲" : "▼"}</span>
        </div>
      </div>

      {/* Expanded detail */}
      {expanded && (
        <div style={{ marginTop: "1.25rem", display: "flex", flexDirection: "column", gap: "1rem" }}>
          {t.description && <p style={{ color: "#aaa", fontSize: "0.85rem" }}>{t.description}</p>}

          {/* Quant metrics */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: "0.5rem" }}>
            {[
              { l: "My Prob",     v: `${(t.estimatedProb * 100).toFixed(1)}%`       },
              { l: "Market Prob", v: `${(t.marketImpliedProb * 100).toFixed(1)}%`   },
              { l: "Dec Odds",    v: t.marketOddsDecimal.toFixed(2)                  },
              { l: "EV",         v: `${(t.ev * 100).toFixed(2)}%`                   },
              { l: "Kelly",      v: `${(t.kellyFraction * 100).toFixed(1)}%`        },
              { l: "Rec. Size",  v: `$${Math.round(t.recommendedSizeDollars).toLocaleString()}` },
              { l: "Confidence", v: `${t.confidence}%`                              },
              { l: "Risk",       v: t.risk                                           },
            ].map((m) => (
              <div key={m.l} style={{ background: "#1a1a1a", padding: "0.5rem 0.75rem", borderRadius: "8px" }}>
                <div style={{ fontSize: "0.65rem", color: "#555", textTransform: "uppercase", letterSpacing: "0.08em" }}>{m.l}</div>
                <div style={{ fontSize: "0.875rem", fontWeight: 700 }}>{m.v}</div>
              </div>
            ))}
          </div>

          {/* Narrative sections */}
          {[
            { label: "A — Recommendation", val: t.recommendation },
            { label: "C — Mispricing", val: t.mispricing },
            { label: "C — Contrarian", val: t.contrarian },
            { label: "C — Catalyst", val: t.catalyst },
            { label: "D — Exit Criteria", val: t.exitCriteria },
            { label: "E — Best Case", val: t.bestCase },
            { label: "E — Base Case", val: t.baseCase },
            { label: "E — Worst Case", val: t.worstCase },
            { label: "E — Change Evidence", val: t.changeEvidence },
          ].filter((s) => s.val).map((s) => (
            <div key={s.label}>
              <div className="section-label">{s.label}</div>
              <p style={{ fontSize: "0.85rem", color: "#aaa", margin: 0 }}>{s.val}</p>
            </div>
          ))}

          {/* F — Outcome entry */}
          <div style={{ borderTop: "1px solid #1e1e1e", paddingTop: "1rem" }}>
            <div className="section-label">F — Record Outcome</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "0.75rem" }}>
              <div>
                <div style={{ fontSize: "0.75rem", color: "#666", marginBottom: "0.3rem" }}>Outcome</div>
                <select
                  className="select"
                  value={outForm.outcome}
                  onChange={(e) => setOutForm((p) => ({ ...p, outcome: e.target.value as Outcome }))}
                >
                  <option value="pending">Pending</option>
                  <option value="win">Win</option>
                  <option value="loss">Loss</option>
                  <option value="push">Push</option>
                </select>
              </div>
              <div>
                <div style={{ fontSize: "0.75rem", color: "#666", marginBottom: "0.3rem" }}>Actual Size ($)</div>
                <input className="input" type="number" value={outForm.size} onChange={(e) => setOutForm((p) => ({ ...p, size: e.target.value }))} />
              </div>
              <div>
                <div style={{ fontSize: "0.75rem", color: "#666", marginBottom: "0.3rem" }}>Profit / Loss ($)</div>
                <input className="input" type="number" value={outForm.profit} placeholder="-50 or +120" onChange={(e) => setOutForm((p) => ({ ...p, profit: e.target.value }))} />
              </div>
            </div>
            <div style={{ marginTop: "0.5rem" }}>
              <div style={{ fontSize: "0.75rem", color: "#666", marginBottom: "0.3rem" }}>Post-trade notes</div>
              <textarea className="textarea" rows={2} value={outForm.notes} onChange={(e) => setOutForm((p) => ({ ...p, notes: e.target.value }))} placeholder="What happened? What would you do differently?" />
            </div>
            <div style={{ display: "flex", gap: "0.75rem", marginTop: "0.75rem" }}>
              <button className="btn-primary" onClick={saveOutcome}>Save Outcome</button>
              <button className="btn-danger" onClick={onDelete}>Delete</button>
            </div>
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
