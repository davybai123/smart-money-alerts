'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { RefreshCw, Filter, TrendingUp } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import EVBadge from '@/components/EVBadge';
import { formatKickoff, formatOdds, formatPct, marketLabel, cn } from '@/lib/utils';

type SortKey = 'ev' | 'confidence' | 'kickoff';

interface ValueBetRow {
  id: string;
  match_id: string;
  market: string;
  selection: string;
  bookmaker: string;
  decimal_odds: number;
  our_probability: number;
  market_implied_prob: number;
  ev_percentage: number;
  recommended_fraction: number;
  confidence_score: number;
  refreshed_at: string;
  match: {
    kickoff_utc: string;
    home_team: { name: string };
    away_team: { name: string };
  };
}

export default function ValueBetsPage() {
  const [bets, setBets] = useState<ValueBetRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [minEV, setMinEV] = useState(3);
  const [sortBy, setSortBy] = useState<SortKey>('ev');
  const [marketFilter, setMarketFilter] = useState('all');

  async function load() {
    setLoading(true);
    const { data } = await supabase
      .from('value_bets')
      .select(`
        *,
        match:matches!match_id(
          kickoff_utc,
          home_team:teams!home_team_id(name),
          away_team:teams!away_team_id(name)
        )
      `)
      .eq('is_active', true)
      .gte('ev_percentage', minEV)
      .order('ev_percentage', { ascending: false });

    setBets((data ?? []) as ValueBetRow[]);
    setLastUpdated(new Date().toLocaleTimeString());
    setLoading(false);
  }

  useEffect(() => { load(); }, [minEV]);

  const filtered = bets
    .filter((b) => marketFilter === 'all' || b.market === marketFilter)
    .sort((a, b) => {
      if (sortBy === 'ev')         return b.ev_percentage - a.ev_percentage;
      if (sortBy === 'confidence') return b.confidence_score - a.confidence_score;
      return new Date(a.match.kickoff_utc).getTime() - new Date(b.match.kickoff_utc).getTime();
    });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <TrendingUp className="w-6 h-6 text-ev-positive" />
            Value Bets
          </h1>
          <p className="text-muted text-sm mt-1">
            Only bets with positive expected value (EV ≥ {minEV}%) are shown. Updated every 30 minutes.
          </p>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="flex items-center gap-2 text-sm text-muted hover:text-white border border-border rounded-lg px-3 py-2 transition-colors"
        >
          <RefreshCw className={cn('w-4 h-4', loading && 'animate-spin')} />
          Refresh
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 bg-surface border border-border rounded-xl p-4">
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-muted" />
          <span className="text-sm text-muted">Filters:</span>
        </div>

        <div className="flex items-center gap-2">
          <label className="text-sm text-muted">Min EV:</label>
          <select
            value={minEV}
            onChange={(e) => setMinEV(Number(e.target.value))}
            className="bg-bg border border-border rounded-lg text-sm text-white px-2 py-1"
          >
            {[3, 5, 8, 10, 15].map((v) => <option key={v} value={v}>{v}%</option>)}
          </select>
        </div>

        <div className="flex items-center gap-2">
          <label className="text-sm text-muted">Market:</label>
          <select
            value={marketFilter}
            onChange={(e) => setMarketFilter(e.target.value)}
            className="bg-bg border border-border rounded-lg text-sm text-white px-2 py-1"
          >
            <option value="all">All</option>
            <option value="1x2">1X2</option>
            <option value="over_25">Goals O/U 2.5</option>
            <option value="btts">BTTS</option>
          </select>
        </div>

        <div className="flex items-center gap-2">
          <label className="text-sm text-muted">Sort:</label>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortKey)}
            className="bg-bg border border-border rounded-lg text-sm text-white px-2 py-1"
          >
            <option value="ev">EV % ↓</option>
            <option value="confidence">Confidence ↓</option>
            <option value="kickoff">Kickoff soonest</option>
          </select>
        </div>

        <div className="ml-auto text-sm text-muted self-center">
          {filtered.length} bets
          {lastUpdated && <span> · Updated {lastUpdated}</span>}
        </div>
      </div>

      {/* Bet cards */}
      {loading ? (
        <div className="grid sm:grid-cols-2 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-surface border border-border rounded-xl p-5 animate-pulse h-48" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-surface border border-border rounded-xl p-12 text-center">
          <TrendingUp className="w-10 h-10 mx-auto mb-3 text-muted opacity-40" />
          <p className="text-muted">No value bets match your criteria right now.</p>
          <p className="text-sm text-muted mt-1">Odds update every 30 minutes — check back soon.</p>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 gap-4">
          {filtered.map((vb) => <ValueBetCard key={vb.id} bet={vb} />)}
        </div>
      )}
    </div>
  );
}

function ValueBetCard({ bet }: { bet: ValueBetRow }) {
  const evPct = bet.ev_percentage;
  const borderColor =
    evPct >= 8  ? 'border-l-ev-positive' :
    evPct >= 3  ? 'border-l-ev-marginal' : 'border-l-ev-negative';

  return (
    <div className={cn('bg-surface border border-border rounded-xl p-5 border-l-4', borderColor)}>
      {/* Match */}
      <div className="flex items-start justify-between mb-3">
        <div>
          <Link href={`/match/${bet.match_id}`} className="text-sm font-semibold text-white hover:text-ev-positive transition-colors">
            {bet.match.home_team.name} vs {bet.match.away_team.name}
          </Link>
          <div className="text-xs text-muted mt-0.5">{formatKickoff(bet.match.kickoff_utc)}</div>
        </div>
        <EVBadge evPct={evPct} />
      </div>

      {/* Market */}
      <div className="mb-4">
        <div className="font-bold text-white">{marketLabel(bet.market, bet.selection)}</div>
        <div className="text-sm text-muted">{bet.bookmaker} · <span className="font-mono text-white">{formatOdds(bet.decimal_odds)}</span></div>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-3 gap-3 text-center mb-3">
        <StatCell label="Our Prob" value={formatPct(bet.our_probability)} />
        <StatCell label="Market" value={formatPct(bet.market_implied_prob)} />
        <StatCell label="Edge" value={`+${((bet.our_probability - bet.market_implied_prob) * 100).toFixed(1)}pp`} highlight />
      </div>

      {/* Kelly */}
      <div className="bg-bg rounded-lg p-3">
        <div className="text-xs text-muted mb-1">Recommended stake</div>
        <div className="flex items-center justify-between">
          <span className="font-mono font-bold text-white">
            {(bet.recommended_fraction * 100).toFixed(2)}% bankroll
          </span>
          <span className="text-xs text-muted">
            e.g. £{(bet.recommended_fraction * 1000).toFixed(0)}/£1k
          </span>
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between mt-3">
        <span className="text-xs text-muted">Confidence: {bet.confidence_score}/100</span>
        <Link href={`/match/${bet.match_id}`} className="text-xs text-ev-positive hover:underline">
          View Analysis →
        </Link>
      </div>
    </div>
  );
}

function StatCell({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div>
      <div className="text-xs text-muted">{label}</div>
      <div className={cn('font-mono font-semibold text-sm', highlight ? 'text-ev-positive' : 'text-white')}>{value}</div>
    </div>
  );
}
