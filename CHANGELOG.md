# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.5.1] - 2026-01-24 (patch)

### Breaking Changes

- None.

### Improvements

- Pre-publish validation now fails if the human changelog entry for the release is missing or lacks the required sections/type metadata.
- `verax version` trust surface is contract-tested and keeps stability, compatibility guarantees, and deprecation policy visible by default.
- Historical changelog headings now carry explicit release types to mirror the semantic versioning law.

### Fixes

- Added the 0.4.2 human changelog entry to stay aligned with the machine changelog.
- Release validation now checks CHANGELOG.md alongside changelog.json before publish.

### Guarantees (unchanged)

- CLI commands and exit codes remain stable (0/10/20/30/40/50/64).
- Artifact schemas unchanged: `summary.json`, `findings.json`, `observe.json`.
- Deterministic, read-only, zero-config behavior preserved.

## [0.5.0] - 2026-01-24 (minor)

### Breaking Changes

- None.

### Improvements

- `verax version` now reports stability, compatibility guarantees, and versioning law from the single source of truth (`src/version.js`).
- Pre-publish validation blocks releases without version bumps, semantic changelog entries, passing tests, or clean git state.
- README surfaces stability/npm badges and upgrade safety rules at the top for quick risk assessment.
- Deprecation framework wired for CLI flags with policy-first warnings and test coverage.

### Fixes

- Reinforced `src/version.js` as the only version source and synchronized package metadata.
- Changelog validation now enforces required fields, types, and semver-aligned release types.

### Guarantees (unchanged)

- CLI contract and exit codes remain stable (0/10/20/30/40/50/64).
- Artifact schema unchanged: `summary.json`, `findings.json`, `observe.json`.
- Deterministic behavior preserved: same inputs produce identical outputs.
- Read-only safety remains: scans never modify the application under test.
- Zero-config defaults still work without user configuration.

## [0.4.2] - 2026-01-24 (minor)

### Breaking Changes

- None.

### Improvements

- Standardized CLI exit codes (0/10/20/30/40/50/64) for Stage 7.0 contract hardening.
- Zero-config first-run experience with automatic discovery defaults.
- GitHub Actions workflow wired with exit code mapping for CI trust signals.

### Fixes

- Normalized exit code 65 to 50 (EVIDENCE_VIOLATION) across commands.
- First-run detection now checks both `.verax/runs/` and `.verax/scans/` directories.
- CI environments (`CI=true`) disable relaxed first-run defaults.

### Guarantees (unchanged)

- Exit codes 0/10/20/30/40/50/64 remain stable.
- Artifact schemas unchanged: `summary.json`, `findings.json`, `observe.json`.
- Deterministic behavior preserved.
- Read-only, zero-config defaults remain intact.

## [0.4.0] - 2026-01-17 (minor)

Status: Beta

### Summary

- Trust-Locked, deterministic, CI-safe public flow sanity guard
- Evidence-backed findings only (no evidence → no finding)
- Strict scope: pre-auth public flows; no business logic validation
- 241 tests covering detection logic, exit codes, invariants

### Updates

- README positioning locked to public-flow, CI-safe, deterministic scope
- CLI UX: clearer completion summary; lightweight progress indicator on long runs
- Error messages standardized with `[ERROR]` prefix across CLI commands
- CI adoption docs added: `docs/CI_INTEGRATION.md`

### Guarantees (Trust Lock)

- **No evidence → no finding** — Findings are only reported when observable evidence exists
- **Internal errors never reported as user bugs** — Exceptions and tool failures explicitly excluded from findings
- **Deterministic results** — Same run on same target produces identical findings
- **Honest scope** — No claims about auth flows, business logic, or QA replacement

### What VERAX Intentionally Does NOT Do

- ❌ Validate authentication flows or authorization logic
- ❌ Check business correctness (e.g., cart math, pricing, permissions)
- ❌ Scan authenticated/protected areas
- ❌ Replace QA, E2E testing, or security audits
- ❌ Analyze network performance or backend behavior

### Breaking Changes

None. Exit codes, JSON artifacts, and CLI interface remain compatible with v0.3.x.

## [0.3.1] - 2026-01-16 (patch)

### Fixed

- **Exit Code Policy (CRITICAL)**: `verax run` now returns correct exit codes for CI/CD integration:
  - Exit 0: Run completed successfully with no silent failures detected
  - Exit 1: Run completed successfully but silent failures were detected
  - Exit 66: Run incomplete due to timeout or partial observation
  - Exit 2, 64, 65: Unchanged (crash, usage error, invalid data)
- Timeout status changed from 'FAILED' to 'INCOMPLETE' for proper exit code handling

## [0.3.0] - 2026-01-13 (minor)

### Updates

- Package metadata and CI/CD workflow configuration updates
- Minor documentation corrections and artifact cleanup
- Test fixture organization and screenshot management
- Workflow file improvements for release automation
- Enhanced CI/CD workflow configurations
- Improved artifact structure and organization
- Updated test fixtures for better test coverage

