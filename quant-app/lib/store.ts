// localStorage helpers and shared data types

export function getItem<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export function setItem<T>(key: string, value: T): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(key, JSON.stringify(value));
}

export const KEYS = {
  TRADES: "qf_trades",
  BANKROLL: "qf_bankroll",
} as const;

export type Verdict = "bet" | "pass" | "watchlist" | "hedge";
export type RiskLevel = "Low" | "Medium" | "High";
export type Market = "financial" | "sports" | "prediction" | "crypto" | "other";
export type OddsFormat = "american" | "decimal" | "implied";
export type Outcome = "win" | "loss" | "push" | "pending";

export interface TradeAnalysis {
  id: string;
  createdAt: string;

  // Asset
  asset: string;
  market: Market;
  description: string;

  // A. Executive Summary
  recommendation: string;
  confidence: number; // 0–100
  risk: RiskLevel;
  verdict: Verdict;

  // B. Quantitative
  estimatedProb: number;      // 0–1 (analyst's true probability)
  marketOddsDecimal: number;  // market price as decimal odds
  marketImpliedProb: number;  // 1 / marketOddsDecimal
  ev: number;                 // fraction of stake
  kellyFraction: number;      // full Kelly
  recommendedSizeDollars: number;
  bankrollAtTime: number;

  // C. Market Analysis
  mispricing: string;
  contrarian: string;
  catalyst: string;

  // D. Risk Management
  maxExposurePct: number; // % of bankroll
  exitCriteria: string;

  // E. Scenarios
  bestCase: string;
  baseCase: string;
  worstCase: string;
  changeEvidence: string;

  // Outcome
  outcome: Outcome;
  actualSizeDollars?: number;
  actualProfitDollars?: number;
  closedAt?: string;
  outcomeNotes?: string;
}

export interface BankrollEntry {
  id: string;
  date: string;
  amount: number;
  note: string;
}
