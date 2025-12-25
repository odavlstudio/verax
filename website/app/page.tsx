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
          <a href="#use-cases" className="nav-link">Use Cases</a>
          <a href="#reports" className="nav-link">Reports</a>
          <a href="#positioning" className="nav-link">Positioning</a>
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

        <section className="section" id="use-cases">
          <div>
            <h2>REAL-WORLD USE CASES</h2>
            <h3 style={{ marginTop: 16, fontSize: 16, fontWeight: 600 }}>Before Deployment</h3>
            <p style={{ marginBottom: 12 }}>Run Guardian before a release to catch breakage before code goes live. It verifies critical flows in a real browser so issues are found before users encounter them.</p>
            <h3 style={{ marginTop: 16, fontSize: 16, fontWeight: 600 }}>Before Marketing or Traffic Spikes</h3>
            <p style={{ marginBottom: 12 }}>Validate real user paths before sending campaign traffic. Guardian exercises the site like a user and flags breakage so you avoid directing people into broken flows.</p>
            <h3 style={{ marginTop: 16, fontSize: 16, fontWeight: 600 }}>After UI or Frontend Changes</h3>
            <p style={{ marginBottom: 12 }}>Use Guardian after UI updates to detect navigation or submission regressions. It confirms that visual changes did not break interactive behavior in key journeys.</p>
            <h3 style={{ marginTop: 16, fontSize: 16, fontWeight: 600 }}>In CI Pipelines</h3>
            <p style={{ marginBottom: 12 }}>Run Guardian as a final reality check after tests pass but before merge or deploy. It executes flows in CI and fails the job when critical behavior does not meet expectations.</p>
          </div>
        </section>

        <section className="section" id="reports">
          <div>
            <h2>OUTPUTS & REPORTS</h2>
            <h3 style={{ marginTop: 16, fontSize: 16, fontWeight: 600 }}>What Guardian Produces</h3>
            <ul className="list" role="list" style={{ marginTop: 8, marginBottom: 12 }}>
              <li className="list-item"><span className="dot" aria-hidden="true" /><span>HTML report — a human-readable summary designed for decisions</span></li>
              <li className="list-item"><span className="dot" aria-hidden="true" /><span>Contextual errors — messages and states explaining what failed</span></li>
              <li className="list-item"><span className="dot" aria-hidden="true" /><span>Screenshots — visual evidence captured during flows</span></li>
              <li className="list-item"><span className="dot" aria-hidden="true" /><span>Execution details — steps taken, timings, and outcomes</span></li>
            </ul>
            <h3 style={{ marginTop: 16, fontSize: 16, fontWeight: 600 }}>What the Report Is For</h3>
            <ul className="list" role="list" style={{ marginTop: 8, marginBottom: 12 }}>
              <li className="list-item"><span className="dot" aria-hidden="true" /><span>Understanding what broke — clear identification of failed steps</span></li>
              <li className="list-item"><span className="dot" aria-hidden="true" /><span>Understanding where and why — page context and error detail</span></li>
              <li className="list-item"><span className="dot" aria-hidden="true" /><span>Supporting release decisions — evidence to proceed or fix first</span></li>
            </ul>
            <h3 style={{ marginTop: 16, fontSize: 16, fontWeight: 600 }}>How Developers Use It</h3>
            <ul className="list" role="list" style={{ marginTop: 8 }}>
              <li className="list-item"><span className="dot" aria-hidden="true" /><span>Review before deploy — confirm flows work in reality</span></li>
              <li className="list-item"><span className="dot" aria-hidden="true" /><span>Share with teammates — align on what failed and why</span></li>
              <li className="list-item"><span className="dot" aria-hidden="true" /><span>Attach to CI results — include the report in your pipeline output</span></li>
            </ul>
          </div>
        </section>

        <section className="section" id="positioning">
          <div>
            <h2>WHERE GUARDIAN FITS</h2>
            <h3 style={{ marginTop: 16, fontSize: 16, fontWeight: 600 }}>Guardian is NOT</h3>
            <ul className="list" role="list" style={{ marginTop: 8, marginBottom: 12 }}>
              <li className="list-item"><span className="dot" aria-hidden="true" /><span>A replacement for unit tests</span></li>
              <li className="list-item"><span className="dot" aria-hidden="true" /><span>A replacement for E2E test suites</span></li>
              <li className="list-item"><span className="dot" aria-hidden="true" /><span>A production monitoring system</span></li>
              <li className="list-item"><span className="dot" aria-hidden="true" /><span>A load or performance testing tool</span></li>
            </ul>
            <h3 style={{ marginTop: 16, fontSize: 16, fontWeight: 600 }}>Guardian complements</h3>
            <ul className="list" role="list" style={{ marginTop: 8, marginBottom: 12 }}>
              <li className="list-item"><span className="dot" aria-hidden="true" /><span>Unit tests — logic correctness at the function and component level</span></li>
              <li className="list-item"><span className="dot" aria-hidden="true" /><span>E2E tests — verify expected flows under test definitions</span></li>
              <li className="list-item"><span className="dot" aria-hidden="true" /><span>CI pipelines — a final reality check prior to merge or release</span></li>
            </ul>
            <h3 style={{ marginTop: 16, fontSize: 16, fontWeight: 600 }}>Guardian’s Unique Role</h3>
            <ul className="list" role="list" style={{ marginTop: 8 }}>
              <li className="list-item"><span className="dot" aria-hidden="true" /><span>Verifies what users will experience in a real browser</span></li>
              <li className="list-item"><span className="dot" aria-hidden="true" /><span>Catches breakage that tests can miss in practice</span></li>
              <li className="list-item"><span className="dot" aria-hidden="true" /><span>Provides evidence for release decisions through human-readable reports</span></li>
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
