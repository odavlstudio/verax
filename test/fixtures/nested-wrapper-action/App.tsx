import React from 'react';
import { submit } from './api/wrapper';

export function App() {
  return (
    <div>
      <button onClick={submit}>Submit</button>
    </div>
  );
}

export default App;
