# Trust & Governance Files Audit

**Date:** 2026-01-02  
**Task:** Read-only discovery and assessment of documentation/governance files  
**Status:** COMPLETE

---

## Executive Summary

**Finding:** All 5 files listed in `package.json` files array are **MISSING** from the repository root.

However, **partial or alternative documentation exists** in various locations:
- Contract documentation: Web-based (website/app/docs/contract/) + test documentation (test/contracts/README.md)
- Support information: Available in README.md (GitHub issue templates)
- Versioning policy: Stated in CHANGELOG.md ("follows semantic versioning")
- Security/Maintainers: No documentation found anywhere

---

## Detailed Findings

### File 1: SECURITY.md

**Status:** 🔴 **MISSING**

**Search Results:**
- ✗ No SECURITY.md file at repository root
- ✗ No security.md variants found anywhere
- ✗ No security policy documentation found

**References Found:**
- ✓ Listed in `package.json` files array (line 39)
- ✓ Mentioned in internal audit: `internal/audits/03-security-supplychain.md` recommends creating it
- ✓ Mentioned in internal audit: `internal/audits/05-defect-ledger.md` suggests documenting PII risks

**Current State:**
- No vulnerability disclosure policy documented
- No security contact information available
- No guidance for reporting security issues
- GitHub Security Advisories may not display properly without this file

**Content to Address (from audit findings):**
- Vulnerability disclosure process
- Security contact email
- Screenshot PII handling policy
- Supply chain security practices
- Supported versions

**Recommendation:** ⭐ **CREATE (HIGH PRIORITY)**
- GitHub expects this file for security advisories
- Reduces friction for security researchers
- Professional standard for production tools

---

### File 2: SUPPORT.md

**Status:** 🟡 **PARTIAL (information scattered)**

**Search Results:**
- ✗ No SUPPORT.md file at repository root
- ✗ No support.md variants found anywhere

**References Found:**
- ✓ Listed in `package.json` files array (line 40)
- ✓ Support information **does exist** in README.md (lines 229-231, 266-268)

**Current Support Information (in README.md):**
```markdown
**Report issues or improvements:**
- [Bug or clarity issue?](https://github.com/odavlstudio/odavlguardian/issues/new?template=clarity.yml)
- [Adoption blockers?](https://github.com/odavlstudio/odavlguardian/issues/new?template=adoption.yml)
```

**What's Missing:**
- No centralized support document
- No community guidelines (Discord, forum, etc.)
- No response time expectations
- No paid support information (if applicable)
- No FAQ or troubleshooting links
- No distinction between community vs. commercial support

**Accuracy for v2.0.0:** ✅ Links work, issue templates exist

**Recommendation:** 🟠 **CREATE (MEDIUM PRIORITY)**
- Consolidate support information into dedicated file
- Clarify support channels and expectations
- Link from README to SUPPORT.md
- Reduces redundancy and improves discoverability

---

### File 3: MAINTAINERS.md

**Status:** 🔴 **MISSING**

**Search Results:**
- ✗ No MAINTAINERS.md file at repository root
- ✗ No maintainers.md or maintainer*.md variants found anywhere

**References Found:**
- ✓ Listed in `package.json` files array (line 41)
- ✓ Mentioned in internal audit: `internal/audits/README.md` lists "Missing CONTRIBUTING.md" but not MAINTAINERS

**Current State:**
- No maintainer list documented
- No governance structure defined
- No contribution review process specified
- No contact information for maintainers

**What Should Be Included:**
- List of active maintainers
- Contact methods (GitHub handles, email)
- Areas of responsibility
- Decision-making process
- How to become a maintainer
- Code of conduct (or link to it)

**Recommendation:** 🟢 **CREATE (OPTIONAL)**
- Low priority for single-maintainer projects
- More important if accepting community contributions
- Can be combined with CONTRIBUTING.md if project grows

---

### File 4: VERSIONING.md

**Status:** 🟡 **PARTIAL (policy stated, not documented)**

**Search Results:**
- ✗ No VERSIONING.md file at repository root
- ✗ No versioning.md or version-policy.md variants found anywhere

**References Found:**
- ✓ Listed in `package.json` files array (line 42)
- ✓ Mentioned in internal release documentation: `internal/release-version-truth.md` (line 796) suggests creating it
- ✓ Policy stated in CHANGELOG.md: "This project follows **semantic versioning**"

**Current Policy (CHANGELOG.md, lines 3-9):**
```markdown
This project follows **semantic versioning**, with a strong emphasis on:

- reality-based behavior
- honest outcomes
- evidence over assumptions
```

**What's Missing:**
- No detailed explanation of version number scheme
- No breaking change policy
- No deprecation timeline
- No LTS or support policy
- No explanation of what triggers major/minor/patch bumps
- No contract/API stability guarantees beyond test/contracts/README.md

