import { notFound } from 'next/navigation';
import { Lock, Clock, MapPin } from 'lucide-react';
import ProbabilityBar from '@/components/ProbabilityBar';
import EVBadge from '@/components/EVBadge';
import ConfidenceBadge from '@/components/ConfidenceBadge';
import { formatKickoff, formatOdds, formatPct, stageLabel, marketLabel, evBg, cn } from '@/lib/utils';
import type { MatchAnalysis } from '@/lib/database.types';
import type { Metadata } from 'next';

export const revalidate = 120;

async function getMatchAnalysis(matchId: string): Promise<MatchAnalysis | null> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

  const res = await fetch(
    `${supabaseUrl}/functions/v1/match-analysis?match_id=${matchId}`,
    {
      headers: { Authorization: `Bearer ${supabaseAnon}` },
      next: { revalidate: 120 },
    }
  );

  if (!res.ok) return null;
  return res.json() as Promise<MatchAnalysis>;
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const data = await getMatchAnalysis(id);
  if (!data) return { title: 'Match Not Found' };
  return {
    title: `${data.match.home_team.name} vs ${data.match.away_team.name}`,
  };
}

export default async function MatchDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = await getMatchAnalysis(id);
  if (!data) notFound();

  const { match, prediction: pred, value_bets: valueBets, best_odds: bestOdds } = data;
  const isCompleted = ['completed', 'completed_aet', 'completed_pens'].includes(match.status);

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Match Header */}
      <div className="bg-surface border border-border rounded-xl p-6">
        <div className="flex items-center gap-2 text-xs text-muted mb-4">
          <span className="bg-border rounded px-1.5 py-0.5">{stageLabel(match.stage)}</span>
          {match.group && <span>Group {match.group}</span>}
          {match.is_locked && (
            <span className="flex items-center gap-1 text-ev-marginal">
              <Lock className="w-3 h-3" /> Prediction locked
            </span>
          )}
        </div>

        <div className="grid grid-cols-3 gap-4 items-center">
          <TeamPanel team={match.home_team} />

          <div className="text-center space-y-2">
            {isCompleted && match.score ? (
              <div className="text-3xl font-mono font-black text-white">{match.score}</div>
            ) : (
              <div className="text-muted font-mono text-sm">VS</div>
            )}
            <div className="flex items-center justify-center gap-1 text-xs text-muted">
              <Clock className="w-3 h-3" />
              {formatKickoff(match.kickoff_utc)}
            </div>
            {match.city && (
              <div className="flex items-center justify-center gap-1 text-xs text-muted">
                <MapPin className="w-3 h-3" />
                {match.city}
              </div>
            )}
            {pred && <ConfidenceBadge score={pred.confidence.score} showLabel />}
          </div>

          <TeamPanel team={match.away_team} reverse />
        </div>
      </div>

      {/* Predictions */}
      {pred && !isCompleted && (
        <>
          <div className="bg-surface border border-border rounded-xl p-6">
            <h2 className="font-bold text-white mb-4">1X2 Markets</h2>
            <div className="grid grid-cols-3 gap-4 mb-6">
              <MarketCard
                label={`${match.home_team.name} Win`}
                prob={pred.markets['1x2'].home.probability}
                fairOdds={pred.markets['1x2'].home.fair_odds}
                bestOdds={pred.markets['1x2'].home.best_book_odds}
                bestBookmaker={pred.markets['1x2'].home.best_bookmaker}
              />
              <MarketCard
                label="Draw"
                prob={pred.markets['1x2'].draw.probability}
                fairOdds={pred.markets['1x2'].draw.fair_odds}
                bestOdds={pred.markets['1x2'].draw.best_book_odds}
                bestBookmaker={pred.markets['1x2'].draw.best_bookmaker}
              />
              <MarketCard
                label={`${match.away_team.name} Win`}
                prob={pred.markets['1x2'].away.probability}
                fairOdds={pred.markets['1x2'].away.fair_odds}
                bestOdds={pred.markets['1x2'].away.best_book_odds}
                bestBookmaker={pred.markets['1x2'].away.best_bookmaker}
              />
            </div>
            <ProbabilityBar
              homeProb={pred.markets['1x2'].home.probability}
              drawProb={pred.markets['1x2'].draw.probability}
              awayProb={pred.markets['1x2'].away.probability}
              homeName={match.home_team.name}
              awayName={match.away_team.name}
            />
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            {/* Goals */}
            <div className="bg-surface border border-border rounded-xl p-5">
              <h3 className="font-bold text-white mb-3">Goals Markets</h3>
              <div className="text-sm text-muted mb-3">
                Expected: <span className="font-mono text-white">{pred.markets.goals.expected_home.toFixed(2)}</span> — <span className="font-mono text-white">{pred.markets.goals.expected_away.toFixed(2)}</span>
              </div>
              <div className="space-y-2">
                <GoalsRow label="Over 1.5" prob={pred.markets.goals.prob_over_15} />
                <GoalsRow label="Over 2.5" prob={pred.markets.goals.prob_over_25} fairOdds={pred.markets.goals.fair_odds_over_25} />
                <GoalsRow label="Under 2.5" prob={1 - pred.markets.goals.prob_over_25} fairOdds={pred.markets.goals.fair_odds_under_25} />
                <GoalsRow label="Over 3.5" prob={pred.markets.goals.prob_over_35} />
              </div>
            </div>

            {/* BTTS */}
            <div className="bg-surface border border-border rounded-xl p-5">
              <h3 className="font-bold text-white mb-3">Both Teams to Score</h3>
              <div className="space-y-2">
                <GoalsRow label="BTTS Yes" prob={pred.markets.btts.prob_yes} fairOdds={pred.markets.btts.fair_odds_yes} />
                <GoalsRow label="BTTS No"  prob={pred.markets.btts.prob_no}  fairOdds={pred.markets.btts.fair_odds_no} />
              </div>
              <div className="mt-4 pt-3 border-t border-border text-xs text-muted space-y-1">
                <div>λ Home: <span className="font-mono text-white">{pred.model_inputs.lambda_home.toFixed(3)}</span></div>
                <div>λ Away: <span className="font-mono text-white">{pred.model_inputs.lambda_away.toFixed(3)}</span></div>
                <div>Elo gap: <span className="font-mono text-white">{Math.abs(pred.model_inputs.home_elo - pred.model_inputs.away_elo).toFixed(0)}</span> pts</div>
              </div>
            </div>
          </div>

          {/* Confidence breakdown */}
          <div className="bg-surface border border-border rounded-xl p-5">
            <h3 className="font-bold text-white mb-3">Confidence Breakdown</h3>
            <div className="grid sm:grid-cols-5 gap-3">
              {Object.entries(pred.confidence.factors).map(([key, val]) => (
                <div key={key} className="text-center">
                  <div className="text-lg font-mono font-bold text-white">{val}</div>
                  <div className="text-xs text-muted capitalize">{key.replace(/([A-Z])/g, ' $1').trim()}</div>
                </div>
              ))}
            </div>
            {pred.key_factors.length > 0 && (
              <div className="mt-4 pt-3 border-t border-border space-y-1">
                {pred.key_factors.map((f, i) => (
                  <div key={i} className="text-xs text-muted">• {f}</div>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {/* Value Bets */}
      {valueBets.length > 0 && (
        <div className="bg-surface border border-border rounded-xl p-5">
          <h2 className="font-bold text-white mb-4">Value Bets ({valueBets.length})</h2>
          <div className="space-y-3">
            {valueBets.map((vb, i) => (
              <div key={i} className={cn('rounded-lg p-4', evBg(vb.ev_pct).replace('text-', 'border-l-4 border-').split(' ')[0], 'bg-white/5 border border-border')}>
                <div className="flex items-start justify-between">
                  <div>
                    <div className="font-semibold text-white">{marketLabel(vb.market, vb.selection)}</div>
                    <div className="text-sm text-muted">{vb.bookmaker} · {formatOdds(vb.odds)}</div>
                  </div>
                  <EVBadge evPct={vb.ev_pct} size="lg" />
                </div>
                <div className="grid grid-cols-3 gap-4 mt-3 text-xs">
                  <div>
                    <div className="text-muted">Our prob</div>
                    <div className="font-mono font-semibold text-white">{formatPct(vb.our_prob)}</div>
                  </div>
                  <div>
                    <div className="text-muted">Market implied</div>
                    <div className="font-mono font-semibold text-white">{formatPct(vb.implied_prob)}</div>
                  </div>
                  <div>
                    <div className="text-muted">Rec. stake</div>
                    <div className="font-mono font-semibold text-white">{vb.recommended_pct.toFixed(2)}% bankroll</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Narrative */}
      {pred && (data as any).narrative?.text && (
        <div className="bg-surface border border-border rounded-xl p-5">
          <h2 className="font-bold text-white mb-4">AI Match Analysis</h2>
          <div className="text-sm text-gray-300 whitespace-pre-wrap leading-relaxed">
            {(data as any).narrative.text}
          </div>
        </div>
      )}

      {/* Locked notice */}
      {isCompleted && (
        <div className="bg-surface border border-ev-marginal/30 rounded-xl p-4 text-center text-sm text-ev-marginal">
          <Lock className="w-4 h-4 inline mr-2" />
          Match complete. All predictions were locked at kickoff and cannot be modified.
        </div>
      )}
    </div>
  );
}

function TeamPanel({ team, reverse }: { team: any; reverse?: boolean }) {
  return (
    <div className={cn('text-center', reverse && 'order-last')}>
      <div className="text-4xl mb-2">🏳️</div>
      <div className="font-bold text-white">{team.name}</div>
      {team.elo_rating && (
        <div className="text-xs text-muted font-mono mt-1">{team.elo_rating} Elo</div>
      )}
    </div>
  );
}

function MarketCard({ label, prob, fairOdds, bestOdds, bestBookmaker }: {
  label: string; prob: number; fairOdds: number;
  bestOdds: number | null; bestBookmaker: string | null;
}) {
  const evPct = bestOdds ? ((prob * (bestOdds - 1)) - (1 - prob)) * 100 : null;

  return (
    <div className="bg-bg border border-border rounded-lg p-3 text-center">
      <div className="text-xs text-muted mb-1">{label}</div>
      <div className="text-2xl font-mono font-black text-white">{formatPct(prob)}</div>
      <div className="text-xs text-muted mt-1">Fair: <span className="font-mono text-white">{formatOdds(fairOdds)}</span></div>
      {bestOdds && (
        <div className="text-xs mt-1">
          Best: <span className="font-mono text-white">{formatOdds(bestOdds)}</span>
          {bestBookmaker && <span className="text-muted"> @ {bestBookmaker}</span>}
        </div>
      )}
      {evPct !== null && <div className="mt-2"><EVBadge evPct={evPct} size="sm" /></div>}
    </div>
  );
}

function GoalsRow({ label, prob, fairOdds }: { label: string; prob: number; fairOdds?: number }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-muted">{label}</span>
      <div className="flex items-center gap-3">
        <span className="font-mono text-white">{formatPct(prob)}</span>
        {fairOdds && <span className="font-mono text-muted text-xs">{formatOdds(fairOdds)}</span>}
      </div>
    </div>
  );
}
