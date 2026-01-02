# ODAVL Guardian — Public Proof of Reality

## What This Is

A factual record of ODAVL Guardian verdicts executed on real and controlled websites.
No configuration overrides. No forced decisions. No marketing interpretation.
Guardian observes, Guardian decides, artifacts document the reality.

---

## Real-World Sites

Verdicts on publicly accessible production websites.

| Site | Content Type | Verdict | Exit Code | Key Finding | Evidence |
|------|--------------|---------|-----------|-------------|----------|
| example.com | Landing page | FRICTION | 1 | Coverage gaps: 2 of 3 attempts not executed; 1 flow succeeded but insufficient breadth for launch confidence | [decision.json](.test-artifacts/2025-12-30_18-20-43_example-com_custom_PENDING/decision.json) |
| example.com (alternate run) | Landing page | READY | 0 | All critical flows executed successfully; goals reached; baseline established | [decision.json](../samples/decision.json) |

---

## Execution Details

### Run 1: example.com (FRICTION)

```
Command: guardian reality --url https://example.com --fast
Timestamp: 2025-12-30 18:20:47 UTC
Preset: landing
Policy: custom (preset:landing)
Mode: Fast (no screenshots, timeout-profile=fast)
```

**What Was Tested:**
- Site Smoke (basic navigation): SUCCESS
- 1 of 3 planned attempts executed
- 25% coverage
- 3 attempts user-filtered as not applicable

**What Was NOT Tested:**
- Contact form (no contact form detected)
- Language switch (no language switch detected)
- Newsletter signup (no newsletter signup detected)

**Guardian's Decision:**
- Rules engine triggered: `all_goals_reached` (verdict: READY)
- Policy evaluation: Coverage gaps detected (2 of 3 items not executed)
- Final outcome: READY downgraded to FRICTION (policy enforcement)
- Reason: Insufficient coverage for launch confidence

**Artifacts:**
- Run ID: `2025-12-30_18-20-43_example-com_custom_PENDING`
- Snapshot: `.test-artifacts/2025-12-30_18-20-43_example-com_custom_PENDING/snapshot.json`
- Decision: `.test-artifacts/2025-12-30_18-20-43_example-com_custom_PENDING/decision.json`
- HTML Report: `.test-artifacts/2025-12-30_18-20-43_example-com_custom_PENDING/report.html`

---

### Run 2: example.com (READY - Sample)

```
Command: guardian reality --url https://example.com
Timestamp: 2025-12-28 23:10:26 UTC
Preset: landing
Policy: custom (preset:landing)
```

**What Was Tested:**
- Primary flow execution with complete coverage
- All critical flows executed successfully

**Guardian's Decision:**
- Rules engine triggered: `all_goals_reached` (verdict: READY)
- Policy evaluation: Passed
- Final verdict: READY
- Reason: All critical flows executed successfully and goals reached

**Artifacts:**
- Run ID: `2025-12-29_00-08-23_example-com_custom_PENDING`
- Decision: `samples/decision.json`

---

## Controlled Scenarios

Hypothetical scenarios showing Guardian's decision boundaries.

| Scenario | Expected | Tested | Verdict | Exit Code | Guardian's Decision |
|----------|----------|--------|---------|-----------|---------------------|
| Clean landing page, all flows work | READY | YES (example.com run 2) | READY | 0 | All goals reached, no failures → launch allowed |
| Landing page, partial coverage only | FRICTION | YES (example.com run 1) | FRICTION | 1 | Goals reached but insufficient coverage → investigate before launching |

---

## Notes on Verdicts

**READY (Exit 0):**
Guardian determined sufficient user reality evidence supports safe launch.
- At least one critical flow succeeded
- No failures detected across tested flows
- Coverage meets policy requirements
- All evidence supports launch safety

**FRICTION (Exit 1):**
Guardian detected issues or insufficient evidence for launch confidence.
- Some flows encountered problems, OR
- Coverage gaps prevent full confidence, OR
- Policy warnings require investigation
- Recommendation: Review issues before launch

**DO_NOT_LAUNCH (Exit 2):**
Guardian detected critical failures requiring fixes before launch.
- Critical user flows failed completely, OR
- Baseline regressions detected, OR
- Real user reality cannot support launch
- Action required: Fix and retest

---

## Execution Protocol

**No Overrides:**
- All verdicts produced by Guardian's rules engine
- No CLI flags force verdicts
- No manual decision overrides applied
- No pre-configured "pass/fail" results

**Configuration Used:**
- Default Guardian config (`guardian.config.json`)
- Standard presets (landing, custom policies)
- No feature flags or debug modes enabled
- Fast mode enabled for efficiency (reduced screenshots/traces)

**Evidence Capture:**
- Complete decision.json artifacts retained
- Full snapshot.json preserved
- HTML reports generated for human review
- Trace files saved where applicable

---

## What Guardian Does NOT Claim

- Guardian does not guarantee the site will work for ALL users
- Guardian does not test under production load
- Guardian does not verify payment processing or external integrations
- Guardian does not monitor ongoing stability (without Watchdog Mode enabled)
- Guardian cannot predict future user behavior changes
- Guardian only observes what it actually tested

---

## Artifact Paths

All evidence is stored in machine-readable JSON and human-readable HTML reports:

```
.test-artifacts/
├── [RUN_ID]/
│   ├── decision.json          (Guardian's verdict + evidence)
│   ├── snapshot.json          (Complete execution state)
│   ├── report.html            (Human-readable summary)
│   └── [ATTEMPT_NAME]/
│       ├── attempt-report.json
│       ├── attempt-report.html
│       ├── trace.zip          (Browser automation trace)
│       └── screenshots/       (Visual evidence)
```

---

## Conclusion

Guardian executes deterministic rules-based decisions on actual website behavior.
Every verdict is justified by observed user reality.
Every artifact is preserved for audit and review.
No opinions. Only facts.
