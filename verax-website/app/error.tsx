'use client';

import { useEffect } from 'react';

export const dynamic = 'force-dynamic';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-base-black px-4">
      <div className="text-center">
        <h1 className="text-6xl font-bold text-signal-orange mb-4">Error</h1>
        <h2 className="text-2xl font-semibold text-text-primary mb-4">Something went wrong</h2>
        <p className="text-text-muted mb-8">An error occurred while loading this page.</p>
        <div className="flex gap-4 justify-center">
          <button
            onClick={reset}
            className="px-6 py-3 rounded-lg bg-signal-orange text-base-black text-sm font-semibold hover:bg-signal-orange-deep transition-all duration-300"
          >
            Try again
          </button>
          <a
            href="/"
            className="px-6 py-3 rounded-lg glass-hover text-text-primary text-sm font-semibold"
          >
            Back to Home
          </a>
        </div>
      </div>
    </div>
  );
}
