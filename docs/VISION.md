VERAX — Vision 1.0

Silent User Failure Detection for the Web

1. What VERAX Is

VERAX is a read-only, evidence-driven system that joins any web application,
understands its observable technical promises,
executes real user interactions,
and reveals Silent Failures — moments where the application promised something,
the user acted,
and nothing clearly happened.

VERAX exists to expose the truth gap between
what the code and UI promise
and
what users actually experience.

2. The Core Problem

Most user losses do not happen because of visible crashes or server errors.

They happen when a user:

clicks a button

submits a form

attempts to continue a critical flow

tries to complete an important action

and receives no clear feedback:

no navigation

no message

no visible state change

no explanation

These failures:

do not appear in logs

do not fail automated tests

do not break servers

often remain invisible

This class of failures is called Silent Failures.

Silent Failures silently destroy conversion, trust, and revenue.

VERAX was created to detect them before users leave.

3. What VERAX Actually Understands

VERAX does not understand:

business intent

product strategy

user personas

design opinions

VERAX understands only one thing:

Explicit technical promises observable in the code and UI.

This includes:

navigation intent (links, routing, redirects)

form submission behavior

validation and error signaling

visible state transitions (state → UI)

feedback indicators (messages, spinners, confirmations)

basic user interaction contracts

VERAX asks a single question:

“Based on this code and UI, what should a reasonable user expect to happen?”

VERAX evaluates what should happen,
not why the code was written this way.

4. How VERAX Operates

VERAX operates through three immutable steps:

1. Promise Extraction

VERAX analyzes the application to derive explicit, observable promises made to the user through the UI and code structure.

2. Real Interaction Execution

VERAX interacts with the application as a rational, realistic user would —
without guessing intent, inventing scenarios, or forcing behavior.

3. Promise vs Reality Comparison

If a promise exists, the user acts, and no clear outcome is observable,
VERAX records a Silent Failure.

No promise → no expectation → no finding.

5. Evidence Is the Supreme Authority

VERAX is an evidence system, not an opinion engine.

No evidence → no finding

Weak evidence → low confidence

Conflicting signals → explicit uncertainty

Every Silent Failure must be supported by:

observable UI state

before/after artifacts

verifiable runtime signals

VERAX never reports assumptions.
VERAX reports provable reality.

6. Determinism Over Intelligence

VERAX prioritizes determinism over perceived intelligence.

Given:

the same application

the same state

the same interaction

VERAX must produce the same outcome.

Predictability, reproducibility, and forensic clarity are more important than speculative intelligence.

7. Silence Is a First-Class Signal

The absence of feedback is not neutral.

Silence includes:

no UI change

no navigation

no message

no visible acknowledgment

If the user acts and silence follows,
VERAX treats that silence as meaningful data.

Silence is evidence.

8. Global Adoption Principle — Works on Any Repo

VERAX is designed so that any company with a web application repository
can run it with minimal effort and receive immediate, actionable value.

VERAX:

does not require code changes

does not impose conventions

does not demand explanations

The project never adapts to VERAX.
VERAX adapts to the project.

9. 90% Web Reality Coverage

VERAX is built to be useful for more than 90% of modern web applications.

This is achieved not by duplicating framework logic,
but by understanding shared, observable web patterns.

Framework support is an outcome — not a strategy.

The strategy is to observe universal browser reality:
DOM behavior, navigation, rendering, network effects, and user-visible feedback.

10. Framework-Agnostic by Design

VERAX does not rely on:

framework plugins

SDKs

framework-specific adapters

VERAX understands applications through common web interaction patterns,
allowing it to operate across most modern stacks without coupling.

Frameworks change.
Reality does not.

11. Read-Only by Nature (With Management Exceptions)

VERAX is strictly observational with respect to analyzed applications:

It:

never mutates analyzed application state

never applies fixes to application code

never patches code or behavior

never enforces behavior on target sites

VERAX reports reality.
Decisions remain human.

### Management Commands Exception

VERAX management commands (`clean`, `gate`) may modify VERAX-generated artifacts and reports, but never modify the analyzed application:

- **`verax clean`** — Deletes old VERAX run artifacts (`.verax/runs/`) for storage management. Defaults to dry-run; requires explicit `--allow-delete-confirmed` to actually delete.
- **`verax gate`** — Analyzes a run and generates a pass/fail decision report. Does not modify the target application; only produces a gate report for CI systems.

These management commands are opt-in and exist to support enterprise automation. They do not violate the "read-only with respect to analyzed applications" contract.

12. Operational Definition of Silent Failure

A Silent Failure occurs when:

A technical promise exists

The user performs the expected action

The application produces no observable acknowledgment

No success, error, redirect, or explanation is provided

Promise → Action → No Acknowledgment → No Explanation = Silent Failure

Observable acknowledgment may include:

navigation or route change

success or error messaging

visible state updates

loading indicators that resolve meaningfully

validation feedback or focus changes

13. Silent Failure Classes

VERAX detects Silent Failures across common categories, including:

Dead Interactions — clicks that do nothing

Silent Submissions — forms with no success or error feedback

Broken Navigation Promises — implied navigation that never occurs

Invisible State Failures — backend actions without UI reflection

Stuck or Phantom Loading — loading without outcome

Silent Permission Walls — blocked actions without explanation

Render Failures — state changes without visible re-render

14. What VERAX Delivers to Teams

For each Silent Failure, VERAX provides:

the exact interaction location

the expected user outcome

the observed reality

clear before/after evidence

an honest confidence score

impact framing in user terms

VERAX does not output vague judgments.
VERAX outputs accountability with evidence.

15. Zero Configuration by Default

Zero configuration is a design principle.

VERAX works out-of-the-box in the common case.

Optional configuration exists only to:

narrow scope

provide authentication context

integrate with CI workflows

VERAX never requires teams to rewrite their application.

16. Not Coverage-Driven

VERAX does not aim for total interaction coverage.

It aims for meaningful interaction accountability.

Interactions without a clear promise or user impact are outside VERAX’s scope.

17. Never a Gatekeeper by Default

VERAX informs decisions — it does not block delivery.

By default:

no hard failures

no forced pipeline blocks

no automated judgment authority

VERAX provides clarity, confidence, and evidence.
The decision belongs to people.

18. What VERAX Will Never Be

VERAX will never:

guess user intent

derive business logic

evaluate UX subjectively

compare applications to others

replace QA, analytics, or product judgment

claim completeness or perfection

19. Measure of Success

VERAX is successful when it:

runs on most web repositories with minimal effort

understands common interaction patterns across stacks

reveals the majority of provable Silent Failures

reduces internal debate about “is this a real problem?”

provides evidence strong enough to act upon

20. The Final Truth

Silent Failures are the most dangerous failures
because they are invisible.

VERAX exists to make silence observable —
and truth undeniable.