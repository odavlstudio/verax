# Static Risk X-Ray Analysis
**Generated:** 2026-01-01  
**Purpose:** Identify risky patterns, non-determinism, error handling issues, and coupling WITHOUT fixing

---

## 1. Core Modules Identification

### Decision Engine & Verdict Logic
**Files:**
- `src/guardian/decision-authority.js` - **Single source of truth for verdicts**
- `src/guardian/verdict.js`, `src/guardian/verdicts.js` - Verdict utilities
- `src/guardian/verdict-card.js` - Verdict formatting
- `src/guardian/verdict-policy.js` - Policy application
- `src/guardian/final-outcome.js` - Exit code mapping
- `src/guardian/rules-engine.js` - Rules evaluation

**Responsibilities:**
- Merge all signals (flows, attempts, journey, policy, baseline)
- Produce deterministic READY|FRICTION|DO_NOT_LAUNCH verdict
- Map verdict to exit codes (0|1|2|3)

**Inputs:** Flows, attempts, rules engine, journey verdict, policy eval, baseline diff, coverage, site intelligence  
**Outputs:** `{ finalVerdict, verdictSource, exitCode, reasons, confidence }`

**Error Handling:** Pure functions, no IO, explicit dependencies  
**Risky Patterns:**  
- ⚠️ Call tracker using Map + Date.now() for timestamps (Date.now risk)
- ⚠️ Silent production fallback when double-call detected (warning only)

**Coupling:** Used by `reality.js`, `smoke.js`, `flow-executor.js`, CI modes

---

### Scanners (Playwright / HTTP / DOM)

#### attempt-engine.js (1025 lines)
**Responsibilities:**
- Execute single user attempt with Playwright
- Handle steps (navigate, click, type, wait, screenshot)
- Detect SUCCESS, FAILURE, FRICTION, NOT_APPLICABLE outcomes
- Soft failure detection via validators

**Inputs:** Playwright page, attemptId, baseUrl, artifactsDir, validatorSpecs  
**Outputs:** `{ outcome, steps, timings, friction, error, validators, softFailures }`

**Error Handling:** try/catch per step with retries (maxStepRetries=2)  
**Risky Patterns:**
- ⚠️ `page.waitForTimeout(200)` - Hard-coded timing (line 116)
- ⚠️ `page.waitForTimeout(stepDef.duration || 1000)` - User-controlled timing (line 493)
- ⚠️ Custom attempts (site_smoke, primary_ctas, contact_discovery_v2) bypass base logic
- ⚠️ Retry loop with maxStepRetries (non-determinism if flaky)
- ⚠️ Console/page error listeners (side effects during execution)
- ⚠️ Broad catch blocks

**Coupling:** Heavy dependency on `attempt-registry`, `validators`, `selector-fallbacks`

#### flow-executor.js (619 lines)
**Responsibilities:**
- Execute multi-step flows (JSON-defined)
- Manage flow lifecycle (navigate, interact, wait, validate)
- Handle flow-level retries and timeouts

**Inputs:** Playwright page, flowDef, baseUrl, options  
**Outputs:** `{ success, outcome, steps, durationMs, error }`

**Error Handling:** try/catch with retries  
**Risky Patterns:**
- ⚠️ `await page.waitForTimeout(duration)` - User-controlled timing (line 386)
- ⚠️ `setTimeout(resolve, ms)` - Helper function for delays (line 619)
- ⚠️ `Date.now()` for timing measurements (lines 459, 535, 547)
- ⚠️ Fallback `startedAt || Date.now()` indicates timing state issues

**Coupling:** Uses `human-navigator`, `wait-for-outcome`, `attempt-engine`

#### journey-scanner.js (506 lines)
**Responsibilities:**
- Human journey execution (semantic user intent)
- Smart navigation and goal detection
- Retry logic with exponential backoff

**Inputs:** Browser, baseUrl, journeyDef, siteProfile  
**Outputs:** `{ outcome, steps, signals, confidence }`

