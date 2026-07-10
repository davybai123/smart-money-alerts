import { cn, confidenceBg } from '@/lib/utils';

interface Props {
  score: number;
  showLabel?: boolean;
}

export default function ConfidenceBadge({ score, showLabel = false }: Props) {
  const label =
    score >= 80 ? 'Very High' :
    score >= 65 ? 'High' :
    score >= 50 ? 'Moderate' :
    score >= 35 ? 'Low' : 'Very Low';

  return (
    <span className={cn(
      'inline-flex items-center gap-1 rounded-full text-xs font-mono font-semibold px-2 py-0.5',
      confidenceBg(score),
    )}>
      {score}
      {showLabel && <span className="opacity-70">· {label}</span>}
    </span>
  );
}
