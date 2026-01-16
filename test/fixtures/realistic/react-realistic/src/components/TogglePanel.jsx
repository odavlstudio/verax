import React, { useState } from 'react';

function TogglePanel() {
  const [isOpen, setIsOpen] = useState(false);

  // INTENTIONAL SILENT FAILURE #2: State update failure
  // Button promises state update (modal opens) but state doesn't change
  const handleToggle = () => {
    // Promise: Should toggle isOpen state (modal should open/close)
    // Reality: State update is called but doesn't actually change
    // This simulates a bug where setState is called but state doesn't update
    setIsOpen(!isOpen);
    
    // Intentionally prevent state update (simulates bug)
    // In real bug: setState might be called but component doesn't re-render
    // or state update is overridden immediately
    setTimeout(() => {
      // Override the state change - simulates race condition or bug
      // This creates a silent failure where state doesn't actually change
      if (isOpen) {
        // Intentionally keep state as-is (silent failure)
      }
    }, 0);
  };

  return (
    <div>
      <h1>Toggle Panel</h1>
      <p>Click the button to open/close the panel.</p>
      <button
        onClick={handleToggle}
        style={{
          padding: '0.75rem 1.5rem',
          background: '#28a745',
          color: 'white',
          border: 'none',
          borderRadius: '4px',
          cursor: 'pointer',
          marginBottom: '1rem'
        }}
      >
        {isOpen ? 'Close Panel' : 'Open Panel'}
      </button>
      
      {/* INTENTIONAL: Panel state doesn't actually change (silent failure) */}
      {isOpen && (
        <div style={{
          padding: '2rem',
          background: '#f8f9fa',
          border: '1px solid #ddd',
          borderRadius: '4px',
          marginTop: '1rem'
        }}>
          <h2>Panel Content</h2>
          <p>This panel should appear when the button is clicked, but it doesn't due to a state update bug.</p>
        </div>
      )}
    </div>
  );
}

export default TogglePanel;

