import React, { useState } from 'react';

// CONFIRMED SUCCESS: setView('settings') with 2+ signals
export default function ViewSwitchSuccess() {
  const [currentView, setCurrentView] = useState('home');
  
  const handleSwitchToSettings = () => {
    // Promise: setView('settings') - literal string
    setCurrentView('settings');
  };
  
  return (
    <div>
      <button onClick={handleSwitchToSettings} id="switch-to-settings">
        Switch to Settings
      </button>
      
      {currentView === 'settings' && (
        <div id="settings-view" role="main">
          <h2>Settings View</h2>
          <p>This is the settings view with landmark change (h2) and DOM signature change</p>
          <div aria-live="polite" role="status">View switched to settings</div>
        </div>
      )}
      
      {currentView === 'home' && (
        <div id="home-view" role="main">
          <h1>Home View</h1>
          <p>Current view: {currentView}</p>
        </div>
      )}
    </div>
  );
}

