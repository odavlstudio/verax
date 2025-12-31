# POSITIONING_LOCK: Guardian's Category and Differentiation

---

## CATEGORY NAME

**Deployment Decision Authority** (or: **Reality-Based Launch Gating**)

### Why this category?
Guardian is not in the category of:
- Testing tools (those execute code)
- Monitoring tools (those collect continuous data)
- QA tools (those find bugs)

Guardian is in a category by itself: **a gating authority that makes binding pre-deployment decisions based on observed user reality.**

The closest analogy: A **launch control officer** who decides "go/no-go" before a spacecraft launch, except for websites.

---

## HOW GUARDIAN DIFFERS FROM TESTING TOOLS

### Playwright / Cypress / Selenium (E2E Testing Frameworks)

| Dimension | Guardian | Testing Tools |
|-----------|----------|---------------|
| **Goal** | Decide if safe to launch | Find bugs / verify functionality |
| **Verdict** | READY / FRICTION / DO_NOT_LAUNCH (binding, gates deployment) | Test pass/fail (informational) |
| **Scope** | Observes live production-candidate site in one pass | Tests run repeatedly, often in isolated staging environments |
| **Overridability** | Verdicts are non-bypassable | Test failures can be ignored or marked as expected |

**Key difference:** Testing tools validate that code works as *intended*. Guardian validates that real users can *accomplish their goal.*

**Evidence from code:**
- [PRODUCT_IDENTITY.md](../../PRODUCT_IDENTITY.md): "Not a unit test framework. Not a replacement for Playwright, Cypress, or QA."
- [README.md](../../README.md): "Not based on tests. Not based on assumptions. Based on real user reality."
- [src/guardian/verdict.js](../../src/guardian/verdict.js): Verdict computation (READY/FRICTION/DO_NOT_LAUNCH) is fundamentally different from test pass/fail

---

## HOW GUARDIAN DIFFERS FROM MONITORING TOOLS

### Sentry / Datadog / New Relic (Continuous Monitoring)

| Dimension | Guardian | Monitoring Tools |
|-----------|----------|------------------|
| **Timing** | Pre-deployment (before launch) + post-deployment (after launch) | Post-deployment only (continuous) |
| **Data model** | Observed user flow outcomes (did they complete?) | Logs, metrics, traces (what happened systemically?) |
| **Decision** | Go/no-go gate (binary verdict) | Health dashboard (continuous observations) |
| **Retention** | Last N runs stored locally | Long-term data warehouse |

**Key difference:** Monitoring tools observe *everything* continuously. Guardian observes *specific user flows* periodically (pre-launch + post-launch checkpoints).

**Evidence from code:**
- [src/guardian/live-guardian.js](../../src/guardian/live-guardian.js): Scheduled checks (every N minutes), not continuous instrumentation
- [src/guardian/live-state.js](../../src/guardian/live-state.js): Stores last N runs locally; no infinite history
- [src/guardian/live-baseline-compare.js](../../src/guardian/live-baseline-compare.js): Binary outcome (regressed or not), not metric dashboard

---

## DIFFERENTIATION SUMMARY TABLE

| Aspect | Guardian | Testing Tools | Monitoring Tools |
|--------|----------|---------------|------------------|
| **Purpose** | Launch decision | Bug finding | Health observation |
| **Verdict binding?** | YES (blocks launch) | NO (informational) | NO (advisory) |
| **Repeatable/scheduled?** | YES (before + after launch) | YES (repeatable) | YES (continuous) |
| **Requires code access?** | NO (black-box) | YES (code instrumentation) | YES (SDK/instrumentation) |
| **Overridable?** | NO (authority is binding) | YES (tests can be marked expected fail) | N/A (advisory only) |

---

## FINAL POSITIONING STATEMENT

**Guardian is the gating authority that decides whether a website is safe to launch based on observed user reality, not code assumptions or continuous metrics.**

Unlike testing tools, Guardian's verdict is binding and gates deployments. Unlike monitoring tools, Guardian is lightweight, requires no code instrumentation, and runs on-demand before and after launch. Guardian answers one question only: "Will launching this now break real users?"

---

## EVIDENCE FOR POSITIONING

**Pre-deployment gating authority:**
- [README.md](../../README.md): "The final decision authority before launch"
- [action.yml](../../action.yml): "fail-on" input shows Guardian is a CI/CD gate
- [PRODUCT_IDENTITY.md](../../PRODUCT_IDENTITY.md): "An authority that cannot be bypassed"

**Black-box, observation-based:**
- [bin/guardian.js](../../bin/guardian.js): `guardian reality --url <url>` requires only URL, no code
- [docs/PRODUCT.md](../PRODUCT.md): "Works on any website, regardless of tech stack"
- [src/guardian/browser.js](../../src/guardian/browser.js): Real browser automation, not code parsing

**Non-bypassable authority:**
- [PRODUCT_IDENTITY.md](../../PRODUCT_IDENTITY.md): "No overrides. No force-ready."
- [src/guardian/final-outcome.js](../../src/guardian/final-outcome.js): Precedence rules ensure DO_NOT_LAUNCH always dominates

**Real user reality focus:**
- [README.md](../../README.md): "Based on real user reality"
- [src/guardian/attempt-registry.js](../../src/guardian/attempt-registry.js): Pre-defined flows mimic real user goals (not code paths)
- [src/guardian/human-journey-context.js](../../src/guardian/human-journey-context.js): Contextualizes user intent, not code execution

---

## WHAT GUARDIAN IS NOT (For clarity)

- **Not a test framework** — No assertions, no expect() statements, no setup/teardown
- **Not a monitoring system** — No continuous data collection, no long-term persistence
- **Not a QA tool** — No bug finding, no recommendations, no auto-fixes
- **Not a deployment tool** — No orchestration, no configuration, no infrastructure management
- **Not a security scanner** — No vulnerability analysis, no penetration testing
- **Not a performance profiler** — No load testing, no metrics collection

---

**Clarity score:** 9/10  
**Ambiguities remaining:** One minor: "Reality-Based Launch Gating" is clearer than "Deployment Decision Authority" to non-technical readers, but "Deployment Decision Authority" is more precise for technical buyers. Both are defensible.
