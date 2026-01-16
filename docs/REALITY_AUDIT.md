# VERAX — Reality Audit

**Document Type**: Forensic Audit Log  
**Created**: 2026-01-16  
**Purpose**: Accumulate all structural, logical, and philosophical violations discovered in the VERAX codebase.

---

## Audit Phases

| Phase | Focus | Status |
|-------|-------|--------|
| 0 | Initialization | COMPLETE |
| 1 | Repository Structure | COMPLETE |
| 2 | Legacy & Dead Code | COMPLETE |
| 3 | Internal Code Quality | COMPLETE |
| 4 | Tests & Automation | COMPLETE |
| 5 | Vision Compliance | COMPLETE |

---

## Phase 1: Repository Structure

**Status**: COMPLETE  
**Focus**: Root-level files, folder organization, naming conventions, structural chaos.

### Findings

#### 1.1 — Root-Level Script Files (Unorganized)

**Files**:
- `bulk-fix-lint.js`
- `fix-final-110.js`
- `fix-observer-jsdoc.js`
- `fix-string-buffer.js`
- `fix-underscore-imports.js`

**Problem**: Five ad-hoc fix scripts scattered at repository root. Names suggest temporary, one-time operations.

**Why Harmful**: 
- Creates visual clutter at repository entry point
- Naming convention (`fix-*`) implies these are historical artifacts, not maintained tools
- No clear ownership or purpose
- Violates principle of organized tooling

**Action**: **DELETE** — These appear to be historical lint fixes or one-time migrations. If any are still needed, move to `scripts/historical/` or delete entirely.

---

#### 1.2 — Root-Level Debug/Test Output Files

**Files**:
- `action-contracts-debug.txt`
- `action-contracts-full.txt`
- `action-contracts-output.txt`
- `test-action-contracts-full.txt`
- `test-output.txt`
- `test-run-output.txt`
- `full-test-output.txt`
- `lint-output.json`

**Problem**: Eight debug/test output files at repository root.

**Why Harmful**:
- These are runtime artifacts, not source files
- Should be generated ephemerally or in dedicated output directories
- Should be gitignored
- Pollutes repository structure

**Action**: **DELETE** + **RESTRUCTURE** — Delete all. Add `.txt` and `.json` patterns to `.gitignore` if not already present. Document in README if these files are intentionally tracked.

---

#### 1.3 — Root-Level Digest/Proof Files

**Files**:
- `digest_run1.json`
- `digest_run2.json`
- `runtime-proof-index.json`
- `vision-parity-proof.json`

**Problem**: Runtime proof artifacts at root level with generic names.

**Why Harmful**:
- `digest_run1` and `digest_run2` suggest numbered test iterations (sign of experimental workflow)
- No clear relation to source structure
- Not in `artifacts/` or `reports/` where they belong

**Action**: **MOVE** — Move to `artifacts/proof/` or delete if obsolete.

---

#### 1.4 — Redundant Nested Directories in `artifacts/`

**Paths**:
- `artifacts/.verax/`
- `artifacts/.veraxverax/`

**Problem**: Two hidden VERAX directories inside `artifacts/`. One appears to be a typo (`veraxverax`).

**Why Harmful**:
- Typo suggests copy-paste error or corrupted directory creation
- Hidden directories in output folder serve no clear purpose
- Likely leftover from test runs

**Action**: **DELETE** — Remove both. If these are needed, clarify purpose and document.

---

#### 1.5 — `artifacts/h --access public` (Invalid Directory Name)

**Path**: `artifacts/h --access public`

**Problem**: Directory name is literally `h --access public`. Appears to be a shell command fragment mistakenly used as a directory name.

**Why Harmful**:
- Invalid naming (spaces and command structure)
- Suggests command execution error during artifact creation
- Cannot be reliably manipulated in most shells without escaping

**Action**: **DELETE** — This is clearly a mistake.

---

#### 1.6 — Excessive Legacy/Manual Test Directories in `artifacts/`

**Paths**:
- `artifacts/manual-test/`
- `artifacts/manual-test-fixture/`
- `artifacts/manual-test-jsx/`
- `artifacts/manual-test-verbose/`
- `artifacts/debug/`
- `artifacts/legacy/`
- `artifacts/sample-run/`
- `artifacts/test-runs/`
- `artifacts/test-fixtures/`
- `artifacts/test-contract-enforcement/`

**Problem**: Ten manual/legacy test directories inside `artifacts/`.

**Why Harmful**:
- `artifacts/` should contain **outputs**, not test inputs or fixtures
- Naming overlap with `/test/` (which also has fixtures)
- `legacy/` suggests outdated content
- `manual-test-*` proliferation indicates no clear testing strategy

**Action**: **RESTRUCTURE** — Move test fixtures to `/test/fixtures/`. Move manual test outputs to `/test/manual-runs/` or delete. Archive or delete `legacy/`.

---

#### 1.7 — `tmp/` at Root with Test Files Inside

**Path**: `tmp/`

**Problem**: 
- Contains a mix of test scripts (`test-*.js`) and test run directories
- `tmp/` at root suggests ephemeral content, but test files should not be ephemeral

