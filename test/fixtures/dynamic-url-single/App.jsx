// Single variable template literal
import React from 'react';

function App() {
  const userId = '123';
  
  const handleFetch = () => {
    fetch(`/api/users/${userId}`);
  };
  
  return (
    <div>
      <button onClick={handleFetch}>Fetch User</button>
    </div>
  );
}

export default App;

