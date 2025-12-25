"use client";

import Link from "next/link";
import dynamic from "next/dynamic";

// Content rewritten for clarity and accuracy per Phase 7.1

const ProgressBar = dynamic(() => import("../components/ProgressBar"), { ssr: false });

export default function Page() {
  return (
    <div className="page">
      <ProgressBar />

      <header className="nav-bar shell">
        <div className="brand">
          <span className="marker" aria-hidden="true" />
          <span>ODAVL Guardian</span>
        </div>
        <nav className="nav-links" aria-label="Main navigation">
          <a href="#what" className="nav-link">What</a>
          <a href="#why" className="nav-link">Why</a>
          <a href="#when" className="nav-link">When</a>
          <a href="#how" className="nav-link">How</a>
          <a href="https://github.com/odavlstudio/odavlguardian/blob/main/README.md" className="nav-link" target="_blank" rel="noopener noreferrer">Docs</a>
        </nav>
        <div className="nav-actions">
          <a 
            href="https://github.com/odavlstudio/odavlguardian" 
            className="nav-link"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="View ODAVL Guardian on GitHub"
          >
            GitHub
          </a>
        </div>
      </header>

      <main className="shell">
        <section className="hero">
          <div className="hero-grid">
            <div>
              <h1>Market reality testing for websites — before users do.</h1>
              <p>Guardian runs real browser checks locally or in CI to verify critical user journeys before real people experience them.</p>
            </div>
          </div>
        </section>
        <section className="section" id="what">
          <div>
            <h2>WHAT</h2>
            <p>ODAVL Guardian is a developer tool that runs your website through real browser flows and produces human‑readable reports.</p>
            <ul className="list" role="list" style={{ marginTop: 12 }}>
              <li className="list-item"><span className="dot" aria-hidden="true" /><span>CLI + VS Code Extension</span></li>
              <li className="list-item"><span className="dot" aria-hidden="true" /><span>Executes realistic user journeys in a browser</span></li>
              <li className="list-item"><span className="dot" aria-hidden="true" /><span>Outputs clear, human‑readable findings</span></li>
            </ul>
          </div>
        </section>

        <section className="section" id="why">
          <div>
            <h2>WHY</h2>
            <p>Websites often pass automated tests yet fail in reality—links don’t open, forms misbehave, flows break, or UX changes introduce regressions. Guardian runs market‑like checks to catch these failures before users or customers do.</p>
          </div>
        </section>

        <section className="section" id="when">
          <div>
            <h2>WHEN</h2>
            <ul className="list" role="list" style={{ marginTop: 12 }}>
              <li className="list-item"><span className="dot" aria-hidden="true" /><span>Before deployment</span></li>
              <li className="list-item"><span className="dot" aria-hidden="true" /><span>Before marketing campaigns</span></li>
              <li className="list-item"><span className="dot" aria-hidden="true" /><span>After UI changes</span></li>
              <li className="list-item"><span className="dot" aria-hidden="true" /><span>In CI pipelines</span></li>
            </ul>
          </div>
        </section>

        <section className="section" id="how">
          <div>
            <h2>HOW GUARDIAN WORKS</h2>
            <p>Guardian operates in five clear steps:</p>
            
            <h3 style={{ marginTop: 24, marginBottom: 8, fontSize: 16, fontWeight: 600 }}>Step 1 — You run Guardian</h3>
            <p style={{ marginBottom: 16 }}>Execute Guardian locally via the CLI or through the VS Code Extension. You can also run it in a CI pipeline. Point it at your website and the flows you want to test.</p>
            
            <h3 style={{ marginTop: 24, marginBottom: 8, fontSize: 16, fontWeight: 600 }}>Step 2 — Guardian opens a real browser</h3>
            <p style={{ marginBottom: 16 }}>Guardian uses a real browser engine—not mocks, not synthetic APIs. It launches a Chromium instance and interacts with your actual website the way a user would.</p>
            
            <h3 style={{ marginTop: 24, marginBottom: 8, fontSize: 16, fontWeight: 600 }}>Step 3 — Real user flows are executed</h3>
            <p style={{ marginBottom: 16 }}>Guardian performs the exact steps you define: navigating to pages, filling forms, clicking buttons, submitting data, waiting for responses, and checking results. Every action is a real browser interaction.</p>
            
            <h3 style={{ marginTop: 24, marginBottom: 8, fontSize: 16, fontWeight: 600 }}>Step 4 — Guardian detects breakage</h3>
            <p style={{ marginBottom: 16 }}>Guardian observes what happens during execution and flags issues:</p>
            <ul className="list" role="list" style={{ marginTop: 8, marginBottom: 16 }}>
              <li className="list-item"><span className="dot" aria-hidden="true" /><span>Navigation failures — pages don't load or redirect incorrectly</span></li>
              <li className="list-item"><span className="dot" aria-hidden="true" /><span>Submission failures — forms fail to submit or error unexpectedly</span></li>
              <li className="list-item"><span className="dot" aria-hidden="true" /><span>Visual issues — elements don't appear or layout breaks</span></li>
              <li className="list-item"><span className="dot" aria-hidden="true" /><span>Timeouts — flows hang or take too long</span></li>
              <li className="list-item"><span className="dot" aria-hidden="true" /><span>Unexpected behavior — flows don't complete as expected</span></li>
            </ul>
            
            <h3 style={{ marginTop: 24, marginBottom: 8, fontSize: 16, fontWeight: 600 }}>Step 5 — A human-readable report is generated</h3>
            <p style={{ marginBottom: 16 }}>Guardian outputs an HTML report. No raw logs. No data dashboards. Just clear findings with screenshots, error messages, and context. The report is designed for developers and decision makers to act on immediately.</p>
            
            <h3 style={{ marginTop: 32, marginBottom: 12, fontSize: 16, fontWeight: 600, borderTop: "1px solid var(--border-color)", paddingTop: 24 }}>What Guardian does NOT do</h3>
            <p style={{ marginBottom: 16 }}>Clarity matters. Here's what Guardian is not:</p>
            <ul className="list" role="list" style={{ marginTop: 8 }}>
              <li className="list-item"><span className="dot" aria-hidden="true" /><span>It is not load testing — Guardian checks one flow at a time, not concurrent traffic patterns</span></li>
              <li className="list-item"><span className="dot" aria-hidden="true" /><span>It is not monitoring production traffic — Guardian runs when you trigger it, it doesn't watch live users</span></li>
              <li className="list-item"><span className="dot" aria-hidden="true" /><span>It is not a SaaS service — Guardian runs locally or in your CI. No cloud dependency. No accounts required</span></li>
              <li className="list-item"><span className="dot" aria-hidden="true" /><span>It does not replace unit or E2E tests — Guardian is a complement, testing the real flow end-to-end</span></li>
            </ul>
          </div>
        </section>

        <section className="section" id="cta">
          <div className="panel">
            <h2>Try it now</h2>
            <p>Run Guardian locally or in CI to validate real browser flows and read the results in plain language.</p>
            <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap", margin: "14px 0" }}>
              <a
                href="https://github.com/odavlstudio/odavlguardian"
                className="cta"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Open the ODAVL Guardian GitHub repository"
              >
                Try it now
              </a>
            </div>
          </div>
        </section>

        <section className="section" id="trust">
          <div className="panel">
            <h2>Trust</h2>
            <ul className="list" role="list" style={{ marginTop: 12 }}>
              <li className="list-item">
                <span className="dot" aria-hidden="true" />
                <span>
                  Open Source on GitHub — <a href="https://github.com/odavlstudio/odavlguardian" target="_blank" rel="noopener noreferrer" aria-label="ODAVL Guardian GitHub repository">repository</a>
                </span>
              </li>
              <li className="list-item">
                <span className="dot" aria-hidden="true" />
                <span>
                  Documentation — <a href="https://github.com/odavlstudio/odavlguardian/blob/main/README.md" target="_blank" rel="noopener noreferrer" aria-label="ODAVL Guardian README">README</a>
                </span>
              </li>
              <li className="list-item">
                <span className="dot" aria-hidden="true" />
                <span>
                  Available as a VS Code Extension — <a href="https://github.com/odavlstudio/odavlguardian/tree/main/extension" target="_blank" rel="noopener noreferrer" aria-label="ODAVL Guardian VS Code Extension folder">extension</a>
                </span>
              </li>
            </ul>
          </div>
        </section>
      </main>

      <footer className="footer shell">
        ODAVL Guardian — Market reality testing for websites
      </footer>
    </div>
  );
}