**Existing Contract Documentation:**
- ✅ Behavioral contracts documented: `test/contracts/README.md` (183 lines)
- ✅ Web documentation: `website/app/docs/contract/page.tsx` (Guardian Contract v1)
- ✅ Export contract: `src/guardian/export-contract.js` with version tracking

**Recommendation:** 🟠 **CREATE (MEDIUM PRIORITY)**
- Consolidate versioning policy into dedicated file
- Link to contract documentation for API stability
- Clarify what constitutes a breaking change
- Document support window for major versions
- Reference from CHANGELOG.md

---

### File 5: guardian-contract-v1.md

**Status:** 🟡 **EXISTS ELSEWHERE (not as markdown file)**

**Search Results:**
- ✗ No guardian-contract-v1.md file at repository root
- ✗ No guardian-contract*.md files found anywhere

**References Found:**
- ✓ Listed in `package.json` files array (line 35)
- ✓ Referenced in website routing: `website/lib/docs.ts` (lines 5, 34)
- ✓ Web implementation exists: `website/app/docs/contract/page.tsx` (188 lines)
- ✓ Test contracts documented: `test/contracts/README.md` (183 lines)

**Current Documentation (Alternative Formats):**

1. **Web Version (Primary):** `website/app/docs/contract/page.tsx`
   - Contract v1 specification (TypeScript/React)
   - Covers: Overview, Verdicts, Confidence Model, Evidence, Presets
   - Accessible at: `/docs/contract` on deployed website
   - Status: ✅ Complete and accurate for v2.0.0

2. **Test Contracts (Technical):** `test/contracts/README.md`
   - Behavioral contracts for CI/CD guarantees
   - Covers: CI gate defaults, exit codes, filesystem containment, observability
   - Executable contract tests (not just documentation)
   - Status: ✅ Complete, referenced in npm dry-run report

**Content Coverage:**
- ✅ Guardian specification and guarantees
- ✅ Verdict definitions (READY/FRICTION/DO_NOT_LAUNCH)
- ✅ Confidence model explained
- ✅ Exit code mapping (canonical)
- ✅ Artifact specifications
- ✅ Behavioral contracts (executable)

**What's Missing:**
- ❌ Markdown version for npm package inclusion
- ❌ Offline-readable documentation format
- ❌ Direct link from README to contract

**Accuracy for v2.0.0:** ✅ Web version and test contracts are accurate

**Recommendation:** 🟠 **CREATE MARKDOWN VERSION (MEDIUM PRIORITY)**
- Export website contract page to markdown
- Ensures contract is available offline in npm package
- Allows CLI to reference local contract file
- Maintains single source of truth (generate from web version)

**Alternative:** Remove from package.json and rely on web documentation

---

## Package.json Files Array Analysis

**Current Configuration:**
```json
"files": [
  "bin/",              // ✅ EXISTS (1 file)
  "src/",              // ✅ EXISTS (165 files)
  "flows/",            // ✅ EXISTS (2 files)
  "policies/",         // ✅ EXISTS (4 files)
  "config/",           // ✅ EXISTS (8 files)
  "guardian-contract-v1.md",  // ❌ MISSING
  "README.md",         // ✅ EXISTS
  "LICENSE",           // ✅ EXISTS
  "CHANGELOG.md",      // ✅ EXISTS
  "SECURITY.md",       // ❌ MISSING
  "SUPPORT.md",        // ❌ MISSING
  "MAINTAINERS.md",    // ❌ MISSING
  "VERSIONING.md"      // ❌ MISSING
]
```

**File Existence:**
- ✅ Present: 9/13 entries (directories + 4 core files)
- ❌ Missing: 5/13 entries (all governance/documentation files)

**npm pack Behavior:**
- npm will **silently skip** missing files
- Package will be created successfully (confirmed in dry-run)
- No errors or warnings during publish
- Reduces package professionalism but doesn't break functionality

---

## Summary Table

| File | Status | Location | Accurate for v2.0.0 | In package.json | Recommendation |
|------|--------|----------|---------------------|----------------|----------------|
| **SECURITY.md** | 🔴 MISSING | None | N/A | ✅ Yes | ⭐ CREATE (HIGH) |
| **SUPPORT.md** | 🟡 PARTIAL | README.md | ✅ Yes | ✅ Yes | 🟠 CREATE (MEDIUM) |
| **MAINTAINERS.md** | 🔴 MISSING | None | N/A | ✅ Yes | 🟢 CREATE (OPTIONAL) |
| **VERSIONING.md** | 🟡 PARTIAL | CHANGELOG.md | ✅ Yes | ✅ Yes | 🟠 CREATE (MEDIUM) |
| **guardian-contract-v1.md** | 🟡 EXISTS ELSEWHERE | website/, test/ | ✅ Yes | ✅ Yes | 🟠 EXPORT TO MD (MEDIUM) |

---

## Recommendations by Priority

### 🔴 HIGH PRIORITY (Blocking Professional Polish)

