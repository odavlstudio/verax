import Link from 'next/link';

export default function Home() {
  return (
    <div>
      <h1>Next.js Home - BROKEN</h1>
      <Link href="/broken-route" id="broken-next-link">Go to Broken Route (BROKEN - route missing)</Link>
      <button onClick={() => fetch('/api/missing-endpoint')} id="broken-next-button">
        Fetch (BROKEN - endpoint missing)
      </button>
    </div>
  );
}






