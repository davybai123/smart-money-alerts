/**
 * ingest-odds — Cron Edge Function
 * GoalEdge.io
 *
 * POST /functions/v1/ingest-odds
 * Fetches latest bookmaker odds from The Odds API and stores them.
 * Runs every 30 min during 06:00–22:00 UTC via pg_cron.
 * Requires service role auth.
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { handleCors, jsonResponse, errorResponse } from '../_shared/cors.ts';

const ODDS_API_BASE = 'https://api.the-odds-api.com/v4';
const SPORT_KEY     = 'soccer_fifa_world_cup';

// Markets we care about — mapped to our internal names
const MARKET_MAP: Record<string, string> = {
  h2h:       '1x2',
  totals:    'totals',
  btts:      'btts',
};

interface OddsApiOutcome {
  name:  string;
  price: number;
  point?: number;
}

interface OddsApiMarket {
  key:      string;
  last_update: string;
  outcomes: OddsApiOutcome[];
}

interface OddsApiBookmaker {
  key:        string;
  title:      string;
  last_update: string;
  markets:    OddsApiMarket[];
}

interface OddsApiEvent {
  id:           string;
  sport_key:    string;
  commence_time: string;
  home_team:    string;
  away_team:    string;
  bookmakers:   OddsApiBookmaker[];
}

Deno.serve(async (req) => {
  const corsResp = handleCors(req);
  if (corsResp) return corsResp;

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  const oddsApiKey = Deno.env.get('ODDS_API_KEY');
  if (!oddsApiKey) {
    return errorResponse('MISSING_CONFIG', 'ODDS_API_KEY not configured.', 500);
  }

  try {
    const body = await req.json().catch(() => ({}));
    const dryRun: boolean = body.dry_run ?? false;
    const bookmakers: string = body.bookmakers ?? 'bet365,williamhill,betway,paddypower,unibet';

    // Fetch odds for all three markets in one request
    const marketsParam = Object.keys(MARKET_MAP).join(',');
    const url = new URL(`${ODDS_API_BASE}/sports/${SPORT_KEY}/odds`);
    url.searchParams.set('apiKey', oddsApiKey);
    url.searchParams.set('regions', 'uk,eu');
    url.searchParams.set('markets', marketsParam);
    url.searchParams.set('oddsFormat', 'decimal');
    url.searchParams.set('bookmakers', bookmakers);

    const resp = await fetch(url.toString());
    if (!resp.ok) {
      const text = await resp.text();
      console.error('Odds API error:', resp.status, text);
      return errorResponse('ODDS_API_ERROR', `Odds API returned ${resp.status}`, 502);
    }

    const events: OddsApiEvent[] = await resp.json();
    const remaining = resp.headers.get('x-requests-remaining');
    const used      = resp.headers.get('x-requests-used');

    // Load our match fixtures to correlate by team names
    const { data: matches, error: matchErr } = await supabase
      .from('matches')
      .select(`
        id, kickoff_utc, status,
        home_team:teams!home_team_id(id, name, fifa_code),
        away_team:teams!away_team_id(id, name, fifa_code)
      `)
      .eq('status', 'scheduled')
      .gt('kickoff_utc', new Date().toISOString());

    if (matchErr) throw matchErr;

    // Build lookup: normalised "home vs away" → match id
    const matchLookup = new Map<string, string>();
    for (const m of (matches ?? []) as any[]) {
      const key = `${m.home_team.name.toLowerCase()}|${m.away_team.name.toLowerCase()}`;
      matchLookup.set(key, m.id);
    }

    let inserted   = 0;
    let unmatched  = 0;
    const rows: any[] = [];

    for (const event of events) {
      const key = `${event.home_team.toLowerCase()}|${event.away_team.toLowerCase()}`;
      const matchId = matchLookup.get(key);

      if (!matchId) {
        console.warn(`No match found for: ${event.home_team} vs ${event.away_team}`);
        unmatched++;
        continue;
      }

      for (const bk of event.bookmakers) {
        for (const market of bk.markets) {
          const ourMarket = MARKET_MAP[market.key];
          if (!ourMarket) continue;

          for (const outcome of market.outcomes) {
            const { selection, line } = resolveSelection(market.key, outcome);
            if (!selection) continue;

            rows.push({
              match_id:     matchId,
              bookmaker:    bk.key,
              market:       ourMarket,
              selection,
              decimal_odds: outcome.price,
              line:         line ?? null,
              fetched_at:   new Date().toISOString(),
            });
          }
        }
      }
    }

    if (!dryRun && rows.length > 0) {
      // Insert in batches of 500
      for (let i = 0; i < rows.length; i += 500) {
        const batch = rows.slice(i, i + 500);
        const { error: insertErr } = await supabase
          .from('bookmaker_odds')
          .insert(batch);
        if (insertErr) {
          console.error('Insert error:', insertErr);
          throw insertErr;
        }
        inserted += batch.length;
      }
    } else {
      inserted = rows.length;
    }

    return jsonResponse({
      success: true,
      events_fetched: events.length,
      odds_rows: rows.length,
      inserted: dryRun ? 0 : inserted,
      unmatched_events: unmatched,
      dry_run: dryRun,
      api_requests_remaining: remaining,
      api_requests_used: used,
    });
  } catch (err) {
    console.error('ingest-odds error:', err);
    return errorResponse('INTERNAL_ERROR', String(err), 500);
  }
});

/**
 * Resolve The Odds API outcome into our canonical selection name and optional line.
 */
function resolveSelection(
  marketKey: string,
  outcome: OddsApiOutcome,
): { selection: string | null; line?: number } {
  switch (marketKey) {
    case 'h2h': {
      // outcome.name is the team name or "Draw"
      const n = outcome.name.toLowerCase();
      if (n === 'draw') return { selection: 'draw' };
      // We'll store "home" / "away" — caller maps by position
      // The Odds API returns home first in h2h, but we rely on name matching
      // Store raw name for now; refresh-value-bets resolves home/away from match
      return { selection: outcome.name };
    }
    case 'totals': {
      if (outcome.point === undefined) return { selection: null };
      const dir = outcome.name.toLowerCase(); // "Over" | "Under"
      const pts = outcome.point;
      // Map to our canonical selections: over_15, over_25, over_35
      const allowed = [1.5, 2.5, 3.5];
      if (!allowed.includes(pts)) return { selection: null };
      return { selection: `${dir}_${String(pts).replace('.', '')}`, line: pts };
      // Produces: "over_15", "under_25", etc.
    }
    case 'btts': {
      // BetAPI btts: outcome.name = "Yes" | "No"
      return { selection: outcome.name.toLowerCase() };
    }
    default:
      return { selection: null };
  }
}
