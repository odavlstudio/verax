import React from 'react';

function App() {
  // No promises here: no navigation, no forms, no network calls
  const [counter, setCounter] = React.useState(0);
  
  const handleUnproven = () => {
    // Function reference with unknown effects - NOT extracted
    someUnknownFunction();
  };
  
  return (
    <div>
      <h1>Counter: {counter}</h1>
      <button onClick={() => setCounter(counter + 1)}>Increment</button>
      <button onClick={handleUnproven}>Unknown Action</button>
    </div>
  );
}

function someUnknownFunction() {
  // No proven effects
}

export default App;





