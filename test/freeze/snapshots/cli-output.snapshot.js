// Canonical CLI Output Snapshots for Surface Freeze
// Normalized: timestamps and paths stripped, exact section ordering and wording frozen

module.exports = {
  ready_high: `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
GUARDIAN REALITY TEST
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Target: https://example.com
Run ID: (normalized)

EXECUTION SUMMARY
──────────────────────────────────────────────────────────────────────
Planned:  9 attempts
Executed: 9 attempts

VERDICT
──────────────────────────────────────────────────────────────────────
Status: READY

Reason: All critical flows executed successfully and goals reached

What Guardian Tested: 9 attempts
- site_smoke: SUCCESS
- primary_ctas: SUCCESS
- contact_discovery_v2: SUCCESS
- contact_form: SUCCESS
- language_switch: SUCCESS
- newsletter_signup: SUCCESS
- signup: SUCCESS
- login: SUCCESS
- checkout: SUCCESS

What Guardian Did Not Test: 0 gaps

CONFIDENCE SIGNALS
──────────────────────────────────────────────────────────────────────
Overall Confidence: HIGH

Outcome Score: Complete (all 9 attempts executed)
Coverage Score: Complete (0 gaps)
Evidence Score: Complete (reports captured)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
FINAL RECOMMENDATION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Site is ready for production. All critical flows passed.

Full report: (normalized)
Exit code: 0

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`.trim(),

  friction_medium: `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
GUARDIAN REALITY TEST
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Target: https://example.com
Run ID: (normalized)

EXECUTION SUMMARY
──────────────────────────────────────────────────────────────────────
Planned:  5 attempts
Executed: 5 attempts

VERDICT
──────────────────────────────────────────────────────────────────────
Status: FRICTION

Reason: Evidence is mixed: 2 failed attempt(s); 1 friction attempt(s).

What Guardian Tested: 5 attempts
- site_smoke: SUCCESS
- primary_ctas: FAILURE
- checkout: FRICTION
- contact_form: SUCCESS
- login: SUCCESS

What Guardian Did Not Test: 0 gaps

CONFIDENCE SIGNALS
──────────────────────────────────────────────────────────────────────
Overall Confidence: MEDIUM

Outcome Score: Partial (4 of 5 attempts succeeded)
Coverage Score: Complete (0 gaps)
Evidence Score: Partial (reports and screenshots captured)

FAILURES & FRICTION
──────────────────────────────────────────────────────────────────────
2 failure(s) detected:
- primary_ctas: Navigation step failed; element unresponsive
- checkout: Form submission timeout; payment gateway unreachable

1 friction signal(s):
- contact_form: Form submitted but validation warning appears

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
FINAL RECOMMENDATION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Site has issues. Review failures above and fix before launch.

Full report: (normalized)
Exit code: 1

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`.trim(),

  do_not_launch_low: `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
GUARDIAN REALITY TEST
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Target: https://example.com
Run ID: (normalized)

EXECUTION SUMMARY
──────────────────────────────────────────────────────────────────────
Planned:  3 attempts
Executed: 1 attempt
Skipped:  2 attempts
          (2 not applicable)

VERDICT
──────────────────────────────────────────────────────────────────────
Status: DO_NOT_LAUNCH

Reason: Guardian reached verdict: DO_NOT_LAUNCH based on observed evidence.

What Guardian Tested: 1 attempt
- site_smoke: FAILURE

What Guardian Did Not Test: 2 gaps
- critical_flow_a: Not applicable to this site type
- critical_flow_b: Not applicable to this site type

CONFIDENCE SIGNALS
──────────────────────────────────────────────────────────────────────
Overall Confidence: LOW

Outcome Score: Failed (critical flow did not pass)
Coverage Score: Limited (2 of 3 attempts not applicable)
Evidence Score: Limited (minimal evidence captured)

FAILURES & FRICTION
──────────────────────────────────────────────────────────────────────
1 failure(s) detected:
- site_smoke: Critical infrastructure issue detected; site unreachable

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
FINAL RECOMMENDATION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

DO NOT LAUNCH. Critical failures detected. Investigate immediately.

Full report: (normalized)
Exit code: 2

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`.trim()
};
