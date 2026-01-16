import React from 'react';
import { Routes, Route, Link } from 'react-router-dom';
import UserProfile from './components/UserProfile.jsx';
import TogglePanel from './components/TogglePanel.jsx';
import ItemList from './components/ItemList.jsx';
import DataLoader from './components/DataLoader.jsx';
import Home from './components/Home.jsx';

function App() {
  return (
    <div style={{ fontFamily: 'system-ui, sans-serif', maxWidth: '1200px', margin: '0 auto', padding: '20px' }}>
      <nav style={{ background: '#333', padding: '1rem', marginBottom: '2rem' }}>
        <Link to="/" style={{ color: 'white', textDecoration: 'none', marginRight: '2rem' }}>Home</Link>
        <Link to="/profile" style={{ color: 'white', textDecoration: 'none', marginRight: '2rem' }}>Profile</Link>
        <Link to="/panel" style={{ color: 'white', textDecoration: 'none', marginRight: '2rem' }}>Panel</Link>
        <Link to="/items" style={{ color: 'white', textDecoration: 'none', marginRight: '2rem' }}>Items</Link>
        <Link to="/data" style={{ color: 'white', textDecoration: 'none' }}>Data</Link>
      </nav>

      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/profile" element={<UserProfile />} />
        <Route path="/panel" element={<TogglePanel />} />
        <Route path="/items" element={<ItemList />} />
        <Route path="/data" element={<DataLoader />} />
      </Routes>
    </div>
  );
}

export default App;

