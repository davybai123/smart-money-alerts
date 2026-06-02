/**
 * refresh-value-bets — Admin Edge Function
 * GoalEdge.io
 *
 * POST /functions/v1/refresh-value-bets
 * Compares our model's fair odds to the latest bookmaker odds.
 * Deletes stale value bets, inserts new ones where EV ≥ 3%.
 * Called after ingest-odds completes.
 * Requires service role auth.
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { handleCors, jsonResponse, errorResponse } from '../_shared/cors.ts';
import { calculateEV, deVig, rankByEV, type MarketCandidate } from '../_shared/kelly.ts';

const MIN_EV_PCT = 3.0;

Deno.serve(async (req) => {
  const corsResp = handleCors(req);
  if (corsResp) return corsResp;

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  try {
    const body = await req.json().catch(() => ({}));
    const matchIds: string[] | null = body.match_ids ?? null;
    const dryRun: boolean           = body.dry_run ?? false;
    const minEvPct: number          = body.min_ev_pct ?? MIN_EV_PCT;

    // 1. Fetch latest published predictions for upcoming matches
    let predQuery = supabase
      .from('match_predictions')
      .select(`
        id, match_id, version,
        prob_home_win, prob_draw, prob_away_win,
        prob_over_15, prob_over_25, prob_over_35,
        prob_btts_yes,
        confidence_score,
        match:matches!match_id(
          id, kickoff_utc, status,
          home_team:teams!home_team_id(id, name),
          away_team:teams!away_team_id(id, name)
        )
      `)
      .eq('is_published', true)
      .eq('is_locked', false)
      .order('match_id')
      .order('version', { ascending: false });

    if (matchIds?.length) {
      predQuery = predQuery.in('match_id', matchIds);
    }

    const { data: predictions, error: predErr } = await predQuery;
    if (predErr) throw predErr;

    if (!predictions?.length) {
      return jsonResponse({ message: 'No published predictions found.', refreshed: 0 });
    }

    // Deduplicate — keep highest version per match
    const latestByMatch = new Map<string, any>();
    for (const p of predictions as any[]) {
      if (!latestByMatch.has(p.match_id)) {
        latestByMatch.set(p.match_id, p);
      }
    }
    const activePredictions = [...latestByMatch.values()];
    const activeMatchIds    = activePredictions.map((p: any) => p.match_id);

    // 2. Fetch latest bookmaker odds for these matches
    // "Latest" = rows fetched within the last 45 minutes
    const since = new Date(Date.now() - 45 * 60 * 1000).toISOString();

    const { data: allOdds, error: oddsErr } = await supabase
      .from('bookmaker_odds')
      .select('match_id, bookmaker, market, selection, decimal_odds, fetched_at')
      .in('match_id', activeMatchIds)
      .gte('fetched_at', since)
      .order('match_id')
      .order('market')
      .order('selection')
      .order('fetched_at', { ascending: false });

    if (oddsErr) throw oddsErr;

    // 3. Build odds lookup: match_id → market → selection → best decimal odds
    const oddsMap = buildOddsMap(allOdds ?? [], activePredictions);

    // 4. Build value bet candidates
    const candidates: Array<MarketCandidate & { match_id: string; prediction_id: string; bookmaker: string }> = [];

    for (const pred of activePredictions as any[]) {
      const matchOdds = oddsMap.get(pred.match_id);
      if (!matchOdds) continue;

      const homeName = pred.match.home_team.name;
      const awayName = pred.match.away_team.name;

      const marketDefs: Array<{ market: string; selection: string; ourProb: number }> = [
        { market: '1x2',      selection: 'home',     ourProb: pred.prob_home_win },
        { market: '1x2',      selection: 'draw',     ourProb: pred.prob_draw },
        { market: '1x2',      selection: 'away',     ourProb: pred.prob_away_win },
        { market: 'over_25',  selection: 'over_25',  ourProb: pred.prob_over_25 },
        { market: 'over_25',  selection: 'under_25', ourProb: 1 - pred.prob_over_25 },
        { market: 'over_15',  selection: 'over_15',  ourProb: pred.prob_over_15 },
        { market: 'over_35',  selection: 'over_35',  ourProb: pred.prob_over_35 },
        { market: 'btts',     selection: 'yes',      ourProb: pred.prob_btts_yes },
        { market: 'btts',     selection: 'no',       ourProb: 1 - pred.prob_btts_yes },
      ];

      for (const def of marketDefs) {
        const bestOdd = matchOdds.get(`${def.market}|${def.selection}`);
        if (!bestOdd) continue;

        candidates.push({
          match_id:      pred.match_id,
          prediction_id: pred.id,
          market:        def.market,
          selection:     def.selection,
          ourProbability: def.ourProb,
          decimalOdds:   bestOdd.odds,
          bookmaker:     bestOdd.bookmaker,
          confidence:    pred.confidence_score ?? 70,
        });
      }
    }

    // 5. Calculate EV for each candidate and filter
    const valueBets = candidates
      .map((c) => {
        const ev = calculateEV(c.ourProbability, c.decimalOdds, c.confidence ?? 70);
        return { ...c, ...ev };
      })
      .filter((c) => c.evPercentage >= minEvPct)
      .sort((a, b) => b.evPercentage - a.evPercentage);

    if (!dryRun) {
      // 6a. Delete stale value bets for these matches
      const { error: deleteErr } = await supabase
        .from('value_bets')
        .delete()
        .in('match_id', activeMatchIds);

      if (deleteErr) throw deleteErr;

      // 6b. Insert new value bets
      if (valueBets.length > 0) {
        const rows = valueBets.map((v) => ({
          match_id:              v.match_id,
          prediction_id:         v.prediction_id,
          market:                v.market,
          selection:             v.selection,
          bookmaker:             v.bookmaker,
          decimal_odds:          v.decimalOdds,
          our_probability:       v.ourProbability,
          market_implied_prob:   +(1 / v.decimalOdds).toFixed(6),
          ev_percentage:         v.evPercentage,
          ev_fraction:           v.evFraction,
          kelly_fraction:        v.kellyFraction,
          half_kelly:            v.halfKelly,
          quarter_kelly:         v.quarterKelly,
          recommended_fraction:  v.recommendedFraction,
          confidence_score:      v.confidence ?? 70,
          is_active:             true,
          refreshed_at:          new Date().toISOString(),
        }));

        const { error: insertErr } = await supabase
          .from('value_bets')
          .insert(rows);

        if (insertErr) throw insertErr;
      }
    }

    return jsonResponse({
      success:      true,
      matches_scanned: activePredictions.length,
      candidates_evaluated: candidates.length,
      value_bets_found: valueBets.length,
      dry_run: dryRun,
      top_bets: valueBets.slice(0, 10).map((v) => ({
        match_id:    v.match_id,
        market:      v.market,
        selection:   v.selection,
        bookmaker:   v.bookmaker,
        decimal_odds: v.decimalOdds,
        ev_pct:      v.evPercentage,
        verdict:     v.verdict,
        recommended_fraction: v.recommendedFraction,
      })),
    });
  } catch (err) {
    console.error('refresh-value-bets error:', err);
    return errorResponse('INTERNAL_ERROR', String(err), 500);
  }
});

interface OddsEntry { odds: number; bookmaker: string }

/**
 * Build a nested map: match_id → "market|selection" → best (highest) decimal odds.
 * For h2h markets, resolve team-name selections to "home"/"away" using prediction data.
 */
