import React, { useState } from 'react';

// BLOCKED INTERACTION: Disabled button
export default function ViewSwitchBlocked() {
  const [isDisabled, setIsDisabled] = useState(true);
  const [currentView, setCurrentView] = useState('home');
  
  const handleSwitch = () => {
    if (!isDisabled) {
      setCurrentView('settings');
    }
  };
  
  return (
    <div>
      <button 
        onClick={handleSwitch} 
        id="blocked-switch-button"
        disabled={isDisabled}
      >
        Switch View (Disabled)
      </button>
      <p>Button is disabled - interaction should be INFORMATIONAL</p>
      <p>Current view: {currentView}</p>
    </div>
  );
}

