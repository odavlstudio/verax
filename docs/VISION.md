# VERAX — Vision

## 1. What VERAX Is

**VERAX is a read-only, deterministic guard for public, pre-authentication user flows.**

It observes real user interactions on live web applications  
and detects **Silent User Failures** — moments where:

- the application makes a visible technical promise,
- the user acts on that promise,
- and no clear, observable acknowledgment happens.

VERAX exists to reveal **where users are lost before trust is established** —
before signup, before login, before conversion.

It does not simulate intent.  
It does not guess meaning.  
It does not modify systems.

**VERAX observes promises, actions, and outcomes — and reports only what can be proven.**

---

## 2. The Exact Problem VERAX Solves

Most critical user losses do **not** happen after login.

They happen when a user:

- clicks a primary CTA,
- submits a signup or login form,
- requests a password reset,
- or navigates between public pages,

and **nothing clearly happens**.

No error.  
No confirmation.  
No feedback.  

The system may be technically “working”,  
yet from the user’s perspective, the promise was broken.

Traditional tools miss this gap:

- QA verifies expected paths.
- Monitoring checks availability.
- Analytics shows behavior after the fact.

**None of them answer the question:  
“Did the user clearly experience what the system promised?”**

VERAX exists to answer exactly that — with evidence.

---

## 3. Scope of Responsibility (Strict and Explicit)

### ✅ IN SCOPE (What VERAX Is Responsible For)

VERAX guarantees accurate, deterministic analysis for:

- Public pages (pre-authentication)
- Landing pages and marketing flows
- Primary CTAs and navigation
- Signup, login, and password-reset forms
- Visible, user-triggered interactions
- Observable outcomes:
  - URL or route changes
  - Meaningful DOM updates
  - User-visible feedback
  - Network activity correlated to the action

All findings are:

- Read-only
- Evidence-backed
- Deterministic (same input → same output)

---

### ❌ OUT OF SCOPE (By Design)

VERAX explicitly does **not** claim responsibility for:

- Authenticated / post-login flows
- Role-based or permission-gated behavior
- Business logic correctness
- Dynamic entity routes (e.g. `/users/:id`)
- Feature flags and A/B variants
- Mobile or native applications
- Non-observable internal state changes

These areas are **intentionally excluded**, not forgotten.

---

## 4. What VERAX Is NOT

VERAX is **not**:

- a testing framework
- a QA replacement
- a monitoring system
- a crawler
- an analytics tool
- an AI decision engine
- a bug fixer
- a simulator of user intent

**VERAX does not use heuristics, learning, or guessing.**

Instead, it uses **explicit, centralized rules** that do not adapt, learn, or infer intent.

---

## 5. Definition of a Silent User Failure

A Silent User Failure exists **only if all conditions are met**:

1. A **technical promise** is visible to the user  
   (navigation, submission, or feedback is expected).
2. The user **performs the corresponding action**.
3. Within a defined observation window:
   - no navigation occurs,
   - no meaningful UI change is visible,
   - no clear feedback is presented.

If any observable acknowledgment exists,  
VERAX does **not** report a failure.

If evidence is incomplete,  
VERAX reports **incompleteness**, not success.

---

## 6. Result Semantics and Trust Contract

VERAX results are intentionally conservative.

### SUCCESS
- All in-scope interactions were observed
- No silent failures were detected

This does **not** mean the application is correct —  
only that no silent failures were observed in the tested scope.

### FINDINGS DETECTED
- At least one silent failure was observed
- Evidence is attached and reproducible

### INCOMPLETE
- Coverage was partial
- Time, budget, or environmental limits were reached

An INCOMPLETE result must **never** be interpreted as safe.

---

## 7. Determinism Over Intelligence

VERAX prioritizes determinism over cleverness.

- No probabilistic reasoning
- No hidden heuristics
- No learning from past runs
- No adaptive behavior that changes outcomes

