'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

export default function ProductsPage() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  // INTENTIONAL SILENT FAILURE #5: Missing loading state
  // Product list promises loading indicator but none appears
  useEffect(() => {
    // Promise: Should show loading indicator during fetch
    // Reality: Loading state is set but UI doesn't show it
    setLoading(true);
    
    // Simulate data fetch
    setTimeout(() => {
      setProducts([
        { id: 1, name: 'Product A', price: 99 },
        { id: 2, name: 'Product B', price: 149 },
        { id: 3, name: 'Product C', price: 199 },
      ]);
      setLoading(false);
    }, 1000);
  }, []);

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '20px' }}>
      <h1>Products</h1>
      
      {/* INTENTIONAL: Loading state exists but UI doesn't show it (silent failure) */}
      {loading && (
        <div style={{ 
          padding: '1rem',
          background: '#fff3cd',
          border: '1px solid #ffc107',
          borderRadius: '4px',
          marginBottom: '1rem',
          display: 'none' // INTENTIONAL: Loading indicator is hidden (silent failure)
        }}>
          Loading products...
        </div>
      )}
      
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '2rem' }}>
        {products.map(product => (
          <div key={product.id} style={{
            border: '1px solid #ddd',
            borderRadius: '8px',
            padding: '1.5rem'
          }}>
            <h3>{product.name}</h3>
            <p>${product.price}</p>
            <Link href={`/products/${product.id}`} style={{
              display: 'inline-block',
              padding: '0.75rem 1.5rem',
              background: '#007bff',
              color: 'white',
              textDecoration: 'none',
              borderRadius: '4px',
              marginTop: '1rem'
            }}>
              View Details
            </Link>
          </div>
        ))}
      </div>
    </div>
  );
}

