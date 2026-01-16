import React, { useState } from 'react';

// AMBIGUOUS CASE: One signal only (DOM signature changes but no landmark/focus/aria-live)
export default function ViewSwitchAmbiguous() {
  const [currentTab, setTab] = useState('tab1');
  
  const handleSwitchTab = () => {
    // Promise: setTab('tab2') - literal string (matches pattern)
    setTab('tab2');
  };
  
  return (
    <div>
      <button onClick={handleSwitchTab} id="switch-tab">
        Switch Tab
      </button>
      
      {/* DOM signature changes but no landmark change, no focus change, no aria-live */}
      <div id="tab-container">
        {currentTab === 'tab1' && <div>Tab 1 Content</div>}
        {currentTab === 'tab2' && <div>Tab 2 Content</div>}
      </div>
    </div>
  );
}

