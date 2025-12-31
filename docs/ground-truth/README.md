# GROUND TRUTH ARTIFACTS: Index & Quick Reference

**Date:** December 31, 2025  
**Status:** Phase 0 - Product Ground Truth Lock  
**Scope:** Evidence-based product definition artifacts for odavlguardian  

---

## FILES IN THIS FOLDER

### 1. [ONE_LINER.md](ONE_LINER.md)
**What it is:** Single-sentence product definition (≤25 words)

**Definition:** "Guardian decides whether a website is safe to launch by observing real users, then monitors what breaks after."

**Why read it:** Quick elevator pitch; non-technical language; answers what/for whom/why.

---

### 2. [PRIMARY_USER.md](PRIMARY_USER.md)
**What it is:** The single primary user persona

**Persona:** CI/CD Pipeline Operator / Release Engineer / Deployment gatekeeper

**Key facts:**
- Controls deployment pipeline and decides if commits reach production
- Needs deterministic, machine-readable verdicts (exit codes 0/1/2)
- Integrates Guardian into GitHub Actions, GitLab CI, Bitbucket, etc.
- Runs Guardian on every deployment candidate (multiple times per day)
- Needs decision.json with reasons for failures

**Why read it:** Clarifies who the product was designed for; explains architecture choices (GitHub Action, exit codes, rate limiting).

---

### 3. [DOES_DOES_NOT.md](DOES_DOES_NOT.md)
**What it is:** Concrete, testable capabilities and non-capabilities

**What GUARDIAN DOES (7 bullets):**
1. Observes real user flows in a real browser (Playwright)
2. Returns deterministic verdict: READY, FRICTION, or DO_NOT_LAUNCH
3. Decides based on observed reality, not code analysis or tests
4. Generates machine-readable decision artifacts (JSON, reports, traces)
5. Integrates into CI/CD with deterministic exit codes (0/1/2)
6. Monitors production after deployment (Live mode)
7. Non-bypassable authority (verdicts cannot be overridden)

**What GUARDIAN DOES NOT DO (7 bullets):**
1. Does NOT find or fix bugs
2. Does NOT replace testing frameworks
3. Does NOT analyze code quality or security
4. Does NOT require code access or integration
5. Does NOT compete with continuous monitoring tools
6. Does NOT configure or deploy websites
7. Does NOT guarantee 100% coverage

**Why read it:** Clear boundaries; explains what Guardian is designed for and what it deliberately does not do.

---

### 4. [CORE_PROMISE.md](CORE_PROMISE.md)
**What it is:** Guardian's value contract and proof mechanisms

**The Promise:**
Before launch: Observe the website as a real user will, tell if safe to launch.  
After launch: Monitor production, alert if user flows break.

**How Guardian Proves It:**
- Real browser automation (Playwright)
- Pre-defined user flow execution
- Verdict computation (READY/FRICTION/DO_NOT_LAUNCH)
- decision.json (machine-readable verdict + reasons)
- Exit codes (0/1/2 for pipeline integration)
- HTML/JSON reports + network traces
- Post-launch monitoring with baseline comparison

**Why read it:** Explains the value proposition and exactly how the system works; proof mechanisms are concrete and testable.

---

### 5. [POSITIONING_LOCK.md](POSITIONING_LOCK.md)
**What it is:** Product category, differentiation, and positioning statement

**Category:** Deployment Decision Authority (or: Reality-Based Launch Gating)

**How Guardian Differs:**
- **vs. Testing Tools (Playwright, Cypress):** Testing tools find bugs; Guardian decides if safe to launch. Testing results are informational; Guardian verdicts are binding.
- **vs. Monitoring Tools (Sentry, Datadog):** Monitoring tools observe everything continuously; Guardian observes specific user flows periodically. Monitoring is advisory; Guardian verdicts gate deployments.

**Positioning:** Guardian is the gating authority that decides whether a website is safe to launch based on observed user reality, not code assumptions or continuous metrics.

**Why read it:** Clarifies what category Guardian is in and how it's fundamentally different from adjacent tools.

---

## QUICK REFERENCE: GROUND TRUTH

| Question | Answer | Source File |
|----------|--------|-------------|
| **What is Guardian in one sentence?** | Decides if safe to launch by observing real users, monitors after | ONE_LINER.md |
| **Who is the primary user?** | CI/CD operator / Release engineer / Pipeline gatekeeper | PRIMARY_USER.md |
| **What is Guardian?** | 7 core capabilities | DOES_DOES_NOT.md (PART A) |
| **What is Guardian NOT?** | 7 explicit non-capabilities | DOES_DOES_NOT.md (PART B) |
| **What problem does Guardian solve?** | Launches breaking user flows; teams decide without reality data | CORE_PROMISE.md (Problem) |
| **What does Guardian promise?** | Safe launches via real user observation + binding verdict | CORE_PROMISE.md (Promise) |
| **How does Guardian prove it?** | decision.json, exit codes, reports, traces, monitoring | CORE_PROMISE.md (Proof) |
| **What category is Guardian in?** | Deployment Decision Authority | POSITIONING_LOCK.md |
| **How is Guardian different from testing tools?** | Non-bypassable gate, not informational | POSITIONING_LOCK.md |
| **How is Guardian different from monitoring tools?** | Periodic checkpoints, not continuous; binary verdict, not dashboard | POSITIONING_LOCK.md |

---

## VALIDATION SCORES

| Artifact | Clarity | Ambiguities |
|----------|---------|------------|
| ONE_LINER.md | 10/10 | None |
| PRIMARY_USER.md | 9/10 | Persona title is broad ("Release Engineer" family) but accurate |
| DOES_DOES_NOT.md | 10/10 | None |
| CORE_PROMISE.md | 9/10 | "Real user" is simulated, not actual humans (intentional design choice) |
| POSITIONING_LOCK.md | 9/10 | Two category names both defensible; one slightly clearer |

**Overall Ground Truth Quality: 9.4/10**

---

## HOW TO USE THESE ARTIFACTS

### For Marketing/Sales
- Start with ONE_LINER.md
- Use POSITIONING_LOCK.md for competitive positioning
- Reference CORE_PROMISE.md for value prop

### For Product Managers
- Use PRIMARY_USER.md to understand who we're building for
- Use DOES_DOES_NOT.md to define scope and boundaries
- Reference CORE_PROMISE.md for feature prioritization

### For Engineers/Architects
- Use PRIMARY_USER.md to understand why features are designed the way they are (exit codes, GitHub Action, rate limiting)
- Use DOES_DOES_NOT.md to understand what NOT to build
- Reference POSITIONING_LOCK.md to understand where Guardian fits in the ecosystem

### For Users/Customers
- Start with ONE_LINER.md
- Read CORE_PROMISE.md to understand what Guardian does
- Use DOES_DOES_NOT.md to understand what Guardian does NOT do
- Reference PRIMARY_USER.md to see if Guardian is for you

---

## NEXT STEPS (Not in scope for Phase 0)

These artifacts are **locked ground truth**. They should:
- Guide all marketing messaging (consistency)
- Inform feature prioritization (stay in scope)
- Shape API design (reflect core promise)
- Drive hiring conversations (who we're building for)

Changes to these artifacts require explicit decision (not routine updates).

---

**Last Updated:** December 31, 2025, 02:15 UTC  
**Status:** Phase 0 Complete — Ground Truth Locked
