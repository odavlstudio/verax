# VERAX CORE INVARIANTS

**Status**: Constitutional - Binding  
**Authority**: Extracted from VISION.md, product-definition.js, BETA_USER_CONTRACT.md, and enforced code behavior  
**Last Reviewed**: 2026-01-18  
**Structure**: Identity Invariants (unmendable) + Scope Constraints (amendable via GOVERNANCE.md)

---

# CORE IDENTITY INVARIANTS

These rules define what VERAX IS at its foundation.

Breaking any of these rules means building a different product. They cannot be changed without abandoning VERAX's core identity.

---

## 1. THE OBSERVATION PRINCIPLE

**VERAX MUST observe real user behavior, never simulate or predict it.**

- VERAX MUST open the target application in a real browser (Playwright-based)
- VERAX MUST execute interactions as a rational user would
- VERAX MUST record what actually happens, not what should happen
- VERAX MUST NOT guess, derive, or treat user intent
- VERAX MUST NOT predict or simulate outcomes without evidence

---

## 2. THE EVIDENCE LAW

**No finding can be marked CONFIRMED without substantive evidence.**

- Substantive evidence is defined as at least one of:
  - URL/route change (window.location or client-side route state)
  - DOM mutation (element added/removed/modified)
  - Network request (HTTP call sent)
  - State mutation (application state variable changed, observable in DOM)
  - Concrete sensor data (console output, focus change, ARIA attribute change, loading indicator)

- A finding marked CONFIRMED MUST include evidence from at least one category above
- If a finding lacks sufficient evidence, it MUST be downgraded to SUSPECTED or dropped entirely
- This enforcement is non-optional and applies to all finding types

---

## 3. THE DETERMINISM PRINCIPLE

**Given the same application code, same target URL, and same interaction sequence, VERAX MUST produce identical findings and exit codes.**

- VERAX MUST use deterministic ID generation for all artifacts (no timestamps, no randomness in IDs)
- VERAX MUST sort all output deterministically (expectations, observations, findings by file→line→column→kind→value)
- VERAX MUST NOT use Date.now(), Math.random(), or crypto.randomBytes() in ID generation or expectation ordering
- Run IDs MUST be derived from content hash, not timestamp or random values
- Multiple runs against the same code and URL MUST produce byte-for-byte identical findings.json

---

## 4. THE PROMISE-EXTRACTION PRINCIPLE

**VERAX MUST extract expectations ONLY from explicit code signals, not from business logic or intent.**

- VERAX MUST extract from:
  - HTML links (href attributes)
  - Route definitions (React Router, Vue Router, Next.js routes)
  - Form submissions (form.onsubmit, onClick handlers on submit buttons)
  - Static fetch/axios calls with literal URLs
  - State mutations (useState setters, Redux dispatches, Zustand mutations)
  - Explicit navigation calls (window.location, router.push, history.pushState)

- VERAX MUST NOT extract from:
  - Business logic or intent (e.g., "this button should charge a credit card")
  - Implicit behavior (e.g., treating a POST will succeed)
  - Dynamic routes (e.g., /user/:id is not extractable without runtime data)
  - Conditional logic (e.g., "this route exists if the user is premium")

---

## 5. THE NO-GUESSING PRINCIPLE

**VERAX MUST NOT use rules, derivation, or premises in detection logic.**

- VERAX MUST NOT guess what "should" happen based on naming conventions or patterns
- VERAX MUST NOT derive business intent from code structure
- VERAX MUST NOT treat HTTP success without observing the response
- VERAX MUST NOT make premises about timing, race conditions, or asynchronous behavior
- If a promise cannot be verified with concrete evidence, the finding MUST be marked SUSPECTED or dropped
- Comments in code referencing "treat", "guess", "derive", or "rule" violate this principle

---

## 6. THE SILENCE-FAILURE DEFINITION

**A silent failure occurs when:**

1. Code explicitly promises an observable outcome (extracted by Promise Extraction Principle)
2. A user acts on that promise (interaction executed in browser)
3. No concrete evidence of the promised outcome is observed
4. No error or exception is reported

**VERAX MUST report only conditions that satisfy all four criteria above.**

---

## 7. THE FINDINGS CONTRACT

**Every finding MUST include:**

