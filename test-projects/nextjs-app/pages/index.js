import Link from 'next/link';
import { useRouter } from 'next/router';

export default function Home() {
  const router = useRouter();
  
  return (
    <div>
      <h1>Welcome</h1>
      <Link href="/about">About Page</Link>
      <Link href="/products">Products</Link>
      <button onClick={() => router.push('/contact')}>Contact Us</button>
      <button onClick={() => fetch('https://api.example.com/data')}>Load Data</button>
    </div>
  );
}
