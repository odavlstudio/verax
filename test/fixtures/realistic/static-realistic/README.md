# Static Realistic Fixture

## What This Simulates
A realistic multi-page static website (e.g., marketing site, documentation site) with intentional silent failures.

## Capabilities Exercised
- `link-detection-href`
- `interactive-element-no-href`
- `navigation-silent-failure`
- `external-navigation-blocking`
- `network-detection-handler`
- `network-request-observation`
- `network-silent-failure`
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
- `guardrails-truth-reconciliation`
- `confidence-engine-hardening`
- `determinism-hardening`
- `security-baseline-enforcement`
- `ga-release-readiness`
- `enterprise-operational-guarantees`
- `performance-budget-clarity`

## Intentional Silent Failures

### 1. CONFIRMED: Broken Contact Form (navigation-silent-failure)
- **Location**: `contact.html`
- **Issue**: Form submission button promises navigation to `/thank-you` but fails silently
- **Expected**: Should be reported as CONFIRMED finding with evidence

### 2. CONFIRMED: Newsletter Signup Button (navigation-silent-failure)
- **Location**: `index.html`
- **Issue**: Button with `onclick` promises navigation but `preventDefault()` is called
- **Expected**: Should be reported as CONFIRMED finding

### 3. CONFIRMED: Broken Navigation Button (interactive-element-no-href)
- **Location**: `interactive.html`
- **Issue**: Button without href promises navigation to `/about.html` but fails silently
- **Expected**: Should be reported as CONFIRMED finding with evidence

### 4. CONFIRMED: Broken Action Div (interactive-element-no-href)
- **Location**: `interactive.html`
- **Issue**: Clickable div without href promises action but fails silently
- **Expected**: Should be reported as CONFIRMED finding with evidence

### 5. FALSE POSITIVE TRAP: Analytics Link (should NOT be reported)
- **Location**: `index.html`
- **Issue**: Link to `/analytics` that intentionally does nothing (analytics tracking)
- **Expected**: Should NOT be reported (no user-facing promise)

### 6. FALSE POSITIVE TRAP: Analytics Button (should NOT be reported)
- **Location**: `interactive.html`
- **Issue**: Analytics tracking button that intentionally does nothing
- **Expected**: Should NOT be reported (analytics-only, not user-facing)

### 7. FALSE POSITIVE TRAP: Noop Handler (should NOT be reported)
- **Location**: `interactive.html`
- **Issue**: Button with noop handler - not a user-facing promise
- **Expected**: Should NOT be reported (noop handler, not a promise)

### 8. GUARDRAILS: Disabled Button (should NOT be reported)
- **Location**: `interactive.html`
- **Issue**: Disabled button - interaction is prevented, not a silent failure
- **Expected**: Should NOT be reported (disabled interaction is informational)

### 9. GUARDRAILS: Prevented Interaction (should NOT be reported)
- **Location**: `interactive.html`
- **Issue**: Button with preventDefault - interaction is explicitly prevented
- **Expected**: Should NOT be reported (prevented interaction is informational)

### 10. PARTIAL/AMBIGUOUS: Search Form (confidence < 1)
- **Location**: `search.html`
- **Issue**: Form submission may or may not work (depends on server state)
- **Expected**: Should be reported with MEDIUM confidence

### 11. AMBIGUOUS: Conditional Action (confidence < 1)
- **Location**: `interactive.html`
- **Issue**: Button that may or may not work depending on state
- **Expected**: Should be reported with MEDIUM confidence

### 12. AMBIGUOUS: Guarded Interaction (confidence < 1)
- **Location**: `interactive.html`
- **Issue**: Button with guard condition that may prevent action
- **Expected**: Should be reported with MEDIUM confidence

### 13. CONFIRMED: Missing Validation Feedback (validation-silent-failure)
- **Location**: `contact.html`
- **Issue**: Invalid email submission proceeds without feedback
- **Expected**: Should be reported as validation_silent_failure

### 14. CONFIRMED: Broken Submit Form (network-silent-failure)
- **Location**: `network.html`
- **Issue**: Form submission promises network request but fails silently (no error, no feedback)
- **Expected**: Should be reported as CONFIRMED finding with network evidence

