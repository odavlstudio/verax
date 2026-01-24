# VERAX GOVERNANCE

**Status**: Constitutional Process - How decisions are made  
**Authority**: Institutional necessity for 1.0+ longevity  
**Last Reviewed**: 2026-01-24  

---

## PURPOSE

This document defines how VERAX maintains constitutional integrity when:
- A proposed change contradicts CORE.md
- A contradiction appears between CORE and code
- A limitation is challenged as unfair
- New information reveals a CORE rule is broken or unenforceable
- The constitution itself may need revision

**Principle**: Prefer blocking changes and maintaining clarity over allowing ambiguous exceptions.

---

## THE CONSTITUTION IS BINDING

CORE.md and EVOLUTION.md are not advisory.

They are the legal framework for all decisions.

If code contradicts CORE, the code is wrong — not the constitution.

---

## RULE 1: CORE CONTRADICTIONS ARE CRITICAL BUGS

**If code behavior contradicts any rule in CORE.md (principles 1-15), it is a critical bug.**

The bug is not the missing feature — it is the broken promise.

### Process:

1. **Identify the contradiction**
   - Which CORE rule is violated?
   - What code violates it?
   - Is this a known violation or a newly discovered one?

2. **Assess severity**
   - **TIER 1 (Constitutional violation)**: Rule 2 (Evidence Law), Rule 3 (Read-only), Rule 5 (Determinism), Rule 11 (Exit codes)
   - **TIER 2 (Scope violation)**: Rule 4 (Pre-auth), Rule 13 (Honesty)
   - **TIER 3 (Implementation violation)**: Rule 6, 7, 9, 12, 14, 15

3. **Report issue**
   - Title: `[CORE-VIOLATION] <Rule N>: <Brief description>`
   - Add label: `constitutional-violation`
   - Link to affected CORE rule
   - Include evidence (code location, test case, reproduction)

4. **Fix or amend**
   - **Option A (Fix)**: Change code to honor CORE
   - **Option B (Amend)**: Change CORE to reflect new reality (requires governance vote, see Rule 5)

---

## RULE 2: EVOLUTION CONSTRAINT CHECKING

**Before a feature is merged, it MUST be checked against EVOLUTION.md.**

### Process:

1. **Identify which evolution path(s) the feature affects** (paths 1-8)
2. **Verify all constraints in that path are met**
3. **Check for forbidden evolution** (explicitly blocked)
4. **If the feature doesn't fit any path, it requires CORE amendment** (see Rule 5)

### Code Review Checklist:

- [ ] Feature aligns with at least one evolution path
- [ ] All constraints for that path are verified
- [ ] Feature does not violate CORE principle 1-15
- [ ] Exit codes unchanged or properly updated
- [ ] Determinism preserved (if applicable)
- [ ] Documentation reflects new capability (if new)
- [ ] Maturity level documented (ALPHA/BETA/STABLE/DEPRECATED)

If any checkbox fails, the PR is not approved until resolved.

---

## RULE 3: BREAKING CHANGES REQUIRE VISIBILITY

**Any change that affects:**
- Exit codes
- Finding schema
- Artifact structure
- Supported frameworks
- Scope boundaries
- Evidence requirements
- Output format

...MUST be:
1. **Documented in CHANGELOG.md** with explicit "BREAKING CHANGE:" prefix
2. **Announced to users** with migration guide
3. **Reflected in version number** (major version bump)
4. **Reviewed for CORE alignment** (does it violate anything?)

---

## RULE 4: CONTRADICTIONS BETWEEN DOCUMENTATION AND CODE

**The code is the source of truth. Documentation is the contract.**

If documentation claims something code doesn't do:
- **Minimal severity**: Fix documentation to match code
- **Critical severity**: Code is missing a promised feature

### Process:

1. **Reproduce the contradiction**
   - Show what documentation promises
   - Show what code actually does
   - Is this a bug in code or inaccurate documentation?

2. **Classify**
   - **Documentation bug**: Update docs, backport fix to previous versions if applicable
   - **Code bug**: Fix code per CORE.md, increment patch version
   - **Scope mismatch**: May require CORE amendment (see Rule 5)

3. **Update both**
   - Code changes MUST update documentation
   - Documentation changes MUST be validated against code
   - Issue a corrected release

---

## RULE 5: AMENDING CORE.MD (CONSTITUTIONAL CHANGE)

**CORE.md may be amended, but ONLY through formal process.**

