# ODAVL Guardian — Silent Failure Detector

ODAVL Guardian is a public CLI tool that detects silent user failures by interacting with websites as real users do and reporting interactions that produce no observable effect.

**v1.0.2 is the first stable public release.** Install with `npm install -g @odavl/guardian`.

The npm package (`@odavl/guardian`) and this README are the complete public interface. Everything you need to use ODAVL Guardian is documented here.

The Problem

Many websites appear to work correctly while users silently encounter broken interactions:

Buttons are clickable but do nothing

Navigation links loop or lead nowhere

Forms submit without feedback

UI toggles change state without changing content

These failures:

Do not appear in logs

Do not trigger errors

Are invisible to analytics

Cause users to leave without explanation

What ODAVL Guardian Does

ODAVL Guardian:

Opens the target URL in a real browser

Interacts with visible user-facing elements

Observes actual outcomes (navigation, DOM changes, feedback)

Confirms failures through retries and stability checks

Reports confirmed silent failures only

It focuses exclusively on what users can see and experience.

What It Does NOT Do

ODAVL Guardian does not:

Test authentication or authorization flows

Perform security or penetration testing

Analyze backend logic or source code

Measure performance or SEO

Act as a generic test framework

Its scope is intentionally narrow and user-focused.

## Quick Start

Install globally:

```bash
npm install -g @odavl/guardian
```

Run against a website:

```bash
guardian silent --url https://example.com
```

Or use npx without installation:

```bash
npx @odavl/guardian silent --url https://example.com
```

**Note:** Guardian requires Playwright browsers. On first run, install them with:
```bash
npx playwright install --with-deps chromium
```

## Product Contract

ODAVL Guardian is a **signal engine**, not a decision authority. It detects silent user failures through evidence-based interaction testing and provides signals that may require human verification.

### What It Is

ODAVL Guardian is:
- **Silent User Failure Detection** — Detects interactions that produce no observable effect
- **Evidence-Based** — Provides screenshots, DOM snapshots, and structured data for verification
- **Signal Engine** — Treats all findings as signals that may require human verification

### What It Is NOT

ODAVL Guardian is NOT:
- **E2E Login/Checkout Testing** — Does not test authentication or multi-step user flows
- **Security Testing** — Does not perform penetration testing or security audits
- **Decision Authority** — Does not make pass/fail decisions; provides signals for human review

### "Signal, Not Truth" Principle

Always treat findings as **signals** that may require human verification. Guardian's detection is based on observable behavior patterns, but:
- False positives can occur (especially with client-side routing, delayed JS hydration, intentional non-functionality)
- Context matters — some "failures" may be intentional design choices
- Human verification is recommended before taking action on findings

### Recommended Usage Patterns

**CI Default (Warning-Only Signal):**
- Use `--mode warn` (default in CI environments)
- Exit code 0 even if failures are found (non-blocking)
- Review failures in CI logs and artifacts
- Prevents pipeline breakage while surfacing signals

**Blocking Mode (Expert-Only):**
- Use `--mode block` explicitly (default in local development)
- Exit code 1 when failures are found (breaks pipelines)
- Recommended only for:
  - Stable, well-understood pages
  - Teams with established retry and manual verification norms
  - Pages with predictable interaction patterns

## How It Works

Guardian opens the target URL in a real browser, interacts with visible user-facing elements, and observes actual outcomes (navigation, DOM changes, feedback). It confirms failures through retries and stability checks, reporting only confirmed silent failures.

## Output

Guardian produces a clear console summary with:

- Total confirmed silent failures
- Severity distribution (HIGH / MEDIUM / LOW)
- Detailed entries for each failure, including interaction type, description, severity, and evidence references

**Severity levels:**
- **HIGH** — critical, above-the-fold interactions
- **MEDIUM** — visible but less critical elements
- **LOW** — footer or secondary interactions

**Evidence artifacts:**
- Before/after screenshots for visual confirmation
- JSON report containing structured failure data, descriptions, severity, and scores
- HAR (HTTP Archive) recording (optional, off by default)

**HAR Recording (Optional):**
HAR recording is disabled by default. To enable it, create a `guardian.config.json` file in your project root:

```json
{
  "media": {
    "har": true
  }
}
```

