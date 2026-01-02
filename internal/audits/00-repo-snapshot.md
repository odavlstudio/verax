# Repository Snapshot Report
**Generated:** 2026-01-01  
**Purpose:** Complete inventory of repository structure, dependencies, and code patterns

---

## 1. System Environment

### Node & npm Versions
```
$ node --version
v20.19.5

$ npm --version
10.8.2
```

### OS Information
```
WindowsProductName : Windows 10 Home
WindowsVersion     : 2009
OsArchitecture     : 64-Bit
```

---

## 2. Package.json Analysis

### Basic Info
- **Package Name:** `@odavl/guardian`
- **Version:** `2.0.0`
- **Release State:** `stable`
- **License:** MIT
- **Node Engine Requirement:** `>=18.0.0`

### Entrypoints
- **bin:** `bin/guardian.js` (CLI command: `guardian`)
- **main:** `src/guardian/index.js`
- **files:** bin/, src/, flows/, policies/, config/, docs

### Scripts (Full List - 61 scripts)
```json
"lint": "eslint .",
"lint:check": "npm run lint -- --max-warnings 0",
"typecheck": "node scripts/validate-syntax.js",
"pack:verify": "npm pack --dry-run",
"build": "npm run pack:verify",
"test:freeze": "node scripts/freeze-gate.js",
"test:contracts": "mocha test/contracts/*.test.js --timeout 60000 --exit",
"test:stage4:ci": "node scripts/stage4-ci-gate.js",
"test:report-unification": "npx mocha test/report-unification.test.js --timeout 10000",
"test": "node test/cli-validation.test.js && node test/mvp.test.js && node test/stage4-security.test.js && node test/stage5-ci-gate.test.js && node test/stage5-error-handling.test.js && node test/stage6-verdict-card.test.js && node test/stage7-watchdog-simple.test.js && node --test test/obs-logger.test.js && npm run test:contracts",
"test:stage5:determinism": "node test/stage5-determinism.test.js",
"test:stage7:watchdog": "node test/stage7-watchdog-simple.test.js",
"test:stage6:verdict": "node test/stage6-verdict-card.test.js",
"test:stage6:integration": "node test/stage6-verdict-card-integration.test.js",
"test:journey:unit": "node test/journey-scanner.unit.test.js",
"test:journey:integration": "node test/journey-scanner.integration.test.js",
"test:journey:all": "node test/journey-scanner.unit.test.js && node test/journey-scanner.integration.test.js",
"test:phase0": "node test/phase0-reality-lock.test.js",
"test:phase1": "node test/phase1-baseline-expansion.test.js",
"test:phase2": "node test/phase2-auto-attempts.test.js",
"test:phase2-old": "node test/phase2.test.js",
"test:attempt": "node test/attempt.test.js",
"test:reality": "node test/reality.test.js",
"test:baseline": "node test/baseline.test.js",
"test:baseline:junit": "node test/baseline-junit.test.js",
"test:snapshot": "node test/snapshot.test.js",
"test:soft-failures": "node test/soft-failures.test.js",
"test:criticality": "node test/market-criticality.test.js",
"test:discovery": "node test/discovery.test.js",
"test:phase5": "node test/phase5.test.js",
"test:phase5:visual": "node test/phase5-visual.test.js",
"test:phase5:evidence": "node test/phase5-evidence-run.test.js",
"test:phase5:all": "node test/phase5-visual.test.js && node test/phase5-evidence-run.test.js",
"test:phase6": "node test/phase6.test.js && node test/phase6-product.test.js",
"test:phase10b": "node test/site-intelligence.unit.test.js && node test/site-intelligence.flow.test.js && node test/site-intelligence.verdict.test.js && node test/site-intelligence.integration.test.js",
"test:final-lockdown": "node test/final-lockdown.test.js",
"test:trust-seal": "node test/trust-seal.test.js",
"test:narrative-run": "node test/narrative-run.test.js",
"test:hardening": "node test/trust-seal.test.js && node test/narrative-run.test.js",
"test:wave1-3": "npx mocha test/success-evaluator.unit.test.js test/wave1-3-success-e2e.test.js --timeout 30000",
"test:export": "node test/export.test.js",
"test:export-api": "node test/export-api.test.js",
"test:export-contract": "node test/export-contract.test.js",
"test:export-equivalence": "node test/export-equivalence.test.js",
"test:export-freeze": "node test/export-equivalence.freeze.test.js",
"test:export-guards": "node test/export-negative-guards.test.js",
"test:first-run": "node test/first-run.test.js",
"test:verdict-clarity": "node test/verdict-clarity.test.js",
"test:verdict-clarity-integration": "node test/verdict-clarity-integration.test.js",
"test:error-clarity": "node test/error-clarity.test.js",
"test:output-readability": "node test/output-readability.test.js",
"test:confidence-signals": "node test/confidence-signals.test.js",
"test:realworld-harness": "node test/realworld-harness.test.js",
"test:proof-narrative": "node test/proof-narrative.test.js",
"test:examples-usage": "node test/examples-usage.test.js",
"test:trust-closure": "node test/trust-closure.test.js",
"test:surface-freeze": "node test/surface-freeze.test.js",
"test:export:all": "node test/export.test.js && node test/export-api.test.js && node test/export-contract.test.js && node test/export-equivalence.test.js && node test/export-equivalence.freeze.test.js && node test/export-negative-guards.test.js",
"release:dry": "npm run test:guardian && node bin/guardian.js --help && node bin/guardian.js --version",
"test:guardian": "npx jest test/guardian/stability-scorer.unit.test.js test/guardian/stability.integration.test.js test/guardian/alert-ledger.unit.test.js test/guardian/severity-classification.unit.test.js --testTimeout=50000",
"start": "node bin/guardian.js",
"sample:generate": "node scripts/generate-sample.js",
"template:verify": "node scripts/verify-templates.js",
"verify:baseline": "node scripts/verify-live-guardian.js",
"verify:verdicts": "node scripts/verify-unknown-elimination.js"
```