### When CORE amendment is needed:

- New information shows a CORE rule is technically impossible
- A critical market need conflicts with a CORE rule
- A contradiction in CORE itself becomes apparent
- A major version (e.g., 1.0 → 2.0) is planned and scope changes intentionally

### Amendment Process:

1. **Proposal phase**
   - Create GitHub issue: `[CORE-AMENDMENT] <Rule N>: <Proposed change>`
   - Include: what the rule currently says, why it needs to change, what the new rule would be
   - Link to related issues, contradictions, or PRs
   - Propose replacement language (if amending) or deletion (if removing)

2. **Discussion phase**
   - At least 2 weeks of public discussion
   - VERAX maintainers MUST engage with concerns
   - Document all objections and responses
   - Update proposal if new information changes assessment

3. **Voting phase**
   - Core maintainers vote: Approve, Reject, or Request Changes
   - At least 2/3 maintainer agreement required
   - Vote results and rationale documented publicly
   - If rejected, issue closed with explanation

4. **Implementation phase**
   - Approved amendment published in CORE.md with amendment number and date
   - All affected code MUST be updated to comply with new rule
   - New tests MUST validate compliance
   - Release with major version bump
   - Changelog MUST explain what changed and why

5. **Enforcement**
   - All future PRs checked against new rule
   - Code audits verify no violations of new rule

### Amendment Record

Each amendment to CORE.md MUST include:
```markdown
## AMENDMENT <N> — <Date>

**Rule changed**: CORE principle <N>

**Previous language**: [full text]

**New language**: [full text]

**Rationale**: [why this amendment was necessary]

**Vote result**: <N> maintainers approved, <N> opposed

**Implementation**: [list of code changes, new tests, documentation updates]
```

Amendments are cumulative and immutable (never deleted, only superseded).

---

## RULE 6: GOVERNANCE OF EVOLUTION PATHS

**Evolution paths in EVOLUTION.md may be refined, but not removed without CORE amendment.**

### When an evolution path needs updating:

1. **Path constraint is impossible** (technical limitation discovered)
2. **Path is being exploited** to bypass CORE (someone found a loophole)
3. **New constraints needed** to prevent future abuse

### Process:

1. **Propose constraint change** in GitHub issue: `[EVOLUTION-PATH-<N>] <Constraint or clarification>`
2. **Justify the change** with technical evidence or case study
3. **Ensure new constraint doesn't violate CORE**
4. **Submit PR** to EVOLUTION.md with explanation comment
5. **Require code review** from at least 2 maintainers
6. **If PR is approved**, deploy with patch version bump

---

## RULE 7: HANDLING SCOPE BOUNDARY DISPUTES

