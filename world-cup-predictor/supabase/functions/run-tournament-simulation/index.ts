/**
 * run-tournament-simulation — Admin Edge Function
 * GoalEdge.io
 *
 * POST /functions/v1/run-tournament-simulation
 * Runs a Monte Carlo simulation of the World Cup 2026 tournament.
 * 100,000 iterations by default. Stores results in tournament_simulation table.
 * Requires service role auth.
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { handleCors, jsonResponse, errorResponse } from '../_shared/cors.ts';
import { predictMatch, type TeamRating } from '../_shared/dixon-coles.ts';

const DEFAULT_ITERATIONS = 100_000;
const MAX_GOALS = 8;

interface TeamStanding {
  teamId:   string;
  name:     string;
  fifaCode: string;
  points:   number;
  gf:       number;
  ga:       number;
  gd:       number;
  played:   number;
}

interface SimulationResult {
  teamId:         string;
  fifaCode:       string;
  name:           string;
  probGroup:      number; // probability of advancing from group stage
  probR16:        number;
  probQF:         number;
  probSF:         number;
  probFinal:      number;
  probWinner:     number;
  avgPosition:    number; // average finishing position in group
}

Deno.serve(async (req) => {
  const corsResp = handleCors(req);
  if (corsResp) return corsResp;

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  try {
    const body = await req.json().catch(() => ({}));
    const iterations: number = Math.min(body.iterations ?? DEFAULT_ITERATIONS, 500_000);
    const dryRun:     boolean = body.dry_run ?? false;

    // 1. Load all group-stage fixtures (scheduled) and team ratings
    const [matchesRes, ratingsRes] = await Promise.all([
      supabase
        .from('matches')
        .select(`
          id, group_letter, stage,
          home_team_id, away_team_id,
          score_home, score_away, status
        `)
        .eq('stage', 'group')
        .order('group_letter')
        .order('match_number'),

      supabase
        .from('v_latest_team_ratings')
        .select('*'),
    ]);

    if (matchesRes.error) throw matchesRes.error;
    if (ratingsRes.error) throw ratingsRes.error;

    const fixtures = matchesRes.data as any[];
    const ratings  = ratingsRes.data as any[];

    if (!fixtures?.length) {
      return errorResponse('NO_FIXTURES', 'No group-stage fixtures found.', 404);
    }

    // Build rating lookup
    const ratingMap = new Map<string, any>(
      ratings.map((r: any) => [r.team_id, r])
    );

    // Identify all groups and their teams
    const groupsMap = new Map<string, Set<string>>();
    for (const f of fixtures) {
      if (!groupsMap.has(f.group_letter)) groupsMap.set(f.group_letter, new Set());
      groupsMap.get(f.group_letter)!.add(f.home_team_id);
      groupsMap.get(f.group_letter)!.add(f.away_team_id);
    }

    // 2. Separate already-played fixtures (use actual scores) from scheduled ones
    const playedFixtures = fixtures.filter((f) => f.status !== 'scheduled' && f.score_home !== null);
    const pendingFixtures = fixtures.filter((f) => f.status === 'scheduled');

    // 3. Run Monte Carlo
    // Track how often each team reaches each round
    const counters: Record<string, {
      groupAdvance: number;
      r16: number; qf: number; sf: number; final: number; winner: number;
      positionSum: number;
    }> = {};

    // Initialise counters for all teams
    for (const [, teams] of groupsMap) {
      for (const tid of teams) {
        counters[tid] = { groupAdvance: 0, r16: 0, qf: 0, sf: 0, final: 0, winner: 0, positionSum: 0 };
      }
    }

    // Pre-cache team ratings as TeamRating objects
    const teamRatingCache = new Map<string, TeamRating>();
    for (const [tid, r] of ratingMap) {
      teamRatingCache.set(tid, {
        eloRating:      r.elo_rating,
        attackStrength: r.attack_strength,
        defenceStrength: r.defence_strength,
        formScore:      r.form_score,
        isHostNation:   r.is_host_nation ?? false,
      });
    }

    for (let iter = 0; iter < iterations; iter++) {
      // Simulate each group
      const groupAdvancers: string[][] = []; // [2 per group]

      for (const [, teams] of groupsMap) {
        const standings: Record<string, TeamStanding> = {};
        for (const tid of teams) {
          const r = ratingMap.get(tid);
          standings[tid] = {
            teamId: tid,
            name: r?.team_name ?? tid,
            fifaCode: r?.fifa_code ?? '',
            points: 0, gf: 0, ga: 0, gd: 0, played: 0,
          };
        }

        // Apply actual results first
        for (const f of playedFixtures.filter((pf) => teams.has(pf.home_team_id))) {
          applyResult(standings, f.home_team_id, f.away_team_id, f.score_home, f.score_away);
        }

        // Simulate pending fixtures
        for (const f of pendingFixtures.filter((pf) => teams.has(pf.home_team_id))) {
          const homeRating = teamRatingCache.get(f.home_team_id);
          const awayRating = teamRatingCache.get(f.away_team_id);
          if (!homeRating || !awayRating) continue;

          const [hg, ag] = simulateScore(homeRating, awayRating);
          applyResult(standings, f.home_team_id, f.away_team_id, hg, ag);
        }

        // Rank teams within group
        const ranked = rankGroup(Object.values(standings));
        for (let pos = 0; pos < ranked.length; pos++) {
          counters[ranked[pos].teamId].positionSum += pos + 1;
        }

        // Top 2 advance (WC 2026: top 2 from each group advance, plus 8 best 3rd-place)
        groupAdvancers.push([ranked[0].teamId, ranked[1].teamId]);

        // Track group advancement for top 2
        counters[ranked[0].teamId].groupAdvance++;
        counters[ranked[1].teamId].groupAdvance++;
      }

      // Knockout stage simulation (simplified bracket)
      // Round of 32 → R16 → QF → SF → Final
      // WC 2026 has 48 teams: 12 groups × 2 + 8 best 3rd-place = 32 in R32
      // For simplicity, simulate from R16 with the 24 group winners/runners-up

      let r16Teams = groupAdvancers.flat();

      // R16 — 16 matches from 32 teams (simplified: pair first 16 vs last 16)
      const r16Winners = simulateKnockoutRound(r16Teams, teamRatingCache, counters, 'r16');
      const qfWinners  = simulateKnockoutRound(r16Winners, teamRatingCache, counters, 'qf');
      const sfWinners  = simulateKnockoutRound(qfWinners, teamRatingCache, counters, 'sf');
      const finalists  = simulateKnockoutRound(sfWinners, teamRatingCache, counters, 'final');

      // Winner
      if (finalists.length > 0) {
        counters[finalists[0]].winner++;
      }
    }

    // 4. Compute final probabilities
    const results: SimulationResult[] = Object.entries(counters).map(([tid, c]) => {
      const r = ratingMap.get(tid);
      return {
        teamId:      tid,
        fifaCode:    r?.fifa_code ?? '',
        name:        r?.team_name ?? tid,
        probGroup:   +(c.groupAdvance / iterations).toFixed(4),
        probR16:     +(c.r16 / iterations).toFixed(4),
        probQF:      +(c.qf / iterations).toFixed(4),
        probSF:      +(c.sf / iterations).toFixed(4),
        probFinal:   +(c.final / iterations).toFixed(4),
        probWinner:  +(c.winner / iterations).toFixed(4),
        avgPosition: +(c.positionSum / iterations).toFixed(2),
      };
    }).sort((a, b) => b.probWinner - a.probWinner);

    if (!dryRun) {
      // Upsert simulation results
      const rows = results.map((r) => ({
        team_id:         r.teamId,
        iterations,
        prob_group_advance: r.probGroup,
        prob_r16:        r.probR16,
        prob_qf:         r.probQF,
        prob_sf:         r.probSF,
        prob_final:      r.probFinal,
        prob_winner:     r.probWinner,
        avg_group_position: r.avgPosition,
        simulated_at:    new Date().toISOString(),
      }));

      // Delete previous simulation before inserting new one
      await supabase.from('tournament_simulation').delete().neq('team_id', '');

      const { error: insertErr } = await supabase
        .from('tournament_simulation')
        .insert(rows);

      if (insertErr) throw insertErr;
    }

    return jsonResponse({
      success:    true,
      iterations,
      teams:      results.length,
      dry_run:    dryRun,
      top_10:     results.slice(0, 10),
      simulated_at: new Date().toISOString(),
    });
  } catch (err) {
    console.error('run-tournament-simulation error:', err);
    return errorResponse('INTERNAL_ERROR', String(err), 500);
  }
});

/** Apply a match result to group standings */
function applyResult(
  standings: Record<string, TeamStanding>,
  homeId: string,
  awayId: string,
  hg: number,
  ag: number,
): void {
  const h = standings[homeId];
  const a = standings[awayId];
  if (!h || !a) return;

  h.gf += hg; h.ga += ag; h.gd += hg - ag; h.played++;
  a.gf += ag; a.ga += hg; a.gd += ag - hg; a.played++;

  if (hg > ag) { h.points += 3; }
  else if (hg < ag) { a.points += 3; }
  else { h.points += 1; a.points += 1; }
}

