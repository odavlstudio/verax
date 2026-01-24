import React from 'react';
import Link from 'next/link';
import Router from 'next/router';

/**
 * Home page with pages router
 * Tests extraction of next/link and next/router patterns
 */
export default function Home() {
  const router = Router;
  
  const handleDashboard = () => {
    router.push('/dashboard');
  };
  
  return React.createElement(
    'div',
    null,
    React.createElement('h1', null, 'Pages Router Home'),
    React.createElement(Link, { href: '/about' }, 'About'),
    React.createElement(Link, { href: '/services' }, 'Services'),
    React.createElement('button', { onClick: handleDashboard }, 'Go to Dashboard')
  );
}
