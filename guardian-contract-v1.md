# Guardian Contract v1

**Applicability:** v2.0.0 and later

**Status:** Permanent. Violations require MAJOR version bump.

---

## What Is Guardian?

Guardian is a **deterministic browser automation testing tool** that:

- Executes real user flows in a real browser (Chromium via Playwright)
- Produces verdicts about flow health: READY, FRICTION, or DO_NOT_LAUNCH
- Logs evidence as JSON for CI/CD pipelines and human review
- Runs locally or in CI/CD without external dependencies

Guardian is **NOT:**
- A security scanner
- A performance profiler
- A visual regression tool
- A load testing tool
- A replacement for manual testing

---

## Core Guarantees

Guardian makes 4 permanent guarantees:

### 1. Deterministic Verdicts

**The Guarantee:**
> Same input → Same output. Running the same flow twice produces the same verdict.

**Why It Matters:**
- CI/CD pipelines must make reliable decisions
- Non-deterministic verdicts make gates unreliable
- If a flow passes once and fails next, the pipeline is broken

**How We Enforce It:**
- Browser state is fully isolated between runs (`--filesystem-isolation`)
- No external service dependencies (except your app)
- Verdict logic is pure (no randomness, no time-dependent decisions)
- Contract test: `test/contracts/contract-exit-codes.test.js`

**What This Means For You:**
- If flow X produces READY verdict, it will always produce READY (given same network, browser state)
- If it sometimes fails, something else changed (network, app state, browser version)
- Flaky tests are not Guardian's responsibility—they're your app's responsibility

---

### 2. Single Source of Truth

**The Guarantee:**
> Guardian produces exactly one verdict per flow run, with full evidence logged.

**Why It Matters:**
- CI/CD decisions must be unambiguous
- "Did the flow pass?" must have one answer, not multiple conflicting signals
- You cannot have Guardian say both READY and FRICTION for the same run

**How We Enforce It:**
- One verdict per execution (not per page, not per assertion)
- All evidence is logged before verdict is rendered
- Evidence is complete and immutable
- Contract test: `test/contracts/contract-observability.test.js`

**What This Means For You:**
- One flow run = one verdict in the JSON report
- All evidence is in the report (no hidden signals)
- Verdict is final; Guardian doesn't change it mid-execution

---

### 3. No Blind Execution

**The Guarantee:**
> Guardian logs what it's doing in real-time. You see evidence as it executes.

**Why It Matters:**
- "Blinding" is when a tool executes but you don't know what happened
- Silent failures are worse than loud failures
- You need visibility to debug and trust the verdict

**How We Enforce It:**
- Every action (click, input, wait, navigation) is logged
- Evidence includes:
  - Selector attempts and success/failure
  - Wait outcomes (success, timeout, elements found)
  - Network activity observed
  - Screenshots at key points
  - Console messages and errors
- No test runs in "silent mode"
- Contract test: `test/contracts/contract-observability.test.js`

**What This Means For You:**
- If a step fails, evidence shows exactly why
- If a step succeeds, evidence shows what was found and how
- No mystery failures; full execution trail is captured

---

### 4. Honest Reporting

**The Guarantee:**
> Guardian reports what it actually observed, not what it thinks you want to hear.

**Why It Matters:**
- Dishonest verdicts break trust
- "Passing" a flow that has problems leads to bad deployments
- You need to know real flow health, not optimistic assessments

**How We Enforce It:**
- Verdicts are evidence-based, not assumption-based
- READY means evidence supports it will work for users
- FRICTION means some users will struggle
- DO_NOT_LAUNCH means unacceptable user experience
- No "maybe it's fine" verdicts
- All evidence is exposed for human review

**What This Means For You:**
- READY is trustworthy for deploying to production
- FRICTION requires investigation or mitigation
- DO_NOT_LAUNCH is a real blocker
- Verdict reflects reality, not politics or pressure

---

## Verdict Definitions

### READY (Exit Code 0)

**Meaning:** The flow is production-ready.

**Conditions:**
- All critical user actions succeeded
- Flow completes within time budget
- No blocking errors or timeouts
- Selectors resolved as expected
- User can complete their goal

**Confidence:** Medium-to-high. Guardian observed successful execution.

**Action:** Safe to deploy.

---

### FRICTION (Exit Code 1)

**Meaning:** The flow works, but users will struggle.

