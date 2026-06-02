/**
 * generate-predictions — Admin Edge Function
 * GoalEdge.io
 *
 * POST /functions/v1/generate-predictions
 * Generates Dixon-Coles predictions for all upcoming matches.
 * Requires service role auth.
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { handleCors, jsonResponse, errorResponse } from '../_shared/cors.ts';
import { predictMatch, computeConfidence, type TeamRating } from '../_shared/dixon-coles.ts';

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
    const dryRun: boolean = body.dry_run ?? false;
    const autoPublish: boolean = body.auto_publish ?? false;

    // Fetch upcoming matches that need predictions
    let query = supabase
      .from('matches')
      .select(`
        id, match_number, stage, group_letter, kickoff_utc, status,
        home_team_id, away_team_id,
        home_team:teams!home_team_id(id, fifa_code, name, is_host_nation),
        away_team:teams!away_team_id(id, fifa_code, name, is_host_nation)
      `)
      .eq('status', 'scheduled')
      .gt('kickoff_utc', new Date().toISOString());

    if (matchIds?.length) {
      query = query.in('id', matchIds);
    }

    const { data: matches, error: matchErr } = await query;
    if (matchErr) throw matchErr;
    if (!matches?.length) {
      return jsonResponse({ message: 'No upcoming matches found.', generated: 0 });
    }

    // Fetch latest ratings for all teams involved
    const teamIds = [...new Set(matches.flatMap((m: any) => [m.home_team_id, m.away_team_id]))];

    const { data: ratings, error: ratErr } = await supabase
      .from('v_latest_team_ratings')
      .select('*')
      .in('team_id', teamIds);

    if (ratErr) throw ratErr;

    const ratingByTeam = Object.fromEntries(
      (ratings ?? []).map((r: any) => [r.team_id, r])
    );

    const results: any[] = [];
    let generated = 0;
    let skipped = 0;

    for (const match of matches as any[]) {
      const homeRating = ratingByTeam[match.home_team_id];
      const awayRating = ratingByTeam[match.away_team_id];

      if (!homeRating || !awayRating) {
        console.warn(`Missing ratings for match ${match.id} — skipping`);
        skipped++;
        continue;
      }

      // Check if a prediction already exists for this version
      const { data: existingPred } = await supabase
        .from('match_predictions')
        .select('id, version')
        .eq('match_id', match.id)
        .eq('is_locked', false)
        .order('version', { ascending: false })
        .limit(1)
        .single();

      const nextVersion = existingPred ? existingPred.version + 1 : 1;

      // Run Dixon-Coles model
      const homeTeam: TeamRating = {
        eloRating: homeRating.elo_rating,
        attackStrength: homeRating.attack_strength,
        defenceStrength: homeRating.defence_strength,
        formScore: homeRating.form_score,
        isHostNation: match.home_team.is_host_nation,
      };
      const awayTeam: TeamRating = {
        eloRating: awayRating.elo_rating,
        attackStrength: awayRating.attack_strength,
        defenceStrength: awayRating.defence_strength,
        formScore: awayRating.form_score,
        isHostNation: false, // away team never gets host advantage
      };

      const markets = predictMatch(homeTeam, awayTeam);

      // Compute confidence
      const confidence = computeConfidence({
        homeMatchesAvailable: homeRating.matches_used ?? 10,
        awayMatchesAvailable: awayRating.matches_used ?? 10,
        h2hCount: 5, // default — real implementation fetches H2H
        hasXgData: (homeRating.avg_xg_scored ?? 0) > 0,
        keyInjuries: 0, // default — real implementation checks player_availability
        marketOddsAvailable: false, // will be updated after odds ingestion
        ourProbHome: markets.probHomeWin,
        marketProbHome: 0.33, // default — updated after odds
      });

      const prediction = {
        match_id: match.id,
        version: nextVersion,
        is_published: autoPublish,
        published_at: autoPublish ? new Date().toISOString() : null,

        // Model inputs snapshot
        home_elo: homeRating.elo_rating,
        away_elo: awayRating.elo_rating,
        home_attack: homeRating.attack_strength,
        home_defence: homeRating.defence_strength,
        away_attack: awayRating.attack_strength,
        away_defence: awayRating.defence_strength,
        home_form: homeRating.form_score,
        away_form: awayRating.form_score,
        lambda_home: +markets.lambdaHome.toFixed(4),
        lambda_away: +markets.lambdaAway.toFixed(4),
        rho: -0.13,

        // 1X2
        prob_home_win: +markets.probHomeWin.toFixed(6),
        prob_draw:     +markets.probDraw.toFixed(6),
        prob_away_win: +markets.probAwayWin.toFixed(6),
        fair_odds_home: +markets.fairOddsHome.toFixed(3),
        fair_odds_draw: +markets.fairOddsDraw.toFixed(3),
        fair_odds_away: +markets.fairOddsAway.toFixed(3),

        // Goals
        expected_goals_home: +markets.expectedGoalsHome.toFixed(3),
        expected_goals_away: +markets.expectedGoalsAway.toFixed(3),
        prob_over_15: +markets.probOver15.toFixed(6),
        prob_over_25: +markets.probOver25.toFixed(6),
        prob_over_35: +markets.probOver35.toFixed(6),
        prob_btts_yes: +markets.probBttsYes.toFixed(6),
        fair_odds_over_25:  +markets.fairOddsOver25.toFixed(3),
        fair_odds_under_25: +markets.fairOddsUnder25.toFixed(3),
        fair_odds_btts_yes: +markets.fairOddsBttsYes.toFixed(3),
        fair_odds_btts_no:  +markets.fairOddsBttsNo.toFixed(3),

        // Confidence
        confidence_score: confidence.score,
        confidence_factors: confidence.factors,
        data_quality_score: confidence.factors.dataQuality,
        model_agreement_score: confidence.factors.modelStability,

        key_factors: [
          `Home xG rate: ${homeRating.avg_xg_scored?.toFixed(2) ?? 'N/A'}`,
          `Away xG rate: ${awayRating.avg_xg_scored?.toFixed(2) ?? 'N/A'}`,
          `Elo gap: ${Math.abs(homeRating.elo_rating - awayRating.elo_rating).toFixed(0)} points`,
        ],
      };

      if (!dryRun) {
        const { error: insertErr } = await supabase
          .from('match_predictions')
          .insert(prediction);

        if (insertErr) {
          console.error(`Failed to insert prediction for match ${match.id}:`, insertErr);
          skipped++;
          continue;
        }
      }

      results.push({
        match_id: match.id,
        match: `${match.home_team.name} vs ${match.away_team.name}`,
        kickoff: match.kickoff_utc,
        prob_home: markets.probHomeWin.toFixed(3),
        prob_draw: markets.probDraw.toFixed(3),
        prob_away: markets.probAwayWin.toFixed(3),
        expected_goals: `${markets.expectedGoalsHome.toFixed(2)} - ${markets.expectedGoalsAway.toFixed(2)}`,
        confidence: confidence.score,
        version: nextVersion,
        dry_run: dryRun,
      });
      generated++;
    }

    return jsonResponse({
      success: true,
      generated,
      skipped,
      dry_run: dryRun,
      auto_published: autoPublish,
      predictions: results,
    });
  } catch (err) {
    console.error('generate-predictions error:', err);
    return errorResponse('INTERNAL_ERROR', String(err), 500);
  }
});
