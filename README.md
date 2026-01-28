# VERAX v0.4.5

Catch buttons and forms that do nothing.
No AI. No guessing. Just evidence.

Silent failure detection for public user flows (pre-authentication only)

The Problem

Silent user failures don’t crash your app.
They quietly make users leave.

Common examples:

A button looks clickable but does nothing

A form submits with no confirmation

A link is clicked but navigation never happens

Validation triggers, but feedback isn’t shown

Your logs are clean.
Your tests pass.
Monitoring shows nothing.

From the user’s perspective, the promise was broken.

VERAX exists to reveal these gaps — with evidence.

How VERAX Works

VERAX compares what your code promises with what users actually experience.

Learn Promises
Parse source code to extract user-visible promises:
navigation, forms, and feedback signals.

Observe Behavior
Execute real interactions in a real browser
(clicks, submits, typing).

Detect Gaps
Compare promised outcomes vs observed results.

Report Findings
Produce evidence-backed findings:
screenshots, DOM diffs, traces.

Result: You see exactly where users get stuck — with reproducible proof.

2-Minute Quick Start
Option 1: Try the built-in demo
git clone https://github.com/odavlstudio/verax.git
cd verax
npm install

npm run demo         # Terminal 1: demo at http://127.0.0.1:4000
npm run verax:demo   # Terminal 2: run VERAX against demo

Artifacts are written to:

.verax/runs/<runId>/

Option 2: Run on your own site
npm install -g @veraxhq/verax
verax run --url https://your-site.test --src /path/to/repo

Important: LIMITED mode

VERAX needs source code to extract promises.

If source code is not detected:

VERAX runs in LIMITED mode

Result is always INCOMPLETE (exit code 30)

This prevents false “green” CI signals

verax run --url https://your-site.test --src ./   # Full detection
verax run --url https://your-site.test           # LIMITED mode only

Inspect results
verax inspect .verax/runs/<runId>

Key artifacts:

verax-summary.md — Human-readable summary

summary.json — Verdict, coverage, counts

findings.json — Evidence-backed findings

evidence/ — Screenshots, DOM diffs, traces

Understanding Results
✅ SUCCESS (exit code 0)

All observable public flows were tested.
No silent failures were detected within scope.

Does NOT mean:

The app is bug-free

All edge cases are covered

Means:

No silent failures were observed

Evidence guarantees were satisfied

RESULT SUCCESS
REASON Scanned 12 interactions; 12 completed; 0 silent failures
ACTION Continue with other testing

🔍 FINDINGS (exit code 20)

One or more silent failures were confirmed with evidence.

Each finding includes:

The promised behavior (from code)

What actually happened (from browser)

Before/after screenshots

DOM and network evidence

RESULT FINDINGS
REASON 1 silent failure: “Sign up” button does nothing
ACTION Fix the issue and re-run VERAX

⚠️ INCOMPLETE (exit code 30)

The run could not be trusted.

Common reasons:

Source code not detected (LIMITED mode)

Coverage below threshold

Observation timeout

Authenticated flows (out of scope)

INCOMPLETE is not safe. Do not ignore it.

RESULT INCOMPLETE
REASON Source code not detected (limited runtime-only mode)
ACTION Provide --src <path>

🚫 USAGE_ERROR (exit code 64)

Invalid CLI usage:

Missing --url

Unknown flags

Invalid --min-coverage

🔴 INVARIANT_VIOLATION (exit code 50)

Internal error or artifact corruption
(always investigate).

Detection Scope
✅ What VERAX Detects (Guaranteed)

Navigation

Link clicks → route / URL changes

Forms

Submissions with user-visible feedback

Validation messages

Feedback signals

aria-live

role="alert" / role="status"

Stable text nodes

Attributes: disabled, aria-invalid, data-loading

Observable outcomes

DOM changes

Network activity correlated to actions

Navigation events

❌ Out of Scope (By Design)

Visual-only changes (spinners, colors, animations)
→ Use visual regression tools

Ambiguous ARIA attributes (aria-expanded, etc.)

Transient flashes < 100ms

Authenticated flows

Backend-dependent dynamic routes

CLI Reference
verax run
verax run --url <url> [options]

Options

--url <url> (required)

--src <path> — Source directory

--out <path> — Output directory (default: .verax)

--min-coverage <0.0-1.0> — Default: 0.50 first run, 0.90 after

--force-post-auth — EXPERIMENTAL (always INCOMPLETE)

--timeout <ms>

--json

--debug

verax inspect
verax inspect <runPath>

verax doctor
verax doctor [--json]

Checks Node.js, Playwright, and write permissions.

Guarantees & Limitations
Guarantees

Read-only

Deterministic

Evidence-backed

Conservative (uncertainty → INCOMPLETE)

Limitations

Pre-auth only

Public flows only

Not a test framework

Not runtime monitoring

CI/CD Usage
verax run --url https://staging.example.com --src ./
case $? in
  0)  echo "✓ No silent failures"; exit 0 ;;
  20) echo "✗ Silent failures detected"; exit 1 ;;
  30) echo "⚠️ Incomplete coverage"; exit 1 ;;
  *)  echo "✗ VERAX error"; exit 1 ;;
esac

Installation
npm install -g @veraxhq/verax

Requirements

Node.js 18+

Playwright (auto-installed)

Supported Frameworks

Full

React

Next.js

Static HTML

Partial

Vue 3

Angular

SvelteKit

License

MIT © VERAX