**Conditions:**
- Flow completes but with friction indicators:
  - Slow page loads (>3s)
  - Multiple selector retries needed
  - Non-critical elements timeout
  - Network latency observed
  - Poor form UX patterns detected
  - Unclear error messages

**Confidence:** Medium. Guardian observed completion but with pain points.

**Action:** Investigate and fix before deploying. Or deploy with acceptance of user frustration.

---

### DO_NOT_LAUNCH (Exit Code 2)

**Meaning:** The flow is broken. Do not deploy.

**Conditions:**
- Critical flow failures:
  - Primary user action blocks (selector not found, permission denied)
  - Flow times out completely
  - Page crashes or refuses to load
  - Network cannot reach app
  - Unhandled JavaScript errors
  - Data validation rejects user input

**Confidence:** High. Guardian observed blocker conditions.

**Action:** Fix the issue before deploying. This is a gate failure.

---

### ERROR (Exit Code 3)

**Meaning:** Guardian itself crashed or could not produce a verdict.

**Conditions:**
- Guardian process failure:
  - Browser crash (Playwright could not connect)
  - Test file syntax error
  - Configuration invalid
  - Guardian internal exception
  - Timeout in Guardian itself (not the app)

**Confidence:** None. No verdict produced.

**Action:** Fix Guardian or test setup, then re-run.

---

## Exit Code Truth Table

```
┌─────────────────┬──────────────────┬──────────────────┐
│ Verdict         │ Exit Code        │ CI Pipeline      │
├─────────────────┼──────────────────┼──────────────────┤
│ READY           │ 0                │ ✅ PASS (deploy) │
│ FRICTION        │ 1                │ ⚠️  WARNING       │
│ DO_NOT_LAUNCH   │ 2                │ ❌ FAIL (block)  │
│ ERROR           │ 3                │ ❌ FAIL (error)  │
└─────────────────┴──────────────────┴──────────────────┘
```

**Exit codes are permanent contracts.** Changing them requires MAJOR version bump.

---

## Confidence Model

Guardian assigns a confidence level to each verdict:

### High Confidence

Verdict is based on direct observation:
- Guardian directly invoked the user action
- User action succeeded or failed visibly
- Evidence is complete and unambiguous

Example: "Selector #submit-button clicked successfully" → High confidence verdict

### Medium Confidence

Verdict is based on indirect signals:
- Guardian observed timeouts or retries
- Multiple strategies used (fallback selectors)
- Evidence is present but incomplete

Example: "Flow completed after 5 selector retries" → Medium confidence verdict

### Low Confidence

Verdict is based on assumptions:
- Limited visibility into what happened
- Evidence is sparse
- Multiple interpretations possible

Example: "App didn't crash, so assuming flow worked" → Low confidence verdict

**Guardian prefers low or uncertain verdicts over high false confidence.**

---

## Behavioral Contracts

Guardian enforces 4 permanent behavioral contracts via test suite:

### Contract 1: CI Gate Default Is Strict

**File:** `test/contracts/contract-ci-gate.test.js`

**The Contract:**
```
Default CI gate behavior rejects anything less than READY
```

**What This Means:**
- Running `guardian --ci` without explicit `--friction-allowed` fails if verdict is FRICTION
- Only READY verdicts (exit code 0) pass CI gate by default
- CI pipelines don't accidentally deploy FRICTION flows

**Violation:** If `--ci` mode accepts FRICTION by default, contract is broken → MAJOR version bump required

---

### Contract 2: Filesystem Containment

**File:** `test/contracts/contract-filesystem.test.js`

**The Contract:**
```
Guardian cannot read/write outside --runtime-root
```

**What This Means:**
- Guardian cannot escape to parent directories
- Guardian cannot read system files (unless explicitly in flow)
- Guardian cannot write to arbitrary locations
- Filesystem is isolated to `--runtime-root` or `/tmp/guardian-***`

**Violation:** If Guardian reads `/etc/passwd` without permission, contract is broken → MAJOR version bump required

---

### Contract 3: Always-Log Evidence

**File:** `test/contracts/contract-observability.test.js`

**The Contract:**
```
Every Guardian action is logged before verdict is produced
```

**What This Means:**
- No hidden actions (what you see is what Guardian did)
- Evidence is complete before verdict
- Verdict output includes full action log
- You can audit exactly what happened

**Violation:** If Guardian produces READY verdict without logging steps, contract is broken → MAJOR version bump required

---

