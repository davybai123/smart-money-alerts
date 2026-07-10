import { supabase } from '@/lib/supabase';
import { Trophy, Clock } from 'lucide-react';
import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Tournament Simulator' };
export const revalidate = 600;

async function getSimulation() {
  const { data } = await supabase
    .from('tournament_simulation')
    .select('*, team:teams!team_id(id, name, fifa_code, group_letter)')
    .order('prob_winner', { ascending: false });
  return data ?? [];
}

async function getGroups() {
  const { data: matches } = await supabase
    .from('matches')
    .select(`
      id, group_letter, status, score_home, score_away,
      home_team:teams!home_team_id(id, name),
      away_team:teams!away_team_id(id, name)
    `)
    .eq('stage', 'group')
    .not('group_letter', 'is', null)
    .order('group_letter')
    .order('match_number');
  return matches ?? [];
}

export default async function TournamentPage() {
  const [simulation, groupMatches] = await Promise.all([getSimulation(), getGroups()]);

  const top8  = simulation.slice(0, 8);
  const rest  = simulation.slice(8);
  const lastSimulated = simulation[0]?.simulated_at;

  // Build group standings from match results
  const groups = buildGroupStandings(groupMatches as any[]);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <Trophy className="w-6 h-6 text-ev-positive" />
          Tournament Simulator
        </h1>
        <p className="text-muted text-sm mt-1 flex items-center gap-1">
          <Clock className="w-3.5 h-3.5" />
          {lastSimulated
            ? `100,000 iterations · Last run ${new Date(lastSimulated).toLocaleString('en-GB')}`
            : 'Simulation not yet run'}
        </p>
      </div>

      {/* Winner probabilities */}
      <section>
        <h2 className="text-lg font-bold text-white mb-4">World Cup Winner Probabilities</h2>
        {simulation.length === 0 ? (
          <div className="bg-surface border border-border rounded-xl p-8 text-center text-muted">
            Run <code className="bg-border px-1 rounded text-xs">run-tournament-simulation</code> to generate data.
          </div>
        ) : (
          <div className="space-y-2">
            {top8.map((sim: any, i) => (
              <WinnerRow key={sim.id} sim={sim} rank={i + 1} />
            ))}

            {rest.length > 0 && (
              <details className="group">
                <summary className="cursor-pointer text-sm text-muted hover:text-white py-2 pl-2">
                  Show all {rest.length} remaining teams ▸
                </summary>
                <div className="mt-2 space-y-2">
                  {rest.map((sim: any, i) => (
                    <WinnerRow key={sim.id} sim={sim} rank={i + 9} compact />
                  ))}
                </div>
              </details>
            )}
          </div>
        )}
      </section>

      {/* Stage probabilities table */}
      {simulation.length > 0 && (
        <section>
          <h2 className="text-lg font-bold text-white mb-4">Stage Probabilities</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-muted text-xs border-b border-border">
                  <th className="text-left pb-2 font-medium">Team</th>
                  <th className="text-right pb-2 font-medium">Advance</th>
                  <th className="text-right pb-2 font-medium">R16</th>
                  <th className="text-right pb-2 font-medium">QF</th>
                  <th className="text-right pb-2 font-medium">SF</th>
                  <th className="text-right pb-2 font-medium">Final</th>
                  <th className="text-right pb-2 font-medium">Win</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {simulation.map((sim: any) => (
                  <tr key={sim.id} className="hover:bg-surface/50 transition-colors">
                    <td className="py-2 font-medium text-white">{sim.team?.name}</td>
                    <td className="py-2 text-right font-mono text-muted">{pct(sim.prob_group_advance)}</td>
                    <td className="py-2 text-right font-mono text-muted">{pct(sim.prob_r16)}</td>
                    <td className="py-2 text-right font-mono text-muted">{pct(sim.prob_qf)}</td>
                    <td className="py-2 text-right font-mono text-muted">{pct(sim.prob_sf)}</td>
                    <td className="py-2 text-right font-mono text-muted">{pct(sim.prob_final)}</td>
                    <td className="py-2 text-right font-mono font-bold text-ev-positive">{pct(sim.prob_winner)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Group standings */}
      {groups.size > 0 && (
        <section>
          <h2 className="text-lg font-bold text-white mb-4">Group Standings</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[...groups.entries()].map(([letter, teams]) => (
              <div key={letter} className="bg-surface border border-border rounded-xl overflow-hidden">
                <div className="bg-border/50 px-4 py-2 font-bold text-sm text-white">Group {letter}</div>
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-muted border-b border-border">
                      <th className="text-left px-3 py-1.5">Team</th>
                      <th className="text-center px-1 py-1.5">P</th>
                      <th className="text-center px-1 py-1.5">W</th>
                      <th className="text-center px-1 py-1.5">D</th>
                      <th className="text-center px-1 py-1.5">L</th>
                      <th className="text-center px-1 py-1.5">GD</th>
                      <th className="text-center px-1 py-1.5">Pts</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {teams.map((t, i) => (
                      <tr key={t.teamId} className={i < 2 ? 'text-white' : 'text-muted'}>
                        <td className="px-3 py-1.5 font-medium truncate max-w-24">{t.name}</td>
                        <td className="text-center font-mono px-1">{t.played}</td>
                        <td className="text-center font-mono px-1">{t.won}</td>
                        <td className="text-center font-mono px-1">{t.drawn}</td>
                        <td className="text-center font-mono px-1">{t.lost}</td>
                        <td className="text-center font-mono px-1">{t.gd > 0 ? `+${t.gd}` : t.gd}</td>
                        <td className="text-center font-mono font-bold px-1">{t.points}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function WinnerRow({ sim, rank, compact }: { sim: any; rank: number; compact?: boolean }) {
  const pctVal = (sim.prob_winner * 100).toFixed(compact ? 1 : 2);
  const fairOdds = sim.prob_winner > 0 ? (1 / sim.prob_winner).toFixed(2) : '—';
  const barWidth = Math.max(2, sim.prob_winner * 500);

  return (
    <div className="flex items-center gap-3 bg-surface border border-border rounded-lg px-4 py-2.5">
      <span className="text-muted text-sm w-6 text-right font-mono">{rank}</span>
      <span className="text-xl">🏳️</span>
      <span className="font-medium text-white flex-1">{sim.team?.name}</span>
      {!compact && (
        <div className="flex-1 hidden sm:block">
          <div className="h-1.5 bg-border rounded-full overflow-hidden">
            <div
              className="h-full bg-ev-positive rounded-full"
              style={{ width: `${Math.min(100, barWidth)}%` }}
            />
          </div>
        </div>
      )}
      <span className="font-mono font-bold text-ev-positive w-12 text-right">{pctVal}%</span>
      {!compact && <span className="font-mono text-muted text-sm w-16 text-right">{fairOdds}</span>}
    </div>
  );
}

function pct(val: number): string {
  return `${(val * 100).toFixed(1)}%`;
}

interface TeamStanding {
  teamId: string;
  name: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  gf: number;
  ga: number;
  gd: number;
  points: number;
}

function buildGroupStandings(matches: any[]): Map<string, TeamStanding[]> {
  const groups = new Map<string, Map<string, TeamStanding>>();

  for (const m of matches) {
    const g = m.group_letter;
    if (!g) continue;
    if (!groups.has(g)) groups.set(g, new Map());
    const map = groups.get(g)!;

    for (const [tid, name] of [[m.home_team.id, m.home_team.name], [m.away_team.id, m.away_team.name]]) {
      if (!map.has(tid)) {
        map.set(tid, { teamId: tid, name, played: 0, won: 0, drawn: 0, lost: 0, gf: 0, ga: 0, gd: 0, points: 0 });
      }
    }

    if (m.score_home === null || m.score_away === null) continue;

    const home = map.get(m.home_team.id)!;
    const away = map.get(m.away_team.id)!;
    home.played++; away.played++;
    home.gf += m.score_home; home.ga += m.score_away; home.gd += m.score_home - m.score_away;
    away.gf += m.score_away; away.ga += m.score_home; away.gd += m.score_away - m.score_home;

    if (m.score_home > m.score_away) { home.won++; home.points += 3; away.lost++; }
    else if (m.score_home < m.score_away) { away.won++; away.points += 3; home.lost++; }
    else { home.drawn++; home.points++; away.drawn++; away.points++; }
  }

  const result = new Map<string, TeamStanding[]>();
  for (const [g, map] of groups) {
    const ranked = [...map.values()].sort((a, b) =>
      b.points !== a.points ? b.points - a.points :
      b.gd !== a.gd ? b.gd - a.gd :
      b.gf - a.gf
    );
    result.set(g, ranked);
  }
  return result;
}
