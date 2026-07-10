'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Trophy, Target, BarChart3, BookOpen, User, TrendingUp } from 'lucide-react';
import { cn } from '@/lib/utils';

const links = [
  { href: '/matches',    label: 'Matches',    icon: Target },
  { href: '/value-bets', label: 'Value Bets', icon: TrendingUp },
  { href: '/tournament', label: 'Tournament', icon: Trophy },
  { href: '/track-record', label: 'Track Record', icon: BarChart3 },
  { href: '/methodology', label: 'How It Works', icon: BookOpen },
];

export default function Nav() {
  const path = usePathname();

  return (
    <nav className="sticky top-0 z-50 bg-surface/95 backdrop-blur border-b border-border">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 flex items-center justify-between h-14">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 font-bold text-white">
          <div className="w-7 h-7 bg-ev-positive rounded-lg flex items-center justify-center text-bg text-sm font-black">
            G
          </div>
          <span className="hidden sm:block">GoalEdge</span>
          <span className="text-ev-positive text-xs font-mono hidden sm:block">.io</span>
        </Link>

        {/* Desktop links */}
        <div className="hidden md:flex items-center gap-1">
          {links.map((l) => {
            const active = path.startsWith(l.href);
            return (
              <Link
                key={l.href}
                href={l.href}
                className={cn(
                  'px-3 py-1.5 rounded-lg text-sm font-medium transition-colors',
                  active
                    ? 'bg-ev-positive/10 text-ev-positive'
                    : 'text-muted hover:text-white hover:bg-white/5'
                )}
              >
                {l.label}
              </Link>
            );
          })}
        </div>

        {/* Auth buttons */}
        <div className="flex items-center gap-2">
          <Link
            href="/account"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm text-muted hover:text-white border border-border hover:border-white/20 transition-colors"
          >
            <User className="w-3.5 h-3.5" />
            <span className="hidden sm:block">Account</span>
          </Link>
        </div>
      </div>

      {/* Mobile bottom nav */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 bg-surface border-t border-border flex z-50">
        {links.slice(0, 4).map((l) => {
          const Icon = l.icon;
          const active = path.startsWith(l.href);
          return (
            <Link
              key={l.href}
              href={l.href}
              className={cn(
                'flex-1 flex flex-col items-center gap-0.5 py-2 text-xs',
                active ? 'text-ev-positive' : 'text-muted'
              )}
            >
              <Icon className="w-5 h-5" />
              <span>{l.label.split(' ')[0]}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