**Given the same code input and stable environment,**
**VERAX produces deterministic logic and reproducible artifacts.**

### What Is Deterministic

**Core logic and findings:**
- Silent failure detection (promise vs observation comparison)
- Evidence validation (same evidence → same classification)
- Severity assignment (HIGH/MEDIUM/LOW rules are deterministic)
- Exit codes (same conditions → same code)
- Artifact structure and counts (same findings → same summary.json)

**Normalized across runs:**
- Source code discovery (same search paths, same priority)
- Framework detection (same detection rules)
- Expectation extraction (same code → same promises)
- Path normalization (absolute paths made relative consistently)

### What Varies by Design

**Time-based fields** (allowed to differ between runs):
- `startedAt`, `completedAt` timestamps
- `duration` (run time in milliseconds)
- `runId` (unique identifier per execution)

**Environment-dependent** (allowed to vary):
- `runtimeVersion` (VERAX version)
- `nodeVersion` (Node.js version)
- `platform` (OS type)

**Deterministic but unseeded** (same across runs only if timeout/coverage identical):
- `coverage.coverageRatio` (ratio of attempted/total)
- `findingsCounts` (counts of each severity)

### First-Run Defaults (Safety Feature)

VERAX applies **different defaults** for first run vs subsequent runs:

| Setting | First Run | Subsequent Runs |
|---------|-----------|-----------------|
| `--min-coverage` | 0.50 (relaxed) | 0.90 (strict) |
| CI mode | `balanced` | `balanced` |

**Why:** First run may have incomplete source extraction or environment issues. Subsequent runs assume you've validated the basic setup. This is documented in run.meta.json for audit trail.

---

## 8. Evidence Is the Product

VERAX **attempts** to produce findings backed by:

- before/after screenshots
- DOM diffs
- network traces
- execution timelines

**When evidence is incomplete:**
- The finding is downgraded or discarded.
- If the gap cannot be assessed, the result is marked INCOMPLETE.

VERAX never asks to be trusted blindly.

---

## 9. Supported Frameworks

VERAX provides **full support** for:
- Static HTML
- React (with react-router-dom)
- Next.js (App Router and Pages Router, dev and prod)

VERAX provides **partial support** for:
- Vue 3 (code extraction only; observation partially supported)
- Angular (code extraction only; observation partially supported)
- SvelteKit (code extraction only; observation partially supported)

**Unsupported frameworks** are detected and explicitly marked `OUT_OF_SCOPE`, with warnings printed to the CLI and incomplete reasons recorded in artifacts.

---

## 10. Zero Configuration — With Honest Limits

VERAX is designed to work out-of-the-box for public flows.

### Source Auto-Discovery (Implementation in v0.4.5)

When `--src` is not provided, VERAX automatically searches for source code in this exact order:

1. `./src`
2. `./app`
3. `./frontend`
4. `.` (current directory)

**If source IS detected:**
- Runs with full detection capabilities (source-based + runtime observation)
- Result can be SUCCESS, FINDINGS, or INCOMPLETE based on actual findings
- Full evidence guarantees apply

**If source is NOT detected after searching all paths:**
- Runs in LIMITED mode (runtime observation only, no source-based detection)
- **Verdict is ALWAYS INCOMPLETE** with explicit reasons:
  - `source_not_detected`
  - `limited_runtime_only_mode`
- **Exit code: 30 (INCOMPLETE)**
- User must provide `--src <path>` explicitly to enable full analysis

### LIMITED Mode Guarantee

LIMITED mode is a **safety feature**, not a limitation:

- When source is missing, VERAX does not claim false confidence
- Runtime-only observation cannot provide the evidence guarantees required for SUCCESS or FINDINGS
- Even if no failures are observed, result is INCOMPLETE
- This prevents CI false-negatives (unsafe green signals)

