"use client";
import { useState, useEffect } from "react";
import { v4 as uuidv4 } from "uuid";
import {
  americanToDecimal,
  calcEV,
  kellyFraction,
  halfKelly,
  quarterKelly,
  recommendedSize as calcRecommendedSize,
  evLabel,
  evColor,
  riskFromInputs,
} from "@/lib/quant";
import {
  getItem, setItem, KEYS,
  type TradeAnalysis, type Verdict, type Market, type OddsFormat,
} from "@/lib/store";

const EMPTY: Omit<TradeAnalysis,
  "id" | "createdAt" | "marketImpliedProb" | "ev" | "kellyFraction" | "recommendedSizeDollars" | "risk"
> = {
  asset: "",
  market: "financial",
  description: "",
  recommendation: "",
  confidence: 55,
  verdict: "watchlist",
  estimatedProb: 0.55,
  marketOddsDecimal: 2.0,
  bankrollAtTime: 10000,
  mispricing: "",
  contrarian: "",
  catalyst: "",
  maxExposurePct: 5,
  exitCriteria: "",
  bestCase: "",
  baseCase: "",
  worstCase: "",
  changeEvidence: "",
  outcome: "pending",
};

type OddsInput = { format: OddsFormat; value: string };

export default function AnalyzerClient() {
  const [form, setForm] = useState({ ...EMPTY });
  const [oddsInput, setOddsInput] = useState<OddsInput>({ format: "decimal", value: "2.00" });
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  // Derived quant values
  const decimalOdds = parseDecimalOdds(oddsInput);
  const p = form.estimatedProb;
  const ev = calcEV(p, decimalOdds);
  const kf = kellyFraction(p, decimalOdds - 1);
  const hk = halfKelly(p, decimalOdds - 1);
  const qk = quarterKelly(p, decimalOdds - 1);
  const impliedProb = decimalOdds > 0 ? 1 / decimalOdds : 0;
  const edge = p - impliedProb;
  const recSize = calcRecommendedSize(p, decimalOdds, form.bankrollAtTime, form.confidence);
  const risk = riskFromInputs(form.confidence, kf);

  function handleSave() {
    if (!form.asset.trim()) { setError("Asset/market name is required."); return; }
    if (decimalOdds <= 1) { setError("Market odds must be > 1.0."); return; }
    setError("");

    const record: TradeAnalysis = {
      ...form,
      id: uuidv4(),
      createdAt: new Date().toISOString(),
      marketOddsDecimal: decimalOdds,
      marketImpliedProb: impliedProb,
      ev,
      kellyFraction: kf,
      recommendedSizeDollars: recSize,
      risk,
    };

    const existing = getItem<TradeAnalysis[]>(KEYS.TRADES, []);
    setItem(KEYS.TRADES, [record, ...existing]);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
    setForm({ ...EMPTY });
    setOddsInput({ format: "decimal", value: "2.00" });
  }

  function field(k: keyof typeof form, v: string | number) {
    setForm((prev) => ({ ...prev, [k]: v }));
  }

  return (
    <div style={{ padding: "2rem", maxWidth: "1100px" }}>
      <div style={{ marginBottom: "1.5rem" }}>
        <h1 style={{ fontSize: "1.6rem", fontWeight: 900, letterSpacing: "-0.02em" }}>🔬 Opportunity Analyzer</h1>
        <p style={{ color: "#666", fontSize: "0.8rem", marginTop: "0.25rem" }}>
          Structured A–F framework: EV calculation, Kelly sizing, and scenario planning.
        </p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: "1.5rem", alignItems: "start" }}>
        {/* LEFT: Form */}
        <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>

          {/* A. Executive Summary */}
          <Section label="A — Executive Summary">
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
              <LabeledField label="Asset / Ticker / Event">
                <input
                  className="input"
                  placeholder="e.g. TSLA, Man City ML, BTC"
                  value={form.asset}
                  onChange={(e) => field("asset", e.target.value)}
                />
              </LabeledField>
              <LabeledField label="Market Type">
                <select className="select" value={form.market} onChange={(e) => field("market", e.target.value as Market)}>
                  <option value="financial">Financial</option>
                  <option value="sports">Sports</option>
                  <option value="prediction">Prediction Market</option>
                  <option value="crypto">Crypto</option>
                  <option value="other">Other</option>
                </select>
              </LabeledField>
            </div>
            <LabeledField label="Description">
              <textarea
                className="textarea"
                rows={2}
                placeholder="What is this opportunity? Include context."
                value={form.description}
                onChange={(e) => field("description", e.target.value)}
              />
            </LabeledField>
            <LabeledField label="Recommendation (1-sentence thesis)">
              <input
                className="input"
                placeholder="e.g. Fade the public on Kansas City -3.5 vs Denver"
                value={form.recommendation}
                onChange={(e) => field("recommendation", e.target.value)}
              />
            </LabeledField>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
              <LabeledField label={`Confidence: ${form.confidence}%`}>
                <input
                  type="range" min={0} max={100} step={1}
                  value={form.confidence}
                  onChange={(e) => field("confidence", Number(e.target.value))}
                  style={{ width: "100%", accentColor: "#22c55e" }}
                />
              </LabeledField>
              <LabeledField label="Verdict">
                <select className="select" value={form.verdict} onChange={(e) => field("verdict", e.target.value as Verdict)}>
                  <option value="bet">Bet / Trade</option>
                  <option value="pass">Pass</option>
                  <option value="watchlist">Watchlist</option>
                  <option value="hedge">Hedge</option>
                </select>
              </LabeledField>
            </div>
          </Section>

          {/* B. Quantitative */}
          <Section label="B — Quantitative Analysis">
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "0.75rem" }}>
              <LabeledField label={`My Win Prob: ${(form.estimatedProb * 100).toFixed(0)}%`}>
                <input
                  type="range" min={0.01} max={0.99} step={0.01}
                  value={form.estimatedProb}
                  onChange={(e) => field("estimatedProb", Number(e.target.value))}
                  style={{ width: "100%", accentColor: "#22c55e" }}
                />
                <div style={{ fontSize: "0.75rem", color: "#555", marginTop: "0.25rem" }}>
                  Market implied: {(impliedProb * 100).toFixed(1)}%
                  {" · "}
                  <span style={{ color: edge >= 0 ? "#22c55e" : "#ef4444" }}>
                    {edge >= 0 ? "+" : ""}{(edge * 100).toFixed(1)}% edge
                  </span>
                </div>
              </LabeledField>
              <LabeledField label="Odds Format">
                <select
                  className="select"
                  value={oddsInput.format}
                  onChange={(e) => setOddsInput({ format: e.target.value as OddsFormat, value: oddsInput.value })}
                >
                  <option value="decimal">Decimal (2.50)</option>
                  <option value="american">American (-110)</option>
                  <option value="implied">Implied % (40)</option>
                </select>
              </LabeledField>
              <LabeledField label={`Market Odds (${oddsInput.format})`}>
                <input
                  className="input"
                  value={oddsInput.value}
                  onChange={(e) => setOddsInput((prev) => ({ ...prev, value: e.target.value }))}
                  placeholder={oddsInput.format === "american" ? "-110" : oddsInput.format === "implied" ? "40" : "2.50"}
                />
              </LabeledField>
            </div>
            <LabeledField label="Current Bankroll ($)">
              <input
                className="input"
                type="number"
                min={0}
                value={form.bankrollAtTime}
                onChange={(e) => field("bankrollAtTime", Number(e.target.value))}
              />
            </LabeledField>
          </Section>

          {/* C. Market Analysis */}
          <Section label="C — Market Analysis">
            <LabeledField label="What is the market pricing incorrectly?">
              <textarea
                className="textarea"
                rows={2}
                placeholder="Identify the specific mispricing or inefficiency..."
                value={form.mispricing}
                onChange={(e) => field("mispricing", e.target.value)}
              />
            </LabeledField>
            <LabeledField label="Contrarian viewpoint (devil's advocate)">
              <textarea
                className="textarea"
                rows={2}
                placeholder="Why might the other side be right? What am I missing?"
                value={form.contrarian}
                onChange={(e) => field("contrarian", e.target.value)}
              />
            </LabeledField>
            <LabeledField label="Catalyst / timing">
              <input
                className="input"
                placeholder="What drives price/odds movement? When?"
                value={form.catalyst}
                onChange={(e) => field("catalyst", e.target.value)}
              />
            </LabeledField>
          </Section>

          {/* D. Risk Management */}
          <Section label="D — Risk Management">
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
              <LabeledField label={`Max Exposure: ${form.maxExposurePct}% of bankroll`}>
                <input
                  type="range" min={0.5} max={25} step={0.5}
                  value={form.maxExposurePct}
                  onChange={(e) => field("maxExposurePct", Number(e.target.value))}
                  style={{ width: "100%", accentColor: "#f59e0b" }}
                />
                <div style={{ fontSize: "0.75rem", color: "#555", marginTop: "0.25rem" }}>
                  = ${Math.round((form.maxExposurePct / 100) * form.bankrollAtTime).toLocaleString()}
                </div>
              </LabeledField>
              <LabeledField label="Exit criteria / stop-loss">
                <input
                  className="input"
                  placeholder="e.g. Close if line moves 1+ point against; 3-game losing streak"
                  value={form.exitCriteria}
                  onChange={(e) => field("exitCriteria", e.target.value)}
                />
              </LabeledField>
            </div>
          </Section>

          {/* E. Decision Framework */}
          <Section label="E — Decision Framework">
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "0.75rem" }}>
              <LabeledField label="Best case">
                <textarea className="textarea" rows={3} value={form.bestCase} onChange={(e) => field("bestCase", e.target.value)} placeholder="Bull case scenario..." />
              </LabeledField>
              <LabeledField label="Base case">
                <textarea className="textarea" rows={3} value={form.baseCase} onChange={(e) => field("baseCase", e.target.value)} placeholder="Most likely outcome..." />
              </LabeledField>
              <LabeledField label="Worst case">
                <textarea className="textarea" rows={3} value={form.worstCase} onChange={(e) => field("worstCase", e.target.value)} placeholder="Bear case scenario..." />
              </LabeledField>
            </div>
            <LabeledField label="What evidence would change the conclusion?">
              <textarea
                className="textarea"
                rows={2}
                placeholder="e.g. Key player confirmed injured, model revision changes prob below 50%..."
                value={form.changeEvidence}
                onChange={(e) => field("changeEvidence", e.target.value)}
              />
            </LabeledField>
          </Section>

          {error && <p style={{ color: "#ef4444", fontSize: "0.85rem" }}>{error}</p>}

          <button className="btn-primary" onClick={handleSave} style={{ alignSelf: "flex-start", padding: "0.65rem 2rem" }}>
            {saved ? "✓ Saved to Trade Log" : "Save Analysis →"}
          </button>
        </div>

        {/* RIGHT: Live output panel */}
        <div style={{ position: "sticky", top: "2rem", display: "flex", flexDirection: "column", gap: "1rem" }}>
          {/* EV card */}
          <div className="card" style={{ borderColor: evColor(ev) }}>
            <div style={{ fontSize: "0.7rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#666", marginBottom: "0.5rem" }}>
              Expected Value
            </div>
            <div style={{ fontSize: "2.5rem", fontWeight: 900, color: evColor(ev), lineHeight: 1 }}>
              {ev >= 0 ? "+" : ""}{(ev * 100).toFixed(2)}%
            </div>
            <div style={{ fontSize: "0.8rem", color: evColor(ev), marginTop: "0.25rem" }}>{evLabel(ev)}</div>
            <hr className="divider" />
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem", fontSize: "0.78rem" }}>
              <Stat label="My Prob" value={`${(p * 100).toFixed(1)}%`} />
              <Stat label="Market Prob" value={`${(impliedProb * 100).toFixed(1)}%`} />
              <Stat label="Edge" value={`${edge >= 0 ? "+" : ""}${(edge * 100).toFixed(1)}%`} color={edge >= 0 ? "#22c55e" : "#ef4444"} />
              <Stat label="Dec Odds" value={decimalOdds.toFixed(2)} />
            </div>
          </div>

          {/* Kelly sizing */}
          <div className="card">
            <div style={{ fontSize: "0.7rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#666", marginBottom: "0.75rem" }}>
              Position Sizing
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
              <SizeRow label="Full Kelly"    pct={kf}  bankroll={form.bankrollAtTime} color="#ef4444" warn />
              <SizeRow label="Half Kelly"    pct={hk}  bankroll={form.bankrollAtTime} color="#f59e0b" />
              <SizeRow label="Quarter Kelly" pct={qk}  bankroll={form.bankrollAtTime} color="#22c55e" />
              <hr className="divider" />
              <div style={{ background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.2)", borderRadius: "8px", padding: "0.75rem" }}>
                <div style={{ fontSize: "0.7rem", color: "#22c55e", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em" }}>
                  Recommended Size
                </div>
                <div style={{ fontSize: "1.5rem", fontWeight: 900, color: "#22c55e", lineHeight: 1.2, marginTop: "0.2rem" }}>
                  ${Math.round(recSize).toLocaleString()}
                </div>
                <div style={{ fontSize: "0.72rem", color: "#555", marginTop: "0.2rem" }}>
                  ¼-Kelly × confidence ({form.confidence}%), capped 10% bankroll
                </div>
              </div>
            </div>
          </div>

          {/* Risk badge */}
          <div className="card">
            <div style={{ fontSize: "0.7rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#666", marginBottom: "0.5rem" }}>
              Risk Rating
            </div>
            <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
              <span className={`badge badge-${riskBadge(risk)}`} style={{ fontSize: "0.85rem", padding: "0.3rem 0.8rem" }}>
                {risk}
              </span>
              <span className={`badge badge-${verdictBadge(form.verdict)}`} style={{ fontSize: "0.85rem", padding: "0.3rem 0.8rem" }}>
                {form.verdict.toUpperCase()}
              </span>
            </div>
            <div style={{ fontSize: "0.75rem", color: "#555", marginTop: "0.5rem" }}>
              Confidence: {form.confidence}% · Kelly: {(kf * 100).toFixed(1)}%
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Helpers ──────────────────────────────────────────────────

function parseDecimalOdds(oddsInput: OddsInput): number {
  const v = parseFloat(oddsInput.value);
  if (isNaN(v)) return 2.0;
  if (oddsInput.format === "american") return americanToDecimal(v);
  if (oddsInput.format === "implied") return v > 0 ? 100 / v : 2.0;
  return Math.max(1.001, v);
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="card">
      <div className="section-label">{label}</div>
      <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
        {children}
      </div>
    </div>
  );
}

function LabeledField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div style={{ fontSize: "0.75rem", color: "#666", marginBottom: "0.3rem" }}>{label}</div>
      {children}
    </div>
  );
}

function Stat({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div>
      <div style={{ fontSize: "0.65rem", color: "#555", textTransform: "uppercase", letterSpacing: "0.08em" }}>{label}</div>
      <div style={{ fontSize: "0.9rem", fontWeight: 700, color: color ?? "#f0f0f0" }}>{value}</div>
    </div>
  );
}

function SizeRow({ label, pct, bankroll, color, warn }: { label: string; pct: number; bankroll: number; color: string; warn?: boolean }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "0.8rem" }}>
      <span style={{ color: "#aaa" }}>{label}</span>
      <span style={{ fontWeight: 700, color: warn && pct > 0.20 ? "#ef4444" : color }}>
        {(pct * 100).toFixed(1)}% · ${Math.round(pct * bankroll).toLocaleString()}
      </span>
    </div>
  );
}

function riskBadge(r: string) {
  if (r === "Low") return "green";
  if (r === "Medium") return "amber";
  return "red";
}

function verdictBadge(v: string) {
  if (v === "bet") return "green";
  if (v === "pass") return "red";
  if (v === "watchlist") return "amber";
  return "blue";
}
