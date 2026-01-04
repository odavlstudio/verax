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

## Exit Codes

- `0` - No silent failures found
- `1` - Silent failures detected
- `2` - Tool error (invalid URL, browser failure, etc.)

## Using Guardian in CI

Guardian automatically detects CI environments and suppresses welcome messages. Use it in GitHub Actions:

```yaml
name: Check Silent Failures

on: [push, pull_request]

jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Set up Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '18.x'
      
      - name: Install Guardian
        run: npm install -g @odavl/guardian
      
      - name: Install Playwright browsers
        run: npx playwright install --with-deps chromium
      
      - name: Run Guardian
        env:
          CI: true
        run: guardian silent --url https://your-site.com
```

The workflow will:
- ✅ Pass (exit 0) if no silent failures are found
- ❌ Fail (exit 1) if silent failures are detected
- ❌ Fail (exit 2) if Guardian encounters an error

See `.github/workflows/guardian-silent-example.yml` for a complete example.

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

**Internal Materials (Not Required):**
- `_internal/` - Internal development materials, historical documentation, and validation data
- `docs/` - Additional documentation (may reference internal processes)
- `validation-runs/` - Historical validation test runs

End users only need the npm package and this README. Internal folders are maintained for development purposes and can be safely ignored.

## Philosophy

ODAVL Guardian tests reality as users experience it. It simulates real interactions and observes genuine responses, focusing on observable effects rather than implementation details. This approach surfaces failures that users encounter but automated tests often miss.