/** FIFA tiebreaker: points → GD → GF → coin flip */
function rankGroup(teams: TeamStanding[]): TeamStanding[] {
  return [...teams].sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    if (b.gd !== a.gd)         return b.gd - a.gd;
    if (b.gf !== a.gf)         return b.gf - a.gf;
    return Math.random() - 0.5; // coin flip for equal teams
  });
}

/** Simulate a single score using Dixon-Coles λ values with Poisson sampling */
function simulateScore(home: TeamRating, away: TeamRating): [number, number] {
  const markets = predictMatch(home, away);
  const hg = poissonSample(markets.lambdaHome);
  const ag = poissonSample(markets.lambdaAway);
  return [Math.min(hg, MAX_GOALS), Math.min(ag, MAX_GOALS)];
}

/** Sample from Poisson distribution using Knuth's algorithm */
function poissonSample(lambda: number): number {
  if (lambda <= 0) return 0;
  const L = Math.exp(-lambda);
  let k = 0;
  let p = 1;
  do { k++; p *= Math.random(); } while (p > L);
  return k - 1;
}

/**
 * Simulate a knockout round.
 * Teams are paired sequentially; in case of draw, goes to "extra time"
 * which is a 50/50 coin flip (simplified — real impl would re-run model).
 */
function simulateKnockoutRound(
  teams: string[],
  ratingCache: Map<string, TeamRating>,
  counters: Record<string, any>,
  round: 'r16' | 'qf' | 'sf' | 'final',
): string[] {
  const winners: string[] = [];

  for (let i = 0; i < teams.length - 1; i += 2) {
    const homeId = teams[i];
    const awayId = teams[i + 1];
    const homeRating = ratingCache.get(homeId);
    const awayRating = ratingCache.get(awayId);

    if (!homeRating || !awayRating) {
      // Bye — home team advances
      winners.push(homeId);
      counters[homeId][round]++;
      continue;
    }

    // Simulate 90 min
    let [hg, ag] = simulateScore(homeRating, awayRating);

    // If draw in knockout, go to penalties (coin flip weighted by Elo)
    if (hg === ag) {
      const homeElo = homeRating.eloRating;
      const awayElo = awayRating.eloRating;
      const homeWinProb = 1 / (1 + Math.pow(10, (awayElo - homeElo) / 400));
      hg = Math.random() < homeWinProb ? 1 : 0;
      ag = 1 - hg;
    }

    const winnerId = hg > ag ? homeId : awayId;
    winners.push(winnerId);
    counters[winnerId][round]++;
  }

  // Handle odd number of teams (bye)
  if (teams.length % 2 !== 0) {
    const byeTeam = teams[teams.length - 1];
    winners.push(byeTeam);
    counters[byeTeam][round]++;
  }

  return winners;
}