**Test Runner:** Mixed approach
- Mocha for contracts and some integration tests
- Jest for guardian-specific tests
- Custom Node.js test runners for most tests (using `node test/*.test.js`)
- Node's built-in test runner (`node --test`) for obs-logger

**Linter/Formatter:**
- ESLint configured (`eslint .`)
- No Prettier detected

### Dependencies (3 runtime)
```
express: ^5.2.1
playwright: ^1.48.2
yazl: ^2.5.1
```

### Dev Dependencies (8)
```
@babel/core: ^7.28.5
@types/node: ^20.11.30
ajv: ^8.17.1
ajv-formats: ^3.0.1
eslint: ^8.57.0
glob: ^13.0.0
jszip: ^3.10.1
mocha: ^11.7.5
typescript: ^5.4.5
```

### Overrides
```
qs: ^6.14.1 (security override)
```

---

## 3. Repository Map

### Top-Level Folders

| Folder | Purpose |
|--------|---------|
| **artifacts/** | Output directory for test/run artifacts (screenshots, traces, reports) |
| **bin/** | CLI entrypoint (`guardian.js`) |
| **config/** | Default configurations (guardian.config.json, policy files, profiles) |
| **data/** | Persistent data (guardian-profiles.json) |
| **docs/** | Comprehensive documentation (architecture, contracts, phases, product identity) |
| **examples/** | Demo scripts showing pattern detection, focus summaries, silence discipline |
| **extension/** | VS Code extension (separate package.json, TypeScript source) |
| **flows/** | Example flow definitions (JSON files for login/signup scenarios) |
| **internal/** | Internal verification scripts |
| **policies/** | Policy presets (enterprise.json, saas.json, startup.json, landing-demo.json) |
| **reports/** | Report output directory |
| **samples/** | Sample decision/summary outputs |
| **scripts/** | Utility scripts (verification, sample generation, CI gates, freeze gates) |
| **src/** | **Core source code** (guardian engine, recipes, enterprise/founder/payments/plans modules) |
| **test/** | **Large test suite** (100+ test files covering phases, contracts, integration, units) |
| **trust/** | Trust-related artifacts/documentation |
| **website/** | Marketing/documentation website (Next.js app) |

### Core Runtime Files (in src/guardian/)

**CLI & Entry:**
- `bin/guardian.js` - Main CLI entry, version check, logger setup
- `src/guardian/index.js` - Main export
- `src/guardian/ci-cli.js` - CI mode CLI
- `src/guardian/live-cli.js` - Live/watchdog CLI
- `src/guardian/journey-scan-cli.js` - Journey scanning CLI

**Decision Engine:**
- `decision-authority.js` - **Core verdict authority**
- `verdict.js`, `verdicts.js` - Verdict logic
- `verdict-card.js`, `verdict-clarity.js` - Verdict formatting/output
- `verdict-policy.js` - Policy application
- `final-outcome.js` - Exit code mapping

**Scanners:**
- `attempt-engine.js` - **Core Playwright scanning engine**
- `flow-executor.js` - Multi-step flow execution
- `journey-scanner.js` - Human journey scanning
- `discovery-engine.js` - Page/link discovery
- `crawler.js` - Site crawling
- `smoke.js` - Smoke testing
- `reality.js` - Reality checking mode

**Baseline & Drift:**
- `baseline.js`, `baseline-registry.js`, `baseline-storage.js`, `baseline-reporter.js` - Baseline management
- `drift-detector.js` - Drift detection
- `watchdog-diff.js` - Watchdog mode diff

**Reporting:**
- `reporter.js` - Main reporter
- `html-reporter.js`, `enhanced-html-reporter.js` - HTML output
- `junit-reporter.js` - JUnit XML output
- `cli-summary.js` - CLI summary
- `human-reporter.js` - Human-readable reports
- `market-reporter.js` - Market/product reports
- `ci-output.js` - CI-specific output

**Artifacts:**
- `screenshot.js` - Screenshot capture
- `run-artifacts.js` - Artifact management
- `artifact-sanitizer.js` - Artifact cleanup/sanitization
- `run-export.js` - Export to ZIP/API
- `export-contract.js` - Export contract enforcement

**Intelligence:**
- `site-intelligence.js` - Site analysis
- `pattern-analyzer.js` - Pattern detection
- `breakage-intelligence.js` - Breakage analysis
- `failure-intelligence.js` - Failure categorization
- `root-cause-analysis.js` - RCA engine
- `behavioral-signals.js` - Behavior detection
- `success-evaluator.js` - Success evaluation

**Reliability:**
- `retry-policy.js` - Retry logic
- `fail-safe.js` - Fail-safe mechanisms
- `determinism.js` - Determinism enforcement
- `honesty.js` - Honest reporting
- `error-clarity.js`, `output-readability.js`, `confidence-signals.js` - UX improvements

**Browser Management:**
- `browser-pool.js`, `browser.js` - Playwright browser pooling
- `wait-for-outcome.js` - Page outcome detection
- `timeout-profiles.js` - Timeout configuration

**Configuration:**
- `config-loader.js`, `config-validator.js` - Config management
- `policy.js` - Policy engine
- `preset-loader.js`, `profile-loader.js` - Preset/profile loading
- `scan-presets.js` - Scan preset definitions

**Helpers:**
- `obs-logger.js` - Evidence logging
- `path-safety.js` - Path traversal prevention
- `env-guard.js` - Environment checks
- `safety.js` - Safety utilities
- `text-formatters.js` - Text formatting
- `validators.js` - Validation utilities

---

## 4. Keyword Search Results

### TODO / FIXME / HACK / XXX / DEPRECATED
**Total matches:** 38

**In source code:**
- `src/guardian/crawler.js:85` - `linkCount: links.length, // Deprecated, use 'links'`
- `test/LEVEL_1_SUMMARY.js:2` - `// DEPRECATED: This file has been moved to ./internal and is not a test.`

**In documentation:**
- `STAGE_4_COMPLETION.md` - 2 TODO references (cleanup tasks)
- Various docs mention "No TODOs" as a quality signal

**In package-lock.json:**
- Multiple deprecated npm packages:
  - `@eslint/config-array` → use newer version
  - `@eslint/object-schema` → use newer version
  - ESLint 8.x → no longer supported
  - `inflight` module → leaks memory
  - `rimraf` <v4 → unsupported
  - `glob` <v9 → unsupported
  - NextJS security vulnerability in website/package-lock.json

### console.log
**Total matches:** 200+ (truncated)

**Distribution:**
- **test/** - Vast majority (test output, debug logging)
- **website/** - Documentation examples
- **src/** - Very few (mostly removed from production code)

**Notable src/ occurrences:**
- NO console.log found in core guardian engine files
- Clean production code

### process.exit
**Total matches:** 200+ (truncated)

**Distribution:**
- **test/** - Dominant usage (test exit codes)
- **src/** - Need to verify (likely in CLI files only)

**Patterns:**
- Tests use `process.exit(0)` for pass, `process.exit(1)` for fail
- Some use `process.exitCode` instead (cleaner)
- Tests often use `process.exit(2)` for error scenarios

### try { / catch (
**Total matches:** 200+ (extensive error handling)

**Distribution:**
- Widespread across src/ and test/
- **Analysis:** Heavy use of try/catch (needs review for broad catches)

### eval()
**Total matches:** 0 ✅
- No eval usage detected

### child_process / exec / spawn
**Total matches:** 20 in tests

**Files:**
- `test/check-alias.test.js` - execSync
- `test/cli-positioning-help.test.js` - execSync
- `test/mvp.test.js` - spawnSync
- `test/phase11-demo.js` - execSync
- `test/smoke-ci-output.test.js` - spawnSync
- `test/stage5-determinism.test.js` - spawn
- `test/stage1-final-seal.test.js` - spawn
- Multiple other test files using spawn/spawnSync for CLI testing

**Production code:** None detected in src/

### fs.rm / rimraf
**Total matches:** 20+ (all in tests)

**Pattern:**
- All usage in test cleanup: `fs.rmSync(tmpDir, { recursive: true, force: true })`
- No production usage in src/
- Safe test cleanup pattern

---

## 5. Additional Patterns

### setTimeout / sleep / waitForTimeout
**23 matches in src/guardian/**

**Files with timeouts:**
- `attempt-engine.js` - page.waitForTimeout(200), waitForTimeout(1000) for step delays
- `flow-executor.js` - page.waitForTimeout(duration)
- `human-navigator.js` - page.waitForTimeout(minWait) for human-like behavior
- `journey-scanner.js` - setTimeout for timeouts, retry backoff
- `live-cli.js` - setTimeout for interval scheduling
- `live-scheduler-runner.js` - setTimeout for scheduling
- `retry-policy.js` - setTimeout(1000) for retries
- `run-export.js` - setTimeout for retry delays
- `screenshot.js` - page.waitForTimeout(100)
- `smoke.js` - setTimeout for budget timer
- `wait-for-outcome.js` - setTimeout for polling
- `watch-runner.js` - setTimeout for debounce
- `recipe-runtime.js` - setTimeout(500), setTimeout(1000) for retries

**Risk:** Non-determinism, flakiness, timing-dependent tests

### Date.now / Math.random
**50+ matches of Date.now in src/**

**Usage:**
- **Timing:** Duration measurement (startTime = Date.now(), elapsed = Date.now() - startTime)
- **Unique IDs:** `runId: 'sched-${Date.now()}'`, `error-${Date.now()}`, screenshot filenames
- **Scheduling:** live-scheduler calculations, nextRunTime

**Math.random:** 0 matches ✅

**Risk:** Date.now for IDs is weak (collision risk under parallel execution)

### fetch / axios / http
**6 matches in src/**

**Files:**
- `src/guardian/webhook.js` - `fetch(webhookUrl, ...)` for webhook notifications
- `src/guardian/sitemap.js` - `fetch(url)` for sitemap/robots.txt retrieval

**Risk:** Network calls without retries/timeouts (except already in retry-policy)

### Playwright page.goto
*Search needed separately*

---

## Summary Statistics

| Category | Count |
|----------|-------|
| **Total Scripts** | 61 |
| **Runtime Dependencies** | 3 |
| **Dev Dependencies** | 8 |
| **Core Source Files (src/guardian/)** | ~110 files |
| **Test Files** | 100+ |
| **TODO/FIXME/HACK** | 38 (mostly docs/deps) |
| **console.log** | 200+ (tests only) |
| **process.exit** | 200+ (tests) |
| **try/catch blocks** | 200+ |
| **eval()** | 0 ✅ |
| **child_process usage** | 20 (tests only) |
| **fs.rm** | 20+ (tests only) |
| **setTimeout/waitForTimeout** | 23 (src/) |
| **Date.now** | 50+ (src/) |
| **Math.random** | 0 ✅ |
| **Network calls** | 6 (webhook, sitemap) |

---

## Key Observations

1. **Test-Heavy Codebase:** 100+ test files, multiple test runners (Mocha, Jest, custom Node.js)
2. **Phase-Based Development:** Tests organized by phase (phase0, phase1, ... phase12)
3. **Clean Production Code:** No console.log, no eval, no Math.random in src/
4. **Timing Dependencies:** Heavy use of setTimeout/waitForTimeout (23 occurrences in src/)
5. **Date.now Overuse:** 50+ uses for timing, IDs, scheduling
6. **Deprecated Dependencies:** Multiple npm packages flagged as deprecated
7. **Security Override:** qs package overridden due to vulnerability
8. **Mixed Test Patterns:** Some tests use process.exit, others use process.exitCode
9. **Extensive Error Handling:** 200+ try/catch blocks
10. **Modular Architecture:** Clean separation (guardian/, recipes/, enterprise/, founder/, payments/, plans/)