**1. Create SECURITY.md**
- **Why:** GitHub expects this for security advisories
- **Impact:** Security researchers need clear vulnerability disclosure process
- **Effort:** 15-30 minutes
- **Template:** Use GitHub's standard security policy template
- **Content:**
  - Supported versions
  - Security contact: security@odavl.com (or GitHub private reporting)
  - Vulnerability disclosure process
  - Response time expectations
  - PII handling in screenshots (per internal audits)

---

### 🟠 MEDIUM PRIORITY (Polish & Clarity)

**2. Create SUPPORT.md**
- **Why:** Centralize support information (currently scattered in README)
- **Impact:** Better user experience, reduces confusion
- **Effort:** 10-15 minutes
- **Content:**
  - GitHub issue templates (bug, feature, adoption blocker)
  - Community channels (if any)
  - Documentation links
  - Response expectations
  - Commercial support (if applicable)

**3. Create VERSIONING.md**
- **Why:** Clarify semantic versioning policy beyond "we follow semver"
- **Impact:** Sets expectations for API stability and breaking changes
- **Effort:** 20-30 minutes
- **Content:**
  - Semantic versioning explained
  - What triggers major/minor/patch bumps
  - Breaking change policy
  - Deprecation timeline
  - LTS support policy (if any)
  - Link to test/contracts/README.md for behavioral contracts

**4. Export guardian-contract-v1.md**
- **Why:** Make contract available offline in npm package
- **Impact:** Users can read contract without internet access
- **Effort:** 30-45 minutes (conversion + review)
- **Content:**
  - Export website/app/docs/contract/page.tsx to markdown
  - Maintain single source of truth (automate conversion if possible)
  - Include references to test/contracts/ for technical details

---

### 🟢 LOW PRIORITY (Nice to Have)

**5. Create MAINTAINERS.md**
- **Why:** Document project governance
- **Impact:** More important for multi-maintainer projects
- **Effort:** 10-15 minutes
- **Content:**
  - Maintainer list
  - Contact methods
  - Decision-making process
  - How to become a maintainer
  - Link to CODE_OF_CONDUCT.md (if created)
- **Note:** Can be deferred if project has single maintainer

---

## Alternative: Remove from package.json

If creating these files is not feasible before publish, you can:

**Option A: Remove from files array**
```json
"files": [
  "bin/",
  "src/",
  "flows/",
  "policies/",
  "config/",
  "README.md",
  "LICENSE",
  "CHANGELOG.md"
]
```

**Option B: Keep references, create placeholder files**
Create minimal files that redirect to online documentation:
```markdown
# SECURITY.md
See security policy: https://github.com/odavlstudio/odavlguardian/security/policy

# SUPPORT.md
See support information: https://github.com/odavlstudio/odavlguardian#support

# guardian-contract-v1.md
See contract documentation: https://odavl.com/docs/contract
```

**Recommendation:** **Option B (placeholder files)** is better than Option A because:
- Maintains npm package.json integrity
- Directs users to correct resources
- Can be replaced with full files later without breaking changes
- Takes only 5 minutes to create

---

## Impact Assessment

### Current Impact (Missing Files)

**Functional:** ✅ No impact
- Package installs correctly
- CLI works properly
- All features function as expected

**Professional Polish:** ⚠️ Moderate impact
- Missing SECURITY.md may deter security researchers
- Missing SUPPORT.md increases friction for users seeking help
- Missing contract .md reduces offline documentation quality
- Missing versioning policy creates uncertainty about stability

**Community Adoption:** ⚠️ Minor to moderate impact
- Open-source projects expect these files
- Absence signals less mature project governance
- May reduce confidence in production readiness

### Post-Creation Impact

**With all files created:**
- ✅ Professional, production-grade presentation
- ✅ Clear governance and support channels
- ✅ Security-first appearance
- ✅ Reduced friction for contributors and users
- ✅ Better SEO and discoverability (GitHub indexes these files)

---

## Conclusion

**Assessment:** All 5 files are missing from repository root, but **partial documentation exists** in scattered locations.

**Recommendation:**
1. **Before v2.0.0 publish:** Create SECURITY.md (HIGH priority) + placeholder files for others
2. **Post-publish:** Gradually create full versions of SUPPORT.md, VERSIONING.md, guardian-contract-v1.md
3. **Optional:** Create MAINTAINERS.md when project governance expands

**Estimated Total Effort:**
- High priority (SECURITY.md): 30 minutes
- Placeholder files: 5 minutes
- Full medium priority files: 90 minutes
- Total: ~2 hours for complete governance documentation

**Publish Readiness:** Package is **functionally ready** but **professionally incomplete**. Creating at least SECURITY.md is recommended before official v2.0.0 publication.

---

**Audit Completed:** 2026-01-02  
**Files Assessed:** 5/5  
**Repository Scan:** Complete  
**Status:** READ-ONLY (no modifications made)