### 15. CONFIRMED: Broken Save Action (network-silent-failure)
- **Location**: `network.html`
- **Issue**: Button promises network request but fails silently (no error, no feedback)
- **Expected**: Should be reported as CONFIRMED finding with network evidence

### 16. FALSE POSITIVE TRAP: Analytics Beacon (should NOT be reported)
- **Location**: `network.html`
- **Issue**: Analytics tracking request that intentionally does nothing
- **Expected**: Should NOT be reported (analytics-only, not user-facing)

### 17. FALSE POSITIVE TRAP: Background Polling (should NOT be reported)
- **Location**: `network.html`
- **Issue**: Background polling request that intentionally does nothing
- **Expected**: Should NOT be reported (background polling, not user-facing)

### 18. GUARDRAILS: Network Success + No UI (should NOT be CONFIRMED)
- **Location**: `network.html`
- **Issue**: Network request succeeds but no UI feedback provided
- **Expected**: Should be SUSPECTED, not CONFIRMED (guardrails applied)

### 19. AMBIGUOUS: Optimistic UI (confidence < 1)
- **Location**: `network.html`
- **Issue**: Network request with optimistic UI update - ambiguous whether failure is silent
- **Expected**: Should be reported with MEDIUM confidence

### 20. AMBIGUOUS: Retry Logic (confidence < 1)
- **Location**: `network.html`
- **Issue**: Network request with retry logic - ambiguous whether failure is silent
- **Expected**: Should be reported with MEDIUM confidence

### 21. CONFIRMED: Missing Loading Indicator (ui-feedback-missing)
- **Location**: `feedback.html`
- **Issue**: Action promises loading indicator but none appears
- **Expected**: Should be reported as CONFIRMED finding with evidence

### 22. CONFIRMED: Missing Success Feedback (ui-feedback-missing)
- **Location**: `feedback.html`
- **Issue**: Action completes successfully but no feedback is shown
- **Expected**: Should be reported as CONFIRMED finding with evidence

### 23. CONFIRMED: Missing Error Feedback (ui-feedback-missing)
- **Location**: `feedback.html`
- **Issue**: Action fails but no error message is shown
- **Expected**: Should be reported as CONFIRMED finding with evidence

### 24. FALSE POSITIVE TRAP: Loading Indicator Present (should NOT be reported)
- **Location**: `feedback.html`
- **Issue**: Action shows loading indicator - feedback exists
- **Expected**: Should NOT be reported (feedback present, not a silent failure)

### 25. FALSE POSITIVE TRAP: Toast Notification Present (should NOT be reported)
- **Location**: `feedback.html`
- **Issue**: Action shows toast notification - feedback exists
- **Expected**: Should NOT be reported (feedback present, not a silent failure)

### 26. FALSE POSITIVE TRAP: DOM Change Present (should NOT be reported)
- **Location**: `feedback.html`
- **Issue**: Action causes visible DOM change - feedback exists
- **Expected**: Should NOT be reported (feedback present, not a silent failure)

### 27. GUARDRAILS: Validation Feedback Present (should NOT be reported)
- **Location**: `feedback.html`
- **Issue**: Validation feedback is shown - prevents silent failure claim
- **Expected**: Should NOT be reported (validation feedback present)

### 28. AMBIGUOUS: Delayed Feedback (confidence < 1)
- **Location**: `feedback.html`
- **Issue**: Feedback appears after delay - ambiguous whether failure is silent
- **Expected**: Should be reported with MEDIUM confidence

### 29. AMBIGUOUS: Partial DOM Change (confidence < 1)
- **Location**: `feedback.html`
- **Issue**: Partial DOM change occurs - ambiguous whether feedback is sufficient
- **Expected**: Should be reported with MEDIUM confidence

### 30. AMBIGUOUS: Button State Change Only (confidence < 1)
- **Location**: `feedback.html`
- **Issue**: Only button state changes - ambiguous whether feedback is sufficient
- **Expected**: Should be reported with MEDIUM confidence

## Determinism Rules
- All links use relative paths
- No external network calls
- No random data
- No time-based behavior

