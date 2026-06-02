/**
 * Dixon-Coles Bivariate Poisson Model
 * World Cup 2026 Prediction Engine — GoalEdge.io
 *
 * Reference: Dixon & Coles (1997) "Modelling Association Football Scores
 * and Inefficiencies in the Football Betting Market"
 *
 * The model corrects pure Poisson for the correlation of low-scoring outcomes:
 *   0-0, 1-0, 0-1, 1-1 are all more/less frequent than independence predicts.
 */

const MAX_GOALS = 8;

/** Poisson probability mass function */
function poissonPMF(lambda: number, k: number): number {
  if (lambda <= 0) return k === 0 ? 1 : 0;
  let logP = -lambda + k * Math.log(lambda) - logFactorial(k);
  return Math.exp(logP);
}

const logFactCache: number[] = [0]; // log(0!) = 0
function logFactorial(n: number): number {
  while (logFactCache.length <= n) {
    logFactCache.push(logFactCache[logFactCache.length - 1] + Math.log(logFactCache.length));
  }
  return logFactCache[n];
}

/**
 * Dixon-Coles τ correction factor.
 * Applied to cells (0,0), (1,0), (0,1), (1,1) only.
 * ρ ≈ -0.13 for World Cup (estimated from tournament data).
 */
function tau(i: number, j: number, lambda: number, mu: number, rho: number): number {
  if (i === 0 && j === 0) return 1 - lambda * mu * rho;
  if (i === 1 && j === 0) return 1 + mu * rho;
  if (i === 0 && j === 1) return 1 + lambda * rho;
  if (i === 1 && j === 1) return 1 - rho;
  return 1.0;
}

export interface ScoreMatrix {
  matrix: number[][];
  lambdaHome: number;
  lambdaAway: number;
}

/**
 * Build the full score probability matrix P(home=i, away=j).
 *
 * @param attackHome   Home team attack strength (relative to average)
 * @param defenceHome  Home team defence strength (relative to average)
 * @param attackAway   Away team attack strength
 * @param defenceAway  Away team defence strength
 * @param homeAdv      Home advantage factor (1.0 for neutral venues, ~1.12 for host nations)
 * @param globalMean   League/tournament average goals per team per game (default 1.15 for WC)
 * @param rho          Dixon-Coles correlation parameter (default -0.13)
 */
export function buildScoreMatrix(
  attackHome: number,
  defenceHome: number,
  attackAway: number,
  defenceAway: number,
  homeAdv = 1.0,
  globalMean = 1.15,
  rho = -0.13,
): ScoreMatrix {
  const lambdaHome = attackHome * defenceAway * homeAdv * globalMean;
  const lambdaAway = attackAway * defenceHome * globalMean;

  const matrix: number[][] = [];
  let totalProb = 0;

  for (let i = 0; i <= MAX_GOALS; i++) {
    matrix[i] = [];
    for (let j = 0; j <= MAX_GOALS; j++) {
      const t = tau(i, j, lambdaHome, lambdaAway, rho);
      const p = poissonPMF(lambdaHome, i) * poissonPMF(lambdaAway, j) * t;
      matrix[i][j] = Math.max(0, p);
      totalProb += matrix[i][j];
    }
  }

  // Normalise to sum = 1
  for (let i = 0; i <= MAX_GOALS; i++) {
    for (let j = 0; j <= MAX_GOALS; j++) {
      matrix[i][j] /= totalProb;
    }
  }

  return { matrix, lambdaHome, lambdaAway };
}

export interface MarketProbabilities {
  // 1X2
  probHomeWin: number;
  probDraw: number;
  probAwayWin: number;
  fairOddsHome: number;
  fairOddsDraw: number;
  fairOddsAway: number;

  // Goals
  probOver15: number;
  probUnder15: number;
  probOver25: number;
  probUnder25: number;
  probOver35: number;
  probUnder35: number;
  fairOddsOver25: number;
  fairOddsUnder25: number;

  // BTTS
  probBttsYes: number;
  probBttsNo: number;
  fairOddsBttsYes: number;
  fairOddsBttsNo: number;

  // xG projections
  expectedGoalsHome: number;
  expectedGoalsAway: number;

  // Raw lambdas
  lambdaHome: number;
  lambdaAway: number;
}