**Scope boundaries (what VERAX will and won't support) are defined by CORE principle 4 (pre-auth only).**

If someone requests a feature that conflicts with pre-auth scope:

1. **Clarify the request**
   - Does this require testing authenticated flows? If yes, it's out of scope.
   - Does this require testing protected data? If yes, it's out of scope.
   - Is there a pre-auth equivalent? If yes, consider that instead.

2. **Respond with path**
   - **If it fits pre-auth scope**: Add to evolution path, plan implementation
   - **If it conflicts with pre-auth scope**: Politely decline, reference CORE principle 4
   - **If it's a strategic opportunity**: Escalate to CORE amendment process (Rule 5)

3. **Document the decision**
   - Add to README.md "What VERAX doesn't do" section
   - Close issue with explanation and link to CORE

---

## RULE 8: VISION LOCK ENFORCEMENT

**All code containing Vision Lock comments MUST match the rule it locks.**

Vision Lock syntax:
```javascript
// VISION LOCK: <principle name>
// <Principle definition>
// <Non-negotiable constraint>
```

### Enforcement:

1. **During code review**: Any VISION LOCK comment MUST have corresponding CORE rule
2. **During testing**: Automated tests MUST verify Vision Lock constraints are honored
3. **During refactoring**: Vision Lock code MUST NOT be refactored away without constitutional amendment

### Example:

```javascript
// VISION LOCK: Read-Only Principle (CORE #3)
// VERAX must never send POST/PUT/PATCH/DELETE requests
// Constraint: network.firewall MUST block all write operations

if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method)) {
  this.blockRequest(request);
}
```

---

## RULE 9: WHAT CANNOT BE OVERRIDDEN

**Certain decisions are NOT subject to governance debate.**

The following are immutable:
- CORE principle 2 (Evidence Law)
- CORE principle 3 (Read-only)
- CORE principle 5 (Determinism)
- CORE principle 7 (No guessing)
- CORE principle 11 (Exit codes)

If someone proposes an amendment that would relax these principles, the proposal is rejected immediately with explanation: "This would require changing the fundamental nature of VERAX."

These principles exist because they are constitutive of what VERAX is. Changing them is not evolution — it is building a different product.

---

## RULE 10: COMMUNICATION OF DECISIONS

**All constitutional decisions MUST be communicated clearly.**

### When a decision is made:

1. **GitHub issue resolution** (if decision was requested via issue)
2. **CHANGELOG.md update** (if decision affects users)
3. **Documentation update** (CORE, EVOLUTION, or product docs)
4. **Blog post or statement** (if decision is strategic)

### Communication template:

```markdown
## Decision: <Title>

**What changed**: [Summary of decision]

**Why**: [Rationale, including reference to CORE or EVOLUTION]

**Who decided**: [Maintainers involved]

**Effective date**: [When this takes effect]

**What users need to do**: [Migration steps if applicable]
```

---

## RULE 11: ESCALATION PATHS

**If a decision cannot be made at team level, escalate clearly.**

Escalation hierarchy:
1. **Code review** (PR approvers decide technical implementation)
2. **Maintainer consensus** (core maintainers decide EVOLUTION path alignment)
3. **Constitutional amendment** (CORE changes require vote)
4. **Project governance** (if no consensus on vote)

Do not proceed with a change if consensus is not reached at the appropriate level.

---

## RULE 12: HISTORICAL RECORD

**All governance decisions MUST be recorded for future reference.**

Maintain a `constitution/DECISIONS.md` file documenting:
- Date of decision
- What was decided
- Who decided it
- Why (rationale)
- Links to related issues/PRs
- Whether decision is still in effect

This prevents repeated arguments about the same issue and provides context for new maintainers.

---

## RULE 13: ANNUAL CONSTITUTIONAL REVIEW

**Once per year, the CORE.md and EVOLUTION.md MUST be reviewed.**

### Review process:

1. **Audit current code** against CORE — identify any violations not yet reported
2. **Review decided amendments** — are they being honored?
3. **Assess evolution paths** — which paths are being used? Do constraints need tightening?
4. **Gather user feedback** — are there pain points that suggest CORE needs amendment?
5. **Publish review** as blog post or issue — announce findings publicly

---

## RULE 14: WHO HAS AUTHORITY

**Constitutional decisions are made by:**

1. **Code review** (PR approvers): Technical implementation, Evolution path compliance
2. **Maintainers** (2+ core maintainers): EVOLUTION path refinement, scope clarification
3. **Maintainers + Founder** (2/3+ agreement): CORE amendment

External contributors may propose changes but do not have voting authority.

---

## RULE 15: NAMING RULES (FROZEN)

**All file names, folder names, and exports MUST reflect actual responsibility, not history, intent, or transition state.**

This rule prevents naming degradation that obscures code purpose and creates architectural ambiguity.

### Forbidden Naming Patterns

The following patterns are STRICTLY FORBIDDEN in all file and folder names:

- `experimental` (use framework-specific or capability-specific names)
- `refactor` (legacy code must use `.legacy.js` or `.deprecated.js`)
- `temp` / `tmp` / `temporary` (no temporary implementations in production)
- `vibe` / `magic` / `wizard` / `human` / `phantom` / `ghost` (no anthropomorphic language)
- `utils` (unless narrowly scoped with clear justification)
- Any name suggesting future work or incomplete migration

### Required Suffix Semantics

File suffixes MUST be semantically correct:

- `-engine.js` → orchestration and coordination logic only
- `-detector.js` → detection logic only
- `-sensor.js` → observation without interpretation only
- `-extractor.js` → static extraction logic only
- `-builder.js` → construction logic only
- `-validator.js` → validation logic only
- `-normalizer.js` → normalization logic only
- `-aggregator.js` → aggregation logic only
- `-writer.js` → file writing logic only

### Legacy Code Naming

Legacy or deprecated code MUST be explicitly named:

- `.legacy.js` for internal legacy implementations
- `.deprecated.js` for backward compatibility facades

### Canonical Entry Points

Every subsystem with multiple implementations MUST document:

- The canonical entry point (public API)
- Legacy implementations (internal use only)
- Deprecated facades (backward compatibility only)

### Enforcement

- Any PR introducing forbidden naming patterns MUST be rejected
- Any PR renaming files without updating all imports MUST be rejected
- File names are constitutional invariants subject to code review

---

## RULE 16: NO VIBE CODING RULE (ABSOLUTE)

**Production code MUST NOT contain speculative, emotional, or placeholder language.**

This rule ensures code clarity, enterprise-grade communication, and eliminates ambiguity about implementation status.

### Strictly Forbidden Markers

The following markers are STRICTLY FORBIDDEN in all production code:

- `TODO`
- `FIXME`
- `HACK`
- `WIP`
- `XXX`
- `placeholder`
- `temporary fix` / `temp fix`
- `workaround` (unless explicitly documented as intentional limitation)

### Forbidden Language Patterns

The following language patterns are FORBIDDEN in comments and documentation:

- `maybe` / `probably` / `hopefully`
- `should work` / `expected to`
- `might be` / `could be`
- `just in case`
- `???`

### Required Comment Standards

Every comment MUST describe either:

- **What the code DOES** (present tense, factual)
- **What the code EXPLICITLY does NOT do** (stated as limitation)

Examples of acceptable limitations:

```javascript
// Screenshot redaction not implemented - binary buffer returned unmodified
// Binary screenshot redaction requires specialized image processing
```

Examples of FORBIDDEN language:

```javascript
// TODO: Add redaction later
// Placeholder for redaction logic
// This should probably work
// Maybe add validation here
```

### Unimplemented Features

If a feature is not implemented:

- State the limitation explicitly and neutrally
- Document technical reasons if applicable
- Do NOT promise future implementation
- Do NOT use placeholder markers

### Enforcement

- Any PR introducing forbidden markers MUST be rejected
- Any PR with speculative language MUST be revised
- Comments are subject to the same review standards as code
- No exceptions are permitted without explicit constitutional amendment

---

## RULE 17: ENFORCEMENT OF RULES 15 AND 16

**Rules 15 and 16 are constitutional invariants.**

These rules protect VERAX from architectural decay and ensure enterprise-grade code quality.

### Enforcement Mechanisms

1. **Code Review**: PR approvers MUST reject any violation
2. **CI Pipeline**: Automated checks SHOULD flag violations where feasible
3. **Contributor Guidelines**: All contributors MUST be informed of these rules
4. **Zero Tolerance**: No PR may be merged with violations, regardless of scope

### Exception Process

Exceptions to Rules 15 and 16 require:

1. **Explicit constitutional amendment** (see Rule 5)
2. **Maintainer + Founder consensus** (2/3+ agreement)
3. **Public documentation** of exception rationale
4. **Sunset clause** for temporary exceptions (no permanent violations)

No individual maintainer or contributor may grant exceptions independently.

---

## CONFLICT RESOLUTION

**If two rules in CORE conflict with each other:**

1. **Report as issue**: `[CORE-CONFLICT] <Rule X> vs <Rule Y>`
2. **State the conflict clearly** with example showing both rules cannot be satisfied
3. **Escalate to constitutional amendment** (Rule 5)
4. **In the meantime**, apply this hierarchy:
   - Rule 2 (Evidence Law) > all others
   - Rule 3 (Read-only) > all others  
   - Rule 5 (Determinism) > all others
   - If neither is above, apply Rule 11 (pre-auth scope)

---

## IMPLEMENTATION CHECKLIST

Before any change to CORE.md, EVOLUTION.md, or major code behavior:

- [ ] Is this a response to a CORE violation? (Rule 1)
- [ ] Does this proposal fit EVOLUTION paths 1-8? (Rule 2)
- [ ] Does this require a major version bump? (Rule 3)
- [ ] Is documentation in sync with code? (Rule 4)
- [ ] Does this require CORE amendment? (Rule 5)
- [ ] If amending CORE, is proposal ready for vote? (Rule 5)
- [ ] Have Vision Lock constraints been verified? (Rule 8)
- [ ] Is decision documented for future reference? (Rule 12)
- [ ] Has authority been granted for this decision? (Rule 14)

If any checkbox is unchecked, do not proceed.

---

## CLOSING PRINCIPLE

The constitution exists to preserve VERAX's identity and user trust.

When in doubt, prefer maintaining the constitution over expanding capability.

A smaller tool that keeps its promises is more valuable than a larger tool that breaks them.

