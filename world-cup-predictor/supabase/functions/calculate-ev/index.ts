/**
 * calculate-ev — Public Edge Function
 * GoalEdge.io
 *
 * POST /functions/v1/calculate-ev
 * Calculates EV for a user-provided bookmaker odds input against our model's probability.
 * No auth required.
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { handleCors, jsonResponse, errorResponse } from '../_shared/cors.ts';
import { calculateEV, americanToDecimal, fractionalToDecimal, impliedToDecimal } from '../_shared/kelly.ts';

Deno.serve(async (req) => {
  const corsResp = handleCors(req);
  if (corsResp) return corsResp;

  try {
    const body = await req.json();
    const { match_id, market, selection, decimal_odds, american_odds, fractional_odds, implied_pct } = body;

    if (!match_id || !market || !selection) {
      return errorResponse('MISSING_PARAMS', 'match_id, market, and selection are required.');
    }

    // Resolve decimal odds from whatever format was provided
    let decOdds: number;
    if (decimal_odds) {
      decOdds = Number(decimal_odds);
    } else if (american_odds !== undefined) {
      decOdds = americanToDecimal(Number(american_odds));
    } else if (fractional_odds) {
      decOdds = fractionalToDecimal(String(fractional_odds));
    } else if (implied_pct) {
      decOdds = impliedToDecimal(Number(implied_pct));
    } else {
      return errorResponse('INVALID_ODDS_FORMAT', 'Provide decimal_odds, american_odds, fractional_odds, or implied_pct.');
    }

    if (decOdds <= 1.0 || isNaN(decOdds)) {
      return errorResponse('INVALID_ODDS', 'Decimal odds must be greater than 1.0.');
    }

    // Fetch our probability for this market+selection
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
    );

    const { data: pred, error } = await supabase
      .from('match_predictions')
      .select('*')
      .eq('match_id', match_id)
      .eq('is_published', true)
      .order('version', { ascending: false })
      .limit(1)
      .single();

    if (error || !pred) {
      return errorResponse('PREDICTION_NOT_FOUND', 'No published prediction found for this match.');
    }

    // Map market+selection to our probability field
    const probMap: Record<string, Record<string, number>> = {
      '1x2': {
        'home': pred.prob_home_win,
        'draw': pred.prob_draw,
        'away': pred.prob_away_win,
      },
      'over_25': { 'over': pred.prob_over_25 },
      'under_25': { 'under': 1 - pred.prob_over_25 },
      'over_15': { 'over': pred.prob_over_15 },
      'under_15': { 'under': 1 - pred.prob_over_15 },
      'over_35': { 'over': pred.prob_over_35 },
      'under_35': { 'under': 1 - pred.prob_over_35 },
      'btts': { 'yes': pred.prob_btts_yes, 'no': 1 - pred.prob_btts_yes },
    };

    const marketProbs = probMap[market.toLowerCase()];
    if (!marketProbs) {
      return errorResponse('UNKNOWN_MARKET', `Market '${market}' is not supported.`);
    }

    const ourProb = marketProbs[selection.toLowerCase()];
    if (ourProb === undefined) {
      return errorResponse('UNKNOWN_SELECTION', `Selection '${selection}' not valid for market '${market}'.`);
    }

    const ev = calculateEV(ourProb, decOdds, pred.confidence_score ?? 70);

    return jsonResponse({
      match_id,
      market,
      selection,
      our_probability: ourProb,
      market_decimal_odds: decOdds,
      market_implied_probability: +(1 / decOdds).toFixed(6),
      ...ev,
      confidence_score: pred.confidence_score,
      fair_odds: +(1 / ourProb).toFixed(3),
    });
  } catch (err) {
    console.error('calculate-ev error:', err);
    return errorResponse('INTERNAL_ERROR', 'An unexpected error occurred.', 500);
  }
});
