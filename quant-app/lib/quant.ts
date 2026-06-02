// Core quant math: odds conversion, EV, Kelly criterion

export function americanToDecimal(american: number): number {
  if (american > 0) return american / 100 + 1;
  return 100 / Math.abs(american) + 1;
}

export function decimalToAmerican(decimal: number): number {
  if (decimal >= 2) return Math.round((decimal - 1) * 100);
  return Math.round(-100 / (decimal - 1));
}

export function decimalToImpliedProb(decimal: number): number {
  return 1 / decimal;
}

// EV as a fraction of stake. Positive = edge.
// p = true win probability, decimalOdds = market decimal odds
export function calcEV(p: number, decimalOdds: number): number {
  const b = decimalOdds - 1; // net odds (profit per $1 staked)
  const q = 1 - p;
  return p * b - q;
}

// Full Kelly fraction of bankroll to stake.
// b = net decimal odds (decimal - 1), p = true win prob
export function kellyFraction(p: number, b: number): number {
  const q = 1 - p;
  return Math.max(0, (b * p - q) / b);
}

export function halfKelly(p: number, b: number): number {
  return kellyFraction(p, b) / 2;
}

export function quarterKelly(p: number, b: number): number {
  return kellyFraction(p, b) / 4;
}

// Confidence-adjusted position size recommendation:
// Scale half-Kelly by confidence, capped at 10% of bankroll.
export function recommendedSize(
  p: number,
  decimalOdds: number,
  bankroll: number,
  confidence: number
): number {
  const b = decimalOdds - 1;
  const hk = halfKelly(p, b);
  const confidenceScale = confidence / 100;
  const raw = hk * confidenceScale * bankroll;
  return Math.min(raw, bankroll * 0.10); // hard cap at 10% of bankroll
}

export function evLabel(ev: number): string {
  if (ev >= 0.20) return "Exceptional +EV";
  if (ev >= 0.10) return "Strong +EV";
  if (ev >= 0.04) return "Marginal +EV";
  if (ev >= 0) return "Near-Breakeven";
  return "Negative EV";
}

export function evColor(ev: number): string {
  if (ev >= 0.10) return "#22c55e";
  if (ev >= 0.04) return "#f59e0b";
  if (ev >= 0) return "#94a3b8";
  return "#ef4444";
}

export function riskFromInputs(confidence: number, kelly: number): "Low" | "Medium" | "High" {
  if (confidence >= 70 && kelly < 0.05) return "Low";
  if (confidence >= 50 && kelly < 0.15) return "Medium";
  return "High";
}

export interface CongressTradeRow {
  name: string | null;
  party: string | null;
  chamber: string | null;
  ticker: string | null;
  company: string | null;
  tradeType: string | null;
  size: string | null;
  price: string | null;
  daysAfter: number | null;
}

export function parseCongressTrade(raw: string): CongressTradeRow {
  const tickerMatch = raw.match(/([A-Z]{1,5}:[A-Z]{2})/);
  const ticker = tickerMatch?.[1] ?? null;

  const typeMatch = raw.match(/\b(buy|sell)\b/i);
  const tradeType = typeMatch?.[1]?.toLowerCase() ?? null;

  const sizeMatch = raw.match(/(\d+[KM])[\s–\-]+(\d+[KM])/i);
  const size = sizeMatch ? `${sizeMatch[1]}–${sizeMatch[2]}` : null;

  const priceMatch = raw.match(/\$([0-9,.]+)/);
  const price = priceMatch ? `$${priceMatch[1]}` : null;

  const partyMatch = raw.match(/\b(Republican|Democrat)\b/i);
  const party = partyMatch?.[1] ?? null;

  const chamberMatch = raw.match(/\b(House|Senate)\b/i);
  const chamber = chamberMatch?.[1] ?? null;

  const nameMatch = raw.trim().match(/^([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/);
  const name = nameMatch?.[1]?.trim() ?? null;

  const daysMatch = raw.match(/(\d+)\s+days/);
  const daysAfter = daysMatch ? parseInt(daysMatch[1]) : null;

  // Company name: between state abbreviation and ticker
  let company: string | null = null;
  if (ticker) {
    const [beforeTicker] = raw.split(ticker);
    const companyMatch = beforeTicker.match(/(?:House|Senate)[A-Z]{2}\s+(.+?)(?:\d|$)/);
    if (companyMatch) {
      company = companyMatch[1].replace(/\s+/g, " ").trim();
    }
  }

  return { name, party, chamber, ticker, company, tradeType, size, price, daysAfter };
}
