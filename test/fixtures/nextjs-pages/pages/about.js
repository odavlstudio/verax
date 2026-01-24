import React from 'react';
import Link from 'next/link';

/**
 * About page
 */
export default function About() {
  return React.createElement(
    'div',
    null,
    React.createElement('h1', null, 'About Page'),
    React.createElement(Link, { href: '/' }, 'Home')
  );
}
