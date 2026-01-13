import React, { useState, useReducer } from 'react';
import { BrowserRouter as Router, Link } from 'react-router-dom';
import axios from 'axios';

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useReducer((state, action) => {
    return { ...state, ...action };
  }, { status: 'active' });

  const loadData = async () => {
    setLoading(true);
    try {
      const response = await axios.get('/api/dashboard');
      setData(response.data);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <nav>
        <Link to="/users">Users</Link>
        <Link to="/reports">Reports</Link>
        <Link to="/settings">Settings</Link>
      </nav>
      
      <button onClick={loadData}>Load Dashboard</button>
      {loading && <p>Loading...</p>}
      {data && <pre>{JSON.stringify(data)}</pre>}
      
      <div>Filter: {filter.status}</div>
    </div>
  );
}
