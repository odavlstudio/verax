# Release Engineering Audit Report
**Project:** odavlguardian  
**Audit Date:** 2026-01-02  
**Auditor:** Release Engineering Auditor  
**Scope:** Version history, release integrity, breaking changes, contract stability

---

## Executive Summary

**Current State:** The repository has experienced rapid, iterative versioning with **inconsistencies and contradictions** across version declarations, CHANGELOG entries, and git tags. The current declared version is **2.0.0** (package.json), but the repository exhibits signs of version confusion, duplicate entries, and incomplete alignment.

**Critical Finding:** The codebase has **contract-stable behavior** (exit codes, verdicts, filesystem containment), which justifies a major release, but the versioning history shows instability that needs resolution before a clean final release.

**Recommendation:** Perform a **version reset and normalization** to **2.0.0** as the canonical stable release, with full alignment across all artifacts.

---

## 1. Version Inventory

### Current Declared Versions

| Location | Version | Release State | Notes |
|----------|---------|---------------|-------|
| **package.json** | `2.0.0` | `stable` | Main npm package |
| **extension/package.json** | `1.1.2` | — | VS Code extension |
| **website/package.json** | `0.1.0` | — | Documentation website |
| **README.md** | `2.0.0` | Stable | Line 7 |
| **Git tag v2.0.0** | 2.0.0 | — | Tag exists (commit 84a9e1b) |
| **Git tag v1.1.1** | 1.1.1 | — | Tag exists (commit 84a9e1b, **same as v2.0.0**) |

### Version References in Documentation

