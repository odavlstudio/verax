import React from 'react';
import { BrowserRouter, Routes, Route, Link, useLocation } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { FeatureFlagProvider } from './context/FeatureFlagContext';
import Home from './pages/Home';
import Dashboard from './pages/Dashboard';
import Settings from './pages/Settings';
import Profile from './pages/Profile';

function Navigation() {
  const location = useLocation();

  const isActive = (path) => location.pathname === path;

  return (
    <nav>
      <Link to="/" className={isActive('/') ? 'active' : ''}>
        Home
      </Link>
      <Link to="/dashboard" className={isActive('/dashboard') ? 'active' : ''}>
        Dashboard
      </Link>
      <Link to="/settings" className={isActive('/settings') ? 'active' : ''}>
        Settings
      </Link>
      <Link to="/profile" className={isActive('/profile') ? 'active' : ''}>
        Profile
      </Link>
    </nav>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <FeatureFlagProvider>
          <Navigation />
          <div className="container">
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="/profile" element={<Profile />} />
            </Routes>
          </div>
        </FeatureFlagProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
