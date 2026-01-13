import React from 'react';
import { Routes, Route } from 'react-router-dom';
import Home from './Home.js';
import About from './About.js';

function App() {
  return React.createElement(
    Routes,
    null,
    React.createElement(Route, { path: '/', element: React.createElement(Home, null) }),
    React.createElement(Route, { path: '/about', element: React.createElement(About, null) })
  );
}

export default App;

