/**
 * Test fixture: React component with POST button
 * VERAX should extract this button interaction promise during static analysis
 */

import React from 'react';

function TestApp() {
  const handleClick = async () => {
    const response = await fetch('/api/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'save', data: 'test' })
    });
    return response.json();
  };

  return (
    <div>
      <h1>POST Blocking Test</h1>
      <button onClick={handleClick}>Send POST to /api/save</button>
    </div>
  );
}

export default TestApp;
