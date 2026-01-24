# 🛡️ VERAX

[![VERAX CI](https://github.com/odavlstudio/verax/actions/workflows/verax.yml/badge.svg)](https://github.com/odavlstudio/verax/actions/workflows/verax.yml)
[![npm version](https://img.shields.io/npm/v/@veraxhq/verax.svg)](https://www.npmjs.com/package/@veraxhq/verax)
[![stability: stable](https://img.shields.io/badge/stability-stable-green.svg)](https://github.com/odavlstudio/verax/blob/main/src/version.js)
[![license: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](https://github.com/odavlstudio/verax/blob/main/LICENSE)

Release & Upgrade Safety (10s read)
- Current version: 0.5.1 (stable). Semantic versioning: MAJOR = CLI/exit code/artifact schema breaks; MINOR = new capabilities; PATCH = fixes/perf/tests. Source: [src/version.js](src/version.js).
- Compatibility guarantees: CLI commands and exit codes stay stable; artifact schemas unchanged; deterministic, read-only, zero-config behavior preserved.
- Deprecation policy: No silent removals. Deprecated flags warn for at least one minor release before removal.
- Release gate: npm publish blocked unless version bumped, changelog (json + markdown) updated, tests pass, and git is clean ([scripts/prepublish-check.js](scripts/prepublish-check.js)).

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

VERAX provides 10 CLI commands organized by purpose. See [docs/PHASES.md](docs/PHASES.md) for feature maturity and stability information.

### Core Observation Commands (Always Production-Ready)

These commands perform forensic observation of your applications and are fully stable (Phase 5).

#### `verax run --url <url> [options]`

**Purpose**: Execute the primary forensic observation scan

**Usage**:
```bash
verax run --url http://localhost:3000 --src . --out .verax
```

**Common options**:
- `--src <path>` — Source code root (default: current directory)
- `--out <path>` — Output directory for artifacts (default: `.verax`)
- `--profile <profile>` — Scan profile: `standard` or `strict` (default: `standard`)
- `--json` — JSON-only output (suppress console summary)
- `[--auth-*]` — Authentication options (storage, cookies, headers)

**Output**: Generates `.verax/runs/<runId>/` with findings, evidence, and logs

---

#### `verax inspect <runPath> [options]`

**Purpose**: Inspect and analyze results from a previous run

**Usage**:
```bash
verax inspect .verax/runs/2026-01-11T12-34-56Z_abc123
verax inspect .verax/runs/latest  # Inspect most recent run
```

**Common options**:
- `--compare <otherRunPath>` — Compare findings across runs
- `--json` — JSON output only

**Output**: Detailed report with findings, evidence locations, and comparisons

---

#### `verax doctor [--json]`

**Purpose**: Verify environment readiness (Node.js, Playwright, Chromium)

**Usage**:
```bash
verax doctor
verax doctor --json  # Machine-readable output
```

**Output**: Environment diagnostics and readiness status

**Exit codes**:
- `0` — Environment ready for VERAX
- `1` — Issues detected (Playwright, Chromium, or other dependencies missing)

---

### Advanced Analysis Commands (Phase 5 · Production-Ready)

These commands provide deeper post-hoc analysis based on run artifacts.

#### `verax diagnose <runId> [--json]`

**Purpose**: Generate post-hoc diagnostics explaining HOW and WHY a run behaved as it did

**Usage**:
```bash
verax diagnose 2026-01-11T12-34-56Z_abc123
verax diagnose .verax/runs/2026-01-11T12-34-56Z_abc123
```

**Output**: Diagnostics report explaining run behavior, decision-making, and any anomalies

---

#### `verax explain <runId> <findingId> [--json]`

**Purpose**: Deep-dive explanation for a specific finding

**Usage**:
```bash
verax explain 2026-01-11T12-34-56Z_abc123 finding-001
```

**Output**: Finding details with evidence chains, confidence reasoning, and context

---

#### `verax stability <runId> [--json]`

**Purpose**: Analyze stability metrics for a single run

**Usage**:
```bash
verax stability 2026-01-11T12-34-56Z_abc123
```

**Output**: Stability analysis, coverage metrics, and reliability indicators

---

#### `verax triage <runId> [--json]`

**Purpose**: Generate incident triage report with action plan

**Usage**:
```bash
verax triage 2026-01-11T12-34-56Z_abc123
```

**Output**: Triage report with prioritized findings and recommended actions

---

### Enterprise & CI Commands (Phase 5 · Production-Ready)

These commands automate release decisions and run management.

#### `verax stability-run --url <url> --repeat <N> [--mode ci|standard] [--json]`

**Purpose**: Execute batch stability testing (multiple iterations) to measure consistency

**Usage**:
```bash
verax stability-run --url http://localhost:3000 --repeat 5
verax stability-run --url http://localhost:3000 --repeat 10 --mode ci
```

**Options**:
- `--repeat <N>` — Number of iterations (minimum 2, recommended 5–10)
- `--mode ci` — CI mode (fast, fewer observations); default: `standard`
- `--json` — JSON output only

**Output**: Batch stability report with consistency metrics across all runs

---

#### `verax gate --url <url> [options]`

**Purpose**: CI release gate — runs a scan and generates pass/fail decision for automated deployment

**Usage**:
```bash
verax gate --url http://staging.example.com
verax gate --url http://prod.example.com --profile strict
```

**Options**:
- `--profile <profile>` — Scan profile (default: `standard`)
- `--json` — JSON gate report only

**Exit codes**:
- `0` — Gate decision passed; safe to deploy
- `1` — Gate decision failed or warnings present
- `2` — Internal crash

**Use case**: Integrate into CI/CD pipelines to prevent releasing with known silent failures

---

#### `verax clean [--dry-run] [--keep-last N] [--older-than-days N]`

**Purpose**: Run retention and hygiene — manage `.verax/runs/` storage

**Usage**:
```bash
verax clean --dry-run                    # Preview what would be deleted
verax clean --keep-last 10               # Keep latest 10 runs, delete rest
verax clean --older-than-days 30         # Delete runs older than 30 days
verax clean --allow-delete-confirmed     # Actually delete (default: dry-run only)
```

**Default behavior**: Dry-run (shows what would be deleted without making changes)

**Safety**: Defaults to safe dry-run mode; explicit `--allow-delete-confirmed` required for actual deletion

---

### Help & Version

#### `verax --help`

Show all available commands and options

#### `verax --version`

Show installed VERAX version

---

## Command Examples

### Basic Scan

```bash
verax run --url http://localhost:3000
```

### CI/CD Integration (Release Gate)

```bash
#!/bin/bash
verax gate --url http://staging.example.com
if [ $? -eq 0 ]; then
  deploy_to_production
else
  echo "Gate failed; deployment blocked"
  exit 1
fi
```

### Stability Testing

```bash
verax stability-run --url http://localhost:3000 --repeat 5
```

### Run Inspection & Comparison

```bash
# Inspect latest run
verax inspect .verax/runs/latest

# Compare two runs
verax inspect .verax/runs/2026-01-11T12-34-56Z_abc123 \
  --compare .verax/runs/2026-01-11T13-45-00Z_def456
```

### Deep Diagnostics

```bash
# Run initial scan
verax run --url http://localhost:3000

# Get diagnostics
verax diagnose latest

# Explain a specific finding
verax explain latest finding-001

# Triage findings with action plan
verax triage latest
```

### Cleanup

```bash
# Preview cleanup
verax clean --keep-last 10 --dry-run

# Actually delete old runs
verax clean --keep-last 10 --allow-delete-confirmed
```

---

## Feature Stability

**Phase 5 (Stable & Production-Ready)**: All commands above are fully tested and safe for production use.

**Phase 6A (Experimental)**: Additional security and integrity features coming in Phase 6A are not yet production-ready.

See [docs/PHASES.md](docs/PHASES.md) for detailed feature maturity information.

---

## Removed Features

Interactive prompt mode (`verax` without arguments) was removed in VERAX 0.4.x.

Use explicit command-line arguments instead (CI-friendly, auditible):
```bash
verax run --url http://localhost:3000 --src . --out .verax
```

See [docs/REMOVED_FEATURES.md](docs/REMOVED_FEATURES.md) for migration guidance on other deprecated commands.

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

| Exit Code | Meaning |
|-----------|---------|
| **0**  | SUCCESS — no actionable findings |
| **10** | NEEDS_REVIEW — suspected findings present |
| **20** | FAILURE_CONFIRMED — confirmed findings present |
| **30** | FAILURE_INCOMPLETE — incomplete or coverage-short run |
| **40** | INFRA_FAILURE — runtime/crash/invariant failure |
| **50** | EVIDENCE_LAW_VIOLATION — corrupted/missing artifacts |
| **64** | USAGE_ERROR — invalid CLI usage |

## CI Gates (Optional)

- Gate metadata (gate outcome, decision usefulness, evidence quality, preview) is always produced for transparency.
- Enforcement is **off by default**. Exit codes and behavior remain unchanged unless you explicitly opt in.
- Opt-in requires `VERAX_ENFORCE_GATES=1` plus a policy file at `.verax/gates.policy.json` with `enforcement.enabled: true`.
- See [docs/gates.md](docs/gates.md) for policy structure, safety notes, and CI examples.

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
