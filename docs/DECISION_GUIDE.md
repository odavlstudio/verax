# VERAX — Decision Guide

How to interpret results and decide what to do next

Purpose of This Document

This document explains how to use VERAX results to make decisions.

It does not explain how VERAX works internally.
It does not define new rules or scope.
It does not override CORE or VISION.

Its only purpose is to answer one question:

“I ran VERAX. What should I do now?”

1. Run Outcomes — What They Mean

Every verax run ends in one of four outcomes.

✅ CLEAN (Exit Code 0)

Meaning:

No silent failures were detected

All observed promises produced observable outcomes

What this means (and does not mean):

✔ No evidence of silent user failures

❌ Does NOT guarantee correctness

❌ Does NOT guarantee good UX

❌ Does NOT mean all flows were covered

Recommended action:

Accept the result

Continue development or release

Re-run when code changes or scope expands

❌ FINDINGS DETECTED (Exit Code 1)

Meaning:

At least one silent failure was detected

A user action produced no observable acknowledgment

What this means:

A real user can act and receive no clear feedback

This is a confirmed UX risk, not a theory

Recommended action:

Inspect findings.json

Review evidence (screenshots, logs)

Decide whether to:

fix immediately

accept the risk

defer with awareness

⚠ INCOMPLETE RUN (Exit Code 66)

Meaning:

Observation did not complete

Results are partial

Common reasons:

Browser crash

Timeout

Observation budget exceeded

What this means:

Findings (if any) are real

Absence of findings is NOT meaningful

Recommended action:

Do not treat as safe

Re-run with adjusted timeout or scope

Investigate stability issues if repeated

🚫 INVALID INPUT / TOOL ERROR (Exit Code 64 / 65 / 2)

Meaning:

VERAX could not perform a valid observation

Recommended action:

Fix CLI usage or input

Verify environment with verax doctor

Re-run before making any product decision

2. How to Read a Finding

Each finding describes a gap between promise and observable reality.

Key fields you should look at:
Status

CONFIRMED
Evidence clearly shows a silent failure

SUSPECTED
Partial evidence; observation incomplete or ambiguous

UNPROVEN / INFORMATIONAL
No actionable failure detected

Decision rule:

Treat CONFIRMED as real user risk

Treat SUSPECTED as investigation candidates

Severity

HIGH — blocks or breaks a critical user flow

MEDIUM — visible but non-blocking degradation

LOW — edge case or limited impact

Severity describes impact, not certainty.

Confidence

A numeric score (0–1) reflecting evidence quality, not correctness.

High confidence = strong observation

Low confidence = weak or partial signals

Important:
Low confidence does NOT mean false.
It means interpret cautiously.

Evidence

Evidence answers:

What was expected

What was observed

What signals were present or missing

If there is no evidence, the finding is not CONFIRMED.

3. Common Misinterpretations (Avoid These)

❌ “Zero findings means the site is safe”
→ False. It only means no silent failures were observed.

❌ “Low confidence means ignore it”
→ False. It means investigate with caution.

❌ “Incomplete run with no findings is OK”
→ False. Incomplete means unknown.

❌ “VERAX says my code is wrong”
→ False. VERAX reports observations, not judgments.

4. Typical Decision Patterns
CI / Pull Request

Exit 0 → allow merge

Exit 1 → review findings before merge

Exit 66 → retry or block until clarified

Release Decision

CONFIRMED + HIGH severity → strongly consider fix

MEDIUM / LOW → conscious risk decision

Re-run after fixes to verify silence is resolved

Product Review

Repeated silent failures in same area → structural UX issue

Isolated findings → tactical fixes

5. What VERAX Does NOT Decide

VERAX does not decide:

whether a behavior is acceptable

whether UX is good or bad

whether business logic is correct

whether a release should ship

VERAX provides evidence.
Humans make decisions.

6. Final Reminder

VERAX exists to prevent false certainty.

It makes silence observable.
It does not replace judgment.

When in doubt:

inspect evidence

re-run with care

prefer clarity over assumptions

End of Decision Guide