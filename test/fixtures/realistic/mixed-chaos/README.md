# Mixed Chaos Fixture

## What This Simulates
A realistic application with multiple types of failures across different technologies and patterns (worst-case scenario).

## Capabilities Exercised
- All navigation capabilities
- All network capabilities
- `state-detection-usestate`
- `state-detection-redux`
- `state-detection-zustand`
- `state-mutation-observation`
- `state-silent-failure`
- `ui-feedback-loading`
- `ui-feedback-disabled`
- `ui-feedback-toast`
- `ui-feedback-dom-change`
- `ui-feedback-intelligence`
- `ui-feedback-missing`
- `validation-feedback-detection`
- `validation-silent-failure`
- `confidence-unified-system`
- `evidence-law-enforcement`
- `evidence-substantive-check`
- `evidence-downgrade-suspected`

## Intentional Silent Failures

### 1. CONFIRMED: Mixed Navigation Failure (navigation-silent-failure)
- **Location**: Multiple pages
- **Issue**: Links, buttons, and programmatic navigation all fail silently
- **Expected**: Should be reported as CONFIRMED findings

### 2. CONFIRMED: Network Cascade Failure (network-silent-failure)
- **Location**: Multiple components
- **Issue**: Multiple network requests fail silently in sequence
- **Expected**: Should be reported as CONFIRMED findings

### 3. FALSE POSITIVE TRAP: Multiple Analytics (should NOT be reported)
- **Location**: Multiple pages
- **Issue**: Various analytics tracking that intentionally do nothing
- **Expected**: Should NOT be reported

### 4. PARTIAL/AMBIGUOUS: State Race Condition (confidence < 1)
- **Location**: State management components
- **Issue**: State updates may or may not work due to race conditions
- **Expected**: Should be reported with MEDIUM confidence

### 5. CONFIRMED: Evidence Law Violation (evidence-law-enforcement)
- **Location**: Findings generation
- **Issue**: Findings marked CONFIRMED without sufficient evidence
- **Expected**: Should be downgraded to SUSPECTED by Evidence Law

## Determinism Rules
- All failures are deterministic
- No random behavior
- No external dependencies
- Predictable failure patterns

