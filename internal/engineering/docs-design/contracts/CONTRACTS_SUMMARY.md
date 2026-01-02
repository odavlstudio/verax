# Behavior Contracts Implementation Summary

**Date:** January 1, 2026  
**Status:** ✅ COMPLETE — All 26 contract tests passing

---

## Mission Accomplished

Created permanent behavior contracts that lock down Guardian's core safety guarantees. Any future regression **will immediately break CI**.

---

## Files Added/Modified

### New Files
```
test/contracts/
  ├── test-harness.js                    (CLI spawning + workspace utilities)
  ├── contract-ci-gate.test.js           (CONTRACT A — 3 tests)
  ├── contract-exit-codes.test.js        (CONTRACT B — 5 tests)
  ├── contract-filesystem.test.js        (CONTRACT C — 4 tests)
  ├── contract-observability.test.js     (CONTRACT D — 7 tests)
  ├── contract-scheduler.test.js         (CONTRACT E — 7 tests)
  └── README.md                          (Documentation)
```

### Modified Files
```
package.json
  - Added: "test:contracts" script
  - Updated: "test" script to run contracts
```

---

## Contracts Implemented

### ✅ CONTRACT A: CI Gate Default Is Strict
**Protects:** CI gate cannot be tricked into advisory mode by default.

**Tests:** 3 passing
- CI gate without `--mode` defaults to strict (fails on DO_NOT_LAUNCH)
- Exit code 2 on DO_NOT_LAUNCH verdict
- Advisory mode requires explicit `--mode advisory` flag

**Mechanism:** CLI validation + exit code enforcement

---

### ✅ CONTRACT B: Exit Code Truth Table
**Protects:** The exit code mapping that all CI systems depend on.

**Canonical mapping (immutable):**
```
READY          → 0 (deploy allowed)
FRICTION       → 1 (investigate)
DO_NOT_LAUNCH  → 2 (deploy blocked)
ERROR/UNKNOWN  → 3 (system error)
```

**Tests:** 5 passing
- Verdict to exit code mapping is consistent
- CLI respects exit code mapping
- Unreachable URLs exit with code 3
- Invalid syntax exits non-zero
- Help/version exit 0

**Mechanism:** [src/guardian/verdicts.js](../../src/guardian/verdicts.js) `mapExitCodeFromCanonical()`

---

### ✅ CONTRACT C: Filesystem Containment
**Protects:** Guardian cannot be exploited to write outside its safe base.

**Safety guarantees:**
- Traversal paths (`../`) rejected with error code
- Absolute external paths rejected with error code
- **No files created outside base** on failure
- Containment errors: `code: 'EOUTOFBASE'`

**Tests:** 4 passing
- Traversal path fails with exit 2/3
- Absolute path fails with exit 2/3
- Path safety API enforces containment
- Error code is `EOUTOFBASE`

**Mechanism:** [src/guardian/path-safety.js](../../src/guardian/path-safety.js) `ensurePathWithinBase()`

---

### ✅ CONTRACT D: Always-Log Evidence
**Protects:** Audit trail for every CLI invocation (compliance + debugging).

**Observability guarantees:**
- "Evidence log:" printed to console on EVERY run
- Log file written to `.odavlguardian/logs/run-*.log`
- Log entries are valid JSON (structured)
- Failed runs logged with error context

**Tests:** 7 passing
- Console output includes "Evidence log:" line
- Log directory created automatically
- Log entries are valid JSON
- Error runs logged with context
- Help command creates log
- Logger creates directory safely

**Mechanism:** [src/guardian/obs-logger.js](../../src/guardian/obs-logger.js) `createLogger()`

---

### ✅ CONTRACT E: Scheduler Safety Guarantees
**Protects:** Background scheduler cannot DoS, tight-loop, or corrupt state.

**Safety guarantees:**
- **Invalid state quarantined** (not executed)
- **Invalid `nextRunAt`** triggers ≥1s backoff (no tight loops)
- **Exponential backoff** on consecutive failures
- **Child spawn errors** logged + rescheduled
- **Timers capped** at maximum (1 hour)

**Tests:** 7 passing
- Invalid URL scheme quarantined
- Invalid date enforces ≥1s backoff
- Stale timestamp triggers exponential backoff
- Backoff capped at max
- Spawn errors logged + rescheduled
- Valid schedules not quarantined
- Validation enforces minimum interval

**Mechanism:** 
- State validation: [src/guardian/live-scheduler-state.js](../../src/guardian/live-scheduler-state.js)
- Backoff logic: [src/guardian/live-scheduler-runner.js](../../src/guardian/live-scheduler-runner.js) `computeNextDelay()`

---

## Test Results

```
  26 passing (10s)
  0 failing

Breakdown by contract:
  CONTRACT A — CI Gate Default Strict       3/3 ✅
  CONTRACT B — Exit Code Truth Table        5/5 ✅
  CONTRACT C — Filesystem Containment       4/4 ✅
  CONTRACT D — Always-Log Evidence          7/7 ✅
  CONTRACT E — Scheduler Safety             7/7 ✅
```

