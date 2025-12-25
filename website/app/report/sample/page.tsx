import Link from "next/link";
import GlowBackdrop from "../../../components/GlowBackdrop";

function isValidHttpUrl(value: string) {
  try {
    const u = new URL(value);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

export default function SampleReportPage({
  searchParams,
}: {
  searchParams: { [key: string]: string | string[] | undefined };
}) {
  const rawParam = searchParams?.url;
  const raw = Array.isArray(rawParam) ? rawParam[0] : rawParam || null;
  let decoded: string | null = null;
  if (raw) {
    try {
      decoded = decodeURIComponent(raw);
    } catch {
      decoded = null;
    }
  }

  const valid = decoded ? isValidHttpUrl(decoded) : false;

  return (
    <main className="container" style={{ position: "relative" }}>
      <GlowBackdrop className="glow" />

      <section className="section-shell" aria-labelledby="report-head">
        <h1 className="section-title" id="report-head">Reality check report</h1>
        <p className="trust-head">This is a demo scan to show what Guardian reports look like.</p>

        {!valid ? (
          <>
            <div className="report-card" role="region" aria-label="No URL provided">
              <div className="report-line">
                <strong>No URL provided.</strong>
              </div>
              <hr className="report-divider" />
              <Link href="/run" className="btn btn-primary" aria-label="Go to run">
                Go to /run
              </Link>
            </div>
            <div style={{ marginTop: "0.75rem" }}>
              <Link
                href="/run"
                aria-label="Back to run"
                style={{
                  fontSize: "0.9rem",
                  color: "var(--muted)",
                  opacity: 0.9,
                  textDecoration: "none",
                }}
              >
                ← Back to run another check
              </Link>
            </div>
          </>
        ) : (
          <>
            <div className="report-card" role="region" aria-label="Sample scan result">
              <div className="report-line">
                <span>Scan result for:</span>
                <strong>{decoded}</strong>
              </div>
              <div className="report-line">
                <span>Status:</span>
                <strong className="report-status">Issues found</strong>
              </div>
              <hr className="report-divider" />
              <ul className="report-list">
                <li>Missing meta descriptions on 6 pages</li>
                <li>Broken CTA link on /pricing</li>
                <li>Privacy policy not discoverable</li>
                <li>Large layout shift on homepage (CLS)</li>
              </ul>
            </div>
            <div style={{ marginTop: "0.75rem" }}>
              <Link
                href="/run"
                aria-label="Back to run"
                style={{
                  fontSize: "0.9rem",
                  color: "var(--muted)",
                  opacity: 0.9,
                  textDecoration: "none",
                }}
              >
                ← Back to run another check
              </Link>
            </div>
          </>
        )}
      </section>
    </main>
  );
}
