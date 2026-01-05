'use client';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html>
      <body>
        <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#0A0A0A', padding: '1rem' }}>
          <div style={{ textAlign: 'center' }}>
            <h1 style={{ fontSize: '3rem', fontWeight: 'bold', color: '#F59E0B', marginBottom: '1rem' }}>Error</h1>
            <h2 style={{ fontSize: '1.5rem', fontWeight: '600', color: '#E5E5E5', marginBottom: '1rem' }}>Something went wrong</h2>
            <button
              onClick={reset}
              style={{ padding: '0.75rem 1.5rem', borderRadius: '0.5rem', backgroundColor: '#F59E0B', color: '#0A0A0A', fontSize: '0.875rem', fontWeight: '600', cursor: 'pointer', border: 'none' }}
            >
              Try again
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