**Error Handling:** Retry loops with timeout  
**Risky Patterns:**
- ⚠️ `setTimeout(() => { resolve(timeout) }, timeoutMs)` - Timeout timer (line 41)
- ⚠️ `await new Promise(r => setTimeout(r, 500 + (attempt * 200)))` - Backoff (line 184)
- ⚠️ `new Promise(r => setTimeout(r, 1000))` - Fixed delay (line 302)
- ⚠️ `\`${name}-${Date.now()}.png\`` - Screenshot naming with Date.now (line 506)
- ⚠️ Race condition: timeout vs navigation completion
- ⚠️ Exponential backoff with arithmetic (attempt * 200)

**Coupling:** Depends on `human-navigator`, `intent-detector`, `human-journey-context`

#### crawler.js (123 lines)
**Responsibilities:**
- Discover pages via links and sitemaps
- BFS crawl with depth/page limits
- Track visited URLs

**Inputs:** Playwright page, startUrl, options  
**Outputs:** `{ visited: [], discovered: Set, ... }`

**Error Handling:** try/catch per page visit  
**Risky Patterns:**
- ⚠️ Deprecated field: `linkCount` (line 85)
- ⚠️ Unbounded Set growth (discovered URLs)
- ⚠️ No network timeout enforcement

**Coupling:** Used by `reality.js`, `smoke.js`

---

### Report Generation

#### reporter.js (168 lines)
**Responsibilities:**
- Create summary reports from crawl/flow results
- Format decision structure
- Prepare artifacts directory

**Inputs:** crawlResult, baseUrl  
**Outputs:** Report JSON object

**Error Handling:** Minimal (assumes valid inputs)  
**Risky Patterns:**
- ⚠️ `Date.now()` via `new Date().toISOString()` for runId (determinism risk if parallel)
- ⚠️ Synchronous fs operations (fs.existsSync, fs.mkdirSync)
- ⚠️ No error handling for file operations

**Coupling:** Used by all scanners

#### html-reporter.js (319 lines)
**Responsibilities:**
- Generate HTML reports with embedded styles
- Evidence presentation
- Verdict cards

**Inputs:** decision object, snapshot, meta  
**Outputs:** HTML string

**Error Handling:** Template string generation (no explicit error handling)  
**Risky Patterns:**
- ⚠️ Large string concatenation
- ⚠️ No XSS escaping (assumes trusted input)

**Coupling:** Used by `reality.js`, `baseline-reporter.js`

#### junit-reporter.js (248 lines)
**Responsibilities:**
- JUnit XML output for CI integration

**Risky Patterns:**
- ⚠️ XML injection risk if attempt names contain special chars (low - controlled input)

---

### Policy & Gates

#### policy.js (444 lines)
**Responsibilities:**
- Evaluate policy rules (evidence thresholds, market criticality)
- Compute integrity scores
- Policy preset loading

**Inputs:** Policy object, snapshot, attempts, flows  
**Outputs:** `{ passed, evidence, failingThresholds }`

**Error Handling:** Graceful defaults if policy missing  
**Risky Patterns:**
- ⚠️ Policy hash computation (uses coverage %, selector confidence) - floating point comparison
- ⚠️ Market criticality string matching (soft failures if typos)

**Coupling:** Used by `decision-authority`, `reality.js`

#### ci-gate.js (64 lines)
**Responsibilities:**
- Map verdict to CI exit codes
- Advisory vs gate mode

**Inputs:** Verdict, mode  
**Outputs:** Exit code (0|1|2|3)

**Error Handling:** Validates mode enum  
**Risky Patterns:**
- ⚠️ NONE - Clean implementation

---

### Artifacts Persistence

#### snapshot.js (413 lines)
**Responsibilities:**
- Save/load snapshot JSON
- Schema validation
- Atomic file writes

**Inputs:** Snapshot object, runDir  
**Outputs:** File write, validation result

**Error Handling:** Validation errors, file write errors  
**Risky Patterns:**
- ⚠️ Synchronous fs.writeFileSync (blocking)
- ⚠️ JSON.stringify without error handling
- ⚠️ No file lock mechanism (parallel write risk)

**Coupling:** Central data persistence

#### run-export.js (412 lines)
**Responsibilities:**
- Export runs to ZIP
- HTTP POST to API with retries
- Exponential backoff

**Inputs:** runDir, exportOptions  
**Outputs:** ZIP buffer or HTTP success

