# VERAX CI Integration — Quick Start

## GitHub Actions Badge

Add this badge to your README.md:

```markdown
[![VERAX Silent Failure Detection](https://github.com/YOUR_ORG/YOUR_REPO/actions/workflows/verax.yml/badge.svg)](https://github.com/YOUR_ORG/YOUR_REPO/actions/workflows/verax.yml)
```

Replace `YOUR_ORG/YOUR_REPO` with your repository path.

## Copy-Paste Workflow

Create `.github/workflows/verax.yml`:

```yaml
name: VERAX Silent Failure Detection

on:
  pull_request:
    types: [opened, synchronize, reopened]
  push:
    branches:
      - main

jobs:
  verax-scan:
    name: Scan for Silent Failures
    runs-on: ubuntu-latest
    
    steps:
      - name: Checkout code
        uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '18'
      
      - name: Install VERAX
        run: npm install -g @veraxhq/verax
      
      - name: Run VERAX scan
        run: |
          verax run https://your-app-url.com \
            --ci-mode=strict \
            --min-coverage=0.90
```

## Exit Code Reference

| Exit Code | Meaning | CI Behavior |
|-----------|---------|-------------|
| 0 | SUCCESS — No issues detected | ✅ Pass |
| 10 | NEEDS_REVIEW — Suspected findings only | ✅ Pass (warning) |
| 20 | FAILURE_CONFIRMED — Confirmed silent failures | ❌ Fail |
| 30 | FAILURE_INCOMPLETE — Coverage/validation incomplete | ❌ Fail |
| 40 | INFRA_FAILURE — Runtime error | ❌ Fail |
| 50 | EVIDENCE_VIOLATION — Corrupted artifacts | ❌ Fail |
| 64 | USAGE_ERROR — Invalid command/flags | ❌ Fail |

## Advanced Configuration

### Custom Coverage Threshold

```yaml
- name: Run VERAX scan (relaxed coverage)
  run: verax run https://your-app.com --ci-mode=balanced --min-coverage=0.70
```

### Upload Artifacts on Failure

```yaml
- name: Upload VERAX artifacts on failure
  if: failure()
  uses: actions/upload-artifact@v4
  with:
    name: verax-artifacts-${{ github.run_id }}
    path: .verax/
    retention-days: 7
```

### Scan with Authentication

```yaml
- name: Run VERAX scan (authenticated)
  env:
    AUTH_TOKEN: ${{ secrets.AUTH_TOKEN }}
  run: |
    verax run https://your-app.com \
      --ci-mode=strict \
      --auth-header="Authorization: Bearer $AUTH_TOKEN"
```

## CI Mode Behavior

VERAX automatically detects CI environments and applies strict defaults:

- **First-run relaxed defaults are DISABLED** in CI
- Coverage threshold: 0.90 (unless explicitly overridden)
- CI mode: `strict` (recommended for gating)
- All runs treated as non-first-run for determinism

## Local vs CI

| Setting | Local First Run | Local Subsequent | CI (Any Run) |
|---------|----------------|------------------|--------------|
| Min Coverage | 0.50 | 0.90 | 0.90 |
| CI Mode | advisory | balanced | strict |
| First-Run Messages | Yes | No | No |

## Troubleshooting

**Exit 30 (INCOMPLETE)**: Increase timeout or reduce coverage threshold:
```yaml
run: verax run URL --min-coverage=0.80
```

**Exit 40 (INFRA_FAILURE)**: Check Node.js version (18+ required) and network connectivity.

**Exit 50 (EVIDENCE_VIOLATION)**: Re-run scan — likely transient issue.

**Exit 64 (USAGE_ERROR)**: Check command syntax — `--url` is required.

## No Secrets Required

VERAX runs read-only scans and requires NO secrets by default. Add authentication only if scanning protected routes.
