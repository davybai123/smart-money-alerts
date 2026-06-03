import type { Metadata } from 'next';
import './globals.css';
import Nav from '@/components/Nav';

export const metadata: Metadata = {
  title: { template: '%s | GoalEdge.io', default: 'GoalEdge.io — World Cup 2026 Betting Intelligence' },
  description: 'AI-powered World Cup 2026 predictions. Find value bets with positive expected value using Dixon-Coles modelling and Kelly criterion sizing.',
  keywords: ['World Cup 2026', 'betting predictions', 'expected value', 'football analytics', 'value bets'],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-bg">
        <Nav />
        <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
          {children}
        </main>
        <footer className="border-t border-border mt-16 py-8 text-center text-xs text-muted">
          <p>⚠️ 18+ | Gamble Responsibly | This is analysis, not financial advice.</p>
          <p className="mt-1">GoalEdge.io — Data updated every 30 minutes during match days.</p>
        </footer>
      </body>
    </html>
  );
}
