/**
 * Kelly Criterion and EV utilities — GoalEdge.io
 */

export interface EVResult {
  evPercentage: number;
  evFraction: number;
  edge: number;
  kellyFraction: number;
  halfKelly: number;
  quarterKelly: number;
  /** Quarter-Kelly scaled by confidence, hard-capped at 5% bankroll */
  recommendedFraction: number;
  verdict: 'exceptional' | 'strong' | 'marginal' | 'negative';
  verdictLabel: string;
}

/**
 * Calculate EV and Kelly sizing for a single bet.
 *
 * @param ourProb       Our estimated win probability (0-1)
 * @param decimalOdds   Bookmaker decimal odds (e.g. 2.40)
 * @param confidence    Model confidence score (0-100)
 */
export function calculateEV(
  ourProb: number,
  decimalOdds: number,
  confidence = 70,
): EVResult {
  const b = decimalOdds - 1; // net profit per unit staked
  const q = 1 - ourProb;
  const marketProb = 1 / decimalOdds;

  // Expected value = (prob × win) − (prob_lose × stake)
  const evFraction = ourProb * b - q;
  const evPercentage = evFraction * 100;
  const edge = (ourProb - marketProb) * 100; // percentage points edge

  // Full Kelly fraction
  const kellyFraction = b > 0 ? Math.max(0, (b * ourProb - q) / b) : 0;
  const halfKelly = kellyFraction / 2;
  const quarterKelly = kellyFraction / 4;

  // Recommended: quarter-Kelly scaled by confidence, hard-cap 5% bankroll
  const confidenceScale = confidence / 100;
  const recommendedFraction = Math.min(0.05, quarterKelly * confidenceScale);

  const verdict: EVResult['verdict'] =
    evPercentage >= 15 ? 'exceptional' :
    evPercentage >= 8  ? 'strong' :
    evPercentage >= 3  ? 'marginal' : 'negative';

  const verdictLabel =
    verdict === 'exceptional' ? 'Exceptional +EV' :
    verdict === 'strong'      ? 'Strong +EV' :
    verdict === 'marginal'    ? 'Marginal +EV' : 'Negative EV';

  return {
    evPercentage: +evPercentage.toFixed(3),
    evFraction: +evFraction.toFixed(6),
    edge: +edge.toFixed(3),
    kellyFraction: +kellyFraction.toFixed(6),
    halfKelly: +halfKelly.toFixed(6),
    quarterKelly: +quarterKelly.toFixed(6),
    recommendedFraction: +recommendedFraction.toFixed(6),
    verdict,
    verdictLabel,
  };
}

/** Convert American odds to decimal */
export function americanToDecimal(american: number): number {
  return american > 0 ? american / 100 + 1 : 100 / Math.abs(american) + 1;
}

/** Convert fractional string "5/2" to decimal */
export function fractionalToDecimal(frac: string): number {
  const [num, den] = frac.split('/').map(Number);
  return num / den + 1;
}

/** Convert implied probability % to decimal odds */
export function impliedToDecimal(impliedPct: number): number {
  return impliedPct > 0 ? 100 / impliedPct : 2.0;
}

/** De-vig a set of raw implied probabilities (removes bookmaker margin) */
export function deVig(rawProbs: number[]): number[] {
  const overround = rawProbs.reduce((s, p) => s + p, 0);
  return rawProbs.map((p) => p / overround);
}

/**
 * Find best value bet across multiple markets for a single match.
 * Returns markets sorted by EV descending.
 */
export interface MarketCandidate {
  market: string;
  selection: string;
  ourProbability: number;
  decimalOdds: number;
  bookmaker: string;
  confidence?: number;
}

export function rankByEV(
  candidates: MarketCandidate[],
  minEVPct = 3.0,
): Array<MarketCandidate & EVResult> {
  return candidates
    .map((c) => ({
      ...c,
      ...calculateEV(c.ourProbability, c.decimalOdds, c.confidence ?? 70),
    }))
    .filter((c) => c.evPercentage >= minEVPct)
    .sort((a, b) => b.evPercentage - a.evPercentage);
}
