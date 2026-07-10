import { supabase } from '@/lib/supabase';
import { BarChart3, CheckCircle, XCircle, MinusCircle } from 'lucide-react';
import { marketLabel, formatOdds, formatPct, cn } from '@/lib/utils';
import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Track Record' };
export const revalidate = 600;

async function getBetHistory() {
  // Fetch settled value bets with match info for track record
  const { data } = await supabase
    .from('saved_bets')
    .select(`
      *,
      match:matches!match_id(
        kickoff_utc,
        home_team:teams!home_team_id(name),
        away_team:teams!away_team_id(name)
      )
    `)
    .not('outcome', 'eq', 'pending')
    .order('created_at', { ascending: false })
    .limit(100);
  return data ?? [];
}

export default async function TrackRecordPage() {
  const history = await getBetHistory();

  const settled = history.filter((b: any) => b.outcome !== 'pending');
  const wins    = settled.filter((b: any) => b.outcome === 'won').length;
  const losses  = settled.filter((b: any) => b.outcome === 'lost').length;
  const pushes  = settled.filter((b: any) => b.outcome === 'push').length;

  const totalStaked  = settled.reduce((s: number, b: any) => s + b.stake, 0);
  const totalReturns = settled.reduce((s: number, b: any) => s + (b.actual_return ?? 0), 0);
  const netPL        = totalReturns - totalStaked;
  const roi          = totalStaked > 0 ? (netPL / totalStaked) * 100 : 0;
  const winRate      = settled.length > 0 ? (wins / settled.length) * 100 : 0;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <BarChart3 className="w-6 h-6 text-ev-positive" />
          Track Record
        </h1>
        <p className="text-muted text-sm mt-1">
          All predictions published and locked before kickoff. No retroactive changes possible.
        </p>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard label="Total Bets" value={settled.length.toString()} />
        <StatCard
          label="Win Rate"
          value={`${winRate.toFixed(1)}%`}
          positive={winRate > 50}
        />
        <StatCard
          label="Net P&L"
          value={`${netPL >= 0 ? '+' : ''}£${netPL.toFixed(0)}`}
          positive={netPL >= 0}
          negative={netPL < 0}
        />
        <StatCard
          label="ROI"
          value={`${roi >= 0 ? '+' : ''}${roi.toFixed(1)}%`}
          positive={roi >= 0}
          negative={roi < 0}
        />
      </div>

      {/* Win/loss breakdown */}
      <div className="flex gap-4 text-sm">
        <span className="flex items-center gap-1 text-ev-positive"><CheckCircle className="w-4 h-4" /> {wins} Won</span>
        <span className="flex items-center gap-1 text-ev-negative"><XCircle className="w-4 h-4" /> {losses} Lost</span>
        <span className="flex items-center gap-1 text-muted"><MinusCircle className="w-4 h-4" /> {pushes} Push</span>
      </div>

      {/* Bet history table */}
      {history.length === 0 ? (
        <div className="bg-surface border border-border rounded-xl p-12 text-center text-muted">
          <BarChart3 className="w-10 h-10 mx-auto mb-3 opacity-40" />
          <p>No settled bets yet. Track record builds as matches complete.</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-muted text-xs border-b border-border">
                <th className="text-left pb-2 font-medium">Match</th>
                <th className="text-left pb-2 font-medium">Market</th>
                <th className="text-right pb-2 font-medium">Odds</th>
                <th className="text-right pb-2 font-medium">Stake</th>
                <th className="text-center pb-2 font-medium">Result</th>
                <th className="text-right pb-2 font-medium">P&L</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {history.map((b: any) => {
                const pl = (b.actual_return ?? 0) - b.stake;
                const match = b.match;
                return (
                  <tr key={b.id} className="hover:bg-surface/50 transition-colors">
                    <td className="py-2 text-white truncate max-w-40">
                      {match?.home_team?.name} v {match?.away_team?.name}
                    </td>
                    <td className="py-2 text-muted">{marketLabel(b.market, b.selection)}</td>
                    <td className="py-2 text-right font-mono text-white">{formatOdds(b.decimal_odds)}</td>
                    <td className="py-2 text-right font-mono text-muted">£{b.stake.toFixed(0)}</td>
                    <td className="py-2 text-center">
                      <ResultBadge outcome={b.outcome} />
                    </td>
                    <td className={cn(
                      'py-2 text-right font-mono font-semibold',
                      pl > 0 ? 'text-ev-positive' : pl < 0 ? 'text-ev-negative' : 'text-muted'
                    )}>
                      {pl >= 0 ? '+' : ''}£{pl.toFixed(0)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, positive, negative }: {
  label: string; value: string; positive?: boolean; negative?: boolean;
}) {
  return (
    <div className="bg-surface border border-border rounded-xl p-4">
      <div className="text-xs text-muted mb-1">{label}</div>
      <div className={cn(
        'font-mono font-bold text-2xl',
        positive ? 'text-ev-positive' : negative ? 'text-ev-negative' : 'text-white'
      )}>
        {value}
      </div>
    </div>
  );
}

function ResultBadge({ outcome }: { outcome: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    won:     { label: 'Won',   cls: 'bg-ev-positive/20 text-ev-positive' },
    lost:    { label: 'Lost',  cls: 'bg-ev-negative/20 text-ev-negative' },
    push:    { label: 'Push',  cls: 'bg-muted/20 text-muted' },
    pending: { label: 'Open',  cls: 'bg-blue-500/20 text-blue-400' },
  };
  const { label, cls } = map[outcome] ?? map.pending;
  return (
    <span className={cn('text-xs font-medium px-2 py-0.5 rounded-full', cls)}>{label}</span>
  );
}
