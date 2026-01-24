import React from 'react';
import { Routes, Route, Link } from 'react-router-dom';

function Home() {
  return React.createElement(
    'div',
    null,
    React.createElement('h1', null, 'Home'),
    React.createElement(Link, { to: '/about' }, 'About'),
    React.createElement(Link, { to: '/pricing' }, 'Pricing')
  );
}

function About() {
  return React.createElement('h1', null, 'About Page');
}

function Pricing() {
  return React.createElement('h1', null, 'Pricing Page');
}

function App() {
  return React.createElement(
    Routes,
    null,
    React.createElement(Route, { path: '/', element: React.createElement(Home, null) }),
    React.createElement(Route, { path: '/about', element: React.createElement(About, null) }),
    React.createElement(Route, { path: '/pricing', element: React.createElement(Pricing, null) })
  );
}

export default App;