- Type (navigation_silent_failure, network_silent_failure, state_change_silent_failure, ui_feedback_silent_failure)
- Severity (CONFIRMED or SUSPECTED, as per Evidence Law)
- Interaction (what the user did)
- What was promised (code-derived expectation)
- What was observed (actual browser behavior)
- Why it matters (impact to user experience)
- Evidence (screenshots, network traces, DOM state, sensor data)
- Confidence level (derived from evidence strength and signal quality)

If any required field is missing or empty, the finding MUST be dropped or downgraded.

---

## 8. THE CI-SAFETY PRINCIPLE

**VERAX MUST provide deterministic exit codes safe for CI/CD pipelines.**

Exit code contract (mandatory):
- **0**: Run succeeded, zero findings detected
- **1**: Run succeeded, ≥1 findings detected
- **66**: Run incomplete (timeout, budget exceeded, partial observation)
- **65**: Invalid input (bad URL, missing source directory, no expectations extracted)
- **64**: CLI usage error (missing --url, invalid flags, wrong command syntax)
- **2**: Tool error (internal crash, contract violation, unrecoverable state)

Any deviation from this exit code contract is a critical bug.

---

## 9. THE ARTIFACT INTEGRITY PRINCIPLE

**All artifacts written by VERAX MUST be complete and consistent.**

- If a run begins, artifacts MUST be persisted in a standard location: `.verax/runs/<runId>/`
- Summary.json MUST always contain a digest field with accurate counts (even on failure)
- Findings.json MUST only contain findings that satisfy all contracts above
- Observation traces MUST be recorded even if findings are zero
- Cross-artifact consistency MUST be validated before writing (if summary says X findings, findings.json MUST contain X findings)
- Incomplete or inconsistent artifacts MUST exit 66 (INCOMPLETE) and clearly indicate the problem

---

## 10. THE HONESTY PRINCIPLE

**VERAX MUST be explicit about what it does and does not do.**

- VERAX MUST NOT claim to test authentication flows
- VERAX MUST NOT claim to replace QA or E2E testing
- VERAX MUST NOT claim to validate business logic
- VERAX MUST NOT claim to monitor production traffic
- VERAX MUST NOT claim full framework support for frameworks with only partial support
- VERAX MUST NOT claim detection capability for phenomena it cannot observe
- Documentation MUST match code behavior (all claims MUST be verifiable in running behavior)

---

## 11. THE FRAMEWORK-INDEPENDENCE PRINCIPLE

**VERAX MUST NOT be coupled to a single framework.**

- VERAX MUST support static HTML sites with zero framework
- VERAX MUST support multiple routing libraries (React Router, Vue Router, Next.js, etc.)
- VERAX MUST support multiple state libraries (React hooks, Redux, Vuex, Pinia, Zustand, etc.)
- VERAX MUST support multiple async patterns (callbacks, promises, async/await)
- Framework-specific code MUST be isolated and pluggable
- A finding type MUST be framework-agnostic (e.g., "navigation_silent_failure" applies to any framework)

---

## 12. THE REDACTION PRINCIPLE

**VERAX MUST automatically redact sensitive data from all artifacts.**

- VERAX MUST redact Authorization headers, cookies, and X-API-Key headers
- VERAX MUST redact JWT tokens, bearer tokens, and API keys from network traces
- VERAX MUST redact PII from query strings, request bodies, and response bodies
- Redaction MUST occur before artifacts are written to disk
- Redaction MUST be deterministic (same sensitive values → same redacted output)

---

## TIMEOUT SAFETY & INFRASTRUCTURE CENTRALIZATION

**All execution timeouts MUST be sourced from centralized configuration.**

This is an enforcement of environmental transparency and infrastructure safety.

Configuration file: `src/verax/shared/scan-budget.js`

### Requirements

1. **No hardcoded timeout literals** in execution code paths
  - Every timeout must either reference a ScanBudget property (e.g., `scanBudget.interactionTimeoutMs`)
  - OR be documented with a `// CRITICAL:` comment explaining infrastructure-specific rationale

2. **ScanBudget-Managed** (user-configurable)
  - interactionTimeoutMs, navigationTimeoutMs, initialNavigationTimeoutMs
  - settleTimeoutMs, stabilization delays, network waits
  - Can be overridden per run via environment variables

3. **Infrastructure-Specific** (environment-determined, documented)
  - browser.close() timeout (5000ms)
  - Observer sampling delays (100ms, 50ms)
  - CLI operation timeouts (doctor, init, security scanning)
  - Must be documented with CRITICAL comment explaining purpose

