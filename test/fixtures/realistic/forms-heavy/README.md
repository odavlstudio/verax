# Forms Heavy Fixture

## What This Simulates
A realistic form-heavy application (e.g., survey tool, data entry system) with intentional silent failures.

## Capabilities Exercised
- `validation-feedback-detection`
- `validation-silent-failure`
- `network-detection-handler`
- `network-silent-failure`
- `state-detection-usestate`
- `state-mutation-observation`
- `state-silent-failure`
- `ui-feedback-loading`
- `ui-feedback-disabled`
- `ui-feedback-toast`
- `ui-feedback-dom-change`
- `ui-feedback-intelligence`
- `ui-feedback-missing`
- `confidence-unified-system`
- `evidence-law-enforcement`
- `evidence-substantive-check`
- `evidence-downgrade-suspected`

## Intentional Silent Failures

### 1. CONFIRMED: Registration Form Submission (network-silent-failure)
- **Location**: `register.html`
- **Issue**: Form promises POST request but fails silently
- **Expected**: Should be reported as CONFIRMED finding

### 2. CONFIRMED: Missing Validation Feedback (validation-silent-failure)
- **Location**: `contact.html`
- **Issue**: Invalid email submission proceeds without feedback
- **Expected**: Should be reported as validation_silent_failure

### 3. FALSE POSITIVE TRAP: Hidden Form Field (should NOT be reported)
- **Location**: `contact.html`
- **Issue**: Hidden honeypot field that intentionally does nothing
- **Expected**: Should NOT be reported

### 4. PARTIAL/AMBIGUOUS: Multi-step Form (confidence < 1)
- **Location**: `wizard.html`
- **Issue**: Form progression may or may not work (depends on step)
- **Expected**: Should be reported with MEDIUM confidence

### 5. CONFIRMED: Missing Submit Feedback (ui-feedback-missing)
- **Location**: `survey.html`
- **Issue**: Submit button promises loading state but none appears
- **Expected**: Should be reported as missing UI feedback

## Determinism Rules
- All form submissions use mock endpoints
- No external dependencies
- No random validation
- Deterministic form behavior

