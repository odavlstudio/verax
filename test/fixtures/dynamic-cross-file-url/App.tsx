import React from 'react';
import { saveDynamic } from './api/dynamic';

export function App() {
  return (
    <div>
      <button onClick={saveDynamic}>Save Dynamic</button>
    </div>
  );
}

export default App;
