# Doctor Error — Canonical Reference

## What Doctor Error Is
- Single-purpose error analyst that turns a raw error into a Diagnosis Tree and a concrete Fix Path.
- Opinionated assistant for engineers who already own their codebase and can execute fixes.
- Produces structured, bounded outputs that can be fed to automation or shown to humans.
- Optimized for speed, clarity, and actionability over narration.

## What Doctor Error Is NOT
- Not an IDE, debugger, log shipper, profiler, tracer, observability suite, or general chatbot.
- Not a code generator or pair-programmer; it does not modify code for you.
- Not a postmortem writer or RCA narrator; it stays tactical and current.
- Not a compliance, security, or governance tool.

## Vision
Deliver the fastest path from “mysterious error” to “confident, verified fix” through a concise diagnosis tree and prescriptive fix steps.

## Target Audience
- Professional engineers shipping and operating JS/TS services, CLIs, and frontends.
- SREs and incident responders who need crisp, automatable diagnostics.
- Tooling teams embedding structured error intelligence into workflows.

## Core Idea
Error → Diagnosis Tree (ranked causes, questions, quick checks) → Fix Path (Quick Fix, Best Fix, Verify).

## Golden Rule
Every output must be specific, reproducible, and immediately actionable; no speculation without a suggested check.

## Boundaries
- Works only with provided error context; never invents stack frames or code paths.
- Limits to English language and JS/TS domain examples unless explicitly expanded.
- Max two diagnostic questions per error; prefers direct checks when confidence is high.
- Safety notes stay minimal and concrete (e.g., data loss risk, downtime impact).

## Success Definition
A user can: (1) match the error via `errorSignature`, (2) see a ranked list of likely causes, (3) run at least one quick check, (4) follow a Fix Path to resolution, and (5) verify the fix—all without additional clarification.

## Do / Don’t
- Do keep outputs within the contract and length limits.
- Do prefer deterministic checks (logs, env vars, feature flags, versions) over speculation.
- Do show both a quick mitigation and a durable best fix when they differ.
- Do flag safety-sensitive actions with a brief note.
- Don’t output placeholders, open questions without choices, or generic advice.
- Don’t restate the full stack trace; extract the signal and move to actions.
- Don’t mix unrelated domains (stay with the provided error and its code surface).

## Free vs Pro
Doctor Error offers a Free tier for quick triage and a Pro upgrade for comprehensive resolution guidance.

| Feature                     | Free                          | Pro                                    |
|-----------------------------|-------------------------------|----------------------------------------|
| Error matching & confidence | ✓ Full                        | ✓ Full                                 |
| Causes                      | Top 1 cause only              | All ranked causes (2-5)                |
| Diagnostic questions        | —                             | ✓ When relevant (0-2)                  |
| Quick Fix                   | ✓ (max 2 steps)               | ✓ Full steps (1-6)                     |
| Best Fix                    | —                             | ✓ Durable resolution (1-6 steps)       |
| Verify steps                | —                             | ✓ Observable checks (1-4 steps)        |
| Copy buttons                | JSON, Quick Fix               | JSON, Quick Fix, Best Fix              |

**How Pro works:**
- One-time payment via Stripe (test mode for now).
- After checkout, you receive a Pro token stored locally.
- Pro features unlock immediately; token persists across sessions.
- No accounts system yet; simple token-based access.

## Web UI (MVP) — How to Run
- Install deps: `npm install`
- Start web UI: `npm run dev` (serves on http://localhost:3000)
- Use the page: paste an error, click Diagnose; copy JSON or Quick Fix from the results card.

**Run with Stripe test mode (for Pro unlock):**
- Set env: `STRIPE_SECRET_KEY=sk_test_your_key_here`
- Start: `STRIPE_SECRET_KEY=sk_test_your_key npm run dev`
- Click "Unlock Pro" to test checkout flow (use Stripe test card: 4242 4242 4242 4242).
- After checkout, Pro features activate automatically.

## Production Setup
- Required env vars (fail-fast on startup):
	- `STRIPE_SECRET_KEY` (test or live secret key, e.g., `sk_test_...` or `sk_live_...`)
	- `NODE_ENV` (`production` for live deployments)
	- `PORT` (optional, defaults to 3000)
- Start server: `NODE_ENV=production STRIPE_SECRET_KEY=sk_live_xxx PORT=3000 npm run dev`
- Stripe test → live: replace test key with `sk_live_...`; checkout flow is identical.
- Never commit secrets; use environment injection (CI/CD secrets, .env not tracked).

## Production Checklist
- [ ] Env vars set: `STRIPE_SECRET_KEY`, `NODE_ENV`, optional `PORT`
- [ ] Server boots without startup warnings or missing-env errors
- [ ] Stripe checkout creates session successfully (test or live key)
- [ ] Pro unlock works after payment (URL contains `?pro=...` and UI shows Pro active)

## Feedback Loop
Doctor Error collects minimal, anonymous feedback to improve diagnosis accuracy over time. This loop is optional, privacy-respecting, and designed to help us refine Error Packs without tracking users.

**What we collect:**
- `errorSignature`: the matched signature (e.g., "Cannot read properties of undefined")
- `errorTitle`: the diagnosis title
- `isPro`: whether the user was using Free or Pro
- `outcome`: "worked" or "didnt_work"
- `timestamp`: when feedback was submitted

**What we do NOT collect:**
- No personal identifiers (names, emails, IPs)
- No full error text or stack traces
- No user behavior tracking beyond the single feedback event

**Why it matters:**
Feedback helps us identify which signatures need refinement, which causes resonate with users, and where Pro features deliver the most value. Over time, this data informs new Error Packs and improved matching rules.

**How it works:**
1. After a diagnosis renders, you'll see two buttons: "✓ Worked" and "✗ Didn't work"
2. Click one to submit feedback (optional)
3. If you click "Didn't work," you'll see next steps like pasting the full stack trace or checking secondary causes
4. Feedback is stored locally in `/data/feedback.log` (JSON lines format)
5. Dev-only stats endpoint at `/api/feedback/stats` shows aggregated counts by signature and outcome

**Privacy commitment:**
- Feedback is fully anonymous
- No third-party analytics or trackers
- Data stays local to your deployment (no external services)
- You can disable feedback by removing the buttons from the UI

