# scripts

Purpose-driven utilities for development and CI.

## Active Scripts

- `add-missing-imports.mjs` — helper to auto-add missing imports during refactors.
- `validate-network-detection.js`, `validate-ui-feedback-detection.js`, `validate-usestate-detection.js` — local validators for detection heuristics.
- `verify-release.js` — invoked by CI release prechecks (see .github/workflows/ci.yml).
- `check-root-contract.js` — root contract guard used in local/CI checks.

## Legacy & Archived Scripts

Historical one-off scripts have been moved to `/scripts/archive/`:

- `final-timestamp-migration.mjs` — historical one-off timestamp migration (not used in CI)
- `migrate-timestamps.mjs` — historical timestamp migration utility (not used in CI)
- `suppress-string-buffer-errors.js` — legacy error suppression mitigation (manual-use only)

See `/scripts/archive/README.md` for details on archived scripts.

## CI Scripts

CI-specific scripts have been moved to `/.github/scripts/`:

- `verax-ci-summary.js` — optional helper for parsing .verax run artifacts in CI/PR workflows (not auto-invoked by current workflows)

CI workflows (`.github/workflows/ci.yml`) run `verify-release.js` from this directory on ubuntu matrix to validate release readiness.
