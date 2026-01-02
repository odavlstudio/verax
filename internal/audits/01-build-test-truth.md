# Build/Test Truth Run with Evidence
**Generated:** 2026-01-01  
**Purpose:** Capture baseline state of build/test/lint - identify all failures and warnings

---

## 1. Clean Install Status

### Decision
**Kept existing installation** - node_modules and package-lock.json already present  
**Command used:** None (tests run directly)  
**Rationale:** Dependencies already installed, lockfile present, avoiding unnecessary reinstall

---

## 2. Test Suite Execution

### Command
```bash
npm test
```

### Exit Code
**✅ 0 (PASSED)**

### Test Results Summary

| Test Suite | Status | Duration | Details |
|------------|--------|----------|---------|
| cli-validation.test.js | ✅ PASSED | < 1s | CLI validation failures are strict and predictable |
| mvp.test.js | ✅ PASSED | ~3s | Basic crawl and report generation |
| stage4-security.test.js | ✅ PASSED | ~10s | Security & data safety, sanitization, network safety |
| stage5-ci-gate.test.js | ✅ PASSED | < 1s | CI gate mode, exit codes, advisory vs gate |
| stage5-error-handling.test.js | ✅ PASSED | ~2s | Error decision write, fail-safe wrapper, traversal protection |
| stage6-verdict-card.test.js | ✅ PASSED | < 1s | Verdict card generation, severity, business impact |
| stage7-watchdog-simple.test.js | ✅ PASSED | ~2s | Watchdog mode, baseline comparison, degradation detection |
| obs-logger.test.js (Node test runner) | ✅ PASSED | ~93ms | Logging, error capture, path containment (3/3 tests) |
| **test:contracts** (Mocha) | ✅ PASSED | ~9s | **26 contracts passed** |

### Contract Tests Breakdown (26 tests)
- **CONTRACT A:** CI Gate Default Strict Behavior (3 tests)
- **CONTRACT B:** Exit Code Truth Table (5 tests)
- **CONTRACT C:** Filesystem Containment (4 tests)
- **CONTRACT D:** Always-Log Evidence (7 tests)
- **CONTRACT E:** Scheduler Safety Guarantees (7 tests)

### Total Tests
- **All test suites:** ✅ PASSED
- **Contract tests:** 26/26 ✅
- **Node test runner:** 3/3 ✅
- **Total:** ~30+ test cases

### Timing
- **Total test run:** ~27 seconds
- **Longest suite:** stage4-security (~10s)
- **Fastest suite:** stage5-ci-gate (<1s)

---

## 3. Lint Execution

### Command
```bash
npm run lint
```

### Exit Code
**✅ 0 (PASSED)**

### Result
**NO ERRORS** - ESLint passed cleanly with no warnings or errors.

**Configuration:**
- Linter: ESLint 8.57.0
- No Prettier detected
- Command: `eslint .`

---

## 4. Build Execution

### Command
```bash
npm run build
```
(which runs `npm run pack:verify` → `npm pack --dry-run`)

### Exit Code
**✅ 0 (PASSED)**

### Result
**Package verification successful**

**Package Stats:**
- Package name: `@odavl/guardian@2.0.0`
- Tarball size: **326.2 KB** (compressed)
- Unpacked size: **1.4 MB**
- Total files: **164**
- Shasum: `2828fbba72349317f974bcf6c8c50901fbd90ae2`

**Included files breakdown:**
- 1 README, LICENSE, CHANGELOG
- 1 bin/ (79.0kB guardian.js)
- 4 folders: flows/, policies/, config/, src/
- 164 JavaScript files (src/guardian/, src/enterprise/, src/founder/, src/recipes/, etc.)

---

## 5. CLI Launch Test

### Command
```bash
node bin/guardian.js --help
```

### Exit Code
**✅ 0 (PASSED)**

### Output
CLI launched successfully and displayed help message with:
- Quick start instructions
- Common options
- VS Code integration
- Advanced commands
- Examples
- Config instructions
- Documentation links

### Evidence Log
Every CLI invocation creates evidence log:
- **Log path:** `.odavlguardian\logs\run-<hash>.log`
- **Confirmed:** Evidence logging is working

---

## 6. Warnings & Suspicious Patterns

### ⚠️ Recurring Warnings in Tests

#### 1. META.json Write Failures (repeated 5x)
```
❌ Failed to write META.json: runDir must stay within artifacts base directory: C:\Users\sabou\odavlguardian\.odavlguardian
```

