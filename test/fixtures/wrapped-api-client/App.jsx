import React from 'react';
import { submitData } from './api/client';

export function App() {
  return (
    <div>
      <button onClick={submitData}>Submit</button>
    </div>
  );
}

export default App;

