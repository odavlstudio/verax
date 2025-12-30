# 🛡️ ODAVL Guardian

![Release](https://img.shields.io/github/v/release/odavlstudio/odavlguardian?label=release&color=blue)
![Reality Based](https://img.shields.io/badge/reality--based-verified-informational)
![Results](https://img.shields.io/badge/results-READY%20%7C%20FRICTION%20%7C%20DO__NOT__LAUNCH-orange)
![Status](https://img.shields.io/badge/status-stable-green)
![Tests](https://github.com/odavlstudio/odavlguardian/actions/workflows/guardian.yml/badge.svg)

**Launch Decision Engine for Websites**

Guardian tests your website with real browsers and returns a reality-based verdict (READY | FRICTION | DO_NOT_LAUNCH) to gate deployments.

```bash
# Test your site, get a verdict
guardian reality --url https://your-site.com

# Verdict determines deployment
# Exit 0 = READY (ship it)
# Exit 1 = FRICTION (investigate)
# Exit 2 = DO_NOT_LAUNCH (block deployment)
```

Artifacts: `decision.json` (machine-readable) + `summary.md` (human-readable)

## Why It Exists

Tests pass. Metrics look good. Code is clean.

And users still fail.

Guardian finds these breaks before they become support tickets.

## Recommended First Run

**The canonical command:**

```bash
npm install -g @odavl/guardian

guardian reality --url https://example.com
```

Guardian produces **canonical artifacts:**

```
✅ Verdict: READY (exit code 0)

Artifacts:
  - .odavlguardian/<timestamp>/decision.json  (machine-readable)
  - .odavlguardian/<timestamp>/summary.md     (human-readable)
```

**Canonical output:**
```
Verdict: READY | FRICTION | DO_NOT_LAUNCH
Reason: <human explanation>
Next: Deploy | Review | Fix before launch
```

**Use-case:** Pre-launch gating. Run Guardian before deploying. Block deployments on `DO_NOT_LAUNCH`.

## Try Guardian in 30 Seconds

Don't install. Just run:

```bash
npx @odavl/guardian reality --url https://your-site.com
```

**What you'll see:**
- **READY** → All critical flows work. Safe to launch.
- **FRICTION** → Some flows have issues. Review before launch.
- **DO_NOT_LAUNCH** → Critical failure. Fix before deploying.

[Read real examples](docs/DECISION_CONFIDENCE.md) of what each verdict means.

## What You Get

### decision.json (Machine-Readable)

```json
{
  "finalVerdict": "READY",
  "exitCode": 0,
  "triggeredRules": ["all_goals_reached"],
  "reasons": [
    {
      "ruleId": "all_goals_reached",
      "message": "All critical flows executed successfully and goals reached",
      "category": "COMPLIANCE",
      "priority": 50
    }
  ],
  "policySignals": {
    "executedCount": 1,
    "failedCount": 0,
    "goalReached": true,
    "domain": "example.com"
  }
}
```

### summary.md (Human-Readable)

Human-friendly explanation of the verdict, what was tested, what Guardian couldn't confirm, and why.

## The Three Verdicts

- **READY** (exit 0) — Goal reached, no failures
- **FRICTION** (exit 1) — Partial success, warnings, or near-misses
- **DO_NOT_LAUNCH** (exit 2) — User failed or flow broken

Guardian never pretends success.

## What Guardian Does (Conceptually)

1. **You define a scenario** — signup, checkout, landing, etc.
2. **Guardian executes it** — real navigation, real waits, real interactions
3. **Guardian evaluates** — did the human succeed?
4. **Guardian produces a decision** — not logs, a verdict

## When to Use Guardian

- **Before launch** — Does signup actually work?
- **Before scaling** — Does checkout really finish?
- **Before campaigns** — Does the landing convert?
- **Before localization** — Does language switching work?
- **Before deployment** — Did this change break the flow?

## How It Works

Guardian uses a **rules engine** to evaluate reality:

1. Scan results → Policy signals (execution counts, outcomes, etc.)
2. Policy signals → Rules evaluation (deterministic, transparent)
3. Rules → Final verdict (READY | FRICTION | DO_NOT_LAUNCH)

**All rules are explicit.** No ML. No guessing. Transparency by design.

## What Guardian Is NOT

Guardian is not:

- A unit test framework
- A code quality tool
- A performance benchmark
- A security scanner
- A Lighthouse replacement

Guardian complements those tools.

## Honesty Contract

Guardian never pretends success. Strict principles:

- **No hallucination** — Only what Guardian observed
- **No fake success** — Honest verdicts always
- **No optimistic assumptions** — Conservative by default
- **No silent failures** — If reality is broken, Guardian says so
- **Evidence > explanation** — Verdicts are data-driven
- **Reality > implementation** — What users experience matters most

See [docs/PRODUCT.md](docs/PRODUCT.md) for complete product identity and workflows.

## Install

```bash
npm install -g @odavl/guardian
```

## Quick Start

```bash
# Test a website
guardian reality --url https://example.com

# Test with a preset (startup, custom, landing, full)
guardian reality --url https://example.com --preset startup

# See all options
guardian --help
```

## VS Code Integration

Command Palette → "Guardian: Run Reality Check"

## Status

**Early but real.** Opinionated. Built with honesty over hype.

This is a foundation — not a marketing shell.

## License

MIT

---

Built with the belief that users matter more than code.
