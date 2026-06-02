"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { parseCongressTrade } from "@/lib/quant";

export default function CongressClient({ rawTrades }: { rawTrades: string[] }) {
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<"all" | "buy" | "sell">("all");

  const parsed = useMemo(
    () => rawTrades.map((r) => ({ raw: r, ...parseCongressTrade(r) })).filter((t) => t.ticker || t.tradeType),
    [rawTrades]
  );

  const filtered = parsed.filter((t) => {
    const q = search.toLowerCase();
    const matchSearch =
      !q ||
      t.ticker?.toLowerCase().includes(q) ||
      t.name?.toLowerCase().includes(q) ||
      t.company?.toLowerCase().includes(q);
    const matchType = typeFilter === "all" || t.tradeType === typeFilter;
    return matchSearch && matchType;
  });

  const buys  = parsed.filter((t) => t.tradeType === "buy").length;
  const sells = parsed.filter((t) => t.tradeType === "sell").length;
  const tickers = [...new Set(parsed.map((t) => t.ticker).filter(Boolean))];

  return (
    <div style={{ padding: "2rem", maxWidth: "960px" }}>
      <div style={{ marginBottom: "1.5rem" }}>
        <h1 style={{ fontSize: "1.6rem", fontWeight: 900, letterSpacing: "-0.02em" }}>🏛️ Congressional Smart Money</h1>
        <p style={{ color: "#666", fontSize: "0.8rem", marginTop: "0.25rem" }}>
          Live feed from Capitol Trades · {parsed.length} trades · {buys} buys · {sells} sells
        </p>
      </div>

      {/* Summary stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: "1rem", marginBottom: "1.5rem" }}>
        <div className="stat-card">
          <div style={{ fontSize: "0.7rem", color: "#666", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em" }}>Total Trades</div>
          <div style={{ fontSize: "1.75rem", fontWeight: 900, color: "#f0f0f0" }}>{parsed.length}</div>
        </div>
        <div className="stat-card">
          <div style={{ fontSize: "0.7rem", color: "#666", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em" }}>Buys</div>
          <div style={{ fontSize: "1.75rem", fontWeight: 900, color: "#22c55e" }}>{buys}</div>
        </div>
        <div className="stat-card">
          <div style={{ fontSize: "0.7rem", color: "#666", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em" }}>Sells</div>
          <div style={{ fontSize: "1.75rem", fontWeight: 900, color: "#ef4444" }}>{sells}</div>
        </div>
        <div className="stat-card">
          <div style={{ fontSize: "0.7rem", color: "#666", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em" }}>Unique Tickers</div>
          <div style={{ fontSize: "1.75rem", fontWeight: 900, color: "#60a5fa" }}>{tickers.length}</div>
        </div>
      </div>

      {/* Filters */}
      <div style={{ display: "flex", gap: "0.75rem", marginBottom: "1.25rem", flexWrap: "wrap" }}>
        <input
          className="input"
          style={{ maxWidth: "260px" }}
          placeholder="Search ticker, name, company..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        {(["all", "buy", "sell"] as const).map((f) => (
          <button
            key={f}
            className={typeFilter === f ? "btn-primary" : "btn-ghost"}
            onClick={() => setTypeFilter(f)}
            style={{ padding: "0.4rem 1rem", fontSize: "0.8rem", minWidth: "60px" }}
          >
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      {/* Trade rows */}
      {filtered.length === 0 ? (
        <div className="card" style={{ textAlign: "center", padding: "3rem" }}>
          <p style={{ color: "#555" }}>No trades match your filter.</p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
          {filtered.map((t, i) => (
            <div
              key={i}
              className="card"
              style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "0.75rem" }}
            >
              {/* Left: who + company */}
              <div style={{ minWidth: "160px" }}>
                <div style={{ fontWeight: 700, fontSize: "0.85rem" }}>{t.name ?? "Unknown"}</div>
                <div style={{ display: "flex", gap: "0.4rem", marginTop: "0.2rem", flexWrap: "wrap" }}>
                  {t.party && (
                    <span className={`badge badge-${t.party === "Republican" ? "red" : "blue"}`}>{t.party}</span>
                  )}
                  {t.chamber && <span className="badge badge-gray">{t.chamber}</span>}
                </div>
              </div>

              {/* Middle: company + ticker */}
              <div style={{ flex: 1, minWidth: "160px" }}>
                <div style={{ fontSize: "0.85rem", fontWeight: 600 }}>{t.company ?? "—"}</div>
                {t.ticker && (
                  <div style={{ fontSize: "0.75rem", color: "#60a5fa", marginTop: "0.1rem", fontFamily: "monospace" }}>
                    {t.ticker}
                  </div>
                )}
              </div>

              {/* Right: trade details */}
              <div style={{ display: "flex", gap: "0.75rem", alignItems: "center", flexWrap: "wrap" }}>
                {t.tradeType && (
                  <span className={`badge badge-${t.tradeType === "buy" ? "green" : "red"}`} style={{ fontSize: "0.8rem" }}>
                    {t.tradeType.toUpperCase()}
                  </span>
                )}
                {t.size && <span style={{ fontSize: "0.8rem", color: "#aaa" }}>{t.size}</span>}
                {t.price && <span style={{ fontSize: "0.85rem", fontWeight: 700 }}>{t.price}</span>}
                {t.daysAfter !== null && (
                  <span style={{ fontSize: "0.72rem", color: t.daysAfter > 30 ? "#ef4444" : "#f59e0b" }}>
                    +{t.daysAfter}d late
                  </span>
                )}
                {t.ticker && (
                  <Link
                    href={`/analyzer?asset=${encodeURIComponent(t.ticker.split(":")[0])}&market=financial`}
                    style={{ fontSize: "0.75rem", color: "#22c55e", textDecoration: "none", whiteSpace: "nowrap" }}
                  >
                    Analyse →
                  </Link>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <p style={{ color: "#444", fontSize: "0.72rem", marginTop: "1.5rem" }}>
        Data scraped from Capitol Trades via smart-money-alerts scraper. Refresh by running{" "}
        <code style={{ color: "#666" }}>node scraper.js</code> from the project root.
      </p>
    </div>
  );
}
