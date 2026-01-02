# Release Version Truth — Authoritative Version Discovery

**Date:** 2026-01-02  
**Purpose:** Establish complete and accurate understanding of versioning, release history, and version authority across odavlguardian  
**Method:** READ-ONLY discovery, observation, and analysis  
**Scope:** All version declarations, git tags, CHANGELOG entries, documentation references, and workspace state

---

## Executive Summary

### Current State of Version Truth

**Committed State (git HEAD):**
- Main package: **1.1.1** (committed)
- Extension: **1.1.1** (committed)
- Git tags: **v1.1.1** and **v2.0.0** both point to commit `84a9e1b`

**Uncommitted Workspace State:**
- Main package: **2.0.0** (uncommitted changes)
- Extension: **1.1.2** (uncommitted changes)
- CHANGELOG.md: Contains 2.0.0 entry (uncommitted)

**Critical Finding:** The repository is in a **transition state**. The declared version 2.0.0 exists only in the working directory (not committed or tagged to the correct state). Both git tags (v1.1.1 and v2.0.0) point to the same commit where package.json declares version 1.1.1.

### Version Authority Hierarchy

**PRIMARY AUTHORITY (npm publish-time):**
1. `package.json` → **version: "2.0.0"** (uncommitted)
2. Git tag → **v2.0.0** (annotated tag on commit 84a9e1b, which has version 1.1.1)

**SECONDARY (informational):**
3. `README.md` line 7 → "Version: 2.0.0" (uncommitted)
4. `CHANGELOG.md` → Contains 2.0.0 entry (uncommitted)
5. `extension/package.json` → "1.1.2" (uncommitted)

**Status:** **VERSION MISMATCH BETWEEN GIT TAGS AND PACKAGE.JSON**

---

## Section A: Version Inventory

### A.1 All Version Declarations (Authoritative)

| Location | Committed Version | Working Directory Version | Authority | Status |
|----------|------------------|---------------------------|-----------|--------|
| `/package.json` | **1.1.1** | **2.0.0** | PRIMARY | ⚠️ UNCOMMITTED |
| `/extension/package.json` | **1.1.1** | **1.1.2** | SECONDARY | ⚠️ UNCOMMITTED |
| `/website/package.json` | **0.1.0** | **0.1.0** | SECONDARY | ✅ COMMITTED |
| `/README.md` line 7 | "Version: 2.0.0" | "Version: 2.0.0" | INFORMATIONAL | ⚠️ UNCOMMITTED |

### A.2 Version References in Documentation

| File | Version Referenced | Context | Status |
|------|-------------------|---------|--------|
| `README.md` | 2.0.0 (line 7, 191) | "Version: 2.0.0", "Current Version: 2.0.0" | Uncommitted |
| `CHANGELOG.md` | 2.0.0, 1.1.2, 1.1.1 (x2), 1.0.1, 1.0.0 (x2), 0.3.0 | Full release history | Uncommitted changes |
| `test/contracts/README.md` | 1.1.2+contracts | Contract version reference | Committed |
| `internal/release-audit.md` | Multiple (2.0.0, 1.1.2, 1.1.1, 1.0.1) | Previous audit findings | Untracked file |
| `.github/ISSUE_TEMPLATE/clarity.yml` | 1.0.0 | Issue template default | Committed |
| `.github/ISSUE_TEMPLATE/adoption.yml` | 1.0.0 | Issue template default | Committed |

### A.3 Version References in Code

| File | Version String | Context | Type |
|------|---------------|---------|------|
| `bin/guardian.js` | `18.0.0` | Required Node.js version | Runtime requirement |
| `src/guardian/attempt-reporter.js` | `version: '1.0.0'` | Attempt report schema version | Internal format |
| `src/guardian/market-reporter.js` | `version: '1.0.0'` | Market report schema version | Internal format |
| `src/recipes/recipe-store.js` | `version: '1.0.0'` (multiple) | Recipe schema version | Internal format |
| `website/public/sample-artifacts/*.json` | `version: "1.0.0"` | Sample artifact metadata | Demo data |
| `website/public/sample-artifacts/snapshot.json` | `toolVersion: "0.2.0-phase2"` | Historical snapshot | Demo data |

### A.4 Git Workflow References

| File | Version Pattern | Context | Status |
|------|----------------|---------|--------|
| `.github/workflows/publish-npm.yml` | Manual input `(e.g., 0.2.1)` | Publish workflow placeholder | Committed |
| `.github/workflows/public-proof.yml` | `v0.3.0-beta` (2 refs) | Historical install command | Committed |
| `.github/workflows/guardian-pr-gate.yml` | `v1.48.2` | Playwright cache version | Committed |

---

## Section B: Git & Tag Reality

### B.1 Git Tag Inventory

| Tag | Target Commit | Commit Message | Tag Type | Tag Date | package.json Version at Commit |
|-----|--------------|----------------|----------|----------|-------------------------------|
| `v1.1.1` | `84a9e1b` | "release: v1.1.1 — reality freeze & version alignment" | lightweight | 2026-01-01 | **1.1.1** |
| `v2.0.0` | `2a66bf7` → `84a9e1b` | "Release 2.0.0 - Final Seal Strict Gate" | **annotated** | 2026-01-01 | **1.1.1** |

**Critical Finding:** Both tags point to the **same commit** (`84a9e1b`), where `package.json` declares version **1.1.1**. The v2.0.0 tag is an **annotated tag** with its own commit object (`2a66bf7`), but it references the same code commit as v1.1.1.

**Git Tag Analysis:**
```
* 84a9e1b (HEAD, tag: v2.0.0, tag: v1.1.1, origin/main, main)
  | * 8a35169 (release/v1.1.1, origin/release/v1.0.1, release/v1.0.1)
  |/
  * 24fb740
```

### B.2 Version Progression Timeline (Committed History)

