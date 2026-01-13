import { useState } from 'react';
import { Link } from 'react-router-dom';

export default function App() {
  const [count, setCount] = useState(0);
  
  const fetchData = async () => {
    const response = await fetch('/api/data');
    const data = await response.json();
    console.log(data);
  };
  
  return (
    <div>
      <nav>
        <Link to="/about">About</Link>
        <Link to="/products">Products</Link>
      </nav>
      <button onClick={fetchData}>Load Data</button>
      <button onClick={() => setCount(count + 1)}>Count: {count}</button>
    </div>
  );
}
