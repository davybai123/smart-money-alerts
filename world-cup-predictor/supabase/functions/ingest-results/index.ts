/**
 * ingest-results — Admin Edge Function
 * GoalEdge.io
 *
 * POST /functions/v1/ingest-results
 * Fetches final scores from API-Football and updates match records.
 * Locks predictions at kickoff, records outcomes, triggers bet settlement.
 * Requires service role auth.
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { handleCors, jsonResponse, errorResponse } from '../_shared/cors.ts';

const API_FOOTBALL_BASE = 'https://v3.football.api-sports.io';
// FIFA World Cup 2026 league ID in API-Football (confirm before launch)
const WC_LEAGUE_ID      = 1;
const WC_SEASON         = 2026;

interface ApiFootballFixture {
  fixture: {
    id:     number;
    date:   string;
    status: { short: string; elapsed: number | null };
  };
  teams: {
    home: { id: number; name: string };
    away: { id: number; name: string };
  };
  goals: {
    home: number | null;
    away: number | null;
  };
  score: {
    fulltime:  { home: number | null; away: number | null };
    extratime: { home: number | null; away: number | null };
    penalty:   { home: number | null; away: number | null };
  };
}

Deno.serve(async (req) => {
  const corsResp = handleCors(req);
  if (corsResp) return corsResp;

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  const apiKey = Deno.env.get('API_FOOTBALL_KEY');
  if (!apiKey) {
    return errorResponse('MISSING_CONFIG', 'API_FOOTBALL_KEY not configured.', 500);
  }

  try {
    const body = await req.json().catch(() => ({}));
    const dryRun:  boolean = body.dry_run ?? false;
    // Optionally target a specific date (YYYY-MM-DD); defaults to today
    const targetDate: string = body.date ?? new Date().toISOString().split('T')[0];

    const url = new URL(`${API_FOOTBALL_BASE}/fixtures`);
    url.searchParams.set('league',  String(WC_LEAGUE_ID));
    url.searchParams.set('season',  String(WC_SEASON));
    url.searchParams.set('date',    targetDate);
    url.searchParams.set('status',  'FT-AET-PEN'); // finished, after extra time, after penalties

    const resp = await fetch(url.toString(), {
      headers: {
        'x-apisports-key': apiKey,
        'x-rapidapi-key':  apiKey,
      },
    });

    if (!resp.ok) {
      return errorResponse('API_FOOTBALL_ERROR', `API-Football returned ${resp.status}`, 502);
    }

    const json = await resp.json();
    const fixtures: ApiFootballFixture[] = json?.response ?? [];

    // Load our matches for this date to correlate by team name
    const { data: ourMatches, error: matchErr } = await supabase
      .from('matches')
      .select(`
        id, kickoff_utc, status, api_fixture_id,
        home_team:teams!home_team_id(id, name, api_football_id),
        away_team:teams!away_team_id(id, name, api_football_id)
      `)
      .in('status', ['scheduled', 'in_progress'])
      .gte('kickoff_utc', `${targetDate}T00:00:00Z`)
      .lte('kickoff_utc', `${targetDate}T23:59:59Z`);

    if (matchErr) throw matchErr;

    // Build lookups by api_fixture_id (preferred) and by team name pair
    const byFixtureId = new Map<number, any>();
    const byTeamNames = new Map<string, any>();

    for (const m of (ourMatches ?? []) as any[]) {
      if (m.api_fixture_id) byFixtureId.set(m.api_fixture_id, m);
      const key = `${m.home_team.name.toLowerCase()}|${m.away_team.name.toLowerCase()}`;
      byTeamNames.set(key, m);
    }

    let updated = 0;
    let settled = 0;
    let skipped = 0;
    const detail: any[] = [];

    for (const fix of fixtures) {
      const status = fix.fixture.status.short;
      // Only process truly finished matches
      if (!['FT', 'AET', 'PEN'].includes(status)) {
        skipped++;
        continue;
      }

      const ourMatch =
        byFixtureId.get(fix.fixture.id) ??
        byTeamNames.get(`${fix.teams.home.name.toLowerCase()}|${fix.teams.away.name.toLowerCase()}`);

      if (!ourMatch) {
        console.warn(`No match found for API fixture ${fix.fixture.id}: ${fix.teams.home.name} vs ${fix.teams.away.name}`);
        skipped++;
        continue;
      }

      const ftHome  = fix.score.fulltime.home ?? fix.goals.home ?? 0;
      const ftAway  = fix.score.fulltime.away ?? fix.goals.away ?? 0;
      const etHome  = fix.score.extratime.home ?? null;
      const etAway  = fix.score.extratime.away ?? null;
      const penHome = fix.score.penalty.home ?? null;
      const penAway = fix.score.penalty.away ?? null;

      const matchStatus =
        status === 'PEN'  ? 'completed_pens'    :
        status === 'AET'  ? 'completed_aet'     : 'completed';

      if (!dryRun) {
        const { error: updateErr } = await supabase
          .from('matches')
          .update({
            status:           matchStatus,
            score_home:       ftHome,
            score_away:       ftAway,
            score_home_et:    etHome,
            score_away_et:    etAway,
            score_home_pens:  penHome,
            score_away_pens:  penAway,
            api_fixture_id:   fix.fixture.id,
          })
          .eq('id', ourMatch.id);

        if (updateErr) {
          console.error(`Failed to update match ${ourMatch.id}:`, updateErr);
          skipped++;
          continue;
        }

        // Settle value bets for this match
        const betsSettled = await settleBets(supabase, ourMatch.id, ftHome, ftAway);
        settled += betsSettled;
      }

      updated++;
      detail.push({
        match_id:  ourMatch.id,
        fixture:   `${fix.teams.home.name} ${ftHome}–${ftAway} ${fix.teams.away.name}`,
        status:    matchStatus,
        api_id:    fix.fixture.id,
        dry_run:   dryRun,
      });
    }

    return jsonResponse({
      success: true,
      date:    targetDate,
      fixtures_from_api: fixtures.length,
      matches_updated:   updated,
      bets_settled:      settled,
      skipped,
      dry_run: dryRun,
      results: detail,
    });
  } catch (err) {
    console.error('ingest-results error:', err);
    return errorResponse('INTERNAL_ERROR', String(err), 500);
  }
});

/**
 * Mark saved_bets as won/lost/push based on final score.
 * Returns count of bets settled.
 */
