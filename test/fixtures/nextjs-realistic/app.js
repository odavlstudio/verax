import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

/**
 * Realistic Next.js app with mixed routing patterns
 */
export default function App() {
  const router = useRouter();
  
  return React.createElement(
    'div',
    null,
    React.createElement('h1', null, 'Next.js Realistic App'),
    React.createElement(Link, { href: '/dashboard' }, 'Dashboard'),
    React.createElement(Link, { href: '/products/123' }, 'Product'),
    React.createElement('button', { onClick: () => router.push('/checkout') }, 'Checkout')
  );
}
