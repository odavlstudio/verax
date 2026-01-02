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

**Version:** 2.0.0 (Stable)  
**Scope:** Decision Engine (Pre-Launch + Post-Launch Authority)  
**License:** MIT  
**Maturity:** Production-ready for CI/CD deployment gating and production monitoring

Guardian's decision engine is stable and production-ready. All core functionality (observe, decide, report) is in active use.

---

## How Guardian Is Used

- Before launch: blocks deployment when reality is broken
- After launch: monitors production and alerts when reality breaks

## Watchdog Mode (After Launch)

Guardian remains your authority after launch. It continues observing reality, detects when user flows break, and alerts your team immediately.

**How it works:**

1. **Create baseline** from a known-good production state:
   ```bash
   guardian reality --url https://example.com --baseline create
   ```

2. **Monitor production** — Run Guardian on schedule (cron, GitHub Actions):
   ```bash
   guardian reality --url https://example.com --watchdog
   ```
   - Silent when everything works
   - **Alerts on degradation:**
     - Verdict downgrades (READY → FRICTION, READY → DO_NOT_LAUNCH)
     - Coverage drops ≥20%
     - Selector confidence drops ≥0.2
     - Critical flows that start failing

3. **Update baseline** after fixes or intentional changes:
   ```bash
   guardian reality --url https://example.com --baseline update
   ```
   - Only updates if current verdict is READY
   - Preserves alert integrity

**What Guardian does NOT do:**
- Does not auto-fix issues
- Does not deploy patches
- Does not run continuously (you schedule it)

**Your responsibility:** Guardian reports what broke. Your team responds.

**Learn more:** `guardian reality --help` (see WATCHDOG MODE section)

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

## Quality Gates

Guardian enforces code quality standards before deployment. Run these commands to validate your changes:

```bash
# Run ESLint code style checks
npm run lint

# Run TypeScript type checking
npm run typecheck

# Run all quality checks + tests
npm run quality
```

**For contributors:** All quality gates must pass before submitting pull requests. The CI pipeline enforces these checks automatically.

### Baseline Quality Guard (Zero Regression Shield)

**Current Technical Debt:**
- ESLint: 220 errors (frozen baseline)
- TypeScript: 281 errors (frozen baseline)

These legacy errors are **intentionally frozen** and do not block development. However, introducing **new** errors is prohibited.

**How it works:**

1. **Baselines capture current state:** Error counts are frozen in [reports/quality-baseline/](reports/quality-baseline/)
   - `eslint-baseline.json` — 220 errors across 73 files
   - `typecheck-baseline.json` — 281 errors across 51 files

2. **Guard prevents regressions:** Before committing or in CI/PR checks, run:
   ```bash
   npm run quality:guard
   ```
   - ✅ Passes if error count stays the same or decreases
   - ❌ Fails if any new errors are introduced
   - Reports exactly which error categories increased

3. **Update baselines (maintainers only):** After intentionally fixing errors:
   ```bash
   npm run quality:baseline
   ```
   This updates the frozen baselines to reflect improvements.

**Philosophy:** Fix legacy errors incrementally without blocking new work. The guard ensures technical debt doesn't grow while we chip away at it.

---

## CI Enforcement & Release Safety

Guardian enforces mandatory quality gates in all CI/CD pipelines. Every push and pull request must pass quality checks before proceeding.

### Mandatory Quality Gates

The CI pipeline runs a dedicated `quality-gates` job that **must pass before any downstream jobs execute**:

```yaml
quality-gates:
  ├─ npm ci              # Install exact dependencies
  ├─ npm test            # Run all tests
  ├─ npm run quality     # ESLint + TypeScript checks
  ├─ npm run quality:guard # Prevent regression (new errors)
  └─ npm audit           # Security advisory (non-blocking)
```

**Your PR will be blocked if:**
- ❌ Any test fails (`npm test`)
- ❌ ESLint detects style violations (`npm run quality`)
- ❌ TypeScript detects type errors (`npm run quality`)
- ❌ New lint/type errors are introduced (`npm run quality:guard`)

**Your PR will proceed if:**
- ✅ Security audit finds issues (`npm audit`) — logged but non-blocking

### Before Pushing Code

Ensure your changes pass locally:

```bash
# 1. Run tests
npm test

# 2. Check code quality (style + types)
npm run quality

# 3. Verify no regressions
npm run quality:guard

# 4. Push when all pass ✅
git push
```

If `npm run quality:guard` fails, you've introduced new errors. Check the report and fix them before pushing.

### Current Baselines

The mandatory quality gates enforce these frozen error counts:

- **ESLint:** 172 errors (across 72 files)
- **TypeScript:** 280 errors (across 51 files)

These baselines are **intentionally not zero** to allow incremental improvement. Your changes must not *increase* these counts.

### Workflow Integration

All Guardian workflows enforce these gates:

- **[guardian.yml](.github/workflows/guardian.yml)** — Main CI (all pushes, PRs, releases)
- **[guardian-pr-gate.yml](.github/workflows/guardian-pr-gate.yml)** — PR-specific checks
- **[guardian-nightly.yml](.github/workflows/guardian-nightly.yml)** — Production monitoring

---

## Learn More

- [Product Definition (ONE_LINER)](docs/ground-truth/ONE_LINER.md)
- [Core Promise](docs/ground-truth/CORE_PROMISE.md)
- [Full Technical Docs](docs/README.technical.md)