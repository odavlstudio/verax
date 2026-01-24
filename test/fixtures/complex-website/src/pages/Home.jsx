import React from 'react';
import { Link } from 'react-router-dom';

function Home() {
  return (
    <div className="page">
      <h1>Welcome to Complex Website</h1>
      <p>
        This website is intentionally designed with silent failures to stress-test VERAX.
      </p>

      <h2>Pages & Intentional Bugs</h2>

      <div style={{ marginTop: '2rem' }}>
        <div className="list-item">
          <h3>📊 Dashboard</h3>
          <p style={{ marginTop: '0.5rem', marginBottom: '1rem' }}>
            <strong>Bug:</strong> Navigation Silent Failure - URL updates but content doesn't render
          </p>
          <Link to="/dashboard">
            <button>Go to Dashboard</button>
          </Link>
        </div>

        <div className="list-item">
          <h3>⚙️ Settings</h3>
          <p style={{ marginTop: '0.5rem', marginBottom: '1rem' }}>
            <strong>Bugs:</strong> Form Silent Failure (no success feedback) + Feature Flag Bug
            (disabled feature still shows)
          </p>
          <Link to="/settings">
            <button>Go to Settings</button>
          </Link>
        </div>

        <div className="list-item">
          <h3>👤 Profile</h3>
          <p style={{ marginTop: '0.5rem', marginBottom: '1rem' }}>
            <strong>Bug:</strong> Conditional UI Bug - Stale UI button doesn't disappear after login
          </p>
          <Link to="/profile">
            <button>Go to Profile</button>
          </Link>
        </div>
      </div>

      <div className="info" style={{ marginTop: '2rem' }}>
        <strong>Technical Stack:</strong> React + Vite + React Router + useContext
      </div>

      <div className="warning" style={{ marginTop: '1rem' }}>
        <strong>Note:</strong> All bugs are intentional and clearly marked in the source code with
        "INTENTIONAL SILENT FAILURE" comments. Open DevTools console - you won't see any errors.
      </div>
    </div>
  );
}

export default Home;
