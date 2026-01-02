# PRIMARY_USER: CI/CD Pipeline Operator

## Persona Title
**Release Engineer / DevOps operator / Deployment pipeline maintainer**  
(Responsible for gating production deployments based on safety criteria)

---

## Five Bullet Facts About This User

1. **They control the deployment pipeline** — They decide if a commit passes to production or gets blocked. Guardian verdict (READY/DO_NOT_LAUNCH) is an input to their gate logic.

2. **They need deterministic, machine-readable verdicts** — Not human opinions. Not "probably okay." Yes/no answers with exit codes (0=READY, 1=FRICTION, 2=DO_NOT_LAUNCH).

3. **They want to integrate Guardian into their existing CI/CD system** — GitHub Actions, GitLab CI, Bitbucket, Jenkins, etc. GitHub Action ([action.yml](../../action.yml)) is explicitly designed for them.

4. **They need to know what failed and why** — To understand if they should retry, fix the site, or investigate further. Guardian provides decision.json with reasons, not just exit codes.

5. **They run Guardian on every deployment candidate, not just once** — Multiple runs per day/week across different URLs and presets. Plan-based rate limiting exists ([src/plans/plan-definitions.js](../../src/plans/plan-definitions.js)) because this user runs frequent scans.

---

## Evidence Section

### Direct evidence: GitHub Action as primary interface

From [action.yml](../../action.yml):
```yaml
inputs:
  url: "Target URL to evaluate (e.g., https://example.com)"
  preset: "Guardian preset (e.g., landing)"
  fail-on: "Failure policy for verdicts: none | friction | risk | any"
  
outputs:
  verdict: "Final Guardian verdict (READY | FRICTION | DO_NOT_LAUNCH)"
  exit-code: "Guardian exit code"
  run-id: "Guardian run identifier"
```

**Why this is primary evidence:** The action.yml explicitly defines machine-readable inputs/outputs, deterministic exit codes, and a "fail-on" policy. This is CI/CD language, not developer language.

### Exit code determinism (built for CI/CD)

From [src/guardian/verdicts.js](../../src/guardian/verdicts.js):
```javascript
// Canonical verdict mapping → exit codes
READY → 0 (deployment allowed)
FRICTION → 1 (investigate, likely blocked in pipeline)
DO_NOT_LAUNCH → 2 (deployment blocked)
```

From [README.md](../../README.md):
> "Guardian runs. Guardian decides. Your pipeline listens."

**Why this matters:** Exit codes are the language of shell scripts and CI systems. No other user persona cares about exit code semantics; pipeline operators build on them.

### Plan-based rate limiting targets CI/CD users

From [src/plans/plan-definitions.js](../../src/plans/plan-definitions.js):
```javascript
FREE: { maxScansPerMonth: 10 },
PRO: { maxScansPerMonth: 200, ciModeAllowed: true },
BUSINESS: { maxScansPerMonth: -1 } // unlimited
```

**Why this matters:** Rate limiting by "scans per month" assumes frequent, repeated runs. Solo developers don't run 200 scans/month; pipelines do (multiple PRs/deployments daily).

### CI mode output format

From [src/guardian/ci-mode.js](../../src/guardian/ci-mode.js):
> "Explicit CI/CD output mode" with formatted summary and verdict-first output

**Why this matters:** A dedicated "CI mode" wouldn't exist if CI/CD operators weren't primary.

### Decision.json as machine-readable artifact

From [samples/decision.json](../../samples/decision.json):
```json
{
  "finalVerdict": "READY",
  "exitCode": 0,
  "runId": "2025-12-29_00-08-23_example-com_custom_PENDING",
  "resolved": { ... machine-readable structures ... }
}
```

**Why this matters:** Pipeline operators parse decision.json to extract verdict, rules, evidence. Humans don't read JSON reports; tools do.

### Secondary confirmation: Pre-launch gating is the core use-case

From [PRODUCT_IDENTITY.md](../../PRODUCT_IDENTITY.md):
> "Lifecycle: Before launch: deployment gate"

From [docs/PRODUCT.md](../PRODUCT.md):
> "Pre-launch gating: Run Guardian before deploying to production. If verdict is DO_NOT_LAUNCH, block the deployment."

**Why this matters:** "Deployment gate" = pipeline gate. That's a CI/CD operator's job.

---

## Why This User Over Others?

| User Persona | Evidence of Support | Primary or Secondary? |
|--------------|--------------------|-----------------------|
| **CI/CD Operator** | GitHub Action, exit codes, rate limiting, deterministic verdicts, CI mode output | **PRIMARY** ← designed for this |
| Startup Founder | Simplified "startup" preset, founder tracking | Secondary (convenience layer) |
| Developer | VS Code Extension, local CLI | Secondary (IDE convenience) |
| Enterprise | RBAC, audit logging, PDF export | Secondary (governance layer) |
| Real user | Implicit: flows tested are user-centric | Implicit (not a user persona, but the focus) |

**Justification:** The entire architecture is optimized for pipeline integration (exit codes, rate limiting, GitHub Action, CI mode, decision.json). Startups use Guardian, but Guardian was designed to fit into deployment pipelines, not to be a primary user interface.

---

## Validation

- **Is this a real user in the repo evidence?** Yes. GitHub Action, exit codes, and CI mode are explicitly for pipeline operators.
- **Is this the ONLY primary user?** Yes. All other personas use Guardian, but this is the persona the product was architected for.
- **Could developers be primary instead?** No. The VS Code Extension is optional; the GitHub Action is essential.
- **Could founders be primary instead?** No. Founder tracking (Phase 10) is explicit add-on feature, not core architecture.

---

**Clarity score:** 9/10  
**Ambiguities remaining:** One minor ambiguity: "Release Engineer," "DevOps operator," and "Deployment pipeline maintainer" are slightly different roles, but they all share the same primary need (safe deployment gating via CI/CD). The persona is accurate but captures a broad role family rather than a single title.