When enabled, Guardian records all network traffic as a HAR file. The HAR file contains the complete HTTP request/response data for the entire browser session and is saved to `har/session.har` in the run directory. HAR files can be analyzed with tools like [HAR Analyzer](https://toolbox.googleapps.com/apps/har_analyzer/) or Chrome DevTools.

## Exit Codes

Exit codes vary by operating mode (see `--mode` flag):

**Block Mode (default in local development):**
- `0` - No silent failures found
- `1` - Silent failures detected
- `2` - Tool error (invalid URL, browser failure, etc.)

**Warn Mode (default in CI environments):**
- `0` - No failures found OR failures found (non-blocking signal mode)
- `2` - Tool error (invalid URL, browser failure, etc.)

In warn mode, the tool always exits with code 0 to prevent pipeline breakage, but still reports failures with "Status: FAIL (Signal)" in the console output. Check the console output and JSON report to review findings.

## Using Guardian in CI

Guardian automatically detects CI environments and suppresses welcome messages. Use it in GitHub Actions:

```yaml
name: Guardian Silent Failure Check

on:
  push:
  pull_request:
  workflow_dispatch:
    inputs:
      url:
        description: 'URL to test'
        required: true
        type: string

jobs:
  check-silent-failures:
    runs-on: ubuntu-latest
    
    steps:
      - name: Checkout code (optional, only needed if testing from repo)
        uses: actions/checkout@v4
        if: false  # Set to true if you need the repo code

      - name: Set up Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '18.x'
      
      - name: Install Guardian
        run: npm install -g @odavl/guardian
      
      - name: Install Playwright browsers
        run: npx playwright install --with-deps chromium
      
      - name: Run Guardian Silent Check
        env:
          CI: true
        run: |
          guardian silent --url ${{ inputs.url || 'https://example.com' }}
        id: guardian

      - name: Check exit code
        run: |
          if [ ${{ steps.guardian.outcome }} == 'failure' ]; then
            echo "Guardian found silent failures (exit code 1) or encountered an error (exit code 2)"
            exit 1
          else
            echo "Guardian check passed (exit code 0)"
          fi
```

The workflow will:
- ✅ Pass (exit 0) if no silent failures are found
- ❌ Fail (exit 1) if silent failures are detected
- ❌ Fail (exit 2) if Guardian encounters an error

This example can be copied directly to `.github/workflows/guardian-silent.yml` in your repository.

### PR Signal Mode (Non-Blocking)

For non-blocking PR signal workflows that post results as PR comments:

```yaml
name: Guardian PR Signal

on:
  pull_request:
    types: [opened, synchronize, reopened]

jobs:
  guardian-pr-signal:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      pull-requests: write
    
    steps:
      - name: Checkout code
        uses: actions/checkout@v4
      
      - name: Set up Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '18.x'
      
      - name: Install Guardian
        run: npm install -g @odavl/guardian
      
      - name: Install Playwright browsers
        run: npx playwright install --with-deps chromium
      
      - name: Run Guardian (warn mode)
        env:
          CI: true
        run: |
          guardian silent --url https://example.com --mode warn
```

**Baseline diff (optional):** If a baseline file exists at `.odavl-guardian/baseline/silent-results.json`, Guardian will automatically compare against it and show NEW/RESOLVED/UNCHANGED counts in the diff output.

**Diff output meaning:**
- **NEW**: Failures present in current run but not in baseline (newly introduced)
- **RESOLVED**: Failures present in baseline but not in current run (fixed)
- **UNCHANGED**: Failures present in both baseline and current run (persistent)

See `.github/workflows/guardian-pr-signal.yml` for a complete example with PR comment posting and artifact uploads.

## Installation

### Global Installation (Recommended)

```bash
npm install -g @odavl/guardian
guardian silent --url https://example.com
```

### Using npx (No Installation)

```bash
npx @odavl/guardian silent --url https://example.com
```

### Local Installation

```bash
npm install @odavl/guardian
npx guardian silent --url https://example.com
```

**Note:** Guardian requires Playwright browsers. On first run, install them with:
```bash
npx playwright install --with-deps chromium
```

## Versioning

ODAVL Guardian follows [Semantic Versioning](https://semver.org/).

### Breaking Changes

Breaking changes are indicated by a major version bump (e.g., 1.0.2 → 2.0.0). Breaking changes may include:

- Changes to exit code behavior
- Changes to JSON report structure
- Removal of CLI flags or commands
- Changes to config file format
- Changes to minimum Node.js version requirements

Non-breaking changes (minor/patch versions) include:
- New optional features
- New CLI flags (backward compatible)
- Bug fixes
- Performance improvements

See [CHANGELOG.md](./CHANGELOG.md) for detailed version history.

## Repository Structure

This repository contains:

**Public Product (What You Need):**
- `bin/` - CLI executable
- `src/` - Source code
- `package.json` - Package configuration
- `README.md` - This file (complete documentation)
- `CHANGELOG.md` - Version history
- `LICENSE` - MIT License

**Website:**
- `odavlguardian-website/` - ODAVL Guardian website (Next.js). Deployed via Vercel. Root Directory should be set to `odavlguardian-website` in Vercel project settings. No build or runtime secrets required.

**Internal Materials (Not Required):**
- `_internal/` - Internal development materials, historical documentation, and validation data
- `docs/` - Additional documentation (may reference internal processes)
- `validation-runs/` - Historical validation test runs

End users only need the npm package and this README. Internal folders are maintained for development purposes and can be safely ignored.

## Philosophy

ODAVL Guardian tests reality as users experience it. It simulates real interactions and observes genuine responses, focusing on observable effects rather than implementation details. This approach surfaces failures that users encounter but automated tests often miss.