/** Derive all market probabilities from the score matrix */
export function deriveMarkets(sm: ScoreMatrix): MarketProbabilities {
  const { matrix, lambdaHome, lambdaAway } = sm;

  let probHomeWin = 0, probDraw = 0, probAwayWin = 0;
  let probOver15 = 0, probOver25 = 0, probOver35 = 0;
  let probBttsYes = 0;
  let expectedGoalsHome = 0, expectedGoalsAway = 0;

  for (let i = 0; i <= MAX_GOALS; i++) {
    for (let j = 0; j <= MAX_GOALS; j++) {
      const p = matrix[i][j];
      if (i > j) probHomeWin += p;
      else if (i === j) probDraw += p;
      else probAwayWin += p;

      const total = i + j;
      if (total > 1) probOver15 += p;
      if (total > 2) probOver25 += p;
      if (total > 3) probOver35 += p;
      if (i > 0 && j > 0) probBttsYes += p;

      expectedGoalsHome += i * p;
      expectedGoalsAway += j * p;
    }
  }

  const safeOdds = (p: number) => p > 0.001 ? 1 / p : 999;

  return {
    probHomeWin,
    probDraw,
    probAwayWin,
    fairOddsHome:  safeOdds(probHomeWin),
    fairOddsDraw:  safeOdds(probDraw),
    fairOddsAway:  safeOdds(probAwayWin),

    probOver15, probUnder15: 1 - probOver15,
    probOver25, probUnder25: 1 - probOver25,
    probOver35, probUnder35: 1 - probOver35,
    fairOddsOver25:  safeOdds(probOver25),
    fairOddsUnder25: safeOdds(1 - probOver25),

    probBttsYes, probBttsNo: 1 - probBttsYes,
    fairOddsBttsYes: safeOdds(probBttsYes),
    fairOddsBttsNo:  safeOdds(1 - probBttsYes),

    expectedGoalsHome,
    expectedGoalsAway,
    lambdaHome,
    lambdaAway,
  };
}

export interface TeamRating {
  eloRating: number;
  attackStrength: number;
  defenceStrength: number;
  formScore: number;
  isHostNation?: boolean;
}

/**
 * Run the full prediction pipeline for a single match.
 * Returns market probabilities and the model inputs snapshot.
 */
export function predictMatch(
  home: TeamRating,
  away: TeamRating,
  options: { globalMean?: number; rho?: number } = {},
): MarketProbabilities & { homeAdv: number } {
  const globalMean = options.globalMean ?? 1.15;
  const rho = options.rho ?? -0.13;

  // Host nation advantage
  const homeAdv = home.isHostNation ? 1.08 : 1.0;

  // Elo-based form weighting: scale attack/defence by relative Elo
  // Teams rated much higher than average get a slight boost
  const eloFactor = (elo: number) => Math.pow(10, (elo - 1800) / 800);
  const homeEloFactor = eloFactor(home.eloRating);
  const awayEloFactor = eloFactor(away.eloRating);

  // Blend xG-based strength with Elo factor (70/30 weighting)
  const attackHome = home.attackStrength * 0.7 + homeEloFactor * 0.3;
  const defenceHome = home.defenceStrength;
  const attackAway = away.attackStrength * 0.7 + awayEloFactor * 0.3;
  const defenceAway = away.defenceStrength;

  const sm = buildScoreMatrix(attackHome, defenceHome, attackAway, defenceAway, homeAdv, globalMean, rho);
  const markets = deriveMarkets(sm);

  return { ...markets, homeAdv };
}

/**
 * Compute confidence score for a prediction.
 * Returns 0-100 score and breakdown.
 */
export function computeConfidence(params: {
  homeMatchesAvailable: number;
  awayMatchesAvailable: number;
  h2hCount: number;
  hasXgData: boolean;
  keyInjuries: number;         // count of key players doubtful/out
  marketOddsAvailable: boolean;
  ourProbHome: number;
  marketProbHome: number;      // market implied (de-vigged)
}): { score: number; factors: Record<string, number> } {
  const {
    homeMatchesAvailable,
    awayMatchesAvailable,
    h2hCount,
    hasXgData,
    keyInjuries,
    marketOddsAvailable,
    ourProbHome,
    marketProbHome,
  } = params;

  // Data quality (0-100)
  const dataQuality =
    (hasXgData ? 40 : 0) +
    Math.min(30, homeMatchesAvailable * 3) * 0.5 +
    Math.min(30, awayMatchesAvailable * 3) * 0.5;

  // H2H depth (0-100)
  const h2hScore =
    h2hCount >= 10 ? 100 :
    h2hCount >= 6  ?  75 :
    h2hCount >= 3  ?  50 :
    h2hCount >= 1  ?  25 : 10;

  // Injury clarity (0-100)
  const injuryScore =
    keyInjuries === 0 ? 100 :
    keyInjuries === 1 ?  50 :
    keyInjuries === 2 ?  25 : 10;

  // Market agreement (0-100) — divergence from 5-15% is GOOD (edge exists)
  const probDiff = Math.abs(ourProbHome - marketProbHome);
  const marketAgreement =
    !marketOddsAvailable    ? 30 :
    probDiff < 0.03         ? 40 :   // basically same as market
    probDiff < 0.10         ? 80 :   // moderate edge — credible
    probDiff < 0.18         ? 60 :   // larger edge — could be right
    20;                              // huge divergence — be careful

  // Model stability: estimate from how close probs are (proxy)
  const modelStability = 70; // Default; real implementation re-runs with perturbed params

  const score =
    0.30 * dataQuality +
    0.25 * modelStability +
    0.20 * marketAgreement +
    0.15 * h2hScore +
    0.10 * injuryScore;

  return {
    score: Math.round(Math.min(100, Math.max(0, score))),
    factors: {
      dataQuality: Math.round(dataQuality),
      modelStability: Math.round(modelStability),
      marketAgreement: Math.round(marketAgreement),
      h2hScore: Math.round(h2hScore),
      injuryScore: Math.round(injuryScore),
    },
  };
}
