"use client";
import { useState } from "react";
import {
  americanToDecimal,
  calcEV,
  kellyFraction,
  halfKelly,
  quarterKelly,
  evLabel,
  evColor,
} from "@/lib/quant";

type OddsFormat = "decimal" | "american" | "implied";

interface Scenario {
  label: string;
  prob: number;
  odds: number;
  bankroll: number;
}

const PRESETS: Scenario[] = [
  { label: "Coin flip at -110", prob: 0.5333, odds: 1.909, bankroll: 10000 },
  { label: "55% edge, evens",   prob: 0.55,   odds: 2.0,   bankroll: 10000 },
  { label: "Heavy fav -200",    prob: 0.65,   odds: 1.5,   bankroll: 10000 },
  { label: "Big dog +300",      prob: 0.35,   odds: 4.0,   bankroll: 10000 },
];

export default function KellyClient() {
  const [prob, setProb]       = useState(0.55);
  const [format, setFormat]   = useState<OddsFormat>("decimal");
  const [oddsVal, setOddsVal] = useState("2.00");
  const [bankroll, setBankroll] = useState(10000);
  const [kellyFrac, setKellyFrac] = useState(0.5); // fraction of full Kelly (0.5 = half)

  function loadPreset(p: Scenario) {
    setProb(p.prob);
    setFormat("decimal");
    setOddsVal(p.odds.toFixed(3));
    setBankroll(p.bankroll);
  }

  const decOdds = parseOdds(format, oddsVal);
  const b = decOdds - 1;
  const impliedProb = decOdds > 0 ? 1 / decOdds : 0;
  const edge = prob - impliedProb;
  const ev = calcEV(prob, decOdds);
  const fullK = kellyFraction(prob, b);
  const halfK = halfKelly(prob, b);
  const quarterK = quarterKelly(prob, b);
  const customK = fullK * kellyFrac;
  const customSize = customK * bankroll;

  // Sensitivity table: prob ± 5%
  const probRange = [-0.10, -0.05, 0, +0.05, +0.10].map((delta) => {
    const p2 = Math.min(0.99, Math.max(0.01, prob + delta));
    const ev2 = calcEV(p2, decOdds);
    const kf2 = kellyFraction(p2, b);
    return { delta, p: p2, ev: ev2, kf: kf2 };
  });

  // Ruin risk (simplified: consecutive losses to halve bankroll at Kelly)
  const ruinLosses = fullK > 0 ? Math.ceil(Math.log(0.5) / Math.log(1 - fullK)) : Infinity;

  return (
    <div style={{ padding: "2rem", maxWidth: "900px" }}>
      <div style={{ marginBottom: "1.5rem" }}>
        <h1 style={{ fontSize: "1.6rem", fontWeight: 900, letterSpacing: "-0.02em" }}>🧮 Kelly Criterion Calculator</h1>
        <p style={{ color: "#666", fontSize: "0.8rem", marginTop: "0.25rem" }}>
          Optimal position sizing based on edge and odds. Never risk more than the Kelly fraction.
        </p>
      </div>

      {/* Presets */}
      <div style={{ marginBottom: "1.5rem" }}>
        <div className="section-label">Quick Presets</div>
        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
          {PRESETS.map((p) => (
            <button key={p.label} className="btn-ghost" onClick={() => loadPreset(p)} style={{ fontSize: "0.78rem" }}>
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.5rem", alignItems: "start" }}>
        {/* Inputs */}
        <div className="card">
          <div className="section-label">Inputs</div>
          <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            <div>
              <div style={{ fontSize: "0.75rem", color: "#666", marginBottom: "0.3rem" }}>
                Win Probability: {(prob * 100).toFixed(1)}%
              </div>
              <input
                type="range" min={0.01} max={0.99} step={0.01}
                value={prob}
                onChange={(e) => setProb(Number(e.target.value))}
                style={{ width: "100%", accentColor: "#22c55e" }}
              />
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.7rem", color: "#555", marginTop: "0.2rem" }}>
                <span>1%</span><span style={{ color: "#22c55e" }}>{(prob * 100).toFixed(1)}%</span><span>99%</span>
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
              <div>
                <div style={{ fontSize: "0.75rem", color: "#666", marginBottom: "0.3rem" }}>Odds Format</div>
                <select className="select" value={format} onChange={(e) => setFormat(e.target.value as OddsFormat)}>
                  <option value="decimal">Decimal</option>
                  <option value="american">American</option>
                  <option value="implied">Implied %</option>
                </select>
              </div>
              <div>
                <div style={{ fontSize: "0.75rem", color: "#666", marginBottom: "0.3rem" }}>
                  {format === "american" ? "American Odds" : format === "implied" ? "Implied %" : "Decimal Odds"}
                </div>
                <input
                  className="input"
                  value={oddsVal}
                  onChange={(e) => setOddsVal(e.target.value)}
                  placeholder={format === "american" ? "-110" : format === "implied" ? "47.6" : "2.10"}
                />
              </div>
            </div>

            <div>
              <div style={{ fontSize: "0.75rem", color: "#666", marginBottom: "0.3rem" }}>Bankroll ($)</div>
              <input
                className="input"
                type="number"
                value={bankroll}
                onChange={(e) => setBankroll(Number(e.target.value))}
              />
            </div>

            <div>
              <div style={{ fontSize: "0.75rem", color: "#666", marginBottom: "0.3rem" }}>
                Kelly Fraction: {(kellyFrac * 100).toFixed(0)}% ({kellyFracLabel(kellyFrac)})
              </div>
              <input
                type="range" min={0.1} max={1.0} step={0.05}
                value={kellyFrac}
                onChange={(e) => setKellyFrac(Number(e.target.value))}
                style={{ width: "100%", accentColor: "#f59e0b" }}
              />
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.7rem", color: "#555", marginTop: "0.2rem" }}>
                <span>¼K (10%)</span><span>½K (50%)</span><span>Full K</span>
              </div>
            </div>
          </div>
        </div>

        {/* Outputs */}
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          {/* EV */}
          <div className="card" style={{ borderColor: evColor(ev) }}>
            <div style={{ fontSize: "0.7rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#666" }}>Expected Value</div>
            <div style={{ fontSize: "2.2rem", fontWeight: 900, color: evColor(ev), lineHeight: 1.1, marginTop: "0.25rem" }}>
              {ev >= 0 ? "+" : ""}{(ev * 100).toFixed(2)}%
            </div>
            <div style={{ fontSize: "0.8rem", color: evColor(ev) }}>{evLabel(ev)}</div>
            <hr className="divider" />
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem", fontSize: "0.8rem" }}>
              <Stat l="My Prob"       v={`${(prob * 100).toFixed(1)}%`} />
              <Stat l="Market Prob"   v={`${(impliedProb * 100).toFixed(1)}%`} />
              <Stat l="Edge"          v={`${edge >= 0 ? "+" : ""}${(edge * 100).toFixed(2)}%`} c={edge >= 0 ? "#22c55e" : "#ef4444"} />
              <Stat l="Dec Odds"      v={decOdds.toFixed(3)} />
            </div>
          </div>

          {/* Kelly sizes */}
          <div className="card">
            <div style={{ fontSize: "0.7rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#666", marginBottom: "0.75rem" }}>Kelly Sizes</div>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
              {[
                { l: "Full Kelly",    k: fullK,    warn: true  },
                { l: "Half Kelly",    k: halfK,    warn: false },
                { l: "Quarter Kelly", k: quarterK, warn: false },
                { l: `Custom (${(kellyFrac*100).toFixed(0)}%)`, k: customK, warn: false, highlight: true },
              ].map((row) => (
                <div key={row.l} style={{
                  display: "flex", justifyContent: "space-between", alignItems: "center",
                  padding: row.highlight ? "0.5rem 0.75rem" : "0 0",
                  background: row.highlight ? "rgba(34,197,94,0.08)" : "transparent",
                  border: row.highlight ? "1px solid rgba(34,197,94,0.2)" : "none",
                  borderRadius: row.highlight ? "8px" : "0",
                  fontSize: "0.85rem",
                }}>
                  <span style={{ color: row.highlight ? "#22c55e" : "#aaa" }}>{row.l}</span>
                  <span style={{ fontWeight: 700, color: row.warn && row.k > 0.25 ? "#ef4444" : row.highlight ? "#22c55e" : "#f0f0f0" }}>
                    {(row.k * 100).toFixed(1)}% · ${Math.round(row.k * bankroll).toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Risk metric */}
          <div className="card">
            <div style={{ fontSize: "0.7rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#666", marginBottom: "0.5rem" }}>Risk Metrics</div>
            <div style={{ fontSize: "0.82rem", color: "#aaa", lineHeight: 1.7 }}>
              <div>
                Halve bankroll in{" "}
                <strong style={{ color: ruinLosses < 10 ? "#ef4444" : "#f0f0f0" }}>
                  {isFinite(ruinLosses) ? ruinLosses : "∞"} consecutive losses
                </strong>
                {" "}at full Kelly
              </div>
              <div>
                Max drawdown tolerance at ½-Kelly:{" "}
                <strong>{(halfK * 100).toFixed(1)}%/trade</strong>
              </div>
              <div style={{ marginTop: "0.5rem", padding: "0.5rem", background: "#1a1a1a", borderRadius: "6px", fontSize: "0.75rem", color: "#666" }}>
                Rule: Never bet more than you can lose without abandoning the strategy.
                Full Kelly is theoretically optimal but practically dangerous — use ¼ or ½ Kelly.
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Sensitivity table */}
      <div className="card" style={{ marginTop: "1.5rem" }}>
        <h2 style={{ fontWeight: 700, fontSize: "0.9rem", marginBottom: "1rem" }}>Probability Sensitivity</h2>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.82rem" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid #1e1e1e" }}>
                {["Prob Shift", "Win Prob", "EV", "Full Kelly", "½ Kelly", "Bet Size (½K)"].map((h) => (
                  <th key={h} style={{ padding: "0.5rem 0.75rem", textAlign: "left", color: "#555", fontWeight: 600, fontSize: "0.72rem", textTransform: "uppercase", letterSpacing: "0.08em" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {probRange.map((row) => (
                <tr
                  key={row.delta}
                  style={{
                    borderBottom: "1px solid #1a1a1a",
                    background: row.delta === 0 ? "rgba(34,197,94,0.04)" : "transparent",
                  }}
                >
                  <td style={{ padding: "0.5rem 0.75rem", color: row.delta === 0 ? "#22c55e" : row.delta > 0 ? "#22c55e" : "#ef4444" }}>
                    {row.delta === 0 ? "Base" : row.delta > 0 ? `+${(row.delta * 100).toFixed(0)}%` : `${(row.delta * 100).toFixed(0)}%`}
                  </td>
                  <td style={{ padding: "0.5rem 0.75rem" }}>{(row.p * 100).toFixed(1)}%</td>
                  <td style={{ padding: "0.5rem 0.75rem", color: evColor(row.ev), fontWeight: 600 }}>
                    {row.ev >= 0 ? "+" : ""}{(row.ev * 100).toFixed(2)}%
                  </td>
                  <td style={{ padding: "0.5rem 0.75rem" }}>{(row.kf * 100).toFixed(1)}%</td>
                  <td style={{ padding: "0.5rem 0.75rem" }}>{(row.kf * 50).toFixed(1)}%</td>
                  <td style={{ padding: "0.5rem 0.75rem", fontWeight: 600 }}>${Math.round(row.kf * 0.5 * bankroll).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card" style={{ marginTop: "1.25rem", background: "rgba(245,158,11,0.04)", borderColor: "rgba(245,158,11,0.2)" }}>
        <p style={{ fontSize: "0.8rem", color: "#aaa", lineHeight: 1.7, margin: 0 }}>
          <strong style={{ color: "#f59e0b" }}>Kelly Criterion:</strong>{" "}
          f* = (bp − q) / b, where b = net decimal odds, p = win probability, q = 1 − p.
          A positive Kelly fraction means positive EV. Use ¼ or ½ Kelly for practical bankroll management —
          full Kelly maximises long-run geometric growth but produces high variance and drawdowns.
          The recommended bet size in the Analyzer uses ¼-Kelly scaled by your confidence level, capped at 10% bankroll.
        </p>
      </div>
    </div>
  );
}

function parseOdds(format: OddsFormat, val: string): number {
  const v = parseFloat(val);
  if (isNaN(v)) return 2.0;
  if (format === "american") return americanToDecimal(v);
  if (format === "implied") return v > 0 ? 100 / v : 2.0;
  return Math.max(1.001, v);
}

function kellyFracLabel(f: number) {
  if (f <= 0.15) return "conservative";
  if (f <= 0.55) return "moderate";
  return "aggressive";
}

function Stat({ l, v, c }: { l: string; v: string; c?: string }) {
  return (
    <div>
      <div style={{ fontSize: "0.65rem", color: "#555", textTransform: "uppercase", letterSpacing: "0.08em" }}>{l}</div>
      <div style={{ fontSize: "0.9rem", fontWeight: 700, color: c ?? "#f0f0f0" }}>{v}</div>
    </div>
  );
}
