import React from 'react';
import { handleClick } from './handler';

export function App() {
  return (
    <div>
      <button onClick={handleClick}>External</button>
    </div>
  );
}

export default App;
