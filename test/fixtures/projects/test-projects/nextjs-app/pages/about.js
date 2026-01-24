import { useState } from 'react';

export default function About() {
  const [count, setCount] = useState(0);
  
  const handleClick = async () => {
    setCount(count + 1);
    const response = await fetch('https://api.example.com/about');
    const data = await response.json();
    return data;
  };
  
  return (
    <div>
      <h1>About Page</h1>
      <p>Count: {count}</p>
      <button onClick={handleClick}>Increment</button>
    </div>
  );
}


