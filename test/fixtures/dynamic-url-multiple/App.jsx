// Multiple variables in template literal
import React from 'react';

function App() {
  const resource = 'users';
  const id = '456';
  
  const handleFetch = () => {
    fetch(`/api/${resource}/${id}`);
  };
  
  return (
    <div>
      <button onClick={handleFetch}>Fetch Resource</button>
    </div>
  );
}

export default App;