| File | Version(s) Mentioned | Context |
|------|---------------------|---------|
| CHANGELOG.md | 2.0.0, 1.1.2, 1.1.1, 1.0.1, 1.0.0, 0.3.0 | Release history |
| extension/CHANGELOG.md | 1.1.2, 1.1.1, 0.2.0, 0.1.0 | Extension release history |
| test/contracts/README.md | `1.1.2+contracts` | Contract version reference |
| internal/audits/*.md | Multiple references to 1.1.2, 2.0.0 version mismatch | Audit findings |

### Artifacts Found

- **No .tgz files found** in repository (good: artifacts not committed)
- **Sample artifacts** in `website/public/sample-artifacts/` reference version `1.0.0`
- **No published artifacts** found in repository structure

---

## 2. Git History Analysis

### Git Tags

```
v1.1.1  →  commit 84a9e1b (2026-01-01)
v2.0.0  →  commit 84a9e1b (2026-01-01)  [SAME COMMIT]
```

**Critical Issue:** Both `v1.1.1` and `v2.0.0` tags point to the **same commit** (84a9e1b). This creates ambiguity about the actual release version.

### Version Change Timeline (from git log)

```
Date         | Commit   | Action                                      | Version
-------------|----------|---------------------------------------------|----------
2026-01-01   | 84a9e1b  | release: v1.1.1 — reality freeze & version alignment | 1.1.1 (and v2.0.0 tag)
2026-01-01   | 8a35169  | chore: bump version to 1.1.1                | 1.1.1
2025-12-31   | 24fb740  | Release v1.0.1: Sync public version to code reality | 1.0.1
2025-12-30   | c6fc968  | chore: bump version to 1.1.0                | 1.1.0
2025-12-29   | 9f9260d  | chore: release v1.0.0 - stable production release | 1.0.0
2025-12-24   | f62686d  | chore(release): bump version to v0.2.0      | 0.2.0
2025-12-23   | c92fcc6  | chore(release): prepare npm package v0.1.0-rc1 | 0.1.0-rc1
```

### Version Jump Pattern (from package.json history)

```
0.1.0 (doctor-error, original project name)
  → 0.1.0-rc1 (odavl-guardian)
  → 0.2.0
  → 1.0.0
  → 1.1.0
  → 1.0.1  [REGRESSION: 1.1.0 → 1.0.1]
  → 1.1.1
  → 2.0.0  [CURRENT]
```

**Critical Issue:** Version **regressed** from `1.1.0` to `1.0.1` on 2025-12-31, then jumped back to `1.1.1`, indicating versioning confusion during rapid iteration.

### Release Commits Without Clear Intent

- Commit `84a9e1b` is tagged as **both** v1.1.1 and v2.0.0
- Multiple commits claim "v1.0.0 release" (9f9260d, 4a9735d, 75bb941)
- Version bumps occurred without corresponding CHANGELOG entries in some cases

---

## 3. CHANGELOG Analysis

### Versions Listed in CHANGELOG.md

1. **[2.0.0]** — Final Seal Strict Gate Release (2026-01-01) — **BREAKING**
2. **[1.1.2]** — Packaging Hotfix (2026-01-01) — Hotfix
3. **[1.1.1]** — Reality Freeze & Version Alignment Release (2025-12-31) — Stable
4. **[1.1.1]** — Reality Freeze & Version Alignment Release (2025-12-31) — **DUPLICATE**
5. **[1.0.1]** — Patch Release (2025-12-31) — Stable
6. **[1.0.0]** — First Stable Release (2025-12-30) — Stable
7. **[1.0.0]** — Stable Release - Market Reality Testing Engine (2025-12-29) — **DUPLICATE**
8. **[0.3.0]** — Beta Release with Working Engine (2025-12-28) — Beta

### Inconsistencies and Problems

#### Problem 1: Duplicate Entries
- **1.1.1 appears TWICE** (lines 33 and 74)
- **1.0.0 appears TWICE** (lines 103 and 140)

#### Problem 2: Missing Version in Git History
- **1.1.2** appears in CHANGELOG (line 46) but **no git tag exists** for v1.1.2
- **1.1.2** is only in `extension/package.json`, not main `package.json`

#### Problem 3: Timeline Inconsistencies
- CHANGELOG shows 1.1.1 on 2025-12-31
- CHANGELOG shows 1.1.2 on 2026-01-01 (after 1.1.1)
- CHANGELOG shows 2.0.0 on 2026-01-01 (same date as 1.1.2)
- Git shows all three (1.1.1, 1.1.2, 2.0.0) on the same or adjacent dates

#### Problem 4: Version Order Violation
CHANGELOG presents versions in this order:
```
2.0.0 (top, most recent)
1.1.1
1.1.2  [OUT OF ORDER - should be after 1.1.1]
1.1.1  [DUPLICATE]
1.0.1
1.0.0 (duplicate)
0.3.0
```

**Expected order:** 2.0.0 → 1.1.2 → 1.1.1 → 1.0.1 → 1.0.0 → 0.3.0

#### Problem 5: Entry Quality
- Some entries are comprehensive with detailed subsections
- Others are minimal placeholders
- No consistent format for breaking changes

### Gaps
- No entry for version bumps that occurred in git history (e.g., 0.2.0 mentioned in commits but minimal CHANGELOG entry)
- No clear mapping between git commits and CHANGELOG entries for some releases

---

## 4. Breaking Change Detection

### Confirmed Breaking Changes

#### A. Exit Code Semantics (Locked via Contract Tests)
**Status:** ✅ **STABLE, CONTRACT-PROTECTED**

From `test/contracts/contract-exit-codes.test.js`:
```
READY          → exit code 0
FRICTION       → exit code 1
DO_NOT_LAUNCH  → exit code 2
ERROR/UNKNOWN  → exit code 3
```

**Evidence:**
- `src/guardian/verdicts.js` implements canonical mapping
- `test/contracts/contract-exit-codes.test.js` enforces immutability
- All tests passing (26 passing as of audit date)

**Breaking Change Assessment:** Exit codes were **established and locked** during the 1.0.0 timeframe. No evidence of changes since stabilization.

#### B. Verdict Logic (Three-Tier System)
**Status:** ✅ **STABLE**

From `src/guardian/verdict.js` and multiple references:
```
READY          — All flows succeeded, safe to launch
FRICTION       — Mixed outcomes, caution required
DO_NOT_LAUNCH  — Critical failure, block deployment
```

**Evidence:**
- Verdict logic is deterministic and covered by tests
- `src/guardian/verdict-clarity.js` provides human-readable explanations
- Contract tests verify verdict-to-exit-code mapping

**Breaking Change Assessment:** Verdict semantics were established in early 1.0.0 and have remained stable.

#### C. Filesystem Containment (Contract C)
**Status:** ✅ **STABLE, CONTRACT-PROTECTED**

From `test/contracts/README.md` and `test/contracts/contract-filesystem.test.js`:
- Path traversal (`..`) is rejected
- Absolute external paths are rejected
- All artifacts written within `.guardian/` directory

**Breaking Change Assessment:** Filesystem containment was introduced as a **breaking change** in version 2.0.0 (per CHANGELOG), and is now contract-protected.

#### D. CI Gate Default Behavior (Contract A)
**Status:** ✅ **BREAKING CHANGE in 2.0.0, NOW STABLE**

From `test/contracts/README.md` and CHANGELOG:
```
Before 2.0.0: CI behavior default was advisory (or unspecified)
2.0.0:        CI gate defaults to STRICT mode (breaking)
```

**CHANGELOG Entry (2.0.0):**
> **Strict-by-default CI gate (BREAKING)**
> - Default CI behavior is strict gate mode; advisory requires explicit opt-in.

**Evidence:**
- `test/contracts/contract-ci-gate.test.js` enforces strict-by-default
- Test verifies that `--mode advisory` is required for advisory mode
- CI gate fails with exit code 2 on DO_NOT_LAUNCH verdict

**Breaking Change Assessment:** This was a **documented breaking change** that **justifies the 2.0.0 major version bump**.

---

### Version Bump Appropriateness

| Change | Version Bump | Appropriate? | Notes |
|--------|--------------|--------------|-------|
| Strict CI gate default | 1.x.x → **2.0.0** | ✅ **YES** | Breaking change for CI/CD users |
| Filesystem containment enforcement | 1.x.x → **2.0.0** | ✅ **YES** | Breaking for users writing artifacts outside `.guardian/` |
| Watchdog mode addition | 1.0.x → 1.1.0 | ✅ **YES** | New feature, non-breaking (opt-in) |
| Packaging hotfix (1.1.2) | 1.1.1 → 1.1.2 | ⚠️ **QUESTIONABLE** | Only in extension, not main package |

**Conclusion:** The **2.0.0 bump is justified** due to two documented breaking changes:
1. Strict-by-default CI gate
2. Filesystem containment enforcement

However, the version history leading up to 2.0.0 is chaotic and contains retrograde movements.

---

## 5. Current Contract State

### Contract Tests Status
**Test Suite:** `test/contracts/**/*.js`  
**Status:** ✅ **26 passing (as of 2026-01-02)**

### Contracts Enforced

| Contract | Protected Behavior | File | Status |
|----------|-------------------|------|--------|
| **Contract A** | CI gate defaults to strict mode | `contract-ci-gate.test.js` | ✅ ENFORCED |
| **Contract B** | Exit code truth table (0/1/2/3) | `contract-exit-codes.test.js` | ✅ ENFORCED |
| **Contract C** | Filesystem containment | `contract-filesystem.test.js` | ✅ ENFORCED |

### Behavioral Stability Assessment

#### ✅ **STABLE: Core Verdict Engine**
- Verdict logic is deterministic
- Exit codes are locked and tested
- No drift detected in behavioral tests

#### ✅ **STABLE: CLI Contract**
- Help/version commands exit with code 0
- Invalid syntax exits non-zero
- Required flags are validated

#### ✅ **STABLE: Artifact Generation**
- `decision.json` structure is consistent
- Artifacts written to `.guardian/` subdirectories
- Sanitization of sensitive data enforced (per 1.1.2 hotfix)

### Would This Qualify as "Contract-Stable"?
**Answer:** ✅ **YES**

**Justification:**
1. Core behaviors (verdicts, exit codes, filesystem) are **locked by passing contract tests**
2. Test suite passes reliably (26/26 tests)
3. No experimental features in critical path
4. Breaking changes from 2.0.0 are **documented and enforced**

**Remaining Risk:** **Version identity confusion** (dual tags v1.1.1 and v2.0.0 on same commit) creates potential for user/ecosystem confusion, but does not affect runtime behavior.

---

## 6. Identified Problems

### CRITICAL Issues

#### CRIT-1: Dual Git Tags on Same Commit
**Problem:** Commit `84a9e1b` is tagged as **both** `v1.1.1` and `v2.0.0`.  
**Impact:** Ambiguity about which version is canonical. npm may publish under one tag, but git history shows both.  
**Evidence:**
```bash
git tag --list
v1.1.1
v2.0.0

