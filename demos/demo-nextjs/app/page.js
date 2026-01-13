'use client';

import { useState } from 'react';

export default function Home() {
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    
    // INTENTIONAL SILENT FAILURE:
    // Form submission starts but never completes
    // The fetch is initiated but response is never handled
    // User sees "Submitting..." forever with no success/error
    console.log('Form submission initiated (but never completes)');
    
    try {
      const response = await fetch('/api/submit', {
        method: 'POST',
        body: JSON.stringify({ message: 'User data' }),
        headers: { 'Content-Type': 'application/json' }
      });
      
      // CRITICAL BUG: Response is never processed
      // The .json() is never called, so the handler never knows if submit succeeded
      // Loading spinner stays on forever
      // User gets no feedback at all
      
    } catch (error) {
      // Error handling intentionally incomplete
    }
  };

  return (
    <div style={{ fontFamily: 'system-ui', maxWidth: '600px', margin: '50px auto' }}>
      <h1>VERAX Demo: Next.js</h1>
      
      <p style={{ color: '#666' }}>
        This demo contains an <strong>intentional silent failure</strong> to demonstrate VERAX's detection capability.
      </p>

      <h2>The Bug</h2>
      <p>
        The form below sends data to the server but never processes the response. 
        The loading state is triggered but never reset, leaving the user hanging forever.
      </p>

      <form onSubmit={handleSubmit} style={{ marginTop: '30px' }}>
        <div style={{ marginBottom: '20px' }}>
          <label htmlFor="email" style={{ display: 'block', marginBottom: '5px' }}>
            Email Address:
          </label>
          <input
            id="email"
            type="email"
            placeholder="user@example.com"
            required
            style={{
              width: '100%',
              padding: '8px',
              fontSize: '14px',
              boxSizing: 'border-box'
            }}
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          style={{
            padding: '10px 20px',
            fontSize: '16px',
            backgroundColor: loading ? '#ccc' : '#0066cc',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: loading ? 'not-allowed' : 'pointer'
          }}
        >
          {loading ? '⏳ Submitting...' : 'Submit Form'}
        </button>
      </form>

      {submitted && (
        <div style={{ marginTop: '20px', padding: '10px', backgroundColor: '#e8f5e9', borderRadius: '4px' }}>
          ✓ Form submitted successfully
        </div>
      )}

      <hr style={{ margin: '40px 0' }} />

      <h2>How to Test with VERAX</h2>
      <ol>
        <li>Start the development server: <code>npm run dev</code></li>
        <li>In repo root, run: <code>verax run --url http://localhost:3000 --src ./demos/demo-nextjs --out ./demos/demo-nextjs/.verax</code></li>
        <li>VERAX will detect the form submission that never completes</li>
      </ol>

      <h2>What VERAX Finds</h2>
      <ul>
        <li><strong>Silent Failure</strong>: Form submission starts but response is never handled</li>
        <li><strong>No Error Handling</strong>: User receives no success or failure feedback</li>
        <li><strong>Broken Promise</strong>: async operation never resolves</li>
      </ul>
    </div>
  );
}
