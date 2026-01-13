// React Action App source (for instrumentation)
import React, { useState } from 'react';

function App() {
  const [message, setMessage] = useState('');
  
  const handleSave = () => {
    fetch('/api/save', { method: 'POST', body: JSON.stringify({ data: 'test' }) })
      .then(response => {
        if (!response.ok) {
          console.error('Save failed');
        }
        return response.json();
      })
      .then(data => setMessage('Saved!'))
      .catch(err => {
        console.error('Error:', err);
      });
  };
  
  return (
    <div>
      <h1>React Action App</h1>
      <button onClick={handleSave}>Save Data</button>
      {message && <p>{message}</p>}
    </div>
  );
}

export default App;
