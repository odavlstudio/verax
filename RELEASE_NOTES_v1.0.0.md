# v1.0.0 — Deployment Decision Engine

**Release Date:** December 31, 2025  
**Status:** Stable (Production-Ready)  
**License:** MIT

---

## What Guardian Decides

Guardian answers one question before every deployment:

> "Will launching this now harm real users or the business?"

To decide, Guardian:
1. Opens a real browser
2. Observes your website exactly as a real user would
3. Executes critical user flows (navigation, forms, checkout)
4. Issues a binding verdict: **READY**, **FRICTION**, or **DO_NOT_LAUNCH**

This verdict is **non-negotiable** — it cannot be overridden or suppressed.

---

## Who It's For

**Primary User:** CI/CD Pipeline Operators / Release Engineers

These are the people responsible for gating production deployments based on safety criteria. Guardian provides:

- **Deterministic exit codes** (0 = READY, 1 = FRICTION, 2 = DO_NOT_LAUNCH) for pipeline logic
- **Machine-readable verdicts** in `decision.json` for automation
- **Human-readable reports** in HTML format for investigation
- **GitHub Action integration** ([action.yml](https://github.com/odavlstudio/odavlguardian/blob/main/action.yml)) for CI/CD workflows

Guardian runs on every deployment candidate, not just once. It integrates into existing pipelines (GitHub Actions, GitLab CI, Jenkins, Bitbucket, etc.) without replacing your tests.

---

## How to Try in 10 Minutes

**Quickstart:** [Guardian in GitHub Actions](https://github.com/odavlstudio/odavlguardian/blob/main/docs/quickstart/CI_GITHUB_ACTION.md)

This guide includes:
- Copy/paste GitHub Actions workflow (minimal, runnable)
- How to interpret verdicts in your pipeline
- Where artifacts appear and what they mean
- Troubleshooting common issues

**Example workflow:**

```yaml
name: Guardian Pre-Launch Check
on: [push]
jobs:
  reality-check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Install Guardian
        run: npm install -g @odavl/guardian
      - name: Run Guardian
        run: guardian reality --url https://staging.example.com
```

Guardian will observe the site, issue a verdict, and exit with code 0 (READY), 1 (FRICTION), or 2 (DO_NOT_LAUNCH). Your pipeline respects the exit code.

---

## What It Is NOT

Guardian is **not:**

- **A testing tool** — Guardian does not run unit tests, integration tests, or E2E tests. It observes real user flows.
- **A bug scanner** — Guardian reports "checkout fails" but does not debug why or suggest fixes.
- **A QA replacement** — Guardian complements QA, doesn't replace it.
- **Configurable to force approval** — No `--force-ready` flag, no override mechanism.
- **A code quality analyzer** — Guardian does not analyze code, scan for security issues, or check performance benchmarks.
- **A monitoring platform** — Guardian issues verdicts and monitors post-launch (via Live mode), but it is not a full observability platform like DataDog or New Relic.

---

## Known Limitations

### Scope of v1.0.0

This release focuses exclusively on the **Decision Engine** — the core capability of observing websites, deciding safety, and issuing verdicts.

**What v1.0.0 includes:**
- Real browser observation (Playwright-based)
- Deterministic verdict logic (READY / FRICTION / DO_NOT_LAUNCH)
- CI/CD integration (GitHub Action, exit codes, decision.json)
- Post-launch monitoring (Live mode, baseline comparison)
- HTML and JSON reporting

**What v1.0.0 does NOT include:**
- Multi-user authentication flows (only supports single-user login scenarios)
- JavaScript-heavy SPAs with complex state management (basic SPA support exists)
- Mobile-specific flows (desktop browser only; mobile viewport emulation available)
- Multi-language/internationalization testing (single locale per run)
- Complex form validation scenarios (basic form submission supported)

### Technical Constraints

1. **Node.js requirement:** Guardian requires Node.js 18+ (uses native Playwright APIs)
2. **Browser dependency:** Chromium-based observation (Playwright bundles Chromium; no Firefox/Safari in v1.0.0)
3. **Single-page observation:** Guardian observes one URL at a time (no multi-page workflow orchestration in single command)
4. **No cloud execution:** Guardian runs locally or in CI/CD runners; no hosted/SaaS execution option
5. **No telemetry:** Guardian collects zero usage data, which means we learn only from GitHub issues

### What Guardian Cannot Observe

Guardian observes **user-facing behavior** only. It does NOT:
- Analyze backend logic or API responses (unless they impact frontend behavior)
- Validate database integrity or data correctness
- Check server-side security vulnerabilities
- Monitor infrastructure health (CPU, memory, disk)
- Test API endpoints directly (only observes browser-rendered results)

### Known Issues

- **Slow networks:** Guardian observes with default timeouts (5s for navigation, 3s for actions). Very slow sites may trigger FRICTION verdicts even if flows work eventually.
- **Rate limiting:** Websites with aggressive rate limiting may block Guardian's browser automation.
- **CAPTCHAs:** Guardian cannot solve CAPTCHAs. Sites requiring CAPTCHA on critical flows cannot be observed automatically.
- **Session expiry:** If a user flow depends on session state and sessions expire during observation, Guardian may issue false DO_NOT_LAUNCH verdicts.

---

## Post-Launch Monitoring

After you deploy, Guardian can continue observing in **Live mode**:

```bash
guardian live start --url https://example.com --interval 5
```

This runs reality checks every 5 minutes, compares against baseline, and alerts when user flows break. Guardian does **not** auto-fix, auto-deploy, or auto-rollback. It reports. Your team responds.

---

## Feedback

We're learning how release engineers use Guardian. Your feedback shapes future development.

**Report issues or suggest improvements:**
- [Clarity issue?](https://github.com/odavlstudio/odavlguardian/issues/new?template=clarity.yml)
- [Adoption blocker?](https://github.com/odavlstudio/odavlguardian/issues/new?template=adoption.yml)

**Tell us:**
- What worked in the Quickstart
- What was confusing
- Where the verdict was right or wrong
- How Guardian fits (or doesn't) in your pipeline

**We do not:**
- Collect telemetry
- Track usage
- Share data with third parties

All feedback stays on GitHub.

---

## Changelog Summary

Full changelog: [CHANGELOG.md](https://github.com/odavlstudio/odavlguardian/blob/main/CHANGELOG.md)

**v1.0.0 highlights:**
- Guardian is now the final decision authority before launch
- Observable Capabilities: VISIBLE = MUST WORK (absent features not penalized)
- Honest verdict enforcement with fair coverage calculation
- Deterministic verdicts: READY / FRICTION / DO_NOT_LAUNCH
- CLI, npm package, and VS Code extension aligned
- Read-only transparency via decision.json and artifacts
- No behavior overrides, no force-ready flags

---

## Installation

```bash
npm install -g @odavl/guardian
```

Or use in GitHub Actions without installation:

```yaml
- name: Run Guardian
  run: npx @odavl/guardian reality --url https://staging.example.com
```

---

## Documentation

- [Quickstart (CI/CD)](https://github.com/odavlstudio/odavlguardian/blob/main/docs/quickstart/CI_GITHUB_ACTION.md)
- [Artifact Orientation Guide](https://github.com/odavlstudio/odavlguardian/blob/main/docs/ARTIFACT_ORIENTATION.md)
- [Core Promise](https://github.com/odavlstudio/odavlguardian/blob/main/docs/ground-truth/CORE_PROMISE.md)
- [Product Identity](https://github.com/odavlstudio/odavlguardian/blob/main/PRODUCT_IDENTITY.md)
- [Technical Documentation](https://github.com/odavlstudio/odavlguardian/blob/main/docs/README.technical.md)

---

## License

MIT License — see [LICENSE](https://github.com/odavlstudio/odavlguardian/blob/main/LICENSE)

---

**Guardian v1.0.0 is the final decision authority before launch.**  
Observe reality. Decide safety. Ship confidently.
