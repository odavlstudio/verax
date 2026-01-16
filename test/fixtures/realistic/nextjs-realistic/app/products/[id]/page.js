'use client';

import { useParams } from 'next/navigation';
import { useState } from 'react';

export default function ProductDetailPage() {
  const params = useParams();
  const productId = params.id;
  const [purchasing, setPurchasing] = useState(false);

  // INTENTIONAL SILENT FAILURE #1: Product purchase button
  // Button promises network request but fails silently
  const handlePurchase = async () => {
    setPurchasing(true);
    
    // Promise: Should make POST request to /api/purchase
    // Reality: Request fails silently, no error, no feedback
    try {
      const response = await fetch('/api/purchase', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId })
      });
      
      // Intentionally ignore response and errors
      // No success message, no error handling, no navigation
      // Silent failure
    } catch (error) {
      // Intentionally swallow error - silent failure
    } finally {
      setPurchasing(false);
    }
  };

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', padding: '20px' }}>
      <h1>Product {productId}</h1>
      <p>This is a detailed view of product {productId}.</p>
      <p>Price: $199</p>
      
      <button
        onClick={handlePurchase}
        disabled={purchasing}
        style={{
          padding: '0.75rem 1.5rem',
          background: purchasing ? '#ccc' : '#28a745',
          color: 'white',
          border: 'none',
          borderRadius: '4px',
          cursor: purchasing ? 'not-allowed' : 'pointer',
          marginTop: '1rem'
        }}
      >
        {purchasing ? 'Processing...' : 'Purchase Now'}
      </button>
      
      {/* INTENTIONAL: No success/error message after purchase */}
    </div>
  );
}