4. **Future expansion** of timeout values defaults to `scan-budget.js` unless explicitly infrastructure-bound

---

# CORE SCOPE CONSTRAINTS

These rules define the current operational boundaries of VERAX.

They are binding and cannot be violated without constitutional amendment (see GOVERNANCE.md Rule 5).

However, unlike Identity Invariants, these constraints may be amended if circumstances change and proper governance process is followed.

---

## 13. THE READ-ONLY PRINCIPLE (SCOPE CONSTRAINT)

**VERAX currently operates on a read-only basis, never mutating application state, data, or configuration.**

- VERAX MUST NOT send POST, PUT, PATCH, or DELETE requests
- VERAX MUST NOT modify local storage, session storage, or cookies
- VERAX MUST NOT trigger actions that persist state (payments, deletions, account changes)
- VERAX MUST run as an anonymous, unauthenticated user
- If VERAX observes a request that would mutate state, VERAX MUST block it and record the attempt
- No flag, environment variable, or configuration MUST allow this principle to be overridden in the current release

**Amendment path**: This constraint may only be changed via GOVERNANCE.md Rule 5 (constitutional amendment process). Any change would require major version bump and explicit user communication.

---

## 14. THE PRE-AUTH SCOPE CONSTRAINT

**VERAX currently operates on pre-authentication flows exclusively.**

- VERAX MUST NOT test authenticated user journeys
- VERAX MUST NOT attempt to log in, use credentials, or handle auth tokens
- VERAX MUST NOT validate authorization or permission logic
- VERAX MUST NOT test protected endpoints or authenticated routes
- Public flows (signup, marketing pages, pre-auth onboarding) are in scope
- Private flows (account settings, protected resources, admin panels) are out of scope

**Amendment path**: This constraint may only be changed via GOVERNANCE.md Rule 5 (constitutional amendment process). Expanding to authenticated flows would require:
  - New data handling policies (credentials, PII protection)
  - New documentation of test attack surface
  - Clear user opt-in for each test run
  - Major version bump

---

## 15. THE SOURCE-CODE REQUIREMENT (SCOPE CONSTRAINT)

**VERAX currently requires access to local source code.**

- VERAX is not a public-website scanner
- VERAX is not a third-party audit tool
- VERAX requires the user to provide source code via `--src` argument
- Expectations are extracted through static analysis of source files
- Without source code, VERAX cannot work

**Amendment path**: This constraint could theoretically change if remote source analysis or binary introspection became available. Any such change would require:
  - Major version bump
  - New security guarantees (how private source is protected)
  - Clear documentation that this is a different operational mode
  - GOVERNANCE.md Rule 5 amendment process

---

## CORE VIOLATION DETECTION

### Identity Invariant Violations (Rules 1-12):

Any code change that:
- Adds a feature contradicting Identity Invariants
- Removes evidence enforcement from findings
- Changes exit codes without updating CORE
- Adds non-deterministic behavior to IDs or ordering
- Attempts to test authenticated flows
- Adds opinionated intelligence or guessing logic

...is a CORE violation and MUST be rejected during code review.

### Scope Constraint Violations (Rules 13-15):

These are binding in the current release but may be formally amended per GOVERNANCE.md Rule 5.

Any violation of Scope Constraints requires:
1. Constitutional amendment via GOVERNANCE.md Rule 5
2. Major version bump
3. Explicit user communication
4. No code change until amendment is approved

---

## HOW TO USE THIS DOCUMENT

### For Identity Invariants (1-12):
1. These define VERAX's fundamental nature
2. Code MUST conform to these rules
3. Violations are critical bugs
4. No PR should be approved that breaks these rules
5. Amendment would require abandoning VERAX (not evolution, replacement)

### For Scope Constraints (13-15):
1. These define current operational boundaries
2. Code MUST conform to these rules in the current release
3. Violations are critical bugs
4. Amendment REQUIRES formal governance process (GOVERNANCE.md Rule 5)
5. Any scope change requires major version bump and user communication

### Before Adding a Feature:
1. Check if it violates any Identity Invariant 1-12 → reject immediately
2. Check if it violates any Scope Constraint 13-15 → may require amendment process
3. Check EVOLUTION.md for allowed evolution paths
4. Proceed with code review
