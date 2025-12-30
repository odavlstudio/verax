# ODAVL Guardian — Product Identity

**One-line definition:**  
Guardian is a launch decision engine that tests websites with real browsers and returns a reality-based verdict (READY | FRICTION | DO_NOT_LAUNCH) to gate deployments.

---

## What It Is

- ✅ A **CLI tool** for pre-launch reality checks
- ✅ A **Node.js library** with programmable API
- ✅ A **VS Code extension** for quick checks
- ✅ A **GitHub Action** for deployment gating
- ✅ A **browser automation engine** using Playwright
- ✅ A **verdict system** with deterministic exit codes
- ✅ An **evidence generator** (decision.json, summary.md, artifacts)

---

## What It Is Not

- ❌ Not a unit test framework
- ❌ Not a code quality analyzer
- ❌ Not a performance benchmarking tool
- ❌ Not a security scanner
- ❌ Not a substitute for Lighthouse or PageSpeed
- ❌ Not a monitoring service (see: `guardian live` for scheduled checks)

Guardian complements these tools by answering: **Can a real user complete the goal?**

---

## Primary Use-Case

**Pre-launch gating:** Run Guardian before deploying to production. If verdict is `DO_NOT_LAUNCH`, block the deployment. If `FRICTION`, investigate. If `READY`, ship with confidence.

### Golden Path Guarantee

Guardian guarantees safe behavior on simple static websites (landing pages, documentation, blogs):

- ✅ **Will NOT block launch** (DO_NOT_LAUNCH) if the site is functional but has no interactive elements
- ✅ **Returns FRICTION** when nothing is testable (acknowledges limited coverage)
- ✅ **Returns READY** when basic navigation and pages load successfully
- ✅ **Only blocks (DO_NOT_LAUNCH)** when a real critical failure is detected (site unreachable, broken navigation, user flow fails)

This means you can safely run Guardian on ANY website type without fear of false-positive launch blockers.

---

## Outputs

Guardian produces machine-readable and human-readable artifacts:

### `decision.json` (Machine-Readable)
```json
{
  "finalVerdict": "READY",
  "exitCode": 0,
  "triggeredRules": ["all_goals_reached"],
  "reasons": [
    {
      "ruleId": "all_goals_reached",
      "message": "All critical flows executed successfully",
      "category": "COMPLIANCE",
      "priority": 50
    }
  ],
  "policySignals": {
    "executedCount": 1,
    "failedCount": 0,
    "goalReached": true
  }
}
```

### `summary.md` (Human-Readable)
Plain English explanation of what was tested, what Guardian observed, what it couldn't confirm, and why the verdict was issued.

### Verdict Meanings

| Verdict | Exit Code | Meaning |
|---------|-----------|---------|
| `READY` | 0 | All critical flows succeeded. Safe to launch. |
| `FRICTION` | 1 | Partial success, warnings, or minor issues detected. |
| `DO_NOT_LAUNCH` | 2 | Critical failure. User cannot complete the goal. |

Exit codes are deterministic and designed for CI/CD gates.

---

## 3 Practical Workflows

### A) CLI Quickstart (Canonical)

**The canonical way to run Guardian:**

```bash
# Install globally
npm install -g @odavl/guardian

# Run a reality check (canonical command)
guardian reality --url https://example.com

# Canonical output (always produced)
Verdict: READY | FRICTION | DO_NOT_LAUNCH
Reason: <human explanation>
Next: Deploy | Review | Fix before launch

# Check exit code for automation
echo $?  # 0 = READY, 1 = FRICTION, 2 = DO_NOT_LAUNCH
```

**Canonical artifacts (always generated):**
- `.odavlguardian/<timestamp>/decision.json` — Machine-readable truth
- `.odavlguardian/<timestamp>/summary.md` — Human-readable explanation

### B) GitHub Action Gating

```yaml
name: Pre-Deploy Gate
on: [push]

jobs:
  reality-check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: odavlstudio/odavlguardian@v1
        with:
          url: https://staging.example.com
          preset: startup
          fail-on: any  # Block on any non-READY verdict
      - run: echo "Verdict was ${{ steps.guardian.outputs.verdict }}"
```

If Guardian returns `DO_NOT_LAUNCH`, the workflow fails and deployment is blocked.

### C) VS Code Extension Usage

1. Open Command Palette: `Ctrl+Shift+P` / `Cmd+Shift+P`
2. Type: `Guardian: Run Reality Check`
3. Enter URL when prompted
4. Review verdict and artifacts in browser

Extension commands:
- `Guardian: Run Reality Check` — Execute reality check
- `Guardian: Open Last Report` — Open most recent report

---

## Honesty Contract

Guardian follows strict principles:

- **No hallucination** — Only reports what was actually observed
- **No fake success** — If reality is broken, Guardian says so
- **No optimistic assumptions** — Conservative by default
- **No silent failures** — Failures are explicit with reasons
- **Evidence > explanation** — Verdicts are backed by artifacts

Guardian never pretends success. If a user flow fails, the verdict reflects that reality.

---

## Scope Note

This repository includes experimental/enterprise features:

- `src/enterprise/` — RBAC, audit logging, PDF exports
- `src/payments/` — Payment integrations
- `src/plans/` — Plan management
- `src/recipes/` — Recipe store/engine
- `website/` — Next.js marketing site

These are **not part of the core promise** (launch decision engine). The core promise is:

1. Run real browser tests
2. Evaluate user success
3. Return a verdict with exit code
4. Generate evidence artifacts

Everything else is experimental or enterprise-tier.

---

## Documentation

- [Getting Started](guardian/getting-started.md) — First-time setup *(if exists)*
- [CI Integration](guardian/ci-integration.md) — GitHub Actions, GitLab CI, etc. *(if exists)*
- [Contract](guardian/guardian-contract-v1.md) — API contract *(if exists)*
- [Presets](guardian/presets.md) — Test presets (startup, saas, landing, etc.) *(if exists)*

---

**Version:** 1.0.1 (Stable)  
**License:** MIT  
**Repository:** [github.com/odavlstudio/odavlguardian](https://github.com/odavlstudio/odavlguardian)
