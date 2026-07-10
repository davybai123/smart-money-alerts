import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[50vh] text-center space-y-4">
      <div className="text-5xl font-black font-mono text-muted">404</div>
      <h1 className="text-2xl font-bold text-white">Page not found</h1>
      <p className="text-muted">This page doesn&apos;t exist or has been removed.</p>
      <Link href="/" className="text-ev-positive hover:underline">← Back to home</Link>
    </div>
  );
}