**Example:**
```bash
$ verax run --url http://example.com
# Source not found in ./src, ./app, ./frontend, .
⚠️  Source: not detected (limited runtime-only mode)
    Analysis will be limited to runtime observation.
    Result will be marked INCOMPLETE.
    Provide --src <path> for full source-based analysis.

# ... observation runs ...

# Output summary
RESULT INCOMPLETE
REASON No source code detected; runtime-only observation is insufficient for trust
ACTION Provide --src <path> to enable full source-based analysis

# Exit code: 30
```

### "Zero Configuration" Definition

**"Zero configuration" means:**
> You can run `verax run --url <site>` without `--src`  
> and VERAX will behave correctly (not crash, not give false confidence).  
> **Within the defined scope** (projects with detectable source code structure),  
> you get full detection. **Outside that scope** (missing source), you get honest INCOMPLETE.

**Safety guarantee:**
- LIMITED mode never returns SUCCESS or FINDINGS
- Absence of source code → always INCOMPLETE → CI gates are safe

**Enterprise CI/CD recommendation:**
Provide `--src <path>` explicitly for deterministic, reproducible builds and full detection.

---

## 11. Post-Authentication Scope Enforcement

VERAX is **explicitly designed for pre-authentication flows only.**

The Vision contract and all guarantees apply ONLY to:
- Public landing pages
- Signup forms
- Login forms
- Password reset flows
- Public navigation

The Vision contract does **NOT** apply to:
- Post-login authenticated flows
- Role-based access control
- Permission-gated features
- Internal dashboards
- Authenticated API responses

### How Post-Auth Mode Works

If you attempt to use authentication flags (`--cookies`, `--auth-token`, etc.):

1. **Pre-condition:** Requires explicit `--force-post-auth` flag
   - This is intentional: we want to avoid accidental authenticated testing
   - Without `--force-post-auth`, auth flags are rejected

2. **Execution:** VERAX runs observation with auth context
   - Interactions may execute in authenticated state
   - But detection logic does NOT validate them as in-scope

3. **Verdict:** ALWAYS INCOMPLETE
   - Result is marked INCOMPLETE by contract
   - Evidence is not trusted for authenticated flows
   - Exit code: 30 (INCOMPLETE)

4. **Output:** Clear warning

```
⚠️  WARNING: Running in EXPERIMENTAL post-auth mode
    • Authenticated flows are OUT OF SCOPE per Vision.md
    • This result MUST NOT be trusted
    • VERAX is designed for pre-authentication user journeys only
```

### Why This Design?

Post-authentication flows have **different trust requirements**:
- Promises depend on backend state, not just frontend code
- Silent failures mean something different (permission denied, invalid state, etc.)
- Evidence must include backend contract validation, not just UI observation

Supporting post-auth flows would require a different product. VERAX explicitly does not attempt this.

### Example: Using POST-AUTH Mode

```bash
# ✗ This fails without --force-post-auth:
$ verax run --url https://app.example.com --cookies "session=xyz" 
# Error: Auth flags require --force-post-auth

# ✓ This runs in LIMITED/experimental mode:
$ verax run --url https://app.example.com --cookies "session=xyz" --force-post-auth

# Output:
# ⚠️  WARNING: Running in EXPERIMENTAL post-auth mode
# ... observation runs ...
# RESULT INCOMPLETE
# REASON Authenticated flows are OUT OF SCOPE per Vision.md
# Exit code: 30

# This prevents CI from treating authenticated flows as trusted
```

---

## 12. Expansion Philosophy

VERAX will expand its scope **only when guarantees can be preserved**.

Future capabilities may include:

- authenticated flows
- deeper SPA state observation
- enterprise orchestration

Each expansion will be:
- explicit
- versioned
- and contractually defined

Nothing is added implicitly.

---

## 13. The Core Principle

> **If VERAX cannot prove it,  
> VERAX will not claim it.**

This principle overrides all others.

---

## 14. Final Statement

VERAX is not built to test everything.

It is built to protect the moment where users decide
whether they trust your product or leave forever.

That moment happens **before login**.

VERAX exists for that moment.
