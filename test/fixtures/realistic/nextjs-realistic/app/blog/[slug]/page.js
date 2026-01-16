'use client';

import { useParams } from 'next/navigation';
import { useState } from 'react';

export default function BlogPostPage() {
  const params = useParams();
  const slug = params.slug;
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // INTENTIONAL SILENT FAILURE #2: Comment submission
  // Form promises POST request but fails silently
  const handleSubmitComment = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    
    // Promise: Should make POST request to /api/comments
    // Reality: Request fails silently, no error, no feedback
    try {
      const response = await fetch('/api/comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug, comment })
      });
      
      // Intentionally ignore response and errors
      // No success message, no error handling
      // Silent failure
      setComment(''); // Clear form but no feedback
    } catch (error) {
      // Intentionally swallow error - silent failure
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', padding: '20px' }}>
      <h1>Blog Post: {slug}</h1>
      <p>This is a blog post about {slug}.</p>
      
      <div style={{ marginTop: '3rem', paddingTop: '2rem', borderTop: '1px solid #ddd' }}>
        <h2>Leave a Comment</h2>
        <form onSubmit={handleSubmitComment}>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Your comment..."
            required
            style={{
              width: '100%',
              minHeight: '120px',
              padding: '0.75rem',
              border: '1px solid #ddd',
              borderRadius: '4px',
              fontFamily: 'inherit',
              marginBottom: '1rem'
            }}
          />
          <button
            type="submit"
            disabled={submitting}
            style={{
              padding: '0.75rem 1.5rem',
              background: submitting ? '#ccc' : '#007bff',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: submitting ? 'not-allowed' : 'pointer'
            }}
          >
            {submitting ? 'Submitting...' : 'Submit Comment'}
          </button>
        </form>
        
        {/* INTENTIONAL: No success/error message after submission */}
      </div>
    </div>
  );
}

