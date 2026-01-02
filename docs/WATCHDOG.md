# Watchdog Mode: Production Monitoring

This document explains how to monitor production after deploying using Guardian's watchdog mode.

---

## Concept

After you deploy with a READY verdict, you want to know if the site continues to work as expected in production.

Guardian's watchdog mode does this by:
1. **Establishing a baseline** from a known-good production state
2. **Monitoring on schedule** (every 5 minutes, hourly, etc.)
3. **Alerting on degradation** when flows break or performance drops

---

## How It Works

### Step 1: Create a Baseline

```bash
guardian reality --url https://production.com --baseline create
```

This runs Guardian against your live production site and saves the results as a baseline:

```
✅ Baseline created
Location: .odavlguardian/baseline-production-com-12-31-2025.json
Next step: Schedule watchdog monitoring
```

**What gets saved:**
- Which user flows ran successfully
- How long they took
- Coverage percentage
- Selector confidence scores
- Network safety signals

**When to create:**
- After a successful deployment
- After verifying the site works in production
- Whenever you intentionally change the site and want to update baseline

### Step 2: Schedule Watchdog Runs

```bash
# Run once
guardian reality --url https://production.com --watchdog

# Or schedule with your tool (cron, GitHub Actions, etc.)
0 * * * * guardian reality --url https://production.com --watchdog
```

**What watchdog does:**
1. Runs the same user flows as the baseline
2. Compares results to baseline
3. Alerts if things degrade
4. Reports no output if everything is normal (silent success)

### Step 3: Read Alerts

When watchdog detects degradation:

```
⚠️  DEGRADATION DETECTED

Verdict downgrade: READY → FRICTION
Reason: Checkout flow now slower (60s timeout)

Coverage: 70% → 50% (20% drop)

Action: Review production state and baseline
```

---

## What Triggers Alerts

Guardian alerts on:

**Verdict downgrade:**
- READY → FRICTION (some flows now broken or slow)
- READY → DO_NOT_LAUNCH (critical failure)
- FRICTION → DO_NOT_LAUNCH

**Coverage drops ≥20%:**
- Flows that were testable are now skipped
- Indicates missing features or changed site structure

**Selector confidence drops ≥0.2:**
- Element selectors no longer reliable
- Indicates page structure changed significantly

**Critical flows fail:**
- Flows that passed before now fail
- Specific flow-level degradation

---

## Interpreting Results

### Silent (No Output)

```bash
$ guardian reality --url https://production.com --watchdog
# No output
$ echo $?
0
```

**Meaning:** All is well. Exit code 0 (success).

---

### Degradation Alert

```
⚠️  DEGRADATION DETECTED: Verdict downgrade

Before (baseline): READY
Now: FRICTION

Reason: Checkout flow timeout (>60s)

Actions:
1. Review production state: https://production.com/checkout
2. Check backend logs for slowness
3. Verify CDN/network health
4. Run full Guardian report: guardian reality --url https://production.com
```

---

## Use Cases

### SaaS Platform Monitoring

```yaml
# GitHub Actions: Check production every 5 minutes
name: Guardian Watchdog
on:
  schedule:
    - cron: '*/5 * * * *'
jobs:
  monitor:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Check production
        run: |
          npx @odavl/guardian reality \
            --url https://app.example.com \
            --watchdog
      - name: Report on failure
        if: failure()
        run: |
          curl -X POST -H 'Content-type: application/json' \
            --data '{"text":"Guardian detected production degradation"}' \
            ${{ secrets.SLACK_WEBHOOK }}
```

### Post-Deployment Smoke Test

```bash
#!/bin/bash
# Run after every deploy to verify production works

PROD_URL="https://example.com"

echo "Checking production..."
guardian reality --url $PROD_URL --watchdog

if [ $? -ne 0 ]; then
  echo "⚠️  Production degradation detected"
  # Page devops team, trigger rollback, etc.
  exit 1
fi

echo "✅ Production healthy"
```

---

## Updating the Baseline

When you intentionally change the site (new feature, redesign, etc.), update the baseline:

```bash
guardian reality --url https://production.com --baseline update
```

**Behavior:**
- Only updates if current verdict is READY
- Preserves alert integrity (if site is broken, won't update)
- Creates timestamped backup of previous baseline

**When to update:**
- After deploying new features
- After design redesigns
- After removing old flows
- After intentional infrastructure changes

**Do NOT update if:**
- Site is broken (DO_NOT_LAUNCH or FRICTION)
- Changes are being rolled back
- You're still debugging issues

---

## Baseline Files

Guardian stores baselines in `.odavlguardian/`:

```
.odavlguardian/
├── baselines/
│   ├── production-com-12-31-2025.json     (current)
│   ├── production-com-12-30-2025.json     (previous)
│   └── production-com-12-29-2025.json     (older)
└── runs/
    └── 2025-12-31T15-22-10Z/
        ├── decision.json
        └── summary.md
```

**Multiple baselines:**
You can maintain separate baselines for different environments:

```bash
# Staging baseline
guardian reality --url https://staging.com --baseline create

# Production baseline
guardian reality --url https://production.com --baseline create
```

---

## Tips

**Cold starts after deployment:**
Run Guardian once manually right after deploying to establish initial production state. This gives watchdog a clean baseline.

**Prevent alert fatigue:**
If you get frequent false alerts, check if your site has legitimate variability (ads loading, slow network, etc.). Consider filtering in your alert rules.

**Keep baseline fresh:**
Update baseline after intentional changes, but not so frequently that you lose the ability to detect *actual* degradation.

**Correlate with logs:**
When Guardian detects degradation, correlate with application logs, infrastructure changes, or traffic spikes from that time.

