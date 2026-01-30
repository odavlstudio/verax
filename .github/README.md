# VERAX

A deterministic CLI for detecting silent user failures in public web flows.

Catch buttons and forms that do nothing. No AI. No guessing. Just evidence.

Silent failure detection for public user flows (pre-authentication only).

## The Problem

Silent user failures don't crash your app — they quietly make users leave.

Common examples:
- A button looks clickable but does nothing
- A form submits with no confirmation
- A link is clicked but navigation never happens
- Validation triggers, but feedback isn't shown

Your logs are clean. Your tests pass. Monitoring shows nothing. From the user's perspective, the promise was broken.

VERAX reveals these gaps with reproducible evidence.

## How It Works

VERAX compares what your code *promises* with what users actually *experience*.

1. **Learn Promises** — Parse source code to extract user-visible promises (navigation, forms, feedback signals)
2. **Observe Behavior** — Execute real interactions in a real browser (clicks, submits, typing)
3. **Detect Gaps** — Compare promised outcomes vs observed results
4. **Report Findings** — Produce evidence: screenshots, DOM diffs, network traces

Result: You see exactly where users get stuck, with reproducible proof.

## Quick Start

### Prerequisites

- Node.js 18+
- Playwright (auto-installed)
- Your application running and accessible at a URL
- Repository root directory with source code

### Option 1: Try the Built-In Demo

```bash
git clone https://github.com/odavlstudio/verax.git
cd verax
npm install

npm run demo         # Terminal 1: starts demo at http://127.0.0.1:4000
npm run verax:demo   # Terminal 2: runs VERAX against demo
```

### Option 2: Run on Your Own Site

```bash
npm install -g @veraxhq/verax
verax run --url http://localhost:3000 --src ./
```

Replace `http://localhost:3000` with your actual development URL.

If your source code is in a subdirectory:
```bash
verax run --url http://localhost:3000 --src ./client
```

## Understanding Results

VERAX produces one of five outcomes, identified by exit code:

### ✅ SUCCESS (exit code 0)

All observable public flows were tested. No silent failures detected within scope.

**What this means:**
- No evidence of silent failures was found within attempted scope
- Tested flows behaved as promised

**What this does NOT mean:**
- All flows in your app were tested (only discovered ones)
- Your app is bug-free
- All possible issues were caught

### 🔍 FINDINGS DETECTED (exit code 20)

One or more silent failures were confirmed with evidence.

Each finding includes:
- The promised behavior (from code analysis)
- What actually happened (from browser observation)
- Before/after screenshots
- DOM and network evidence

### ⚠️ INCOMPLETE (exit code 30)

The run did not complete fully. One or more preconditions failed or limits were reached.

**⚠️ Important:** INCOMPLETE results must NOT be treated as safe. Findings may be incomplete, and absence of findings is NOT meaningful.

**Common causes and how to fix:**

| Cause | Fix |
|-------|-----|
| Source code not detected | Verify `--src` path contains `.js`, `.jsx`, or `.tsx` files |
| Coverage below threshold | VERAX found fewer interactive elements than expected |
| Observation timeout | Website was too slow; try increasing `--timeout` |
| Scope policy blocked execution | Authenticated or out-of-scope flows detected |
| Browser/Playwright error | Run `verax doctor` for diagnostics |

### 🚫 USAGE_ERROR (exit code 64)

Invalid CLI usage (missing `--url`, unknown flags, etc.). Fix the command and retry.

### 🔴 INVARIANT_VIOLATION (exit code 50)

Internal error or artifact corruption. Artifacts may be corrupted or the evidence law was broken. Always investigate.

## Source Code Detection

VERAX requires source code to extract promises.

**Detected file types:**
- React/JSX (`.js`, `.jsx`, `.tsx` files with React code)
- Next.js (`app/` or `pages/` directories)
- Static HTML (`.html` files)
- Vue 3, Angular, SvelteKit (partial support — see below)

### When Source Code is Not Detected

If VERAX cannot find source code at your `--src` path:
- Result: INCOMPLETE (exit code 30)
- Reason: Promises cannot be extracted without source code
- This is intentional: runtime-only observation would be unreliable

