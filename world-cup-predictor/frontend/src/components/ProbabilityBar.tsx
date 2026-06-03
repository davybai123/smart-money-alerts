import { cn } from '@/lib/utils';

interface Props {
  homeProb: number;
  drawProb: number;
  awayProb: number;
  homeName: string;
  awayName: string;
  compact?: boolean;
}

export default function ProbabilityBar({ homeProb, drawProb, awayProb, homeName, awayName, compact }: Props) {
  const h = Math.round(homeProb * 100);
  const d = Math.round(drawProb * 100);
  const a = Math.round(awayProb * 100);

  if (compact) {
    return (
      <div className="space-y-1">
        <div className="flex h-1.5 rounded-full overflow-hidden gap-px">
          <div className="bg-blue-500"    style={{ width: `${h}%` }} />
          <div className="bg-gray-500"    style={{ width: `${d}%` }} />
          <div className="bg-orange-400" style={{ width: `${a}%` }} />
        </div>
        <div className="flex justify-between text-xs font-mono text-muted">
          <span className="text-blue-400">{h}%</span>
          <span className="text-gray-400">{d}%</span>
          <span className="text-orange-400">{a}%</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-3 text-center text-xs text-muted mb-1">
        <span className="truncate">{homeName}</span>
        <span>Draw</span>
        <span className="truncate">{awayName}</span>
      </div>
      <div className="flex h-2 rounded-full overflow-hidden gap-px bg-border">
        <div className="bg-blue-500 transition-all"    style={{ width: `${h}%` }} />
        <div className="bg-gray-500 transition-all"    style={{ width: `${d}%` }} />
        <div className="bg-orange-400 transition-all" style={{ width: `${a}%` }} />
      </div>
      <div className="grid grid-cols-3 text-center">
        <span className={cn('font-mono font-bold', h >= d && h >= a ? 'text-blue-400' : 'text-muted')}>{h}%</span>
        <span className={cn('font-mono font-bold', d >= h && d >= a ? 'text-white' : 'text-muted')}>{d}%</span>
        <span className={cn('font-mono font-bold', a >= h && a >= d ? 'text-orange-400' : 'text-muted')}>{a}%</span>
      </div>
    </div>
  );
}
