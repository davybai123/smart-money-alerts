import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatKickoff(utc: string, opts: { time?: boolean; date?: boolean } = { time: true, date: true }): string {
  const d = new Date(utc);
  const parts: Intl.DateTimeFormatOptions = {};
  if (opts.date) { parts.month = 'short'; parts.day = 'numeric'; }
  if (opts.time) { parts.hour = '2-digit'; parts.minute = '2-digit'; parts.timeZoneName = 'short'; }
  return d.toLocaleString('en-GB', parts);
}

export function formatOdds(decimal: number): string {
  return decimal.toFixed(2);
}

export function formatPct(prob: number): string {
  return `${(prob * 100).toFixed(1)}%`;
}

export function evColor(evPct: number): string {
  if (evPct >= 8)  return 'text-ev-positive';
  if (evPct >= 3)  return 'text-ev-marginal';
  return 'text-ev-negative';
}

export function evBg(evPct: number): string {
  if (evPct >= 8)  return 'bg-ev-positive/20 text-ev-positive border border-ev-positive/30';
  if (evPct >= 3)  return 'bg-ev-marginal/20 text-ev-marginal border border-ev-marginal/30';
  return 'bg-ev-negative/20 text-ev-negative border border-ev-negative/30';
}

export function confidenceColor(score: number): string {
  if (score >= 70) return 'text-ev-positive';
  if (score >= 50) return 'text-ev-marginal';
  return 'text-ev-negative';
}

export function confidenceBg(score: number): string {
  if (score >= 70) return 'bg-ev-positive/20 text-ev-positive';
  if (score >= 50) return 'bg-ev-marginal/20 text-ev-marginal';
  return 'bg-ev-negative/20 text-ev-negative';
}

export function stageLabel(stage: string): string {
  const map: Record<string, string> = {
    group:     'Group Stage',
    r32:       'Round of 32',
    r16:       'Round of 16',
    qf:        'Quarter-Final',
    sf:        'Semi-Final',
    third:     'Third Place',
    final:     'Final',
  };
  return map[stage] ?? stage;
}

export function marketLabel(market: string, selection: string): string {
  const labels: Record<string, string> = {
    '1x2|home':      'Home Win',
    '1x2|draw':      'Draw',
    '1x2|away':      'Away Win',
    'over_25|over_25':  'Over 2.5 Goals',
    'over_25|under_25': 'Under 2.5 Goals',
    'over_15|over_15':  'Over 1.5 Goals',
    'over_15|under_15': 'Under 1.5 Goals',
    'over_35|over_35':  'Over 3.5 Goals',
    'over_35|under_35': 'Under 3.5 Goals',
    'btts|yes':      'Both Teams to Score',
    'btts|no':       'BTTS — No',
  };
  return labels[`${market}|${selection}`] ?? `${market} ${selection}`;
}