**Error Handling:** Retry logic with exponential backoff  
**Risky Patterns:**
- ⚠️ `setTimeout(() => { resolve() }, delay)` - Multiple retry delays (lines 352, 373, 392)
- ⚠️ Network calls without global timeout (fetch)
- ⚠️ Retry backoff: `Math.min(1000 * Math.pow(2, attempt), 10000)` - Math.pow (deterministic but complex)

**Coupling:** Used by CLI, CI modes

---

## 2. Risky Patterns Detected

### setTimeout / sleep / waitForTimeout (23 occurrences in src/)

| File | Line | Pattern | Risk | Justification |
|------|------|---------|------|---------------|
| `attempt-engine.js` | 116 | `page.waitForTimeout(200)` | HIGH | Hard-coded timing - flakiness |
| `attempt-engine.js` | 493 | `page.waitForTimeout(stepDef.duration \|\| 1000)` | HIGH | User-controlled delay |
| `flow-executor.js` | 386 | `page.waitForTimeout(duration)` | HIGH | User-controlled delay |
| `flow-executor.js` | 619 | `setTimeout(resolve, ms)` | MEDIUM | Helper function for delays |
| `human-navigator.js` | 251 | `page.waitForTimeout(minWait)` | MEDIUM | Human-like delay (acceptable for UX simulation) |
| `intent-detector.js` | 20 | `page.waitForTimeout(100)` | LOW | Short stabilization delay |
| `journey-scanner.js` | 41 | `setTimeout(() => resolve('timeout'), timeoutMs)` | MEDIUM | Timeout mechanism |
| `journey-scanner.js` | 184 | `setTimeout(r, 500 + (attempt * 200))` | HIGH | Exponential backoff - non-determinism |
| `journey-scanner.js` | 302 | `setTimeout(r, 1000)` | MEDIUM | Fixed retry delay |
| `live-cli.js` | 86 | `setTimeout(r, intervalMinutes * 60 * 1000)` | LOW | Scheduler interval |
| `live-scheduler-runner.js` | 203, 260 | `setTimeout` | LOW | Scheduler timers |
| `retry-policy.js` | 73 | `setTimeout(resolve, 1000)` | MEDIUM | Fixed retry delay |
| `run-export.js` | 352, 373, 392 | `setTimeout` (3x) | MEDIUM | HTTP retry delays |
| `screenshot.js` | 29 | `page.waitForTimeout(100)` | LOW | Render stabilization |
| `smoke.js` | 92 | `setTimeout` | MEDIUM | Budget timeout |
| `wait-for-outcome.js` | 109 | `setTimeout` | MEDIUM | Polling mechanism |
| `watch-runner.js` | 125 | `setTimeout` | LOW | Debounce timer |
| `recipe-runtime.js` | 371, 418 | `setTimeout(r, 500)`, `setTimeout(r, 1000)` | MEDIUM | Recipe retry delays |

**Overall Assessment:** HIGH RISK - Heavy reliance on timing creates test flakiness

---

### Date.now / Math.random (50+ Date.now occurrences)

| File | Usage | Risk | Purpose |
|------|-------|------|---------|
| `decision-authority.js` | `Date.now()` for call tracker timestamp | LOW | Logging only |
| `discovery-engine.js` | `Date.now()` for timing measurements (7x) | LOW | Duration tracking |
| `env-guard.js` | `Date.now()` in temp file name | MEDIUM | Collision risk under parallel execution |
| `fail-safe.js` | `Date.now()` in error dir name | MEDIUM | Collision risk |
| `flow-executor.js` | `Date.now()` for timing (4x) | LOW | Duration measurement |
| `human-journey-context.js` | `Date.now()` for start time (3x) | LOW | Duration tracking |
| `human-navigator.js` | `Date.now()` for timing (4x) | LOW | Duration tracking |
| `journey-scanner.js` | `Date.now()` in screenshot filename | HIGH | Collision risk in parallel runs |
| `live-scheduler-runner.js` | `Date.now()` for runId + scheduling (4x) | MEDIUM | Collision risk, scheduler state |
| `live-state.js` | `Date.now()` for scheduling (5x) | MEDIUM | Scheduler timing |
| `run-cleanup.js` | `Date.now()` for age calculation | LOW | Cleanup logic |
| `smoke.js` | `Date.now()` for timing (3x) | LOW | Budget tracking |
| `wait-for-outcome.js` | `Date.now()` for timeout tracking (2x) | LOW | Polling mechanism |
| `recipe-runtime.js` | `Date.now()` for duration tracking (15x) | LOW | Timing measurements |
| `founder/usage-signals.js` | `Date.now()` for day calculation | LOW | Analytics |

