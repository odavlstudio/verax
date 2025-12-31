# ODAVL Guardian — The Final Decision Authority Before Launch

**What:** Guardian observes your website as real users experience it and issues a binding verdict on whether it's safe to launch.

**For:** CI/CD Pipeline Operators / Release Engineers (those responsible for gating production deployments)

**Try it in 10 minutes:** [Quickstart: Guardian in GitHub Actions](docs/quickstart/CI_GITHUB_ACTION.md)

---

## The Decision Guardian Makes

Guardian answers one question before every launch:

> "Will launching this now harm real users or the business?"

Guardian observes your website **as a real user would** — navigates pages, fills forms, completes flows — then issues a binding verdict:

- **READY** (exit 0) → All critical flows work. Safe to deploy.
- **FRICTION** (exit 1) → Some issues found. Investigate before deploying.
- **DO_NOT_LAUNCH** (exit 2) → Critical flow is broken. Deployment blocked.

**This verdict cannot be overridden.**

---

## Status

**Version:** 1.0.0 (Stable)  
**Scope:** Decision Engine (Pre-Launch Authority)  
**License:** MIT  
**Maturity:** Production-ready for CI/CD deployment gating

Guardian's decision engine is stable and production-ready. All core functionality (observe, decide, report) is in active use.

---

## How Guardian Is Used

- Before launch: blocks deployment when reality is broken
- After launch: monitors production and alerts when reality breaks

## Watchdog Mode (After Launch)

Guardian remains your authority after launch. It continues observing
reality, detects when user flows break, and alerts your team immediately.
Guardian does not auto-fix. Guardian does not deploy patches. Guardian reports
what is broken. Your team responds. Same verdicts, same authority, same
responsibility.

## Verdicts (Non-Negotiable)

- READY → Users can complete their critical goals. Safe to deploy.
- FRICTION → investigate before proceeding
- DO_NOT_LAUNCH → launch blocked

Guardian verdicts cannot be overridden.

## What Guardian Is Not

- Not a testing tool
- Not a bug scanner
- Not a QA replacement
- Not configurable to force approval

## The Ethical Rule

Guardian never allows READY
if it cannot defend that decision
to a real human user.

## Quickstart (CI/CD)

**Want to add Guardian to your deployment pipeline in <10 minutes?**

Start here: **[Quickstart: Guardian in GitHub Actions](docs/quickstart/CI_GITHUB_ACTION.md)**

This guide includes:
- Minimal GitHub Actions workflow (copy/paste ready)
- How to interpret verdicts in your pipeline
- Where artifacts appear and what they mean
- Troubleshooting common issues

**Example:** [examples/github-action/](examples/github-action/)

## Decision Statement

ODAVL Guardian blocks launches when it cannot defensibly justify that real user reality supports safe deployment.

## Quick Start: The Canonical Command

```bash
guardian reality --url https://example.com
```

**This is the only command you need for CI/CD deployment gating.**

Guardian:
1. Observes your site as real users would
2. Issues a verdict: READY (exit 0), FRICTION (exit 1), or DO_NOT_LAUNCH (exit 2)
3. Writes decision.json with full reasoning

Your pipeline respects the exit code. If DO_NOT_LAUNCH, deployment is blocked.

## When Guardian Says No (DO_NOT_LAUNCH)

The flow is blocked. The decision is final. Here's what to do:

1. Review the decision.json file for Guardian's reasons
2. Fix the broken user flows in production candidate
3. Rerun Guardian to get a new verdict
4. Deployment proceeds only when verdict is READY or acceptable FRICTION

**Guardian never forces approval. The authority model is absolute.**

## Understanding Guardian's Output

After Guardian runs, you'll get:
- **decision.json** — Machine-readable verdict and reasons (use in your pipeline logic)
- **HTML report** — Human-readable report with screenshots and flow details

[Learn how to read Guardian artifacts](docs/ARTIFACT_ORIENTATION.md)

---

## How to Give Feedback

We're learning how release engineers use Guardian. Your feedback shapes future development.

**Report issues or suggest improvements:**
- [Bug or clarity issue?](https://github.com/odavlstudio/odavlguardian/issues/new?template=clarity.yml)
- [Adoption blockers?](https://github.com/odavlstudio/odavlguardian/issues/new?template=adoption.yml)

**Tell us:**
- What worked in the quickstart
- What was confusing
- Where the verdict was right or wrong
- How Guardian fits (or doesn't) in your pipeline

**We do not:**
- Collect telemetry
- Track usage
- Share data with third parties

All feedback stays on GitHub.

---

## Learn More

- [Product Definition (ONE_LINER)](docs/ground-truth/ONE_LINER.md)
- [Core Promise](docs/ground-truth/CORE_PROMISE.md)
- [Full Technical Docs](docs/README.technical.md)

