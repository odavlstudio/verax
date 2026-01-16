import React, { useState, useEffect } from 'react';
import axios from 'axios';

export default function NetworkTestComponent() {
  const [data, setData] = useState(null);
  const [count, setCount] = useState(0);
  
  // Network call in useEffect hook
  useEffect(() => {
    fetch('https://api.example.com/initial-data')
      .then(res => res.json())
      .then(data => setData(data));
  }, []);
  
  // Network call in named handler
  const handleLoadMore = async () => {
    const response = await axios.get('https://api.example.com/more-data');
    setData(response.data);
  };
  
  // Network call in inline onClick handler
  const handleRefresh = () => {
    axios.post('https://api.example.com/refresh', { count });
  };
  
  // Network call in callback within useEffect
  useEffect(() => {
    const interval = setInterval(() => {
      fetch('https://api.example.com/poll')
        .then(res => res.json())
        .catch(err => console.error(err));
    }, 5000);
    
    return () => clearInterval(interval);
  }, []);
  
  // Handler with XHR
  const handleLegacyRequest = () => {
    const xhr = new XMLHttpRequest();
    xhr.open('GET', 'https://api.example.com/legacy');
    xhr.send();
  };
  
  return (
    <div>
      <h1>Network Test Component</h1>
      <button onClick={handleLoadMore}>Load More</button>
      <button onClick={handleRefresh}>Refresh</button>
      <button onClick={handleLegacyRequest}>Legacy Request</button>
      <button onClick={() => fetch('https://api.example.com/inline-click')}>
        Inline Fetch
      </button>
      <button onClick={() => axios.delete('https://api.example.com/delete-item')}>
        Delete
      </button>
      <p>Count: {count}</p>
    </div>
  );
}