| Date | Commit | Action | Version in package.json | Git Tag |
|------|--------|--------|------------------------|---------|
| 2026-01-01 | `84a9e1b` | release: v1.1.1 — reality freeze | **1.1.1** | v1.1.1, v2.0.0 |
| 2026-01-01 | `8a35169` | chore: bump version to 1.1.1 (branch) | 1.1.1 | — |
| 2025-12-31 | `24fb740` | Release v1.0.1 | **1.0.1** | — |
| 2025-12-30 | `c6fc968` | chore: bump version to 1.1.0 | **1.1.0** | — |
| 2025-12-30 | `9f9260d` | chore: release v1.0.0 | **1.0.0** | — |
| 2025-12-24 | `f62686d` | chore(release): bump version to v0.2.0 | **0.2.0** | — |
| Earlier | `c92fcc6` | chore(release): prepare npm package v0.1.0-rc1 | **0.1.0-rc1** | — |

**Version Regression Detected:** Version went from **1.1.0** → **1.0.1** → **1.1.1** (retrograde movement between 2025-12-30 and 2025-12-31).

### B.3 Uncommitted Workspace State

**Working Directory Changes (not committed):**
- `package.json`: **1.1.1** → **2.0.0**
- `extension/package.json`: **1.1.1** → **1.1.2**
- `CHANGELOG.md`: Added 2.0.0 entry at top
- `README.md`: Updated version references to 2.0.0
- 116 modified files total
- 71 untracked files (new features, tests, audits)

**Git Status:** 
```
On branch main
Your branch is up to date with 'origin/main'
Changes not staged for commit
```

### B.4 Tag Consolidation Risk Assessment

**If v1.1.1 tag is removed:**
- npm packages published with v1.1.1 tag remain valid
- GitHub releases tagged v1.1.1 become orphaned
- Users who cloned at v1.1.1 continue to work without issue
- CI pipelines referencing v1.1.1 will fail

**If v2.0.0 tag is moved to a future commit:**
- Current v2.0.0 annotated tag would be deleted/replaced
- Tag history shows tag was once on commit 84a9e1b (immutable in git reflog)
- Safer approach than removing v1.1.1

**Recommendation:** Keep both tags on current commit, commit workspace changes as new commit, and move v2.0.0 tag to the new commit.

---

## Section C: CHANGELOG & History Consistency

### C.1 CHANGELOG Version Entries (Committed vs Working Directory)

**Committed CHANGELOG (HEAD at 84a9e1b):**
```
## [1.1.1] — Reality Freeze & Version Alignment Release (2025-12-31)
## v1.0.0 — First Stable Release (2025-12-30)
## [1.0.1] — Patch Release (2025-12-31)
## [v1.0.0] — Stable Release - Market Reality Testing Engine (2025-12-29)
## [v0.3.0] — Beta Release with Working Engine (2025-12-28)
```

**Uncommitted CHANGELOG (working directory):**
```
## [2.0.0] — Final Seal Strict Gate Release (2026-01-01) ← NEW
## [1.1.1] — Reality Freeze & Version Alignment Release (2025-12-31)
## [1.1.2] — Packaging Hotfix (2026-01-01) ← NEW
## [1.1.1] — Reality Freeze & Version Alignment Release (2025-12-31) ← DUPLICATE
## v1.0.0 — First Stable Release (2025-12-30)
## [1.0.1] — Patch Release (2025-12-31)
## [v1.0.0] — Stable Release - Market Reality Testing Engine (2025-12-29) ← DUPLICATE
## [v0.3.0] — Beta Release with Working Engine (2025-12-28)
```

### C.2 CHANGELOG Consistency Issues

#### Issue 1: Duplicate Entries (Uncommitted)
**1.1.1 appears twice:**
- Line ~33: "## [1.1.1] — Reality Freeze & Version Alignment Release"
- Line ~74: "## [1.1.1] — Reality Freeze & Version Alignment Release" (duplicate)

**1.0.0 appears twice:**
- Line ~103: "## v1.0.0 — First Stable Release"
- Line ~140: "## [v1.0.0] — Stable Release - Market Reality Testing Engine"

**Impact:** Confusing for users reading changelog, implies two separate releases with same version.

#### Issue 2: Out-of-Order Entries (Uncommitted)
**Chronological ordering violation:**
```
[2.0.0] — 2026-01-01 ← Correct position
[1.1.1] — 2025-12-31 ← Correct position
[1.1.2] — 2026-01-01 ← WRONG: should be between 2.0.0 and first 1.1.1
[1.1.1] — 2025-12-31 ← Duplicate
```

Version 1.1.2 (dated 2026-01-01) appears AFTER the first 1.1.1 entry (dated 2025-12-31), but BEFORE the duplicate 1.1.1 entry. This creates ambiguity about whether 1.1.2 came before or after 1.1.1.

**Semantic versioning expectation:** 1.1.2 should come AFTER 1.1.1, but the dates suggest they were both released on different days, with 1.1.2 potentially being a same-day hotfix to 1.1.1.

#### Issue 3: Missing Git Tag for 1.1.2
**Version 1.1.2 in CHANGELOG has no corresponding git tag.**

**Git tag inventory:**
```
v1.1.1 → commit 84a9e1b
v2.0.0 → commit 84a9e1b (annotated tag)
```

**Impact:** Users cannot check out v1.1.2, CI pipelines cannot reference it, and there's no git proof that 1.1.2 ever existed as a release.

#### Issue 4: Version Regression Not Explained
**CHANGELOG shows:**
- 1.1.0 is not documented in CHANGELOG as a standalone release
- 1.0.1 appears AFTER 1.0.0 entries (correct for patch)
- But git history shows: 1.1.0 (committed) → 1.0.1 (committed) → 1.1.1 (committed)

**CHANGELOG does not explain the 1.1.0 → 1.0.1 regression.**

