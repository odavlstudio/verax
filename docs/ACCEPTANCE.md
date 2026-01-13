# VERAX 0.2.0 Acceptance Checklist

This checklist verifies that VERAX CLI is production-ready. Each item should be completed and verified before deployment.

## Pre-Acceptance Environment Setup

Before running the acceptance tests, ensure:

```bash
# 1. Navigate to the repository root
cd /path/to/verax

# 2. Install the CLI globally (or use npx verax)
npm install -g @veraxhq/verax

# 3. Verify you have Node.js 18+
node --version

# 4. Start a demo server
cd demos/demo-static
python3 -m http.server 8000  # or: npx http-server
```

---

## Acceptance Items

### ✓ Item 1: Installation Verification

**Objective**: Confirm @veraxhq/verax can be installed and runs

**Steps**:
```bash
npm list -g @veraxhq/verax
```

**Expected Result**: Package appears in global packages with version 0.2.0

**Status**: [ ] Pass / [ ] Fail

---

### ✓ Item 2: Version Reporting

**Objective**: CLI reports correct version

**Steps**:
```bash
verax --version
```

**Expected Result**: Output shows `0.2.0`

**Status**: [ ] Pass / [ ] Fail

---

### ✓ Item 3: Help Command

**Objective**: Help text is complete and accurate

**Steps**:
```bash
verax --help
```

**Expected Result**: Output includes all commands (run, inspect, doctor) with usage examples

**Status**: [ ] Pass / [ ] Fail

---

### ✓ Item 4: Environment Validation (Doctor Command)

**Objective**: `doctor` command detects environment readiness

**Steps**:
```bash
verax doctor --json
```

**Expected Result**: JSON output includes:
- ✓ Node.js version check (>= 18.0.0)
- ✓ Playwright browser availability
- ✓ File system write permissions
- All checks return `"status": "ok"`

**Status**: [ ] Pass / [ ] Fail

---

### ✓ Item 5: Scan Execution (Run Command)

**Objective**: Full scan completes successfully

**Steps**:
```bash
# With demo server running on port 8000:
verax run --url http://localhost:8000 --src ./demos/demo-static --out ./test-artifacts
```

**Expected Result**: 
- CLI completes without errors
- Exit code is 0
- Output confirms scan finished
- No unhandled exceptions

**Status**: [ ] Pass / [ ] Fail

---

### ✓ Item 6: Artifacts Generation

**Objective**: All required evidence files are created

**Steps**:
```bash
# After Item 5 scan, verify:
ls -la test-artifacts/
```

**Expected Result**: Directory contains:
- `learn.json` - Learned expectations (JSON format)
- `observe.json` - Observed behavior (JSON format)
- `findings.json` - Detected issues (JSON format)
- `summary.json` - Summary with digest (includes counts)

All files are valid JSON and non-empty.

**Status**: [ ] Pass / [ ] Fail

---

### ✓ Item 7: Silent Failure Detection Accuracy

**Objective**: VERAX correctly identifies intentional silent failures

**Steps**:
```bash
# Run on demo-static (has intentional silent failure)
verax run --url http://localhost:8000 --src ./demos/demo-static --out ./test-demo-static

# Check findings
cat test-demo-static/findings.json | jq '.findings[0] // "NO FINDINGS"'
```

**Expected Result**: 
- `findings.json` contains at least one finding
- Finding describes a silent failure (link without href, missing handler, or incomplete flow)
- Finding includes file location and line number

**Status**: [ ] Pass / [ ] Fail

---

### ✓ Item 8: Deterministic Ordering

**Objective**: Multiple runs produce identical IDs and ordering

**Steps**:
```bash
# Run scan twice on same target
verax run --url http://localhost:8000 --src ./demos/demo-static --out ./test-run-1
verax run --url http://localhost:8000 --src ./demos/demo-static --out ./test-run-2

# Compare findings IDs
cat test-run-1/findings.json | jq '.findings | map(.expectationId) | sort'
cat test-run-2/findings.json | jq '.findings | map(.expectationId) | sort'
```

**Expected Result**: 
- Both runs produce identical expectation IDs
- Findings appear in same order
- No randomization in output

**Status**: [ ] Pass / [ ] Fail

---

### ✓ Item 9: Privacy Protection (No Secrets in Evidence)

**Objective**: Sensitive data is redacted before writing files

**Steps**:
```bash
# Verify no exposed secrets in any artifact
grep -r "Bearer " test-artifacts/ || echo "✓ No Bearer tokens"
grep -r "Authorization" test-artifacts/ || echo "✓ No auth headers"
grep -r "api_key=" test-artifacts/ || echo "✓ No API keys"

# Check for redaction placeholder
grep -r "REDACTED" test-artifacts/ && echo "✓ Redaction confirmed"
```

**Expected Result**: 
- No sensitive data (tokens, keys, credentials) in any JSON file
- All sensitive values are replaced with `***REDACTED***`
- No Authorization/Cookie headers in plain text

**Status**: [ ] Pass / [ ] Fail

---

### ✓ Item 10: Exit Codes

**Objective**: CLI returns correct exit codes for all scenarios

**Steps**:
```bash
# Success case
verax run --url http://localhost:8000 --src ./demos/demo-static --out ./test-ec-success
echo "Exit code: $?"

# Usage error (missing required arg)
verax run --url http://localhost:8000
echo "Exit code: $?"

# Help command
verax --help
echo "Exit code: $?"
```

**Expected Result**: 
- Success scan: exit code **0**
- Usage error (missing --src): exit code **64**
- Help command: exit code **0**

**Status**: [ ] Pass / [ ] Fail

---

## Summary

**Total Items**: 10  
**Passed**: ___/10  
**Failed**: ___/10  

### Acceptance Decision

- **ACCEPT** (10/10 passed): VERAX 0.1.0 is production-ready
- **CONDITIONAL** (9/10 passed): Requires investigation of 1 failed item
- **REJECT** (< 9/10 passed): Requires fixes before release

### Notes

If any item fails, document the issue and steps to reproduce in this section:

```
Failed Item: ___
Reproduction: ___
Error Message: ___
Root Cause: ___
Resolution: ___
```

---

## Sign-Off

**Acceptance Date**: ________________  
**Accepted By**: ________________  
**Version**: 0.2.0  
**Timestamp**: ________________  

This document confirms that VERAX 0.2.0 meets all acceptance criteria and is approved for production deployment.
