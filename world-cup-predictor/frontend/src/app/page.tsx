import Link from 'next/link';
import { TrendingUp, Target, Trophy, ArrowRight, Zap } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import MatchCard from '@/components/MatchCard';
import EVBadge from '@/components/EVBadge';
import { formatKickoff, marketLabel } from '@/lib/utils';
import type { MatchWithTeams } from '@/lib/database.types';

export const revalidate = 300; // 5-min ISR

async function getTodayMatches(): Promise<MatchWithTeams[]> {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
  const todayEnd   = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).toISOString();

  const { data: matches } = await supabase
    .from('matches')
    .select(`
      *,
      home_team:teams!home_team_id(*),
      away_team:teams!away_team_id(*),
      prediction:match_predictions(
        id, prob_home_win, prob_draw, prob_away_win, confidence_score, is_published, version
      ),
      top_value_bet:value_bets(
        id, market, selection, decimal_odds, ev_percentage, is_active
      )
    `)
    .gte('kickoff_utc', todayStart)
    .lt('kickoff_utc', todayEnd)
    .order('kickoff_utc');

  return (matches ?? []).map((m: any) => ({
    ...m,
    prediction: Array.isArray(m.prediction)
      ? (m.prediction.find((p: any) => p.is_published) ?? null)
      : null,
    top_value_bet: Array.isArray(m.top_value_bet)
      ? (m.top_value_bet.find((vb: any) => vb.is_active) ?? null)
      : null,
  })) as MatchWithTeams[];
}

async function getTopValueBets() {
  const { data } = await supabase
    .from('value_bets')
    .select(`
      *,
      match:matches!match_id(kickoff_utc, home_team:teams!home_team_id(name), away_team:teams!away_team_id(name))
    `)
    .eq('is_active', true)
    .order('ev_percentage', { ascending: false })
    .limit(5);
  return data ?? [];
}

async function getTopFavourites() {
  const { data } = await supabase
    .from('tournament_simulation')
    .select('*, team:teams!team_id(name, fifa_code)')
    .order('prob_winner', { ascending: false })
    .limit(3);
  return data ?? [];
}

export default async function HomePage() {
  const [todayMatches, topValueBets, topFavourites] = await Promise.all([
    getTodayMatches(),
    getTopValueBets(),
    getTopFavourites(),
  ]);

  const stats = {
    matches:    72,
    valueBets:  topValueBets.length,
    confidence: 71,
  };

  return (
    <div className="space-y-12">
      {/* Hero */}
      <section className="text-center py-12 space-y-6">
        <div className="inline-flex items-center gap-2 bg-ev-positive/10 border border-ev-positive/20 rounded-full px-4 py-1.5 text-ev-positive text-sm font-medium">
          <Zap className="w-3.5 h-3.5" />
          World Cup 2026 — Live Predictions
        </div>

        <h1 className="text-4xl sm:text-6xl font-black text-white leading-tight tracking-tight">
          Find Value.<br />
          <span className="text-ev-positive">Not Winners.</span>
        </h1>

        <p className="text-muted text-lg max-w-xl mx-auto">
          Dixon-Coles powered World Cup predictions. We identify mispriced odds so you can bet with a genuine edge.
        </p>

        <div className="flex flex-wrap items-center justify-center gap-4">
          <StatChip icon={<Target className="w-3.5 h-3.5" />} value={`${stats.matches} matches`} label="analysed" />
          <StatChip icon={<TrendingUp className="w-3.5 h-3.5" />} value={`${stats.valueBets} value bets`} label="identified" />
          <StatChip icon={<Trophy className="w-3.5 h-3.5" />} value={`${stats.confidence}%`} label="avg confidence" />
        </div>

        <div className="flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/value-bets"
            className="inline-flex items-center gap-2 bg-ev-positive text-bg px-5 py-2.5 rounded-lg font-semibold hover:bg-ev-positive/90 transition-colors"
          >
            See Value Bets <ArrowRight className="w-4 h-4" />
          </Link>
          <Link
            href="/matches"
            className="inline-flex items-center gap-2 border border-border text-white px-5 py-2.5 rounded-lg font-medium hover:border-white/30 transition-colors"
          >
            All Matches
          </Link>
        </div>
      </section>

      {/* Today's Matches */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-white">
            Today&apos;s Matches
            <span className="ml-2 text-sm text-muted font-normal">{new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}</span>
          </h2>
          <Link href="/matches" className="text-sm text-muted hover:text-ev-positive transition-colors">
            All matches →
          </Link>
        </div>

        {todayMatches.length > 0 ? (
          <div className="grid sm:grid-cols-2 gap-4">
            {todayMatches.map((m) => <MatchCard key={m.id} match={m} />)}
          </div>
        ) : (
          <div className="bg-surface border border-border rounded-xl p-8 text-center text-muted">
            <Target className="w-8 h-8 mx-auto mb-2 opacity-40" />
            <p>No matches scheduled today. <Link href="/matches" className="text-ev-positive hover:underline">See upcoming matches →</Link></p>
          </div>
        )}
      </section>

      {/* Value Bets Ticker */}
      {topValueBets.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <span className="text-ev-positive">🔥</span> Live Value Bets
            </h2>
            <Link href="/value-bets" className="text-sm text-muted hover:text-ev-positive transition-colors">
              See all →
            </Link>
          </div>

          <div className="overflow-x-auto pb-2">
            <div className="flex gap-3 min-w-max">
              {topValueBets.map((vb: any) => (
                <div key={vb.id} className="bg-surface border border-border rounded-xl p-4 w-64 shrink-0">
                  <div className="text-xs text-muted mb-2 truncate">
                    {vb.match?.home_team?.name} vs {vb.match?.away_team?.name}
                  </div>
                  <div className="font-semibold text-white text-sm mb-1">{marketLabel(vb.market, vb.selection)}</div>
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-white text-sm">{vb.decimal_odds.toFixed(2)}</span>
                    <EVBadge evPct={vb.ev_percentage} size="sm" />
                  </div>
                  <div className="text-xs text-muted mt-1">{vb.bookmaker}</div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Tournament Snapshot */}
      {topFavourites.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-white">Tournament Favourites</h2>
            <Link href="/tournament" className="text-sm text-muted hover:text-ev-positive transition-colors">
              Full simulation →
            </Link>
          </div>

          <div className="grid grid-cols-3 gap-3">
            {topFavourites.map((sim: any, i) => (
              <div key={sim.id} className="bg-surface border border-border rounded-xl p-4 text-center">
                <div className="text-2xl mb-2">{['🥇', '🥈', '🥉'][i]}</div>
                <div className="font-bold text-white text-sm">{sim.team?.name}</div>
                <div className="text-ev-positive font-mono font-bold text-lg mt-1">
                  {(sim.prob_winner * 100).toFixed(1)}%
                </div>
                <div className="text-xs text-muted">chance to win</div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function StatChip({ icon, value, label }: { icon: React.ReactNode; value: string; label: string }) {
  return (
    <div className="flex items-center gap-2 bg-surface border border-border rounded-full px-3 py-1.5 text-sm">
      <span className="text-ev-positive">{icon}</span>
      <span className="font-semibold text-white">{value}</span>
      <span className="text-muted">{label}</span>
    </div>
  );
}
