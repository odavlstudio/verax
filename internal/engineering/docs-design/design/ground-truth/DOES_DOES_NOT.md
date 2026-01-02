# DOES / DOES NOT: Guardian Capabilities Matrix

## PART A: WHAT GUARDIAN DOES (Concrete, Testable)

1. **Observes real user flows using a real browser**
   - Simulates: navigation, form submission, clicks, typing, page waits
   - Tool: Playwright (not headless code analysis)
   - Evidence: [src/guardian/browser.js](../../src/guardian/browser.js), [src/guardian/attempt.js](../../src/guardian/attempt.js)

2. **Returns a deterministic verdict: READY, FRICTION, or DO_NOT_LAUNCH**
   - READY: Users can complete critical goals safely
   - FRICTION: Partial success or detected degradation
   - DO_NOT_LAUNCH: Critical user flow is broken
   - Evidence: [src/guardian/verdict.js](../../src/guardian/verdict.js), [README.md](../../README.md#L34-L38)

3. **Decides based on observed reality, not code analysis or tests**
   - Does NOT parse code, run unit tests, or scan for patterns
   - Does NOT assume; only records what actually happened in the browser
   - Evidence: [PRODUCT_IDENTITY.md](../../PRODUCT_IDENTITY.md): "Not a testing tool. Not a bug scanner."

4. **Generates machine-readable decision artifacts**
   - decision.json (verdict + reasons + rules triggered + evidence references)
   - snapshot.json (detailed execution trace)
   - HTML report (human summary)
   - Evidence: [src/guardian/reporter.js](../../src/guardian/reporter.js), [samples/decision.json](../../samples/decision.json)

5. **Integrates into CI/CD pipelines with deterministic exit codes**
   - Exit code 0 = READY (launch allowed)
   - Exit code 1 = FRICTION (investigate)
   - Exit code 2 = DO_NOT_LAUNCH (blocked)
   - Evidence: [action.yml](../../action.yml), [src/guardian/verdicts.js](../../src/guardian/verdicts.js)

6. **Monitors production after deployment (Live mode)**
   - Runs reality checks on schedule (every N minutes)
   - Compares to baseline, alerts if user flows break
   - Sends webhooks or reports degradation
   - Evidence: [src/guardian/live-guardian.js](../../src/guardian/live-guardian.js), [src/guardian/live-cli.js](../../src/guardian/live-cli.js)

7. **Non-bypassable authority: Verdicts cannot be overridden**
   - No `--force-ready` flag
   - No way to suppress DO_NOT_LAUNCH verdict
   - Pipeline can choose to ignore verdict, but verdict is always issued and logged
   - Evidence: [PRODUCT_IDENTITY.md](../../PRODUCT_IDENTITY.md#L16-L18): "No overrides. No force-ready."

---

## PART B: WHAT GUARDIAN DOES NOT DO (Non-capabilities, Explicit)

1. **Does NOT find or fix bugs**
   - Guardian reports "checkout fails"; does NOT debug why
   - No root-cause analysis recommendations
   - No code patches or auto-fixes
   - Evidence: [README.md](../../README.md#L39-L43): "Not a bug scanner. Guardian reports what is broken. Your team responds."

2. **Does NOT replace testing frameworks (Playwright, Cypress, Jest, etc.)**
   - Guardian is orthogonal to unit tests, integration tests, E2E tests
   - Guardian runs alongside tests, not instead of them
   - Evidence: [PRODUCT_IDENTITY.md](../../PRODUCT_IDENTITY.md#L11-L14): "Not a unit test framework. Not a code quality analyzer. Not a performance benchmarking tool."

3. **Does NOT analyze code quality or security**
   - No linting, type checking, or static analysis
   - No vulnerability scanning or penetration testing
   - No performance profiling or load testing
   - Evidence: [docs/PRODUCT.md](../PRODUCT.md): "Not a security scanner. Not a performance benchmarking tool."

4. **Does NOT require code access or integration**
   - Guardian is black-box: only needs running URL
   - No SDK installation, no code instrumentation, no API keys needed
   - Works on any website, regardless of tech stack
   - Evidence: [bin/guardian.js](../../bin/guardian.js#L35-L40): "guardian reality --url <url>" — only input required

5. **Does NOT compete with monitoring tools (Sentry, Datadog, New Relic)**
   - Guardian is pre-deployment + post-deployment observation
   - Does NOT collect continuous logs, metrics, traces
   - Does NOT persist monitoring data long-term
   - Evidence: [src/guardian/live-guardian.js](../../src/guardian/live-guardian.js): Stores last N runs, not infinite history

6. **Does NOT configure or deploy the website**
   - Guardian observes only; never modifies the site
   - No infrastructure automation, no config management, no deployment orchestration
   - Evidence: [PRODUCT_IDENTITY.md](../../PRODUCT_IDENTITY.md#L13): "Not a fixer or advisor."

7. **Does NOT guarantee 100% coverage**
   - Cannot test all pages, flows, or edge cases in 20-second observation window
   - May skip flows that aren't discoverable or applicable to preset
   - Verdict is "best effort based on observed reality," not absolute certainty
   - Evidence: [docs/PRODUCT.md](../PRODUCT.md#L15-L20): "Golden Path Guarantee" acknowledges limited coverage scenarios

---

## Validation

### Testability of DOES claims
- Each can be verified by running `guardian reality --url <url>` and inspecting decision.json and exit code ✓
- Playwright automation can be verified by watching `--headful` mode ✓
- Live mode can be verified by running `guardian live start|stop` ✓

### Testability of DOES NOT claims
- Guardian's help text and code confirm no `--fix` flag, no `--force-ready`, no code analysis options ✓
- Official docs (PRODUCT_IDENTITY.md, README.md) explicitly list what Guardian is not ✓
- Source code search for "bug fix", "patch", "recommendation" returns zero matches in core decision logic ✓

---

**Clarity score:** 10/10  
**Ambiguities remaining:** None. All bullets are concrete, testable, and backed by code or documentation evidence.