**Why Harmful**:
- Test scripts belong in `/test/`, not `/tmp/`
- Directory name suggests deletion is safe, but content may be important
- No clear distinction between temporary outputs and test code

**Action**: **RESTRUCTURE** — Move test scripts to `/test/`. Move test run directories to `artifacts/` or delete if obsolete. Keep `/tmp/` truly temporary and gitignored.

---

#### 1.8 — `_external/` Directory Name (Non-Standard)

**Path**: `_external/verax-website/`

**Problem**: Leading underscore naming convention for external dependencies.

**Why Harmful**:
- Not a standard convention for external projects
- Better alternatives: `external/`, `third-party/`, `vendor/`
- Hidden sorting behavior (underscores sort differently)

**Action**: **MOVE** — Rename to `external/` or document why underscore is intentional.

---

#### 1.9 — Missing Dedicated `scripts/` Subdirectories

**Path**: `scripts/`

**Problem**: Mix of standalone scripts with only one subdirectory (`ci/`).

**Why Harmful**:
- Scripts like `validate-network-detection.js` are validators
- `suppress-string-buffer-errors.js` is a suppression tool
- No clear categorization (validation vs. tooling vs. CI)

**Action**: **RESTRUCTURE** — Create subdirectories:
- `scripts/validation/`
- `scripts/tooling/`
- `scripts/ci/`

---

#### 1.10 — Release Artifacts in `release/` Without Context

**Path**: `release/`

**Files**:
- `security.secrets.report.json`
- `security.supplychain.report.json`
- `security.vuln.report.json`

**Problem**: Three security reports with no README or metadata.

**Why Harmful**:
- No timestamp, no context, no version association
- Reports could be stale or outdated
- No documentation on how or when these are generated

**Action**: **RESTRUCTURE** — Add `release/README.md` documenting purpose, generation process, and freshness policy. Consider moving to `artifacts/security/` if these are runtime outputs.

---

#### 1.11 — No Dedicated `docs/architecture/` Directory

**Missing**: `docs/architecture/`

**Problem**: No clear location for architectural decision records (ADRs) or design documents.

**Why Harmful**:
- `docs/VISION.md` exists, but no structure for ongoing design decisions
- Important for VERAX as a principle-driven project

**Action**: **CREATE** — Add `docs/architecture/` for future ADRs and design documentation.

---

#### 1.12 — CHANGELOG.md at Root (Potentially Unmaintained)

**File**: `CHANGELOG.md`

**Problem**: No clear indication if this is actively maintained or historical.

**Why Harmful**:
- If unmaintained, creates false impression of change tracking
- Should be generated from commits or manually enforced

**Action**: **VERIFY** — Check if CHANGELOG is current. If not, either update it or document that it's not maintained.

---

### Phase 1 Summary

**Total Issues**: 12  
**Root-level clutter files**: 13 (scripts + outputs)  
**Misplaced artifacts**: 10+ directories  
**Invalid/typo directories**: 2  
**Recommended deletions**: 15+  
**Recommended moves**: 8+  
**Recommended restructures**: 5

---

## Phase 2: Legacy & Dead Code

**Status**: COMPLETE  
**Focus**: Unused commands, deprecated flows, dead logic, irrelevant features.

### Findings

#### 2.1 — `--allow-writes` Flag (Contradicts Vision)

**Location**: `src/cli/entry.js` (lines 73, 118, 152)

**Problem**: CLI exposes `--allow-writes` flag that allows POST/PUT/PATCH/DELETE requests during observation.

**Why Harmful**:
- **Violates VERAX principle #10**: "VERAX is strictly observational. It never mutates application state."
- Introducing a flag to allow writes directly contradicts the read-only nature of VERAX
- Safety flag suggests VERAX can modify state when explicitly enabled
- Creates ambiguity about what VERAX actually does

**Evidence from Vision**:
> "VERAX is strictly observational. It: never mutates application state, never applies fixes, never patches code, never enforces behavior."

**Action**: **DELETE** — Remove `--allow-writes` flag entirely. VERAX should NEVER support write operations. If safety checks exist internally, they should be unconditional, not configurable.

---

#### 2.2 — `doctor` Command (Unnecessary Surface Area)

**Location**: `src/cli/commands/doctor.js`

**Problem**: Dedicated environment diagnostic command that checks Node.js version, Playwright installation, and Chromium binaries.

**Why Harmful**:
- VERAX should fail fast with clear error messages if dependencies are missing
- Environment diagnostics are better handled by package managers and CI
- Adds command surface area for minimal value
- Smoke test launch adds execution complexity

**Action**: **DELETE** — Remove `doctor` command. Replace with inline dependency checks that fail immediately with actionable error messages during `verax run`.

---

#### 2.3 — Dynamic Route Handling Infrastructure (Feature Creep)

**Locations**:
- `src/verax/detect/dynamic-route-findings.js` (339 lines)
- `src/verax/core/dynamic-route-intelligence.js`
- Multiple references across codebase

**Problem**: Extensive infrastructure for handling dynamic routes (e.g., `/user/:id`), despite README explicitly stating:

> "❌ Does not support dynamic routes (e.g. /user/${id} is intentionally skipped)"

**Why Harmful**:
- Contradicts documented product scope
- Adds significant complexity for unsupported feature
- Classification systems (`DYNAMIC_ROUTE_VERIFIABILITY`, `ROUTE_VERDICT`)
- Correlation and evidence building for feature explicitly marked as "not supported"

**Action**: **DELETE** or **SIMPLIFY** — Either:
1. Delete all dynamic route handling (if truly not supported)
2. Update docs to reflect actual support level
3. Simplify to basic skip logic only

---

#### 2.4 — `--json` Flag Proliferation (Inconsistent Contract)

**Problem**: `--json` flag appears in multiple commands (`run`, `inspect`, `doctor`) but behavior is inconsistent.

**Why Harmful**:
- No central JSON output contract specification
- Each command implements JSON output differently
- Creates maintenance burden
- User expectations unclear

**Action**: **RESTRUCTURE** — Document JSON output schema centrally in `docs/` and enforce consistency across all commands.

---

#### 2.5 — `legacy` Artifact Type in `root-artifacts.js`

**Location**: `src/verax/shared/root-artifacts.js`

**Problem**: Code explicitly references `'legacy'` as an artifact type, suggesting support for legacy outputs.

**Why Harmful**:
- Naming suggests backward compatibility burden
- No documentation on what constitutes "legacy" artifacts
- Creates confusion about output structure

**Action**: **DELETE** — Remove `legacy` artifact type. Archive or migrate any historical artifacts to dedicated archive directory outside main flow.

---

#### 2.6 — Unused Expectation Tracking Without Clear Purpose

**Location**: `src/verax/shared/progress-reporter.js`

**Problem**: Tracks `unused`, `unusedByReason` expectations and reports them, but unclear what "unused" means in context.

**Why Harmful**:
- README states: "VERAX does not aim for 100% interaction coverage"
- Tracking "unused" expectations implies coverage goal
- Contradicts Vision principle #11: "Not Coverage-Driven"

**Action**: **DELETE** or **CLARIFY** — Either remove unused expectation tracking or clarify that "unused" means "not matched to observable interactions" (which is expected behavior).

---

#### 2.7 — Interactive Default Command (Wizard Mode)

**Location**: `src/cli/commands/default.js`

**Problem**: Default command (`verax` with no args) enters interactive mode with URL detection/prompting.

**Why Harmful**:
- Adds complexity for local dev UX convenience
- Creates dual-mode CLI (interactive vs. strict)
- CI-unfriendly default behavior
- More surface area for bugs

**Evidence**: README promotes `verax run --url` as "ideal for CI" but default mode is interactive.

**Action**: **SIMPLIFY** — Make `verax run --url` the ONLY mode. Remove interactive prompts. CLI tools should be explicit by default.

---

#### 2.8 — `--verbose` Flag Without Clear Contract

**Location**: `src/cli/entry.js`

**Problem**: `--verbose` flag exists but no documentation on what additional output is provided.

**Why Harmful**:
- Users cannot reason about what to expect
- Likely inconsistently implemented
- Debugging flags should have clear scope

**Action**: **DOCUMENT** or **DELETE** — Either document verbose behavior or remove if not consistently used.

---

### Phase 2 Summary

**Total Issues**: 8  
**Vision violations**: 2 (--allow-writes, coverage tracking)  
**Feature creep**: 1 (dynamic routes)  
**Unnecessary commands**: 1 (doctor)  
**Inconsistent contracts**: 3 (--json, --verbose, unused tracking)  
**Legacy artifacts**: 1  
**Recommended deletions**: 5  
**Recommended clarifications**: 3

---

## Phase 3: Internal Code Quality

**Status**: COMPLETE  
**Focus**: Spaghetti code, oversized files, unused functions, overengineering, confusing logic.

### Findings

#### 3.1 — Monster File: `verifier.js` (980 lines)

**Location**: `src/verax/core/artifacts/verifier.js`

**Problem**: Single file with 980 lines handling artifact verification, contract validation, evidence enforcement, and cross-artifact consistency.

**Why Harmful**:
- Violates single responsibility principle
- Difficult to test comprehensively
- High cognitive load for modifications
- Mixed concerns (file I/O, validation, enforcement, reporting)

**Action**: **RESTRUCTURE** — Split into:
- `artifact-validator.js` (existence checks)
- `contract-validator.js` (version compliance)
- `evidence-enforcer.js` (evidence law)
- `consistency-checker.js` (cross-artifact checks)

---

#### 3.2 — Monster File: `observe/index.js` (902 lines)

**Location**: `src/verax/observe/index.js`

**Problem**: 902-line orchestration file mixing:
- Browser lifecycle
- Network interception/blocking
- Interaction execution
- Evidence capture
- Silence tracking
- Incremental logic
- Budget enforcement

**Why Harmful**:
- Entry point should be thin orchestration layer
- Cannot reason about individual responsibilities
- Testing requires mocking entire system
- High risk of regression with any change

