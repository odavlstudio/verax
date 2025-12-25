import GlowBackdrop from "../components/GlowBackdrop";
import Link from "next/link";

export default function Page() {
  return (
    <main className="container">
      {/* Ambient glow behind hero */}
      <GlowBackdrop className="glow" />

      <section className="hero">
        <h1>Reality-based website checks before you ship.</h1>
        <p>
          Catch broken pages, missing SEO, and trust killers before launch.
        </p>
        <div className="cta-row" role="navigation" aria-label="Primary actions">
          <Link href="/run" className="btn btn-primary" aria-label="Run Reality Check">Run Reality Check</Link>
          <a href="#" className="btn btn-secondary" aria-label="View sample report">View sample report</a>
        </div>
      </section>

      <section className="trust-strip" aria-label="Trusted by">
        <p className="trust-head">
          Used by founders before launch — not after incidents.
        </p>
        <div className="trust-logos" role="list">
          <div className="trust-pill" role="listitem">Founder-led SaaS</div>
          <div className="trust-pill" role="listitem">Indie teams</div>
          <div className="trust-pill" role="listitem">Early-stage products</div>
          <div className="trust-pill" role="listitem">Product marketers</div>
          <div className="trust-pill" role="listitem">Design-forward apps</div>
        </div>
      </section>

      <section className="section-shell" aria-labelledby="value-head">
        <p className="section-label">What Guardian catches</p>
        <h2 className="section-title" id="value-head">Issues that quietly break launches</h2>
        <div className="card-grid">
          <article className="value-card">
            <h3>Broken pages & dead links</h3>
            <p>Pages that fail, redirect incorrectly, or silently break.</p>
          </article>
          <article className="value-card">
            <h3>Missing SEO fundamentals</h3>
            <p>Titles, meta tags, and indexing gaps that hurt discoverability.</p>
          </article>
          <article className="value-card">
            <h3>Trust & credibility gaps</h3>
            <p>Missing policies, broken CTAs, and weak trust signals.</p>
          </article>
          <article className="value-card">
            <h3>Performance & UX red flags</h3>
            <p>Slow loads, layout shifts, and obvious friction points.</p>
          </article>
        </div>
      </section>

      <section className="section-shell" aria-labelledby="how-head">
        <p className="section-label">How it works</p>
        <h2 className="section-title" id="how-head">From URL to clear answers in minutes</h2>
        <div className="steps-grid">
          <article className="step-card">
            <span className="step-num">01</span>
            <h3>Enter a live URL</h3>
            <p>Point Guardian at your real website — no setup required.</p>
          </article>
          <article className="step-card">
            <span className="step-num">02</span>
            <h3>Run a reality check</h3>
            <p>Guardian scans pages, signals, and launch-critical risks.</p>
          </article>
          <article className="step-card">
            <span className="step-num">03</span>
            <h3>Review a clear report</h3>
            <p>Get prioritized issues you can fix before shipping.</p>
          </article>
        </div>
      </section>

      <section className="section-shell" aria-labelledby="sample-head">
        <p className="section-label">Sample output</p>
        <h2 className="section-title" id="sample-head">See what Guardian finds</h2>
        <div className="report-card" role="region" aria-label="Sample scan result">
          <div className="report-line">
            <span>Scan result for:</span>
            <strong>example.com</strong>
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
      </section>

      <section className="section-shell" aria-labelledby="pricing-head">
        <p className="section-label">Pricing</p>
        <h2 className="section-title" id="pricing-head">Simple pricing for real launches</h2>
        <div className="pricing-grid">
          <article className="price-card">
            <h3 className="price-title">Free</h3>
            <p className="price-desc">For quick reality checks</p>
            <p className="price-meta">$0 · Launch-safe basics</p>
            <ul className="price-list">
              <li>Scan public pages</li>
              <li>Basic issue detection</li>
              <li>CLI usage</li>
              <li>Community support</li>
            </ul>
            <Link href="/run" className="btn btn-primary price-cta" aria-label="Get started free">Get started free</Link>
          </article>

          <article className="price-card pro">
            <h3 className="price-title">Pro</h3>
            <p className="price-desc">For serious launches</p>
            <p className="price-meta">Early access</p>
            <ul className="price-list">
              <li>Deeper checks & signals</li>
              <li>Prioritized findings</li>
              <li>Exportable reports</li>
              <li>Early access to new checks</li>
            </ul>
            <button className="btn btn-primary price-cta" aria-label="Upgrade to Pro">Upgrade to Pro</button>
          </article>
        </div>
      </section>

      <section className="final-cta" aria-label="Final call to action">
        {/* Subtle ambient glow behind close section */}
        <GlowBackdrop className="final-glow" />
        <h2>Ready to run a reality check?</h2>
        <p>Catch launch-critical issues before users do.</p>
        <Link href="/run" className="btn btn-primary" aria-label="Run Reality Check">Run Reality Check</Link>
      </section>

      <footer className="footer" aria-label="Footer">
        <div className="container footer-inner">
          <div className="footer-left">© ODAVL Guardian</div>
          <nav className="footer-right" aria-label="Footer links">
            <a href="#" aria-label="Docs">Docs</a>
            <a href="#" aria-label="GitHub">GitHub</a>
            <a href="#" aria-label="Privacy">Privacy</a>
            <a href="#" aria-label="Terms">Terms</a>
          </nav>
        </div>
      </footer>
    </main>
  );
}
