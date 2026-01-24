'use client';

import Link from 'next/link';

/**
 * Home page with navigation links
 * Tests extraction of next/link href attributes
 */
export default function Home() {
  return (
    <div>
      <h1>Home</h1>
      <Link href="/pricing">Pricing</Link>
      <Link href="/contact">Contact</Link>
      <Link href="/about">Plain Link to About</Link>
      <a href="/settings">Settings</a>
    </div>
  );
}