### Contract 4: Scheduler Safety Guarantees

**File:** `test/contracts/contract-scheduler.test.js`

**The Contract:**
```
Guardian respects time limits and prevents runaway execution
```

**What This Means:**
- `--timeout` flag works and Guardian stops when time expires
- No infinite loops or blocked processes
- Browser cleanup happens even if flow fails
- Resource cleanup is guaranteed

**Violation:** If Guardian ignores `--timeout` and runs forever, contract is broken → MAJOR version bump required

---

## Evidence Artifacts

Guardian produces 3 artifacts per run:

### 1. JSON Report

```json
{
  "verdict": "READY",
  "confidence": "medium",
  "exitCode": 0,
  "actions": [
    {
      "type": "navigate",
      "url": "https://example.com/login",
      "success": true
    },
    {
      "type": "click",
      "selector": "#email",
      "success": true
    },
    {
      "type": "input",
      "selector": "#password",
      "success": true
    }
  ],
  "observations": {
    "pageLoad": 1250,
    "domReady": 890,
    "interactive": 1200
  },
  "errors": []
}
```

**Contains:**
- Verdict and confidence
- Action-by-action log
- Performance metrics
- Errors and warnings

---

### 2. Screenshots (Optional)

```
artifacts/
  ├─ login-flow-start.png
  ├─ login-flow-email-filled.png
  └─ login-flow-success.png
```

**Contains:**
- Browser state at key points
- Visual evidence of selector success
- Error states (if applicable)

---

### 3. Console Logs

```
2024-01-15T10:22:34Z [guardian] Starting flow: login
2024-01-15T10:22:35Z [browser] Page.navigate: https://example.com/login
2024-01-15T10:22:36Z [guardian] Action: click #email
2024-01-15T10:22:37Z [guardian] Action: input password
2024-01-15T10:22:38Z [guardian] Verdict: READY
```

**Contains:**
- Timeline of all actions
- Timing information
- Selector resolution details
- Final verdict and reason

---

## Non-Guarantees

Guardian makes **NO guarantees about:**

### Security

- Guardian does not scan for vulnerabilities
- Guardian does not verify HTTPS certificates
- Guardian does not detect malware
- Use a security scanner in addition to Guardian

### Performance

- Guardian does not set performance budgets
- Guardian does not fail slow pages automatically
- FRICTION verdict indicates slowness; you must decide acceptable threshold
- Use a performance tool (Lighthouse, WebPageTest) for detailed analysis

### Accessibility

- Guardian does not test accessibility (a11y)
- Guardian does not verify keyboard navigation
- Guardian does not check color contrast or ARIA
- Use an a11y tool (axe, Lighthouse) for accessibility testing

### Compliance

- Guardian does not verify GDPR, HIPAA, PCI compliance
- Guardian does not audit data protection
- Guardian does not verify audit trails
- Use compliance tools for these checks

### Browser Coverage

- Guardian tests in Chromium only (via Playwright)
- Safari, Firefox, older Chrome versions not tested
- Mobile browsers not tested (unless specified in flow)
- Test in target browsers separately

---

## Using Guardian Safely

1. **Guardian is not your only gate.** Use in combination with:
   - Unit tests
   - Integration tests
   - Security scanning
   - Performance profiling
   - Manual QA on real devices

2. **Guardian is not a security tool.** For security-critical features:
   - Perform security code review
   - Use OWASP Top 10 testing
   - Consider penetration testing
   - Do not rely on Guardian alone

3. **Guardian is not a guarantee.** READY verdict means:
   - Flow worked under test conditions
   - Not guaranteed to work for 100% of users
   - Network, device, and browser variations exist
   - Guardian tests optimal path, not all edge cases

4. **Guardian requires maintenance.** As your app changes:
   - Update flow definitions
   - Re-test selectors
   - Adjust time budgets
   - Guardian doesn't auto-adapt

---

## Summary

Guardian provides:
- ✅ Deterministic flow testing
- ✅ Real browser execution
- ✅ Honest verdicts (READY/FRICTION/DO_NOT_LAUNCH)
- ✅ Full evidence logging
- ✅ CI/CD pipeline integration

Guardian does NOT provide:
- ❌ Security scanning
- ❌ Performance testing
- ❌ Accessibility testing
- ❌ Load testing
- ❌ 100% user coverage guarantee

Use Guardian to increase confidence in critical user flows. Use other tools for security, performance, and coverage.
