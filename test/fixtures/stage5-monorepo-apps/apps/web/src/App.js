import React from 'react';

export function Dashboard() {
  return (
    <div>
      <h1>Web App Dashboard</h1>
      <button onClick={() => window.location.href = '/settings'}>Settings</button>
    </div>
  );
}