**Math.random:** 0 occurrences ✅

**Overall Assessment:** MEDIUM RISK - Date.now used for IDs/filenames creates collision potential

---

### Network Calls (6 occurrences)

| File | Line | Call | Risk | Protection |
|------|------|------|------|------------|
| `webhook.js` | 85 | `fetch(webhookUrl, ...)` | MEDIUM | None - no timeout, no retry |
| `sitemap.js` | 20-173 | `fetch(url)` (5x) | MEDIUM | Follow redirects, but no timeout |

**Assessment:** MEDIUM RISK - Network calls without timeout/retry configuration

---

### Playwright page.goto Usage
*Separate search needed - likely in attempt-engine, flow-executor, journey-scanner*

Estimated occurrences: ~15-20 based on scanner count

**Typical pattern:** `await page.goto(url, { waitUntil: 'networkidle', timeout })`

**Risk:** Network-dependent, can hang if remote site slow

---

### Retry Loops (10+ occurrences)

| File | Pattern | Risk |
|------|---------|------|
| `attempt-engine.js` | Step retry loop (maxStepRetries=2) | HIGH - Can mask real failures |
| `journey-scanner.js` | Exponential backoff with attempt counter | HIGH - Non-deterministic timing |
| `retry-policy.js` | Generic retry with fixed delay | MEDIUM - Fixed delay (1s) |
| `run-export.js` | HTTP retry with exponential backoff | MEDIUM - Network-dependent |
| `recipe-runtime.js` | Recipe step retries | MEDIUM - Fixed delays |

**Assessment:** HIGH RISK - Retries mask flakiness, timing dependencies

---

### Unbounded Concurrency (Promise.all)

**Search results:** No unbounded Promise.all detected in core scanners ✅

**Playwright browser pool:** Uses `browser-pool.js` with explicit concurrency limits

---

### Hardcoded URLs

**Search needed:** Likely in test fixtures only, not production code

---

### File System Writes Outside Artifacts

| File | Operation | Risk | Protection |
|------|-----------|------|------------|
| `snapshot.js` | `fs.writeFileSync(snapshotPath, ...)` | MEDIUM | Path safety module |
| `baseline-storage.js` | `fs.writeFileSync(baselinePath, ...)` | MEDIUM | Path safety module |
| `run-export.js` | ZIP creation | LOW | In-memory buffer |
| `obs-logger.js` | Log file writes | MEDIUM | Path safety module |

**path-safety.js (42 lines):** Enforces containment with `ensurePathWithinBase()`

**Assessment:** LOW RISK - Path safety enforced

---

### Inconsistent Terminology

**Verdict terms:**
- READY (canonical)
- SUCCESS (attempt-level)
- FRICTION (canonical)
- DO_NOT_LAUNCH (canonical)
- FAILURE (attempt-level)
- INSUFFICIENT_DATA (canonical)
- ERROR (canonical)
- OBSERVED (legacy, should be SUCCESS)
- UNKNOWN (fallback)

**Assessment:** MEDIUM RISK - Mapping between attempt outcomes and verdicts requires careful handling

---

## 3. Error Handling Strategy Assessment

### Decision Engine (decision-authority.js)
**Strategy:** Pure functions, no IO, explicit error propagation  
**Quality:** ✅ EXCELLENT - No hidden failures

### Scanners (attempt-engine, flow-executor, journey-scanner)
**Strategy:** try/catch per step + retry loops  
**Quality:** ⚠️ FAIR - Broad catches, retry masking

**Example from attempt-engine.js:**
```javascript
try {
  // step execution
} catch (stepError) {
  // Retry loop
  if (attempt < this.maxStepRetries) {
    continue; // Silent retry
  }
  // Log and fail
}
```

**Issue:** Silent retries hide flakiness

