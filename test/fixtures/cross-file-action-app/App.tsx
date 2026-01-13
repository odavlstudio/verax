import React from 'react';
import { saveUser } from './api/saveUser';

export function App() {
  return (
    <div>
      <button onClick={saveUser}>Save User</button>
    </div>
  );
}

export default App;
