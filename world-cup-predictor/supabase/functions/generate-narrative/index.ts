/**
 * generate-narrative — Admin Edge Function
 * GoalEdge.io
 *
 * POST /functions/v1/generate-narrative
 * Uses Claude to generate a human-readable match preview and betting narrative.
 * Stores result in match_predictions.narrative (JSONB).
 * Requires service role auth.
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import Anthropic from 'https://esm.sh/@anthropic-ai/sdk@0.24';
import { handleCors, jsonResponse, errorResponse } from '../_shared/cors.ts';

const MODEL = 'claude-opus-4-8';

Deno.serve(async (req) => {
  const corsResp = handleCors(req);
  if (corsResp) return corsResp;

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY');
  if (!anthropicKey) {
    return errorResponse('MISSING_CONFIG', 'ANTHROPIC_API_KEY not configured.', 500);
  }

  try {
    const body = await req.json();
    const { match_id, force_regenerate = false } = body;

    if (!match_id) {
      return errorResponse('MISSING_PARAMS', 'match_id is required.');
    }

    // Fetch match + latest prediction + value bets
    const [matchRes, predRes, valueBetsRes] = await Promise.all([
      supabase
        .from('matches')
        .select(`
          id, match_number, stage, group_letter, kickoff_utc,
          home_team:teams!home_team_id(id, name, fifa_code, elo_rating, form_score, avg_xg_scored, avg_xg_conceded),
          away_team:teams!away_team_id(id, name, fifa_code, elo_rating, form_score, avg_xg_scored, avg_xg_conceded)
        `)
        .eq('id', match_id)
        .single(),

      supabase
        .from('match_predictions')
        .select(`
          id, version, narrative,
          prob_home_win, prob_draw, prob_away_win,
          fair_odds_home, fair_odds_draw, fair_odds_away,
          expected_goals_home, expected_goals_away,
          prob_over_25, prob_btts_yes,
          confidence_score, confidence_factors, key_factors,
          lambda_home, lambda_away
        `)
        .eq('match_id', match_id)
        .eq('is_published', true)
        .order('version', { ascending: false })
        .limit(1)
        .single(),

      supabase
        .from('value_bets')
        .select('market, selection, bookmaker, decimal_odds, ev_percentage, our_probability, recommended_fraction')
        .eq('match_id', match_id)
        .eq('is_active', true)
        .order('ev_percentage', { ascending: false })
        .limit(5),
    ]);

    if (matchRes.error || !matchRes.data) {
      return errorResponse('MATCH_NOT_FOUND', `Match ${match_id} not found.`, 404);
    }
    if (predRes.error || !predRes.data) {
      return errorResponse('PREDICTION_NOT_FOUND', 'No published prediction found for this match.');
    }

    const match = matchRes.data as any;
    const pred  = predRes.data as any;

    // Skip regeneration if narrative already exists and not forced
    if (pred.narrative && !force_regenerate) {
      return jsonResponse({
        success:  true,
        match_id,
        cached:   true,
        narrative: pred.narrative,
      });
    }

    const valueBets = valueBetsRes.data ?? [];

    // Build the prompt for Claude
    const kickoffDate = new Date(match.kickoff_utc).toLocaleDateString('en-GB', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    });
    const kickoffTime = new Date(match.kickoff_utc).toLocaleTimeString('en-GB', {
      hour: '2-digit', minute: '2-digit', timeZone: 'UTC',
    });

    const homeTeam = match.home_team as any;
    const awayTeam = match.away_team as any;

    const systemPrompt = `You are a professional football analyst and sports betting expert writing for GoalEdge.io,
a World Cup 2026 betting intelligence platform. Your audience is experienced bettors who want concise,
data-driven insights. Write with authority but be honest about uncertainty. Never recommend reckless gambling.
Always frame advice around value and expected value, not "backing the winner". Keep the tone analytical,
confident, and direct. No filler phrases like "absolutely" or "certainly".`;

    const userPrompt = `Generate a match preview and betting analysis for:

**${homeTeam.name} vs ${awayTeam.name}**
Stage: ${match.stage} — Group ${match.group_letter}
Kickoff: ${kickoffDate} at ${kickoffTime} UTC

## Model Probabilities (Dixon-Coles)
- Home Win (${homeTeam.name}): ${(pred.prob_home_win * 100).toFixed(1)}% — Fair odds: ${pred.fair_odds_home.toFixed(2)}
- Draw: ${(pred.prob_draw * 100).toFixed(1)}% — Fair odds: ${pred.fair_odds_draw.toFixed(2)}
- Away Win (${awayTeam.name}): ${(pred.prob_away_win * 100).toFixed(1)}% — Fair odds: ${pred.fair_odds_away.toFixed(2)}
- Expected Goals: ${pred.expected_goals_home.toFixed(2)} – ${pred.expected_goals_away.toFixed(2)}
- Over 2.5 Goals: ${(pred.prob_over_25 * 100).toFixed(1)}%
- BTTS Yes: ${(pred.prob_btts_yes * 100).toFixed(1)}%

## Team Ratings
${homeTeam.name}: Elo ${homeTeam.elo_rating}, Form ${homeTeam.form_score?.toFixed(2) ?? 'N/A'}, xG scored ${homeTeam.avg_xg_scored?.toFixed(2) ?? 'N/A'}/game, xG conceded ${homeTeam.avg_xg_conceded?.toFixed(2) ?? 'N/A'}/game
${awayTeam.name}: Elo ${awayTeam.elo_rating}, Form ${awayTeam.form_score?.toFixed(2) ?? 'N/A'}, xG scored ${awayTeam.avg_xg_scored?.toFixed(2) ?? 'N/A'}/game, xG conceded ${awayTeam.avg_xg_conceded?.toFixed(2) ?? 'N/A'}/game

## Key Factors
${(pred.key_factors ?? []).join('\n')}

## Model Confidence: ${pred.confidence_score}/100
${pred.confidence_factors ? Object.entries(pred.confidence_factors).map(([k, v]) => `- ${k}: ${v}`).join('\n') : ''}

${valueBets.length > 0 ? `## Active Value Bets (EV ≥ 3%)
${valueBets.map((vb: any) => `- ${vb.market} ${vb.selection} @ ${vb.decimal_odds} (${vb.bookmaker}) — EV: +${vb.ev_percentage.toFixed(1)}%, Kelly: ${(vb.recommended_fraction * 100).toFixed(2)}% bankroll`).join('\n')}` : '## No Active Value Bets\nNo significant edges found vs current market odds.'}

---

Write the following sections:

1. **Match Preview** (2-3 paragraphs): tactical context, key factors, tournament stakes
2. **Model Verdict** (1 paragraph): what the numbers say, where we see it going
3. **Betting Angles** (bullet list): specific actionable angles with brief rationale
4. **Risk Factors** (2-3 bullets): what could make the model wrong
5. **One-Line Summary**: a single punchy sentence capturing the betting case

Keep total length under 450 words. Be precise with numbers. Avoid clichés.`;

    const anthropic = new Anthropic({ apiKey: anthropicKey });

    const message = await anthropic.messages.create({
      model:      MODEL,
      max_tokens: 1024,
      messages: [{ role: 'user', content: userPrompt }],
      system: systemPrompt,
    });

    const narrativeText = message.content
      .filter((b: any) => b.type === 'text')
      .map((b: any) => b.text)
      .join('\n');

    const narrative = {
      text:         narrativeText,
      generated_at: new Date().toISOString(),
      model:        MODEL,
      version:      pred.version,
      tokens_used:  message.usage?.input_tokens + message.usage?.output_tokens,
    };

    // Store narrative on the prediction record
    const { error: updateErr } = await supabase
      .from('match_predictions')
      .update({ narrative })
      .eq('id', pred.id);

    if (updateErr) {
      console.error('Failed to save narrative:', updateErr);
      // Return narrative anyway — don't fail the request
    }

    return jsonResponse({
      success:    true,
      match_id,
      cached:     false,
      narrative,
    });
  } catch (err) {
    console.error('generate-narrative error:', err);
    return errorResponse('INTERNAL_ERROR', String(err), 500);
  }
});