## [0.2.0] - 2026-01-11 (minor)

### Added (Release Discipline & Documentation)

#### Release Discipline & Documentation

- Official demo projects (demo-static, demo-react, demo-nextjs) with intentional silent failures
- ACCEPTANCE.md: 10-item production readiness checklist
- FINAL_LOCK.md: Comprehensive scope, limitations, and evidence interpretation guide
- Deterministic redaction testing (redaction.test.js: 12 test cases, all passing)
- Deterministic ID testing (determinism.test.js: 8 test cases, all passing)

### Changed

#### CLI Contract Correction (CRITICAL)

- Removed ALL references to non-existent commands (scan, flow, learn, observe) from code and documentation
- CLI now correctly exposes only: `verax`, `verax run`, `verax inspect`, `verax doctor`
- Updated all error messages and help text to use correct command names

#### Enterprise Hardening

- **Run Lifecycle Fix**: `run.status.json` now properly transitions RUNNING → COMPLETE on success and RUNNING → FAILED on crash
- **Summary Digest Guarantee**: `summary.json` ALWAYS contains digest field (defaults to zeros on failure)
- **Crash Safety**: All unhandled errors now mark run as FAILED and preserve partial artifacts
- **Version Tracking**: All run metadata now uses correct version (0.2.0) from package.json

#### Documentation

- Updated README.md to reference only implemented commands
- Updated ACCEPTANCE.md to version 0.2.0 with correct checklist items
- Updated FINAL_LOCK.md scope statement to reflect actual implementation

### Resolved Issues

- **CLI contract alignment**: Code and docs now match actual CLI surface
- **Run status transitions**: Proper lifecycle management with FAILED status on errors
- **Summary digest**: Guaranteed presence of digest in all code paths
- **Crash safety**: Proper error handling with status updates and artifact preservation
- **Version consistency**: All metadata uses package.json version (0.2.0)
- Documentation no longer references non-existent commands
- Acceptance criteria match real CLI surface and artifact structure

## [0.1.0] - 2026-01-11 (minor)

### Added

#### Phase 1-3: Core Foundation

- Learn phase: Extracts explicit code expectations (navigation, network, state changes) from source code
- Observe phase: Real browser observation using Playwright to capture user-visible outcomes
- Detect phase: Deterministic classification of expectations vs. observations (observed, silent-failure, coverage-gap, unproven, informational)

#### Phase 4-6: Enterprise Hardening

- Doctor command: Environment diagnostics (Node ≥18, Playwright install, Chromium binary, headless smoke test)
- Redaction & Privacy (Phase 8.2): Masks sensitive headers (Authorization, Cookie, X-API-Key), bearer tokens, JWTs, and query parameters before writing to disk
- Deterministic ID generation (Phase 8.3): Hash-based expectation IDs (exp_\<hash\>) independent of discovery order
- Stable ordering: Expectations, observations, and findings sorted deterministically by file→line→column→kind→value
- Stable summary digest: Counts (expectationsTotal, attempted, observed, silentFailures, coverageGaps, unproven, informational) identical across runs

#### Phase 9: Packaging & Release Discipline

- npm packaging as @veraxhq/verax with correct bin setup
- Cross-platform binary with proper shebang
- MIT license
- Production-ready release artifacts

### Features

- **Code-Driven Expectations**: Extracts promises from Next.js, Vue, and static HTML source code
- **Real Browser Testing**: Uses Playwright to observe actual user-visible outcomes
- **Silent Failure Detection**: Identifies gaps between what code promises and what users can observe
- **Evidence-Backed Classifications**: Every finding includes confidence score and evidence file references
- **Privacy-First**: Automatic redaction of sensitive data (tokens, headers, API keys) before disk writes
- **Deterministic Output**: Same inputs produce identical IDs, ordering, and digest across runs
- **Enterprise Diagnostics**: Doctor command validates environment readiness

### Commands

- `verax run --url <url> --src <path>`: Run complete Learn→Observe→Detect pipeline
- `verax doctor [--json]`: Verify environment (Node, Playwright, Chromium, sandbox)
- `verax --version`: Show package version
- `verax --help`: Show help text

### Technical Details

- **Node.js**: Requires >=18.0.0
- **Dependencies**: Playwright (browser automation), Inquirer (prompts), glob (file discovery)
- **Detection Engine**: Deterministic confidence calculation based on evidence signals (screenshots, network logs, DOM changes)
- **Impact Scoring**: Routes and APIs classified as HIGH/MEDIUM/LOW based on type
- **Redaction**: Bearer tokens, JWT patterns, Authorization headers, Cookie headers, X-API-Key, query params (api_key, access_token)

### Known Limitations

- Observation requires real browser launch (slow for CI without optimization)
- Dynamic route parameters not captured from source code
- External link validation not included in Learn phase
- State observations limited to DOM/console inspection

---

[0.1.0]: https://github.com/odavlstudio/verax/releases/tag/v0.1.0
