import React, { useState, useEffect } from 'react';

function DataLoader() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  // INTENTIONAL SILENT FAILURE #5: Missing loading feedback
  // Data fetch promises loading indicator but none appears
  const loadData = async () => {
    // Promise: Should show loading indicator during fetch
    // Reality: Loading state is set but UI doesn't show it
    setLoading(true);
    
    try {
      // Simulate network request
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Intentionally don't set loading to false immediately
      // This creates a case where loading state exists but UI doesn't reflect it
      setData({ message: 'Data loaded' });
    } catch (error) {
      // Silent failure - no error handling
    } finally {
      // Intentionally delay setting loading to false
      // This simulates a bug where loading state doesn't update UI
      setTimeout(() => {
        setLoading(false);
      }, 500);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  return (
    <div>
      <h1>Data Loader</h1>
      <p>This component loads data but doesn't show loading feedback properly.</p>
      
      {/* INTENTIONAL: Loading state exists but UI doesn't show it (silent failure) */}
      {loading && (
        <div style={{ 
          padding: '1rem',
          background: '#fff3cd',
          border: '1px solid #ffc107',
          borderRadius: '4px',
          marginBottom: '1rem',
          display: 'none' // INTENTIONAL: Loading indicator is hidden (silent failure)
        }}>
          Loading...
        </div>
      )}
      
      {data && (
        <div style={{
          padding: '1rem',
          background: '#d4edda',
          border: '1px solid #28a745',
          borderRadius: '4px'
        }}>
          <p>{data.message}</p>
        </div>
      )}
      
      <button
        onClick={loadData}
        style={{
          marginTop: '1rem',
          padding: '0.75rem 1.5rem',
          background: '#007bff',
          color: 'white',
          border: 'none',
          borderRadius: '4px',
          cursor: 'pointer'
        }}
      >
        Reload Data
      </button>
    </div>
  );
}

export default DataLoader;