git log --oneline --decorate | grep 84a9e1b
84a9e1b (HEAD -> main, tag: v2.0.0, tag: v1.1.1, origin/main) release: v1.1.1 — reality freeze
```

#### CRIT-2: Duplicate CHANGELOG Entries
**Problem:** Version `1.1.1` appears **twice** in CHANGELOG.md (lines 33 and 74), and `1.0.0` appears **twice** (lines 103 and 140).  
**Impact:** Confusion about which entry is authoritative. Possible copy-paste errors during rapid iteration.

#### CRIT-3: Version Regression in History
**Problem:** Version went from `1.1.0` → `1.0.1` → `1.1.1` (retrograde movement).  
**Impact:** Indicates indecision or mistake during release process. Breaks semantic versioning expectations.

#### CRIT-4: Missing Version Alignment
**Problem:** Extension version (`1.1.2`) does not match main package version (`2.0.0`).  
**Impact:** User confusion about which version they're using. Ecosystem misalignment.

### HIGH Issues

#### HIGH-1: Version 1.1.2 in CHANGELOG but No Git Tag
**Problem:** CHANGELOG lists `[1.1.2]` as a release, but no `v1.1.2` git tag exists.  
**Impact:** Cannot verify or reproduce the 1.1.2 release from git history alone.

#### HIGH-2: Inconsistent CHANGELOG Formatting
**Problem:** Some entries are comprehensive, others are minimal. No consistent structure for breaking changes.  
**Impact:** Difficult to assess release impact at a glance.

#### HIGH-3: Sample Artifacts Reference Old Version
**Problem:** Artifacts in `website/public/sample-artifacts/` reference version `1.0.0`.  
**Impact:** Documentation/demo artifacts do not reflect current version.

### MEDIUM Issues

#### MED-1: Extension Version Lags Behind
**Problem:** Extension is at `1.1.2`, main package at `2.0.0`.  
**Impact:** Users may expect version parity. Extension may not reflect breaking changes in 2.0.0.

#### MED-2: No Unified Release Notes
**Problem:** CHANGELOG has entries, but no consolidated release notes document for 2.0.0.  
**Impact:** Users lack a single authoritative source for "what changed in 2.0.0".

---

## 7. Risks of Current State

### Risk 1: Version Identity Crisis
**Severity:** 🔴 HIGH  
**Description:** Dual tags (v1.1.1 and v2.0.0) on same commit create ambiguity. If someone runs `git checkout v1.1.1`, they get the same code as `v2.0.0`, but the commit message says "v1.1.1". This is a **truth violation**.

**Impact:**
- npm publish confusion (which version is "real"?)
- User reports may reference wrong version
- Rollback operations become ambiguous

### Risk 2: CHANGELOG Cannot Be Trusted
**Severity:** 🟠 MEDIUM  
**Description:** Duplicate entries, out-of-order versions, and missing git tags mean the CHANGELOG does not provide a reliable version history.

**Impact:**
- Developers cannot rely on CHANGELOG to understand "what changed when"
- Automated tooling (e.g., changelog generators) may fail

### Risk 3: Extension-Package Version Divergence
**Severity:** 🟡 LOW-MEDIUM  
**Description:** Extension at 1.1.2, package at 2.0.0. If extension relies on package behavior, breaking changes in 2.0.0 may not be reflected.

**Impact:**
- Extension may break if user updates package
- User confusion about "which version" they're running

### Risk 4: No Clear Migration Path for Breaking Changes
**Severity:** 🟠 MEDIUM  
**Description:** 2.0.0 introduces breaking changes (strict CI gate, filesystem containment), but no migration guide exists in CHANGELOG.

**Impact:**
- Users upgrading from 1.x may experience unexpected failures
- CI/CD pipelines may break silently

---

## 8. Recommendations

### Recommendation 1: Normalize to 2.0.0 as Canonical Release
**Action:** Accept `2.0.0` as the **canonical stable release** and remove ambiguity.

**Steps:**
1. **Remove duplicate git tag `v1.1.1`** (or document why both exist)
   ```bash
   git tag -d v1.1.1
   git push origin :refs/tags/v1.1.1
   ```
2. **Update all references** to treat `2.0.0` as the current stable version
3. **Update CHANGELOG** to clarify that v1.1.1 was a transitional tag and v2.0.0 is the true release

**Justification:** The 2.0.0 version bump is justified by breaking changes. Dual tags create ambiguity that undermines trust.

### Recommendation 2: Clean CHANGELOG
**Action:** Remove duplicate entries, fix ordering, and consolidate version history.

**Steps:**
1. **Remove duplicate 1.1.1 entry** (keep only one)
2. **Remove duplicate 1.0.0 entry** (keep only one)
3. **Reorder entries** if needed (most recent first)
4. **Add section headers** for breaking changes in 2.0.0
5. **Add migration guide** for users upgrading from 1.x

### Recommendation 3: Align Extension Version
**Action:** Decide whether extension should track main package version or maintain independent versioning.

**Options:**
- **Option A:** Bump extension to `2.0.0` for alignment
- **Option B:** Document that extension version is independent and explain the relationship

**Recommended:** Option A (version parity) for ecosystem clarity.

### Recommendation 4: Create Release Notes Document
**Action:** Create a formal release notes document for 2.0.0.

**File:** `RELEASE_NOTES_2.0.0.md` or similar

**Contents:**
- Overview of 2.0.0 changes
- Breaking changes and migration guide
- New features (if any)
- Bug fixes
- Credits and acknowledgments

### Recommendation 5: Tag Strategy Going Forward
**Action:** Adopt a clear tagging strategy to prevent future dual-tag issues.

**Policy:**
- One commit = one version tag
- Tag message should match commit message
- Use annotated tags with release notes: `git tag -a vX.Y.Z -m "Release notes"`

### Recommendation 6: Version Bump Discipline
**Action:** Establish a process to prevent version regressions and confusion.

**Process:**
1. Version bumps occur in dedicated commits
2. CHANGELOG is updated **before** version bump commit
3. Git tag is created **immediately after** version bump
4. No retrograde version movements (1.1.0 → 1.0.1 should never happen)

---

## 9. Recommended Next Unified Version

### Analysis
- **Current version:** 2.0.0 (package.json)
- **Git tags:** v1.1.1 and v2.0.0 (both on same commit)
- **Breaking changes:** Yes (strict CI gate, filesystem containment)
- **Contract stability:** Yes (all tests passing)

### Recommendation: **Keep 2.0.0**
**Justification:**
1. Breaking changes justify major version bump
2. Contract tests enforce behavioral stability
3. `2.0.0` is already declared in package.json and README
4. Code is production-ready

### Action: **Reset and Normalize**
**NOT** a version bump, but a **version clarification**:

1. **Remove `v1.1.1` tag** (artifact of version confusion)
2. **Keep `v2.0.0` tag** as canonical
3. **Update CHANGELOG** to clarify version history
4. **Update extension** to 2.0.0 for alignment
5. **Publish to npm** as `@odavl/guardian@2.0.0` with confidence

### Future Version Path
After 2.0.0 stabilization:
- **2.0.1** — Patch for bugs (no breaking changes)
- **2.1.0** — Minor features (non-breaking)
- **3.0.0** — Next major version (if breaking changes needed)

---

## 10. Conclusion

### Summary of Findings
- **Version Confusion:** Dual tags, duplicate CHANGELOG entries, version regressions
- **Contract Stability:** ✅ Core behaviors are stable and protected by tests
- **Breaking Changes:** 2.0.0 breaking changes are **justified and appropriate**
- **Recommendation:** Normalize to **2.0.0 as the canonical stable release**

### Final Assessment
The codebase is **contract-stable and production-ready**. The version history is **messy but resolvable**. With minor cleanup (remove dual tag, fix CHANGELOG), the repository can confidently declare **2.0.0 as the unified, stable, final release**.

### Risk Level
- **Technical Risk:** 🟢 **LOW** (code is stable)
- **Process Risk:** 🟠 **MEDIUM** (version history needs cleanup)
- **User Impact Risk:** 🟡 **LOW-MEDIUM** (mainly confusion, not breakage)

---

**End of Audit Report**

**Next Steps:**
1. Review this report
2. Execute normalization recommendations
3. Publish 2.0.0 with confidence
4. Establish version discipline for future releases

---

**Auditor Notes:**  
This audit is **READ-ONLY**. No changes were made to code, versions, or files. All findings are based on observation of current repository state as of 2026-01-02.
