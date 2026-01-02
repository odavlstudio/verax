# Understanding Guardian Verdicts

This document explains Guardian's three canonical verdicts in detail. For a quick summary, see [README.md](../README.md#verdict-model).

---

## READY (Exit Code 0)

**Meaning:** All critical user flows completed successfully without failure. Safe to deploy.

**When it happens:**
- All executed user flows succeeded
- No critical failures or blocks detected
- Coverage of intended flows is adequate (≥70%)
- Network security signals show no blocking warnings

**What Guardian observed:**
- Users can navigate critical pages
- Forms submit successfully
- Checkout, signup, or login flows complete
- No timeouts or element-not-found errors

**Your action:** Deploy with confidence.

**Example:** E-commerce site—all product pages load, add-to-cart works, checkout completes successfully.

---

## FRICTION (Exit Code 1)

**Meaning:** Some user flows experienced issues (incomplete execution, slow responses, partial failures), but no single critical flow is completely broken. Proceed with caution.

**When it happens:**
- Some flows succeeded, others encountered problems that didn't block completion
- Coverage is below 70%, indicating incomplete testing
- Network warnings are present but not blocking
- Static sites (read-only, no interactive flows) trigger this as limited coverage

**What Guardian observed:**
- User flows had mixed outcomes (some pass, some don't)
- Tests didn't cover all intended user interactions
- Pages load but some interactions are slow or inconsistent
- No complete flow failure, but significant friction detected

**Your action:** Review findings and decide whether to deploy. Most teams fix issues first.

**Example:** User can complete signup, but confirmation email arrives after 30 seconds (slow but works).

---

## DO_NOT_LAUNCH (Exit Code 2)

**Meaning:** One or more critical user flows are completely broken or blocked. Deployment is prevented.

**When it happens:**
- A critical flow (checkout, signup, login, navigation) completely failed
- Site is unreachable or discovery completely failed
- Network security blocks the flow (HTTP on checkout, etc.)
- Evidence is insufficient to declare safety

**What Guardian observed:**
- Critical user flow execution halted
- Required element not found or not clickable
- Flow timed out or returned error
- Site itself is broken (unable to navigate to initial state)

**Your action:** Fix the broken flow and rerun Guardian.

**Example:** User cannot click checkout button (element doesn't exist or is blocked by modal).

---

## How Coverage Affects Verdicts

Guardian requires **70% coverage** of discovered interactive flows to declare READY.

- **Coverage ≥70%**: Verdicts are READY or DO_NOT_LAUNCH (sufficient evidence)
- **Coverage <70%**: READY candidate is downgraded to FRICTION (incomplete testing)
- **Coverage 0% (static site)**: FRICTION (not a launch blocker, but limited coverage)

---

## Golden Path: Static Sites

For read-only websites (landing pages, documentation, blogs):
- **No interactive flows** = Coverage 0%
- **Verdict**: FRICTION (not a blocker, just acknowledges limited testing)
- **Action**: Safe to deploy

This differs from DO_NOT_LAUNCH, which occurs when a flow *should* work but is broken.

---

## Verdict Hierarchy

When multiple flows are tested, Guardian uses this hierarchy:

1. **DO_NOT_LAUNCH** (worst) — At least one critical flow failed
2. **FRICTION** — Mixed outcomes or insufficient coverage
3. **READY** (best) — All flows succeeded

Worse verdicts take precedence. A single DO_NOT_LAUNCH overrides multiple READYs.