**Action**: **RESTRUCTURE** — Extract into:
- `observe-orchestrator.js` (main flow only)
- `safety-firewall.js` (network blocking)
- `incremental-coordinator.js` (snapshot/diff logic)
- Keep core execution in smaller, focused modules

---

#### 3.3 — Monster File: `confidence-engine.js` (896 lines)

**Location**: `src/verax/detect/confidence-engine.js`

**Problem**: 896 lines of confidence computation logic in a single file.

**Why Harmful**:
- Confidence calculation should be pure, testable functions
- Monolithic structure makes rule changes risky
- Likely contains duplicated logic
- Hard to audit confidence rules

**Action**: **RESTRUCTURE** — Split into:
- `confidence-rules.js` (pure calculation functions)
- `confidence-aggregator.js` (combining multiple signals)
- `confidence-reporter.js` (output formatting)

---

#### 3.4 — Interactive Command Monster: `default.js` (710 lines)

**Location**: `src/cli/commands/default.js`

**Problem**: 710-line interactive command with:
- URL detection
- User prompting (inquirer)
- Full pipeline orchestration
- Error handling
- Timeout/watchdog logic
- Event emission

**Why Harmful**:
- Command handlers should be thin
- Mixes UI, orchestration, and business logic
- Already flagged for deletion in Phase 2 (interactive mode)

**Action**: **DELETE** (per Phase 2) or **RESTRUCTURE** if retained — Extract pipeline orchestration into separate module.

---

#### 3.5 — Excessive TypeScript Suppression (`@ts-expect-error`)

**Locations**: 20+ occurrences across codebase

**Problem**: Extensive use of `@ts-expect-error` comments to bypass type checking.

**Why Harmful**:
- Indicates type system is not aligned with runtime reality
- Masks actual type errors
- No guarantee code is actually correct
- Defeats purpose of TypeScript

**Example**: `readFileSync` returns `string` but TypeScript doesn't know this without encoding parameter types.

**Action**: **FIX** — Either:
1. Add proper type declarations
2. Use type assertions with runtime validation
3. Fix TypeScript configuration

Do NOT suppress type errors without justification.

---

#### 3.6 — Naming: "Truth" vs "Reality"

**Locations**:
- `learnTruth`, `observeTruth`, `detectTruth` in `scan-summary-writer.js`
- `truth-assessor.js`

**Problem**: VERAX is about "reality" and "evidence", but internal names use "truth" which has philosophical baggage.

**Why Harmful**:
- Inconsistent with brand (VERAX = truth seeker, but focused on observable reality)
- "Truth" implies absolute knowledge; "reality" implies observation
- Confusing for contributors

**Action**: **RENAME** — Replace "truth" terminology with "result" or "output":
- `learnResult`, `observeResult`, `detectResult`
- Rename `truth-assessor.js` to `result-validator.js`

---

#### 3.7 — Detect Phase Fragmentation (20+ files)

**Location**: `src/verax/detect/` (20 distinct modules)

**Problem**: Detection logic split across:
- `dynamic-route-findings.js`
- `interactive-findings.js`
- `route-findings.js`
- `ui-feedback-findings.js`
- `journey-stall-detector.js`
- `expectation-chain-detector.js`
- `flow-detector.js`
- `skip-classifier.js`
- `signal-mapper.js`
- ... (12 more)

**Why Harmful**:
- No clear taxonomy of finding types
- High coupling (files import from each other extensively)
- Difficult to understand which detector runs when
- Likely duplication in evidence building

**Action**: **RESTRUCTURE** — Create clear finding type hierarchy:
- `detectors/navigation.js`
- `detectors/interaction.js`
- `detectors/state.js`
- `detectors/network.js`

Consolidate overlapping logic.

---

#### 3.8 — Silence Tracker Overuse

**Location**: Throughout `observe/` and `detect/`

**Problem**: `silenceTracker.record()` called in dozens of locations with free-form string reasons.

**Why Harmful**:
- No central registry of silence types
- String-based classification (typos, inconsistencies)
- Difficult to query/aggregate silence data
- No schema validation

**Action**: **RESTRUCTURE** — Create `silence-types.js` enum with all valid silence reasons. Enforce at record time.

---

#### 3.9 — Long Parameter Lists (7+ parameters)

**Locations**:
- `writeTraces()` — 8 parameters
- `writeScanSummary()` — 10 parameters
- `observe()` — 6 parameters (but some are optional objects)

**Why Harmful**:
- High cognitive load
- Easy to pass arguments in wrong order
- Testing requires extensive setup

**Action**: **RESTRUCTURE** — Use parameter objects with destructuring:
```javascript
// Instead of: writeTraces(a, b, c, d, e, f, g, h)
// Use: writeTraces({ projectDir, url, traces, coverage, ... })
```

---

#### 3.10 — Inconsistent Null Handling

**Problem**: Mix of `null`, `undefined`, and optional parameters across codebase without clear convention.

**Example**:
- `observe(url, manifestPath = null, ...)`
- `verifyRun(runDir, registrySnapshot = null)`
- Some functions use `undefined`, others use `null`

**Why Harmful**:
- Inconsistent API contracts
- Difficult to reason about optionality
- Type errors and runtime bugs

