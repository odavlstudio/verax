# Contributing to VERAX

Thank you for your interest in contributing to VERAX!

## Development Workflow

### Artifact Prevention & Cleanup Policy

**CRITICAL: Build Artifacts and Temporary Files**

VERAX maintains strict controls to prevent repository pollution. The following must **NEVER** be committed:

- ❌ `.tgz` files (npm pack artifacts)
- ❌ `/tmp/` directory (deleted in STAGE 1 cleanup — use OS temp or `.verax/` instead)
- ❌ `/artifacts/` directory (deleted in STAGE 1 cleanup — use `.verax/runs/` instead)
- ❌ `/.verax/` directory contents (runtime outputs only)

**Automatic Safeguards:**

1. **Git Layer**: `.gitignore` blocks all artifacts (see comments in file for rationale)
2. **NPM Layer**: `postpack` hook auto-removes `.tgz` files after `npm pack`
3. **Cleanup Script**: Run `npm run clean` to remove `.verax/` and any stray `tmp/` directories

**Where to Put Things:**

| **What You Need** | **Where to Put It** |
|-------------------|---------------------|
| Test fixtures (committed) | `/test/fixtures/` |
| Test helpers (committed) | `/test/helpers/` |
| Runtime output (user-controlled) | `.verax/runs/<runId>/` |
| Temporary debugging files | OS temp directory (`os.tmpdir()`) or `.verax/` (then clean) |
| One-off debug scripts | Delete after use, or document in `/scripts/` if reusable |

**Before Committing:**

```bash
# Clean runtime artifacts
npm run clean

# Verify no artifacts remain
git status

# If you see .tgz, tmp/, artifacts/, or .verax/ — DO NOT commit them
```

**If You Accidentally Create Artifacts:**

1. Run `npm run clean` immediately
2. If `.tgz` files persist, delete manually: `rm *.tgz`
3. Never use `git add .` — use explicit paths to avoid accidents

### Code Changes

**Before Submitting:**
- Run full test suite: `npm test`
- Ensure all tests pass
- Follow existing code style
- Update documentation if needed

**Determinism Requirements:**
If your change affects artifact generation:
- Ensure outputs are byte-identical across runs with the same inputs
- Respect locale-independent sorting (use `localeCompare(other, 'en', { sensitivity: 'base' })`)
- Use `normalizeToPosixPath()` for file paths in artifacts
- Use `getTimeProvider().iso()` for timestamps in evidence artifacts

### Testing

**Test Organization:**
- Unit tests: `/test/src/` (mirrors `/src/` structure)
- Integration tests: `/test/release/`
- Contract tests: `/test/contracts/`
- Fixtures: `/test/fixtures/`

**Running Tests:**
```bash
npm test                    # Run full test suite
npm test -- path/to/test.js # Run specific test file
```

### Documentation

**Key Documents:**
- `/constitution/` — Core principles and invariants (requires maintainer approval to change)
- `/docs/` — User-facing documentation
- `README.md` — Quick start and overview

### Questions?

Open an issue or discussion in the repository.

---

**Remember:** VERAX is forensic and evidence-driven. Changes should maintain these principles: no guessing, no speculation, deterministic by design.
