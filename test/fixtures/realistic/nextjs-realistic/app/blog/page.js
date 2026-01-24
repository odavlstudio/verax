'use client';

import Link from 'next/link';

export default function BlogPage() {
  const posts = [
    { slug: 'getting-started', title: 'Getting Started' },
    { slug: 'advanced-topics', title: 'Advanced Topics' },
    { slug: 'best-practices', title: 'Best Practices' },
  ];

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '20px' }}>
      <h1>Blog</h1>
      <p>Read our latest articles.</p>
      
      <div style={{ display: 'grid', gap: '2rem', marginTop: '2rem' }}>
        {posts.map(post => (
          <div key={post.slug} style={{
            border: '1px solid #ddd',
            borderRadius: '8px',
            padding: '1.5rem'
          }}>
            <h2>{post.title}</h2>
            <Link href={`/blog/${post.slug}`} style={{
              display: 'inline-block',
              marginTop: '1rem',
              color: '#007bff',
              textDecoration: 'none'
            }}>
              Read More →
            </Link>
          </div>
        ))}
      </div>
    </div>
  );
}



