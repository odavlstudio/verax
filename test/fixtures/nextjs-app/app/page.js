import React from 'react';
import Link from 'next/link.js';

// Converted from JSX to React.createElement to keep fixtures parseable by node --test
export default function Home() {
  return React.createElement(
    'div',
    null,
    React.createElement('h1', null, 'Home'),
    React.createElement(Link, { href: '/pricing' }, 'Pricing'),
    React.createElement(Link, { href: '/contact' }, 'Contact'),
    React.createElement('a', { href: '/about' }, 'Plain Link to About')
  );
}
