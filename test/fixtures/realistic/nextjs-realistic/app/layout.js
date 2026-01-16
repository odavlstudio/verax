export const metadata = {
  title: 'Next.js Realistic App',
  description: 'Realistic Next.js application with intentional silent failures',
};

'use client';

import { useEffect } from 'react';

export default function RootLayout({ children }) {
  // FALSE POSITIVE TRAP: Page view tracking (should NOT be reported)
  // This is intentionally a no-op for analytics
  useEffect(() => {
    // Intentionally does nothing - not a user-facing promise
    fetch('/api/analytics/pageview', { method: 'POST' })
      .catch(() => {
        // Intentionally ignore - this is expected behavior
      });
  }, []);

  return (
    <html lang="en">
      <body style={{ fontFamily: 'system-ui, sans-serif', margin: 0, padding: 0 }}>
        <nav style={{ background: '#333', padding: '1rem', marginBottom: '2rem' }}>
          <a href="/" style={{ color: 'white', textDecoration: 'none', marginRight: '2rem' }}>Home</a>
          <a href="/products" style={{ color: 'white', textDecoration: 'none', marginRight: '2rem' }}>Products</a>
          <a href="/blog" style={{ color: 'white', textDecoration: 'none', marginRight: '2rem' }}>Blog</a>
          <a href="/search" style={{ color: 'white', textDecoration: 'none' }}>Search</a>
        </nav>
        {children}
      </body>
    </html>
  );
}

