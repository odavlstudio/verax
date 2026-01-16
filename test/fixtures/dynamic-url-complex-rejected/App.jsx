// Complex expressions that should be rejected (not detectable)
import React from 'react';

function App() {
  const obj = { path: 'users' };
  
  const handleFetch1 = () => {
    // Function call - should be rejected
    fetch(`/api/${getPath()}`);
  };
  
  const handleFetch2 = () => {
    // Member access - should be rejected
    fetch(`/api/${obj.path}`);
  };
  
  return (
    <div>
      <button onClick={handleFetch1}>Fetch 1</button>
      <button onClick={handleFetch2}>Fetch 2</button>
    </div>
  );
}

function getPath() {
  return 'users';
}

export default App;

