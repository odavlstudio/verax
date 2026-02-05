# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.4.9] - 2026-02-05 (patch)

### Pilot (purpose)

This release is cut for pilot usage: run a read-only scan of a public (pre-login) URL, generate evidence-backed artifacts, and bundle them for sharing/CI.

### Pilot (guarantees)

- Public CLI surface is frozen to: `run`, `bundle`, `readiness`, `capability-bundle`, `version`, `help` (plus `--help/-h`, `--version/-v` fast exits).
- Exit codes remain stable: `0` SUCCESS, `20` FINDINGS, `30` INCOMPLETE, `50` INVARIANT_VIOLATION, `64` USAGE_ERROR.
- Truth vocabulary remains stable in user-facing outputs and `summary.json`: `SUCCESS`, `FINDINGS`, `INCOMPLETE`.
- Bundles include an integrity manifest (`integrity.manifest.json`) to detect missing/tampered files.

### Pilot (explicitly out of scope)

- Post-auth / authenticated scanning unless explicitly forced; pilots are intended for public, pre-login flows by default.
- Business logic correctness validation (e.g., pricing/math/permissions).
- Security vulnerability scanning and compliance judgments.
- Monitoring/analytics and performance benchmarking.

### Breaking Changes

- None.

### Improvements

- Pilot surface commands are locked and contract-tested (see `verax --help` for the frozen list).
- Pilot-only diagnostics: `readiness` (no scan) and `capability-bundle` (safe-to-share bundle).
- Bundling validates required run artifacts and includes integrity metadata.

### Fixes

- `scripts/verify-release.js` now keeps the packed tarball for verification (postpack cleanup is skipped only for the verifier).
- `verax bundle` no longer fails on valid runs due to summary/findings count drift.

### Guarantees

- Exit codes and truth vocabulary remain stable (0/20/30/50/64; SUCCESS/FINDINGS/INCOMPLETE).
- Public CLI surface remains frozen to the pilot commands listed above.

## [0.4.6] - 2026-01-28 (patch)

### Breaking Changes

- None.

### Improvements

- README completely rewritten for npm onboarding clarity and first-run success.
- Replaced vague "LIMITED mode" terminology with clear "source-not-detected" behavior explanation.
- Added explicit prerequisites before own-site usage instructions.
- Provided concrete example artifact paths and runIds (e.g., `20260128-143052-run-abc123`).
- Fixed broken URL example (`https://your-site.test` → `http://localhost:3000`).
- Added operational clarity to INCOMPLETE exit code (table of causes and fixes).
- Added clarity to SUCCESS exit code (explicit "does NOT mean" and "means" sections).
- Defined "Partial" framework support operationally.
- Added `verax doctor` diagnostics to source-not-detected troubleshooting.
- All examples now realistic and immediately actionable for first-time users.

### Fixes

- Removed placeholder paths like `<id>` and `<runId>`; all paths now concrete.
- Removed nested-terminology contradictions (LIMITED mode vs evidence-backed safety).
- Clarified that source detection looks for specific file types (.js, .jsx, .tsx, .html).
- Clarified that INCOMPLETE is not a reduced-functionality mode but a hard blocker.

### Guarantees (unchanged)

- CLI commands and exit codes remain stable (0/20/30/50/64).
- Artifact schemas unchanged: `summary.json`, `findings.json`, `observe.json`.
- Deterministic, read-only, zero-config behavior preserved.
- No code changes; documentation-only release.

## [0.4.5] - 2026-01-24 (patch)

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

- CLI commands and exit codes remain stable (0/20/30/50/64).
- Artifact schemas unchanged: `summary.json`, `findings.json`, `observe.json`.
- Deterministic, read-only, zero-config behavior preserved.

## [0.4.2] - 2026-01-24 (minor)

### Breaking Changes

- None.

### Improvements

- Standardized CLI exit codes (0/20/30/50/64) for Stage 7.0 contract hardening.
- Zero-config first-run experience with automatic discovery defaults.
- GitHub Actions workflow wired with exit code mapping for CI trust signals.

### Fixes

- Normalized non-contract exit codes to 50 (INVARIANT_VIOLATION) across commands.
- First-run detection now checks both `.verax/runs/` and `.verax/scans/` directories.
- CI environments (`CI=true`) disable relaxed first-run defaults.

### Guarantees (unchanged)

- Exit codes 0/20/30/50/64 remain stable.
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
  - Exit 20: Run completed but findings were detected
  - Exit 30: Run incomplete due to timeout or partial observation
  - Exit 50, 64: Unchanged (invariant violation, usage error)
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
