# Repository Structure Guide

This guide explains the organization of the odavlguardian repository and where to find specific types of documentation.

---

## Directory Organization

### Root Level

**Key Files:**
- `README.md` — **SOURCE OF TRUTH** — Product overview and core concepts
- `CHANGELOG.md` — Release history and version information
- `package.json` — Project metadata and dependencies

**Code Directories:**
- `src/` — Source code (application logic)
- `test/` — Test suite and test utilities
- `bin/` — CLI entry points
- `extension/` — VS Code extension code

**Configuration:**
- `config/` — Configuration files and templates
- `policies/` — Policy definitions for Guardian
- `flows/` — User flow definitions
- `data/` — Data files and profiles

**Other:**
- `scripts/` — Utility and automation scripts
- `examples/` — Example usage and demos
- `website/` — Documentation website code
- `docs/` — Product and integration documentation (user-facing)
- `internal/` — Internal tools and materials (developer-only)
- `archive/` — Historical and superseded documents

---

## Documentation Locations

### For End Users

**Start here:** `/README.md` (root)

**Then explore:** `/docs/README.md` (documentation index)

**User guides in `/docs/`:**
- `VERDICTS.md` — Understanding Guardian's verdicts (READY, FRICTION, DO_NOT_LAUNCH)
- `CI-CD-USAGE.md` — Integration with CI/CD pipelines
- `WATCHDOG.md` — Production monitoring and baseline comparison
- `NETWORK-SECURITY.md` — Security signals and network analysis
- `ARTIFACT_ORIENTATION.md` — Reading Guardian's output files
- `DECISION_CONFIDENCE.md` — Real-world examples of verdicts
- `REAL_USER_STORY.md` — User scenario walkthrough
- `README.technical.md` — Technical reference for advanced usage
- `quickstart/CI_GITHUB_ACTION.md` — GitHub Actions integration guide

### For Developers

**Design & Engineering:** `/internal/engineering/`
- `docs-design/` — Product design documents and philosophy
- `LEVEL_1_SUMMARY.js` — Level 1 validation script
- `verify-extension.js` — Extension verification tool

**Quality & Audits:** `/internal/audits/`
- `00-repo-snapshot.md` — Repository structure analysis
- `01-build-test-truth.md` — Build and test verification
- `02-static-risk-xray.md` — Static analysis and risk assessment
- `03-security-supplychain.md` — Supply chain security audit
- `04-product-truth.md` — Documentation vs. implementation consistency
- `05-defect-ledger.md` — Defect catalog and priorities
- `trust/` — Public proof artifacts
- `logs/` — Detailed audit logs

### For Archival

**Historical Materials:** `/archive/`
- `REORGANIZATION_COMPLETE.md` — Documentation reorganization record
- `REORGANIZATION_SUMMARY.md` — Process summary
- `COMPLETION_CHECKLIST.md` — Completion verification
- `EXECUTIVE_SUMMARY.md` — Executive overview
- `STATUS.md` — Final status report

---

## Key Principles

### ✅ README.md is the Single Source of Truth

- All documentation aligns with `/README.md`
- No contradictions between docs and README
- Product claims are verified in code

### ✅ User-Facing Documentation is Top-Level

- `/docs/` contains only user-facing guides
- Clear, professional, and easy to navigate
- No internal notes or design documents

### ✅ Internal Materials are Hidden

- `/internal/` contains only developer materials
- Completely separated from user documentation
- Not accessible to end users by default

### ✅ Audits are Verifiable

- `/internal/audits/` contains objective audit reports
- No marketing claims, only facts
- Evidence-based conclusions

### ✅ History is Preserved

- `/archive/` keeps historical documents
- Non-destructive: nothing is deleted
- Easy to understand what changed and why

---

## Navigation Quick Reference

| Need | Location |
|------|----------|
| **Product overview** | `/README.md` |
| **User documentation** | `/docs/README.md` |
| **Understanding verdicts** | `/docs/VERDICTS.md` |
| **CI/CD integration** | `/docs/CI-CD-USAGE.md` |
| **Production monitoring** | `/docs/WATCHDOG.md` |
| **Network security** | `/docs/NETWORK-SECURITY.md` |
| **Reading artifacts** | `/docs/ARTIFACT_ORIENTATION.md` |
| **Design decisions** | `/internal/engineering/docs-design/` |
| **Audit reports** | `/internal/audits/` |
| **Trust artifacts** | `/internal/audits/trust/` |
| **Archived materials** | `/archive/` |

---

## Files That Should NOT Be Here

The following types of files have been organized into proper locations:

- ❌ ~~Audit reports in root~~ → Now in `/internal/audits/`
- ❌ ~~Design philosophy in /docs~~ → Now in `/internal/engineering/docs-design/`
- ❌ ~~Trust artifacts in /trust~~ → Now in `/internal/audits/trust/`
- ❌ ~~Cleanup documentation in /docs~~ → Now in `/archive/`

---

## Maintenance Guidelines

### Adding New Documentation

1. **User-facing docs?** → Place in `/docs/`
2. **Design or internal?** → Place in `/internal/engineering/`
3. **Audit or verification?** → Place in `/internal/audits/`
4. **Historical only?** → Place in `/archive/`

### Updating Documentation

1. Check `/README.md` (source of truth)
2. Ensure all docs align with README
3. Test claims against code
4. No marketing language, only facts

### Removing Documentation

1. Don't delete; move to `/archive/`
2. Keep records for historical reference
3. Update relevant index files

---

## Repository Health

**Status:** ✅ Clean and organized

- ✅ Single source of truth (README.md)
- ✅ Clear audience separation
- ✅ No contradictions
- ✅ Professional structure
- ✅ Easy navigation

---

**Last Updated:** January 2, 2026  
**Maintained By:** Repository Architecture Team
