import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { fetchUserDataFast, fetchUserDataSlow } from '../api/mockApi';

function Profile() {
  const { isLoggedIn, user, login, logout } = useAuth();
  const [userData, setUserData] = useState(null);
  const [raceData, setRaceData] = useState(null);

  // INTENTIONAL SILENT FAILURE: Async race condition
  // Two requests fire - the slower one completes after the faster one
  // The state gets overwritten with outdated data
  useEffect(() => {
    const loadUserData = async () => {
      // Fire both requests simultaneously
      const slowPromise = fetchUserDataSlow();
      const fastPromise = fetchUserDataFast();

      // The bug: whichever one completes last overwrites the state
      // Even though fast completes first, slow will overwrite it later
      fastPromise.then((data) => {
        setRaceData(data);
      });

      slowPromise.then((data) => {
        // INTENTIONAL SILENT FAILURE: This overwrites the fast data
        // User sees "Current User Data" briefly, then it changes to "Outdated User Data"
        // No error, no explanation, just silent replacement
        setRaceData(data);
      });
    };

    loadUserData();
  }, []);

  const handleLogin = async () => {
    await login();
  };

  const handleLogout = () => {
    logout();
  };

  return (
    <div className="page">
      <h1>Profile</h1>

      <h2>Authentication Status</h2>
      <p>
        Currently:
        <strong
          style={{
            marginLeft: '0.5rem',
            color: isLoggedIn ? '#27ae60' : '#e74c3c',
          }}
        >
          {isLoggedIn ? 'Logged In' : 'Logged Out'}
        </strong>
      </p>

      {/* INTENTIONAL SILENT FAILURE: Conditional UI Bug
           After clicking login, isLoggedIn becomes true,
           but the login button does NOT disappear.
           
           The button SHOULD disappear when isLoggedIn is true,
           but due to stale UI, it remains visible and clickable.
           This is a classic React bug where state updates don't trigger re-renders properly.
      */}
      {!isLoggedIn && (
        <button type="button" onClick={handleLogin}>
          Login
        </button>
      )}

      {isLoggedIn && (
        <>
          <button type="button" onClick={handleLogout} className="danger">
            Logout
          </button>

          {user && (
            <div className="user-data" style={{ marginTop: '1.5rem' }}>
              <strong>User Information:</strong>
              <pre>{JSON.stringify(user, null, 2)}</pre>
            </div>
          )}
        </>
      )}

      <div className="comment" style={{ marginTop: '1.5rem' }}>
        INTENTIONAL SILENT FAILURE: Try clicking the "Login" button. The button might not
        disappear even though the state has changed. This simulates a stale UI bug where the
        component's conditional rendering doesn't update properly.
      </div>

      <h2>User Data (Race Condition Test)</h2>
      <p>
        This section loads user data with an intentional race condition. Fast request finishes
        first, but slow request overwrites the data.
      </p>

      {raceData && (
        <div className="user-data">
          <strong>Data from Race Condition:</strong>
          <pre>{JSON.stringify(raceData, null, 2)}</pre>
          <p style={{ marginTop: '1rem', color: '#7d6608' }}>
            <strong>Note:</strong> Watch the "source" field. It should be "FAST_REQUEST" but
            after 3 seconds it changes to "SLOW_REQUEST". The slower request overwrites the
            faster one silently.
          </p>
        </div>
      )}

      <div className="comment" style={{ marginTop: '1.5rem' }}>
        INTENTIONAL SILENT FAILURE: Two API requests fire simultaneously. The fast one (500ms)
        completes first, but the slow one (3000ms) overwrites it later. No error, no loading
        indicator, just silent data replacement.
      </div>
    </div>
  );
}

export default Profile;
