import React, { useState } from 'react';

function UserProfile() {
  const [name, setName] = useState('John Doe');
  const [email, setEmail] = useState('john@example.com');
  const [saving, setSaving] = useState(false);

  // INTENTIONAL SILENT FAILURE #1: Save button network failure
  // Button promises network request but fails silently
  const handleSave = async () => {
    setSaving(true);
    
    // Promise: Should make POST request to /api/user/save
    // Reality: Request fails silently, no error, no feedback
    try {
      const response = await fetch('/api/user/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email })
      });
      
      // Intentionally ignore response and errors
      // No success message, no error handling, no navigation
      // Silent failure
    } catch (error) {
      // Intentionally swallow error - silent failure
    } finally {
      setSaving(false);
    }
  };

  // FALSE POSITIVE TRAP: Analytics event (should NOT be reported)
  // This is intentionally a no-op for tracking
  const trackAnalytics = () => {
    // Intentionally does nothing - not a user-facing promise
    // Should not be reported as a failure
    fetch('/api/analytics', { method: 'POST', body: JSON.stringify({ event: 'view' }) })
      .catch(() => {
        // Intentionally ignore - this is expected behavior
      });
  };

  React.useEffect(() => {
    trackAnalytics();
  }, []);

  return (
    <div>
      <h1>User Profile</h1>
      <div style={{ marginBottom: '1rem' }}>
        <label style={{ display: 'block', marginBottom: '0.5rem' }}>
          Name:
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            style={{ marginLeft: '0.5rem', padding: '0.5rem' }}
          />
        </label>
      </div>
      <div style={{ marginBottom: '1rem' }}>
        <label style={{ display: 'block', marginBottom: '0.5rem' }}>
          Email:
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={{ marginLeft: '0.5rem', padding: '0.5rem' }}
          />
        </label>
      </div>
      <button
        onClick={handleSave}
        disabled={saving}
        style={{
          padding: '0.75rem 1.5rem',
          background: saving ? '#ccc' : '#007bff',
          color: 'white',
          border: 'none',
          borderRadius: '4px',
          cursor: saving ? 'not-allowed' : 'pointer'
        }}
      >
        {saving ? 'Saving...' : 'Save Changes'}
      </button>
      {/* INTENTIONAL: No success/error message after save */}
    </div>
  );
}

export default UserProfile;

