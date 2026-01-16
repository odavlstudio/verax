// Mixed static + dynamic segments
import React from 'react';

function App() {
  const category = 'electronics';
  const productId = '789';
  
  const handleFetch = () => {
    fetch(`/api/products/${category}/item/${productId}/details`);
  };
  
  return (
    <div>
      <button onClick={handleFetch}>Fetch Product</button>
    </div>
  );
}

export default App;