**To debug:**
```bash
verax run --url http://localhost:3000 --src ./ --debug
```

The `--debug` flag shows what VERAX found in your source directory.

## Artifacts & Inspection

After each run, VERAX generates artifacts with evidence.

**Artifacts are located in:**
```
.verax/runs/20260128-143052-run-abc123/
```

The full artifact path is printed in terminal output when the run completes.

**To inspect results:**
```bash
verax inspect .verax/runs/20260128-143052-run-abc123/
```

**Contents:**
- `verax-summary.md` — Human-readable summary
- `summary.json` — Verdict, coverage counts
- `findings.json` — Detailed evidence
- `evidence/` — Screenshots, DOM diffs, traces

**Example terminal output:**
```
[VERAX] Reading source code...
[VERAX] Found 8 interactive elements
[VERAX] Starting browser observations...
[VERAX] Run complete: SUCCESS (0 silent failures detected)

Artifacts available in: .verax/runs/20260128-143052-run-abc123/
Next: verax inspect .verax/runs/20260128-143052-run-abc123/
```

## Detection Scope

### ✅ What VERAX Detects

**Navigation**
- Link clicks → route/URL changes

**Forms**
- Submissions with user-visible feedback
- Validation messages
- Feedback signals: `aria-live`, `role="alert"`, `role="status"`, stable text nodes
- Attributes: `disabled`, `aria-invalid`, `data-loading`

**Observable Outcomes**
- DOM changes
- Network activity correlated to actions
- Navigation events

### ❌ Out of Scope (By Design)

- Visual-only changes (spinners, colors, animations) → Use visual regression tools
- Ambiguous ARIA attributes (`aria-expanded`, etc.)
- Transient flashes < 100ms
- Authenticated flows
- Backend-dependent dynamic routes

## CLI Reference

### verax run

```bash
verax run --url <url> [options]
```

**Options:**
- `--url <url>` (required) — Your application URL
- `--src <path>` — Source directory (recommended for full detection)
- `--out <path>` — Output directory (default: `.verax`)
- `--min-coverage <0.0-1.0>` — Coverage threshold (default: 0.50 first run, 0.90 after)
- `--force-post-auth` — Experimental (always returns INCOMPLETE)
- `--timeout <ms>` — Observation timeout
- `--debug` — Show detection details
- `--json` — Output JSON

### verax inspect

```bash
verax inspect <path/to/run>
```

Displays findings in terminal.

### verax doctor

```bash
verax doctor [--json]
```

Checks Node.js, Playwright, and file permissions.

## Supported Frameworks

### Full Support

- React
- Next.js
- Static HTML

### Partial Support

Framework detection is less reliable; may produce fewer findings.

- **Vue 3** — Custom v-model patterns may not be detected
- **Angular** — Detection limited to `routerLink` and standard forms
- **SvelteKit** — Client-side only; server-side rendering not supported

**Recommendation:** Test on a known user flow first to verify detection works for your setup.

## Guarantees & Limitations

### Guarantees

- **Read-only** — VERAX never modifies your application
- **Deterministic** — Same inputs produce identical outputs
- **Evidence-backed** — All findings include reproducible proof
- **Conservative** — Uncertainty results in INCOMPLETE, not false positives

### Limitations

- Pre-authentication flows only
- Public flows only
- Not a test framework
- Not runtime monitoring
- Visual regressions not detected

## Installation

```bash
npm install -g @veraxhq/verax
```

### Requirements

- Node.js 18 or higher
- Playwright (auto-installed)

## CI/CD Integration

```bash
verax run --url https://staging.example.com --src ./

case $? in
  0)  echo "✓ No silent failures detected"; exit 0 ;;
  20) echo "✗ Silent failures detected"; exit 1 ;;
  30) echo "⚠ Incomplete observation"; exit 1 ;;
  50) echo "✗ Artifact corruption"; exit 1 ;;
  64) echo "✗ Usage error"; exit 1 ;;
  *)  echo "✗ Unknown error"; exit 1 ;;
esac
```

## License

MIT © VERAX
