# 🛡️ ODAVL Guardian — Market Reality Testing Engine

Guardian tests your product before the market does — it runs real-browser checks to catch broken flows early and produces evidence you can trust.

---

## Public Preview

- Distribution: GitHub-only (no npm publish yet)
- Scope: CLI usage from source

---

## Requirements

- Node.js 18+
- npm
- Playwright browsers (Chromium)

Install browsers once per machine:

```bash
npx playwright install --with-deps chromium
```

---

## Install from Source

```bash
# Clone the repository
git clone https://github.com/ODAVL/odavl-guardian.git
cd odavl-guardian

# Install dependencies
npm install

# Install Playwright browsers (Chromium)
npx playwright install --with-deps chromium
```

Quick try:

```bash
# Quick reality check with startup policy (from source)
node bin/guardian.js protect https://example.com

# Full reality snapshot with artifacts
node bin/guardian.js reality --url https://example.com --artifacts ./artifacts
```

---

## CLI Commands

Use the CLI from source during Public Preview:

```text
node bin/guardian.js init                 # Initialize Guardian in the current directory
node bin/guardian.js protect <url>        # Quick reality check using the startup preset
node bin/guardian.js presets              # List available policy presets
node bin/guardian.js attempt [...]        # Execute a single attempt
node bin/guardian.js reality [...]        # Full market reality snapshot
node bin/guardian.js baseline save [...]  # Save a named baseline
node bin/guardian.js baseline check [...] # Check current run against a baseline
```

Examples:

```bash
node bin/guardian.js reality --url https://example.com --policy preset:saas --artifacts ./artifacts
node bin/guardian.js baseline save --url "http://127.0.0.1:3000?mode=ok" --name ok-baseline --baseline-dir guardian-baselines --artifacts artifacts
node bin/guardian.js baseline check --url "http://127.0.0.1:3000?mode=ok" --name ok-baseline --baseline-dir guardian-baselines --artifacts artifacts --junit artifacts/junit.xml
```

---

## Artifacts

- Market report: artifacts/market-run-*/market-report.html
- Snapshot JSON: artifacts/market-run-*/snapshot.json
- Attempt reports: artifacts/market-run-*/`<attempt-id>`/attempt-report.*
- Playwright trace: artifacts/market-run-*/trace.zip (when enabled)
- JUnit XML: artifacts/junit.xml (when requested)

---

## Exit Codes

```text
0  READY            # Safe to proceed - all checks passed
1  DO_NOT_LAUNCH    # Critical issues found - do not deploy
2  FRICTION         # Usability issues found - proceed with caution
```

---

## CI Integration (Minimal)

```yaml
name: Guardian Reality Check
on: [push, pull_request]

jobs:
  guardian:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '18'

      - run: npm ci
      - run: node bin/guardian.js reality --url https://staging.example.com --max-pages 25

      - uses: actions/upload-artifact@v4
        with:
          name: guardian-report
          path: artifacts/market-run-*/market-report.html
```

---

## Docs & Specs

- Contract: [guardian-contract-v1.md](guardian-contract-v1.md)
- Engine docs: [docs/guardian](docs/guardian)

---

## Status & Known Issues

- Public Preview (GitHub-only). CLI usage is via source: see [bin/guardian.js](bin/guardian.js).
- Website subproject build has an ESLint rule failure (react/no-unescaped-entities). Not required for CLI usage.
- Tests: most suites pass; see [CHANGELOG.md](CHANGELOG.md) for current failures/regressions, if any.

---

## License

Licensed under the MIT License. See [LICENSE](LICENSE) for details.
