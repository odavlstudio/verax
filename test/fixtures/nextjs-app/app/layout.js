import React from 'react';

/**
 * Root layout for Next.js app router
 */
export default function RootLayout({ children }) {
  return React.createElement(
    'html',
    { lang: 'en' },
    React.createElement(
      'body',
      null,
      children
    )
  );
}
