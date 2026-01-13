// Dynamic URL source (for contract extraction - should NOT produce PROVEN contract)
import React, { useState } from 'react';

function App() {
  const [userId] = useState('123');
  
  const handleFetch = () => {
    // Template literal with variable - NOT static
    fetch(`/api/users/${userId}`)
      .then(response => response.json())
      .then(data => console.log(data))
      .catch(err => console.error(err));
  };
  
  return (
    <div>
      <h1>Dynamic URL Test</h1>
      <button onClick={handleFetch}>Fetch User</button>
      <p>This should NOT create a PROVEN contract</p>
    </div>
  );
}

export default App;
