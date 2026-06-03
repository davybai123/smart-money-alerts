import { cn, evBg } from '@/lib/utils';

interface Props {
  evPct: number;
  size?: 'sm' | 'md' | 'lg';
}

export default function EVBadge({ evPct, size = 'md' }: Props) {
  const label =
    evPct >= 15 ? 'Exceptional' :
    evPct >= 8  ? 'Strong' :
    evPct >= 3  ? 'Marginal' : 'Neg.';

  return (
    <span className={cn(
      'inline-flex items-center gap-1 rounded-full font-mono font-semibold',
      evBg(evPct),
      size === 'sm' ? 'text-xs px-2 py-0.5' :
      size === 'lg' ? 'text-base px-3 py-1'  :
                      'text-sm px-2.5 py-0.5',
    )}>
      {evPct >= 3 ? '+' : ''}{evPct.toFixed(1)}% EV
      {size !== 'sm' && <span className="opacity-70">· {label}</span>}
    </span>
  );
}