### C.3 CHANGELOG vs Git History Alignment

| CHANGELOG Entry | Git Tag | Git Commit | package.json Version | Alignment Status |
|----------------|---------|------------|---------------------|------------------|
| [2.0.0] | v2.0.0 | 84a9e1b (tag only) | 1.1.1 | ⚠️ **MISMATCH** (tag exists, package.json doesn't match) |
| [1.1.2] | — | — | — | ⚠️ **MISSING TAG** |
| [1.1.1] (first) | v1.1.1 | 84a9e1b | 1.1.1 | ✅ **ALIGNED** |
| [1.1.1] (second) | v1.1.1 | 84a9e1b | 1.1.1 | ⚠️ **DUPLICATE** |
| [1.0.1] | — | 24fb740 | 1.0.1 | ⚠️ **NO TAG** |
| v1.0.0 | — | 9f9260d | 1.0.0 | ⚠️ **NO TAG** |
| [v1.0.0] (second) | — | — | — | ⚠️ **DUPLICATE** |
| [v0.3.0] | — | — | — | ⚠️ **NO TAG** (likely cleaned up) |

**Summary:** Only v1.1.1 has complete alignment (CHANGELOG + Git tag + package.json). All other versions have at least one missing element.

---

## Section D: Extension & Website Alignment

### D.1 Extension Version Analysis

**Extension package.json:**
- **Committed:** 1.1.1
- **Uncommitted:** 1.1.2
- **Publisher:** odavl
- **VS Code marketplace status:** Unknown (requires manual check)

**Extension vs Main Package Divergence:**

| State | Main Package | Extension | Delta | Concern |
|-------|-------------|-----------|-------|---------|
| Committed | 1.1.1 | 1.1.1 | ✅ 0 | Aligned |
| Uncommitted | 2.0.0 | 1.1.2 | ⚠️ 0.8 | **MAJOR divergence** |

**If uncommitted changes are committed as-is:**
- Main package: 2.0.0 (major bump)
- Extension: 1.1.2 (patch bump)
- Users will see @odavl/guardian@2.0.0 but odavl-guardian (extension)@1.1.2

**Breaking Change Impact Assessment:**

According to uncommitted CHANGELOG.md (2.0.0 entry):
> **Strict-by-default CI gate (BREAKING)**
> Default CI behavior is strict gate mode; advisory requires explicit opt-in.

**Question:** Does this breaking change affect the VS Code extension?
- If YES → Extension should bump to 2.0.0 for consistency
- If NO → Extension can remain at 1.1.2, but version divergence should be documented

**Extension CHANGELOG (uncommitted):**
```
## [1.1.2] — 2026-01-01
- Packaging and runtime resolution fixes
- Alignment with main package breaking changes
```

**Concern:** Extension CHANGELOG mentions "alignment with main package breaking changes" but only bumps to 1.1.2 (patch), not 2.0.0 (major).

### D.2 Website Version Analysis

**Website package.json:**
- **Version:** 0.1.0 (committed and unchanged)
- **Framework:** Next.js 14.1.0
- **Purpose:** Documentation and marketing site

**Website version independence:**
- Website version (0.1.0) is independent of main package version
- This is appropriate (website is a separate product)
- No version alignment expected or required

**Website sample artifacts:**
- Located in `website/public/sample-artifacts/`
- Reference various historical versions: 1.0.0, 0.2.0-phase2
- These are demo data and don't need to match current version

**Status:** ✅ Website versioning is correct and independent.

### D.3 Multi-Artifact Version Strategy

**Current approach:**
- Main package: Semantic versioning (currently 2.0.0 uncommitted)
- Extension: Semantic versioning (currently 1.1.2 uncommitted)
- Website: Independent versioning (0.1.0)

**Observed pattern:**
- Main package and extension historically stayed aligned (both were 1.1.1)
- Uncommitted changes introduce divergence (2.0.0 vs 1.1.2)

**Two possible strategies:**

**Strategy A: Version Parity (Aligned)**
- Main package and extension always share the same version
- Major version bumps apply to both
- Users see consistent version across npm and VS Code marketplace

**Strategy B: Independent Versioning (Divergent)**
- Extension version can differ from main package
- Extension only bumps major version if extension API breaks
- Requires documentation explaining the relationship

**Current state suggests:** Repository was following Strategy A (version parity) but uncommitted changes introduce Strategy B (divergence) without explicit policy documentation.

**Recommendation needed:** Decide and document which strategy to follow.

---

## Section E: Breaking Change Validation

### E.1 Documented Breaking Changes (CHANGELOG.md - Uncommitted)

**Version 2.0.0 breaking changes:**

1. **Strict-by-default CI gate (BREAKING)**
   - **Description:** "Default CI behavior is strict gate mode; advisory requires explicit opt-in."
   - **Impact:** Users who relied on advisory mode by default must now explicitly opt-in
   - **Justification:** Changes default behavior, requires user action to maintain previous behavior
   - **Verdict:** ✅ **Justifies major version bump**

2. **Filesystem containment enforced**
   - **Description:** "Path traversal and external artifact writes are blocked"
   - **Impact:** Code that previously wrote artifacts outside allowed directories will now fail
   - **Justification:** Security hardening that breaks previously allowed (but unsafe) behavior
   - **Verdict:** ✅ **Justifies major version bump**

### E.2 Contract Tests for Breaking Changes

**Contract test coverage (from previous audit):**
- ✅ Exit code contracts (0=READY, 1=FRICTION, 2=DO_NOT_LAUNCH)
- ✅ Verdict output structure
- ✅ Filesystem containment enforcement
- ✅ Help/version commands exit 0

**Contract test file:** `test/contracts/README.md` references "Guardian Version: 1.1.2+contracts"

**Analysis:** Contract tests exist and enforce behavior, but contract version reference (1.1.2+contracts) doesn't align with main package version (2.0.0 uncommitted).

### E.3 Breaking Change Scope Assessment

**Question:** Are the breaking changes sufficient to justify 2.0.0?

**Semantic versioning rule:**
> MAJOR version when you make incompatible API changes

**Assessment of each breaking change:**

#### Breaking Change 1: Strict-by-default CI gate
**Before:** CI gate runs in advisory mode by default (non-blocking)  
**After:** CI gate runs in strict mode by default (blocking on FRICTION/DO_NOT_LAUNCH)  
**User impact:**
- Existing CI pipelines that previously passed may now fail
- Users must update CI config to add `--mode=advisory` flag to restore previous behavior
- Code doesn't need to change, but CI scripts do

**Is this a breaking API change?**
- Yes: Default behavior changes
- Yes: Requires user action to maintain previous behavior
- No: Not a code-level API break

**Verdict:** ✅ This justifies a major version bump (behavioral breaking change)

#### Breaking Change 2: Filesystem containment
**Before:** Guardian could write artifacts anywhere on filesystem  
**After:** Guardian blocks writes outside allowed directories  
**User impact:**
- Custom scripts that directed Guardian to write outside project directory will fail
- Output directory arguments that pointed to external paths will be rejected
- Legitimate use cases may be broken (e.g., writing to shared artifact store)

**Is this a breaking API change?**
- Yes: Previously valid API usage now throws errors
- Yes: Code that relied on external writes must be updated
- Yes: No workaround without code changes

**Verdict:** ✅ This justifies a major version bump (security-driven breaking change)

### E.4 Conclusion: Is 2.0.0 Justified?

**Summary:**
- **2 documented breaking changes**
- **Both are actual breaking changes** (not just feature additions)
- **Contract tests exist** to prevent regression
- **Changes are security and correctness motivated** (not arbitrary)

**Verdict:** ✅ **YES, version 2.0.0 is fully justified** by the documented breaking changes.

**Caveat:** The version 2.0.0 declaration is currently **uncommitted**, and the git tag v2.0.0 points to a commit where package.json still says 1.1.1. This is a process issue, not a justification issue.

---

## Section F: Governance & Future Discipline

### F.1 Observed Versioning Problems

**Process gaps identified:**

1. **Dual tags on same commit** (v1.1.1 and v2.0.0 both on 84a9e1b)
   - Root cause: v2.0.0 was tagged before package.json was updated to 2.0.0
   - Effect: Git tag claims version 2.0.0, but code at that tag says 1.1.1

2. **Uncommitted version bumps** (package.json shows 2.0.0 but not committed)
   - Root cause: Version bumped in working directory but not committed
   - Effect: Published npm package would have version 2.0.0, but git history wouldn't show the bump

3. **CHANGELOG duplicates** (1.1.1 appears twice, 1.0.0 appears twice)
   - Root cause: Manual CHANGELOG editing without deduplication checks
   - Effect: Confusing release history

4. **Missing git tags** (1.1.2, 1.0.1, 1.0.0, 0.3.0 in CHANGELOG but no tags)
   - Root cause: Tags not created for all released versions
   - Effect: Cannot check out specific versions, CI can't reference them

5. **Version regression** (1.1.0 → 1.0.1 → 1.1.1)
   - Root cause: Unclear release process during rapid iteration
   - Effect: Semantic versioning violated

6. **Extension version drift** (2.0.0 vs 1.1.2 in uncommitted state)
   - Root cause: No documented policy on extension version alignment
   - Effect: User confusion about which version they're running

### F.2 Recommended Canonical Version Model

**Single source of truth:** `package.json` version field

**Version bump workflow (recommended):**

```
1. Decide version number (MAJOR.MINOR.PATCH) based on changes
2. Update package.json version field
3. Update extension/package.json (decision: aligned or independent)
4. Update CHANGELOG.md (add entry at top, avoid duplicates)
5. Update README.md version references
6. Commit all changes: "chore(release): bump version to X.Y.Z"
7. Create git tag: git tag -a vX.Y.Z -m "Release X.Y.Z: [summary]"
8. Push commit AND tag: git push && git push --tags
9. Publish to npm: npm publish (uses package.json version)
10. Publish extension to VS Code marketplace (uses extension/package.json version)
```

**Critical rule:** Never create a git tag before the version bump commit exists.

### F.3 Version Bump Criteria (Semantic Versioning)

**MAJOR version (X.0.0):**
- Breaking changes to public API
- Behavioral changes requiring user code updates
- Security hardening that breaks previous behavior
- Default behavior changes that affect existing users
- **Example:** Strict CI gate default, filesystem containment

**MINOR version (0.X.0):**
- New features that don't break existing code
- New optional flags or configuration
- Backward-compatible API additions
- **Example:** New preset, new command, new optional flag

**PATCH version (0.0.X):**
- Bug fixes that don't change API
- Documentation updates
- Performance improvements
- Dependency updates (security patches)
- **Example:** Fix sanitization bug, improve error messages

### F.4 Extension Version Alignment Policy (Needs Decision)

**Option A: Strict Parity (Recommended for Simplicity)**
- Extension version ALWAYS matches main package version
- When main package bumps to 2.0.0, extension also bumps to 2.0.0
- Even if extension has no breaking changes, it follows main package
- **Advantage:** Users see consistent version everywhere
- **Disadvantage:** Extension version bumps even when extension unchanged

**Option B: Independent Semantic Versioning**
- Extension version follows its own semantic versioning
- Extension only bumps major version if extension API breaks
- Main package can be 2.0.0 while extension is 1.1.2
- **Advantage:** Extension version accurately reflects extension changes
- **Disadvantage:** Requires documentation explaining relationship

**Option C: Hybrid (Major Version Parity, Independent Minor/Patch)**
- Major version always matches (both 2.x.x)
- Minor/patch can differ (2.0.0 vs 2.1.3)
- **Advantage:** Balance between consistency and independence
- **Disadvantage:** Most complex to explain

**Current state suggests:** Repository intended Option A (parity) but uncommitted changes introduce Option B (independence) without documentation.

**Recommended:** Choose Option A (strict parity) for clarity, or explicitly document Option B with a version mapping table.

### F.5 CHANGELOG Maintenance Discipline

**Rules to prevent duplicates and ordering issues:**

1. **One entry per version** (remove duplicates immediately)
2. **Chronological order** (newest at top: 2.0.0, 1.1.2, 1.1.1, 1.0.1, ...)
3. **Semantic version order** (if dates conflict, use semver: 1.1.2 comes after 1.1.1)
4. **Consistent heading format** (choose: `## [X.Y.Z]` or `## vX.Y.Z`, not both)
5. **Date in heading** (e.g., `## [2.0.0] - 2026-01-01`)
6. **No retroactive edits** (don't change old entries unless factually incorrect)
7. **Breaking changes clearly marked** (use `(BREAKING)` or **bold** in summary)

**Automated check (recommended):**
```bash
# Check for duplicate version headings
grep -E "^## \[?v?[0-9]+\.[0-9]+\.[0-9]+\]?" CHANGELOG.md | sort | uniq -d
```

### F.6 Git Tagging Discipline

**Rules to prevent dual tags and missing tags:**

1. **One tag per version** (no v1.1.1 and v2.0.0 on same commit)
2. **Tag after version bump commit** (never tag before package.json is updated)
3. **Annotated tags for releases** (use `git tag -a`, not lightweight tags)
4. **Tag message format** (e.g., `"Release X.Y.Z: [one-line summary]"`)
5. **Push tags explicitly** (`git push --tags` or `git push origin vX.Y.Z`)
6. **Never delete pushed tags** (if wrong, create new tag, don't rewrite history)
7. **Tag naming convention** (use `vX.Y.Z`, not `X.Y.Z` or `release-X.Y.Z`)

**Protection against dual tags:**
```bash
# Check if current commit already has a tag
git tag --points-at HEAD

# If tag exists, decide:
# - Create new commit with version bump, then tag that
# - OR reuse existing tag (if version truly hasn't changed)
```

### F.7 Version Freeze for Stability

**Concept:** Once a version is tagged and pushed, it is **immutable**.

**Rules:**
- Never change package.json version after tagging
- Never move a tag after pushing to remote
- Never delete a tag after publishing to npm
- If version is wrong, create a new version (don't fix the old one)

**Example:**
- If v2.0.0 tag was created with version 1.1.1 in package.json (current situation):
  - **Don't:** Move v2.0.0 tag to a new commit
  - **Do:** Accept v2.0.0 tag as "annotated tag pointing to 1.1.1 code"
  - **Do:** Create new commit with version 2.0.0 in package.json
  - **Do:** Either create v2.0.1 tag on new commit, or document that v2.0.0 tag is "tag-only release"

**Current situation resolution options:**

**Option 1: Accept tag-only v2.0.0**
- Leave v2.0.0 tag on commit 84a9e1b (where package.json=1.1.1)
- Commit current uncommitted changes as new commit (package.json=2.0.0)
- Create new tag v2.0.1 on new commit
- Document that v2.0.0 was "tag-only release, use v2.0.1 for code"

**Option 2: Treat v2.0.0 as future release**
- Leave v2.0.0 tag on commit 84a9e1b
- Commit current uncommitted changes as new commit (package.json=2.0.0)
- Move v2.0.0 tag to new commit (acceptable since npm hasn't published v2.0.0 yet)
- Document this was a "tag correction" in CHANGELOG

**Option 3: Abandon v2.0.0 tag, create v2.1.0**
- Delete v2.0.0 tag (if not yet pushed to npm registry)
- Commit current uncommitted changes
- Tag as v2.1.0 instead (skip 2.0.0 entirely)
- Document that 2.0.0 was skipped due to tagging error

**Recommendation:** Option 2 (move v2.0.0 tag) is cleanest if npm hasn't published v2.0.0 yet. If already published, use Option 1 (v2.0.1).

---

## Section G: Critical Decision Points

### G.1 Immediate Actions Required

**Before any release or commit:**

1. **Decide on extension version alignment policy**
   - [ ] Option A: Strict parity (extension → 2.0.0)
   - [ ] Option B: Independent (extension → 1.1.2)
   - [ ] Document decision in README or CONTRIBUTING.md

2. **Resolve uncommitted changes**
   - [ ] Commit current changes (package.json 2.0.0, extension 1.1.2, CHANGELOG updates)
   - [ ] OR discard changes and stay at 1.1.1

3. **Fix git tag situation**
   - [ ] Move v2.0.0 tag to new commit (if npm hasn't published yet)
   - [ ] OR create v2.0.1 tag (if v2.0.0 already published)
   - [ ] OR delete v2.0.0 tag and create v2.1.0 (if tagging error acknowledged)

4. **Clean up CHANGELOG**
   - [ ] Remove duplicate 1.1.1 entry
   - [ ] Remove duplicate 1.0.0 entry
   - [ ] Fix ordering (1.1.2 should be between 2.0.0 and first 1.1.1, or merged with 1.1.1 if same release)

5. **Create missing git tags (if versions were truly released)**
   - [ ] Tag v1.0.1 (commit 24fb740) if it was published to npm
   - [ ] Tag v1.0.0 (commit 9f9260d) if it was published to npm
   - [ ] Document that these are "retroactive tags for historical releases"

### G.2 Version Truth State Machine

**Current State: TRANSITION**
- Committed: 1.1.1 (with v1.1.1 and v2.0.0 tags)
- Uncommitted: 2.0.0 (package), 1.1.2 (extension)

**Desired End State (Option A - Recommended):**
- Committed: 2.0.0 (package), 2.0.0 (extension), CHANGELOG cleaned up
- Tagged: v2.0.0 (on new commit with package.json=2.0.0)
- Published: @odavl/guardian@2.0.0 (npm), odavl-guardian@2.0.0 (VS Code marketplace)

**Desired End State (Option B):**
- Committed: 2.0.0 (package), 1.1.2 (extension), CHANGELOG cleaned up
- Tagged: v2.0.0 (on new commit with package.json=2.0.0)
- Published: @odavl/guardian@2.0.0 (npm), odavl-guardian@1.1.2 (VS Code marketplace)
- Documented: "Extension version is independent, currently at 1.1.2"

**Transition path:**
```
1. Choose end state (Option A or B)
2. Update extension/package.json if choosing Option A (1.1.2 → 2.0.0)
3. Clean up CHANGELOG (remove duplicates, fix ordering)
4. Commit all changes: "chore(release): finalize version 2.0.0"
5. Check if npm has v2.0.0 already published:
   - If NO: Move v2.0.0 tag to new commit
   - If YES: Create v2.0.1 tag on new commit
6. Push commit and tags
7. Publish to npm and VS Code marketplace
8. Update documentation with version governance policy
```

---

## Section H: Authoritative Version Declarations

### H.1 What is "Version Truth" Right Now?

**For npm users (`npm install @odavl/guardian`):**
- Latest published version: Check `npm view @odavl/guardian version` (unknown from this analysis)
- Likely: 1.1.1 (since that's the committed version)

**For git users (`git clone` or `git checkout`):**
- `git checkout main`: package.json says 2.0.0 (uncommitted local changes)
- `git checkout v2.0.0`: package.json says 1.1.1 (tag points to commit 84a9e1b)
- `git checkout v1.1.1`: package.json says 1.1.1 (correct)

**For VS Code extension users:**
- Marketplace version: Unknown (requires manual check)
- Likely: 1.1.1 (if last published from commit 84a9e1b)

**For CI/CD users (GitHub Actions, GitLab CI, etc.):**
- If using `@odavl/guardian@latest`: Gets npm latest (likely 1.1.1)
- If using `@odavl/guardian@2.0.0`: May fail if not published to npm yet
- If using git tag `v2.0.0`: Gets code with version 1.1.1 (tag mismatch)

### H.2 Version Authority Decision Matrix

| Scenario | Authority Source | Current Value | Correct? |
|----------|-----------------|---------------|----------|
| npm publish | package.json (committed) | 1.1.1 | ⚠️ Working directory says 2.0.0 |
| git clone | package.json (HEAD) | 2.0.0 (uncommitted) | ⚠️ Not committed yet |
| git checkout v2.0.0 | package.json (at tag) | 1.1.1 | ❌ Tag name doesn't match code |
| VS Code publish | extension/package.json (committed) | 1.1.1 | ⚠️ Working directory says 1.1.2 |
| Documentation | README.md | 2.0.0 | ⚠️ Not committed yet |
| CHANGELOG | CHANGELOG.md | 2.0.0 (top entry) | ⚠️ Not committed yet |

**Conclusion:** No single authoritative version number is consistent across all sources right now. The repository is in a **transition state** between 1.1.1 (committed) and 2.0.0 (declared but uncommitted).

### H.3 Recommended Authority Hierarchy (Going Forward)

**Tier 1 (PRIMARY - determines npm version):**
1. **package.json `version` field** (committed to git)

**Tier 2 (MUST MATCH primary):**
2. **Git tag** (e.g., v2.0.0) - MUST point to commit where package.json has that version
3. **CHANGELOG.md** top entry - MUST match package.json version
4. **README.md** version statement - MUST match package.json version

**Tier 3 (MAY DIFFER, but document relationship):**
5. **extension/package.json `version` field** - MAY differ if independent versioning policy chosen
6. **website/package.json `version` field** - SHOULD differ (independent product)

**Tier 4 (Informational - no authority):**
7. Internal schema versions (attempt-reporter.js, market-reporter.js, etc.)
8. Sample artifact versions (demo data, can be historical)
9. CI workflow version references (can reference old versions)

**Enforcement mechanism:**
- Pre-commit hook: Check that README version matches package.json version
- Pre-tag hook: Check that tag name matches package.json version
- CI test: Fail if CHANGELOG top entry doesn't match package.json version

---

## Section I: Recommended Next Steps (Tactical)

### I.1 Short-Term (Next 48 Hours)

**Priority 1: Resolve uncommitted state**

```bash
# Check npm registry to see if 2.0.0 was already published
npm view @odavl/guardian versions

# If 2.0.0 NOT in npm:
git add package.json extension/package.json CHANGELOG.md README.md
git commit -m "chore(release): finalize version 2.0.0"
git tag -a -f v2.0.0 -m "Release 2.0.0: Final Seal Strict Gate"
git push
git push -f origin v2.0.0

# If 2.0.0 ALREADY in npm:
git add package.json extension/package.json CHANGELOG.md README.md
git commit -m "chore(release): finalize version 2.0.0"
git tag -a v2.0.1 -m "Release 2.0.1: Package alignment and CHANGELOG cleanup"
git push
git push origin v2.0.1
```

**Priority 2: Fix CHANGELOG duplicates**

Edit CHANGELOG.md:
- Remove second 1.1.1 entry (keep only the first)
- Remove second 1.0.0 entry (keep only the first)
- Verify ordering: 2.0.0 → 1.1.2 → 1.1.1 → 1.0.1 → 1.0.0 → 0.3.0

**Priority 3: Decide extension version policy**

Add to README.md or CONTRIBUTING.md:
```markdown
### Version Policy

**Main Package (@odavl/guardian):** Follows semantic versioning strictly.

**VS Code Extension (odavl-guardian):** [CHOOSE ONE]
- **Option A:** Maintains version parity with main package (always same version)
- **Option B:** Follows independent semantic versioning (may differ from main package)

Current versions:
- Main package: 2.0.0
- VS Code extension: [1.1.2 or 2.0.0 depending on choice]
```

### I.2 Medium-Term (Next 2 Weeks)

**1. Create missing git tags for historical releases**

```bash
# Tag v1.0.1 (if it was published to npm)
git tag -a v1.0.1 24fb740 -m "Release 1.0.1: Sync public version to code reality (retroactive tag)"

# Tag v1.0.0 (if it was published to npm)
git tag -a v1.0.0 9f9260d -m "Release 1.0.0: Stable production release (retroactive tag)"

git push --tags
```

**2. Add pre-commit hooks for version consistency**

Create `.husky/pre-commit` (if using Husky):
```bash
#!/bin/sh
# Check that README.md version matches package.json version
PKG_VERSION=$(node -p "require('./package.json').version")
README_VERSION=$(grep -oP '(?<=Version: )[0-9]+\.[0-9]+\.[0-9]+' README.md | head -1)

if [ "$PKG_VERSION" != "$README_VERSION" ]; then
  echo "ERROR: Version mismatch:"
  echo "  package.json: $PKG_VERSION"
  echo "  README.md: $README_VERSION"
  exit 1
fi
```

**3. Document versioning process**

Create `VERSIONING.md` (already listed in package.json files array):
```markdown
# Versioning Process

## Before Every Release

1. Decide version number (MAJOR.MINOR.PATCH)
2. Update package.json `version`
3. Update extension/package.json `version` (if version parity policy)
4. Update CHANGELOG.md (add entry at top)
5. Update README.md version references
6. Commit: `chore(release): bump version to X.Y.Z`
7. Tag: `git tag -a vX.Y.Z -m "Release X.Y.Z: [summary]"`
8. Push: `git push && git push --tags`
9. Publish to npm: `npm publish`
10. Publish extension to VS Code marketplace

## Version Bump Criteria

- MAJOR: Breaking changes (API incompatibility)
- MINOR: New features (backward compatible)
- PATCH: Bug fixes (no API changes)
```

### I.3 Long-Term (Next 1-3 Months)

**1. Automated version consistency CI check**

Add to `.github/workflows/version-check.yml`:
```yaml
name: Version Consistency Check

on: [push, pull_request]

jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Check version consistency
        run: |
          PKG_VERSION=$(node -p "require('./package.json').version")
          README_VERSION=$(grep -oP '(?<=Version: )[0-9]+\.[0-9]+\.[0-9]+' README.md | head -1)
          CHANGELOG_VERSION=$(grep -oP '(?<=## \[)[0-9]+\.[0-9]+\.[0-9]+(?=\])' CHANGELOG.md | head -1)
          
          if [ "$PKG_VERSION" != "$README_VERSION" ] || [ "$PKG_VERSION" != "$CHANGELOG_VERSION" ]; then
            echo "Version mismatch detected!"
            exit 1
          fi
```

**2. CHANGELOG duplicate detection**

Add to CI:
```bash
# Fail if duplicate version entries exist
grep -E "^## \[?v?[0-9]+\.[0-9]+\.[0-9]+\]?" CHANGELOG.md | sort | uniq -d | grep . && exit 1 || true
```

**3. Quarterly version audit**

Schedule quarterly review:
- Check for version drift
- Verify all published versions have git tags
- Confirm CHANGELOG matches npm registry
- Update version policy documentation if needed

---

## Section J: Final Observations

### J.1 What Works Well

**✅ Strengths observed:**

1. **Contract testing exists** - Exit codes and behavior are enforced by tests
2. **Breaking changes documented** - CHANGELOG clearly marks (BREAKING) changes
3. **Multiple artifacts tracked** - Main package, extension, and website are managed
4. **Semantic versioning intent** - Repository attempts to follow semver principles
5. **Git tags used** - Release tagging is practiced (even if imperfectly)
6. **CHANGELOG maintained** - Release history is documented (even with duplicates)

### J.2 What Needs Improvement

**⚠️ Process gaps:**

1. **Version bump workflow inconsistent** - Changes made in working directory but not committed before tagging
2. **Git tag timing wrong** - v2.0.0 tag created before package.json updated to 2.0.0
3. **CHANGELOG duplicates** - Manual editing without deduplication
4. **Missing tags** - Not all released versions have corresponding git tags
5. **Version regression occurred** - 1.1.0 → 1.0.1 suggests process confusion
6. **Extension version policy undocumented** - No clear rule on alignment vs independence

### J.3 Risk Assessment

**Current state risk level: 🟠 MEDIUM**

**Why not HIGH?**
- Code is stable and contract-tested
- Breaking changes are justified and documented
- Users can still npm install successfully (gets committed version)
- No data loss or corruption risk

**Why not LOW?**
- Version confusion can cause user frustration
- Git tag mismatch can break CI pipelines
- Uncommitted changes block clean release process
- CHANGELOG duplicates reduce trust in documentation

**Mitigation:** Follow tactical steps in Section I to resolve within 48 hours.

### J.4 Version Truth Confidence Assessment

**Can we confidently answer: "What version is odavlguardian?"**

**For committed code:** ✅ YES - version 1.1.1 (with caveat that v2.0.0 tag points here)  
**For working directory:** ⚠️ NO - version 2.0.0 but uncommitted  
**For npm registry:** ❓ UNKNOWN - need to check `npm view @odavl/guardian version`  
**For VS Code marketplace:** ❓ UNKNOWN - need to check marketplace API  
**For end users:** ❌ NO - conflicting signals (tag says 2.0.0, code says 1.1.1, workspace says 2.0.0)

**Overall confidence: 🟡 MEDIUM** - We can determine version with analysis, but it's not immediately clear.

---

## Appendices

### Appendix A: Complete Version Reference Table

| Location | Committed | Uncommitted | Type | Notes |
|----------|-----------|-------------|------|-------|
| package.json | 1.1.1 | 2.0.0 | PRIMARY | npm publish authority |
| extension/package.json | 1.1.1 | 1.1.2 | SECONDARY | VS Code marketplace authority |
| website/package.json | 0.1.0 | 0.1.0 | INDEPENDENT | No change needed |
| README.md line 7 | 2.0.0 | 2.0.0 | INFORMATIONAL | Matches uncommitted package.json |
| README.md line 191 | 2.0.0 | 2.0.0 | INFORMATIONAL | Duplicate reference |
| CHANGELOG.md | 1.1.1 (top) | 2.0.0 (top) | DOCUMENTATION | Contains duplicates |
| test/contracts/README.md | 1.1.2+contracts | 1.1.2+contracts | INFORMATIONAL | Contract version marker |
| Git tag v1.1.1 | 1.1.1 | N/A | TAG | Points to commit 84a9e1b |
| Git tag v2.0.0 | 1.1.1 (at tagged commit) | N/A | TAG | Annotated tag on same commit |
| action.yml | No version | No version | N/A | GitHub Action descriptor |
| bitbucket-pipelines.yml | No version | No version | N/A | CI config |

### Appendix B: Git Tag Technical Details

```bash
# v1.1.1 tag (lightweight)
$ git show v1.1.1
commit 84a9e1bd2d03061629d26615604f543b12dce052
Author: monawlo <contact@odavl.com>
Date:   Thu Jan 1 03:34:43 2026 +0100
    release: v1.1.1 — reality freeze & version alignment

# v2.0.0 tag (annotated)
$ git show v2.0.0
tag v2.0.0
Tagger: monawlo <contact@odavl.com>
Date:   Thu Jan 1 18:42:01 2026 +0100
Release 2.0.0 - Final Seal Strict Gate

commit 84a9e1bd2d03061629d26615604f543b12dce052
...same commit as v1.1.1...
```

**Key insight:** v2.0.0 is an annotated tag (has its own commit object 2a66bf7) but points to the same code commit (84a9e1b) as v1.1.1.

### Appendix C: Uncommitted Files Summary

**Version-related changes:**
- package.json (1.1.1 → 2.0.0)
- extension/package.json (1.1.1 → 1.1.2)
- README.md (version references updated)
- CHANGELOG.md (2.0.0 and 1.1.2 entries added)

**Other modified files:** 116 total (src/, test/, docs/, extension/, etc.)

**New untracked files:** 71 total (new features, tests, audits, docs)

**Git status:** `Changes not staged for commit` (nothing staged, nothing committed)

### Appendix D: Semantic Versioning Quick Reference

**Version format:** MAJOR.MINOR.PATCH

**MAJOR (X.0.0):**
- Incompatible API changes
- Breaking behavior changes
- Removal of deprecated features
- Example: Guardian 2.0.0 (strict CI gate default change)

**MINOR (0.X.0):**
- New features (backward compatible)
- New optional parameters
- Deprecations (without removal)
- Example: Guardian 1.1.0 (watchdog mode added)

**PATCH (0.0.X):**
- Bug fixes (no API changes)
- Documentation updates
- Performance improvements
- Example: Guardian 1.1.2 (sanitization bug fix)

**Pre-release:** X.Y.Z-alpha, X.Y.Z-beta, X.Y.Z-rc1
**Build metadata:** X.Y.Z+build.123

---

## Conclusion

### Summary of Version Truth

**Committed reality (git HEAD):**
- Package version: 1.1.1
- Extension version: 1.1.1
- Git tags: v1.1.1 and v2.0.0 (both on same commit)

**Uncommitted reality (working directory):**
- Package version: 2.0.0
- Extension version: 1.1.2
- CHANGELOG: 2.0.0 entry added
- README: Version references updated to 2.0.0

**Git tag mismatch:**
- v2.0.0 tag points to commit where package.json says 1.1.1
- This creates confusion: checking out v2.0.0 gives code with version 1.1.1

**Breaking changes:**
- 2.0.0 bump is JUSTIFIED (strict CI gate + filesystem containment)
- Changes are documented and contract-tested

**Process issues:**
- Uncommitted version bump (not yet in git history)
- Git tag created before version bump commit
- CHANGELOG duplicates (1.1.1 twice, 1.0.0 twice)
- Missing git tags for some versions (1.1.2, 1.0.1, 1.0.0)
- Version regression in history (1.1.0 → 1.0.1)
- Extension version policy undocumented

### Recommended Immediate Actions

1. ✅ **Commit uncommitted changes** (package.json 2.0.0, extension 1.1.2 or 2.0.0)
2. ✅ **Fix git tag** (move v2.0.0 to new commit, or create v2.0.1)
3. ✅ **Clean CHANGELOG** (remove duplicates, fix ordering)
4. ✅ **Decide extension policy** (version parity or independent)
5. ✅ **Document version process** (create VERSIONING.md)
6. ✅ **Create missing tags** (v1.0.1, v1.0.0 retroactive tags)

### Final Assessment

**Version truth confidence:** 🟡 **MEDIUM** (can be determined with analysis, but not immediately clear)

**Version justification:** ✅ **VALID** (2.0.0 is justified by breaking changes)

**Version process maturity:** 🟠 **DEVELOPING** (gaps exist but are fixable)

**Recommended status after fixes:** ✅ **CLEAR** (2.0.0 as canonical version, documented process)

**Urgency:** ⚠️ **HIGH** (resolve within 48 hours to avoid user confusion)

---

**End of Release Version Truth Report**

**This document is READ-ONLY discovery. No changes were made to code, versions, git tags, or files. All findings are based on observation of repository state as of 2026-01-02.**
