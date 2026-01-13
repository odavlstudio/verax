import React, { useState } from 'react';

export default function App() {
  const [loading, setLoading] = useState(false);

  const handleSave = async () => {
    setLoading(true);
    // INTENTIONAL SILENT FAILURE: Promise is made but never resolved
    // The button click triggers state change (loading=true) but the promise
    // never completes, so the UI never shows success/failure feedback
    
    // Commented out resolve to create silent failure:
    // await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Instead, we just set loading=true and never set it back to false
    console.log('Save initiated (but never completes)');
  };

  return (
    <div style={styles.container}>
      <h1>VERAX Demo: React App</h1>

      <div style={styles.section}>
        <h2>Silent Failure Example</h2>
        <p>Click the button below. It will show "Saving..." but never complete.</p>
        <button 
          onClick={handleSave}
          disabled={loading}
          style={styles.button}
        >
          {loading ? 'Saving...' : 'Save Data'}
        </button>
        <p style={styles.note}>
          <strong>Silent Failure:</strong> The click handler starts, shows loading state,
          but the async operation never completes. User sees "Saving..." forever.
        </p>
      </div>

      <div style={styles.section}>
        <h2>What VERAX Will Detect</h2>
        <ul>
          <li>✅ Button click (navigation promise)</li>
          <li>✅ Network request expectation (if API call was promised in code)</li>
          <li>❌ Silent failure: Loading state changes but never resolves</li>
        </ul>
      </div>

      <div style={styles.section}>
        <h2>How to Run VERAX</h2>
        <pre style={styles.code}>
# From demo-react/ directory:

# Install VERAX globally
npm install -g @veraxhq/verax

# Start React development server in another terminal
npm start

# In another terminal, run VERAX
verax run --url http://localhost:3000 --src . --out .verax

# Review results
cat .verax/runs/*/findings.json
        </pre>
      </div>
    </div>
  );
}

const styles = {
  container: {
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    maxWidth: '600px',
    margin: '40px auto',
    padding: '20px',
    backgroundColor: '#f5f5f5',
  },
  section: {
    backgroundColor: 'white',
    padding: '15px',
    marginBottom: '15px',
    borderRadius: '8px',
    borderLeft: '4px solid #007bff',
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
  },
  button: {
    padding: '10px 20px',
    backgroundColor: '#007bff',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '16px',
    marginBottom: '10px',
  },
  note: {
    color: '#666',
    fontSize: '14px',
    fontStyle: 'italic',
  },
  code: {
    backgroundColor: '#333',
    color: '#0f0',
    padding: '10px',
    borderRadius: '4px',
    overflow: 'auto',
    fontSize: '12px',
  },
};
