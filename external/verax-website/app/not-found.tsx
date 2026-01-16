export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-base-black px-4">
      <div className="text-center">
        <h1 className="text-6xl font-bold text-signal-orange mb-4">404</h1>
        <h2 className="text-2xl font-semibold text-text-primary mb-4">Page Not Found</h2>
        <p className="text-text-muted mb-8">The page you're looking for doesn't exist.</p>
        <a
          href="/"
          className="inline-block px-6 py-3 rounded-lg bg-signal-orange text-base-black text-sm font-semibold hover:bg-signal-orange-deep transition-all duration-300"
        >
          Back to Home
        </a>
      </div>
    </div>
  );
}
