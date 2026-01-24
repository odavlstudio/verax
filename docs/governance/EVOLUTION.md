# VERAX EVOLUTION FRAMEWORK

**Status**: Constitutional Process - Defines how VERAX may grow  
**Authority**: Based on Vision.md scope expansion and framework diversity language  
**Last Reviewed**: 2026-01-18  

---

## PRINCIPLE: EVOLUTION WITH FIDELITY

VERAX is allowed to expand capability and reach **ONLY IF** every rule in CORE.md remains unbroken.

This document defines HOW VERAX may evolve without losing its identity.

---

## EVOLUTION PATH 1: FRAMEWORK SUPPORT EXPANSION

**Status**: Explicitly encouraged by VISION.md

VERAX may add support for additional frameworks, routing libraries, and state management tools without violating CORE, provided:

1. **Framework-specific extraction MUST be isolated** in dedicated modules (e.g., `learn/extractors/svelte-extractor.js`)
2. **Finding types MUST remain framework-agnostic** (all frameworks produce the same finding types)
3. **The core pipeline (learn → observe → detect) MUST NOT change**
4. **Static analysis MUST NOT become guessing**
5. **New framework support MUST be documented in README.md** with explicit maturity level (ALPHA, BETA, STABLE)

**Example of allowed evolution:**
- Add SvelteKit route extractor
- Add Remix data loader extraction
- Add Astro route support

**Example of forbidden evolution:**
- Adding framework-specific finding types (violates CORE principle 14)
- Using ML/rules to guess framework intent (violates CORE principle 7)
- Testing framework-specific auth flows (violates CORE principle 4)

---

## EVOLUTION PATH 2: SENSOR & SIGNAL FIDELITY

**Status**: Implicitly encouraged by Evidence Law

VERAX may improve observation accuracy and signal detection without violating CORE, provided:

1. **Sensors MUST report observable facts, not interpretations**
2. **New sensors MUST NOT introduce rule guessing**
3. **Evidence requirements MUST NOT be relaxed** (Evidence Law remains strict)
4. **Confidence scoring MAY improve** but MUST NOT lower evidence bar for CONFIRMED findings

**Example of allowed evolution:**
- Add ARIA landmark detection for accessibility signal
- Improve DOM diff accuracy to catch subtle mutations
- Add Web Components shadow DOM introspection

**Example of forbidden evolution:**
- treating a failed network request "probably means" a business logic error (violates CORE principle 7)
- Lowering evidence thresholds to increase finding volume (violates CORE principle 2)
- deriving intent from function names or variable patterns (violates CORE principle 7)

---

## EVOLUTION PATH 3: SCOPE BOUNDARY CLARIFICATION

**Status**: May evolve as frameworks change, not as ambition grows

VERAX may clarify which frameworks and features are in-scope or out-of-scope, provided:

1. **Scope boundaries MUST remain clear and testable**
2. **Explicit "not supported" MUST be documented** with technical reason, not business decision
3. **Expanding scope (e.g., adding auth flow testing) requires CORE amendment** per GOVERNANCE.md
4. **Contracting scope MUST be announced** to users and documented

**Example of allowed evolution:**
- Formally documenting that dynamic routes (/user/:id) are out of scope with technical reason
- Clarifying which Next.js features are supported (API Routes? Middleware?)
- Adding clear list of state libraries VERAX cannot analyze

**Example of forbidden evolution:**
- Adding auth flow testing without amending CORE (violates CORE principle 4)
- Claiming "partial support" while secretly testing authenticated flows (violates CORE principle 13)

---

## EVOLUTION PATH 4: OUTPUT SCHEMA ENRICHMENT

**Status**: Allowed if backward compatible and Evidence Law is preserved

VERAX may add new fields to findings.json, summary.json, or observe.json artifacts, provided:

1. **All existing fields MUST remain and mean the same thing**
2. **New fields MUST NOT be required** for basic interpretation
3. **Evidence fields MUST NOT be weakened or made optional**
4. **Schema version MUST be updated** and documented
5. **Breaking changes require major version bump** per semver

**Example of allowed evolution:**
- Add `findingId` for cross-artifact referencing
- Add `sourceRef` (file:line) for findings linking back to code
- Add `evidenceIntentAuditTrail` documenting what evidence was required vs. captured

**Example of forbidden evolution:**
- Removing evidence fields (violates CORE principle 2)
- Making severity OPTIONAL (violates CORE principle 9)
- Adding new finding types without framework-agnostic definition (violates CORE principle 14)

---

## EVOLUTION PATH 5: PERFORMANCE & BUDGET MANAGEMENT

**Status**: Encouraged - CORE says nothing about performance

VERAX may improve performance, add budget controls, and optimize observation, provided:

