# CORE_PROMISE: Guardian's Value Contract

---

## THE PROBLEM

**Shipping websites to production is high-risk because decisions are made on assumptions, not reality.**

Teams run tests, code reviews, and staging checks — all important — but these are developer-centric validations. They don't answer the question that matters at launch: "Can a real user complete their goal on this live site?"

A real user will:
- Encounter the actual network conditions of their region
- Use the website exactly as designed (not via automated tests)
- Expect the critical flows to work (checkout, signup, login, navigation)
- Notice if the site is broken

But a deployment team must decide whether to launch *without observing the site as a real user would.* They rely on test results, code reviews, and staging environments — all proxies for reality, not reality itself.

**Result:** Broken user flows ship to production. Teams react after the damage. Customer trust erodes.

---

## GUARDIAN'S PROMISE

**Before you launch, Guardian will observe your website exactly as a real user will, and tell you whether launch is safe.**

Guardian:
1. Opens a real browser
2. Navigates to your site
3. Executes the user flows you care about (navigation, forms, checkout, etc.)
4. Reports whether those flows completed successfully
5. Issues a clear verdict: **READY** (safe to launch), **FRICTION** (investigate), or **DO_NOT_LAUNCH** (blocked)

This verdict is **binding** — it cannot be overridden. If Guardian says unsafe, the site stays down until fixed.

After launch, Guardian continues to monitor. If a user flow breaks in production, Guardian alerts your team in real-time.

---

## PROOF MECHANISM

### How Guardian observes
- **Real browser automation** ([src/guardian/browser.js](../../src/guardian/browser.js)): Uses Playwright to launch Chromium and execute real interactions
- **Pre-defined user flows** ([src/guardian/attempt-registry.js](../../src/guardian/attempt-registry.js)): Each flow simulates a real user goal (e.g., "user navigates home → clicks CTA → reaches goal")
- **Attempt execution** ([src/guardian/attempt.js](../../src/guardian/attempt.js)): Runs each flow, records pass/fail, captures screenshots and traces

### How Guardian decides
- **Verdict computation** ([src/guardian/verdict.js](../../src/guardian/verdict.js)): Scores confidence (coverage, evidence, penalties) and maps to READY/FRICTION/DO_NOT_LAUNCH
- **Policy evaluation** ([src/guardian/policy.js](../../src/guardian/policy.js)): Applies policy rules (preset-based: startup, saas, enterprise, custom)
- **Final authority** ([src/guardian/final-outcome.js](../../src/guardian/final-outcome.js)): Merges all signals into deterministic verdict; DO_NOT_LAUNCH dominates everything

### How Guardian proves the verdict
- **decision.json** ([samples/decision.json](../../samples/decision.json)): Machine-readable verdict + reasons + triggered rules + evidence hashes
  ```json
  {
    "finalVerdict": "READY",
    "exitCode": 0,
    "reasons": [
      {
        "ruleId": "all_goals_reached",
        "message": "All critical flows executed successfully and goals reached",
        "category": "COMPLIANCE",
        "priority": 50
      }
    ]
  }
  ```
- **Exit codes** ([src/guardian/verdicts.js](../../src/guardian/verdicts.js)): Deterministic shell exit codes
  - 0 = READY
  - 1 = FRICTION
  - 2 = DO_NOT_LAUNCH
- **HTML report** ([src/guardian/html-reporter.js](../../src/guardian/html-reporter.js)): Human-readable summary with screenshots, flow outcomes, market impact
- **Snapshot** ([src/guardian/snapshot.js](../../src/guardian/snapshot.js)): Detailed execution trace with timestamps, selectors, errors, hashes for verification
- **Network trace** ([src/guardian/network-trace.js](../../src/guardian/network-trace.js)): HAR format network recording for debugging

### How Guardian gates deployments
- **GitHub Action** ([action.yml](../../action.yml)): Runs Guardian as CI/CD step, returns verdict as action output, pipeline respects exit code
- **CI mode output** ([src/guardian/ci-mode.js](../../src/guardian/ci-mode.js)): Formatted verdict-first output for pipeline parsing
- **Exit code enforcement** ([bin/guardian.js](../../bin/guardian.js)): Process exits with 0/1/2, pipeline blocks on code 2

### How Guardian monitors post-launch
- **Live Guardian** ([src/guardian/live-guardian.js](../../src/guardian/live-guardian.js)): Scheduled execution (every N minutes)
- **Baseline comparison** ([src/guardian/live-baseline-compare.js](../../src/guardian/live-baseline-compare.js)): Detects when flow outcomes regress vs. known-good baseline
- **Alerting** ([src/guardian/live-alert.js](../../src/guardian/live-alert.js)): Generates alerts for regressions, sends webhooks, notifies team
- **Live state** ([src/guardian/live-state.js](../../src/guardian/live-state.js)): Persists schedule, baseline, last run state for continuous monitoring

### How Guardian guarantees authority
- **Non-overridable verdict** ([PRODUCT_IDENTITY.md](../../PRODUCT_IDENTITY.md)): "No overrides. No force-ready. No silent failures."
- **Deterministic precedence** ([src/guardian/final-outcome.js](../../src/guardian/final-outcome.js)): DO_NOT_LAUNCH always dominates; no situation where FRICTION or insufficient evidence can be silently ignored
- **Explicit audit trail** ([src/enterprise/audit-logger.js](../../src/enterprise/audit-logger.js)): Every decision is logged with full context for compliance

---

## THE GUARANTEE

If Guardian says **READY**, you can deploy with confidence that **the real user flows that matter actually work.**

If Guardian says **DO_NOT_LAUNCH**, the site **is broken for real users** in a way that matters, and **the launch is blocked.**

This is not a confidence level. This is not a suggestion. This is a binding verdict.

---

**Clarity score:** 9/10  
**Ambiguities remaining:** One minor: "real user" is operationally defined as "user flow simulated by Playwright," not an actual human. This is intentional and explicit in the design, but some users might initially interpret "real" as "actual human testing," which Guardian does not do.
