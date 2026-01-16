// Dynamic URL inside wrapped API client
import React from 'react';
import { apiClient } from './api/client';

function App() {
  const userId = '999';
  
  const handleSubmit = () => {
    apiClient.post(`/api/users/${userId}/update`, { name: 'Test' });
  };
  
  return (
    <div>
      <button onClick={handleSubmit}>Update User</button>
    </div>
  );
}

export default App;

