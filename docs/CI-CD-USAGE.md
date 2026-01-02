# Using Guardian in CI/CD

This document explains how to integrate Guardian into your deployment pipeline. For quick start, see [quickstart/CI_GITHUB_ACTION.md](quickstart/CI_GITHUB_ACTION.md).

---

## High-Level Philosophy

Guardian is designed as a **deployment gate**: a deterministic check that runs before your code reaches production.

Your CI/CD pipeline respects Guardian's exit code:
- **0 (READY)**: Deployment proceeds
- **1 (FRICTION)**: Warn or block based on your policy
- **2 (DO_NOT_LAUNCH)**: Deployment blocked

---

## Integration Pattern

### 1. Run Guardian Before Deploying

Add Guardian to your deployment workflow after building and testing, before pushing to production:

```yaml
# Pseudo-code (adjust for your platform)
jobs:
  deploy:
    steps:
      - name: Build application
        run: npm run build
      
      - name: Run Guardian reality check
        run: guardian reality --url https://staging.example.com
        # If exit code is 2, deployment stops here
      
      - name: Deploy to production
        if: success()  # Only runs if Guardian succeeded
        run: npm run deploy
```

### 2. Interpret the Verdict

After Guardian runs, read the exit code:

```bash
guardian reality --url https://your-site.com
echo $?  # Exit code: 0=READY, 1=FRICTION, 2=DO_NOT_LAUNCH
```

**In your pipeline:**
- Exit 0 → Safe. Proceed with deployment.
- Exit 1 → Issues found. Your policy decides: investigate and fix, or proceed with caution.
- Exit 2 → Critical failure. Block deployment.

### 3. Read the Report

Guardian writes artifacts to `.odavlguardian/<timestamp>/`:

```
.odavlguardian/
└── 2025-12-30T15-22-10Z/
    ├── decision.json      (machine-readable verdict + reasoning)
    ├── summary.md         (human-readable report)
    ├── report.html        (visual report with screenshots)
    └── network-trace.zip  (detailed request logs)
```

**Use decision.json for automated decisions:**

```javascript
const fs = require('fs');
const decision = JSON.parse(fs.readFileSync('decision.json', 'utf8'));

if (decision.finalVerdict === 'DO_NOT_LAUNCH') {
  console.error('Deployment blocked:', decision.reasons);
  process.exit(1);
}
```

---

## Common Policies

### Strict (Recommended for New Integrations)

Block on any DO_NOT_LAUNCH:

```yaml
- name: Guardian Reality Check
  run: guardian reality --url ${{ env.STAGING_URL }}
  # Exit code 2 automatically fails the job
```

### Caution (Mixed Results Acceptable)

Warn but proceed on FRICTION, block on DO_NOT_LAUNCH:

```yaml
- name: Guardian Reality Check
  run: |
    guardian reality --url ${{ env.STAGING_URL }}
    EXIT_CODE=$?
    if [ $EXIT_CODE -eq 2 ]; then
      echo "❌ Critical failure detected"
      exit 1
    elif [ $EXIT_CODE -eq 1 ]; then
      echo "⚠️  Issues detected, proceeding with caution"
    fi
```

### Observational (Log Only)

Run Guardian but never block (use for feedback only):

```yaml
- name: Guardian Reality Check (Observational)
  run: guardian reality --url ${{ env.STAGING_URL }} || true
  continue-on-error: true  # Always succeeds, even on DO_NOT_LAUNCH
```

---

## Best Practices

**Test against staging, not production:**  
Run Guardian against staging/pre-production before actual deployment. This tests your changes safely.

**Run on every pre-deploy check:**  
Guardian should run on every deployment candidate (every merge to main, every release).

**Check artifacts in CI logs:**  
Link to or upload the report and decision.json to your CI logs for visibility.

**Use exit codes programmatically:**  
Build custom logic around Guardian's verdicts if your process requires it.

**Baseline for confidence:**  
On your first integration, run Guardian a few times to understand what verdicts you typically get. This builds confidence in the tool.

---

## Watchdog: Production Monitoring

After deployment, Guardian can monitor production using baseline comparison:

```bash
# Create baseline from known-good state
guardian reality --url https://production.com --baseline create

# Monitor on schedule (e.g., every 5 minutes)
guardian reality --url https://production.com --watchdog
```

Guardian alerts when:
- Verdict downgrades (READY → FRICTION or DO_NOT_LAUNCH)
- Coverage drops by 20% or more
- Previously passing flows start failing

See [Watchdog Concept](WATCHDOG.md) for details.

---

## Troubleshooting

**Guardian hangs or times out:**
Try `--fast` flag for quicker runs on slow sites.

**Unexpected FRICTION verdict:**
Check coverage in decision.json. Low coverage (<70%) triggers FRICTION.

**Exit code not recognized:**
Verify you're reading the correct exit code. Guardian uses 0/1/2. Anything else indicates an error.

**Artifacts not found:**
Check `.odavlguardian/` directory. By default, artifacts are written there.