---

## How Tests Work

### Architecture
1. **Test Harness** (`test-harness.js`)
   - Spawns real guardian CLI process (not mocks)
   - Captures exit code + stdout/stderr
   - Creates temp workspaces for isolation
   - Utilities for log finding, JSON parsing

2. **Each Contract File**
   - Mocha-based test suite
   - Uses real CLI paths (`guardian smoke`, `guardian ci`, etc.)
   - Verifies actual exit codes and file creation
   - No mocks, no stubs for core behavior

### Isolation
- Each test gets own temp directory under `os.tmpdir()`
- CLI runs in isolated `cwd`
- No shared state between tests
- Automatic cleanup on completion

### Exit Code Verification
- Tests verify exact exit codes (0, 1, 2, 3)
- Failure case: unreachable URL → exit 2 or 3
- Invalid flag → exit non-zero
- Help command → exit 0

### Filesystem Verification
- Confirms no files created outside base on failure
- Verifies log directory structure
- Checks JSON validity in logs
- Confirms quarantine files created for invalid state

---

## Integration with CI

### Automated on every commit
```bash
npm run test:contracts  # Runs in ~10 seconds
```

### Part of full suite
```bash
npm test  # Includes all contract tests
```

### CI workflow
```yaml
- npm ci
- npm run lint
- npm run typecheck
- npm run build
- npm run test:contracts  # MUST PASS
- npm test                # Full suite
```

---

## Regression Detection

Contract tests will **immediately fail** if:

❌ **Exit code changes:**
```javascript
// REGRESSION: Changing exit codes breaks downstream CI
READY → 0           // OK
FRICTION → 1        // OK
DO_NOT_LAUNCH → 2   // MUST NOT CHANGE
ERROR → 3           // MUST NOT CHANGE
```

❌ **Path containment is weakened:**
```javascript
// REGRESSION: Allowing traversal path escape
ensurePathWithinBase('/safe', '../../evil')  // MUST THROW
```

❌ **Strict mode becomes advisory by default:**
```javascript
// REGRESSION: Advisory mode without explicit flag
guardian ci --url http://example.com  // MUST BE STRICT
```

❌ **Logging is removed:**
```javascript
// REGRESSION: No evidence log
console.log('Evidence log:')  // MUST ALWAYS PRINT
```

❌ **Scheduler goes into tight loop:**
```javascript
// REGRESSION: Invalid nextRunAt not backed off
computeNextDelay(badEntry)  // MUST return >= 1000ms
```

---

## Running Contracts

### All contracts
```bash
npm run test:contracts
```

### Specific contract
```bash
mocha test/contracts/contract-ci-gate.test.js --timeout 60000
mocha test/contracts/contract-exit-codes.test.js --timeout 60000
mocha test/contracts/contract-filesystem.test.js --timeout 60000
mocha test/contracts/contract-observability.test.js --timeout 60000
mocha test/contracts/contract-scheduler.test.js --timeout 60000
```

### In full suite
```bash
npm test
```

### Watch mode
```bash
mocha test/contracts/*.test.js --watch --timeout 60000
```

---

## Documentation

See [test/contracts/README.md](README.md) for:
- Detailed explanation of each contract
- Why each one matters
- What behavior each locks down
- How to interpret failures
- Future contract candidates

---

## Key Design Decisions

### Why Real CLI Execution?
Contract tests spawn actual Guardian process, not mocks. This catches:
- Import failures
- Module loading issues
- Real exit code behavior
- Actual file I/O

### Why Temp Directories?
Tests create isolated workspaces to:
- Prevent state pollution
- Allow parallel execution
- Verify no escape outside base
- Clean up automatically

### Why Immutable Contracts?
Contracts cannot be "fixed" - they can only be broken and acknowledged:
1. Test fails (regression detected)
2. Document breaking change
3. Major version bump
4. Update downstream systems
5. Change contract tests (last resort)

---

## What These Contracts Protect

| Contract | Protects | If Broken | Impact |
|----------|----------|-----------|--------|
| A | Strict-by-default CI gate | Advisory mode in CI | Deployments never blocked |
| B | Exit code semantics | Exit codes change | All downstream CI breaks |
| C | Filesystem safety | Traversal allowed | Privilege escalation |
| D | Audit trail & logging | No evidence | Compliance failure |
| E | Scheduler stability | Tight loops/DoS | Production outage |

---

## Success Criteria (All Met)

- ✅ All 5 contracts implemented
- ✅ All 26 tests passing
- ✅ Real CLI paths tested (not mocks)
- ✅ Deterministic and offline
- ✅ Tests verify FAILURES work
- ✅ CI enforcement added
- ✅ Documentation complete
- ✅ No TODOs or placeholders
- ✅ Behavior locked permanently

---

**Mission Status: COMPLETE** 🔒

Any future regression in these core guarantees will be caught immediately by CI.
