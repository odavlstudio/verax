import React, { useEffect, useState } from 'react';
import { fetchDashboardData, fetchUserDataFast, fetchUserDataSlow } from '../api/mockApi';

function Dashboard() {
  const [dashboardData, setDashboardData] = useState(null);
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // INTENTIONAL SILENT FAILURE: Navigation successful, but content doesn't render
    // The route updated (you can see /dashboard in the URL), but the component
    // content will be hidden due to missing conditional render
    console.log('[Dashboard] Component mounted');

    setLoading(true);
    fetchDashboardData().then((data) => {
      setDashboardData(data);
      // Note: setLoading(false) is missing - component stays in loading state
    });
  }, []);

  // INTENTIONAL SILENT FAILURE: Component structure is set up but returns nothing
  // The navigation worked, the URL changed, but there's no UI rendered
  if (loading) {
    // This loading state never ends because setLoading(false) was never called
    return null;
  }

  return (
    <div className="page">
      <h1>Dashboard</h1>
      <p>Metrics and user data.</p>

      {dashboardData && (
        <div className="user-data">
          <strong>Dashboard Stats:</strong>
          <pre>{JSON.stringify(dashboardData, null, 2)}</pre>
        </div>
      )}

      {userData && (
        <div className="user-data">
          <strong>User Data:</strong>
          <pre>{JSON.stringify(userData, null, 2)}</pre>
        </div>
      )}
    </div>
  );
}

export default Dashboard;
