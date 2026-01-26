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

### ❌ OUT OF SCOPE (By Design, For Now)

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

**Note:** Time-based fields (timestamps, run duration) are not deterministically identical across runs, by design. Framework and feature detection are deterministic. Retry logic and timeout classification are centralized and deterministic.

Trust is earned through reproducibility and explicit rules, not prediction.

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

**Auto-Detection:**
- When `--src` is omitted, VERAX automatically searches for source code in:
  1. Current directory (`.`)
  2. Common subdirectories: `./src`, `./app`, `./frontend`, `./pages`
  3. Parent directories (up to 3 levels above current directory)

**If source IS detected:**
- Runs with full detection capabilities (source-based + runtime observation)
- Result can be SUCCESS, FINDINGS, or INCOMPLETE based on actual findings
- Full evidence guarantees apply

**If source is NOT detected:**
- Runs in LIMITED mode (runtime observation only, no source-based detection)
- Result is **ALWAYS INCOMPLETE** with explicit reasons:
  - `source_not_detected`
  - `limited_runtime_only_mode`
- Exit code: 30 (INCOMPLETE)
- User must provide `--src` explicitly to enable full trust

**"Zero configuration" means:**
> You can run `verax run --url <site>` meaningfully without specifying `--src`  
> **within the defined scope** (projects with detectable source code).

**Safety guarantee:**  
LIMITED mode never returns SUCCESS or false confidence.  
Absence of source code → always INCOMPLETE → CI gates block safely.

**Enterprise CI/CD recommendation:**  
Provide `--src` explicitly for deterministic, reproducible builds.

---

## 11. Expansion Philosophy

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

## 12. The Core Principle

> **If VERAX cannot prove it,  
> VERAX will not claim it.**

This principle overrides all others.

---

## Final Statement

VERAX is not built to test everything.

It is built to protect the moment where users decide
whether they trust your product or leave forever.

That moment happens **before login**.

VERAX exists for that moment.