**Action**: **STANDARDIZE** — Adopt single convention:
- Optional parameters: use `= undefined` (JavaScript default)
- Explicit "no value": use `null`
- Document convention in `docs/CODE_STYLE.md`

---

#### 3.11 — Nested Ternaries and Complex Conditionals

**Locations**: Multiple files in `detect/` and `observe/`

**Problem**: Nested ternary operators and multi-clause conditionals without comments.

**Example** (hypothetical from pattern analysis):
```javascript
const result = a ? (b ? c : d) : (e ? f : g);
```

**Why Harmful**:
- Impossible to read/debug
- No explanation of intent
- Bug-prone during modifications

**Action**: **REFACTOR** — Extract to named variables or helper functions:
```javascript
const primaryCondition = a && b;
const fallbackCondition = !a && e;
const result = primaryCondition ? c : (fallbackCondition ? f : g);
```

---

#### 3.12 — Lack of Public API Documentation

**Problem**: No `docs/API.md` documenting public functions, expected inputs, and outputs.

**Why Harmful**:
- New contributors must reverse-engineer intent from code
- No single source of truth for function contracts
- JSDoc comments are inconsistent

**Action**: **CREATE** — Add `docs/API.md` documenting:
- Public CLI commands
- Exported functions from main modules
- Expected input/output schemas

---

### Phase 3 Summary

**Total Issues**: 12  
**Monster files (>700 lines)**: 4  
**Fragmented modules**: 1 (detect/)  
**Code smell categories**: 8 (type suppression, naming, parameters, null handling, ternaries, etc.)  
**Recommended restructures**: 7  
**Recommended renames**: 1  
**Recommended standardizations**: 2  
**Documentation gaps**: 1

---

## Phase 4: Tests & Automation

**Status**: COMPLETE  
**Focus**: Broken tests, redundant scripts, misleading CI, test alignment with Vision.

### Findings

#### 4.1 — Excessive Test Fixtures (70+ directories)

**Location**: `test/fixtures/` (70+ subdirectories, 1815+ files)

**Problem**: Massive fixture directory with overlapping and potentially obsolete test fixtures.

**Why Harmful**:
- High maintenance burden
- Unclear which fixtures are actively used
- Many appear to be one-off test scenarios
- No clear naming convention or organization

**Examples of potential overlap**:
- `nav-ok/`, `nav-broken/`, `nav-guarded/`
- `network-ok/`, `network-failure/`, `network-slow/`
- `ci-pass/`, `ci-fail/`, `ci-warn/`
- Multiple "dynamic-url-*" fixtures

**Action**: **AUDIT & CONSOLIDATE** — 
1. Identify fixtures actually referenced by tests
2. Delete unused fixtures
3. Consolidate overlapping scenarios
4. Document fixture purpose in README

---

#### 4.2 — Complex Test Infrastructure (Force-Exit Logic)

**Location**: `test/infrastructure/test-runner-wrapper.js`

**Problem**: 181-line test runner wrapper with:
- Hard 5-minute timeout
- Force browser kill logic
- Event loop drain guarantees
- Active handle tracking
- Force exit fallback

**Why Harmful**:
- Suggests underlying test stability problems
- Comment: "Hanging is worse than failing" indicates band-aid solution
- Masks root cause of hanging tests
- Over-engineered for simple test execution

**Action**: **INVESTIGATE ROOT CAUSE** — This infrastructure exists because tests hang. Find and fix hanging tests instead of building complex wrapper.

---

#### 4.3 — Multiple CI Workflow Files (Redundant/Confusing)

**Location**: `.github/workflows/`

**Files**:
- `ci.yml`
- `release.yml`
- `verax-ci.yml`
- `verax-release.yml`
- `verax.yml`

**Problem**: Five separate workflow files with unclear naming and purpose distinction.

**Why Harmful**:
- `ci.yml` vs `verax-ci.yml` — unclear why two CI files
- `release.yml` vs `verax-release.yml` — unclear difference
- `verax.yml` — purpose unknown without inspection
- Likely duplicated logic
- Confusing for contributors

**Action**: **CONSOLIDATE** — Reduce to:
- `ci.yml` (all CI checks)
- `release.yml` (release only)

Document purpose clearly in each file.

---

#### 4.4 — Test File Organization (Mixed Concerns)

**Location**: `test/` root contains:
- `test-decision-direct.js`
- `test-matrix.js`
- `verify-expectation-driven.js`

But `test/release/` contains actual `.test.js` files (19 files).

**Problem**: No clear distinction between test helpers, test runners, and actual tests.

