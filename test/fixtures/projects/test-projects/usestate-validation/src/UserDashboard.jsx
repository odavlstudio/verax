import React, { useState } from 'react';

export default function UserDashboard() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [darkMode, setDarkMode] = useState(false);
  
  React.useEffect(() => {
    fetchUserData()
      .then(data => {
        setNotifications(data.notifications);
        setLoading(false);
      })
      .catch(err => {
        setError(err.message);
        setLoading(false);
      });
  }, []);
  
  const toggleDarkMode = () => {
    setDarkMode(!darkMode);
  };
  
  const dismissNotification = (id) => {
    setNotifications(notifications.filter(n => n.id !== id));
  };
  
  const clearError = () => {
    setError(null);
  };
  
  return (
    <div className={darkMode ? 'dashboard-dark' : 'dashboard-light'}>
      <header>
        <h1>User Dashboard</h1>
        <button onClick={toggleDarkMode}>
          {darkMode ? 'Light Mode' : 'Dark Mode'}
        </button>
      </header>
      
      {loading && (
        <div className="loading-spinner">
          Loading your data...
        </div>
      )}
      
      {error && (
        <div className="error-banner">
          <span>{error}</span>
          <button onClick={clearError}>Dismiss</button>
        </div>
      )}
      
      {!loading && !error && (
        <div className="notifications">
          <h2>Notifications ({notifications.length})</h2>
          {notifications.map(notif => (
            <div key={notif.id} className="notification-item">
              <p>{notif.message}</p>
              <button onClick={() => dismissNotification(notif.id)}>
                Dismiss
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Mock API
async function fetchUserData() {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({
        notifications: [
          { id: 1, message: 'Welcome back!' },
          { id: 2, message: 'You have 3 new messages' },
        ]
      });
    }, 1000);
  });
}