**Impact:** Medium  
**Location:** Multiple test runs (mvp, stage4-security)  
**Symptom:** Path containment check rejecting .odavlguardian as base  
**Hypothesis:** Path safety logic may be overly strict for default artifact directory

#### 2. Latest Pointers Update Failures (repeated 5x)
```
❌ Failed to update latest pointers: Cannot read properties of null (reading 'timestamp')
```

**Impact:** Medium  
**Location:** Following META.json failures  
**Symptom:** Null pointer when updating latest pointers  
**Hypothesis:** Dependent on META.json write success

#### 3. Feature Not Yet Implemented Warnings

```
⚠️ networkSafety not populated (feature not yet implemented)
⚠️ Network request tracking not available (feature not yet implemented)
```

**Impact:** Low (informational)  
**Location:** stage4-security tests  
**Status:** Known missing features

#### 4. Scheduler State Quarantine (intentional test)
```
Scheduler state quarantined (url invalid). Moved to ...schedules.quarantine-*.json
```

**Impact:** None (expected behavior in contract test)  
**Location:** CONTRACT E scheduler safety test  
**Status:** Working as intended

---

## 7. Failing Tests List

### Count: **0**

**All tests passed.** No failing tests detected.

---

## 8. Stack Traces / Error Details

### Top 10 Most Suspicious Errors

| # | Error | Severity | Count | Location | Symptom |
|---|-------|----------|-------|----------|---------|
| 1 | META.json write failure | MEDIUM | 5x | mvp.test.js, stage4-security.test.js | Path containment rejection for .odavlguardian |
| 2 | Latest pointers null read | MEDIUM | 5x | Same as #1 | Null dereference after META.json failure |
| 3 | networkSafety not implemented | LOW | 1x | stage4-security.test.js | Known gap - network monitoring |
| 4 | Network request tracking unavailable | LOW | 1x | stage4-security.test.js | Known gap - request tracking |
| 5-10 | None | - | - | - | No other errors |

---

## 9. Node Deprecation Warnings

### Detected: **NONE**

No Node.js deprecation warnings emitted during test/build/lint runs.

### Experimental Warnings: **NONE**

No experimental API warnings detected.

---

## 10. Timing Analysis

| Operation | Duration | Notes |
|-----------|----------|-------|
| npm test | ~27s | Includes 30+ tests + Playwright browser launches |
| npm run lint | < 1s | Clean pass, no errors |
| npm run build | ~2s | Pack verification |
| guardian --help | < 1s | Fast CLI startup |
| **Total** | **~30s** | Reasonable for integration test suite |

### Slowest Test Suites
1. **stage4-security.test.js** - ~10s (3 Playwright browser runs)
2. **test:contracts** (Mocha) - ~9s (26 contract tests with spawns)
3. **mvp.test.js** - ~3s (browser + artifacts)
4. **obs-logger.test.js** - ~93ms (Node test runner overhead)

---

## 11. Summary

### Build Health: ✅ **GREEN**

| Category | Status | Issues |
|----------|--------|--------|
| **Tests** | ✅ PASS | 0 failures |
| **Lint** | ✅ PASS | 0 errors/warnings |
| **Build** | ✅ PASS | Package created |
| **CLI** | ✅ PASS | Launches correctly |

### Key Strengths
1. ✅ **All tests passing** - 30+ tests, 0 failures
2. ✅ **Clean lint** - No ESLint errors
3. ✅ **Contracts enforced** - 26/26 contracts passing
4. ✅ **No deprecation warnings** - Clean Node.js 20 compatibility
5. ✅ **Fast builds** - Build completes in ~2s
6. ✅ **Evidence logging works** - All CLI runs create logs

### Issues Requiring Investigation (Not Blockers)
1. ⚠️ **META.json write failures** (5x) - Path containment logic may be too strict for default .odavlguardian directory
2. ⚠️ **Latest pointers null reads** (5x) - Cascading from META.json failure
3. ℹ️ **Missing features** - Network safety tracking (acknowledged gaps)

### Blocker Assessment
**NONE** - All critical paths work. Warnings are non-fatal and tests pass despite them.

### Recommended Next Steps
1. Investigate why .odavlguardian is rejected by path safety (likely relative path resolution issue)
2. Add null checks before accessing META.json-derived data
3. Implement network safety tracking (low priority, feature gap)

---

## 12. Log Files Reference

All raw logs saved to `audit/logs/`:
- `test.log` - Full test output (884 lines)
- `lint.log` - ESLint output (clean)
- `build.log` - npm pack dry-run output
- `cli-help.log` - CLI help screen output