**Why Harmful**:
- Difficult to find actual tests
- Inconsistent naming (some have `.test.js`, some don't)
- No clear taxonomy

**Action**: **RESTRUCTURE** — Move all `.test.js` files to dedicated test directories. Keep only infrastructure in `test/infrastructure/`.

---

#### 4.5 — No Smoke Tests for Vision Violations

**Problem**: No automated tests verifying that:
- `--allow-writes` flag is rejected/removed (Phase 2.1)
- Dynamic route handling aligns with documentation (Phase 2.3)
- VERAX never mutates state

**Why Harmful**:
- Vision violations can creep back in
- Manual enforcement is fragile

**Action**: **CREATE** — Add `test/release/vision-compliance.test.js` with automated checks for constitutional rules.

---

#### 4.6 — Redundant Scripts in `scripts/`

**Locations**:
- `scripts/validate-network-detection.js`
- `scripts/validate-ui-feedback-detection.js`
- `scripts/validate-usestate-detection.js`
- `scripts/verify-release.js`

**Problem**: Standalone validation scripts that should be regular tests.

**Why Harmful**:
- Not integrated into test suite
- Likely run manually (unreliable)
- Duplicates test infrastructure

**Action**: **CONSOLIDATE** — Convert to proper tests in `test/` or delete if redundant.

---

#### 4.7 — Missing Test Coverage Reporting

**Problem**: No `coverage/` directory or coverage reporting in package.json scripts.

**Why Harmful**:
- Cannot reason about test completeness
- No baseline for measuring improvements

**Action**: **ADD** — Add `test:coverage` script using Node.js built-in coverage or `c8`.

---

#### 4.8 — Playwright Cleanup Complexity

**Location**: `test/infrastructure/playwright-cleanup.js`

**Problem**: Dedicated Playwright cleanup module suggests resource leak issues.

**Why Harmful**:
- Browsers should close automatically in test teardown
- Existence of cleanup infrastructure indicates underlying problem
- Band-aid solution, not root cause fix

**Action**: **INVESTIGATE** — Find tests leaking browser resources and fix teardown. Delete cleanup module once fixed.

---

#### 4.9 — No Test Naming Convention Enforcement

**Problem**: Mix of naming styles:
- `artifact-verifier.test.js`
- `determinism-baseline.test.js`
- `test-matrix.js` (not `.test.js`)

**Why Harmful**:
- Test discovery inconsistent
- No clear pattern for contributors

**Action**: **STANDARDIZE** — Enforce `.test.js` suffix for all tests. Document in `docs/TESTING.md`.

---

#### 4.10 — Missing `docs/TESTING.md`

**Problem**: No central testing documentation explaining:
- How to run tests
- Test organization
- Fixture usage
- Writing new tests

**Why Harmful**:
- Contributors must reverse-engineer test patterns
- No guidance on test quality standards

**Action**: **CREATE** — Add `docs/TESTING.md` with comprehensive testing guide.

---

### Phase 4 Summary

**Total Issues**: 10  
**Fixture bloat**: 70+ directories  
**Over-engineered infrastructure**: 3 (test wrapper, cleanup, multiple workflows)  
**Missing tests**: 1 (vision compliance)  
**Organizational issues**: 3 (naming, structure, scripts)  
**Coverage gaps**: 1  
**CI redundancy**: 1  
**Documentation gaps**: 1  
**Recommended deletions**: 2 (unused fixtures, redundant scripts)  
**Recommended investigations**: 2 (hanging tests, resource leaks)  
**Recommended additions**: 2 (coverage, vision tests)

---

## Phase 5: Vision Compliance

**Status**: COMPLETE  
**Focus**: Config-driven logic, non-deterministic behavior, opinionated decisions, intelligence without evidence.

### Findings

#### 5.1 — Config System Violates Zero-Configuration Principle

**Location**: `src/verax/shared/config-loader.js` (189 lines)

**Problem**: Full configuration system with `--use-config` flag, despite Vision stating:

> "Zero-configuration is not a feature — it is a non-negotiable design principle. VERAX does not require setup, does not rely on project-specific configuration, does not ask teams to explain their application."

**Why Harmful**:
- Config system exists at all (even behind flag)
- `DEFAULT_CONFIG` includes opinionated defaults:
  - `defaultUrl: 'http://localhost:3000'` (assumption)
  - `denyKeywords: ['delete', 'remove', 'billing', 'payment']` (opinionated intelligence)
- Creates maintenance burden for feature that violates core principle

**Action**: **DELETE** — Remove entire config system. If specific parameters are needed, accept them as explicit CLI arguments only. No config files.

---

#### 5.2 — Non-Deterministic Run ID Generation (Timestamp-Based)

**Location**: `src/cli/util/run-id.js`

**Problem**: Uses `Date.now()` and `randomBytes()` to generate run IDs:
```javascript
const timestamp = now.toISOString().replace(/:/g, '-');
const hash = crypto.randomBytes(4).toString('hex');
return `${timestamp}_${hash}`;
```

**Contradicts**: `src/verax/core/run-id.js` which explicitly states:
> "CRITICAL: NO timestamps, NO random values. Hash must be identical for identical inputs"

**Why Harmful**:
- Two competing implementations with opposite philosophies
- Timestamp-based IDs violate determinism principle
- Vision #6: "VERAX prioritizes deterministic behavior over 'smart' behavior"
- Cannot reproduce identical runs for forensic analysis

**Action**: **FIX** — Delete `cli/util/run-id.js`. Use only `core/run-id.js` (deterministic hash-based).

---

#### 5.3 — Opinionated "Smart" Mode (Interactive Command)

**Location**: `src/cli/commands/default.js` (710 lines)

**Problem**: "Smart default command" with URL auto-detection, prompting, and adaptive behavior.

**Why Harmful**:
- Vision #6: "Determinism Over Intelligence"
- Vision #13: "VERAX will never guess user intent"
- Interactive mode makes assumptions and infers intent
- Already flagged in Phase 2.7 for deletion

**Action**: **DELETE** (per Phase 2.7) — CLI should be explicit-only. No intelligence, no guessing.

---

#### 5.4 — `denyKeywords` Configuration (Opinionated Intelligence)

**Location**: `src/verax/shared/config-loader.js` (lines 25-26)

**Problem**: Default config includes:
```javascript
denyKeywords: ['delete', 'remove', 'billing', 'payment']
```

**Why Harmful**:
- VERAX making judgment about what actions are "risky"
- Vision #13: "VERAX will never: guess user intent, infer business logic"
- Hardcoded business logic assumptions
- Users should decide what's risky, not VERAX

**Action**: **DELETE** — Remove `denyKeywords` entirely. VERAX observes, doesn't judge.

---

#### 5.5 — `inferViewSwitchKind()` Function (Hidden Intelligence)

**Location**: `src/verax/shared/view-switch-rules.js`

**Problem**: Function that "infers" view switch intent from function names.

**Why Harmful**:
- Explicit function name: `infer*` indicates guessing
- Vision: "Evidence Is the Supreme Authority. No evidence → no finding."
- Inference without evidence violates core principle

**Action**: **DELETE** or **RENAME** — If this function extracts explicit view switch signals from code, rename to `extractViewSwitchKind()`. If it actually guesses, delete it.

---

#### 5.6 — Heuristic Parameter Name Guessing in Dynamic Routes

**Location**: `src/verax/shared/dynamic-route-utils.js` (line 46)

**Comment**: `// Parameter name heuristics (deterministic)`

**Problem**: "Heuristics" are by definition educated guesses, not evidence.

**Why Harmful**:
- Vision: "VERAX never reports assumptions"
- Claiming heuristics are "deterministic" doesn't make them evidence-based
- Parameter name guessing violates no-guess principle

**Action**: **AUDIT** — If this code generates example paths for dynamic routes, clarify that these are NOT used for findings, only for logging/documentation. If used for detection, delete.

---

#### 5.7 — `Math.random()` Used for Internal IDs

**Locations**:
- `src/verax/observe/loading-sensor.js` (line 16)
- `src/verax/detect/journey-stall-detector.js` (line 465)
- `src/verax/detect/expectation-chain-detector.js` (line 161)

**Problem**: Internal IDs generated with `Math.random()` or `Date.now()`.

**Why Harmful**:
- Vision #6: "Determinism Over Intelligence. Given the same application, same state, same interaction, VERAX must produce the same outcome."
- Non-deterministic IDs make forensic comparison impossible
- Breaks reproducibility

**Action**: **FIX** — Replace with deterministic ID generation based on content hash.

---

#### 5.8 — `assume` Keyword in Code

**Location**: `src/verax/observe/interaction-runner.js` (line 594)

**Comment**: `// Navigation completed successfully - assume HTTP 200`

**Problem**: Explicit use of "assume" contradicts Vision.

**Why Harmful**:
- Vision: "VERAX never reports assumptions"
- If HTTP status cannot be observed, should be marked as "unknown", not "assumed 200"

**Action**: **FIX** — Replace assumption with explicit "unknown" marking or actual observation.

---

#### 5.9 — Vision Lock Comments Without Enforcement

**Locations**:
- `config-loader.js`: "VISION LOCKED"
- `expectation-prover.js`: "NO-GUESSING GUARANTEE"
- `flow-extractor.js`: "NO HEURISTICS"

**Problem**: Comments declare principles but no automated enforcement.

**Why Harmful**:
- Comments can drift from reality
- No tests verifying these guarantees
- Manual enforcement is unreliable

**Action**: **ENFORCE** — Create `test/release/vision-compliance.test.js` (per Phase 4.5) that:
- Scans codebase for banned keywords (`assume`, `guess`, `infer`, `heuristic`)
- Validates deterministic ID generation
- Checks for random/timestamp usage in critical paths

---

#### 5.10 — Missing Vision Principle Documentation in Code

**Problem**: No central `src/verax/PRINCIPLES.md` or similar enforcing constitutional rules at code level.

**Why Harmful**:
- Contributors may not know about Vision principles
- No reference document for code review
- Principles exist only in `docs/VISION.md` (distant from code)

**Action**: **CREATE** — Add `src/verax/PRINCIPLES.md` with:
- Core principles extracted from Vision
- Code-level enforcement rules
- Examples of violations and corrections
- Link to full Vision document

---

### Phase 5 Summary

**Total Issues**: 10  
**Vision violations**: 8 (config system, non-determinism, inference, assumptions, opinionated logic)  
**Competing implementations**: 1 (two run-id generators)  
**Unenforced guarantees**: 1 (vision lock comments)  
**Documentation gaps**: 1 (principles in code)  
**Recommended deletions**: 4 (config system, smart mode, deny keywords, inference functions)  
**Recommended fixes**: 3 (deterministic IDs, assumption removal)  
**Recommended enforcement**: 2 (automated tests, principles doc)

---

## Summary

**Audit Completion Date**: 2026-01-16  
**Total Phases Completed**: 6/6  
**Total Issues Identified**: 62  

### Breakdown by Phase

| Phase | Issues | Deletions | Moves | Restructures | Fixes | Creates |
|-------|--------|-----------|-------|--------------|-------|---------|
| 1 — Repository Structure | 12 | 15+ | 8+ | 5 | 0 | 1 |
| 2 — Legacy & Dead Code | 8 | 5 | 0 | 1 | 0 | 0 |
| 3 — Internal Code Quality | 12 | 0 | 0 | 7 | 2 | 1 |
| 4 — Tests & Automation | 10 | 2+ | 0 | 2 | 0 | 3 |
| 5 — Vision Compliance | 10 | 4 | 0 | 0 | 3 | 2 |
| **TOTAL** | **52** | **26+** | **8+** | **15** | **5** | **7** |

### Critical Violations by Category

**Vision/Constitution Violations** (10):
- Phase 2.1: `--allow-writes` flag (violates read-only principle)
- Phase 2.6: Unused expectation tracking (violates "not coverage-driven")
- Phase 5.1: Config system (violates zero-config principle)
- Phase 5.2: Non-deterministic run IDs (violates determinism)
- Phase 5.3: Interactive smart mode (violates "never guess intent")
- Phase 5.4: Opinionated deny keywords (violates "never infer business logic")
- Phase 5.5: Inference functions (violates "no assumptions")
- Phase 5.6: Heuristic guessing (violates evidence requirement)
- Phase 5.8: Explicit assumptions in code
- Phase 5.9: Unenforced vision locks

**Structural Chaos** (22):
- 13 root-level clutter files
- 10+ misplaced artifact directories
- 2 invalid/typo directories
- 70+ test fixture directories (likely overlapping)
- 5 competing CI workflow files
- Monster files (4 files >700 lines each)

**Dead/Legacy Code** (8):
- 5 `fix-*.js` scripts at root
- 8 debug output files at root
- `doctor` command (unnecessary)
- Dynamic route infrastructure (contradicts docs)
- Legacy artifact type in code

**Code Quality Issues** (12):
- 20+ TypeScript suppressions
- Long parameter lists (7-10 params)
- Inconsistent null handling
- Silence tracker fragmentation
- Detect phase fragmentation (20+ modules)
- Naming inconsistency ("truth" vs "reality")

### Priority 1 — Immediate Action Required

These findings directly violate VERAX constitutional principles and must be addressed immediately:

1. **DELETE `--allow-writes` flag** (Phase 2.1)
2. **DELETE config system** (Phase 5.1)
3. **FIX non-deterministic run IDs** (Phase 5.2)
4. **DELETE interactive mode** (Phase 5.3)
5. **DELETE deny keywords** (Phase 5.4)
6. **CREATE vision compliance tests** (Phase 5.9)

### Priority 2 — Major Structural Cleanup

These findings represent significant technical debt and structural problems:

1. **Clean root directory** — Delete/move 21+ files (Phase 1.1-1.3)
2. **Restructure artifacts/** — Remove invalid/typo directories (Phase 1.4-1.6)
3. **Split monster files** — 4 files requiring breakup (Phase 3.1-3.4)
4. **Consolidate test fixtures** — Audit 70+ directories (Phase 4.1)
5. **Fix test infrastructure** — Remove force-exit wrapper (Phase 4.2)

### Priority 3 — Quality & Documentation

Lower-priority improvements for maintainability:

1. Fix TypeScript suppressions (Phase 3.5)
2. Standardize null handling (Phase 3.10)
3. Create API documentation (Phase 3.12)
4. Add test coverage reporting (Phase 4.7)
5. Create testing documentation (Phase 4.10)
6. Create principles documentation (Phase 5.10)

### Recommended Execution Order

**Week 1 — Constitutional Repairs**:
- Remove all Vision violations (Priority 1)
- Create enforcement tests
- Document principles in code

**Week 2 — Structural Cleanup**:
- Clean repository root
- Restructure artifacts/
- Consolidate CI workflows
- Audit test fixtures

**Week 3 — Code Quality**:
- Split monster files
- Fix TypeScript issues
- Standardize conventions
- Add documentation

**Week 4 — Testing & Verification**:
- Fix test infrastructure
- Add coverage reporting
- Verify all changes
- Final audit pass

---

## Conclusion

VERAX has **52 identified issues** across 5 audit dimensions.

**Most Critical Finding**: Multiple constitutional violations exist in production code, including features that directly contradict the Vision document (config system, non-determinism, inference/guessing logic).

**Root Cause**: Lack of automated enforcement for Vision principles. "VISION LOCK" comments exist but are not validated.

**Immediate Action**: Delete 4 major features (config, smart mode, allow-writes, deny keywords) and implement automated Vision compliance testing before any new development.

---

*End of Audit Document*
