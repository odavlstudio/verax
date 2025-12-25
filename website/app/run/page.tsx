"use client";
import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import GlowBackdrop from "../../components/GlowBackdrop";

export default function RunPage() {
  const router = useRouter();
  const [targetUrl, setTargetUrl] = useState("");
  const [error, setError] = useState<string | null>(null);

  function isValidHttpUrl(value: string) {
    try {
      const u = new URL(value);
      return u.protocol === "http:" || u.protocol === "https:";
    } catch {
      return false;
    }
  }

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!isValidHttpUrl(targetUrl)) {
      setError("Enter a valid http(s) URL.");
      return;
    }
    setError(null);
    const q = encodeURIComponent(targetUrl);
    router.push(`/report/sample?url=${q}`);
  };

  return (
    <main className="container" style={{ position: "relative" }}>
      <GlowBackdrop className="glow" />
      <section className="hero" aria-labelledby="run-head">
        <h1 id="run-head">Run a reality check</h1>
        <p>Enter a live website URL to see what Guardian checks for.</p>
        <form onSubmit={onSubmit} className="form-stack" noValidate>
          <label htmlFor="site-url" className="sr-only">Website URL</label>
          <input
            id="site-url"
            name="url"
            type="url"
            required
            inputMode="url"
            placeholder="https://example.com"
            value={targetUrl}
            onChange={(e) => setTargetUrl(e.target.value)}
            className="input"
            aria-invalid={error ? "true" : "false"}
            aria-describedby={error ? "url-error" : undefined}
          />
          {error ? (
            <p id="url-error" className="error-text" role="alert">
              {error}
            </p>
          ) : null}
          <button type="submit" className="btn btn-primary">
            Run check
          </button>
        </form>
      </section>
    </main>
  );
}