1. **Determinism MUST NOT be sacrificed** for speed (CORE principle 5)
2. **Exit code 66 (INCOMPLETE) MUST be used** if budget/timeout prevents complete observation
3. **Evidence quality MUST NOT degrade** to improve performance
4. **Incomplete scans MUST clearly indicate what was skipped**

**Example of allowed evolution:**
- Add configurable observation timeout (default 10min)
- Skip certain frameworks if not detected (with 66 exit code)
- Add incremental observation (observe some interactions, not all)

**Example of forbidden evolution:**
- Using rules to "predict" outcomes instead of observing (violates CORE principle 7)
- Relaxing Evidence Law thresholds for faster finding validation (violates CORE principle 2)
- Silent timeout (run completes with 0 exit code despite incomplete observation) (violates CORE principle 11)

---

## EVOLUTION PATH 6: DOCUMENTATION & UX CLARITY

**Status**: Encouraged - CORE requires honesty

VERAX may improve documentation, examples, and user experience, provided:

1. **No new capabilities may be claimed** in documentation
2. **Limitations MUST be documented** as clearly as capabilities
3. **Examples MUST work** (no aspirational code)
4. **Scope statements MUST match code behavior**

**Example of allowed evolution:**
- Add tutorial showing how to integrate VERAX in GitHub Actions
- Document why dynamic routes are out of scope (technical limitations)
- Show examples of findings VERAX would and would not catch

**Example of forbidden evolution:**
- Claiming VERAX replaces E2E testing (violates CORE principle 13)
- Showing example of auth flow testing as "planned" (implies false scope, violates CORE principle 13)
- Marketing VERAX as "AI-powered" or "intelligent" (violates CORE principle 7)

---

## EVOLUTION PATH 7: ERROR RECOVERY & GRACEFUL DEGRADATION

**Status**: Encouraged - VERAX promises CI-safety

VERAX may improve error handling and graceful degradation, provided:

1. **Crashes MUST NOT occur on valid input**
2. **Incomplete observation MUST NOT silently succeed** (must exit 66)
3. **Partial findings MUST be reported** with clear indication of why incomplete
4. **Exit codes MUST remain consistent** per CORE principle 11

**Example of allowed evolution:**
- Browser crash during observation → exit 66 with reason
- Missing Playwright binary → exit 65 with clear error
- Timeout during frame capture → exit 66, report which frames were captured

**Example of forbidden evolution:**
- Silently dropping findings if evidence capture fails (violates CORE principle 2)
- Exiting 0 if observation times out (violates CORE principle 11)

---

## EVOLUTION PATH 8: INTERNAL REFACTORING

**Status**: Encouraged if CORE is preserved

VERAX may refactor internal code, restructure modules, and improve maintainability, provided:

1. **External behavior MUST remain identical** (findings, exit codes, artifact structure)
2. **Determinism MUST NOT degrade** due to refactoring
3. **CORE enforcement MUST be maintained** (Evidence Law checks still run)

**Example of allowed evolution:**
- Split `observe/index.js` into smaller, focused modules
- Consolidate duplicate detection logic in `detect/`
- Reorganize test fixtures for clarity

**Example of forbidden evolution:**
- Refactoring that removes Evidence Law validation (violates CORE principle 2)
- Restructuring that changes finding output structure (violates CORE principle 9)

---

## EVOLUTION EXPLICITLY FORBIDDEN

The following evolution paths are blocked permanently by CORE:

1. **Authentication flow testing** — CORE principle 4 (pre-auth only) is non-negotiable
2. **Business logic validation** — CORE principle 6 (extract only from code signals)
3. **AI/ML derivation** — CORE principle 7 (no guessing)
4. **Evidence relaxation** — CORE principle 2 (Evidence Law is mandatory)
5. **State mutation** — CORE principle 3 (read-only)
6. **Non-deterministic output** — CORE principle 5 (determinism is required)

If any of these paths become strategically important, the CORE must be amended via GOVERNANCE.md process (not just evolved).

---

## MATURITY LEVELS FOR NEW CAPABILITIES

As VERAX adds new features, they MUST be tagged with maturity:

- **ALPHA**: Unstable, may change, limited testing, user feedback drives design
- **BETA**: Stable API, incomplete implementation, some edge cases untested
- **STABLE**: Fully tested, documented, committed to backward compatibility
- **DEPRECATED**: Worked previously, no longer maintained, users should migrate

Each capability MUST be documented in README.md with explicit maturity level.

---

## HOW TO USE THIS DOCUMENT

1. **Before adding a new feature**, check if it aligns with one of the 8 evolution paths
2. **If the feature doesn't fit any path**, it likely violates CORE — do not proceed without amending CORE via GOVERNANCE.md
3. **If it fits a path**, verify all constraints in that path
4. **Document maturity level** in README and changelog
5. **If evolution requires behavioral change**, update CORE first

