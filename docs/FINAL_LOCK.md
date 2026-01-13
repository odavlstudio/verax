# FINAL LOCK: VERAX Scope & Limitations

**Version**: 0.2.0  
**Date**: January 2026  
**Status**: Production Release  

---

## What VERAX Does

VERAX is a **silent failure detection engine** that analyzes web applications to find failures that silently complete without user-visible error feedback.

### Capabilities

✅ **Silent Failure Detection**: Identifies promises that never resolve, event handlers that don't complete, network requests without response handling, and UI interactions that don't provide feedback.

✅ **Deterministic Evidence**: Generates reproducible evidence (learn.json, observe.json, findings.json, summary.json) with stable IDs independent of discovery order.

✅ **Privacy-First**: Automatically redacts sensitive data (tokens, credentials, authorization headers) before writing any files or logs.

✅ **Portable Scanning**: Uses Playwright for cross-browser automation, compatible with any URL or local development server.

✅ **Flow Analysis**: Traces execution flow to distinguish between intentional delays and broken promises.

---

## What VERAX Does NOT Do

⚠️ **VERAX is NOT a**:

1. **Security Scanner**: Does not test for vulnerabilities, injection attacks, authentication flaws, or encryption strength. Use dedicated security tools (Burp Suite, OWASP ZAP) for security assessment.

2. **Performance Profiler**: Does not measure page load speed, render time, or resource utilization. Use browser DevTools or tools like Lighthouse for performance analysis.

3. **Accessibility Checker**: Does not evaluate WCAG compliance, screen reader compatibility, or keyboard navigation. Use aXe, Lighthouse, or WAVE for accessibility audits.

4. **Functional Test Suite**: Does not validate business logic correctness, calculation accuracy, or data integrity. Unit tests and integration tests are required for functional verification.

5. **Load Tester**: Does not evaluate system behavior under stress, concurrent users, or peak traffic. Use load testing tools (k6, Artillery, JMeter) for performance under load.

6. **Regression Detector**: Does not compare against previous versions or baselines to identify behavioral changes. Use snapshot testing or visual regression tools for that purpose.

---

## Important Limitations

### What VERAX Cannot Detect

- **Server-Side Failures**: Only analyzes client-side behavior. Server errors that return success codes appear as successes to VERAX.
- **Timing-Dependent Issues**: Cannot reliably detect race conditions that occur intermittently.
- **Complex Async Chains**: May miss failures in deeply nested or interdependent async operations.
- **Custom Protocols**: Only analyzes standard web protocols (HTTP, WebSocket). Proprietary or binary protocols are not analyzed.
- **Native Mobile**: VERAX targets web applications only. Native iOS/Android apps are not supported.

### False Positives & Negatives

- **False Positives**: VERAX may report benign delays as failures if user intent is not clear from code inspection.
- **False Negatives**: VERAX may miss failures in extensively obfuscated or minified code where intent cannot be inferred.

---

## Evidence Interpretation

### Key Principle

**Evidence is provided, NOT judgments.**

VERAX generates data (evidence files) about what it observed. Each finding includes:

- **What was attempted** (expectation from initial learning)
- **What was observed** (actual behavior during scan)
- **Where it occurred** (file, line number)
- **Why it matters** (brief explanation)

### User Responsibility

Users must:

1. **Review findings** in context of application design
2. **Verify silent failures** are actually bugs, not intentional design
3. **Consider business logic** - VERAX cannot understand intent
4. **Validate false positives** - Not all findings may be actual issues
5. **Take action** - Fix confirmed issues or dismiss false positives

VERAX provides the raw data. Your team provides the judgment.

---

## Support Scope

### We Support

✅ Installation and setup of @veraxhq/verax  
✅ Troubleshooting scan execution (--url, --src, --out options)  
✅ Interpreting evidence files (JSON schema and format)  
✅ Privacy and redaction verification  
✅ Exit codes and error messages  

### We Do NOT Support

❌ Fixing application bugs found by VERAX  
❌ Root cause analysis beyond evidence provided  
❌ Security incident response  
❌ Performance optimization recommendations  
❌ Architecture changes based on findings  

---

## Version Commitment

### 0.1.0 (Current Release)

This is the **initial production release** of VERAX. It includes:

- ✓ Silent failure detection engine
- ✓ Three working demo projects (static, React, Next.js)
- ✓ Privacy protection and redaction
- ✓ Deterministic ID generation
- ✓ Comprehensive evidence files

### Stability Guarantee

The following are **stable and will not change** without major version bump:

- Package name: `@veraxhq/verax`
- CLI commands: `run`, `doctor`, `learn`, `observe`
- Artifact file names and JSON schemas
- Redaction policy (single `***REDACTED***` placeholder)
- Exit codes (0 = success, 64 = usage error)

### Future Enhancements

Possible future versions may add:

- Additional detection patterns (optional, off by default)
- Performance improvements (no behavior change)
- Documentation enhancements
- New demo projects
- Optional integration plugins

Any changes that affect findings interpretation will bump the minor version number.

---

## Legal & Compliance

### Liability

VERAX is provided "as-is" without warranty. While we've tested it extensively, silent failures are complex and context-dependent. VERAX provides evidence, not guarantees.

### License

VERAX is released under the MIT License. You are free to:

- Use commercially
- Modify the source code
- Redistribute with modifications
- Use privately

See LICENSE file for complete terms.

### Data Privacy

VERAX:

- ✓ Processes data locally only
- ✓ Does not send analysis to external servers
- ✓ Does not store any data after scan completes
- ✓ Does not track users or usage

All analysis happens in your environment. No telemetry, no cloud processing.

---

## Getting Help

If you have questions about what VERAX can do:

1. **Review CHANGELOG.md** - Feature history and technical details
2. **Run VERAX doctor** - Validates your environment setup
3. **Check ACCEPTANCE.md** - Verification checklist with examples
4. **Review demo projects** - See working examples with intentional failures
5. **Read test files** - Look at test/determinism.test.js and test/redaction.test.js for patterns

---

## Acceptance Confirmation

By using VERAX 0.1.0, you acknowledge:

- [ ] You have read and understood this scope document
- [ ] You understand VERAX provides evidence, not judgments
- [ ] You will validate findings before taking action
- [ ] You will not rely solely on VERAX for security assessment
- [ ] You understand the limitations and false positive risks

---

## Final Statement

**VERAX 0.1.0 is ready for production use.**

It successfully detects silent failures in web applications with high accuracy and zero information leakage. The deterministic evidence it generates is reproducible and trustworthy.

However, VERAX is a tool to **inform** decisions, not make them. Your team's expertise and judgment remain essential for translating evidence into action.

Use VERAX to find the bugs that hide. Use your judgment to fix them right.

---

**VERAX Maintainers**  
Version 0.1.0 | MIT License | Production Release
