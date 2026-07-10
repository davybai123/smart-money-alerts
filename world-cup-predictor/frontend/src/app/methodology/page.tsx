'use client';

import { useState } from 'react';
import type { Metadata } from 'next';

const EV_CALC_DEFAULT = { prob: '55', odds: '2.10', bankroll: '1000' };

export default function MethodologyPage() {
  const [calc, setCalc] = useState(EV_CALC_DEFAULT);

  const prob   = parseFloat(calc.prob) / 100;
  const odds   = parseFloat(calc.odds);
  const br     = parseFloat(calc.bankroll);

  const ev     = !isNaN(prob) && !isNaN(odds) ? (prob * (odds - 1)) - (1 - prob) : null;
  const evPct  = ev !== null ? ev * 100 : null;
  const b      = odds - 1;
  const kelly  = ev !== null && b > 0 ? Math.max(0, (b * prob - (1 - prob)) / b) : 0;
  const recStake = !isNaN(br) ? Math.min(0.05, kelly / 4) * br : 0;

  return (
    <div className="max-w-3xl mx-auto space-y-12">
      <div>
        <h1 className="text-2xl font-bold text-white">How It Works</h1>
        <p className="text-muted mt-1">Our methodology, model, and decision framework explained.</p>
      </div>

      <Section id="philosophy" title="Our Philosophy">
        <p>We don&apos;t predict match winners. We identify when bookmakers have mispriced odds — when the true probability of an outcome is higher than what the bookmaker&apos;s odds imply. This is <strong className="text-white">expected value</strong> betting.</p>
        <p className="mt-3">A bet has positive EV when: <code className="bg-border px-1.5 py-0.5 rounded text-sm font-mono">(our probability × bookmaker odds) &gt; 1.0</code></p>
        <p className="mt-3 text-muted text-sm">Even correct-probability bets lose money sometimes. What matters is making decisions that are correct on average over hundreds of bets — not being right every time.</p>
      </Section>

      <Section id="model" title="The Prediction Model">
        <p>We use a <strong className="text-white">Dixon-Coles Bivariate Poisson</strong> model, one of the most well-studied approaches in football analytics. It works by:</p>
        <ol className="mt-3 space-y-2 text-muted list-decimal list-inside">
          <li>Estimating each team&apos;s attack strength and defensive weakness using xG (expected goals) data</li>
          <li>Modelling goals scored as Poisson random variables with a low-score correction (the &ldquo;Dixon-Coles τ correction&rdquo;)</li>
          <li>Weighting team ratings with Elo to account for overall team quality</li>
          <li>Applying a host nation advantage for USA, Canada, and Mexico</li>
        </ol>
        <Example title="Score Matrix Example">
          A match with λ_home = 1.4 and λ_away = 0.9 produces a full probability distribution over all score lines (0-0, 1-0, 0-1, etc.) We aggregate these to derive 1X2, goals, and BTTS probabilities.
        </Example>
      </Section>

      <Section id="ev" title="Expected Value Explained">
        <p>EV is the average outcome of a bet if you were to place it many times.</p>
        <Example title="Worked Example">
          <p>You believe Argentina has a 60% chance of winning. Bookmaker offers 2.00 (implied: 50%).</p>
          <p className="mt-2 font-mono text-sm">EV = (0.60 × 1.00) - (0.40 × 1.00) = <strong className="text-ev-positive">+20%</strong></p>
          <p className="mt-2 text-muted text-sm">For every £1 staked, you expect to return £1.20 on average. That&apos;s a 20% edge.</p>
        </Example>
      </Section>

      <Section id="kelly" title="Kelly Criterion">
        <p>The Kelly Criterion tells you how much of your bankroll to stake to maximise long-run growth. We always recommend <strong className="text-white">quarter-Kelly</strong>, scaled by our model confidence.</p>
        <Example title="Kelly Formula">
          <code className="text-sm font-mono">f* = (b × p - q) / b</code>
          <p className="mt-2 text-muted text-sm">Where: b = decimal odds − 1, p = our probability, q = 1 − p</p>
          <p className="mt-2 text-muted text-sm">We cap recommended stakes at 5% of bankroll regardless of Kelly output.</p>
        </Example>
      </Section>

      <Section id="confidence" title="Confidence Scores">
        <p>Each prediction gets a 0–100 confidence score built from 5 factors:</p>
        <div className="mt-3 space-y-2 text-sm">
          {[
            ['30%', 'Data Quality', 'Is xG data available? How many matches of data do we have?'],
            ['25%', 'Model Stability', 'How much do probabilities change with perturbed inputs?'],
            ['20%', 'Market Agreement', 'Does our probability align credibly with the market?'],
            ['15%', 'H2H History', 'How many head-to-head matches exist?'],
            ['10%', 'Injury Clarity', 'Are key players confirmed available?'],
          ].map(([weight, label, desc]) => (
            <div key={label} className="flex gap-3">
              <span className="text-ev-positive font-mono w-10 shrink-0">{weight}</span>
              <div>
                <span className="text-white font-medium">{label}</span>
                <span className="text-muted ml-2">{desc}</span>
              </div>
            </div>
          ))}
        </div>
      </Section>

      <Section id="calculator" title="Interactive EV Calculator">
        <p className="text-muted text-sm mb-4">Enter your probability estimate and the bookmaker&apos;s odds to calculate expected value.</p>

        <div className="bg-bg border border-border rounded-xl p-5 space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <label className="block">
              <div className="text-xs text-muted mb-1">Your probability (%)</div>
              <input
                type="number" min="1" max="99"
                value={calc.prob}
                onChange={(e) => setCalc({ ...calc, prob: e.target.value })}
                className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-white font-mono text-sm focus:outline-none focus:border-ev-positive"
              />
            </label>
            <label className="block">
              <div className="text-xs text-muted mb-1">Decimal odds</div>
              <input
                type="number" min="1.01" step="0.01"
                value={calc.odds}
                onChange={(e) => setCalc({ ...calc, odds: e.target.value })}
                className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-white font-mono text-sm focus:outline-none focus:border-ev-positive"
              />
            </label>
            <label className="block">
              <div className="text-xs text-muted mb-1">Bankroll (£)</div>
              <input
                type="number" min="1"
                value={calc.bankroll}
                onChange={(e) => setCalc({ ...calc, bankroll: e.target.value })}
                className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-white font-mono text-sm focus:outline-none focus:border-ev-positive"
              />
            </label>
          </div>

          {evPct !== null && !isNaN(evPct) && (
            <div className="grid grid-cols-3 gap-4 pt-3 border-t border-border">
              <CalcResult
                label="Expected Value"
                value={`${evPct >= 0 ? '+' : ''}${evPct.toFixed(1)}%`}
                highlight={evPct >= 3}
                negative={evPct < 0}
              />
              <CalcResult label="Full Kelly" value={`${(kelly * 100).toFixed(2)}%`} />
              <CalcResult
                label="Rec. Stake (¼ Kelly)"
                value={`£${recStake.toFixed(2)}`}
                highlight={evPct >= 3}
              />
            </div>
          )}
        </div>
      </Section>

      <Section id="data" title="Data Sources">
        <ul className="space-y-2 text-sm text-muted">
          <li>• <strong className="text-white">API-Football</strong> — Match results, team statistics, live scores</li>
          <li>• <strong className="text-white">The Odds API</strong> — Real-time bookmaker odds from Bet365, William Hill, Betway, Unibet and others</li>
          <li>• <strong className="text-white">FIFA</strong> — Official tournament structure, group assignments, match schedule</li>
          <li>• <strong className="text-white">Manual curation</strong> — Elo ratings calibrated from 5 years of international match data</li>
        </ul>
      </Section>

      <Section id="limits" title="Model Limitations">
        <ul className="space-y-2 text-sm text-muted">
          <li>• We cannot predict injuries, suspensions, or weather announced after our data snapshot</li>
          <li>• Tournament football has small samples — early-group H2H data may be sparse</li>
          <li>• The model assumes teams play to their statistical profile — motivation and tactics can override this</li>
          <li>• We do not model penalty shootout probabilities with precision</li>
          <li>• No system beats the market consistently. This is a tool to identify edges, not a guarantee</li>
        </ul>
      </Section>
    </div>
  );
}

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-20">
      <h2 className="text-lg font-bold text-white mb-3 border-l-2 border-ev-positive pl-3">{title}</h2>
      <div className="text-gray-300 leading-relaxed">{children}</div>
    </section>
  );
}

function Example({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-bg border border-border rounded-lg p-4 mt-3">
      <div className="text-xs text-ev-positive font-semibold uppercase tracking-wide mb-2">{title}</div>
      <div className="text-sm text-gray-300">{children}</div>
    </div>
  );
}

function CalcResult({ label, value, highlight, negative }: {
  label: string; value: string; highlight?: boolean; negative?: boolean;
}) {
  return (
    <div className="text-center">
      <div className="text-xs text-muted mb-1">{label}</div>
      <div className={`font-mono font-bold text-lg ${negative ? 'text-ev-negative' : highlight ? 'text-ev-positive' : 'text-white'}`}>
        {value}
      </div>
    </div>
  );
}
