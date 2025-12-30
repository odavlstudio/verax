# ODAVL Guardian — VS Code Extension

Launch decision engine that tests real user flows and returns a deploy verdict.

## What it does

- Run real headless browser journeys and return a verdict: READY, FRICTION, or DO_NOT_LAUNCH
- Capture evidence: artifacts, reports, timings
- Produce deterministic exit codes for CI gates

## Commands

- **Guardian: Run Reality Check** — Execute Guardian against any URL
- **Guardian: Open Last Report** — Open the most recent report

## Who is this for?

Engineers and QA leads who need auditable, browser-level truth before shipping.

## Requirements

- Node.js 18+
- ODAVL Guardian CLI: `npm install -g @odavl/guardian`

Verify installation:
```bash
guardian --version
```

Should show: `1.0.0` (or later)

## Usage

1. Open Command Palette (`Ctrl+Shift+P` / `Cmd+Shift+P`)
2. Type "Guardian" to list commands
3. Choose a command and provide the target URL
4. Review the verdict and artifacts in your browser

## Support

- Documentation: [docs](https://github.com/odavlstudio/odavlguardian/tree/main/docs)
- Issues: [issue tracker](https://github.com/odavlstudio/odavlguardian/issues)
- Getting Started: [docs/guardian/getting-started.md](https://github.com/odavlstudio/odavlguardian/blob/main/docs/guardian/getting-started.md)
