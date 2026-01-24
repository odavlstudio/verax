'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';

/**
 * Pricing page with router navigation
 * Tests extraction of useRouter().push() calls
 */
export default function Pricing() {
  const router = useRouter();
  
  const handleNavigate = () => {
    router.push('/checkout');
  };
  
  return (
    <div>
      <h1>Pricing Page</h1>
      <button onClick={handleNavigate}>Go to Checkout</button>
      <Link href="/">Back to Home</Link>
    </div>
  );
}