### Reporters (reporter.js, html-reporter.js)
**Strategy:** Assume valid inputs, minimal error handling  
**Quality:** ⚠️ WEAK - No defense against malformed data

### Policy & Gates (policy.js, ci-gate.js)
**Strategy:** Validation + graceful defaults  
**Quality:** ✅ GOOD - Explicit mode validation

### Artifacts (snapshot.js, baseline-storage.js)
**Strategy:** File operation errors propagated  
**Quality:** ⚠️ FAIR - Synchronous operations, no lock mechanism

---

## 4. Coupling Analysis

### High Coupling (5+ dependencies)
- `reality.js` → decision-authority, policy, baseline, reporter, crawler, attempt-engine, flow-executor, journey-scanner
- `attempt-engine.js` → attempt-registry, validators, selector-fallbacks, screenshot, wait-for-outcome
- `flow-executor.js` → human-navigator, wait-for-outcome, attempt-engine, intent-detector

### Medium Coupling (3-4 dependencies)
- `journey-scanner.js` → human-navigator, intent-detector, human-journey-context
- `decision-authority.js` → verdicts, coverage-model, rules-engine
- `reporter.js` → html-reporter, junit-reporter

### Low Coupling (0-2 dependencies)
- `ci-gate.js`, `path-safety.js`, `obs-logger.js` ✅

**Assessment:** reality.js is a GOD OBJECT - orchestrates entire execution

---

## 5. Silent Failure Patterns

### Broad Catch Blocks (200+ try/catch in repo)

**High-risk locations:**
- `attempt-engine.js` - Per-step catch with retry loop
- `flow-executor.js` - Per-flow catch
- `journey-scanner.js` - Journey timeout race condition

### Silent Warnings (Not Logged)
- META.json write failures (seen in tests) - Logged to console but execution continues
- Latest pointers update failures - Logged but not fatal
- Baseline not created - Warning only

### Production Fallbacks
- `decision-authority.js` - Double-call warning in production (not error)
- Policy evaluation - Defaults to permissive if policy missing

---

## 6. Non-Determinism Sources

| Source | Severity | Locations |
|--------|----------|-----------|
| **setTimeout/waitForTimeout** | CRITICAL | 23 occurrences |
| **Date.now for IDs** | HIGH | ~15 occurrences |
| **Network timing** | HIGH | All fetch calls |
| **Retry loops** | HIGH | 10+ retry implementations |
| **Race conditions** | MEDIUM | journey-scanner timeout vs success |
| **Playwright timing** | MEDIUM | Page loads, animations, redirects |

---

## 7. Timeouts

| File | Timeout Type | Value | Risk |
|------|--------------|-------|------|
| `attempt-engine.js` | Constructor default | 30000ms | Reasonable |
| `flow-executor.js` | User-controlled | Variable | Risk if too long |
| `journey-scanner.js` | Timeout timer | Variable | Risk of premature timeout |
| `smoke.js` | Budget timer | Variable | Expected behavior |
| `wait-for-outcome.js` | Polling timeout | Variable | Risk if too short |

---

## Summary: Top 10 Risky Patterns

1. ⚠️ **23x setTimeout/waitForTimeout** - Timing dependencies throughout codebase
2. ⚠️ **50+ Date.now usages** - Collision risk in parallel execution, especially for IDs
3. ⚠️ **Retry loops with silent failures** - Masks flakiness in attempt-engine, journey-scanner
4. ⚠️ **Broad catch blocks** - Silent error swallowing in scanners
5. ⚠️ **Network calls without timeout** - fetch in webhook.js, sitemap.js
6. ⚠️ **Race conditions** - journey-scanner timeout vs success detection
7. ⚠️ **GOD OBJECT reality.js** - Orchestrates everything, high coupling
8. ⚠️ **Synchronous file operations** - Blocking fs.writeFileSync in snapshot.js
9. ⚠️ **No file lock mechanism** - Parallel write risk in artifacts
10. ⚠️ **Weak error handling in reporters** - Assumes valid inputs, no XSS escaping

**Determinism Risk Level:** HIGH  
**Reliability Risk Level:** MEDIUM  
**Security Risk Level:** LOW (path safety enforced)
