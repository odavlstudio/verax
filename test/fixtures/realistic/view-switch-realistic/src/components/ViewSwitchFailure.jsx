import React, { useState } from 'react';

// CONFIRMED FAILURE: Promise exists but no meaningful change (0-1 signals)
export default function ViewSwitchFailure() {
  const [currentView, setCurrentView] = useState('home');
  
  const handleSwitchToProfile = () => {
    // Promise: setView('profile') - literal string
    setCurrentView('profile');
    // But no actual UI change happens (same DOM structure)
  };
  
  return (
    <div>
      <button onClick={handleSwitchToProfile} id="switch-to-profile">
        Switch to Profile (Silent Failure)
      </button>
      
      {/* Same structure regardless of view - no DOM signature change, no landmark change */}
      <div id="view-container" role="main">
        <h1>View Container</h1>
        <p>Current view state: {currentView} (but UI doesn't change)</p>
      </div>
    </div>
  );
}

