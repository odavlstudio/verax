# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.2] - 2025-01-04

### Initial Public Stable Release

First stable, supported public release of ODAVL Guardian.

**Note:** Earlier versions (1.0.0, 1.0.1) were published but are deprecated due to release pipeline issues. Version 1.0.2 is the first officially supported release and the recommended version for all users.

### Features

- **Silent Failure Detection**: Detects user interactions that produce no observable effect
  - CTA button clicks that do nothing
  - Navigation links that fail or loop
  - Form submissions with no feedback
  - UI toggles that don't change content

- **Adaptive Observation Windows**: Dynamic waiting (4-12s) that adapts to page activity
  - Base wait: 4-5 seconds
  - Extends up to 12 seconds if DOM/network activity continues
  - Prevents false negatives from delayed content loading

- **Animation Mutation Filtering**: Ignores style/class changes that don't affect content
  - Filters animation-only DOM mutations
  - Prioritizes text changes, new interactive elements, modal insertion
  - Reduces false positives from CSS animations

- **SPA Navigation Detection**: Detects client-side routing even when URL doesn't change
  - History API change detection (pushState/replaceState)
  - Main content container replacement detection
  - Scroll position reset correlation
  - Marks SPA navigation as successful

- **Robust Element Selectors**: Prioritized selector strategy chain
  - ID → data-testid → aria-label → role+name → text → nth-of-type
  - Selector strategy included in failure reports

- **Deterministic Execution**: Consistent results across runs
  - Deterministic sorting of elements and failures
  - Identical runs produce identical JSON output

- **CI/CD Integration**: Designed for automation
  - Strict exit code contract: 0 (pass), 1 (failures), 2 (error)
  - CI-friendly output (no interactive prompts)
  - GitHub Actions workflow example included

- **Evidence Collection**: Comprehensive failure evidence
  - Before/after screenshots
  - Optional HAR (HTTP Archive) recording
  - Structured JSON reports with severity scores

### Validation

- **Real-World Validation Program**: Tested on 30 diverse production websites
- **Metrics**:
  - Precision: 95.8% (95.8% of reported failures are real)
  - Recall: 100% (all detected failures verified)
  - F1 Score: 97.9%
- **Certification**: CERTIFIED FOR PUBLIC RELEASE

### Documentation

- Complete README with installation and usage instructions
- CI/CD integration guide
- Exit code contract documentation
- Versioning and breaking changes policy

### Technical Requirements

- Node.js >= 18.0.0
- Playwright (browsers installed via `npx playwright install`)

---

## Previous Versions

The following versions were published but are not supported:

### [1.0.1] - 2025-01-04

- Removed accidental npm deprecation flag
- No functional changes

### [1.0.0] - 2025-01-04

- Initial release attempt
