import Link from 'next/link';
import { Clock, MapPin } from 'lucide-react';
import { formatKickoff, stageLabel, marketLabel } from '@/lib/utils';
import ProbabilityBar from './ProbabilityBar';
import EVBadge from './EVBadge';
import ConfidenceBadge from './ConfidenceBadge';
import type { MatchWithTeams } from '@/lib/database.types';

interface Props {
  match: MatchWithTeams;
}

export default function MatchCard({ match }: Props) {
  const pred = match.prediction;
  const vb   = match.top_value_bet;
  const isCompleted = ['completed', 'completed_aet', 'completed_pens'].includes(match.status);

  return (
    <Link
      href={`/match/${match.id}`}
      className="block bg-surface border border-border rounded-xl p-4 hover:border-white/20 transition-colors group"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2 text-xs text-muted">
          <span className="bg-border rounded px-1.5 py-0.5">{stageLabel(match.stage)}</span>
          {match.group_letter && <span>Group {match.group_letter}</span>}
        </div>
        <div className="flex items-center gap-1 text-xs text-muted">
          <Clock className="w-3 h-3" />
          {formatKickoff(match.kickoff_utc, { time: true, date: true })}
        </div>
      </div>

      {/* Teams */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex-1 text-center">
          <div className="text-2xl mb-1">🏳️</div>
          <div className="font-semibold text-sm text-white leading-tight">{match.home_team?.name}</div>
          {match.home_team?.elo_rating && (
            <div className="text-xs text-muted font-mono">{match.home_team.elo_rating} Elo</div>
          )}
        </div>

        <div className="px-4 text-center">
          {isCompleted && match.score_home !== null ? (
            <div className="font-mono font-bold text-xl text-white">
              {match.score_home} – {match.score_away}
            </div>
          ) : (
            <div className="text-muted text-sm font-mono">VS</div>
          )}
        </div>

        <div className="flex-1 text-center">
          <div className="text-2xl mb-1">🏳️</div>
          <div className="font-semibold text-sm text-white leading-tight">{match.away_team?.name}</div>
          {match.away_team?.elo_rating && (
            <div className="text-xs text-muted font-mono">{match.away_team.elo_rating} Elo</div>
          )}
        </div>
      </div>

      {/* Venue */}
      {match.city && (
        <div className="flex items-center gap-1 text-xs text-muted mb-3">
          <MapPin className="w-3 h-3" />
          {match.venue ? `${match.venue}, ` : ''}{match.city}
        </div>
      )}

      {/* Prediction */}
      {pred && !isCompleted && (
        <div className="space-y-3">
          <ProbabilityBar
            homeProb={pred.prob_home_win}
            drawProb={pred.prob_draw}
            awayProb={pred.prob_away_win}
            homeName={match.home_team?.name ?? 'Home'}
            awayName={match.away_team?.name ?? 'Away'}
            compact
          />

          <div className="flex items-center justify-between">
            <ConfidenceBadge score={pred.confidence_score} showLabel />
            {vb && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted">{marketLabel(vb.market, vb.selection)}</span>
                <EVBadge evPct={vb.ev_percentage} size="sm" />
              </div>
            )}
          </div>
        </div>
      )}

      {!pred && !isCompleted && (
        <div className="text-xs text-muted text-center py-2">Prediction pending</div>
      )}

      {/* CTA */}
      <div className="mt-3 text-xs text-muted group-hover:text-ev-positive transition-colors text-right">
        Full analysis →
      </div>
    </Link>
  );
}
