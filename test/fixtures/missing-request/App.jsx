// Missing Request source (for contract extraction)
import React from 'react';

function App() {
  const handleClick = (e) => {
    e.preventDefault();
    if (true) {
      console.log('Prevented');
      return;
    }
    // This fetch is promised but never executed
    fetch('/api/save', { method: 'POST' });
  };
  
  return (
    <div>
      <h1>Missing Request Test</h1>
      <button onClick={handleClick}>Broken Button</button>
    </div>
  );
}

export default App;