async function settleBets(
  supabase: ReturnType<typeof createClient>,
  matchId: string,
  homeGoals: number,
  awayGoals: number,
): Promise<number> {
  const { data: bets, error } = await supabase
    .from('saved_bets')
    .select('id, market, selection, stake')
    .eq('match_id', matchId)
    .eq('outcome', 'pending');

  if (error || !bets?.length) return 0;

  const total = homeGoals + awayGoals;
  let count = 0;

  for (const bet of bets as any[]) {
    const outcome = resolveOutcome(bet.market, bet.selection, homeGoals, awayGoals, total);
    if (!outcome) continue;

    await supabase
      .from('saved_bets')
      .update({ outcome, settled_at: new Date().toISOString() })
      .eq('id', bet.id);

    count++;
  }

  return count;
}

function resolveOutcome(
  market: string,
  selection: string,
  home: number,
  away: number,
  total: number,
): 'won' | 'lost' | 'push' | null {
  switch (market) {
    case '1x2': {
      const result = home > away ? 'home' : home < away ? 'away' : 'draw';
      return selection === result ? 'won' : 'lost';
    }
    case 'over_25':
      if (total === 2) return 'push';
      return (selection === 'over_25' ? total > 2.5 : total < 2.5) ? 'won' : 'lost';
    case 'over_15':
      if (total === 1) return 'push';
      return (selection === 'over_15' ? total > 1.5 : total < 1.5) ? 'won' : 'lost';
    case 'over_35':
      if (total === 3) return 'push';
      return (selection === 'over_35' ? total > 3.5 : total < 3.5) ? 'won' : 'lost';
    case 'btts':
      return (selection === 'yes' ? (home > 0 && away > 0) : !(home > 0 && away > 0)) ? 'won' : 'lost';
    default:
      return null;
  }
}
