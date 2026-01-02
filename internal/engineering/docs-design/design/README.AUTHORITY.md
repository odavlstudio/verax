# ODAVL Guardian

## The Final Decision Before Launch

ODAVL Guardian is the final authority that decides
whether a website or digital product is safe to go live.

It observes your website as real users experience it.

Not based on tests.
Not based on assumptions.
Based on real user reality.

## What Guardian Decides

“Will launching this now harm real users or the business?”

If the answer is uncertain, Guardian stops the launch.

## How Guardian Is Used

- Before launch: blocks deployment when reality is broken
- After launch: monitors production and alerts when reality breaks

## Verdicts (Non-Negotiable)

- READY → Users can complete their critical goals. Safe to deploy.
- FRICTION → investigate before proceeding
- DO_NOT_LAUNCH → launch blocked

Guardian verdicts cannot be overridden.

## What Guardian Is Not

- Not a testing tool
- Not a bug scanner
- Not a QA replacement
- Not configurable to force approval

## The Ethical Rule

Guardian never allows READY
if it cannot defend that decision
to a real human user.

## Quick Start (Minimal)

```bash
guardian reality --url https://example.com
```

Guardian runs.
Guardian decides.
Your pipeline listens.

## When Guardian Says No

- You fix reality
- You rerun Guardian
- Only then can launch proceed
