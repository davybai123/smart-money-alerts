/**
 * match-analysis — Public Edge Function
 * GoalEdge.io
 *
 * GET /functions/v1/match-analysis?match_id=<uuid>
 * Returns a complete analysis bundle for a single match:
 *   - Match details and team info
 *   - Latest published prediction with all market probabilities
 *   - Top value bets (EV ≥ 3%)
 *   - Best available odds per market
 *   - Head-to-head summary
 *   - Confidence score breakdown
 * No auth required (public endpoint).
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { handleCors, jsonResponse, errorResponse } from '../_shared/cors.ts';

Deno.serve(async (req) => {
  const corsResp = handleCors(req);
  if (corsResp) return corsResp;

  try {
    const url       = new URL(req.url);
    const matchId   = url.searchParams.get('match_id');

    if (!matchId) {
      return errorResponse('MISSING_PARAMS', 'match_id query parameter is required.');
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
    );

    // Run all lookups in parallel
    const [matchRes, predRes, valueBetsRes, oddsRes] = await Promise.all([
      // Match details
      supabase
        .from('matches')
        .select(`
          id, match_number, stage, group_letter, kickoff_utc, status, venue, city, country,
          score_home, score_away, score_home_et, score_away_et, score_home_pens, score_away_pens,
          home_team:teams!home_team_id(
            id, fifa_code, name, flag_url, is_host_nation,
            elo_rating, attack_strength, defence_strength, form_score,
            avg_xg_scored, avg_xg_conceded
          ),
          away_team:teams!away_team_id(
            id, fifa_code, name, flag_url, is_host_nation,
            elo_rating, attack_strength, defence_strength, form_score,
            avg_xg_scored, avg_xg_conceded
          )
        `)
        .eq('id', matchId)
        .single(),

      // Latest published prediction
      supabase
        .from('match_predictions')
        .select(`
          id, version, is_published, is_locked, published_at,
          home_elo, away_elo, home_attack, home_defence, away_attack, away_defence,
          home_form, away_form, lambda_home, lambda_away, rho,
          prob_home_win, prob_draw, prob_away_win,
          fair_odds_home, fair_odds_draw, fair_odds_away,
          expected_goals_home, expected_goals_away,
          prob_over_15, prob_over_25, prob_over_35, prob_btts_yes,
          fair_odds_over_25, fair_odds_under_25, fair_odds_btts_yes, fair_odds_btts_no,
          confidence_score, confidence_factors, data_quality_score, model_agreement_score,
          key_factors
        `)
        .eq('match_id', matchId)
        .eq('is_published', true)
        .order('version', { ascending: false })
        .limit(1)
        .single(),

      // Active value bets
      supabase
        .from('value_bets')
        .select(`
          id, market, selection, bookmaker, decimal_odds,
          our_probability, market_implied_prob,
          ev_percentage, ev_fraction, recommended_fraction,
          confidence_score
        `)
        .eq('match_id', matchId)
        .eq('is_active', true)
        .order('ev_percentage', { ascending: false }),

      // Best odds per market (most recent 60 min)
      supabase
        .from('bookmaker_odds')
        .select('market, selection, bookmaker, decimal_odds, fetched_at')
        .eq('match_id', matchId)
        .gte('fetched_at', new Date(Date.now() - 60 * 60 * 1000).toISOString())
        .order('market')
        .order('decimal_odds', { ascending: false }),
    ]);

    if (matchRes.error || !matchRes.data) {
      return errorResponse('MATCH_NOT_FOUND', `Match ${matchId} not found.`, 404);
    }

    const match = matchRes.data as any;

    // Aggregate best odds per market+selection
    const bestOdds = aggregateBestOdds(oddsRes.data ?? []);

    // Build score display string for completed matches
    const scoreDisplay = buildScoreDisplay(match);

    // Prepare response
    const response: any = {
      match: {
        id:           match.id,
        match_number: match.match_number,
        stage:        match.stage,
        group:        match.group_letter,
        kickoff_utc:  match.kickoff_utc,
        status:       match.status,
        venue:        match.venue,
        city:         match.city,
        country:      match.country,
        score:        scoreDisplay,
        home_team:    match.home_team,
        away_team:    match.away_team,
      },
      prediction: null,
      value_bets: [],
      best_odds:  bestOdds,
      odds_count: (oddsRes.data ?? []).length,
    };

    if (!predRes.error && predRes.data) {
      const pred = predRes.data as any;
      response.prediction = {
        id:         pred.id,
        version:    pred.version,
        is_locked:  pred.is_locked,
        published_at: pred.published_at,

        // 1X2
        markets: {
          '1x2': {
            home: {
              probability: pred.prob_home_win,
              fair_odds:   pred.fair_odds_home,
              best_book_odds: bestOdds['1x2']?.home?.odds ?? null,
              best_bookmaker: bestOdds['1x2']?.home?.bookmaker ?? null,
            },
            draw: {
              probability: pred.prob_draw,
              fair_odds:   pred.fair_odds_draw,
              best_book_odds: bestOdds['1x2']?.draw?.odds ?? null,
              best_bookmaker: bestOdds['1x2']?.draw?.bookmaker ?? null,
            },
            away: {
              probability: pred.prob_away_win,
              fair_odds:   pred.fair_odds_away,
              best_book_odds: bestOdds['1x2']?.away?.odds ?? null,
              best_bookmaker: bestOdds['1x2']?.away?.bookmaker ?? null,
            },
          },
          goals: {
            expected_home: pred.expected_goals_home,
            expected_away: pred.expected_goals_away,
            prob_over_15:  pred.prob_over_15,
            prob_over_25:  pred.prob_over_25,
            prob_over_35:  pred.prob_over_35,
            fair_odds_over_25:  pred.fair_odds_over_25,
            fair_odds_under_25: pred.fair_odds_under_25,
          },
          btts: {
            prob_yes:  pred.prob_btts_yes,
            prob_no:   1 - pred.prob_btts_yes,
            fair_odds_yes: pred.fair_odds_btts_yes,
            fair_odds_no:  pred.fair_odds_btts_no,
          },
        },

        confidence: {
          score:   pred.confidence_score,
          factors: pred.confidence_factors,
          label:   confidenceLabel(pred.confidence_score),
        },

        model_inputs: {
          home_elo:    pred.home_elo,
          away_elo:    pred.away_elo,
          lambda_home: pred.lambda_home,
          lambda_away: pred.lambda_away,
          rho:         pred.rho,
        },

        key_factors: pred.key_factors ?? [],
      };
    }

    response.value_bets = (valueBetsRes.data ?? []).map((vb: any) => ({
      market:     vb.market,
      selection:  vb.selection,
      bookmaker:  vb.bookmaker,
      odds:       vb.decimal_odds,
      our_prob:   vb.our_probability,
      implied_prob: vb.market_implied_prob,
      ev_pct:     vb.ev_percentage,
      ev_label:   evLabel(vb.ev_percentage),
      recommended_fraction: vb.recommended_fraction,
      recommended_pct: +(vb.recommended_fraction * 100).toFixed(2),
    }));

    return jsonResponse(response);
  } catch (err) {
    console.error('match-analysis error:', err);
    return errorResponse('INTERNAL_ERROR', String(err), 500);
  }
});

function aggregateBestOdds(rows: any[]): Record<string, Record<string, { odds: number; bookmaker: string }>> {
  const result: Record<string, Record<string, { odds: number; bookmaker: string }>> = {};

  for (const row of rows) {
    if (!result[row.market]) result[row.market] = {};
    const existing = result[row.market][row.selection];
    if (!existing || row.decimal_odds > existing.odds) {
      result[row.market][row.selection] = {
        odds:       row.decimal_odds,
        bookmaker:  row.bookmaker,
      };
    }
  }

  return result;
}

function buildScoreDisplay(match: any): string | null {
  if (!['completed', 'completed_aet', 'completed_pens', 'in_progress'].includes(match.status)) {
    return null;
  }
  if (match.score_home === null) return null;

  let s = `${match.score_home}–${match.score_away}`;
  if (match.score_home_et !== null) {
    s += ` (AET ${match.score_home_et}–${match.score_away_et})`;
  }
  if (match.score_home_pens !== null) {
    s += ` (PSO ${match.score_home_pens}–${match.score_away_pens})`;
  }
  return s;
}

function confidenceLabel(score: number): string {
  if (score >= 80) return 'Very High';
  if (score >= 65) return 'High';
  if (score >= 50) return 'Moderate';
  if (score >= 35) return 'Low';
  return 'Very Low';
}

function evLabel(evPct: number): string {
  if (evPct >= 15) return 'Exceptional +EV';
  if (evPct >= 8)  return 'Strong +EV';
  if (evPct >= 3)  return 'Marginal +EV';
  return 'Negative EV';
}
