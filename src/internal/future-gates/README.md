# Future Enterprise Gates

This directory contains code for planned VERAX capabilities that are **not yet part of the core product** and are **not exposed via CLI**.

## Planned Modules

### Enterprise Gates (PLANNED, NOT IMPLEMENTED)

These modules represent research and planning for enterprise-grade features planned for a future VERAX release. **They are not integrated into the core `verax run` command and have no CLI interface.**

- **GA Readiness** (`/ga/`) — Concept for validating release readiness
- **Security Scanning** (`/security/`) — Concept for security policy enforcement
- **Release Provenance** (`/release/`) — Concept for build reproducibility
- **Truth Certificates** (`/truth/`) — Concept for attestation chains

## Why They're Here (Not Deleted)

1. **Design artifacts**: These represent architectural decisions and are useful for future implementation
2. **Test coverage**: Test files in `test/release/release-integrity.test.js` preserve the design intent
3. **Learning value**: Code documents "what we considered for enterprise"

## Why They're NOT in Core

From VERAX Constitution (Stage 0 audit):
- **Honesty Principle** (CORE #10): "VERAX MUST be explicit about what it does and does not do"
- **No Incomplete Features**: These modules are not production-ready, not tested in CI, not part of the product definition

## Accessing These (If/When Implemented)

Future versions will:
1. Move these to `src/verax/core/` or keep in `src/internal/`
2. Add CLI commands: `verax ga`, `verax security:check`, `verax release:check`
3. Document in product-definition.js
4. Integrate into `npm test` CI pipeline

## For Now

**Do NOT import from `src/internal/future-gates/` in production code.** Only use for:
- Historical reference
- Design planning
- Documentation of what was attempted

---

**Last Updated**: January 24, 2026 — Constitutional Purification Pass
