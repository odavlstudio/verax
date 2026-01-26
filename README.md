# VERAX v1

> Catch buttons and forms that do nothing. No AI, no guessing — just evidence.

**Silent failure detection for public user flows** (pre-authentication only)

[![VERAX CI](https://github.com/odavlstudio/verax/actions/workflows/verax.yml/badge.svg)](https://github.com/odavlstudio/verax/actions/workflows/verax.yml)
[![npm version](https://img.shields.io/npm/v/@veraxhq/verax.svg)](https://www.npmjs.com/package/@veraxhq/verax)
[![license: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](https://github.com/odavlstudio/verax/blob/main/LICENSE)

---

## 3-Minute Quickstart

**Try the demo (recommended for first-time users):**

The demo ships with this repo, so clone it first:
```bash
git clone https://github.com/odavlstudio/verax.git && cd verax && npm install
npm run demo         # Terminal 1: starts fixture at http://127.0.0.1:4000
npm run verax:demo   # Terminal 2: runs scan, see results in ~30 sec
```
See docs/first-run.md for sample output and artifact layout.

**Run on your own site:**
```bash
npm install -g @veraxhq/verax
verax run --url https://your-site.test --src /path/to/your/repo
```
VERAX **requires source code** to learn promises. Without matching source, it extracts zero promises and marks the result INCOMPLETE.

**Inspect artifacts:**
- Human summary: .verax/runs/latest/summary.md
- Evidence & findings: .verax/runs/latest/findings.json, evidence/
- Re-run: `verax inspect .verax/runs/latest`

## The Problem

Silent user failures don't crash your site. They don't throw errors. They simply make users give up.

Examples:
- A button that should navigate does nothing.
- A form submission that triggers an API call shows no feedback or change.
- A state update runs in code but never reaches the UI.

**Your code looks correct. Users experience broken flows. You don't know why.**

---

## What VERAX v1 Does

1. **Reads your source code** to extract explicit promises about user interactions (navigation, network calls, state changes).
2. **Opens your site in a real browser** and executes those interactions like a user would.
3. **Compares code promises with observed outcomes** and reports gaps with evidence.
4. **Assigns confidence levels** (HIGH / MEDIUM / LOW) based on evidence strength.
5. **Provides concrete evidence** for every gap (screenshots, network logs, console output, DOM state).

**Result:** Deterministic, reproducible reports. No guesses. No heuristics.

---

## What VERAX v1 Does NOT Do

| Feature | Status | Why |
|---------|--------|-----|
| Dynamic routes (`/user/${id}`) | ❌ Not supported | Can't promise what we can't see in static code |
| Post-authentication flows | ❌ Out of scope | Requires different observation strategy |
| Backend/API monitoring | ❌ Out of scope | Not a production monitoring tool |
| Replace unit/integration tests | ❌ Different purpose | We observe public flows; tests validate internals |
| Vue, Angular, SvelteKit | ❌ v1 unsupported | Code extraction only; observation not implemented |
| Every bug | ❌ Impossible | Only detects gaps between code promises and user observations |
| AI/heuristics | ❌ Intentionally absent | All results are deterministic and explainable |

---

## How to Read Results

### SUCCESS ✅

**What it means:** All public flows were tested. No unresolved gaps detected.

**What it does NOT mean:** Your application has no bugs. It means VERAX found no gaps between code promises and user observations in the flows it could test.

**Example output:**
```
[SUCCESS] Every public flow was tested in the real browser. 
No silent failures detected. (Confidence: HIGH.)
Result is trustworthy. Proceed.
```

---

### INCOMPLETE ⚠️

**What it means:** VERAX could not test all flows. Results are partial.

**Why it is dangerous:**
```
⚠️ THIS RESULT MUST NOT BE TREATED AS SAFE.
Partial coverage cannot rule out silent failures in untested areas.
```

**What caused incompleteness:**
- Timeout (observation took too long)
- Budget exceeded (too many interactions queued)
- Site behavior (e.g., infinite redirects, authentication required)

**What to do:** Increase coverage budget, reduce scope, or rerun after fixing blockers.

---

### FINDINGS 🔴

**What it means:** VERAX detected one or more gaps between code promises and observed outcomes.

**What action is expected:**
1. Review the evidence (screenshots, logs, network activity).
2. Determine if the gap is a real bug or a false positive.
3. Fix the underlying issue.
4. Re-run to confirm.

**Example finding:**
```
Click promise: "navigation to /signup"
Observed outcome: No URL change, no network request detected
Confidence: HIGH
Evidence: Screenshot (before/after), network log, console output
```

---

## Concrete Example

### Setup
- **Site:** Public signup page with email + password form
- **Interaction:** User clicks "Sign Up" button
- **Code promise:** Button click triggers form submission → POST to `/api/signup` → success response

### What VERAX Does

1. **Learn phase:** Extracts from source code:
   - Button is a form submit trigger
   - Form action points to `/api/signup`
   - Expected network request: POST with email/password

2. **Observe phase:** Opens site in real browser:
   - Fills email field
   - Fills password field
   - Clicks sign-up button
   - Records: Did the POST request fire? Did we get a response? Did any UI change?

3. **Detect phase:** Compares:
   - Expected: POST to `/api/signup` 
   - Actual: [No request detected]
   → **GAP FOUND**

### Evidence Produced

- Screenshot (before click)
- Screenshot (after click)
- Network activity log (empty - no POST seen)
- Console output (if any errors)
- DOM state before/after
- Execution timeline

---

## Who This Is For

**Good fit:**
- CTOs and engineering leaders who want visibility into public user flows
- Product teams shipping public signup, onboarding, or demo experiences
- QA teams automating smoke tests for critical paths
- Teams integrating into CI/CD as a trust gate before release

**Not a good fit:**
- Production monitoring / APM tools
- Teams that need post-auth flow testing
- Projects with no public flows (internal tools, SaaS dashboards)
- Teams that need dynamic route support (`/user/${id}`)

---

## Version & Stability

**Current version:** 0.5.1 (stable)

**Compatibility guarantees:**
- CLI commands and exit codes remain stable
- Artifact schemas unchanged
- Deterministic, read-only behavior preserved
- Semantic versioning: MAJOR = breaking changes, MINOR = new capabilities, PATCH = fixes/perf

**Deprecation policy:** No silent removals. Deprecated features warn for at least one minor release.

---

## Installation & Usage

**Requirements:** Node.js 18+

```bash
# Install globally
npm install -g @veraxhq/verax

# Or run from source
git clone https://github.com/odavlstudio/verax
cd verax
npm install
npm link
```

**Basic usage:**
```bash
# Scan a site
verax run --url http://localhost:3000

# Inspect results
verax inspect .verax/runs/latest

# Check environment
verax doctor
```

**Full command reference:** Run `verax --help`

---

## Framework Support

| Framework | Learn | Observe |
|-----------|-------|---------|
| Static HTML | ✅ Full | ✅ Full |
| React (react-router-dom) | ✅ Full | ✅ Full |
| Next.js (App & Pages Router) | ✅ Full | ✅ Full (dev), Limited (prod) |
| Vue 3 (Vue Router) | ⚠️ Partial | ⚠️ Partial |
| Angular | ⚠️ Partial | ⚠️ Partial |
| SvelteKit | ⚠️ Partial | ⚠️ Partial |

**Note:** v1 focuses on static HTML, React, and Next.js. Other frameworks have partial support (code extraction only).

---

## Privacy & Security

VERAX automatically redacts secrets and sensitive data:
- API keys
- Auth tokens
- PII (email, phone, SSN patterns)
- Custom redaction rules supported

**Data stays local:** All observations and artifacts are written to your local `.verax` directory. No telemetry. No cloud upload.

---

## Contributing

Issues and PRs welcome. See [CONTRIBUTING.md](CONTRIBUTING.md).

---

## License

MIT. See [LICENSE](LICENSE).
