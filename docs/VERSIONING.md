# Versioning Policy

Guardian follows **Semantic Versioning 2.0.0** (semver).

## Version Format

```
MAJOR.MINOR.PATCH
```

- **MAJOR:** Incompatible changes (breaking changes)
- **MINOR:** New backward-compatible features
- **PATCH:** Bug fixes, no new features

## Current Baseline

**v2.0.0** is the **first canonical release**. All versions before v2.0.0 (v1.x, v0.x) were experimental/pre-canonical development versions.

## Version Authority

**package.json** is the single source of truth for Guardian's version.

All other version references must match:
- Git tags must match `package.json` version
- CHANGELOG.md must list current version
- README.md must reference current version
- npm publishes based on `package.json` version

## Breaking Changes

A **breaking change** requires a **MAJOR version bump** (e.g., 2.0.0 → 3.0.0).

### Examples of Breaking Changes

| Change | Reason |
|--------|--------|
| Change exit code mapping (e.g., FRICTION → 0 instead of 1) | Exit codes are permanent contracts; CI/CD scripts depend on them |
| Change verdict verdict logic (e.g., READY criteria) | Verdict definitions are guarantees; changing breaks assumptions |
| Change CLI flags or arguments | Automation depends on CLI interface |
| Remove or rename exported functions | Programmatic usage breaks |
| Change default CI gate behavior | CI pipelines built on current defaults |
| Violate contract guarantees (see `guardian-contract-v1.md`) | Contracts are permanent unless versioned |
| Change filesystem containment scope | Security assumptions change |
| Change scheduler safety guarantees | Automation patterns break |

### Examples of NON-Breaking Changes

| Change | Reason |
|--------|--------|
| Add new exit code or verdict | Existing codes unchanged; purely additive |
| Add new CLI flag (optional) | Existing scripts still work |
| Improve verdict confidence | Output more helpful, not different |
| Add new flow validation rule | More coverage, same core behavior |
| Speed up Guardian execution | Faster is always compatible |
| Add new export format | Existing exports unchanged |
| Improve error messages | Better debugging, same contract |

## Contract Stability

Guardian has **4 permanent behavioral contracts** documented in `guardian-contract-v1.md`:

1. **CI Gate Default Is Strict**
2. **Filesystem Containment**
3. **Always-Log Evidence**
4. **Scheduler Safety Guarantees**

Breaking any contract requires a **MAJOR version bump**.

These contracts are **tested, not documented**:

```bash
test/contracts/contract-ci-gate.test.js
test/contracts/contract-filesystem.test.js
test/contracts/contract-observability.test.js
test/contracts/contract-scheduler.test.js
```

If a contract test fails, CI/CD pipeline fails. No breaking changes can ship without a major version bump.

## Version Release Process

1. **Update package.json** with new version
2. **Update CHANGELOG.md** with changes
3. **Create git commit** with message `chore(release): vX.Y.Z`
4. **Create git tag** annotated: `git tag -a vX.Y.Z -m "Release vX.Y.Z"`
5. **Push commit and tag** to origin
6. **Publish to npm** when ready

## Pre-Release Versions (Optional)

For future use, pre-release versions use format: `2.0.0-alpha`, `2.0.0-beta`, `2.0.0-rc.1`

These are **not currently used** and must be explicitly pulled by version.

## Summary

- **Minor/Patch bumps:** Low risk, additive changes only
- **Major bumps:** Required for breaking changes, contract violations
- **Single source of truth:** Always check `package.json`
- **Contracts enforce rules:** Breaking contracts forces major version
