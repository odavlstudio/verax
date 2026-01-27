# /scripts/archive — Historical & Legacy Scripts

This directory contains one-off scripts and utilities that are **no longer active** in the VERAX codebase.

**Status**: Preserved for historical reference only. Not used in CI or runtime operations.

## Contents

- `final-timestamp-migration.mjs` — One-time timestamp migration script (executed once, kept for reference)
- `migrate-timestamps.mjs` — Historical timestamp migration utility (not used in CI)
- `suppress-string-buffer-errors.js` — Legacy error suppression mitigation (manual-use only, not integrated into workflow)

## Why These Exist Here

These scripts represent specific engineering decisions made during development that required one-off migrations or short-lived mitigations. They are preserved in case:

1. Historical context is needed (e.g., "why did we change timestamp handling?")
2. Similar operations need to be performed again in the future
3. Code archaeology requires understanding past transformations

## Usage

**Do NOT run these scripts unless you have a specific reason and have reviewed the code carefully.**

These scripts:
- May have undocumented dependencies
- May not work with current versions of dependencies
- Are not tested as part of the CI pipeline
- May break if core code has changed

If you need to run one of these scripts, document why you are running it and verify its behavior before executing.

## When to Move to Deletion

Consider deleting these scripts when:
- The affected code areas are completely refactored and the script becomes irrelevant
- Multiple major versions have passed without any use
- A decision is made that the historical context is no longer needed

See the main `/scripts/README.md` for currently active development utilities.
