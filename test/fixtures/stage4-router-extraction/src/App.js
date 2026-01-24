import React from 'react';
import { Routes, Route, Link, useNavigate } from 'react-router-dom';

function Dashboard() {
  const navigate = useNavigate();
  
  return (
    <div>
      <h1>Dashboard</h1>
      
      {/* Static navigation promises - SHOULD be extracted */}
      <Link to="/profile">Go to Profile</Link>
      <Link to="/settings">Go to Settings</Link>
      
      {/* Dynamic navigation promises - SHOULD NOT be extracted (has :id param) */}
      <Link to={`/post/${123}`}>View Post</Link>
      
      {/* Handler with static path - CAN be extracted if detectable */}
      <button onClick={() => navigate('/about')}>About Page</button>
      
      {/* Handler with dynamic path - SHOULD NOT be extracted */}
      <button onClick={() => {
        const id = getRandomId();
        navigate(`/item/${id}`);
      }}>Random Item</button>
    </div>
  );
}

function Profile() {
  return <h1>Profile Page</h1>;
}

function Settings() {
  return <h1>Settings Page</h1>;
}

function About() {
  return <h1>About Page</h1>;
}

function App() {
  return (
    <Routes>
      <Route path="/" element={<Dashboard />} />
      <Route path="/profile" element={<Profile />} />
      <Route path="/settings" element={<Settings />} />
      <Route path="/about" element={<About />} />
      <Route path="/post/:id" element={<div>Post Page</div>} />
      <Route path="/item/:id" element={<div>Item Page</div>} />
    </Routes>
  );
}

function getRandomId() {
  return 'deterministic-id';
}

export default App;





