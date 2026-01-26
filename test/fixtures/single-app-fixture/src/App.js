import React from 'react';

function App() {
  const handleClick = () => {
    // Static navigation - should be extracted
    window.location.href = '/about';
  };

  return (
    <div>
      <h1>Single App</h1>
      <button onClick={handleClick}>Go to About</button>
      <a href="/contact">Contact</a>
    </div>
  );
}

export default App;





