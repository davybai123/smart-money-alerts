import { supabase } from '@/lib/supabase';
import MatchCard from '@/components/MatchCard';
import { stageLabel } from '@/lib/utils';
import type { MatchWithTeams } from '@/lib/database.types';
import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'All Matches' };
export const revalidate = 300;

async function getAllMatches(): Promise<MatchWithTeams[]> {
  const { data } = await supabase
    .from('matches')
    .select(`
      *,
      home_team:teams!home_team_id(*),
      away_team:teams!away_team_id(*),
      prediction:match_predictions(id, prob_home_win, prob_draw, prob_away_win, confidence_score, is_published, version),
      top_value_bet:value_bets(id, market, selection, decimal_odds, ev_percentage, is_active)
    `)
    .order('kickoff_utc');

  return (data ?? []).map((m: any) => ({
    ...m,
    prediction: Array.isArray(m.prediction)
      ? (m.prediction.find((p: any) => p.is_published) ?? null) : null,
    top_value_bet: Array.isArray(m.top_value_bet)
      ? (m.top_value_bet.find((vb: any) => vb.is_active) ?? null) : null,
  })) as MatchWithTeams[];
}

export default async function MatchesPage() {
  const matches = await getAllMatches();

  // Group by date
  const byDate = new Map<string, MatchWithTeams[]>();
  for (const m of matches) {
    const dateKey = new Date(m.kickoff_utc).toLocaleDateString('en-GB', {
      weekday: 'long', day: 'numeric', month: 'long'
    });
    if (!byDate.has(dateKey)) byDate.set(dateKey, []);
    byDate.get(dateKey)!.push(m);
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-white">All Matches</h1>
        <p className="text-muted text-sm mt-1">{matches.length} matches · World Cup 2026 Group Stage</p>
      </div>

      {byDate.size === 0 && (
        <div className="bg-surface border border-border rounded-xl p-12 text-center text-muted">
          No matches loaded yet. Run the data pipeline to populate fixtures.
        </div>
      )}

      {[...byDate.entries()].map(([date, dayMatches]) => (
        <section key={date}>
          <h2 className="text-sm font-semibold text-muted uppercase tracking-wider mb-3 border-b border-border pb-2">
            {date}
          </h2>
          <div className="grid sm:grid-cols-2 gap-4">
            {dayMatches.map((m) => <MatchCard key={m.id} match={m} />)}
          </div>
        </section>
      ))}
    </div>
  );
}
