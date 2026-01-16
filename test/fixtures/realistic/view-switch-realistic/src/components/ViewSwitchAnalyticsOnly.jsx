import React, { useState } from 'react';

// ANALYTICS ONLY: Only analytics fired, no UI change
export default function ViewSwitchAnalyticsOnly() {
  const [currentView, setCurrentView] = useState('home');
  
  const handleAnalyticsClick = () => {
    // Promise: setView('analytics') - literal string
    setCurrentView('analytics');
    
    // Fire analytics only
    if (typeof window !== 'undefined' && window.gtag) {
      window.gtag('event', 'view_switch', { view: 'analytics' });
    }
    
    // Simulate analytics beacon
    fetch('/api/analytics/track', {
      method: 'POST',
      body: JSON.stringify({ event: 'view_switch', view: 'analytics' })
    }).catch(() => {});
  };
  
  return (
    <div>
      <button onClick={handleAnalyticsClick} id="analytics-only-button">
        Fire Analytics Only
      </button>
      <p>This fires analytics but no UI change (same DOM structure)</p>
      <div id="analytics-container">
        <p>Current view state: {currentView} (but UI doesn't change)</p>
      </div>
    </div>
  );
}