function buildOddsMap(
  rows: any[],
  predictions: any[],
): Map<string, Map<string, OddsEntry>> {
  // Build team-name → role lookup for each match
  const matchRoles = new Map<string, { home: string; away: string }>();
  for (const p of predictions as any[]) {
    matchRoles.set(p.match_id, {
      home: p.match.home_team.name.toLowerCase(),
      away: p.match.away_team.name.toLowerCase(),
    });
  }

  const result = new Map<string, Map<string, OddsEntry>>();

  for (const row of rows) {
    let { match_id, market, selection, decimal_odds, bookmaker } = row;

    // Resolve h2h team names to "home"/"away"
    if (market === '1x2' && selection !== 'draw') {
      const roles = matchRoles.get(match_id);
      if (!roles) continue;
      const selLower = selection.toLowerCase();
      if (selLower === roles.home) {
        selection = 'home';
      } else if (selLower === roles.away) {
        selection = 'away';
      } else {
        continue; // unknown team name
      }
    }

    // Normalise totals selections
    // The Odds API gives "over_15" / "under_25" etc (already normalised in ingest-odds)

    if (!result.has(match_id)) {
      result.set(match_id, new Map());
    }
    const matchMap = result.get(match_id)!;
    const key = `${market}|${selection}`;
    const existing = matchMap.get(key);

    // Keep best (highest) odds across bookmakers
    if (!existing || decimal_odds > existing.odds) {
      matchMap.set(key, { odds: decimal_odds, bookmaker });
    }
  }

  return result;
}
