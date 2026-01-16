# 🛡️ VERAX

A forensic observation engine for real user outcomes

VERAX observes and reports gaps between what your code explicitly promises and what users can actually observe.

Silent user failures don’t crash your site.
They don’t throw errors.
They simply lose users quietly.

VERAX exists to surface those gaps — with evidence, not guesses.

🤔 What is VERAX?

A silent user failure happens when your code clearly implies that something should happen —
but from the user’s point of view, nothing meaningful does.

Concrete examples:

A button click that should navigate… but doesn’t.

A form submission that triggers an API call… but shows no feedback.

A state update that runs in code… but never reaches the UI.

These issues are frustrating for users and notoriously hard for teams to notice.

VERAX reads your source code to understand what is promised, then opens your site in a real browser and experiences it like a user.
When expectations and reality don’t align, VERAX reports the gap clearly and honestly.

VERAX does not guess intent.
It only reports observations backed by explicit code promises.

🧠 Clarification: “Silent failure”

In VERAX, a silent failure is not a judgment about correctness.

It means:

For a promised interaction (for example, a click expected to navigate or save),
no observable, user-visible effect could be verified
(no URL change, no network request, no feedback).

This does not mean your code is wrong.
It means the observation produced no verifiable effect for the promise being evaluated.

✅ What VERAX does (today)

🔍 Observes and reports gaps between code promises and user-visible outcomes
(by comparing code-derived expectations with real browser behavior)

🧠 Extracts expectations from source code using static analysis:

Navigation from HTML links, React Router, Vue Router, and Next.js routes

Network actions from fetch / axios calls with static URLs

State mutations from React useState, Redux, Vuex, Pinia, Zustand set operations

🖱️ Observes websites like a real user using Playwright
(clicks, forms, navigation, scrolling)

📊 Assigns confidence levels (HIGH / MEDIUM / LOW) based on evidence strength and coverage

🧾 Provides concrete evidence for every reported discrepancy:

Screenshots

Network activity

Console logs

DOM and state changes

💻 Runs as a CLI tool via `verax run` (and inspects results with `verax inspect`)

🧱 Supports real-world projects:

**Fully verified (production-ready):**
- Static HTML sites
- React SPAs (with react-router-dom)

**Supported (learn-only / partial observation):**
- Next.js (App Router & Pages Router)
- Vue.js (with Vue Router)
- Angular
- SvelteKit

🔐 Protects privacy by automatically redacting secrets and sensitive data

🚫 What VERAX does NOT do

❌ Does not guess intent — no heuristics, no assumptions

❌ Does not support dynamic routes (e.g. /user/${id} is intentionally skipped)

❌ Does not replace QA or tests — it complements them

❌ Does not monitor production traffic

❌ Does not work for every framework

❌ Does not detect every bug — only gaps backed by explicit code promises

❌ Does not use AI — all results are deterministic and explainable

🔄 How VERAX works (high-level)

VERAX runs three phases automatically:

1) **Learn**
Analyze source code to derive explicit, proven expectations
(routes, static network actions, state changes).

2) **Observe**
Open the site in a real browser and execute user interactions safely,
recording what actually happens.

3) **Detect**
Compare code-derived expectations with observed outcomes and report:
- Discrepancies
- Coverage gaps
- Unknowns
- Safety blocks

All with evidence.

📦 Installation

Requirements: Node.js 18+

From npm:

npm install -g @veraxhq/verax

From source:

git clone <repository-url>
cd verax
npm install
npm link

## Commands

VERAX provides these CLI commands:

- `verax` — Interactive mode (detects URL or prompts for it)
- `verax run --url <url> [--src <path>] [--out <path>]` — Non-interactive CI mode (strict, explicit)
- `verax inspect <runPath>` — Inspect results from a previous run
- `verax doctor [--json]` — Verify environment (Node, Playwright, Chromium binary)
- `verax --version` — Show CLI version
- `verax --help` — Show help text

## Examples

Run a non-interactive scan (ideal for CI):

```bash
verax run --url http://localhost:3000 --src . --out .verax
```

Run interactive mode (default auto-detection):

```bash
verax
```

Check environment readiness:

```bash
verax doctor --json
```

Inspect a previous run:

```bash
verax inspect .verax/runs/2026-01-11T12-34-56Z_abc123
```

📁 Output (CI-friendly)

Run a scan:

```bash
verax run --url http://localhost:3000 --src . --out .verax
```

Artifacts are written to:

`.verax/runs/<runId>/`

Including:

- `summary.json` — overall observation summary with digest counts
- `findings.json` — reported discrepancies with evidence
- `learn.json` — code-derived expectations
- `observe.json` — browser observations and outcomes
- `evidence/` — screenshots and logs

🚦 Exit codes (tool-only semantics)

Exit codes reflect tool execution status only.
They do not represent site quality or correctness and must not be used as a pass/fail gate without explicit user logic.

0 — VERAX executed successfully (regardless of findings, gaps, or confidence)

2 — Tool crashed or failed internally

64 — Invalid CLI usage (missing args, invalid flags)

65 — Invalid input data (e.g. malformed JSON, unreadable manifest)

📊 Reading results (observer-first)

Each reported discrepancy includes:

Promise context: navigation, network action, state change, feedback

Outcome classification: silent failure, coverage gap, unproven interaction, safety block, informational

Evidence: screenshots, network artifacts, console logs, trace references

Confidence: coverage ratio and silence impact

Confidence (observer truth)

Confidence reflects the quality and completeness of observation,
not the quality or correctness of the site.

HIGH (≥80) — strong evidence and coverage; observations are reliable

MEDIUM (60–79) — likely discrepancy with some ambiguity

LOW (<60) — weak or partial evidence; interpret cautiously

🧭 When VERAX is a good fit

SaaS signup and pricing flows

React and Next.js projects

CI pipelines that need UX reality checks

Teams that value evidence over assumptions

🚫 When VERAX is NOT a good fit

Internal admin dashboards

Authentication-heavy systems

Apps built around highly dynamic routing

Unsupported frameworks

Teams expecting a full QA replacement

🧪 Project status

VERAX is a production-grade CLI tool in active development.
It is designed for early adopters and technical teams.

VERAX is not a SaaS product.
It runs locally or in CI. There is no hosted service.

⚠ Important

VERAX does not certify correctness.
Zero findings do not mean a site is safe.

VERAX exists to prevent false certainty, not to grant confidence.
Use the Decision Snapshot and evidence to make a human judgment.

📄 License

MIT
